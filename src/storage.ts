import { CATEGORY_COLORS, defaultCalendarPrefs, STATUSES, TYPES, KEY, defaultSettings, safeLink, validDate, validateEvent, seedData, type CalendarPrefs, type CategoryDef, type Data, type SchoolHoliday, type Settings } from './model.ts';
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const string = (v: unknown, max = 10000): v is string => typeof v === 'string' && v.length <= max;
const id = (v: unknown): v is string => string(v, 150) && /^[a-zA-Z0-9_-]+$/.test(v);
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 9e15;
const text = (v: unknown, max: number) => (string(v, max) ? v : '');
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }

// 달력 표시 설정은 보기 취향일 뿐이라, 값이 이상하면 막지 않고 기본값으로 되돌린다.
function parseCalendarPrefs(input: unknown): CalendarPrefs {
  const base = defaultCalendarPrefs();
  if (!isObj(input)) return base;
  const pick = <K extends keyof CalendarPrefs>(key: K, allowed: readonly CalendarPrefs[K][]) =>
    (allowed as readonly unknown[]).includes(input[key as string]) ? input[key as string] as CalendarPrefs[K] : base[key];
  return {
    weekStart: pick('weekStart', [0, 1]),
    density: pick('density', ['compact', 'normal', 'roomy']),
    fontScale: pick('fontScale', ['small', 'normal', 'large']),
    fontFamily: pick('fontFamily', ['default', 'system', 'malgun', 'nanum']),
    maxPerCell: pick('maxPerCell', [2, 3, 4, 5, 6]),
    saturdayColor: pick('saturdayColor', ['blue', 'red']),
    defaultView: pick('defaultView', ['auto', 'calendar', 'list']),
  };
}

// 설정은 나중에 추가된 항목이라, 없거나 망가진 백업은 기본값으로 되돌리고 나머지 데이터는 살린다.
function parseSettings(input: unknown, unique: (v: unknown) => void): Settings {
  const fallback = defaultSettings();
  if (!isObj(input)) return fallback;
  const profileInput = isObj(input.profile) ? input.profile : {};
  const profile = { name: text(profileInput.name, 100), school: text(profileInput.school, 200), department: text(profileInput.department, 200), note: text(profileInput.note, 2000) };

  let categories: CategoryDef[] = fallback.categories;
  if (Array.isArray(input.categories) && input.categories.length && input.categories.length <= 30) {
    const parsed: CategoryDef[] = [];
    for (const c of input.categories) {
      assert(isObj(c) && id(c.id) && string(c.name, 50) && c.name.trim() && string(c.color, 30) && /^#[0-9a-fA-F]{6}$/.test(c.color), '분류 설정이 올바르지 않습니다.');
      unique(c.id);
      parsed.push({ id: c.id, name: c.name, color: c.color });
    }
    assert(new Set(parsed.map(c => c.name)).size === parsed.length, '분류 명칭이 겹칩니다.');
    categories = parsed;
  }

  const holidays: SchoolHoliday[] = [];
  if (Array.isArray(input.holidays)) {
    assert(input.holidays.length <= 500, '학교 휴일이 너무 많습니다.');
    for (const h of input.holidays) {
      assert(isObj(h) && id(h.id) && string(h.name, 100) && h.name.trim() && validDate(h.start) && validDate(h.end) && h.start <= h.end, '학교 지정 휴일 설정이 올바르지 않습니다.');
      unique(h.id);
      holidays.push({ id: h.id, name: h.name, start: h.start, end: h.end });
    }
  }

  return { profile, calendar: parseCalendarPrefs(input.calendar), categories, holidays, holidayKey: text(input.holidayKey, 500) };
}

export function parseBackup(input: unknown): Data {
  assert(isObj(input) && input.version === 1 && Array.isArray(input.tasks) && Array.isArray(input.events) && Array.isArray(input.notices) && Array.isArray(input.delivered), '업무달력 버전 1 백업 파일이 아닙니다.');
  assert(input.tasks.length <= 10000 && input.events.length <= 20000 && input.notices.length <= 100000 && input.delivered.length <= 100000, '백업 데이터가 너무 큽니다.');
  const ids = new Set<string>();
  const unique = (v: unknown) => { assert(id(v) && !ids.has(v), '중복되거나 올바르지 않은 식별자가 있습니다.'); ids.add(v); };
  const settings = parseSettings(input.settings, unique);
  for (const t of input.tasks) { assert(isObj(t), '업무 형식이 올바르지 않습니다.'); unique(t.id); assert(string(t.name, 300) && t.name.trim() && string(t.category, 50) && t.category.trim() && STATUSES.includes(t.status as never) && string(t.memo) && Array.isArray(t.links) && Array.isArray(t.checklist) && t.links.length <= 200 && t.checklist.length <= 500, '업무의 필수 값이 올바르지 않습니다.'); for (const l of t.links) { assert(isObj(l) && id(l.id) && string(l.name, 300) && l.name.trim() && string(l.url, 10000) && safeLink(l.url), '링크는 https: 또는 onenote: 주소와 표시 이름이 필요합니다.'); unique(l.id); } for (const c of t.checklist) { assert(isObj(c) && id(c.id) && string(c.text, 1000) && c.text.trim() && typeof c.done === 'boolean', '체크리스트 형식이 올바르지 않습니다.'); unique(c.id); } }
  const taskIds = new Set(input.tasks.map((t: Record<string, unknown>) => t.id));
  for (const e of input.events) { assert(isObj(e), '일정 형식이 올바르지 않습니다.'); unique(e.id); assert(string(e.title, 300) && taskIds.has(e.taskId) && TYPES.includes(e.type as never) && typeof e.allDay === 'boolean' && Array.isArray(e.reminders) && e.reminders.every((r: unknown) => [0, 60, 1440, 10080].includes(r as number)) && new Set(e.reminders).size === e.reminders.length && ['start', 'end'].includes(e.reminderBase as string) && finite(e.revision) && Number.isInteger(e.revision) && finite(e.createdAt) && finite(e.reminderSince), '일정의 필수 값 또는 연결된 업무가 올바르지 않습니다.'); assert(!validateEvent(e as unknown as Data['events'][number]), '일정의 제목·날짜·시간 범위를 확인해 주세요.'); }
  const eventIds = new Set(input.events.map((e: Record<string, unknown>) => e.id)); const noticeIds = new Set();
  for (const n of input.notices) { assert(isObj(n) && string(n.id, 300) && !noticeIds.has(n.id) && eventIds.has(n.eventId) && string(n.title, 500) && finite(n.dueAt) && typeof n.read === 'boolean', '알림 데이터가 올바르지 않습니다.'); noticeIds.add(n.id); }
  assert(input.delivered.every((v: unknown) => string(v, 300)) && new Set(input.delivered).size === input.delivered.length, '알림 발송 기록이 올바르지 않습니다.');
  // Copy only known properties. Imported text remains plain text in React.
  const data = input as unknown as Data;
  // 설정에 없는 분류를 쓰는 업무가 있으면 분류를 되살려 준다. 지우면 업무 분류가 사라지기 때문이다.
  const known = new Set(settings.categories.map(c => c.name));
  for (const task of data.tasks) {
    if (known.has(task.category) || settings.categories.length >= 30) continue;
    known.add(task.category);
    settings.categories.push({ id: `restored-${settings.categories.length}`, name: task.category, color: CATEGORY_COLORS[settings.categories.length % CATEGORY_COLORS.length] });
  }
  return { version: 1, tasks: data.tasks.map(t => ({ id: t.id, name: t.name, category: t.category, status: t.status, memo: t.memo, links: t.links.map(l => ({ id: l.id, name: l.name, url: l.url })), checklist: t.checklist.map(c => ({ id: c.id, text: c.text, done: c.done })) })), events: data.events.map(e => ({ id: e.id, title: e.title, taskId: e.taskId, type: e.type, start: e.start, end: e.end, allDay: e.allDay, startTime: e.startTime, endTime: e.endTime, reminders: [...e.reminders], reminderBase: e.reminderBase, revision: e.revision, createdAt: e.createdAt, reminderSince: e.reminderSince })), notices: data.notices.map(n => ({ id: n.id, eventId: n.eventId, title: n.title, dueAt: n.dueAt, read: n.read })), delivered: [...data.delivered], settings };
}
export function saveData(data: Data) { localStorage.setItem(KEY, JSON.stringify(data)); }
export function loadData(): { data: Data; error: string } { try { const saved = localStorage.getItem(KEY); if (saved !== null) return { data: parseBackup(JSON.parse(saved)), error: '' }; const data = seedData(); saveData(data); return { data, error: '' }; } catch { return { data: { version: 1, tasks: [], events: [], notices: [], delivered: [], settings: defaultSettings() }, error: '브라우저 데이터를 읽거나 저장할 수 없습니다. 기존 저장 데이터는 덮어쓰지 않았습니다. 백업을 확인한 뒤 가져오기로 복구해 주세요.' }; } }

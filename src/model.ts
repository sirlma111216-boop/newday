import type { CSSProperties } from 'react';
export const CATEGORIES = ['수업', '학교업무', '연수', '개인', '미지정'] as const;
export const STATUSES = ['예정', '진행 중', '완료'] as const;
export const TYPES = ['일반 일정', '기간', '마감', '발표', '장기'] as const;
export type Category = string;
export type Status = typeof STATUSES[number];
export type EventType = typeof TYPES[number];
export type Link = { id: string; name: string; url: string };
export type Check = { id: string; text: string; done: boolean };
export type Task = { id: string; name: string; category: Category; status: Status; memo: string; links: Link[]; checklist: Check[] };
export type Schedule = { id: string; title: string; taskId: string; type: EventType; start: string; end: string; allDay: boolean; startTime: string; endTime: string; reminders: number[]; reminderBase: 'start' | 'end'; revision: number; createdAt: number; reminderSince: number };
export type Notice = { id: string; eventId: string; title: string; dueAt: number; read: boolean };
export type Profile = { name: string; school: string; department: string; note: string };
export type SchoolHoliday = { id: string; name: string; start: string; end: string };
export type CategoryDef = { id: string; name: string; color: string };
export type CalendarPrefs = { weekStart: 0 | 1; density: 'compact' | 'normal' | 'roomy'; fontScale: 'small' | 'normal' | 'large'; fontFamily: 'default' | 'system' | 'malgun' | 'nanum'; maxPerCell: number; saturdayColor: 'blue' | 'red'; defaultView: 'auto' | 'calendar' | 'list' };
export type Extras = { todo: boolean };
export type TodoItem = { id: string; text: string; done: boolean; createdAt: number; doneAt: number };
export type Settings = { profile: Profile; calendar: CalendarPrefs; extras: Extras; categories: CategoryDef[]; holidays: SchoolHoliday[]; holidayKey: string };
export type Data = { version: 1; tasks: Task[]; events: Schedule[]; notices: Notice[]; delivered: string[]; todos: TodoItem[]; settings: Settings };
export const REMINDERS = [{ value: 10080, label: '7일 전' }, { value: 1440, label: '1일 전' }, { value: 60, label: '1시간 전' }, { value: 0, label: '정각' }];
export const KEY = 'work-calendar-v1';
export const uid = () => crypto.randomUUID();
export function seoulToday(now = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function addDays(date: string, amount: number) { return new Date(Date.parse(date + 'T00:00:00Z') + amount * 86400000).toISOString().slice(0, 10); }
export function dayDiff(a: string, b: string) { return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000); }
export function shiftMonth(date: string, amount: number) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + amount); return d.toISOString().slice(0, 10); }
export function calendarDays(month: string, weekStart = 0) { const first = month.slice(0, 7) + '-01'; const offset = (new Date(first + 'T00:00:00Z').getUTCDay() - weekStart + 7) % 7; const last = addDays(shiftMonth(first, 1), -1); const count = Math.ceil((Number(last.slice(-2)) + offset) / 7) * 7; return Array.from({ length: count }, (_, i) => addDays(first, i - offset)); }
export function dateLabel(date: string) { return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`; }
export function validDate(d: unknown): d is string { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) >= 1900 && Number(d.slice(0, 4)) <= 2200 && !isNaN(Date.parse(d)) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d; }
// 원노트 단락 링크에는 전자 필기장·구역·페이지 이름의 공백이 그대로 들어오므로 가운데 공백은 허용한다.
// 앞뒤 공백은 브라우저가 지워 ' javascript:' 같은 주소가 실행될 수 있으므로 계속 막는다.
export function safeLink(url: string) { if (url !== url.trim() || /[\u0000-\u001f\u007f]/.test(url)) return false; if (/^onenote:/i.test(url)) return url.length > 8; try { return new URL(url).protocol === 'https:'; } catch { return false; } }
export function eventTimestamp(event: Schedule, base = event.reminderBase) { const isEnd = base === 'end'; return Date.parse(`${isEnd ? event.end : event.start}T${event.allDay ? (isEnd ? '23:59' : '09:00') : (isEnd ? event.endTime : event.startTime)}:00+09:00`); }
export function deadlineLabel(event: Schedule, today = seoulToday(), now = Date.now()) { if (event.type !== '마감') return ''; const diff = dayDiff(event.end, today); if (eventTimestamp(event, 'end') < now) return '기한 경과'; return diff === 0 ? 'D-day' : `D-${diff}`; }
export function validateEvent(event: Schedule) { if (!event.title.trim()) return '일정명을 입력해 주세요.'; if (!validDate(event.start) || !validDate(event.end)) return '올바른 날짜를 입력해 주세요. (1900~2200년)'; if (event.start > event.end) return '종료일은 시작일과 같거나 이후여야 합니다.'; if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(event.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.endTime)) return '올바른 시간을 입력해 주세요.'; if (!event.allDay && event.start === event.end && event.startTime > event.endTime) return '종료 시간은 시작 시간과 같거나 이후여야 합니다.'; return ''; }
export function blankTask(category: string = FALLBACK_CATEGORY): Task { return { id: uid(), name: '', category, status: '예정', memo: '', links: [], checklist: [] }; }
export function blankEvent(date = seoulToday()): Schedule { return { id: uid(), title: '', taskId: '', type: '일반 일정', start: date, end: date, allDay: true, startTime: '09:00', endTime: '18:00', reminders: [], reminderBase: 'start', revision: 0, createdAt: Date.now(), reminderSince: Date.now() }; }
export function cancelPending(data: Data, eventId: string) { return { ...data, notices: data.notices.filter(n => n.eventId !== eventId), delivered: data.delivered.filter(id => !id.startsWith(eventId + ':')) }; }
export function dueNotices(data: Data, now = Date.now()): Notice[] { const sent = new Set(data.delivered); return data.events.flatMap(event => event.reminders.flatMap(offset => { const dueAt = eventTimestamp(event) - offset * 60000; const id = `${event.id}:${event.revision}:${event.reminderBase}:${offset}`; if (dueAt > now || dueAt < event.reminderSince || sent.has(id)) return []; return [{ id, eventId: event.id, title: `${event.title} · ${REMINDERS.find(r => r.value === offset)!.label}`, dueAt, read: false }]; })); }
export function seedData(today = seoulToday()): Data {
  const task = (name: string, category: Category, status: Status = '예정'): Task => ({ ...blankTask(), name: name + ' — 예시', category, status });
  const tasks: Task[] = [task('수업안 경진대회', '수업', '진행 중'), task('2학기 학급 운영', '학교업무', '진행 중'), task('교원 역량 연수', '연수'), task('나의 일정', '개인'), task('학습자료 정리', '수업', '완료'), task('학교 안전 점검', '학교업무')];
  tasks[0].memo = '수업안을 작성하고 필요한 서류를 확인한 뒤 제출하세요.\n공문을 보면서 접수 조건과 제출 방법을 확인해 주세요.\n이 업무와 연결된 모든 일정에서 자료와 준비 사항을 함께 관리합니다.';
  tasks[0].checklist = ['수업안 작성', '서류 확인', '제출 완료'].map((text, i) => ({ id: uid(), text, done: i === 0 }));
  tasks[0].links = [{ id: uid(), name: 'OneNote 이용 안내', url: 'https://www.onenote.com/' }];
  tasks[1].checklist = [{ id: uid(), text: '학급별 회신 확인', done: false }];
  const first = today.slice(0, 7) + '-01'; const last = addDays(shiftMonth(today, 1), -1);
  const make = (title: string, index: number, start: string, end = start, type: EventType = '일반 일정', timed = false): Schedule => ({ ...blankEvent(start), title: title + ' — 예시', taskId: tasks[index].id, end, type, allDay: !timed, reminderBase: type === '마감' ? 'end' : 'start', startTime: timed ? '16:00' : '09:00', endTime: timed ? '17:00' : '18:00' });
  return { version: 1, tasks, events: [make('수업안 경진대회 · 접수', 0, addDays(today, -5), addDays(today, 12), '기간'), make('수업안 제출', 0, addDays(today, 3), addDays(today, 3), '마감', true), make('수업안 결과 발표', 0, addDays(today, 15), undefined, '발표'), make('학년 협의회', 1, today, today, '일반 일정', true), make('가정통신문 회신', 1, addDays(today, 2), addDays(today, 2), '마감'), make('디지털 수업 연수', 2, addDays(today, 5), addDays(today, 7), '기간'), make('산책과 독서', 3, today), make('학습자료 정리', 4, addDays(today, -2)), make('안전 점검 주간', 5, addDays(first, -2), addDays(first, 3), '기간'), make('다음 달 수업 준비', 1, addDays(last, -2), addDays(last, 4), '기간'), make('동아리 활동', 1, addDays(today, 1)), make('온라인 연수 신청', 2, addDays(today, 4), addDays(today, 4), '마감')], notices: [], delivered: [], todos: [], settings: defaultSettings() };
}
export type Segment = { event: Schedule; start: number; span: number; lane: number; continued: boolean; continues: boolean };
export function weekSegments(events: Schedule[], days: string[]): Segment[] { const lanes: number[] = []; return events.filter(e => e.start <= days[6] && e.end >= days[0]).sort((a, b) => (a.start < days[0] ? days[0] : a.start).localeCompare(b.start < days[0] ? days[0] : b.start) || dayDiff(b.end, b.start) - dayDiff(a.end, a.start) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)).map(event => { const start = Math.max(0, dayDiff(event.start, days[0])); const end = Math.min(6, dayDiff(event.end, days[0])); let lane = lanes.findIndex(last => last < start); if (lane === -1) lane = lanes.length; lanes[lane] = end; return { event, start, span: end - start + 1, lane, continued: event.start < days[0], continues: event.end > days[6] }; }); }
export function filteredEvents(data: Data, query: string, categories: Category[], incomplete: boolean) { const q = query.trim().toLocaleLowerCase(); return data.events.filter(e => { const task = data.tasks.find(t => t.id === e.taskId); return task && categories.includes(task.category) && (!incomplete || task.checklist.some(item => !item.done)) && (!q || [e.title, task.name, task.memo, ...task.checklist.map(c => c.text), ...task.links.map(l => l.name)].join(' ').toLocaleLowerCase().includes(q)); }); }


// ── 설정 ──────────────────────────────────────────────
// 분류 색은 클레이 디자인의 파스텔을 그대로 쓴다. 저장값은 배경색이고 테두리는 여기서 짙게 만든다.
export const FALLBACK_CATEGORY = '미지정';
export const CATEGORY_COLORS = ['#b8a4ed', '#ffb084', '#a4d4c5', '#e8b94a', '#ff9f9f', '#9ec5f0', '#f2a7c3', '#cde08a', '#d9b8f0', '#ffd9a0', '#a8dce8', '#e0dfdb'];
export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { id: 'cat-class', name: '수업', color: '#b8a4ed' },
  { id: 'cat-work', name: '학교업무', color: '#ffb084' },
  { id: 'cat-training', name: '연수', color: '#a4d4c5' },
  { id: 'cat-personal', name: '개인', color: '#e8b94a' },
  { id: 'cat-none', name: FALLBACK_CATEGORY, color: '#e0dfdb' },
];
export function defaultCalendarPrefs(): CalendarPrefs { return { weekStart: 0, density: 'normal', fontScale: 'normal', fontFamily: 'default', maxPerCell: 3, saturdayColor: 'blue', defaultView: 'auto' }; }
export function defaultExtras(): Extras { return { todo: false }; }
export function defaultSettings(): Settings { return { profile: { name: '', school: '', department: '', note: '' }, calendar: defaultCalendarPrefs(), extras: defaultExtras(), categories: DEFAULT_CATEGORIES.map(c => ({ ...c })), holidays: [], holidayKey: '' }; }
export function categoryColor(settings: Settings, name: string) { return settings.categories.find(c => c.name === name)?.color ?? '#e0dfdb'; }
// --cat-* 를 직접 넣어 .cat-0 같은 고정 클래스 없이도 같은 배색을 쓴다.
export function categoryStyle(color: string): CSSProperties { return { '--cat-bg': color, '--cat-text': 'var(--clay-ink)', '--cat-border': `color-mix(in srgb, ${color} 65%, var(--clay-teal))` } as CSSProperties; }
export function categoryStyleOf(settings: Settings, name: string) { return categoryStyle(categoryColor(settings, name)); }
export function fallbackCategory(settings: Settings) { return settings.categories.find(c => c.name === FALLBACK_CATEGORY)?.name ?? settings.categories.at(-1)?.name ?? FALLBACK_CATEGORY; }

// 학교 지정 휴일은 기간으로 저장하므로 하루씩 펼쳐서 찾는다.
export function schoolHolidayOn(settings: Settings, date: string) { return settings.holidays.find(h => h.start <= date && date <= h.end); }
export function validateSchoolHoliday(holiday: SchoolHoliday) { if (!holiday.name.trim()) return '휴일 명칭을 입력해 주세요.'; if (!validDate(holiday.start) || !validDate(holiday.end)) return '올바른 날짜를 입력해 주세요. (1900~2200년)'; if (holiday.start > holiday.end) return '종료일은 시작일과 같거나 이후여야 합니다.'; return ''; }
export function blankSchoolHoliday(date = seoulToday()): SchoolHoliday { return { id: uid(), name: '', start: date, end: date }; }
// 검색은 달력을 걸러 내지 않고, 눌러서 그 날짜로 이동할 목록만 만든다.
// 다가오는 일정을 먼저, 지난 일정은 최근 것부터 보여 준다.
export function searchEvents(data: Data, query: string, today = seoulToday(), limit = 12) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return { total: 0, rows: [] as Schedule[] };
  const matched = data.events.filter(event => {
    const task = data.tasks.find(t => t.id === event.taskId);
    if (!task) return false;
    return [event.title, task.name, task.memo, ...task.checklist.map(c => c.text), ...task.links.map(l => l.name)].join(' ').toLocaleLowerCase().includes(q);
  });
  const order = (a: Schedule, b: Schedule) => a.start.localeCompare(b.start) || a.startTime.localeCompare(b.startTime);
  const upcoming = matched.filter(e => e.end >= today).sort(order);
  const past = matched.filter(e => e.end < today).sort((a, b) => order(b, a));
  return { total: matched.length, rows: [...upcoming, ...past].slice(0, limit) };
}

// ── 달력 표시 설정 ────────────────────────────────────
const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
export const DENSITY_HEIGHT = { compact: '112px', normal: '156px', roomy: '210px' };
export const FONT_SCALE = { small: '0.88', normal: '1', large: '1.16' };
export const FONT_STACK = {
  default: "'Inter', 'Noto Sans KR', 'Segoe UI', 'Malgun Gothic', sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', 'Malgun Gothic', sans-serif",
  malgun: "'Malgun Gothic', '맑은 고딕', system-ui, sans-serif",
  nanum: "'NanumGothic', 'Nanum Gothic', '나눔고딕', system-ui, sans-serif",
};
export function weekdayOf(date: string) { return new Date(date + 'T00:00:00Z').getUTCDay(); }
export function weekdayLabels(weekStart = 0) { return Array.from({ length: 7 }, (_, i) => WEEKDAY_NAMES[(i + weekStart) % 7]); }
/** 달력 밀도·글자·글꼴을 CSS 변수로 만들어 앱 전체에 적용한다. */
export function calendarVars(prefs: CalendarPrefs): CSSProperties {
  return {
    '--week-min-height': DENSITY_HEIGHT[prefs.density] ?? DENSITY_HEIGHT.normal,
    '--cal-font-scale': FONT_SCALE[prefs.fontScale] ?? FONT_SCALE.normal,
    '--clay-font': FONT_STACK[prefs.fontFamily] ?? FONT_STACK.default,
    '--clay-display': FONT_STACK[prefs.fontFamily] ?? FONT_STACK.default,
    '--sat-color': prefs.saturdayColor === 'red' ? '#c2453c' : '#4f7cb5',
    // body 는 .app 의 조상이라 변수만 덮으면 글꼴이 바뀌지 않는다. 직접 지정해 상속시킨다.
    fontFamily: FONT_STACK[prefs.fontFamily] ?? FONT_STACK.default,
  } as CSSProperties;
}

// ── 할 일 목록 (추가 기능) ─────────────────────────────
export function blankTodo(text = ''): TodoItem { return { id: uid(), text, done: false, createdAt: Date.now(), doneAt: 0 }; }
/** 해야 할 일은 직접 정한 순서를 그대로, 완료한 일은 최근에 끝낸 것이 위로 온다. */
export function splitTodos(todos: TodoItem[]) {
  return {
    open: todos.filter(t => !t.done),
    done: todos.filter(t => t.done).sort((a, b) => b.doneAt - a.doneAt || b.createdAt - a.createdAt),
  };
}
/** 해야 할 일 안에서 from 번째를 to 번째 자리로 옮긴다. 완료한 일의 순서는 건드리지 않는다. */
export function moveTodo(todos: TodoItem[], id: string, to: number) {
  const open = todos.filter(t => !t.done);
  const from = open.findIndex(t => t.id === id);
  if (from < 0) return todos;
  const target = Math.max(0, Math.min(open.length - 1, to));
  if (from === target) return todos;
  const [moved] = open.splice(from, 1);
  open.splice(target, 0, moved);
  return [...open, ...todos.filter(t => t.done)];
}
export function toggleTodo(todos: TodoItem[], id: string, now = Date.now()) {
  return todos.map(t => t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? now : 0 } : t);
}
export function todoDoneLabel(at: number) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(at);
}

// ── 일정 공유 ─────────────────────────────────────────
// 공유는 '고른 분류만 따로 복사해 저장'하는 방식이다. 브라우저에서 걸러 보여 주는 방식은
// 개발자 도구로 전체가 드러나므로 보안이 되지 않는다.
export type ShareConfig = { code: string; categories: string[]; updatedAt: number };
export type SharePayload = { label: string; data: Data };

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O, 1/I 처럼 헷갈리는 글자는 뺀다
export function newShareCode(length = 24) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
/** 보기 좋게 네 글자씩 끊어 보여 준다. */
export function formatShareCode(code: string) { return (code.match(/.{1,4}/g) ?? []).join('-'); }
/** 붙여 넣을 때 공백·붙임표가 섞여도 받아들인다. */
export function normalizeShareCode(input: string) { return input.toUpperCase().replace(/[^A-Z0-9]/g, ''); }
export function validShareCode(code: string) { return /^[A-Z0-9]{16,64}$/.test(code); }

/**
 * 고른 분류에 속한 업무와 그 일정만 남긴 사본을 만든다.
 * 개인정보·공휴일 인증키·알림·할 일은 달력 내용이 아니므로 사본에 담지 않는다.
 */
export function buildShareSnapshot(data: Data, categories: string[]): Data {
  const allowed = new Set(categories);
  const tasks = data.tasks.filter(t => allowed.has(t.category));
  const taskIds = new Set(tasks.map(t => t.id));
  return {
    version: 1,
    tasks: tasks.map(t => ({ ...t, links: t.links.map(l => ({ ...l })), checklist: t.checklist.map(c => ({ ...c })) })),
    events: data.events.filter(e => taskIds.has(e.taskId)).map(e => ({ ...e, reminders: [], reminderBase: 'start' as const })),
    notices: [],
    delivered: [],
    todos: [],
    settings: {
      profile: { name: '', school: '', department: '', note: '' },
      calendar: { ...data.settings.calendar },
      extras: { todo: false },
      categories: data.settings.categories.filter(c => allowed.has(c.name)).map(c => ({ ...c })),
      holidays: data.settings.holidays.map(h => ({ ...h })),
      holidayKey: '',
    },
  };
}
export function shareLabel(data: Data) {
  const name = data.settings.profile.name.trim();
  return name ? `${name}님의 업무달력` : '공유된 업무달력';
}

// ── 반복 일정과 긴 기간 ────────────────────────────────
export const WEEKDAY_PICKS = [{ value: 1, label: '월' }, { value: 2, label: '화' }, { value: 3, label: '수' }, { value: 4, label: '목' }, { value: 5, label: '금' }, { value: 6, label: '토' }, { value: 0, label: '일' }];
export const MAX_REPEAT = 200;

/** 시작일~종료일 사이에서 고른 요일에 해당하는 날짜를 모두 돌려준다. */
export function weeklyDates(start: string, end: string, weekdays: number[], limit = MAX_REPEAT) {
  const days: string[] = [];
  if (!validDate(start) || !validDate(end) || start > end || !weekdays.length) return days;
  const span = dayDiff(end, start);
  if (span > 3650) return days; // 10년을 넘는 범위는 실수로 보고 만들지 않는다.
  for (let i = 0; i <= span && days.length < limit; i++) {
    const date = addDays(start, i);
    if (weekdays.includes(weekdayOf(date))) days.push(date);
  }
  return days;
}

export function validateRepeat(start: string, end: string, weekdays: number[]) {
  if (!validDate(start) || !validDate(end)) return '올바른 날짜를 입력해 주세요. (1900~2200년)';
  if (start > end) return '종료일은 시작일과 같거나 이후여야 합니다.';
  if (!weekdays.length) return '반복할 요일을 하나 이상 골라 주세요.';
  if (dayDiff(end, start) > 3650) return '반복 기간이 너무 깁니다. 10년 안으로 줄여 주세요.';
  if (!weeklyDates(start, end, weekdays).length) return '그 기간에 해당하는 요일이 없습니다.';
  return '';
}

/** 긴 기간 일정은 날짜 칸 아래쪽에 작고 흐리게 따로 깔아 둔다. */
export function isBand(event: Schedule) { return event.type === '장기'; }

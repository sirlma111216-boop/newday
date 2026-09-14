import { CATEGORIES, STATUSES, TYPES, KEY, safeLink, validateEvent, seedData, type Data } from './model.ts';
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const string = (v: unknown, max = 10000): v is string => typeof v === 'string' && v.length <= max;
const id = (v: unknown): v is string => string(v, 150) && /^[a-zA-Z0-9_-]+$/.test(v);
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 9e15;
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export function parseBackup(input: unknown): Data {
  assert(isObj(input) && input.version === 1 && Array.isArray(input.tasks) && Array.isArray(input.events) && Array.isArray(input.notices) && Array.isArray(input.delivered), '업무달력 버전 1 백업 파일이 아닙니다.');
  assert(input.tasks.length <= 10000 && input.events.length <= 20000 && input.notices.length <= 100000 && input.delivered.length <= 100000, '백업 데이터가 너무 큽니다.');
  const ids = new Set<string>();
  const unique = (v: unknown) => { assert(id(v) && !ids.has(v), '중복되거나 올바르지 않은 식별자가 있습니다.'); ids.add(v); };
  for (const t of input.tasks) { assert(isObj(t), '업무 형식이 올바르지 않습니다.'); unique(t.id); assert(string(t.name, 300) && t.name.trim() && CATEGORIES.includes(t.category as never) && STATUSES.includes(t.status as never) && string(t.memo) && Array.isArray(t.links) && Array.isArray(t.checklist) && t.links.length <= 200 && t.checklist.length <= 500, '업무의 필수 값이 올바르지 않습니다.'); for (const l of t.links) { assert(isObj(l) && id(l.id) && string(l.name, 300) && l.name.trim() && string(l.url, 10000) && safeLink(l.url), '링크는 https: 또는 onenote: 주소와 표시 이름이 필요합니다.'); unique(l.id); } for (const c of t.checklist) { assert(isObj(c) && id(c.id) && string(c.text, 1000) && c.text.trim() && typeof c.done === 'boolean', '체크리스트 형식이 올바르지 않습니다.'); unique(c.id); } }
  const taskIds = new Set(input.tasks.map((t: Record<string, unknown>) => t.id));
  for (const e of input.events) { assert(isObj(e), '일정 형식이 올바르지 않습니다.'); unique(e.id); assert(string(e.title, 300) && taskIds.has(e.taskId) && TYPES.includes(e.type as never) && typeof e.allDay === 'boolean' && Array.isArray(e.reminders) && e.reminders.every((r: unknown) => [0, 60, 1440, 10080].includes(r as number)) && new Set(e.reminders).size === e.reminders.length && ['start', 'end'].includes(e.reminderBase as string) && finite(e.revision) && Number.isInteger(e.revision) && finite(e.createdAt) && finite(e.reminderSince), '일정의 필수 값 또는 연결된 업무가 올바르지 않습니다.'); assert(!validateEvent(e as unknown as Data['events'][number]), '일정의 제목·날짜·시간 범위를 확인해 주세요.'); }
  const eventIds = new Set(input.events.map((e: Record<string, unknown>) => e.id)); const noticeIds = new Set();
  for (const n of input.notices) { assert(isObj(n) && string(n.id, 300) && !noticeIds.has(n.id) && eventIds.has(n.eventId) && string(n.title, 500) && finite(n.dueAt) && typeof n.read === 'boolean', '알림 데이터가 올바르지 않습니다.'); noticeIds.add(n.id); }
  assert(input.delivered.every((v: unknown) => string(v, 300)) && new Set(input.delivered).size === input.delivered.length, '알림 발송 기록이 올바르지 않습니다.');
  // Copy only known properties. Imported text remains plain text in React.
  const data = input as unknown as Data;
  return { version: 1, tasks: data.tasks.map(t => ({ id: t.id, name: t.name, category: t.category, status: t.status, memo: t.memo, links: t.links.map(l => ({ id: l.id, name: l.name, url: l.url })), checklist: t.checklist.map(c => ({ id: c.id, text: c.text, done: c.done })) })), events: data.events.map(e => ({ id: e.id, title: e.title, taskId: e.taskId, type: e.type, start: e.start, end: e.end, allDay: e.allDay, startTime: e.startTime, endTime: e.endTime, reminders: [...e.reminders], reminderBase: e.reminderBase, revision: e.revision, createdAt: e.createdAt, reminderSince: e.reminderSince })), notices: data.notices.map(n => ({ id: n.id, eventId: n.eventId, title: n.title, dueAt: n.dueAt, read: n.read })), delivered: [...data.delivered] };
}
export function saveData(data: Data) { localStorage.setItem(KEY, JSON.stringify(data)); }
export function loadData(): { data: Data; error: string } { try { const saved = localStorage.getItem(KEY); if (saved !== null) return { data: parseBackup(JSON.parse(saved)), error: '' }; const data = seedData(); saveData(data); return { data, error: '' }; } catch { return { data: { version: 1, tasks: [], events: [], notices: [], delivered: [] }, error: '브라우저 데이터를 읽거나 저장할 수 없습니다. 기존 저장 데이터는 덮어쓰지 않았습니다. 백업을 확인한 뒤 가져오기로 복구해 주세요.' }; } }

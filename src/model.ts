export const CATEGORIES = ['수업', '학교업무', '연수', '개인', '미지정'] as const;
export const STATUSES = ['예정', '진행 중', '완료'] as const;
export const TYPES = ['일반 일정', '기간', '마감', '발표'] as const;
export type Category = typeof CATEGORIES[number];
export type Status = typeof STATUSES[number];
export type EventType = typeof TYPES[number];
export type Link = { id: string; name: string; url: string };
export type Check = { id: string; text: string; done: boolean };
export type Task = { id: string; name: string; category: Category; status: Status; memo: string; links: Link[]; checklist: Check[] };
export type Schedule = { id: string; title: string; taskId: string; type: EventType; start: string; end: string; allDay: boolean; startTime: string; endTime: string; reminders: number[]; reminderBase: 'start' | 'end'; revision: number; createdAt: number; reminderSince: number };
export type Notice = { id: string; eventId: string; title: string; dueAt: number; read: boolean };
export type Data = { version: 1; tasks: Task[]; events: Schedule[]; notices: Notice[]; delivered: string[] };
export const REMINDERS = [{ value: 10080, label: '7일 전' }, { value: 1440, label: '1일 전' }, { value: 60, label: '1시간 전' }, { value: 0, label: '정각' }];
export const KEY = 'work-calendar-v1';
export const uid = () => crypto.randomUUID();
export function seoulToday(now = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function addDays(date: string, amount: number) { return new Date(Date.parse(date + 'T00:00:00Z') + amount * 86400000).toISOString().slice(0, 10); }
export function dayDiff(a: string, b: string) { return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000); }
export function shiftMonth(date: string, amount: number) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + amount); return d.toISOString().slice(0, 10); }
export function calendarDays(month: string) { const first = month.slice(0, 7) + '-01'; const offset = new Date(first + 'T00:00:00Z').getUTCDay(); const last = addDays(shiftMonth(first, 1), -1); const count = Math.ceil((Number(last.slice(-2)) + offset) / 7) * 7; return Array.from({ length: count }, (_, i) => addDays(first, i - offset)); }
export function dateLabel(date: string) { return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`; }
export function validDate(d: unknown): d is string { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) >= 1900 && Number(d.slice(0, 4)) <= 2200 && !isNaN(Date.parse(d)) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d; }
export function safeLink(url: string) { if (/[\u0000-\u0020\u007f]/.test(url)) return false; if (/^onenote:/i.test(url)) return url.length > 8; try { return new URL(url).protocol === 'https:'; } catch { return false; } }
export function eventTimestamp(event: Schedule, base = event.reminderBase) { const isEnd = base === 'end'; return Date.parse(`${isEnd ? event.end : event.start}T${event.allDay ? (isEnd ? '23:59' : '09:00') : (isEnd ? event.endTime : event.startTime)}:00+09:00`); }
export function deadlineLabel(event: Schedule, today = seoulToday(), now = Date.now()) { if (event.type !== '마감') return ''; const diff = dayDiff(event.end, today); if (eventTimestamp(event, 'end') < now) return '기한 경과'; return diff === 0 ? 'D-day' : `D-${diff}`; }
export function validateEvent(event: Schedule) { if (!event.title.trim()) return '일정명을 입력해 주세요.'; if (!validDate(event.start) || !validDate(event.end)) return '올바른 날짜를 입력해 주세요. (1900~2200년)'; if (event.start > event.end) return '종료일은 시작일과 같거나 이후여야 합니다.'; if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(event.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.endTime)) return '올바른 시간을 입력해 주세요.'; if (!event.allDay && event.start === event.end && event.startTime > event.endTime) return '종료 시간은 시작 시간과 같거나 이후여야 합니다.'; return ''; }
export function blankTask(): Task { return { id: uid(), name: '', category: '미지정', status: '예정', memo: '', links: [], checklist: [] }; }
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
  return { version: 1, tasks, events: [make('수업안 경진대회 · 접수', 0, addDays(today, -5), addDays(today, 12), '기간'), make('수업안 제출', 0, addDays(today, 3), addDays(today, 3), '마감', true), make('수업안 결과 발표', 0, addDays(today, 15), undefined, '발표'), make('학년 협의회', 1, today, today, '일반 일정', true), make('가정통신문 회신', 1, addDays(today, 2), addDays(today, 2), '마감'), make('디지털 수업 연수', 2, addDays(today, 5), addDays(today, 7), '기간'), make('산책과 독서', 3, today), make('학습자료 정리', 4, addDays(today, -2)), make('안전 점검 주간', 5, addDays(first, -2), addDays(first, 3), '기간'), make('다음 달 수업 준비', 1, addDays(last, -2), addDays(last, 4), '기간'), make('동아리 활동', 1, addDays(today, 1)), make('온라인 연수 신청', 2, addDays(today, 4), addDays(today, 4), '마감')], notices: [], delivered: [] };
}
export type Segment = { event: Schedule; start: number; span: number; lane: number; continued: boolean; continues: boolean };
export function weekSegments(events: Schedule[], days: string[]): Segment[] { const lanes: number[] = []; return events.filter(e => e.start <= days[6] && e.end >= days[0]).sort((a, b) => (a.start < days[0] ? days[0] : a.start).localeCompare(b.start < days[0] ? days[0] : b.start) || dayDiff(b.end, b.start) - dayDiff(a.end, a.start) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)).map(event => { const start = Math.max(0, dayDiff(event.start, days[0])); const end = Math.min(6, dayDiff(event.end, days[0])); let lane = lanes.findIndex(last => last < start); if (lane === -1) lane = lanes.length; lanes[lane] = end; return { event, start, span: end - start + 1, lane, continued: event.start < days[0], continues: event.end > days[6] }; }); }
export function filteredEvents(data: Data, query: string, categories: Category[], incomplete: boolean) { const q = query.trim().toLocaleLowerCase(); return data.events.filter(e => { const task = data.tasks.find(t => t.id === e.taskId); return task && categories.includes(task.category) && (!incomplete || task.checklist.some(item => !item.done)) && (!q || [e.title, task.name, task.memo, ...task.checklist.map(c => c.text), ...task.links.map(l => l.name)].join(' ').toLocaleLowerCase().includes(q)); }); }

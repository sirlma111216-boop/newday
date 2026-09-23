import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, fallbackCategory, schoolHolidayOn, validateSchoolHoliday, addDays, calendarDays, seedData, weekSegments, dayDiff, seoulToday, blankEvent, blankTask, dueNotices, eventTimestamp, validateEvent, safeLink, filteredEvents, cancelPending, type Data } from '../src/model.ts';
import { parseBackup, loadData, saveData } from '../src/storage.ts';
test('서울 날짜는 UTC와 구별되며 윤년과 월 경계에서 날짜 계산이 정확하다', () => { assert.equal(seoulToday(new Date('2026-09-12T16:00:00Z')), '2026-09-13'); assert.equal(addDays('2024-02-28', 1), '2024-02-29'); assert.equal(addDays('2026-12-31', 1), '2027-01-01'); assert.equal(dayDiff('2026-10-02', '2026-09-29'), 3); });
test('월간은 일요일 시작, 토요일 종료이며 마지막 날짜까지 포함한다', () => { for (const month of ['2026-02-01', '2026-05-01', '2026-09-01']) { const d = calendarDays(month); assert.equal(d.length % 7, 0); assert.equal(new Date(d[0] + 'T00:00Z').getUTCDay(), 0); assert.equal(new Date(d.at(-1)! + 'T00:00Z').getUTCDay(), 6); } });
test('기간은 종료일 포함, 주와 월 경계에서도 빠짐없이 정확히 한 번 표시된다', () => { const e = { ...blankEvent('2026-09-25'), end: '2026-10-07' }; const days = Array.from({ length: 21 }, (_, i) => addDays('2026-09-20', i)); const covered: string[] = []; for (let w = 0; w < 3; w++) { const week = days.slice(w * 7, w * 7 + 7); for (const s of weekSegments([e], week)) covered.push(...week.slice(s.start, s.start + s.span)); } assert.equal(covered.length, 13); assert.equal(new Set(covered).size, 13); assert.equal(covered[0], e.start); assert.equal(covered.at(-1), e.end); });
test('겹치는 일정은 별도 행을 사용하고 같은 행에서 충돌하지 않는다', () => { const days = Array.from({ length: 7 }, (_, i) => addDays('2026-09-13', i)); const events = Array.from({ length: 7 }, (_, i) => ({ ...blankEvent(days[i % 3]), end: days[Math.min(6, i % 3 + 3)] })); const segments = weekSegments(events, days); for (const a of segments) for (const b of segments) if (a !== b && a.lane === b.lane) assert.ok(a.start + a.span <= b.start || b.start + b.span <= a.start); assert.ok(segments.some(s => s.lane >= 3)); });
test('역전된 날짜·시간·존재하지 않는 날짜를 거부한다', () => { assert.match(validateEvent({ ...blankEvent('2026-09-20'), title: '테스트', end: '2026-09-19' }), /종료일/); assert.match(validateEvent({ ...blankEvent('2026-09-20'), title: '테스트', allDay: false, startTime: '19:00', endTime: '18:00' }), /종료 시간/); assert.match(validateEvent({ ...blankEvent('2026-02-30'), title: '테스트' }), /올바른 날짜/); });
test('검색·분류·준비할 일 필터를 결합하고 공통 메모·준비할 일을 검색한다', () => { const d = seedData('2026-09-13'); assert.equal(filteredEvents(d, '서류 확인', ['수업'], true).length, 3); assert.equal(filteredEvents(d, '서류 확인', ['연수'], true).length, 0); assert.equal(filteredEvents(d, '학습자료', ['수업'], true).length, 0); assert.equal(filteredEvents(d, '학습자료', ['수업'], false).length, 1); });
function notificationFixture(): Data { const task = { ...blankTask(), name: '알림 확인' }; const e = { ...blankEvent('2026-09-13'), title: '제출', taskId: task.id, allDay: false, startTime: '10:00', endTime: '17:00', reminderBase: 'end' as const, reminders: [10080, 1440, 60, 0], reminderSince: Date.parse('2026-09-01T00:00+09:00') }; return { version: 1, tasks: [task], events: [e], notices: [], delivered: [], settings: defaultSettings() }; }
test('서울 마감 기준 여러 알림을 수집하고 재실행·새로고침에 중복하지 않는다', () => { const d = notificationFixture(); const at = Date.parse('2026-09-13T17:00+09:00'); assert.equal(eventTimestamp(d.events[0]), at); const notices = dueNotices(d, at); assert.equal(notices.length, 4); const stored = parseBackup(JSON.parse(JSON.stringify({ ...d, notices, delivered: notices.map(n => n.id) }))); assert.equal(dueNotices(stored, at + 100000).length, 0); });
test('놓친 미확인 알림 복구, 생성 전 알림 제외, 수정·삭제 시 미발송 알림 정리', () => { const d = notificationFixture(); assert.equal(dueNotices(d, Date.parse('2026-09-14T10:00+09:00')).length, 4); const late = structuredClone(d); late.events[0].reminderSince = Date.parse('2026-09-13T16:30+09:00'); assert.equal(dueNotices(late, Date.parse('2026-09-13T17:00+09:00')).length, 1); const legacy = structuredClone(d); legacy.tasks[0].status = '완료'; assert.equal(dueNotices(legacy, Date.parse('2026-09-14T10:00+09:00')).length, 4); assert.equal(dueNotices({ ...d, events: [] }, Date.now()).length, 0); const sent = dueNotices(d, Date.parse('2026-09-13T17:00+09:00')); assert.equal(cancelPending({ ...d, notices: sent, delivered: sent.map(n => n.id) }, d.events[0].id).notices.length, 0); });
test('종일 시작은 09:00, 종료는 당일 23:59 서울 기준이다', () => { const e = { ...blankEvent('2026-09-13'), title: '종일' }; assert.equal(eventTimestamp(e, 'start'), Date.parse('2026-09-13T09:00+09:00')); assert.equal(eventTimestamp(e, 'end'), Date.parse('2026-09-13T23:59+09:00')); });
test('백업은 관계와 원노트 원문을 보존하고 위험한 링크와 잘못된 필수 값을 거부한다', () => { const d = seedData('2026-09-13'); const link = 'onenote:https://example.invalid/test.one#section&section-id={TEST}&page-id={PAGE}&object-id={PARAGRAPH}&p=1'; d.tasks[0].links = [{ id: 'link-test', name: '단락 보존 테스트', url: link }]; assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(d))), d); for (const change of [(x: Data) => { x.events[0].taskId = 'missing'; }, (x: Data) => { x.tasks[0].links[0].url = 'javascript:alert(1)'; }, (x: Data) => { x.events[0].end = '2026-02-30'; }, (x: Data) => { x.events[0].reminders = [0, 0]; }, (x: Data) => { x.events[1].id = x.events[0].id; }]) { const copy = structuredClone(d); change(copy); assert.throws(() => parseBackup(copy)); } for (const value of ['http://example.com', 'data:text/html,hi', 'javascript:alert(1)', ' https://example.com', 'https://example.com ', 'onenote:']) assert.equal(safeLink(value), false); assert.equal(safeLink(link), true); assert.equal(safeLink('onenote:https://d.docs.live.net/a1/문서/내 전자 필기장/새 구역.one#첫 페이지&section-id={A}&page-id={B}&object-id={C}&end'), true); });
test('모든 데이터를 삭제하고 다시 열어도 예시 데이터가 재생성되지 않는다', () => { const memory = new Map<string, string>(); Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v) } }); assert.equal(loadData().data.events.length, 12); const empty: Data = { version: 1, tasks: [], events: [], notices: [], delivered: [], settings: defaultSettings() }; saveData(empty); assert.deepEqual(loadData().data, empty); const before = [...memory]; assert.throws(() => parseBackup({ version: 5 })); assert.deepEqual([...memory], before); });

test('미지정 일정은 기존 분류와 함께 백업 복원 및 필터가 가능하다', () => {
  const data = seedData('2026-09-21');
  const task = { ...blankTask(), name: '직접 입력한 업무', checklist: [{ id: 'check-pending', text: '준비 확인', done: false }] };
  assert.equal(task.category, '미지정');
  const event = { ...blankEvent('2026-09-29'), title: task.name, taskId: task.id, end: '2026-10-02', type: '기간' as const };
  data.tasks.push(task); data.events.push(event);
  const restored = parseBackup(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(filteredEvents(restored, '직접 입력', ['미지정'], true), [event]);
  assert.equal(filteredEvents(restored, '직접 입력', ['수업'], true).length, 0);
  restored.tasks.find(t => t.id === task.id)!.category = '수업';
  assert.deepEqual(filteredEvents(restored, '직접 입력', ['수업'], true), [event]);
});

test('설정은 기본값을 채우고 학교 휴일·분류 설정을 검증한다', () => {
  const data = seedData('2026-09-21');
  assert.equal(data.settings.categories.length, 5);
  assert.equal(fallbackCategory(data.settings), '미지정');

  // 설정이 없던 예전 백업도 기본 설정으로 복원된다.
  const legacy = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  delete legacy.settings;
  assert.deepEqual(parseBackup(legacy).settings, defaultSettings());

  // 설정에 없는 분류를 쓰는 업무가 있으면 분류를 되살려 데이터를 잃지 않는다.
  const renamed = structuredClone(data);
  renamed.settings.categories = renamed.settings.categories.filter(c => c.name !== '연수');
  const restored = parseBackup(JSON.parse(JSON.stringify(renamed)));
  assert.ok(restored.settings.categories.some(c => c.name === '연수'));

  // 분류 명칭이 겹치거나 색 형식이 틀리면 거부한다.
  for (const broken of [
    (x: Data) => { x.settings.categories[1].name = x.settings.categories[0].name; },
    (x: Data) => { x.settings.categories[0].color = 'red'; },
    (x: Data) => { x.settings.categories[0].name = '   '; },
  ]) { const copy = structuredClone(data); broken(copy); assert.throws(() => parseBackup(JSON.parse(JSON.stringify(copy)))); }
});

test('학교 지정 휴일은 기간으로 저장되고 하루 단위로 조회된다', () => {
  const settings = defaultSettings();
  settings.holidays = [{ id: 'holiday-1', name: '여름방학', start: '2026-07-20', end: '2026-08-14' }];
  assert.equal(schoolHolidayOn(settings, '2026-07-19'), undefined);
  assert.equal(schoolHolidayOn(settings, '2026-07-20')!.name, '여름방학');
  assert.equal(schoolHolidayOn(settings, '2026-08-01')!.name, '여름방학');
  assert.equal(schoolHolidayOn(settings, '2026-08-14')!.name, '여름방학');
  assert.equal(schoolHolidayOn(settings, '2026-08-15'), undefined);

  assert.equal(validateSchoolHoliday({ id: 'a', name: '재량휴업일', start: '2026-10-05', end: '2026-10-05' }), '');
  assert.match(validateSchoolHoliday({ id: 'a', name: ' ', start: '2026-10-05', end: '2026-10-05' }), /명칭/);
  assert.match(validateSchoolHoliday({ id: 'a', name: '방학', start: '2026-10-05', end: '2026-10-04' }), /종료일/);
  assert.match(validateSchoolHoliday({ id: 'a', name: '방학', start: '2026-02-30', end: '2026-03-02' }), /올바른 날짜/);

  const data = { ...seedData('2026-09-21'), settings };
  assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(data))).settings.holidays, settings.holidays);
});

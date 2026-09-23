import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareSnapshot, newShareCode, formatShareCode, normalizeShareCode, validShareCode, blankTodo, moveTodo, splitTodos, toggleTodo, defaultSettings, defaultCalendarPrefs, calendarVars, weekdayLabels, weekdayOf, DENSITY_HEIGHT, FONT_SCALE, shiftMonth, fallbackCategory, schoolHolidayOn, validateSchoolHoliday, addDays, calendarDays, seedData, weekSegments, dayDiff, seoulToday, blankEvent, blankTask, dueNotices, eventTimestamp, validateEvent, safeLink, filteredEvents, searchEvents, cancelPending, type Data } from '../src/model.ts';
import { parseBackup, loadData, saveData } from '../src/storage.ts';
test('서울 날짜는 UTC와 구별되며 윤년과 월 경계에서 날짜 계산이 정확하다', () => { assert.equal(seoulToday(new Date('2026-09-12T16:00:00Z')), '2026-09-13'); assert.equal(addDays('2024-02-28', 1), '2024-02-29'); assert.equal(addDays('2026-12-31', 1), '2027-01-01'); assert.equal(dayDiff('2026-10-02', '2026-09-29'), 3); });
test('월간은 일요일 시작, 토요일 종료이며 마지막 날짜까지 포함한다', () => { for (const month of ['2026-02-01', '2026-05-01', '2026-09-01']) { const d = calendarDays(month); assert.equal(d.length % 7, 0); assert.equal(new Date(d[0] + 'T00:00Z').getUTCDay(), 0); assert.equal(new Date(d.at(-1)! + 'T00:00Z').getUTCDay(), 6); } });
test('기간은 종료일 포함, 주와 월 경계에서도 빠짐없이 정확히 한 번 표시된다', () => { const e = { ...blankEvent('2026-09-25'), end: '2026-10-07' }; const days = Array.from({ length: 21 }, (_, i) => addDays('2026-09-20', i)); const covered: string[] = []; for (let w = 0; w < 3; w++) { const week = days.slice(w * 7, w * 7 + 7); for (const s of weekSegments([e], week)) covered.push(...week.slice(s.start, s.start + s.span)); } assert.equal(covered.length, 13); assert.equal(new Set(covered).size, 13); assert.equal(covered[0], e.start); assert.equal(covered.at(-1), e.end); });
test('겹치는 일정은 별도 행을 사용하고 같은 행에서 충돌하지 않는다', () => { const days = Array.from({ length: 7 }, (_, i) => addDays('2026-09-13', i)); const events = Array.from({ length: 7 }, (_, i) => ({ ...blankEvent(days[i % 3]), end: days[Math.min(6, i % 3 + 3)] })); const segments = weekSegments(events, days); for (const a of segments) for (const b of segments) if (a !== b && a.lane === b.lane) assert.ok(a.start + a.span <= b.start || b.start + b.span <= a.start); assert.ok(segments.some(s => s.lane >= 3)); });
test('역전된 날짜·시간·존재하지 않는 날짜를 거부한다', () => { assert.match(validateEvent({ ...blankEvent('2026-09-20'), title: '테스트', end: '2026-09-19' }), /종료일/); assert.match(validateEvent({ ...blankEvent('2026-09-20'), title: '테스트', allDay: false, startTime: '19:00', endTime: '18:00' }), /종료 시간/); assert.match(validateEvent({ ...blankEvent('2026-02-30'), title: '테스트' }), /올바른 날짜/); });
test('검색·분류·준비할 일 필터를 결합하고 공통 메모·준비할 일을 검색한다', () => { const d = seedData('2026-09-13'); assert.equal(filteredEvents(d, '서류 확인', ['수업'], true).length, 3); assert.equal(filteredEvents(d, '서류 확인', ['연수'], true).length, 0); assert.equal(filteredEvents(d, '학습자료', ['수업'], true).length, 0); assert.equal(filteredEvents(d, '학습자료', ['수업'], false).length, 1); });
function notificationFixture(): Data { const task = { ...blankTask(), name: '알림 확인' }; const e = { ...blankEvent('2026-09-13'), title: '제출', taskId: task.id, allDay: false, startTime: '10:00', endTime: '17:00', reminderBase: 'end' as const, reminders: [10080, 1440, 60, 0], reminderSince: Date.parse('2026-09-01T00:00+09:00') }; return { version: 1, tasks: [task], events: [e], notices: [], delivered: [], todos: [], settings: defaultSettings() }; }
test('서울 마감 기준 여러 알림을 수집하고 재실행·새로고침에 중복하지 않는다', () => { const d = notificationFixture(); const at = Date.parse('2026-09-13T17:00+09:00'); assert.equal(eventTimestamp(d.events[0]), at); const notices = dueNotices(d, at); assert.equal(notices.length, 4); const stored = parseBackup(JSON.parse(JSON.stringify({ ...d, notices, delivered: notices.map(n => n.id) }))); assert.equal(dueNotices(stored, at + 100000).length, 0); });
test('놓친 미확인 알림 복구, 생성 전 알림 제외, 수정·삭제 시 미발송 알림 정리', () => { const d = notificationFixture(); assert.equal(dueNotices(d, Date.parse('2026-09-14T10:00+09:00')).length, 4); const late = structuredClone(d); late.events[0].reminderSince = Date.parse('2026-09-13T16:30+09:00'); assert.equal(dueNotices(late, Date.parse('2026-09-13T17:00+09:00')).length, 1); const legacy = structuredClone(d); legacy.tasks[0].status = '완료'; assert.equal(dueNotices(legacy, Date.parse('2026-09-14T10:00+09:00')).length, 4); assert.equal(dueNotices({ ...d, events: [] }, Date.now()).length, 0); const sent = dueNotices(d, Date.parse('2026-09-13T17:00+09:00')); assert.equal(cancelPending({ ...d, notices: sent, delivered: sent.map(n => n.id) }, d.events[0].id).notices.length, 0); });
test('종일 시작은 09:00, 종료는 당일 23:59 서울 기준이다', () => { const e = { ...blankEvent('2026-09-13'), title: '종일' }; assert.equal(eventTimestamp(e, 'start'), Date.parse('2026-09-13T09:00+09:00')); assert.equal(eventTimestamp(e, 'end'), Date.parse('2026-09-13T23:59+09:00')); });
test('백업은 관계와 원노트 원문을 보존하고 위험한 링크와 잘못된 필수 값을 거부한다', () => { const d = seedData('2026-09-13'); const link = 'onenote:https://example.invalid/test.one#section&section-id={TEST}&page-id={PAGE}&object-id={PARAGRAPH}&p=1'; d.tasks[0].links = [{ id: 'link-test', name: '단락 보존 테스트', url: link }]; assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(d))), d); for (const change of [(x: Data) => { x.events[0].taskId = 'missing'; }, (x: Data) => { x.tasks[0].links[0].url = 'javascript:alert(1)'; }, (x: Data) => { x.events[0].end = '2026-02-30'; }, (x: Data) => { x.events[0].reminders = [0, 0]; }, (x: Data) => { x.events[1].id = x.events[0].id; }]) { const copy = structuredClone(d); change(copy); assert.throws(() => parseBackup(copy)); } for (const value of ['http://example.com', 'data:text/html,hi', 'javascript:alert(1)', ' https://example.com', 'https://example.com ', 'onenote:']) assert.equal(safeLink(value), false); assert.equal(safeLink(link), true); assert.equal(safeLink('onenote:https://d.docs.live.net/a1/문서/내 전자 필기장/새 구역.one#첫 페이지&section-id={A}&page-id={B}&object-id={C}&end'), true); });
test('모든 데이터를 삭제하고 다시 열어도 예시 데이터가 재생성되지 않는다', () => { const memory = new Map<string, string>(); Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v) } }); assert.equal(loadData().data.events.length, 12); const empty: Data = { version: 1, tasks: [], events: [], notices: [], delivered: [], todos: [], settings: defaultSettings() }; saveData(empty); assert.deepEqual(loadData().data, empty); const before = [...memory]; assert.throws(() => parseBackup({ version: 5 })); assert.deepEqual([...memory], before); });

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

test('검색은 달력을 거르지 않고 이동할 목록만 만들며 다가오는 일정을 먼저 보여 준다', () => {
  const today = '2026-09-13';
  const data = seedData(today);

  // 검색어를 넣어도 달력에 보이는 일정 수는 그대로다.
  const all = filteredEvents(data, '', [...data.settings.categories.map(c => c.name)], false);
  assert.equal(all.length, data.events.length);

  // 제목·업무명·메모·준비할 일·링크 이름까지 찾는다.
  assert.ok(searchEvents(data, '수업안', today).total >= 2);
  assert.equal(searchEvents(data, '서류 확인', today).total, 3);
  assert.equal(searchEvents(data, 'OneNote 이용 안내', today).total, 3);
  assert.equal(searchEvents(data, '', today).total, 0);
  assert.deepEqual(searchEvents(data, '   ', today).rows, []);
  assert.equal(searchEvents(data, '존재하지않는일정', today).total, 0);

  // 분류 필터를 꺼 두어도 검색으로는 찾을 수 있어야 한다.
  const hidden = searchEvents(data, '학습자료', today);
  assert.equal(hidden.total, 1);

  // 다가오는 일정이 먼저, 지난 일정은 최근 것부터 온다.
  const rows = searchEvents(data, '예시', today).rows;
  const border = rows.findIndex(e => e.end < today);
  if (border > 0) {
    const upcoming = rows.slice(0, border);
    const past = rows.slice(border);
    for (let i = 1; i < upcoming.length; i++) assert.ok(upcoming[i - 1].start <= upcoming[i].start);
    for (let i = 1; i < past.length; i++) assert.ok(past[i - 1].start >= past[i].start);
    assert.ok(upcoming.every(e => e.end >= today));
  }

  // 목록 길이는 limit 으로 제한하되 총 개수는 그대로 알려 준다.
  const limited = searchEvents(data, '예시', today, 3);
  assert.equal(limited.rows.length, 3);
  assert.ok(limited.total > 3);
});

test('주 시작 요일에 따라 달력 첫 칸과 요일 머리글이 바뀐다', () => {
  for (const month of ['2026-02-01', '2026-05-01', '2026-09-01']) {
    const sunday = calendarDays(month, 0);
    const monday = calendarDays(month, 1);
    assert.equal(sunday.length % 7, 0);
    assert.equal(monday.length % 7, 0);
    assert.equal(new Date(sunday[0] + 'T00:00Z').getUTCDay(), 0);
    assert.equal(new Date(sunday.at(-1)! + 'T00:00Z').getUTCDay(), 6);
    assert.equal(new Date(monday[0] + 'T00:00Z').getUTCDay(), 1);
    assert.equal(new Date(monday.at(-1)! + 'T00:00Z').getUTCDay(), 0);
    // 두 설정 모두 그 달을 하루도 빠짐없이 담아야 한다.
    const first = month.slice(0, 7) + '-01';
    const last = addDays(shiftMonth(first, 1), -1);
    for (const grid of [sunday, monday]) { assert.ok(grid.includes(first)); assert.ok(grid.includes(last)); }
  }
  assert.deepEqual(weekdayLabels(0), ['일', '월', '화', '수', '목', '금', '토']);
  assert.deepEqual(weekdayLabels(1), ['월', '화', '수', '목', '금', '토', '일']);
  assert.equal(weekdayOf('2026-09-13'), 0);
  assert.equal(weekdayOf('2026-09-19'), 6);
});

test('달력 표시 설정은 기본값을 채우고 이상한 값은 되돌린다', () => {
  const data = seedData('2026-09-21');
  assert.deepEqual(data.settings.calendar, defaultCalendarPrefs());

  // 설정이 없던 예전 백업도 기본값으로 복원된다.
  const legacy = JSON.parse(JSON.stringify(data));
  delete legacy.settings.calendar;
  assert.deepEqual(parseBackup(legacy).settings.calendar, defaultCalendarPrefs());

  // 고른 값은 그대로 저장된다.
  const tuned = structuredClone(data);
  tuned.settings.calendar = { weekStart: 1, density: 'roomy', fontScale: 'large', fontFamily: 'malgun', maxPerCell: 5, saturdayColor: 'red', defaultView: 'list' };
  assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(tuned))).settings.calendar, tuned.settings.calendar);

  // 범위를 벗어난 값은 막지 않고 기본값으로 되돌린다. 보기 취향일 뿐이라 데이터를 잃으면 안 된다.
  const broken = JSON.parse(JSON.stringify(data));
  broken.settings.calendar = { weekStart: 9, density: 'huge', fontScale: null, fontFamily: 'comic', maxPerCell: 99, saturdayColor: 'green', defaultView: 'grid' };
  assert.deepEqual(parseBackup(broken).settings.calendar, defaultCalendarPrefs());

  // CSS 변수로 칸 높이·글자·토요일 색이 나온다.
  const vars = calendarVars({ ...defaultCalendarPrefs(), density: 'compact', fontScale: 'large', saturdayColor: 'red' }) as Record<string, string>;
  assert.equal(vars['--week-min-height'], DENSITY_HEIGHT.compact);
  assert.equal(vars['--cal-font-scale'], FONT_SCALE.large);
  assert.equal(vars['--sat-color'], '#c2453c');
});

test('분류 개명은 id 기준이라 이미 있는 이름으로 바꿔도 서로 뒤섞이지 않는다', () => {
  // 설정 화면이 저장할 때 만드는 개명표를 그대로 재현한다.
  const renameMap = (before: { id: string; name: string }[], after: { id: string; name: string }[], fallback: string) => {
    const moves: Record<string, string> = {};
    for (const original of before) {
      const current = after.find(c => c.id === original.id);
      if (!current) moves[original.name] = fallback;
      else if (current.name !== original.name) moves[original.name] = current.name;
    }
    return moves;
  };
  const apply = (tasks: string[], moves: Record<string, string>, known: Set<string>, fallback: string) =>
    tasks.map(c => { const moved = moves[c] ?? c; return known.has(moved) ? moved : fallback; });

  const before = defaultSettings().categories.map(c => ({ id: c.id, name: c.name }));
  // 수업 → 학교업무, 학교업무 → 외부강의 처럼 이름이 한 칸씩 밀리는 연쇄 개명
  const after = [
    { id: 'cat-class', name: '학교업무' },
    { id: 'cat-work', name: '외부강의' },
    { id: 'cat-training', name: '경희대' },
    { id: 'cat-personal', name: 'Spirit' },
    { id: 'cat-none', name: '공모전' },
  ];
  const moves = renameMap(before, after, '공모전');
  assert.deepEqual(moves, { 수업: '학교업무', 학교업무: '외부강의', 연수: '경희대', 개인: 'Spirit', 미지정: '공모전' });

  const known = new Set(after.map(c => c.name));
  assert.deepEqual(apply(['수업', '학교업무', '연수', '개인', '미지정'], moves, known, '공모전'),
    ['학교업무', '외부강의', '경희대', 'Spirit', '공모전']);

  // 두 분류의 이름을 맞바꿔도 서로 정확히 교차한다.
  const swapped = [{ id: 'cat-class', name: '학교업무' }, { id: 'cat-work', name: '수업' }, ...before.slice(2)];
  const swapMoves = renameMap(before, swapped, '미지정');
  assert.deepEqual(apply(['수업', '학교업무'], swapMoves, new Set(swapped.map(c => c.name)), '미지정'), ['학교업무', '수업']);

  // 분류를 지우면 그 업무만 기본 분류로 간다.
  const removed = before.filter(c => c.id !== 'cat-training');
  const removeMoves = renameMap(before, removed, '미지정');
  assert.deepEqual(removeMoves, { 연수: '미지정' });
  assert.deepEqual(apply(['수업', '연수'], removeMoves, new Set(removed.map(c => c.name)), '미지정'), ['수업', '미지정']);
});

test('자료 링크는 표시 이름 없이 주소만으로 저장된다', () => {
  const data = seedData('2026-09-21');
  // 이름 없이 주소만 있는 링크도 그대로 복원된다.
  data.tasks[0].links = [{ id: 'link-noname', name: '', url: 'onenote:https://d.docs.live.net/a/내 전자 필기장/구역.one#공문&end' }];
  const restored = parseBackup(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(restored.tasks[0].links, data.tasks[0].links);

  // 예전에 붙여 둔 이름은 지우지 않고 그대로 보존한다.
  const legacy = structuredClone(data);
  legacy.tasks[0].links = [{ id: 'link-named', name: '전환기교육강사', url: 'https://khgms-my.sharepoint.com/personal/doc.one' }];
  assert.equal(parseBackup(JSON.parse(JSON.stringify(legacy))).tasks[0].links[0].name, '전환기교육강사');

  // 주소가 잘못된 링크는 이름과 무관하게 계속 거부한다.
  const bad = structuredClone(data);
  bad.tasks[0].links = [{ id: 'link-bad', name: '', url: 'http://example.com' }];
  assert.throws(() => parseBackup(JSON.parse(JSON.stringify(bad))));
});

test('할 일은 직접 정한 순서를 지키고 완료한 일은 최근 것이 위로 온다', () => {
  const at = (n: number) => Date.parse('2026-09-21T09:00+09:00') + n * 60000;
  let todos = ['첫째', '둘째', '셋째'].map((text, i) => ({ ...blankTodo(text), id: 'todo-' + i, createdAt: at(i) }));

  // 순서 바꾸기: 셋째를 맨 위로
  todos = moveTodo(todos, 'todo-2', 0);
  assert.deepEqual(splitTodos(todos).open.map(t => t.text), ['셋째', '첫째', '둘째']);
  // 범위를 벗어난 자리는 끝으로 모은다.
  assert.deepEqual(splitTodos(moveTodo(todos, 'todo-2', 99)).open.map(t => t.text), ['첫째', '둘째', '셋째']);
  // 없는 항목이면 그대로 둔다.
  assert.equal(moveTodo(todos, 'missing', 0), todos);

  // 완료하면 완료 시각이 남고 '해야 할 일'에서 빠진다.
  todos = toggleTodo(todos, 'todo-0', at(10));
  const afterFirst = splitTodos(todos);
  assert.deepEqual(afterFirst.open.map(t => t.text), ['셋째', '둘째']);
  assert.deepEqual(afterFirst.done.map(t => t.text), ['첫째']);
  assert.equal(todos.find(t => t.id === 'todo-0')!.doneAt, at(10));

  // 나중에 완료한 것이 위로 온다. 가장 먼저 한 일이 가장 아래.
  todos = toggleTodo(todos, 'todo-1', at(20));
  assert.deepEqual(splitTodos(todos).done.map(t => t.text), ['둘째', '첫째']);

  // 다시 누르면 해야 할 일로 돌아오고 완료 시각은 지워진다.
  todos = toggleTodo(todos, 'todo-0', at(30));
  assert.equal(todos.find(t => t.id === 'todo-0')!.doneAt, 0);
  assert.ok(splitTodos(todos).open.some(t => t.text === '첫째'));

  // 완료한 일의 순서를 바꿔 달라고 해도 해야 할 일 순서는 건드리지 않는다.
  const before = splitTodos(todos).open.map(t => t.text);
  assert.deepEqual(splitTodos(moveTodo(todos, 'todo-1', 0)).open.map(t => t.text), before);
});

test('할 일은 백업에 저장되고 잘못된 값은 거부한다', () => {
  const data = seedData('2026-09-21');
  data.todos = [{ id: 'todo-keep', text: '공문 확인', done: true, createdAt: 1, doneAt: 2 }];
  assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(data))).todos, data.todos);

  // 설정이 없던 예전 백업에는 할 일이 없으므로 빈 목록으로 복원된다.
  const legacy = JSON.parse(JSON.stringify(data));
  delete legacy.todos;
  assert.deepEqual(parseBackup(legacy).todos, []);
  assert.equal(parseBackup(legacy).settings.extras.todo, false);

  for (const broken of [
    (x: Data) => { x.todos[0].text = '  '; },
    (x: Data) => { (x.todos[0] as unknown as Record<string, unknown>).done = 'yes'; },
    (x: Data) => { (x.todos[0] as unknown as Record<string, unknown>).doneAt = 'now'; },
  ]) { const copy = structuredClone(data); broken(copy); assert.throws(() => parseBackup(JSON.parse(JSON.stringify(copy)))); }
});

test('공유 사본에는 고른 분류만 담기고 개인정보·인증키·알림은 빠진다', () => {
  const data = seedData('2026-09-21');
  data.settings.profile = { name: '김교사', school: '○○중학교', department: '교무부', note: '내선 1234' };
  data.settings.holidayKey = 'SECRET-KEY';
  data.settings.holidays = [{ id: 'h1', name: '재량휴업일', start: '2026-10-05', end: '2026-10-05' }];
  data.todos = [{ id: 'todo-1', text: '비밀 메모', done: false, createdAt: 1, doneAt: 0 }];
  data.events[0].reminders = [1440];

  const snapshot = buildShareSnapshot(data, ['수업']);

  // 고른 분류의 업무와 그 일정만 남는다.
  assert.ok(snapshot.tasks.length > 0);
  assert.ok(snapshot.tasks.every(t => t.category === '수업'));
  const taskIds = new Set(snapshot.tasks.map(t => t.id));
  assert.ok(snapshot.events.every(e => taskIds.has(e.taskId)));
  // 고르지 않은 분류의 일정은 하나도 들어가지 않는다.
  const hiddenTasks = data.tasks.filter(t => t.category !== '수업').map(t => t.id);
  assert.ok(snapshot.events.every(e => !hiddenTasks.includes(e.taskId)));
  assert.deepEqual(snapshot.settings.categories.map(c => c.name), ['수업']);

  // 달력 내용이 아닌 것은 담지 않는다.
  assert.deepEqual(snapshot.settings.profile, { name: '', school: '', department: '', note: '' });
  assert.equal(snapshot.settings.holidayKey, '');
  assert.deepEqual(snapshot.todos, []);
  assert.deepEqual(snapshot.notices, []);
  assert.deepEqual(snapshot.delivered, []);
  assert.ok(snapshot.events.every(e => e.reminders.length === 0));
  // 학교 휴일은 달력 표시에 필요하므로 함께 간다.
  assert.deepEqual(snapshot.settings.holidays, data.settings.holidays);

  // 사본은 그대로 저장·복원할 수 있어야 한다.
  assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(snapshot))), snapshot);
  // 원본은 건드리지 않는다.
  assert.equal(data.settings.profile.name, '김교사');
  assert.equal(data.todos.length, 1);
});

test('공유 번호는 길고 헷갈리는 글자가 없으며 붙임표를 넣어도 알아본다', () => {
  const code = newShareCode();
  assert.equal(code.length, 24);
  assert.ok(validShareCode(code));
  assert.ok(!/[01IO]/.test(code), '0·1·I·O 처럼 헷갈리는 글자는 쓰지 않는다');
  assert.equal(formatShareCode(code).replace(/-/g, ''), code);
  assert.equal(normalizeShareCode(formatShareCode(code).toLowerCase()), code);
  assert.equal(normalizeShareCode(' ab cd-ef '), 'ABCDEF');
  assert.ok(!validShareCode('SHORT'));
  // 매번 다른 번호가 나온다.
  assert.equal(new Set(Array.from({ length: 50 }, () => newShareCode())).size, 50);
});

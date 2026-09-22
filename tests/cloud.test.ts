import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudConflict, decodeRecord, emptyData, nextRecord } from '../src/cloudModel.ts';
import { seedData } from '../src/model.ts';

test('클라우드 직렬화는 업무 연결·한국어·기간·원노트 원문을 보존한다', () => {
  const data = seedData('2026-09-15');
  data.tasks[0].links[0].url = 'onenote:https://example.invalid/공문.one#제목&section-id={abc}&page-id={def}&object-id={ghi}';
  assert.deepEqual(decodeRecord(nextRecord(undefined, 0, data)), { data, revision: 1 });
});
test('두 기기가 같은 버전을 편집하면 두 번째 저장을 거부해 첫 변경을 보존한다', () => {
  const base = nextRecord(undefined, 0, seedData('2026-09-15'));
  const a = decodeRecord(base).data; const b = structuredClone(a);
  a.tasks[0].memo = 'PC에서 먼저 저장'; b.tasks[0].memo = '휴대전화의 오래된 변경';
  const saved = nextRecord(base, 1, a);
  assert.throws(() => nextRecord(saved, 1, b), CloudConflict);
  assert.equal(decodeRecord(saved).data.tasks[0].memo, 'PC에서 먼저 저장');
  assert.equal(saved.revision, 2);
});
test('비어 있는 달력도 저장되어 재연결 시 예시가 다시 생기지 않는다', () => {
  const empty = nextRecord(undefined, 0, emptyData());
  assert.deepEqual(decodeRecord(empty).data, emptyData());
  assert.equal(nextRecord(empty, 1, emptyData()).revision, 2);
});
test('손상된 클라우드 데이터·잘못된 연결·실행 가능한 링크는 저장 전에 거부한다', () => {
  assert.throws(() => decodeRecord({ revision: 1, payload: '{bad' }));
  assert.throws(() => decodeRecord({ revision: -1, payload: '{}' }));
  const data = seedData('2026-09-15');
  data.events[0].taskId = 'missing';
  assert.throws(() => nextRecord(undefined, 0, data));
  data.events[0].taskId = data.tasks[0].id;
  data.tasks[0].links[0].url = 'javascript:alert(1)';
  assert.throws(() => nextRecord(undefined, 0, data));
});
test('클라우드 크기 제한은 한국어 UTF-8 바이트까지 계산한다', () => {
  const data = seedData('2026-09-15');
  for (let i = 0; i < 40; i++) {
    const task = structuredClone(data.tasks[1]); task.id = 'large-' + i;
    task.checklist = []; task.links = []; task.memo = '한'.repeat(10000); data.tasks.push(task);
  }
  assert.throws(() => nextRecord(undefined, 0, data), /900KB/);
});

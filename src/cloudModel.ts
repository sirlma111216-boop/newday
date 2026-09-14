import type { Data } from './model.ts';
import { parseBackup } from './storage.ts';

export const emptyData = (): Data => ({ version: 1, tasks: [], events: [], notices: [], delivered: [] });
export type CloudRecord = { revision: number; payload: string };
export class CloudConflict extends Error {
  constructor() { super('다른 기기에서 먼저 변경했습니다. 최신 내용을 확인한 뒤 다시 저장해 주세요. 입력 내용은 편집창에 유지됩니다.'); }
}
export function decodeRecord(value: unknown): { data: Data; revision: number } {
  if (!value || typeof value !== 'object') throw new Error('클라우드 데이터 형식이 올바르지 않습니다.');
  const r = value as Record<string, unknown>;
  if (!Number.isSafeInteger(r.revision) || (r.revision as number) < 1 || typeof r.payload !== 'string') throw new Error('클라우드 데이터 버전을 확인할 수 없습니다.');
  return { data: parseBackup(JSON.parse(r.payload)), revision: r.revision as number };
}
export function nextRecord(current: unknown, expected: number, next: Data): CloudRecord {
  const actual = current === undefined ? 0 : decodeRecord(current).revision;
  if (actual !== expected) throw new CloudConflict();
  const payload = JSON.stringify(parseBackup(next));
  if (new TextEncoder().encode(payload).length > 900000) throw new Error('클라우드 저장 한도(약 900KB)를 넘었습니다. JSON 백업 후 오래된 일정이나 메모를 정리해 주세요.');
  return { revision: actual + 1, payload };
}
export function cloudError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  if (code.includes('permission-denied')) return 'Firestore 접근 권한이 없습니다. 보안 규칙의 본인 UID와 로그인 계정을 확인해 주세요.';
  if (code.includes('unauthorized-domain')) return 'Firebase Authentication의 승인된 도메인에 현재 사이트 주소를 추가해 주세요.';
  if (code.includes('popup-blocked')) return '로그인 팝업이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.';
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return '로그인 창이 닫혔습니다. 다시 로그인할 수 있습니다.';
  if (code.includes('unavailable') || code.includes('network-request-failed')) return '네트워크에 연결하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
  return error instanceof Error ? error.message : '클라우드 요청을 처리하지 못했습니다. 다시 시도해 주세요.';
}

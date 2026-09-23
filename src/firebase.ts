import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { deleteDoc, doc, getDoc, getFirestore, onSnapshot, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { decodeRecord, emptyData, nextRecord } from './cloudModel';
import { parseBackup } from './storage';
import { dueNotices, type Data, type Notice } from './model';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};
export const cloudConfigured = Object.values(config).every(v => !!v?.trim());
export const cloudConfigIncomplete = !cloudConfigured && Object.values(config).some(Boolean);
const app = cloudConfigured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const calendar = (uid: string) => {
  if (!db) throw new Error('Firebase 설정이 필요합니다.');
  return doc(db, 'users', uid, 'calendar', 'main');
};
export async function login() {
  if (!auth) return;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}
export async function logout() { if (auth) await signOut(auth); }
export function watchCalendar(uid: string, receive: (data: Data, revision: number) => void, fail: (error: unknown) => void) {
  return onSnapshot(calendar(uid), { includeMetadataChanges: true }, snapshot => {
    // A cached empty snapshot is not proof that the server has no calendar.
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    try {
      const value = snapshot.exists() ? decodeRecord(snapshot.data()) : { data: emptyData(), revision: 0 };
      receive(value.data, value.revision);
    } catch (error) { fail(error); }
  }, fail);
}
export async function writeCalendar(uid: string, expected: number, data: Data) {
  const ref = calendar(uid);
  return runTransaction(db!, async transaction => {
    const snapshot = await transaction.get(ref);
    const next = nextRecord(snapshot.exists() ? snapshot.data() : undefined, expected, data);
    transaction.set(ref, { ...next, updatedAt: serverTimestamp() });
    return next.revision;
  });
}
export async function claimReminders(uid: string): Promise<Notice[]> {
  const ref = calendar(uid);
  return runTransaction(db!, async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return [];
    const { data, revision } = decodeRecord(snapshot.data());
    const notices = dueNotices(data);
    if (!notices.length) return [];
    const next = nextRecord(snapshot.data(), revision, {
      ...data, notices: [...notices, ...data.notices], delivered: [...data.delivered, ...notices.map(n => n.id)],
    });
    transaction.set(ref, { ...next, updatedAt: serverTimestamp() });
    return notices;
  });
}

// ── 일정 공유 ─────────────────────────────────────────
const shareRef = (code: string) => {
  if (!db) throw new Error('클라우드 설정이 없어 공유를 사용할 수 없습니다.');
  return doc(db, 'shares', code);
};

/** 고른 분류만 담은 사본을 공유 번호 문서에 저장한다. 보는 사람은 이 문서만 읽는다. */
export async function writeShare(code: string, ownerUid: string, label: string, snapshot: Data) {
  const payload = JSON.stringify(parseBackup(snapshot));
  if (new TextEncoder().encode(payload).length > 900000) throw new Error('공유할 내용이 너무 큽니다. 공유 분류를 줄여 주세요.');
  await setDoc(shareRef(code), { payload, label, ownerUid, updatedAt: serverTimestamp() });
}

export async function readShare(code: string): Promise<{ label: string; data: Data }> {
  let snap;
  try { snap = await getDoc(shareRef(code)); }
  catch (issue) {
    const code2 = (issue as { code?: string })?.code ?? '';
    if (code2.includes('permission-denied')) throw new Error('이 공유 달력을 볼 권한이 없습니다. Google 계정으로 로그인했는지, 번호가 맞는지 확인해 주세요.');
    if (code2.includes('unavailable') || code2.includes('network')) throw new Error('네트워크에 연결하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.');
    throw issue;
  }
  if (!snap.exists()) throw new Error('그런 공유 번호가 없습니다. 번호를 다시 확인해 주세요.');
  const value = snap.data() as Record<string, unknown>;
  if (typeof value.payload !== 'string') throw new Error('공유 데이터 형식이 올바르지 않습니다.');
  return { label: typeof value.label === 'string' ? value.label : '공유된 업무달력', data: parseBackup(JSON.parse(value.payload)) };
}

export async function deleteShare(code: string) { await deleteDoc(shareRef(code)); }

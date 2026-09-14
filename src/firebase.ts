import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getFirestore, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { decodeRecord, emptyData, nextRecord } from './cloudModel';
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

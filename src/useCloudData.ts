import { useCallback, useEffect, useRef, useState } from 'react';
import { claimReminders, watchCalendar, writeCalendar } from './firebase';
import { cloudError, emptyData } from './cloudModel';
import { dueNotices, type Data } from './model';

export function useCloudData(uid: string) {
  const [data, setData] = useState(emptyData);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [attempt, setAttempt] = useState(0);
  const state = useRef({ data, revision: 0, ready: false, busy: false, active: true });
  useEffect(() => {
    state.current.active = true;
    const stop = watchCalendar(uid, (next, revision) => {
      if (!state.current.active || revision < state.current.revision) return;
      state.current.data = next; state.current.revision = revision; state.current.ready = true;
      setData(next); setReady(true); setError('');
    }, issue => { state.current.ready = false; setError(cloudError(issue)); });
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { state.current.active = false; stop(); window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, [uid, attempt]);
  const commit = useCallback(async (next: Data, _recovery = false) => {
    const s = state.current;
    if (!s.ready || !navigator.onLine) { setError('클라우드에 연결된 상태에서 저장할 수 있습니다. 입력 내용은 유지됩니다.'); return false; }
    if (s.busy) { setError('앞선 변경을 저장하고 있습니다. 잠시 후 다시 시도해 주세요.'); return false; }
    s.busy = true; setBusy(true);
    try {
      const revision = await writeCalendar(uid, s.revision, next);
      if (!s.active) return false;
      if (revision >= s.revision) { s.revision = revision; s.data = next; setData(next); }
      setError(''); return true;
    } catch (issue) { if (s.active) setError(cloudError(issue)); return false; }
    finally { s.busy = false; if (s.active) setBusy(false); }
  }, [uid]);
  useEffect(() => {
    let active = true;
    let retryAfter = 0;
    const tick = async () => {
      const s = state.current;
      // Polling local state is free; contact Firestore only when a notice is actually due.
      if (!active || !s.ready || s.busy || Date.now() < retryAfter || !navigator.onLine || !dueNotices(s.data).length) return;
      s.busy = true;
      try {
        const notices = await claimReminders(uid);
        if (!active) return;
        if ('Notification' in window && Notification.permission === 'granted') {
          for (const n of notices.filter(n => Date.now() - n.dueAt < 120000)) {
            try { new Notification('업무달력', { body: n.title, tag: n.id }); } catch { /* Shared in-app notice remains available. */ }
          }
        }
      } catch (issue) { retryAfter = Date.now() + 30000; if (active) setError(cloudError(issue)); }
      finally { s.busy = false; }
    };
    const timer = setInterval(() => void tick(), 2000);
    const focus = () => void tick(); window.addEventListener('focus', focus);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [uid]);
  return { data, commit, error, setError, busy, ready, retry: () => setAttempt(v => v + 1),
    storageLabel: !online ? '오프라인 · 저장하려면 연결 필요' : busy ? '클라우드에 저장 중…' : ready ? 'Firebase에 동기화됨' : '클라우드 연결 중…', cloud: true };
}

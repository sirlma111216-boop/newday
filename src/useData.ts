import { useCallback, useEffect, useRef, useState } from 'react';
import { dueNotices, KEY, type Data } from './model';
import { loadData, parseBackup, saveData } from './storage';
export function useData() {
  const [initial] = useState(loadData); const [data, setData] = useState(initial.data); const [error, setError] = useState(initial.error); const [blocked, setBlocked] = useState(!!initial.error); const ref = useRef(data); ref.current = data;
  const commit = useCallback(async (next: Data, recovery = false) => { if (blocked && !recovery) { setError('기존 데이터 보호를 위해 저장이 중지되었습니다. 백업을 가져와 복구해 주세요.'); return false; } try { saveData(next); ref.current = next; setData(next); setError(''); setBlocked(false); return true; } catch { setError('저장 공간 또는 브라우저 권한 문제로 저장하지 못했습니다. 입력 내용은 유지됩니다. 백업을 내보내 주세요.'); return false; } }, [blocked]);
  useEffect(() => { const changed = (e: StorageEvent) => { if (e.key !== KEY) return; try { if (!e.newValue) throw Error(); const next = parseBackup(JSON.parse(e.newValue)); ref.current = next; setData(next); } catch { setBlocked(true); setError('다른 탭에서 저장 데이터가 변경되거나 삭제되었습니다. 백업을 확인해 주세요.'); } }; window.addEventListener('storage', changed); return () => window.removeEventListener('storage', changed); }, []);
  useEffect(() => { if (blocked) return; let active = true;
    const tick = async () => {
      const collect = async () => { if (!active) return; try { const raw = localStorage.getItem(KEY); const current = raw ? parseBackup(JSON.parse(raw)) : ref.current; const notices = dueNotices(current); if (!notices.length) return; const next = { ...current, notices: [...notices, ...current.notices], delivered: [...current.delivered, ...notices.map(n => n.id)] }; if (!await commit(next)) return; if ('Notification' in window && Notification.permission === 'granted') for (const n of notices.filter(n => Date.now() - n.dueAt < 120000)) { try { new Notification('업무달력', { body: n.title, tag: n.id }); } catch { /* In-app notice remains available. */ } } } catch { setError('저장 데이터를 확인하지 못해 알림 처리를 잠시 중지했습니다.'); } };
      if (navigator.locks) await navigator.locks.request('work-calendar-reminders', collect); else await collect();
    }; void tick(); const timer = window.setInterval(() => void tick(), 2000); const onVisible = () => void tick(); window.addEventListener('focus', onVisible); document.addEventListener('visibilitychange', onVisible); return () => { active = false; clearInterval(timer); window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, [blocked, commit]);
  return { data, commit, error, setError, busy: false, ready: true, storageLabel: '이 브라우저에 저장됨', cloud: false, retry: () => window.location.reload() };
}

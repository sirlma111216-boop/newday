import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { CalendarDays, Cloud, LogOut } from 'lucide-react';
import { auth, login, logout } from './firebase';
import { cloudError } from './cloudModel';

export function CloudSession({ children }: { children: (user: User) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => onAuthStateChanged(auth!, next => { setUser(next); setChecking(false); }, issue => { setError(cloudError(issue)); setChecking(false); }), []);
  if (user) return <>{children(user)}</>;
  return <div className="cloud-gate"><section className="cloud-login"><CalendarDays size={32}/><h1>업무달력</h1><p>같은 Google 계정으로 로그인하면<br/>PC와 휴대전화에서 같은 일정을 확인합니다.</p><button className="primary" disabled={checking || busy} onClick={async () => { setBusy(true); setError(''); try { await login(); } catch (issue) { setError(cloudError(issue)); } finally { setBusy(false); } }}>{checking ? '로그인 확인 중…' : busy ? '로그인 중…' : 'Google 계정으로 로그인'}</button>{error && <p className="form-error" role="alert">{error}</p>}<p className="help">기존 브라우저 일정은 로그인 후 JSON 백업으로 가져올 수 있습니다.</p></section></div>;
}
export function CloudAccount({ user, busy, error, onError }: { user: User; busy: boolean; error?: string; onError: (value: string) => void }) {
  return <div className="cloud-account"><span><Cloud size={16}/>{user.email || user.displayName || '로그인됨'}</span><details><summary>계정 정보</summary><div><p>Firestore 보안 규칙에 사용할 UID</p><code>{user.uid}</code>{error && <p role="alert">{error}</p>}</div></details><button disabled={busy} onClick={async () => { try { await logout(); } catch (issue) { onError(cloudError(issue)); } }}><LogOut size={14}/>로그아웃</button></div>;
}

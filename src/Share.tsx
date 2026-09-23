import { useState } from 'react';
import { Copy, Eye, RefreshCw, Share2, Trash2 } from 'lucide-react';
import { cloudConfigured } from './firebase';
import { deleteShare, writeShare } from './firebase';
import { auth } from './firebase';
import { buildShareSnapshot, formatShareCode, newShareCode, normalizeShareCode, shareLabel, validShareCode, type Data } from './model';

const MY_SHARE_KEY = 'work-calendar-my-share';
type MyShare = { code: string; categories: string[]; updatedAt: number };

export const readMyShare = (): MyShare | null => {
  try { const raw = localStorage.getItem(MY_SHARE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const writeMyShare = (value: MyShare | null) => {
  try { value ? localStorage.setItem(MY_SHARE_KEY, JSON.stringify(value)) : localStorage.removeItem(MY_SHARE_KEY); } catch { /* 저장 못 해도 이번 세션은 동작한다. */ }
};

export function ShareSettings({ data, onView, toast }: { data: Data; onView: (code: string) => void; toast: (message: string) => void }) {
  const [share, setShare] = useState<MyShare | null>(readMyShare);
  const [picked, setPicked] = useState<string[]>(() => readMyShare()?.categories ?? data.settings.categories.map(c => c.name));
  const [entry, setEntry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const names = data.settings.categories.map(c => c.name);
  const shared = names.filter(n => picked.includes(n));

  async function publish(code = share?.code ?? newShareCode()) {
    const uid = auth?.currentUser?.uid;
    if (!uid) { setError('공유하려면 먼저 로그인해야 합니다.'); return; }
    if (!shared.length) { setError('공유할 분류를 하나 이상 선택해 주세요.'); return; }
    setBusy(true); setError('');
    try {
      await writeShare(code, uid, shareLabel(data), buildShareSnapshot(data, shared));
      const next = { code, categories: shared, updatedAt: Date.now() };
      writeMyShare(next); setShare(next);
      toast(share ? '공유 내용을 새로 올렸습니다.' : '공유를 시작했습니다.');
    } catch (issue) { setError((issue as Error).message); }
    finally { setBusy(false); }
  }

  async function stop() {
    if (!share) return;
    setBusy(true); setError('');
    try {
      await deleteShare(share.code);
      writeMyShare(null); setShare(null);
      toast('공유를 중지했습니다.');
    } catch (issue) { setError((issue as Error).message); }
    finally { setBusy(false); }
  }

  async function copyCode() {
    if (!share) return;
    try { await navigator.clipboard.writeText(formatShareCode(share.code)); toast('공유 번호를 복사했습니다.'); }
    catch { toast('복사를 지원하지 않는 환경입니다. 번호를 직접 선택해 복사해 주세요.'); }
  }

  function openShared() {
    const code = normalizeShareCode(entry);
    if (!validShareCode(code)) { setError('공유 번호를 다시 확인해 주세요.'); return; }
    onView(code);
  }

  if (!cloudConfigured) return <>
    <p className="help">일정 공유는 Firebase 계정 동기화를 켠 상태에서만 쓸 수 있습니다. 지금은 이 브라우저에만 저장하는 모드라 다른 사람에게 보여 줄 수 없습니다.</p>
  </>;

  return <>
    <section className="settings-section">
      <h3><Share2 size={17}/>내 달력 공유하기</h3>
      <p className="help">고른 분류만 따로 복사해서 공유합니다. 고르지 않은 분류와 개인정보, 공휴일 인증키, 알림, 할 일은 공유본에 담기지 않습니다. 공유받은 사람은 <strong>보기만</strong> 할 수 있고 고치거나 지울 수 없습니다.</p>

      <div className="section-label">공유할 분류</div>
      <div className="share-categories">
        {names.map(name => <label className="category-filter" key={name}>
          <input type="checkbox" checked={picked.includes(name)} onChange={() => setPicked(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])}/>
          {name}
        </label>)}
      </div>
      <div className="button-row">
        <button type="button" onClick={() => setPicked([...names])}>모두 선택</button>
        <button type="button" onClick={() => setPicked([])}>모두 해제</button>
      </div>

      {share ? <>
        <div className="share-code-box">
          <div className="section-label">공유 번호</div>
          <code className="share-code">{formatShareCode(share.code)}</code>
          <div className="button-row">
            <button type="button" onClick={copyCode}><Copy size={15}/>번호 복사</button>
            <button type="button" disabled={busy} onClick={() => void publish()}><RefreshCw size={15}/>{busy ? '올리는 중…' : '지금 내용으로 갱신'}</button>
            <button type="button" className="danger" disabled={busy} onClick={() => void stop()}><Trash2 size={15}/>공유 중지</button>
          </div>
        </div>
        <p className="help">일정을 고친 뒤에는 <strong>‘지금 내용으로 갱신’</strong>을 눌러야 상대 화면에 반영됩니다. 공유 분류를 바꿨을 때도 같습니다. 공유를 중지하면 번호는 즉시 쓸 수 없게 됩니다.</p>
      </> : <>
        <div className="button-row"><button type="button" className="primary" disabled={busy} onClick={() => void publish()}>{busy ? '만드는 중…' : '공유 번호 만들기'}</button></div>
        <p className="help">번호를 아는 <strong>로그인한 사람만</strong> 볼 수 있습니다. 번호는 24자리 무작위로 만들어집니다.</p>
      </>}
    </section>

    <section className="settings-section">
      <h3><Eye size={17}/>공유받은 달력 보기</h3>
      <p className="help">받은 공유 번호를 넣으면 그 달력을 보는 화면으로 바뀝니다. 보는 동안에는 내 달력이 보이지 않고, ‘나가기’를 눌러야 돌아옵니다.</p>
      <label className="field">공유 번호
        <input value={entry} maxLength={80} placeholder="예: ABCD-EFGH-IJKL-MNOP-QRST-UVWX"
          onChange={e => { setEntry(e.currentTarget.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); openShared(); } }}/>
      </label>
      <div className="button-row"><button type="button" className="primary" disabled={!entry.trim()} onClick={openShared}><Eye size={15}/>이 달력 보기</button></div>
    </section>

    {error && <p className="form-error" role="alert">{error}</p>}
  </>;
}

import { useEffect, useRef, useState } from 'react';
import { QrCode, Download, Copy, Upload, ClipboardPaste, ExternalLink } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { safeLink } from './model';

type Tab = 'make' | 'read';

/** 붙여 넣기·파일에서 받은 그림을 읽기 위한 픽셀 변환. */
async function toImageData(source: Blob) {
  const bitmap = await createImageBitmap(source);
  // 너무 큰 사진은 줄여서 읽는다. 원본 그대로 읽으면 느리고 메모리를 많이 쓴다.
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('이 브라우저에서는 그림을 읽을 수 없습니다.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return ctx.getImageData(0, 0, width, height);
}

export function QrDialog({ onClose, toast }: { onClose: () => void; toast: (message: string) => void }) {
  const [tab, setTab] = useState<Tab>('make');
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [found, setFound] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // 만들기: 주소를 적는 대로 QR 그림을 다시 그린다.
  useEffect(() => {
    const value = text.trim();
    if (!value) { setImage(''); setError(''); return; }
    let alive = true;
    (async () => {
      try {
        const { toDataURL } = await import('qrcode');
        const url = await toDataURL(value, { width: 512, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0a0a0a', light: '#ffffff' } });
        if (alive) { setImage(url); setError(''); }
      } catch (issue) { if (alive) { setImage(''); setError(`QR을 만들지 못했습니다. ${(issue as Error).message}`); } }
    })();
    return () => { alive = false; };
  }, [text]);

  async function decode(source: Blob) {
    setBusy(true); setError(''); setFound('');
    try {
      const [{ default: jsQR }, pixels] = await Promise.all([import('jsqr'), toImageData(source)]);
      const result = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
      if (!result?.data) { setError('QR 코드를 찾지 못했습니다. 코드가 또렷하게 보이는 그림으로 다시 시도해 주세요.'); return; }
      setFound(result.data);
    } catch (issue) { setError(`그림을 읽지 못했습니다. ${(issue as Error).message}`); }
    finally { setBusy(false); }
  }

  // 붙여 넣기로 그림을 받는다. 캡처한 QR을 파일로 저장하지 않고 바로 쓸 수 있다.
  useEffect(() => {
    if (tab !== 'read') return;
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find(i => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (!file) return;
      e.preventDefault();
      void decode(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [tab]);

  async function pasteFromClipboard() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith('image/'));
        if (type) { void decode(await item.getType(type)); return; }
      }
      setError('복사한 그림이 없습니다. QR 그림을 복사한 뒤 다시 눌러 주세요.');
    } catch {
      setError('브라우저가 붙여넣기 버튼을 막았습니다. 이 창을 누른 뒤 Ctrl+V(맥은 Cmd+V)로 붙여 넣어 주세요.');
    }
  }

  function download() {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image;
    a.download = `qr-${Date.now()}.png`;
    a.click();
    toast('QR 그림을 내려받았습니다.');
  }

  async function copyFound() {
    try { await navigator.clipboard.writeText(found); toast('읽어 낸 주소를 복사했습니다.'); }
    catch { toast('복사를 지원하지 않는 환경입니다. 주소를 직접 선택해 복사해 주세요.'); }
  }

  return <FloatingPanel name="qr" title="QR 코드" icon={<QrCode size={18}/>} onClose={onClose} footer={<button type="button" onClick={onClose}>닫기</button>}>
    <div className="settings-tabs" role="tablist">
      <button role="tab" aria-selected={tab === 'make'} className={tab === 'make' ? 'active' : ''} onClick={() => setTab('make')}>QR 만들기</button>
      <button role="tab" aria-selected={tab === 'read'} className={tab === 'read' ? 'active' : ''} onClick={() => setTab('read')}>QR 읽기</button>
    </div>

    <div className="panel-content">
      {tab === 'make' && <>
        <label className="field">주소나 글
          <input aria-label="QR로 만들 내용" maxLength={2000} placeholder="https://..." value={text} onChange={e => setText(e.currentTarget.value)}/>
        </label>
        {image
          ? <div className="qr-result">
              <img src={image} alt="만들어진 QR 코드"/>
              <div className="button-row">
                <button type="button" onClick={download}><Download size={15}/>PNG로 저장</button>
              </div>
            </div>
          : <p className="help">주소를 적으면 바로 QR 코드가 만들어집니다. 글자도 넣을 수 있습니다.</p>}
      </>}

      {tab === 'read' && <>
        <div className="qr-drop" ref={dropRef}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over'); }}
          onDragLeave={e => e.currentTarget.classList.remove('over')}
          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('over'); const file = e.dataTransfer.files?.[0]; if (file?.type.startsWith('image/')) void decode(file); }}>
          <ClipboardPaste size={22}/>
          <p>여기에 <strong>Ctrl+V</strong>로 붙여 넣거나 그림을 끌어다 놓으세요.</p>
          <div className="button-row">
            <button type="button" disabled={busy} onClick={() => void pasteFromClipboard()}><ClipboardPaste size={15}/>복사한 그림 붙여넣기</button>
            <label className="file-pick">
              <Upload size={15}/>그림 파일 열기
              <input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) void decode(file); e.target.value = ''; }}/>
            </label>
          </div>
        </div>
        {busy && <p className="help" role="status">그림을 읽는 중입니다…</p>}
        {found && <div className="qr-found">
          <div className="section-label">읽어 낸 내용</div>
          <p className="qr-text">{found}</p>
          <div className="button-row">
            <button type="button" onClick={() => void copyFound()}><Copy size={15}/>복사</button>
            {safeLink(found.trim()) && <a className="qr-open" href={found.trim()} target={found.trim().toLowerCase().startsWith('https:') ? '_blank' : undefined} rel="noopener noreferrer"><ExternalLink size={15}/>열기</a>}
          </div>
        </div>}
      </>}

      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </FloatingPanel>;
}

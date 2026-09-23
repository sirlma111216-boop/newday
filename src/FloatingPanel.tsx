import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

type Spot = { x: number; y: number };

const spotKey = (name: string) => `work-calendar-panel-${name}`;
const readSpot = (name: string): Spot | null => {
  try { const raw = localStorage.getItem(spotKey(name)); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const writeSpot = (name: string, spot: Spot) => {
  try { localStorage.setItem(spotKey(name), JSON.stringify(spot)); } catch { /* 저장 못 해도 이번 세션은 동작한다. */ }
};

/** 화면 밖으로 나가지 않게 가둔다. 창 크기가 바뀌어도 다시 불러올 수 있어야 한다. */
function clamp(spot: Spot, width: number, height: number): Spot {
  return {
    x: Math.max(8, Math.min(spot.x, window.innerWidth - Math.min(width, window.innerWidth) - 8)),
    y: Math.max(8, Math.min(spot.y, window.innerHeight - Math.min(height, window.innerHeight) - 8)),
  };
}

/**
 * 달력을 보면서 쓸 수 있도록 화면을 막지 않는 떠 있는 창.
 * 제목 줄을 끌어 옮길 수 있고 위치를 기억한다. 좁은 화면에서는 아래쪽에 고정한다.
 */
export function FloatingPanel({ name, title, icon, onClose, children, footer }: { name: string; title: string; icon?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 699px)').matches);
  const [spot, setSpot] = useState<Spot | null>(readSpot(name));
  // 끌기를 끝낼 때 저장하려면 최신 위치가 필요하다. 상태만 읽으면 끌기 전 값이 저장된다.
  const spotRef = useRef(spot);
  spotRef.current = spot;

  useEffect(() => {
    const query = window.matchMedia('(max-width: 699px)');
    const sync = () => setCompact(query.matches);
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // 처음 열 때는 화면 가운데 위쪽에 둔다.
  useEffect(() => {
    if (compact || spot || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    setSpot(clamp({ x: Math.max(8, (window.innerWidth - box.width) / 2), y: 72 }, box.width, box.height));
  }, [compact, spot]);

  // 창 크기가 줄어 패널이 화면 밖에 남는 일을 막는다.
  useEffect(() => {
    if (compact) return;
    const fit = () => setSpot(previous => {
      if (!previous || !ref.current) return previous;
      const box = ref.current.getBoundingClientRect();
      return clamp(previous, box.width, box.height);
    });
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [compact]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (compact || e.button !== 0 || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    grab.current = { dx: e.clientX - box.left, dy: e.clientY - box.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDrag = (e: PointerEvent<HTMLDivElement>) => {
    const held = grab.current;
    if (!held || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const next = clamp({ x: e.clientX - held.dx, y: e.clientY - held.dy }, box.width, box.height);
    spotRef.current = next;
    setSpot(next);
  };
  const endDrag = () => {
    if (grab.current && spotRef.current) writeSpot(name, spotRef.current);
    grab.current = null;
  };

  const placement = compact || !spot ? undefined : { left: spot.x, top: spot.y };

  return <div ref={ref} className={'floating-panel ' + (compact ? 'sheet' : '')} style={placement} role="dialog" aria-label={title}>
    <div className="floating-head" onPointerDown={startDrag} onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <h2>{icon}{title}</h2>
      <button type="button" className="icon-button" aria-label="닫기" onClick={onClose}><X size={20}/></button>
    </div>
    <div className="floating-body">{children}</div>
    {footer && <div className="floating-foot">{footer}</div>}
  </div>;
}

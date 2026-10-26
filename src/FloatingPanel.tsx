import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

type Spot = { x: number; y: number };
type Size = { w: number; h: number };
type Edge = 'e' | 'w' | 's' | 'se' | 'sw';

const MIN_W = 320;
const MIN_H = 240;
const EDGES: Edge[] = ['e', 'w', 's', 'se', 'sw'];

const spotKey = (name: string) => `work-calendar-panel-${name}`;
const sizeKey = (name: string) => `work-calendar-panel-${name}-size`;
const readSaved = <T,>(key: string): T | null => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const writeSaved = (key: string, value: unknown) => {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 못 해도 이번 세션은 동작한다. */ }
};
const readSpot = (name: string) => readSaved<Spot>(spotKey(name));
const writeSpot = (name: string, spot: Spot) => writeSaved(spotKey(name), spot);
const between = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** 저장된 크기가 지금 화면보다 크면 화면 안으로 줄인다. */
function fitSize(size: Size | null): Size | null {
  if (!size || !Number.isFinite(size.w) || !Number.isFinite(size.h)) return null;
  return { w: between(size.w, MIN_W, window.innerWidth - 16), h: between(size.h, MIN_H, window.innerHeight - 16) };
}

/** 화면 밖으로 나가지 않게 가둔다. 창 크기가 바뀌어도 다시 불러올 수 있어야 한다. */
function clamp(spot: Spot, width: number, height: number): Spot {
  return {
    x: Math.max(8, Math.min(spot.x, window.innerWidth - Math.min(width, window.innerWidth) - 8)),
    y: Math.max(8, Math.min(spot.y, window.innerHeight - Math.min(height, window.innerHeight) - 8)),
  };
}

/**
 * 달력을 보면서 쓸 수 있도록 화면을 막지 않는 떠 있는 창.
 * 제목 줄을 끌어 옮길 수 있고, 가장자리를 끌어 크기를 바꾼다. 위치와 크기를 기억한다.
 * 좁은 화면에서는 아래쪽에 고정한다.
 */
export function FloatingPanel({ name, title, icon, onClose, children, footer }: { name: string; title: string; icon?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 699px)').matches);
  const [spot, setSpot] = useState<Spot | null>(readSpot(name));
  // 끌기를 끝낼 때 저장하려면 최신 위치가 필요하다. 상태만 읽으면 끌기 전 값이 저장된다.
  const spotRef = useRef(spot);
  spotRef.current = spot;
  const [size, setSize] = useState<Size | null>(() => fitSize(readSaved<Size>(sizeKey(name))));
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const resizing = useRef<{ edge: Edge; x: number; y: number; left: number; top: number; w: number; h: number } | null>(null);

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
    const fit = () => {
      setSize(previous => fitSize(previous));
      setSpot(previous => {
        if (!previous || !ref.current) return previous;
        const box = ref.current.getBoundingClientRect();
        return clamp(previous, box.width, box.height);
      });
    };
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

  const startResize = (edge: Edge) => (e: PointerEvent<HTMLDivElement>) => {
    if (compact || e.button !== 0 || !ref.current) return;
    e.preventDefault();
    const box = ref.current.getBoundingClientRect();
    resizing.current = { edge, x: e.clientX, y: e.clientY, left: box.left, top: box.top, w: box.width, h: box.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResize = (e: PointerEvent<HTMLDivElement>) => {
    const held = resizing.current;
    if (!held) return;
    const dx = e.clientX - held.x;
    const dy = e.clientY - held.y;
    let { left, w, h } = held;
    if (held.edge.includes('e')) w = between(held.w + dx, MIN_W, window.innerWidth - 8 - held.left);
    // 왼쪽 가장자리는 오른쪽 끝을 그대로 두고 왼쪽 끝을 옮긴다.
    if (held.edge.includes('w')) { w = between(held.w - dx, MIN_W, held.left + held.w - 8); left = held.left + held.w - w; }
    if (held.edge.includes('s')) h = between(held.h + dy, MIN_H, window.innerHeight - 8 - held.top);
    const nextSize = { w, h };
    const nextSpot = { x: left, y: held.top };
    sizeRef.current = nextSize;
    spotRef.current = nextSpot;
    setSize(nextSize);
    setSpot(nextSpot);
  };
  const endResize = () => {
    if (resizing.current) {
      if (sizeRef.current) writeSaved(sizeKey(name), sizeRef.current);
      if (spotRef.current) writeSpot(name, spotRef.current);
    }
    resizing.current = null;
  };
  // 모서리를 두 번 누르면 처음 크기로 돌아간다.
  const resetSize = () => { setSize(null); writeSaved(sizeKey(name), null); };

  const placement = compact || !spot ? undefined : { left: spot.x, top: spot.y, ...(size ? { width: size.w, height: size.h, maxHeight: 'none' } : {}) };

  return <div ref={ref} className={'floating-panel ' + (compact ? 'sheet' : '')} style={placement} role="dialog" aria-label={title}>
    {!compact && EDGES.map(edge => <div key={edge} className={'floating-resize ' + edge} aria-hidden="true"
      title={edge === 'se' ? '끌어서 크기 조절 · 두 번 누르면 처음 크기' : undefined}
      onPointerDown={startResize(edge)} onPointerMove={onResize} onPointerUp={endResize} onPointerCancel={endResize}
      onDoubleClick={edge === 'se' ? resetSize : undefined}/>)}
    <div className="floating-head" onPointerDown={startDrag} onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <h2>{icon}{title}</h2>
    </div>
    <div className="floating-body">{children}</div>
    {footer && <div className="floating-foot">{footer}</div>}
  </div>;
}

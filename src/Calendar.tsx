import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { addDays, calendarDays, dayDiff, deadlineLabel, seoulToday, weekSegments, categoryStyleOf, schoolHolidayOn, weekdayLabels, weekdayOf, type Data, type Schedule, type Settings } from './model';

type Props = {
  data: Data;
  settings: Settings;
  holidays: Record<string, string>;
  events: Schedule[];
  month: string;
  open: (id: string) => void;
  quickAdd: (title: string, start: string, end: string) => Promise<boolean>;
  showDay: (date: string) => void;
  move: (id: string, date: string, origin: string, resize: boolean) => void;
};

export function Calendar({ data, settings, holidays, events, month, open, quickAdd, showDay, move }: Props) {
  const [draft, setDraft] = useState<{ start: string; end: string; title: string } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const anchor = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);

  useEffect(() => { if (draft && !selecting) input.current?.focus(); }, [draft?.start, selecting]);
  const begin = (date: string) => {
    if (savingRef.current || draft?.title.trim()) { input.current?.focus(); return false; }
    setDraft({ start: date, end: date, title: '' });
    setError('');
    return true;
  };
  const pointerDate = (e: PointerEvent) => {
    const cells = e.currentTarget.closest('.calendar')?.querySelectorAll<HTMLElement>('[data-date]');
    return Array.from(cells || []).find(cell => {
      const rect = cell.getBoundingClientRect();
      return e.clientX >= rect.left && e.clientX < rect.right && e.clientY >= rect.top && e.clientY < rect.bottom;
    })?.dataset.date;
  };
  const startSelection = (e: PointerEvent<HTMLDivElement>, date: string) => {
    if (compact || e.button !== 0 || !begin(date)) return;
    anchor.current = date;
    setSelecting(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const extendSelection = (e: PointerEvent) => {
    const date = pointerDate(e), first = anchor.current;
    if (first && date) setDraft(current => current && ({ ...current, start: first < date ? first : date, end: first < date ? date : first }));
  };
  const finishSelection = (e: PointerEvent) => {
    if (!anchor.current) return;
    extendSelection(e);
    anchor.current = null;
    setSelecting(false);
  };
  const submit = async () => {
    if (!draft || savingRef.current) return;
    const title = draft.title.trim();
    if (!title) { setDraft(null); return; }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      if (await quickAdd(title, draft.start, draft.end)) setDraft(null);
      else setError('저장하지 못했습니다. 연결을 확인하고 다시 저장해 주세요.');
    } catch { setError('저장하지 못했습니다. 입력 내용은 유지됩니다.'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 699px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 699px)');
    const sync = () => setCompact(query.matches);
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const prefs = settings.calendar; const days = calendarDays(month, prefs.weekStart), today = seoulToday();
  const drag = (e: DragEvent, id: string, origin: string, resize = false) => {
    e.stopPropagation();
    e.dataTransfer.setData('application/work-calendar', JSON.stringify({ id, origin, resize }));
    e.dataTransfer.effectAllowed = 'move';
  };
  const drop = (e: DragEvent, date: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/work-calendar'));
      if (typeof payload.id === 'string' && typeof payload.origin === 'string') move(payload.id, date, payload.origin, payload.resize === true);
    } catch { /* Ignore unrelated drags. */ }
  };

  return <div className="calendar">
    <div className="weekdays">{weekdayLabels(prefs.weekStart).map((day, i) => { const w = (i + prefs.weekStart) % 7; return <span key={day} className={w === 0 ? 'sun' : w === 6 ? 'sat' : ''}>{day}</span>; })}</div>
    {Array.from({ length: days.length / 7 }, (_, weekIndex) => {
      const week = days.slice(weekIndex * 7, weekIndex * 7 + 7);
      const segments = weekSegments(events, week);
      const preview = draft && draft.start <= week[6] && draft.end >= week[0] ? { start: Math.max(0, dayDiff(draft.start, week[0])), end: Math.min(6, dayDiff(draft.end, week[0])) } : null;
      return <div className="week" key={week[0]}>
        <div className="day-backgrounds">{week.map((date, dayIndex) => { const publicName = holidays[date]; const school = schoolHolidayOn(settings, date); const weekday = weekdayOf(date); const restDay = weekday === 0 || !!publicName; return <div key={date} data-date={date} className={'day ' + (date.slice(0, 7) !== month.slice(0, 7) ? 'muted ' : '') + (restDay ? 'rest-day ' : '') + (school ? 'school-holiday ' : '') + (weekday === 0 ? 'sun ' : weekday === 6 ? 'sat ' : '')} onClick={() => { if (compact) showDay(date); }} onPointerDown={e => startSelection(e, date)} onPointerMove={extendSelection} onPointerUp={finishSelection} onPointerCancel={() => { anchor.current = null; setSelecting(false); }} onDragOver={e => { if (e.dataTransfer.types.includes('application/work-calendar')) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); } }} onDragLeave={e => e.currentTarget.classList.remove('drag-over')} onDrop={e => drop(e, date)}>
          <button className={'day-number ' + (date === today ? 'today' : '')} aria-label={compact ? `${date} 일정 보기` : `${date} 일정 추가`} aria-current={date === today ? 'date' : undefined} onClick={e => { e.stopPropagation(); if (compact) showDay(date); else if (e.detail === 0) begin(date); }}>{Number(date.slice(8))}</button>
          {date === today && <span className="today-label">오늘</span>}
          {(publicName || school) && <span className={'holiday-name ' + (publicName ? 'public' : '')} title={[publicName, school?.name].filter(Boolean).join(' · ')}>{publicName || school!.name}</span>}
        </div>; })}</div>

        <div className="event-grid">{segments.filter(segment => segment.lane < prefs.maxPerCell).map(segment => {
          const task = data.tasks.find(item => item.id === segment.event.taskId)!;
          const period = segment.event.start !== segment.event.end;
          const deadline = deadlineLabel(segment.event);
          return <div key={segment.event.id} className={`event ${period ? 'period' : 'single'} ${segment.continued ? 'continued' : ''} ${segment.continues ? 'continues' : ''}`} style={{ ...categoryStyleOf(settings, task.category), gridColumn: `${segment.start + 1} / span ${segment.span}`, gridRow: segment.lane + 1 }} draggable onDragStart={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const offset = Math.min(segment.span - 1, Math.max(0, Math.floor((e.clientX - rect.left) / (rect.width / segment.span))));
            drag(e, segment.event.id, addDays(week[segment.start], offset));
          }}>
            <button className="event-title" onClick={() => open(segment.event.id)} title={`${segment.event.title} · ${segment.event.start}~${segment.event.end} · ${task.category}${deadline ? ' · ' + deadline : ''}`}>
              {segment.continued && '‹ '}{segment.event.type === '마감' && '⚑ '}{!segment.event.allDay && <span className="event-time">{segment.event.type === '마감' ? segment.event.endTime : segment.event.startTime} </span>}{segment.event.title}{segment.continues && ' ›'}{deadline && <span className="event-dday">{deadline}</span>}
            </button>
            {period && !segment.continues && <span draggable role="button" tabIndex={0} aria-label={`${segment.event.title} 종료일 변경`} title="끌어서 종료일 변경 · Enter로 상세 편집" className="resize-handle" onClick={e => { e.stopPropagation(); open(segment.event.id); }} onKeyDown={e => { if (e.key === 'Enter') open(segment.event.id); }} onDragStart={e => drag(e, segment.event.id, segment.event.end, true)}>⋮</span>}
          </div>;
        })}
        {week.map((date, column) => {
          const hidden = segments.filter(segment => segment.lane >= prefs.maxPerCell && segment.start <= column && segment.start + segment.span > column).length;
          return hidden > 0 && <button key={date} className="more-events" style={{ gridColumn: column + 1, gridRow: prefs.maxPerCell + 1 }} onClick={() => showDay(date)}>외 {hidden}개</button>;
        })}</div>

        {preview && draft && <div className="inline-grid"><div className={'inline-entry cat-4 ' + (draft.start !== draft.end ? 'range-entry' : '')} style={{ gridColumn: (preview.start + 1) + ' / span ' + (preview.end - preview.start + 1) }}>
          {draft.start !== draft.end && <div className="draft-range-line" aria-label={draft.start + '부터 ' + draft.end + '까지'}/>}
          {week.includes(draft.start) && !selecting ? <form onSubmit={e => { e.preventDefault(); void submit(); }} className="inline-form">
            <div className="inline-title-row">{draft.start === draft.end && <span className="inline-dot" title="미지정"/>}<input ref={input} aria-label="달력에 일정 바로 입력" placeholder="일정 입력" maxLength={300} value={draft.title} disabled={saving} onChange={e => setDraft({ ...draft, title: e.currentTarget.value })} onKeyDown={e => { if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault(); if (e.key === 'Escape' && !saving) setDraft(null); }}/></div>
            <div className="inline-actions"><button type="submit" disabled={saving}>{saving ? '저장 중' : '저장 ↵'}</button><button type="button" disabled={saving} onClick={() => setDraft(null)}>취소</button></div>
            {error && <p role="alert">{error}</p>}
          </form> : <span className="range-preview-label">{selecting ? '미지정' : draft.title || '일정 입력 중'}</span>}
        </div></div>}
      </div>;
    })}
  </div>;
}

import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Eye, List, LogOut, X } from 'lucide-react';
import { Calendar } from './Calendar';
import { Modal } from './Editor';
import { readShare } from './firebase';
import { useHolidays } from './holidays';
import { calendarVars, categoryStyleOf, dateLabel, deadlineLabel, filteredEvents, seoulToday, shiftMonth, type Data, type Schedule } from './model';

const SHARE_KEY = 'work-calendar-viewing-share';
export const rememberedShare = () => { try { return localStorage.getItem(SHARE_KEY) || ''; } catch { return ''; } };
export const rememberShare = (code: string) => { try { code ? localStorage.setItem(SHARE_KEY, code) : localStorage.removeItem(SHARE_KEY); } catch { /* 저장 못 해도 이번 세션은 동작한다. */ } };

/** 남의 공유 달력을 보는 화면. 고치거나 지우는 길이 아예 없다. */
export function SharedCalendar({ code, onLeave }: { code: string; onLeave: () => void }) {
  const [state, setState] = useState<{ label: string; data: Data } | null>(null);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(seoulToday());
  const [view, setView] = useState<'calendar' | 'list'>(() => window.innerWidth < 700 ? 'list' : 'calendar');
  const [dayView, setDayView] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [now] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    setState(null); setError('');
    readShare(code)
      .then(result => { if (alive) setState(result); })
      .catch(issue => { if (alive) setError((issue as Error).message); });
    return () => { alive = false; };
  }, [code]);

  const data = state?.data;
  const settings = data?.settings;
  const today = seoulToday(new Date(now));
  const names = settings?.categories.map(c => c.name) ?? [];
  const events = data ? filteredEvents(data, '', names, false) : [];
  const years = [Number(month.slice(0, 4)) - 1, Number(month.slice(0, 4)), Number(month.slice(0, 4)) + 1];
  const { holidays } = useHolidays(data ? years : [], '');
  const monthEvents = events
    .filter(e => e.start.slice(0, 7) <= month.slice(0, 7) && e.end.slice(0, 7) >= month.slice(0, 7))
    .sort((a, b) => a.start.localeCompare(b.start) || a.startTime.localeCompare(b.startTime));
  const current = data?.events.find(e => e.id === picked);
  const currentTask = data?.tasks.find(t => t.id === current?.taskId);

  const rows = (list: Schedule[]) => list.length
    ? <div className="event-list">{list.map(e => {
        const t = data!.tasks.find(item => item.id === e.taskId)!;
        const deadline = deadlineLabel(e, today, now);
        return <button key={e.id} className="list-row" style={categoryStyleOf(settings!, t.category)} onClick={() => { setPicked(e.id); setDayView(null); }}>
          <span className="list-date"><strong>{dateLabel(e.start)}</strong><small>{e.start !== e.end ? `~ ${dateLabel(e.end)}` : e.allDay ? '종일' : `${e.startTime}–${e.endTime}`}</small></span>
          <span className="list-main"><strong>{e.title}</strong><small>{t.name !== e.title ? `관련 업무 · ${t.name}` : '일정'}</small></span>
          <span className="list-meta"><span className="tag">{t.category}</span>{deadline && <span className="deadline-badge">{deadline}</span>}</span>
        </button>;
      })}</div>
    : <div className="empty-state"><CalendarDays size={30}/><p>표시할 일정이 없습니다.</p></div>;

  return <div className="app" style={settings ? calendarVars(settings.calendar) : undefined}>
    <div className="share-bar">
      <span className="share-where"><Eye size={17}/><strong>{state?.label ?? '공유 달력'}</strong>을 보는 중입니다 · 읽기 전용</span>
      <button className="primary" onClick={() => { rememberShare(''); onLeave(); }}><LogOut size={16}/>나가기</button>
    </div>

    {error && <div className="cloud-gate"><section className="cloud-login">
      <h1>공유 달력을 열지 못했습니다</h1>
      <p role="alert">{error}</p>
      <button onClick={() => { rememberShare(''); onLeave(); }}>내 달력으로 돌아가기</button>
    </section></div>}

    {!error && !data && <div className="cloud-gate"><section className="cloud-login"><h1>공유 달력</h1><p role="status">불러오는 중입니다…</p></section></div>}

    {data && settings && <div className="workspace"><main>
      <div className="calendar-toolbar">
        <div className="month-title">
          <h1>{month.slice(0, 4)}년 {Number(month.slice(5, 7))}월</h1>
          <button className="icon-button" aria-label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18}/></button>
          <button className="icon-button" aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18}/></button>
          <button onClick={() => setMonth(today)}>오늘</button>
        </div>
        <div className="view-toggle">
          <button aria-pressed={view === 'calendar'} className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={16}/>월간</button>
          <button aria-pressed={view === 'list'} className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={16}/>목록</button>
        </div>
      </div>
      <div className="calendar-subtitle"><span>공유받은 달력입니다. 고치거나 지울 수 없습니다.</span><span>{monthEvents.length}개 일정</span></div>

      {view === 'calendar'
        ? <div className="calendar-scroll"><Calendar readOnly data={data} settings={settings} holidays={holidays} events={events} month={month}
            open={id => setPicked(id)} quickAdd={async () => false} showDay={setDayView} move={() => {}}/></div>
        : rows(monthEvents)}
      <footer><span><span className="status-dot"/>공유 달력 · 읽기 전용</span><span>{settings.categories.length}개 분류를 공유받았습니다</span></footer>
    </main></div>}

    {dayView && data && <Modal title={`${dateLabel(dayView)}의 일정`} onClose={() => setDayView(null)} wide>
      <div className="modal-content">{rows(events.filter(e => e.start <= dayView && e.end >= dayView))}</div>
    </Modal>}

    {current && currentTask && <Modal title="일정 보기" onClose={() => setPicked(null)}>
      <div className="modal-content share-detail">
        <div className="detail-tags"><span className="tag" style={categoryStyleOf(settings!, currentTask.category)}>{currentTask.category}</span></div>
        <h2>{current.title}</h2>
        <p className="detail-date"><CalendarDays size={17}/><span>{dateLabel(current.start)}{current.start !== current.end ? ` – ${dateLabel(current.end)}` : ''}<small>{current.allDay ? '종일' : `${current.startTime} – ${current.endTime}`} · 서울 시간</small></span></p>
        {currentTask.name !== current.title && <p className="help">관련 업무 · {currentTask.name}</p>}
        {currentTask.memo && <section className="detail-section"><h3>메모</h3><p className="memo">{currentTask.memo}</p></section>}
        {currentTask.checklist.length > 0 && <section className="detail-section"><h3>준비할 일</h3>{currentTask.checklist.map(item => <p key={item.id} className={'check-item ' + (item.done ? 'checked' : '')}><span>{item.done ? '✓ ' : '· '}{item.text}</span></p>)}</section>}
        {currentTask.links.length > 0 && <section className="detail-section"><h3>관련 자료</h3>{currentTask.links.map(link => <p key={link.id} className="help share-link">{link.url}</p>)}</section>}
      </div>
      <div className="modal-actions"><button onClick={() => setPicked(null)}><X size={16}/>닫기</button></div>
    </Modal>}
  </div>;
}

/** 자기 달력을 아직 못 여는 사람도 공유 번호로는 들어올 수 있어야 한다. */
export function ShareEntry({ onView }: { onView: (code: string) => void }) {
  const [entry, setEntry] = useState('');
  const [problem, setProblem] = useState('');
  const go = () => {
    const code = (entry.toUpperCase().match(/[A-Z0-9]/g) ?? []).join('');
    if (!/^[A-Z0-9]{16,64}$/.test(code)) { setProblem('공유 번호를 다시 확인해 주세요.'); return; }
    onView(code);
  };
  return <div className="share-entry">
    <label className="field">공유 번호로 남의 달력 보기
      <input value={entry} maxLength={80} placeholder="받은 공유 번호를 넣어 주세요"
        onChange={e => { setEntry(e.currentTarget.value); setProblem(''); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); go(); } }}/>
    </label>
    <button type="button" disabled={!entry.trim()} onClick={go}><Eye size={15}/>이 달력 보기</button>
    {problem && <p className="form-error" role="alert">{problem}</p>}
  </div>;
}

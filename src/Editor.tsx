import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Plus, Trash2, Link2, CheckSquare, ChevronDown, Globe } from 'lucide-react';
import { blankTask, categoryStyle, fallbackCategory, REMINDERS, safeLink, uid, validateEvent, type Data, type Schedule, type Task } from './model';

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className={'modal ' + (wide ? 'wide' : '')} onCancel={e => { e.preventDefault(); onClose(); }} aria-label={title}>
    <div className="modal-heading"><h2>{title}</h2><button type="button" className="icon-button" aria-label="닫기" onClick={onClose}><X size={20}/></button></div>
    {children}
  </dialog>;
}

// 원노트 단락 링크는 onenote: 주소로도, 학교 SharePoint·OneDrive의 https 주소로도 복사됩니다.
function isOneNoteLink(url: string) {
  const value = url.toLowerCase();
  return value.startsWith('onenote:') || value.includes('onenote') || value.includes('.one') || value.includes('sharepoint.com') || value.includes('onedrive.live.com') || value.includes('docs.live.net');
}

function OneNoteIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="2.4" y="2.5" width="13.6" height="19" rx="2.2" fill="#7719AA"/>
    <path d="M6.1 17.3V6.7h2.1l3.9 6.2V6.7h2.1v10.6h-2.1l-3.9-6.2v6.2z" fill="#fff"/>
    <rect x="16.8" y="5.3" width="4.8" height="4.2" rx="1.2" fill="#C48EDD"/>
    <rect x="16.8" y="9.9" width="4.8" height="4.2" rx="1.2" fill="#A65FCB"/>
    <rect x="16.8" y="14.5" width="4.8" height="4.2" rx="1.2" fill="#8534B5"/>
  </svg>;
}

export function Editor({ data, event, onSave, onClose, mode = 'modal', onDelete }:{ data: Data; event: Schedule; onSave: (event: Schedule, task: Task) => Promise<boolean>; onClose: () => void; mode?: 'modal' | 'panel'; onDelete?: () => void }) {
  const existing = data.events.some(e => e.id === event.id);
  const [draft, setDraft] = useState({ ...event });
  const [task, setTask] = useState<Task>(() => structuredClone(data.tasks.find(t => t.id === event.taskId) || blankTask(fallbackCategory(data.settings))));
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const originalEvent = useRef(data.events.find(e => e.id === event.id));
  const originalTask = useRef(data.tasks.find(t => t.id === event.taskId));
  const isLinked = data.events.some(e => e.id !== draft.id && e.taskId === draft.taskId);
  const linkValue = isLinked ? draft.taskId : '';
  const linkOptions = data.tasks.filter(candidate => data.events.some(e => e.id !== draft.id && e.taskId === candidate.id));

  const update = (values: Partial<Schedule>) => { setDirty(true); setDraft(previous => ({ ...previous, ...values })); };
  const changeTask = (values: Partial<Task>) => { setDirty(true); setTask(previous => ({ ...previous, ...values })); };
  const close = () => saving ? undefined : dirty ? setDiscard(true) : onClose();
  const inferredType = (start: string, end: string) => start === end ? '일반 일정' as const : '기간' as const;

  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (mode !== 'panel') return;
    panelRef.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => { if (document.querySelector('dialog[open]')) return; if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (JSON.stringify(originalEvent.current) !== JSON.stringify(data.events.find(item => item.id === event.id)) || JSON.stringify(originalTask.current) !== JSON.stringify(data.tasks.find(item => item.id === draft.taskId))) {
      setError('편집 중 다른 기기나 창에서 이 일정 또는 관련 업무가 변경되었습니다. 편집창을 다시 열어 최신 내용을 확인해 주세요.');
      return;
    }
    const normalized = { ...draft, type: draft.type === '마감' ? '마감' as const : inferredType(draft.start, draft.end) };
    const problem = validateEvent(normalized);
    if (problem) { setError(problem); return; }
    const links = task.links.map(link => ({ ...link, name: link.name.trim(), url: link.url.trim() }));
    const badLink = links.findIndex(link => !safeLink(link.url));
    if (badLink >= 0) {
      setError(`자료 링크 ${badLink + 1}의 주소를 확인해 주세요. https: 또는 onenote: 로 시작하는 주소만 저장할 수 있습니다.`);
      return;
    }
    if (task.checklist.some(item => !item.text.trim())) { setError('준비할 일을 입력하거나 빈 항목을 삭제해 주세요.'); return; }
    const savedTask = { ...task, links, name: task.name.trim() || normalized.title.trim() };
    setSaving(true);
    try {
      if (await onSave({ ...normalized, title: normalized.title.trim(), taskId: savedTask.id }, savedTask)) { if (mode === 'modal') onClose(); }
      else setError('저장하지 못했습니다. 입력 내용은 유지됩니다. 연결 상태를 확인하고 다시 시도해 주세요.');
    } finally { setSaving(false); }
  };

  const formBody = <fieldset disabled={saving} className="editor-fields"><div className="form-body">
    <label className="field">일정명<input autoFocus={mode === 'modal'} value={draft.title} maxLength={300} placeholder="어떤 일정이 있나요?" onChange={e => update({ title: e.currentTarget.value })}/></label>
    <div className="field-row">
      <label className="field">시작일<input type="date" min="1900-01-01" max="2200-12-31" value={draft.start} onInput={e => { const start = e.currentTarget.value; const end = draft.start === draft.end ? start : draft.end; update({ start, end, type: draft.type === '마감' ? '마감' : inferredType(start, end) }); }}/></label>
      <label className="field">종료일<input type="date" min="1900-01-01" max="2200-12-31" value={draft.end} onInput={e => { const end = e.currentTarget.value; update({ end, type: draft.type === '마감' ? '마감' : inferredType(draft.start, end) }); }}/></label>
    </div>
    <p className="help">종료일까지 포함해서 달력에 표시합니다.</p>
    <div className="category-choices" role="group" aria-label="분류 선택">{data.settings.categories.map(category => <button type="button" key={category.id} style={categoryStyle(category.color)} aria-pressed={task.category === category.name} onClick={() => changeTask({ category: category.name })}><span className="category-dot"/>{category.name}</button>)}</div>
    <section className="form-section"><h3><Link2 size={17}/>관련 자료</h3>{task.links.map((link, index) => <div className="link-edit" key={link.id}><input aria-label={`링크 ${index + 1} 주소`} placeholder="https:// 또는 onenote:" maxLength={10000} value={link.url} onChange={e => changeTask({ links: task.links.map(item => item.id === link.id ? { ...item, url: e.currentTarget.value } : item) })}/>{safeLink(link.url.trim()) && <a className="icon-button" href={link.url.trim()} target={link.url.trim().toLowerCase().startsWith('https:') ? '_blank' : undefined} rel="noopener noreferrer" aria-label={`링크 ${index + 1} 열기`} title="링크 열기">{isOneNoteLink(link.url.trim()) ? <OneNoteIcon size={20}/> : <Globe size={19} className="web-link-icon"/>}</a>}<button type="button" className="icon-button" aria-label={`링크 ${index + 1} 삭제`} onClick={() => changeTask({ links: task.links.filter(item => item.id !== link.id) })}><Trash2 size={16}/></button></div>)}<button type="button" className="text-button" onClick={() => changeTask({ links: [...task.links, { id: uid(), name: '', url: '' }] })}><Plus size={16}/>링크 추가</button><p className="help">원노트에서 ‘단락 링크 복사’ 후 원래 주소 전체를 붙여 넣으세요.<br/>원노트 설치 및 접근 권한에 따라 열리는 방식이 달라질 수 있습니다.</p></section>
    <section className="form-section simple-options">
      <label className="check-label"><input type="checkbox" checked={draft.allDay} onChange={e => update({ allDay: e.target.checked })}/>시간을 정하지 않은 종일 일정</label>
      {!draft.allDay && <div className="field-row"><label className="field">시작 시간<input type="time" value={draft.startTime} onInput={e => update({ startTime: e.currentTarget.value })}/></label><label className="field">종료 시간<input type="time" value={draft.endTime} onInput={e => update({ endTime: e.currentTarget.value })}/></label></div>}
      <label className="check-label"><input type="checkbox" checked={draft.type === '마감'} onChange={e => update({ type: e.target.checked ? '마감' : inferredType(draft.start, draft.end), reminderBase: e.target.checked ? 'end' : 'start' })}/><span><strong>마감일로 표시</strong><small>D-day를 표시합니다. 일을 완료했다는 뜻은 아닙니다.</small></span></label>
    </section>

    <button type="button" className="advanced-toggle" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}><ChevronDown size={17} className={advanced ? 'rotate' : ''}/>{advanced ? '세부 내용 접기' : '세부 내용 더 보기'}<span>관련 업무 · 메모 · 준비할 일 · 알림</span></button>
    {advanced && <>

      <section className="form-section related-work-editor">
        <h3>관련 업무</h3>
        <label className="field">같은 자료를 사용할 업무<select aria-label="관련 업무" value={linkValue} onChange={e => {
          const selected = e.currentTarget.value;
          setDirty(true);
          if (!selected) {
            if (isLinked) { const fresh = blankTask(); setTask(fresh); update({ taskId: '' }); originalTask.current = undefined; }
            return;
          }
          const selectedTask = data.tasks.find(item => item.id === selected);
          if (!selectedTask) return;
          update({ taskId: selected });
          originalTask.current = selectedTask;
          setTask(structuredClone(selectedTask));
        }}><option value="">연결하지 않음</option>{linkOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <p className={'connection-summary ' + (isLinked ? 'is-linked' : '')}>{isLinked ? <>‘<strong>{task.name}</strong>’와 연결되어 있습니다. 메모·자료·준비할 일을 함께 사용합니다.</> : '다른 일정과 연결하지 않고 이 일정만의 내용을 저장합니다.'}</p>
      </section>

      <section className="form-section"><h3>메모</h3><label className="field"><span className="visually-hidden">메모</span><textarea aria-label="메모" rows={4} maxLength={10000} placeholder="공문에서 확인할 내용이나 처리 방법을 적어 두세요" value={task.memo} onChange={e => changeTask({ memo: e.currentTarget.value })}/></label></section>
      <section className="form-section"><h3><CheckSquare size={17}/>준비할 일</h3>{task.checklist.map((item, index) => <div className={'check-edit ' + (item.done ? 'checked' : '')} key={item.id}><input type="checkbox" aria-label={`준비 ${index + 1} 완료`} checked={item.done} onChange={e => changeTask({ checklist: task.checklist.map(check => check.id === item.id ? { ...check, done: e.target.checked } : check) })}/><input aria-label={`준비 ${index + 1} 내용`} maxLength={1000} value={item.text} placeholder="준비할 일" onChange={e => changeTask({ checklist: task.checklist.map(check => check.id === item.id ? { ...check, text: e.currentTarget.value } : check) })}/><button type="button" className="icon-button" aria-label={`준비 ${index + 1} 삭제`} onClick={() => changeTask({ checklist: task.checklist.filter(check => check.id !== item.id) })}><Trash2 size={16}/></button></div>)}<button type="button" className="text-button" onClick={() => changeTask({ checklist: [...task.checklist, { id: uid(), text: '', done: false }] })}><Plus size={16}/>준비할 일 추가</button><p className="help">체크한 항목에만 완료선이 표시됩니다.</p></section>
      <section className="form-section"><h3>알림</h3><label className="field">알림 기준<select aria-label="알림 기준" value={draft.reminderBase} onChange={e => update({ reminderBase: e.currentTarget.value as 'start' | 'end' })}><option value="start">시작일</option><option value="end">종료일</option></select></label><div className="reminder-options">{REMINDERS.map(reminder => <label key={reminder.value}><input type="checkbox" checked={draft.reminders.includes(reminder.value)} onChange={() => update({ reminders: draft.reminders.includes(reminder.value) ? draft.reminders.filter(value => value !== reminder.value) : [...draft.reminders, reminder.value] })}/>{reminder.label}</label>)}</div><p className="help">서울 시간 기준 · 종일 일정은 시작일 09:00 / 종료일 23:59 기준입니다.</p></section>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div></fieldset>;

  const actions = mode === 'panel'
    ? <div className="modal-actions panel-actions">{existing && onDelete && <button type="button" className="danger-solid" disabled={saving} onClick={onDelete}><Trash2 size={16}/>삭제</button>}<button className="primary" type="submit" disabled={saving}>{saving ? '저장 중…' : '변경 저장'}</button></div>
    : <div className="modal-actions"><button type="button" disabled={saving} onClick={close}>취소</button><button className="primary" type="submit" disabled={saving}>{saving ? '저장 중…' : existing ? '변경 저장' : '일정 저장'}</button></div>;

  const discardBox = discard && <div className="discard-box" role="alert"><p>저장하지 않은 변경 사항을 버릴까요?</p><button type="button" onClick={() => setDiscard(false)}>계속 작성</button><button type="button" onClick={onClose}>변경 버리기</button></div>;

  if (mode === 'panel') return <aside className="detail-panel edit-panel" tabIndex={-1} ref={panelRef} aria-label="일정 상세 및 변경">
    <div className="detail-top"><span>일정 상세 및 변경</span><button type="button" className="icon-button" aria-label="상세 닫기" disabled={saving} onClick={close}><X size={20}/></button></div>
    <form onSubmit={submit}>{formBody}{actions}</form>
    {discardBox}
  </aside>;

  return <Modal title={existing ? '일정 수정' : '새 일정'} onClose={close} wide>
    <form onSubmit={submit}>{formBody}{actions}</form>
    {discardBox}
  </Modal>;
}

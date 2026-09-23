import { useRef, useState, type DragEvent } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, ListTodo, RotateCcw } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { blankTodo, moveTodo, splitTodos, todoDoneLabel, toggleTodo, type Data, type TodoItem } from './model';

type Tab = 'open' | 'done';

export function TodoDialog({ data, onClose, commit, toast }: { data: Data; onClose: () => void; commit: (data: Data) => Promise<boolean>; toast: (message: string) => void }) {
  const [tab, setTab] = useState<Tab>('open');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dragId = useRef<string | null>(null);
  const todos = data.todos ?? [];
  const { open, done } = splitTodos(todos);

  async function save(next: TodoItem[], message = '') {
    if (busy) return false;
    setBusy(true); setError('');
    try {
      if (await commit({ ...data, todos: next })) { if (message) toast(message); return true; }
      setError('저장하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
      return false;
    } finally { setBusy(false); }
  }

  async function add() {
    const value = text.trim();
    if (!value) return;
    if (todos.length >= 2000) { setError('할 일은 2000개까지 저장할 수 있습니다.'); return; }
    // 새 할 일은 맨 아래에 붙이고, 완료한 일은 뒤쪽에 그대로 둔다.
    if (await save([...open, blankTodo(value), ...done])) setText('');
  }

  function drop(e: DragEvent, targetId: string) {
    e.preventDefault();
    const held = dragId.current;
    dragId.current = null;
    if (!held || held === targetId) return;
    void save(moveTodo(todos, held, open.findIndex(t => t.id === targetId)));
  }

  const row = (item: TodoItem, index: number) => <li
    key={item.id}
    className={'todo-item ' + (item.done ? 'done' : '')}
    draggable={!item.done}
    onDragStart={() => { dragId.current = item.id; }}
    onDragOver={e => { if (!item.done && dragId.current) e.preventDefault(); }}
    onDrop={e => { if (!item.done) drop(e, item.id); }}
  >
    {!item.done && <span className="todo-grip" aria-hidden="true"><GripVertical size={16}/></span>}
    <button type="button" className="todo-check" role="checkbox" aria-checked={item.done}
      aria-label={`${item.text} ${item.done ? '다시 할 일로' : '완료'}`}
      onClick={() => void save(toggleTodo(todos, item.id), item.done ? '' : '완료한 일로 옮겼습니다.')}/>
    <span className="todo-text">{item.text}</span>
    {item.done
      ? <>
          <span className="todo-when">{todoDoneLabel(item.doneAt)}</span>
          <button type="button" className="icon-button" aria-label={`${item.text} 다시 할 일로`} onClick={() => void save(toggleTodo(todos, item.id))}><RotateCcw size={15}/></button>
        </>
      : <span className="todo-order">
          <button type="button" className="icon-button" aria-label={`${item.text} 위로`} disabled={index === 0} onClick={() => void save(moveTodo(todos, item.id, index - 1))}><ChevronUp size={16}/></button>
          <button type="button" className="icon-button" aria-label={`${item.text} 아래로`} disabled={index === open.length - 1} onClick={() => void save(moveTodo(todos, item.id, index + 1))}><ChevronDown size={16}/></button>
        </span>}
    <button type="button" className="icon-button" aria-label={`${item.text} 삭제`} onClick={() => void save(todos.filter(t => t.id !== item.id))}><Trash2 size={15}/></button>
  </li>;

  return <FloatingPanel name="todo" title="할 일 목록" icon={<ListTodo size={18}/>} onClose={onClose} footer={<button type="button" onClick={onClose}>닫기</button>}>
    <div className="settings-tabs" role="tablist">
      <button role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'active' : ''} onClick={() => setTab('open')}><ListTodo size={16}/>해야 할 일 {open.length > 0 && <span className="todo-count">{open.length}</span>}</button>
      <button role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>완료한 일 {done.length > 0 && <span className="todo-count">{done.length}</span>}</button>
    </div>

    <div className="panel-content">
      {tab === 'open' && <>
        <div className="todo-add">
          <input aria-label="할 일 입력" maxLength={1000} placeholder="할 일을 적어 주세요" value={text}
            onChange={e => setText(e.currentTarget.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }}/>
          <button type="button" className="primary" disabled={busy || !text.trim()} onClick={() => void add()}><Plus size={16}/>추가</button>
        </div>
        {open.length
          ? <ul className="todo-list">{open.map(row)}</ul>
          : <p className="help">아직 할 일이 없습니다. 위에 적고 추가를 눌러 주세요.</p>}
        <p className="help">동그라미를 누르면 완료한 일로 넘어갑니다. 끌어서 옮기거나 위·아래 화살표로 순서를 바꿀 수 있습니다.</p>
      </>}

      {tab === 'done' && (done.length
        ? <ul className="todo-list">{done.map(row)}</ul>
        : <p className="help">완료한 일이 아직 없습니다.</p>)}

      {error && <p className="form-error" role="alert">{error}</p>}
    </div>

  </FloatingPanel>;
}

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, User, CalendarOff, Tags, Check, CalendarDays, Bell } from 'lucide-react';
import { Modal } from './Editor';
import { loadHolidays } from './holidays';
import { NotificationSettings } from './Panels';
import { CATEGORY_COLORS, FALLBACK_CATEGORY, defaultCalendarPrefs, type CalendarPrefs, type Schedule, blankSchoolHoliday, categoryStyle, seoulToday, uid, validateSchoolHoliday, type CategoryDef, type Data, type SchoolHoliday, type Settings as SettingsData } from './model';

export type SettingsTab = 'profile' | 'calendar' | 'holiday' | 'category' | 'notice';

export function SettingsDialog({ data, initialTab = 'profile', onClose, onSave, commit, onOpen, onTest, toast }: { data: Data; initialTab?: SettingsTab; onClose: () => void; onSave: (settings: SettingsData, renames: Record<string, string>) => Promise<boolean>; commit: (data: Data, recovery?: boolean) => Promise<boolean>; onOpen: (id: string) => void; onTest: (event: Schedule) => void; toast: (message: string) => void }) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [draft, setDraft] = useState<SettingsData>(() => structuredClone(data.settings));
  // 좁은 화면에서는 탭이 가로로 넘치므로, 고른 탭이 화면 밖에 남지 않게 끌어온다.
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => { tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' }); }, [tab]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [keyResult, setKeyResult] = useState('');

  const update = (values: Partial<SettingsData>) => { setError(''); setDraft(previous => ({ ...previous, ...values })); };
  const prefs = draft.calendar ?? defaultCalendarPrefs();
  // 이전 상태에서 이어받아야 연달아 바꿀 때 앞의 변경이 덮어써지지 않는다.
  const changeCalendar = (values: Partial<CalendarPrefs>) => { setError(''); setDraft(previous => ({ ...previous, calendar: { ...(previous.calendar ?? defaultCalendarPrefs()), ...values } })); };
  const changeProfile = (values: Partial<SettingsData['profile']>) => { setError(''); setDraft(previous => ({ ...previous, profile: { ...previous.profile, ...values } })); };
  const usage = (name: string) => data.tasks.filter(t => t.category === name).length;

  // 이름이 아니라 id 로만 다룬다. 이름으로 찾으면 '수업→학교업무'처럼 이미 있는 이름으로 바꿀 때
  // 서로 다른 분류가 같은 이름을 잠깐 공유해 엉뚱한 분류가 바뀐다.
  function renameCategory(category: CategoryDef, name: string) {
    setError('');
    setDraft(previous => ({ ...previous, categories: previous.categories.map(c => c.id === category.id ? { ...c, name } : c) }));
  }

  function recolorCategory(category: CategoryDef, color: string) {
    setError('');
    setDraft(previous => ({ ...previous, categories: previous.categories.map(c => c.id === category.id ? { ...c, color } : c) }));
  }

  function removeCategory(category: CategoryDef) {
    if (draft.categories.length <= 1) { setError('분류는 최소 하나가 필요합니다.'); return; }
    setError('');
    setDraft(previous => ({ ...previous, categories: previous.categories.filter(c => c.id !== category.id) }));
  }

  /** 저장할 때 id 를 맞대어 '원래 이름 → 바뀐 이름'을 만든다. 지운 분류는 남은 기본 분류로 보낸다. */
  function renameMap(categories: CategoryDef[]) {
    const fallback = categories.find(c => c.name === FALLBACK_CATEGORY)?.name ?? categories[0].name;
    const moves: Record<string, string> = {};
    for (const original of data.settings.categories) {
      const current = categories.find(c => c.id === original.id);
      if (!current) moves[original.name] = fallback;
      else if (current.name !== original.name) moves[original.name] = current.name;
    }
    return moves;
  }

  async function checkKey() {
    setChecking(true); setKeyResult('');
    try {
      const year = Number(seoulToday().slice(0, 4));
      const holidays = await loadHolidays(year, draft.holidayKey, true);
      setKeyResult(`${draft.holidayKey.trim() ? '공공데이터포털' : '무인증 공개 자료'}에서 ${year}년 공휴일 ${holidays.length}일을 불러왔습니다.`);
    } catch (e) { setKeyResult(`불러오지 못했습니다. ${(e as Error).message}`); }
    finally { setChecking(false); }
  }

  async function submit() {
    if (saving) return;
    const categories = draft.categories.map(c => ({ ...c, name: c.name.trim() }));
    if (categories.some(c => !c.name)) { setError('분류 명칭을 입력해 주세요.'); setTab('category'); return; }
    if (new Set(categories.map(c => c.name)).size !== categories.length) { setError('분류 명칭이 겹칩니다. 서로 다른 이름을 써 주세요.'); setTab('category'); return; }
    const holidays = draft.holidays.map(h => ({ ...h, name: h.name.trim() }));
    for (const holiday of holidays) {
      const problem = validateSchoolHoliday(holiday);
      if (problem) { setError(`학교 지정 휴일: ${problem}`); setTab('holiday'); return; }
    }
    setSaving(true);
    try {
      const profile = { name: draft.profile.name.trim(), school: draft.profile.school.trim(), department: draft.profile.department.trim(), note: draft.profile.note.trim() };
      if (await onSave({ ...draft, profile, categories, holidays, holidayKey: draft.holidayKey.trim() }, renameMap(categories))) { toast('설정을 저장했습니다.'); onClose(); }
      else setError('저장하지 못했습니다. 입력 내용은 유지됩니다. 연결 상태를 확인하고 다시 시도해 주세요.');
    } finally { setSaving(false); }
  }

  return <Modal title="설정" onClose={onClose} wide>
    <div className="settings-tabs" role="tablist" ref={tabsRef}>
      <button role="tab" aria-selected={tab === 'profile'} className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><User size={16}/>개인정보</button>
      <button role="tab" aria-selected={tab === 'calendar'} className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}><CalendarDays size={16}/>달력</button>
      <button role="tab" aria-selected={tab === 'holiday'} className={tab === 'holiday' ? 'active' : ''} onClick={() => setTab('holiday')}><CalendarOff size={16}/>휴일</button>
      <button role="tab" aria-selected={tab === 'category'} className={tab === 'category' ? 'active' : ''} onClick={() => setTab('category')}><Tags size={16}/>분류</button>
      <button role="tab" aria-selected={tab === 'notice'} className={tab === 'notice' ? 'active' : ''} onClick={() => setTab('notice')}><Bell size={16}/>알림</button>
    </div>

    <div className="modal-content">
      {tab === 'profile' && <>
        <p className="help">이 기기와 계정에만 저장됩니다. 일정에 함께 저장되지 않으며, 백업 파일에는 포함됩니다.</p>
        <label className="field">이름<input maxLength={100} value={draft.profile.name} placeholder="홍길동" onChange={e => changeProfile({ name: e.currentTarget.value })}/></label>
        <label className="field">근무 학교<input maxLength={200} value={draft.profile.school} placeholder="○○중학교" onChange={e => changeProfile({ school: e.currentTarget.value })}/></label>
        <label className="field">부서 · 담당<input maxLength={200} value={draft.profile.department} placeholder="교무부 · 2학년 담임" onChange={e => changeProfile({ department: e.currentTarget.value })}/></label>
        <label className="field">메모<textarea rows={3} maxLength={2000} value={draft.profile.note} placeholder="내선 번호나 업무 인수인계 메모 등" onChange={e => changeProfile({ note: e.currentTarget.value })}/></label>
      </>}

      {tab === 'calendar' && <>
        <p className="help">달력을 보기 편한 모양으로 맞춰 보세요. 저장하면 이 기기와 계정 모두에 적용됩니다.</p>
        <Choice label="주 시작 요일" value={prefs.weekStart} onPick={v => changeCalendar({ weekStart: v })} options={[[0, '일요일'], [1, '월요일']]}/>
        <Choice label="칸 높이" value={prefs.density} onPick={v => changeCalendar({ density: v })} options={[['compact', '좁게'], ['normal', '보통'], ['roomy', '넓게']]}/>
        <Choice label="글자 크기" value={prefs.fontScale} onPick={v => changeCalendar({ fontScale: v })} options={[['small', '작게'], ['normal', '보통'], ['large', '크게']]}/>
        <Choice label="글꼴" value={prefs.fontFamily} onPick={v => changeCalendar({ fontFamily: v })} options={[['default', '기본'], ['system', '시스템'], ['malgun', '맑은 고딕'], ['nanum', '나눔고딕']]}/>
        <Choice label="한 칸에 표시" value={prefs.maxPerCell} onPick={v => changeCalendar({ maxPerCell: v })} options={[[2, '2개'], [3, '3개'], [4, '4개'], [5, '5개'], [6, '6개']]}/>
        <Choice label="토요일 색" value={prefs.saturdayColor} onPick={v => changeCalendar({ saturdayColor: v })} options={[['blue', '파란색'], ['red', '빨간색']]}/>
        <Choice label="기본 보기" value={prefs.defaultView} onPick={v => changeCalendar({ defaultView: v })} options={[['auto', '자동'], ['calendar', '월간'], ['list', '목록']]}/>
        <p className="help">‘자동’은 화면이 좁으면 목록, 넓으면 월간으로 엽니다. 일요일과 공휴일은 항상 빨간색으로 표시합니다.</p>
      </>}

      {tab === 'holiday' && <>
        <section className="settings-section">
          <h3>공휴일 자동 연동</h3>
          <p className="help">법정 공휴일과 일요일은 달력에 빨간색으로 표시하고, 공휴일은 무슨 날인지 이름도 함께 보여 줍니다. 토요일 색은 달력 탭에서 고를 수 있습니다. 해가 바뀌면 그 해 공휴일을 자동으로 다시 불러옵니다.</p>
          <label className="field">공공데이터포털 인증키
            <input maxLength={500} value={draft.holidayKey} placeholder="비워 두면 무인증 공개 자료를 사용합니다" onChange={e => update({ holidayKey: e.currentTarget.value })}/>
          </label>
          <p className="help">data.go.kr의 ‘한국천문연구원 특일 정보’에서 발급받은 일반 인증키(Decoding)를 붙여 넣으세요. 대체공휴일·임시공휴일까지 정확합니다. 비워 두면 무인증 공개 자료로 표시하되, 학교 휴일이 아닌 제헌절·근로자의 날은 빼고 보여 줍니다.</p>
          <div className="button-row"><button type="button" disabled={checking} onClick={checkKey}>{checking ? '확인 중…' : '연결 확인'}</button></div>
          {keyResult && <p className="help" role="status">{keyResult}</p>}
        </section>

        <section className="settings-section">
          <h3>학교 지정 휴일</h3>
          <p className="help">재량휴업일, 방학처럼 학교에서 정한 휴일을 등록합니다. 하루면 시작일과 종료일을 같게 두세요.</p>
          {draft.holidays.map((holiday, index) => <div className="holiday-edit" key={holiday.id}>
            <input aria-label={`휴일 ${index + 1} 명칭`} placeholder="예: 재량휴업일, 여름방학" maxLength={100} value={holiday.name}
              onChange={e => update({ holidays: draft.holidays.map(h => h.id === holiday.id ? { ...h, name: e.currentTarget.value } : h) })}/>
            <div className="field-row">
              <label className="field">시작일<input type="date" min="1900-01-01" max="2200-12-31" value={holiday.start}
                onInput={e => { const start = e.currentTarget.value; update({ holidays: draft.holidays.map(h => h.id === holiday.id ? { ...h, start, end: h.start === h.end || h.end < start ? start : h.end } : h) }); }}/></label>
              <label className="field">종료일<input type="date" min="1900-01-01" max="2200-12-31" value={holiday.end}
                onInput={e => { const end = e.currentTarget.value; update({ holidays: draft.holidays.map(h => h.id === holiday.id ? { ...h, end } : h) }); }}/></label>
              <button type="button" className="icon-button" aria-label={`휴일 ${index + 1} 삭제`} onClick={() => update({ holidays: draft.holidays.filter(h => h.id !== holiday.id) })}><Trash2 size={16}/></button>
            </div>
          </div>)}
          {!draft.holidays.length && <p className="help">아직 등록한 학교 휴일이 없습니다.</p>}
          <button type="button" className="text-button" onClick={() => update({ holidays: [...draft.holidays, blankSchoolHoliday()] })}><Plus size={16}/>학교 휴일 추가</button>
        </section>
      </>}

      {tab === 'category' && <>
        <p className="help">분류의 이름과 색을 바꿀 수 있습니다. 이름을 바꾸면 그 분류를 쓰던 업무도 함께 바뀝니다. 분류를 지우면 그 업무는 남은 첫 분류로 옮겨집니다.</p>
        {draft.categories.map((category, index) => <div className="category-edit" key={category.id}>
          <div className="category-edit-top">
            <span className="category-dot" style={categoryStyle(category.color)}/>
            <input aria-label={`분류 ${index + 1} 명칭`} maxLength={50} value={category.name} placeholder="분류 이름" onChange={e => renameCategory(category, e.currentTarget.value)}/>
            <span className="category-usage">업무 {usage(category.name)}개</span>
            <button type="button" className="icon-button" aria-label={`분류 ${category.name || index + 1} 삭제`} onClick={() => removeCategory(category)}><Trash2 size={16}/></button>
          </div>
          <div className="color-choices" role="group" aria-label={`분류 ${index + 1} 색 선택`}>
            {CATEGORY_COLORS.map(color => <button type="button" key={color} className="color-swatch" style={{ background: color }} aria-label={color} aria-pressed={category.color === color}
              onClick={() => recolorCategory(category, color)}>{category.color === color && <Check size={14}/>}</button>)}
          </div>
        </div>)}
        <button type="button" className="text-button" onClick={() => update({ categories: [...draft.categories, { id: uid(), name: '', color: CATEGORY_COLORS[draft.categories.length % CATEGORY_COLORS.length] }] })}><Plus size={16}/>분류 추가</button>
        <p className="help">기본 분류 ‘{FALLBACK_CATEGORY}’는 새 일정을 만들 때 처음 선택되는 분류입니다.</p>
      </>}

      {error && <p className="form-error" role="alert">{error}</p>}
    </div>

    {tab === 'notice' && <NotificationSettings data={data} commit={commit} onClose={onClose} onOpen={onOpen} onTest={onTest} toast={toast}/>}

    <div className="modal-actions">
      <button type="button" disabled={saving} onClick={onClose}>취소</button>
      <button type="button" className="primary" disabled={saving} onClick={submit}>{saving ? '저장 중…' : '설정 저장'}</button>
    </div>
  </Modal>;
}

function Choice<T extends string | number>({ label, value, options, onPick }: { label: string; value: T; options: [T, string][]; onPick: (value: T) => void }) {
  return <div className="pref-row">
    <span>{label}</span>
    <div className="pref-choices" role="group" aria-label={label}>
      {options.map(([option, text]) => <button type="button" key={String(option)} aria-pressed={value === option} onClick={() => onPick(option)}>{text}</button>)}
    </div>
  </div>;
}

export type { SchoolHoliday };

import { blankEvent, blankTask, defaultCalendarPrefs, defaultSettings, validDate, weekdayOf, type CalendarPrefs, type Data } from '../model.ts';
import type { AttendanceRecord, ClassInfo, Student, SchoolSchedule, GlobalSettings } from './types';
export const ATTENDANCE_STATUSES = ['출석', '지각', '조퇴', '결과', '결석'] as const;
export const ATTENDANCE_TYPES = ['질병', '미인정', '인정', '기타'] as const;
export const ATTENDANCE_COLORS = ['#a4d4c5', '#e8b94a', '#ffb084', '#b8a4ed', '#ff9f9f'];
export type AttendanceData = { version: 1; students: Student[]; attendance: AttendanceRecord[]; classInfo: ClassInfo; schedule: SchoolSchedule; settings: GlobalSettings; calendar: CalendarPrefs };
export const emptyAttendance = (): AttendanceData => ({ version: 1, students: [], attendance: [], classInfo: { schoolName: '', grade: '', classNumber: '', teacherName: '' }, schedule: { vacations: [], holidays: [] }, settings: { smsTarget: 'PARENT', dailyPeriods: [0,7,7,7,7,7,0] }, calendar: defaultCalendarPrefs() });
const obj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 300) => { if (typeof v !== 'string' || v.length > max) throw new Error('문자 입력 형식을 확인해 주세요.'); return v; };
const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
export function parseRoster(value: unknown): { students: Student[]; classInfo: ClassInfo } {
  check(obj(value), '학급 자료 형식이 올바르지 않습니다.'); const v = value as Record<string, any>;
  check(Array.isArray(v.students) && v.students.length <= 1000, '학생 명단을 확인해 주세요.');
  const ids = new Set<string>(), numbers = new Set<number>();
  const students = v.students.map((s: any) => {
    check(obj(s), '학생 정보가 올바르지 않습니다.');
    const id = str(s.id), name = str(s.name).trim(), number = s.number;
    check(id && name && Number.isInteger(number) && number > 0 && !ids.has(id) && !numbers.has(number), '학생 번호·이름·ID를 확인해 주세요. 중복 번호는 사용할 수 없습니다.');
    ids.add(id); numbers.add(number);
    return { id, number, name, phoneNumber: str(s.phoneNumber ?? '', 50), parentPhoneNumber: str(s.parentPhoneNumber ?? '', 50) };
  }).sort((a: Student,b: Student) => a.number-b.number);
  const c = v.classInfo ?? {}; check(obj(c), '학급 정보가 올바르지 않습니다.');
  return { students, classInfo: { schoolName: str(c.schoolName ?? ''), grade: str(c.grade ?? ''), classNumber: str(c.classNumber ?? ''), teacherName: str(c.teacherName ?? '') } };
}
export function parseAttendance(value: unknown): AttendanceData {
  check(obj(value), '출결 백업 형식이 올바르지 않습니다.'); const v = value as Record<string, any>;
  check(v.version === 1, '지원하지 않는 출결 백업 버전입니다.');
  const base = emptyAttendance(), roster = parseRoster(v);
  check(Array.isArray(v.attendance) && v.attendance.length <= 30000, '출결 기록을 확인해 주세요.');
  const ids = new Set<string>(), pairs = new Set<string>();
  const attendance = v.attendance.map((r: any) => {
    check(obj(r), '출결 기록 형식 오류'); const id = str(r.id), studentId = str(r.studentId), date = str(r.date);
    check(id && studentId && !ids.has(id) && !pairs.has(studentId + ':' + date) && validDate(date), '중복 출결 또는 잘못된 날짜입니다.');
    check(ATTENDANCE_STATUSES.includes(r.status) && (!r.type || ATTENDANCE_TYPES.includes(r.type)), '출결 구분을 확인해 주세요.');
    check(Array.isArray(r.periods) && r.periods.every((p: unknown) => Number.isInteger(p) && Number(p) >= 1 && Number(p) <= 15), '교시를 확인해 주세요.');
    check(Number.isInteger(r.studentNumber) && r.studentNumber > 0 && typeof r.hasDocument === 'boolean', '학생 번호와 서류 상태를 확인해 주세요.');
    ids.add(id); pairs.add(studentId + ':' + date);
    return { id, studentId, studentName: str(r.studentName), studentNumber: r.studentNumber, date, status: r.status, periods: [...new Set<number>(r.periods)].sort((a,b)=>a-b), ...(r.type ? { type: r.type } : {}), reason: str(r.reason, 3000), hasDocument: r.hasDocument };
  });
  const schedule = v.schedule ?? base.schedule;
  check(obj(schedule) && Array.isArray(schedule.vacations) && Array.isArray(schedule.holidays), '학교 일정 형식 오류');
  const vacations = schedule.vacations.map((h: any) => { check(obj(h) && validDate(h.startDate) && validDate(h.endDate) && h.startDate <= h.endDate, '방학 기간을 확인해 주세요.'); return { id: str(h.id), name: str(h.name), startDate: h.startDate, endDate: h.endDate }; });
  const holidays = schedule.holidays.map((h: any) => { check(obj(h) && validDate(h.date), '휴업일 날짜를 확인해 주세요.'); return { id: str(h.id), name: str(h.name), date: h.date }; });
  const settings = v.settings ?? base.settings;
  check(obj(settings) && ['PARENT','STUDENT'].includes(settings.smsTarget) && Array.isArray(settings.dailyPeriods) && settings.dailyPeriods.length === 7 && settings.dailyPeriods.every((p: unknown) => Number.isInteger(p) && Number(p) >= 0 && Number(p) <= 15), '요일별 교시 설정을 확인해 주세요.');
  const c = v.calendar ?? base.calendar;
  check(obj(c) && [0,1].includes(c.weekStart) && ['compact','normal','roomy'].includes(c.density) && ['small','normal','large'].includes(c.fontScale), '달력 표시 설정을 확인해 주세요.');
  return { ...base, ...roster, attendance, schedule: { vacations, holidays }, settings: { smsTarget: settings.smsTarget, dailyPeriods: [...settings.dailyPeriods] }, calendar: { ...base.calendar, weekStart: c.weekStart, density: c.density, fontScale: c.fontScale } };
}
export function importRoster(current: AttendanceData, source: unknown): AttendanceData {
  // 출결·방학·설정은 가져오지 않는다. 현재 명단이 있으면 번호로 연결하여 기존 출결의 학생 ID를 유지한다.
  const roster = parseRoster(source);
  const incoming = roster.students.map(s => ({ ...s, id: current.students.find(old => old.number === s.number)?.id ?? s.id }));
  const numbers = new Set(incoming.map(s=>s.number));
  return parseAttendance({ ...current, classInfo: roster.classInfo, students: [...current.students.filter(s=>!numbers.has(s.number)), ...incoming] });
}
export function attendanceCalendar(data: AttendanceData): Data {
  const settings = defaultSettings(); settings.calendar = data.calendar;
  settings.categories = ATTENDANCE_STATUSES.map((name,i)=>({id:`attendance-${i}`,name,color:ATTENDANCE_COLORS[i]}));
  settings.holidays = [...data.schedule.vacations.map(h=>({id:h.id,name:h.name,start:h.startDate,end:h.endDate})), ...data.schedule.holidays.map(h=>({id:h.id,name:h.name,start:h.date,end:h.date}))];
  const tasks = data.attendance.map(r=>({...blankTask(r.status),id:r.id,name:`${r.studentNumber}번 ${r.studentName}`,memo:r.reason}));
  const events = data.attendance.map(r=>({...blankEvent(r.date),id:r.id,taskId:r.id,title:`${r.studentNumber} ${r.studentName} · ${r.type ? r.type+' ' : ''}${r.status}`}));
  return {version:1,tasks,events,settings,notices:[],delivered:[],todos:[]};
}
export function schoolDayReason(data: AttendanceData, date: string, publicHolidays: Record<string,string>) {
  return data.schedule.holidays.find(h=>h.date===date)?.name || data.schedule.vacations.find(h=>h.startDate<=date && date<=h.endDate)?.name || publicHolidays[date] || (data.settings.dailyPeriods[weekdayOf(date)]===0 ? '수업이 없는 요일' : '');
}
export function periodSelection(status: string, periods: number[], picked: number, count: number) {
  const all = Array.from({length:count},(_,i)=>i+1);
  if (status==='지각') return all.filter(p=>p<=picked);
  if (status==='조퇴') return all.filter(p=>p>=picked);
  return periods.includes(picked) ? periods.filter(p=>p!==picked) : [...periods,picked].sort((a,b)=>a-b);
}

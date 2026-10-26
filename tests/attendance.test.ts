import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyAttendance, parseAttendance, importRoster, attendanceCalendar, periodSelection, schoolDayReason } from '../src/attendance/model.ts';
const roster={classInfo:{schoolName:'테스트학교',grade:'2',classNumber:'3',teacherName:'테스트'},students:[{id:'s1',number:1,name:'테스트학생',phoneNumber:'01000000001',parentPhoneNumber:'01000000002'}]};
const record={id:'r1',studentId:'s1',studentName:'테스트학생',studentNumber:1,date:'2026-10-26',status:'결석',type:'질병',periods:[1,2],reason:'검사용',hasDocument:false};
test('기존 앱 가져오기는 학급과 연락처만 복사하고 과거 출결과 설정을 제외한다',()=>{
 const imported=importRoster(emptyAttendance(),{...roster,attendance:[record],settings:{smsTarget:'STUDENT',dailyPeriods:[0,1,1,1,1,1,0]}});
 assert.deepEqual(imported.students,roster.students);assert.deepEqual(imported.classInfo,roster.classInfo);assert.equal(imported.attendance.length,0);assert.equal(imported.settings.smsTarget,'PARENT');
});
test('명단 재가져오기는 같은 번호의 학생 ID와 현재 기록을 유지한다',()=>{
 const current=parseAttendance({...emptyAttendance(),...roster,attendance:[record]});
 const result=importRoster(current,{...roster,students:[{...roster.students[0],id:'different',parentPhoneNumber:'01099999999'}]});
 assert.equal(result.students[0].id,'s1');assert.equal(result.students[0].parentPhoneNumber,'01099999999');assert.deepEqual(result.attendance,current.attendance);
});
test('출결 중복·잘못된 날짜·번호·교시를 거부한다',()=>{
 const value={...emptyAttendance(),...roster,attendance:[record]};
 assert.throws(()=>parseAttendance({...value,attendance:[record,{...record,id:'r2'}]}));
 assert.throws(()=>parseAttendance({...value,attendance:[{...record,date:'2026-02-30'}]}));
 assert.throws(()=>parseAttendance({...value,attendance:[{...record,periods:[99]}]}));
 assert.throws(()=>parseAttendance({...value,students:[roster.students[0],{...roster.students[0],id:'s2'}]}));
});
test('출결 달력은 출결만 표시하고 일정 알림과 할 일을 생성하지 않는다',()=>{
 const data=parseAttendance({...emptyAttendance(),...roster,attendance:[record]});const calendar=attendanceCalendar(data);
 assert.equal(calendar.events.length,1);assert.match(calendar.events[0].title,/테스트학생/);assert.equal(calendar.tasks[0].category,'결석');assert.deepEqual(calendar.events[0].reminders,[]);assert.equal(calendar.todos.length,0);
});
test('지각·조퇴는 연속 교시, 결과는 개별 교시로 처리한다',()=>{
 assert.deepEqual(periodSelection('지각',[],3,7),[1,2,3]);assert.deepEqual(periodSelection('조퇴',[],5,7),[5,6,7]);assert.deepEqual(periodSelection('결과',[2],4,7),[2,4]);assert.deepEqual(periodSelection('결과',[2,4],2,7),[4]);
});
test('수업 없는 요일과 방학·휴업일을 구분한다',()=>{
 const data=emptyAttendance();assert.equal(schoolDayReason(data,'2026-10-25',{}),'수업이 없는 요일');assert.equal(schoolDayReason(data,'2026-10-26',{}),'');
 data.schedule.vacations=[{id:'v',name:'방학',startDate:'2026-10-26',endDate:'2026-10-28'}];assert.equal(schoolDayReason(data,'2026-10-27',{}),'방학');
});

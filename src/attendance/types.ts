
export interface Student {
  id: string;
  number: number;
  name: string;
  phoneNumber?: string;
  parentPhoneNumber?: string;
}

export enum AttendanceStatus {
  PRESENT = '출석',
  LATENESS = '지각',
  EARLY_LEAVE = '조퇴',
  CLASS_SKIPPED = '결과',
  ABSENCE = '결석'
}

export enum AttendanceType {
  DISEASE = '질병',
  UNAUTHORIZED = '미인정',
  AUTHORIZED = '인정',
  ETC = '기타'
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string; // Denormalized for easier stats display
  studentNumber: number;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  periods: number[]; // 1~7
  type?: AttendanceType;
  reason: string;
  hasDocument: boolean;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ClassInfo {
  schoolName: string;
  grade: string;
  classNumber: string;
  teacherName: string;
}

export interface Vacation {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface CustomHoliday {
  id: string;
  name: string;
  date: string;
}

export interface SchoolSchedule {
  vacations: Vacation[];
  holidays: CustomHoliday[];
}

export interface GlobalSettings {
  smsTarget: 'STUDENT' | 'PARENT';
  dailyPeriods: number[]; // Index 0 = Sunday, 1 = Monday, ... 6 = Saturday
}

// Firestore Document Interface
export interface TeacherData {
  students: Student[];
  attendance: AttendanceRecord[];
  classInfo: ClassInfo;
  schedule: SchoolSchedule;
  settings?: GlobalSettings;
  updatedAt?: string;
}

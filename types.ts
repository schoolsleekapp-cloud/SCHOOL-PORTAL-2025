
export interface Subject {
  selectedSubject: string;
  name: string;
  ca1: number | string;
  ca2: number | string;
  exam: number | string;
  total: number;
  average: number;
  grade: string;
  remark: string;
}

export interface Trait {
  name: string;
  rating: number;
}

export interface Attendance {
  present: number;
  total: number;
}

export interface ResultData {
  id?: string;
  schoolName: string;
  schoolLogo: string;
  schoolId: string;
  schoolEmail: string;
  schoolPhone: string;
  schoolAddress: string;
  themeColor: string;
  studentName: string;
  admissionNumber: string;
  classLevel: string;
  term: string;
  session: string;
  year: string;
  position: string;
  teacherId: string;
  accessCode: string;
  subjects: Subject[];
  principalRemark: string;
  teacherRemark: string;
  attendance: Attendance;
  affective: Trait[];
  psychomotor: Trait[];
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
  searchName?: string;
}

export interface SchoolData {
  schoolName: string;
  schoolId: string;
  schoolCode: string;
  schoolAddress: string;
  schoolEmail: string;
  schoolPhone: string;
  schoolLogo: string;
}

export interface StudentData {
  studentName: string;
  admissionNumber: string;
  schoolId: string;
  classLevel: string;
  gender: string;
  parentPhone: string;
  generatedId?: string;
  schoolName?: string;
  schoolLogo?: string;
  createdAt?: string;
  userId?: string;
}

export interface TeacherData {
  teacherName: string;
  schoolId: string;
  generatedId: string;
  phoneNumber: string;
  email: string;
  schoolName?: string;
  schoolLogo?: string;
  createdAt?: string;
  userId?: string;
}

export type ViewState = 'home' | 'create' | 'view-result' | 'admin-dashboard' | 'register-student' | 'register-school' | 'register-teacher' | 'super-admin-view' | 'admin-search';

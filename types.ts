

export interface Subject {
  selectedSubject: string;
  name: string;
  ca1: number | string;
  ca2: number | string;
  ca3: number | string;
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

export interface AttendanceLog {
  studentName: string;
  admissionNumber: string;
  schoolId: string;
  date: string; // YYYY-MM-DD
  clockInTime?: string;
  clockOutTime?: string;
  timestamp: string;
  dropOffGuardian?: string;
  dropOffPhone?: string;
  pickUpGuardian?: string;
  pickUpPhone?: string;
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
  cognitive: Trait[]; // Added Cognitive Domain
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
  searchName?: string;
  parentPhone?: string;
  parentEmail?: string; // Added Parent Email
}

export interface SchoolData {
  id?: string;
  schoolName: string;
  schoolId: string;
  schoolCode: string; // Used as Password
  schoolAddress: string;
  schoolEmail: string;
  schoolPhone: string;
  schoolLogo: string;
  createdAt?: string;
}

export interface SchoolAdminProfile {
  id?: string;
  adminId: string; // The login ID (e.g., SCH-001-A1)
  schoolId: string;
  name: string;
  password: string;
  createdAt: string;
}

export interface SuperAdminProfile {
  id?: string;
  name: string;
  email: string;
  key: string; // Secret key for login
  createdAt: string;
}

export interface StudentData {
  id?: string;
  studentName: string;
  admissionNumber: string;
  schoolId: string;
  classLevel: string;
  gender: string;
  parentPhone: string;
  parentEmail?: string; // Added Parent Email
  generatedId?: string;
  schoolName?: string;
  schoolLogo?: string;
  createdAt?: string;
  userId?: string;
}

export interface TeacherData {
  id?: string;
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

export interface Question {
  id: number;
  questionText: string;
  options?: string[]; // Made optional for Essay type
  correctAnswer: string; // The correct option string or model answer
  section?: string; // e.g., 'objective', 'theory'
  image?: string; // Base64 string for diagrams/drawings
}

export type AssessmentType = 'ca1' | 'ca2' | 'ca3' | 'exam';

export interface CbtAssessment {
  id?: string;
  examCode: string;
  schoolId: string;
  teacherId: string;
  subject: string;
  classLevel: string;
  term: string;
  session: string;
  durationMinutes: number;
  type: AssessmentType;
  questionMode?: 'objective' | 'theory' | 'comprehension'; // New field
  instructions?: string; // New field
  questions: Question[];
  createdAt: string;
  status: 'active' | 'closed';
}

export interface ExamLog {
  id?: string;
  examCode: string;
  studentName: string;
  admissionNumber: string;
  score: number;
  total: number;
  percentage: number;
  submittedAt: string;
  subject: string;
  type: string;
}

export type ViewState = 'home' | 'create' | 'view-result' | 'admin-dashboard' | 'register-student' | 'register-school' | 'register-teacher' | 'super-admin-view' | 'admin-search' | 'attendance' | 'cbt-portal' | 'teachers-portal' | 'school-admin-login' | 'school-admin-dashboard';
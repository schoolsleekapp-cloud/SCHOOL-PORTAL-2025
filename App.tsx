
import React, { useState, useRef, useEffect } from 'react';
import QRCode from "react-qr-code";
import { 
  School, FileText, Search, ShieldAlert, Edit, Users, Building2, 
  Database, Plus, Trash2, Trophy, Activity, 
  Sparkles, Loader2, Eye, ArrowLeft, RefreshCw, KeyRound, CheckCircle, Palette, Phone, Mail, MapPin, Clock, Star, UserCog,
  Upload, QrCode, GraduationCap, Lock, House, LayoutDashboard, UserCheck, CreditCard, LogIn, LogOut, CalendarCheck, Calendar, ChevronLeft, ChevronRight, FileDown, Laptop2, BrainCircuit, X, User, BarChart3, Settings, ShieldCheck, UserPlus, Share2, UserCircle, Play
} from 'lucide-react';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, orderBy, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { db, storage } from './services/firebase';
import { generateGeminiRemarks } from './services/gemini';
import ResultTemplate from './components/ResultTemplate';
import StudentIdCard from './components/StudentIdCard';
import TeacherIdCard from './components/TeacherIdCard';
import QrScannerModal from './components/QrScannerModal';
import IdCardManager from './components/IdCardManager';
import CbtPortal from './components/CbtPortal'; // Import CBT Portal
import { ResultData, Subject, SchoolData, StudentData, ViewState, TeacherData, AttendanceLog, CbtAssessment, SchoolAdminProfile } from './types';
import { 
  THEME_COLORS, AFFECTIVE_TRAITS, PSYCHOMOTOR_SKILLS, COGNITIVE_TRAITS,
  ALL_NIGERIAN_SUBJECTS, CLASS_LEVELS, TEACHER_SECRET_CODE, SUPER_ADMIN_KEY, APP_ID 
} from './constants';

// Add new views to ViewState
type ExtendedViewState = ViewState | 'student-login' | 'student-dashboard';

export default function App() {
  const [view, setView] = useState<ExtendedViewState>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Student Dashboard State
  const [dashboardStudent, setDashboardStudent] = useState<StudentData | null>(null);
  const [studentDashTab, setStudentDashTab] = useState<'profile' | 'results' | 'attendance' | 'exams'>('profile');
  const [studentResults, setStudentResults] = useState<ResultData[]>([]);
  const [studentAttendanceLogs, setStudentAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [loginMethod, setLoginMethod] = useState<'scan' | 'manual'>('scan');
  const [manualStudentLogin, setManualStudentLogin] = useState({ schoolId: '', studentId: '' });
  const [showDashboardIdCard, setShowDashboardIdCard] = useState(false);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  
  // Super Admin Data
  const [superAdminKey, setSuperAdminKey] = useState('');
  const [adminTab, setAdminTab] = useState<'overview' | 'schools' | 'students' | 'teachers' | 'results' | 'id_cards'>('overview');
  const [allSchools, setAllSchools] = useState<SchoolData[]>([]);
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [allTeachers, setAllTeachers] = useState<TeacherData[]>([]);
  const [allResults, setAllResults] = useState<ResultData[]>([]);
  const [masterSearch, setMasterSearch] = useState('');
  const [resultSearch, setResultSearch] = useState('');

  // Export State for Admin
  const [exportState, setExportState] = useState<{
      data: ResultData | null;
      action: 'download' | 'whatsapp' | null;
      loading: boolean;
  }>({ data: null, action: null, loading: false });

  // School Admin State
  const [currentSchool, setCurrentSchool] = useState<SchoolData | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{name: string, role: string} | null>(null);
  const [schoolLogin, setSchoolLogin] = useState({ id: '', password: '' });
  const [schoolDashboardTab, setSchoolDashboardTab] = useState<'overview' | 'teachers' | 'students' | 'results' | 'attendance' | 'exams' | 'admins'>('overview');
  const [showSchoolQr, setShowSchoolQr] = useState(false);
  
  // Sub-Admin & Teacher Management State
  const [schoolAdmins, setSchoolAdmins] = useState<SchoolAdminProfile[]>([]);
  const [editingTeacher, setEditingTeacher] = useState<TeacherData | null>(null);
  const [newAdminData, setNewAdminData] = useState({ name: '', password: '' });
  
  const [schoolData, setSchoolData] = useState({
    teachers: [] as TeacherData[],
    students: [] as StudentData[],
    results: [] as ResultData[],
    attendance: [] as AttendanceLog[],
    exams: [] as CbtAssessment[]
  });

  // Initial Form State
  const initialFormState: ResultData = {
    schoolName: '', schoolLogo: '', schoolId: '', schoolEmail: '', schoolPhone: '', schoolAddress: '', themeColor: '#6b21a8', 
    studentName: '', admissionNumber: '', classLevel: 'SSS 1', term: 'First Term', session: '2024/2025',
    year: new Date().getFullYear().toString(), position: '', teacherId: '', accessCode: '1234', 
    subjects: [], principalRemark: '', teacherRemark: '',
    attendance: { present: 0, total: 0 }, // Default total to 0 as requested
    affective: AFFECTIVE_TRAITS.map(t => ({ name: t, rating: 3 })),
    psychomotor: PSYCHOMOTOR_SKILLS.map(t => ({ name: t, rating: 3 })),
    cognitive: COGNITIVE_TRAITS.map(t => ({ name: t, rating: 3 }))
  };

  const [formData, setFormData] = useState<ResultData>(initialFormState);
  const [regData, setRegData] = useState<Partial<StudentData & SchoolData & TeacherData>>({});
  const [searchQuery, setSearchQuery] = useState({ schoolId: '', studentId: '' });
  const [adminQuery, setAdminQuery] = useState({ schoolId: '', studentId: '', teacherCode: '' });
  const [foundResult, setFoundResult] = useState<ResultData | null>(null);
  
  // ID Card States
  const [generatedStudent, setGeneratedStudent] = useState<StudentData | null>(null);
  const [showIdCard, setShowIdCard] = useState(false);
  const [generatedTeacher, setGeneratedTeacher] = useState<TeacherData | null>(null);
  const [showTeacherIdCard, setShowTeacherIdCard] = useState(false);

  // Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const [scannerContext, setScannerContext] = useState<'create' | 'check' | 'edit' | 'attendance_in' | 'attendance_out' | 'check_attendance' | 'student_login'>('create');
  
  // Attendance State
  const [attendanceStatus, setAttendanceStatus] = useState<{name: string, time: string, type: 'in' | 'out'} | null>(null);
  const [attendanceReport, setAttendanceReport] = useState<{logs: AttendanceLog[], student: {name: string, id: string}} | null>(null);
  const [reportMonth, setReportMonth] = useState(new Date());
  const [selectedDateLog, setSelectedDateLog] = useState<AttendanceLog | null>(null);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const attendancePrintRef = useRef<HTMLDivElement>(null);

  // Attendance Confirmation Modal State
  const [pendingAttendance, setPendingAttendance] = useState<{
      student: StudentData,
      type: 'in' | 'out',
      schoolId: string
  } | null>(null);
  const [guardianInfo, setGuardianInfo] = useState({ name: '', phone: '' });

  // Fetch Student Dashboard Data
  useEffect(() => {
      if (view === 'student-dashboard' && dashboardStudent) {
          const fetchStudentData = async () => {
              setLoading(true);
              try {
                  // Results
                  const qResults = query(collection(db, 'Result Data'), 
                      where('schoolId', '==', dashboardStudent.schoolId),
                      where('admissionNumber', '==', dashboardStudent.admissionNumber)
                  );
                  const resSnap = await getDocs(qResults);
                  setStudentResults(resSnap.docs.map(d => ({ ...d.data(), id: d.id } as ResultData)));

                  // Attendance
                  const qAtt = query(collection(db, 'Attendance Data'), 
                      where('schoolId', '==', dashboardStudent.schoolId),
                      where('admissionNumber', '==', dashboardStudent.admissionNumber)
                  );
                  const attSnap = await getDocs(qAtt);
                  setStudentAttendanceLogs(attSnap.docs.map(d => d.data() as AttendanceLog));

              } catch (err) {
                  console.error(err);
                  setError("Failed to load student data.");
              } finally {
                  setLoading(false);
              }
          };
          fetchStudentData();
      }
  }, [view, dashboardStudent]);

  const handleStudentLogin = async () => {
      if (!manualStudentLogin.schoolId || !manualStudentLogin.studentId) {
          setError("School ID and Student ID are required.");
          return;
      }
      setLoading(true);
      setError('');
      try {
          // Login with Generated Student ID
          const q = query(collection(db, 'Student Data'), 
              where("schoolId", "==", manualStudentLogin.schoolId.trim()),
              where("generatedId", "==", manualStudentLogin.studentId.trim())
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
              setDashboardStudent(snap.docs[0].data() as StudentData);
              setView('student-dashboard');
              setSuccessMsg("Welcome back!");
          } else {
              setError("Student record not found. Please check your Student ID.");
          }
      } catch (err) {
          console.error(err);
          setError("Login failed due to network error.");
      } finally {
          setLoading(false);
      }
  };

  const renderStudentDashboard = () => {
      if (!dashboardStudent) return null;

      const tabs = [
          { id: 'profile', label: 'Profile', icon: UserCircle, color: 'bg-blue-600' },
          { id: 'results', label: 'My Results', icon: FileText, color: 'bg-purple-600' },
          { id: 'exams', label: 'CBT Exams', icon: Laptop2, color: 'bg-indigo-600' },
          { id: 'attendance', label: 'Attendance', icon: CalendarCheck, color: 'bg-green-600' },
      ];

      return (
          <div className="max-w-6xl mx-auto animate-fade-in flex flex-col md:flex-row gap-6 p-4">
              {/* Sidebar */}
              <div className="w-full md:w-72 shrink-0 space-y-4">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
                      <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center border-4 border-white shadow-md overflow-hidden mb-4">
                          {dashboardStudent.schoolLogo ? <img src={dashboardStudent.schoolLogo} className="w-full h-full object-cover"/> : <User size={40} className="text-gray-400"/>}
                      </div>
                      <h2 className="text-xl font-bold text-gray-800">{dashboardStudent.studentName}</h2>
                      <p className="text-sm text-gray-500 font-bold mb-2">{dashboardStudent.admissionNumber}</p>
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{dashboardStudent.classLevel}</span>
                      
                      <div className="mt-6 flex flex-col gap-2">
                          {tabs.map(tab => {
                              const Icon = tab.icon;
                              const isActive = studentDashTab === tab.id;
                              return (
                                  <button 
                                      key={tab.id}
                                      onClick={() => setStudentDashTab(tab.id as any)}
                                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${isActive ? `${tab.color} text-white shadow-lg` : 'text-gray-600 hover:bg-gray-50'}`}
                                  >
                                      <Icon size={18} /> {tab.label}
                                  </button>
                              )
                          })}
                      </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                      <button onClick={() => { setDashboardStudent(null); setView('home'); }} className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 p-2 rounded-lg font-bold transition">
                          <LogOut size={18} /> Logout
                      </button>
                  </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100 min-h-[500px]">
                  <h3 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4 capitalize">{studentDashTab.replace('_', ' ')}</h3>

                  {studentDashTab === 'profile' && (
                      <div className="space-y-6 animate-slide-up">
                          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600">
                                  <School size={24} />
                              </div>
                              <div>
                                  <p className="text-xs text-gray-500 font-bold uppercase">School</p>
                                  <h4 className="text-lg font-bold text-gray-800">{dashboardStudent.schoolName || 'Unknown School'}</h4>
                                  <p className="text-xs text-gray-500 font-mono">ID: {dashboardStudent.schoolId}</p>
                              </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-4 border rounded-xl">
                                  <p className="text-xs text-gray-400 font-bold uppercase">Parent Phone</p>
                                  <p className="font-bold text-gray-700">{dashboardStudent.parentPhone || 'Not Set'}</p>
                              </div>
                              <div className="p-4 border rounded-xl">
                                  <p className="text-xs text-gray-400 font-bold uppercase">Gender</p>
                                  <p className="font-bold text-gray-700">{dashboardStudent.gender || 'Not Specified'}</p>
                              </div>
                          </div>

                          <div className="mt-8">
                              <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CreditCard size={18}/> Digital ID Card</h4>
                              <div className="bg-gray-100 p-8 rounded-xl flex justify-center flex-col items-center gap-4">
                                  <div className="text-center text-gray-500 text-sm mb-2">View and download your official student identity card.</div>
                                  <button 
                                    onClick={() => setShowDashboardIdCard(true)}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-lg"
                                  >
                                      <CreditCard size={20}/> View My ID Card
                                  </button>
                              </div>
                          </div>
                      </div>
                  )}

                  {studentDashTab === 'results' && (
                      <div className="space-y-4 animate-slide-up">
                          {studentResults.length === 0 ? (
                              <div className="text-center py-12 text-gray-400">
                                  <FileText size={48} className="mx-auto mb-2 opacity-50"/>
                                  <p>No results published yet.</p>
                              </div>
                          ) : (
                              studentResults.map((res, idx) => (
                                  <div key={idx} className="border rounded-xl p-4 hover:shadow-md transition flex flex-col md:flex-row justify-between items-center gap-4">
                                      <div>
                                          <h4 className="font-bold text-gray-800">{res.term}, {res.session}</h4>
                                          <p className="text-sm text-gray-500">{res.classLevel}</p>
                                      </div>
                                      <button 
                                          onClick={() => { setFoundResult(res); setView('view-result'); }}
                                          className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-bold text-sm hover:bg-purple-200 transition flex items-center gap-2"
                                      >
                                          <Eye size={16}/> View Result
                                      </button>
                                  </div>
                              ))
                          )}
                      </div>
                  )}

                  {studentDashTab === 'attendance' && (
                      <div className="animate-slide-up">
                          <div className="bg-green-50 p-6 rounded-xl border border-green-100 mb-6 text-center">
                              <h4 className="text-3xl font-bold text-green-700">{studentAttendanceLogs.length}</h4>
                              <p className="text-xs font-bold uppercase text-green-600">Total Days Present</p>
                          </div>
                          
                          <div className="max-h-[400px] overflow-y-auto">
                              <table className="w-full text-sm text-left">
                                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs sticky top-0">
                                      <tr>
                                          <th className="p-3">Date</th>
                                          <th className="p-3">In</th>
                                          <th className="p-3">Out</th>
                                          <th className="p-3">Pickup</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                      {studentAttendanceLogs.map((log, i) => (
                                          <tr key={i} className="hover:bg-gray-50">
                                              <td className="p-3 font-mono text-gray-600">{log.date}</td>
                                              <td className="p-3 text-green-600 font-bold">{log.clockInTime || '-'}</td>
                                              <td className="p-3 text-red-600 font-bold">{log.clockOutTime || '-'}</td>
                                              <td className="p-3 text-gray-500 text-xs">{log.pickUpGuardian || '-'}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  )}

                  {studentDashTab === 'exams' && (
                      <div className="animate-slide-up text-center">
                          <div className="bg-indigo-50 p-8 rounded-xl border-2 border-indigo-100 mb-6">
                              <Laptop2 size={48} className="mx-auto text-indigo-600 mb-4" />
                              <h4 className="text-xl font-bold text-indigo-900 mb-2">Ready to take an exam?</h4>
                              <p className="text-indigo-700 mb-6 max-w-md mx-auto">Access the Computer Based Test portal directly. You are already logged in.</p>
                              <button 
                                  onClick={() => setView('cbt-portal')}
                                  className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 mx-auto"
                              >
                                  <Play size={18} /> Open Exam Portal
                              </button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const handleScanSuccess = async (decodedText: string) => {
    // Add logic for student dashboard login via scan
    if (scannerContext === 'student_login') {
        setShowScanner(false);
        try {
            const data = JSON.parse(decodedText);
            if (!data.ad || !data.sc) throw new Error("Invalid Student QR Code.");
            
            setLoading(true);
            const q = query(collection(db, 'Student Data'), 
                where("schoolId", "==", data.sc), 
                where("admissionNumber", "==", data.ad)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                setDashboardStudent(snap.docs[0].data() as StudentData);
                setView('student-dashboard');
                setSuccessMsg("Login Successful via QR!");
            } else {
                setError("Student not found via QR Scan.");
            }
        } catch (e) {
            setError("Invalid QR Code.");
        } finally {
            setLoading(false);
        }
        return;
    }
    
    setShowScanner(false);
    try {
        const data = JSON.parse(decodedText);
        if (!data.sc || !data.ad) {
            setError("Invalid QR Code: Missing School ID or Admission Number.");
            return;
        }

        if (scannerContext === 'attendance_in' || scannerContext === 'attendance_out') {
            setLoading(true);
            setSuccessMsg("Scanning... verifying student.");
            try {
                const qStudent = query(collection(db, 'Student Data'), 
                    where("schoolId", "==", data.sc), 
                    where("admissionNumber", "==", data.ad)
                );
                const studentSnap = await getDocs(qStudent);
                if (!studentSnap.empty) {
                    const studentData = studentSnap.docs[0].data() as StudentData;
                    setPendingAttendance({
                        student: studentData,
                        type: scannerContext === 'attendance_in' ? 'in' : 'out',
                        schoolId: data.sc
                    });
                    setSuccessMsg(""); 
                } else {
                    setError("Student record not found. Cannot mark attendance.");
                }
            } catch (err) {
                console.error(err);
                setError("Error verifying student.");
            } finally {
                setLoading(false);
            }
            return;
        }

        if (scannerContext === 'check_attendance') {
            setLoading(true);
            setSuccessMsg("Fetching attendance history...");
            try {
                const q = query(collection(db, 'Attendance Data'), 
                    where("schoolId", "==", data.sc), 
                    where("admissionNumber", "==", data.ad)
                );
                const querySnapshot = await getDocs(q);
                const logs = querySnapshot.docs.map(doc => doc.data() as AttendanceLog);
                
                let studentName = data.nm;
                if(!studentName && logs.length > 0) studentName = logs[0].studentName;
                
                setAttendanceReport({
                    logs,
                    student: { name: studentName || data.ad, id: data.ad }
                });
            } catch (e) {
                console.error(e);
                setError("Failed to fetch attendance records.");
            } finally {
                setLoading(false);
            }
            return;
        }

        if (scannerContext === 'create') {
            setSuccessMsg("QR Code Scanned! Fetching student details...");
            setFormData(prev => ({ ...prev, schoolId: data.sc, admissionNumber: data.ad, studentName: data.nm || prev.studentName }));
            setLoading(true);
            
            const qSchool = query(collection(db, 'School Data'), where("schoolId", "==", data.sc));
            const schoolSnap = await getDocs(qSchool);
            if (!schoolSnap.empty) {
                const sData = schoolSnap.docs[0].data() as SchoolData;
                 setFormData(prev => ({
                    ...prev,
                    schoolName: sData.schoolName || prev.schoolName,
                    schoolLogo: sData.schoolLogo || prev.schoolLogo,
                    schoolEmail: sData.schoolEmail || prev.schoolEmail,
                    schoolPhone: sData.schoolPhone || prev.schoolPhone,
                    schoolAddress: sData.schoolAddress || prev.schoolAddress,
                    schoolId: data.sc,
                    admissionNumber: data.ad,
                    studentName: data.nm || prev.studentName
                }));
            }

            const qStudent = query(collection(db, 'Student Data'), 
                where("schoolId", "==", data.sc), 
                where("admissionNumber", "==", data.ad)
            );
            const studentSnap = await getDocs(qStudent);
            if (!studentSnap.empty) {
                 const stData = studentSnap.docs[0].data() as StudentData;
                 setFormData(prev => ({ 
                     ...prev, 
                     studentName: stData.studentName || prev.studentName, 
                     classLevel: stData.classLevel || prev.classLevel,
                     parentPhone: stData.parentPhone || prev.parentPhone
                }));
                setSuccessMsg("Student form auto-filled from Database!");
            } else {
                setSuccessMsg("School data loaded. Student record not found in DB, but IDs filled.");
            }

            const qAtt = query(collection(db, 'Attendance Data'),
                where("schoolId", "==", data.sc),
                where("admissionNumber", "==", data.ad)
            );
            const attSnap = await getDocs(qAtt);
            const daysPresent = attSnap.size;
            
            setFormData(prev => ({ ...prev, attendance: { ...prev.attendance, present: daysPresent } }));
            if(daysPresent > 0) {
                setSuccessMsg(prev => prev + ` Attendance Records Found: ${daysPresent} days.`);
            }
            setLoading(false);

        } else if (scannerContext === 'check') {
            setSearchQuery({ schoolId: data.sc, studentId: data.ad });
            setSuccessMsg("QR Scanned. Looking up result...");
            setLoading(true);
            const q = query(collection(db, 'Result Data'),
                where("schoolId", "==", data.sc),
                where("admissionNumber", "==", data.ad)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                setFoundResult(querySnapshot.docs[0].data() as ResultData);
                setSuccessMsg("Result retrieved successfully.");
            } else { 
                setError("No result found for this student."); 
            }
            setLoading(false);
        } else if (scannerContext === 'edit') {
            setAdminQuery(prev => ({ ...prev, schoolId: data.sc, studentId: data.ad }));
            setSuccessMsg("QR Scanned. Please enter Teacher ID to verify.");
        }

    } catch (e) {
        console.error(e);
        setError("Failed to parse QR Code data. Is this a valid Student ID?");
    }
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setRegData({});
    setError('');
    setSuccessMsg('');
    setIsPreview(false);
    setIsPublished(false);
    setIsEditing(false);
    setEditDocId(null);
    setFoundResult(null);
    setSchoolLogin({ id: '', password: '' });
    setManualStudentLogin({ schoolId: '', studentId: '' });
    setAdminQuery({ schoolId: '', studentId: '', teacherCode: '' });
    setSearchQuery({ schoolId: '', studentId: '' });
  };

  const handleConfirmAttendance = async () => {
    if (!pendingAttendance) return;
    setLoading(true);
    try {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString();
        
        const q = query(collection(db, 'Attendance Data'), 
            where("schoolId", "==", pendingAttendance.schoolId),
            where("admissionNumber", "==", pendingAttendance.student.admissionNumber),
            where("date", "==", dateStr)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            if (pendingAttendance.type === 'out') {
                throw new Error("Cannot Clock Out without Clocking In first.");
            }
            const newLog: AttendanceLog = {
                studentName: pendingAttendance.student.studentName,
                admissionNumber: pendingAttendance.student.admissionNumber,
                schoolId: pendingAttendance.schoolId,
                date: dateStr,
                clockInTime: timeStr,
                timestamp: now.toISOString(),
                dropOffGuardian: guardianInfo.name,
                dropOffPhone: guardianInfo.phone
            };
            await addDoc(collection(db, 'Attendance Data'), newLog);
            setSuccessMsg(`Clocked IN: ${pendingAttendance.student.studentName} at ${timeStr}`);
        } else {
            const docRef = snap.docs[0].ref;
            const data = snap.docs[0].data() as AttendanceLog;
            
            if (pendingAttendance.type === 'in') {
                if (data.clockInTime) throw new Error("Already Clocked In today.");
                 await updateDoc(docRef, { 
                    clockInTime: timeStr, 
                    dropOffGuardian: guardianInfo.name,
                    dropOffPhone: guardianInfo.phone 
                 });
                 setSuccessMsg(`Clocked IN: ${pendingAttendance.student.studentName} at ${timeStr}`);
            } else {
                if (data.clockOutTime) throw new Error("Already Clocked Out today.");
                 await updateDoc(docRef, { 
                    clockOutTime: timeStr, 
                    pickUpGuardian: guardianInfo.name,
                    pickUpPhone: guardianInfo.phone 
                 });
                 setSuccessMsg(`Clocked OUT: ${pendingAttendance.student.studentName} at ${timeStr}`);
            }
        }
        setPendingAttendance(null);
        setGuardianInfo({ name: '', phone: '' });
    } catch (e: any) {
        setError(e.message);
    } finally {
        setLoading(false);
    }
  };

  const renderAttendanceView = () => (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2"><Clock /> Attendance Kiosk</h2>
            <p className="text-gray-500 mb-8">Scan Student ID card to log attendance.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button onClick={() => { setScannerContext('attendance_in'); setShowScanner(true); }} className="p-8 bg-green-50 border-2 border-green-200 rounded-xl hover:bg-green-100 hover:border-green-500 transition group">
                    <LogIn size={48} className="mx-auto text-green-600 mb-4 group-hover:scale-110 transition-transform"/>
                    <h3 className="text-xl font-bold text-green-800">Clock In (Morning)</h3>
                    <p className="text-green-600">Arrival & Drop-off</p>
                </button>
                <button onClick={() => { setScannerContext('attendance_out'); setShowScanner(true); }} className="p-8 bg-red-50 border-2 border-red-200 rounded-xl hover:bg-red-100 hover:border-red-500 transition group">
                    <LogOut size={48} className="mx-auto text-red-600 mb-4 group-hover:scale-110 transition-transform"/>
                    <h3 className="text-xl font-bold text-red-800">Clock Out (Closing)</h3>
                    <p className="text-red-600">Departure & Pickup</p>
                </button>
            </div>
             <button onClick={() => setView('home')} className="mt-8 text-gray-400 hover:text-gray-600">Back Home</button>
        </div>
    </div>
  );

  const handleAutoFillSchool = async () => {
    if (!formData.schoolId) return;
    setLoading(true);
    try {
        const q = query(collection(db, 'School Data'), where("schoolId", "==", formData.schoolId));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const data = snap.docs[0].data() as SchoolData;
            setFormData(prev => ({
                ...prev,
                schoolName: data.schoolName,
                schoolAddress: data.schoolAddress,
                schoolEmail: data.schoolEmail,
                schoolPhone: data.schoolPhone,
                schoolLogo: data.schoolLogo,
            }));
            setSuccessMsg("School details loaded.");
        }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const storageRef = ref(storage, `logos/${Date.now()}_${file.name}`);
      setLoading(true);
      try {
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        if (view === 'create') setFormData(prev => ({ ...prev, schoolLogo: url }));
        else setRegData(prev => ({ ...prev, schoolLogo: url }));
      } catch (err) {
        setError("Failed to upload logo.");
      }
      setLoading(false);
    }
  };

  const handleAutoFillStudent = async () => {
      if (!formData.schoolId || !formData.admissionNumber) return;
      setLoading(true);
      try {
          const q = query(collection(db, 'Student Data'), 
              where("schoolId", "==", formData.schoolId),
              where("admissionNumber", "==", formData.admissionNumber)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
              const data = snap.docs[0].data() as StudentData;
              setFormData(prev => ({
                  ...prev,
                  studentName: data.studentName,
                  classLevel: data.classLevel,
                  parentPhone: data.parentPhone
              }));
              
              const qAtt = query(collection(db, 'Attendance Data'),
                 where("schoolId", "==", formData.schoolId),
                 where("admissionNumber", "==", formData.admissionNumber)
              );
              const attSnap = await getDocs(qAtt);
              setFormData(prev => ({ ...prev, attendance: { ...prev.attendance, present: attSnap.size } }));

              setSuccessMsg("Student details loaded.");
          }
      } catch (e) { console.error(e); }
      setLoading(false);
  };

  const loadPresetSubjects = () => {
    const common = ["Mathematics", "English Language", "Basic Science", "Civic Education"];
    const newSubjects: Subject[] = common.map(name => ({
        selectedSubject: name,
        name: name,
        ca1: 0, ca2: 0, ca3: 0, exam: 0, total: 0, average: 0, grade: 'F', remark: 'Fail'
    }));
    setFormData(prev => ({ ...prev, subjects: newSubjects }));
  };

  const handleAddSubject = () => {
    setFormData(prev => ({
        ...prev,
        subjects: [...prev.subjects, {
            selectedSubject: '', name: '', 
            ca1: 0, ca2: 0, ca3: 0, exam: 0, total: 0, average: 0, grade: 'F', remark: 'Fail'
        }]
    }));
  };

  const calculateGrade = (total: number) => {
      if (total >= 70) return { grade: 'A', remark: 'Excellent' };
      if (total >= 60) return { grade: 'B', remark: 'Very Good' };
      if (total >= 50) return { grade: 'C', remark: 'Credit' };
      if (total >= 45) return { grade: 'D', remark: 'Pass' };
      if (total >= 40) return { grade: 'E', remark: 'Fair' };
      return { grade: 'F', remark: 'Fail' };
  };

  const handleSubjectChange = (index: number, field: keyof Subject, value: any) => {
    const updatedSubjects = [...formData.subjects];
    const subject = updatedSubjects[index];
    (subject as any)[field] = value;
    
    if (field === 'selectedSubject') {
        subject.name = value === 'Others' ? '' : value;
    }

    const ca1 = Number(subject.ca1) || 0;
    const ca2 = Number(subject.ca2) || 0;
    const ca3 = Number(subject.ca3) || 0;
    const exam = Number(subject.exam) || 0;
    
    subject.total = ca1 + ca2 + ca3 + exam;
    const gradeInfo = calculateGrade(subject.total);
    subject.grade = gradeInfo.grade;
    subject.remark = gradeInfo.remark;

    setFormData(prev => ({ ...prev, subjects: updatedSubjects }));
  };

  const handleRemoveSubject = (index: number) => {
      const updated = formData.subjects.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, subjects: updated }));
  };

  const handleGenerateRemarks = async () => {
      setLoading(true);
      try {
          const remarks = await generateGeminiRemarks(
              formData.studentName, 
              formData.subjects, 
              formData.classLevel, 
              formData.position, 
              formData.affective
          );
          setFormData(prev => ({
              ...prev,
              principalRemark: remarks.principalRemark,
              teacherRemark: remarks.teacherRemark
          }));
          setSuccessMsg("Remarks generated by AI.");
      } catch (e) {
          setError("Failed to generate remarks.");
      }
      setLoading(false);
  };

  const handlePublish = async () => {
      setLoading(true);
      try {
          const payload = {
              ...formData,
              updatedAt: new Date().toISOString()
          };
          
          if (isEditing && editDocId) {
             const docRef = doc(db, 'Result Data', editDocId);
             await updateDoc(docRef, payload);
             setSuccessMsg("Result Updated Successfully.");
          } else {
             payload.createdAt = new Date().toISOString();
             await addDoc(collection(db, 'Result Data'), payload);
             setSuccessMsg("Result Published Successfully.");
          }
          setIsPublished(true);
      } catch (e) {
          setError("Failed to publish result.");
      }
      setLoading(false);
  };
  
  const handleSuperAdminAccess = async () => {
      if (superAdminKey === SUPER_ADMIN_KEY) {
          setView('super-admin-view');
          // Load data
          setLoading(true);
          try {
             const sSnap = await getDocs(collection(db, 'School Data'));
             setAllSchools(sSnap.docs.map(d => d.data() as SchoolData));
             const tSnap = await getDocs(collection(db, 'Teacher Data'));
             setAllTeachers(tSnap.docs.map(d => d.data() as TeacherData));
             const stSnap = await getDocs(collection(db, 'Student Data'));
             setAllStudents(stSnap.docs.map(d => d.data() as StudentData));
             const rSnap = await getDocs(collection(db, 'Result Data'));
             setAllResults(rSnap.docs.map(d => d.data() as ResultData));
          } catch(e) { setError("Failed to load data."); }
          setLoading(false);
      } else {
          setError("Invalid Admin Key");
      }
  };

  const handleRegisterStudent = async () => {
      if (!regData.studentName || !regData.schoolId || !regData.admissionNumber) {
          setError("Required fields missing.");
          return;
      }
      setLoading(true);
      try {
          const q = query(collection(db, 'Student Data'), 
             where("schoolId", "==", regData.schoolId),
             where("admissionNumber", "==", regData.admissionNumber)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
              setError("Student ID already exists.");
          } else {
              const generatedId = Math.random().toString(36).substring(2, 8).toUpperCase();
              let schoolName = '';
              let schoolLogo = '';
              const qS = query(collection(db, 'School Data'), where("schoolId", "==", regData.schoolId));
              const snapS = await getDocs(qS);
              if(!snapS.empty) {
                  schoolName = snapS.docs[0].data().schoolName;
                  schoolLogo = snapS.docs[0].data().schoolLogo;
              }
              const newStudent: StudentData = {
                  studentName: regData.studentName!,
                  admissionNumber: regData.admissionNumber!,
                  schoolId: regData.schoolId!,
                  classLevel: regData.classLevel || '',
                  gender: regData.gender || '',
                  parentPhone: regData.parentPhone || '',
                  generatedId,
                  schoolName,
                  schoolLogo,
                  createdAt: new Date().toISOString()
              };
              await addDoc(collection(db, 'Student Data'), newStudent);
              setGeneratedStudent(newStudent);
              setShowIdCard(true);
              setSuccessMsg(`Student Registered. ID: ${generatedId}`);
          }
      } catch (e) {
          setError("Failed to register.");
      }
      setLoading(false);
  };

  const handleRegisterTeacher = async () => {
     if (!regData.teacherName || !regData.schoolId) {
         setError("Name and School ID required.");
         return;
     }
     setLoading(true);
     try {
         const generatedId = "TCH-" + Math.floor(1000 + Math.random() * 9000);
          let schoolName = '';
          let schoolLogo = '';
          const qS = query(collection(db, 'School Data'), where("schoolId", "==", regData.schoolId));
          const snapS = await getDocs(qS);
          if(!snapS.empty) {
              schoolName = snapS.docs[0].data().schoolName;
              schoolLogo = snapS.docs[0].data().schoolLogo;
          }
         const newTeacher: TeacherData = {
             teacherName: regData.teacherName!,
             schoolId: regData.schoolId!,
             generatedId,
             phoneNumber: regData.phoneNumber || '',
             email: regData.email || '',
             schoolName,
             schoolLogo,
             createdAt: new Date().toISOString()
         };
         await addDoc(collection(db, 'Teacher Data'), newTeacher);
         setGeneratedTeacher(newTeacher);
         setShowTeacherIdCard(true);
         setSuccessMsg("Teacher Registered.");
     } catch (e) { setError("Failed to register."); }
     setLoading(false);
  };

  const handleRegisterSchool = async () => {
      if (!regData.schoolName || !regData.schoolCode) {
          setError("Name and Code required.");
          return;
      }
      setLoading(true);
      try {
          const schoolId = "SCH-" + Math.floor(100 + Math.random() * 900);
          const newSchool: SchoolData = {
              schoolName: regData.schoolName!,
              schoolId: schoolId,
              schoolCode: regData.schoolCode!,
              schoolAddress: regData.schoolAddress || '',
              schoolEmail: regData.schoolEmail || '',
              schoolPhone: regData.schoolPhone || '',
              schoolLogo: regData.schoolLogo || ''
          };
          await addDoc(collection(db, 'School Data'), newSchool);
          setSuccessMsg(`School Registered. ID: ${schoolId}`);
      } catch (e) { setError("Failed to register."); }
      setLoading(false);
  };

  const handleSchoolLogin = async () => {
     if (!schoolLogin.id || !schoolLogin.password) {
         setError("Credentials required.");
         return;
     }
     setLoading(true);
     try {
         const qMain = query(collection(db, 'School Data'), 
             where("schoolId", "==", schoolLogin.id),
             where("schoolCode", "==", schoolLogin.password)
         );
         const snapMain = await getDocs(qMain);
         
         if (!snapMain.empty) {
             const school = snapMain.docs[0].data() as SchoolData;
             setCurrentSchool(school);
             setCurrentUserProfile({ name: 'Principal / Main Admin', role: 'Main Admin' });
             setView('school-admin-dashboard');
             return;
         }
         
         setError("Invalid credentials.");
     } catch (e) { setError("Login failed."); }
     setLoading(false);
  };

  const renderSchoolAdminDashboard = () => {
      if (!currentSchool) return null;
      return (
          <div className="max-w-6xl mx-auto p-6 animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">{currentSchool.schoolName}</h2>
                    <p className="text-gray-500">Dashboard</p>
                  </div>
                  <button onClick={() => { setCurrentSchool(null); setView('home'); }} className="text-red-500 hover:underline">Logout</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-xl shadow">
                     <h3 className="font-bold text-gray-500">Teachers</h3>
                     <p className="text-3xl font-bold">{schoolData.teachers.length}</p>
                     <button onClick={() => setSchoolDashboardTab('teachers')} className="text-blue-600 text-sm mt-2">Manage</button>
                  </div>
                   <div className="bg-white p-6 rounded-xl shadow">
                     <h3 className="font-bold text-gray-500">Students</h3>
                     <p className="text-3xl font-bold">{schoolData.students.length}</p>
                     <button onClick={() => setSchoolDashboardTab('students')} className="text-blue-600 text-sm mt-2">Manage</button>
                  </div>
              </div>
              <div className="mt-8 bg-white p-6 rounded-xl shadow min-h-[300px]">
                 {schoolDashboardTab === 'overview' && <p className="text-gray-500 text-center py-10">Select a category to manage.</p>}
                 {schoolDashboardTab === 'teachers' && (
                     <div><h3 className="font-bold mb-4">Teachers List</h3>
                     </div>
                 )}
              </div>
          </div>
      );
  };

  const handleAdminLookup = async () => {
     if (!adminQuery.schoolId || !adminQuery.studentId || !adminQuery.teacherCode) {
         setError("All fields required.");
         return;
     }
     setLoading(true);
     try {
         // 1. Verify Teacher
         const qT = query(collection(db, 'Teacher Data'), where("generatedId", "==", adminQuery.teacherCode));
         const snapT = await getDocs(qT);
         if (snapT.empty) throw new Error("Invalid Teacher ID");
         
         // 2. Lookup Student to resolve ID to Admission Number
         const qS = query(collection(db, 'Student Data'), 
             where("schoolId", "==", adminQuery.schoolId.trim()),
             where("generatedId", "==", adminQuery.studentId.trim()) // Using generatedId (Student ID)
         );
         const snapS = await getDocs(qS);
         if (snapS.empty) throw new Error("Student ID not found in database.");
         
         const studentData = snapS.docs[0].data() as StudentData;
         const admissionNo = studentData.admissionNumber;

         // 3. Lookup Result using Admission Number
         const qR = query(collection(db, 'Result Data'), 
             where("schoolId", "==", adminQuery.schoolId.trim()),
             where("admissionNumber", "==", admissionNo)
         );
         const snapR = await getDocs(qR);
         if (snapR.empty) throw new Error("No result found for this student.");
         
         const resData = snapR.docs[0].data() as ResultData;
         setFormData(resData);
         setEditDocId(snapR.docs[0].id);
         setIsEditing(true);
         setView('create');
     } catch (e: any) { setError(e.message); }
     setLoading(false);
  };

  const handleCheckResult = async () => {
     if (!searchQuery.schoolId || !searchQuery.studentId) {
         setError("School ID and Student ID required.");
         return;
     }
     setLoading(true);
     try {
         const q = query(collection(db, 'Result Data'), 
             where("schoolId", "==", searchQuery.schoolId),
             where("admissionNumber", "==", searchQuery.studentId)
         );
         const snap = await getDocs(q);
         if (!snap.empty) {
             setFoundResult(snap.docs[0].data() as ResultData);
             setView('view-result');
         } else {
             setError("Result not found.");
         }
     } catch (e) { setError("Failed to check result."); }
     setLoading(false);
  };

  const renderSuperAdminView = () => (
      <div className="max-w-6xl mx-auto p-6 bg-white shadow-xl rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-red-600">Super Admin Database</h2>
            <button onClick={() => setView('admin-dashboard')} className="px-4 py-2 bg-gray-200 rounded">Close</button>
          </div>
          <div className="flex gap-4 mb-6 border-b">
             <button onClick={() => setAdminTab('schools')} className={`pb-2 px-4 ${adminTab==='schools'?'border-b-2 border-red-600 font-bold':''}`}>Schools ({allSchools.length})</button>
             <button onClick={() => setAdminTab('teachers')} className={`pb-2 px-4 ${adminTab==='teachers'?'border-b-2 border-red-600 font-bold':''}`}>Teachers ({allTeachers.length})</button>
             <button onClick={() => setAdminTab('students')} className={`pb-2 px-4 ${adminTab==='students'?'border-b-2 border-red-600 font-bold':''}`}>Students ({allStudents.length})</button>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
             {adminTab === 'schools' && (
                 <table className="w-full text-sm text-left">
                     <thead className="bg-gray-100"><tr><th className="p-2">Name</th><th className="p-2">ID</th><th className="p-2">Code</th></tr></thead>
                     <tbody>{allSchools.map((s,i) => <tr key={i} className="border-b"><td className="p-2">{s.schoolName}</td><td className="p-2">{s.schoolId}</td><td className="p-2">{s.schoolCode}</td></tr>)}</tbody>
                 </table>
             )}
              {adminTab === 'teachers' && (
                 <table className="w-full text-sm text-left">
                     <thead className="bg-gray-100"><tr><th className="p-2">Name</th><th className="p-2">ID</th><th className="p-2">School</th></tr></thead>
                     <tbody>{allTeachers.map((t,i) => <tr key={i} className="border-b"><td className="p-2">{t.teacherName}</td><td className="p-2">{t.generatedId}</td><td className="p-2">{t.schoolName}</td></tr>)}</tbody>
                 </table>
             )}
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 pb-12 print:bg-white print:p-0">
      
      {/* Modals & Popups */}
      {showIdCard && generatedStudent && <StudentIdCard student={generatedStudent} onClose={() => { setShowIdCard(false); setView('admin-dashboard'); setRegData({}); }} />}
      {showTeacherIdCard && generatedTeacher && <TeacherIdCard teacher={generatedTeacher} onClose={() => { setShowTeacherIdCard(false); setView('teachers-portal'); setRegData({}); }} />}
      {showScanner && <QrScannerModal onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}
      
      {/* Student Dashboard ID Card Modal */}
      {showDashboardIdCard && dashboardStudent && (
          <StudentIdCard student={dashboardStudent} onClose={() => setShowDashboardIdCard(false)} />
      )}

      {/* Hidden Export Container */}
      <div className="fixed top-0 left-0 -z-50 opacity-0 pointer-events-none">
          {exportState.data && (
              <ResultTemplate data={exportState.data} showDownloads={false} pdfId="admin-export-container" />
          )}
      </div>

      {/* Attendance Confirmation Modal */}
      {pendingAttendance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70] backdrop-blur-sm animate-fade-in">
             <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h3 className={`text-xl font-bold flex items-center gap-2 ${pendingAttendance.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                        {pendingAttendance.type === 'in' ? <LogIn /> : <LogOut />}
                        Confirm Clock {pendingAttendance.type === 'in' ? 'IN' : 'OUT'}
                    </h3>
                    <button onClick={() => setPendingAttendance(null)} className="text-gray-400 hover:text-gray-600"><Trash2 size={20}/></button>
                </div>
                <div className="flex items-center gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border shadow-sm shrink-0 overflow-hidden">
                        {pendingAttendance.student.schoolLogo ? <img src={pendingAttendance.student.schoolLogo} className="w-full h-full object-cover"/> : <School className="text-gray-400"/>}
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 text-lg">{pendingAttendance.student.studentName}</h4>
                        <div className="text-sm text-gray-500"><span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs font-bold mr-2">{pendingAttendance.student.classLevel}</span><span>{pendingAttendance.student.generatedId}</span></div>
                    </div>
                </div>
                <div className="space-y-4 mb-6">
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">{pendingAttendance.type === 'in' ? 'Dropped Off By' : 'Picked Up By'}</label><input type="text" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. Mrs. Adebayo" value={guardianInfo.name} onChange={(e) => setGuardianInfo({...guardianInfo, name: e.target.value})}/></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Guardian Phone Number</label><input type="tel" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. 08012345678" value={guardianInfo.phone} onChange={(e) => setGuardianInfo({...guardianInfo, phone: e.target.value})}/></div>
                </div>
                <div className="flex gap-3"><button onClick={() => setPendingAttendance(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Cancel</button><button onClick={handleConfirmAttendance} disabled={loading} className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 ${pendingAttendance.type === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>{loading ? <Loader2 className="animate-spin"/> : <CheckCircle size={18}/>} Confirm</button></div>
                {error && <p className="text-red-500 text-sm text-center mt-3">{error}</p>}
             </div>
        </div>
      )}

      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl text-purple-800 cursor-pointer" onClick={() => { resetForm(); setView('home'); }}><School /> Sleek School Portal</div>
          <div className="text-xs text-gray-500 hidden md:block">Standard Nigerian Grading System</div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && !pendingAttendance && (<div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm flex items-start gap-3"><ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={20} /><div><h3 className="font-bold text-red-800">Error</h3><p className="text-sm text-red-700">{error}</p></div></div>)}
        {successMsg && !pendingAttendance && (<div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded shadow-sm flex items-start gap-3"><CheckCircle className="text-green-500 shrink-0 mt-0.5" size={20} /><div><h3 className="font-bold text-green-800">Success</h3><p className="text-sm text-green-700">{successMsg}</p></div></div>)}

        {view === 'home' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in">
            <div className="bg-purple-50 p-6 rounded-full"><School className="w-16 h-16 text-purple-700" /></div>
            <h1 className="text-4xl font-bold text-gray-800 tracking-tight">Sleek School <span className="text-purple-600">Portal</span></h1>
            <p className="text-gray-600 max-w-md text-lg">Generate, manage, and distribute student results securely using School and Student IDs.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl mt-8 px-4">
              
              <button onClick={() => { resetForm(); setView('student-login'); }} className="group p-6 bg-white border-2 border-indigo-100 rounded-2xl hover:border-indigo-500 hover:shadow-xl transition-all duration-300 text-left col-span-1 lg:col-span-1">
                <div className="mb-4 text-indigo-600"><UserCircle size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-indigo-700">Student Portal</h3>
                <p className="text-sm text-gray-500">Login to Dashboard (Results, Exams & Profile).</p>
              </button>

              <button onClick={() => { resetForm(); setView('cbt-portal'); }} className="group p-6 bg-white border-2 border-blue-100 rounded-2xl hover:border-blue-500 hover:shadow-xl transition-all duration-300 text-left">
                <div className="mb-4 text-blue-600"><Laptop2 size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-blue-700">CBT Portal</h3>
                <p className="text-sm text-gray-500">Teachers & Exams access.</p>
              </button>

              <button onClick={() => { resetForm(); setView('attendance'); }} className="group p-6 bg-white border-2 border-green-100 rounded-2xl hover:border-green-500 hover:shadow-xl transition-all duration-300 text-left">
                <div className="mb-4 text-green-600"><CalendarCheck size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-green-700">Attendance</h3>
                <p className="text-sm text-gray-500">Clock In/Out students.</p>
              </button>

              <button onClick={() => setView('admin-dashboard')} className="group p-6 bg-white border-2 border-red-100 rounded-2xl hover:border-red-500 hover:shadow-xl transition-all duration-300 text-left lg:col-span-3">
                <div className="mb-4 text-red-600"><ShieldAlert size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-red-700">Admin & Teachers</h3>
                <p className="text-sm text-gray-500">Manage DB, Registers & Upload Results.</p>
              </button>
            </div>
          </div>
        )}

        {view === 'cbt-portal' && <CbtPortal onBack={() => setView('home')} initialStudent={dashboardStudent} />}
        {view === 'attendance' && renderAttendanceView()}
        
        {/* Student Login View */}
        {view === 'student-login' && (
            <div className="max-w-md mx-auto mt-10 bg-white p-8 rounded-2xl shadow-xl animate-slide-up text-center">
                 <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600">
                    <UserCircle size={32} />
                 </div>
                 <h2 className="text-2xl font-bold text-gray-800 mb-2">Student Dashboard Login</h2>
                 <p className="text-gray-500 mb-6 text-sm">Scan your ID card or enter details manually.</p>
                 
                 {/* Toggle Login Method */}
                 <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
                    <button 
                        onClick={() => { setLoginMethod('scan'); setError(''); }}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition ${loginMethod === 'scan' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <div className="flex items-center justify-center gap-2"><QrCode size={16}/> Scan QR</div>
                    </button>
                    <button 
                        onClick={() => { setLoginMethod('manual'); setError(''); }}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition ${loginMethod === 'manual' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <div className="flex items-center justify-center gap-2"><KeyRound size={16}/> Enter ID</div>
                    </button>
                 </div>

                 {loginMethod === 'scan' ? (
                    <button 
                        onClick={() => { setScannerContext('student_login'); setShowScanner(true); }}
                        className="w-full py-4 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition"
                    >
                        <QrCode size={20} /> Open Camera
                    </button>
                 ) : (
                     <div className="space-y-4 text-left animate-fade-in">
                         <div>
                             <label className="text-xs font-bold text-gray-500 uppercase">School ID</label>
                             <input 
                                  type="text" 
                                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                  placeholder="e.g. SCH-001"
                                  value={manualStudentLogin.schoolId}
                                  onChange={(e) => setManualStudentLogin({...manualStudentLogin, schoolId: e.target.value})}
                             />
                         </div>
                         <div>
                             <label className="text-xs font-bold text-gray-500 uppercase">Student ID</label>
                             <input 
                                  type="text" 
                                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                  placeholder="e.g. 8X9Y2Z"
                                  value={manualStudentLogin.studentId}
                                  onChange={(e) => setManualStudentLogin({...manualStudentLogin, studentId: e.target.value})}
                             />
                         </div>
                         <button onClick={handleStudentLogin} disabled={loading} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition">
                             {loading ? <Loader2 className="animate-spin mx-auto"/> : "Login"}
                         </button>
                     </div>
                 )}
                 <button onClick={() => setView('home')} className="mt-6 text-gray-400 text-sm hover:text-gray-600">Back Home</button>
                 {error && <p className="text-red-500 mt-4 text-sm bg-red-50 p-2 rounded">{error}</p>}
            </div>
        )}

        {view === 'student-dashboard' && renderStudentDashboard()}

        {view === 'create' && !isPreview && (
             <div className="max-w-5xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden animate-slide-up">
             {/* ... (existing create view content) ... */}
             <div className={`${isEditing ? 'bg-orange-600' : 'bg-purple-700'} p-6 text-white flex justify-between items-center`}>
              <h2 className="text-2xl font-bold flex items-center gap-2">{isEditing ? <Edit /> : <FileText />} {isEditing ? "Edit Existing Result" : "Result Generator"}</h2>
              <button onClick={() => setView('teachers-portal')} className="text-white opacity-80 hover:opacity-100">Close</button>
            </div>
            <div className="p-6 md:p-8 space-y-8">
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 relative">
                {successMsg && <div className="absolute top-4 right-4 bg-green-100 text-green-800 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse"><RefreshCw size={12}/> {successMsg}</div>}
                
                <div className="absolute top-4 right-4 md:right-auto md:left-[220px] md:top-6 z-10">
                    <button onClick={() => { setScannerContext('create'); setShowScanner(true); }} className="bg-black text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg hover:bg-gray-800 transition"><QrCode size={14} /> Scan Student ID</button>
                </div>

                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><School size={18} /> School Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div><label className="text-sm font-semibold text-gray-700">School ID (Auto-Fill)</label><input type="text" value={formData.schoolId} onChange={(e) => setFormData({...formData, schoolId: e.target.value})} onBlur={handleAutoFillSchool} className="w-full p-3 border rounded-lg outline-none bg-yellow-50 border-yellow-200" placeholder="Enter ID & click away"/></div>
                    <div><label className="text-sm font-semibold text-gray-700">School Name</label><input type="text" value={formData.schoolName} onChange={(e) => setFormData({...formData, schoolName: e.target.value})} className="w-full p-3 border rounded-lg outline-none" placeholder="e.g. Lagos Model College"/></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Phone size={12}/> Phone</label><input type="text" value={formData.schoolPhone} onChange={(e) => setFormData({...formData, schoolPhone: e.target.value})} className="w-full p-2 border rounded outline-none text-sm"/></div>
                      <div><label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Mail size={12}/> Email</label><input type="text" value={formData.schoolEmail} onChange={(e) => setFormData({...formData, schoolEmail: e.target.value})} className="w-full p-2 border rounded outline-none text-sm"/></div>
                    </div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><MapPin size={12}/> Address</label><input type="text" value={formData.schoolAddress} onChange={(e) => setFormData({...formData, schoolAddress: e.target.value})} className="w-full p-2 border rounded outline-none text-sm"/></div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">School Logo & Theme</label>
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                      <div className="flex-1 w-full space-y-2">
                        <div className="relative border border-gray-300 rounded-lg bg-white p-2 flex items-center gap-2"><Upload size={16} className="text-gray-400" /><input type="file" accept="image/*" onChange={handleLogoUpload} className="text-sm text-gray-500 w-full"/></div>
                        <input type="text" value={formData.schoolLogo} onChange={(e) => setFormData({...formData, schoolLogo: e.target.value})} className="w-full p-2 text-xs border-b border-gray-200 outline-none mt-1" placeholder="Or Image URL..."/>
                        <div className="mt-4"><label className="text-xs font-bold text-gray-500 uppercase mb-2 block flex items-center gap-1"><Palette size={12} /> Result Theme Color</label><div className="flex flex-wrap gap-2">{THEME_COLORS.map(color => (<button key={color.name} onClick={() => setFormData({...formData, themeColor: color.hex})} className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${formData.themeColor === color.hex ? 'border-black ring-2 ring-gray-200' : 'border-transparent'}`} style={{ backgroundColor: color.hex }} title={color.name}/>))}</div></div>
                      </div>
                      <div className="w-24 h-24 bg-gray-100 rounded-lg border flex items-center justify-center overflow-hidden shrink-0 relative">{formData.schoolLogo ? <img src={formData.schoolLogo} alt="Preview" className="w-full h-full object-contain" /> : <School size={32} className="text-gray-300" />}<div className="absolute bottom-0 w-full h-2" style={{ backgroundColor: formData.themeColor }}></div></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Student Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-sm font-semibold text-gray-700">Student ID</label><input type="text" value={formData.admissionNumber} onChange={(e) => setFormData({...formData, admissionNumber: e.target.value})} onBlur={handleAutoFillStudent} className="w-full p-3 border rounded-lg bg-yellow-50 border-yellow-200 outline-none" placeholder="Enter Student ID & click away"/></div>
                <div className="space-y-2"><label className="text-sm font-semibold text-gray-700">Student Name</label><input type="text" value={formData.studentName} onChange={(e) => setFormData({...formData, studentName: e.target.value})} className="w-full p-3 border rounded-lg outline-none"/></div>
                <div className="space-y-2"><label className="text-sm font-semibold text-gray-700">Class Level</label><select value={formData.classLevel} onChange={(e) => setFormData({...formData, classLevel: e.target.value})} className="w-full p-3 border rounded-lg outline-none bg-white">{CLASS_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-sm font-semibold text-gray-700">Term</label><select value={formData.term} onChange={(e) => setFormData({...formData, term: e.target.value})} className="w-full p-3 border rounded-lg outline-none bg-white">{['First Term', 'Second Term', 'Third Term'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div className="space-y-2"><label className="text-sm font-semibold text-gray-700">Year</label><input type="number" value={formData.year} onChange={(e) => setFormData({...formData, year: e.target.value})} className="w-full p-3 border rounded-lg outline-none" placeholder="2024"/></div>
                </div>
                <div className="space-y-2 col-span-1 md:col-span-2"><label className="text-sm font-semibold text-indigo-700 flex items-center gap-1"><UserCog size={14} /> Teacher's ID (Required)</label><input type="text" value={formData.teacherId} onChange={(e) => setFormData({...formData, teacherId: e.target.value})} className="w-full p-3 border-2 border-indigo-100 bg-indigo-50 rounded-lg outline-none" placeholder="Enter your Teacher ID"/></div>
              </div>

              <hr className="border-gray-100" />
              
              {/* Subjects */}
              <div>
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                  <h3 className="text-xl font-bold text-gray-800">Academic Performance</h3>
                  <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1 rounded border border-yellow-200"><Trophy size={16} className="text-yellow-600" /><input type="text" placeholder="Position" value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} className="bg-transparent outline-none w-32 text-sm font-semibold text-yellow-800 placeholder-yellow-400"/></div>
                  <div className="flex gap-2">
                    <button onClick={loadPresetSubjects} className="px-4 py-2 text-sm text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100">Quick Load</button>
                    <button onClick={handleAddSubject} className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 flex items-center gap-1"><Plus size={16} /> Add</button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 font-bold uppercase">
                      <tr>
                        <th className="px-4 py-3 min-w-[200px]">Subject</th>
                        <th className="px-2 py-3 w-16 text-center">CA 1</th>
                        <th className="px-2 py-3 w-16 text-center">CA 2</th>
                        <th className="px-2 py-3 w-16 text-center">CA 3</th>
                        <th className="px-2 py-3 w-16 text-center">Exam</th>
                        <th className="px-2 py-3 w-20 text-center">Total</th>
                        <th className="px-2 py-3 w-20 text-center bg-gray-100">Avg</th>
                        <th className="px-2 py-3 w-20 text-center">Grade</th>
                        <th className="px-4 py-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {formData.subjects.map((sub, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2">
                            <div className="space-y-1">
                              {sub.selectedSubject === 'Others' ? (
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="text" 
                                    value={sub.name} 
                                    onChange={(e) => handleSubjectChange(idx, 'name', e.target.value)} 
                                    placeholder="Type Subject Name..." 
                                    className="w-full text-sm p-2 bg-white border border-yellow-300 rounded outline-none focus:ring-2 focus:ring-yellow-400" 
                                    autoFocus
                                  />
                                  <button 
                                    onClick={() => handleSubjectChange(idx, 'selectedSubject', '')}
                                    className="p-2 bg-gray-100 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-500 transition"
                                    title="Cancel Custom Subject"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <select 
                                  value={sub.selectedSubject} 
                                  onChange={(e) => handleSubjectChange(idx, 'selectedSubject', e.target.value)} 
                                  className="w-full bg-transparent p-2 border-b border-transparent focus:border-purple-500 outline-none cursor-pointer"
                                >
                                  <option value="" disabled>Select Subject</option>
                                  {ALL_NIGERIAN_SUBJECTS.map(subject => (<option key={subject} value={subject}>{subject}</option>))}
                                </select>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2"><input type="number" value={sub.ca1} onChange={(e) => handleSubjectChange(idx, 'ca1', e.target.value)} className="w-full text-center bg-gray-50 rounded p-2 outline-none"/></td>
                          <td className="px-2 py-2"><input type="number" value={sub.ca2} onChange={(e) => handleSubjectChange(idx, 'ca2', e.target.value)} className="w-full text-center bg-gray-50 rounded p-2 outline-none"/></td>
                          <td className="px-2 py-2"><input type="number" value={sub.ca3} onChange={(e) => handleSubjectChange(idx, 'ca3', e.target.value)} className="w-full text-center bg-gray-50 rounded p-2 outline-none"/></td>
                          <td className="px-2 py-2"><input type="number" value={sub.exam} onChange={(e) => handleSubjectChange(idx, 'exam', e.target.value)} className="w-full text-center bg-gray-50 rounded p-2 outline-none"/></td>
                          <td className="px-2 py-2 text-center font-bold text-gray-800">{sub.total}</td>
                          <td className="px-2 py-2"><input type="number" value={sub.average} onChange={(e) => handleSubjectChange(idx, 'average', e.target.value)} className="w-full text-center bg-gray-100 rounded p-2 outline-none text-gray-600"/></td>
                          <td className="px-2 py-2 text-center font-bold"><span className={`px-2 py-1 rounded text-xs ${sub.grade.includes('F') || sub.grade.includes('E') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{sub.grade}</span></td>
                          <td className="px-4 py-2 text-center"><button onClick={() => handleRemoveSubject(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Domains & Attendance */}
              <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl space-y-6">
                 <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Activity size={18} /> Domains & Attendance</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-4 rounded border">
                       <h4 className="font-bold text-sm text-gray-600 mb-3 flex items-center gap-2"><Clock size={14}/> Attendance</h4>
                       <div className="flex flex-col md:flex-row gap-4">
                          <div className="flex-1"><label className="text-xs font-bold text-gray-500 uppercase">Days Opened</label><input type="number" value={formData.attendance.total} onChange={(e) => setFormData({...formData, attendance: {...formData.attendance, total: Number(e.target.value)}})} className="w-full p-2 border rounded outline-none" /></div>
                          <div className="flex-1"><label className="text-xs font-bold text-gray-500 uppercase">Days Present</label><input type="number" value={formData.attendance.present} onChange={(e) => setFormData({...formData, attendance: {...formData.attendance, present: Number(e.target.value)}})} className="w-full p-2 border rounded outline-none" /></div>
                       </div>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div><h4 className="font-bold text-sm text-gray-600 mb-3 flex items-center gap-2"><Star size={14}/> Affective Domain (Rate 1-5)</h4><div className="bg-white rounded border p-4 grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">{formData.affective.map((trait, i) => (<div key={i} className="flex items-center justify-between text-sm"><span>{trait.name}</span><div className="flex gap-1">{[1,2,3,4,5].map(val => (<button key={val} onClick={() => {const n=[...formData.affective]; n[i].rating=val; setFormData({...formData, affective: n});}} className={`w-6 h-6 rounded flex items-center justify-center text-xs ${trait.rating >= val ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{val}</button>))}</div></div>))}</div></div>
                    <div><h4 className="font-bold text-sm text-gray-600 mb-3 flex items-center gap-2"><Activity size={14}/> Psychomotor Domain (Rate 1-5)</h4><div className="bg-white rounded border p-4 grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">{formData.psychomotor.map((skill, i) => (<div key={i} className="flex items-center justify-between text-sm"><span>{skill.name}</span><div className="flex gap-1">{[1,2,3,4,5].map(val => (<button key={val} onClick={() => {const n=[...formData.psychomotor]; n[i].rating=val; setFormData({...formData, psychomotor: n});}} className={`w-6 h-6 rounded flex items-center justify-center text-xs ${skill.rating >= val ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{val}</button>))}</div></div>))}</div></div>
                    <div><h4 className="font-bold text-sm text-gray-600 mb-3 flex items-center gap-2"><BrainCircuit size={14}/> Cognitive Domain (Rate 1-5)</h4><div className="bg-white rounded border p-4 grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">{formData.cognitive.map((trait, i) => (<div key={i} className="flex items-center justify-between text-sm"><span>{trait.name}</span><div className="flex gap-1">{[1,2,3,4,5].map(val => (<button key={val} onClick={() => {const n=[...formData.cognitive]; n[i].rating=val; setFormData({...formData, cognitive: n});}} className={`w-6 h-6 rounded flex items-center justify-center text-xs ${trait.rating >= val ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{val}</button>))}</div></div>))}</div></div>
                 </div>
              </div>

              {/* Remarks */}
              <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 relative">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2"><Sparkles className="text-indigo-500" size={20} /> AI Agent Remarks</h3>
                  <button onClick={handleGenerateRemarks} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all">{loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}{isEditing ? "Regenerate Remarks" : "Ask AI to Write Remarks"}</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-sm font-medium text-indigo-900">Class Teacher's Remark</label><textarea value={formData.teacherRemark} onChange={(e) => setFormData({...formData, teacherRemark: e.target.value})} className="w-full p-3 rounded-lg border-indigo-200 min-h-[100px] text-sm" placeholder="Teacher's specific feedback..."/></div>
                  <div className="space-y-2"><label className="text-sm font-medium text-indigo-900">Principal's Remark</label><textarea value={formData.principalRemark} onChange={(e) => setFormData({...formData, principalRemark: e.target.value})} className="w-full p-3 rounded-lg border-indigo-200 min-h-[100px] text-sm" placeholder="Principal's summary..."/></div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl flex flex-col md:flex-row gap-6 items-end justify-end">
                <button onClick={() => {if (!formData.schoolName || !formData.schoolId || !formData.studentName) { setError("Please fill in School & Student details."); window.scrollTo(0,0); return; } setError(''); setIsPreview(true); window.scrollTo(0,0);}} className={`w-full md:w-auto px-8 py-4 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all ${isEditing ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}><Eye size={18} />Preview Result</button>
              </div>
              {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg text-center">{error}</div>}
            </div>
            </div>
        )}

        {view === 'create' && isPreview && (
          <div className="max-w-4xl mx-auto animate-fade-in space-y-6 flex flex-col items-center">
            <ResultTemplate data={formData} showDownloads={false} />
            <div className="flex gap-4 justify-center py-8 w-full max-w-2xl mt-4 border-t pt-8 print:hidden">
              {!isPublished ? (
                <>
                  <button onClick={() => setIsPreview(false)} className="px-6 py-3 bg-gray-200 text-gray-800 font-bold rounded-full hover:bg-gray-300 flex items-center gap-2"><ArrowLeft size={18} /> Edit / Back</button>
                  <button onClick={handlePublish} disabled={loading} className="px-8 py-3 bg-purple-600 text-white font-bold rounded-full hover:bg-purple-700 shadow-lg flex items-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <CheckCircle size={18} />} Confirm & Publish</button>
                </>
              ) : (
                <>
                   <ResultTemplate data={formData} showDownloads={true} />
                   <button onClick={() => { resetForm(); setView('home'); }} className="px-6 py-3 bg-gray-800 text-white font-bold rounded-full hover:bg-gray-900 flex items-center gap-2">Start New Result</button>
                </>
              )}
            </div>
            {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg text-center">{error}</div>}
            {successMsg && <div className="p-4 bg-green-100 text-green-700 rounded-lg text-center">{successMsg}</div>}
          </div>
        )}
        
        {/* ... Rest of existing views (admin-dashboard, register forms, etc) ... */}
        {view === 'admin-dashboard' && (
           <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="bg-purple-900 text-white p-8 rounded-2xl shadow-lg flex justify-between items-center">
              <div><h2 className="text-3xl font-bold flex items-center gap-2"><ShieldAlert /> Administrator's Dashboard</h2><p className="text-purple-200 mt-1">Manage schools, students, teachers and access global databases.</p></div>
              <button onClick={() => setView('home')} className="text-purple-200 hover:text-white">Exit</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button onClick={() => { setRegData({}); setView('register-student'); }} className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-purple-500 text-left group">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Users size={24} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Register Students</h3>
                <p className="text-sm text-gray-500">Teachers upload personal data for new students.</p>
              </button>
              <button onClick={() => { setRegData({}); setView('register-school'); }} className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-purple-500 text-left group">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-orange-600 group-hover:text-white transition-colors"><Building2 size={24} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">School Admin</h3>
                <p className="text-sm text-gray-500">Register new institution with Code and Logo.</p>
              </button>
               <button onClick={() => setView('teachers-portal')} className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-yellow-500 text-left group">
                <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-yellow-600 group-hover:text-white transition-colors"><GraduationCap size={24} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Teachers Portal</h3>
                <p className="text-sm text-gray-500">Register teachers, create and edit results.</p>
              </button>
              <div className="bg-white p-8 rounded-xl shadow-md border-2 border-purple-100 text-left">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><Database size={24} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Master Database</h3>
                <p className="text-sm text-gray-500 mb-4">Restricted access for Super Admins.</p>
                <input type="text" value={superAdminKey} onChange={(e) => setSuperAdminKey(e.target.value)} placeholder="Enter Admin Email/Key" className="w-full p-2 border rounded text-sm mb-2 outline-none"/>
                <button onClick={handleSuperAdminAccess} disabled={loading} className="w-full bg-red-600 text-white py-2 rounded font-bold text-sm hover:bg-red-700">{loading ? "Verifying..." : "Access Database"}</button>
                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
              </div>
            </div>
          </div>
        )}

        {view === 'teachers-portal' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
             <div className="bg-yellow-600 text-white p-8 rounded-2xl shadow-lg flex justify-between items-center">
              <div><h2 className="text-3xl font-bold flex items-center gap-2"><GraduationCap /> Teachers Portal</h2><p className="text-yellow-100 mt-1">Manage teacher profiles and student results.</p></div>
              <button onClick={() => setView('admin-dashboard')} className="text-yellow-100 hover:text-white">Back to Admin</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button onClick={() => { setRegData({}); setView('register-teacher'); }} className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-yellow-500 text-left group">
                    <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-yellow-600 group-hover:text-white transition-colors"><User size={24} /></div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Register Teacher</h3>
                    <p className="text-xs text-gray-500">Create new teacher profile and ID card.</p>
                </button>

                <button onClick={() => { resetForm(); setView('create'); }} className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-purple-500 text-left group">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors"><FileText size={24} /></div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Create Result</h3>
                    <p className="text-xs text-gray-500">Generate new result sheets.</p>
                </button>

                <button onClick={() => { resetForm(); setView('admin-search'); }} className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-orange-500 text-left group">
                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-orange-600 group-hover:text-white transition-colors"><Edit size={24} /></div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Edit Result</h3>
                    <p className="text-xs text-gray-500">Modify uploaded results.</p>
                </button>
            </div>
          </div>
        )}

        {view === 'register-student' && (
           <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-xl animate-slide-up">
            <h2 className="text-2xl font-bold text-blue-800 mb-6 flex items-center gap-2"><Users /> Student Registration</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-500">Full Name</label><input type="text" className="w-full p-3 border rounded" onChange={(e) => setRegData({...regData, studentName: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-gray-500">Gender</label><select className="w-full p-3 border rounded bg-white" onChange={(e) => setRegData({...regData, gender: e.target.value})}><option value="Male">Male</option><option value="Female">Female</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-500">Admission No</label><input type="text" className="w-full p-3 border rounded" onChange={(e) => setRegData({...regData, admissionNumber: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-gray-500">School ID</label><input type="text" className="w-full p-3 border rounded" onChange={(e) => setRegData({...regData, schoolId: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-500">Current Class</label><select className="w-full p-3 border rounded bg-white" onChange={(e) => setRegData({...regData, classLevel: e.target.value})}>{CLASS_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="text-xs font-bold text-gray-500">Parent Phone</label><input type="text" className="w-full p-3 border rounded" onChange={(e) => setRegData({...regData, parentPhone: e.target.value})} /></div>
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setView('admin-dashboard')} className="flex-1 py-3 bg-gray-200 rounded text-gray-700 font-bold">Cancel</button>
                <button onClick={handleRegisterStudent} disabled={loading} className="flex-1 py-3 bg-blue-600 text-white rounded font-bold">{loading ? 'Saving...' : 'Save Student Data'}</button>
              </div>
              {successMsg && <p className="text-green-600 text-center">{successMsg}</p>}
              {error && <p className="text-red-600 text-center">{error}</p>}
            </div>
          </div>
        )}
        
        {view === 'register-teacher' && (
           <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-xl animate-slide-up">
            <h2 className="text-2xl font-bold text-yellow-700 mb-6 flex items-center gap-2"><GraduationCap /> Teacher Registration</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-500">Full Name</label><input type="text" className="w-full p-3 border rounded" onChange={(e) => setRegData({...regData, teacherName: e.target.value})} placeholder="e.g. Mr. Okeke John" /></div>
                <div><label className="text-xs font-bold text-gray-500">School ID</label><input type="text" className="w-full p-3 border rounded" onChange={(e) => setRegData({...regData, schoolId: e.target.value})} placeholder="e.g. SCH-001" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div><label className="text-xs font-bold text-gray-500">Email Address</label><input type="email" className="w-full p-3 border rounded" onChange={(e) => setRegData({...regData, email: e.target.value})} /></div>
                 <div><label className="text-xs font-bold text-gray-500">Phone Number</label><input type="text" className="w-full p-3 border rounded" onChange={(e) => setRegData({...regData, phoneNumber: e.target.value})} /></div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button onClick={() => setView('teachers-portal')} className="flex-1 py-3 bg-gray-200 rounded text-gray-700 font-bold">Cancel</button>
                <button onClick={handleRegisterTeacher} disabled={loading} className="flex-1 py-3 bg-yellow-600 text-white rounded font-bold">{loading ? 'Registering...' : 'Generate Teacher ID'}</button>
              </div>
              {successMsg && <p className="text-green-600 text-center">{successMsg}</p>}
              {error && <p className="text-red-600 text-center">{error}</p>}
            </div>
          </div>
        )}

        {view === 'register-school' && (
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-xl animate-slide-up">
            <h2 className="text-2xl font-bold text-orange-800 mb-6 flex items-center gap-2"><Building2 /> School Registration</h2>
            <div className="space-y-4">
              <div><label className="text-xs font-bold text-gray-500">School Name</label><input type="text" className="w-full p-3 border rounded" onChange={(e) => setRegData({...regData, schoolName: e.target.value})} /></div>
              <div className="grid grid-cols-1 gap-4">
                <div><label className="text-xs font-bold text-red-500">Password</label><input type="password" className="w-full p-3 border rounded bg-red-50" onChange={(e) => setRegData({...regData, schoolCode: e.target.value})} placeholder="Create a secure password" /></div>
              </div>
              <div><label className="text-xs font-bold text-gray-500">Address</label><input type="text" className="w-full p-3 border rounded" onChange={(e) => setRegData({...regData, schoolAddress: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-500">Email</label><input type="text" className="w-full p-3 border rounded" onChange={(e) => setRegData({...regData, schoolEmail: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-gray-500">Phone</label><input type="text" className="w-full p-3 border rounded" onChange={(e) => setRegData({...regData, schoolPhone: e.target.value})} /></div>
              </div>
              <div><label className="text-xs font-bold text-gray-500">School Logo</label><input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full p-2 border rounded mt-1" /></div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setView('admin-dashboard')} className="flex-1 py-3 bg-gray-200 rounded text-gray-700 font-bold">Cancel</button>
                <button onClick={handleRegisterSchool} disabled={loading} className="flex-1 py-3 bg-orange-600 text-white rounded font-bold">{loading ? 'Registering...' : 'Register School'}</button>
              </div>
              
              <div className="mt-6 border-t pt-6">
                 <button onClick={() => setView('school-admin-login')} className="w-full py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 flex items-center justify-center gap-2 transition-all">
                    <LogIn size={18} /> Login to School Dashboard
                 </button>
              </div>

              {successMsg && <p className="text-green-600 text-center mt-2">{successMsg}</p>}
              {error && <p className="text-red-600 text-center mt-2">{error}</p>}
            </div>
          </div>
        )}

        {view === 'school-admin-login' && (
            <div className="max-w-md mx-auto mt-10 bg-white p-8 rounded-2xl shadow-xl animate-slide-up text-center">
                 <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-600">
                    <School size={32} />
                 </div>
                 <h2 className="text-2xl font-bold text-gray-800 mb-2">School Admin Login</h2>
                 <p className="text-gray-500 mb-6 text-sm">Access your school's dashboard. <br/>Enter School ID (or Admin ID) and Password.</p>
                 
                 <div className="space-y-4 text-left">
                     <div>
                         <label className="text-xs font-bold text-gray-500 uppercase">Login ID</label>
                         <input 
                            type="text" 
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" 
                            placeholder="e.g. SCH-1234 or SCH-1234-A1"
                            value={schoolLogin.id}
                            onChange={(e) => setSchoolLogin({...schoolLogin, id: e.target.value})}
                         />
                     </div>
                     <div>
                         <label className="text-xs font-bold text-gray-500 uppercase">Password</label>
                         <input 
                            type="password" 
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            placeholder="********"
                            value={schoolLogin.password}
                            onChange={(e) => setSchoolLogin({...schoolLogin, password: e.target.value})}
                         />
                     </div>
                     <button onClick={handleSchoolLogin} disabled={loading} className="w-full py-3 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition">
                         {loading ? <Loader2 className="animate-spin mx-auto"/> : "Login"}
                     </button>
                 </div>
                 <button onClick={() => setView('admin-dashboard')} className="mt-6 text-gray-400 text-sm hover:text-gray-600">Back</button>
                 {error && <p className="text-red-500 mt-4 text-sm bg-red-50 p-2 rounded">{error}</p>}
            </div>
        )}

        {view === 'school-admin-dashboard' && renderSchoolAdminDashboard()}

        {view === 'admin-search' && (
          <div className="max-w-md mx-auto space-y-8 animate-fade-in pt-8">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center space-y-6 border-t-4 border-orange-500">
              <div className="bg-orange-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-orange-600"><UserCog size={32} /></div>
              <div><h2 className="text-2xl font-bold text-gray-800">Edit Uploaded Result</h2><p className="text-gray-500 mt-2 text-sm">Enter details to locate and edit a specific result.</p></div>
              
              <button 
                  onClick={() => { setScannerContext('edit'); setShowScanner(true); }}
                  className="w-full bg-black text-white py-3 rounded-lg font-bold mb-2 flex items-center justify-center gap-2 hover:bg-gray-800 transition shadow-lg"
              >
                  <QrCode size={18} /> Scan Student ID
              </button>

              <div className="space-y-4 text-left">
                <div><label className="text-xs font-bold text-gray-500 uppercase">School ID</label><input type="text" value={adminQuery.schoolId} onChange={(e) => setAdminQuery({...adminQuery, schoolId: e.target.value})} className="w-full p-3 border rounded-lg outline-none focus:border-orange-500" placeholder="e.g. SCH-001"/></div>
                <div><label className="text-xs font-bold text-gray-500 uppercase">Student ID</label><input type="text" value={adminQuery.studentId} onChange={(e) => setAdminQuery({...adminQuery, studentId: e.target.value})} className="w-full p-3 border rounded-lg outline-none focus:border-orange-500" placeholder="e.g. 8X9Y2Z"/></div>
                <div className="pt-2 border-t border-dashed"><label className="text-xs font-bold text-red-500 uppercase flex items-center gap-1"><KeyRound size={12} /> Teacher ID / Admin Code</label><input type="password" value={adminQuery.teacherCode} onChange={(e) => setAdminQuery({...adminQuery, teacherCode: e.target.value})} className="w-full p-3 border rounded-lg outline-none focus:border-red-500 bg-red-50" placeholder="Enter your Teacher ID"/></div>
                <button onClick={handleAdminLookup} disabled={loading} className="w-full py-3 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" size={18}/> : <Edit size={18} />}{loading ? "Verifying..." : "Verify & Edit"}</button>
                {error && <p className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">{error}</p>}
                {successMsg && <p className="text-green-600 text-sm text-center font-medium bg-green-50 p-2 rounded">{successMsg}</p>}
                <button onClick={() => setView('teachers-portal')} className="w-full text-sm text-gray-400 hover:text-gray-600 mt-2">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {view === 'view-result' && (
             foundResult ? (
                <div className="animate-fade-in">
                     <div className="max-w-6xl mx-auto px-4 py-4 mb-4">
                        <button onClick={() => { setFoundResult(null); setView(dashboardStudent ? 'student-dashboard' : 'home'); }} className="flex items-center gap-2 text-gray-600 hover:text-black font-medium transition">
                            <ArrowLeft size={20} /> Back
                        </button>
                     </div>
                     <ResultTemplate data={foundResult} showDownloads={true} />
                </div>
            ) : (
                <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl animate-slide-up text-center mt-10">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
                        <Search size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Check Result</h2>
                    <p className="text-gray-500 mb-6 text-sm">Enter your details or scan your ID card.</p>
                    
                    <button 
                        onClick={() => { setScannerContext('check'); setShowScanner(true); }}
                        className="w-full bg-black text-white py-3 rounded-lg font-bold mb-6 flex items-center justify-center gap-2 hover:bg-gray-800 transition shadow-lg"
                    >
                        <QrCode size={18} /> Scan Student ID
                    </button>
                    
                    <div className="relative flex py-2 items-center mb-4">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">Or Enter Manually</span>
                        <div className="flex-grow border-t border-gray-200"></div>
                    </div>

                    <div className="space-y-4 text-left">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">School ID</label>
                            <input 
                                type="text" 
                                value={searchQuery.schoolId}
                                onChange={(e) => setSearchQuery({...searchQuery, schoolId: e.target.value})}
                                className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                                placeholder="e.g. SCH-001"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Student ID (Adm No)</label>
                            <input 
                                type="text" 
                                value={searchQuery.studentId}
                                onChange={(e) => setSearchQuery({...searchQuery, studentId: e.target.value})}
                                className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                                placeholder="e.g. ADM/2024/005"
                            />
                        </div>
                        
                        <button 
                            onClick={handleCheckResult} 
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Search size={18} />} 
                            View Result
                        </button>

                        <button onClick={() => setView('home')} className="w-full py-2 text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
                    </div>
                    
                     {error && <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium">{error}</div>}
                </div>
            )
        )}
        
        {view === 'super-admin-view' && renderSuperAdminView()}
      </main>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import QRCode from "react-qr-code";
import { 
  School, FileText, Search, ShieldAlert, Edit, Users, Building2, 
  Database, Plus, Trash2, Trophy, Activity, 
  Sparkles, Loader2, Eye, ArrowLeft, RefreshCw, KeyRound, CheckCircle, Palette, Phone, Mail, MapPin, Clock, Star, UserCog,
  Upload, QrCode, GraduationCap, Lock, House, LayoutDashboard, UserCheck, CreditCard, LogIn, LogOut, CalendarCheck, Calendar, ChevronLeft, ChevronRight, FileDown, Laptop2, BrainCircuit, X, User, BarChart3, Settings, ShieldCheck, UserPlus, Filter, ArrowUpDown, Send, MessageCircle
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
import { ResultData, Subject, SchoolData, StudentData, ViewState, TeacherData, AttendanceLog, CbtAssessment, SchoolAdminProfile, SuperAdminProfile } from './types';
import { 
  THEME_COLORS, AFFECTIVE_TRAITS, PSYCHOMOTOR_SKILLS, COGNITIVE_TRAITS,
  ALL_NIGERIAN_SUBJECTS, CLASS_LEVELS, TEACHER_SECRET_CODE, SUPER_ADMIN_KEY, APP_ID 
} from './constants';

export default function App() {
  const [view, setView] = useState<ViewState>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  
  // Super Admin Data
  const [superAdminKey, setSuperAdminKey] = useState('');
  const [adminTab, setAdminTab] = useState<'overview' | 'schools' | 'students' | 'teachers' | 'results' | 'id_cards' | 'admins'>('overview');
  const [allSchools, setAllSchools] = useState<SchoolData[]>([]);
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [allTeachers, setAllTeachers] = useState<TeacherData[]>([]);
  const [allResults, setAllResults] = useState<ResultData[]>([]);
  const [superAdmins, setSuperAdmins] = useState<SuperAdminProfile[]>([]);
  
  // Edit Modals State
  const [editingSchool, setEditingSchool] = useState<SchoolData | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);
  const [newSuperAdmin, setNewSuperAdmin] = useState({ name: '', email: '', key: '' });

  // Filter & Sort State
  const [filterConfig, setFilterConfig] = useState({ search: '', sort: 'newest', filter: 'all' });

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
  
  // Emailing & WhatsApp State
  const [emailingResult, setEmailingResult] = useState<ResultData | null>(null);
  const [isEmailing, setIsEmailing] = useState(false);
  const emailTemplateRef = useRef<HTMLDivElement>(null);
  
  const [whatsappResult, setWhatsappResult] = useState<ResultData | null>(null);
  const [isWhatsapping, setIsWhatsapping] = useState(false);
  const whatsappTemplateRef = useRef<HTMLDivElement>(null);

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
  const [scannerContext, setScannerContext] = useState<'create' | 'check' | 'edit' | 'attendance_in' | 'attendance_out' | 'check_attendance'>('create');
  
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

  // Fetch School Dashboard Data
  useEffect(() => {
    if (view === 'school-admin-dashboard' && currentSchool) {
        const fetchSchoolData = async () => {
            setLoading(true);
            try {
                // Fetch Teachers
                const qT = query(collection(db, 'Teacher Data'), where('schoolId', '==', currentSchool.schoolId));
                const snapT = await getDocs(qT);
                const teachers = snapT.docs.map(d => ({id: d.id, ...d.data()} as TeacherData));

                // Fetch Students
                const qS = query(collection(db, 'Student Data'), where('schoolId', '==', currentSchool.schoolId));
                const snapS = await getDocs(qS);
                const students = snapS.docs.map(d => ({id: d.id, ...d.data()} as StudentData));

                // Fetch Recent Results (limit 20 for performance)
                const qR = query(collection(db, 'Result Data'), where('schoolId', '==', currentSchool.schoolId));
                const snapR = await getDocs(qR);
                const results = snapR.docs.map(d => ({id: d.id, ...d.data()} as ResultData));

                // Fetch Attendance
                const qA = query(collection(db, 'Attendance Data'), where('schoolId', '==', currentSchool.schoolId));
                const snapA = await getDocs(qA);
                const attendance = snapA.docs.map(d => d.data() as AttendanceLog);

                 // Fetch Exams
                const qE = query(collection(db, 'CBT Assessments'), where('schoolId', '==', currentSchool.schoolId));
                const snapE = await getDocs(qE);
                const exams = snapE.docs.map(d => ({id: d.id, ...d.data()} as CbtAssessment));
                
                // Fetch Sub Admins
                const qAdmins = query(collection(db, 'School Admins'), where('schoolId', '==', currentSchool.schoolId));
                const snapAdmins = await getDocs(qAdmins);
                const admins = snapAdmins.docs.map(d => ({id: d.id, ...d.data()} as SchoolAdminProfile));

                setSchoolData({ teachers, students, results, attendance, exams });
                setSchoolAdmins(admins);
            } catch (err) {
                console.error("Error fetching school data:", err);
                setError("Failed to load school dashboard data.");
            } finally {
                setLoading(false);
            }
        };
        fetchSchoolData();
    }
  }, [view, currentSchool]);

  const calculateGrade = (total: number, level: string) => {
    let system = [];
    if (level.startsWith("SSS")) {
      system = [
        { min: 75, grade: "A1", remark: "Excellent" }, { min: 70, grade: "B2", remark: "Very Good" },
        { min: 65, grade: "B3", remark: "Good" }, { min: 60, grade: "C4", remark: "Credit" },
        { min: 55, grade: "C5", remark: "Credit" }, { min: 50, grade: "C6", remark: "Credit" },
        { min: 45, grade: "D7", remark: "Pass" }, { min: 40, grade: "E8", remark: "Pass" },
        { min: 0, grade: "F9", remark: "Fail" }
      ];
    } else if (level.startsWith("JSS")) {
      system = [
        { min: 70, grade: "A", remark: "Distinction" }, { min: 60, grade: "C", remark: "Credit" },
        { min: 50, grade: "P", remark: "Pass" }, { min: 0, grade: "F", remark: "Fail" }
      ];
    } else {
      system = [
        { min: 80, grade: "A", remark: "Excellent" }, { min: 65, grade: "B", remark: "Very Good" },
        { min: 50, grade: "C", remark: "Credit" }, { min: 40, grade: "D", remark: "Fair" },
        { min: 0, grade: "E", remark: "Needs Improvement" }
      ];
    }

    for (let g of system) {
      if (total >= g.min) return g;
    }
    return system[system.length - 1];
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setRegData({});
    setIsEditing(false);
    setIsPreview(false);
    setIsPublished(false);
    setEditDocId(null);
    setError('');
    setSuccessMsg('');
    setGeneratedStudent(null);
    setShowIdCard(false);
    setGeneratedTeacher(null);
    setShowTeacherIdCard(false);
    setShowScanner(false);
    setShowSchoolQr(false);
    setAttendanceStatus(null);
    setAttendanceReport(null);
    setPendingAttendance(null);
    setGuardianInfo({ name: '', phone: '' });
    setReportMonth(new Date());
    setSelectedDateLog(null);
    setReportStartDate('');
    setReportEndDate('');
    setFoundResult(null);
    setSearchQuery({ schoolId: '', studentId: '' });
    setAdminQuery({ schoolId: '', studentId: '', teacherCode: '' });
    setSchoolLogin({ id: '', password: '' });
    setEditingTeacher(null);
    setEditingSchool(null);
    setEditingStudent(null);
    setFilterConfig({ search: '', sort: 'newest', filter: 'all' });
  };

  // --- FILTER & SORT HELPER ---
  const filterAndSortData = (data: any[], type: 'school' | 'student' | 'teacher' | 'result' | 'exam') => {
      let filtered = [...data];

      // 1. Search
      if (filterConfig.search) {
          const lowerQ = filterConfig.search.toLowerCase();
          filtered = filtered.filter(item => {
              if (type === 'school') return item.schoolName?.toLowerCase().includes(lowerQ) || item.schoolId?.toLowerCase().includes(lowerQ);
              if (type === 'student') return item.studentName?.toLowerCase().includes(lowerQ) || item.admissionNumber?.toLowerCase().includes(lowerQ);
              if (type === 'teacher') return item.teacherName?.toLowerCase().includes(lowerQ) || item.generatedId?.toLowerCase().includes(lowerQ);
              if (type === 'result') return item.studentName?.toLowerCase().includes(lowerQ) || item.admissionNumber?.toLowerCase().includes(lowerQ);
              if (type === 'exam') return item.subject?.toLowerCase().includes(lowerQ) || item.examCode?.toLowerCase().includes(lowerQ);
              return false;
          });
      }

      // 2. Filter (Category/Class)
      if (filterConfig.filter !== 'all') {
          filtered = filtered.filter(item => {
             // For Students/Results - filter by ClassLevel
             if ((type === 'student' || type === 'result') && item.classLevel) {
                 return item.classLevel === filterConfig.filter;
             }
             // For Exams - filter by Type
             if (type === 'exam' && item.type) {
                 return item.type === filterConfig.filter;
             }
             return true;
          });
      }

      // 3. Sort
      filtered.sort((a, b) => {
          if (filterConfig.sort === 'newest') {
              return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
          }
          if (filterConfig.sort === 'oldest') {
               return (new Date(a.createdAt || 0).getTime()) - (new Date(b.createdAt || 0).getTime());
          }
          if (filterConfig.sort === 'name_asc') {
               const nameA = a.studentName || a.schoolName || a.teacherName || a.subject || '';
               const nameB = b.studentName || b.schoolName || b.teacherName || b.subject || '';
               return nameA.localeCompare(nameB);
          }
           if (filterConfig.sort === 'name_desc') {
               const nameA = a.studentName || a.schoolName || a.teacherName || a.subject || '';
               const nameB = b.studentName || b.schoolName || b.teacherName || b.subject || '';
               return nameB.localeCompare(nameA);
          }
          return 0;
      });

      return filtered;
  };

  const handleUpdateSchool = async () => {
    if (!editingSchool || !editingSchool.id) return;
    setLoading(true);
    try {
        const docRef = doc(db, 'School Data', editingSchool.id);
        await updateDoc(docRef, { ...editingSchool });
        setSuccessMsg("School Updated Successfully!");
        setAllSchools(prev => prev.map(s => s.id === editingSchool.id ? editingSchool : s));
        setEditingSchool(null);
    } catch (err) {
        console.error(err);
        setError("Failed to update school.");
    } finally {
        setLoading(false);
    }
  };

  const handleUpdateStudent = async () => {
      if (!editingStudent || !editingStudent.id) return;
      setLoading(true);
      try {
          const docRef = doc(db, 'Student Data', editingStudent.id);
          await updateDoc(docRef, { ...editingStudent });
          setSuccessMsg("Student Updated Successfully!");
          // Update local state in both dashboards
          setAllStudents(prev => prev.map(s => s.id === editingStudent.id ? editingStudent : s));
          setSchoolData(prev => ({
              ...prev,
              students: prev.students.map(s => s.id === editingStudent.id ? editingStudent : s)
          }));
          setEditingStudent(null);
      } catch (err) {
          console.error(err);
          setError("Failed to update student.");
      } finally {
          setLoading(false);
      }
  };

  const handleEditResult = (result: ResultData) => {
      // Populate Form
      const enhancedSubjects = (result.subjects || []).map(s => ({ 
          ...s, 
          ca1: s.ca1 === undefined ? '' : s.ca1, 
          ca2: s.ca2 === undefined ? '' : s.ca2, 
          ca3: s.ca3 === undefined ? '' : s.ca3, 
          exam: s.exam === undefined ? '' : s.exam, 
          average: s.average || 0, 
          selectedSubject: ALL_NIGERIAN_SUBJECTS.includes(s.name) ? s.name : 'Others' 
      })); 
      
      setFormData({ 
          ...result, 
          subjects: enhancedSubjects, 
          attendance: result.attendance || { present: 0, total: 0 }, 
          affective: result.affective || AFFECTIVE_TRAITS.map(t => ({ name: t, rating: 3 })), 
          psychomotor: result.psychomotor || PSYCHOMOTOR_SKILLS.map(t => ({ name: t, rating: 3 })),
          cognitive: result.cognitive || COGNITIVE_TRAITS.map(t => ({ name: t, rating: 3 })) 
      }); 
      
      setEditDocId(result.id || null);
      setIsEditing(true); 
      setView('create'); 
      setSuccessMsg("Loaded result for editing.");
  };

  // --- SEND RESULT TO PARENT EMAIL ---
  const handleSendResultEmail = async (result: ResultData) => {
    setIsEmailing(true);
    try {
        // 1. Get Email
        let email = result.parentEmail;
        if (!email) {
            // Try fetching from Student Data if not in Result Data
            const q = query(collection(db, 'Student Data'), where("schoolId", "==", result.schoolId), where("admissionNumber", "==", result.admissionNumber));
            const snap = await getDocs(q);
            if (!snap.empty) {
                email = (snap.docs[0].data() as StudentData).parentEmail;
            }
        }

        if (!email) {
            alert("No parent email found for this student. Please update student profile.");
            setIsEmailing(false);
            return;
        }

        // 2. Prepare Template in DOM
        setEmailingResult(result);
        // Wait briefly for the hidden component to render with new data
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        // 3. Generate Blob
        if (!emailTemplateRef.current || !window.html2pdf) {
             throw new Error("PDF Generator not ready.");
        }
        
        const element = emailTemplateRef.current;
        const opt = {
            margin: 0,
            filename: `${result.studentName}_Result.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        const pdfBlob = await window.html2pdf().set(opt).from(element).output('blob');

        // 4. Upload to Firebase Storage
        const fileName = `results/${result.schoolId}/email_${result.studentName.replace(/\s+/g,'_')}_${Date.now()}.pdf`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, pdfBlob);
        const downloadUrl = await getDownloadURL(storageRef);

        // 5. Open Mailto Link
        const subject = `Term Result Sheet - ${result.studentName}`;
        const body = `Dear Parent,\n\nPlease find attached the result sheet for ${result.studentName}.\n\nYou can view and download it here:\n${downloadUrl}\n\nBest Regards,\n${result.schoolName}`;
        
        window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setSuccessMsg("Email client opened with result link!");

    } catch (e: any) {
        console.error(e);
        alert("Failed to process email request: " + e.message);
    } finally {
        setIsEmailing(false);
        setEmailingResult(null);
    }
  };

  // --- SEND RESULT TO WHATSAPP ---
  const handleSendResultWhatsApp = async (result: ResultData) => {
    setIsWhatsapping(true);
    try {
        // 1. Get Phone Number
        let phone = result.parentPhone;
        if (!phone) {
             const q = query(collection(db, 'Student Data'), where("schoolId", "==", result.schoolId), where("admissionNumber", "==", result.admissionNumber));
             const snap = await getDocs(q);
             if (!snap.empty) {
                 phone = (snap.docs[0].data() as StudentData).parentPhone;
             }
        }

        if (!phone) {
            alert("No parent phone number found for this student.");
            setIsWhatsapping(false);
            return;
        }

        // 2. Prepare Template in DOM
        setWhatsappResult(result);
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 3. Generate Blob
        if (!whatsappTemplateRef.current || !window.html2pdf) {
             throw new Error("PDF Generator not ready.");
        }

        const element = whatsappTemplateRef.current;
        const opt = {
            margin: 0,
            filename: `${result.studentName}_Result.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const pdfBlob = await window.html2pdf().set(opt).from(element).output('blob');

        // 4. Upload to Firebase Storage
        const fileName = `results/${result.schoolId}/wa_${result.studentName.replace(/\s+/g,'_')}_${Date.now()}.pdf`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, pdfBlob);
        const downloadUrl = await getDownloadURL(storageRef);

        // 5. Format Phone & Open WhatsApp
        // Remove non-digits
        let fmtPhone = phone.replace(/\D/g, '');
        // Remove leading 0 if present
        if (fmtPhone.startsWith('0')) fmtPhone = fmtPhone.substring(1);
        // Add 234 if not present
        if (!fmtPhone.startsWith('234')) fmtPhone = '234' + fmtPhone;

        const message = `Hello, please find the result sheet for ${result.studentName} here: ${downloadUrl}`;
        const whatsappUrl = `https://wa.me/${fmtPhone}?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank');
        setSuccessMsg("WhatsApp opened with result link!");

    } catch (e: any) {
        console.error(e);
        alert("Failed to process WhatsApp request: " + e.message);
    } finally {
        setIsWhatsapping(false);
        setWhatsappResult(null);
    }
  };

  const handleUpdateTeacher = async () => {
      if (!editingTeacher || !editingTeacher.id) return;
      setLoading(true);
      try {
          const teacherRef = doc(db, 'Teacher Data', editingTeacher.id);
          await updateDoc(teacherRef, {
              teacherName: editingTeacher.teacherName,
              email: editingTeacher.email,
              phoneNumber: editingTeacher.phoneNumber
          });
          setSuccessMsg("Teacher details updated successfully!");
          
          setSchoolData(prev => ({
              ...prev,
              teachers: prev.teachers.map(t => t.id === editingTeacher.id ? editingTeacher : t)
          }));
          setAllTeachers(prev => prev.map(t => t.id === editingTeacher.id ? editingTeacher : t));
          
          setEditingTeacher(null);
      } catch (err) {
          console.error(err);
          setError("Failed to update teacher details.");
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
      if (!window.confirm("Are you sure you want to delete this teacher? This action cannot be undone.")) return;
      setLoading(true);
      try {
          await deleteDoc(doc(db, 'Teacher Data', teacherId));
          setSuccessMsg("Teacher deleted successfully.");
          setSchoolData(prev => ({
              ...prev,
              teachers: prev.teachers.filter(t => t.id !== teacherId)
          }));
          setAllTeachers(prev => prev.filter(t => t.id !== teacherId));
      } catch (err) {
          console.error(err);
          setError("Failed to delete teacher.");
      } finally {
          setLoading(false);
      }
  };

  const handleAddSubAdmin = async () => {
      if (!newAdminData.name || !newAdminData.password || !currentSchool) {
          setError("Name and Password are required.");
          return;
      }
      setLoading(true);
      try {
          const suffix = Math.floor(1000 + Math.random() * 9000);
          const adminId = `${currentSchool.schoolId}-A${suffix}`;
          
          const newAdmin: SchoolAdminProfile = {
              schoolId: currentSchool.schoolId,
              adminId: adminId,
              name: newAdminData.name,
              password: newAdminData.password,
              createdAt: new Date().toISOString()
          };

          const docRef = await addDoc(collection(db, 'School Admins'), newAdmin);
          setSchoolAdmins(prev => [...prev, { ...newAdmin, id: docRef.id }]);
          setNewAdminData({ name: '', password: '' });
          setSuccessMsg(`Admin Added! Login ID: ${adminId}`);
      } catch (err) {
          console.error(err);
          setError("Failed to add admin.");
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteSubAdmin = async (id: string) => {
      if (!window.confirm("Remove this admin access?")) return;
      setLoading(true);
      try {
          await deleteDoc(doc(db, 'School Admins', id));
          setSchoolAdmins(prev => prev.filter(a => a.id !== id));
          setSuccessMsg("Admin removed.");
      } catch (err) {
          console.error(err);
          setError("Failed to remove admin.");
      } finally {
          setLoading(false);
      }
  };

  // Super Admin Management
  const handleAddSuperAdmin = async () => {
     if(!newSuperAdmin.name || !newSuperAdmin.key) { setError("Name and Key are required"); return; }
     setLoading(true);
     try {
         const newAdmin: SuperAdminProfile = {
             name: newSuperAdmin.name,
             email: newSuperAdmin.email,
             key: newSuperAdmin.key,
             createdAt: new Date().toISOString()
         };
         const docRef = await addDoc(collection(db, 'SuperAdmins'), newAdmin);
         setSuperAdmins(prev => [...prev, { ...newAdmin, id: docRef.id }]);
         setNewSuperAdmin({ name: '', email: '', key: '' });
         setSuccessMsg("Super Admin Added.");
     } catch (err) {
         console.error(err);
         setError("Failed to add Super Admin.");
     } finally { setLoading(false); }
  };

  const handleDeleteSuperAdmin = async (id: string) => {
      if (!window.confirm("Revoke Super Admin access?")) return;
      setLoading(true);
      try {
          await deleteDoc(doc(db, 'SuperAdmins', id));
          setSuperAdmins(prev => prev.filter(a => a.id !== id));
          setSuccessMsg("Super Admin Removed.");
      } catch (err) { setError("Failed to remove."); } finally { setLoading(false); }
  };

  const handleConfirmAttendance = async () => {
      // ... existing implementation
      if (!pendingAttendance) return;
      if (!guardianInfo.name || !guardianInfo.phone) {
          setError("Guardian Name and Phone are required.");
          return;
      }

      setLoading(true);
      const { student, type, schoolId } = pendingAttendance;
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toLocaleTimeString();

      try {
           const qAtt = query(collection(db, 'Attendance Data'), 
              where("schoolId", "==", schoolId),
              where("admissionNumber", "==", student.admissionNumber),
              where("date", "==", today)
          );
          const attSnap = await getDocs(qAtt);

          if (type === 'in') {
              if (!attSnap.empty) {
                  const rec = attSnap.docs[0].data() as AttendanceLog;
                  if (rec.clockInTime) {
                      setError(`${student.studentName} already clocked in at ${rec.clockInTime}.`);
                  } else {
                       await updateDoc(attSnap.docs[0].ref, { 
                          clockInTime: now,
                          dropOffGuardian: guardianInfo.name,
                          dropOffPhone: guardianInfo.phone
                       });
                       setSuccessMsg(`${student.studentName} Clocked IN at ${now}`);
                       setAttendanceStatus({ name: student.studentName, time: now, type: 'in' });
                  }
              } else {
                  await addDoc(collection(db, 'Attendance Data'), {
                      studentName: student.studentName,
                      admissionNumber: student.admissionNumber,
                      schoolId: schoolId,
                      date: today,
                      clockInTime: now,
                      dropOffGuardian: guardianInfo.name,
                      dropOffPhone: guardianInfo.phone,
                      timestamp: new Date().toISOString()
                  });
                  setSuccessMsg(`${student.studentName} Clocked IN at ${now}`);
                  setAttendanceStatus({ name: student.studentName, time: now, type: 'in' });
              }
          } else {
              if (attSnap.empty) {
                  setError(`${student.studentName} has not clocked in today! Cannot clock out.`);
              } else {
                  const rec = attSnap.docs[0].data() as AttendanceLog;
                  if (rec.clockOutTime) {
                       setError(`${student.studentName} already clocked out at ${rec.clockOutTime}.`);
                  } else {
                      await updateDoc(attSnap.docs[0].ref, { 
                          clockOutTime: now,
                          pickUpGuardian: guardianInfo.name,
                          pickUpPhone: guardianInfo.phone
                       });
                      setSuccessMsg(`${student.studentName} Clocked OUT at ${now}`);
                      setAttendanceStatus({ name: student.studentName, time: now, type: 'out' });
                  }
              }
          }
      } catch (err: any) {
          console.error(err);
          setError("Attendance submission failed.");
      } finally {
          setLoading(false);
          setPendingAttendance(null);
          setGuardianInfo({ name: '', phone: '' });
      }
  };

  const handleDownloadAttendanceReport = () => {
    if (!attendanceReport || !window.html2pdf || !attendancePrintRef.current) return;
    
    const element = attendancePrintRef.current;
    const filename = `${attendanceReport.student.name.replace(/\s+/g, '_')}_Attendance_Report.pdf`;

    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    window.html2pdf().set(opt).from(element).save();
  };

  const handleScanSuccess = async (decodedText: string) => {
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
                     parentPhone: stData.parentPhone || prev.parentPhone,
                     parentEmail: stData.parentEmail || prev.parentEmail
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

  const handlePublish = async () => {
    setLoading(true);
    try {
      const teacherCode = formData.teacherId.trim();
      if (!teacherCode) { setError("Teacher ID is required to publish results."); setLoading(false); return; }
      if (teacherCode !== TEACHER_SECRET_CODE) {
          const qTeacher = query(collection(db, 'Teacher Data'), where("generatedId", "==", teacherCode));
          const teacherSnap = await getDocs(qTeacher);
          if (teacherSnap.empty) { setError("Invalid Teacher ID. Please register as a teacher in the Admin dashboard."); setLoading(false); return; }
      }

      let finalParentPhone = formData.parentPhone;
      let finalParentEmail = formData.parentEmail;

      if (!finalParentPhone || !finalParentEmail) {
         const qStudent = query(collection(db, 'Student Data'), 
            where("schoolId", "==", formData.schoolId), 
            where("admissionNumber", "==", formData.admissionNumber)
         );
         const sSnap = await getDocs(qStudent);
         if (!sSnap.empty) { 
             const sData = sSnap.docs[0].data() as StudentData;
             if(!finalParentPhone) finalParentPhone = sData.parentPhone;
             if(!finalParentEmail) finalParentEmail = sData.parentEmail;
         }
      }

      const currentUserId = 'anonymous';
      const dataToSave = {
        ...formData,
        parentPhone: finalParentPhone,
        parentEmail: finalParentEmail,
        schoolId: formData.schoolId.trim(),
        admissionNumber: formData.admissionNumber.trim(),
        searchName: formData.studentName.toLowerCase().trim(),
        updatedAt: new Date().toISOString(),
        userId: currentUserId
      };
      
      const resultsRef = collection(db, 'Result Data');
      
      if (isEditing && editDocId) {
        const docRef = doc(db, 'Result Data', editDocId);
        await updateDoc(docRef, dataToSave);
        setSuccessMsg("Result Updated Successfully!");
      } else {
        await addDoc(resultsRef, { ...dataToSave, createdAt: new Date().toISOString() });
        setSuccessMsg("Result Published Successfully!");
      }
      
      if (finalParentPhone) { setFormData(prev => ({ ...prev, parentPhone: finalParentPhone })); }
      if (finalParentEmail) { setFormData(prev => ({ ...prev, parentEmail: finalParentEmail })); }
      
      setIsPublished(true);
      window.scrollTo(0, document.body.scrollHeight);
      
    } catch (err: any) { 
      console.error("Publish Error:", err);
      setError("Failed to save. Ensure you have internet access."); 
    } finally { setLoading(false); }
  };
  
  const handleAutoFillSchool = async () => { if (!formData.schoolId) return; setSuccessMsg("Checking School Database..."); try { const q = query(collection(db, 'School Data'), where("schoolId", "==", formData.schoolId.trim())); const querySnapshot = await getDocs(q); if (!querySnapshot.empty) { const schoolData = querySnapshot.docs[0].data() as SchoolData; setFormData(prev => ({ ...prev, schoolName: schoolData.schoolName || prev.schoolName, schoolLogo: schoolData.schoolLogo || prev.schoolLogo, schoolEmail: schoolData.schoolEmail || prev.schoolEmail, schoolPhone: schoolData.schoolPhone || prev.schoolPhone, schoolAddress: schoolData.schoolAddress || prev.schoolAddress, })); setSuccessMsg("School details loaded automatically!"); } else { setSuccessMsg(""); } } catch (err) { console.error(err); setSuccessMsg(""); } setTimeout(() => setSuccessMsg(''), 2000); };
  
  const handleAutoFillStudent = async () => {
    if (!formData.schoolId || !formData.admissionNumber) return;
    setSuccessMsg("Checking Student Database...");
    
    const inputVal = formData.admissionNumber.trim();
    const schoolVal = formData.schoolId.trim();

    try {
      let q = query(collection(db, 'Student Data'), 
          where("schoolId", "==", schoolVal), 
          where("generatedId", "==", inputVal)
      );
      let querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        q = query(collection(db, 'Student Data'), 
            where("schoolId", "==", schoolVal), 
            where("generatedId", "==", inputVal.toUpperCase())
        );
        querySnapshot = await getDocs(q);
      }

      if (querySnapshot.empty) {
         q = query(collection(db, 'Student Data'), 
            where("schoolId", "==", schoolVal), 
            where("admissionNumber", "==", inputVal)
        );
        querySnapshot = await getDocs(q);
      }

      if (!querySnapshot.empty) {
        const studentData = querySnapshot.docs[0].data() as StudentData;
        setFormData(prev => ({
          ...prev,
          studentName: studentData.studentName || prev.studentName,
          classLevel: studentData.classLevel || prev.classLevel,
          parentPhone: studentData.parentPhone || prev.parentPhone,
          parentEmail: studentData.parentEmail || prev.parentEmail,
          admissionNumber: studentData.admissionNumber || prev.admissionNumber
        }));
        setSuccessMsg("Student profile found and loaded!");
      } else {
        setSuccessMsg("Student not found.");
      }
    } catch (err) {
      console.error(err);
      setSuccessMsg("Error checking DB.");
    }
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { if (file.size > 500000) { setError("Image file is too large. Please use an image under 500KB."); return; } const reader = new FileReader(); reader.onloadend = () => { const result = reader.result as string; setFormData(prev => ({ ...prev, schoolLogo: result })); setRegData(prev => ({ ...prev, schoolLogo: result })); setEditingSchool(prev => prev ? ({ ...prev, schoolLogo: result }) : null); }; reader.readAsDataURL(file); } };
  
  const handleSubjectChange = (index: number, field: keyof Subject, value: string | number) => { 
      const newSubjects = [...formData.subjects]; 
      const subject = { ...newSubjects[index] }; 
      if (field === 'selectedSubject') { 
          subject.selectedSubject = value as string; 
          subject.name = value === 'Others' ? '' : value as string; 
      } else if (field === 'name') { 
          subject.name = value as string; 
      } else { 
          (subject as any)[field] = value; 
      } 
      
      if (['ca1', 'ca2', 'ca3', 'exam'].includes(field as string) || field === 'selectedSubject') { 
          const safeTotal = (subject.ca1 === '' ? 0 : Number(subject.ca1)) + 
                            (subject.ca2 === '' ? 0 : Number(subject.ca2)) + 
                            (subject.ca3 === '' ? 0 : Number(subject.ca3)) + 
                            (subject.exam === '' ? 0 : Number(subject.exam)); 
          subject.total = safeTotal; 
          const gradeInfo = calculateGrade(subject.total, formData.classLevel); 
          subject.grade = gradeInfo.grade; 
          subject.remark = gradeInfo.remark; 
      } 
      newSubjects[index] = subject; 
      setFormData({ ...formData, subjects: newSubjects }); 
  };

  const handleAddSubject = () => { 
      setFormData(prev => ({ 
          ...prev, 
          subjects: [ ...prev.subjects, { selectedSubject: '', name: '', ca1: '', ca2: '', ca3: '', exam: '', total: 0, average: 0, grade: '', remark: '' } ] 
      })); 
  };
  
  const handleRemoveSubject = (index: number) => { const newSubjects = [...formData.subjects]; newSubjects.splice(index, 1); setFormData({ ...formData, subjects: newSubjects }); };
  
  const loadPresetSubjects = () => { 
      let subjectsToLoad: string[] = []; 
      const lvl = formData.classLevel; 
      if (lvl.startsWith("Nursery")) subjectsToLoad = ["Number Work", "Letter Work", "Health Habits", "Social Norms", "Rhymes", "Creative Arts"]; 
      else if (lvl.startsWith("Basic")) subjectsToLoad = ["Mathematics", "English Language", "Basic Science & Technology", "Verbal Reasoning", "Quantitative Reasoning"]; 
      else if (lvl.startsWith("JSS")) subjectsToLoad = ["Mathematics", "English Studies", "Basic Science", "Social Studies", "Civic Education"]; 
      else subjectsToLoad = ["Mathematics", "English Language", "Biology", "Economics"]; 
      
      const mapped = subjectsToLoad.map(name => ({ selectedSubject: name, name, ca1: '', ca2: '', ca3: '', exam: '', total: 0, average: 0, grade: 'F', remark: 'Fail' })); 
      setFormData(prev => ({ ...prev, subjects: mapped })); 
  };
  
  const handleGenerateRemarks = async () => { if (formData.subjects.length === 0) { setError("Please add subjects and scores first."); return; } setLoading(true); setError(''); try { const remarks = await generateGeminiRemarks(formData.studentName, formData.subjects, formData.classLevel, formData.position, formData.affective); setFormData(prev => ({ ...prev, principalRemark: remarks.principalRemark, teacherRemark: remarks.teacherRemark })); setSuccessMsg("Remarks generated by AI!"); } catch (err) { setError("Failed to generate remarks."); } finally { setLoading(false); } };
  const handleRegisterStudent = async () => { if (!regData.studentName || !regData.admissionNumber || !regData.schoolId) { setError("Name, Admission Number, and School ID are required."); return; } setLoading(true); setError(''); try { const q = query(collection(db, 'School Data'), where("schoolId", "==", regData.schoolId.trim())); const querySnapshot = await getDocs(q); if (querySnapshot.empty) { setError("School ID not found. Please register the school first."); return; } const schoolData = querySnapshot.docs[0].data() as SchoolData; const schoolName = schoolData.schoolName || ""; const schoolLogo = schoolData.schoolLogo || ""; const uniqueId = Math.random().toString(36).substring(2, 10).toUpperCase(); const studentPayload: StudentData = { studentName: regData.studentName || "", admissionNumber: regData.admissionNumber || "", schoolId: regData.schoolId || "", classLevel: regData.classLevel || "", gender: regData.gender || "Male", parentPhone: regData.parentPhone || "", parentEmail: regData.parentEmail || "", generatedId: uniqueId, schoolName: schoolName, schoolLogo: schoolLogo, createdAt: new Date().toISOString(), userId: 'anonymous' }; await addDoc(collection(db, 'Student Data'), studentPayload); setGeneratedStudent(studentPayload); setSuccessMsg("Student Registered Successfully!"); setShowIdCard(true); } catch(err: any) { console.error("Student Registration Error:", err); setError("Failed to register student."); } finally { setLoading(false); } };
  const handleRegisterTeacher = async () => { 
      if (!regData.teacherName || !regData.schoolId || !regData.email) { 
          setError("Name, School ID and Email are required."); 
          return; 
      } 
      setLoading(true); 
      try { 
          const q = query(collection(db, 'School Data'), where("schoolId", "==", regData.schoolId.trim())); 
          const schoolSnap = await getDocs(q); 
          if (schoolSnap.empty) { 
              setError("School ID not found."); 
              return; 
          } 
          const schoolData = schoolSnap.docs[0].data() as SchoolData; 
          const teacherId = "TCH-" + Math.floor(1000 + Math.random() * 9000); 
          const teacherPayload: TeacherData = { 
              teacherName: regData.teacherName || "", 
              schoolId: regData.schoolId || "", 
              generatedId: teacherId, 
              phoneNumber: regData.phoneNumber || "", 
              email: regData.email || "", 
              schoolName: schoolData.schoolName || "", 
              schoolLogo: schoolData.schoolLogo || "", 
              createdAt: new Date().toISOString(), 
              userId: 'anonymous' 
          }; 
          await addDoc(collection(db, 'Teacher Data'), teacherPayload); 
          setGeneratedTeacher(teacherPayload); 
          setSuccessMsg("Teacher Registered Successfully!"); 
          setShowTeacherIdCard(true); 
      } catch (err: any) { 
          console.error("Teacher Reg Error:", err); 
          setError(`Failed to register teacher: ${err.message}`); 
      } finally { 
          setLoading(false); 
      } 
  };
  const handleRegisterSchool = async () => { 
      if (!regData.schoolName || !regData.schoolCode) { 
          setError("School Name and Password are required."); 
          return; 
      } 
      setLoading(true); 
      try { 
          const newSchoolId = `SCH-${Math.floor(1000 + Math.random() * 9000)}`;
          const newSchool: SchoolData = {
              schoolName: regData.schoolName!,
              schoolId: newSchoolId,
              schoolCode: regData.schoolCode!, // Password
              schoolAddress: regData.schoolAddress || '',
              schoolEmail: regData.schoolEmail || '',
              schoolPhone: regData.schoolPhone || '',
              schoolLogo: regData.schoolLogo || ''
          };

          await addDoc(collection(db, 'School Data'), { ...newSchool, createdAt: new Date().toISOString(), userId: 'anonymous' }); 
          
          setSuccessMsg(`School Registered! ID: ${newSchoolId}`); 
          setCurrentSchool(newSchool);
          setCurrentUserProfile({ name: 'Master Admin', role: 'Main Admin' });

          setTimeout(() => { 
              setSuccessMsg(''); 
              setRegData({}); 
              setView('school-admin-dashboard');
          }, 1500); 
      } catch(err: any) { 
          console.error("School Registration Error:", err); 
          setError(`Failed to register school: ${err.message || 'Network Error'}`); 
      } finally { 
          setLoading(false); 
      } 
  };

  const handleSchoolLogin = async () => {
    if (!schoolLogin.id || !schoolLogin.password) {
        setError("Login ID and Password are required.");
        return;
    }
    setLoading(true);
    setError('');
    
    const inputId = schoolLogin.id.trim();

    try {
        // 1. Try Login as Master Admin (School ID)
        let q = query(collection(db, 'School Data'), where("schoolId", "==", inputId));
        let snap = await getDocs(q);
        
        if (!snap.empty) {
            const school = snap.docs[0].data() as SchoolData;
            if (school.schoolCode === schoolLogin.password) {
                 setCurrentSchool(school);
                 setCurrentUserProfile({ name: 'Master Admin', role: 'Main Admin' });
                 setSuccessMsg("Login Successful!");
                 setTimeout(() => { setSuccessMsg(''); setView('school-admin-dashboard'); }, 1000);
                 setLoading(false);
                 return;
            }
        }

        // 2. Try Login as Sub-Admin
        q = query(collection(db, 'School Admins'), where("adminId", "==", inputId));
        snap = await getDocs(q);

        if (!snap.empty) {
            const adminProfile = snap.docs[0].data() as SchoolAdminProfile;
            if (adminProfile.password === schoolLogin.password) {
                 // Fetch Parent School Data
                 const qSchool = query(collection(db, 'School Data'), where("schoolId", "==", adminProfile.schoolId));
                 const snapSchool = await getDocs(qSchool);
                 
                 if (!snapSchool.empty) {
                     setCurrentSchool(snapSchool.docs[0].data() as SchoolData);
                     setCurrentUserProfile({ name: adminProfile.name, role: 'Administrator' });
                     setSuccessMsg(`Welcome, ${adminProfile.name}!`);
                     setTimeout(() => { setSuccessMsg(''); setView('school-admin-dashboard'); }, 1000);
                     setLoading(false);
                     return;
                 }
            }
        }

        setError("Invalid ID or Password.");
    } catch (err) {
        console.error(err);
        setError("Login failed due to network or server error.");
    } finally {
        setLoading(false);
    }
  };

  const handleCheckResult = async () => {
    // ... existing implementation
    if (!searchQuery.schoolId || !searchQuery.studentId) {
        setError("School ID and Student ID are required.");
        return;
    }
    setLoading(true);
    setError('');
    try {
        const q = query(collection(db, 'Result Data'),
            where("schoolId", "==", searchQuery.schoolId.trim()),
            where("admissionNumber", "==", searchQuery.studentId.trim())
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            setFoundResult(querySnapshot.docs[0].data() as ResultData);
            setSuccessMsg("Result retrieved successfully.");
        } else {
            setError("No result found matching these details.");
        }
    } catch (err) {
        console.error(err);
        setError("Failed to fetch result. Please try again.");
    } finally {
        setLoading(false);
    }
  };

  const handleAdminLookup = async () => { 
      if (!adminQuery.schoolId || !adminQuery.studentId || !adminQuery.teacherCode) { setError("All fields are required."); return; } 
      setLoading(true); setError(''); 
      try { 
          const q = query(collection(db, 'Result Data'), where("schoolId", "==", adminQuery.schoolId.trim()), where("admissionNumber", "==", adminQuery.studentId.trim())); 
          const querySnapshot = await getDocs(q); 
          if (querySnapshot.empty) { setError("No result found."); } 
          else { 
              const docSnap = querySnapshot.docs[0]; 
              const data = docSnap.data() as ResultData; 
              let isAuthorized = false; 
              if (adminQuery.teacherCode === TEACHER_SECRET_CODE) isAuthorized = true; 
              else if (data.teacherId === adminQuery.teacherCode) isAuthorized = true; 
              if (!isAuthorized) { setError("Access Denied: Teacher ID does not match the record owner."); setLoading(false); return; } 
              
              handleEditResult(data);
          } 
      } catch (err: any) { setError("Error looking up result."); } finally { setLoading(false); } 
    };

  const handleSuperAdminAccess = async () => { 
      setLoading(true); setError(''); 
      let authorized = false;

      // 1. Check Hardcoded Key
      if (superAdminKey === SUPER_ADMIN_KEY) {
          authorized = true;
      } else {
          // 2. Check Database
          try {
              const q = query(collection(db, 'SuperAdmins'), where('key', '==', superAdminKey));
              const snap = await getDocs(q);
              if(!snap.empty) authorized = true;
          } catch(err) {
              console.error(err);
          }
      }

      if (authorized) {
           try { 
              const [res, sch, stu, tch, adm] = await Promise.all([ 
                  getDocs(collection(db, 'Result Data')), 
                  getDocs(collection(db, 'School Data')), 
                  getDocs(collection(db, 'Student Data')), 
                  getDocs(collection(db, 'Teacher Data')),
                  getDocs(collection(db, 'SuperAdmins'))
              ]); 
              setAllResults(res.docs.map(d => ({id: d.id, ...d.data()} as ResultData))); 
              setAllSchools(sch.docs.map(d => ({id: d.id, ...d.data()} as SchoolData))); 
              setAllStudents(stu.docs.map(d => ({id: d.id, ...d.data()} as StudentData))); 
              setAllTeachers(tch.docs.map(d => ({id: d.id, ...d.data()} as TeacherData))); 
              setSuperAdmins(adm.docs.map(d => ({id: d.id, ...d.data()} as SuperAdminProfile)));
              
              setView('super-admin-view'); 
              setAdminTab('overview'); 
          } catch(err: any) { 
              console.error(err); 
              setError("Failed to fetch database. Check internet connection."); 
          } 
      } else {
          setError("Invalid Access Credentials."); 
      }
      setLoading(false); 
  };

  const getDaysInMonth = (date: Date) => { const year = date.getFullYear(); const month = date.getMonth(); const days = new Date(year, month + 1, 0).getDate(); return Array.from({ length: days }, (_, i) => { const d = new Date(year, month, i + 1); return { date: d, iso: d.toISOString().split('T')[0], dayNum: i + 1, isWeekend: d.getDay() === 0 || d.getDay() === 6 }; }); };
  const renderAttendanceView = () => { return ( <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-xl animate-slide-up text-center"> <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center justify-center gap-2"><CalendarCheck className="text-purple-600" /> Class Attendance</h2> <div className="mb-8"> <p className="text-gray-500 mb-4">Select an action below.</p> <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> <button onClick={() => { setScannerContext('attendance_in'); setShowScanner(true); setError(''); setSuccessMsg(''); setAttendanceStatus(null); setAttendanceReport(null); setSelectedDateLog(null); }} className="flex flex-col items-center justify-center p-5 bg-green-50 border-2 border-green-200 rounded-2xl hover:bg-green-100 hover:border-green-500 transition-all group"> <LogIn size={32} className="text-green-600 mb-1 group-hover:scale-110 transition-transform" /> <span className="text-lg font-bold text-green-700">Clock In</span> </button> <button onClick={() => { setScannerContext('attendance_out'); setShowScanner(true); setError(''); setSuccessMsg(''); setAttendanceStatus(null); setAttendanceReport(null); setSelectedDateLog(null); }} className="flex flex-col items-center justify-center p-5 bg-red-50 border-2 border-red-200 rounded-2xl hover:bg-red-100 hover:border-red-500 transition-all group"> <LogOut size={32} className="text-red-600 mb-1 group-hover:scale-110 transition-transform" /> <span className="text-lg font-bold text-red-700">Clock Out</span> </button> <button onClick={() => { setScannerContext('check_attendance'); setShowScanner(true); setError(''); setSuccessMsg(''); setAttendanceStatus(null); setAttendanceReport(null); setSelectedDateLog(null); }} className="flex flex-col items-center justify-center p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl hover:bg-blue-100 hover:border-blue-500 transition-all group"> <Calendar size={32} className="text-blue-600 mb-1 group-hover:scale-110 transition-transform" /> <span className="text-lg font-bold text-blue-700">Check Report</span> </button> </div> </div> {attendanceStatus && (<div className={`p-6 rounded-xl border-2 animate-fade-in ${attendanceStatus.type === 'in' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}><div className="text-5xl mb-2">{attendanceStatus.type === 'in' ? '👋' : '🏠'}</div><h3 className="text-2xl font-bold">{attendanceStatus.name}</h3><p className="text-lg font-medium">{attendanceStatus.type === 'in' ? 'Clocked IN' : 'Clocked OUT'} at <span className="font-mono font-bold bg-white/50 px-2 rounded">{attendanceStatus.time}</span></p></div>)} {attendanceReport && ( <div className="mt-8 border-t pt-8 animate-fade-in"> <div className="bg-gray-50 p-4 rounded-xl mb-6 flex flex-wrap gap-4 items-end justify-center border border-gray-100"> <div> <label className="text-xs font-bold text-gray-500 block mb-1">Start Date</label> <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="p-2 border rounded text-sm w-36 outline-none focus:ring-1 focus:ring-purple-500 bg-white"/> </div> <div> <label className="text-xs font-bold text-gray-500 block mb-1">End Date</label> <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="p-2 border rounded text-sm w-36 outline-none focus:ring-1 focus:ring-purple-500 bg-white"/> </div> <button onClick={handleDownloadAttendanceReport} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 h-[38px] transition shadow-md"> <FileDown size={18}/> Download PDF </button> </div> <div className="grid grid-cols-7 gap-1 mb-2 text-xs font-bold text-gray-400"><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div></div> <div className="grid grid-cols-7 gap-1"> {getDaysInMonth(reportMonth).map((d) => { const log = attendanceReport.logs.find(log => log.date === d.iso); const isLogged = !!log; return (<div key={d.dayNum} onClick={() => { if(isLogged) setSelectedDateLog(log || null); }} className={`aspect-square flex items-center justify-center rounded-lg text-sm font-bold relative group ${isLogged ? 'bg-green-500 text-white cursor-pointer' : 'bg-gray-50 text-gray-400'}`}>{d.dayNum}</div>); })} </div> </div> )} {selectedDateLog && ( <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedDateLog(null)}> <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full m-4 relative" onClick={e => e.stopPropagation()}> <button onClick={() => setSelectedDateLog(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button> <h3 className="font-bold text-xl text-gray-800 mb-1">Attendance Details</h3> <p className="text-sm text-gray-500 mb-6 font-medium">{selectedDateLog.date}</p> <div className="space-y-4"><div className="bg-green-50 p-4 rounded-xl border border-green-100"><p className="text-2xl font-mono font-bold text-green-900 mb-2">{selectedDateLog.clockInTime || '---'}</p><div className="text-sm text-green-800 bg-white/60 p-2 rounded-lg"><div className="flex gap-1 mb-1"><span className="font-semibold text-green-900 w-16">Guardian:</span> <span>{selectedDateLog.dropOffGuardian || 'N/A'}</span></div></div></div><div className="bg-red-50 p-4 rounded-xl border border-red-100"><p className="text-2xl font-mono font-bold text-red-900 mb-2">{selectedDateLog.clockOutTime || '---'}</p><div className="text-sm text-red-800 bg-white/60 p-2 rounded-lg"><div className="flex gap-1 mb-1"><span className="font-semibold text-red-900 w-16">Guardian:</span> <span>{selectedDateLog.pickUpGuardian || 'N/A'}</span></div></div></div></div> </div> </div> )} <button onClick={() => setView('home')} className="mt-8 text-gray-500 hover:text-gray-800 font-medium">Back to Home</button> </div> ); };
  
  // Reusable Filter Toolbar
  const renderFilterToolbar = () => (
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
              <input 
                  type="text" 
                  placeholder="Search records..." 
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-purple-500"
                  value={filterConfig.search}
                  onChange={e => setFilterConfig({...filterConfig, search: e.target.value})}
              />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                  <select 
                      className="w-full pl-9 pr-8 py-2 border rounded-lg text-sm bg-white outline-none cursor-pointer appearance-none"
                      value={filterConfig.filter}
                      onChange={e => setFilterConfig({...filterConfig, filter: e.target.value})}
                  >
                      <option value="all">All Categories</option>
                      {CLASS_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="ca1">CA1</option>
                      <option value="ca2">CA2</option>
                      <option value="exam">Exam</option>
                  </select>
              </div>
              <div className="relative flex-1 md:flex-none">
                  <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                  <select 
                      className="w-full pl-9 pr-8 py-2 border rounded-lg text-sm bg-white outline-none cursor-pointer appearance-none"
                      value={filterConfig.sort}
                      onChange={e => setFilterConfig({...filterConfig, sort: e.target.value})}
                  >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="name_asc">Name (A-Z)</option>
                      <option value="name_desc">Name (Z-A)</option>
                  </select>
              </div>
          </div>
      </div>
  );

  const renderSuperAdminView = () => {
    const tabs = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard, color: 'bg-indigo-600' },
        { id: 'schools', label: 'Schools', icon: School, color: 'bg-orange-600' },
        { id: 'students', label: 'Students', icon: Users, color: 'bg-blue-600' },
        { id: 'teachers', label: 'Teachers', icon: GraduationCap, color: 'bg-yellow-600' },
        { id: 'results', label: 'Results', icon: FileText, color: 'bg-purple-600' },
        { id: 'id_cards', label: 'ID Cards', icon: CreditCard, color: 'bg-emerald-600' },
        { id: 'admins', label: 'Admins', icon: ShieldCheck, color: 'bg-red-600' },
    ];

    return (
        <div className="max-w-7xl mx-auto animate-fade-in flex flex-col md:flex-row gap-6 relative">
            {/* Edit School Modal */}
            {editingSchool && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full">
                        <h3 className="text-xl font-bold mb-4">Edit School</h3>
                        <div className="space-y-3">
                            <input className="w-full p-2 border rounded" placeholder="School Name" value={editingSchool.schoolName} onChange={e => setEditingSchool({...editingSchool, schoolName: e.target.value})} />
                            <input className="w-full p-2 border rounded" placeholder="Email" value={editingSchool.schoolEmail} onChange={e => setEditingSchool({...editingSchool, schoolEmail: e.target.value})} />
                            <input className="w-full p-2 border rounded" placeholder="Phone" value={editingSchool.schoolPhone} onChange={e => setEditingSchool({...editingSchool, schoolPhone: e.target.value})} />
                            <input className="w-full p-2 border rounded" placeholder="Password (Code)" value={editingSchool.schoolCode} onChange={e => setEditingSchool({...editingSchool, schoolCode: e.target.value})} />
                            <div className="border p-2 rounded">
                                <label className="text-xs font-bold text-gray-500 block mb-1">Logo</label>
                                <input type="file" accept="image/*" onChange={handleLogoUpload} />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setEditingSchool(null)} className="flex-1 py-2 bg-gray-100 rounded">Cancel</button>
                            <button onClick={handleUpdateSchool} className="flex-1 py-2 bg-blue-600 text-white rounded">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

             {/* Edit Student Modal */}
             {editingStudent && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full">
                        <h3 className="text-xl font-bold mb-4">Edit Student</h3>
                        <div className="space-y-3">
                            <input className="w-full p-2 border rounded" placeholder="Student Name" value={editingStudent.studentName} onChange={e => setEditingStudent({...editingStudent, studentName: e.target.value})} />
                            <input className="w-full p-2 border rounded" placeholder="Admission Number" value={editingStudent.admissionNumber} onChange={e => setEditingStudent({...editingStudent, admissionNumber: e.target.value})} />
                            <select className="w-full p-2 border rounded bg-white" value={editingStudent.classLevel} onChange={e => setEditingStudent({...editingStudent, classLevel: e.target.value})}>
                                {CLASS_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input className="w-full p-2 border rounded" placeholder="Parent Phone" value={editingStudent.parentPhone} onChange={e => setEditingStudent({...editingStudent, parentPhone: e.target.value})} />
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setEditingStudent(null)} className="flex-1 py-2 bg-gray-100 rounded">Cancel</button>
                            <button onClick={handleUpdateStudent} className="flex-1 py-2 bg-blue-600 text-white rounded">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <div className="w-full md:w-64 shrink-0 space-y-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
                        <Database className="text-red-600" /> Master DB
                    </h2>
                    <div className="flex flex-col gap-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = adminTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => { setAdminTab(tab.id as any); setFilterConfig({search:'', sort:'newest', filter:'all'}); }}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                                        isActive 
                                            ? `${tab.color} text-white shadow-lg` 
                                            : `text-gray-600 hover:bg-gray-50`
                                    }`}
                                >
                                    <Icon size={18} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                     <button onClick={() => setView('admin-dashboard')} className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-red-600 transition p-2 font-medium text-sm">
                        <LogOut size={16} /> Exit Dashboard
                     </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-white p-8 rounded-2xl shadow-xl border border-gray-100 min-h-[600px]">
                <div className="mb-6 pb-4 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800 capitalize">{adminTab.replace('_', ' ')}</h3>
                        <p className="text-gray-500 text-sm">Manage system-wide data.</p>
                    </div>
                </div>

                {adminTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="p-6 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-orange-600 shadow-sm"><School size={24} /></div>
                            <div><h3 className="text-3xl font-bold text-gray-800">{allSchools.length}</h3><p className="text-sm text-gray-500 font-bold uppercase">Schools</p></div>
                        </div>
                         <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm"><Users size={24} /></div>
                            <div><h3 className="text-3xl font-bold text-gray-800">{allStudents.length}</h3><p className="text-sm text-gray-500 font-bold uppercase">Students</p></div>
                        </div>
                        <div className="p-6 bg-yellow-50 border border-yellow-100 rounded-2xl flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-yellow-600 shadow-sm"><GraduationCap size={24} /></div>
                            <div><h3 className="text-3xl font-bold text-gray-800">{allTeachers.length}</h3><p className="text-sm text-gray-500 font-bold uppercase">Teachers</p></div>
                        </div>
                         <div className="p-6 bg-purple-50 border border-purple-100 rounded-2xl flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-purple-600 shadow-sm"><FileText size={24} /></div>
                            <div><h3 className="text-3xl font-bold text-gray-800">{allResults.length}</h3><p className="text-sm text-gray-500 font-bold uppercase">Results</p></div>
                        </div>
                    </div>
                )}
                
                {adminTab === 'schools' && (
                     <div>
                        {renderFilterToolbar()}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                                    <tr>
                                        <th className="p-4 border-b font-bold">School Name</th>
                                        <th className="p-4 border-b font-bold">ID</th>
                                        <th className="p-4 border-b font-bold">Details</th>
                                        <th className="p-4 border-b font-bold text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filterAndSortData(allSchools, 'school').map((s, i) => (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden border">
                                                        {s.schoolLogo ? <img src={s.schoolLogo} className="w-full h-full object-cover"/> : <School size={16} className="text-gray-400"/>}
                                                    </div>
                                                    <span className="font-bold text-gray-800">{s.schoolName}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 font-mono text-xs bg-gray-50/50 text-gray-600 rounded">{s.schoolId}</td>
                                            <td className="p-4 text-xs text-gray-500">{s.schoolEmail}<br/>{s.schoolPhone}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => setEditingSchool(s)} className="bg-orange-50 text-orange-600 p-2 rounded hover:bg-orange-100"><Edit size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {adminTab === 'students' && (
                    <div>
                        {renderFilterToolbar()}
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-600 uppercase text-xs sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 border-b">Name</th>
                                        <th className="p-4 border-b">Admission No</th>
                                        <th className="p-4 border-b">Class</th>
                                        <th className="p-4 border-b text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filterAndSortData(allStudents, 'student').map((s, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="p-4 font-bold text-gray-800">{s.studentName}</td>
                                            <td className="p-4 text-gray-600 font-mono text-xs">{s.admissionNumber}</td>
                                            <td className="p-4"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">{s.classLevel}</span></td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => setEditingStudent(s)} className="bg-blue-50 text-blue-600 p-2 rounded hover:bg-blue-100"><Edit size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {adminTab === 'teachers' && (
                     <div>
                        {renderFilterToolbar()}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                                    <tr>
                                        <th className="p-4 border-b font-bold">Name</th>
                                        <th className="p-4 border-b font-bold">ID</th>
                                        <th className="p-4 border-b font-bold">School</th>
                                        <th className="p-4 border-b font-bold text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filterAndSortData(allTeachers, 'teacher').map((t, i) => (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-bold text-gray-800">{t.teacherName}</td>
                                            <td className="p-4 font-mono text-xs text-yellow-600 bg-yellow-50 rounded w-fit px-2">{t.generatedId}</td>
                                            <td className="p-4 text-gray-600 text-xs">{t.schoolName}</td>
                                            <td className="p-4 text-right flex justify-end gap-2">
                                                 <button onClick={() => setEditingTeacher(t)} className="bg-yellow-50 text-yellow-600 p-2 rounded hover:bg-yellow-100"><Edit size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {adminTab === 'results' && (
                    <div>
                         {renderFilterToolbar()}
                         <div className="overflow-x-auto max-h-[600px]">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-600 uppercase text-xs sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 border-b">Student</th>
                                        <th className="p-4 border-b">Class</th>
                                        <th className="p-4 border-b">Term</th>
                                        <th className="p-4 border-b text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filterAndSortData(allResults, 'result').map((r, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="p-4 font-bold text-gray-800">{r.studentName}</td>
                                            <td className="p-4 text-xs text-gray-600">{r.classLevel}</td>
                                            <td className="p-4 text-xs text-gray-600">{r.term} {r.session}</td>
                                            <td className="p-4 text-right flex justify-end gap-2">
                                                <button onClick={() => handleSendResultWhatsApp(r)} disabled={isWhatsapping} className="bg-green-50 text-green-600 p-2 rounded hover:bg-green-100" title="Send via WhatsApp">
                                                    {isWhatsapping && whatsappResult?.id === r.id ? <Loader2 size={16} className="animate-spin"/> : <MessageCircle size={16}/>}
                                                </button>
                                                <button onClick={() => handleSendResultEmail(r)} disabled={isEmailing} className="bg-blue-50 text-blue-600 p-2 rounded hover:bg-blue-100" title="Send via Email">
                                                    {isEmailing && emailingResult?.id === r.id ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
                                                </button>
                                                <button onClick={() => handleEditResult(r)} className="bg-purple-50 text-purple-600 p-2 rounded hover:bg-purple-100"><Edit size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {adminTab === 'id_cards' && (
                    <IdCardManager students={allStudents} teachers={allTeachers} />
                )}

                {adminTab === 'admins' && (
                    <div className="space-y-6">
                        <div className="bg-red-50 p-6 rounded-xl border border-red-100">
                            <h3 className="text-lg font-bold text-red-800 mb-4">Add New Super Admin</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <input placeholder="Name" className="p-2 border rounded" value={newSuperAdmin.name} onChange={e => setNewSuperAdmin({...newSuperAdmin, name: e.target.value})}/>
                                <input placeholder="Email" className="p-2 border rounded" value={newSuperAdmin.email} onChange={e => setNewSuperAdmin({...newSuperAdmin, email: e.target.value})}/>
                                <input placeholder="Secure Key" className="p-2 border rounded" value={newSuperAdmin.key} onChange={e => setNewSuperAdmin({...newSuperAdmin, key: e.target.value})}/>
                            </div>
                            <button onClick={handleAddSuperAdmin} className="mt-4 px-6 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700">Grant Access</button>
                        </div>

                        <div className="bg-white border rounded-xl overflow-hidden">
                             <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="p-4">Name</th>
                                        <th className="p-4">Email</th>
                                        <th className="p-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    <tr className="bg-gray-50">
                                        <td className="p-4 font-bold text-gray-800">Root Admin</td>
                                        <td className="p-4 text-gray-500">System Owner</td>
                                        <td className="p-4 text-right"><span className="text-xs bg-gray-200 px-2 py-1 rounded">Protected</span></td>
                                    </tr>
                                    {superAdmins.map(admin => (
                                        <tr key={admin.id}>
                                            <td className="p-4">{admin.name}</td>
                                            <td className="p-4 text-gray-500">{admin.email}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => admin.id && handleDeleteSuperAdmin(admin.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                             </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
  };

  const renderSchoolAdminDashboard = () => {
    // Define tabs
    const tabs = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard, color: 'bg-blue-600', hover: 'hover:bg-blue-700' },
        { id: 'teachers', label: 'Teachers', icon: GraduationCap, color: 'bg-yellow-600', hover: 'hover:bg-yellow-700' },
        { id: 'students', label: 'Students', icon: Users, color: 'bg-green-600', hover: 'hover:bg-green-700' },
        { id: 'results', label: 'Results', icon: FileText, color: 'bg-purple-600', hover: 'hover:bg-purple-700' },
        { id: 'exams', label: 'CBT Exams', icon: Laptop2, color: 'bg-indigo-600', hover: 'hover:bg-indigo-700' },
        { id: 'attendance', label: 'Attendance', icon: CalendarCheck, color: 'bg-red-600', hover: 'hover:bg-red-700' },
        { id: 'admins', label: 'Settings & Admins', icon: Settings, color: 'bg-gray-600', hover: 'hover:bg-gray-700' },
    ];

    return (
    <div className="max-w-7xl mx-auto animate-fade-in flex flex-col md:flex-row gap-6">
        {/* School QR Modal */}
        {showSchoolQr && currentSchool && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowSchoolQr(false)}>
                <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowSchoolQr(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-600">
                        <School size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">{currentSchool.schoolName}</h3>
                    <p className="text-sm text-gray-500 mb-6">School Identity QR Code</p>
                    
                    <div className="bg-white p-4 rounded-xl border-2 border-dashed border-orange-200 inline-block mb-4">
                        <div style={{ height: "auto", margin: "0 auto", maxWidth: 200, width: "100%" }}>
                            <QRCode
                                size={256}
                                level="M"
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                value={currentSchool.schoolId}
                                viewBox={`0 0 256 256`}
                            />
                        </div>
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 uppercase font-bold">School ID</p>
                        <p className="font-mono text-xl font-bold text-orange-600 tracking-wider">{currentSchool.schoolId}</p>
                    </div>
                </div>
            </div>
        )}

        {/* Edit Student Modal (Reused) */}
        {editingStudent && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full">
                    <h3 className="text-xl font-bold mb-4">Edit Student</h3>
                    <div className="space-y-3">
                        <input className="w-full p-2 border rounded" placeholder="Student Name" value={editingStudent.studentName} onChange={e => setEditingStudent({...editingStudent, studentName: e.target.value})} />
                        <input className="w-full p-2 border rounded" placeholder="Admission Number" value={editingStudent.admissionNumber} onChange={e => setEditingStudent({...editingStudent, admissionNumber: e.target.value})} />
                        <select className="w-full p-2 border rounded bg-white" value={editingStudent.classLevel} onChange={e => setEditingStudent({...editingStudent, classLevel: e.target.value})}>
                            {CLASS_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input className="w-full p-2 border rounded" placeholder="Parent Phone" value={editingStudent.parentPhone} onChange={e => setEditingStudent({...editingStudent, parentPhone: e.target.value})} />
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setEditingStudent(null)} className="flex-1 py-2 bg-gray-100 rounded">Cancel</button>
                        <button onClick={handleUpdateStudent} className="flex-1 py-2 bg-blue-600 text-white rounded">Save Changes</button>
                    </div>
                </div>
            </div>
        )}

        {/* Edit Teacher Modal */}
        {editingTeacher && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <UserCog size={20} className="text-orange-600"/> Edit Teacher Profile
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500">Name</label>
                            <input 
                                type="text" 
                                className="w-full p-2 border rounded" 
                                value={editingTeacher.teacherName}
                                onChange={(e) => setEditingTeacher({...editingTeacher, teacherName: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500">Email</label>
                            <input 
                                type="email" 
                                className="w-full p-2 border rounded" 
                                value={editingTeacher.email}
                                onChange={(e) => setEditingTeacher({...editingTeacher, email: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500">Phone</label>
                            <input 
                                type="text" 
                                className="w-full p-2 border rounded" 
                                value={editingTeacher.phoneNumber}
                                onChange={(e) => setEditingTeacher({...editingTeacher, phoneNumber: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setEditingTeacher(null)} className="flex-1 py-2 bg-gray-100 rounded text-gray-700 font-bold hover:bg-gray-200">Cancel</button>
                        <button onClick={handleUpdateTeacher} className="flex-1 py-2 bg-orange-600 text-white rounded font-bold hover:bg-orange-700">Update</button>
                    </div>
                </div>
             </div>
        )}

        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0 space-y-4">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                 {/* School Profile Header in Sidebar */}
                 <div className="flex flex-col items-center mb-6 text-center">
                     <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 border border-orange-200 mb-2 overflow-hidden" onClick={() => setShowSchoolQr(true)}>
                         {currentSchool?.schoolLogo ? <img src={currentSchool.schoolLogo} className="w-full h-full object-cover"/> : <School size={32} />}
                     </div>
                     <h2 className="font-bold text-gray-800 leading-tight">{currentSchool?.schoolName}</h2>
                     <p className="text-xs text-gray-500 mt-1 font-bold">{currentUserProfile?.name}</p>
                 </div>
                 
                 <div className="flex flex-col gap-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = schoolDashboardTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => { setSchoolDashboardTab(tab.id as any); setFilterConfig({search:'', sort:'newest', filter:'all'}); }}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                                    isActive 
                                        ? `${tab.color} text-white shadow-lg` 
                                        : `text-gray-600 hover:bg-gray-50`
                                }`}
                            >
                                <Icon size={18} />
                                {tab.label}
                            </button>
                        );
                    })}
                 </div>
             </div>
             {/* Logout */}
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                 <button onClick={() => { setCurrentSchool(null); setCurrentUserProfile(null); setView('home'); }} className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-red-600 transition p-2 font-medium text-sm">
                    <LogOut size={16} /> Logout
                 </button>
             </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-white p-8 rounded-2xl shadow-xl border border-gray-100 min-h-[600px]">
             {/* Content Header */}
             <div className="mb-6 pb-4 border-b border-gray-100 flex justify-between items-center">
                 <div>
                     <h3 className="text-2xl font-bold text-gray-800 capitalize">{schoolDashboardTab.replace('_', ' ')}</h3>
                     <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">ID: {currentSchool?.schoolId}</span>
                        <button onClick={() => setShowSchoolQr(true)} className="text-orange-600 text-xs font-bold flex items-center gap-1 hover:bg-orange-50 px-2 py-1 rounded"><QrCode size={12}/> QR Code</button>
                     </div>
                 </div>
             </div>

             {loading && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-orange-500" size={32} /></div>}
             
             {!loading && schoolDashboardTab === 'overview' && (
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="p-6 bg-blue-50 rounded-xl border border-blue-100 text-center">
                         <h3 className="text-3xl font-bold text-blue-600 mb-1">{schoolData.teachers.length}</h3>
                         <p className="text-xs font-bold uppercase text-gray-500">Teachers</p>
                     </div>
                     <div className="p-6 bg-green-50 rounded-xl border border-green-100 text-center">
                         <h3 className="text-3xl font-bold text-green-600 mb-1">{schoolData.students.length}</h3>
                         <p className="text-xs font-bold uppercase text-gray-500">Students</p>
                     </div>
                     <div className="p-6 bg-purple-50 rounded-xl border border-purple-100 text-center">
                         <h3 className="text-3xl font-bold text-purple-600 mb-1">{schoolData.results.length}</h3>
                         <p className="text-xs font-bold uppercase text-gray-500">Results</p>
                     </div>
                      <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                         <h3 className="text-3xl font-bold text-indigo-600 mb-1">{schoolData.exams.length}</h3>
                         <p className="text-xs font-bold uppercase text-gray-500">Active Exams</p>
                     </div>
                 </div>
             )}

             {!loading && schoolDashboardTab === 'teachers' && (
                 <div>
                    {renderFilterToolbar()}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                <tr>
                                    <th className="p-3">Name</th>
                                    <th className="p-3">Teacher ID</th>
                                    <th className="p-3">Email</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filterAndSortData(schoolData.teachers, 'teacher').map((t, i) => (
                                    <tr key={i} className="hover:bg-gray-50 group">
                                        <td className="p-3 font-bold">{t.teacherName}</td>
                                        <td className="p-3 font-mono">{t.generatedId}</td>
                                        <td className="p-3">{t.email}</td>
                                        <td className="p-3 text-right flex justify-end gap-2">
                                            <button onClick={() => setEditingTeacher(t)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-full"><Edit size={16}/></button>
                                            <button onClick={() => t.id && handleDeleteTeacher(t.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-full"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                                {schoolData.teachers.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">No teachers found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                 </div>
             )}

             {!loading && schoolDashboardTab === 'admins' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div>
                         <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><ShieldCheck size={20}/> Authorized Admins</h3>
                         <div className="space-y-3">
                             <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                                 <div>
                                     <p className="font-bold text-gray-800">Master Admin</p>
                                     <p className="text-xs text-gray-500 font-mono">{currentSchool?.schoolId}</p>
                                 </div>
                                 <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-bold">Owner</span>
                             </div>
                             {schoolAdmins.map((admin) => (
                                 <div key={admin.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                                     <div>
                                         <p className="font-bold text-gray-800">{admin.name}</p>
                                         <div className="flex gap-2 text-xs text-gray-500 font-mono">
                                             <span>ID: {admin.adminId}</span>
                                             <span>Pwd: {admin.password}</span>
                                         </div>
                                     </div>
                                     <button onClick={() => admin.id && handleDeleteSubAdmin(admin.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                 </div>
                             ))}
                             {schoolAdmins.length === 0 && <p className="text-sm text-gray-400 italic">No additional admins configured.</p>}
                         </div>
                     </div>
                     
                     <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                         <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><UserPlus size={20}/> Add New Admin</h3>
                         <div className="space-y-4">
                             <div>
                                 <label className="text-xs font-bold text-gray-500 uppercase">Admin Name</label>
                                 <input 
                                    type="text" 
                                    className="w-full p-2 border rounded bg-white" 
                                    placeholder="e.g. Vice Principal"
                                    value={newAdminData.name}
                                    onChange={e => setNewAdminData({...newAdminData, name: e.target.value})}
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-bold text-gray-500 uppercase">Create Password</label>
                                 <input 
                                    type="text" 
                                    className="w-full p-2 border rounded bg-white" 
                                    placeholder="Secret Code"
                                    value={newAdminData.password}
                                    onChange={e => setNewAdminData({...newAdminData, password: e.target.value})}
                                 />
                             </div>
                             <button onClick={handleAddSubAdmin} className="w-full py-2 bg-orange-600 text-white font-bold rounded hover:bg-orange-700">Create Admin Access</button>
                         </div>
                     </div>
                 </div>
             )}

             {!loading && schoolDashboardTab === 'students' && (
                 <div>
                    {renderFilterToolbar()}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                <tr>
                                    <th className="p-3">Name</th>
                                    <th className="p-3">Student ID</th>
                                    <th className="p-3">Admission No</th>
                                    <th className="p-3">Class</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filterAndSortData(schoolData.students, 'student').map((s, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="p-3 font-bold">{s.studentName}</td>
                                        <td className="p-3 font-mono text-purple-600">{s.generatedId}</td>
                                        <td className="p-3 font-mono">{s.admissionNumber}</td>
                                        <td className="p-3">{s.classLevel}</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => setEditingStudent(s)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-full"><Edit size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                                {schoolData.students.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-400">No students found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                 </div>
             )}

             {!loading && schoolDashboardTab === 'results' && (
                  <div>
                    {renderFilterToolbar()}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                <tr>
                                    <th className="p-3">Student Name</th>
                                    <th className="p-3">Class</th>
                                    <th className="p-3">Term</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filterAndSortData(schoolData.results, 'result').map((r, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="p-3 font-bold">{r.studentName}</td>
                                        <td className="p-3">{r.classLevel}</td>
                                        <td className="p-3">{r.term} {r.session}</td>
                                        <td className="p-3 text-right flex justify-end gap-2">
                                            <button onClick={() => handleSendResultWhatsApp(r)} disabled={isWhatsapping} className="text-green-500 hover:text-green-700 bg-green-50 p-2 rounded-full" title="Send via WhatsApp">
                                                {isWhatsapping && whatsappResult?.id === r.id ? <Loader2 size={16} className="animate-spin"/> : <MessageCircle size={16}/>}
                                            </button>
                                            <button onClick={() => handleSendResultEmail(r)} disabled={isEmailing} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-full" title="Send via Email">
                                                {isEmailing && emailingResult?.id === r.id ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
                                            </button>
                                            <button onClick={() => handleEditResult(r)} className="text-purple-500 hover:text-purple-700 bg-purple-50 p-2 rounded-full"><Edit size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                                {schoolData.results.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">No results uploaded yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                  </div>
             )}

            {!loading && schoolDashboardTab === 'exams' && (
                  <div>
                    {renderFilterToolbar()}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                <tr>
                                    <th className="p-3">Subject</th>
                                    <th className="p-3">Type</th>
                                    <th className="p-3">Class</th>
                                    <th className="p-3">Code</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filterAndSortData(schoolData.exams, 'exam').map((e, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="p-3 font-bold">{e.subject}</td>
                                        <td className="p-3 uppercase">{e.type}</td>
                                        <td className="p-3">{e.classLevel}</td>
                                        <td className="p-3 font-mono text-purple-600">{e.examCode}</td>
                                    </tr>
                                ))}
                                {schoolData.exams.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">No exams created yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                  </div>
             )}

             {!loading && schoolDashboardTab === 'attendance' && (
                  <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                         <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                             <tr>
                                 <th className="p-3">Date</th>
                                 <th className="p-3">Student</th>
                                 <th className="p-3">In</th>
                                 <th className="p-3">In Guardian</th>
                                 <th className="p-3">Out</th>
                                 <th className="p-3">Out Guardian</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y">
                             {schoolData.attendance.map((a, i) => (
                                 <tr key={i} className="hover:bg-gray-50">
                                     <td className="p-3 font-mono text-xs">{a.date}</td>
                                     <td className="p-3 font-bold">{a.studentName}</td>
                                     <td className="p-3 text-green-600">{a.clockInTime || '-'}</td>
                                     <td className="p-3 text-xs text-gray-500">{a.dropOffGuardian || '-'}</td>
                                     <td className="p-3 text-red-600">{a.clockOutTime || '-'}</td>
                                     <td className="p-3 text-xs text-gray-500">{a.pickUpGuardian || '-'}</td>
                                 </tr>
                             ))}
                             {schoolData.attendance.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-400">No attendance logs found.</td></tr>}
                         </tbody>
                     </table>
                 </div>
             )}
        </div>
    </div>
  )};

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 pb-12 print:bg-white print:p-0">
      
      {/* Hidden Container for Email Result PDF Generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={emailTemplateRef}>
            {emailingResult && <ResultTemplate data={emailingResult} />}
        </div>
      </div>
      
      {/* Hidden Container for WhatsApp Result PDF Generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={whatsappTemplateRef}>
            {whatsappResult && <ResultTemplate data={whatsappResult} />}
        </div>
      </div>

      {/* Modals & Popups */}
      {showIdCard && generatedStudent && <StudentIdCard student={generatedStudent} onClose={() => { setShowIdCard(false); setView('admin-dashboard'); setRegData({}); }} />}
      {showTeacherIdCard && generatedTeacher && <TeacherIdCard teacher={generatedTeacher} onClose={() => { setShowTeacherIdCard(false); setView('teachers-portal'); setRegData({}); }} />}
      {showScanner && <QrScannerModal onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}
      
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl mt-8 px-4">
              
              <button onClick={() => { resetForm(); setView('cbt-portal'); }} className="group p-6 bg-white border-2 border-indigo-100 rounded-2xl hover:border-indigo-500 hover:shadow-xl transition-all duration-300 text-left">
                <div className="mb-4 text-indigo-600"><Laptop2 size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-indigo-700">CBT Portal</h3>
                <p className="text-sm text-gray-500">Exams & Assessments.</p>
              </button>

              <button onClick={() => { resetForm(); setView('view-result'); }} className="group p-6 bg-white border-2 border-blue-100 rounded-2xl hover:border-blue-500 hover:shadow-xl transition-all duration-300 text-left">
                <div className="mb-4 text-blue-600"><Search size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-blue-700">Check Result</h3>
                <p className="text-sm text-gray-500">Students view/print results.</p>
              </button>

              <button onClick={() => { resetForm(); setView('attendance'); }} className="group p-6 bg-white border-2 border-green-100 rounded-2xl hover:border-green-500 hover:shadow-xl transition-all duration-300 text-left">
                <div className="mb-4 text-green-600"><CalendarCheck size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-green-700">Attendance</h3>
                <p className="text-sm text-gray-500">Clock In/Out students.</p>
              </button>

              <button onClick={() => setView('admin-dashboard')} className="group p-6 bg-white border-2 border-red-100 rounded-2xl hover:border-red-500 hover:shadow-xl transition-all duration-300 text-left">
                <div className="mb-4 text-red-600"><ShieldAlert size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-red-700">Admin</h3>
                <p className="text-sm text-gray-500">Manage DB & Registers.</p>
              </button>
            </div>
          </div>
        )}

        {view === 'cbt-portal' && <CbtPortal onBack={() => setView('home')} />}
        {view === 'attendance' && renderAttendanceView()}
        {view === 'create' && !isPreview && (
             <div className="max-w-5xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden animate-slide-up">
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
              {/* Added Parent Email Input */}
              <div><label className="text-xs font-bold text-gray-500">Parent Email</label><input type="email" className="w-full p-3 border rounded" placeholder="For emailing results" onChange={(e) => setRegData({...regData, parentEmail: e.target.value})} /></div>
              
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
                <div><label className="text-xs font-bold text-gray-500 uppercase">Student ID (Admission No)</label><input type="text" value={adminQuery.studentId} onChange={(e) => setAdminQuery({...adminQuery, studentId: e.target.value})} className="w-full p-3 border rounded-lg outline-none focus:border-orange-500" placeholder="e.g. ADM/2024/055"/></div>
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
                        <button onClick={() => { setFoundResult(null); setView('home'); }} className="flex items-center gap-2 text-gray-600 hover:text-black font-medium transition">
                            <ArrowLeft size={20} /> Back to Search
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
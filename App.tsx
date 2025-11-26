
import React, { useState } from 'react';
import { 
  School, FileText, Search, ShieldAlert, Edit, Users, Building2, 
  Database, Plus, Trash2, Trophy, Activity, 
  Sparkles, Loader2, Eye, ArrowLeft, RefreshCw, KeyRound, CheckCircle, Palette, Phone, Mail, MapPin, Clock, Star, UserCog,
  Upload, QrCode, GraduationCap, Lock, House, LayoutDashboard, UserCheck, CreditCard
} from 'lucide-react';
import { collection, addDoc, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

import { db } from './services/firebase';
import { generateGeminiRemarks } from './services/gemini';
import ResultTemplate from './components/ResultTemplate';
import StudentIdCard from './components/StudentIdCard';
import TeacherIdCard from './components/TeacherIdCard';
import QrScannerModal from './components/QrScannerModal';
import IdCardManager from './components/IdCardManager';
import { ResultData, Subject, SchoolData, StudentData, ViewState, TeacherData } from './types';
import { 
  THEME_COLORS, AFFECTIVE_TRAITS, PSYCHOMOTOR_SKILLS, 
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
  const [adminTab, setAdminTab] = useState<'overview' | 'schools' | 'students' | 'teachers' | 'results' | 'id_cards'>('overview');
  const [allSchools, setAllSchools] = useState<SchoolData[]>([]);
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [allTeachers, setAllTeachers] = useState<TeacherData[]>([]);
  const [allResults, setAllResults] = useState<ResultData[]>([]);
  const [masterSearch, setMasterSearch] = useState('');

  // Initial Form State
  const initialFormState: ResultData = {
    schoolName: '', schoolLogo: '', schoolId: '', schoolEmail: '', schoolPhone: '', schoolAddress: '', themeColor: '#6b21a8', 
    studentName: '', admissionNumber: '', classLevel: 'SSS 1', term: 'First Term', session: '2024/2025',
    year: new Date().getFullYear().toString(), position: '', teacherId: '', accessCode: '1234', 
    subjects: [], principalRemark: '', teacherRemark: '',
    attendance: { present: 0, total: 0 },
    affective: AFFECTIVE_TRAITS.map(t => ({ name: t, rating: 3 })),
    psychomotor: PSYCHOMOTOR_SKILLS.map(t => ({ name: t, rating: 3 }))
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
  const [scannerContext, setScannerContext] = useState<'create' | 'check' | 'edit'>('create');

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
  };

  const handleScanSuccess = async (decodedText: string) => {
    setShowScanner(false);
    try {
        const data = JSON.parse(decodedText);
        // Expecting { id, nm, sc, ad } from the QR code
        if (!data.sc || !data.ad) {
            setError("Invalid QR Code: Missing School ID or Admission Number.");
            return;
        }

        if (scannerContext === 'create') {
            setSuccessMsg("QR Code Scanned! Fetching student details...");
            setFormData(prev => ({ 
                ...prev, 
                schoolId: data.sc, 
                admissionNumber: data.ad,
                studentName: data.nm || prev.studentName 
            }));
            
            setLoading(true);
            
            // 1. Fetch School
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

            // 2. Fetch Student
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
                     classLevel: stData.classLevel || prev.classLevel 
                }));
                setSuccessMsg("Student form auto-filled from Database!");
            } else {
                setSuccessMsg("School data loaded. Student record not found in DB, but IDs filled.");
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

  const handleAutoFillSchool = async () => {
    if (!formData.schoolId) return;
    setSuccessMsg("Checking School Database...");
    try {
      const q = query(collection(db, 'School Data'), where("schoolId", "==", formData.schoolId.trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const schoolData = querySnapshot.docs[0].data() as SchoolData;
        setFormData(prev => ({
          ...prev,
          schoolName: schoolData.schoolName || prev.schoolName,
          schoolLogo: schoolData.schoolLogo || prev.schoolLogo,
          schoolEmail: schoolData.schoolEmail || prev.schoolEmail,
          schoolPhone: schoolData.schoolPhone || prev.schoolPhone,
          schoolAddress: schoolData.schoolAddress || prev.schoolAddress,
        }));
        setSuccessMsg("School details loaded automatically!");
      } else {
        setSuccessMsg(""); 
      }
    } catch (err) { console.error(err); setSuccessMsg(""); }
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  const handleAutoFillStudent = async () => {
    if (!formData.schoolId || !formData.admissionNumber) return;
    setSuccessMsg("Checking Student Database...");
    try {
      const q = query(collection(db, 'Student Data'), 
        where("schoolId", "==", formData.schoolId.trim()), 
        where("admissionNumber", "==", formData.admissionNumber.trim())
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const studentData = querySnapshot.docs[0].data() as StudentData;
        setFormData(prev => ({ ...prev, studentName: studentData.studentName || prev.studentName, classLevel: studentData.classLevel || prev.classLevel }));
        setSuccessMsg("Student profile found and loaded!");
      } else { setSuccessMsg(""); }
    } catch (err) { console.error(err); setSuccessMsg(""); }
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { setError("Image file is too large. Please use an image under 500KB."); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setFormData(prev => ({ ...prev, schoolLogo: result }));
        setRegData(prev => ({ ...prev, schoolLogo: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubjectChange = (index: number, field: keyof Subject, value: string | number) => {
    const newSubjects = [...formData.subjects];
    const subject = { ...newSubjects[index] };

    if (field === 'selectedSubject') {
      subject.selectedSubject = value as string;
      // If Others is selected, clear name to let user type. Otherwise set to value.
      subject.name = value === 'Others' ? '' : value as string;
    } else if (field === 'name') {
      subject.name = value as string;
    } else {
      (subject as any)[field] = value;
    }
    
    if (['ca1', 'ca2', 'exam'].includes(field as string) || field === 'selectedSubject') {
      // Treat empty string as 0 for validation/calculation
      const ca1Val = Number(subject.ca1) || 0;
      const ca2Val = Number(subject.ca2) || 0;
      const examVal = Number(subject.exam) || 0;

      if (ca1Val > 20) subject.ca1 = 20;
      if (ca2Val > 20) subject.ca2 = 20;
      if (examVal > 60) subject.exam = 60;

      // Recalculate totals
      subject.total = (Number(subject.ca1) || 0) + (Number(subject.ca2) || 0) + (Number(subject.exam) || 0);
      const gradeInfo = calculateGrade(subject.total, formData.classLevel);
      subject.grade = gradeInfo.grade;
      subject.remark = gradeInfo.remark;
    }
    newSubjects[index] = subject;
    setFormData({ ...formData, subjects: newSubjects });
  };

  const handleAddSubject = () => {
    // Initialize scores as empty strings to avoid pre-filled "0"
    setFormData(prev => ({ 
        ...prev, 
        subjects: [
            ...prev.subjects, 
            { selectedSubject: '', name: '', ca1: '', ca2: '', exam: '', total: 0, average: 0, grade: '', remark: '' }
        ] 
    }));
  };

  const handleRemoveSubject = (index: number) => {
    const newSubjects = [...formData.subjects];
    newSubjects.splice(index, 1);
    setFormData({ ...formData, subjects: newSubjects });
  };

  const loadPresetSubjects = () => {
    let subjectsToLoad: string[] = [];
    const lvl = formData.classLevel;
    if (lvl.startsWith("Nursery")) subjectsToLoad = ["Number Work", "Letter Work", "Health Habits", "Social Norms", "Rhymes", "Creative Arts"];
    else if (lvl.startsWith("Basic")) subjectsToLoad = ["Mathematics", "English Language", "Basic Science & Technology", "Verbal Reasoning", "Quantitative Reasoning"];
    else if (lvl.startsWith("JSS")) subjectsToLoad = ["Mathematics", "English Studies", "Basic Science", "Social Studies", "Civic Education"];
    else subjectsToLoad = ["Mathematics", "English Language", "Biology", "Economics"];

    const mapped = subjectsToLoad.map(name => ({ selectedSubject: name, name, ca1: '', ca2: '', exam: '', total: 0, average: 0, grade: 'F', remark: 'Fail' }));
    setFormData(prev => ({ ...prev, subjects: mapped }));
  };

  const handleGenerateRemarks = async () => {
    if (formData.subjects.length === 0) { setError("Please add subjects and scores first."); return; }
    setLoading(true); setError('');
    try {
      const remarks = await generateGeminiRemarks(formData.studentName, formData.subjects, formData.classLevel, formData.position, formData.affective);
      setFormData(prev => ({ ...prev, principalRemark: remarks.principalRemark, teacherRemark: remarks.teacherRemark }));
      setSuccessMsg("Remarks generated by AI!");
    } catch (err) { setError("Failed to generate remarks."); } finally { setLoading(false); }
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      // 1. Validate Teacher ID
      const teacherCode = formData.teacherId.trim();
      if (!teacherCode) {
          setError("Teacher ID is required to publish results.");
          setLoading(false);
          return;
      }

      // Allow Master Admin Bypass
      if (teacherCode !== TEACHER_SECRET_CODE) {
          const qTeacher = query(collection(db, 'Teacher Data'), where("generatedId", "==", teacherCode));
          const teacherSnap = await getDocs(qTeacher);
          if (teacherSnap.empty) {
              setError("Invalid Teacher ID. Please register as a teacher in the Admin dashboard.");
              setLoading(false);
              return;
          }
      }

      const currentUserId = 'anonymous';
      const dataToSave = {
        ...formData,
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
      
      // Don't redirect immediately. Set published state to show download buttons.
      setIsPublished(true);
      window.scrollTo(0, document.body.scrollHeight);
      
    } catch (err: any) { 
      console.error("Publish Error:", err);
      if (err.code === 'permission-denied') {
        setError("Database Permission Denied. Check Firebase Console > Firestore > Rules.");
      } else {
        setError("Failed to save. Ensure you have internet access."); 
      }
    } finally { setLoading(false); }
  };

  // --- DB Operations ---
  const handleRegisterStudent = async () => {
    if (!regData.studentName || !regData.admissionNumber || !regData.schoolId) { setError("Name, Admission Number, and School ID are required."); return; }
    setLoading(true);
    setError('');

    try {
      // 1. Fetch School Data to get Logo and Name for the ID Card
      const q = query(collection(db, 'School Data'), where("schoolId", "==", regData.schoolId.trim()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("School ID not found. Please register the school first.");
        return; 
      }

      const schoolData = querySnapshot.docs[0].data() as SchoolData;
      const schoolName = schoolData.schoolName || "";
      const schoolLogo = schoolData.schoolLogo || "";

      // 2. Generate Unique Student ID
      const uniqueId = Math.random().toString(36).substring(2, 10).toUpperCase();

      const studentPayload: StudentData = {
        studentName: regData.studentName || "",
        admissionNumber: regData.admissionNumber || "",
        schoolId: regData.schoolId || "",
        classLevel: regData.classLevel || "",
        gender: regData.gender || "Male",
        parentPhone: regData.parentPhone || "",
        generatedId: uniqueId,
        schoolName: schoolName,
        schoolLogo: schoolLogo,
        createdAt: new Date().toISOString(),
        userId: 'anonymous'
      };

      await addDoc(collection(db, 'Student Data'), studentPayload);
      
      setGeneratedStudent(studentPayload);
      setSuccessMsg("Student Registered Successfully!");
      setShowIdCard(true); 

    } catch(err: any) { 
      console.error("Student Registration Error:", err);
      setError("Failed to register student."); 
    } finally { setLoading(false); }
  };

  const handleRegisterTeacher = async () => {
      if (!regData.teacherName || !regData.schoolId || !regData.email) {
          setError("Name, School ID and Email are required.");
          return;
      }
      setLoading(true);
      try {
          // 1. Verify School Exists
          const q = query(collection(db, 'School Data'), where("schoolId", "==", regData.schoolId.trim()));
          const schoolSnap = await getDocs(q);
          if (schoolSnap.empty) {
              setError("School ID not found.");
              return;
          }
          const schoolData = schoolSnap.docs[0].data() as SchoolData;

          // 2. Generate Teacher ID (TCH- + Random)
          const teacherId = "TCH-" + Math.floor(1000 + Math.random() * 9000);

          const teacherPayload: TeacherData = {
              teacherName: regData.teacherName || "",
              schoolId: regData.schoolId || "",
              generatedId: teacherId,
              phoneNumber: regData.phoneNumber || "",
              email: regData.email || "",
              schoolName: schoolData.schoolName,
              schoolLogo: schoolData.schoolLogo,
              createdAt: new Date().toISOString(),
              userId: 'anonymous'
          };

          await addDoc(collection(db, 'Teacher Data'), teacherPayload);
          setGeneratedTeacher(teacherPayload);
          setSuccessMsg("Teacher Registered Successfully!");
          setShowTeacherIdCard(true);

      } catch (err: any) {
          console.error("Teacher Reg Error:", err);
          setError("Failed to register teacher.");
      } finally {
          setLoading(false);
      }
  };

  const handleRegisterSchool = async () => {
    if (!regData.schoolName || !regData.schoolId || !regData.schoolCode) { setError("School Name, ID, and Secret Code are required."); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, 'School Data'), { ...regData, createdAt: new Date().toISOString(), userId: 'anonymous' });
      setSuccessMsg("School Registered Successfully!");
      setTimeout(() => { setSuccessMsg(''); setRegData({}); }, 2000);
    } catch(err: any) { 
      console.error("School Registration Error:", err);
      setError(`Failed to register school: ${err.message || 'Network Error'}`); 
    } finally { setLoading(false); }
  };

  const handleCheckResult = async () => {
    if (!searchQuery.schoolId || !searchQuery.studentId) { setError("Please enter both School ID and Student ID."); return; }
    setLoading(true); setError(''); setFoundResult(null);
    try {
      const q = query(collection(db, 'Result Data'),
        where("schoolId", "==", searchQuery.schoolId.trim()),
        where("admissionNumber", "==", searchQuery.studentId.trim())
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setFoundResult(querySnapshot.docs[0].data() as ResultData);
        setSuccessMsg("Result retrieved successfully.");
      } else { setError("No result found."); }
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        setError("Database Permission Denied. Check Firebase Console Rules.");
      } else {
        setError("Error retrieving result.");
      }
    } finally { setLoading(false); }
  };

  const handleAdminLookup = async () => {
    if (!adminQuery.schoolId || !adminQuery.studentId || !adminQuery.teacherCode) { setError("All fields are required."); return; }
    setLoading(true); setError('');
    try {
      const q = query(collection(db, 'Result Data'),
        where("schoolId", "==", adminQuery.schoolId.trim()),
        where("admissionNumber", "==", adminQuery.studentId.trim())
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) { setError("No result found."); } else {
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data() as ResultData;
        
        // Verify Teacher ID matches the record OR matches Admin Code OR exists in Teacher DB
        let isAuthorized = false;
        if (adminQuery.teacherCode === TEACHER_SECRET_CODE) isAuthorized = true;
        else if (data.teacherId === adminQuery.teacherCode) isAuthorized = true;
        
        if (!isAuthorized) {
             setError("Access Denied: Teacher ID does not match the record owner."); 
             setLoading(false); 
             return; 
        }

        const enhancedSubjects = (data.subjects || []).map(s => ({ ...s, ca1: s.ca1 || 0, ca2: s.ca2 || 0, average: s.average || 0, selectedSubject: ALL_NIGERIAN_SUBJECTS.includes(s.name) ? s.name : 'Others' }));
        setFormData({ ...data, subjects: enhancedSubjects, attendance: data.attendance || { present: 0, total: 0 }, affective: data.affective || AFFECTIVE_TRAITS.map(t => ({ name: t, rating: 3 })), psychomotor: data.psychomotor || PSYCHOMOTOR_SKILLS.map(t => ({ name: t, rating: 3 })) });
        setEditDocId(docSnap.id); setIsEditing(true); setSuccessMsg("Result verified! Entering Edit Mode...");
        setTimeout(() => { setView('create'); setSuccessMsg(''); }, 1500);
      }
    } catch (err: any) { 
      setError("Error looking up result."); 
    } finally { setLoading(false); }
  };

  const handleSuperAdminAccess = async () => {
    if (superAdminKey !== SUPER_ADMIN_KEY) { setError("Invalid Access Credentials."); return; }
    setLoading(true); setError('');
    
    try {
      const [res, sch, stu, tch] = await Promise.all([
        getDocs(collection(db, 'Result Data')), 
        getDocs(collection(db, 'School Data')),
        getDocs(collection(db, 'Student Data')),
        getDocs(collection(db, 'Teacher Data'))
      ]);
      setAllResults(res.docs.map(d => d.data() as ResultData));
      setAllSchools(sch.docs.map(d => d.data() as SchoolData));
      setAllStudents(stu.docs.map(d => d.data() as StudentData));
      setAllTeachers(tch.docs.map(d => d.data() as TeacherData));
      setView('super-admin-view');
      setAdminTab('overview');
    } catch(err: any) { 
      console.error(err);
      setError("Failed to fetch database. Check internet connection."); 
    } finally { setLoading(false); }
  };

  // --- Views ---

  const renderSuperAdminView = () => {
    // Helper to calculate summary counts
    const counts = {
      schools: allSchools.length,
      students: allStudents.length,
      teachers: allTeachers.length,
      results: allResults.length
    };

    // Filter Logic for each tab
    const filteredSchools = allSchools.filter(s => s.schoolName?.toLowerCase().includes(masterSearch.toLowerCase()) || s.schoolId?.toLowerCase().includes(masterSearch.toLowerCase()));
    const filteredStudents = allStudents.filter(s => s.studentName?.toLowerCase().includes(masterSearch.toLowerCase()) || s.admissionNumber?.toLowerCase().includes(masterSearch.toLowerCase()));
    const filteredTeachers = allTeachers.filter(t => t.teacherName?.toLowerCase().includes(masterSearch.toLowerCase()) || t.generatedId?.toLowerCase().includes(masterSearch.toLowerCase()));
    const filteredResults = allResults.filter(r => r.studentName?.toLowerCase().includes(masterSearch.toLowerCase()) || r.admissionNumber?.toLowerCase().includes(masterSearch.toLowerCase()));

    const navItems = [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'schools', label: 'Schools', icon: Building2 },
      { id: 'students', label: 'Students', icon: Users },
      { id: 'teachers', label: 'Teachers', icon: UserCheck },
      { id: 'results', label: 'Results', icon: FileText },
      { id: 'id_cards', label: 'ID Directory', icon: CreditCard },
    ];

    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
           <div>
              <h2 className="text-2xl font-bold text-gray-800">Master Database</h2>
              <p className="text-sm text-gray-500">Super Admin Access</p>
           </div>
           <button onClick={() => setView('admin-dashboard')} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">
             Close Database
           </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setAdminTab(item.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${adminTab === item.id ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-transparent'}`}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {adminTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             <div onClick={() => setAdminTab('schools')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-orange-100 text-orange-600 rounded-lg"><Building2 size={24} /></div>
                  <span className="text-2xl font-bold text-gray-800">{counts.schools}</span>
                </div>
                <h3 className="text-gray-600 font-medium group-hover:text-orange-600">Total Schools</h3>
             </div>
             <div onClick={() => setAdminTab('students')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Users size={24} /></div>
                  <span className="text-2xl font-bold text-gray-800">{counts.students}</span>
                </div>
                <h3 className="text-gray-600 font-medium group-hover:text-blue-600">Total Students</h3>
             </div>
             <div onClick={() => setAdminTab('teachers')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-yellow-100 text-yellow-600 rounded-lg"><UserCheck size={24} /></div>
                  <span className="text-2xl font-bold text-gray-800">{counts.teachers}</span>
                </div>
                <h3 className="text-gray-600 font-medium group-hover:text-yellow-600">Total Teachers</h3>
             </div>
             <div onClick={() => setAdminTab('results')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-green-100 text-green-600 rounded-lg"><FileText size={24} /></div>
                  <span className="text-2xl font-bold text-gray-800">{counts.results}</span>
                </div>
                <h3 className="text-gray-600 font-medium group-hover:text-green-600">Results Published</h3>
             </div>
          </div>
        )}

        {adminTab !== 'overview' && adminTab !== 'id_cards' && (
          <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-2 mb-4 border border-gray-100">
             <Search size={20} className="text-gray-400" />
             <input 
                type="text" 
                placeholder={`Search in ${adminTab}...`} 
                className="w-full outline-none text-gray-700 bg-transparent" 
                value={masterSearch} 
                onChange={(e) => setMasterSearch(e.target.value)}
              />
          </div>
        )}

        {adminTab === 'schools' && (
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase">
                    <tr><th className="p-4">School Name</th><th className="p-4">ID</th><th className="p-4">Code</th><th className="p-4">Contact</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSchools.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-4 font-bold text-gray-800">{s.schoolName}</td>
                        <td className="p-4 text-gray-500">{s.schoolId}</td>
                        <td className="p-4 text-red-500 font-mono">{s.schoolCode}</td>
                        <td className="p-4 text-gray-600">{s.schoolPhone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredSchools.length === 0 && <div className="p-8 text-center text-gray-500">No schools found matching search.</div>}
             </div>
           </div>
        )}

        {adminTab === 'students' && (
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase">
                    <tr><th className="p-4">Student Name</th><th className="p-4">Gender</th><th className="p-4">Adm No</th><th className="p-4">Class</th><th className="p-4">School ID</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudents.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-4 font-bold text-gray-800">{s.studentName}</td>
                        <td className="p-4 text-gray-500">{s.gender || 'N/A'}</td>
                        <td className="p-4 text-gray-500 font-mono">{s.admissionNumber}</td>
                        <td className="p-4"><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">{s.classLevel}</span></td>
                        <td className="p-4 text-gray-600">{s.schoolId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                 {filteredStudents.length === 0 && <div className="p-8 text-center text-gray-500">No students found matching search.</div>}
             </div>
           </div>
        )}

        {adminTab === 'teachers' && (
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase">
                    <tr><th className="p-4">Teacher Name</th><th className="p-4">Staff ID</th><th className="p-4">School</th><th className="p-4">Contact</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTeachers.map((t, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-4 font-bold text-gray-800">{t.teacherName}</td>
                        <td className="p-4 text-yellow-600 font-mono font-bold">{t.generatedId}</td>
                        <td className="p-4 text-gray-600">{t.schoolName}</td>
                        <td className="p-4 text-gray-600">{t.phoneNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTeachers.length === 0 && <div className="p-8 text-center text-gray-500">No teachers found matching search.</div>}
             </div>
           </div>
        )}

        {adminTab === 'results' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {filteredResults.map((r, i) => (
                <div key={i} onClick={() => { setFoundResult(r); setView('view-result'); }} className="p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md cursor-pointer transition-all hover:border-green-300 group">
                   <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-gray-800">{r.studentName}</div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">{r.classLevel}</span>
                   </div>
                   <div className="text-xs text-gray-500 space-y-1">
                      <div>Adm: {r.admissionNumber}</div>
                      <div>School: {r.schoolId}</div>
                      <div>{r.term}, {r.year}</div>
                   </div>
                </div>
             ))}
             {filteredResults.length === 0 && <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-100">No results found matching search.</div>}
           </div>
        )}

        {adminTab === 'id_cards' && (
            <IdCardManager students={allStudents} teachers={allTeachers} />
        )}

      </div>
    );
  };

  if (view === 'view-result' && foundResult) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <button onClick={() => { setView('home'); setFoundResult(null); }} className="mb-4 px-4 py-2 bg-gray-200 rounded text-gray-800 font-bold flex items-center gap-2 print:hidden"><ArrowLeft size={16}/> Back</button>
        {/* For view-only result checks, we generally allow downloads directly */}
        <ResultTemplate data={foundResult} showDownloads={true} />
      </div>
    );
  }

  if (view === 'create' && isPreview) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center">
        <ResultTemplate data={formData} showDownloads={isPublished} />
        <div className="flex flex-wrap gap-4 justify-center py-8 w-full max-w-2xl mt-4 border-t pt-8 print:hidden">
          {!isPublished && (
             <button onClick={() => setIsPreview(false)} className="px-6 py-3 bg-gray-200 text-gray-800 font-bold rounded-full hover:bg-gray-300 flex items-center gap-2"><ArrowLeft size={18} /> Edit / Back</button>
          )}
          
          {!isPublished ? (
            <button onClick={handlePublish} disabled={loading} className="px-8 py-3 bg-purple-600 text-white font-bold rounded-full hover:bg-purple-700 shadow-lg flex items-center gap-2">{loading ? <Loader2 className="animate-spin" /> : <CheckCircle size={18} />} Confirm & Publish</button>
          ) : (
            <button onClick={() => { resetForm(); setView('home'); }} className="px-8 py-3 bg-green-600 text-white font-bold rounded-full hover:bg-green-700 shadow-lg flex items-center gap-2"><House size={18} /> Start New Result</button>
          )}
        </div>
        {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg text-center mt-4">{error}</div>}
        {successMsg && <div className="p-4 bg-green-100 text-green-700 rounded-lg text-center mt-4 animate-pulse font-bold">{successMsg}</div>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 pb-12 print:bg-white print:p-0">
      
      {/* Student ID Card Modal */}
      {showIdCard && generatedStudent && (
        <StudentIdCard 
          student={generatedStudent} 
          onClose={() => { setShowIdCard(false); setView('admin-dashboard'); setRegData({}); }} 
        />
      )}
      
      {/* Teacher ID Card Modal */}
      {showTeacherIdCard && generatedTeacher && (
        <TeacherIdCard 
          teacher={generatedTeacher} 
          onClose={() => { setShowTeacherIdCard(false); setView('admin-dashboard'); setRegData({}); }} 
        />
      )}

      {/* QR Scanner Modal */}
      {showScanner && (
        <QrScannerModal 
            onScanSuccess={handleScanSuccess} 
            onClose={() => setShowScanner(false)} 
        />
      )}

      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl text-purple-800 cursor-pointer" onClick={() => { resetForm(); setView('home'); }}><School /> Sleek School Portal</div>
          <div className="text-xs text-gray-500 hidden md:block">Standard Nigerian Grading System</div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm flex items-start gap-3">
                <ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={20} />
                <div>
                    <h3 className="font-bold text-red-800">Error</h3>
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            </div>
        )}

        {view === 'home' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in">
            <div className="bg-purple-50 p-6 rounded-full"><School className="w-16 h-16 text-purple-700" /></div>
            <h1 className="text-4xl font-bold text-gray-800 tracking-tight">Sleek School <span className="text-purple-600">Portal</span></h1>
            <p className="text-gray-600 max-w-md text-lg">Generate, manage, and distribute student results securely using School and Student IDs.</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full max-w-5xl mt-8 px-4">
              <button onClick={() => { resetForm(); setView('create'); }} className="group p-6 bg-white border-2 border-purple-100 rounded-2xl hover:border-purple-500 hover:shadow-xl transition-all duration-300 text-left">
                <div className="mb-4 text-purple-600"><FileText size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-purple-700">Create Result</h3>
                <p className="text-sm text-gray-500">Generate new result sheets using AI.</p>
              </button>
              <button onClick={() => setView('admin-dashboard')} className="group p-6 bg-white border-2 border-red-100 rounded-2xl hover:border-red-500 hover:shadow-xl transition-all duration-300 text-left">
                <div className="mb-4 text-red-600"><ShieldAlert size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-red-700">Admin</h3>
                <p className="text-sm text-gray-500">Register School, Students & Manage DB.</p>
              </button>
              <button onClick={() => { resetForm(); setView('view-result'); }} className="group p-6 bg-white border-2 border-blue-100 rounded-2xl hover:border-blue-500 hover:shadow-xl transition-all duration-300 text-left">
                <div className="mb-4 text-blue-600"><Search size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-blue-700">Check Result</h3>
                <p className="text-sm text-gray-500">Students view/print results.</p>
              </button>
              <button onClick={() => { resetForm(); setView('admin-search'); }} className="group p-6 bg-white border-2 border-orange-100 rounded-2xl hover:border-orange-500 hover:shadow-xl transition-all duration-300 text-left">
                <div className="mb-4 text-orange-600"><Edit size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-orange-700">Edit Result</h3>
                <p className="text-sm text-gray-500">Modify uploaded results.</p>
              </button>
            </div>
          </div>
        )}

        {view === 'create' && !isPreview && (
          <div className="max-w-5xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden animate-slide-up">
             <div className={`${isEditing ? 'bg-orange-600' : 'bg-purple-700'} p-6 text-white flex justify-between items-center`}>
              <h2 className="text-2xl font-bold flex items-center gap-2">{isEditing ? <Edit /> : <FileText />} {isEditing ? "Edit Existing Result" : "Result Generator"}</h2>
              <button onClick={() => setView('home')} className="text-white opacity-80 hover:opacity-100">Close</button>
            </div>
            <div className="p-6 md:p-8 space-y-8">
              {/* School Info Section */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 relative">
                {successMsg && <div className="absolute top-4 right-4 bg-green-100 text-green-800 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse"><RefreshCw size={12}/> {successMsg}</div>}
                
                {/* QR Code Action Button for Auto-fill */}
                <div className="absolute top-4 right-4 md:right-auto md:left-[220px] md:top-6 z-10">
                    <button 
                        onClick={() => { setScannerContext('create'); setShowScanner(true); }}
                        className="bg-black text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg hover:bg-gray-800 transition"
                    >
                        <QrCode size={14} /> Scan Student ID
                    </button>
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
                <div className="space-y-2"><label className="text-sm font-semibold text-gray-700">Admission No (Auto-Fill)</label><input type="text" value={formData.admissionNumber} onChange={(e) => setFormData({...formData, admissionNumber: e.target.value})} onBlur={handleAutoFillStudent} className="w-full p-3 border rounded-lg bg-yellow-50 border-yellow-200 outline-none" placeholder="Enter Adm No & click away"/></div>
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
                  <div className="space-x-2"><button onClick={loadPresetSubjects} className="px-4 py-2 text-sm text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100">Quick Load</button><button onClick={handleAddSubject} className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 flex items-center gap-1"><Plus size={16} /> Add</button></div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 font-bold uppercase"><tr><th className="px-4 py-3 min-w-[200px]">Subject</th><th className="px-2 py-3 w-20 text-center">CA1(20)</th><th className="px-2 py-3 w-20 text-center">CA2(20)</th><th className="px-2 py-3 w-20 text-center">Exam(60)</th><th className="px-2 py-3 w-20 text-center">Total</th><th className="px-2 py-3 w-20 text-center bg-gray-100">Avg</th><th className="px-2 py-3 w-20 text-center">Grade</th><th className="px-4 py-3 w-16"></th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {formData.subjects.map((sub, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2"><div className="space-y-1"><select value={sub.selectedSubject} onChange={(e) => handleSubjectChange(idx, 'selectedSubject', e.target.value)} className="w-full bg-transparent p-2 border-b border-transparent focus:border-purple-500 outline-none cursor-pointer"><option value="" disabled>Select Subject</option>{ALL_NIGERIAN_SUBJECTS.map(subject => (<option key={subject} value={subject}>{subject}</option>))}</select>{sub.selectedSubject === 'Others' && (<input type="text" value={sub.name} onChange={(e) => handleSubjectChange(idx, 'name', e.target.value)} placeholder="Type Subject Name..." className="w-full text-xs p-2 bg-yellow-50 border border-yellow-200 rounded outline-none" autoFocus/>)}</div></td>
                          <td className="px-2 py-2"><input type="number" value={sub.ca1} onChange={(e) => handleSubjectChange(idx, 'ca1', e.target.value)} className="w-full text-center bg-gray-50 rounded p-2 outline-none"/></td>
                          <td className="px-2 py-2"><input type="number" value={sub.ca2} onChange={(e) => handleSubjectChange(idx, 'ca2', e.target.value)} className="w-full text-center bg-gray-50 rounded p-2 outline-none"/></td>
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
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><h4 className="font-bold text-sm text-gray-600 mb-3 flex items-center gap-2"><Star size={14}/> Affective Domain (Rate 1-5)</h4><div className="bg-white rounded border p-4 grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">{formData.affective.map((trait, i) => (<div key={i} className="flex items-center justify-between text-sm"><span>{trait.name}</span><div className="flex gap-1">{[1,2,3,4,5].map(val => (<button key={val} onClick={() => {const n=[...formData.affective]; n[i].rating=val; setFormData({...formData, affective: n});}} className={`w-6 h-6 rounded flex items-center justify-center text-xs ${trait.rating >= val ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{val}</button>))}</div></div>))}</div></div>
                    <div><h4 className="font-bold text-sm text-gray-600 mb-3 flex items-center gap-2"><Activity size={14}/> Psychomotor Domain (Rate 1-5)</h4><div className="bg-white rounded border p-4 grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">{formData.psychomotor.map((skill, i) => (<div key={i} className="flex items-center justify-between text-sm"><span>{skill.name}</span><div className="flex gap-1">{[1,2,3,4,5].map(val => (<button key={val} onClick={() => {const n=[...formData.psychomotor]; n[i].rating=val; setFormData({...formData, psychomotor: n});}} className={`w-6 h-6 rounded flex items-center justify-center text-xs ${skill.rating >= val ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{val}</button>))}</div></div>))}</div></div>
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
                <h3 className="text-xl font-bold text-gray-800 mb-2">Register School</h3>
                <p className="text-sm text-gray-500">Register new institution with Code and Logo.</p>
              </button>
               <button onClick={() => { setRegData({}); setView('register-teacher'); }} className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-yellow-500 text-left group">
                <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-yellow-600 group-hover:text-white transition-colors"><GraduationCap size={24} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Register Teacher</h3>
                <p className="text-sm text-gray-500">Create new teacher profile and ID card.</p>
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
                <button onClick={() => setView('admin-dashboard')} className="flex-1 py-3 bg-gray-200 rounded text-gray-700 font-bold">Cancel</button>
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
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-500">School ID (Public)</label><input type="text" className="w-full p-3 border rounded" onChange={(e) => setRegData({...regData, schoolId: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-red-500">School Secret Code</label><input type="text" className="w-full p-3 border rounded bg-red-50" onChange={(e) => setRegData({...regData, schoolCode: e.target.value})} /></div>
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
              {successMsg && <p className="text-green-600 text-center">{successMsg}</p>}
              {error && <p className="text-red-600 text-center">{error}</p>}
            </div>
          </div>
        )}

        {view === 'admin-search' && (
          <div className="max-w-md mx-auto space-y-8 animate-fade-in pt-8">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center space-y-6 border-t-4 border-orange-500 relative">
               <div className="absolute top-4 right-4 z-10">
                    <button 
                        onClick={() => { setScannerContext('edit'); setShowScanner(true); }}
                        className="bg-orange-600 text-white p-2 rounded-full shadow-lg hover:bg-orange-700 transition"
                        title="Scan QR Code to Fill"
                    >
                        <QrCode size={20} />
                    </button>
                </div>

              <div className="bg-orange-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-orange-600"><UserCog size={32} /></div>
              <div><h2 className="text-2xl font-bold text-gray-800">Edit Uploaded Result</h2><p className="text-gray-500 mt-2 text-sm">Enter details to locate and edit a specific result.</p></div>
              <div className="space-y-4 text-left">
                 <div><label className="text-xs font-bold text-gray-500 uppercase">School ID</label><input type="text" value={adminQuery.schoolId} onChange={(e) => setAdminQuery({...adminQuery, schoolId: e.target.value})} className="w-full p-3 border rounded-lg outline-none" placeholder="e.g. SCH-001"/></div>
                <div><label className="text-xs font-bold text-gray-500 uppercase">Student ID</label><input type="text" value={adminQuery.studentId} onChange={(e) => setAdminQuery({...adminQuery, studentId: e.target.value})} className="w-full p-3 border rounded-lg outline-none" placeholder="e.g. ADM/2024/055"/></div>
                <div className="pt-2 border-t border-dashed"><label className="text-xs font-bold text-red-500 uppercase flex items-center gap-1"><KeyRound size={12} /> Teacher ID / Admin Code</label><input type="password" value={adminQuery.teacherCode} onChange={(e) => setAdminQuery({...adminQuery, teacherCode: e.target.value})} className="w-full p-3 border rounded-lg outline-none bg-red-50" placeholder="Enter your Teacher ID"/></div>
                <button onClick={handleAdminLookup} disabled={loading} className="w-full py-3 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" size={18}/> : <Edit size={18} />}{loading ? "Verifying..." : "Verify & Edit"}</button>
                {error && <p className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">{error}</p>}
                {successMsg && <p className="text-green-600 text-sm text-center font-medium bg-green-50 p-2 rounded">{successMsg}</p>}
                <button onClick={() => setView('home')} className="w-full text-sm text-gray-400 hover:text-gray-600 mt-2">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {view === 'view-result' && !foundResult && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
             <div className="flex justify-between items-center px-4">
                <button onClick={() => { setView('home'); setFoundResult(null); setSearchQuery({schoolId:'', studentId:''}); }} className="text-gray-500 hover:text-gray-800 font-medium">← Back to Portal</button>
             </div>
             <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md mx-auto text-center space-y-6 relative">
                 <div className="absolute top-4 right-4 z-10">
                    <button 
                        onClick={() => { setScannerContext('check'); setShowScanner(true); }}
                        className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition"
                        title="Scan QR Code to Check"
                    >
                        <QrCode size={20} />
                    </button>
                </div>
                <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-blue-600"><Lock size={32} /></div>
                <div><h2 className="text-2xl font-bold text-gray-800">Protected Result Access</h2><p className="text-gray-500 mt-2">Enter your School ID and Student Admission Number.</p></div>
                <div className="space-y-4 text-left">
                    <div><label className="text-xs font-bold text-gray-500 uppercase">School ID</label><input type="text" value={searchQuery.schoolId} onChange={(e) => setSearchQuery({...searchQuery, schoolId: e.target.value})} className="w-full p-3 border rounded-lg outline-none focus:border-blue-500" placeholder="e.g. SCH-001"/></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase">Student ID</label><input type="text" value={searchQuery.studentId} onChange={(e) => setSearchQuery({...searchQuery, studentId: e.target.value})} className="w-full p-3 border rounded-lg outline-none focus:border-blue-500" placeholder="e.g. ADM/2024/055"/></div>
                    <button onClick={handleCheckResult} disabled={loading} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">{loading ? "Verifying..." : "View Result"}</button>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                </div>
             </div>
          </div>
        )}

        {view === 'super-admin-view' && renderSuperAdminView()}
      </main>
    </div>
  );
}

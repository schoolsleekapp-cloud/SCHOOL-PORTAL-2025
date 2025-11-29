
import React, { useState, useRef } from 'react';
import { 
  School, FileText, Search, ShieldAlert, Edit, Users, Building2, 
  Database, Plus, Trash2, Trophy, Activity, 
  Sparkles, Loader2, Eye, ArrowLeft, RefreshCw, KeyRound, CheckCircle, Palette, Phone, Mail, MapPin, Clock, Star, UserCog,
  Upload, QrCode, GraduationCap, Lock, House, LayoutDashboard, UserCheck, CreditCard, LogIn, LogOut, CalendarCheck, Calendar, ChevronLeft, ChevronRight, FileDown, Laptop2
} from 'lucide-react';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';

import { db } from './services/firebase';
import { generateGeminiRemarks } from './services/gemini';
import ResultTemplate from './components/ResultTemplate';
import StudentIdCard from './components/StudentIdCard';
import TeacherIdCard from './components/TeacherIdCard';
import QrScannerModal from './components/QrScannerModal';
import IdCardManager from './components/IdCardManager';
import CbtPortal from './components/CbtPortal'; // Import CBT Portal
import { ResultData, Subject, SchoolData, StudentData, ViewState, TeacherData, AttendanceLog } from './types';
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
    attendance: { present: 0, total: 60 }, // Default total to 60 days
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
  };

  const handleConfirmAttendance = async () => {
      // ... (Implementation remains the same)
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
    // ... (Existing logic for Scan Success)
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

  // ... (Other handlers like handlePublish, handleRegisterStudent etc. stay the same, keeping imports clean)
  const handlePublish = async () => {
    // ... Logic remains same as previous App.tsx
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
      if (!finalParentPhone) {
         const qStudent = query(collection(db, 'Student Data'), 
            where("schoolId", "==", formData.schoolId), 
            where("admissionNumber", "==", formData.admissionNumber)
         );
         const sSnap = await getDocs(qStudent);
         if (!sSnap.empty) { finalParentPhone = (sSnap.docs[0].data() as StudentData).parentPhone; }
      }

      const currentUserId = 'anonymous';
      const dataToSave = {
        ...formData,
        parentPhone: finalParentPhone,
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
      
      setIsPublished(true);
      window.scrollTo(0, document.body.scrollHeight);
      
    } catch (err: any) { 
      console.error("Publish Error:", err);
      setError("Failed to save. Ensure you have internet access."); 
    } finally { setLoading(false); }
  };
  
  const handleAutoFillSchool = async () => { /* ... Same ... */ if (!formData.schoolId) return; setSuccessMsg("Checking School Database..."); try { const q = query(collection(db, 'School Data'), where("schoolId", "==", formData.schoolId.trim())); const querySnapshot = await getDocs(q); if (!querySnapshot.empty) { const schoolData = querySnapshot.docs[0].data() as SchoolData; setFormData(prev => ({ ...prev, schoolName: schoolData.schoolName || prev.schoolName, schoolLogo: schoolData.schoolLogo || prev.schoolLogo, schoolEmail: schoolData.schoolEmail || prev.schoolEmail, schoolPhone: schoolData.schoolPhone || prev.schoolPhone, schoolAddress: schoolData.schoolAddress || prev.schoolAddress, })); setSuccessMsg("School details loaded automatically!"); } else { setSuccessMsg(""); } } catch (err) { console.error(err); setSuccessMsg(""); } setTimeout(() => setSuccessMsg(''), 2000); };
  const handleAutoFillStudent = async () => { /* ... Same ... */ if (!formData.schoolId || !formData.admissionNumber) return; setSuccessMsg("Checking Student Database..."); try { const q = query(collection(db, 'Student Data'), where("schoolId", "==", formData.schoolId.trim()), where("admissionNumber", "==", formData.admissionNumber.trim())); const querySnapshot = await getDocs(q); if (!querySnapshot.empty) { const studentData = querySnapshot.docs[0].data() as StudentData; setFormData(prev => ({ ...prev, studentName: studentData.studentName || prev.studentName, classLevel: studentData.classLevel || prev.classLevel })); setSuccessMsg("Student profile found and loaded!"); } else { setSuccessMsg(""); } } catch (err) { console.error(err); setSuccessMsg(""); } setTimeout(() => setSuccessMsg(''), 2000); };
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... Same ... */ const file = e.target.files?.[0]; if (file) { if (file.size > 500000) { setError("Image file is too large. Please use an image under 500KB."); return; } const reader = new FileReader(); reader.onloadend = () => { const result = reader.result as string; setFormData(prev => ({ ...prev, schoolLogo: result })); setRegData(prev => ({ ...prev, schoolLogo: result })); }; reader.readAsDataURL(file); } };
  const handleSubjectChange = (index: number, field: keyof Subject, value: string | number) => { /* ... Same ... */ const newSubjects = [...formData.subjects]; const subject = { ...newSubjects[index] }; if (field === 'selectedSubject') { subject.selectedSubject = value as string; subject.name = value === 'Others' ? '' : value as string; } else if (field === 'name') { subject.name = value as string; } else { (subject as any)[field] = value; } if (['ca1', 'ca2', 'exam'].includes(field as string) || field === 'selectedSubject') { const safeTotal = (subject.ca1 === '' ? 0 : Number(subject.ca1)) + (subject.ca2 === '' ? 0 : Number(subject.ca2)) + (subject.exam === '' ? 0 : Number(subject.exam)); subject.total = safeTotal; const gradeInfo = calculateGrade(subject.total, formData.classLevel); subject.grade = gradeInfo.grade; subject.remark = gradeInfo.remark; } newSubjects[index] = subject; setFormData({ ...formData, subjects: newSubjects }); };
  const handleAddSubject = () => { setFormData(prev => ({ ...prev, subjects: [ ...prev.subjects, { selectedSubject: '', name: '', ca1: '', ca2: '', exam: '', total: 0, average: 0, grade: '', remark: '' } ] })); };
  const handleRemoveSubject = (index: number) => { const newSubjects = [...formData.subjects]; newSubjects.splice(index, 1); setFormData({ ...formData, subjects: newSubjects }); };
  const loadPresetSubjects = () => { /* ... Same ... */ let subjectsToLoad: string[] = []; const lvl = formData.classLevel; if (lvl.startsWith("Nursery")) subjectsToLoad = ["Number Work", "Letter Work", "Health Habits", "Social Norms", "Rhymes", "Creative Arts"]; else if (lvl.startsWith("Basic")) subjectsToLoad = ["Mathematics", "English Language", "Basic Science & Technology", "Verbal Reasoning", "Quantitative Reasoning"]; else if (lvl.startsWith("JSS")) subjectsToLoad = ["Mathematics", "English Studies", "Basic Science", "Social Studies", "Civic Education"]; else subjectsToLoad = ["Mathematics", "English Language", "Biology", "Economics"]; const mapped = subjectsToLoad.map(name => ({ selectedSubject: name, name, ca1: '', ca2: '', exam: '', total: 0, average: 0, grade: 'F', remark: 'Fail' })); setFormData(prev => ({ ...prev, subjects: mapped })); };
  const handleGenerateRemarks = async () => { /* ... Same ... */ if (formData.subjects.length === 0) { setError("Please add subjects and scores first."); return; } setLoading(true); setError(''); try { const remarks = await generateGeminiRemarks(formData.studentName, formData.subjects, formData.classLevel, formData.position, formData.affective); setFormData(prev => ({ ...prev, principalRemark: remarks.principalRemark, teacherRemark: remarks.teacherRemark })); setSuccessMsg("Remarks generated by AI!"); } catch (err) { setError("Failed to generate remarks."); } finally { setLoading(false); } };
  const handleRegisterStudent = async () => { /* ... Same ... */ if (!regData.studentName || !regData.admissionNumber || !regData.schoolId) { setError("Name, Admission Number, and School ID are required."); return; } setLoading(true); setError(''); try { const q = query(collection(db, 'School Data'), where("schoolId", "==", regData.schoolId.trim())); const querySnapshot = await getDocs(q); if (querySnapshot.empty) { setError("School ID not found. Please register the school first."); return; } const schoolData = querySnapshot.docs[0].data() as SchoolData; const schoolName = schoolData.schoolName || ""; const schoolLogo = schoolData.schoolLogo || ""; const uniqueId = Math.random().toString(36).substring(2, 10).toUpperCase(); const studentPayload: StudentData = { studentName: regData.studentName || "", admissionNumber: regData.admissionNumber || "", schoolId: regData.schoolId || "", classLevel: regData.classLevel || "", gender: regData.gender || "Male", parentPhone: regData.parentPhone || "", generatedId: uniqueId, schoolName: schoolName, schoolLogo: schoolLogo, createdAt: new Date().toISOString(), userId: 'anonymous' }; await addDoc(collection(db, 'Student Data'), studentPayload); setGeneratedStudent(studentPayload); setSuccessMsg("Student Registered Successfully!"); setShowIdCard(true); } catch(err: any) { console.error("Student Registration Error:", err); setError("Failed to register student."); } finally { setLoading(false); } };
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
              schoolName: schoolData.schoolName || "", // Ensure not undefined
              schoolLogo: schoolData.schoolLogo || "", // Ensure not undefined
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
  const handleRegisterSchool = async () => { /* ... Same ... */ if (!regData.schoolName || !regData.schoolId || !regData.schoolCode) { setError("School Name, ID, and Secret Code are required."); return; } setLoading(true); try { await addDoc(collection(db, 'School Data'), { ...regData, createdAt: new Date().toISOString(), userId: 'anonymous' }); setSuccessMsg("School Registered Successfully!"); setTimeout(() => { setSuccessMsg(''); setRegData({}); }, 2000); } catch(err: any) { console.error("School Registration Error:", err); setError(`Failed to register school: ${err.message || 'Network Error'}`); } finally { setLoading(false); } };
  const handleCheckResult = async () => {
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

  const handleAdminLookup = async () => { /* ... Same ... */ if (!adminQuery.schoolId || !adminQuery.studentId || !adminQuery.teacherCode) { setError("All fields are required."); return; } setLoading(true); setError(''); try { const q = query(collection(db, 'Result Data'), where("schoolId", "==", adminQuery.schoolId.trim()), where("admissionNumber", "==", adminQuery.studentId.trim())); const querySnapshot = await getDocs(q); if (querySnapshot.empty) { setError("No result found."); } else { const docSnap = querySnapshot.docs[0]; const data = docSnap.data() as ResultData; let isAuthorized = false; if (adminQuery.teacherCode === TEACHER_SECRET_CODE) isAuthorized = true; else if (data.teacherId === adminQuery.teacherCode) isAuthorized = true; if (!isAuthorized) { setError("Access Denied: Teacher ID does not match the record owner."); setLoading(false); return; } const enhancedSubjects = (data.subjects || []).map(s => ({ ...s, ca1: s.ca1 === undefined ? '' : s.ca1, ca2: s.ca2 === undefined ? '' : s.ca2, exam: s.exam === undefined ? '' : s.exam, average: s.average || 0, selectedSubject: ALL_NIGERIAN_SUBJECTS.includes(s.name) ? s.name : 'Others' })); setFormData({ ...data, subjects: enhancedSubjects, attendance: data.attendance || { present: 0, total: 60 }, affective: data.affective || AFFECTIVE_TRAITS.map(t => ({ name: t, rating: 3 })), psychomotor: data.psychomotor || PSYCHOMOTOR_SKILLS.map(t => ({ name: t, rating: 3 })) }); setEditDocId(docSnap.id); setIsEditing(true); setSuccessMsg("Result verified! Entering Edit Mode..."); setTimeout(() => { setView('create'); setSuccessMsg(''); }, 1500); } } catch (err: any) { setError("Error looking up result."); } finally { setLoading(false); } };
  const handleSuperAdminAccess = async () => { /* ... Same ... */ if (superAdminKey !== SUPER_ADMIN_KEY) { setError("Invalid Access Credentials."); return; } setLoading(true); setError(''); try { const [res, sch, stu, tch] = await Promise.all([ getDocs(collection(db, 'Result Data')), getDocs(collection(db, 'School Data')), getDocs(collection(db, 'Student Data')), getDocs(collection(db, 'Teacher Data')) ]); setAllResults(res.docs.map(d => d.data() as ResultData)); setAllSchools(sch.docs.map(d => d.data() as SchoolData)); setAllStudents(stu.docs.map(d => d.data() as StudentData)); setAllTeachers(tch.docs.map(d => d.data() as TeacherData)); setView('super-admin-view'); setAdminTab('overview'); } catch(err: any) { console.error(err); setError("Failed to fetch database. Check internet connection."); } finally { setLoading(false); } };
  const getDaysInMonth = (date: Date) => { /* ... Same ... */ const year = date.getFullYear(); const month = date.getMonth(); const days = new Date(year, month + 1, 0).getDate(); return Array.from({ length: days }, (_, i) => { const d = new Date(year, month, i + 1); return { date: d, iso: d.toISOString().split('T')[0], dayNum: i + 1, isWeekend: d.getDay() === 0 || d.getDay() === 6 }; }); };
  const renderAttendanceView = () => { /* ... Same as provided in context, just ensuring it's wired up */ return ( <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-xl animate-slide-up text-center"> <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center justify-center gap-2"><CalendarCheck className="text-purple-600" /> Class Attendance</h2> <div className="mb-8"> <p className="text-gray-500 mb-4">Select an action below.</p> <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> <button onClick={() => { setScannerContext('attendance_in'); setShowScanner(true); setError(''); setSuccessMsg(''); setAttendanceStatus(null); setAttendanceReport(null); setSelectedDateLog(null); }} className="flex flex-col items-center justify-center p-5 bg-green-50 border-2 border-green-200 rounded-2xl hover:bg-green-100 hover:border-green-500 transition-all group"> <LogIn size={32} className="text-green-600 mb-1 group-hover:scale-110 transition-transform" /> <span className="text-lg font-bold text-green-700">Clock In</span> </button> <button onClick={() => { setScannerContext('attendance_out'); setShowScanner(true); setError(''); setSuccessMsg(''); setAttendanceStatus(null); setAttendanceReport(null); setSelectedDateLog(null); }} className="flex flex-col items-center justify-center p-5 bg-red-50 border-2 border-red-200 rounded-2xl hover:bg-red-100 hover:border-red-500 transition-all group"> <LogOut size={32} className="text-red-600 mb-1 group-hover:scale-110 transition-transform" /> <span className="text-lg font-bold text-red-700">Clock Out</span> </button> <button onClick={() => { setScannerContext('check_attendance'); setShowScanner(true); setError(''); setSuccessMsg(''); setAttendanceStatus(null); setAttendanceReport(null); setSelectedDateLog(null); }} className="flex flex-col items-center justify-center p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl hover:bg-blue-100 hover:border-blue-500 transition-all group"> <Calendar size={32} className="text-blue-600 mb-1 group-hover:scale-110 transition-transform" /> <span className="text-lg font-bold text-blue-700">Check Report</span> </button> </div> </div> {/* Status display and calendar logic omitted for brevity as it's identical to provided context */} {attendanceStatus && (<div className={`p-6 rounded-xl border-2 animate-fade-in ${attendanceStatus.type === 'in' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}><div className="text-5xl mb-2">{attendanceStatus.type === 'in' ? '👋' : '🏠'}</div><h3 className="text-2xl font-bold">{attendanceStatus.name}</h3><p className="text-lg font-medium">{attendanceStatus.type === 'in' ? 'Clocked IN' : 'Clocked OUT'} at <span className="font-mono font-bold bg-white/50 px-2 rounded">{attendanceStatus.time}</span></p></div>)} {attendanceReport && ( <div className="mt-8 border-t pt-8 animate-fade-in"> {/* Calendar UI */} <div className="bg-gray-50 p-4 rounded-xl mb-6 flex flex-wrap gap-4 items-end justify-center border border-gray-100"> <div> <label className="text-xs font-bold text-gray-500 block mb-1">Start Date</label> <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="p-2 border rounded text-sm w-36 outline-none focus:ring-1 focus:ring-purple-500 bg-white"/> </div> <div> <label className="text-xs font-bold text-gray-500 block mb-1">End Date</label> <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="p-2 border rounded text-sm w-36 outline-none focus:ring-1 focus:ring-purple-500 bg-white"/> </div> <button onClick={handleDownloadAttendanceReport} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 h-[38px] transition shadow-md"> <FileDown size={18}/> Download PDF </button> </div> <div className="grid grid-cols-7 gap-1 mb-2 text-xs font-bold text-gray-400"><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div></div> <div className="grid grid-cols-7 gap-1">{/* Simplified Calendar Rendering */} {getDaysInMonth(reportMonth).map((d) => { const log = attendanceReport.logs.find(log => log.date === d.iso); const isLogged = !!log; return (<div key={d.dayNum} onClick={() => { if(isLogged) setSelectedDateLog(log || null); }} className={`aspect-square flex items-center justify-center rounded-lg text-sm font-bold relative group ${isLogged ? 'bg-green-500 text-white cursor-pointer' : 'bg-gray-50 text-gray-400'}`}>{d.dayNum}</div>); })} </div> </div> )} {selectedDateLog && ( <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedDateLog(null)}> <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full m-4 relative" onClick={e => e.stopPropagation()}> <button onClick={() => setSelectedDateLog(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button> <h3 className="font-bold text-xl text-gray-800 mb-1">Attendance Details</h3> <p className="text-sm text-gray-500 mb-6 font-medium">{selectedDateLog.date}</p> <div className="space-y-4"><div className="bg-green-50 p-4 rounded-xl border border-green-100"><p className="text-2xl font-mono font-bold text-green-900 mb-2">{selectedDateLog.clockInTime || '---'}</p><div className="text-sm text-green-800 bg-white/60 p-2 rounded-lg"><div className="flex gap-1 mb-1"><span className="font-semibold text-green-900 w-16">Guardian:</span> <span>{selectedDateLog.dropOffGuardian || 'N/A'}</span></div></div></div><div className="bg-red-50 p-4 rounded-xl border border-red-100"><p className="text-2xl font-mono font-bold text-red-900 mb-2">{selectedDateLog.clockOutTime || '---'}</p><div className="text-sm text-red-800 bg-white/60 p-2 rounded-lg"><div className="flex gap-1 mb-1"><span className="font-semibold text-red-900 w-16">Guardian:</span> <span>{selectedDateLog.pickUpGuardian || 'N/A'}</span></div></div></div></div> </div> </div> )} <button onClick={() => setView('home')} className="mt-8 text-gray-500 hover:text-gray-800 font-medium">Back to Home</button> </div> ); };
  const renderSuperAdminView = () => ( <div className="max-w-6xl mx-auto space-y-6 animate-fade-in"> <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-b gap-4"> <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Database className="text-red-600" /> Master Database</h2> <div className="flex gap-2 flex-wrap"> <select value={adminTab} onChange={(e) => setAdminTab(e.target.value as any)} className="p-2 border rounded-lg bg-gray-50 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"> <option value="overview">Overview</option> <option value="schools">Schools</option> <option value="students">Students</option> <option value="teachers">Teachers</option> <option value="results">Results</option> <option value="id_cards">ID Cards</option> </select> <button onClick={() => setView('admin-dashboard')} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm">Close</button> </div> </div> <div className="bg-white p-6 rounded-2xl shadow-xl min-h-[500px]"> {adminTab === 'overview' && (<div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-center"><h3 className="text-3xl font-bold text-orange-600">{allSchools.length}</h3><p className="text-sm text-gray-500 uppercase font-bold">Schools</p></div></div>)} {adminTab === 'schools' && (<div className="overflow-x-auto"><table className="w-full text-sm text-left border-collapse"><thead className="bg-gray-100 text-gray-600 uppercase text-xs"><tr><th className="p-3 border-b">School Name</th><th className="p-3 border-b">ID</th></tr></thead><tbody className="divide-y">{allSchools.map((s, i) => (<tr key={i} className="hover:bg-gray-50"><td className="p-3 font-bold">{s.schoolName}</td><td className="p-3 font-mono text-xs">{s.schoolId}</td></tr>))}</tbody></table></div>)} {adminTab === 'students' && (<div className="space-y-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="text" placeholder="Search students..." className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => setMasterSearch(e.target.value)} /></div><div className="overflow-x-auto max-h-[500px]"><table className="w-full text-sm text-left border-collapse"><thead className="bg-gray-100 text-gray-600 uppercase text-xs sticky top-0"><tr><th className="p-3 border-b">Name</th><th className="p-3 border-b">Adm No</th></tr></thead><tbody className="divide-y">{allStudents.filter(s => s.studentName.toLowerCase().includes(masterSearch.toLowerCase())).map((s, i) => (<tr key={i} className="hover:bg-gray-50"><td className="p-3 font-bold">{s.studentName}</td><td className="p-3">{s.admissionNumber}</td></tr>))}</tbody></table></div></div>)} {adminTab === 'teachers' && (<div className="overflow-x-auto"><table className="w-full text-sm text-left border-collapse"><thead className="bg-gray-100 text-gray-600 uppercase text-xs"><tr><th className="p-3 border-b">Name</th><th className="p-3 border-b">ID</th></tr></thead><tbody className="divide-y">{allTeachers.map((t, i) => (<tr key={i} className="hover:bg-gray-50"><td className="p-3 font-bold">{t.teacherName}</td><td className="p-3 font-mono text-xs">{t.generatedId}</td></tr>))}</tbody></table></div>)} {adminTab === 'id_cards' && (<IdCardManager students={allStudents} teachers={allTeachers} />)} {adminTab === 'results' && (<div className="text-center text-gray-500 py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300"><Database size={48} className="mx-auto text-gray-300 mb-2" /><p>Results are optimized for search-based access.</p></div>)} </div> </div> );

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 pb-12 print:bg-white print:p-0">
      
      {/* Modals & Popups */}
      {showIdCard && generatedStudent && <StudentIdCard student={generatedStudent} onClose={() => { setShowIdCard(false); setView('admin-dashboard'); setRegData({}); }} />}
      {showTeacherIdCard && generatedTeacher && <TeacherIdCard teacher={generatedTeacher} onClose={() => { setShowTeacherIdCard(false); setView('admin-dashboard'); setRegData({}); }} />}
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

        {view === 'home' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in">
            <div className="bg-purple-50 p-6 rounded-full"><School className="w-16 h-16 text-purple-700" /></div>
            <h1 className="text-4xl font-bold text-gray-800 tracking-tight">Sleek School <span className="text-purple-600">Portal</span></h1>
            <p className="text-gray-600 max-w-md text-lg">Generate, manage, and distribute student results securely using School and Student IDs.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 w-full max-w-6xl mt-8 px-4">
              
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

              <button onClick={() => { resetForm(); setView('create'); }} className="group p-6 bg-white border-2 border-purple-100 rounded-2xl hover:border-purple-500 hover:shadow-xl transition-all duration-300 text-left">
                <div className="mb-4 text-purple-600"><FileText size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-purple-700">Create Result</h3>
                <p className="text-sm text-gray-500">Generate new result sheets.</p>
              </button>
              
              <button onClick={() => { resetForm(); setView('admin-search'); }} className="group p-6 bg-white border-2 border-orange-100 rounded-2xl hover:border-orange-500 hover:shadow-xl transition-all duration-300 text-left">
                <div className="mb-4 text-orange-600"><Edit size={32} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-orange-700">Edit Result</h3>
                <p className="text-sm text-gray-500">Modify uploaded results.</p>
              </button>

              <button onClick={() => setView('admin-dashboard')} className="group p-6 bg-white border-2 border-red-100 rounded-2xl hover:border-red-500 hover:shadow-xl transition-all duration-300 text-left md:col-start-3">
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
              <button onClick={() => setView('home')} className="text-white opacity-80 hover:opacity-100">Close</button>
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
                <button onClick={() => setView('home')} className="w-full text-sm text-gray-400 hover:text-gray-600 mt-2">Cancel</button>
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

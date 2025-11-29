
import React, { useState, useEffect, useRef } from 'react';
import { 
  Laptop2, QrCode, Upload, FileText, CheckCircle, Clock, 
  AlertCircle, ChevronRight, Save, User, School, Play, BrainCircuit, Loader2, KeyRound, Calculator, BookOpen, Layers, Type, AlignLeft,
  FileDown, Trash2, Copy, Users, Printer, Eye, ClipboardList, Edit, X
} from 'lucide-react';
import { 
  collection, addDoc, query, where, getDocs, updateDoc, doc, setDoc, orderBy 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { generateExamQuestions } from '../services/gemini';
import { 
  TeacherData, StudentData, CbtAssessment, Question, 
  AssessmentType, ResultData, Subject, ExamLog 
} from '../types';
import { CLASS_LEVELS, ALL_NIGERIAN_SUBJECTS } from '../constants';
import QrScannerModal from './QrScannerModal';

interface CbtPortalProps {
  onBack: () => void;
}

type PortalMode = 'selection' | 'teacher_login' | 'teacher_dash' | 'student_login' | 'student_exam';

const CbtPortal: React.FC<CbtPortalProps> = ({ onBack }) => {
  const [mode, setMode] = useState<PortalMode>('selection');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  
  // Login Method Toggle
  const [loginMethod, setLoginMethod] = useState<'scan' | 'manual'>('scan');
  const [manualTeacherId, setManualTeacherId] = useState('');
  const [manualStudentId, setManualStudentId] = useState({ schoolId: '', admissionNumber: '' });

  // Teacher State
  const [teacher, setTeacher] = useState<TeacherData | null>(null);
  const [myAssessments, setMyAssessments] = useState<CbtAssessment[]>([]);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<CbtAssessment | null>(null);

  const [assessmentForm, setAssessmentForm] = useState({
    subject: '',
    selectedSubject: '', // Tracks dropdown value
    classLevel: '',
    term: 'First Term',
    type: 'ca1' as AssessmentType,
    questionMode: 'objective' as 'objective' | 'theory' | 'comprehension',
    questionCount: 10, // Default number of questions
    instructions: '',
    duration: 30, // minutes
    notes: '',
    generatedQuestions: [] as Question[]
  });

  // Result Viewer State
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultExamCode, setResultExamCode] = useState('');
  const [examResults, setExamResults] = useState<ExamLog[]>([]);

  // Student State
  const [student, setStudent] = useState<StudentData | null>(null);
  const [examCodeInput, setExamCodeInput] = useState('');
  const [activeAssessment, setActiveAssessment] = useState<CbtAssessment | null>(null);
  const [answers, setAnswers] = useState<{[key: number]: string}>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [scoreData, setScoreData] = useState<{score: number, total: number, percentage: number} | null>(null);

  // PDF Refs
  const questionsPrintRef = useRef<HTMLDivElement>(null);
  const historyPrintRef = useRef<HTMLDivElement>(null);
  const studentResultPrintRef = useRef<HTMLDivElement>(null);

  // Math Symbols
  const MATH_SYMBOLS = [
    '√', 'π', 'θ', '∞', '∫', '∑', '∂', '∆', 'μ', 'σ', 
    '±', '≠', '≈', '≤', '≥', '÷', '×', '·', 
    '²', '³', '½', '∈', '∀', '∃', '⇒', 'Ω', '°'
  ];

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (activeAssessment && !examSubmitted && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [activeAssessment, examSubmitted, timeLeft]);

  // Fetch Teacher's Assessment History
  useEffect(() => {
    if (teacher && mode === 'teacher_dash') {
      const fetchHistory = async () => {
        try {
          // Removed orderBy to prevent index requirement error. Sorting is done client-side.
          const q = query(
            collection(db, 'CBT Assessments'),
            where("teacherId", "==", teacher.generatedId)
          );
          const snap = await getDocs(q);
          const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CbtAssessment));
          
          // Sort client-side by createdAt descending
          data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          setMyAssessments(data);
        } catch (err) {
          console.error("Error fetching history:", err);
        }
      };
      fetchHistory();
    }
  }, [teacher, mode, success]);

  // --- HANDLERS ---

  const insertSymbol = (symbol: string) => {
    const textarea = document.getElementById('cbt-notes-input') as HTMLTextAreaElement;
    if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = assessmentForm.notes;
        const newText = text.substring(0, start) + symbol + text.substring(end);
        setAssessmentForm(prev => ({ ...prev, notes: newText }));
        // Restore focus and cursor
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + symbol.length, start + symbol.length);
        }, 0);
    } else {
        setAssessmentForm(prev => ({ ...prev, notes: prev.notes + symbol }));
    }
  };

  const handleUpdateQuestion = (idx: number, field: string, val: string, optIdx?: number) => {
    const updatedQuestions = [...assessmentForm.generatedQuestions];
    const question = { ...updatedQuestions[idx] };

    if (field === 'text') {
        question.questionText = val;
    } else if (field === 'correct') {
        question.correctAnswer = val;
    } else if (field === 'option' && question.options && optIdx !== undefined) {
        const updatedOptions = [...question.options];
        updatedOptions[optIdx] = val;
        question.options = updatedOptions;
    }

    updatedQuestions[idx] = question;
    setAssessmentForm(prev => ({ ...prev, generatedQuestions: updatedQuestions }));
  };

  const handleRemoveQuestion = (idx: number) => {
      const updatedQuestions = assessmentForm.generatedQuestions.filter((_, i) => i !== idx);
      setAssessmentForm(prev => ({ ...prev, generatedQuestions: updatedQuestions }));
  };

  const handleScan = async (dataStr: string) => {
    setShowScanner(false);
    setError('');
    try {
      const data = JSON.parse(dataStr);
      
      if (mode === 'teacher_login') {
        // Teacher Scan
        if (!data.id) throw new Error("Invalid Teacher ID");
        setLoading(true);
        const q = query(collection(db, 'Teacher Data'), where("generatedId", "==", data.id));
        const snap = await getDocs(q);
        if (snap.empty) throw new Error("Teacher record not found.");
        setTeacher(snap.docs[0].data() as TeacherData);
        setMode('teacher_dash');
      } else if (mode === 'student_login') {
        // Student Scan
        if (!data.ad || !data.sc) throw new Error("Invalid Student ID");
        setLoading(true);
        const q = query(collection(db, 'Student Data'), 
          where("schoolId", "==", data.sc),
          where("admissionNumber", "==", data.ad)
        );
        const snap = await getDocs(q);
        if (snap.empty) throw new Error("Student record not found.");
        setStudent(snap.docs[0].data() as StudentData);
        setMode('student_exam'); // Go to code entry
      }
    } catch (err: any) {
      setError(err.message || "Scan failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherManualLogin = async () => {
    if (!manualTeacherId.trim()) {
        setError("Please enter your Teacher ID.");
        return;
    }
    setLoading(true);
    setError('');
    try {
        const q = query(collection(db, 'Teacher Data'), where("generatedId", "==", manualTeacherId.trim()));
        const snap = await getDocs(q);
        if (snap.empty) throw new Error("Teacher record not found. Please check ID.");
        
        setTeacher(snap.docs[0].data() as TeacherData);
        setMode('teacher_dash');
    } catch (err: any) {
        setError(err.message || "Login failed.");
    } finally {
        setLoading(false);
    }
  };

  const handleStudentManualLogin = async () => {
    if (!manualStudentId.schoolId || !manualStudentId.admissionNumber) {
        setError("Please enter School ID and Admission Number.");
        return;
    }
    setLoading(true);
    setError('');
    try {
        const q = query(collection(db, 'Student Data'), 
          where("schoolId", "==", manualStudentId.schoolId.trim()),
          where("admissionNumber", "==", manualStudentId.admissionNumber.trim())
        );
        const snap = await getDocs(q);
        if (snap.empty) throw new Error("Student record not found.");
        
        setStudent(snap.docs[0].data() as StudentData);
        setMode('student_exam');
    } catch (err: any) {
        setError(err.message || "Login failed.");
    } finally {
        setLoading(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!assessmentForm.notes || !assessmentForm.subject) {
      setError("Please select a subject and paste lesson notes.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const questions = await generateExamQuestions(
        assessmentForm.notes,
        assessmentForm.classLevel,
        assessmentForm.subject,
        assessmentForm.questionCount,
        assessmentForm.questionMode
      );
      
      // Append new questions to existing ones (Continuation logic)
      setAssessmentForm(prev => ({ 
          ...prev, 
          generatedQuestions: [...prev.generatedQuestions, ...questions] 
      }));
      
      setSuccess(`Generated ${questions.length} ${assessmentForm.questionMode} questions. Added to list.`);
    } catch (err) {
      setError("Failed to generate questions. Ensure content is sufficient.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAssessment = async () => {
    if (!teacher || assessmentForm.generatedQuestions.length === 0) return;
    setLoading(true);
    
    try {
      const examCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const assessmentPayload: CbtAssessment = {
        examCode,
        schoolId: teacher.schoolId,
        teacherId: teacher.generatedId,
        subject: assessmentForm.subject,
        classLevel: assessmentForm.classLevel,
        term: assessmentForm.term,
        session: new Date().getFullYear().toString(), // Simplified session
        durationMinutes: assessmentForm.duration,
        type: assessmentForm.type,
        questionMode: assessmentForm.questionMode,
        instructions: assessmentForm.instructions,
        questions: assessmentForm.generatedQuestions,
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      await addDoc(collection(db, 'CBT Assessments'), assessmentPayload);
      setSuccess(`Assessment Created! EXAM CODE: ${examCode}`);
      // Only reset notes/instructions, keep questions visible for a moment or give option to clear
      setAssessmentForm(prev => ({ ...prev, generatedQuestions: [], notes: '', instructions: '' })); 
    } catch (err) {
      setError("Failed to save assessment.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!window.html2pdf || !questionsPrintRef.current) return;
    const element = questionsPrintRef.current;
    
    const filename = `${assessmentForm.subject}_${assessmentForm.classLevel}_Questions.pdf`;

    const opt = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    window.html2pdf().set(opt).from(element).save();
  };

  const handleDownloadHistoryPDF = () => {
      if (!window.html2pdf || !historyPrintRef.current || !viewingHistoryItem) return;
      const element = historyPrintRef.current;
      const filename = `${viewingHistoryItem.subject}_${viewingHistoryItem.examCode}_Questions.pdf`;

      const opt = {
        margin: 10,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      window.html2pdf().set(opt).from(element).save();
  };

  const handleDownloadStudentResult = () => {
    if (!window.html2pdf || !studentResultPrintRef.current || !student || !activeAssessment) return;
    
    const element = studentResultPrintRef.current;
    const filename = `${student.studentName}_${activeAssessment.subject}_Result.pdf`;

    const opt = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    window.html2pdf().set(opt).from(element).save();
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert("Exam code copied to clipboard!");
  };

  const handleViewResults = async () => {
    if (!resultExamCode) return;
    setLoading(true);
    setExamResults([]);
    try {
        const q = query(collection(db, 'Exam Logs'), where("examCode", "==", resultExamCode.trim()));
        const snap = await getDocs(q);
        const results = snap.docs.map(doc => ({ ...doc.data() as ExamLog }));
        if (results.length === 0) setError("No results found for this code.");
        else setExamResults(results);
    } catch (err) {
        console.error(err);
        setError("Failed to fetch results.");
    } finally {
        setLoading(false);
    }
  };

  const handleStartExam = async () => {
    if (!examCodeInput || !student) return;
    setLoading(true);
    setError('');
    try {
      const q = query(collection(db, 'CBT Assessments'), where("examCode", "==", examCodeInput.trim()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setError("Invalid Exam Code.");
        setLoading(false);
        return;
      }

      const examData = snap.docs[0].data() as CbtAssessment;
      
      // Basic validation
      if (examData.schoolId !== student.schoolId) {
        setError("This exam belongs to a different school.");
        setLoading(false);
        return;
      }
      if (examData.status !== 'active') {
        setError("This exam is closed.");
        setLoading(false);
        return;
      }

      setActiveAssessment(examData);
      setTimeLeft(examData.durationMinutes * 60);
      setExamSubmitted(false);
      setAnswers({});
      setScoreData(null);
    } catch (err) {
      setError("Error fetching exam.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitExam = async () => {
    if (!activeAssessment || !student || examSubmitted) return;
    
    setExamSubmitted(true);
    setLoading(true);

    if (activeAssessment.questionMode === 'theory') {
        setSuccess("Essay submitted successfully! Results will be pending teacher review.");
        setLoading(false);
        return;
    }

    // Calculate Score (Objective & Comprehension)
    let correctCount = 0;
    activeAssessment.questions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });

    const percentage = (correctCount / activeAssessment.questions.length) * 100;
    
    // Scale score based on type (CA usually 20, Exam 60)
    let maxScore = activeAssessment.type === 'exam' ? 60 : 20;
    const finalScore = Math.round((percentage / 100) * maxScore);

    const resultPayload = {
      score: finalScore,
      total: maxScore,
      percentage: Math.round(percentage)
    };

    setScoreData(resultPayload);

    try {
      // 1. Log the Exam Submission for Teacher View
      const examLog: ExamLog = {
          examCode: activeAssessment.examCode,
          studentName: student.studentName,
          admissionNumber: student.admissionNumber,
          score: finalScore,
          total: maxScore,
          percentage: Math.round(percentage),
          submittedAt: new Date().toISOString(),
          subject: activeAssessment.subject,
          type: activeAssessment.type
      };
      await addDoc(collection(db, 'Exam Logs'), examLog);

      // 2. Update Result Sheet Data
      const qResult = query(collection(db, 'Result Data'), 
        where("schoolId", "==", student.schoolId),
        where("admissionNumber", "==", student.admissionNumber),
        where("term", "==", activeAssessment.term)
      );
      
      const resultSnap = await getDocs(qResult);
      
      if (!resultSnap.empty) {
        const docRef = resultSnap.docs[0].ref;
        const resultData = resultSnap.docs[0].data() as ResultData;
        
        let subjects = [...(resultData.subjects || [])];
        const subIndex = subjects.findIndex(s => s.name === activeAssessment.subject);
        
        if (subIndex > -1) {
          (subjects[subIndex] as any)[activeAssessment.type] = finalScore;
          const s = subjects[subIndex];
          const ca1 = Number(s.ca1) || 0;
          const ca2 = Number(s.ca2) || 0;
          const exam = Number(s.exam) || 0;
          subjects[subIndex].total = ca1 + ca2 + exam; 
        } else {
          const newSub: any = {
            name: activeAssessment.subject,
            selectedSubject: activeAssessment.subject,
            ca1: 0, ca2: 0, exam: 0, total: finalScore, average: 0, grade: '', remark: ''
          };
          newSub[activeAssessment.type] = finalScore;
          subjects.push(newSub as Subject);
        }
        
        await updateDoc(docRef, { subjects, updatedAt: new Date().toISOString() });
      } else {
        setSuccess("Score recorded in Exam Log, but Term Result Sheet not found to update.");
        setLoading(false);
        return;
      }
      
      setSuccess("Exam Submitted & Result Sheet Updated!");
      
    } catch (err) {
      console.error(err);
      setError("Exam submitted but failed to update database.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- RENDERS ---

  if (mode === 'selection') {
    return (
      <div className="max-w-4xl mx-auto p-6 animate-slide-up">
        <button onClick={onBack} className="mb-6 text-gray-500 hover:text-gray-800 flex items-center gap-2 font-bold"><ChevronRight className="rotate-180" size={20}/> Back to Portal</button>
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
           <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
             <Laptop2 className="text-blue-600" size={32} /> CBT Portal
           </h1>
           <p className="text-gray-500 mb-8">Computer Based Test System for Assessment & Exams</p>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <button onClick={() => { setMode('teacher_login'); setLoginMethod('scan'); setError(''); }} className="flex flex-col items-center p-8 bg-purple-50 border-2 border-purple-100 rounded-xl hover:border-purple-500 transition-all group">
                 <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <BrainCircuit className="text-purple-600" size={32} />
                 </div>
                 <h3 className="text-xl font-bold text-gray-800">Teacher Login</h3>
                 <p className="text-sm text-gray-500 mt-2">Create Assessments & Upload Notes</p>
              </button>
              
              <button onClick={() => { setMode('student_login'); setLoginMethod('scan'); setError(''); }} className="flex flex-col items-center p-8 bg-blue-50 border-2 border-blue-100 rounded-xl hover:border-blue-500 transition-all group">
                 <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <User className="text-blue-600" size={32} />
                 </div>
                 <h3 className="text-xl font-bold text-gray-800">Student Login</h3>
                 <p className="text-sm text-gray-500 mt-2">Take Exam & Check Scores</p>
              </button>
           </div>
        </div>
      </div>
    );
  }

  // Teacher & Student Login (Shared Scanner Logic + Manual Toggle)
  if (mode === 'teacher_login' || mode === 'student_login') {
    const isTeacher = mode === 'teacher_login';
    return (
      <div className="max-w-md mx-auto p-6 animate-fade-in mt-10">
        <button onClick={() => { setMode('selection'); setError(''); }} className="mb-4 text-sm text-gray-500">Back</button>
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
           <h2 className="text-2xl font-bold mb-6">{isTeacher ? 'Teacher Login' : 'Student Login'}</h2>
           
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
                    onClick={() => setShowScanner(true)}
                    className="w-full py-4 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition"
                >
                    <QrCode size={20} /> Open Camera
                </button>
           ) : (
               <div className="space-y-4 text-left animate-fade-in">
                   {isTeacher ? (
                       <div>
                           <label className="text-xs font-bold text-gray-500 uppercase">Teacher ID</label>
                           <input 
                                type="text" 
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
                                placeholder="e.g. TCH-8521"
                                value={manualTeacherId}
                                onChange={(e) => setManualTeacherId(e.target.value)}
                           />
                       </div>
                   ) : (
                       <>
                           <div>
                               <label className="text-xs font-bold text-gray-500 uppercase">School ID</label>
                               <input 
                                    type="text" 
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                    placeholder="e.g. SCH-001"
                                    value={manualStudentId.schoolId}
                                    onChange={(e) => setManualStudentId({...manualStudentId, schoolId: e.target.value})}
                               />
                           </div>
                           <div>
                               <label className="text-xs font-bold text-gray-500 uppercase">Admission Number</label>
                               <input 
                                    type="text" 
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                    placeholder="e.g. ADM/2024/005"
                                    value={manualStudentId.admissionNumber}
                                    onChange={(e) => setManualStudentId({...manualStudentId, admissionNumber: e.target.value})}
                               />
                           </div>
                       </>
                   )}
                   
                   <button 
                        onClick={isTeacher ? handleTeacherManualLogin : handleStudentManualLogin}
                        disabled={loading}
                        className={`w-full py-3 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg ${isTeacher ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                   >
                        {loading ? <Loader2 className="animate-spin" /> : <Play size={18} />} Login
                   </button>
               </div>
           )}

           {error && <p className="text-red-500 mt-4 text-sm bg-red-50 p-2 rounded border border-red-100 font-medium">{error}</p>}
        </div>
        {showScanner && <QrScannerModal onScanSuccess={handleScan} onClose={() => setShowScanner(false)} />}
      </div>
    );
  }

  // Teacher Dashboard
  if (mode === 'teacher_dash' && teacher) {
    return (
      <div className="max-w-4xl mx-auto p-4 animate-fade-in relative">
        {/* View Results Modal */}
        {showResultModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg h-[80vh] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><Users /> Student Results</h3>
                        <button onClick={() => setShowResultModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            className="flex-1 p-2 border rounded outline-none uppercase"
                            placeholder="Enter Exam Code (e.g. A3F8K9)"
                            value={resultExamCode}
                            onChange={(e) => setResultExamCode(e.target.value)}
                        />
                        <button onClick={handleViewResults} className="bg-blue-600 text-white px-4 rounded font-bold hover:bg-blue-700">{loading ? <Loader2 className="animate-spin"/> : 'Search'}</button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto border rounded-lg bg-gray-50">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-gray-600 sticky top-0 shadow-sm">
                                <tr>
                                    <th className="p-3">Name</th>
                                    <th className="p-3">Score</th>
                                    <th className="p-3">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {examResults.length > 0 ? examResults.map((res, i) => (
                                    <tr key={i} className="hover:bg-gray-50 bg-white">
                                        <td className="p-3">
                                            <div className="font-bold">{res.studentName}</div>
                                            <div className="text-xs text-gray-500">{res.admissionNumber}</div>
                                        </td>
                                        <td className="p-3">
                                            <div className="font-bold text-blue-600">{res.score}/{res.total}</div>
                                            <div className="text-xs text-gray-400">{res.percentage}%</div>
                                        </td>
                                        <td className="p-3 text-xs text-gray-500">
                                            {new Date(res.submittedAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={3} className="p-4 text-center text-gray-500">No results found or search not initiated.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* View History Detail Modal */}
        {viewingHistoryItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
                     <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <div>
                            <h3 className="font-bold text-lg text-gray-800">{viewingHistoryItem.subject} - {viewingHistoryItem.type.toUpperCase()}</h3>
                            <p className="text-xs text-gray-500">Code: {viewingHistoryItem.examCode}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleDownloadHistoryPDF} className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-purple-700">
                                <FileDown size={14}/> PDF
                            </button>
                            <button onClick={() => setViewingHistoryItem(null)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded border">
                         <div className="mb-4 text-sm text-gray-700 italic border-b pb-2">
                            <strong>Instructions:</strong> {viewingHistoryItem.instructions || 'None'}
                         </div>
                         {viewingHistoryItem.questions.map((q, i) => (
                            <div key={i} className="bg-white p-4 mb-3 rounded-lg shadow-sm border border-gray-100">
                                <p className="font-bold text-sm text-gray-800 mb-2">{i+1}. {q.questionText}</p>
                                {q.options && q.options.length > 0 && (
                                    <ul className="grid grid-cols-2 gap-2 text-xs">
                                        {q.options.map((opt, idx) => (
                                            <li key={idx} className={`p-2 rounded ${opt === q.correctAnswer ? 'bg-green-100 text-green-800 font-bold' : 'bg-gray-50 text-gray-600'}`}>
                                                <span className="font-bold mr-1">{String.fromCharCode(65 + idx)}.</span> {opt}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {!q.options && <p className="text-xs text-green-700 mt-1 bg-green-50 p-2 rounded inline-block"><strong>Answer:</strong> {q.correctAnswer}</p>}
                            </div>
                         ))}
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                         <button onClick={() => handleCopyCode(viewingHistoryItem.examCode)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded text-sm font-bold border hover:bg-gray-200">Copy Exam Code</button>
                    </div>
                </div>
            </div>
        )}

        {/* Hidden Container for History PDF Generation */}
        <div className="fixed top-0 left-0 -z-50 invisible pointer-events-none">
            {viewingHistoryItem && (
                <div ref={historyPrintRef} style={{ width: '210mm', minHeight: '297mm', background: 'white', padding: '15mm', fontFamily: 'serif', color: 'black' }}>
                    <div style={{ textAlign: 'center', marginBottom: '10mm', borderBottom: '2px solid black', paddingBottom: '5mm' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase' }}>{teacher.schoolName || "School Assessment"}</h1>
                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '5px' }}>{viewingHistoryItem.subject} - {viewingHistoryItem.type.toUpperCase()}</h2>
                        <p style={{ fontSize: '14px' }}>Class: {viewingHistoryItem.classLevel} | Duration: {viewingHistoryItem.durationMinutes} Mins</p>
                    </div>
                    {viewingHistoryItem.instructions && (
                        <div style={{ marginBottom: '8mm', fontStyle: 'italic', fontSize: '12px' }}>
                            <strong>Instructions:</strong> {viewingHistoryItem.instructions}
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5mm' }}>
                        {viewingHistoryItem.questions.map((q, i) => (
                            <div key={i} style={{ pageBreakInside: 'avoid' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '2mm' }}>{i + 1}. {q.questionText}</div>
                                {q.options && q.options.length > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2mm', fontSize: '12px' }}>
                                        {q.options.map((opt, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: '5px' }}>
                                                <span>{String.fromCharCode(65 + idx)}.</span>
                                                <span>{opt}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ height: '20mm', borderBottom: '1px dotted black', marginTop: '5mm' }}></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
           <div>
             <h2 className="text-2xl font-bold text-gray-800">Welcome, {teacher.teacherName}</h2>
             <p className="text-gray-500 text-sm">{teacher.schoolName}</p>
           </div>
           <div className="flex gap-4 items-center">
             <button onClick={() => setShowResultModal(true)} className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-100 transition">
                <Users size={18} /> View Results
             </button>
             <button onClick={() => { setTeacher(null); setMode('selection'); setManualTeacherId(''); }} className="text-red-500 font-bold text-sm hover:underline">Logout</button>
           </div>
        </div>
        
        {/* NEW SECTION: Teacher's Assessment History */}
        {myAssessments.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><ClipboardList size={18} /> My Generated Assessments</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 border-b">
                            <tr>
                                <th className="p-3">Exam Code</th>
                                <th className="p-3">Subject</th>
                                <th className="p-3">Class</th>
                                <th className="p-3">Type</th>
                                <th className="p-3">Questions</th>
                                <th className="p-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {myAssessments.map((assess) => (
                                <tr key={assess.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-mono font-bold text-purple-600 cursor-pointer" onClick={() => handleCopyCode(assess.examCode)} title="Click to Copy">
                                        {assess.examCode}
                                    </td>
                                    <td className="p-3 font-medium">{assess.subject}</td>
                                    <td className="p-3">{assess.classLevel}</td>
                                    <td className="p-3 uppercase text-xs">{assess.type}</td>
                                    <td className="p-3 text-center">{assess.questions.length}</td>
                                    <td className="p-3">
                                        <button onClick={() => setViewingHistoryItem(assess)} className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                            <Eye size={16} /> View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
           <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Upload size={18} /> Create New Assessment</h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Class Level</label>
                <select 
                  className="w-full p-2 border rounded bg-white"
                  value={assessmentForm.classLevel}
                  onChange={e => setAssessmentForm({...assessmentForm, classLevel: e.target.value})}
                >
                  <option value="">Select Class</option>
                  {CLASS_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
             </div>
             <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Subject</label>
                <select 
                  className="w-full p-2 border rounded bg-white"
                  value={assessmentForm.selectedSubject}
                  onChange={e => {
                      const val = e.target.value;
                      setAssessmentForm(prev => ({
                          ...prev, 
                          selectedSubject: val,
                          subject: val === 'Others' ? '' : val 
                      }));
                  }}
                >
                   <option value="">Select Subject</option>
                   {ALL_NIGERIAN_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {assessmentForm.selectedSubject === 'Others' && (
                    <input 
                        type="text" 
                        placeholder="Enter Subject Name" 
                        value={assessmentForm.subject} 
                        onChange={e => setAssessmentForm(prev => ({...prev, subject: e.target.value}))}
                        className="w-full p-2 mt-1 border rounded outline-none bg-yellow-50 border-yellow-200"
                    />
                )}
             </div>
             <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Assessment Category</label>
                <select 
                  className="w-full p-2 border rounded bg-white"
                  value={assessmentForm.type}
                  onChange={e => setAssessmentForm({...assessmentForm, type: e.target.value as AssessmentType})}
                >
                   <option value="ca1">Assessment 1 (CA1)</option>
                   <option value="ca2">Assessment 2 (CA2)</option>
                   <option value="exam">Examination</option>
                </select>
             </div>
             <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Duration (Minutes)</label>
                <input 
                  type="number" 
                  className="w-full p-2 border rounded"
                  value={assessmentForm.duration}
                  onChange={e => setAssessmentForm({...assessmentForm, duration: Number(e.target.value)})}
                />
             </div>
           </div>

           {/* Question Format Buttons */}
           <div className="mb-4">
               <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Question Format (Continuous)</label>
               <div className="grid grid-cols-3 gap-2">
                   <button 
                       onClick={() => setAssessmentForm({...assessmentForm, questionMode: 'objective'})}
                       className={`p-3 rounded-lg font-bold text-sm flex flex-col items-center gap-1 border-2 transition ${assessmentForm.questionMode === 'objective' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-500 hover:border-purple-200'}`}
                   >
                       <Layers size={20} /> Objective
                   </button>
                   <button 
                       onClick={() => setAssessmentForm({...assessmentForm, questionMode: 'theory'})}
                       className={`p-3 rounded-lg font-bold text-sm flex flex-col items-center gap-1 border-2 transition ${assessmentForm.questionMode === 'theory' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:border-blue-200'}`}
                   >
                       <Type size={20} /> Essay / Theory
                   </button>
                   <button 
                       onClick={() => setAssessmentForm({...assessmentForm, questionMode: 'comprehension'})}
                       className={`p-3 rounded-lg font-bold text-sm flex flex-col items-center gap-1 border-2 transition ${assessmentForm.questionMode === 'comprehension' ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-500 hover:border-orange-200'}`}
                   >
                       <AlignLeft size={20} /> Comprehension
                   </button>
               </div>
           </div>

           {/* Dynamic Fields based on Mode */}
           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
               <div>
                  <label className="text-xs font-bold text-gray-600 uppercase block mb-1">
                      {assessmentForm.questionMode} Instructions
                  </label>
                  <textarea 
                      className="w-full p-2 border rounded text-sm h-16 bg-white focus:ring-1 focus:ring-black outline-none"
                      placeholder={`Enter instructions for ${assessmentForm.questionMode} section...`}
                      value={assessmentForm.instructions}
                      onChange={e => setAssessmentForm({...assessmentForm, instructions: e.target.value})}
                  />
               </div>
               
               <div>
                  <label className="text-xs font-bold text-gray-600 uppercase block mb-1">
                      Number of Questions to Generate
                  </label>
                  <input 
                      type="number" 
                      min={1} 
                      max={50}
                      className="w-full p-2 border rounded bg-white w-24 focus:ring-1 focus:ring-black outline-none"
                      value={assessmentForm.questionCount}
                      onChange={e => setAssessmentForm({...assessmentForm, questionCount: Number(e.target.value)})}
                  />
               </div>

               <div>
                  <label className="text-xs font-bold text-gray-600 uppercase mb-2 block flex items-center gap-2">
                      <Calculator size={14}/> 
                      {assessmentForm.questionMode === 'comprehension' ? 'Passage Content' : 'Lesson Notes / Topic Content'}
                  </label>
                  
                  {/* Math/Symbol Toolbar */}
                  <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-white border border-gray-200 rounded-lg">
                    {MATH_SYMBOLS.map(s => (
                        <button 
                            key={s} 
                            onClick={() => insertSymbol(s)}
                            className="w-8 h-8 flex items-center justify-center bg-gray-50 border border-gray-200 rounded hover:bg-purple-600 hover:text-white hover:border-purple-600 transition text-sm font-serif shadow-sm"
                            title="Insert Symbol"
                        >
                            {s}
                        </button>
                    ))}
                  </div>

                  <textarea 
                     id="cbt-notes-input"
                     className="w-full p-3 border rounded-lg h-40 text-sm focus:ring-2 focus:ring-purple-500 outline-none font-mono bg-white"
                     placeholder={assessmentForm.questionMode === 'comprehension' ? "Paste the comprehension passage here..." : "Paste lesson notes or topic summary here. AI will strictly use this content to generate questions."}
                     value={assessmentForm.notes}
                     onChange={e => setAssessmentForm({...assessmentForm, notes: e.target.value})}
                  ></textarea>
                  <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                     <BrainCircuit size={10} /> Questions will be generated from content and <b>appended</b> to the list.
                  </p>
               </div>
           </div>
           
           <button 
             onClick={handleGenerateQuestions} 
             disabled={loading}
             className="w-full mt-4 bg-purple-600 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-purple-700 disabled:opacity-50 shadow-md transition"
           >
             {loading ? <Loader2 className="animate-spin" size={18} /> : <BrainCircuit size={18} />} 
             Generate & Add {assessmentForm.questionCount} {assessmentForm.questionMode} Questions
           </button>

           {success && (
               <div className="mt-4 bg-green-50 text-green-700 p-3 rounded font-bold border border-green-200 flex items-center gap-2">
                   <CheckCircle size={18} />
                   <span>{success}</span>
                   {success.includes("CODE:") && (
                       <button 
                        onClick={() => handleCopyCode(success.split('CODE: ')[1])}
                        className="ml-2 bg-green-200 hover:bg-green-300 text-green-800 p-1 rounded transition"
                        title="Copy Code"
                       >
                           <Copy size={16} />
                       </button>
                   )}
               </div>
           )}
           {error && <div className="mt-4 bg-red-50 text-red-700 p-3 rounded font-bold border border-red-200">{error}</div>}
        </div>

        {/* Generated Questions Review (Editable) */}
        {assessmentForm.generatedQuestions.length > 0 && (
           <div className="bg-white rounded-xl shadow-lg p-6 animate-slide-up">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                 <h3 className="text-lg font-bold text-gray-800">Review Questions ({assessmentForm.generatedQuestions.length})</h3>
                 <div className="flex gap-2">
                    <button 
                        onClick={() => setAssessmentForm(prev => ({...prev, generatedQuestions: []}))}
                        className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-red-100 transition text-xs"
                    >
                        <Trash2 size={16} /> Clear All
                    </button>
                    <button 
                        onClick={() => handleDownloadPDF()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md transition text-xs"
                    >
                        <FileDown size={16} /> Download PDF
                    </button>
                    <button 
                        onClick={handleSaveAssessment}
                        disabled={loading}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 shadow-md transition text-xs"
                    >
                        <Save size={16} /> Save & Publish
                    </button>
                 </div>
              </div>
              <div className="space-y-4 max-h-[600px] overflow-y-auto border p-2 rounded-lg bg-gray-50">
                 {assessmentForm.generatedQuestions.map((q, i) => (
                    <div key={i} className="p-4 border rounded-lg bg-white relative group">
                       <button 
                            onClick={() => handleRemoveQuestion(i)} 
                            className="absolute top-2 right-2 text-red-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                            title="Remove Question"
                       >
                           <X size={16} />
                       </button>
                       <div className="mb-2">
                           <label className="text-[10px] font-bold text-gray-400 uppercase">Question {i+1}</label>
                           <textarea 
                                value={q.questionText}
                                onChange={(e) => handleUpdateQuestion(i, 'text', e.target.value)}
                                className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-purple-500 outline-none"
                                rows={2}
                           />
                       </div>
                       
                       {q.options && q.options.length > 0 ? (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {q.options.map((opt, idx) => (
                                 <div key={idx} className="flex items-center gap-2">
                                     <span className="font-bold text-gray-400 text-xs w-4">{String.fromCharCode(65 + idx)}.</span>
                                     <input 
                                        type="text"
                                        value={opt}
                                        onChange={(e) => handleUpdateQuestion(i, 'option', e.target.value, idx)}
                                        className={`flex-1 p-2 border rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none ${opt === q.correctAnswer ? 'border-green-400 bg-green-50' : ''}`}
                                     />
                                 </div>
                              ))}
                           </div>
                       ) : null}

                       <div className="mt-3">
                           <label className="text-[10px] font-bold text-gray-400 uppercase">Correct Answer</label>
                            {q.options && q.options.length > 0 ? (
                                <select 
                                    value={q.correctAnswer}
                                    onChange={(e) => handleUpdateQuestion(i, 'correct', e.target.value)}
                                    className="w-full p-2 border rounded text-xs bg-gray-50 outline-none"
                                >
                                    {q.options.map((opt, idx) => (
                                        <option key={idx} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                    type="text"
                                    value={q.correctAnswer}
                                    onChange={(e) => handleUpdateQuestion(i, 'correct', e.target.value)}
                                    className="w-full p-2 border rounded text-xs bg-green-50 border-green-200 outline-none"
                                    placeholder="Model Answer / Marking Guide"
                                />
                            )}
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {/* Hidden Container for PDF Generation */}
        <div className="fixed top-0 left-0 -z-50 invisible pointer-events-none">
            <div ref={questionsPrintRef} style={{ width: '210mm', minHeight: '297mm', background: 'white', padding: '15mm', fontFamily: 'serif', color: 'black' }}>
                <div style={{ textAlign: 'center', marginBottom: '10mm', borderBottom: '2px solid black', paddingBottom: '5mm' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase' }}>{teacher.schoolName || "School Assessment"}</h1>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '5px' }}>{assessmentForm.subject} - {assessmentForm.type.toUpperCase()}</h2>
                    <p style={{ fontSize: '14px' }}>Class: {assessmentForm.classLevel} | Duration: {assessmentForm.duration} Mins</p>
                </div>
                {assessmentForm.instructions && (
                    <div style={{ marginBottom: '8mm', fontStyle: 'italic', fontSize: '12px' }}>
                        <strong>Instructions:</strong> {assessmentForm.instructions}
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5mm' }}>
                    {assessmentForm.generatedQuestions.map((q, i) => (
                        <div key={i} style={{ pageBreakInside: 'avoid' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '2mm' }}>{i + 1}. {q.questionText}</div>
                            {q.options && q.options.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2mm', fontSize: '12px' }}>
                                    {q.options.map((opt, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '5px' }}>
                                            <span>{String.fromCharCode(65 + idx)}.</span>
                                            <span>{opt}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ height: '20mm', borderBottom: '1px dotted black', marginTop: '5mm' }}></div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    );
  }

  // Student Exam Mode
  if (mode === 'student_exam' && student) {
    if (activeAssessment && !scoreData && !examSubmitted) {
       // --- TAKING EXAM ---
       const isTheory = activeAssessment.questionMode === 'theory';
       
       return (
         <div className="max-w-3xl mx-auto p-4 animate-fade-in pb-20">
            {/* Header */}
            <div className="bg-white p-4 rounded-xl shadow-sm border-b sticky top-0 z-10 flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
               <div>
                  <h2 className="font-bold text-gray-800">{activeAssessment.subject} <span className="text-gray-400 text-sm font-normal">| {activeAssessment.type.toUpperCase()}</span></h2>
                  <p className="text-xs text-gray-500">Student: {student.studentName}</p>
               </div>
               <div className="text-right">
                 <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold text-xl ${timeLeft < 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-800'}`}>
                    <Clock size={20} /> {formatTime(timeLeft)}
                 </div>
                 <p className="text-xs font-mono font-bold text-gray-400 mt-1">CODE: {activeAssessment.examCode}</p>
               </div>
            </div>
            
            {activeAssessment.instructions && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg mb-4 text-sm text-yellow-800 flex items-start gap-2">
                    <BookOpen size={16} className="shrink-0 mt-0.5" />
                    <p><strong>Instructions:</strong> {activeAssessment.instructions}</p>
                </div>
            )}

            {/* Questions */}
            <div className="space-y-6">
               {activeAssessment.questions.map((q, i) => (
                  <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                     <p className="font-bold text-lg text-gray-800 mb-4"><span className="text-blue-500 mr-2">{i+1}.</span>{q.questionText}</p>
                     
                     {!q.options || q.options.length === 0 ? (
                        <textarea 
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px]"
                            placeholder="Type your answer here..."
                            value={answers[q.id] || ''}
                            onChange={(e) => setAnswers(prev => ({...prev, [q.id]: e.target.value}))}
                        />
                     ) : (
                         <div className="space-y-2">
                            {q.options?.map((opt, idx) => (
                               <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition ${answers[q.id] === opt ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200'}`}>
                                  <input 
                                    type="radio" 
                                    name={`q-${q.id}`} 
                                    value={opt} 
                                    checked={answers[q.id] === opt}
                                    onChange={() => setAnswers(prev => ({...prev, [q.id]: opt}))}
                                    className="w-5 h-5 text-blue-600"
                                  />
                                  <span className="font-bold text-gray-500 min-w-[20px]">{String.fromCharCode(65 + idx)}.</span>
                                  <span className="text-gray-700">{opt}</span>
                               </label>
                            ))}
                         </div>
                     )}
                  </div>
               ))}
            </div>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-end gap-4 shadow-[0_-5px_15px_rgba(0,0,0,0.1)]">
               <button 
                  onClick={handleSubmitExam}
                  disabled={loading}
                  className="bg-green-600 text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-green-700 disabled:opacity-50 transition shadow-lg"
               >
                  {loading ? 'Submitting...' : 'Submit Assessment'}
               </button>
            </div>
         </div>
       );
    } else if (examSubmitted) {
       // --- RESULT SCREEN ---
       const isTheory = activeAssessment?.questionMode === 'theory';
       
       return (
          <div className="max-w-md mx-auto p-6 mt-10 text-center animate-slide-up">
             <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                   <CheckCircle className="text-green-600" size={40} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Assessment Completed!</h2>
                
                {isTheory ? (
                    <div className="bg-blue-50 p-6 rounded-xl mb-6 text-blue-800">
                        <p className="font-bold">Submission Received.</p>
                        <p className="text-sm mt-2">Your essay responses have been recorded for teacher grading.</p>
                    </div>
                ) : (
                    <>
                        <p className="text-gray-500 mb-6">Your responses have been recorded and your result sheet updated.</p>
                        <div className="bg-gray-50 p-6 rounded-xl mb-6">
                           <p className="text-sm font-bold text-gray-500 uppercase">Your Score</p>
                           <p className="text-5xl font-bold text-blue-600 my-2">{scoreData?.score}<span className="text-xl text-gray-400">/{scoreData?.total}</span></p>
                           <p className="text-sm font-bold text-gray-400">{scoreData?.percentage}% Accuracy</p>
                        </div>
                    </>
                )}
                
                <button onClick={handleDownloadStudentResult} className="w-full mb-3 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2">
                   <FileDown size={18} /> Download Result PDF
                </button>

                {success && <p className="text-green-600 text-xs font-bold mb-4 bg-green-50 p-2 rounded">{success}</p>}
                
                <button onClick={() => { setStudent(null); setMode('selection'); setManualStudentId({schoolId:'',admissionNumber:''}); setExamSubmitted(false); }} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition">
                   Return to Portal
                </button>
             </div>
             
             {/* Hidden Student Result PDF Container */}
             <div className="fixed top-0 left-0 -z-50 invisible pointer-events-none">
                <div ref={studentResultPrintRef} style={{ width: '210mm', minHeight: '297mm', background: 'white', padding: '15mm', fontFamily: 'serif', color: 'black', textAlign: 'left' }}>
                    <div style={{ textAlign: 'center', marginBottom: '10mm', borderBottom: '2px solid black', paddingBottom: '5mm' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase' }}>{student.schoolName || "School Assessment Result"}</h1>
                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '5px' }}>{activeAssessment?.subject} - Result Slip</h2>
                        <div style={{ fontSize: '14px', marginTop: '5px' }}>
                            <p><strong>Name:</strong> {student.studentName}</p>
                            <p><strong>Exam Code:</strong> {activeAssessment?.examCode}</p>
                            <p><strong>Score:</strong> {scoreData?.score} / {scoreData?.total} ({scoreData?.percentage}%)</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5mm' }}>
                        {activeAssessment?.questions.map((q, i) => {
                            const userAnswer = answers[q.id];
                            const isCorrect = userAnswer === q.correctAnswer;
                            
                            return (
                                <div key={i} style={{ pageBreakInside: 'avoid', borderBottom: '1px solid #eee', paddingBottom: '3mm' }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '2mm', fontSize: '14px' }}>{i + 1}. {q.questionText}</div>
                                    
                                    {/* Options Display */}
                                    {q.options && q.options.length > 0 ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2mm', fontSize: '12px', marginBottom: '2mm' }}>
                                            {q.options.map((opt, idx) => (
                                                <div key={idx} style={{ display: 'flex', gap: '5px', color: opt === q.correctAnswer ? 'green' : (opt === userAnswer && !isCorrect ? 'red' : 'black') }}>
                                                    <span style={{ fontWeight: 'bold' }}>{String.fromCharCode(65 + idx)}.</span>
                                                    <span>{opt}</span>
                                                    {opt === q.correctAnswer && <span style={{fontWeight:'bold'}}>(Correct)</span>}
                                                    {opt === userAnswer && opt !== q.correctAnswer && <span style={{fontWeight:'bold'}}>(Your Choice)</span>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '12px', marginBottom: '2mm' }}>
                                            <p><strong>Your Answer:</strong> {userAnswer || '(No Answer)'}</p>
                                            <p style={{ color: 'green' }}><strong>Correct Answer:</strong> {q.correctAnswer}</p>
                                        </div>
                                    )}

                                    {/* Status Line */}
                                    <div style={{ fontSize: '12px', marginTop: '1mm' }}>
                                        {isCorrect ? 
                                            <span style={{ color: 'green', fontWeight: 'bold' }}>✓ Correct</span> : 
                                            <span style={{ color: 'red', fontWeight: 'bold' }}>✗ Incorrect</span>
                                        }
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

          </div>
       );
    }

    // --- CODE ENTRY SCREEN ---
    return (
      <div className="max-w-md mx-auto p-6 animate-fade-in mt-10">
         <div className="flex justify-between items-center mb-4">
             <div>
                <h2 className="font-bold text-lg">{student.studentName}</h2>
                <p className="text-xs text-gray-500">{student.admissionNumber}</p>
             </div>
             <button onClick={() => { setStudent(null); setMode('selection'); setManualStudentId({schoolId:'',admissionNumber:''}); }} className="text-red-500 text-xs font-bold hover:underline">Logout</button>
         </div>

         <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Enter Assessment Code</h3>
            <input 
               type="text" 
               className="w-full text-center text-3xl font-mono tracking-widest p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none uppercase mb-6"
               placeholder="ABC-123"
               value={examCodeInput}
               onChange={e => setExamCodeInput(e.target.value.toUpperCase())}
               maxLength={8}
            />
            <button 
               onClick={handleStartExam} 
               disabled={loading}
               className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg"
            >
               {loading ? <Loader2 className="animate-spin"/> : <Play size={20} />} Start Assessment
            </button>
            {error && <p className="text-red-500 mt-4 text-sm font-bold bg-red-50 p-2 rounded border border-red-100">{error}</p>}
         </div>
      </div>
    );
  }

  return null;
};

export default CbtPortal;

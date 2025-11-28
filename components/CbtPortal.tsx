
import React, { useState, useEffect } from 'react';
import { 
  Laptop2, QrCode, Upload, FileText, CheckCircle, Clock, 
  AlertCircle, ChevronRight, Save, User, School, Play, BrainCircuit, Loader2, KeyRound
} from 'lucide-react';
import { 
  collection, addDoc, query, where, getDocs, updateDoc, doc, setDoc 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { generateExamQuestions } from '../services/gemini';
import { 
  TeacherData, StudentData, CbtAssessment, Question, 
  AssessmentType, ResultData, Subject 
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
  const [assessmentForm, setAssessmentForm] = useState({
    subject: '',
    classLevel: '',
    term: 'First Term',
    type: 'ca1' as AssessmentType,
    duration: 30, // minutes
    notes: '',
    generatedQuestions: [] as Question[]
  });

  // Student State
  const [student, setStudent] = useState<StudentData | null>(null);
  const [examCodeInput, setExamCodeInput] = useState('');
  const [activeAssessment, setActiveAssessment] = useState<CbtAssessment | null>(null);
  const [answers, setAnswers] = useState<{[key: number]: string}>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [scoreData, setScoreData] = useState<{score: number, total: number, percentage: number} | null>(null);

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

  // --- HANDLERS ---

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
        assessmentForm.subject
      );
      setAssessmentForm(prev => ({ ...prev, generatedQuestions: questions }));
      setSuccess("Questions generated successfully! You can review them below.");
    } catch (err) {
      setError("Failed to generate questions. Please try again.");
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
        questions: assessmentForm.generatedQuestions,
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      await addDoc(collection(db, 'CBT Assessments'), assessmentPayload);
      setSuccess(`Assessment Created! EXAM CODE: ${examCode}`);
      setAssessmentForm(prev => ({ ...prev, generatedQuestions: [], notes: '' })); // Reset
    } catch (err) {
      setError("Failed to save assessment.");
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

    // Calculate Score
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

    setScoreData({
      score: finalScore,
      total: maxScore,
      percentage: Math.round(percentage)
    });

    try {
      // Update Result Data in Firebase
      const qResult = query(collection(db, 'Result Data'), 
        where("schoolId", "==", student.schoolId),
        where("admissionNumber", "==", student.admissionNumber),
        where("term", "==", activeAssessment.term)
        // Note: Ideally filter by session too
      );
      
      const resultSnap = await getDocs(qResult);
      
      if (!resultSnap.empty) {
        // Update existing result sheet
        const docRef = resultSnap.docs[0].ref;
        const resultData = resultSnap.docs[0].data() as ResultData;
        
        let subjects = [...(resultData.subjects || [])];
        const subIndex = subjects.findIndex(s => s.name === activeAssessment.subject);
        
        if (subIndex > -1) {
          // Update existing subject
          // We cast to any to update dynamic key 'ca1', 'ca2', 'exam'
          (subjects[subIndex] as any)[activeAssessment.type] = finalScore;
          
          // Recalculate Total
          const s = subjects[subIndex];
          const ca1 = Number(s.ca1) || 0;
          const ca2 = Number(s.ca2) || 0;
          const exam = Number(s.exam) || 0;
          subjects[subIndex].total = ca1 + ca2 + exam; // Note: one of these is the new score
        } else {
          // Add new subject
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
        // Create new Partial Result Sheet
        // This is complex, usually we'd want a result sheet to exist first.
        // For now, we'll just log it or maybe create a placeholder.
        // DECISION: Only update if Result Sheet exists to ensure data integrity.
        // User should "Create Result" first.
        console.warn("Result sheet not found, could not auto-update score.");
        setSuccess("Score calculated, but Result Sheet not found to update. Please inform admin.");
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
      <div className="max-w-4xl mx-auto p-4 animate-fade-in">
        <div className="flex justify-between items-center mb-6">
           <div>
             <h2 className="text-2xl font-bold text-gray-800">Welcome, {teacher.teacherName}</h2>
             <p className="text-gray-500 text-sm">{teacher.schoolName}</p>
           </div>
           <button onClick={() => { setTeacher(null); setMode('selection'); setManualTeacherId(''); }} className="text-red-500 font-bold text-sm hover:underline">Logout</button>
        </div>

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
                  value={assessmentForm.subject}
                  onChange={e => setAssessmentForm({...assessmentForm, subject: e.target.value})}
                >
                   <option value="">Select Subject</option>
                   {ALL_NIGERIAN_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
             <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Assessment Type</label>
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

           <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Lesson Notes / Topic Content</label>
              <textarea 
                 className="w-full p-3 border rounded-lg h-32 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                 placeholder="Paste your lesson notes, topic summary, or manually typed questions here. The AI will generate multiple choice questions from this text."
                 value={assessmentForm.notes}
                 onChange={e => setAssessmentForm({...assessmentForm, notes: e.target.value})}
              ></textarea>
           </div>
           
           <button 
             onClick={handleGenerateQuestions} 
             disabled={loading}
             className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-purple-700 disabled:opacity-50 shadow-md transition"
           >
             {loading ? <Loader2 className="animate-spin" size={18} /> : <BrainCircuit size={18} />} 
             Generate Questions with AI
           </button>

           {success && <div className="mt-4 bg-green-50 text-green-700 p-3 rounded font-bold border border-green-200">{success}</div>}
           {error && <div className="mt-4 bg-red-50 text-red-700 p-3 rounded font-bold border border-red-200">{error}</div>}
        </div>

        {/* Generated Questions Review */}
        {assessmentForm.generatedQuestions.length > 0 && (
           <div className="bg-white rounded-xl shadow-lg p-6 animate-slide-up">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-bold text-gray-800">Review Questions ({assessmentForm.generatedQuestions.length})</h3>
                 <button 
                    onClick={handleSaveAssessment}
                    disabled={loading}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 shadow-md transition"
                 >
                    <Save size={18} /> Save & Publish Assessment
                 </button>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                 {assessmentForm.generatedQuestions.map((q, i) => (
                    <div key={i} className="p-4 border rounded-lg bg-gray-50">
                       <p className="font-bold text-gray-800 mb-2">{i+1}. {q.questionText}</p>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {q.options.map((opt, idx) => (
                             <div key={idx} className={`text-sm p-2 rounded ${opt === q.correctAnswer ? 'bg-green-200 text-green-800 font-bold' : 'bg-white border'}`}>
                                {opt}
                             </div>
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}
      </div>
    );
  }

  // Student Exam Mode
  if (mode === 'student_exam' && student) {
    if (activeAssessment && !scoreData) {
       // --- TAKING EXAM ---
       return (
         <div className="max-w-3xl mx-auto p-4 animate-fade-in pb-20">
            {/* Header */}
            <div className="bg-white p-4 rounded-xl shadow-sm border-b sticky top-0 z-10 flex justify-between items-center mb-6">
               <div>
                  <h2 className="font-bold text-gray-800">{activeAssessment.subject} <span className="text-gray-400 text-sm font-normal">| {activeAssessment.type.toUpperCase()}</span></h2>
                  <p className="text-xs text-gray-500">Student: {student.studentName}</p>
               </div>
               <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold text-xl ${timeLeft < 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-800'}`}>
                  <Clock size={20} /> {formatTime(timeLeft)}
               </div>
            </div>

            {/* Questions */}
            <div className="space-y-6">
               {activeAssessment.questions.map((q, i) => (
                  <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                     <p className="font-bold text-lg text-gray-800 mb-4"><span className="text-blue-500 mr-2">{i+1}.</span>{q.questionText}</p>
                     <div className="space-y-2">
                        {q.options.map((opt, idx) => (
                           <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition ${answers[q.id] === opt ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200'}`}>
                              <input 
                                type="radio" 
                                name={`q-${q.id}`} 
                                value={opt} 
                                checked={answers[q.id] === opt}
                                onChange={() => setAnswers(prev => ({...prev, [q.id]: opt}))}
                                className="w-5 h-5 text-blue-600"
                              />
                              <span className="text-gray-700">{opt}</span>
                           </label>
                        ))}
                     </div>
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
    } else if (scoreData) {
       // --- RESULT SCREEN ---
       return (
          <div className="max-w-md mx-auto p-6 mt-10 text-center animate-slide-up">
             <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                   <CheckCircle className="text-green-600" size={40} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Assessment Completed!</h2>
                <p className="text-gray-500 mb-6">Your responses have been recorded and your result sheet updated.</p>
                
                <div className="bg-gray-50 p-6 rounded-xl mb-6">
                   <p className="text-sm font-bold text-gray-500 uppercase">Your Score</p>
                   <p className="text-5xl font-bold text-blue-600 my-2">{scoreData.score}<span className="text-xl text-gray-400">/{scoreData.total}</span></p>
                   <p className="text-sm font-bold text-gray-400">{scoreData.percentage}% Accuracy</p>
                </div>

                {success && <p className="text-green-600 text-xs font-bold mb-4 bg-green-50 p-2 rounded">{success}</p>}
                
                <button onClick={() => { setStudent(null); setMode('selection'); setManualStudentId({schoolId:'',admissionNumber:''}); }} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition">
                   Return to Portal
                </button>
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

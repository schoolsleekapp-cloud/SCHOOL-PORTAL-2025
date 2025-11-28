
import React, { useRef, useState } from 'react';
import { FileDown, FileType, MapPin, Phone, Mail, Clock, Share2, Loader2 } from 'lucide-react';
import { ResultData } from '../types';
import { storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Add html2pdf to window type
declare global {
  interface Window {
    html2pdf: any;
  }
}

interface ResultTemplateProps {
  data: ResultData;
  showDownloads?: boolean;
}

const ResultTemplate: React.FC<ResultTemplateProps> = ({ data, showDownloads = false }) => {
  const themeColor = data.themeColor || '#6b21a8';
  const sheetRef = useRef<HTMLDivElement>(null);
  // Ref for the hidden container used for "Perfect A4" PDF generation
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  
  const [sharing, setSharing] = useState(false);

  // Compute Student Average
  const totalScoreSum = data.subjects.reduce((acc, sub) => acc + (Number(sub.total) || 0), 0);
  const studentAverage = data.subjects.length > 0 ? (totalScoreSum / data.subjects.length).toFixed(2) : "0.00";

  const handleDownloadPDF = () => {
    if (!window.html2pdf) {
      alert("PDF Library loading... Please wait a moment and try again.");
      return;
    }
    
    // Use the hidden container which is sized exactly for A4 PDF output
    const element = pdfContainerRef.current;
    
    const opt = {
      margin: 0, 
      filename: `${data.studentName}_Result.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 }, // scrollY: 0 fixes the top whitespace issue
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    window.html2pdf().set(opt).from(element).save();
  };

  const handleShareWhatsApp = async () => {
    if (!window.html2pdf || !pdfContainerRef.current) return;
    if (!data.parentPhone) {
        alert("Parent phone number is not available for this student.");
        return;
    }

    setSharing(true);
    const element = pdfContainerRef.current;
    
    const opt = {
      margin: 0, 
      filename: `${data.studentName}_Result.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 }, 
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        // 1. Generate PDF as Blob
        const pdfBlob = await window.html2pdf().set(opt).from(element).output('blob');
        
        // 2. Upload to Firebase Storage
        const fileName = `results/${data.schoolId}/${data.studentName}_${Date.now()}.pdf`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, pdfBlob);
        
        // 3. Get Download URL
        const downloadUrl = await getDownloadURL(storageRef);
        
        // 4. Format Phone Number (Assume Nigerian for now, strip leading 0 add 234)
        let phone = data.parentPhone.replace(/\D/g, ''); // Remove non-digits
        if (phone.startsWith('0')) phone = '234' + phone.substring(1);
        
        // 5. Open WhatsApp
        const message = `Hello, please find the result for ${data.studentName} here: ${downloadUrl}`;
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        
        window.open(whatsappUrl, '_blank');
        
    } catch (error) {
        console.error("Error sharing result:", error);
        alert("Failed to share result. Please try downloading instead.");
    } finally {
        setSharing(false);
    }
  };

  const handleDownloadWord = () => {
    if (!sheetRef.current) return;
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Result Sheet</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + sheetRef.current.innerHTML + footer;
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `${data.studentName}_Result.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  // Reusable Content to keep preview and pdf identical
  const ResultContent = ({ isPdfMode = false }) => (
    <div className={`bg-white w-full ${isPdfMode ? 'h-[297mm] overflow-hidden' : 'min-h-[297mm]'} relative ${!isPdfMode ? 'shadow-2xl' : ''}`}>
        {/* Header */}
        <div style={{ backgroundColor: themeColor }} className="text-white p-4 relative overflow-hidden flex flex-col items-center justify-center">
          <div className="flex items-center gap-6 w-full justify-center px-4">
            {data.schoolLogo && (
              <div className="w-20 h-20 bg-white rounded-lg p-1 shadow-lg flex-shrink-0 flex items-center justify-center">
                <img src={data.schoolLogo} alt="Logo" className="w-full h-full object-contain rounded" />
              </div>
            )}
            <div className="text-center flex-1">
              <h1 className="text-xl md:text-3xl font-serif font-bold uppercase leading-tight mb-1">{data.schoolName || "School Name"}</h1>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] md:text-xs opacity-90 mb-2">
                {data.schoolAddress && <span className="flex items-center gap-1"><MapPin size={10}/> {data.schoolAddress}</span>}
                {data.schoolPhone && <span className="flex items-center gap-1"><Phone size={10}/> {data.schoolPhone}</span>}
                {data.schoolEmail && <span className="flex items-center gap-1"><Mail size={10}/> {data.schoolEmail}</span>}
              </div>
              <div className="inline-block border-t border-white/30 pt-1">
                <h2 className="text-xs font-medium tracking-[0.2em] uppercase">Termly Report Sheet</h2>
                <div className="flex justify-center gap-4 mt-1 opacity-80 text-[10px]">
                  <span>ID: {data.schoolId}</span><span>|</span><span>Year: {data.year}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Body */}
        <div className="p-4 md:p-8 space-y-2">
          <div className="grid grid-cols-4 gap-2 text-xs border-b pb-2">
            <div><span className="block text-gray-400 uppercase text-[9px]">Student</span><span className="font-bold">{data.studentName}</span></div>
            <div><span className="block text-gray-400 uppercase text-[9px]">Admin No</span><span className="font-bold">{data.admissionNumber}</span></div>
            <div><span className="block text-gray-400 uppercase text-[9px]">Class</span><span className="font-bold">{data.classLevel} {data.position && `(${data.position})`}</span></div>
            <div><span className="block text-gray-400 uppercase text-[9px]">Term</span><span className="font-bold">{data.term}, {data.session}</span></div>
          </div>
          
          <div className="flex justify-between bg-gray-50 p-2 rounded border border-gray-200 text-xs">
            <span className="font-bold text-gray-600 flex items-center gap-1"><Clock size={12}/> ATTENDANCE:</span>
            <div className="space-x-4">
              <span>Days Opened: <b>{data.attendance?.total || 0}</b></span>
              <span>Days Present: <b>{data.attendance?.present || 0}</b></span>
              <span>Percentage: <b>{data.attendance?.total > 0 ? Math.round((data.attendance.present / data.attendance.total) * 100) : 0}%</b></span>
            </div>
          </div>
          
          <div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ borderBottomColor: themeColor }} className="border-b-2 text-xs uppercase tracking-wider text-gray-600">
                  <th className="py-1">Subject</th>
                  <th className="py-1 text-center">CA1</th>
                  <th className="py-1 text-center">CA2</th>
                  <th className="py-1 text-center">Exam</th>
                  <th className="py-1 text-center">Total</th>
                  <th className="py-1 text-center">Avg</th>
                  <th className="py-1 text-center">Grade</th>
                  <th className="py-1 text-right">Remark</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 text-sm">
                {data.subjects.map((sub, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1 font-medium truncate max-w-[150px]">{sub.name}</td>
                    <td className="py-1 text-center text-gray-500">{sub.ca1 || 0}</td>
                    <td className="py-1 text-center text-gray-500">{sub.ca2 || 0}</td>
                    <td className="py-1 text-center text-gray-500">{sub.exam}</td>
                    <td className="py-1 text-center font-bold text-black">{sub.total}</td>
                    <td className="py-1 text-center text-gray-500">{sub.average || '-'}</td>
                    <td className="py-1 text-center font-bold"><span style={{ color: sub.grade.includes('F') ? '#dc2626' : themeColor }}>{sub.grade}</span></td>
                    <td className="py-1 text-right uppercase text-gray-500">{sub.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="border rounded p-2">
              <h4 style={{ color: themeColor }} className="font-bold text-[10px] uppercase mb-1 border-b pb-1">Affective Domain (1-5)</h4>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px]">
                {data.affective?.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-600">{item.name}</span>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, r) => (
                        <div key={r} className={`w-1.5 h-1.5 rounded-full ${r < item.rating ? 'bg-gray-800' : 'bg-gray-200'}`}></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border rounded p-2">
              <h4 style={{ color: themeColor }} className="font-bold text-[10px] uppercase mb-1 border-b pb-1">Psychomotor Skills (1-5)</h4>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px]">
                {data.psychomotor?.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-600">{item.name}</span>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, r) => (
                        <div key={r} className={`w-1.5 h-1.5 rounded-full ${r < item.rating ? 'bg-gray-800' : 'bg-gray-200'}`}></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="border border-gray-200 p-2 rounded bg-gray-50">
              <h4 style={{ color: themeColor }} className="font-bold text-[10px] uppercase mb-1">Class Teacher's Remark</h4>
              <p className="text-gray-600 italic font-serif leading-snug text-xs">"{data.teacherRemark}"</p>
              <div className="mt-2 border-t border-gray-300 pt-1 flex justify-between items-center">
                <span className="text-[9px] text-gray-400">Signature & Date</span>
                <div className="h-4 w-16 bg-gray-200 opacity-20 transform -rotate-3"></div>
              </div>
            </div>
            <div className="border border-gray-200 p-2 rounded bg-gray-50">
              <h4 style={{ color: themeColor }} className="font-bold text-[10px] uppercase mb-1">Principal's Remark</h4>
              <p className="text-gray-600 italic font-serif leading-snug text-xs">"{data.principalRemark}"</p>
              <div className="mt-2 border-t border-gray-300 pt-1 flex justify-between items-center">
                <span className="text-[9px] text-gray-400">Signature & Stamp</span>
                <div className="h-6 w-6 rounded-full border-2 opacity-20" style={{ borderColor: themeColor }}></div>
              </div>
            </div>
          </div>
          
          <div className="text-center border-t pt-2 mt-2">
              <span className="text-xs font-bold uppercase text-gray-500">Student's Term Average: </span>
              <span className="text-xl font-bold text-black ml-2">{studentAverage}%</span>
          </div>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center w-full">
      {/* On-Screen Preview Container */}
      <div 
        id="result-sheet-container" 
        ref={sheetRef} 
        className="w-full max-w-[210mm] mt-4 mb-4 mx-auto print-container"
      >
        <ResultContent />
      </div>
      
      {/* Hidden Container for Perfect A4 PDF Generation */}
      {/* Positioned absolutely at top-left to avoid any offset issues during html2canvas capture */}
      <div className="absolute top-0 left-0 -z-50 pointer-events-none opacity-0">
        <div ref={pdfContainerRef} style={{ width: '210mm', height: '297mm' }}>
             <ResultContent isPdfMode={true} />
        </div>
      </div>

      {showDownloads && (
        <div className="w-full max-w-3xl flex flex-wrap gap-4 justify-center print:hidden mt-8 pt-6 border-t border-gray-200 animate-fade-in">
            <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-8 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors text-sm font-bold shadow-lg">
               <FileDown size={18}/> Download PDF
            </button>
            <button onClick={handleShareWhatsApp} disabled={sharing} className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors text-sm font-bold shadow-lg">
               {sharing ? <Loader2 size={18} className="animate-spin"/> : <Share2 size={18}/>} Share via WhatsApp
            </button>
            <button onClick={handleDownloadWord} className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors text-sm font-bold shadow-lg">
               <FileType size={18}/> Download Word
            </button>
        </div>
      )}
    </div>
  );
};

export default ResultTemplate;


import React, { useRef } from 'react';
import QRCode from "react-qr-code";
import { Download, School, User, BadgeCheck } from 'lucide-react';
import { TeacherData } from '../types';

// Add html2pdf to window type
declare global {
  interface Window {
    html2pdf: any;
  }
}

interface TeacherIdCardProps {
  teacher: TeacherData;
  onClose: () => void;
}

const TeacherIdCard: React.FC<TeacherIdCardProps> = ({ teacher, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const downloadPDF = () => {
    if (!window.html2pdf || !printRef.current) return;
    const element = printRef.current;
    
    // Construct filename
    const filename = `${teacher.teacherName.replace(/\s+/g, '_')}_${teacher.generatedId}_Teacher_ID.pdf`;

    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 4, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    window.html2pdf().set(opt).from(element).save();
  };

  // Reusable Card Design Component
  const CardDesign = ({ width, height, className }: { width: string, height: string, className?: string }) => (
    <div 
        className={`bg-gradient-to-br from-slate-800 to-black relative overflow-hidden text-white ${className}`}
        style={{ width, height, fontFamily: 'Inter, sans-serif' }}
    >
         {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 rounded-full blur-[60px] opacity-20 transform translate-x-10 -translate-y-10"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500 rounded-full blur-[40px] opacity-20 transform -translate-x-5 translate-y-5"></div>
        
        {/* Header */}
        <div className="absolute top-0 left-0 w-full p-4 flex items-center justify-between border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-white rounded flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                {teacher.schoolLogo ? (
                <img src={teacher.schoolLogo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                <School className="text-slate-800 w-6 h-6" />
                )}
            </div>
            <div className="leading-tight">
                <h2 className="font-bold text-xs uppercase tracking-wide text-yellow-500">Authorized Personnel</h2>
                <h1 className="font-bold text-sm truncate w-40">{teacher.schoolName || "School Name"}</h1>
            </div>
          </div>
          <BadgeCheck className="text-yellow-500 w-6 h-6" />
        </div>

        {/* Content */}
        <div className="absolute top-20 left-4 w-full flex gap-5 items-end">
           {/* Photo Placeholder */}
           <div className="w-24 h-28 bg-slate-700 rounded-md border border-slate-600 shadow-inner flex items-center justify-center shrink-0">
              <User className="text-slate-500 w-12 h-12" />
           </div>

           {/* Details */}
           <div className="space-y-3 pb-1">
              <div>
                <p className="text-[8px] uppercase text-slate-400 font-bold tracking-wider">Staff Name</p>
                <p className="font-bold text-lg leading-tight w-48 truncate">{teacher.teacherName}</p>
              </div>
              <div>
                <p className="text-[8px] uppercase text-slate-400 font-bold tracking-wider">Teacher ID</p>
                <p className="font-mono text-sm font-bold text-yellow-400 tracking-wide bg-white/10 px-2 py-0.5 rounded inline-block">{teacher.generatedId}</p>
              </div>
              <div>
                <p className="text-[8px] uppercase text-slate-400 font-bold tracking-wider">Role</p>
                <p className="font-medium text-xs text-slate-200">Academic Staff</p>
              </div>
           </div>
        </div>
        
        {/* Footer */}
        <div className="absolute bottom-0 w-full bg-yellow-500 h-1.5"></div>
        <div className="absolute bottom-2.5 left-4 text-[7px] text-slate-500">
           <p>Property of {teacher.schoolName}</p>
        </div>

        {/* QR Code */}
        <div className="absolute bottom-3 right-3 bg-white p-1 rounded-md shadow-lg border border-white/20">
           <div style={{ height: "40px", width: "40px" }}>
            <QRCode
              size={256}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              value={JSON.stringify({
                id: teacher.generatedId,
                nm: teacher.teacherName,
                sc: teacher.schoolId
              })}
              viewBox={`0 0 256 256`}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#000000"
            />
          </div>
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-6">
        <div className="flex justify-between items-center border-b pb-4">
          <h3 className="text-xl font-bold text-gray-800">Teacher ID Card</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="flex justify-center">
            {/* Visual Preview */}
            <CardDesign width="342px" height="216px" className="rounded-xl shadow-lg" />
        </div>

        <div className="space-y-3">
          <p className="text-center text-sm text-gray-500">
            Teacher ID <b>{teacher.generatedId}</b> generated successfully.
          </p>
          <div className="flex gap-3">
             <button onClick={downloadPDF} className="flex-1 bg-yellow-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-yellow-700 transition flex items-center justify-center gap-2">
               <Download size={18} /> Download PDF
             </button>
             <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition">
               Done
             </button>
          </div>
        </div>
      </div>

      {/* Hidden Container for PDF Generation - Fits A4 Page */}
      {/* Used opacity-0 instead of invisible to ensure html2canvas captures it */}
      <div className="fixed top-0 left-0 -z-50 opacity-0 pointer-events-none">
        <div ref={printRef} style={{ width: '210mm', height: '297mm', background: 'white', padding: '15mm' }}>
             <div style={{ marginBottom: '10mm', fontFamily: 'sans-serif' }}>
                 <h1 style={{ fontSize: '18pt', fontWeight: 'bold', color: '#333' }}>Staff Identity Card</h1>
                 <p style={{ fontSize: '12pt', color: '#666' }}>{teacher.schoolName}</p>
                 <hr style={{ marginTop: '5mm', borderColor: '#eee' }} />
             </div>
             {/* Standard CR80 Size: 85.6mm x 54mm */}
            <CardDesign width="85.6mm" height="54mm" className="rounded-lg border border-gray-200" />
        </div>
      </div>
    </div>
  );
};

export default TeacherIdCard;

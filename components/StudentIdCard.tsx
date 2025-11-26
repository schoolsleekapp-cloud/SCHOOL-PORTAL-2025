import React, { useRef } from 'react';
import QRCode from "react-qr-code";
import { Download, School, User } from 'lucide-react';
import { StudentData } from '../types';

interface StudentIdCardProps {
  student: StudentData;
  onClose: () => void;
}

const StudentIdCard: React.FC<StudentIdCardProps> = ({ student, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const downloadPDF = () => {
    if (!window.html2pdf || !printRef.current) return;
    const element = printRef.current;
    
    // Construct filename: StudentName_ID_ID_Card.pdf
    const filename = `${student.studentName.replace(/\s+/g, '_')}_${student.generatedId || 'ID'}_ID_Card.pdf`;

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
        className={`bg-gradient-to-r from-blue-700 to-blue-900 relative overflow-hidden text-white ${className}`}
        style={{ width, height, fontFamily: 'Inter, sans-serif' }}
    >
         {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
        
        {/* Header */}
        <div className="absolute top-0 left-0 w-full p-3 flex items-center gap-3 bg-black/10 backdrop-blur-sm border-b border-white/10">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 overflow-hidden border-2 border-white shadow-md">
            {student.schoolLogo ? (
              <img src={student.schoolLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <School className="text-blue-700 w-6 h-6" />
            )}
          </div>
          <div className="leading-tight overflow-hidden">
            <h2 className="font-bold text-sm uppercase tracking-wide truncate w-48 drop-shadow-sm">{student.schoolName || "School Name"}</h2>
            <p className="text-[9px] text-blue-100 font-medium tracking-wider">OFFICIAL STUDENT ID</p>
          </div>
        </div>

        {/* Content */}
        <div className="absolute top-16 left-4 flex gap-4 items-start">
           {/* Photo Placeholder */}
           <div className="w-20 h-24 bg-gray-100 rounded-lg border-2 border-white shadow-lg flex items-center justify-center shrink-0 overflow-hidden">
              <User className="text-gray-300 w-10 h-10" />
           </div>

           {/* Details */}
           <div className="space-y-1.5 mt-0.5">
              <div>
                <p className="text-[7px] uppercase text-blue-200 font-semibold tracking-wider">Student Name</p>
                <p className="font-bold text-sm leading-tight w-36 truncate drop-shadow-sm">{student.studentName}</p>
              </div>
              <div>
                <p className="text-[7px] uppercase text-blue-200 font-semibold tracking-wider">ID Number</p>
                <p className="font-mono text-xs font-bold text-yellow-300 tracking-wide">{student.generatedId}</p>
              </div>
              <div className="flex gap-4">
                 <div>
                    <p className="text-[7px] uppercase text-blue-200 font-semibold tracking-wider">Class</p>
                    <p className="font-bold text-xs">{student.classLevel}</p>
                 </div>
                 <div>
                    <p className="text-[7px] uppercase text-blue-200 font-semibold tracking-wider">Admission No</p>
                    <p className="font-bold text-xs">{student.admissionNumber}</p>
                 </div>
              </div>
           </div>
        </div>

        {/* QR Code - Redesigned for Readability */}
        <div className="absolute bottom-3 right-3 bg-white p-2 rounded-lg shadow-xl border-2 border-white">
           <div style={{ height: "48px", width: "48px" }}>
            <QRCode
              size={256}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              value={JSON.stringify({
                id: student.generatedId,
                nm: student.studentName,
                sc: student.schoolId,
                ad: student.admissionNumber
              })}
              viewBox={`0 0 256 256`}
              level="L" // Low error correction for less density (easier to scan)
              bgColor="#FFFFFF"
              fgColor="#000000"
            />
          </div>
        </div>
        
        <div className="absolute bottom-2 left-4 text-[7px] text-blue-200 opacity-80 font-medium">
           If found, please return to school authority.
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-6">
        <div className="flex justify-between items-center border-b pb-4">
          <h3 className="text-xl font-bold text-gray-800">Student ID Card Generated</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="flex justify-center">
            {/* Visual Preview on Screen (Scaled nicely for visibility) */}
            <CardDesign width="342px" height="216px" className="rounded-xl shadow-lg" />
        </div>

        <div className="space-y-3">
          <p className="text-center text-sm text-gray-500">
            A unique Student ID <b>{student.generatedId}</b> has been generated.
          </p>
          <div className="flex gap-3">
             <button onClick={downloadPDF} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition flex items-center justify-center gap-2">
               <Download size={18} /> Download PDF
             </button>
             <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition">
               Done
             </button>
          </div>
        </div>
      </div>

      {/* Hidden Container for PDF Generation - Fits A4 Page */}
      <div className="fixed top-0 left-0 -z-50 invisible pointer-events-none">
        <div ref={printRef} style={{ width: '210mm', height: '297mm', background: 'white', padding: '15mm' }}>
             <div style={{ marginBottom: '10mm', fontFamily: 'sans-serif' }}>
                 <h1 style={{ fontSize: '18pt', fontWeight: 'bold', color: '#333' }}>Student Identity Card</h1>
                 <p style={{ fontSize: '12pt', color: '#666' }}>{student.schoolName}</p>
                 <hr style={{ marginTop: '5mm', borderColor: '#eee' }} />
             </div>
             {/* 
                Standard CR80 Size: 85.6mm x 54mm 
                This ensures the printed card is the correct physical size.
             */}
            <CardDesign width="85.6mm" height="54mm" className="rounded-lg border border-gray-200" />
        </div>
      </div>
    </div>
  );
};

export default StudentIdCard;
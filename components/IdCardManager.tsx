
import React, { useState, useRef } from 'react';
import QRCode from "react-qr-code";
import { Search, Filter, ArrowUpDown, FileDown, User, BadgeCheck } from 'lucide-react';
import { StudentData, TeacherData } from '../types';

interface IdCardManagerProps {
  students: StudentData[];
  teachers: TeacherData[];
}

type FilterType = 'all' | 'student' | 'teacher';
type SortType = 'name' | 'school';

const IdCardManager: React.FC<IdCardManagerProps> = ({ students, teachers }) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('name');
  const [search, setSearch] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  // Combine and normalize data
  const combinedData = [
    ...students.map(s => ({ ...s, type: 'student' as const, name: s.studentName, id: s.generatedId })),
    ...teachers.map(t => ({ ...t, type: 'teacher' as const, name: t.teacherName, id: t.generatedId }))
  ];

  // Filter and Sort
  const filteredData = combinedData
    .filter(item => {
      const matchesType = filter === 'all' || item.type === filter;
      const matchesSearch = item.name?.toLowerCase().includes(search.toLowerCase()) || 
                            item.schoolName?.toLowerCase().includes(search.toLowerCase()) ||
                            item.id?.toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    })
    .sort((a, b) => {
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sort === 'school') return (a.schoolName || '').localeCompare(b.schoolName || '');
      return 0;
    });

  const generatePDF = () => {
    if (!window.html2pdf || !printRef.current) return;
    const element = printRef.current;
    
    // A4 is 210mm x 297mm.
    // We target a specific margin to align the grid perfectly.
    const opt = {
      margin: 0, // We control margins inside the container
      filename: `ID_Card_Directory_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 1.0 }, // Max quality for QR codes
      html2canvas: { scale: 3, useCORS: true }, // Higher scale for crisp text
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    window.html2pdf().set(opt).from(element).save();
  };

  // Split data into chunks of 10 for pagination (2 cols x 5 rows)
  const chunkData = (data: any[], size: number) => {
    const chunks = [];
    for (let i = 0; i < data.length; i += size) {
      chunks.push(data.slice(i, i + size));
    }
    return chunks;
  };

  const pages = chunkData(filteredData, 10);

  return (
    <div className="space-y-6">
       {/* Controls */}
       <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by Name, School or ID..." 
            className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="pl-9 pr-8 py-2 border rounded-lg appearance-none bg-white outline-none cursor-pointer text-sm font-medium"
            >
              <option value="all">All Cards</option>
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
            </select>
          </div>
          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              value={sort} 
              onChange={(e) => setSort(e.target.value as SortType)}
              className="pl-9 pr-8 py-2 border rounded-lg appearance-none bg-white outline-none cursor-pointer text-sm font-medium"
            >
              <option value="name">Sort Name</option>
              <option value="school">Sort School</option>
            </select>
          </div>
          <button 
            onClick={generatePDF}
            className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-700 ml-auto"
          >
            <FileDown size={18} /> Export PDF
          </button>
        </div>
      </div>

       {/* List View Preview */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredData.map((item, idx) => (
          <div key={idx} className="bg-white border rounded-lg p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${item.type === 'student' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'}`}>
               {item.type === 'student' ? <User size={24} /> : <BadgeCheck size={24} />}
            </div>
            <div className="overflow-hidden">
               <h3 className="font-bold text-gray-800 truncate">{item.name}</h3>
               <p className="text-xs text-gray-500 truncate">{item.schoolName}</p>
               <div className="flex items-center gap-2 mt-1">
                 <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${item.type === 'student' ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'}`}>{item.type}</span>
                 <span className="text-[10px] text-gray-400 font-mono">{item.id}</span>
               </div>
            </div>
          </div>
        ))}
        {filteredData.length === 0 && (
           <div className="col-span-full text-center py-12 text-gray-500">
             No ID Cards matching your criteria.
           </div>
        )}
      </div>

       {/* Hidden PDF Container */}
       <div className="fixed top-0 left-0 -z-50 invisible pointer-events-none">
        <div ref={printRef}>
          {pages.map((pageItems, pageIndex) => (
             <div key={pageIndex} style={{
                width: '210mm', // Full A4 Width
                height: '297mm', // Full A4 Height
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 85.6mm)', // Precise Card Width for CR80
                gridTemplateRows: 'repeat(5, 54mm)', // Precise Card Height for CR80
                columnGap: '10mm',
                rowGap: '4mm', // Tuned to fit vertical space within margins
                paddingTop: '6mm', // Top Margin
                paddingLeft: '14.4mm', // Left Margin to center: (210 - (85.6*2 + 10)) / 2 = 14.4
                backgroundColor: 'white',
                pageBreakAfter: 'always',
                boxSizing: 'border-box'
             }}>
                {pageItems.map((item, idx) => (
                  <div key={idx} style={{
                     width: '85.6mm',
                     height: '54mm',
                     borderRadius: '8px',
                     overflow: 'hidden',
                     position: 'relative',
                     background: item.type === 'student' ? 'linear-gradient(to right, #1e3a8a, #172554)' : 'linear-gradient(to bottom right, #1e293b, #000)',
                     color: 'white',
                     fontFamily: 'sans-serif',
                     display: 'flex',
                     flexDirection: 'row', // Horizontal layout
                     alignItems: 'center',
                     padding: '3mm',
                     boxSizing: 'border-box',
                     gap: '3mm', // Gap between Text Block and QR Block
                     border: '1px solid #ddd' // Light border for cut lines
                  }}>
                     {/* Text Info Side */}
                     <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', overflow: 'hidden' }}>
                        {/* Header: Logo & School */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                           <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                              {item.schoolLogo ? <img src={item.schoolLogo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="logo"/> : <div style={{fontSize:'6px', color:'#000'}}>LOGO</div>}
                           </div>
                           <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.schoolName?.substring(0, 20)}</div>
                              <div style={{ fontSize: '6px', letterSpacing: '0.5px', opacity: 0.9, color: '#fbbf24' }}>{item.type === 'student' ? 'OFFICIAL STUDENT ID' : 'STAFF IDENTITY CARD'}</div>
                           </div>
                        </div>

                        {/* Details */}
                        <div>
                           <div style={{ fontSize: '14px', fontWeight: '900', lineHeight: '1.1', marginBottom: '6px', whiteSpace: 'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.name}</div>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                 <span style={{ fontSize: '8px', textTransform: 'uppercase', opacity: 0.7, width: '40px' }}>ID No:</span>
                                 <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 'bold' }}>{item.id}</span>
                              </div>
                              {item.type === 'student' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                   <span style={{ fontSize: '8px', textTransform: 'uppercase', opacity: 0.7, width: '40px' }}>Gender:</span>
                                   <span style={{ fontSize: '10px', fontWeight: 'bold' }}>{(item as StudentData).gender}</span>
                                </div>
                              )}
                           </div>
                        </div>
                     </div>

                     {/* QR Code Side - Right Aligned with White Background */}
                     {/* Uses specific styles to match standard QR appearance */}
                     <div style={{
                        width: '32mm',
                        height: '32mm',
                        backgroundColor: 'white', 
                        borderRadius: '4px',
                        padding: '3px', // Quiet zone
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                     }}>
                        <QRCode
                           value={JSON.stringify({ id: item.id, nm: item.name, sc: item.schoolId, ad: (item as any).admissionNumber || 'T' })}
                           size={256}
                           level="M" // Medium error correction for standard density
                           style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                           viewBox={`0 0 256 256`}
                           fgColor="#000000"
                           bgColor="#FFFFFF"
                        />
                     </div>
                  </div>
                ))}
             </div>
          ))}
        </div>
       </div>
    </div>
  );
};

export default IdCardManager;


import React, { useState, useMemo, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, Download, Calendar,
  MapPin, Clock, ArrowLeft, Truck, FileText, ChevronDown, Filter, Loader2, AlertCircle
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { normalizeCompanyName, formatDateToCL } from '../utils/dataProcessor';
import { NovandinoLogo } from './BrandLogo';
import { logActivity, SystemUser } from '../services/firebase';

// Declaraciones para librerías cargadas vía script en index.html
declare const html2canvas: any;
declare const jspdf: any;

interface ArrivalData {
  fecha: string;
  destino: string;
  empresa: string;
  hora: number;
}

interface LlegadaEquiposProps {
  currentUser: SystemUser | null;
  onBack: () => void;
}

const CHART_COLORS = ['#461D77', '#3FAA88', '#C59E4D', '#7177EC', '#4FD1C5', '#171717'];

const getBase64FromUrl = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image at ${url}`);
  }
  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error(`Image at ${url} is empty (0 bytes)`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const CompanyLogo: React.FC<{ company: string; className?: string }> = ({ company, className = '' }) => {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    const compUpper = String(company || '').trim().toUpperCase();
    
    // Choose the logo filename
    let filename = '';
    if (compUpper.includes("COSEDUCAM")) {
      filename = 'coseducam.png';
    } else if (compUpper.includes("M&Q") || compUpper.includes("M & Q")) {
      filename = 'mq.png';
    } else if (compUpper.includes("M S & D") || compUpper.includes("MSD") || compUpper.includes("M S AND D")) {
      filename = 'msd.png';
    } else if (compUpper.includes("JORQUERA")) {
      filename = 'jorquera.png';
    } else if (compUpper.includes("AG SERVICES") || compUpper.includes("AG ")) {
      filename = 'ag.png';
    }

    if (!filename) {
      setHasError(true);
      return;
    }

    const tryLoad = async () => {
      try {
        const b64 = await getBase64FromUrl(`/${filename}`);
        if (active) {
          setLogoSrc(b64);
          setHasError(false);
        }
      } catch (err) {
        console.warn(`Could not load PNG logo for ${company} from /${filename}:`, err);
        if (active) setHasError(true);
      }
    };

    tryLoad();
    return () => {
      active = false;
    };
  }, [company]);

  if (logoSrc && !hasError) {
    return (
      <div className={`flex items-center justify-center p-2 h-full w-full ${className}`}>
        <img
          src={logoSrc}
          alt={company}
          className="max-w-full max-h-full object-contain"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  const compUpper = String(company || '').trim().toUpperCase();

  if (compUpper.includes("COSEDUCAM")) {
    return (
      <div className={`flex flex-col items-center justify-center p-2 text-center h-full w-full ${className}`}>
        <svg viewBox="0 0 100 100" className="w-[64px] h-[64px] mb-1 fill-none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50,15 L85,32 L85,68 L50,85 L15,68 L15,32 Z" fill="#fff" stroke="#f59e0b" strokeWidth="6" />
          <circle cx="50" cy="50" r="28" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,3" fill="none" />
          <text x="50" y="58" textAnchor="middle" fill="#f59e0b" fontFamily="system-ui, sans-serif" fontSize="22" fontWeight="900" stroke="none">CS</text>
        </svg>
        <span className="text-[8px] font-black tracking-tight text-amber-600 uppercase leading-none">COSEDUCAM</span>
      </div>
    );
  }
  if (compUpper.includes("M&Q") || compUpper.includes("M & Q")) {
    return (
      <div className={`flex flex-col items-center justify-center p-2 text-center h-full w-full ${className}`}>
        <svg viewBox="0 0 100 100" className="w-[64px] h-[64px] mb-1 fill-none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="20" y="20" width="60" height="60" rx="16" fill="#fff" stroke="#4f46e5" strokeWidth="6" />
          <path d="M32,65 V35 L50,53 L68,35 V65" stroke="#4f46e5" strokeWidth="8" fill="none" />
          <circle cx="68" cy="68" r="10" fill="#fff" stroke="#4f46e5" strokeWidth="3" />
          <path d="M68,68 L77,77" stroke="#4f46e5" strokeWidth="4" />
        </svg>
        <span className="text-[8px] font-black tracking-tight text-indigo-600 uppercase leading-none">M&Q SPA</span>
      </div>
    );
  }
  if (compUpper.includes("M S & D") || compUpper.includes("MSD") || compUpper.includes("M S AND D")) {
    return (
      <div className={`flex flex-col items-center justify-center p-2 text-center h-full w-full ${className}`}>
        <svg viewBox="0 0 100 100" className="w-[64px] h-[64px] mb-1 fill-none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50,15 L85,32 V68 L50,85 L15,68 V32 Z" fill="#fff" stroke="#7177EC" strokeWidth="6" />
          <path d="M28,45 Q50,70 72,45" stroke="#7177EC" strokeWidth="6" fill="none" />
          <text x="50" y="54" textAnchor="middle" fill="#7177EC" fontFamily="system-ui, sans-serif" fontSize="20" fontWeight="900" letterSpacing="-0.02em" stroke="none">MSD</text>
        </svg>
        <span className="text-[8px] font-black tracking-tight text-indigo-500 uppercase leading-none">M S & D SPA</span>
      </div>
    );
  }
  if (compUpper.includes("JORQUERA")) {
    return (
      <div className={`flex flex-col items-center justify-center p-2 text-center h-full w-full ${className}`}>
        <svg viewBox="0 0 100 100" className="w-[64px] h-[64px] mb-1 fill-none" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="50,15 88,40 88,80 12,80 12,40" fill="#fff" stroke="#0d9488" strokeWidth="6" />
          <path d="M25,50 L50,28 L75,50" stroke="#0d9488" strokeWidth="7" fill="none" />
          <text x="50" y="72" textAnchor="middle" fill="#0d9488" fontFamily="system-ui, sans-serif" fontSize="24" fontWeight="900" stroke="none">JQ</text>
        </svg>
        <span className="text-[8px] font-black tracking-tight text-teal-600 uppercase leading-none">JORQUERA</span>
      </div>
    );
  }
  if (compUpper.includes("AG SERVICES") || compUpper.includes("AG ")) {
    return (
      <div className={`flex flex-col items-center justify-center p-2 text-center h-full w-full ${className}`}>
        <svg viewBox="0 0 100 100" className="w-[64px] h-[64px] mb-1 fill-none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="50" cy="50" r="38" fill="#fff" stroke="#0284c7" strokeWidth="6" />
          <circle cx="50" cy="50" r="28" fill="#0284c7" />
          <text x="50" y="58" textAnchor="middle" fill="#fff" fontFamily="system-ui, sans-serif" fontSize="24" fontWeight="950" stroke="none">AG</text>
        </svg>
        <span className="text-[8px] font-black tracking-tight text-sky-600 uppercase leading-none">AG SERVICES</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-2 text-center h-full w-full text-violeta ${className}`}>
      <Truck size={36} className="text-[#461D77]" />
      <span className="text-[8px] font-black tracking-tight text-[#461D77] uppercase leading-none mt-1">{company.slice(0, 12)}</span>
    </div>
  );
};

export const LlegadaEquipos: React.FC<LlegadaEquiposProps> = ({ currentUser, onBack }) => {
  const [data, setData] = useState<ArrivalData[]>(() => {
    try {
      const saved = localStorage.getItem('sqm_llegadas_data');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [hourRange, setHourRange] = useState<[number, number]>([0, 23]);

  // Handle setting initial date and company on mount if data already exists
  useEffect(() => {
    if (data.length > 0 && !selectedDate) {
      const dates = [...new Set(data.map(r => r.fecha))].sort().reverse();
      if (dates.length > 0) {
        setSelectedDate(dates[0]);
        const dayData = data.filter(r => r.fecha === dates[0]);
        const cos = [...new Set(dayData.map(r => r.empresa))].sort();
        if (cos.length > 0) setSelectedCompany(cos[0]);
      }
    }
  }, [data, selectedDate]);

  const processFile = useCallback((file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames.find(n =>
          n.toUpperCase().includes("BASE") ||
          n.toUpperCase().includes("LLEGADA") ||
          n.toUpperCase().includes("DATOS")
        ) || workbook.SheetNames[0];

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];

        if (jsonData.length < 2) throw new Error("Archivo vacío.");

        let headerIdx = -1;
        for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
          const row = jsonData[i].map(c => String(c || '').toUpperCase());
          if (row.includes('FECHA') || row.includes('EMPRESA') || row.includes('PRODUCTO')) {
            headerIdx = i;
            break;
          }
        }

        const startRow = headerIdx !== -1 ? headerIdx : 0;
        const headers = jsonData[startRow].map(h => String(h || '').toUpperCase().trim());

        const getIdx = (name: string, fallback: number) => {
          const found = headers.findIndex(h => h.includes(name.toUpperCase()));
          return found !== -1 ? found : fallback;
        };

        const idx = {
          fecha: getIdx("FECHA", 0),
          destino: getIdx("DESTINO", 3),
          empresa: getIdx("EMPRESA", 11),
          hora: getIdx("HORA", 14)
        };

        const processed: ArrivalData[] = jsonData.slice(startRow + 1).map(row => {
          if (!row || row.length < 2) return null;

          let dateStr = '';
          const rawDate = row[idx.fecha];
          if (rawDate instanceof Date) {
            dateStr = rawDate.toISOString().split('T')[0];
          } else if (typeof rawDate === 'number') {
            const d = new Date((rawDate - 25569) * 86400 * 1000);
            if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
          } else if (typeof rawDate === 'string') {
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              else dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }

          if (!dateStr) return null;

          let horaNum = 0;
          const rawHora = row[idx.hora];
          if (rawHora instanceof Date) {
            horaNum = rawHora.getHours() + (rawHora.getMinutes() / 60);
          } else if (typeof rawHora === 'string' && rawHora.includes(':')) {
            const parts = rawHora.split(':').map(Number);
            horaNum = (parts[0] || 0) + ((parts[1] || 0) / 60);
          } else if (typeof rawHora === 'number') {
            horaNum = rawHora * 24;
          }

          return {
            fecha: dateStr,
            destino: String(row[idx.destino] || 'SIN DESTINO').trim().toUpperCase(),
            empresa: normalizeCompanyName(row[idx.empresa]),
            hora: horaNum
          };
        }).filter((r): r is ArrivalData => r !== null && !!r.fecha && !!r.empresa);

        if (processed.length === 0) throw new Error("No se procesaron datos.");

        setData(processed);
        localStorage.setItem('sqm_llegadas_data', JSON.stringify(processed));

        // Record Arrivals excel upload audit log in Firestore
        if (currentUser) {
          logActivity(
            currentUser,
            'Carga de Datos',
            `Cargó archivo base Excel (${file.name}) con ${processed.length} registros de tránsito y llegadas de equipos.`
          ).catch(err => console.error('Error logging arrivals excel upload:', err));
        }
        const dates = [...new Set(processed.map(r => r.fecha))].sort().reverse();
        if (dates.length > 0) {
          setSelectedDate(dates[0]);
          const dayData = processed.filter(r => r.fecha === dates[0]);
          const cos = [...new Set(dayData.map(r => r.empresa))].sort();
          if (cos.length > 0) setSelectedCompany(cos[0]);
        }
      } catch (err) {
        console.error("Error procesando Excel:", err);
        alert("Error al cargar el archivo.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleExportPDF = async () => {
    if (exportingPDF) return;
    setExportingPDF(true);
    setExportProgress('Iniciando exportación...');
    
    const chartSection = document.getElementById('arrival-chart-section');
    const tableSection = document.getElementById('arrival-table-section');

    if (!chartSection || !tableSection) {
      alert('Error: No se pudieron encontrar las áreas del reporte.');
      setExportingPDF(false);
      return;
    }

    try {
      const { jsPDF } = (window as any).jspdf;
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      setExportProgress('Capturando visualizaciones...');
      const [chartCanvas, tableCanvas] = await Promise.all([
        html2canvas(chartSection, {
          scale: 1.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 15000
        }),
        html2canvas(tableSection, {
          scale: 1.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 15000
        })
      ]);

      setExportProgress('Procesando página 1 (Horizontal)...');
      const chartImg = chartCanvas.toDataURL('image/jpeg', 0.90);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const chartRatio = chartCanvas.height / chartCanvas.width;
      const finalChartWidth = pdfWidth - 20;
      const finalChartHeight = finalChartWidth * chartRatio;
      pdf.addImage(chartImg, 'JPEG', 10, 10, finalChartWidth, finalChartHeight);

      setExportProgress('Procesando página 2 (Vertical)...');
      pdf.addPage('a4', 'portrait');
      const tableImg = tableCanvas.toDataURL('image/jpeg', 0.90);
      const pdfPortWidth = pdf.internal.pageSize.getWidth();
      const tableRatio = tableCanvas.height / tableCanvas.width;
      const finalTableWidth = pdfPortWidth - 20;
      const finalTableHeight = finalTableWidth * tableRatio;
      
      // Ajuste de margen superior para centrar mejor si la tabla es corta, 
      // o pegarla arriba si es larga.
      const yOffset = finalTableHeight > 250 ? 10 : 15;
      pdf.addImage(tableImg, 'JPEG', 10, yOffset, finalTableWidth, finalTableHeight);

      setExportProgress('Finalizando archivo...');

      // Record download audit log (before pdf.save to guarantee standard execution flow)
      if (currentUser) {
        logActivity(
          currentUser,
          'Descargó PDF',
          `Descargó reporte de llegadas en PDF de la empresa ${selectedCompany} para la fecha ${formatDateToCL(selectedDate)}.`
        ).catch(err => console.error('Error logging PDF download:', err));
      }

      pdf.save(`Reporte_Llegadas_${selectedCompany}_${selectedDate}.pdf`);

    } catch (error) {
      console.error('Error crítico en exportación PDF:', error);
      alert('Hubo un problema al generar el reporte. Intente nuevamente.');
    } finally {
      setExportingPDF(false);
      setExportProgress('');
    }
  };

  const companies = useMemo(() => {
    const dayData = data.filter(d => d.fecha === selectedDate);
    return [...new Set(dayData.map(d => d.empresa))].sort();
  }, [data, selectedDate]);

  const allDestinations = useMemo(() => {
    const dayData = data.filter(d => d.fecha === selectedDate && d.empresa === selectedCompany);
    return [...new Set(dayData.map(d => d.destino))].sort();
  }, [data, selectedDate, selectedCompany]);

  useMemo(() => {
    setSelectedDestinations(allDestinations);
  }, [allDestinations]);

  const filteredData = useMemo(() => {
    return data.filter(d =>
      d.fecha === selectedDate &&
      d.empresa === selectedCompany &&
      selectedDestinations.includes(d.destino) &&
      d.hora >= hourRange[0] && d.hora <= hourRange[1] + 0.99
    );
  }, [data, selectedDate, selectedCompany, selectedDestinations, hourRange]);

  const chartData = useMemo(() => {
    const hours: Record<number, Record<string, number>> = {};
    for (let i = hourRange[0]; i <= hourRange[1]; i++) {
      hours[i] = { hora: i };
      selectedDestinations.forEach(dest => {
        hours[i][dest] = 0;
      });
    }

    filteredData.forEach(d => {
      const h = Math.floor(d.hora);
      if (hours[h] && hours[h][d.destino] !== undefined) {
        hours[h][d.destino]++;
      }
    });

    return Object.values(hours).map(h => ({
      ...h,
      horaStr: `${String(h.hora).padStart(2, '0')}:00`
    }));
  }, [filteredData, selectedDestinations, hourRange]);

  const pivotTable = useMemo(() => {
    const table: Record<number, Record<string, number>> = {};
    filteredData.forEach(d => {
      const h = Math.floor(d.hora);
      if (!table[h]) table[h] = {};
      table[h][d.destino] = (table[h][d.destino] || 0) + 1;
    });

    return Object.entries(table)
      .map(([h, counts]) => ({ hora: Number(h), ...counts }))
      .sort((a, b) => a.hora - b.hora);
  }, [filteredData, selectedDestinations]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED] flex flex-col font-sans text-slate-800">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between sticky top-0 z-40 no-print shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            aria-label="Volver"
            className="w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center transition-colors duration-150 ease-out text-[#461D77] cursor-pointer shadow-sm"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none">
              Llegada de Equipos
            </h1>
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mt-1">
              Control de Acceso y Frecuencia Horaria
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {data.length > 0 && (
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-[#461D77] cursor-pointer"
            >
              {[...new Set(data.map(d => d.fecha))].sort().reverse().map((d: any) => (
                <option key={d} value={d}>{formatDateToCL(d)}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 bg-gradient-to-r from-[#461D77] to-[#7177EC] hover:opacity-95 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 ease-out cursor-pointer shadow-md shadow-[#461D77]/20">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            <span>Subir Excel</span>
            <input type="file" className="hidden" accept=".xlsx,.xlsm" onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
          </label>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-[1400px] mx-auto w-full space-y-6">
        {data.length === 0 ? (
          <div className="h-[68vh] flex flex-col items-center justify-center text-center space-y-5 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-3xl p-8 shadow-xl shadow-slate-200/40">
            <div className="w-16 h-16 bg-[#461D77]/10 rounded-2xl flex items-center justify-center text-[#461D77] border border-[#461D77]/20">
              <Truck size={32} />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Bitácora de Llegada de Equipos</h2>
              <p className="text-slate-500 max-w-md text-xs leading-relaxed">
                Cargue el reporte Excel de jornada para visualizar el flujo horario de entrada por transportista y destino.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 no-print">
              <div className="lg:col-span-4 bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 space-y-3">
                <div className="flex items-center gap-2 text-[#461D77]">
                  <Filter size={14} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Empresa Transportista</span>
                </div>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-[#461D77] transition-colors duration-150"
                >
                  {companies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="lg:col-span-8 bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Destinos de {selectedCompany}
                  </span>
                  <button
                    onClick={() => setSelectedDestinations(allDestinations)}
                    className="text-[11px] font-bold text-[#461D77] hover:underline underline-offset-4 cursor-pointer"
                  >
                    Seleccionar Todos
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allDestinations.map(dest => (
                    <button
                      key={dest}
                      onClick={() => setSelectedDestinations(prev => prev.includes(dest) ? prev.filter(d => d !== dest) : [...prev, dest])}
                      className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase transition-colors duration-150 ease-out border cursor-pointer ${
                        selectedDestinations.includes(dest)
                          ? 'bg-[#461D77] text-white border-[#461D77] shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {dest}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SECCIÓN 1: GRÁFICO (HORIZONTAL) */}
            <div id="arrival-chart-section" className="bg-white rounded-3xl border border-slate-200 overflow-hidden mb-6 shadow-xl shadow-slate-200/40" style={{ backgroundColor: '#ffffff' }}>
              <div className="px-8 py-6 bg-gradient-to-r from-[#461D77] to-[#311042] border-b border-slate-200 flex items-center gap-6">
                <div className="bg-white p-2 rounded-2xl flex items-center justify-center w-24 h-24 border border-white/20 overflow-hidden shrink-0 shadow-md">
                  <CompanyLogo company={selectedCompany} />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-purple-200 uppercase tracking-widest">
                    Reporte de Flujo de Equipos
                  </span>
                  <h2 className="text-2xl font-black text-white tracking-tight uppercase mt-0.5">
                    {selectedCompany}
                  </h2>
                  <p className="text-xs font-mono text-purple-100 mt-1 tabular-nums">
                    Jornada: {formatDateToCL(selectedDate)}
                  </p>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Análisis de Frecuencia</h3>
                    <p className="text-xs text-slate-500">Llegadas por hora y punto de destino</p>
                  </div>
                </div>

                <div className="h-[420px] w-full bg-slate-50/70 rounded-2xl p-5 border border-slate-200/80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="horaStr" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', padding: '12px', boxShadow: '0 10px 25px -5px rgba(15,23,42,0.1)' }}
                        labelStyle={{ fontWeight: '800', color: '#1e293b', marginBottom: '6px', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }} />
                      {selectedDestinations.map((dest, i) => (
                        <Line
                          key={dest}
                          type="monotone"
                          dataKey={dest}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={3}
                          dot={{ r: 3.5, fill: '#fff', strokeWidth: 2 }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: TABLA (VERTICAL) */}
            <div id="arrival-table-section" className="bg-white rounded-3xl border border-slate-200 p-8 space-y-5 overflow-hidden shadow-xl shadow-slate-200/40" style={{ backgroundColor: '#ffffff' }}>
              <div className="flex justify-between items-start border-b border-slate-200 pb-4" style={{ borderBottomColor: '#e2e8f0' }}>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight" style={{ color: '#1e293b' }}>Tabla de Control Operativo</h3>
                  <p className="text-[11px] font-mono text-[#461D77] uppercase tracking-wider leading-none" style={{ color: '#461D77' }}>Consolidado Numérico de Equipos · {selectedCompany}</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider leading-none" style={{ color: '#64748b' }}>Fecha: {formatDateToCL(selectedDate)}</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <table className="w-full text-left border-collapse" style={{ backgroundColor: '#ffffff', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th 
                        className="px-5 py-3 text-[11px] font-bold uppercase text-slate-500 tracking-wider" 
                        style={{ backgroundColor: '#f8fafc', color: '#64748b', borderBottom: '2px solid #e2e8f0', padding: '12px 16px', fontWeight: '700' }}
                      >
                        Hora
                      </th>
                      {selectedDestinations.map(dest => (
                        <th 
                          key={dest} 
                          className="px-5 py-3 text-[11px] font-bold uppercase text-[#461D77] tracking-tight text-center" 
                          style={{ backgroundColor: '#f8fafc', color: '#461D77', borderBottom: '2px solid #e2e8f0', padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}
                        >
                          {dest}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums" style={{ borderColor: '#f1f5f9' }}>
                    {pivotTable.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td 
                          className="px-5 py-2.5 text-sm font-mono font-bold text-slate-800 bg-slate-50/70" 
                          style={{ backgroundColor: '#f8fafc', color: '#1e293b', borderBottom: '1px solid #f1f5f9', fontWeight: '700', padding: '10px 16px' }}
                        >
                          {String(row.hora).padStart(2, '0')}:00
                        </td>
                        {selectedDestinations.map(dest => (
                          <td 
                            key={dest} 
                            className="px-5 py-2.5 text-center font-mono tabular-nums" 
                            style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff', padding: '10px 16px', textAlign: 'center' }}
                          >
                            <span 
                              className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${row[dest] > 0 ? 'bg-[#461D77]/10 text-[#461D77]' : 'text-slate-300'}`}
                              style={row[dest] > 0 
                                ? { backgroundColor: '#F3EEF8', color: '#461D77', padding: '4px 12px', borderRadius: '8px', display: 'inline-block', fontWeight: '700' } 
                                : { color: '#cbd5e1', padding: '4px 12px', display: 'inline-block', fontWeight: '500' }
                              }
                            >
                              {row[dest] || 0}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#461D77' }}>
                      <td 
                        className="px-5 py-3.5 text-[11px] font-bold text-white uppercase tracking-wider" 
                        style={{ backgroundColor: '#461D77', color: '#ffffff', fontWeight: '700', borderTop: '2px solid #461D77', padding: '14px 16px' }}
                      >
                        Total Jornada
                      </td>
                      {selectedDestinations.map(dest => (
                        <td 
                          key={dest} 
                          className="px-5 py-3.5 text-lg font-mono font-black text-white text-center tabular-nums" 
                          style={{ backgroundColor: '#461D77', color: '#ffffff', fontWeight: '800', textAlign: 'center', borderTop: '2px solid #461D77', padding: '14px 16px' }}
                        >
                          {pivotTable.reduce((acc, curr) => acc + (curr[dest] || 0), 0)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="no-print pt-2" data-html2canvas-ignore="true">
              <button
                onClick={handleExportPDF}
                disabled={exportingPDF}
                className="w-full bg-gradient-to-r from-[#461D77] to-[#7177EC] hover:opacity-95 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all duration-150 ease-out cursor-pointer disabled:opacity-60 shadow-lg shadow-[#461D77]/20"
              >
                {exportingPDF ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{exportProgress || 'Generando reporte PDF...'}</span>
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    <span>Generar Reporte PDF (Paginación Automática)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white/80 backdrop-blur-md border-t border-slate-200/80 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#461D77]/10 border border-[#461D77]/15 flex items-center justify-center text-[#461D77]">
            <Calendar size={15} />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-800">Sistema de Gestión Logística</span>
            <span className="text-[10px] font-mono text-slate-400">v3.10.0</span>
          </div>
        </div>
        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider text-center md:text-right">
          Novandino Litio · Uso Interno
        </p>
      </footer>
    </div>
  );
};

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, Loader2,
  Home, Truck, Image as ImageIcon,
  Clock, BarChart3, TrendingUp, Target, Users, Scale, ClipboardCheck, FileText, Download
} from 'lucide-react';
import ChartCard from './ChartCard';
import ProductDetailSection from './ProductDetailSection';
import MainMenu from './MainMenu';
import { LlegadaEquipos } from './LlegadaEquipos';
import { MemoryModule } from './MemoryModule';
import DdDTablero from './DdDTablero';
import ReportFooter from './ReportFooter';
import InstructionModal from './InstructionModal';
import { ImageGallery } from './ImageGallery';
import { PasswordPrompt } from './PasswordPrompt';
import CambioDeTurno from './CambioDeTurno';
import LCEModule from './LCE/LCEModule';
import { cleanNumeric, parseExcelTime, formatHoursToTime, formatDateToCL, downloadBackupJSON, normalizeHeader } from '../utils/dataProcessor';
import { NovandinoLogo } from './BrandLogo';

// Firebase imports
import { SystemUser, logActivity } from '../services/firebase';
import { LoginScreen } from './LoginScreen';
import { ActivityLogsView } from './ActivityLogsView';
import { UserManagementView } from './UserManagementView';

declare const html2canvas: any;
declare const jspdf: any;

const App: React.FC = () => {
  // Session details stored in state and localStorage
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    const saved = localStorage.getItem('sqm_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [view, setView] = useState<'menu' | 'llegada' | 'informe' | 'memoria' | 'ddd' | 'galeria' | 'cambioTurno' | 'lce' | 'users' | 'logs'>('menu');
  const [rawData, setRawData] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [passwordRequest, setPasswordRequest] = useState<{ view: 'memoria' | 'galeria' | 'cambioTurno' | 'lce', name: string } | null>(null);
  const [isJefeTurnoUnlocked, setIsJefeTurnoUnlocked] = useState(false);

  // Sync access state with user roles on change
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'admin' || currentUser.role === 'jefe_turno') {
        setIsJefeTurnoUnlocked(true);
      } else {
        setIsJefeTurnoUnlocked(false);
      }
    }
  }, [currentUser]);

  // Track interface transitions
  useEffect(() => {
    if (currentUser && view !== 'menu') {
      logActivity(currentUser, 'Ingreso a Módulo', `Ingresó al módulo: ${view.toUpperCase()}`);
    }
  }, [view, currentUser]);

  useEffect(() => {
    const savedData = localStorage.getItem('sqm_raw_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.length > 0) {
          const totalTon = parsed.reduce((a: number, b: any) => a + (Number(b.Ton_Real) || 0), 0);
          const totalEq = parsed.reduce((a: number, b: any) => a + (Number(b.Eq_Real) || 0), 0);
          if (totalTon === 0 && totalEq === 0) {
            localStorage.removeItem('sqm_raw_data');
            return;
          }
        }
        setRawData(parsed);
        const dates = [...new Set(parsed.map((r: any) => r.Fecha))].sort().reverse();
        if (dates.length > 0) setSelectedDate(dates[0] as string);
      } catch (e) {
        localStorage.removeItem('sqm_raw_data');
      }
    }
  }, []);

  const isRunning = loading || exportingPDF || exportingImage;

  const handleLogout = () => {
    if (currentUser) {
      logActivity(currentUser, 'Cierre de Sesión', 'El usuario cerró sesión voluntariamente.');
    }
    setCurrentUser(null);
    setIsJefeTurnoUnlocked(false);
    localStorage.removeItem('sqm_current_user');
    setView('menu');
  };

  const handleExportPDF = async () => {
    if (exportingPDF) return;
    setExportingPDF(true);
    document.body.classList.add('is-exporting');
    await new Promise(r => setTimeout(r, 300));
    try {
      const { jsPDF } = (window as any).jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'legal', compress: true });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableWidth = pdfWidth - margin * 2;
      const captureOptions = { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', imageTimeout: 15000 };
      const coverEl = document.getElementById('pdf-cover-page');
      if (coverEl) {
        const coverCanvas = await html2canvas(coverEl, captureOptions);
        const coverImg = coverCanvas.toDataURL('image/jpeg', 0.95);
        const coverRatio = coverCanvas.height / coverCanvas.width;
        const coverHeight = usableWidth * coverRatio;
        const coverY = coverHeight < pdfHeight - margin * 2 ? (pdfHeight - coverHeight) / 2 : margin;
        pdf.addImage(coverImg, 'JPEG', margin, coverY, usableWidth, coverHeight);
      }
      const productSections = document.querySelectorAll('[id^="product-section-"]');
      for (let i = 0; i < productSections.length; i++) {
        pdf.addPage('legal', 'portrait');
        const section = productSections[i] as HTMLElement;
        const canvas = await html2canvas(section, captureOptions);
        const img = canvas.toDataURL('image/jpeg', 0.95);
        const ratio = canvas.height / canvas.width;
        let imgHeight = usableWidth * ratio;
        if (imgHeight > pdfHeight - margin * 2) {
          const scaledWidth = (pdfHeight - margin * 2) / ratio;
          const xOffset = margin + (usableWidth - scaledWidth) / 2;
          pdf.addImage(img, 'JPEG', xOffset, margin, scaledWidth, pdfHeight - margin * 2);
        } else {
          pdf.addImage(img, 'JPEG', margin, margin, usableWidth, imgHeight);
        }
      }
      pdf.save(`Informe_Operativo_${selectedDate}.pdf`);

      // Record download audit log
      if (currentUser) {
        logActivity(currentUser, 'Exportó PDF', `Exportó el reporte operativo PDF de la jornada ${formatDateToCL(selectedDate)}.`);
      }
    } catch (error) {
      console.error('Error en exportación PDF:', error);
      alert('Error al generar el PDF. Intente nuevamente.');
    } finally {
      document.body.classList.remove('is-exporting');
      setExportingPDF(false);
    }
  };

  const handleExportImage = async () => {
    if (exportingImage) return;
    setExportingImage(true);
    const element = document.getElementById('executive-summary-capture');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `Resumen_Operativo_${selectedDate}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Record image generation audit log
      if (currentUser) {
        logActivity(currentUser, 'Exportó PNG', `Descargó placa gráfica de KPIs principales para la jornada ${formatDateToCL(selectedDate)}.`);
      }
    } finally {
      setExportingImage(false);
    }
  };

  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames.find(n => n === "Base de Datos") || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (jsonData.length < 2) throw new Error("Archivo vacío o no estructurado.");
        
        const headers = jsonData[0].map(h => normalizeHeader(String(h)));
        const rows = jsonData.slice(1);
        const idx = {
          fecha: headers.indexOf('fecha'),
          producto: headers.indexOf('producto'),
          tonProg: headers.indexOf('ton_prog'),
          tonReal: headers.indexOf('ton_real'),
          eqProg: headers.indexOf('eq_prog'),
          eqReal: headers.indexOf('eq_real'),
          regReal: headers.indexOf('regulacion_real'),
          sda: headers.indexOf('sda_hrs'),
          pang: headers.indexOf('pang_hrs'),
          faenaMeta: headers.indexOf('faena_meta_hrs'),
          faenaReal: headers.indexOf('faena_real_hrs')
        };
        const missing = Object.entries(idx).filter(([_, v]) => v === -1).map(([k]) => k);
        if (missing.length > 0) throw new Error(`Columnas sugeridas faltantes: ${missing.join(', ')}`);
        
        const processed = rows.map((row) => {
          if (!row[idx.fecha] || !row[idx.producto]) return null;
          let dateStr = '';
          if (row[idx.fecha] instanceof Date) {
            dateStr = (row[idx.fecha] as Date).toISOString().split('T')[0];
          } else {
            const rawVal = String(row[idx.fecha]).trim();
            if (rawVal.includes('/')) {
              const pts = rawVal.split('/');
              if (pts[2]?.length === 4) dateStr = `${pts[2]}-${pts[1].padStart(2, '0')}-${pts[0].padStart(2, '0')}`;
            } else if (rawVal.includes('-')) {
              dateStr = rawVal;
            }
          }
          if (!dateStr || dateStr === 'undefined') return null;
          return {
            Fecha: dateStr,
            Producto: String(row[idx.producto]).trim().toUpperCase(),
            Ton_Prog: cleanNumeric(row[idx.tonProg]),
            Ton_Real: cleanNumeric(row[idx.tonReal]),
            Eq_Prog: cleanNumeric(row[idx.eqProg]),
            Eq_Real: cleanNumeric(row[idx.eqReal]),
            Regulacion_Real: (() => {
              const raw = row[idx.regReal];
              const val = cleanNumeric(raw);
              if (typeof raw === 'number' && raw > 0 && raw <= 1.0) return raw * 100;
              return val;
            })(),
            sdaHours: parseExcelTime(row[idx.sda]),
            pangHours: parseExcelTime(row[idx.pang]),
            faenaMetaHours: parseExcelTime(row[idx.faenaMeta]),
            faenaRealHours: parseExcelTime(row[idx.faenaReal])
          };
        }).filter(r => r !== null);
        
        localStorage.removeItem('sqm_raw_data');
        setRawData(processed);
        localStorage.setItem('sqm_raw_data', JSON.stringify(processed));
        const dates = [...new Set(processed.map(r => r.Fecha))].sort().reverse();
        if (dates.length > 0) setSelectedDate(dates[0]);
        
        // Log import action
        if (currentUser) {
          logActivity(currentUser, 'Carga de Datos', `Cargó archivo base Excel con ${processed.length} registros operativos.`);
        }
      } catch (err: any) {
        alert(`Error al procesar el archivo: ${err.message || 'Error desconocido'}`);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  }, [currentUser]);

  const filteredData = useMemo(() => rawData.filter(r => r.Fecha === selectedDate), [rawData, selectedDate]);

  const operationalKPIs = useMemo(() => {
    if (filteredData.length === 0) return null;
    const totalTonReal = filteredData.reduce((a, b) => a + b.Ton_Real, 0);
    const totalTonProg = filteredData.reduce((a, b) => a + b.Ton_Prog, 0);
    const totalEqReal = filteredData.reduce((a, b) => a + b.Eq_Real, 0);
    const avgReg = filteredData.length > 0 ? filteredData.reduce((acc, d) => acc + (Number(d.Regulacion_Real) || 0), 0) / filteredData.length : 0;
    const validSdaTimes = filteredData.map(d => d.sdaHours).filter(v => v > 0);
    const avgSda = validSdaTimes.length > 0 ? validSdaTimes.reduce((a, b) => a + b, 0) / validSdaTimes.length : 0;
    const validPangTimes = filteredData.map(d => d.pangHours).filter(v => v > 0);
    const avgPang = validPangTimes.length > 0 ? validPangTimes.reduce((a, b) => a + b, 0) / validPangTimes.length : 0;
    const totalHoursInFaena = filteredData.reduce((a, b) => a + b.faenaRealHours, 0);
    const productivity = totalHoursInFaena > 0 ? totalTonReal / totalHoursInFaena : 0;
    const compliance = totalTonProg > 0 ? (totalTonReal / totalTonProg) * 100 : 0;
    const avgLoad = totalEqReal > 0 ? totalTonReal / totalEqReal : 0;
    return [
      { label: "Tiempo Gral. Faena (SdA)", value: formatHoursToTime(avgSda), icon: <Clock className="w-3.5 h-3.5" /> },
      { label: "TIEMPO GRAL: FAENA (NY)", value: formatHoursToTime(avgPang), icon: <Clock className="w-3.5 h-3.5" /> },
      { label: "Productividad Diaria", value: `${productivity.toFixed(1)} T/H`, icon: <TrendingUp className="w-3.5 h-3.5" /> },
      { label: "Carga Real Despachada", value: `${totalTonReal.toLocaleString()} Ton`, icon: <Truck className="w-3.5 h-3.5" /> },
      { label: "Cumplimiento Programa", value: `${compliance.toFixed(1)}%`, icon: <Target className="w-3.5 h-3.5" />, status: compliance < 85 ? 'danger' : 'normal' },
      { label: "Intensidad de Flota", value: `${totalEqReal} EQ`, icon: <Users className="w-3.5 h-3.5" /> },
      { label: "Factor de Carga (Eficiencia)", value: `${avgLoad.toFixed(1)} T/EQ`, icon: <Scale className="w-3.5 h-3.5" /> },
      { label: "PROMEDIO DE % DE REGULACIÓN", value: `${Math.round(avgReg)}%`, icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
    ];
  }, [filteredData]);

  const productList = useMemo(() => {
    const products = [...new Set(filteredData.map(r => r.Producto as string))] as string[];
    return products.sort((a: string, b: string) => {
      const priority: Record<string, number> = { 'SLIT': 1, 'LSI (S)': 2 };
      const aPrio = priority[a] || 99;
      const bPrio = priority[b] || 99;
      if (aPrio !== bPrio) return aPrio - bPrio;
      return a.localeCompare(b);
    });
  }, [filteredData]);

  const handleBackupDownload = (date: string) => {
    downloadBackupJSON(date);
    if (currentUser) {
      logActivity(currentUser, 'Descargó Historial', `Descargó base JSON estructurada del día ${formatDateToCL(date)}.`);
    }
  };

  const handleViewChange = (v: 'menu' | 'llegada' | 'informe' | 'memoria' | 'ddd' | 'galeria' | 'cambioTurno' | 'lce' | 'users' | 'logs') => {
    if (v === 'memoria') {
      if (isJefeTurnoUnlocked) {
        setView('memoria');
      } else {
        setPasswordRequest({ view: 'memoria', name: 'Memoria' });
      }
    } else if (v === 'galeria') {
      if (isJefeTurnoUnlocked) {
        setView('galeria');
      } else {
        setPasswordRequest({ view: 'galeria', name: 'Galería Operativa' });
      }
    } else if (v === 'cambioTurno') {
      if (isJefeTurnoUnlocked) {
        setView('cambioTurno');
      } else {
        setPasswordRequest({ view: 'cambioTurno', name: 'Cambio de Turno' });
      }
    } else if (v === 'lce') {
      if (isJefeTurnoUnlocked) {
        setView('lce');
      } else {
        setPasswordRequest({ view: 'lce', name: 'Control LCE' });
      }
    } else {
      setView(v);
    }
  };

  const renderCurrentView = () => {
    if (view === 'logs' && currentUser?.role === 'admin') {
      return <ActivityLogsView currentUser={currentUser} onBack={() => setView('menu')} />;
    }
    if (view === 'users' && currentUser?.role === 'admin') {
      return <UserManagementView currentUser={currentUser} onBack={() => setView('menu')} />;
    }
    if (view === 'menu') return (
      <MainMenu 
        onSelectView={handleViewChange} 
        isJefeTurnoUnlocked={isJefeTurnoUnlocked}
        onUnlockJefeTurno={() => setIsJefeTurnoUnlocked(true)}
        currentUser={currentUser!}
        onLogout={handleLogout}
      />
    );
    if (view === 'llegada') return <LlegadaEquipos onBack={() => setView('menu')} />;
    if (view === 'memoria') return (
      <MemoryModule
        data={rawData}
        onBack={() => setView('menu')}
        onSelectDate={(d) => { setSelectedDate(d); setView('informe'); }}
      />
    );
    if (view === 'ddd') return (
      <DdDTablero
        data={rawData}
        selectedDate={selectedDate}
        onBack={() => setView('menu')}
      />
    );
    if (view === 'galeria') return <ImageGallery onBack={() => setView('menu')} />;
    if (view === 'cambioTurno') return <CambioDeTurno onBack={() => setView('menu')} />;
    if (view === 'lce') return <LCEModule onBack={() => setView('menu')} />;

    // fallback sidebar layout for standard dashboard view
    return (
      <div className="flex h-screen bg-calido font-sans text-tecnico overflow-hidden">
        <aside className="w-[300px] bg-levanda border-r border-violeta/20 flex flex-col no-print shrink-0">
          <div className="p-6 overflow-y-auto flex-1 space-y-8">
            <button onClick={() => setView('menu')} className="flex items-center gap-2 text-violeta hover:text-nucleo font-black text-[10px] uppercase tracking-widest transition-colors mb-4 group">
              <Home size={14} className="group-hover:-translate-x-1 transition-transform" /> Menú Principal
            </button>
            <div className="bg-white p-5 rounded-3xl border border-violeta/10 flex flex-col items-center gap-2 shadow-sm">
              <h2 className="font-black text-[10px] tracking-[0.2em] uppercase text-violeta">Management</h2>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-violeta">Cargar Datos</p>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-violeta/20 rounded-3xl cursor-pointer bg-white hover:border-ionizado hover:bg-calido transition-all">
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <Upload className="w-8 h-8 text-violeta/30 mb-2" />
                  <p className="text-[10px] text-violeta/60 uppercase font-black tracking-widest">Base Excel</p>
                </div>
                <input type="file" className="hidden" accept=".xlsx,.xlsm" onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
              </label>
            </div>
            {rawData.length > 0 && (
              <>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-violeta">Jornada</p>
                  <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-white border border-violeta/20 rounded-2xl px-4 py-3 text-sm font-black text-tecnico outline-none focus:ring-4 focus:ring-ionizado/10">
                    {[...new Set(rawData.map(r => r.Fecha))].sort().reverse().map(d => <option key={d as string} value={d as string}>{formatDateToCL(d as string)}</option>)}
                  </select>
                </div>
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-violeta">Herramientas</p>
                  <button onClick={handleExportPDF} disabled={exportingPDF} className="w-full bg-white border border-violeta/20 text-nucleo py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-calido transition-all">
                    {exportingPDF ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} Exportar PDF
                  </button>
                  <button onClick={handleExportImage} disabled={exportingImage} className="w-full bg-white border border-violeta/20 text-nucleo py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-calido transition-all">
                    {exportingImage ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />} Descargar PNG
                  </button>
                  {currentUser?.role !== 'supervision' && (
                    <button onClick={() => handleViewChange('galeria')} className="w-full bg-white border border-violeta/20 text-nucleo py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-calido transition-all">
                      <ImageIcon size={12} /> Galería Operativa
                    </button>
                  )}
                  <button onClick={() => handleBackupDownload(selectedDate)} className="w-full bg-nucleo text-white py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-nucleo/90 transition-all shadow-lg shadow-nucleo/10">
                    <Download size={12} /> Descargar Historial
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto relative bg-white">
          {isRunning && (
            <div className="absolute top-4 right-8 z-50 flex items-center gap-3 bg-white px-5 py-2 rounded-full shadow-2xl border border-violeta/10 animate-in fade-in slide-in-from-top-2 no-print">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-ionizado" />
              <span className="text-[10px] font-black text-violeta uppercase tracking-[0.2em]">Cargando Informe...</span>
            </div>
          )}
          <div className="max-w-5xl mx-auto p-8 space-y-0" id="dashboard-report">
            {rawData.length === 0 ? (
              <div className="py-20 flex flex-col items-center text-center space-y-8">
                <div className="w-24 h-24 bg-calido rounded-[2.5rem] flex items-center justify-center text-violeta/20"><BarChart3 size={48} /></div>
                <h2 className="text-3xl font-[900] text-nucleo tracking-tighter uppercase">Gestión de Despacho Litio</h2>
                <p className="text-violeta/60 font-medium">Cargue un archivo base para iniciar el análisis operativo.</p>
              </div>
            ) : (
              <>
                <div id="pdf-cover-page" className="pdf-only page-break-after flex flex-col items-center justify-center min-h-[1000px] w-full bg-white text-center">
                  <div className="space-y-24 flex flex-col items-center w-full">
                    <div className="flex flex-col items-center justify-center text-center w-full">
                      <div className="flex flex-col items-center text-center">
                        <NovandinoLogo className="h-40 w-[600px] max-w-full mb-10" variant="large" />
                        <h1 className="text-[60px] font-[950] text-[#1e293b] tracking-[-0.04em] leading-none uppercase whitespace-nowrap">INFORME OPERATIVO</h1>
                        <p className="text-slate-400 font-bold text-sm tracking-[0.4em] uppercase mt-3 whitespace-nowrap">SUBGERENCIA LOGÍSTICA LITIO - DESPACHO LITIO</p>
                      </div>
                    </div>
                    <div className="pt-20">
                      <p className="text-violeta/30 font-black text-xs tracking-[0.4em] uppercase mb-6">JORNADA CORRESPONDIENTE</p>
                      <p className="text-6xl font-[950] text-ionizado tracking-tighter">{formatDateToCL(selectedDate)}</p>
                    </div>
                  </div>
                </div>
                <div id="executive-summary-capture" className="no-pdf space-y-8 bg-white min-h-[1000px] flex flex-col mb-10 no-page-break">
                  <div className="bg-white p-8 space-y-10 flex-1">
                    <div className="flex justify-between items-start pb-8 border-b-2 border-calido">
                      <div className="flex flex-col items-start gap-4">
                        <NovandinoLogo className="h-32 w-[480px] max-w-full" variant="print" />
                        <div>
                          <h1 className="text-5xl font-[900] text-nucleo tracking-tighter leading-none mb-1 uppercase">INFORME OPERATIVO</h1>
                          <p className="text-violeta font-bold text-[10px] tracking-[0.4em] uppercase">Subgerencia Logística Litio - Despacho Litio</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-violeta font-bold text-[10px] tracking-[0.3em] uppercase mb-1">FECHA JORNADA</p>
                        <p className="text-4xl font-[900] text-ionizado tracking-tighter">{formatDateToCL(selectedDate)}</p>
                      </div>
                    </div>
                    {filteredData.length > 0 && (
                      <div className="bg-white rounded-[2.5rem] p-10 border-2 border-ionizado/10 border-l-[12px] border-l-ionizado space-y-8 shadow-sm">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-ionizado"><span className="font-black uppercase tracking-[0.3em] text-[10px]">KPIs OPERATIVOS</span></div>
                          <h2 className="text-4xl font-[900] text-nucleo tracking-tighter uppercase">Cumplimiento Global</h2>
                        </div>
                        <div className="grid grid-cols-4 gap-4 pt-6">
                          {operationalKPIs?.map((kpi, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-3xl border border-calido flex flex-col gap-2 shadow-sm border-b-4 border-b-levanda">
                              <div className="flex items-center gap-2 text-black">{kpi.icon}<span className="text-[10px] font-black text-black uppercase tracking-widest">{kpi.label}</span></div>
                              <span className={`text-2xl font-[900] ${kpi.status === 'danger' ? 'text-rose-600' : 'text-black'} tracking-tighter`}>{kpi.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-6">
                      <ChartCard type="composed" xAxis="Producto" yAxis={['Ton_Prog', 'Ton_Real', 'faenaMetaHours', 'faenaRealHours']} title="Análisis Comparativo" data={filteredData} />
                    </div>
                  </div>
                  <div className="px-8 pb-8 mt-auto"><ReportFooter /></div>
                </div>
                {productList.map((prod, idx) => (
                  <div key={`${selectedDate}-${prod}`} id={`product-section-${idx}`} className="page-break-before bg-white block w-full pt-4" style={{ minHeight: '330mm' }}>
                    <div className="px-4">
                      <ProductDetailSection product={prod} data={filteredData.filter(d => d.Producto === prod)} date={selectedDate} index={idx + 1} total={productList.length} />
                    </div>
                    <div className="px-4 pb-6 mt-8"><ReportFooter /></div>
                  </div>
                ))}
              </>
            )}
          </div>
        </main>
      </div>
    );
  };

  // If no user is logged in, interrupt rendering and enforce Login Screen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={setCurrentUser} />;
  }

  return (
    <>
      {renderCurrentView()}
      {passwordRequest && (
        <PasswordPrompt 
          correctPassword="MIRAME"
          moduleName={passwordRequest.name}
          onSuccess={() => { 
            setIsJefeTurnoUnlocked(true);
            setView(passwordRequest.view); 
            setPasswordRequest(null); 
          }}
          onCancel={() => setPasswordRequest(null)}
        />
      )}
    </>
  );
};

export default App;

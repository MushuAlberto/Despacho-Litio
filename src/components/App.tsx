import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  Upload, Loader2,
  Home, Truck, Image as ImageIcon,
  Clock, BarChart3, TrendingUp, Target, Users, Scale, ClipboardCheck, FileText, Download,
  Mail, Send, X, Lock, ArrowLeft, ChevronLeft, ChevronRight, PanelLeft, PanelLeftClose
} from 'lucide-react';
import ChartCard from './ChartCard';
import ProductDetailSection from './ProductDetailSection';
import MainMenu from './MainMenu';
import { LlegadaEquipos } from './LlegadaEquipos';
import { MemoryModule } from './MemoryModule';
import DdDTablero from './DdDTablero';
import { SlitDashboard } from './SlitDashboard';
import ReportFooter from './ReportFooter';
import InstructionModal from './InstructionModal';
import { ImageGallery } from './ImageGallery';
import { PasswordPrompt } from './PasswordPrompt';
import CambioDeTurno from './CambioDeTurno';
import LCEModule from './LCE/LCEModule';
import { CumplimientoMQ } from './PQL/CumplimientoMQ';
import { CumplimientoJorquera } from './PQL/CumplimientoJorquera';
import { InformeOperativo } from './PQL/InformeOperativo';
import { ModuloStokes } from './ModuloStokes';
import { CloudUpload } from 'lucide-react';
import { cleanNumeric, parseExcelTime, formatHoursToTime, formatDateToCL, downloadBackupJSON, syncBackupToFirebase, normalizeHeader, formatNumberWithDecimals, separateBischofitaByDest, isProductNovandino, isProductSQM, formatCLB } from '../utils/dataProcessor';
import { NovandinoLogo } from './BrandLogo';
import { OutlookSendButton } from './OutlookSendButton';
import { ExcelUploadDropzone } from './ExcelUploadDropzone';
import { ExportDownloadButton } from './ExportDownloadButton';
import { FirebaseSyncButton } from './FirebaseSyncButton';
import '../utils/send-button';

// Firebase imports
import { SystemUser, logActivity } from '../services/firebase';
import { LoginScreen } from './LoginScreen';
import { WelcomeShowcase } from './WelcomeShowcase';
import { ActivityLogsView } from './ActivityLogsView';
import { UserManagementView } from './UserManagementView';
import { GlobalTopBar } from './GlobalTopBar';
import { CommandPalette } from './CommandPalette';
import { NotFoundView } from './NotFoundView';
import { ControlRoomOverlay } from './ControlRoomOverlay';
import { OfflineIndicator } from './PWAStatusControls';
import { getOperationalSnapshot, saveOperationalSnapshot } from '../services/offlineDb';

declare const html2canvas: any;
declare const jspdf: any;

export type AppView =
  | 'menu'
  | 'llegada'
  | 'informe-novandino'
  | 'informe-sqm'
  | 'memoria'
  | 'ddd'
  | 'galeria'
  | 'cambioTurno'
  | 'lce'
  | 'users'
  | 'logs'
  | 'slit'
  | 'cumplimiento-mq'
  | 'cumplimiento-jorquera'
  | 'informe-operativo'
  | 'stokes'
  | '404';

export const VIEW_TO_PATH: Record<AppView, string> = {
  'menu': '/',
  'llegada': '/llegada',
  'informe-novandino': '/informe-novandino',
  'informe-sqm': '/informe-sqm',
  'memoria': '/memoria',
  'ddd': '/ddd',
  'galeria': '/galeria',
  'cambioTurno': '/cambio-turno',
  'lce': '/lce',
  'users': '/usuarios',
  'logs': '/bitacora',
  'slit': '/slit',
  'cumplimiento-mq': '/cumplimiento-mq',
  'cumplimiento-jorquera': '/cumplimiento-jorquera',
  'informe-operativo': '/informe-operativo',
  'stokes': '/stokes',
  '404': '/404'
};

export const PATH_TO_VIEW: Record<string, AppView> = {
  '/': 'menu',
  '': 'menu',
  '/menu': 'menu',
  '/llegada': 'llegada',
  '/informe-novandino': 'informe-novandino',
  '/informe-sqm': 'informe-sqm',
  '/memoria': 'memoria',
  '/ddd': 'ddd',
  '/galeria': 'galeria',
  '/cambio-turno': 'cambioTurno',
  '/cambioturno': 'cambioTurno',
  '/lce': 'lce',
  '/usuarios': 'users',
  '/users': 'users',
  '/bitacora': 'logs',
  '/logs': 'logs',
  '/slit': 'slit',
  '/cumplimiento-mq': 'cumplimiento-mq',
  '/cumplimiento-jorquera': 'cumplimiento-jorquera',
  '/informe-operativo': 'informe-operativo',
  '/stokes': 'stokes',
  '/404': '404'
};

const VIEW_TITLES: Record<AppView, string> = {
  'menu': 'Litio Dashboard SQM · Menú Principal',
  'llegada': 'Llegada de Equipos · Despacho Litio',
  'informe-novandino': 'Informe Operativo Novandino · Despacho Litio',
  'informe-sqm': 'Informe Operativo SQM NY · Despacho Litio',
  'memoria': 'Módulo Memoria e Historial · Despacho Litio',
  'ddd': 'Tablero DdD · Despacho Litio',
  'galeria': 'Galería de Informes · Despacho Litio',
  'cambioTurno': 'Cambio de Turno · Despacho Litio',
  'lce': 'Control LCE · Despacho Litio',
  'users': 'Gestión de Usuarios · Despacho Litio',
  'logs': 'Bitácora de Auditoría · Despacho Litio',
  'slit': 'Dashboard SLIT · Despacho Litio',
  'cumplimiento-mq': 'Cumplimiento MQ · Despacho Litio',
  'cumplimiento-jorquera': 'Cumplimiento Jorquera · Despacho Litio',
  'informe-operativo': 'Informe Operativo SLIT · Planta Química Litio',
  'stokes': 'Reporte Stokes · Despacho Litio',
  '404': 'Ruta No Encontrada (404) · Despacho Litio'
};

function getInitialView(): AppView {
  if (typeof window === 'undefined') return 'menu';
  const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (PATH_TO_VIEW[pathname]) {
    return PATH_TO_VIEW[pathname];
  }
  const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '/').replace(/\/+$/, '') || '/';
  if (PATH_TO_VIEW[hash]) {
    return PATH_TO_VIEW[hash];
  }
  // Unknown route
  if (pathname !== '/' && pathname !== '') {
    return '404';
  }
  return 'menu';
}

const App: React.FC = () => {
  // Session details stored in state and localStorage
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    const saved = localStorage.getItem('sqm_current_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authGateStep, setAuthGateStep] = useState<'welcome' | 'login'>('welcome');

  const [view, setView] = useState<AppView>(() => getInitialView());
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [rawData, setRawData] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [passwordRequest, setPasswordRequest] = useState<{ view: 'memoria' | 'galeria' | 'cambioTurno' | 'lce', name: string } | null>(null);
  const [isJefeTurnoUnlocked, setIsJefeTurnoUnlocked] = useState(false);
  const [uploadError, setUploadError] = useState<{
    message: string;
    missingColumns?: string[];
    foundHeaders?: string[];
  } | null>(null);

  // Outlook email prefill state
  const [isOutlookModalOpen, setIsOutlookModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('cristiantapia.espinoza@gmail.com');
  const [emailCC, setEmailCC] = useState('operaciones@novandino.cl, despacho@novandino.cl');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Enterprise UI Controls: Command Palette and Fullscreen Mode
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlRoomZoom, setControlRoomZoom] = useState<number>(1.0);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Global keyboard shortcut: Ctrl+K or Cmd+K to toggle Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Browser History Navigation Manager (supports browser back/forward arrows and direct URLs)
  const navigateTo = useCallback((nextView: AppView, replace: boolean = false) => {
    setView(nextView);
    if (typeof window !== 'undefined') {
      const targetPath = VIEW_TO_PATH[nextView] || '/';
      const currentPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
      if (currentPath !== targetPath) {
        if (replace) {
          window.history.replaceState({ view: nextView }, '', targetPath);
        } else {
          window.history.pushState({ view: nextView }, '', targetPath);
        }
      }
      if (VIEW_TITLES[nextView]) {
        document.title = VIEW_TITLES[nextView];
      }
    }
  }, []);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.state?.view && window.history.state.view !== 'menu') {
      window.history.back();
    } else {
      navigateTo('menu');
    }
  }, [navigateTo]);

  // Synchronize browser native back/forward buttons (popstate event)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const initView = getInitialView();
      const initPath = VIEW_TO_PATH[initView] || '/';
      window.history.replaceState({ view: initView }, '', initPath);
      if (VIEW_TITLES[initView]) {
        document.title = VIEW_TITLES[initView];
      }
    }

    const onPopState = (e: PopStateEvent) => {
      if (e.state && e.state.view && VIEW_TO_PATH[e.state.view as AppView]) {
        const nextView = e.state.view as AppView;
        setView(nextView);
        if (VIEW_TITLES[nextView]) {
          document.title = VIEW_TITLES[nextView];
        }
        return;
      }
      const currentPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
      const matched = PATH_TO_VIEW[currentPath] || (currentPath !== '/' ? '404' : 'menu');
      setView(matched);
      if (VIEW_TITLES[matched]) {
        document.title = VIEW_TITLES[matched];
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Sync access state with user roles on change and save session to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sqm_current_user', JSON.stringify(currentUser));
      if (currentUser.role === 'admin' || currentUser.role === 'jefe_turno') {
        setIsJefeTurnoUnlocked(true);
      } else {
        setIsJefeTurnoUnlocked(false);
      }
    } else {
      localStorage.removeItem('sqm_current_user');
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
    } else {
      // Auto-load latest operational report from Firebase Cloud if localStorage is empty
      (async () => {
        try {
          const { getOperationalReportsFromFirebase, safeParseBackupJSON } = await import('../services/firebase');
          const reports = await getOperationalReportsFromFirebase();
          if (reports && reports.length > 0) {
            const latest = reports[0];
            const backup = safeParseBackupJSON(latest.backupData);
            if (backup['sqm_raw_data']) {
              const parsed = typeof backup['sqm_raw_data'] === 'string'
                ? JSON.parse(backup['sqm_raw_data'])
                : backup['sqm_raw_data'];
              if (Array.isArray(parsed) && parsed.length > 0) {
                setRawData(parsed);
                setSelectedDate(latest.date);
                localStorage.setItem('sqm_raw_data', JSON.stringify(parsed));
                void saveOperationalSnapshot('operational_raw', parsed, parsed.length);
                // Also restore any historical sqm_ keys from backup
                Object.entries(backup).forEach(([k, v]) => {
                  if (k.startsWith('sqm_') && k !== 'sqm_current_user' && typeof v === 'string') {
                    localStorage.setItem(k, v);
                  }
                });
              }
            }
          }
        } catch (e) {
          console.error("Error auto-fetching reports from Firebase on startup:", e);
          const offlineSnapshot = await getOperationalSnapshot<any[]>('operational_raw');
          if (offlineSnapshot?.data && Array.isArray(offlineSnapshot.data) && offlineSnapshot.data.length > 0) {
            setRawData(offlineSnapshot.data);
            const dates = [...new Set(offlineSnapshot.data.map((r: any) => r.Fecha))].sort().reverse();
            if (dates.length > 0) setSelectedDate(dates[0] as string);
          }
        }
      })();
    }
  }, []);

  const isRunning = loading || exportingPDF || exportingImage;

  const handleLogout = () => {
    if (currentUser) {
      logActivity(currentUser, 'Cierre de Sesión', 'El usuario cerró sesión voluntariamente.');
    }
    setCurrentUser(null);
    setAuthGateStep('welcome');
    setIsJefeTurnoUnlocked(false);
    localStorage.removeItem('sqm_current_user');
    navigateTo('menu', true);
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
      const fileTitle = view === 'informe-sqm' ? 'Informe_Operativo_SQM_NY' : 'Informe_Operativo_Novandino';
      pdf.save(`${fileTitle}_${selectedDate}.pdf`);

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
      const imgTitle = view === 'informe-sqm' ? 'Resumen_Operativo_SQM_NY' : 'Resumen_Operativo_Novandino';
      link.download = `${imgTitle}_${selectedDate}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Record image generation audit log
      if (currentUser) {
        logActivity(currentUser, 'Exportó PNG', `Descargó placa gráfica de KPIs principales para la jornada ${formatDateToCL(selectedDate)}.`);
      }
    } catch (error) {
      console.error('Error al capturar imagen:', error);
      alert('Error al generar la imagen PNG.');
      throw error;
    } finally {
      setExportingImage(false);
    }
  };

  const processFile = useCallback((file: File) => {
    return new Promise<{ success: boolean; recordCount: number; fileName: string }>((resolve, reject) => {
      setLoading(true);
      setUploadError(null);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames.find(n => n === "Base de Datos") || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];
        if (jsonData.length < 2) throw new Error("Archivo vacío o no estructurado.");
        
        // Find the best header row within first 15 rows
        let bestHeaderRowIdx = 0;
        let bestMatchCount = -1;
        let bestIdxs: Record<string, number> = {};
        let bestHeadersList: string[] = [];

        const scanLimit = Math.min(jsonData.length, 15);
        for (let rIdx = 0; rIdx < scanLimit; rIdx++) {
          const rowHeaders = Array.from(jsonData[rIdx] || []).map(h => {
            if (h === undefined || h === null) return '';
            return normalizeHeader(String(h));
          });
          
          const getIdxForHeaders = (
            aliases: string[], 
            fuzzyKeywords?: { mustContain: string[], orContain?: string[] }[]
          ): number => {
            // 1. Exact values
            for (const alias of aliases) {
              const normAlias = normalizeHeader(alias);
              if (normAlias.length < 2) continue;
              const exactIdx = rowHeaders.findIndex(h => h === normAlias);
              if (exactIdx !== -1) return exactIdx;
            }
            // 2. Partial string matches (bidirectional includes checks)
            for (const alias of aliases) {
              const normAlias = normalizeHeader(alias);
              if (normAlias.length < 3) continue;
              const partialIdx = rowHeaders.findIndex(h => h && (h.includes(normAlias) || normAlias.includes(h)));
              if (partialIdx !== -1) return partialIdx;
            }
            // 3. Fallback to fuzzy keyword heuristics (very powerful)
            if (fuzzyKeywords) {
              for (const fk of fuzzyKeywords) {
                const foundIdx = rowHeaders.findIndex(h => {
                  if (!h) return false;
                  const hasAllMust = fk.mustContain.every(term => h.includes(term));
                  if (!hasAllMust) return false;
                  if (fk.orContain && fk.orContain.length > 0) {
                    return fk.orContain.some(term => h.includes(term));
                  }
                  return true;
                });
                if (foundIdx !== -1) return foundIdx;
              }
            }
            return -1;
          };

          const currentIdxs = {
            fecha: getIdxForHeaders(
              ["FECHA", "JORNADA", "DIA"],
              [{ mustContain: ["FECHA"] }, { mustContain: ["JORNADA"] }]
            ),
            producto: getIdxForHeaders(
              ["PRODUCTO", "NIVEL", "PRODUCTO META", "PROD"],
              [{ mustContain: ["PRODUCTO"] }, { mustContain: ["PROD", "META"] }, { mustContain: ["NIVEL"] }]
            ),
            destino: getIdxForHeaders(
              ["DESTINO", "UBICACION", "UBICACIÓN", "ENTREGA", "PUNTO ENTREGA", "DES"],
              [{ mustContain: ["DESTIN"] }, { mustContain: ["UBICAC"] }, { mustContain: ["ENTREG"] }]
            ),
            empresa: getIdxForHeaders(
              ["EMPRESA", "TRANSPORTISTA", "EMPRESA TRANSPORTE", "FLETERO", "COMPAÑÍA", "CÍA", "COMPAÑIA", "CIA"],
              [{ mustContain: ["EMPRES"] }, { mustContain: ["FLETER"] }, { mustContain: ["TRANSP"] }]
            ),
            tonProg: getIdxForHeaders(
              ["TON PROG", "PROGRAMADO", "TONELADAS PROGRAMADAS", "TONELADAS PROG", "TONELADA PROGRAMADA"],
              [{ mustContain: ["TON", "PROG"] }, { mustContain: ["TONELADA", "PROG"] }]
            ),
            tonReal: getIdxForHeaders(
              ["TON REAL", "REAL", "TONELADAS REALES", "TONELADA REAL"],
              [{ mustContain: ["TON", "REAL"] }, { mustContain: ["TONELADA", "REAL"] }]
            ),
            eqProg: getIdxForHeaders(
              ["EQ PROG", "EQUIPOS PROGRAMADOS", "EQUIPOS PROG", "FLOTA PROGRAMADA", "FLOTA PROG"],
              [
                { mustContain: ["FLOTA", "PROG"] },
                { mustContain: ["EQUIP", "PROG"] },
                { mustContain: ["EQ", "PROG"] },
                { mustContain: ["FLOTA", "PROGRAMA"] },
                { mustContain: ["EQUIP", "PROGRAMA"] },
                { mustContain: ["EQ", "PROGRAMA"] }
              ]
            ),
            eqReal: getIdxForHeaders(
              ["EQ REAL", "EQUIPOS REALES", "EQ REALES", "FLOTA REAL", "FLOTA REALES", "INTENSIDAD FLOTA", "INTENSIDAD DE FLOTA"],
              [
                { mustContain: ["FLOTA", "REAL"] },
                { mustContain: ["EQUIP", "REAL"] },
                { mustContain: ["EQ", "REAL"] },
                { mustContain: ["CAMION", "REAL"] },
                { mustContain: ["FLOTA", "EFECTIV"] },
                { mustContain: ["EQUIP", "EFECTIV"] },
                { mustContain: ["EQ", "EFECTIV"] },
                { mustContain: ["FLOTA", "ACTIV"] },
                { mustContain: ["INTENSIDAD"] }
              ]
            ),
            regReal: getIdxForHeaders(
              ["REGULACION REAL", "REGULACION", "PORCENTAJE DE REGULACION", "REGULACION REAL %", "% REGULALION", "% REGULACION", "REGULACION %", "REG REAL"],
              [
                { mustContain: ["REGULAC"] },
                { mustContain: ["REGULAL"] },
                { mustContain: ["REGULA"] },
                { mustContain: ["%"], orContain: ["REG", "COMPL"] }
              ]
            ),
            sda: getIdxForHeaders(
              ["SDA HRS", "SDA", "SDA HOURS", "SDA H", "SDA (Hrs)", "FAENA SDA"],
              [{ mustContain: ["SDA"] }, { mustContain: ["S D A"] }, { mustContain: ["SANTIAGO"] }]
            ),
            pang: getIdxForHeaders(
              ["PANG HRS", "PANG", "PANG HOURS", "NY HRS", "NY", "TIEMPO GRAL FAENA NY", "NY (Hrs)", "FAENA NY", "N Y"],
              [{ mustContain: ["NY"] }, { mustContain: ["N Y"] }, { mustContain: ["NEWYORK"] }, { mustContain: ["NEW", "YORK"] }, { mustContain: ["PANG"] }]
            ),
            faenaMeta: getIdxForHeaders(
              ["FAENA META HRS", "FAENA META", "TIEMPO INTERIOR FAENA PRODUCTO META", "FAENA META HORAS", "FAENA META (Hrs)"],
              [{ mustContain: ["FAENA", "META"] }, { mustContain: ["META", "HRS"] }, { mustContain: ["META", "HOUR"] }]
            ),
            faenaReal: getIdxForHeaders(
              ["FAENA REAL HRS", "FAENA REAL", "TIEMPO INTERIOR FAENA REAL", "FAENA REAL HORAS", "FAENA REAL (Hrs)"],
              [{ mustContain: ["FAENA", "REAL"] }, { mustContain: ["REAL", "HRS"] }, { mustContain: ["REAL", "HOUR"] }]
            )
          };

          const matchCount = Object.values(currentIdxs).filter(v => v !== -1).length;
          if (matchCount > bestMatchCount) {
            bestMatchCount = matchCount;
            bestHeaderRowIdx = rIdx;
            bestIdxs = currentIdxs;
            bestHeadersList = rowHeaders;
          }
        }

        const idx = bestIdxs;
        const headers = bestHeadersList;
        const rows = jsonData.slice(bestHeaderRowIdx + 1);

        // Check only critical columns
        const criticalMissing: string[] = [];
        if (idx.fecha === -1) criticalMissing.push("Fecha (ej. FECHA, JORNADA, DIA)");
        if (idx.producto === -1) criticalMissing.push("Producto (ej. PRODUCTO, NIVEL, PRODUCTO META)");

        if (criticalMissing.length > 0) {
          setUploadError({
            message: `Columnas obligatorias faltantes en el Excel. No se encontró el encabezado para: ${criticalMissing.join(', ')}.`,
            missingColumns: criticalMissing,
            foundHeaders: headers.filter(h => h.trim() !== '')
          });
          throw new Error("No se pudo mapear la estructura obligatoria de columnas.");
        }
        
        const processed = rows.map((row) => {
          if (!row || row[idx.fecha] === undefined || row[idx.fecha] === null) return null;
          if (idx.producto !== -1 && (row[idx.producto] === undefined || row[idx.producto] === null)) return null;
          
          let dateStr = '';
          const rawDate = row[idx.fecha];
          if (rawDate instanceof Date) {
            dateStr = rawDate.toISOString().split('T')[0];
          } else {
            const rawVal = String(rawDate).trim();
            if (rawVal.includes('/')) {
              const pts = rawVal.split('/');
              if (pts[2]?.length === 4) dateStr = `${pts[2]}-${pts[1].padStart(2, '0')}-${pts[0].padStart(2, '0')}`;
            } else if (rawVal.includes('-')) {
              const pts = rawVal.split('-');
              if (pts[0]?.length === 4) {
                dateStr = rawVal;
              } else if (pts[2]?.length === 4) {
                dateStr = `${pts[2]}-${pts[1].padStart(2, '0')}-${pts[0].padStart(2, '0')}`;
              }
            }
          }
          if (!dateStr || dateStr === 'undefined') return null;

          // Check column AF (index 31) explicitly for SLIT
          const valAF = row[31] !== undefined && row[31] !== null ? String(row[31]).trim().toUpperCase() : '';
          const isSlit = valAF === 'SLIT' || valAF.includes('SLIT');

          const finalProduct = formatCLB(isSlit ? valAF : (idx.producto !== -1 ? String(row[idx.producto]).trim().toUpperCase() : 'DESCONOCIDO'));

          return {
            Fecha: dateStr,
            Producto: finalProduct,
            Destino: idx.destino !== -1 ? formatCLB(String(row[idx.destino]).trim()).toUpperCase() : 'S/D',
            EmpresaMapped: idx.empresa !== -1 ? formatCLB(String(row[idx.empresa] || '').trim()).toUpperCase() : '',
            Ton_Prog: isSlit ? cleanNumeric(row[33]) : (idx.tonProg !== -1 ? cleanNumeric(row[idx.tonProg]) : 0), // AH
            Ton_Real: isSlit ? cleanNumeric(row[34]) : (idx.tonReal !== -1 ? cleanNumeric(row[idx.tonReal]) : 0), // AI
            Eq_Prog: isSlit ? cleanNumeric(row[35]) : (idx.eqProg !== -1 ? cleanNumeric(row[idx.eqProg]) : 0),   // AJ
            Eq_Real: isSlit ? cleanNumeric(row[36]) : (idx.eqReal !== -1 ? cleanNumeric(row[idx.eqReal]) : 0),   // AK
            Regulacion_Real: idx.regReal !== -1 ? (() => {
              const raw = row[idx.regReal];
              const val = cleanNumeric(raw);
              if (val > 0 && val <= 1.0) return val * 100;
              return val;
            })() : (isSlit ? (() => {
              const val38 = cleanNumeric(row[38]); // col AM: fallback % Regulación
              if (val38 > 0) {
                return val38 > 0 && val38 <= 1.0 ? val38 * 100 : val38;
              }
              const val37 = cleanNumeric(row[37]); // col AL fallback
              return val37 > 0 && val37 <= 1.0 ? val37 * 100 : val37;
            })() : 0),
            sdaHours: idx.sda !== -1 ? parseExcelTime(row[idx.sda]) : 0,
            pangHours: idx.pang !== -1 ? parseExcelTime(row[idx.pang]) : 0,
            faenaMetaHours: isSlit ? parseExcelTime(row[49]) : (idx.faenaMeta !== -1 ? parseExcelTime(row[idx.faenaMeta]) : 0), // AX
            faenaRealHours: isSlit ? parseExcelTime(row[50]) : (idx.faenaReal !== -1 ? parseExcelTime(row[idx.faenaReal]) : 0), // AY

            // Custom fields mapped exactly from corresponding columns:
            col_TiempoInteriorFaenaProdMeta: parseExcelTime(row[49]), // AX (index 49)
            col_TiempoInteriorFaenaReal: parseExcelTime(row[50]), // AY (index 50)
            col_PromedioCargaMeta: cleanNumeric(row[47]), // AV (index 47)
            col_PromedioCargaReal: cleanNumeric(row[48]), // AW (index 48)
            col_TonProg: cleanNumeric(row[33]), // AH (index 33)
            col_TonReal: cleanNumeric(row[34]), // AI (index 34)
            col_EqProg: cleanNumeric(row[35]), // AJ (index 35)
            col_EqReal: cleanNumeric(row[36]), // AK (index 36)
            col_PercentCumplimiento: (() => {
              const val = cleanNumeric(row[37]); // AL (index 37)
              return val > 0 && val <= 1.0 ? val * 100 : val;
            })(),
            col_CantidadRegulaciones: cleanNumeric(row[44]), // AS (index 44)
            col_MqAljibesProg: cleanNumeric(row[12]), // M (index 12)
            col_MqAljibesReal: cleanNumeric(row[13]), // N (index 13)
            col_JorqueraAljibesProg: cleanNumeric(row[20]), // U (index 20)
            col_JorqueraAljibesReal: cleanNumeric(row[21])  // V (index 21)
          };
        }).filter(r => r !== null);
        
        if (processed.length === 0) {
          throw new Error("No se encontraron registros de datos operativos válidos después del encabezado.");
        }

        localStorage.removeItem('sqm_raw_data');
        setRawData(processed);
        localStorage.setItem('sqm_raw_data', JSON.stringify(processed));
        void saveOperationalSnapshot('operational_raw', processed, processed.length);
        const dates = [...new Set(processed.map(r => r.Fecha))].sort().reverse();
        if (dates.length > 0) setSelectedDate(dates[0]);
        
        // Log import action
        if (currentUser) {
          logActivity(currentUser, 'Carga de Datos', `Cargó archivo base Excel con ${processed.length} registros operativos.`);
        }

        resolve({
          success: true,
          recordCount: processed.length,
          fileName: file.name
        });
      } catch (err: any) {
        console.error("Error processing file:", err);
        setUploadError({
          message: err.message || 'Error desconocido al procesar el archivo Excel.'
        });
        reject(err);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = (err) => {
      setLoading(false);
      reject(err);
    };
    reader.readAsBinaryString(file);
    });
  }, [currentUser]);

  const separatedRawData = useMemo(() => {
    return separateBischofitaByDest(rawData);
  }, [rawData]);

  const filteredData = useMemo(() => {
    const base = separatedRawData.filter(r => r.Fecha === selectedDate);
    if (view === 'informe-novandino') {
      return base.filter(r => isProductNovandino(r));
    }
    if (view === 'informe-sqm') {
      return base.filter(r => isProductSQM(r));
    }
    return base;
  }, [separatedRawData, selectedDate, view]);

  const availableDates = useMemo(() => {
    return [...new Set(rawData.map(r => r.Fecha))].sort();
  }, [rawData]);

  const previousDate = useMemo(() => {
    if (!selectedDate || availableDates.length <= 1) return null;
    const idx = availableDates.indexOf(selectedDate);
    if (idx > 0) {
      return availableDates[idx - 1];
    }
    return null;
  }, [selectedDate, availableDates]);

  const calculateMetricsForDate = useCallback((date: string | null) => {
    if (!date) return null;
    const base = separatedRawData.filter(r => r.Fecha === date);
    let filtered;
    if (view === 'informe-novandino') {
      filtered = base.filter(r => isProductNovandino(r));
    } else if (view === 'informe-sqm') {
      filtered = base.filter(r => isProductSQM(r));
    } else {
      filtered = base;
    }

    if (filtered.length === 0) return null;

    const totalTonReal = filtered.reduce((a, b) => a + b.Ton_Real, 0);
    const totalTonProg = filtered.reduce((a, b) => a + b.Ton_Prog, 0);
    const totalEqReal = filtered.reduce((a, b) => a + b.Eq_Real, 0);
    const totalEqProg = filtered.reduce((a, b) => a + (b.Eq_Prog || 0), 0);
    const avgReg = filtered.reduce((acc, d) => acc + (Number(d.Regulacion_Real) || 0), 0) / filtered.length;
    const validSdaTimes = filtered.map(d => d.sdaHours).filter(v => v > 0);
    const avgSda = validSdaTimes.length > 0 ? validSdaTimes.reduce((a, b) => a + b, 0) / validSdaTimes.length : 0;
    const validPangTimes = filtered.map(d => d.pangHours).filter(v => v > 0);
    const avgPang = validPangTimes.length > 0 ? validPangTimes.reduce((a, b) => a + b, 0) / validPangTimes.length : 0;
    const totalHoursInFaena = filtered.reduce((a, b) => a + b.faenaRealHours, 0);
    const productivity = totalHoursInFaena > 0 ? totalTonReal / totalHoursInFaena : 0;
    const compliance = totalTonProg > 0 ? (totalTonReal / totalTonProg) * 100 : 0;
    const avgLoad = totalEqReal > 0 ? totalTonReal / totalEqReal : 0;

    return {
      avgSda,
      avgPang,
      productivity,
      totalTonReal,
      compliance,
      totalEqReal,
      avgLoad,
      avgReg
    };
  }, [separatedRawData, view]);

  const currentMetrics = useMemo(() => {
    return calculateMetricsForDate(selectedDate);
  }, [selectedDate, calculateMetricsForDate]);

  const previousMetrics = useMemo(() => {
    return calculateMetricsForDate(previousDate);
  }, [previousDate, calculateMetricsForDate]);

  const operationalKPIs = useMemo(() => {
    if (!currentMetrics) return null;

    const {
      avgSda,
      avgPang,
      productivity,
      totalTonReal,
      compliance,
      totalEqReal,
      avgLoad,
      avgReg
    } = currentMetrics;

    const prev = previousMetrics;

    const getComparisonObj = (currVal: number, prevVal: number | undefined, type: 'time' | 'percent' | 'number' | 'decimal', unit: string, isLowerBetter: boolean = false) => {
      if (prevVal === undefined || prevVal === null) return null;
      
      if (type === 'time') {
        const diffMinutes = Math.round((currVal - prevVal) * 60);
        if (diffMinutes > 0) {
          return { text: `+${diffMinutes} min`, arrow: '↑', isPositive: isLowerBetter ? false : true, isChange: true };
        } else if (diffMinutes < 0) {
          return { text: `-${Math.abs(diffMinutes)} min`, arrow: '↓', isPositive: isLowerBetter ? true : false, isChange: true };
        }
        return { text: 'Sin cambios', arrow: '•', isPositive: null, isChange: false };
      }

      const diff = currVal - prevVal;
      if (Math.abs(diff) < 0.01) {
        return { text: 'Sin cambios', arrow: '•', isPositive: null, isChange: false };
      }

      let formattedDiff = '';
      if (type === 'percent') {
        formattedDiff = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
      } else if (type === 'decimal') {
        formattedDiff = `${diff > 0 ? '+' : ''}${diff.toFixed(1)} ${unit}`;
      } else {
        formattedDiff = `${diff > 0 ? '+' : ''}${Math.round(diff).toLocaleString()} ${unit}`;
      }

      const isIncrease = diff > 0;
      const isPositive = isLowerBetter ? !isIncrease : isIncrease;

      return {
        text: formattedDiff,
        arrow: isIncrease ? '↑' : '↓',
        isPositive,
        isChange: true
      };
    };

    return [
      { 
        label: "Tiempo Gral. Faena (SdA) (2:00)", 
        value: formatHoursToTime(avgSda), 
        icon: <Clock className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(avgSda, prev?.avgSda, 'time', 'min', true) 
      },
      { 
        label: "Tiempo Gral. Faena (NY) (2:00)", 
        value: formatHoursToTime(avgPang), 
        icon: <Clock className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(avgPang, prev?.avgPang, 'time', 'min', true) 
      },
      { 
        label: "Productividad Diaria", 
        value: `${productivity.toFixed(1)} T/H`, 
        icon: <TrendingUp className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(productivity, prev?.productivity, 'decimal', 'T/H', false) 
      },
      { 
        label: "Carga Real Despachada", 
        value: `${formatNumberWithDecimals(totalTonReal, 2)} Ton`, 
        icon: <Truck className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(totalTonReal, prev?.totalTonReal, 'number', 'Ton', false) 
      },
      { 
        label: "Cumplimiento Programa", 
        value: `${compliance.toFixed(1)}%`, 
        icon: <Target className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(compliance, prev?.compliance, 'percent', '%', false) 
      },
      { 
        label: "Intensidad de Flota", 
        value: `${totalEqReal} EQ`, 
        icon: <Users className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(totalEqReal, prev?.totalEqReal, 'number', 'EQ', false) 
      },
      { 
        label: "Factor de Carga (Eficiencia)", 
        value: `${avgLoad.toFixed(1)} T/EQ`, 
        icon: <Scale className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(avgLoad, prev?.avgLoad, 'decimal', 'T/EQ', false) 
      },
      { 
        label: "Promedio % de Regulación", 
        value: `${Math.round(avgReg)}%`, 
        icon: <ClipboardCheck className="w-3.5 h-3.5" />, 
        comparison: getComparisonObj(avgReg, prev?.avgReg, 'percent', '%', false) 
      },
    ].filter(item => {
      if (view === 'informe-novandino' && item.label.startsWith("Tiempo Gral. Faena (NY)")) {
        return false;
      }
      if (view === 'informe-sqm' && item.label.startsWith("Tiempo Gral. Faena (SdA)")) {
        return false;
      }
      return true;
    });
  }, [currentMetrics, previousMetrics, view]);

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

  // Dynamic email pre-fill calculations
  useEffect(() => {
    if (isOutlookModalOpen && selectedDate) {
      const isNovandino = view === 'informe-novandino';
      const typeStr = isNovandino ? 'NOVANDINO' : 'SQM NY';
      const formattedDate = formatDateToCL(selectedDate);
      setEmailSubject(`INFORME OPERATIVO ${typeStr} - JORNADA ${formattedDate}`);
      
      if (isNovandino) {
        setEmailTo('claudio.siniga@novandino.com, carlo.castellaro@novandino.com');
        setEmailCC('Despacho.Salar@sqm.com, carlos.diaz@novandino.com, carlos.mardones.luna@novandino.com, tamara.cabrera@novandino.com, hugo.morgado@novandino.com, Servicio.Transporte.Litio@sqm.com, tomislav.cvitanic@novandino.com, CoordinacionTerrestreLitio@novandino.com, jaime.ardiles@novandino.com');
        
        const bodyText = `Estimados, buen día.\n\n` +
          `Junto con saludar, comparto con ustedes el resumen de la gestión operativa correspondiente a la jornada recién pasada.\n` +
          `A continuación, se presenta la visualización del dashboard con los KPIs principales:\n\n` +
          `[Pegar Imagen PNG del Dashboard Aquí (Ctrl+V)]\n\n` +
          `Adjunto encontrarán el Informe Operativo detallado en PDF, donde se desglosa el detalle de desempeño, los destinos y el registro de eventos para cada línea de producto.\n\n` +
          `Atentamente,`;
        setEmailBody(bodyText);
      } else {
        setEmailTo('claudio.siniga@novandino.com, Allan.Duvauchelle@sqm.com');
        setEmailCC('Alejandro.Gomez@sqm.com, gilbert.maldonado@novandino.com, carlo.castellaro@novandino.com, sebastian.parada@novandino.com, Despacho.Salar@sqm.com, carlos.diaz@novandino.com, Servicio.Transporte.Litio@sqm.com, SupTransporteCS@sqm.com, Maria.Aguilera@sqm.com, andres.salinas.ignacio@novandino.com, jaime.ardiles@novandino.com, ControlProductosSalar@novandino.com');
        
        const bodyText = `Estimados, buen día.\n\n` +
          `Junto con saludar, comparto con ustedes el resumen de la gestión operativa correspondiente a la jornada recién pasada.\n` +
          `A continuación, se presenta la visualización del dashboard con los KPIs principales:\n\n` +
          `[Pegar Imagen PNG del Dashboard Aquí (Ctrl+V)]\n\n` +
          `Adjunto encontrarán el Informe Operativo detallado en PDF, donde se desglosa el detalle de desempeño, los destinos y el registro de eventos para cada línea de producto.\n\n` +
          `Atentamente,`;
        setEmailBody(bodyText);
      }
    }
  }, [isOutlookModalOpen, selectedDate, view, operationalKPIs, currentUser]);

  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);

  const handleSyncToFirebase = async (date: string): Promise<boolean> => {
    setIsSyncingFirebase(true);
    try {
      const success = await syncBackupToFirebase(date);
      if (!success) {
        throw new Error('No se pudo guardar el historial en Firebase');
      }
      return true;
    } catch (err) {
      console.error('Error guardando en Firebase:', err);
      throw err;
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const handleViewChange = (v: AppView) => {
    navigateTo(v);
  };

  const renderCurrentView = () => {
    if (view === 'logs' && (currentUser?.role === 'admin' || currentUser?.role === 'jefe_turno')) {
      return <ActivityLogsView currentUser={currentUser} onBack={handleBack} />;
    }
    if (view === 'users' && currentUser?.role === 'admin') {
      return <UserManagementView currentUser={currentUser} onBack={handleBack} onUpdateCurrentUser={setCurrentUser} />;
    }
    if (view === 'menu') return (
      <MainMenu 
        onSelectView={handleViewChange} 
        isJefeTurnoUnlocked={isJefeTurnoUnlocked}
        onUnlockJefeTurno={() => setIsJefeTurnoUnlocked(true)}
        currentUser={currentUser!}
        onLogout={handleLogout}
        initialLocation={activeLocation}
        onLocationChange={setActiveLocation}
      />
    );
    if (view === 'llegada') return <LlegadaEquipos currentUser={currentUser} onBack={handleBack} />;
    if (view === 'slit' && currentUser?.role === 'admin') {
      return <SlitDashboard data={rawData} onBack={handleBack} />;
    }
    if (view === 'memoria') {
      if (!isJefeTurnoUnlocked) {
        return (
          <PasswordPrompt 
            correctPassword="MIRAME"
            moduleName="Memoria"
            onSuccess={() => setIsJefeTurnoUnlocked(true)}
            onCancel={handleBack}
          />
        );
      }
      return (
        <MemoryModule
          data={rawData}
          onBack={handleBack}
          onSelectDate={(d) => { setSelectedDate(d); navigateTo('informe-novandino'); }}
        />
      );
    }
    if (view === 'ddd') return (
      <DdDTablero
        data={rawData}
        selectedDate={selectedDate}
        onBack={handleBack}
      />
    );
    if (view === 'galeria') return (
      <ImageGallery 
        onBack={handleBack} 
        rawData={rawData}
        selectedDate={selectedDate}
        onDataLoaded={(loadedData, loadedDate) => {
          setRawData(loadedData);
          if (loadedDate) setSelectedDate(loadedDate);
        }}
      />
    );
    if (view === 'cambioTurno') {
      if (!isJefeTurnoUnlocked) {
        return (
          <PasswordPrompt 
            correctPassword="MIRAME"
            moduleName="Cambio de Turno"
            onSuccess={() => setIsJefeTurnoUnlocked(true)}
            onCancel={handleBack}
          />
        );
      }
      return <CambioDeTurno onBack={handleBack} />;
    }
    if (view === 'lce') {
      if (!isJefeTurnoUnlocked) {
        return (
          <PasswordPrompt 
            correctPassword="MIRAME"
            moduleName="Control LCE"
            onSuccess={() => setIsJefeTurnoUnlocked(true)}
            onCancel={handleBack}
          />
        );
      }
      return <LCEModule currentUser={currentUser} onBack={handleBack} />;
    }
    if (view === 'cumplimiento-mq') return <CumplimientoMQ onBack={handleBack} />;
    if (view === 'cumplimiento-jorquera') return <CumplimientoJorquera onBack={handleBack} />;
    if (view === 'informe-operativo') return <InformeOperativo onBack={handleBack} />;
    if (view === 'stokes') {
      if (!currentUser) {
        navigateTo('menu', true);
        return null;
      }
      return <ModuloStokes currentUser={currentUser} onBack={handleBack} />;
    }

    if (view === '404') {
      return (
        <NotFoundView
          attemptedPath={typeof window !== 'undefined' ? window.location.pathname : ''}
          onNavigate={navigateTo}
          onBack={handleBack}
          onOpenSearch={() => setIsCommandPaletteOpen(true)}
        />
      );
    }

    // fallback sidebar layout for standard dashboard view
    return (
      <div className="flex h-screen bg-[#ECEAE3] font-sans text-[#181615] overflow-hidden relative">
        {/* PESTAÑA FLOTANTE PARA MOSTRAR EL MENÚ LATERAL CUANDO ESTÁ OCULTO */}
        {isSidebarCollapsed && (
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(false)}
            className="fixed top-20 left-0 z-50 bg-[#461D77] text-white hover:bg-[#36155E] border border-l-0 border-[#461D77] rounded-r-md p-2.5 shadow-[2px_2px_8px_rgba(24,22,21,0.16)] flex items-center justify-center transition-colors duration-150 cursor-pointer no-print group"
            title="Mostrar Menú Lateral"
          >
            <ChevronRight size={18} className="text-white group-hover:translate-x-0.5 transition-transform duration-150" />
          </button>
        )}

        <aside className={`bg-[#E5E2D9] border-r border-[#D5D0C5] flex flex-col no-print shrink-0 relative transition-all duration-200 ease-out ${
          isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden border-r-0' : 'w-[290px] opacity-100'
        }`}>
          {/* BOTÓN PARA OCULTAR EL MENÚ LATERAL */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(true)}
            className="absolute top-4 right-3 z-30 w-7 h-7 rounded-md bg-white hover:bg-[#F2F0EA] border border-[#D8D4CA] flex items-center justify-center text-[#461D77] transition-colors duration-150 cursor-pointer no-print shadow-[0_1px_2px_rgba(24,22,21,0.06)]"
            title="Ocultar Menú Lateral"
          >
            <ChevronLeft size={15} />
          </button>

          <div className="p-5 overflow-y-auto flex-1 space-y-6">
            <div className="flex flex-col gap-2 mb-2">
              {activeLocation && (
                <button
                  onClick={() => {
                    handleBack();
                  }}
                  className="flex items-center gap-2 text-[#461D77] hover:text-[#36155E] font-semibold text-xs uppercase tracking-wider transition-colors group cursor-pointer"
                >
                  <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform duration-150" /> Volver a {activeLocation}
                </button>
              )}

              <button
                onClick={() => {
                  setActiveLocation(null);
                  navigateTo('menu');
                }}
                className="flex items-center gap-2 text-[#57534E] hover:text-[#181615] font-semibold text-xs uppercase tracking-wider transition-colors group cursor-pointer"
              >
                <Home size={13} className="group-hover:-translate-x-0.5 transition-transform duration-150" /> Menú Principal
              </button>
            </div>

            <ExcelUploadDropzone
              onProcessFile={processFile}
              isProcessingExternal={loading}
              loadedRecordCount={rawData.length}
            />
            {rawData.length > 0 && (
              <>
                <div className="space-y-1.5">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">Jornada</p>
                  <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-white border border-[#D8D4CA] focus:border-[#461D77] rounded-md px-3 py-2.5 text-sm font-mono font-semibold text-[#181615] outline-none">
                    {[...new Set(rawData.map(r => r.Fecha))].sort().reverse().map(d => <option key={d as string} value={d as string}>{formatDateToCL(d as string)}</option>)}
                  </select>
                </div>
                <div className="space-y-2.5 pt-4 border-t border-[#D5D0C5]">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#57534E] mb-1">Herramientas</p>
                  <ExportDownloadButton
                    type="pdf"
                    onClick={handleExportPDF}
                    isLoading={exportingPDF}
                  />
                  <ExportDownloadButton
                    type="png"
                    onClick={handleExportImage}
                    isLoading={exportingImage}
                  />
                  <OutlookSendButton
                    onClick={() => setIsOutlookModalOpen(true)}
                    autoreset={1800}
                  />

                  <FirebaseSyncButton
                    onSync={() => handleSyncToFirebase(selectedDate)}
                    isSyncingExternal={isSyncingFirebase}
                  />
                </div>
              </>
            )}
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto relative bg-[#ECEAE3]">
          {isRunning && (
            <div className="absolute top-4 right-6 z-50 flex items-center gap-2.5 bg-white px-4 py-1.5 rounded-md shadow-[0_2px_6px_rgba(24,22,21,0.1)] border border-[#D8D4CA] no-print">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#461D77]" />
              <span className="font-mono text-[11px] font-semibold text-[#461D77] uppercase tracking-wider">Procesando...</span>
            </div>
          )}
          <div className="max-w-5xl mx-auto p-6 sm:p-8 space-y-6" id="dashboard-report">
            {rawData.length === 0 ? (
              <div className="surface-card rounded-lg py-20 px-8 flex flex-col items-center text-center space-y-6 max-w-xl mx-auto mt-8">
                <div className="w-16 h-16 surface-well rounded-lg flex items-center justify-center text-[#461D77]">
                  <BarChart3 size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#181615] tracking-[-0.02em] uppercase mb-1.5">Gestión de Despacho Litio</h2>
                  <p className="text-sm text-[#57534E]">Cargue un archivo base Excel en el panel izquierdo para iniciar el informe.</p>
                </div>

                {uploadError && (
                  <div className="w-full bg-red-50 border border-red-200 rounded-lg p-5 text-left space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-md bg-red-100 flex items-center justify-center text-[#B91C1C] font-bold shrink-0">!</div>
                      <div>
                        <h4 className="font-bold text-[#181615] text-sm">Error al interpretar la base de datos</h4>
                        <p className="text-xs text-[#B91C1C] mt-1">{uploadError.message}</p>
                      </div>
                    </div>

                    {uploadError.missingColumns && uploadError.missingColumns.length > 0 && (
                      <div className="bg-white border border-[#D8D4CA] rounded-md p-3.5 text-xs space-y-2">
                        <span className="font-mono text-[10px] font-semibold text-[#B91C1C] uppercase tracking-wider block">Columnas críticas faltantes:</span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {uploadError.missingColumns.map((col, cIdx) => (
                            <span key={cIdx} className="bg-red-50 border border-red-200 text-[#B91C1C] px-2 py-0.5 rounded font-mono text-[11px] font-semibold">{col}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {uploadError.foundHeaders && uploadError.foundHeaders.length > 0 && (
                      <div className="surface-well rounded-md p-3.5 text-xs space-y-2 max-h-40 overflow-y-auto">
                        <span className="font-mono text-[10px] font-semibold text-[#181615] uppercase tracking-wider block">Cabeceras leídas en el Excel:</span>
                        <div className="flex flex-wrap gap-1">
                          {uploadError.foundHeaders.map((hdr, hIdx) => (
                            <span key={hIdx} className="bg-white border border-[#D8D4CA] text-[#57534E] px-1.5 py-0.5 rounded text-[10px] font-mono">{hdr}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (() => {
              const reportTitle = view === 'informe-sqm' ? 'INFORME OPERATIVO SQM NY' : 'INFORME OPERATIVO NOVANDINO';
              const reportSubtitle = view === 'informe-sqm' ? 'SUBGERENCIA LOGÍSTICA LITIO' : 'SUBGERENCIA LOGÍSTICA LITIO - DESPACHO LITIO';
              return (
                <>
                  <div id="pdf-cover-page" className="pdf-only page-break-after flex flex-col items-center justify-center min-h-[1000px] w-full bg-white text-center">
                    <div className="space-y-24 flex flex-col items-center w-full">
                      <div className="flex flex-col items-center justify-center text-center w-full">
                        <div className="flex flex-col items-center text-center">
                          <NovandinoLogo className="h-40 w-[600px] max-w-full mb-10" variant="large" />
                          <h1 className="text-[60px] font-[950] text-[#1e293b] tracking-[-0.04em] leading-tight uppercase">
                            {view === 'informe-sqm' ? (
                              <>
                                INFORME OPERATIVO<br />SQM NY
                              </>
                            ) : (
                              'INFORME OPERATIVO NOVANDINO'
                            )}
                          </h1>
                          <p className="text-slate-400 font-bold text-sm tracking-[0.4em] uppercase mt-3 whitespace-nowrap">{reportSubtitle}</p>
                        </div>
                      </div>
                      <div className="pt-20">
                        <p className="text-violeta/30 font-black text-xs tracking-[0.4em] uppercase mb-6">JORNADA CORRESPONDIENTE</p>
                        <p className="text-6xl font-[950] text-ionizado tracking-tighter">{formatDateToCL(selectedDate)}</p>
                      </div>
                    </div>
                  </div>
                  <div id="executive-summary-capture" className="no-pdf surface-card border-t-2 border-t-[#461D77] rounded-lg space-y-8 min-h-[1000px] flex flex-col mb-10 no-page-break">
                    <div className="p-8 space-y-10 flex-1">
                      <div className="flex justify-between items-start pb-8 border-b border-[#D8D4CA]">
                        <div className="flex flex-col items-start gap-4">
                          <NovandinoLogo className="h-32 w-[480px] max-w-full" variant="print" />
                          <div>
                            <h1 className="text-5xl font-[900] text-[#181615] tracking-[-0.03em] leading-tight mb-1 uppercase">
                              {view === 'informe-sqm' ? (
                                <>
                                  INFORME OPERATIVO<br />SQM NY
                                </>
                              ) : (
                                'INFORME OPERATIVO NOVANDINO'
                              )}
                            </h1>
                            <p className="text-[#461D77] font-bold text-[10px] tracking-[0.4em] uppercase">{reportSubtitle}</p>
                          </div>
                        </div>
                        <div className="bg-[#181615] text-[#F7F6F2] px-5 py-3 rounded-md border border-[#2C2826] text-right shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                          <p className="text-[#A8A29E] font-mono font-bold text-[10px] tracking-[0.2em] uppercase mb-1">FECHA JORNADA</p>
                          <p className="text-2xl font-[900] text-white font-mono tabular-nums tracking-tight whitespace-nowrap">{formatDateToCL(selectedDate)}</p>
                        </div>
                      </div>
                    {filteredData.length > 0 && (
                      <div className="surface-well rounded-lg p-6 space-y-5">
                        <div className="flex items-end justify-between border-b border-[#D8D4CA] pb-3">
                          <div className="space-y-0.5">
                            <span className="font-mono font-semibold uppercase tracking-[0.12em] text-[10px] text-[#461D77] block">KPIs Operativos</span>
                            <h2 className="text-2xl font-extrabold text-[#181615] tracking-[-0.02em] uppercase">Cumplimiento Global</h2>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[#D8D4CA] rounded-md overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-[#D8D4CA] bg-white shadow-[0_1px_2px_rgba(24,22,21,0.05)]">
                          {operationalKPIs?.map((kpi, idx) => {
                            const isFeatured = idx === 0;
                            return (
                              <div key={idx} className={`p-4 flex flex-col justify-between min-h-[132px] ${
                                isFeatured ? 'bg-[#181615] text-[#F7F6F2]' : 'bg-white'
                              }`}>
                                <div className="flex items-start gap-2">
                                  <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                                    isFeatured ? 'bg-[#2C2826] text-[#A78BFA]' : 'bg-[#EFECE6] text-[#461D77]'
                                  }`}>
                                    {kpi.icon}
                                  </div>
                                  <span className={`text-[10px] font-semibold uppercase tracking-wider leading-tight block ${
                                    isFeatured ? 'text-[#A8A29E]' : 'text-[#57534E]'
                                  }`}>
                                    {kpi.label}
                                  </span>
                                </div>
                                <div className="mt-2.5">
                                  <span className={`font-mono tabular-nums text-2xl font-bold tracking-[-0.02em] leading-none block ${
                                    isFeatured ? 'text-white' : 'text-[#181615]'
                                  }`}>
                                    {kpi.value}
                                  </span>
                                </div>
                                <div className={`mt-2.5 pt-2 border-t flex items-center justify-between ${
                                  isFeatured ? 'border-[#2C2826]' : 'border-[#E5E2D9]'
                                }`}>
                                  <span className={`font-mono text-[9px] font-medium uppercase tracking-wider leading-none ${
                                    isFeatured ? 'text-[#A8A29E]' : 'text-[#57534E]'
                                  }`}>vs anterior</span>
                                  {kpi.comparison ? (
                                    <span className={`font-mono tabular-nums text-[10px] font-bold flex items-center gap-0.5 select-none leading-none ${
                                      !kpi.comparison.isChange
                                        ? (isFeatured ? 'text-[#A8A29E]' : 'text-[#57534E]')
                                        : kpi.comparison.isPositive
                                          ? (isFeatured ? 'text-[#4ADE80]' : 'text-[#15803D]')
                                          : (isFeatured ? 'text-[#F87171]' : 'text-[#B91C1C]')
                                    }`} title="Comparado con la jornada anterior">
                                      <span>{kpi.comparison.arrow}</span>
                                      <span>{kpi.comparison.text}</span>
                                    </span>
                                  ) : (
                                    <span className="font-mono text-[9px] text-[#78716C]">S/D</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <ChartCard type="composed" xAxis="Producto" yAxis={['Ton_Prog', 'Ton_Real', 'faenaMetaHours', 'faenaRealHours']} title="Análisis Comparativo" data={filteredData} />
                    </div>
                  </div>
                  <div className="px-8 pb-8 mt-auto"><ReportFooter /></div>
                </div>
                {productList.map((prod, idx) => (
                  <div key={`${selectedDate}-${prod}`} id={`product-section-${idx}`} className="page-break-before bg-white block w-full pt-4" style={{ minHeight: '330mm' }}>
                    <div className="px-4">
                      <ProductDetailSection product={prod} data={filteredData.filter(d => d.Producto === prod)} allData={separatedRawData} date={selectedDate} index={idx + 1} total={productList.length} />
                    </div>
                    <div className="px-4 pb-6 mt-8"><ReportFooter /></div>
                  </div>
                ))}
              </>
              ); })()}
          </div>
        </main>
      </div>
    );
  };

  // If no user is logged in, show WelcomeShowcase first and transition to LoginScreen on "Ingreso"
  if (!currentUser) {
    return (
      <AnimatePresence mode="wait">
        {authGateStep === 'welcome' ? (
          <motion.div
            key="welcome-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <WelcomeShowcase onEnterLogin={() => setAuthGateStep('login')} />
          </motion.div>
        ) : (
          <motion.div
            key="login-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <LoginScreen
              onLoginSuccess={setCurrentUser}
              onBackToWelcome={() => setAuthGateStep('welcome')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-calido">
      <GlobalTopBar
        currentView={view}
        currentUser={currentUser}
        activeLocation={activeLocation}
        onNavigate={navigateTo}
        onBack={handleBack}
        onLogout={handleLogout}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      <div
        className="flex-1 flex flex-col transition-all duration-150 origin-top"
        style={isFullscreen && controlRoomZoom !== 1 ? { zoom: controlRoomZoom } : undefined}
      >
        {renderCurrentView()}
      </div>

      <ControlRoomOverlay
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        currentView={view}
        onNavigate={navigateTo}
        zoomLevel={controlRoomZoom}
        onSetZoomLevel={setControlRoomZoom}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        currentUser={currentUser}
        onSelectView={navigateTo}
        onLogout={handleLogout}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      <OfflineIndicator />
      {passwordRequest && (
        <PasswordPrompt 
          correctPassword="MIRAME"
          moduleName={passwordRequest.name}
          onSuccess={() => { 
            setIsJefeTurnoUnlocked(true);
            navigateTo(passwordRequest.view); 
            setPasswordRequest(null); 
          }}
          onCancel={() => {
            setPasswordRequest(null);
            if (view === passwordRequest.view) {
              navigateTo('menu', true);
            }
          }}
        />
      )}

      {/* Interactive Outlook Composer Assistant Modal */}
      {isOutlookModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#1C1917]/50">
          <div className="bg-[#FFFFFF] w-full max-w-2xl rounded-lg shadow-xl border border-[#E2DFD7] overflow-hidden flex flex-col text-left">
            {/* Header */}
            <div className="bg-[#EFECE6]/60 px-6 py-4 border-b border-[#E2DFD7] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-[#461D77] text-white flex items-center justify-center">
                  <Mail size={17} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1C1917] tracking-tight leading-none uppercase">Compartir por Outlook</h3>
                  <p className="font-mono text-[11px] text-[#57534E] mt-1">Asistente de correo corporativo</p>
                </div>
              </div>
              <button
                onClick={() => setIsOutlookModalOpen(false)}
                className="p-1.5 text-[#57534E] hover:text-[#1C1917] transition-colors bg-[#FFFFFF] rounded-md border border-[#E2DFD7] cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#57534E]">Destinatarios (Para)</label>
                    <Lock size={10} className="text-[#57534E]" />
                  </div>
                  <input
                    type="text"
                    value={emailTo}
                    readOnly
                    className="w-full bg-[#F7F6F2] border border-[#E2DFD7] rounded-md px-3 py-2 text-xs font-medium text-[#57534E] cursor-not-allowed select-all outline-none"
                    placeholder="ejemplo@novandino.cl"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#57534E]">Copia (CC)</label>
                    <Lock size={10} className="text-[#57534E]" />
                  </div>
                  <input
                    type="text"
                    value={emailCC}
                    readOnly
                    className="w-full bg-[#F7F6F2] border border-[#E2DFD7] rounded-md px-3 py-2 text-xs font-medium text-[#57534E] cursor-not-allowed select-all outline-none"
                    placeholder="ejemplo@novandino.cl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#57534E]">Asunto del Correo</label>
                  <Lock size={10} className="text-[#57534E]" />
                </div>
                <input
                  type="text"
                  value={emailSubject}
                  readOnly
                  className="w-full bg-[#F7F6F2] border border-[#E2DFD7] rounded-md px-3 py-2 text-xs font-semibold text-[#1C1917] cursor-not-allowed select-all outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#57534E]">Vista Previa del Cuerpo</label>
                    <Lock size={10} className="text-[#57534E]" />
                  </div>
                  <span className="font-mono text-[10px] font-semibold bg-emerald-50 text-[#15803D] border border-emerald-200 px-2 py-0.5 rounded uppercase">KPIs Generados</span>
                </div>
                <textarea
                  rows={8}
                  value={emailBody}
                  readOnly
                  className="w-full bg-[#F7F6F2] border border-[#E2DFD7] rounded-md p-3.5 text-xs font-mono text-[#1C1917] cursor-not-allowed select-all outline-none leading-relaxed resize-none"
                />
              </div>

              <div className="bg-[#EFECE6]/50 border border-[#E2DFD7] p-4 rounded-md flex items-start gap-3">
                <div className="text-[#461D77] shrink-0 mt-0.5"><FileText size={15} /></div>
                <div className="text-[11px] text-[#57534E] space-y-0.5">
                  <p className="font-semibold uppercase tracking-wider text-[#1C1917]">Instrucciones de envío:</p>
                  <p>1. Descargue el informe en PDF y PNG en el panel lateral.</p>
                  <p>2. Haga clic en Abrir Outlook para iniciar la redacción con los destinatarios configurados.</p>
                  <p>3. Pegue la imagen PNG en el cuerpo (Ctrl + V) y adjunte el archivo PDF.</p>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-[#EFECE6]/60 px-6 py-4 border-t border-[#E2DFD7] flex flex-col sm:flex-row sm:justify-end gap-2.5 shrink-0">
              <button
                onClick={() => setIsOutlookModalOpen(false)}
                className="px-4 py-2 rounded-md border border-[#E2DFD7] bg-[#FFFFFF] text-[#57534E] hover:bg-[#F7F6F2] text-xs font-semibold uppercase tracking-wider transition-colors duration-150 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={() => {
                  const mailtoUrl = `mailto:${encodeURIComponent(emailTo)}?cc=${encodeURIComponent(emailCC)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
                  window.open(mailtoUrl, '_self');
                  setIsOutlookModalOpen(false);
                }}
                className="px-4 py-2 rounded-md bg-[#461D77] hover:bg-[#36155E] text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer"
              >
                <Send size={13} /> Abrir Outlook Escritorio
              </button>

              <button
                onClick={() => {
                  const owaUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(emailTo)}&cc=${encodeURIComponent(emailCC)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
                  window.open(owaUrl, '_blank');
                  setIsOutlookModalOpen(false);
                }}
                className="px-4 py-2 rounded-md bg-[#1C1917] hover:bg-stone-800 text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer"
              >
                <Mail size={13} /> Abrir Outlook Web (365)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

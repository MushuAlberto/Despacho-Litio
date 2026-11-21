
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Upload, Trash2, ChevronLeft, ChevronRight, 
  Image as ImageIcon, X, Home, Plus,
  Maximize2, Minimize2, Play, Pause, Timer,
  Clock, TrendingUp, Target, Users, Scale, ClipboardCheck, Truck, Loader2, RefreshCw,
  CloudDownload, Database, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { collection, onSnapshot, query, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { 
  db, handleFirestoreError, OperationType, logActivity, 
  OperationalReportDoc, getOperationalReportsFromFirebase, safeParseBackupJSON,
  isQuotaExceededError, isFirestoreWriteBlocked 
} from '../services/firebase';
import ChartCard from './ChartCard';
import { ProductDetailSection } from './ProductDetailSection';
import { NovandinoLogo } from './BrandLogo';
import { formatDateToCL, formatNumberWithDecimals, formatHoursToTime, separateBischofitaByDest, isProductNovandino, isProductSQM } from '../utils/dataProcessor';

declare const html2canvas: any;

interface GalleryImage {
  id: string;
  url: string;
  name: string;
  date: string;
  createdAt?: string;
}

interface ImageGalleryProps {
  onBack: () => void;
  rawData?: any[];
  selectedDate?: string;
  onDataLoaded?: (data: any[], date?: string) => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  onBack, 
  rawData = [], 
  selectedDate = '',
  onDataLoaded
}) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [intervalTime, setIntervalTime] = useState(5); // en segundos
  const [isGeneratingAuto, setIsGeneratingAuto] = useState(false);
  const [sortBy, setSortBy] = useState<'report-order' | 'recent' | 'oldest' | 'name-asc' | 'name-desc' | 'type-first'>('report-order');

  // Firebase Operational Reports State
  const [operationalData, setOperationalData] = useState<any[]>(rawData);
  const [cloudReports, setCloudReports] = useState<OperationalReportDoc[]>([]);
  const [isLoadingFirebase, setIsLoadingFirebase] = useState(false);
  const [firebaseNotice, setFirebaseNotice] = useState<string | null>(null);
  const [quotaNotice, setQuotaNotice] = useState(false);
  const [lastSyncedDate, setLastSyncedDate] = useState<string>('');
  const hasAttemptedCaptureForDate = useRef<Record<string, boolean>>({});

  // Sync internal operationalData if parent rawData changes and has content
  useEffect(() => {
    if (rawData && rawData.length > 0) {
      setOperationalData(rawData);
    }
  }, [rawData]);

  // Helper to parse and apply an operational report from Firebase
  const loadReportData = useCallback((report: OperationalReportDoc, showNotice = true) => {
    try {
      const backup = safeParseBackupJSON(report.backupData);
      let parsedRows: any[] = [];
      if (backup['sqm_raw_data']) {
        parsedRows = typeof backup['sqm_raw_data'] === 'string'
          ? JSON.parse(backup['sqm_raw_data'])
          : backup['sqm_raw_data'];
      }
      if (Array.isArray(parsedRows) && parsedRows.length > 0) {
        // Sync all keys to localStorage so that ProductDetailSection and charts have historical justifications
        Object.entries(backup).forEach(([k, v]) => {
          if (k.startsWith('sqm_') && typeof v === 'string') {
            localStorage.setItem(k, v);
          }
        });
        localStorage.setItem('sqm_raw_data', JSON.stringify(parsedRows));
        setOperationalData(parsedRows);
        setLastSyncedDate(report.date);
        setActiveDate(report.date);
        if (onDataLoaded) {
          onDataLoaded(parsedRows, report.date);
        }
        if (showNotice) {
          setFirebaseNotice(`Datos del ${formatDateToCL(report.date)} cargados exitosamente desde Firebase Cloud.`);
          setTimeout(() => setFirebaseNotice(null), 5000);
        }
        return true;
      }
    } catch (err) {
      console.error('Error al restaurar datos operativos desde Firebase:', err);
    }
    return false;
  }, [onDataLoaded]);

  // Live Subscription to operational_reports in Firestore
  useEffect(() => {
    const qReports = query(collection(db, 'operational_reports'));
    const unsubscribeReports = onSnapshot(qReports, (snapshot) => {
      const fetchedReports: OperationalReportDoc[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.backupData && data.date) {
          fetchedReports.push({
            id: docSnap.id,
            date: data.date,
            backupData: data.backupData,
            updatedAt: data.updatedAt || new Date().toISOString(),
            updatedBy: data.updatedBy || 'Sistema SQM',
            summary: data.summary || ''
          });
        }
      });
      // Sort descending by date
      fetchedReports.sort((a, b) => b.date.localeCompare(a.date));
      setCloudReports(fetchedReports);

      // Auto-load latest report from Firebase if operationalData is currently empty
      if (fetchedReports.length > 0) {
        setOperationalData((prev) => {
          if (!prev || prev.length === 0) {
            const latest = fetchedReports[0];
            try {
              const backup = safeParseBackupJSON(latest.backupData);
              if (backup['sqm_raw_data']) {
                const parsed = typeof backup['sqm_raw_data'] === 'string'
                  ? JSON.parse(backup['sqm_raw_data'])
                  : backup['sqm_raw_data'];
                if (Array.isArray(parsed) && parsed.length > 0) {
                  // Restore sqm_ keys
                  Object.entries(backup).forEach(([k, v]) => {
                    if (k.startsWith('sqm_') && typeof v === 'string') {
                      localStorage.setItem(k, v);
                    }
                  });
                  localStorage.setItem('sqm_raw_data', JSON.stringify(parsed));
                  setLastSyncedDate(latest.date);
                  setFirebaseNotice(`Datos de jornada ${formatDateToCL(latest.date)} cargados automáticamente desde Firebase.`);
                  setTimeout(() => setFirebaseNotice(null), 5000);
                  if (onDataLoaded) onDataLoaded(parsed, latest.date);
                  return parsed;
                }
              }
            } catch (err) {
              console.error('Error auto-loading latest report from Firebase:', err);
            }
          }
          return prev;
        });
      }
    }, (error) => {
      if (isQuotaExceededError(error)) {
        console.warn('Firestore daily quota reached on operational_reports listener; operating in local mode.');
        setQuotaNotice(true);
        return;
      }
      handleFirestoreError(error, OperationType.GET, 'operational_reports');
    });

    return () => unsubscribeReports();
  }, [onDataLoaded]);

  // Live Persistence via Firestore for Gallery Images
  useEffect(() => {
    const q = query(collection(db, 'gallery_images'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedImages: GalleryImage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedImages.push({
          id: docSnap.id,
          url: data.url,
          name: data.name,
          date: data.date,
          createdAt: data.createdAt
        });
      });
      // Sort images by createdAt descending, fallback to id
      fetchedImages.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });
      setImages(fetchedImages);
      setHasLoaded(true);
    }, (error) => {
      if (isQuotaExceededError(error)) {
        console.warn('Firestore daily quota reached on gallery_images listener; operating in local mode.');
        setQuotaNotice(true);
        setHasLoaded(true);
        return;
      }
      handleFirestoreError(error, OperationType.GET, 'gallery_images');
    });

    return () => unsubscribe();
  }, []);

  // Determine all available operational report dates across operationalData, cloudReports, Firestore images, and prop
  const availableDates = useMemo(() => {
    const datesSet = new Set<string>();
    
    // 1. From operationalData
    if (operationalData && operationalData.length > 0) {
      operationalData.forEach(r => {
        if (r.Fecha && typeof r.Fecha === 'string') {
          datesSet.add(r.Fecha);
        }
      });
    }

    // 2. From Firebase operational reports
    if (cloudReports && cloudReports.length > 0) {
      cloudReports.forEach(cr => {
        if (cr.date) {
          datesSet.add(cr.date);
        }
      });
    }

    // 3. From Firestore gallery images (extract dates from image IDs or names)
    if (images && images.length > 0) {
      images.forEach(img => {
        const match = img.id.match(/\d{4}-\d{2}-\d{2}/);
        if (match) {
          datesSet.add(match[0]);
        }
      });
    }

    // 4. From prop
    if (selectedDate) {
      datesSet.add(selectedDate);
    }

    return Array.from(datesSet).sort().reverse();
  }, [operationalData, cloudReports, images, selectedDate]);

  const [activeDate, setActiveDate] = useState<string>('');

  const effectiveDate = useMemo(() => {
    if (activeDate && availableDates.includes(activeDate)) {
      return activeDate;
    }
    if (availableDates.length > 0) {
      return availableDates[0];
    }
    return selectedDate || '';
  }, [activeDate, availableDates, selectedDate]);

  // When effectiveDate changes, if operationalData does not have rows for it, check if Firebase has it
  useEffect(() => {
    if (!effectiveDate || cloudReports.length === 0) return;
    const hasDataForEffectiveDate = operationalData.some(r => r.Fecha === effectiveDate);
    if (!hasDataForEffectiveDate) {
      const matchingReport = cloudReports.find(r => r.date === effectiveDate);
      if (matchingReport) {
        loadReportData(matchingReport, false);
      }
    }
  }, [effectiveDate, cloudReports, operationalData, loadReportData]);

  // Manual trigger to load latest or current date data from Firebase
  const handleManualLoadFromFirebase = async () => {
    setIsLoadingFirebase(true);
    try {
      const reports = await getOperationalReportsFromFirebase();
      setCloudReports(reports);
      if (reports.length === 0) {
        setFirebaseNotice('No se encontraron informes guardados en Firebase.');
        setTimeout(() => setFirebaseNotice(null), 4000);
        return;
      }

      // Priority: report for effectiveDate if available, else newest report
      const matchingReport = reports.find(r => r.date === effectiveDate) || reports[0];
      const success = loadReportData(matchingReport, true);
      if (success) {
        const savedUser = localStorage.getItem('sqm_current_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          await logActivity(
            parsedUser,
            'Cargó Datos de Firebase',
            `Cargó los datos operativos de la jornada ${formatDateToCL(matchingReport.date)} desde Firebase en la Galería Operativa.`
          );
        }
      }
    } catch (err) {
      console.error('Error manual fetching from Firebase:', err);
      setFirebaseNotice('Error al conectar con Firebase.');
      setTimeout(() => setFirebaseNotice(null), 4000);
    } finally {
      setIsLoadingFirebase(false);
    }
  };

  const separatedRawData = useMemo(() => {
    return separateBischofitaByDest(operationalData);
  }, [operationalData]);

  // Data calculations for report generation
  const novandinoData = useMemo(() => {
    if (!operationalData || !effectiveDate) return [];
    const base = separatedRawData.filter(r => r.Fecha === effectiveDate);
    return base.filter(r => isProductNovandino(r));
  }, [operationalData, separatedRawData, effectiveDate]);

  const sqmData = useMemo(() => {
    if (!operationalData || !effectiveDate) return [];
    const base = separatedRawData.filter(r => r.Fecha === effectiveDate);
    return base.filter(r => isProductSQM(r));
  }, [operationalData, separatedRawData, effectiveDate]);

  const getKPIsForData = useCallback((data: any[]) => {
    if (data.length === 0) return null;
    const totalTonReal = data.reduce((a, b) => a + b.Ton_Real, 0);
    const totalTonProg = data.reduce((a, b) => a + b.Ton_Prog, 0);
    const totalEqReal = data.reduce((a, b) => a + b.Eq_Real, 0);
    const avgReg = data.length > 0 ? data.reduce((acc, d) => acc + (Number(d.Regulacion_Real) || 0), 0) / data.length : 0;
    const validSdaTimes = data.map(d => d.sdaHours).filter(v => v > 0);
    const avgSda = validSdaTimes.length > 0 ? validSdaTimes.reduce((a, b) => a + b, 0) / validSdaTimes.length : 0;
    const validPangTimes = data.map(d => d.pangHours).filter(v => v > 0);
    const avgPang = validPangTimes.length > 0 ? validPangTimes.reduce((a, b) => a + b, 0) / validPangTimes.length : 0;
    const totalHoursInFaena = data.reduce((a, b) => a + b.faenaRealHours, 0);
    const productivity = totalHoursInFaena > 0 ? totalTonReal / totalHoursInFaena : 0;
    const compliance = totalTonProg > 0 ? (totalTonReal / totalTonProg) * 100 : 0;
    const avgLoad = totalEqReal > 0 ? totalTonReal / totalEqReal : 0;
    return [
      { label: "Tiempo Gral. Faena (SdA) (2:00)", value: formatHoursToTime(avgSda), icon: <Clock className="w-3.5 h-3.5" /> },
      { label: "Tiempo Gral. Faena (NY) (2:00)", value: formatHoursToTime(avgPang), icon: <Clock className="w-3.5 h-3.5" /> },
      { label: "Productividad Diaria", value: `${productivity.toFixed(1)} T/H`, icon: <TrendingUp className="w-3.5 h-3.5" /> },
      { label: "Carga Real Despachada", value: `${formatNumberWithDecimals(totalTonReal, 2)} Ton`, icon: <Truck className="w-3.5 h-3.5" /> },
      { label: "Cumplimiento Programa", value: `${compliance.toFixed(1)}%`, icon: <Target className="w-3.5 h-3.5" />, status: compliance < 90 ? 'danger' : 'normal' },
      { label: "Intensidad de Flota", value: `${totalEqReal} EQ`, icon: <Users className="w-3.5 h-3.5" /> },
      { label: "Factor de Carga (Eficiencia)", value: `${avgLoad.toFixed(1)} T/EQ`, icon: <Scale className="w-3.5 h-3.5" /> },
      { label: "PROMEDIO DE % DE REGULACIÓN", value: `${Math.round(avgReg)}%`, icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
    ];
  }, []);

  const novandinoKPIs = useMemo(() => getKPIsForData(novandinoData), [novandinoData, getKPIsForData]);
  const sqmKPIs = useMemo(() => getKPIsForData(sqmData), [sqmData, getKPIsForData]);

  const getProductListForData = useCallback((data: any[]) => {
    const products = [...new Set(data.map(r => r.Producto as string))] as string[];
    return products.sort((a: string, b: string) => {
      const priority: Record<string, number> = { 'SLIT': 1, 'LSI (S)': 2 };
      const aPrio = priority[a] || 99;
      const bPrio = priority[b] || 99;
      if (aPrio !== bPrio) return aPrio - bPrio;
      return a.localeCompare(b);
    });
  }, []);

  const novandinoProductList = useMemo(() => getProductListForData(novandinoData), [novandinoData, getProductListForData]);
  const sqmProductList = useMemo(() => getProductListForData(sqmData), [sqmData, getProductListForData]);

  const sortedImages = useMemo(() => {
    // Only keep manual uploads and automatic images of the CURRENT effective date
    const list = images.filter(img => {
      if (img.id.startsWith('auto_')) {
        return img.id.includes(effectiveDate);
      }
      return true;
    });

    let sortedList: GalleryImage[] = [];
    if (sortBy === 'report-order') {
      sortedList = list.sort((a, b) => {
        const getPriority = (img: GalleryImage) => {
          // --- NOVANDINO PRIORITIES ---
          if (img.id === `auto_kpi_novandino_${effectiveDate}`) return 1;
          if (img.id === `auto_chart_novandino_${effectiveDate}`) return 2;
          if (img.id.startsWith('auto_prod_novandino_')) {
            const match = img.id.match(new RegExp(`^auto_prod_novandino_(.+?)_${effectiveDate}$`));
            if (match) {
              const prodNameUnderscored = match[1];
              const idx = novandinoProductList.findIndex(p => p.replace(/[\s/]+/g, '_') === prodNameUnderscored);
              if (idx !== -1) {
                return 3 + idx;
              }
            }
            return 3 + novandinoProductList.length;
          }

          // --- SQM NY PRIORITIES ---
          const sqmOffset = 100;
          if (img.id === `auto_kpi_sqm_${effectiveDate}`) return sqmOffset + 1;
          if (img.id === `auto_chart_sqm_${effectiveDate}`) return sqmOffset + 2;
          if (img.id.startsWith('auto_prod_sqm_')) {
            const match = img.id.match(new RegExp(`^auto_prod_sqm_(.+?)_${effectiveDate}$`));
            if (match) {
              const prodNameUnderscored = match[1];
              const idx = sqmProductList.findIndex(p => p.replace(/[\s/]+/g, '_') === prodNameUnderscored);
              if (idx !== -1) {
                return sqmOffset + 3 + idx;
              }
            }
            return sqmOffset + 3 + sqmProductList.length;
          }

          // Legacy auto IDs fallback
          if (img.id === `auto_kpi_${effectiveDate}`) return 500;
          if (img.id === `auto_chart_${effectiveDate}`) return 501;
          if (img.id.startsWith('auto_prod_')) return 502;

          return 1000; // Manual images
        };

        const prioA = getPriority(a);
        const prioB = getPriority(b);

        if (prioA !== prioB) {
          return prioA - prioB;
        }

        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });
    } else if (sortBy === 'recent') {
      sortedList = list;
    } else if (sortBy === 'oldest') {
      sortedList = list.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });
    } else if (sortBy === 'name-asc') {
      sortedList = list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name-desc') {
      sortedList = list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'type-first') {
      sortedList = list.sort((a, b) => {
        const isAAuto = a.id.startsWith('auto_');
        const isBAuto = b.id.startsWith('auto_');
        if (isAAuto && !isBAuto) return -1;
        if (!isAAuto && isBAuto) return 1;
        
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });
    } else {
      sortedList = list;
    }

    const staticNovandino: GalleryImage = {
      id: 'static_novandino',
      url: '/sda/home.png',
      name: 'Home',
      date: 'General'
    };

    // Deduplicate the baseList first (user uploaded / auto-generated images)
    const baseList = [staticNovandino, ...sortedList];
    const seenUrls = new Set<string>();
    const uniqueBaseList: GalleryImage[] = [];

    for (const item of baseList) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        uniqueBaseList.push(item);
      }
    }

    const sdaImagesList = [
      { name: 'Salar de Atacama 1', filename: '1.png' },
      { name: 'Salar de Atacama 2', filename: '2.png' },
      { name: 'Salar de Atacama 3', filename: '3.png' },
      { name: 'Salar de Atacama 4', filename: '4.png' },
      { name: 'Salar de Atacama 5', filename: '5.png' },
      { name: 'Salar de Atacama 6', filename: '6.png' },
      { name: 'Salar de Atacama 7', filename: '7.png' },
      { name: 'Salar de Atacama 8', filename: '8.png' }
    ];

    const weavedList: GalleryImage[] = [];
    for (let i = 0; i < uniqueBaseList.length; i++) {
      weavedList.push(uniqueBaseList[i]);
      if (i < uniqueBaseList.length - 1) {
        const sdaIndex = i % sdaImagesList.length;
        const sdaImgObj = sdaImagesList[sdaIndex];
        
        weavedList.push({
          id: `sda_weaved_${i}_${sdaImgObj.filename}`,
          url: `/sda/${sdaImgObj.filename}`,
          name: sdaImgObj.name,
          date: 'General'
        });
      }
    }

    return weavedList;
  }, [images, sortBy, novandinoProductList, sqmProductList, effectiveDate]);

  // Automatic report image generation effect
  useEffect(() => {
    if (!hasLoaded || !operationalData || operationalData.length === 0 || !effectiveDate) return;
    if (hasAttemptedCaptureForDate.current[effectiveDate]) return;

    const runAutomaticCapture = async () => {
      // Novandino IDs
      const novKpiId = `auto_kpi_novandino_${effectiveDate}`;
      const novChartId = `auto_chart_novandino_${effectiveDate}`;
      const novProdIds = novandinoProductList.map(p => `auto_prod_novandino_${p.replace(/[\s/]+/g, '_')}_${effectiveDate}`);

      // SQM NY IDs
      const sqmKpiId = `auto_kpi_sqm_${effectiveDate}`;
      const sqmChartId = `auto_chart_sqm_${effectiveDate}`;
      const sqmProdIds = sqmProductList.map(p => `auto_prod_sqm_${p.replace(/[\s/]+/g, '_')}_${effectiveDate}`);

      const hasNovKpis = images.some(img => img.id === novKpiId);
      const hasNovChart = images.some(img => img.id === novChartId);
      const hasNovProducts = novProdIds.every(id => images.some(img => img.id === id));

      const hasSqmKpis = images.some(img => img.id === sqmKpiId);
      const hasSqmChart = images.some(img => img.id === sqmChartId);
      const hasSqmProducts = sqmProdIds.every(id => images.some(img => img.id === id));

      // Check if all needed captures exist
      const allExist = (novandinoData.length === 0 || (hasNovKpis && hasNovChart && hasNovProducts)) &&
                       (sqmData.length === 0 || (hasSqmKpis && hasSqmChart && hasSqmProducts));

      if (allExist) {
        hasAttemptedCaptureForDate.current[effectiveDate] = true;
        return; // Already exists, don't regenerate
      }

      hasAttemptedCaptureForDate.current[effectiveDate] = true;
      setIsGeneratingAuto(true);
      // Brief pause to allow hidden DOM elements to render styles
      await new Promise(resolve => setTimeout(resolve, 350));

      const generatedList: GalleryImage[] = [];
      const captureOpts = { 
        scale: 1.25, 
        useCORS: true, 
        logging: false, 
        backgroundColor: '#ffffff',
        imageTimeout: 5000 
      };

      try {
        // Temporarily add 'is-exporting' so that 'pdf-only-block' is rendered and inputs are hidden
        document.body.classList.add('is-exporting');
        await new Promise(resolve => setTimeout(resolve, 50));

        // --- 1. CAPTURE NOVANDINO REPORT ---
        if (novandinoData.length > 0) {
          // KPIs
          if (!hasNovKpis) {
            const kpiEl = document.getElementById('capture-kpis-novandino');
            if (kpiEl) {
              const canvas = await html2canvas(kpiEl, captureOpts);
              generatedList.push({
                id: novKpiId,
                url: canvas.toDataURL('image/jpeg', 0.82),
                name: `NOVANDINO - INFORME OPERATIVO - CUMPLIMIENTO GLOBAL (${formatDateToCL(effectiveDate)})`,
                date: formatDateToCL(effectiveDate),
                createdAt: new Date().toISOString()
              });
            }
          }

          // Composed Chart
          if (!hasNovChart) {
            const chartEl = document.getElementById('capture-chart-novandino');
            if (chartEl) {
              const canvas = await html2canvas(chartEl, captureOpts);
              generatedList.push({
                id: novChartId,
                url: canvas.toDataURL('image/jpeg', 0.82),
                name: `NOVANDINO - ANÁLISIS COMPARATIVO (${formatDateToCL(effectiveDate)})`,
                date: formatDateToCL(effectiveDate),
                createdAt: new Date().toISOString()
              });
            }
          }

          // Product details
          for (let i = 0; i < novandinoProductList.length; i++) {
            const prod = novandinoProductList[i];
            const prodId = novProdIds[i];
            const hasProd = images.some(img => img.id === prodId);
            if (!hasProd) {
              const prodEl = document.getElementById(`capture-product-novandino-${i}`);
              if (prodEl) {
                const canvas = await html2canvas(prodEl, captureOpts);
                generatedList.push({
                  id: prodId,
                  url: canvas.toDataURL('image/jpeg', 0.82),
                  name: `NOVANDINO - AUDITORÍA DE DESEMPEÑO - ${prod} (${formatDateToCL(effectiveDate)})`,
                  date: formatDateToCL(effectiveDate),
                  createdAt: new Date().toISOString()
                });
              }
            }
          }
        }

        // --- 2. CAPTURE SQM NY REPORT ---
        if (sqmData.length > 0) {
          // KPIs
          if (!hasSqmKpis) {
            const kpiEl = document.getElementById('capture-kpis-sqm');
            if (kpiEl) {
              const canvas = await html2canvas(kpiEl, captureOpts);
              generatedList.push({
                id: sqmKpiId,
                url: canvas.toDataURL('image/jpeg', 0.82),
                name: `SQM NY - INFORME OPERATIVO - CUMPLIMIENTO GLOBAL (${formatDateToCL(effectiveDate)})`,
                date: formatDateToCL(effectiveDate),
                createdAt: new Date().toISOString()
              });
            }
          }

          // Composed Chart
          if (!hasSqmChart) {
            const chartEl = document.getElementById('capture-chart-sqm');
            if (chartEl) {
              const canvas = await html2canvas(chartEl, captureOpts);
              generatedList.push({
                id: sqmChartId,
                url: canvas.toDataURL('image/jpeg', 0.82),
                name: `SQM NY - ANÁLISIS COMPARATIVO (${formatDateToCL(effectiveDate)})`,
                date: formatDateToCL(effectiveDate),
                createdAt: new Date().toISOString()
              });
            }
          }

          // Product details
          for (let i = 0; i < sqmProductList.length; i++) {
            const prod = sqmProductList[i];
            const prodId = sqmProdIds[i];
            const hasProd = images.some(img => img.id === prodId);
            if (!hasProd) {
              const prodEl = document.getElementById(`capture-product-sqm-${i}`);
              if (prodEl) {
                const canvas = await html2canvas(prodEl, captureOpts);
                generatedList.push({
                  id: prodId,
                  url: canvas.toDataURL('image/jpeg', 0.82),
                  name: `SQM NY - AUDITORÍA DE DESEMPEÑO - ${prod} (${formatDateToCL(effectiveDate)})`,
                  date: formatDateToCL(effectiveDate),
                  createdAt: new Date().toISOString()
                });
              }
            }
          }
        }

        if (generatedList.length > 0) {
          // Instantly show in local gallery state without waiting for Firestore roundtrip
          setImages(prev => {
            const map = new Map<string, GalleryImage>();
            generatedList.forEach(img => map.set(img.id, img));
            prev.forEach(img => {
              if (!map.has(img.id)) map.set(img.id, img);
            });
            return Array.from(map.values()).sort((a, b) => {
              const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              if (timeA !== timeB) return timeB - timeA;
              return b.id.localeCompare(a.id);
            });
          });

          // If Firestore write quota is blocked, keep generated images in local state and avoid sending network requests
          if (isFirestoreWriteBlocked()) {
            setQuotaNotice(true);
            return;
          }

          // Upload all generated images to Firestore in parallel for maximum speed
          const path = 'gallery_images';
          await Promise.all(
            generatedList.map(async (newImg) => {
              try {
                const cleanId = newImg.id.replace(/\//g, '_');
                const docRef = doc(db, path, cleanId);
                await setDoc(docRef, {
                  url: newImg.url,
                  name: newImg.name,
                  date: newImg.date,
                  createdAt: newImg.createdAt || new Date().toISOString()
                });
              } catch (innerErr) {
                if (isQuotaExceededError(innerErr)) {
                  console.warn("Firestore write quota reached; slide stored locally in memory:", newImg.id);
                  setQuotaNotice(true);
                } else {
                  console.error("Error saving automatic report image to Firestore:", innerErr);
                }
              }
            })
          );
        }
      } catch (err) {
        console.error("Error generating automatic report images:", err);
      } finally {
        document.body.classList.remove('is-exporting');
        setIsGeneratingAuto(false);
      }
    };

    runAutomaticCapture();
  }, [operationalData, effectiveDate, novandinoProductList, sqmProductList, novandinoData.length, sqmData.length, hasLoaded]);

  const handleRegenerateAutoImages = async () => {
    if (isGeneratingAuto || !effectiveDate) return;
    
    // Allow re-attempt for current date
    hasAttemptedCaptureForDate.current[effectiveDate] = false;
    setIsGeneratingAuto(true);
    
    try {
      const novKpiId = `auto_kpi_novandino_${effectiveDate}`;
      const novChartId = `auto_chart_novandino_${effectiveDate}`;
      const novProdIds = novandinoProductList.map(p => `auto_prod_novandino_${p.replace(/[\s/]+/g, '_')}_${effectiveDate}`);

      const sqmKpiId = `auto_kpi_sqm_${effectiveDate}`;
      const sqmChartId = `auto_chart_sqm_${effectiveDate}`;
      const sqmProdIds = sqmProductList.map(p => `auto_prod_sqm_${p.replace(/[\s/]+/g, '_')}_${effectiveDate}`);
      
      const idsToDelete = [
        novKpiId, novChartId, ...novProdIds,
        sqmKpiId, sqmChartId, ...sqmProdIds,
        `auto_kpi_${effectiveDate}`, `auto_chart_${effectiveDate}` // Legacy IDs too
      ];
      
      const existingToDelete = idsToDelete.filter(id => images.some(img => img.id === id));

      // Instantly remove from local state
      setImages(prev => prev.filter(img => !existingToDelete.includes(img.id)));

      if (!isFirestoreWriteBlocked()) {
        const path = 'gallery_images';
        // Delete in parallel from Firestore
        await Promise.all(
          existingToDelete.map(id => deleteDoc(doc(db, path, id)).catch(err => {
            if (isQuotaExceededError(err)) {
              setQuotaNotice(true);
            } else {
              console.error(`Error deleting image ${id}:`, err);
            }
          }))
        );
      }
      
      const savedUser = localStorage.getItem('sqm_current_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        await logActivity(
          parsedUser,
          'Regeneró Reportes',
          `Solicitó regenerar las capturas automáticas para la jornada ${formatDateToCL(effectiveDate)}.`
        );
      }
    } catch (err) {
      console.error("Error deleting auto images for regeneration:", err);
      setIsGeneratingAuto(false);
    }
  };

  // Autoplay Effect
  useEffect(() => {
    let interval: any;
    if (autoPlay && sortedImages.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % sortedImages.length);
      }, intervalTime * 1000);
    }
    return () => clearInterval(interval);
  }, [autoPlay, sortedImages.length, intervalTime]);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageId = Math.random().toString(36).substr(2, 9);
        const name = file.name;
        const date = new Date().toLocaleDateString();
        const url = e.target?.result as string;

        const newUploadedImg: GalleryImage = {
          id: imageId,
          url,
          name,
          date,
          createdAt: new Date().toISOString()
        };

        // Always show locally immediately
        setImages(prev => [newUploadedImg, ...prev]);

        if (isFirestoreWriteBlocked()) {
          setQuotaNotice(true);
          return;
        }

        try {
          // Upload to Firestore
          const path = 'gallery_images';
          const docRef = doc(db, path, imageId);
          await setDoc(docRef, {
            url,
            name,
            date,
            createdAt: newUploadedImg.createdAt
          });

          // Record Image upload activity log in Firestore
          const savedUser = localStorage.getItem('sqm_current_user');
          if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            await logActivity(
              parsedUser,
              'Subió Evidencia',
              `Cargó una nueva imagen de terreno (${name}) a la Galería Operativa.`
            );
          }
        } catch (err) {
          if (isQuotaExceededError(err)) {
            console.warn('Firestore write quota exceeded; upload stored in memory.');
            setQuotaNotice(true);
            return;
          }
          console.error('Error saving image upload:', err);
          handleFirestoreError(err, OperationType.WRITE, `gallery_images/${imageId}`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const deleteImage = async (id: string) => {
    if (id === 'static_novandino' || id.startsWith('sda_random_')) return;
    const imgToDelete = sortedImages.find(img => img.id === id);

    // Remove from local state immediately
    setImages(prev => prev.filter(img => img.id !== id));
    if (currentIndex >= sortedImages.length - 1) {
      setCurrentIndex(Math.max(0, sortedImages.length - 2));
    }

    if (isFirestoreWriteBlocked()) {
      return;
    }

    try {
      // Delete from Firestore
      const path = 'gallery_images';
      await deleteDoc(doc(db, path, id));

      // Record Image deletion activity log in Firestore
      const savedUser = localStorage.getItem('sqm_current_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        await logActivity(
          parsedUser,
          'Eliminó Evidencia',
          `Eliminó la imagen (${imgToDelete?.name || 'sin_nombre'}) de la Galería Operativa.`
        );
      }
    } catch (err) {
      if (isQuotaExceededError(err)) {
        setQuotaNotice(true);
        return;
      }
      console.error('Error deleting image:', err);
      handleFirestoreError(err, OperationType.DELETE, `gallery_images/${id}`);
    }
  };

  const nextSlide = useCallback(() => {
    if (sortedImages.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % sortedImages.length);
  }, [sortedImages.length]);

  const prevSlide = useCallback(() => {
    if (sortedImages.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + sortedImages.length) % sortedImages.length);
  }, [sortedImages.length]);

  const openFullScreen = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (sortedImages.length > 0) {
      setIsFullScreen(true);
      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if ((docEl as any).mozRequestFullScreen) {
          await (docEl as any).mozRequestFullScreen();
        } else if ((docEl as any).webkitRequestFullscreen) {
          await (docEl as any).webkitRequestFullscreen();
        } else if ((docEl as any).msRequestFullscreen) {
          await (docEl as any).msRequestFullscreen();
        }
      } catch (err) {
        console.error("Error requesting native fullscreen:", err);
      }
    }
  };

  const closeFullScreen = async () => {
    setIsFullScreen(false);
    setAutoPlay(false);
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.error("Error exiting native fullscreen:", err);
    }
  };

  const handleToggleAutoPlay = async () => {
    const nextAutoPlay = !autoPlay;
    setAutoPlay(nextAutoPlay);
    if (nextAutoPlay) {
      await openFullScreen();
    } else {
      await closeFullScreen();
    }
  };

  // Sync React state with browser's native fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullScreen(isCurrentlyFullscreen);
      if (!isCurrentlyFullscreen) {
        setAutoPlay(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullScreen) {
          closeFullScreen();
        } else {
          onBack();
        }
      }
      
      if (sortedImages.length === 0) return;
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedImages.length, nextSlide, prevSlide, isFullScreen, onBack]);

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex flex-col font-sans text-[#1C1917] relative">
      {/* Header */}
      <header className="bg-[#FFFFFF] border-b border-[#E2DFD7] px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#FFFFFF] hover:bg-[#F7F6F2] border border-[#E2DFD7] rounded-md text-xs font-semibold text-[#1C1917] transition-colors duration-150 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#461D77]"
          >
            <Home size={14} className="text-[#57534E]" />
            <span>Menú</span>
          </button>
          <div className="h-6 w-px bg-[#E2DFD7]" />
          <div>
            <h1 className="text-lg font-bold text-[#1C1917] tracking-[-0.02em] leading-tight">
              Galería Operativa
            </h1>
            <p className="text-xs text-[#78716C]">
              Registro visual de faena y capturas automáticas
            </p>
          </div>

          {/* Firebase Cloud Sync Controls & Status */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleManualLoadFromFirebase}
              disabled={isLoadingFirebase}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150 border ${
                isLoadingFirebase
                  ? 'bg-[#F3EEF8] border-[#461D77]/20 text-[#461D77] cursor-wait'
                  : 'bg-[#FFFFFF] hover:bg-[#F7F6F2] border-[#E2DFD7] text-[#1C1917] cursor-pointer'
              }`}
              title="Carga los datos operativos e informes más recientes guardados en Firebase Firestore."
            >
              {isLoadingFirebase ? (
                <Loader2 size={13} className="animate-spin text-[#461D77]" />
              ) : (
                <CloudDownload size={13} className="text-[#461D77]" />
              )}
              <span>{isLoadingFirebase ? 'Cargando de Firebase...' : 'Cargar de Firebase'}</span>
            </button>

            {lastSyncedDate && (
              <div
                className="hidden xl:flex items-center gap-1.5 text-xs font-mono tabular-nums text-[#57534E] px-2"
                title={`Datos cargados desde Firebase para la jornada ${formatDateToCL(lastSyncedDate)}.`}
              >
                <Database size={12} className="text-[#15803D] shrink-0" />
                <span>Nube: {formatDateToCL(lastSyncedDate)}</span>
              </div>
            )}

            {isGeneratingAuto ? (
              <div className="flex items-center gap-1.5 bg-[#F3EEF8] px-3 py-1.5 rounded-md border border-[#461D77]/20 text-xs font-semibold text-[#461D77]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Sincronizando reportes...</span>
              </div>
            ) : (
              operationalData.length > 0 && effectiveDate && (
                <button
                  onClick={handleRegenerateAutoImages}
                  className="flex items-center gap-1.5 bg-[#FFFFFF] hover:bg-[#F7F6F2] border border-[#E2DFD7] text-[#1C1917] font-semibold text-xs px-3 py-1.5 rounded-md transition-colors duration-150 cursor-pointer"
                  title="Regenera todas las capturas automáticas para incluir las últimas modificaciones."
                >
                  <RefreshCw size={13} className="text-[#461D77]" />
                  <span>Actualizar Reportes</span>
                </button>
              )
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Selector */}
          {availableDates.length > 0 && (
            <div className="bg-[#F7F6F2] rounded-md px-2.5 py-1.5 flex items-center gap-2 border border-[#E2DFD7]">
              <span className="text-xs text-[#78716C] font-medium">Jornada:</span>
              <select
                value={effectiveDate}
                onChange={(e) => {
                  setActiveDate(e.target.value);
                  setCurrentIndex(0);
                }}
                className="bg-transparent text-xs font-semibold text-[#1C1917] outline-none cursor-pointer border-none p-0 focus:ring-0 font-mono tabular-nums"
              >
                {availableDates.map((d, i) => (
                  <option key={d} value={d}>
                    {formatDateToCL(d)}{i === 0 ? ' (Última)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sorting Option */}
          {sortedImages.length > 0 && (
            <div className="bg-[#F7F6F2] rounded-md px-2.5 py-1.5 flex items-center gap-2 border border-[#E2DFD7]">
              <span className="text-xs text-[#78716C] font-medium">Orden:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setCurrentIndex(0);
                }}
                className="bg-transparent text-xs font-semibold text-[#1C1917] outline-none cursor-pointer border-none p-0 focus:ring-0"
              >
                <option value="report-order">Orden del Informe</option>
                <option value="recent">Recientes primero</option>
                <option value="oldest">Antiguas primero</option>
                <option value="name-asc">Nombre (A-Z)</option>
                <option value="name-desc">Nombre (Z-A)</option>
                <option value="type-first">Reportes primero</option>
              </select>
            </div>
          )}

          {/* Autoplay Controls */}
          {sortedImages.length > 0 && (
            <div className="bg-[#F7F6F2] rounded-md p-0.5 flex items-center gap-1 border border-[#E2DFD7]">
              <button
                onClick={handleToggleAutoPlay}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                  autoPlay
                    ? 'bg-[#461D77] text-white'
                    : 'bg-[#FFFFFF] text-[#1C1917] hover:bg-[#EFECE6]'
                }`}
              >
                {autoPlay ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                <span>{autoPlay ? 'Pausar' : 'Autoplay'}</span>
              </button>

              <div className="flex items-center gap-1.5 px-2">
                <Timer size={12} className="text-[#78716C]" />
                <select
                  value={intervalTime}
                  onChange={(e) => setIntervalTime(Number(e.target.value))}
                  className="bg-transparent text-xs font-mono tabular-nums font-semibold text-[#1C1917] outline-none cursor-pointer"
                >
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={40}>40s</option>
                  <option value={45}>45s</option>
                </select>
              </div>
            </div>
          )}

          <label className="bg-[#461D77] hover:bg-[#36155E] text-white px-4 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer">
            <Plus size={14} />
            <span>Subir Imágenes</span>
            <input
              type="file"
              className="hidden"
              multiple
              accept="image/*"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </label>
        </div>
      </header>

      {/* Cloud Notification Banner */}
      {firebaseNotice && (
        <div className="bg-[#F0FDF4] border-b border-[#BBF7D0] px-6 py-2.5 flex items-center justify-between text-[#15803D] text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{firebaseNotice}</span>
          </div>
          <button
            onClick={() => setFirebaseNotice(null)}
            className="text-[#15803D]/70 hover:text-[#15803D] cursor-pointer p-1"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Quota Limit Notice Banner */}
      {quotaNotice && (
        <div className="bg-[#FFFBEB] border-b border-[#FDE68A] px-6 py-2.5 flex items-center justify-between text-[#B45309] text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>Límite diario gratuito de Firebase alcanzado (se reinicia a medianoche). La galería continúa operando con respaldo local.</span>
          </div>
          <button
            onClick={() => setQuotaNotice(false)}
            className="text-[#B45309]/70 hover:text-[#B45309] cursor-pointer p-1"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        {isLoadingFirebase && sortedImages.length === 0 ? (
          <div className="w-full h-[55vh] border border-dashed rounded-lg border-[#D6D3CB] bg-[#FFFFFF] flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 bg-[#F3EEF8] border border-[#461D77]/20 rounded-md flex items-center justify-center text-[#461D77]">
              <Loader2 size={24} className="animate-spin" />
            </div>
            <div className="text-center">
              <h2 className="text-base font-bold text-[#1C1917] tracking-[-0.01em]">
                Cargando datos desde Firebase
              </h2>
              <p className="text-[#78716C] text-xs mt-1">
                Recuperando registros operativos y capturas...
              </p>
            </div>
          </div>
        ) : sortedImages.length === 0 ? (
          <div
            className={`w-full h-[55vh] border border-dashed rounded-lg flex flex-col items-center justify-center space-y-4 transition-colors duration-150 ${
              dragActive
                ? 'border-[#461D77] bg-[#F3EEF8]/50'
                : 'border-[#D6D3CB] bg-[#FFFFFF]'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFileUpload(e.dataTransfer.files);
            }}
          >
            <div className="w-14 h-14 bg-[#F7F6F2] border border-[#E2DFD7] rounded-lg flex items-center justify-center text-[#78716C]">
              <ImageIcon size={28} />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-[#1C1917] tracking-[-0.02em]">
                No hay imágenes cargadas
              </h2>
              <p className="text-[#78716C] text-xs mt-1">
                Arrastra archivos aquí o usa el botón Subir Imágenes.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Main Carousel */}
            <section className="relative group">
              <div className="aspect-[21/9] w-full bg-[#1C1917] rounded-lg overflow-hidden border border-[#E2DFD7] relative carousel-container">
                {sortedImages.map((img, idx) => (
                  <div
                    key={img.id}
                    className={`absolute inset-0 transition-opacity duration-300 ease-out flex items-center justify-center ${
                      idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}

                {/* Fullscreen Trigger */}
                <div className="absolute bottom-5 right-5 z-40">
                  <button
                    onClick={openFullScreen}
                    className="w-11 h-11 bg-[#1C1917]/80 hover:bg-[#461D77] rounded-md flex items-center justify-center text-white transition-colors duration-150 border border-white/20 cursor-pointer"
                    title="Pantalla Completa"
                  >
                    <Maximize2 size={18} />
                  </button>
                </div>

                {/* Controls */}
                <div className="absolute inset-y-0 left-0 w-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20">
                  <button
                    onClick={prevSlide}
                    className="w-10 h-10 bg-[#1C1917]/80 hover:bg-[#FFFFFF] rounded-md flex items-center justify-center text-white hover:text-[#1C1917] transition-colors duration-150 border border-white/20 cursor-pointer"
                    title="Anterior"
                  >
                    <ChevronLeft size={20} />
                  </button>
                </div>
                <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20">
                  <button
                    onClick={nextSlide}
                    className="w-10 h-10 bg-[#1C1917]/80 hover:bg-[#FFFFFF] rounded-md flex items-center justify-center text-white hover:text-[#1C1917] transition-colors duration-150 border border-white/20 cursor-pointer"
                    title="Siguiente"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                {/* Indicators */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 bg-[#1C1917]/60 px-2.5 py-1.5 rounded-md border border-white/15">
                  {sortedImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-1.5 transition-all duration-150 rounded-sm cursor-pointer ${
                        idx === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </section>

            {/* Grid View / Management */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3">
                <h2 className="text-base font-bold text-[#1C1917] tracking-[-0.01em]">
                  Biblioteca de Medios
                </h2>
                <p className="text-xs font-mono tabular-nums text-[#78716C]">
                  {sortedImages.length} archivos
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {sortedImages.map((img, idx) => (
                  <div
                    key={img.id}
                    className={`group relative aspect-square rounded-lg overflow-hidden border transition-colors duration-150 cursor-pointer bg-[#FFFFFF] ${
                      idx === currentIndex
                        ? 'border-[#461D77] ring-2 ring-[#461D77]/25'
                        : 'border-[#E2DFD7] hover:border-[#461D77]/50'
                    }`}
                    onClick={() => setCurrentIndex(idx)}
                  >
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    {img.id !== 'static_novandino' && !img.id.startsWith('sda_random_') && (
                      <div className="absolute inset-0 bg-[#1C1917]/65 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteImage(img.id);
                          }}
                          className="w-9 h-9 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-md flex items-center justify-center transition-colors cursor-pointer"
                          title="Eliminar imagen"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Fullscreen Overlay */}
      {isFullScreen && sortedImages[currentIndex] && (
        <div className="fixed inset-0 z-[9999] bg-[#0C0A09] flex items-center justify-center overflow-hidden">
          {/* Top Right Floating Control */}
          <div className="absolute top-5 right-5 flex items-center gap-2 z-50">
            <button
              onClick={() => setAutoPlay(!autoPlay)}
              className={`w-11 h-11 rounded-md flex items-center justify-center transition-colors duration-150 border cursor-pointer ${
                autoPlay
                  ? 'bg-[#461D77] text-white border-[#461D77]'
                  : 'bg-[#1C1917]/85 text-white border-white/20 hover:bg-[#FFFFFF] hover:text-[#1C1917]'
              }`}
              title={autoPlay ? "Pausar Reproducción" : "Iniciar Reproducción"}
            >
              {autoPlay ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>

            <button
              onClick={closeFullScreen}
              className="w-11 h-11 bg-[#1C1917]/85 text-white rounded-md flex items-center justify-center hover:bg-[#FFFFFF] hover:text-[#1C1917] transition-colors duration-150 border border-white/20 cursor-pointer"
              title="Cerrar Pantalla Completa"
            >
              <X size={20} />
            </button>
          </div>

          {/* Main Full-Size Image Container */}
          <div className="w-full h-full flex items-center justify-center relative select-none">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 z-50">
              <button
                onClick={prevSlide}
                className="w-11 h-11 bg-[#1C1917]/85 text-white rounded-md flex items-center justify-center hover:bg-[#FFFFFF] hover:text-[#1C1917] transition-colors duration-150 border border-white/20 cursor-pointer"
                title="Imagen Anterior"
              >
                <ChevronLeft size={24} />
              </button>
            </div>

            <img
              src={sortedImages[currentIndex].url}
              alt={sortedImages[currentIndex].name}
              className="w-full h-full max-w-full max-h-full object-contain z-10 select-none"
            />

            <div className="absolute right-5 top-1/2 -translate-y-1/2 z-50">
              <button
                onClick={nextSlide}
                className="w-11 h-11 bg-[#1C1917]/85 text-white rounded-md flex items-center justify-center hover:bg-[#FFFFFF] hover:text-[#1C1917] transition-colors duration-150 border border-white/20 cursor-pointer"
                title="Siguiente Imagen"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>

          {/* Bottom Slides Counter */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#1C1917]/85 px-4 py-1.5 rounded-md border border-white/20 pointer-events-none">
            <span className="text-xs font-mono tabular-nums font-semibold text-white">
              {currentIndex + 1} / {sortedImages.length}
            </span>
          </div>
        </div>
      )}
      {/* Hidden Offscreen Capture Area */}
      <div 
        style={{ 
          position: 'absolute', 
          top: '-9999px', 
          left: '-9999px', 
          width: '1000px', 
          background: '#ffffff',
          pointerEvents: 'none'
        }}
      >
        {/* ========================================================================= */}
        {/* ======================= NOVANDINO CAPTURE NODES ========================= */}
        {/* ========================================================================= */}
        {novandinoData.length > 0 && (
          <>
            {/* 1. KPIs Executive Cover - NOVANDINO */}
            <div id="capture-kpis-novandino" style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
              <div className="flex justify-between items-start pb-8 border-b-2 border-slate-200">
                <div className="flex flex-col items-start gap-4">
                  <NovandinoLogo className="h-28 w-[400px] max-w-full" variant="print" />
                  <div>
                    <h1 className="text-4xl font-[900] text-nucleo tracking-tighter leading-none mb-1 uppercase">INFORME OPERATIVO NOVANDINO</h1>
                    <p className="text-violeta font-bold text-[9px] tracking-[0.4em] uppercase">Subgerencia Logística Litio - Despacho Litio</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-violeta font-bold text-[9px] tracking-[0.3em] uppercase mb-1">FECHA JORNADA</p>
                  <p className="text-2xl font-[900] text-ionizado tracking-tighter whitespace-nowrap">{formatDateToCL(effectiveDate)}</p>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-7 border border-[#E2DFD7] space-y-5 mt-8">
                <div className="space-y-1 pb-4 border-b border-[#E2DFD7]">
                  <span className="font-semibold uppercase tracking-widest text-[10px] text-[#461D77] block">KPIs Operativos</span>
                  <h2 className="text-2xl font-bold text-[#1C1917] tracking-[-0.02em] uppercase">Cumplimiento Global Novandino</h2>
                </div>
                <div className="grid grid-cols-4 divide-x divide-[#E2DFD7] border border-[#E2DFD7] rounded-md">
                  {novandinoKPIs?.map((kpi, idx) => (
                    <div key={idx} className="bg-white p-4 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-[#57534E]">
                        {kpi.icon}
                        <span className="text-[10px] font-semibold text-[#57534E] uppercase tracking-wider">{kpi.label}</span>
                      </div>
                      <span className={`text-xl font-bold font-mono tabular-nums ${kpi.status === 'danger' ? 'text-[#B91C1C]' : 'text-[#1C1917]'} tracking-tight`}>
                        {kpi.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Composed Chart - NOVANDINO */}
            <div id="capture-chart-novandino" style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
              <div className="flex justify-between items-start pb-4 border-b border-slate-100">
                <div className="flex flex-col">
                  <p className="text-[9px] font-black text-ionizado uppercase tracking-[0.3em]">Análisis Gráfico Novandino</p>
                  <h2 className="text-3xl font-[950] text-nucleo uppercase tracking-tight">Comparación de Despacho</h2>
                </div>
                <p className="text-xs font-black text-violeta uppercase tracking-widest">{formatDateToCL(effectiveDate)}</p>
              </div>
              <div className="pt-6">
                <ChartCard 
                  type="composed" 
                  xAxis="Producto" 
                  yAxis={['Ton_Prog', 'Ton_Real', 'faenaMetaHours', 'faenaRealHours']} 
                  title="Análisis Comparativo Novandino" 
                  data={novandinoData} 
                />
              </div>
            </div>

            {/* 3. Products Details - NOVANDINO */}
            {novandinoProductList.map((prod, idx) => (
              <div key={`nov-${effectiveDate}-${prod}`} id={`capture-product-novandino-${idx}`} style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
                <ProductDetailSection 
                  product={prod} 
                  data={novandinoData.filter(d => d.Producto === prod)} 
                  allData={separatedRawData}
                  date={effectiveDate || ''} 
                  index={idx + 1} 
                  total={novandinoProductList.length} 
                />
              </div>
            ))}
          </>
        )}

        {/* ========================================================================= */}
        {/* ========================= SQM NY CAPTURE NODES ========================== */}
        {/* ========================================================================= */}
        {sqmData.length > 0 && (
          <>
            {/* 1. KPIs Executive Cover - SQM NY */}
            <div id="capture-kpis-sqm" style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
              <div className="flex justify-between items-start pb-8 border-b-2 border-slate-200">
                <div className="flex flex-col items-start gap-4">
                  <NovandinoLogo className="h-28 w-[400px] max-w-full" variant="print" />
                  <div>
                    <h1 className="text-4xl font-[900] text-nucleo tracking-tighter leading-none mb-1 uppercase">INFORME OPERATIVO SQM NY</h1>
                    <p className="text-violeta font-bold text-[9px] tracking-[0.4em] uppercase">Subgerencia Logística Litio</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-violeta font-bold text-[9px] tracking-[0.3em] uppercase mb-1">FECHA JORNADA</p>
                  <p className="text-2xl font-[900] text-ionizado tracking-tighter whitespace-nowrap">{formatDateToCL(effectiveDate)}</p>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-7 border border-[#E2DFD7] space-y-5 mt-8">
                <div className="space-y-1 pb-4 border-b border-[#E2DFD7]">
                  <span className="font-semibold uppercase tracking-widest text-[10px] text-[#461D77] block">KPIs Operativos</span>
                  <h2 className="text-2xl font-bold text-[#1C1917] tracking-[-0.02em] uppercase">Cumplimiento Global SQM NY</h2>
                </div>
                <div className="grid grid-cols-4 divide-x divide-[#E2DFD7] border border-[#E2DFD7] rounded-md">
                  {sqmKPIs?.map((kpi, idx) => (
                    <div key={idx} className="bg-white p-4 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-[#57534E]">
                        {kpi.icon}
                        <span className="text-[10px] font-semibold text-[#57534E] uppercase tracking-wider">{kpi.label}</span>
                      </div>
                      <span className={`text-xl font-bold font-mono tabular-nums ${kpi.status === 'danger' ? 'text-[#B91C1C]' : 'text-[#1C1917]'} tracking-tight`}>
                        {kpi.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Composed Chart - SQM NY */}
            <div id="capture-chart-sqm" style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
              <div className="flex justify-between items-start pb-4 border-b border-slate-100">
                <div className="flex flex-col">
                  <p className="text-[9px] font-black text-ionizado uppercase tracking-[0.3em]">Análisis Gráfico SQM NY</p>
                  <h2 className="text-3xl font-[950] text-nucleo uppercase tracking-tight">Comparación de Despacho</h2>
                </div>
                <p className="text-xs font-black text-violeta uppercase tracking-widest">{formatDateToCL(effectiveDate)}</p>
              </div>
              <div className="pt-6">
                <ChartCard 
                  type="composed" 
                  xAxis="Producto" 
                  yAxis={['Ton_Prog', 'Ton_Real', 'faenaMetaHours', 'faenaRealHours']} 
                  title="Análisis Comparativo SQM NY" 
                  data={sqmData} 
                />
              </div>
            </div>

            {/* 3. Products Details - SQM NY */}
            {sqmProductList.map((prod, idx) => (
              <div key={`sqm-${effectiveDate}-${prod}`} id={`capture-product-sqm-${idx}`} style={{ width: '900px', padding: '40px', background: '#ffffff' }}>
                <ProductDetailSection 
                  product={prod} 
                  data={sqmData.filter(d => d.Producto === prod)} 
                  allData={separatedRawData}
                  date={effectiveDate || ''} 
                  index={idx + 1} 
                  total={sqmProductList.length} 
                />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

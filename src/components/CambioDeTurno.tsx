import React, { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, FileText, TrendingUp, ArrowLeft, Image, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import CambioAnalisisComparativoChart, { formatDecimalToHHMM } from './CambioAnalisisComparativoChart';
import CambioAnalisisProductoChart from './CambioAnalisisProductoChart';
import { SimpleMarkdown } from './SimpleMarkdown';
import { analyzeProductData } from '../services/localAnalysisService';
import { cleanNumeric, parseExcelTime, normalizeHeader } from '../utils/dataProcessor';
import { generateShiftReportPDF } from '../utils/pdfGenerator';
import { db, isQuotaExceededError } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from './Toast';
import { getCurrentUser } from '../auth/authStore';
import { authenticatedFetch } from '../auth/authenticatedFetch';
import { enqueueOfflineMutation, getOperationalSnapshot, saveOperationalSnapshot } from '../services/offlineDb';

interface ChartData {
  name: string;
  producto: string;
  dateKey: string;
  Ton_Prog: number;
  Ton_Real: number;
  faenaMetaHours: number;
  faenaRealHours: number;
  destino: string;
}

const PRODUCTS_A = [
  "BISCHOFITA",
  "SAL 27/15",
  "SLIT",
  "LSI (S)",
  "NACL",
  "HALITA"
];

const PRODUCTS_B = [
  "MOP 70", "MOP TALCO", "MOP TALCO MAXIS", "MOP-G", "MOP-G (Rojo)",
  "MOP-G 59", "MOP-G O", "MOP-G PLUS", "MOP-G R 59", "MOP-GR PLUS",
  "MOP-H-AL", "MOP-H-BL", "MOP-S", "MOP-S 59", "MOP-S PLUS",
  "SILVINITA", "SOP-G", "SOP-H", "SOP-O", "SOP-S Talco",
  "USOP52", "MOP 50", "SOP FINO"
];

interface CambioDeTurnoProps {
  onBack: () => void;
}

interface GlobalAiSettings {
  activeAi: 'gemini' | 'glm';
  enableGemini: boolean;
  enableGlm: boolean;
  enableShiftAnalysis: boolean;
  enableJustificationRefinement: boolean;
}

interface AnalysisPanelProps {
  title: string;
  data: any[];
  allData: ChartData[];
  uniqueDates: string[];
  range: { start: string; end: string };
  setRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  colorIdx: number;
  complianceData?: any[];
  analysis: string | null;
  setAnalysis: (val: string | null) => void;
  globalAiSettings: GlobalAiSettings;
  userAiEnabled: boolean;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = React.memo(({
  title,
  data,
  allData,
  uniqueDates,
  range,
  setRange,
  colorIdx,
  complianceData,
  analysis,
  setAnalysis,
  globalAiSettings,
  userAiEnabled
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [aiEngine, setAiEngine] = useState<'gemini' | 'glm'>(globalAiSettings.activeAi);

  useEffect(() => {
    setAiEngine(globalAiSettings.activeAi);
  }, [globalAiSettings.activeAi]);

  const handleRunAnalysis = async () => {
    if (data.length === 0) return;
    setIsAnalyzing(true);
    setAnalysis("");
    setIsEditing(false);
    try {
      if (!globalAiSettings.enableShiftAnalysis || !userAiEnabled || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        await new Promise((resolve) => setTimeout(resolve, 400));

        const totalProg = data.reduce((acc, item) => acc + (item.Ton_Prog || 0), 0);
        const totalReal = data.reduce((acc, item) => acc + (item.Ton_Real || 0), 0);
        const pctCumplimiento = totalProg > 0 ? (totalReal / totalProg) * 100 : 0;

        let text = `### **Resumen Ejecutivo - ${title}**\n\n`;
        text += `Durante el periodo seleccionado de la faena **${title}**, se planificó un total de **${Math.round(totalProg).toLocaleString()} Ton** de carga, alcanzando una ejecución de carga real de **${Math.round(totalReal).toLocaleString()} Ton** (que representa un **${pctCumplimiento.toFixed(1)}% de cumplimiento**).\n\n`;

        if (pctCumplimiento >= 100) {
          text += `La operación superó la meta definida con un excelente flujo de carguío y tránsito libre en boleterías y pesajes.\n\n`;
        } else if (pctCumplimiento >= 90) {
          text += `Se registra un ritmo constante dentro de los límites aceptables de la tolerancia operativa ordinaria, alcanzando un progreso cercano al óptimo.\n\n`;
        } else {
          text += `Se evidencia una desviación operativa con un cumplimiento inferior a la meta programada. Se recomienda revisar tiempos de demora no identificados y cuellos de botella.\n\n`;
        }

        text += `### **Análisis de Desviaciones de Desempeño**\n\n`;
        text += typeof navigator !== 'undefined' && !navigator.onLine
          ? `📡 *Nota: Análisis generado en modo local sin conexión. El resumen fue almacenado en IndexedDB para respaldo operativo.*`
          : `⚠️ *Nota: La funcionalidad de Inteligencia Artificial para análisis extendido ha sido desactivada temporalmente por el Administrador de la plataforma o para su usuario. Para volver a habilitar reportes enriquecidos con IA, active el interruptor correspondiente en el Panel de Usuarios o consulte con el Administrador.*`;

        setAnalysis(text);
      } else {
        await analyzeProductData(title, data, (partial) => {
          setAnalysis(partial);
        }, complianceData, range, aiEngine);
      }
    } catch (err) {
      console.error(err);
      setAnalysis(`Error al generar análisis: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div id={`chart-table-container-${title.replace(/\s+/g, '_')}`} className="space-y-5 flex flex-col">
        <div className="bg-white p-4 rounded-lg border border-[#E2DFD7] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className={`text-xs font-mono font-bold px-2.5 py-1 rounded border uppercase tracking-wider ${
            colorIdx === 1 
              ? 'bg-[#F3EEF8] text-[#461D77] border-[#461D77]/20' 
              : 'bg-[#F7F6F2] text-[#1C1917] border-[#E2DFD7]'
          }`}>
            {title}
          </h2>
          {uniqueDates.length > 0 && (
            <div className="flex items-center gap-2 bg-[#F7F6F2] p-1 rounded-md border border-[#E2DFD7] w-full sm:w-auto">
              <div className="flex flex-col">
                <span className="text-[9px] font-semibold text-[#57534E] uppercase px-2">Desde</span>
                <input 
                  type="date"
                  value={range.start}
                  min={uniqueDates[0]}
                  max={uniqueDates[uniqueDates.length - 1]}
                  onChange={(e) => setRange({ ...range, start: e.target.value })}
                  className="bg-transparent text-xs font-mono font-semibold text-[#1C1917] outline-none px-2 cursor-pointer [color-scheme:light]"
                />
              </div>
              <div className="w-px h-5 bg-[#E2DFD7]" />
              <div className="flex flex-col">
                <span className="text-[9px] font-semibold text-[#57534E] uppercase px-2">Hasta</span>
                <input 
                  type="date"
                  value={range.end}
                  min={range.start || uniqueDates[0]}
                  max={uniqueDates[uniqueDates.length - 1]}
                  onChange={(e) => setRange({ ...range, end: e.target.value })}
                  className="bg-transparent text-xs font-mono font-semibold text-[#1C1917] outline-none px-2 cursor-pointer [color-scheme:light]"
                />
              </div>
            </div>
          )}
        </div>

        <CambioAnalisisComparativoChart data={data} title={title} />

        <div className="bg-white rounded-lg border border-[#E2DFD7] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2DFD7] bg-[#EFECE6]/40 flex items-center justify-between">
            <h3 className="text-[11px] font-mono font-semibold text-[#57534E] uppercase tracking-wider">Resumen por Producto</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#F7F6F2] border-b border-[#E2DFD7]">
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#57534E] uppercase tracking-wider">Prod.</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#57534E] uppercase tracking-wider text-right">Prog. Ton</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#57534E] uppercase tracking-wider text-right">Real Ton</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#57534E] uppercase tracking-wider text-right">Meta Hrs</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#57534E] uppercase tracking-wider text-right">Real Hrs</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#57534E] uppercase tracking-wider text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DFD7] tabular-nums">
                {data.map((item) => {
                  const progTon = item.Ton_Prog || 0;
                  const realTon = item.Ton_Real || 0;
                  const metaTime = item.faenaMetaHours || 0;
                  const realTime = item.faenaRealHours || 0;

                  let alertType: 'red' | 'orange' | 'green' = 'green';
                  let alertMessage = 'En Rango';

                  if (realTon > 0 && realTime <= 0) {
                    alertType = 'orange';
                    alertMessage = 'Falla MIGTRA';
                  } else if (progTon > 0 && realTon < (progTon * 0.90)) {
                    alertType = 'red';
                    alertMessage = 'Bajo Ton. (<90%)';
                  } else if (realTime > 0 && metaTime > 0 && (realTime - metaTime) > (10 / 60)) {
                    alertType = 'red';
                    alertMessage = 'Exc. Tiempo (>10m)';
                  }

                  let badgeStyle = "bg-emerald-50 text-[#15803D] border border-emerald-200";
                  if (alertType === 'red') {
                    badgeStyle = "bg-red-50 text-[#B91C1C] border border-red-200";
                  } else if (alertType === 'orange') {
                    badgeStyle = "bg-amber-50 text-[#B45309] border border-amber-200";
                  }

                  return (
                    <tr key={item.name} className="hover:bg-[#F7F6F2] transition-colors duration-150">
                      <td className="px-4 py-2.5 text-xs font-semibold text-[#1C1917]">{item.name}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-right text-[#57534E]">
                        {Math.round(progTon).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono font-semibold text-right text-[#461D77]">
                        {Math.round(realTon).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono text-right text-[#57534E]">
                        {formatDecimalToHHMM(metaTime)}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono font-semibold text-right text-[#1C1917]">
                        {formatDecimalToHHMM(realTime)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase whitespace-nowrap ${badgeStyle}`}>
                          {alertMessage}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[#57534E] text-xs">Sin datos en el rango</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {data.length > 0 && (
        <CambioAnalisisProductoChart 
          allData={allData} 
          range={range} 
          visibleProducts={data.map(item => item.name)} 
        />
      )}

      {/* Panel de Análisis Operativo */}
      <div className="bg-[#1C1917] rounded-lg p-6 border border-[#2E2925] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#461D77] p-2 rounded-md">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-wider">Resumen y Análisis Operativo</h4>
              <p className="text-[#A8A29E] text-xs">Compilación analítica de desempeño del turno</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {(globalAiSettings.enableGemini || globalAiSettings.enableGlm) && (
              <div className="flex items-center gap-1 bg-[#292524] p-1 rounded-md border border-white/10 mr-1">
                {globalAiSettings.enableGemini && (
                  <button
                    type="button"
                    onClick={() => setAiEngine('gemini')}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold transition-colors duration-150 uppercase cursor-pointer ${
                      aiEngine === 'gemini'
                        ? 'bg-[#461D77] text-white'
                        : 'text-[#A8A29E] hover:text-white'
                    }`}
                  >
                    Gemini 3.5
                  </button>
                )}
                {globalAiSettings.enableGlm && (
                  <button
                    type="button"
                    onClick={() => setAiEngine('glm')}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold transition-colors duration-150 uppercase cursor-pointer ${
                      aiEngine === 'glm'
                        ? 'bg-white text-[#1C1917]'
                        : 'text-[#A8A29E] hover:text-white'
                    }`}
                  >
                    Gemma
                  </button>
                )}
              </div>
            )}

            {analysis && !isAnalyzing && (
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="px-3 py-1.5 bg-[#292524] text-white text-xs font-semibold rounded-md hover:bg-[#3F3A36] transition-colors duration-150 cursor-pointer"
              >
                {isEditing ? 'Vista Previa' : 'Editar Texto'}
              </button>
            )}
            <button 
              onClick={() => generateShiftReportPDF({ title, data, range, analysis })}
              disabled={data.length === 0}
              className="px-3.5 py-1.5 bg-[#461D77] text-white text-xs font-semibold rounded-md hover:bg-[#36155E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            <button 
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || data.length === 0}
              className="px-4 py-1.5 bg-white text-[#1C1917] text-xs font-semibold rounded-md hover:bg-[#F7F6F2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 flex items-center gap-1.5 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-3 h-3 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  Generar Reporte
                </>
              )}
            </button>
          </div>
        </div>

        <div className="min-h-[100px] bg-[#292524]/70 rounded-md p-5 border border-white/10">
          {analysis ? (
            isEditing ? (
              <textarea
                value={analysis}
                onChange={(e) => setAnalysis(e.target.value)}
                className="w-full h-[280px] bg-transparent text-[#E7E5E4] text-sm leading-relaxed outline-none border-none resize-none focus:ring-0"
                placeholder="Edita el análisis aquí..."
              />
            ) : (
              <div className="prose prose-invert prose-sm max-w-full text-[#E7E5E4] leading-relaxed">
                <SimpleMarkdown content={analysis} />
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-6 text-[#A8A29E]">
              <p className="text-xs">Haz clic en "Generar Reporte" para compilar el resumen operativo del turno.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default function CambioDeTurno({ onBack }: CambioDeTurnoProps) {
  const { success, error: toastError, warning, info } = useToast();

  const [allData, setAllData] = useState<ChartData[]>([]);
  const [range1, setRange1] = useState({ start: '', end: '' });
  const [range2, setRange2] = useState({ start: '', end: '' });
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [complianceData, setComplianceData] = useState<any[]>([]);
  const [complianceFiles, setComplianceFiles] = useState<string[]>([]);

  // Drag & drop uploader states
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Global AI settings fetched dynamically from Firestore
  const [globalAiSettings, setGlobalAiSettings] = useState({
    activeAi: 'gemini' as 'gemini' | 'glm',
    enableGemini: true,
    enableGlm: true,
    enableShiftAnalysis: true,
    enableJustificationRefinement: true
  });
  const [userAiEnabled, setUserAiEnabled] = useState<boolean>(() => {
    const user = getCurrentUser();
    return user ? user.enableAi !== false : true;
  });

  useEffect(() => {
    const fetchAiSettings = async () => {
      try {
        const docRef = doc(db, 'system_config', 'ai_settings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setGlobalAiSettings({
            activeAi: data.activeAi || 'gemini',
            enableGemini: data.enableGemini !== false,
            enableGlm: data.enableGlm !== false,
            enableShiftAnalysis: data.enableShiftAnalysis !== false,
            enableJustificationRefinement: data.enableJustificationRefinement !== false
          });
        }

        const user = getCurrentUser();
        if (user) {
          const userDocRef = doc(db, 'users', user.entraOid || user.userId || user.uid || '');
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUserAiEnabled(userData.enableAi !== false);
          }
        }
      } catch (err) {
        if (!isQuotaExceededError(err)) {
          console.error('Error fetching AI settings in CambioDeTurno:', err);
        }
      }
    };
    fetchAiSettings();
  }, []);

  // Lifted analysis states for PDF generation
  const [novandinoAnalysis, setNovandinoAnalysis] = useState<string | null>(null);
  const [sqmAnalysis, setSqmAnalysis] = useState<string | null>(null);

  // Intentar cargar datos existentes desde localStorage / IndexedDB al inicializar
  useEffect(() => {
    const hydrateInitialData = async () => {
      const savedData = localStorage.getItem('sqm_raw_data');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed && parsed.length > 0) {
            const mapped: ChartData[] = parsed.map((item: any) => ({
              name: item.Producto || 'SIN PRODUCTO',
              producto: item.Producto || 'SIN PRODUCTO',
              dateKey: item.Fecha,
              Ton_Prog: Number(item.Ton_Prog) || 0,
              Ton_Real: Number(item.Ton_Real) || 0,
              faenaMetaHours: Number(item.faenaMetaHours) || 0,
              faenaRealHours: Number(item.faenaRealHours) || 0,
              destino: item.Destino || 'N/A'
            }));
            setAllData(mapped);

            const dates = mapped.map(d => d.dateKey).filter(Boolean).sort();
            if (dates.length > 0) {
              setRange1({ start: dates[0], end: dates[dates.length - 1] });
              setRange2({ start: dates[0], end: dates[dates.length - 1] });
            }
            setFileName("Historial cargado automáticamente");
            setStatus('success');
          }
        } catch (e) {
          console.error("Error al cargar datos de localStorage:", e);
        }
      }

      const draft = await getOperationalSnapshot<{
        novandinoAnalysis?: string | null;
        sqmAnalysis?: string | null;
      }>('shift_handoff_draft');
      if (draft?.data) {
        if (draft.data.novandinoAnalysis) setNovandinoAnalysis(draft.data.novandinoAnalysis);
        if (draft.data.sqmAnalysis) setSqmAnalysis(draft.data.sqmAnalysis);
      }
    };

    void hydrateInitialData();
  }, []);

  // Respaldo automático en IndexedDB de los análisis de cambio de turno
  useEffect(() => {
    if (novandinoAnalysis || sqmAnalysis) {
      void saveOperationalSnapshot('shift_handoff_draft', {
        range1,
        range2,
        novandinoAnalysis,
        sqmAnalysis,
        fileName,
      });
    }
  }, [novandinoAnalysis, sqmAnalysis, range1, range2, fileName]);

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    const fileNameLower = file.name.toLowerCase();

    if (fileNameLower.endsWith('.json')) {
      reader.onload = (evt) => {
        try {
          const json = JSON.parse(evt.target?.result as string);
          setComplianceData(prev => [...prev, json]);
          setComplianceFiles(prev => [...prev, file.name]);
        } catch (err) {
          console.error("Error parsing JSON:", err);
          setError(`Error en JSON: ${file.name}`);
        }
      };
      reader.readAsText(file);
      return;
    }

    // Procesar archivo Excel
    setFileName(file.name);
    setStatus('idle');
    setError(null);

    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        const wb = XLSX.read(dataBuffer, { type: 'array', cellDates: true });
        
        const targetSheetName = "Base de Datos";
        const wsname = wb.SheetNames.find(name => name === targetSheetName) || wb.SheetNames[0];
        
        if (!wsname) {
          throw new Error(`No se encontró la pestaña "${targetSheetName}" ni ninguna otra en el archivo.`);
        }

        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any[][];
        if (rawData.length < 2) throw new Error("Archivo vacío o estructura inválida.");

        // Detección dinámica de cabeceras similar a App.tsx
        const rawHeaders = rawData[0].map(h => String(h || '').trim());
        const normalizedHeaders = rawHeaders.map(h => normalizeHeader(h));
        
        const getIdx = (fieldName: string, aliases: string[], fallback: number): number => {
          for (const alias of aliases) {
            const normAlias = normalizeHeader(alias);
            if (normAlias.length < 2) continue;
            const exactIdx = normalizedHeaders.findIndex(h => h === normAlias);
            if (exactIdx !== -1) return exactIdx;
          }
          for (const alias of aliases) {
            const normAlias = normalizeHeader(alias);
            if (normAlias.length < 3) continue;
            const partialIdx = normalizedHeaders.findIndex(h => h.includes(normAlias));
            if (partialIdx !== -1) return partialIdx;
          }
          return fallback;
        };

        const idx = {
          fecha: getIdx("fecha", ["FECHA", "JORNADA", "DIA"], 1),
          producto: getIdx("producto", ["PRODUCTO", "NIVEL", "PRODUCTO META"], 5),
          destino: getIdx("destino", ["DESTINO", "UBICACION"], 6),
          tonProg: getIdx("tonProg", ["TON PROG", "PROGRAMADO", "TONELADAS PROGRAMADAS"], 7),
          tonReal: getIdx("tonReal", ["TON REAL", "TONELADAS REALES"], 8),
          faenaMeta: getIdx("faenaMeta", ["TIEMPO INTERIOR FAENA PRODUCTO META", "FAENA META", "META HRS"], 49),
          faenaReal: getIdx("faenaReal", ["TIEMPO INTERIOR FAENA REAL", "FAENA REAL", "REAL HRS"], 50)
        };

        const mappedData: ChartData[] = rawData.slice(1).map((row) => {
          if (!row || row.length < 2) return null;
          let dateVal = "";
          let rawDate = row[idx.fecha];
          if (rawDate instanceof Date) {
            dateVal = rawDate.toISOString().split('T')[0];
          } else if (typeof rawDate === 'number') {
            const d = new Date((rawDate - 25569) * 86400 * 1000);
            if (!isNaN(d.getTime())) dateVal = d.toISOString().split('T')[0];
          } else if (typeof rawDate === 'string' && rawDate.trim()) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) dateVal = d.toISOString().split('T')[0];
          }

          if (!dateVal) return null;

          const producto = String(row[idx.producto] || 'SIN PRODUCTO').toUpperCase().trim();
          const destino = row[idx.destino] ? String(row[idx.destino]).trim() : 'N/A';
          
          return {
            name: producto,
            producto: producto,
            dateKey: dateVal,
            Ton_Prog: cleanNumeric(row[idx.tonProg]),
            Ton_Real: cleanNumeric(row[idx.tonReal]),
            faenaMetaHours: parseExcelTime(row[idx.faenaMeta]),
            faenaRealHours: parseExcelTime(row[idx.faenaReal]),
            destino: destino,
          };
        }).filter((item): item is ChartData => item !== null);

        if (mappedData.length === 0) {
          throw new Error('No se encontraron datos válidos en las columnas del archivo.');
        }

        setAllData(mappedData);
        void saveOperationalSnapshot('shift_handoff_data', mappedData, mappedData.length);

        const user = getCurrentUser();
        const handoffSummary = `Cargó archivo base Excel (${file.name}) con ${mappedData.length} registros para Cambio de Turno.`;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          await enqueueOfflineMutation('shift_handoff', `Cambio de Turno (${file.name})`, {
            user,
            title: 'Cambio de Turno',
            summaryText: handoffSummary,
          });
        } else if (user) {
          try {
            const { logActivity } = await import('../services/firebase');
            await logActivity(user, 'Carga de Datos', handoffSummary);
          } catch (err) {
            console.error('Error logging Cambio de Turno excel upload, queueing offline:', err);
            await enqueueOfflineMutation('shift_handoff', `Cambio de Turno (${file.name})`, {
              user,
              title: 'Cambio de Turno',
              summaryText: handoffSummary,
            });
          }
        }
        
        const dates = mappedData.map(d => d.dateKey).sort();
        if (dates.length > 0) {
          setRange1({ start: dates[0], end: dates[dates.length - 1] });
          setRange2({ start: dates[0], end: dates[dates.length - 1] });
        }
        
        setStatus('success');
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Error al procesar el archivo Excel.');
        setStatus('error');
      }
    };

    reader.onerror = () => {
      setError('Error al leer el archivo.');
      setStatus('error');
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      setIsUploading(true);
      setUploadProgress(0);
      
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setIsUploading(false);
              processFile(file);
              success(`Archivo ${file.name} procesado correctamente`, "Carga Completa");
            }, 300);
            return 100;
          }
          return prev + 10;
        });
      }, 40);
    }
  }, [processFile, success]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setIsUploading(true);
      setUploadProgress(0);
      
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setIsUploading(false);
              processFile(file);
              success(`Archivo ${file.name} procesado correctamente`, "Carga Completa");
            }, 300);
            return 100;
          }
          return prev + 10;
        });
      }, 40);
    }
  }, [processFile, success]);

  const clearCompliance = () => {
    setComplianceData([]);
    setComplianceFiles([]);
  };

  const uniqueDates = Array.from(new Set(allData.map(d => d.dateKey))).sort();

  const getAggregatedData = (start: string, end: string, allowedProducts?: string[]) => {
    const filtered = allData.filter(d => {
      const dateInRange = (!start || !end) || (d.dateKey >= start && d.dateKey <= end);
      const productAllowed = !allowedProducts || allowedProducts.includes(d.producto);
      return dateInRange && productAllowed;
    });

    const groups: Record<string, {
      Ton_Prog: number;
      Ton_Real: number;
      faenaMetaHoursSum: number;
      faenaRealHoursSum: number;
      count: number;
    }> = {};

    filtered.forEach(item => {
      if (!groups[item.producto]) {
        groups[item.producto] = { Ton_Prog: 0, Ton_Real: 0, faenaMetaHoursSum: 0, faenaRealHoursSum: 0, count: 0 };
      }
      groups[item.producto].Ton_Prog += item.Ton_Prog;
      groups[item.producto].Ton_Real += item.Ton_Real;
      groups[item.producto].faenaMetaHoursSum += item.faenaMetaHours;
      groups[item.producto].faenaRealHoursSum += item.faenaRealHours;
      groups[item.producto].count += 1;
    });

    return Object.entries(groups).map(([name, g]) => ({
      name,
      Ton_Prog: g.Ton_Prog,
      Ton_Real: g.Ton_Real,
      faenaMetaHours: g.faenaMetaHoursSum / g.count,
      faenaRealHours: g.faenaRealHoursSum / g.count
    }));
  };

  const aggregatedData1 = React.useMemo(() => getAggregatedData(range1.start, range1.end, PRODUCTS_A), [allData, range1]);
  const aggregatedData2 = React.useMemo(() => getAggregatedData(range2.start, range2.end, PRODUCTS_B), [allData, range2]);

  const downloadTemplate = {
    _fn: async () => {
      const wsData = [
        { B: 'Fecha', AF: 'Producto', AH: 'Ton (Prog)', AI: 'Ton (Real)', AX: 'Meta Hrs', AY: 'Real Hrs' },
        { B: '2026-05-10', AF: 'SLIT', AH: 500, AI: 480, AX: '08:00', AY: '08:30' }
      ];
      const ws = XLSX.utils.json_to_sheet(wsData, { header: ["B", "AF", "AH", "AI", "AX", "AY"], skipHeader: true });
      ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Base de Datos");
      XLSX.writeFile(wb, "plantilla_comparativa.xlsx");

      // Record download audit log
      try {
        const user = getCurrentUser();
        if (user) {
          const { logActivity } = await import('../services/firebase');
          await logActivity(
            user,
            'Descargó Plantilla',
            'Descargó la plantilla Excel para análisis comparativo de cambios de turno (plantilla_comparativa.xlsx).'
          );
        }
      } catch (err) {
        console.error('Error logging template download:', err);
      }
    }
  }._fn;

  const downloadPDF = async (type: 'novandino' | 'sqm') => {
    const reportTitle = type === 'novandino' ? "NOVANDINO" : "SQM N.Y.";
    const reportData = type === 'novandino' ? aggregatedData1 : aggregatedData2;
    const reportRange = type === 'novandino' ? range1 : range2;
    const reportAnalysis = type === 'novandino' ? novandinoAnalysis : sqmAnalysis;
    
    setDownloadingPdf(true);
    info(`Iniciando generación de PDF de alta precisión en el servidor para ${reportTitle}...`, "Generando Reporte", 4000);
    
    try {
      const user = getCurrentUser();
      const operatorName = user ? user.name : '';

      const response = await authenticatedFetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: reportTitle,
          data: reportData,
          range: reportRange,
          analysis: reportAnalysis,
          operatorName: operatorName
        })
      });

      if (!response.ok) {
        throw new Error('La respuesta del servidor no fue exitosa');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_Cambio_Turno_Server_${type.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      success(`Reporte PDF de ${reportTitle} descargado correctamente`, "Generación Completada");

      // Log to Firestore
      try {
        if (user) {
          const { logActivity } = await import('../services/firebase');
          await logActivity(
            user,
            'Descargó PDF Servidor',
            `Exportó y descargó el Reporte PDF de alta precisión generado en el servidor para la faena ${reportTitle}.`
          );
        }
      } catch (logErr) {
        console.error('Error logging PDF server download:', logErr);
      }

    } catch (err) {
      console.error('Error fetching server-side PDF:', err);
      warning("No se pudo completar el PDF en el servidor. Utilizando motor del cliente como respaldo...", "Respaldo Activado");
      
      // Fallback to client-side generation
      try {
        generateShiftReportPDF({
          title: reportTitle,
          data: reportData,
          range: reportRange,
          analysis: reportAnalysis
        });
        success(`Reporte PDF de ${reportTitle} generado en el cliente`, "Descarga Exitosa");
      } catch (clientErr) {
        toastError("Fallo crítico: No se pudo generar el reporte en el cliente.", "Error");
      }
    } finally {
      setDownloadingPdf(false);
    }
  };

  const downloadPNG = (type: 'novandino' | 'sqm') => {
    const id = type === 'novandino' ? 'chart-table-container-NOVANDINO' : 'chart-table-container-SQM_N.Y.';
    const title = type === 'novandino' ? 'Novandino' : 'SQM N.Y.';
    const element = document.getElementById(id);
    if (!element) return;

    // Obtener las dimensiones reales totales para evitar recortes por plegado de pantalla (viewport fold)
    const width = element.scrollWidth + 64; // Compensar 32px de padding por lado
    const height = element.scrollHeight + 64; // Compensar 32px de padding arriba y abajo

    toPng(element, {
      width: width,
      height: height,
      backgroundColor: '#FAF5E6',
      style: {
        borderRadius: '0px',
        padding: '32px',
        margin: '0px',
        height: 'auto',
        maxHeight: 'none',
        overflow: 'visible'
      },
      pixelRatio: 2
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `Grafico_y_Tabla_Comparativa_${type === 'novandino' ? 'Novandino' : 'SQM'}_${dateStr}.png`;
        link.href = dataUrl;
        link.click();

        // Log to Firestore
        try {
          const user = getCurrentUser();
          if (user) {
            import('../services/firebase').then(({ logActivity }) => {
              logActivity(
                user,
                'Descargó PNG',
                `Exportó y descargó el Gráfico y Tabla Comparativa de ${title} en formato PNG.`
              );
            });
          }
        } catch (err) {
          console.error('Error logging PNG download:', err);
        }
      })
      .catch((err) => {
        console.error('Error rendering PNG:', err);
      });
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragOverCapture={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      className="min-h-screen bg-[#F7F6F2] text-[#1C1917] p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 relative"
    >
      {/* Screen-wide Drag & Drop Overlay Portal */}
      {isDragging && (
        <div
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="fixed inset-0 bg-[#1C1917]/85 z-[9999] flex flex-col items-center justify-center border-2 border-dashed border-[#461D77] m-4 rounded-lg transition-opacity duration-150 ease-out"
        >
          <div className="text-center p-8 space-y-3 max-w-md pointer-events-none bg-[#FFFFFF] border border-[#E2DFD7] rounded-lg shadow-sm">
            <div className="mx-auto w-12 h-12 bg-[#F3EEF8] border border-[#461D77]/20 rounded-md flex items-center justify-center text-[#461D77]">
              <Upload className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[#1C1917] tracking-[-0.02em]">
              Suelta para Procesar
            </h2>
            <p className="text-[#57534E] text-sm">
              Suelta tu plantilla Excel o archivo JSON de justificación aquí para cargarlos instantáneamente.
            </p>
          </div>
        </div>
      )}

      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#FFFFFF] p-5 rounded-lg border border-[#E2DFD7]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 bg-[#FFFFFF] hover:bg-[#F7F6F2] rounded-md border border-[#E2DFD7] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#461D77] cursor-pointer"
            title="Volver"
          >
            <ArrowLeft className="w-4 h-4 text-[#1C1917]" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#1C1917] tracking-[-0.02em]">
              Análisis de Turno
            </h1>
            <p className="text-[#57534E] text-xs">
              Comparativa dual: suma de toneladas vs. promedio de horas
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {complianceFiles.length > 0 && (
            <div className="flex items-center gap-2 bg-[#FEF3C7]/60 px-3 py-1.5 rounded-md border border-[#F59E0B]/40">
              <span className="text-xs font-mono tabular-nums font-semibold text-[#B45309]">
                {complianceFiles.length} JSONs Incumplimiento
              </span>
              <button
                onClick={clearCompliance}
                className="p-0.5 hover:bg-[#F59E0B]/20 rounded text-[#B45309] transition-colors duration-150 cursor-pointer"
                title="Limpiar archivos de incumplimiento"
              >
                <AlertCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => downloadPDF('novandino')}
              disabled={aggregatedData1.length === 0 || downloadingPdf}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1C1917] border border-[#E2DFD7] hover:bg-[#F7F6F2] rounded-md transition-colors duration-150 ease-out bg-[#FFFFFF] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#461D77]"
            >
              {downloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#461D77]" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-[#57534E]" />
              )}
              <span>PDF Novandino</span>
            </button>
            <button
              onClick={() => downloadPNG('novandino')}
              disabled={aggregatedData1.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1C1917] border border-[#E2DFD7] hover:bg-[#F7F6F2] rounded-md transition-colors duration-150 ease-out bg-[#FFFFFF] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#461D77]"
            >
              <Image className="w-3.5 h-3.5 text-[#57534E]" />
              <span>PNG Novandino</span>
            </button>
            <button
              onClick={() => downloadPDF('sqm')}
              disabled={aggregatedData2.length === 0 || downloadingPdf}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1C1917] border border-[#E2DFD7] hover:bg-[#F7F6F2] rounded-md transition-colors duration-150 ease-out bg-[#FFFFFF] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#461D77]"
            >
              {downloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#461D77]" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-[#57534E]" />
              )}
              <span>PDF SQM</span>
            </button>
            <button
              onClick={() => downloadPNG('sqm')}
              disabled={aggregatedData2.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1C1917] border border-[#E2DFD7] hover:bg-[#F7F6F2] rounded-md transition-colors duration-150 ease-out bg-[#FFFFFF] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#461D77]"
            >
              <Image className="w-3.5 h-3.5 text-[#57534E]" />
              <span>PNG SQM</span>
            </button>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1C1917] border border-[#E2DFD7] hover:bg-[#F7F6F2] rounded-md transition-colors duration-150 ease-out bg-[#FFFFFF] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#461D77]"
            >
              <Download className="w-3.5 h-3.5 text-[#57534E]" />
              <span>Plantilla</span>
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-[#461D77] hover:bg-[#36155E] text-white text-xs font-semibold rounded-md cursor-pointer transition-colors duration-150 ease-out focus-within:ring-2 focus-within:ring-[#461D77] focus-within:ring-offset-1">
              <Upload className="w-3.5 h-3.5" />
              <span>Cargar Archivos</span>
              <input
                type="file"
                className="hidden"
                accept=".xlsx, .xls, .csv, .xlsm, .json"
                multiple
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>
      </header>

      {fileName && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors duration-150 ${
            status === 'success'
              ? 'bg-[#FFFFFF] border-[#E2DFD7]'
              : 'bg-[#FEF2F2] border-[#FECACA]'
          }`}
        >
          {status === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#B91C1C] shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <span className="font-mono text-xs font-semibold text-[#1C1917] truncate block">
              {fileName}
            </span>
            {error && (
              <p className="text-xs mt-0.5 font-medium text-[#B91C1C]">{error}</p>
            )}
          </div>
          {status === 'success' && (
            <span className="text-[11px] font-mono font-semibold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-0.5 rounded-md shrink-0">
              Cargado
            </span>
          )}
        </div>
      )}

      {/* Interactive Drag & Drop zone when no data is loaded */}
      {allData.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`min-h-[400px] flex flex-col items-center justify-center border border-dashed rounded-lg p-10 transition-colors duration-150 ease-out bg-[#FFFFFF] ${
            isDragging
              ? 'border-[#461D77] bg-[#F3EEF8]/50'
              : 'border-[#D6D3CB] hover:border-[#461D77]/50'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center space-y-5 max-w-md w-full text-center">
              <div className="relative flex items-center justify-center w-16 h-16 bg-[#F3EEF8] border border-[#461D77]/20 rounded-lg">
                <Loader2 className="w-7 h-7 text-[#461D77] animate-spin" />
              </div>
              <div className="space-y-1.5 w-full">
                <div className="flex items-center justify-between text-xs font-semibold text-[#1C1917]">
                  <span>Procesando archivo operativo</span>
                  <span className="font-mono tabular-nums text-[#461D77]">{uploadProgress}%</span>
                </div>
                <p className="text-xs text-[#57534E] text-left">
                  Analizando cabeceras dinámicas y mapeando registros...
                </p>
                <div className="w-full h-1.5 bg-[#EFECE6] rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-[#461D77] transition-all duration-150 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-5 max-w-lg">
              <div className="w-12 h-12 bg-[#F3EEF8] border border-[#461D77]/20 rounded-md flex items-center justify-center text-[#461D77]">
                <Upload className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-[#1C1917] tracking-[-0.02em]">
                  Cargar Planilla de Turno
                </h2>
                <p className="text-sm text-[#57534E] leading-relaxed">
                  Arrastra plantillas comparativas en formato Excel (.xlsx, .xls) o archivos JSON de justificación de desviaciones.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-[#78716C] border-y border-[#E2DFD7] py-2 px-4">
                <span className="inline-flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#15803D]" /> Excel Base
                </span>
                <span aria-hidden="true" className="text-[#D6D3CB]">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#B45309]" /> JSON Justificaciones
                </span>
              </div>

              <div className="pt-1 flex flex-col sm:flex-row items-center gap-3">
                <label className="flex items-center gap-2 px-5 py-2.5 bg-[#461D77] hover:bg-[#36155E] text-white text-xs font-semibold rounded-md cursor-pointer transition-colors duration-150 ease-out">
                  <Upload className="w-4 h-4" />
                  <span>Seleccionar Archivo</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx, .xls, .csv, .xlsm, .json"
                    multiple
                    onChange={handleFileUpload}
                  />
                </label>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#1C1917] border border-[#E2DFD7] hover:bg-[#F7F6F2] rounded-md transition-colors duration-150 ease-out bg-[#FFFFFF] cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#57534E]" />
                  <span>Plantilla Base</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <main className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AnalysisPanel
            title="NOVANDINO"
            data={aggregatedData1}
            allData={allData}
            uniqueDates={uniqueDates}
            range={range1}
            setRange={setRange1}
            colorIdx={1}
            complianceData={complianceData}
            analysis={novandinoAnalysis}
            setAnalysis={setNovandinoAnalysis}
            globalAiSettings={globalAiSettings}
            userAiEnabled={userAiEnabled}
          />
          <AnalysisPanel
            title="SQM N.Y."
            data={aggregatedData2}
            allData={allData}
            uniqueDates={uniqueDates}
            range={range2}
            setRange={setRange2}
            colorIdx={2}
            complianceData={complianceData}
            analysis={sqmAnalysis}
            setAnalysis={setSqmAnalysis}
            globalAiSettings={globalAiSettings}
            userAiEnabled={userAiEnabled}
          />
        </main>
      )}

      <footer className="text-center border-t border-[#E2DFD7] pt-6 pb-8 mt-8">
        <p className="text-xs font-mono text-[#78716C]">
          Análisis de Turno · Modo Comparativo Dual
        </p>
      </footer>
    </div>
  );
}

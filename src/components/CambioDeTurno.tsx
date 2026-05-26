import React, { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Sparkles, BrainCircuit, ArrowLeft } from 'lucide-react';
import CambioAnalisisComparativoChart, { formatDecimalToHHMM } from './CambioAnalisisComparativoChart';
import CambioAnalisisProductoChart from './CambioAnalisisProductoChart';
import { SimpleMarkdown } from './SimpleMarkdown';
import { analyzeProductData } from '../services/geminiAnalysisService';
import { cleanNumeric, parseExcelTime, normalizeHeader } from '../utils/dataProcessor';

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
  "LSI (S)"
];

const PRODUCTS_B = [
  "MOP 70", "MOP TALCO", "MOP TALCO MAXIS", "MOP-G", "MOP-G (Rojo)",
  "MOP-G 59", "MOP-G O", "MOP-G PLUS", "MOP-G R 59", "MOP-GR PLUS",
  "MOP-H-AL", "MOP-H-BL", "MOP-S", "MOP-S 59", "MOP-S PLUS",
  "NACL", "SILVINITA", "SOP-G", "SOP-H", "SOP-O", "SOP-S Talco",
  "USOP52", "MOP 50", "SOP FINO"
];

interface CambioDeTurnoProps {
  onBack: () => void;
}

export default function CambioDeTurno({ onBack }: CambioDeTurnoProps) {
  const [allData, setAllData] = useState<ChartData[]>([]);
  const [range1, setRange1] = useState({ start: '', end: '' });
  const [range2, setRange2] = useState({ start: '', end: '' });
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [complianceData, setComplianceData] = useState<any[]>([]);
  const [complianceFiles, setComplianceFiles] = useState<string[]>([]);

  // Intentar cargar datos existentes desde localStorage al inicializar
  useEffect(() => {
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
  }, []);

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

    reader.onload = (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        const wb = XLSX.read(dataBuffer, { type: 'array', cellDates: true });
        
        const targetSheetName = "Base de Datos";
        const wsname = wb.SheetNames.find(name => name === targetSheetName) || wb.SheetNames[0];
        
        if (!wsname) {
          throw new Error(`No se encontró la pestaña "${targetSheetName}" ni ninguna otra en el archivo.`);
        }

        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
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

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(processFile);
    }
  }, [processFile]);

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

  const downloadTemplate = () => {
    const wsData = [
      { B: 'Fecha', AF: 'Producto', AH: 'Ton (Prog)', AI: 'Ton (Real)', AX: 'Meta Hrs', AY: 'Real Hrs' },
      { B: '2026-05-10', AF: 'SLIT', AH: 500, AI: 480, AX: '08:00', AY: '08:30' }
    ];
    const ws = XLSX.utils.json_to_sheet(wsData, { header: ["B", "AF", "AH", "AI", "AX", "AY"], skipHeader: true });
    ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Base de Datos");
    XLSX.writeFile(wb, "plantilla_comparativa.xlsx");
  };

  const AnalysisPanel = ({ title, data, range, setRange, colorIdx }: { 
    title: string, 
    data: any[], 
    range: {start: string, end: string}, 
    setRange: any,
    colorIdx: number,
    complianceData?: any[]
  }) => {
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const handleRunAnalysis = async () => {
      if (data.length === 0) return;
      setIsAnalyzing(true);
      setAnalysis(""); 
      setIsEditing(false); 
      try {
        await analyzeProductData(title, data, (partial) => {
          setAnalysis(partial);
        }, complianceData);
      } catch (err) {
        console.error(err);
        setAnalysis(`Error al generar análisis: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      } finally {
        setIsAnalyzing(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-2xl border border-violeta/10 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-tighter ${colorIdx === 1 ? 'bg-nucleo/10 text-nucleo' : 'bg-mineral/10 text-mineral'}`}>
            {title}
          </h2>
          {uniqueDates.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 w-full sm:w-auto">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase px-2">Desde</span>
                <input 
                  type="date"
                  value={range.start}
                  min={uniqueDates[0]}
                  max={uniqueDates[uniqueDates.length - 1]}
                  onChange={(e) => setRange({ ...range, start: e.target.value })}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none px-2 cursor-pointer [color-scheme:light]"
                />
              </div>
              <div className="w-px h-4 bg-slate-200" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase px-2">Hasta</span>
                <input 
                  type="date"
                  value={range.end}
                  min={range.start || uniqueDates[0]}
                  max={uniqueDates[uniqueDates.length - 1]}
                  onChange={(e) => setRange({ ...range, end: e.target.value })}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none px-2 cursor-pointer [color-scheme:light]"
                />
              </div>
            </div>
          )}
        </div>

        <CambioAnalisisComparativoChart data={data} />

        <div className="bg-white rounded-[2.5rem] border border-violeta/10 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">RESUMEN POR PRODUCTO</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Prod.</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Prog. Ton</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Real Ton</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Meta Hrs</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Real Hrs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((item) => (
                  <tr key={item.name} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-4 py-3 text-[11px] font-bold text-slate-700">{item.name}</td>
                    <td className="px-4 py-3 text-[11px] font-bold text-right text-slate-400">
                      {Math.round(item.Ton_Prog).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-bold text-right">
                      <span className="text-violeta">{Math.round(item.Ton_Real).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-[11px] font-bold text-right text-slate-400">
                      {formatDecimalToHHMM(item.faenaMetaHours)}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-bold text-right text-mineral">
                      {formatDecimalToHHMM(item.faenaRealHours)}
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium italic text-xs">Sin datos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gráfico y tabla de tendencia diario del producto */}
        {data.length > 0 && (
          <CambioAnalisisProductoChart 
            allData={allData} 
            range={range} 
            visibleProducts={data.map(item => item.name)} 
          />
        )}

        {/* Panel de Análisis de IA */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <BrainCircuit className="w-24 h-24 text-white" />
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-violeta p-2 rounded-xl">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-white text-sm font-black uppercase tracking-widest">Análisis Inteligente</h4>
                  <p className="text-slate-400 text-[10px] font-bold">Insights automáticos basados en datos semanales</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {analysis && !isAnalyzing && (
                  <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-4 py-2 bg-slate-800 text-white text-[10px] font-black rounded-xl hover:bg-slate-700 transition-all uppercase tracking-widest"
                  >
                    {isEditing ? 'Vista Previa' : 'Editar Texto'}
                  </button>
                )}
                <button 
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing || data.length === 0}
                  className="px-6 py-2 bg-white text-slate-900 text-xs font-black rounded-xl hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <BrainCircuit className="w-4 h-4" />
                      Generar Análisis
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="min-h-[100px] bg-slate-800/50 rounded-2xl p-6 border border-white/5">
              {analysis ? (
                isEditing ? (
                  <textarea
                    value={analysis}
                    onChange={(e) => setAnalysis(e.target.value)}
                    className="w-full h-[300px] bg-transparent text-slate-300 text-sm font-medium leading-relaxed outline-none border-none resize-none focus:ring-0"
                    placeholder="Edita el análisis aquí..."
                  />
                ) : (
                  <div className="prose prose-invert prose-sm max-w-full text-slate-300 leading-relaxed">
                    <SimpleMarkdown content={analysis} />
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-8 text-slate-500 italic space-y-2">
                  <p className="text-xs font-medium">Haz clic en "Generar Análisis" para obtener una lectura inteligente de los datos.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-calido p-4 md:p-8 max-w-[1800px] mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-violeta/10 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="p-3 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-violeta tracking-tight">Análisis de Turno</h1>
            <p className="text-slate-500 text-sm font-medium italic">Modo Comparativo Dual: Suma de Tons vs Promedio de Horas</p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {complianceFiles.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-tight">
                {complianceFiles.length} JSONs Incumplimiento
              </span>
              <button onClick={clearCompliance} className="p-1 hover:bg-amber-200 rounded-lg text-amber-600">
                <AlertCircle className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-violeta border-2 border-violeta/10 hover:border-violeta/30 rounded-xl transition-all active:scale-95 bg-white">
              <Download className="w-4 h-4" /> Plantilla
            </button>
            <label className="flex items-center gap-2 px-6 py-3 bg-violeta text-white font-bold rounded-xl cursor-pointer hover:bg-violeta/90 transition-all shadow-lg active:scale-95">
              <Upload className="w-4 h-4" /> <span>Cargar Archivos</span>
              <input type="file" className="hidden" accept=".xlsx, .xls, .csv, .xlsm, .json" multiple onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </header>

      {fileName && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${status === 'success' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
          {status === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-rose-500" />}
          <div className="flex-1">
            <span className="font-bold text-sm text-slate-800">{fileName}</span>
            {error && <p className="text-xs mt-1 font-medium text-rose-600">{error}</p>}
          </div>
          {status === 'success' && (
            <span className="text-[10px] font-black uppercase tracking-widest bg-violeta text-white px-3 py-1 rounded-lg">Cargado Exitosamente</span>
          )}
        </div>
      )}

      <main className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <AnalysisPanel 
          title="NOVANDINO" 
          data={aggregatedData1} 
          range={range1} 
          setRange={setRange1} 
          colorIdx={1} 
          complianceData={complianceData} 
        />
        <AnalysisPanel 
          title="SQM N.Y." 
          data={aggregatedData2} 
          range={range2} 
          setRange={setRange2} 
          colorIdx={2} 
          complianceData={complianceData} 
        />
      </main>

      <footer className="text-center pb-8 border-t border-slate-100 pt-8 mt-12">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Excel Analytic Platform · Modo Dual Activo</p>
      </footer>
    </div>
  );
}

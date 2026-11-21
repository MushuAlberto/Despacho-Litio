import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  ArrowLeft, Upload, X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertCircle, 
  Calendar, CheckCircle, Activity, ClipboardCheck, Target, Gauge,
  Download, Loader2, FileText
} from 'lucide-react';
import { 
  BarChart, Bar, Cell, LineChart, Line, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { toPng } from 'html-to-image';
import { NovandinoLogo } from '../BrandLogo';

interface CumplimientoRow {
  fecha: Date;
  dayLabel: string;
  sol: number;
  real: number;
  equipos: number;
  ton: number;
  prod: number;
  defDia: number;
  defAcumVueltas: number;
  defTonDia: number;
  defAcumTon: number;
}

interface CumplimientoMQProps {
  onBack: () => void;
}

const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTH_FULL_TO_ABBR: { [key: string]: string } = {
  enero: 'ene', febrero: 'feb', marzo: 'mar', abril: 'abr', mayo: 'may', junio: 'jun',
  julio: 'jul', agosto: 'ago', septiembre: 'sep', setiembre: 'sep', octubre: 'oct',
  noviembre: 'nov', diciembre: 'dic'
};

export const CumplimientoMQ: React.FC<CumplimientoMQProps> = ({ onBack }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [workbookSheets, setWorkbookSheets] = useState<{ [key: string]: CumplimientoRow[] }>({});
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [noteText, setNoteText] = useState<string>('');

  const stripAccents = (s: string) => {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const parseSheet = (ws: XLSX.WorkSheet): CumplimientoRow[] | null => {
    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
    let headerRow = -1;
    for (let i = 0; i < Math.min(aoa.length, 15); i++) {
      const cell = aoa[i] && aoa[i][0];
      if (cell && stripAccents(String(cell)).trim().toLowerCase() === 'fecha') {
        headerRow = i;
        break;
      }
    }
    if (headerRow === -1) return null;
    const rows: CumplimientoRow[] = [];
    
    for (let r = headerRow + 2; r < aoa.length; r++) {
      const row = aoa[r];
      // Skip undefined or non-array rows
      if (!row || !Array.isArray(row)) continue;

      // Skip rows where every single cell is null, undefined, or empty/whitespace
      const isEntirelyBlank = row.every(cell => cell === null || cell === undefined || String(cell).trim() === '');
      if (isEntirelyBlank) continue;

      const fechaVal = row[0];
      // Skip rows with missing or blank date
      if (fechaVal === null || fechaVal === undefined || String(fechaVal).trim() === '') continue;

      // Skip summary / total / average rows
      const fechaStr = stripAccents(String(fechaVal)).trim().toLowerCase();
      if (/^(total|totales|promedio|promedios|resumen|subtotal|suma)/i.test(fechaStr)) {
        continue;
      }

      let fecha: Date | null = null;
      if (fechaVal instanceof Date) {
        fecha = fechaVal;
      } else if (typeof fechaVal === 'number') {
        fecha = new Date((fechaVal - 25569) * 86400 * 1000);
      } else if (typeof fechaVal === 'string') {
        const parsed = new Date(fechaVal);
        if (!isNaN(parsed.getTime())) fecha = parsed;
      }

      // If invalid date, skip this row
      if (!fecha || isNaN(fecha.getTime())) continue;

      const solRaw = row[1];
      const realRaw = row[2];
      const equiposRaw = row[3];
      const tonRaw = row[4];
      const prodRaw = row[5];
      const defDiaRaw = row[6];
      const defAcumVueltasRaw = row[7];
      const defTonDiaRaw = row[8];
      const defAcumTonRaw = row[9];

      // Check if all data fields in the row are empty or blank
      const isSolEmpty = solRaw === null || solRaw === undefined || String(solRaw).trim() === '';
      const isRealEmpty = realRaw === null || realRaw === undefined || String(realRaw).trim() === '';
      const isTonEmpty = tonRaw === null || tonRaw === undefined || String(tonRaw).trim() === '';
      const isEquiposEmpty = equiposRaw === null || equiposRaw === undefined || String(equiposRaw).trim() === '';

      // Skip if completely empty metrics
      if (isSolEmpty && isRealEmpty && isTonEmpty && isEquiposEmpty) {
        continue;
      }

      // Skip unrecorded/unworked future days where both requested and real are blank
      if (isSolEmpty && isRealEmpty) {
        continue;
      }

      let sol = Number(solRaw) || 0;
      const real = Number(realRaw) || 0;
      const equipos = Number(equiposRaw) || 0;
      const ton = Number(tonRaw) || 0;
      const prod = Number(prodRaw) || 0;
      let defDia = Number(defDiaRaw) || 0;
      const defAcumVueltas = Number(defAcumVueltasRaw) || 0;
      const defTonDia = Number(defTonDiaRaw) || 0;
      const defAcumTon = Number(defAcumTonRaw) || 0;

      // If sol is missing or 0 but defDia exists, infer sol = real - defDia
      if (sol === 0 && defDia !== 0 && real > 0) {
        const inferred = real - defDia;
        if (inferred > 0) sol = inferred;
      }

      // If every numeric column is exactly 0 and no operations were recorded, treat as empty row
      if (sol === 0 && real === 0 && equipos === 0 && ton === 0 && prod === 0 && defDia === 0) {
        continue;
      }

      rows.push({
        fecha,
        dayLabel: String(fecha.getUTCDate()).padStart(2, '0') + '-' + MONTH_ABBR[fecha.getUTCMonth()],
        sol,
        real,
        equipos,
        ton,
        prod,
        defDia,
        defAcumVueltas,
        defTonDia,
        defAcumTon,
      });
    }

    // Forward and backward fill for sol (meta planificada) so dashed target line extends through all operational days
    let runningSol = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].sol > 0) {
        runningSol = rows[i].sol;
      } else if (runningSol > 0 && rows[i].real > 0) {
        rows[i].sol = runningSol;
        if (rows[i].defDia === 0) {
          rows[i].defDia = rows[i].real - rows[i].sol;
        }
      }
    }
    if (runningSol > 0) {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].sol === 0 && rows[i].real > 0) {
          rows[i].sol = runningSol;
          if (rows[i].defDia === 0) {
            rows[i].defDia = rows[i].real - rows[i].sol;
          }
        } else if (rows[i].sol > 0) {
          runningSol = rows[i].sol;
        }
      }
    }

    return rows;
  };

  const guessDefaultSheet = (sheetNames: string[], fileName: string): string => {
    const norm = stripAccents(fileName.toLowerCase());
    let abbrev: string | null = null;
    for (const full in MONTH_FULL_TO_ABBR) {
      if (norm.includes(full)) {
        abbrev = MONTH_FULL_TO_ABBR[full];
        break;
      }
    }
    const yearMatch = norm.match(/(20\d{2})/);
    const year2 = yearMatch ? yearMatch[1].slice(2) : null;

    if (abbrev) {
      const match = sheetNames.find(n => {
        const sn = stripAccents(n.toLowerCase());
        return sn.startsWith(abbrev!) && (!year2 || sn.includes(year2));
      });
      if (match) return match;
      const matchLoose = sheetNames.find(n => stripAccents(n.toLowerCase()).startsWith(abbrev!));
      if (matchLoose) return matchLoose;
    }
    
    return sheetNames[sheetNames.length - 1] || sheetNames[0];
  };

  const handleFileProcess = async (fileToProcess: File) => {
    const validExt = /\.xlsx?$/i.test(fileToProcess.name);
    if (!validExt) {
      setStatusMsg({ text: 'Formato no soportado. Sube un archivo .xlsx o .xls', isError: true });
      return;
    }
    try {
      const buf = await fileToProcess.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const parsedSheets: { [key: string]: CumplimientoRow[] } = {};
      
      wb.SheetNames.forEach(name => {
        const parsed = parseSheet(wb.Sheets[name]);
        if (parsed !== null && parsed.length > 0) {
          parsedSheets[name] = parsed;
        }
      });

      const validSheets = Object.keys(parsedSheets);
      if (validSheets.length === 0) {
        setStatusMsg({ text: 'No se encontró ninguna hoja con formato reconocible (columna "Fecha"). Revisa el archivo.', isError: true });
        return;
      }

      setWorkbookSheets(parsedSheets);
      setFile(fileToProcess);
      
      const defaultSheet = guessDefaultSheet(validSheets, fileToProcess.name);
      setSelectedSheet(defaultSheet);
      setStatusMsg({ text: `Archivo cargado con éxito. Se detectaron ${validSheets.length} hojas operacionales.`, isError: false });
    } catch (err) {
      console.error(err);
      setStatusMsg({ text: 'No se pudo leer el archivo. Verifica que sea un Excel válido con formato M&Q.', isError: true });
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const resetState = () => {
    setFile(null);
    setWorkbookSheets({});
    setSelectedSheet('');
    setStatusMsg(null);
  };

  // Active data calculation
  const currentData = useMemo(() => {
    if (!selectedSheet || !workbookSheets[selectedSheet]) return [];
    return workbookSheets[selectedSheet];
  }, [selectedSheet, workbookSheets]);

  // KPIs calculations
  const kpis = useMemo(() => {
    if (currentData.length === 0) return null;
    // Filter to get only days that have actually been operated (real > 0 or tonnage > 0)
    const operatedDays = currentData.filter(r => r.real > 0 || r.ton > 0);
    const lastOperated = operatedDays.length > 0 ? operatedDays[operatedDays.length - 1] : currentData[currentData.length - 1];

    const totalSol = operatedDays.reduce((a, r) => a + r.sol, 0);
    const totalReal = operatedDays.reduce((a, r) => a + r.real, 0);
    const cumplPct = totalSol > 0 ? (totalReal / totalSol * 100) : 0;
    const deficitVueltas = lastOperated.defAcumVueltas;
    const deficitTon = lastOperated.defAcumTon;
    const avgProd = operatedDays.length > 0 ? (operatedDays.reduce((a, r) => a + r.prod, 0) / operatedDays.length) : 0;
    
    // Last 3 days trend
    const last3 = operatedDays.slice(-3);
    const last3Sum = last3.reduce((a, r) => a + r.defDia, 0);

    return {
      cumplPct,
      totalReal,
      totalSol,
      deficitVueltas,
      deficitTon,
      avgProd,
      last3Sum,
      trendUp: last3Sum >= 0
    };
  }, [currentData]);

  // Critical Days (Anomalies)
  const criticalDays = useMemo(() => {
    if (currentData.length === 0) return [];
    return [...currentData]
      .sort((a, b) => a.defDia - b.defDia)
      .slice(0, 3);
  }, [currentData]);

  // Date of the last data row in the Excel sheet
  const lastDateStr = useMemo(() => {
    if (currentData.length === 0) return '';
    const lastRow = currentData[currentData.length - 1];
    if (!lastRow || !lastRow.fecha) return '';
    const d = lastRow.fecha;
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }, [currentData]);

  const [downloadingPng, setDownloadingPng] = useState(false);

  const handleDownloadPNG = async () => {
    const element = document.getElementById('cumplimiento-mq-dashboard-capture');
    if (!element) return;
    setDownloadingPng(true);
    try {
      await new Promise(r => setTimeout(r, 120));

      const width = Math.max(element.scrollWidth, 1200) + 48;
      const height = element.scrollHeight + 48;

      const dataUrl = await toPng(element, {
        width: width,
        height: height,
        backgroundColor: '#FAF8F5',
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement && node.getAttribute('data-ignore-capture') === 'true') {
            return false;
          }
          return true;
        },
        style: {
          borderRadius: '0px',
          padding: '24px',
          margin: '0px',
          height: 'auto',
          maxHeight: 'none',
          overflow: 'visible'
        }
      });

      const link = document.createElement('a');
      const sheetTag = selectedSheet ? `_${selectedSheet.replace(/\s+/g, '_')}` : '';
      const dateTag = lastDateStr ? `_${lastDateStr}` : '';
      link.download = `Cumplimiento_MQ_SLIT${sheetTag}${dateTag}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Audit log to Firebase if available
      try {
        const { getCurrentUser } = await import('../../auth/authStore');
        const user = getCurrentUser();
        if (user) {
          const { logActivity } = await import('../../services/firebase');
          logActivity(
            user,
            'Descargó PNG',
            `Descargó reporte completo de Cumplimiento M&Q SLIT (${selectedSheet || ''}) en formato PNG.`
          );
        }
      } catch (logErr) {
        console.error('Error logging PNG download:', logErr);
      }
    } catch (error) {
      console.error('Error generating PNG:', error);
      setStatusMsg({ text: 'No se pudo generar la imagen PNG. Intenta nuevamente.', isError: true });
    } finally {
      setDownloadingPng(false);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED] font-sans text-slate-800 overflow-hidden relative">
      
      {/* PESTAÑA PARA MOSTRAR / OCULTAR */}
      <button
        type="button"
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className={`fixed top-20 z-50 bg-gradient-to-b from-[#461D77] to-[#311042] text-white hover:opacity-95 border border-l-0 border-white/20 rounded-r-xl p-2.5 flex items-center justify-center transition-all duration-150 ease-out cursor-pointer no-print shadow-lg ${
          isSidebarCollapsed ? 'left-0' : 'left-[288px]'
        }`}
        aria-label={isSidebarCollapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
      >
        {isSidebarCollapsed ? (
          <ChevronRight size={18} />
        ) : (
          <ChevronLeft size={18} />
        )}
      </button>

      {/* SIDEBAR FOR ACTIONS */}
      <aside className={`bg-white/95 backdrop-blur-md border-r border-slate-200/80 shadow-lg flex flex-col no-print shrink-0 relative transition-all duration-150 ease-out ${
        isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden border-r-0' : 'w-[288px] opacity-100'
      }`}>
        <div className="p-5 overflow-y-auto flex-1 divide-y divide-slate-200/80 space-y-5">
          <div className="pb-4">
            <button 
              onClick={onBack} 
              className="flex items-center gap-2 text-[#461D77] hover:text-[#311042] font-bold text-xs uppercase tracking-wider transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft size={14} /> Volver a Módulo PQL
            </button>
          </div>

          <div className="pb-5 space-y-2">
            <div className="flex items-center gap-2 text-[#461D77]">
              <ClipboardCheck size={16} />
              <span className="font-black text-[11px] tracking-wider uppercase">Cumplimiento PQL</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Monitoreo de cumplimiento de metas de despacho M&Q, toneladas y rendimiento mensual de flota.
            </p>
          </div>

          {/* EXPORT ACTIONS */}
          <div className="pb-5 space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Exportación</p>
            <button
              type="button"
              onClick={handleDownloadPNG}
              disabled={!file || currentData.length === 0 || downloadingPng}
              className="w-full bg-gradient-to-r from-[#461D77] to-[#7177EC] hover:opacity-95 text-white disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed font-bold text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer shadow-md shadow-[#461D77]/20"
            >
              {downloadingPng ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Generando PNG...</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>Descargar Imagen PNG</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-500 leading-snug">
              Incluye encabezado Novandino, KPIs, gráficos y tabla operativa.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Configuración</p>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Mes / Hoja Operativa</label>
              <select 
                value={selectedSheet} 
                onChange={(e) => setSelectedSheet(e.target.value)}
                disabled={Object.keys(workbookSheets).length === 0}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#461D77] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {Object.keys(workbookSheets).length === 0 ? (
                  <option>— Sin datos —</option>
                ) : (
                  Object.keys(workbookSheets).map(sheetName => (
                    <option key={sheetName} value={sheetName}>{sheetName}</option>
                  ))
                )}
              </select>
            </div>

            {file && (
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono font-medium bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-xl truncate max-w-[190px]">
                  {file.name}
                </span>
                <button 
                  onClick={resetState}
                  className="p-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors duration-150 cursor-pointer"
                  title="Remover Archivo"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN PANEL */}
      <main className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED] overflow-y-auto">
        
        {/* HEADER BAR */}
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-8 py-4 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.08em]">
              <span className="font-bold text-slate-500">
                PQL &middot; Planta Química Litio
              </span>
              {selectedSheet && (
                <>
                  <span className="text-slate-300">&middot;</span>
                  <span className="font-bold text-[#461D77]">
                    Período {selectedSheet}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase mt-1">
              Cumplimiento M&Q &middot; Operación SLIT
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
            <Calendar size={14} className="text-[#461D77]" />
            <span className="font-mono tabular-nums text-xs font-bold text-slate-800">
              {new Date().toLocaleDateString('es-CL')}
            </span>
          </div>
        </header>

        {/* CONTENT */}
        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
          
          {/* UPLOAD ZONE (If no file is uploaded) */}
          {!file && (
            <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-150 shadow-xl shadow-slate-200/40 ${
                dragActive 
                  ? 'border-[#461D77] bg-[#461D77]/5' 
                  : 'border-slate-300 bg-white/90 backdrop-blur-md hover:border-[#7177EC]'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#461D77]/10 border border-[#461D77]/20 flex items-center justify-center mx-auto mb-4">
                <Upload size={24} className="text-[#461D77]" />
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase mb-1.5">
                Carga tu Archivo M&Q Mensual
              </h2>
              <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed mb-6">
                Arrastra o selecciona la planilla de cumplimiento (.xlsx). Cada hoja mensual se procesará automáticamente.
              </p>
              <input 
                type="file" 
                id="pqlFileInput" 
                accept=".xlsx,.xls" 
                onChange={handleFileChange} 
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => document.getElementById('pqlFileInput')?.click()}
                className="bg-gradient-to-r from-[#461D77] to-[#7177EC] hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all duration-150 shadow-md shadow-[#461D77]/20 cursor-pointer"
              >
                Seleccionar Archivo
              </button>
            </div>
          )}

          {/* Status Message */}
          {statusMsg && (
            <div className={`px-4 py-3 rounded-2xl border flex items-center gap-3 text-xs shadow-sm ${
              statusMsg.isError 
                ? 'bg-amber-50 border-amber-200 text-amber-800' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <AlertCircle size={16} className="shrink-0" />
              <span className="font-bold">{statusMsg.text}</span>
            </div>
          )}

          {/* DASHBOARD CONTENT (Active only if data exists) */}
          {file && currentData.length > 0 && kpis && (
            <div id="cumplimiento-mq-dashboard-capture" className="space-y-6 p-1">
              
              {/* ENCABEZADO INTEGRADO: LOGO NOVANDINO, FECHA Y OPERACIÓN */}
              <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 px-6 py-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div className="flex items-center">
                    <NovandinoLogo className="h-16 md:h-20 w-auto" variant="medium" />
                  </div>
                  <div className="bg-gradient-to-br from-[#461D77] to-[#311042] text-white px-5 py-2.5 rounded-2xl border border-white/15 text-right flex flex-col items-end shadow-lg shadow-[#461D77]/20">
                    <p className="text-[10px] font-mono font-bold text-[#4FD1C5] tracking-[0.12em] uppercase">
                      Fecha Jornada
                    </p>
                    <p className="text-base font-black text-white font-mono tabular-nums mt-0.5">
                      {lastDateStr || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-2xl flex items-center justify-center h-14 w-24 shrink-0 overflow-hidden">
                    <img 
                      src="/mq.png" 
                      alt="Logo M&Q" 
                      className="max-h-full max-w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2.5">
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">
                      Cumplimiento M&Q
                    </h2>
                    <span className="hidden sm:inline-block text-slate-300">&middot;</span>
                    <span className="text-xs font-bold text-[#461D77] uppercase tracking-wider">
                      Operación SLIT
                    </span>
                  </div>
                </div>
              </div>

              {/* KPI GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* CUMPLIMIENTO DEL MES */}
                <div className="p-5 flex flex-col justify-between bg-gradient-to-br from-[#461D77] to-[#311042] text-white rounded-3xl border border-white/15 shadow-xl shadow-[#461D77]/20">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-violet-200 uppercase tracking-wider">
                      <Target className="w-3.5 h-3.5 text-[#4FD1C5]" />
                      Cumplimiento Mes
                    </span>
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      kpis.cumplPct >= 95 
                        ? 'bg-emerald-400/20 text-[#4FD1C5]' 
                        : 'bg-amber-400/20 text-amber-300'
                    }`}>
                      {kpis.cumplPct >= 100 ? 'Meta Superada' : kpis.cumplPct >= 90 ? 'En Rango' : 'Bajo Meta'}
                    </span>
                  </div>
                  <h3 className="text-3xl font-black text-white font-mono tabular-nums tracking-tight mt-3">
                    {kpis.cumplPct.toFixed(1)}<span className="text-violet-200 text-sm font-semibold ml-0.5">%</span>
                  </h3>
                  <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-violet-100">{kpis.totalReal} / {kpis.totalSol} vueltas</span>
                    <span className="text-[10px] font-sans font-bold text-violet-200 uppercase">Realizadas</span>
                  </div>
                </div>

                {/* DÉFICIT ACUMULADO */}
                <div className="p-5 flex flex-col justify-between bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {kpis.deficitVueltas >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      Déficit Acumulado
                    </span>
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      kpis.deficitVueltas >= 0 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {kpis.deficitVueltas >= 0 ? 'Superávit' : 'Déficit'}
                    </span>
                  </div>
                  <h3 className={`text-3xl font-black font-mono tabular-nums tracking-tight mt-3 ${
                    kpis.deficitVueltas >= 0 ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {kpis.deficitVueltas > 0 ? `+${kpis.deficitVueltas}` : kpis.deficitVueltas}
                    <span className="text-slate-400 text-xs font-sans font-bold uppercase ml-1.5">vueltas</span>
                  </h3>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className={`font-bold ${kpis.deficitVueltas >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {Math.round(kpis.deficitTon).toLocaleString('es-CL')} ton
                    </span>
                    <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">vs. Plan</span>
                  </div>
                </div>

                {/* PRODUCTIVIDAD PROMEDIO */}
                <div className="p-5 flex flex-col justify-between bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <Gauge className="w-3.5 h-3.5 text-[#461D77]" />
                      Productividad
                    </span>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      Rendimiento
                    </span>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 font-mono tabular-nums tracking-tight mt-3">
                    {kpis.avgProd.toFixed(2)}
                    <span className="text-slate-400 text-xs font-sans font-bold uppercase ml-1.5">ton/vuelta</span>
                  </h3>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600">Promedio mensual</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Días activos</span>
                  </div>
                </div>

                {/* TENDENCIA ÚLTIMOS 3 DÍAS */}
                <div className="p-5 flex flex-col justify-between bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <Activity className="w-3.5 h-3.5 text-[#461D77]" />
                      Tendencia 3 Días
                    </span>
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      kpis.last3Sum >= 0 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'bg-rose-50 text-rose-700'
                    }`}>
                      {kpis.last3Sum >= 0 ? 'Positiva' : 'Crítica'}
                    </span>
                  </div>
                  <h3 className={`text-3xl font-black font-mono tabular-nums tracking-tight mt-3 ${
                    kpis.last3Sum >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {kpis.last3Sum > 0 ? `+${kpis.last3Sum}` : kpis.last3Sum}
                    <span className="text-slate-400 text-xs font-sans font-bold uppercase ml-1.5">vueltas</span>
                  </h3>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className={`font-bold ${kpis.last3Sum >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {kpis.last3Sum >= 0 ? 'Revirtiendo déficit' : 'Profundizando déficit'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">3 Días</span>
                  </div>
                </div>
              </div>

              {/* ROUTE CHART */}
              <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-200">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Cumplimiento Diario</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Vueltas Reales vs. Meta Diaria</p>
                  </div>
                  <div className="flex items-center gap-5 text-xs font-bold text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#461D77]" />
                      <span className="text-slate-800">Cumple Meta</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#B45309]" />
                      <span className="text-slate-800">Déficit</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="dayLabel" 
                        stroke="#64748b" 
                        fontSize={10} 
                        fontWeight="600" 
                        tickLine={false} 
                      />
                      <YAxis stroke="#64748b" fontSize={10} fontWeight="600" tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} 
                        labelStyle={{ fontWeight: '700', fontSize: '11px', color: '#461D77' }}
                      />
                      <Bar 
                        dataKey="real" 
                        name="Vueltas Reales" 
                        radius={[6, 6, 0, 0]}
                        maxBarSize={28}
                      >
                        {currentData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.defDia >= 0 ? '#461D77' : '#B45309'} 
                          />
                        ))}
                      </Bar>
                      <Line 
                        type="monotone" 
                        dataKey="sol" 
                        name="Meta Planificada" 
                        stroke="#7177EC" 
                        strokeWidth={2} 
                        strokeDasharray="5 5" 
                        dot={false}
                        connectNulls={true}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* TWO COLUMNS CHARTS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cumulative Deficit Chart */}
                <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 p-6">
                  <div className="pb-4 mb-5 border-b border-slate-200">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Déficit Acumulado del Mes</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Brecha acumulada en toneladas</p>
                  </div>
                  
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="pqlGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#461D77" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#461D77" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dayLabel" stroke="#64748b" fontSize={10} fontWeight="600" tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} fontWeight="600" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                        <Area 
                          type="monotone" 
                          dataKey="defAcumTon" 
                          name="Déficit Acum. (Ton)" 
                          stroke="#461D77" 
                          fillOpacity={1} 
                          fill="url(#pqlGrad)" 
                          strokeWidth={2.5}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Productivity Chart */}
                <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 p-6">
                  <div className="pb-4 mb-5 border-b border-slate-200">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Productividad Diaria</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Rendimiento promedio de toneladas por vuelta</p>
                  </div>
                  
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dayLabel" stroke="#64748b" fontSize={10} fontWeight="600" tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} fontWeight="600" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                        <Line 
                          type="monotone" 
                          dataKey="prod" 
                          name="Ton/Vuelta" 
                          stroke="#10b981" 
                          strokeWidth={2.5}
                          dot={{ r: 3.5, fill: '#10b981', strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ANOMALIES/CRITICAL DAYS */}
              {criticalDays.length > 0 && (
                <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 p-6">
                  <div className="pb-4 mb-4 border-b border-slate-200">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Días Críticos del Mes</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Jornadas con mayor caída respecto a la meta planificada</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {criticalDays.map((day, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-2xl">
                        <span className="text-sm font-mono font-bold text-slate-800 uppercase">{day.dayLabel}</span>
                        <span className="text-lg font-mono tabular-nums font-black text-amber-600">{day.defDia} vueltas</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DAILY DETAILS TABLE */}
              <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 p-6 overflow-hidden">
                <div className="pb-4 mb-4 border-b border-slate-200">
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Detalle Diario de Operación</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Registro unificado del cumplimiento M&Q SLIT</p>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <table className="min-w-full text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <th className="px-4 py-3 text-left font-bold tracking-wider uppercase font-sans text-[11px]">Fecha</th>
                        <th className="px-4 py-3 text-right font-bold tracking-wider uppercase font-sans text-[11px]">Solicitadas</th>
                        <th className="px-4 py-3 text-right font-bold tracking-wider uppercase font-sans text-[11px]">Real</th>
                        <th className="px-4 py-3 text-right font-bold tracking-wider uppercase font-sans text-[11px]">N° Equipos</th>
                        <th className="px-4 py-3 text-right font-bold tracking-wider uppercase font-sans text-[11px]">Tonelaje</th>
                        <th className="px-4 py-3 text-right font-bold tracking-wider uppercase font-sans text-[11px]">Productividad</th>
                        <th className="px-4 py-3 text-right font-bold tracking-wider uppercase font-sans text-[11px]">Déficit Día</th>
                        <th className="px-4 py-3 text-right font-bold tracking-wider uppercase font-sans text-[11px]">Déficit Acum.</th>
                        <th className="px-4 py-3 text-right font-bold tracking-wider uppercase font-sans text-[11px]">Déficit Ton</th>
                        <th className="px-4 py-3 text-right font-bold tracking-wider uppercase font-sans text-[11px]">Acum. Ton</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {currentData.map((row, idx) => (
                        <tr 
                          key={idx} 
                          className="hover:bg-slate-50/80 transition-colors duration-150"
                        >
                          <td className="px-4 py-2.5 text-left font-bold text-[#461D77]">{row.dayLabel}</td>
                          <td className="px-4 py-2.5 text-right text-slate-800">{row.sol}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{row.real}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500">{row.equipos}</td>
                          <td className="px-4 py-2.5 text-right text-slate-800">{row.ton.toLocaleString('es-CL')}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500">{row.prod.toFixed(2)}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${row.defDia < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{row.defDia}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${row.defAcumVueltas < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{row.defAcumVueltas}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${row.defTonDia < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{Math.round(row.defTonDia).toLocaleString('es-CL')}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${row.defAcumTon < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{Math.round(row.defAcumTon).toLocaleString('es-CL')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* CUADRO DE NOTAS / OBSERVACIONES OPERATIVAS */}
                <div data-ignore-capture="true" className="mt-5 pt-5 border-t border-slate-200">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-[#461D77]" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Notas y Observaciones de la Jornada</span>
                    </div>
                    {noteText.trim().length > 0 ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle size={12} /> Incluido en exportación PNG
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        Opcional (se omite en PNG si está vacío)
                      </span>
                    )}
                  </div>
                  
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Escribe aquí notas, justificaciones de desvíos, condiciones climáticas o comentarios operacionales (opcional)..."
                    rows={3}
                    className="w-full text-xs text-slate-800 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#461D77] rounded-2xl p-3.5 outline-none transition-colors duration-150 resize-y placeholder:text-slate-400"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                    <span>Si no ingresas texto, el reporte PNG omitirá este bloque.</span>
                    {noteText.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => setNoteText('')}
                        className="text-slate-500 hover:text-rose-600 font-semibold transition-colors duration-150 cursor-pointer"
                      >
                        Limpiar nota
                      </button>
                    )}
                  </div>
                </div>

                {/* TARJETA FORMATEADA DE NOTAS */}
                {noteText.trim().length > 0 && (
                  <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#461D77] mb-1.5 flex items-center gap-1.5">
                      <FileText size={13} className="text-[#461D77]" /> Notas y Observaciones Operativas
                    </p>
                    <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {noteText.trim()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

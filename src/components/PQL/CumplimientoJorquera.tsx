import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  ArrowLeft, Upload, X, AlertCircle, ChevronLeft, ChevronRight,
  Calendar, ClipboardCheck, Target, TrendingUp, TrendingDown, Gauge, Activity,
  Download, Loader2, FileText, CheckCircle
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

interface CumplimientoJorqueraProps {
  onBack: () => void;
}

const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTH_FULL_TO_ABBR: { [key: string]: string } = {
  enero: 'ene', febrero: 'feb', marzo: 'mar', abril: 'abr', mayo: 'may', junio: 'jun',
  julio: 'jul', agosto: 'ago', septiembre: 'sep', setiembre: 'sep', octubre: 'oct',
  noviembre: 'nov', diciembre: 'dic'
};

export const CumplimientoJorquera: React.FC<CumplimientoJorqueraProps> = ({ onBack }) => {
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
      setStatusMsg({ text: 'No se pudo leer el archivo. Verifica que sea un Excel válido con formato Jorquera.', isError: true });
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
    const element = document.getElementById('cumplimiento-jorquera-dashboard-capture');
    if (!element) return;
    setDownloadingPng(true);
    try {
      await new Promise(r => setTimeout(r, 120));

      const width = Math.max(element.scrollWidth, 1200) + 48;
      const height = element.scrollHeight + 48;

      const dataUrl = await toPng(element, {
        width: width,
        height: height,
        backgroundColor: '#ECEAE3',
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
      link.download = `Cumplimiento_Jorquera_SLIT${sheetTag}${dateTag}.png`;
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
            `Descargó reporte completo de Cumplimiento Jorquera SLIT (${selectedSheet || ''}) en formato PNG.`
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
    <div className="flex h-screen bg-[#ECEAE3] font-sans text-[#181615] overflow-hidden relative">
      
      {/* PESTAÑA PARA MOSTRAR / OCULTAR */}
      <button
        type="button"
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className={`fixed top-20 z-50 bg-[#461D77] text-white hover:bg-[#36155E] border border-l-0 border-[#461D77] rounded-r-md p-2.5 flex items-center justify-center transition-all duration-150 ease-out cursor-pointer no-print shadow-[2px_2px_8px_rgba(24,22,21,0.16)] ${
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
      <aside className={`bg-[#E5E2D9] border-r border-[#D5D0C5] flex flex-col no-print shrink-0 relative transition-all duration-150 ease-out ${
        isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden border-r-0' : 'w-[288px] opacity-100'
      }`}>
        <div className="p-5 overflow-y-auto flex-1 divide-y divide-[#D5D0C5] space-y-5">
          <div className="pb-4">
            <button 
              onClick={onBack} 
              className="flex items-center gap-2 text-[#461D77] hover:text-[#36155E] font-semibold text-xs uppercase tracking-wider transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft size={14} /> Volver a Módulo PQL
            </button>
          </div>

          <div className="pb-5 space-y-2">
            <div className="flex items-center gap-2 text-[#461D77]">
              <ClipboardCheck size={16} />
              <span className="font-bold text-[11px] tracking-wider uppercase">Cumplimiento Jorquera</span>
            </div>
            <p className="text-xs text-[#57534E] leading-relaxed">
              Monitoreo de cumplimiento de metas de despacho Jorquera, toneladas y rendimiento mensual de flota.
            </p>
          </div>

          {/* EXPORT ACTIONS */}
          <div className="pb-5 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">Exportación</p>
            <button
              type="button"
              onClick={handleDownloadPNG}
              disabled={!file || currentData.length === 0 || downloadingPng}
              className="w-full bg-[#461D77] hover:bg-[#36155E] text-white disabled:bg-[#D5D0C5] disabled:text-[#78716C] disabled:cursor-not-allowed font-semibold text-xs uppercase tracking-wider py-2.5 px-4 rounded-md flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer shadow-[0_1px_2px_rgba(24,22,21,0.12)]"
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
            <p className="text-[11px] text-[#78716C] leading-snug">
              Incluye encabezado Novandino, KPIs, gráficos y tabla operativa.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">Configuración</p>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider block">Mes / Hoja Operativa</label>
              <select 
                value={selectedSheet} 
                onChange={(e) => setSelectedSheet(e.target.value)}
                disabled={Object.keys(workbookSheets).length === 0}
                className="w-full bg-white border border-[#D8D4CA] rounded-md px-3 py-2 text-xs font-semibold text-[#181615] outline-none focus:border-[#461D77] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="pt-3 border-t border-[#D5D0C5] flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono font-medium bg-white text-[#181615] border border-[#D8D4CA] px-2.5 py-1 rounded-md truncate max-w-[190px]">
                  {file.name}
                </span>
                <button 
                  onClick={resetState}
                  className="p-1.5 rounded-md text-[#78716C] hover:text-[#B91C1C] hover:bg-white border border-transparent hover:border-[#D8D4CA] transition-colors duration-150 cursor-pointer"
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
      <main className="flex-1 flex flex-col min-w-0 bg-[#ECEAE3] overflow-y-auto">
        
        {/* HEADER BAR */}
        <header className="bg-white border-b border-[#D8D4CA] px-8 py-4 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-[0_1px_3px_rgba(24,22,21,0.06),0_4px_12px_-4px_rgba(24,22,21,0.05)]">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.08em]">
              <span className="font-bold text-[#57534E]">
                PQL &middot; Planta Química Litio
              </span>
              {selectedSheet && (
                <>
                  <span className="text-[#D8D4CA]">&middot;</span>
                  <span className="font-bold text-[#461D77]">
                    Período {selectedSheet}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl font-bold text-[#181615] tracking-[-0.02em] uppercase mt-1">
              Cumplimiento Jorquera &middot; Operación SLIT
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#57534E]">
            <Calendar size={14} className="text-[#461D77]" />
            <span className="font-mono tabular-nums text-xs font-semibold text-[#181615]">
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
              className={`border border-dashed rounded-lg p-12 text-center transition-colors duration-150 shadow-[0_1px_2px_rgba(24,22,21,0.04)] ${
                dragActive 
                  ? 'border-[#461D77] bg-[#F3EEF8]' 
                  : 'border-[#C8C3B6] bg-white hover:border-[#461D77]/60'
              }`}
            >
              <div className="w-12 h-12 rounded-lg surface-well flex items-center justify-center mx-auto mb-4">
                <Upload size={22} className="text-[#461D77]" />
              </div>
              <h2 className="text-lg font-bold text-[#181615] tracking-[-0.02em] uppercase mb-1.5">
                Carga tu Archivo Jorquera Mensual
              </h2>
              <p className="text-[#57534E] text-xs max-w-md mx-auto leading-relaxed mb-6">
                Arrastra o selecciona la planilla de cumplimiento (.xlsx). Cada hoja mensual se procesará automáticamente.
              </p>
              <input 
                type="file" 
                id="jorqueraFileInput" 
                accept=".xlsx,.xls" 
                onChange={handleFileChange} 
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => document.getElementById('jorqueraFileInput')?.click()}
                className="bg-[#461D77] hover:bg-[#36155E] text-white font-semibold text-xs uppercase tracking-wider px-6 py-2.5 rounded-md transition-colors duration-150 cursor-pointer"
              >
                Seleccionar Archivo
              </button>
            </div>
          )}

          {/* Status Message */}
          {statusMsg && (
            <div className={`px-4 py-3 rounded-lg border flex items-center gap-3 text-xs ${
              statusMsg.isError 
                ? 'bg-[#FEF3C7] border-[#B45309]/30 text-[#B45309]' 
                : 'bg-[#ECFDF5] border-[#15803D]/30 text-[#15803D]'
            }`}>
              <AlertCircle size={16} className="shrink-0" />
              <span className="font-semibold">{statusMsg.text}</span>
            </div>
          )}

          {/* DASHBOARD CONTENT (Active only if data exists) */}
          {file && currentData.length > 0 && kpis && (
            <div id="cumplimiento-jorquera-dashboard-capture" className="space-y-6 p-1">
              
              {/* ENCABEZADO INTEGRADO: LOGO NOVANDINO, FECHA Y OPERACIÓN */}
              <div className="surface-card border-t-2 border-t-[#461D77] px-6 py-5 rounded-lg flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#D8D4CA]">
                  <div className="flex items-center">
                    <NovandinoLogo className="h-16 md:h-20 w-auto" variant="medium" />
                  </div>
                  <div className="bg-[#181615] text-[#F7F6F2] px-4 py-2 rounded-md border border-[#2C2826] text-right flex flex-col items-end shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <p className="text-[10px] font-mono font-semibold text-[#A8A29E] tracking-[0.12em] uppercase">
                      Fecha Jornada
                    </p>
                    <p className="text-base font-bold text-white font-mono tabular-nums mt-0.5">
                      {lastDateStr || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="surface-well p-2 rounded-md flex items-center justify-center h-14 w-28 shrink-0 overflow-hidden">
                    <img 
                      src="/jorquera.png" 
                      alt="Logo Jorquera" 
                      className="max-h-full max-w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2.5">
                    <h2 className="text-lg font-bold text-[#181615] tracking-[-0.02em]">
                      Cumplimiento Jorquera
                    </h2>
                    <span className="hidden sm:inline-block text-[#D8D4CA]">&middot;</span>
                    <span className="text-xs font-semibold text-[#461D77] uppercase tracking-wider">
                      Operación SLIT
                    </span>
                  </div>
                </div>
              </div>

              {/* KPI HAIRLINE GRID */}
              <div className="surface-card rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#D8D4CA] overflow-hidden">
                {/* CUMPLIMIENTO DEL MES — High-contrast dark carbon anchor */}
                <div className={`p-5 flex flex-col justify-between bg-[#181615] text-[#F7F6F2] border-t-2 ${
                  kpis.cumplPct >= 90 ? 'border-t-[#461D77]' : 'border-t-[#B45309]'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#A8A29E] uppercase tracking-wider">
                      <Target className="w-3.5 h-3.5 text-[#A78BFA]" />
                      Cumplimiento Mes
                    </span>
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      kpis.cumplPct >= 95 
                        ? 'text-[#4ADE80]' 
                        : 'text-[#FBBF24]'
                    }`}>
                      {kpis.cumplPct >= 100 ? 'Meta Superada' : kpis.cumplPct >= 90 ? 'En Rango' : 'Bajo Meta'}
                    </span>
                  </div>
                  <h3 className="text-3xl font-bold text-white font-mono tabular-nums tracking-[-0.02em] mt-3">
                    {kpis.cumplPct.toFixed(1)}<span className="text-[#A8A29E] text-sm font-semibold ml-0.5">%</span>
                  </h3>
                  <div className="mt-3 pt-3 border-t border-[#2C2826] flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-[#D6D3D1]">{kpis.totalReal} / {kpis.totalSol} vueltas</span>
                    <span className="text-[10px] font-sans font-semibold text-[#78716C] uppercase">Realizadas</span>
                  </div>
                </div>

                {/* DÉFICIT ACUMULADO */}
                <div className="p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#57534E] uppercase tracking-wider">
                      {kpis.deficitVueltas >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-[#15803D]" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-[#B45309]" />
                      )}
                      Déficit Acumulado
                    </span>
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      kpis.deficitVueltas >= 0 
                        ? 'text-[#15803D]' 
                        : 'text-[#B45309]'
                    }`}>
                      {kpis.deficitVueltas >= 0 ? 'Superávit' : 'Déficit'}
                    </span>
                  </div>
                  <h3 className={`text-3xl font-bold font-mono tabular-nums tracking-[-0.02em] mt-3 ${
                    kpis.deficitVueltas >= 0 ? 'text-[#15803D]' : 'text-[#B45309]'
                  }`}>
                    {kpis.deficitVueltas > 0 ? `+${kpis.deficitVueltas}` : kpis.deficitVueltas}
                    <span className="text-[#78716C] text-xs font-sans font-semibold uppercase ml-1.5">vueltas</span>
                  </h3>
                  <div className="mt-3 pt-3 border-t border-[#E5E2D9] flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className={`font-semibold ${kpis.deficitVueltas >= 0 ? 'text-[#15803D]' : 'text-[#B45309]'}`}>
                      {Math.round(kpis.deficitTon).toLocaleString('es-CL')} ton
                    </span>
                    <span className="text-[10px] font-sans font-semibold text-[#78716C] uppercase">vs. Plan</span>
                  </div>
                </div>

                {/* PRODUCTIVIDAD PROMEDIO */}
                <div className="p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#57534E] uppercase tracking-wider">
                      <Gauge className="w-3.5 h-3.5 text-[#461D77]" />
                      Productividad
                    </span>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#57534E]">
                      Rendimiento
                    </span>
                  </div>
                  <h3 className="text-3xl font-bold text-[#181615] font-mono tabular-nums tracking-[-0.02em] mt-3">
                    {kpis.avgProd.toFixed(2)}
                    <span className="text-[#78716C] text-xs font-sans font-semibold uppercase ml-1.5">ton/vuelta</span>
                  </h3>
                  <div className="mt-3 pt-3 border-t border-[#E5E2D9] flex items-center justify-between text-xs">
                    <span className="text-[#57534E]">Promedio mensual</span>
                    <span className="text-[10px] font-semibold text-[#78716C] uppercase">Días activos</span>
                  </div>
                </div>

                {/* TENDENCIA ÚLTIMOS 3 DÍAS */}
                <div className="p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#57534E] uppercase tracking-wider">
                      <Activity className="w-3.5 h-3.5 text-[#461D77]" />
                      Tendencia 3 Días
                    </span>
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      kpis.last3Sum >= 0 
                        ? 'text-[#15803D]' 
                        : 'text-[#B91C1C]'
                    }`}>
                      {kpis.last3Sum >= 0 ? 'Positiva' : 'Crítica'}
                    </span>
                  </div>
                  <h3 className={`text-3xl font-bold font-mono tabular-nums tracking-[-0.02em] mt-3 ${
                    kpis.last3Sum >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                  }`}>
                    {kpis.last3Sum > 0 ? `+${kpis.last3Sum}` : kpis.last3Sum}
                    <span className="text-[#78716C] text-xs font-sans font-semibold uppercase ml-1.5">vueltas</span>
                  </h3>
                  <div className="mt-3 pt-3 border-t border-[#E5E2D9] flex items-center justify-between text-xs">
                    <span className={`font-semibold ${kpis.last3Sum >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>
                      {kpis.last3Sum >= 0 ? 'Revirtiendo déficit' : 'Profundizando déficit'}
                    </span>
                    <span className="text-[10px] font-semibold text-[#78716C] uppercase">3 Días</span>
                  </div>
                </div>
              </div>

              {/* ROUTE CHART */}
              <div className="surface-card p-6 rounded-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-5 border-b border-[#D8D4CA]">
                  <div>
                    <h2 className="text-sm font-bold text-[#181615] uppercase tracking-wider">Cumplimiento Diario</h2>
                    <p className="text-xs text-[#78716C] mt-0.5">Vueltas Reales vs. Meta Diaria</p>
                  </div>
                  <div className="flex items-center gap-5 text-xs font-semibold text-[#57534E]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#461D77]" />
                      <span className="text-[#181615]">Cumple Meta</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#B45309]" />
                      <span className="text-[#181615]">Déficit</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE7DF" />
                      <XAxis 
                        dataKey="dayLabel" 
                        stroke="#78716C" 
                        fontSize={10} 
                        fontWeight="600" 
                        tickLine={false} 
                      />
                      <YAxis stroke="#78716C" fontSize={10} fontWeight="600" tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #D8D4CA', fontSize: '12px' }} 
                        labelStyle={{ fontWeight: '700', fontSize: '11px', color: '#461D77' }}
                      />
                      <Bar 
                        dataKey="real" 
                        name="Vueltas Reales" 
                        radius={[3, 3, 0, 0]}
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
                        stroke="#57534E" 
                        strokeWidth={1.75} 
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
              <div className="surface-card rounded-lg grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#D8D4CA] overflow-hidden">
                {/* Cumulative Deficit Chart */}
                <div className="p-6">
                  <div className="pb-4 mb-5 border-b border-[#D8D4CA]">
                    <h2 className="text-sm font-bold text-[#181615] uppercase tracking-wider">Déficit Acumulado del Mes</h2>
                    <p className="text-xs text-[#78716C] mt-0.5">Brecha acumulada en toneladas</p>
                  </div>
                  
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="pqlGradJorq" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#461D77" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#461D77" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE7DF" />
                        <XAxis dataKey="dayLabel" stroke="#78716C" fontSize={10} fontWeight="600" tickLine={false} />
                        <YAxis stroke="#78716C" fontSize={10} fontWeight="600" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #D8D4CA', fontSize: '12px' }} />
                        <Area 
                          type="monotone" 
                          dataKey="defAcumTon" 
                          name="Déficit Acum. (Ton)" 
                          stroke="#461D77" 
                          fillOpacity={1} 
                          fill="url(#pqlGradJorq)" 
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Productivity Chart */}
                <div className="p-6">
                  <div className="pb-4 mb-5 border-b border-[#D8D4CA]">
                    <h2 className="text-sm font-bold text-[#181615] uppercase tracking-wider">Productividad Diaria</h2>
                    <p className="text-xs text-[#78716C] mt-0.5">Rendimiento promedio de toneladas por vuelta</p>
                  </div>
                  
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE7DF" />
                        <XAxis dataKey="dayLabel" stroke="#78716C" fontSize={10} fontWeight="600" tickLine={false} />
                        <YAxis stroke="#78716C" fontSize={10} fontWeight="600" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #D8D4CA', fontSize: '12px' }} />
                        <Line 
                          type="monotone" 
                          dataKey="prod" 
                          name="Ton/Vuelta" 
                          stroke="#15803D" 
                          strokeWidth={2} 
                          dot={{ r: 3, fill: '#15803D', strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ANOMALIES/CRITICAL DAYS */}
              {criticalDays.length > 0 && (
                <div className="surface-card p-6 rounded-lg">
                  <div className="pb-4 mb-4 border-b border-[#D8D4CA]">
                    <h2 className="text-sm font-bold text-[#181615] uppercase tracking-wider">Días Críticos del Mes</h2>
                    <p className="text-xs text-[#78716C] mt-0.5">Jornadas con mayor caída respecto a la meta planificada</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#D8D4CA] surface-well rounded-md">
                    {criticalDays.map((day, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between gap-3">
                        <span className="text-sm font-mono font-bold text-[#181615] uppercase">{day.dayLabel}</span>
                        <span className="text-lg font-mono tabular-nums font-bold text-[#B45309]">{day.defDia} vueltas</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DAILY DETAILS TABLE */}
              <div className="surface-card p-6 rounded-lg overflow-hidden">
                <div className="pb-4 mb-4 border-b border-[#D8D4CA]">
                  <h2 className="text-sm font-bold text-[#181615] uppercase tracking-wider">Detalle Diario de Operación</h2>
                  <p className="text-xs text-[#78716C] mt-0.5">Registro unificado del cumplimiento Jorquera SLIT</p>
                </div>

                <div className="overflow-x-auto rounded-md border border-[#D8D4CA] no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <table className="min-w-full text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-[#E7E4DC] text-[#44403C] border-b border-[#D8D4CA]">
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
                    <tbody className="divide-y divide-[#E5E2D9] bg-white">
                      {currentData.map((row, idx) => (
                        <tr 
                          key={idx} 
                          className="hover:bg-[#F4F2EC] transition-colors duration-150"
                        >
                          <td className="px-4 py-2.5 text-left font-bold text-[#461D77]">{row.dayLabel}</td>
                          <td className="px-4 py-2.5 text-right text-[#181615]">{row.sol}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-[#181615]">{row.real}</td>
                          <td className="px-4 py-2.5 text-right text-[#57534E]">{row.equipos}</td>
                          <td className="px-4 py-2.5 text-right text-[#181615]">{row.ton.toLocaleString('es-CL')}</td>
                          <td className="px-4 py-2.5 text-right text-[#57534E]">{row.prod.toFixed(2)}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${row.defDia < 0 ? 'text-[#B45309]' : 'text-[#15803D]'}`}>{row.defDia}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${row.defAcumVueltas < 0 ? 'text-[#B45309]' : 'text-[#15803D]'}`}>{row.defAcumVueltas}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${row.defTonDia < 0 ? 'text-[#B45309]' : 'text-[#15803D]'}`}>{Math.round(row.defTonDia).toLocaleString('es-CL')}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${row.defAcumTon < 0 ? 'text-[#B45309]' : 'text-[#15803D]'}`}>{Math.round(row.defAcumTon).toLocaleString('es-CL')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* CUADRO DE NOTAS / OBSERVACIONES OPERATIVAS */}
                <div data-ignore-capture="true" className="mt-5 pt-5 border-t border-[#D8D4CA]">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-[#461D77]" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[#181615]">Notas y Observaciones de la Jornada</span>
                    </div>
                    {noteText.trim().length > 0 ? (
                      <span className="text-[11px] font-semibold text-[#15803D] bg-[#ECFDF5] border border-[#15803D]/25 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle size={12} /> Incluido en exportación PNG
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#78716C]">
                        Opcional (se omite en PNG si está vacío)
                      </span>
                    )}
                  </div>
                  
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Escribe aquí notas, justificaciones de desvíos, condiciones climáticas o comentarios operacionales (opcional)..."
                    rows={3}
                    className="w-full text-xs text-[#181615] bg-[#F2F0EA] focus:bg-white border border-[#D8D4CA] focus:border-[#461D77] rounded-md p-3 outline-none transition-colors duration-150 resize-y placeholder:text-[#78716C]"
                  />
                  <div className="flex items-center justify-between text-[11px] text-[#78716C] mt-1.5">
                    <span>Si no ingresas texto, el reporte PNG omitirá este bloque.</span>
                    {noteText.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => setNoteText('')}
                        className="text-[#57534E] hover:text-[#B91C1C] font-semibold transition-colors duration-150 cursor-pointer"
                      >
                        Limpiar nota
                      </button>
                    )}
                  </div>
                </div>

                {/* TARJETA FORMATEADA DE NOTAS */}
                {noteText.trim().length > 0 && (
                  <div className="mt-4 p-4 rounded-md surface-well">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#461D77] mb-1.5 flex items-center gap-1.5">
                      <FileText size={13} className="text-[#461D77]" /> Notas y Observaciones Operativas
                    </p>
                    <p className="text-xs text-[#181615] leading-relaxed whitespace-pre-wrap">
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

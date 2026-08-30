import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  ArrowLeft, Upload, X, ChevronRight, BarChart3, TrendingUp, AlertCircle, 
  Calendar, CheckCircle, HelpCircle, Activity, ClipboardCheck 
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

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
  const [file, setFile] = useState<File | null>(null);
  const [workbookSheets, setWorkbookSheets] = useState<{ [key: string]: CumplimientoRow[] }>({});
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const stripAccents = (s: string) => {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const parseSheet = (ws: XLSX.WorkSheet): CumplimientoRow[] | null => {
    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
    let headerRow = -1;
    for (let i = 0; i < Math.min(aoa.length, 10); i++) {
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
      if (!row) break;
      const fechaVal = row[0];
      if (!fechaVal) break; // end of data block
      
      let fecha: Date | null = null;
      if (fechaVal instanceof Date) {
        fecha = fechaVal;
      } else if (typeof fechaVal === 'number') {
        fecha = new Date((fechaVal - 25569) * 86400 * 1000);
      } else if (typeof fechaVal === 'string') {
        const parsed = new Date(fechaVal);
        if (!isNaN(parsed.getTime())) fecha = parsed;
      }

      if (!fecha) break; // hit Total row or end

      const sol = row[1];
      const real = row[2];
      if (sol === null || sol === undefined || real === null || real === undefined) continue; // day with no data yet

      rows.push({
        fecha,
        dayLabel: String(fecha.getUTCDate()).padStart(2, '0') + '-' + MONTH_ABBR[fecha.getUTCMonth()],
        sol: Number(sol) || 0,
        real: Number(real) || 0,
        equipos: Number(row[3]) || 0,
        ton: Number(row[4]) || 0,
        prod: Number(row[5]) || 0,
        defDia: Number(row[6]) || 0,
        defAcumVueltas: Number(row[7]) || 0,
        defTonDia: Number(row[8]) || 0,
        defAcumTon: Number(row[9]) || 0,
      });
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

  return (
    <div className="flex h-screen bg-calido font-sans text-tecnico overflow-hidden">
      
      {/* SIDEBAR FOR ACTIONS */}
      <aside className="w-[300px] bg-levanda border-r border-violeta/20 flex flex-col no-print shrink-0">
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <button 
            onClick={onBack} 
            className="flex items-center gap-2 text-[#461D77] hover:text-nucleo font-black text-[10px] uppercase tracking-widest transition-colors mb-2 group cursor-pointer"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Volver a Módulo SdA
          </button>

          <div className="bg-white p-5 rounded-3xl border border-violeta/10 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2 text-violeta">
              <ClipboardCheck size={18} />
              <span className="font-black text-[10px] tracking-wider uppercase">CUMPLIMIENTO PQL</span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Monitoreo integral de cumplimiento de metas de despacho M&Q, toneladas y rendimiento de flota mensual.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-violeta">Configuración de Visualización</p>
            <div className="bg-white p-5 rounded-3xl border border-violeta/10 space-y-4 shadow-sm">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Mes / Hoja Operativa</label>
                <select 
                  value={selectedSheet} 
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  disabled={Object.keys(workbookSheets).length === 0}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violeta/10 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full uppercase truncate max-w-[150px]">
                    {file.name}
                  </span>
                  <button 
                    onClick={resetState}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Remover Archivo"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN PANEL */}
      <main className="flex-1 flex flex-col min-w-0 bg-calido overflow-y-auto">
        
        {/* HEADER BAR */}
        <header className="bg-white/80 backdrop-blur-md border-b border-violeta/10 px-8 py-5 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 uppercase">
                PQL • Planta Química Litio
              </span>
              {selectedSheet && (
                <span className="text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full bg-[#461D77]/10 text-[#461D77] uppercase">
                  PERÍODO: {selectedSheet}
                </span>
              )}
            </div>
            <h1 className="text-xl font-black text-tecnico tracking-tight uppercase mt-1">
              Cumplimiento M&Q • Operación SLIT
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar size={14} />
            <span className="font-mono text-[11px] font-bold">Última Actualización: {new Date().toLocaleDateString('es-CL')}</span>
          </div>
        </header>

        {/* CONTENT */}
        <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
          
          {/* UPLOAD ZONE (If no file is uploaded) */}
          {!file && (
            <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`border-3 border-dashed rounded-[2.5rem] p-12 text-center transition-all ${
                dragActive 
                  ? 'border-[#461D77] bg-[#461D77]/5' 
                  : 'border-slate-300/80 bg-white/60 hover:border-slate-400'
              }`}
            >
              <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto shadow-inner mb-6">
                <Upload size={38} className="text-[#461D77]" />
              </div>
              <h2 className="text-xl font-black text-tecnico uppercase mb-2">Carga tu Archivo M&Q Mensual</h2>
              <p className="text-slate-500 text-xs font-medium max-w-md mx-auto leading-relaxed mb-6">
                Arrastra o haz clic para subir el archivo de cumplimiento de Novandino (.xlsx). El sistema procesará cada pestaña de mes automáticamente.
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
                className="bg-[#461D77] hover:bg-[#34155b] text-white font-black text-[10px] uppercase tracking-widest px-8 py-3 rounded-2xl transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                Buscar Archivo en mi PC
              </button>
            </div>
          )}

          {/* Status Message */}
          {statusMsg && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs ${
              statusMsg.isError 
                ? 'bg-red-50 border-red-200 text-red-700' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <AlertCircle size={16} />
              <span className="font-bold">{statusMsg.text}</span>
            </div>
          )}

          {/* DASHBOARD CONTENT (Active only if data exists) */}
          {file && currentData.length > 0 && kpis && (
            <div className="space-y-8 animate-fade-in">
              
              {/* KPI CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* CUMPLIMIENTO DEL MES */}
                <div className="bg-[#101f2c] border border-[#21384a] rounded-xl p-5 relative overflow-hidden flex flex-col justify-between shadow-lg">
                  <div className="absolute top-0 left-0 w-[3px] h-full bg-[#2fe0c4]" />
                  <div>
                    <p className="text-[#7f9cae] text-[10px] font-bold uppercase tracking-widest mb-4">CUMPLIMIENTO DEL MES</p>
                    <p className="text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-1.5 font-sans">
                      {kpis.cumplPct.toFixed(1)}<span className="text-[#7f9cae] text-xs font-semibold">%</span>
                    </p>
                  </div>
                  <p className="text-[#7f9cae] text-[11px] font-mono mt-4 font-medium">
                    {kpis.totalReal} de {kpis.totalSol} vueltas realizadas
                  </p>
                </div>

                {/* DÉFICIT ACUMULADO */}
                <div className="bg-[#101f2c] border border-[#21384a] rounded-xl p-5 relative overflow-hidden flex flex-col justify-between shadow-lg">
                  <div className="absolute top-0 left-0 w-[3px] h-full bg-[#ff6b5e]" />
                  <div>
                    <p className="text-[#7f9cae] text-[10px] font-bold uppercase tracking-widest mb-4">DÉFICIT ACUMULADO</p>
                    <p className="text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-1.5 font-sans">
                      {kpis.deficitVueltas}<span className="text-[#7f9cae] text-xs font-semibold">vueltas</span>
                    </p>
                  </div>
                  <p className={`text-[11px] font-mono mt-4 font-semibold ${kpis.deficitVueltas >= 0 ? 'text-[#3ed598]' : 'text-[#ff6b5e]'}`}>
                    {Math.round(kpis.deficitTon).toLocaleString('es-CL')} ton vs. plan
                  </p>
                </div>

                {/* PRODUCTIVIDAD PROMEDIO */}
                <div className="bg-[#101f2c] border border-[#21384a] rounded-xl p-5 relative overflow-hidden flex flex-col justify-between shadow-lg">
                  <div className="absolute top-0 left-0 w-[3px] h-full bg-[#2fe0c4]" />
                  <div>
                    <p className="text-[#7f9cae] text-[10px] font-bold uppercase tracking-widest mb-4">PRODUCTIVIDAD PROMEDIO</p>
                    <p className="text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-1.5 font-sans">
                      {kpis.avgProd.toFixed(2)}<span className="text-[#7f9cae] text-xs font-semibold">ton/vuelta</span>
                    </p>
                  </div>
                  <p className="text-[#7f9cae] text-[11px] font-mono mt-4 font-medium">
                    Promedio de los días registrados
                  </p>
                </div>

                {/* TENDENCIA ÚLTIMOS 3 DÍAS */}
                <div className="bg-[#101f2c] border border-[#21384a] rounded-xl p-5 relative overflow-hidden flex flex-col justify-between shadow-lg">
                  <div className="absolute top-0 left-0 w-[3px] h-full bg-[#2fe0c4]" />
                  <div>
                    <p className="text-[#7f9cae] text-[10px] font-bold uppercase tracking-widest mb-4">TENDENCIA ÚLTIMOS 3 DÍAS</p>
                    <p className="text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-1.5 font-sans">
                      {kpis.last3Sum > 0 ? `+${kpis.last3Sum}` : kpis.last3Sum}<span className="text-[#7f9cae] text-xs font-semibold">vueltas</span>
                    </p>
                  </div>
                  <p className={`text-[11px] font-mono mt-4 font-semibold ${kpis.last3Sum >= 0 ? 'text-[#3ed598]' : 'text-[#ff6b5e]'}`}>
                    {kpis.last3Sum >= 0 ? 'Revirtiendo el déficit' : 'Profundizando el déficit'}
                  </p>
                </div>
              </div>

              {/* ROUTE CHART */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-base font-black text-tecnico uppercase">Ruta Diaria de Cumplimiento</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">Vueltas Reales vs. Meta Diaria</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-md bg-indigo-600" />
                      <span>Cumple Meta</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-md bg-red-400" />
                      <span>Déficit Crítico</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="dayLabel" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        fontWeight="bold" 
                        tickLine={false} 
                      />
                      <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }} 
                        labelStyle={{ fontWeight: 'black', fontSize: '11px', color: '#1e1b4b' }}
                      />
                      <Bar 
                        dataKey="real" 
                        name="Vueltas Reales" 
                        radius={[4, 4, 0, 0]}
                        maxBarSize={25}
                      >
                        {currentData.map((entry, index) => (
                          <rect 
                            key={`rect-${index}`} 
                            fill={entry.defDia >= 0 ? '#461D77' : (entry.defDia >= -20 ? '#7177EC' : '#ff6b5e')} 
                          />
                        ))}
                      </Bar>
                      <Line 
                        type="monotone" 
                        dataKey="sol" 
                        name="Meta Planificada" 
                        stroke="#5a7788" 
                        strokeWidth={1.5} 
                        strokeDasharray="5 5" 
                        dot={false} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* TWO COLUMNS CHARTS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Cumulative Deficit Chart */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
                  <h2 className="text-base font-black text-tecnico uppercase">Déficit Acumulado del Mes</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5 mb-6">Brecha acumulada en Toneladas</p>
                  
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
                        <XAxis dataKey="dayLabel" stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #f1f5f9' }} />
                        <Area 
                          type="monotone" 
                          dataKey="defAcumTon" 
                          name="Déficit Acum. (Ton)" 
                          stroke="#461D77" 
                          fillOpacity={1} 
                          fill="url(#pqlGrad)" 
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Productivity Chart */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
                  <h2 className="text-base font-black text-tecnico uppercase">Productividad Diaria</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5 mb-6">Rendimiento Promedio de Toneladas por Vuelta</p>
                  
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dayLabel" stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #f1f5f9' }} />
                        <Line 
                          type="monotone" 
                          dataKey="prod" 
                          name="Ton/Vuelta" 
                          stroke="#3FAA88" 
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#3FAA88', strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ANOMALIES/CRITICAL DAYS */}
              {criticalDays.length > 0 && (
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
                  <h2 className="text-base font-black text-tecnico uppercase mb-1">Días Críticos del Mes</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-6">Jornadas con Mayor Caída de Cumplimiento Planificado</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {criticalDays.map((day, idx) => (
                      <div key={idx} className="bg-slate-50 p-5 rounded-3xl border border-red-100 border-l-4 border-l-red-500 relative flex flex-col justify-between">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{day.dayLabel}</p>
                          <p className="text-2xl font-black text-red-500 mt-2 mb-1">{day.defDia} Vueltas</p>
                          <p className="text-xs text-slate-500 font-bold">
                            {day.real} de {day.sol} realizadas · {Math.round(day.defTonDia).toLocaleString('es-CL')} Ton bajo plan
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-200/50">
                          <span className="text-[8px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md uppercase block w-max">
                            Causa Raíz
                          </span>
                          <p className="text-[11px] text-slate-600 mt-1 font-bold">
                            Pendiente de asignación por operaciones
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DAILY DETAILS TABLE */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.01)] overflow-hidden">
                <div className="mb-6">
                  <h2 className="text-base font-black text-tecnico uppercase">Detalle Diario de Operación</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">Registro unificado del cumplimiento M&Q SLIT</p>
                </div>

                <div className="overflow-x-auto rounded-3xl border border-slate-100">
                  <table className="min-w-full text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400">
                        <th className="px-6 py-4 text-left font-black tracking-widest uppercase">Fecha</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Solicitadas</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Real</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">N° Equipos</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Tonelaje</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Productividad</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Déficit Día</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Déficit Acum.</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Déficit Ton</th>
                        <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Acum. Ton</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentData.map((row, idx) => (
                        <tr 
                          key={idx} 
                          className={`hover:bg-slate-50/50 transition-colors ${row.defDia <= -20 ? 'bg-red-50/20' : ''}`}
                        >
                          <td className="px-6 py-4 text-left font-bold text-[#461D77]">{row.dayLabel}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-600">{row.sol}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-600">{row.real}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-600">{row.equipos}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-600">{row.ton.toLocaleString('es-CL')}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-600">{row.prod.toFixed(2)}</td>
                          <td className={`px-4 py-4 text-right font-bold ${row.defDia < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{row.defDia}</td>
                          <td className={`px-4 py-4 text-right font-bold ${row.defAcumVueltas < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{row.defAcumVueltas}</td>
                          <td className={`px-4 py-4 text-right font-bold ${row.defTonDia < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{Math.round(row.defTonDia).toLocaleString('es-CL')}</td>
                          <td className={`px-4 py-4 text-right font-bold ${row.defAcumTon < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{Math.round(row.defAcumTon).toLocaleString('es-CL')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

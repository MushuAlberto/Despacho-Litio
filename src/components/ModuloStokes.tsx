import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Truck,
  UploadCloud,
  User
} from 'lucide-react';
import { parsearExcelReportServer } from '../data/datosStokesHistoricos';

export interface DespachoStokes {
  guia: string;
  fechaGuia: string;
  producto: string;
  cantDespacho: number;
  almacenDespachoRaw: string;
  origenStokes: string;
  almacenDestino: string;
  transportista: string;
  patenteCamion: string;
}

interface ModuloStokesProps {
  currentUser?: any;
  onBack: () => void;
}

type BridgeStatus = 'checking' | 'online' | 'offline';

const BRIDGE_BASE_URL = 'http://127.0.0.1:3847';

function fechaLocalISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export const ModuloStokes: React.FC<ModuloStokesProps> = ({ currentUser, onBack }) => {
  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-md text-center space-y-4">
          <Lock className="w-10 h-10 text-red-600 mx-auto" />
          <h2 className="text-xl font-black text-slate-800">Acceso exclusivo de administrador</h2>
          <p className="text-sm text-slate-500">El módulo Reporte Stokes está restringido al administrador del sistema.</p>
          <button onClick={onBack} className="w-full py-3 bg-[#461D77] text-white rounded-xl font-bold">Volver</button>
        </div>
      </div>
    );
  }

  const hoy = fechaLocalISO();
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>('checking');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [dominio, setDominio] = useState('SQM');
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [datos, setDatos] = useState<DespachoStokes[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null);
  const [origen, setOrigen] = useState<'bridge' | 'excel' | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const verificarBridge = async () => {
    setBridgeStatus('checking');
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${BRIDGE_BASE_URL}/health`, { cache: 'no-store', signal: controller.signal });
      window.clearTimeout(timeout);
      if (!response.ok) throw new Error('Bridge no disponible');
      setBridgeStatus('online');
    } catch {
      setBridgeStatus('offline');
    }
  };

  useEffect(() => {
    verificarBridge();
  }, []);

  const consultarStokes = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!usuario.trim() || !password) {
      setError('Ingresa tu usuario y contraseña corporativa.');
      return;
    }
    if (fechaFin < fechaInicio) {
      setError('La fecha final no puede ser anterior a la fecha inicial.');
      return;
    }

    setCargando(true);
    setError(null);
    try {
      const response = await fetch(`${BRIDGE_BASE_URL}/api/reporte-stokes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usuario.trim(),
          password,
          domain: dominio.trim(),
          fechaInicio,
          fechaFin
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || result.error || 'No fue posible obtener el reporte Stokes.');
      if (result.isContingency) throw new Error('ReportServer no está disponible. No se usarán datos de contingencia como información operacional.');

      setDatos(Array.isArray(result.data) ? result.data : []);
      setOrigen('bridge');
      setUltimaActualizacion(new Date().toISOString());
      setBridgeStatus('online');
    } catch (err: any) {
      setError(err?.message || 'Error de conexión con Stokes Bridge.');
      if (String(err?.message || '').includes('fetch')) setBridgeStatus('offline');
    } finally {
      setPassword('');
      setCargando(false);
    }
  };

  const cargarExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = parsearExcelReportServer(new Uint8Array(e.target?.result as ArrayBuffer));
        setDatos(parsed);
        setOrigen('excel');
        setUltimaActualizacion(new Date().toISOString());
        setError(null);
      } catch (err: any) {
        setError(`No se pudo procesar el Excel: ${err?.message || err}`);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const datosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return datos;
    return datos.filter(item => [
      item.guia,
      item.fechaGuia,
      item.producto,
      item.almacenDespachoRaw,
      item.origenStokes,
      item.almacenDestino,
      item.transportista,
      item.patenteCamion
    ].some(value => String(value || '').toLowerCase().includes(q)));
  }, [datos, busqueda]);

  const resumen = useMemo(() => {
    const toneladas = datosFiltrados.reduce((sum, item) => sum + (Number(item.cantDespacho) || 0), 0);
    const transportistas = new Set(datosFiltrados.map(item => item.transportista).filter(Boolean));
    const equipos = new Set(datosFiltrados.map(item => item.patenteCamion).filter(Boolean));
    return { toneladas, transportistas: transportistas.size, equipos: equipos.size };
  }, [datosFiltrados]);

  const exportarExcel = () => {
    if (!datosFiltrados.length) return;
    const rows = datosFiltrados.map((item, index) => ({
      'N°': index + 1,
      'N° Guía': item.guia,
      'Fecha Guía': item.fechaGuia,
      Producto: item.producto,
      'Cantidad Despacho (TON)': item.cantDespacho,
      'Almacén Despacho': item.almacenDespachoRaw,
      'Origen Normalizado': item.origenStokes,
      'Almacén Destino': item.almacenDestino,
      Transportista: item.transportista,
      Patente: item.patenteCamion
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Stokes');
    XLSX.writeFile(workbook, `Reporte_Stokes_${fechaInicio}_${fechaFin}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#F7F5F8] text-slate-800 p-4 md:p-7">
      <div className="max-w-[1500px] mx-auto space-y-5">
        <header className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-3 rounded-2xl bg-purple-50 text-[#461D77] hover:bg-purple-100"><ArrowLeft size={18} /></button>
            <div>
              <div className="text-[10px] font-black tracking-[.18em] uppercase text-[#461D77]">Reporte Stokes</div>
              <h1 className="text-2xl font-black text-[#461D77]">Conexión segura mediante Bridge local</h1>
              <p className="text-sm text-slate-500 mt-1">ReportServer: clanfdbsw06-li.ad.sqmlitio.com · las credenciales no se envían a Vercel.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-2 ${bridgeStatus === 'online' ? 'bg-emerald-50 text-emerald-700' : bridgeStatus === 'checking' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
              <span className={`w-2 h-2 rounded-full ${bridgeStatus === 'online' ? 'bg-emerald-500' : bridgeStatus === 'checking' ? 'bg-amber-500' : 'bg-red-500'}`} />
              {bridgeStatus === 'online' ? 'Bridge conectado' : bridgeStatus === 'checking' ? 'Verificando Bridge' : 'Bridge desconectado'}
            </div>
            <button onClick={verificarBridge} className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"><RefreshCw size={16} /></button>
          </div>
        </header>

        {bridgeStatus === 'offline' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-amber-900">
            <AlertCircle className="shrink-0 mt-0.5" size={19} />
            <div>
              <div className="font-black">Stokes Bridge no está ejecutándose en este computador.</div>
              <p className="text-sm mt-1">En el PC corporativo inicia el repositorio y ejecuta <code className="bg-white px-2 py-0.5 rounded">npm run stokes:bridge</code>. Luego presiona el botón de actualización.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[390px_1fr] gap-5">
          <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm h-fit">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="text-emerald-600" size={20} />
              <div>
                <h2 className="font-black text-[#461D77]">Solicitar reporte</h2>
                <p className="text-xs text-slate-500">Las credenciales viven solo durante esta solicitud en el navegador y el Bridge local.</p>
              </div>
            </div>

            <form onSubmit={consultarStokes} className="space-y-3">
              <label className="block text-xs font-bold text-slate-600">Usuario corporativo
                <div className="relative mt-1"><User size={15} className="absolute left-3 top-3 text-slate-400" /><input value={usuario} onChange={e => setUsuario(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#461D77]" placeholder="usuario o SQM\\usuario" /></div>
              </label>
              <label className="block text-xs font-bold text-slate-600">Contraseña
                <div className="relative mt-1"><KeyRound size={15} className="absolute left-3 top-3 text-slate-400" /><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#461D77]" autoComplete="current-password" /></div>
              </label>
              <label className="block text-xs font-bold text-slate-600">Dominio Windows<input value={dominio} onChange={e => setDominio(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#461D77]" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold text-slate-600">Desde<input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full mt-1 px-2 py-2.5 rounded-xl border border-slate-200 bg-slate-50" /></label>
                <label className="text-xs font-bold text-slate-600">Hasta<input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="w-full mt-1 px-2 py-2.5 rounded-xl border border-slate-200 bg-slate-50" /></label>
              </div>
              <button disabled={cargando || bridgeStatus !== 'online'} className="w-full bg-[#461D77] hover:bg-[#35145b] disabled:bg-slate-300 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2">
                {cargando ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
                {cargando ? 'Consultando ReportServer…' : 'Conectar y obtener Stokes'}
              </button>
            </form>

            <div className="my-4 border-t border-slate-100" />
            <label className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer font-bold text-sm text-slate-700">
              <UploadCloud size={16} /> Cargar Excel manual
              <input type="file" accept=".xlsx,.xls" onChange={cargarExcel} className="hidden" />
            </label>

            {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm"><strong>Error:</strong> {error}</div>}
          </section>

          <section className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="text-xs text-slate-500 font-bold">Guías</div><div className="text-3xl font-black text-[#461D77] mt-1">{datosFiltrados.length.toLocaleString('es-CL')}</div></div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="text-xs text-slate-500 font-bold">Toneladas</div><div className="text-3xl font-black text-slate-900 mt-1">{resumen.toneladas.toLocaleString('es-CL', { maximumFractionDigits: 1 })}</div></div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="text-xs text-slate-500 font-bold">Equipos únicos</div><div className="text-3xl font-black text-slate-900 mt-1">{resumen.equipos}</div></div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="text-xs text-slate-500 font-bold">Transportistas</div><div className="text-3xl font-black text-slate-900 mt-1">{resumen.transportistas}</div></div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-[#461D77] flex items-center gap-2"><FileSpreadsheet size={18} /> Datos Stokes</h2>
                  <p className="text-xs text-slate-500 mt-1">{origen === 'bridge' ? 'Fuente: ReportServer vía Bridge local' : origen === 'excel' ? 'Fuente: Excel local' : 'Sin datos cargados'}{ultimaActualizacion ? ` · Actualizado ${new Date(ultimaActualizacion).toLocaleString('es-CL')}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar…" className="pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm" /></div>
                  <button onClick={exportarExcel} disabled={!datosFiltrados.length} className="px-4 py-2.5 rounded-xl bg-emerald-600 disabled:bg-slate-300 text-white font-bold flex items-center gap-2"><Download size={15} /> Excel</button>
                </div>
              </div>

              {!datos.length ? (
                <div className="py-20 text-center text-slate-400"><Server size={42} className="mx-auto mb-3 text-slate-300" /><div className="font-bold text-slate-600">Aún no hay datos Stokes en esta sesión</div><p className="text-sm mt-1">Conecta el Bridge y solicita el reporte o carga un Excel.</p></div>
              ) : (
                <div className="overflow-auto max-h-[650px]">
                  <table className="w-full text-xs text-left min-w-[1100px]">
                    <thead className="sticky top-0 bg-[#461D77] text-white uppercase tracking-wide"><tr><th className="p-3">Guía</th><th className="p-3">Fecha</th><th className="p-3">Producto</th><th className="p-3 text-right">TON</th><th className="p-3">Origen raw</th><th className="p-3">Origen</th><th className="p-3">Destino</th><th className="p-3">Transportista</th><th className="p-3">Patente</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{datosFiltrados.map((item, index) => <tr key={`${item.guia}-${index}`} className="hover:bg-purple-50"><td className="p-3 font-mono font-black text-[#461D77]">{item.guia}</td><td className="p-3 whitespace-nowrap">{item.fechaGuia}</td><td className="p-3 font-bold">{item.producto}</td><td className="p-3 text-right font-mono font-bold">{Number(item.cantDespacho).toLocaleString('es-CL', { maximumFractionDigits: 2 })}</td><td className="p-3">{item.almacenDespachoRaw}</td><td className="p-3">{item.origenStokes === 'Salar' ? <span className="inline-flex items-center gap-1 text-emerald-700 font-black"><CheckCircle2 size={13} /> Salar</span> : item.origenStokes}</td><td className="p-3">{item.almacenDestino}</td><td className="p-3">{item.transportista}</td><td className="p-3 font-mono font-bold">{item.patenteCamion}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-500 flex items-start gap-2"><ShieldCheck size={16} className="text-emerald-600 shrink-0" /><p><strong className="text-slate-700">Diseño de seguridad:</strong> el Bridge escucha únicamente en <code>127.0.0.1</code>; Despacho-Litio se comunica con él desde este computador y el Bridge se conecta al ReportServer interno. La contraseña se limpia del estado del formulario al terminar cada solicitud.</p></div>
      </div>
    </div>
  );
};

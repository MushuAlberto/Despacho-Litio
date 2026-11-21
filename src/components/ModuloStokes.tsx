import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Info,
  Search,
  ShieldCheck,
  UploadCloud
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

const REPORT_SERVER_URL = 'http://clanfdbsw06-li.ad.sqmlitio.com/ReportServer/Pages/ReportViewer.aspx?/produccion/operaciones/canchas/publico/Historico_guia_transportista';

export const ModuloStokes: React.FC<ModuloStokesProps> = ({ currentUser, onBack }) => {
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-md text-center space-y-4">
          <ShieldCheck className="w-10 h-10 text-[#461D77] mx-auto" />
          <h2 className="text-xl font-black text-slate-800">Sesión requerida</h2>
          <p className="text-sm text-slate-500">Debes iniciar sesión en Despacho-Litio para utilizar Reporte Stokes.</p>
          <button onClick={onBack} className="w-full py-3 bg-[#461D77] text-white rounded-xl font-bold">Volver</button>
        </div>
      </div>
    );
  }

  const [datos, setDatos] = useState<DespachoStokes[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const abrirStokes = () => {
    const nuevaVentana = window.open(REPORT_SERVER_URL, '_blank', 'noopener,noreferrer');
    if (!nuevaVentana) {
      setError('El navegador bloqueó la nueva ventana. Habilita las ventanas emergentes para Despacho-Litio e inténtalo nuevamente.');
    } else {
      setError(null);
    }
  };

  const cargarExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = parsearExcelReportServer(new Uint8Array(e.target?.result as ArrayBuffer));
        if (!parsed.length) {
          throw new Error('No se detectaron guías válidas en el archivo seleccionado.');
        }
        setDatos(parsed);
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
    XLSX.writeFile(workbook, `Reporte_Stokes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#F7F5F8] text-slate-800 p-4 md:p-7">
      <div className="max-w-[1500px] mx-auto space-y-5">
        <header className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-3 rounded-2xl bg-purple-50 text-[#461D77] hover:bg-purple-100"><ArrowLeft size={18} /></button>
            <div>
              <div className="text-[10px] font-black tracking-[.18em] uppercase text-[#461D77]">Reporte Stokes</div>
              <h1 className="text-2xl font-black text-[#461D77]">Obtención de datos Stokes</h1>
              <p className="text-sm text-slate-500 mt-1">Autenticación en el ReportServer corporativo y procesamiento del Excel en este navegador.</p>
            </div>
          </div>
          <div className="px-3 py-2 rounded-xl text-xs font-black flex items-center gap-2 bg-emerald-50 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Flujo corporativo disponible
          </div>
        </header>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 text-blue-900">
          <Info className="shrink-0 mt-0.5" size={19} />
          <div>
            <div className="font-black">Las credenciales se ingresan directamente en el sistema corporativo Stokes.</div>
            <p className="text-sm mt-1">Despacho-Litio no guarda ni recibe tu contraseña. Al abrir Stokes, inicia sesión con tus credenciales habituales, genera <strong>Historico_guia_transportista</strong>, exporta el Excel y luego cárgalo aquí.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[390px_1fr] gap-5">
          <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm h-fit space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2"><ShieldCheck className="text-emerald-600" size={20} /><h2 className="font-black text-[#461D77]">1. Iniciar sesión en Stokes</h2></div>
              <p className="text-xs text-slate-500 mb-4">Se abrirá el ReportServer interno de la empresa. Allí ingresa tu usuario y contraseña corporativa.</p>
              <button onClick={abrirStokes} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm">
                <ExternalLink size={17} /> Abrir Stokes e iniciar sesión
              </button>
            </div>

            <div className="border-t border-slate-100" />

            <div>
              <div className="flex items-center gap-2 mb-2"><UploadCloud className="text-[#461D77]" size={20} /><h2 className="font-black text-[#461D77]">2. Cargar reporte generado</h2></div>
              <p className="text-xs text-slate-500 mb-4">Después de exportar <strong>Historico_guia_transportista</strong> desde Stokes, selecciona el archivo Excel.</p>
              <label className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#461D77] hover:bg-[#35145b] text-white cursor-pointer font-black text-sm">
                <FileSpreadsheet size={17} /> Seleccionar Excel Stokes
                <input type="file" accept=".xlsx,.xls" onChange={cargarExcel} className="hidden" />
              </label>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm flex gap-2"><AlertCircle size={17} className="shrink-0 mt-0.5" /><div><strong>Aviso:</strong> {error}</div></div>}
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
                  <div className="font-black text-[#461D77] flex items-center gap-2"><Database size={17} /> Datos Stokes</div>
                  <div className="text-xs text-slate-400 mt-1">{ultimaActualizacion ? `Excel local · ${new Date(ultimaActualizacion).toLocaleString('es-CL')}` : 'Sin datos cargados'}</div>
                </div>
                <div className="flex gap-2">
                  <div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar…" className="pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm" /></div>
                  <button onClick={exportarExcel} disabled={!datosFiltrados.length} className="px-4 py-2.5 rounded-xl bg-emerald-600 disabled:bg-slate-300 text-white font-bold flex items-center gap-2"><Download size={15} /> Excel</button>
                </div>
              </div>

              {!datos.length ? (
                <div className="py-20 text-center text-slate-400"><FileSpreadsheet size={42} className="mx-auto mb-3 text-slate-300" /><div className="font-bold text-slate-600">Aún no hay datos Stokes en esta sesión</div><p className="text-sm mt-1">Abre Stokes, genera el reporte y carga el Excel exportado.</p></div>
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

        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-500 flex items-start gap-2"><ShieldCheck size={16} className="text-emerald-600 shrink-0" /><p><strong className="text-slate-700">Privacidad:</strong> la autenticación ocurre directamente en el ReportServer corporativo. Despacho-Litio no recibe la contraseña. El Excel se procesa localmente en el navegador y no se envía a Vercel.</p></div>
      </div>
    </div>
  );
};

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
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
  ShieldAlert,
  ShieldCheck,
  Terminal,
  UploadCloud,
  WifiOff,
} from 'lucide-react';
import {
  parseStokesWorkbook,
  StokesParseLogEntry,
  StokesParseSummary,
  StokesQuarantineItem,
  ValidatedStokesItem,
} from '../services/stokesParser';
import {
  enqueueOfflineMutation,
  flushOutboxQueue,
  getOperationalSnapshot,
  saveOperationalSnapshot,
} from '../services/offlineDb';
import { VirtualizedColumnDef, VirtualizedDataTable } from './VirtualizedDataTable';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export type DespachoStokes = ValidatedStokesItem;

interface ModuloStokesProps {
  currentUser?: any;
  onBack: () => void;
}

type StokesViewTab = 'valid' | 'quarantine' | 'logs';

const REPORT_SERVER_URL =
  'http://clanfdbsw06-li.ad.sqmlitio.com/ReportServer/Pages/ReportViewer.aspx?/produccion/operaciones/canchas/publico/Historico_guia_transportista';

const MOP_FILTERS = ['Todas', 'Mop 1', 'Mop 2', 'Mop 3', 'Mop 4', 'Mop 5', 'Mop 6', 'Otro'] as const;

export const ModuloStokes: React.FC<ModuloStokesProps> = ({ currentUser, onBack }) => {
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-md text-center space-y-4">
          <ShieldCheck className="w-10 h-10 text-[#461D77] mx-auto" />
          <h2 className="text-xl font-black text-slate-800">Sesión requerida</h2>
          <p className="text-sm text-slate-500">Debes iniciar sesión en Despacho-Litio para utilizar Reporte Stokes.</p>
          <button onClick={onBack} className="w-full py-3 bg-[#461D77] text-white rounded-xl font-bold cursor-pointer">
            Volver
          </button>
        </div>
      </div>
    );
  }

  const { isOnline } = useOnlineStatus();
  const [datos, setDatos] = useState<ValidatedStokesItem[]>([]);
  const [quarantine, setQuarantine] = useState<StokesQuarantineItem[]>([]);
  const [logs, setLogs] = useState<StokesParseLogEntry[]>([]);
  const [summary, setSummary] = useState<StokesParseSummary | null>(null);
  const [activeTab, setActiveTab] = useState<StokesViewTab>('valid');
  const [mopFilter, setMopFilter] = useState<(typeof MOP_FILTERS)[number]>('Todas');
  const [error, setError] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const deferredSearch = useDeferredValue(busqueda);

  // Hidratación inicial desde IndexedDB para disponibilidad Offline-First
  useEffect(() => {
    let mounted = true;
    getOperationalSnapshot<{
      validRecords: ValidatedStokesItem[];
      quarantinedRecords: StokesQuarantineItem[];
      logs: StokesParseLogEntry[];
      summary: StokesParseSummary | null;
    }>('stokes_latest')
      .then((snap) => {
        if (!mounted || !snap?.data) return;
        if (Array.isArray(snap.data.validRecords) && snap.data.validRecords.length > 0) {
          setDatos(snap.data.validRecords);
          setQuarantine(snap.data.quarantinedRecords || []);
          setLogs(snap.data.logs || []);
          setSummary(snap.data.summary || null);
          setUltimaActualizacion(snap.updatedAt);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const abrirStokes = () => {
    const nuevaVentana = window.open(REPORT_SERVER_URL, '_blank', 'noopener,noreferrer');
    if (!nuevaVentana) {
      setError(
        'El navegador bloqueó la nueva ventana. Habilita las ventanas emergentes para Despacho-Litio e inténtalo nuevamente.'
      );
    } else {
      setError(null);
    }
  };

  const cargarExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = new Uint8Array(e.target?.result as ArrayBuffer);
        const result = parseStokesWorkbook(buffer);

        if (!result.validRecords.length && !result.quarantinedRecords.length) {
          throw new Error('No se detectaron guías en el archivo seleccionado.');
        }

        setDatos(result.validRecords);
        setQuarantine(result.quarantinedRecords);
        setLogs(result.logs);
        setSummary(result.summary);
        setUltimaActualizacion(new Date().toISOString());
        setError(null);
        setActiveTab(result.validRecords.length > 0 ? 'valid' : 'quarantine');

        // Persistir snapshot en IndexedDB y encolar evento para sincronización offline-first
        await saveOperationalSnapshot(
          'stokes_latest',
          {
            validRecords: result.validRecords,
            quarantinedRecords: result.quarantinedRecords,
            logs: result.logs,
            summary: result.summary,
          },
          result.validRecords.length
        );

        await enqueueOfflineMutation('stokes_upload', `Carga Stokes (${result.validRecords.length} guías)`, {
          user: currentUser,
          summary: result.summary,
          fileName: file.name,
        });

        if (navigator.onLine) {
          flushOutboxQueue().catch(() => {});
        }
      } catch (err: any) {
        setError(`No se pudo procesar el Excel: ${err?.message || err}`);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const datosFiltrados = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return datos.filter((item) => {
      if (mopFilter !== 'Todas') {
        const plantLabel = item.mopPlant ?? 'Otro';
        if (plantLabel !== mopFilter) return false;
      }
      if (!q) return true;
      return [
        item.guia,
        item.fechaGuia,
        item.producto,
        item.almacenDespachoRaw,
        item.origenStokes,
        item.mopPlant || '',
        item.almacenDestino,
        item.transportista,
        item.patenteCamion,
      ].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [datos, deferredSearch, mopFilter]);

  const resumen = useMemo(() => {
    const toneladas = datosFiltrados.reduce((sum, item) => sum + (Number(item.cantDespacho) || 0), 0);
    const transportistas = new Set(datosFiltrados.map((item) => item.transportista).filter(Boolean));
    const equipos = new Set(datosFiltrados.map((item) => item.patenteCamion).filter(Boolean));
    return { toneladas, transportistas: transportistas.size, equipos: equipos.size };
  }, [datosFiltrados]);

  const columns = useMemo<VirtualizedColumnDef<ValidatedStokesItem>[]>(
    () => [
      {
        accessorKey: 'guia',
        header: 'Guía',
        size: 115,
        cell: (info) => (
          <span className="font-mono font-bold text-[#461D77] tabular-nums">{String(info.getValue())}</span>
        ),
      },
      {
        accessorKey: 'fechaGuia',
        header: 'Fecha',
        size: 105,
        cell: (info) => <span className="font-mono text-slate-600 tabular-nums">{String(info.getValue())}</span>,
      },
      {
        accessorKey: 'producto',
        header: 'Producto',
        size: 150,
        cell: (info) => <span className="font-semibold text-slate-800">{String(info.getValue())}</span>,
      },
      {
        accessorKey: 'cantDespacho',
        header: () => <span className="block text-right">TON</span>,
        size: 95,
        cell: (info) => (
          <span className="block text-right font-mono font-bold text-slate-900 tabular-nums">
            {Number(info.getValue() || 0).toLocaleString('es-CL', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        accessorKey: 'almacenDespachoRaw',
        header: 'Almacén Origen',
        size: 185,
        cell: (info) => <span className="text-slate-600">{String(info.getValue())}</span>,
      },
      {
        accessorKey: 'mopPlant',
        header: 'Planta / Origen',
        size: 130,
        cell: (info) => {
          const item = info.row.original;
          return item.origenStokes === 'Salar' ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
              <CheckCircle2 size={13} />
              <span>Salar{item.mopPlant ? ` · ${item.mopPlant}` : ''}</span>
            </span>
          ) : (
            <span className="text-slate-600">{item.origenStokes}</span>
          );
        },
      },
      {
        accessorKey: 'almacenDestino',
        header: 'Destino',
        size: 170,
        cell: (info) => <span className="text-slate-700">{String(info.getValue())}</span>,
      },
      {
        accessorKey: 'transportista',
        header: 'Transportista',
        size: 190,
        cell: (info) => <span className="font-medium text-slate-800">{String(info.getValue())}</span>,
      },
      {
        accessorKey: 'patenteCamion',
        header: 'Patente',
        size: 105,
        cell: (info) => (
          <span className="font-mono font-bold text-slate-900 tabular-nums">{String(info.getValue())}</span>
        ),
      },
    ],
    []
  );

  const exportarExcel = () => {
    if (!datosFiltrados.length) return;
    const rows = datosFiltrados.map((item, index) => ({
      'N°': index + 1,
      'N° Guía': item.guia,
      'Fecha Guía': item.fechaGuia,
      Producto: item.producto,
      'Cantidad Despacho (TON)': item.cantDespacho,
      'Almacén Despacho': item.almacenDespachoRaw,
      'Planta Mop': item.mopPlant || 'Otra',
      'Origen Normalizado': item.origenStokes,
      'Almacén Destino': item.almacenDestino,
      Transportista: item.transportista,
      Patente: item.patenteCamion,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Stokes_Validos');

    if (quarantine.length > 0) {
      const qRows = quarantine.map((q) => ({
        'Fila Excel': q.rowIndex,
        Guía: q.rawRow.guia ?? '',
        Producto: q.rawRow.producto ?? '',
        'Cantidad Cruda': q.rawRow.cantDespacho ?? '',
        'Almacén Origen': q.rawRow.almacenDespacho ?? '',
        Transportista: q.rawRow.transportista ?? '',
        Patente: q.rawRow.patente ?? '',
        'Motivo Cuarentena': q.reasons.map((r) => `${r.field}: ${r.message}`).join(' | '),
      }));
      const qSheet = XLSX.utils.json_to_sheet(qRows);
      XLSX.utils.book_append_sheet(workbook, qSheet, 'Cuarentena');
    }

    XLSX.writeFile(workbook, `Reporte_Stokes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#F7F5F8] text-slate-800 p-4 md:p-7">
      <div className="max-w-[1500px] mx-auto space-y-5">
        <header className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl bg-purple-50 text-[#461D77] hover:bg-purple-100 transition-colors cursor-pointer"
              aria-label="Volver"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-xs font-semibold text-slate-500">Reporte Stokes · Mop 1 a Mop 6</p>
              <h1 className="text-2xl font-black text-[#461D77] tracking-tight">Ingesta Defensiva y Analítica Stokes</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Validación estricta con Zod, aislamiento en cuarentena de filas corruptas y respaldo offline en IndexedDB.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
            {!isOnline && (
              <span className="inline-flex items-center gap-1.5 text-amber-700 font-bold">
                <WifiOff size={14} /> Modo offline activo
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
              <ShieldCheck size={15} /> Motor Zod + Cuarentena activo
            </span>
          </div>
        </header>

        <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 flex gap-3 text-blue-950">
          <Info className="shrink-0 mt-0.5 text-blue-700" size={18} />
          <div className="text-sm">
            <p className="font-bold">Autenticación directa en el servidor corporativo ReportServer</p>
            <p className="text-blue-900/80 mt-0.5">
              Despacho-Litio procesa el Excel localmente sin enviar contraseñas. Las filas con datos dañados se aíslan en{' '}
              <strong>Cuarentena</strong> sin interrumpir el resto del reporte.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
          <section className="bg-white rounded-2xl border border-slate-200 p-5 h-fit space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldCheck className="text-emerald-600" size={18} />
                <h2 className="font-bold text-slate-900 text-sm">1. ReportServer Corporativo</h2>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Genera <strong>Historico_guia_transportista</strong> con tus credenciales de red y expórtalo como Excel.
              </p>
              <button
                onClick={abrirStokes}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <ExternalLink size={15} /> Abrir Stokes en ReportServer
              </button>
            </div>

            <div className="border-t border-slate-100" />

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <UploadCloud className="text-[#461D77]" size={18} />
                <h2 className="font-bold text-slate-900 text-sm">2. Cargar Excel Stokes</h2>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Validación automática de plantas Mop 1–6, tonelajes, fechas y patentes.
              </p>
              <label className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#461D77] hover:bg-[#35145b] text-white cursor-pointer font-bold text-xs transition-colors whitespace-nowrap">
                <FileSpreadsheet size={15} /> Seleccionar Excel Stokes
                <input type="file" accept=".xlsx,.xls" onChange={cargarExcel} className="hidden" />
              </label>
            </div>

            {summary && (
              <div className="border-t border-slate-100 pt-4 space-y-2 text-xs">
                <div className="font-bold text-slate-700">Resumen de Ingesta</div>
                <div className="flex justify-between text-slate-600 tabular-nums">
                  <span>Filas válidas:</span>
                  <span className="font-mono font-bold text-emerald-700">{summary.validCount}</span>
                </div>
                <div className="flex justify-between text-slate-600 tabular-nums">
                  <span>En cuarentena:</span>
                  <span className={`font-mono font-bold ${summary.quarantinedCount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                    {summary.quarantinedCount}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 tabular-nums">
                  <span>Tiempo de parseo:</span>
                  <span className="font-mono font-bold text-slate-800">{summary.durationMs} ms</span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs flex gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <strong>Error de lectura:</strong> {error}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4 min-w-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500 font-semibold">Guías válidas</div>
                <div className="text-2xl font-black text-[#461D77] mt-1 font-mono">
                  {datosFiltrados.length.toLocaleString('es-CL')}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500 font-semibold">Tonelaje acumulado</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {resumen.toneladas.toLocaleString('es-CL', { maximumFractionDigits: 1 })}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500 font-semibold">Equipos únicos</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{resumen.equipos}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500 font-semibold">En cuarentena</div>
                <div
                  className={`text-2xl font-black mt-1 font-mono ${
                    quarantine.length > 0 ? 'text-amber-600' : 'text-slate-900'
                  }`}
                >
                  {quarantine.length}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                      <Database size={16} className="text-[#461D77]" /> Datos Operacionales Stokes
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      {ultimaActualizacion
                        ? `Última sincronización local · ${new Date(ultimaActualizacion).toLocaleString('es-CL')}`
                        : 'Sin datos cargados en esta sesión'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Filtrar guía, patente, empresa…"
                        className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:bg-white focus:border-[#461D77] outline-none w-56"
                      />
                    </div>
                    <button
                      onClick={exportarExcel}
                      disabled={!datosFiltrados.length}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Download size={14} /> Exportar Excel
                    </button>
                  </div>
                </div>

                {/* Pestañas de vista y filtro por planta Mop 1-6 */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setActiveTab('valid')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        activeTab === 'valid'
                          ? 'bg-white text-[#461D77] shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Guías Válidas ({datosFiltrados.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('quarantine')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === 'quarantine'
                          ? 'bg-white text-amber-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ShieldAlert size={13} />
                      <span>Cuarentena ({quarantine.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('logs')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === 'logs'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Terminal size={13} />
                      <span>Bitácora ({logs.length})</span>
                    </button>
                  </div>

                  {activeTab === 'valid' && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {MOP_FILTERS.map((plant) => (
                        <button
                          key={plant}
                          type="button"
                          onClick={() => setMopFilter(plant)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                            mopFilter === plant
                              ? 'bg-[#461D77] text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {plant}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {activeTab === 'valid' && (
                <>
                  {!datos.length ? (
                    <div className="py-20 text-center text-slate-400">
                      <FileSpreadsheet size={40} className="mx-auto mb-3 text-slate-300" />
                      <div className="font-bold text-slate-600">Aún no hay datos Stokes cargados</div>
                      <p className="text-xs mt-1">
                        Abre ReportServer, exporta el reporte y selecciona el Excel para validarlo con Zod.
                      </p>
                    </div>
                  ) : (
                    <VirtualizedDataTable
                      data={datosFiltrados}
                      columns={columns}
                      estimateRowHeight={40}
                      maxHeightPx={580}
                    />
                  )}
                </>
              )}

              {activeTab === 'quarantine' && (
                <div className="max-h-[580px] overflow-auto">
                  {quarantine.length === 0 ? (
                    <div className="py-16 text-center text-slate-500 text-sm">
                      Sin registros rechazados. Todas las filas superaron la validación Zod.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left border-collapse tabular-nums">
                      <thead className="sticky top-0 bg-amber-700 text-white">
                        <tr>
                          <th className="px-3 py-2.5 font-bold">Fila Excel</th>
                          <th className="px-3 py-2.5 font-bold">Guía</th>
                          <th className="px-3 py-2.5 font-bold">Origen Crudo</th>
                          <th className="px-3 py-2.5 font-bold">Cantidad Cruda</th>
                          <th className="px-3 py-2.5 font-bold">Motivo de Cuarentena (Zod)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 bg-amber-50/30">
                        {quarantine.map((item) => (
                          <tr key={`${item.rowIndex}-${item.timestamp}`} className="hover:bg-amber-50">
                            <td className="px-3 py-2.5 font-mono font-bold text-amber-800">#{item.rowIndex}</td>
                            <td className="px-3 py-2.5 font-mono">{String(item.rawRow.guia || '—')}</td>
                            <td className="px-3 py-2.5 text-slate-700">{String(item.rawRow.almacenDespacho || '—')}</td>
                            <td className="px-3 py-2.5 font-mono text-slate-700">
                              {String(item.rawRow.cantDespacho ?? 'null')}
                            </td>
                            <td className="px-3 py-2.5 text-rose-700 font-medium">
                              {item.reasons.map((r) => `${r.field}: ${r.message}`).join(' · ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="max-h-[580px] overflow-auto divide-y divide-slate-100 font-mono text-[11px] bg-slate-950 text-slate-200">
                  {logs.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 font-sans text-sm">
                      No hay eventos de parseo registrados todavía.
                    </div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={`${log.timestamp}-${i}`} className="px-4 py-2 flex items-start gap-3">
                        <span className="text-slate-500 shrink-0 tabular-nums">
                          {new Date(log.timestamp).toLocaleTimeString('es-CL')}
                        </span>
                        <span
                          className={`shrink-0 font-bold uppercase w-12 ${
                            log.level === 'error'
                              ? 'text-rose-400'
                              : log.level === 'warn'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {log.level}
                        </span>
                        <span className="text-purple-300 shrink-0">{log.code}</span>
                        <span className="text-slate-200">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-500 flex items-start gap-2">
          <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          <p>
            <strong className="text-slate-700">Privacidad y Resiliencia:</strong> el archivo Excel se valida en memoria con Zod,
            se cachea en IndexedDB para lectura offline y nunca expone credenciales corporativas.
          </p>
        </div>
      </div>
    </div>
  );
};

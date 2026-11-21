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
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F2] p-6">
        <div className="bg-[#FFFFFF] p-8 rounded-lg border border-[#E2DFD7] max-w-md text-center space-y-4">
          <ShieldCheck className="w-9 h-9 text-[#461D77] mx-auto" />
          <h2 className="text-lg font-bold text-[#1C1917]">Sesión requerida</h2>
          <p className="text-sm text-[#57534E]">Debes iniciar sesión en Despacho-Litio para utilizar Reporte Stokes.</p>
          <button onClick={onBack} className="w-full py-2.5 bg-[#461D77] hover:bg-[#36155E] text-white rounded-md font-semibold text-xs uppercase tracking-wider cursor-pointer transition-colors duration-150">
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
          <span className="font-mono font-semibold text-[#461D77] tabular-nums">{String(info.getValue())}</span>
        ),
      },
      {
        accessorKey: 'fechaGuia',
        header: 'Fecha',
        size: 105,
        cell: (info) => <span className="font-mono text-[#57534E] tabular-nums">{String(info.getValue())}</span>,
      },
      {
        accessorKey: 'producto',
        header: 'Producto',
        size: 150,
        cell: (info) => <span className="font-semibold text-[#1C1917]">{String(info.getValue())}</span>,
      },
      {
        accessorKey: 'cantDespacho',
        header: () => <span className="block text-right">TON</span>,
        size: 95,
        cell: (info) => (
          <span className="block text-right font-mono font-semibold text-[#1C1917] tabular-nums">
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
        cell: (info) => <span className="text-[#57534E]">{String(info.getValue())}</span>,
      },
      {
        accessorKey: 'mopPlant',
        header: 'Planta / Origen',
        size: 130,
        cell: (info) => {
          const item = info.row.original;
          return item.origenStokes === 'Salar' ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[#15803D] font-semibold">
              <CheckCircle2 size={13} />
              <span>Salar{item.mopPlant ? ` · ${item.mopPlant}` : ''}</span>
            </span>
          ) : (
            <span className="text-[#57534E]">{item.origenStokes}</span>
          );
        },
      },
      {
        accessorKey: 'almacenDestino',
        header: 'Destino',
        size: 170,
        cell: (info) => <span className="text-[#1C1917]">{String(info.getValue())}</span>,
      },
      {
        accessorKey: 'transportista',
        header: 'Transportista',
        size: 190,
        cell: (info) => <span className="font-medium text-[#1C1917]">{String(info.getValue())}</span>,
      },
      {
        accessorKey: 'patenteCamion',
        header: 'Patente',
        size: 105,
        cell: (info) => (
          <span className="font-mono font-semibold text-[#1C1917] tabular-nums">{String(info.getValue())}</span>
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
    <div className="min-h-screen bg-[#F7F6F2] text-[#1C1917] p-4 md:p-6">
      <div className="max-w-[102rem] mx-auto space-y-5">
        <header className="bg-[#FFFFFF] rounded-lg border border-[#E2DFD7] p-5 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-md bg-[#EFECE6] border border-[#E2DFD7] text-[#1C1917] hover:border-[#461D77] hover:text-[#461D77] transition-colors duration-150 cursor-pointer"
              aria-label="Volver"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
                Reporte Stokes · Mop 1 a Mop 6
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-[#1C1917] tracking-tight">
                Ingesta Defensiva y Analítica Stokes
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px] font-semibold">
            {!isOnline && (
              <span className="inline-flex items-center gap-1.5 text-[#B45309]">
                <WifiOff size={14} /> Offline
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-[#15803D] bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
              <ShieldCheck size={14} /> Validación Zod + IndexedDB
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-5">
          {/* Left Rail */}
          <section className="bg-[#FFFFFF] rounded-lg border border-[#E2DFD7] p-5 h-fit space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[11px] font-bold text-[#461D77]">01</span>
                <h2 className="font-bold text-[#1C1917] text-sm">ReportServer Corporativo</h2>
              </div>
              <p className="text-xs text-[#57534E] mb-3 leading-relaxed">
                Genere <strong>Historico_guia_transportista</strong> con credenciales de red y expórtelo como Excel.
              </p>
              <button
                onClick={abrirStokes}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-[#EFECE6] hover:bg-[#E2DFD7] border border-[#E2DFD7] text-[#1C1917] font-semibold text-xs transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <ExternalLink size={14} /> Abrir Stokes en ReportServer
              </button>
            </div>

            <div className="border-t border-[#E2DFD7]" />

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[11px] font-bold text-[#461D77]">02</span>
                <h2 className="font-bold text-[#1C1917] text-sm">Cargar Excel Stokes</h2>
              </div>
              <p className="text-xs text-[#57534E] mb-3 leading-relaxed">
                Validación local de plantas Mop 1–6, tonelajes, fechas y patentes sin enviar credenciales.
              </p>
              <label className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-[#461D77] hover:bg-[#36155E] text-white cursor-pointer font-semibold text-xs transition-colors duration-150 whitespace-nowrap">
                <UploadCloud size={15} /> Seleccionar Excel Stokes
                <input type="file" accept=".xlsx,.xls" onChange={cargarExcel} className="hidden" />
              </label>
            </div>

            {summary && (
              <div className="border-t border-[#E2DFD7] pt-4 space-y-2 text-xs">
                <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
                  Resumen de Ingesta
                </div>
                <div className="flex justify-between text-[#57534E] tabular-nums">
                  <span>Filas válidas:</span>
                  <span className="font-mono font-bold text-[#15803D]">{summary.validCount}</span>
                </div>
                <div className="flex justify-between text-[#57534E] tabular-nums">
                  <span>En cuarentena:</span>
                  <span className={`font-mono font-bold ${summary.quarantinedCount > 0 ? 'text-[#B45309]' : 'text-[#1C1917]'}`}>
                    {summary.quarantinedCount}
                  </span>
                </div>
                <div className="flex justify-between text-[#57534E] tabular-nums">
                  <span>Tiempo de parseo:</span>
                  <span className="font-mono font-bold text-[#1C1917]">{summary.durationMs} ms</span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-[#B91C1C] rounded-md p-3 text-xs flex gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div>
                  <strong>Error:</strong> {error}
                </div>
              </div>
            )}

            <div className="border-t border-[#E2DFD7] pt-4 text-[11px] text-[#57534E] flex items-start gap-2">
              <Info size={14} className="text-[#461D77] shrink-0 mt-0.5" />
              <span>
                Las filas con errores de esquema se aíslan en Cuarentena sin detener la ingesta.
              </span>
            </div>
          </section>

          {/* Right Main Workspace */}
          <section className="space-y-4 min-w-0">
            {/* Hairline-divided KPI strip */}
            <div className="bg-[#FFFFFF] rounded-lg border border-[#E2DFD7] overflow-hidden">
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 sm:divide-x divide-[#E2DFD7] tabular-nums">
                <div className="p-4">
                  <div className="text-[11px] text-[#57534E] font-semibold uppercase tracking-wider">Guías válidas</div>
                  <div className="text-2xl font-bold text-[#461D77] mt-1 font-mono">
                    {datosFiltrados.length.toLocaleString('es-CL')}
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-[11px] text-[#57534E] font-semibold uppercase tracking-wider">Tonelaje acumulado</div>
                  <div className="text-2xl font-bold text-[#1C1917] mt-1 font-mono">
                    {resumen.toneladas.toLocaleString('es-CL', { maximumFractionDigits: 1 })}
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-[11px] text-[#57534E] font-semibold uppercase tracking-wider">Equipos únicos</div>
                  <div className="text-2xl font-bold text-[#1C1917] mt-1 font-mono">{resumen.equipos}</div>
                </div>
                <div className="p-4">
                  <div className="text-[11px] text-[#57534E] font-semibold uppercase tracking-wider">En cuarentena</div>
                  <div
                    className={`text-2xl font-bold mt-1 font-mono ${
                      quarantine.length > 0 ? 'text-[#B45309]' : 'text-[#1C1917]'
                    }`}
                  >
                    {quarantine.length}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#FFFFFF] rounded-lg border border-[#E2DFD7] overflow-hidden">
              <div className="p-4 border-b border-[#E2DFD7] flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-[#1C1917] flex items-center gap-2 text-sm">
                      <Database size={15} className="text-[#461D77]" /> Datos Operacionales Stokes
                    </div>
                    <div className="font-mono text-[11px] text-[#57534E] mt-0.5 tabular-nums">
                      {ultimaActualizacion
                        ? `Última sincronización local · ${new Date(ultimaActualizacion).toLocaleString('es-CL')}`
                        : 'Sin datos cargados en esta sesión'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#57534E]" />
                      <input
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Filtrar guía, patente, empresa…"
                        className="pl-8 pr-3 py-1.5 rounded-md border border-[#E2DFD7] bg-[#F7F6F2] text-xs font-medium focus:bg-[#FFFFFF] focus:border-[#461D77] outline-none w-56 transition-colors duration-150"
                      />
                    </div>
                    <button
                      onClick={exportarExcel}
                      disabled={!datosFiltrados.length}
                      className="px-3.5 py-1.5 rounded-md bg-[#461D77] hover:bg-[#36155E] disabled:bg-[#E2DFD7] disabled:text-[#57534E] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                    >
                      <Download size={14} /> Exportar Excel
                    </button>
                  </div>
                </div>

                {/* Pestañas de vista y filtro por planta Mop 1-6 */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1 p-1 bg-[#EFECE6] border border-[#E2DFD7] rounded-md">
                    <button
                      type="button"
                      onClick={() => setActiveTab('valid')}
                      className={`px-3 py-1 text-xs font-semibold rounded transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                        activeTab === 'valid'
                          ? 'bg-[#FFFFFF] text-[#461D77] border border-[#E2DFD7]'
                          : 'text-[#57534E] hover:text-[#1C1917]'
                      }`}
                    >
                      Guías Válidas (<span className="font-mono tabular-nums">{datosFiltrados.length}</span>)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('quarantine')}
                      className={`px-3 py-1 text-xs font-semibold rounded transition-colors duration-150 cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === 'quarantine'
                          ? 'bg-[#FFFFFF] text-[#B45309] border border-[#E2DFD7]'
                          : 'text-[#57534E] hover:text-[#1C1917]'
                      }`}
                    >
                      <ShieldAlert size={13} />
                      <span>Cuarentena (<span className="font-mono tabular-nums">{quarantine.length}</span>)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('logs')}
                      className={`px-3 py-1 text-xs font-semibold rounded transition-colors duration-150 cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === 'logs'
                          ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E2DFD7]'
                          : 'text-[#57534E] hover:text-[#1C1917]'
                      }`}
                    >
                      <Terminal size={13} />
                      <span>Bitácora (<span className="font-mono tabular-nums">{logs.length}</span>)</span>
                    </button>
                  </div>

                  {activeTab === 'valid' && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {MOP_FILTERS.map((plant) => (
                        <button
                          key={plant}
                          type="button"
                          onClick={() => setMopFilter(plant)}
                          className={`px-2.5 py-1 font-mono text-[11px] font-semibold rounded-md border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                            mopFilter === plant
                              ? 'bg-[#461D77] border-[#461D77] text-white'
                              : 'bg-[#F7F6F2] border-[#E2DFD7] text-[#57534E] hover:bg-[#EFECE6]'
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
                    <div className="py-16 text-center text-[#57534E]">
                      <FileSpreadsheet size={34} className="mx-auto mb-3 text-[#C7C2B6]" />
                      <div className="font-semibold text-sm text-[#1C1917]">Aún no hay datos Stokes cargados</div>
                      <p className="text-xs mt-1">
                        Exporte el reporte desde ReportServer y seleccione el Excel para validarlo.
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
                    <div className="py-16 text-center text-[#57534E] text-sm">
                      Sin registros rechazados. Todas las filas superaron la validación Zod.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left border-collapse tabular-nums">
                      <thead className="sticky top-0 bg-[#EFECE6] text-[#1C1917] border-b border-[#E2DFD7] font-mono">
                        <tr>
                          <th className="px-3 py-2.5 font-semibold">Fila Excel</th>
                          <th className="px-3 py-2.5 font-semibold">Guía</th>
                          <th className="px-3 py-2.5 font-semibold">Origen Crudo</th>
                          <th className="px-3 py-2.5 font-semibold">Cantidad Cruda</th>
                          <th className="px-3 py-2.5 font-semibold">Motivo de Cuarentena (Zod)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2DFD7]">
                        {quarantine.map((item) => (
                          <tr key={`${item.rowIndex}-${item.timestamp}`} className="hover:bg-[#F7F6F2]">
                            <td className="px-3 py-2.5 font-mono font-bold text-[#B45309]">#{item.rowIndex}</td>
                            <td className="px-3 py-2.5 font-mono">{String(item.rawRow.guia || '—')}</td>
                            <td className="px-3 py-2.5 text-[#1C1917]">{String(item.rawRow.almacenDespacho || '—')}</td>
                            <td className="px-3 py-2.5 font-mono text-[#57534E]">
                              {String(item.rawRow.cantDespacho ?? 'null')}
                            </td>
                            <td className="px-3 py-2.5 text-[#B91C1C] font-medium">
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
                <div className="max-h-[580px] overflow-auto divide-y divide-stone-800 font-mono text-[11px] bg-[#1C1917] text-stone-200">
                  {logs.length === 0 ? (
                    <div className="py-16 text-center text-stone-400 font-sans text-sm">
                      No hay eventos de parseo registrados todavía.
                    </div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={`${log.timestamp}-${i}`} className="px-4 py-2 flex items-start gap-3">
                        <span className="text-stone-400 shrink-0 tabular-nums">
                          {new Date(log.timestamp).toLocaleTimeString('es-CL')}
                        </span>
                        <span
                          className={`shrink-0 font-bold uppercase w-12 ${
                            log.level === 'error'
                              ? 'text-red-400'
                              : log.level === 'warn'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {log.level}
                        </span>
                        <span className="text-stone-300 shrink-0">{log.code}</span>
                        <span className="text-stone-200">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

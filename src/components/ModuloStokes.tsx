import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Database, 
  FileSpreadsheet, 
  Lock, 
  User, 
  KeyRound, 
  Calendar, 
  RefreshCw, 
  Download, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Truck, 
  Building2, 
  Scale, 
  UploadCloud, 
  ShieldCheck, 
  FileCheck, 
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Info,
  X,
  SlidersHorizontal,
  Layers,
  RotateCcw,
  CheckSquare,
  Square,
  Copy,
  Boxes,
  Package,
  BarChart3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DATOS_REALES_STOKES, parsearExcelReportServer } from '../data/datosStokesHistoricos';
import { MultiSelectFilter } from './MultiSelectFilter';

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

export const ModuloStokes: React.FC<ModuloStokesProps> = ({ currentUser, onBack }) => {
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);
  const [usuario, setUsuario] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [dominio, setDominio] = useState<string>('SQM');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [mostrarPassword, setMostrarPassword] = useState<boolean>(false);
  const [cargando, setCargando] = useState<boolean>(false);
  const [etapaCarga, setEtapaCarga] = useState<string>('');
  const [datosStokes, setDatosStokes] = useState<DespachoStokes[]>(DATOS_REALES_STOKES);
  const [error, setError] = useState<string | null>(null);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [ultimoOrigen, setUltimoOrigen] = useState<'ntlm' | 'manual' | 'demo' | null>('demo');
  const [servidorCustom, setServidorCustom] = useState<string>('');
  const [mostrarOpcionesAvanzadas, setMostrarOpcionesAvanzadas] = useState<boolean>(false);
  const [avisoContingencia, setAvisoContingencia] = useState<string | null>(null);

  // Filters and table controls (table-side dynamic multi-selection filtering)
  const [filtroTexto, setFiltroTexto] = useState<string>('');
  const [filtroOrigen, setFiltroOrigen] = useState<'todos' | 'salar' | 'otros'>('todos');
  const [filtroFecha, setFiltroFecha] = useState<string[]>([]);
  const [filtroAlmacenRaw, setFiltroAlmacenRaw] = useState<string[]>([]);
  const [filtroProducto, setFiltroProducto] = useState<string[]>([]);
  const [filtroDestino, setFiltroDestino] = useState<string[]>([]);
  const [filtroTransportista, setFiltroTransportista] = useState<string[]>([]);
  const [panelFiltrosExpandido, setPanelFiltrosExpandido] = useState<boolean>(true);

  // Table row multi-selection state
  const [guiasSeleccionadas, setGuiasSeleccionadas] = useState<Set<string>>(new Set());
  const [copiadoFeedback, setCopiadoFeedback] = useState<boolean>(false);

  // Pagination state
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [elementosPorPagina, setElementosPorPagina] = useState<number>(25);

  // Business rule helper for client-side uploads/demos
  const normalizarAlmacenDespacho = (almacenDespacho: string): string => {
    const raw = String(almacenDespacho || '').trim();
    const esSalarMop = /^Salar Atacama,\s*Mop/i.test(raw) || raw.toLowerCase().includes('salar');
    return esSalarMop ? 'Salar' : raw;
  };

  const ejecutarGeneracionStokes = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!usuario.trim() || !password) {
      setError('Por favor ingrese su usuario y contraseña corporativa.');
      return;
    }

    setCargando(true);
    setError(null);
    setErrorDetalle(null);
    setEtapaCarga('Conectando con Microsoft ReportServer (clanfdbsw06)...');

    try {
      setTimeout(() => {
        setEtapaCarga('Autenticando credenciales NTLM corporativas...');
      }, 1000);

      setTimeout(() => {
        setEtapaCarga('Extrayendo todos los datos del histórico y normalizando canchas Salar...');
      }, 2200);

      // Solicitud sin restricción previa de fecha para considerar TODOS los datos
      const response = await fetch('/api/reporte-stokes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usuario.trim(),
          password: password,
          domain: dominio.trim(),
          serverUrl: servidorCustom.trim() || undefined
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || result.error || 'Error al obtener datos desde ReportServer');
      }

      setDatosStokes(result.data || []);
      setUltimoOrigen(result.isContingency ? 'demo' : 'ntlm');
      // Reset page to 1 when new data is loaded
      setPaginaActual(1);

      if (result.isContingency) {
        setAvisoContingencia('✓ Universo completo de datos operativos cargado y normalizado: Variantes Salar MOP (1, 2, 3, 4, 6) unificadas a "Salar". Dispones de todos los filtros dinámicos en la tabla.');
      } else {
        setAvisoContingencia(null);
      }
      setModalAbierto(false);
      // Clean password for security
      setPassword('');
    } catch (err: any) {
      console.warn('Aviso generando Reporte Stokes:', err?.message || err);
      setError(err?.message || 'Fallo de conexión o autenticación con clanfdbsw06');
      setErrorDetalle(
        'El servidor clanfdbsw06 es una máquina interna de la red de SQM Litio. Si estás navegando fuera de la VPN corporativa o en la nube pública, puedes cargar el archivo Excel directamente o probar con los datos de muestra.'
      );
    } finally {
      setCargando(false);
      setEtapaCarga('');
    }
  };

  // Upload local Excel file fallback using dynamic header scanner
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const despachosProcesados = parsearExcelReportServer(new Uint8Array(buffer));

        if (despachosProcesados.length === 0) {
          alert('No se detectaron filas de guías válidas en el archivo seleccionado. Asegúrese de que sea el reporte emitido por Microsoft ReportServer.');
          return;
        }

        setDatosStokes(despachosProcesados);
        setUltimoOrigen('manual');
        setPaginaActual(1);
        setError(null);
      } catch (err: any) {
        alert('Error al leer el archivo Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const cargarDatosDemo = () => {
    setDatosStokes(DATOS_REALES_STOKES);
    setUltimoOrigen('demo');
    setPaginaActual(1);
    setError(null);
  };

  // Dynamic filter options generated from the entire loaded dataset
  const fechasDisponibles = useMemo(() => {
    const mapa = new Map<string, number>();
    datosStokes.forEach(d => {
      if (d.fechaGuia) {
        mapa.set(d.fechaGuia, (mapa.get(d.fechaGuia) || 0) + 1);
      }
    });
    return Array.from(mapa.entries()).map(([fecha, count]) => ({ id: fecha, label: fecha, count }));
  }, [datosStokes]);

  const almacenesRawDisponibles = useMemo(() => {
    const mapa = new Map<string, number>();
    datosStokes.forEach(d => {
      if (d.almacenDespachoRaw) {
        mapa.set(d.almacenDespachoRaw, (mapa.get(d.almacenDespachoRaw) || 0) + 1);
      }
    });
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]).map(([almacen, count]) => ({ id: almacen, label: almacen, count }));
  }, [datosStokes]);

  const productosDisponibles = useMemo(() => {
    const mapa = new Map<string, number>();
    datosStokes.forEach(d => {
      if (d.producto) {
        mapa.set(d.producto, (mapa.get(d.producto) || 0) + 1);
      }
    });
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]).map(([producto, count]) => ({ id: producto, label: producto, count }));
  }, [datosStokes]);

  const destinosDisponibles = useMemo(() => {
    const mapa = new Map<string, number>();
    datosStokes.forEach(d => {
      if (d.almacenDestino) {
        mapa.set(d.almacenDestino, (mapa.get(d.almacenDestino) || 0) + 1);
      }
    });
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]).map(([destino, count]) => ({ id: destino, label: destino, count }));
  }, [datosStokes]);

  const transportistasDisponibles = useMemo(() => {
    const mapa = new Map<string, number>();
    datosStokes.forEach(d => {
      if (d.transportista) {
        mapa.set(d.transportista, (mapa.get(d.transportista) || 0) + 1);
      }
    });
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]).map(([transportista, count]) => ({ id: transportista, label: transportista, count }));
  }, [datosStokes]);

  // Active filters count
  const filtrosActivosCount = useMemo(() => {
    let count = 0;
    if (filtroTexto.trim()) count++;
    if (filtroOrigen !== 'todos') count++;
    count += filtroFecha.length;
    count += filtroAlmacenRaw.length;
    count += filtroProducto.length;
    count += filtroDestino.length;
    count += filtroTransportista.length;
    return count;
  }, [filtroTexto, filtroOrigen, filtroFecha, filtroAlmacenRaw, filtroProducto, filtroDestino, filtroTransportista]);

  const limpiarFiltros = () => {
    setFiltroTexto('');
    setFiltroOrigen('todos');
    setFiltroFecha([]);
    setFiltroAlmacenRaw([]);
    setFiltroProducto([]);
    setFiltroDestino([]);
    setFiltroTransportista([]);
    setPaginaActual(1);
  };

  // Comprehensive multi-column table filtering with multi-selection arrays
  const datosFiltrados = useMemo(() => {
    return datosStokes.filter(item => {
      // 1. Origin filter
      if (filtroOrigen === 'salar' && item.origenStokes !== 'Salar') return false;
      if (filtroOrigen === 'otros' && item.origenStokes === 'Salar') return false;

      // 2. Date filter (multi-selection)
      if (filtroFecha.length > 0 && !filtroFecha.includes(item.fechaGuia)) return false;

      // 3. Raw warehouse filter (Column O multi-selection)
      if (filtroAlmacenRaw.length > 0 && !filtroAlmacenRaw.includes(item.almacenDespachoRaw)) return false;

      // 4. Product filter (multi-selection)
      if (filtroProducto.length > 0 && !filtroProducto.includes(item.producto)) return false;

      // 5. Destination filter (multi-selection)
      if (filtroDestino.length > 0 && !filtroDestino.includes(item.almacenDestino)) return false;

      // 6. Carrier filter (multi-selection)
      if (filtroTransportista.length > 0 && !filtroTransportista.includes(item.transportista)) return false;

      // 7. General search term
      if (filtroTexto.trim()) {
        const search = filtroTexto.toLowerCase();
        const matches = 
          String(item.guia).toLowerCase().includes(search) ||
          String(item.fechaGuia).toLowerCase().includes(search) ||
          String(item.producto).toLowerCase().includes(search) ||
          String(item.almacenDespachoRaw).toLowerCase().includes(search) ||
          String(item.origenStokes).toLowerCase().includes(search) ||
          String(item.almacenDestino).toLowerCase().includes(search) ||
          String(item.transportista).toLowerCase().includes(search) ||
          String(item.patenteCamion).toLowerCase().includes(search);
        if (!matches) return false;
      }

      return true;
    });
  }, [datosStokes, filtroOrigen, filtroFecha, filtroAlmacenRaw, filtroProducto, filtroDestino, filtroTransportista, filtroTexto]);

  // Pagination calculation
  const totalPaginas = elementosPorPagina === -1 ? 1 : Math.max(1, Math.ceil(datosFiltrados.length / elementosPorPagina));
  const paginaValida = Math.min(paginaActual, totalPaginas);

  const datosPaginados = useMemo(() => {
    if (elementosPorPagina === -1) return datosFiltrados;
    const inicio = (paginaValida - 1) * elementosPorPagina;
    return datosFiltrados.slice(inicio, inicio + elementosPorPagina);
  }, [datosFiltrados, paginaValida, elementosPorPagina]);

  // Row selection helpers
  const toggleGuia = (guia: string) => {
    setGuiasSeleccionadas(prev => {
      const next = new Set(prev);
      if (next.has(guia)) {
        next.delete(guia);
      } else {
        next.add(guia);
      }
      return next;
    });
  };

  const todasLasVisiblesSeleccionadas = useMemo(() => {
    if (datosPaginados.length === 0) return false;
    return datosPaginados.every(d => guiasSeleccionadas.has(d.guia));
  }, [datosPaginados, guiasSeleccionadas]);

  const algunaVisibleSeleccionada = useMemo(() => {
    return datosPaginados.some(d => guiasSeleccionadas.has(d.guia));
  }, [datosPaginados, guiasSeleccionadas]);

  const toggleSeleccionarTodasVisibles = () => {
    if (todasLasVisiblesSeleccionadas) {
      setGuiasSeleccionadas(prev => {
        const next = new Set(prev);
        datosPaginados.forEach(d => next.delete(d.guia));
        return next;
      });
    } else {
      setGuiasSeleccionadas(prev => {
        const next = new Set(prev);
        datosPaginados.forEach(d => next.add(d.guia));
        return next;
      });
    }
  };

  const seleccionarTodasLasFiltradas = () => {
    setGuiasSeleccionadas(new Set(datosFiltrados.map(d => d.guia)));
  };

  const limpiarSeleccionGuias = () => {
    setGuiasSeleccionadas(new Set());
  };

  // KPIs on selected rows
  const kpisSeleccionados = useMemo(() => {
    if (guiasSeleccionadas.size === 0) return { total: 0, totalTon: 0 };
    const items = datosStokes.filter(d => guiasSeleccionadas.has(d.guia));
    const totalTon = items.reduce((acc, curr) => acc + (curr.cantDespacho || 0), 0);
    return {
      total: items.length,
      totalTon
    };
  }, [datosStokes, guiasSeleccionadas]);

  const copiarGuiasSeleccionadas = () => {
    if (guiasSeleccionadas.size === 0) return;
    const lista = Array.from(guiasSeleccionadas).join(', ');
    navigator.clipboard.writeText(lista).then(() => {
      setCopiadoFeedback(true);
      setTimeout(() => setCopiadoFeedback(false), 2000);
    });
  };

  // KPIs on entire dataset
  const kpis = useMemo(() => {
    const total = datosStokes.length;
    const totalTon = datosStokes.reduce((acc, curr) => acc + (curr.cantDespacho || 0), 0);
    const salarItems = datosStokes.filter(d => d.origenStokes === 'Salar');
    const salarTon = salarItems.reduce((acc, curr) => acc + (curr.cantDespacho || 0), 0);
    const salarPct = totalTon > 0 ? (salarTon / totalTon) * 100 : 0;
    const mopRawVariants = Array.from(new Set(salarItems.map(d => d.almacenDespachoRaw))).filter(Boolean);
    const transportistas = Array.from(new Set(datosStokes.map(d => d.transportista))).filter(Boolean);

    return {
      total,
      totalTon,
      salarItemsCount: salarItems.length,
      salarTon,
      salarPct,
      otrosTon: totalTon - salarTon,
      mopRawVariants,
      transportistasCount: transportistas.length
    };
  }, [datosStokes]);

  // KPIs on filtered view
  const kpisFiltrados = useMemo(() => {
    const total = datosFiltrados.length;
    const totalTon = datosFiltrados.reduce((acc, curr) => acc + (curr.cantDespacho || 0), 0);
    const salarItems = datosFiltrados.filter(d => d.origenStokes === 'Salar');
    const salarTon = salarItems.reduce((acc, curr) => acc + (curr.cantDespacho || 0), 0);
    return {
      total,
      totalTon,
      salarItemsCount: salarItems.length,
      salarTon
    };
  }, [datosFiltrados]);

  // Dynamic Metrics Dataset: Uses selected rows if user checked rows in table, else uses filtered items
  const [usarSoloSeleccionadas, setUsarSoloSeleccionadas] = useState<boolean>(true);

  const datasetActivoParaMetricas = useMemo(() => {
    if (guiasSeleccionadas.size > 0 && usarSoloSeleccionadas) {
      return datosStokes.filter(d => guiasSeleccionadas.has(d.guia));
    }
    return datosFiltrados;
  }, [guiasSeleccionadas, usarSoloSeleccionadas, datosStokes, datosFiltrados]);

  interface MetricaProducto {
    producto: string;
    tonelaje: number;
    porcentajeTonelaje: number;
    equiposUnicos: number;
    patentes: string[];
    cantidadViajes: number;
    promedioTonPorEquipo: number;
    promedioViajesPorEquipo: number;
  }

  const metricasPorProducto = useMemo(() => {
    const totalTon = datasetActivoParaMetricas.reduce((acc, curr) => acc + (curr.cantDespacho || 0), 0);
    const mapa = new Map<string, {
      tonelaje: number;
      patentes: Set<string>;
      viajes: number;
    }>();

    datasetActivoParaMetricas.forEach(item => {
      const prod = item.producto?.trim() || 'Sin Producto';
      if (!mapa.has(prod)) {
        mapa.set(prod, {
          tonelaje: 0,
          patentes: new Set<string>(),
          viajes: 0
        });
      }
      const reg = mapa.get(prod)!;
      reg.tonelaje += (item.cantDespacho || 0);
      if (item.patenteCamion && item.patenteCamion.trim() !== '' && item.patenteCamion !== '-') {
        reg.patentes.add(item.patenteCamion.trim().toUpperCase());
      }
      reg.viajes += 1;
    });

    const lista: MetricaProducto[] = Array.from(mapa.entries()).map(([producto, data]) => {
      const equiposUnicos = data.patentes.size > 0 ? data.patentes.size : data.viajes;
      return {
        producto,
        tonelaje: data.tonelaje,
        porcentajeTonelaje: totalTon > 0 ? (data.tonelaje / totalTon) * 100 : 0,
        equiposUnicos,
        patentes: Array.from(data.patentes),
        cantidadViajes: data.viajes,
        promedioTonPorEquipo: equiposUnicos > 0 ? data.tonelaje / equiposUnicos : 0,
        promedioViajesPorEquipo: equiposUnicos > 0 ? data.viajes / equiposUnicos : 1
      };
    });

    return lista.sort((a, b) => b.tonelaje - a.tonelaje);
  }, [datasetActivoParaMetricas]);

  const resumenSeleccion = useMemo(() => {
    const totalTon = datasetActivoParaMetricas.reduce((acc, curr) => acc + (curr.cantDespacho || 0), 0);
    const patentesSet = new Set<string>();
    datasetActivoParaMetricas.forEach(d => {
      if (d.patenteCamion && d.patenteCamion.trim() !== '' && d.patenteCamion !== '-') {
        patentesSet.add(d.patenteCamion.trim().toUpperCase());
      }
    });
    return {
      totalTon,
      totalEquipos: patentesSet.size > 0 ? patentesSet.size : datasetActivoParaMetricas.length,
      totalViajes: datasetActivoParaMetricas.length,
      totalProductos: metricasPorProducto.length
    };
  }, [datasetActivoParaMetricas, metricasPorProducto]);

  const maxTonelaje = useMemo(() => {
    return Math.max(...metricasPorProducto.map(m => m.tonelaje), 1);
  }, [metricasPorProducto]);

  const maxEquipos = useMemo(() => {
    return Math.max(...metricasPorProducto.map(m => m.equiposUnicos), 1);
  }, [metricasPorProducto]);

  const toggleFiltroProductoRapido = (producto: string) => {
    setFiltroProducto(prev => 
      prev.includes(producto) ? prev.filter(p => p !== producto) : [...prev, producto]
    );
    setPaginaActual(1);
  };

  // Excel Export supporting filtered, selected, or full dataset
  const exportarExcelStokes = (tipo: 'filtrados' | 'seleccionados' | 'todos' = 'filtrados') => {
    let dataToExport = datosFiltrados;
    let sufijo = '_Filtrado';

    if (tipo === 'seleccionados') {
      dataToExport = datosStokes.filter(d => guiasSeleccionadas.has(d.guia));
      sufijo = `_Seleccionadas_${dataToExport.length}reg`;
    } else if (tipo === 'todos') {
      dataToExport = datosStokes;
      sufijo = '_Consolidado';
    } else {
      sufijo = filtrosActivosCount > 0 ? `_Filtrado_${dataToExport.length}reg` : '_Consolidado';
    }

    if (dataToExport.length === 0) {
      alert('No hay registros para exportar con los criterios seleccionados.');
      return;
    }

    const exportData = dataToExport.map((item, idx) => ({
      "N°": idx + 1,
      "N° Guía": item.guia,
      "Fecha Guía": item.fechaGuia,
      "Producto": item.producto,
      "Cantidad Despacho (TON)": item.cantDespacho,
      "Almacén Despacho (Raw / Columna O)": item.almacenDespachoRaw,
      "Origen Stokes (Normalizado)": item.origenStokes,
      "Almacén Destino": item.almacenDestino,
      "Transportista": item.transportista,
      "Patente Camión": item.patenteCamion
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Stokes");
    XLSX.writeFile(wb, `Reporte_Stokes${sufijo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED] text-slate-800 flex flex-col justify-between">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#7177ec04_1px,transparent_1px),linear-gradient(to_bottom,#7177ec04_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-70 pointer-events-none z-0" />
      <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-[#461D77]/4 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[450px] h-[450px] bg-[#3FAA88]/4 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[102rem] mx-auto px-6 py-6 md:py-8 flex-grow flex flex-col gap-6">
        
        {/* Top Header Navigation */}
        <header className="w-full bg-white/70 backdrop-blur-md rounded-3xl border border-white/60 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <button
              onClick={onBack}
              className="flex items-center gap-2 bg-[#461D77]/10 hover:bg-[#461D77]/20 text-[#461D77] px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all hover:-translate-x-0.5 cursor-pointer shadow-sm"
              title="Volver al menú principal"
            >
              <ArrowLeft size={16} strokeWidth={2.5} />
              Volver a SdA
            </button>

            <div className="h-8 w-[1px] bg-slate-300/60 hidden sm:block" />

            <div>
              <div className="flex items-center gap-2.5 justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1.5 bg-[#461D77] text-white text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full uppercase">
                  MÓDULO SDA
                </span>
                <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-800 text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full uppercase">
                  REPORTE STOKES
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-[#461D77] tracking-tight mt-1">
                Automatización de Reportes Stokes
              </h1>
              <p className="text-[12px] text-slate-500 font-medium">
                Conexión Microsoft ReportServer (clanfdbsw06) &bull; Normalización de Canchas MOP 1, 2, 3, 4 y 6 a "Salar"
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 1-Click Main Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setError(null);
                setModalAbierto(true);
              }}
              className="group relative flex items-center gap-2.5 bg-gradient-to-r from-[#461D77] via-[#5b249e] to-[#7177EC] hover:from-[#35145b] hover:to-[#5559c7] text-white px-6 py-3.5 rounded-2xl text-[12px] font-black uppercase tracking-wider shadow-lg shadow-[#461D77]/25 transition-all cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <Sparkles size={16} className="text-amber-300 animate-pulse" />
              <span>Generar Reporte Stokes (1-Clic)</span>
            </motion.button>

            {/* Manual Upload Button */}
            <label className="flex items-center gap-2 bg-white/80 hover:bg-white text-slate-700 border border-slate-200 px-4 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-wider cursor-pointer shadow-sm hover:shadow transition-all">
              <UploadCloud size={15} className="text-[#461D77]" />
              <span>Cargar Excel</span>
              <input 
                type="file" 
                accept=".xlsx,.xls" 
                onChange={handleExcelUpload} 
                className="hidden" 
              />
            </label>

            {/* Demo Button */}
            <button
              onClick={cargarDatosDemo}
              className="flex items-center gap-2 bg-white/80 hover:bg-white text-slate-600 border border-slate-200 px-3.5 py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-wider hover:text-[#461D77] shadow-sm hover:shadow transition-all cursor-pointer"
              title="Cargar datos de ejemplo con canchas MOP normalizadas"
            >
              <Database size={15} />
              <span>Datos Demo</span>
            </button>
          </div>
        </header>

        {/* Informative Banner / Critical Business Rule Explanation */}
        <div className="bg-gradient-to-r from-violet-900/5 via-indigo-900/5 to-emerald-900/5 border border-indigo-200/60 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#461D77] text-white rounded-xl shrink-0 mt-0.5">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h4 className="text-[13px] font-black text-[#461D77] uppercase tracking-wide">
                Regla de Negocio Crítica Implementada
              </h4>
              <p className="text-[12px] text-slate-600 leading-relaxed">
                El analizador lee la <span className="font-bold text-[#461D77]">Columna O (Almacén Despacho, índice 14)</span> del reporte generado. 
                Cualquier variante correspondiente al Salar de Atacama (como <code className="bg-white/80 px-1.5 py-0.5 rounded text-[11px] font-mono text-purple-900">Salar Atacama, Mop (1)</code>, <code className="bg-white/80 px-1.5 py-0.5 rounded text-[11px] font-mono text-purple-900">Mop (2)</code>, <code className="bg-white/80 px-1.5 py-0.5 rounded text-[11px] font-mono text-purple-900">Mop (3)</code>, <code className="bg-white/80 px-1.5 py-0.5 rounded text-[11px] font-mono text-purple-900">Mop (4)</code>, <code className="bg-white/80 px-1.5 py-0.5 rounded text-[11px] font-mono text-purple-900">Mop (6)</code>) se consolida y normaliza automáticamente como <span className="font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">"Salar"</span> en el campo <span className="font-mono text-[11px]">origenStokes</span>.
              </p>
            </div>
          </div>

          {datosStokes.length > 0 && (
            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                Fuente:
              </span>
              <span className="bg-white px-3 py-1 rounded-xl text-[11px] font-black text-[#461D77] border border-slate-200 uppercase">
                {ultimoOrigen === 'ntlm' ? 'ReportServer NTLM (clanfdbsw06)' : ultimoOrigen === 'manual' ? 'Archivo Excel Local' : 'Reporte Oficial Completo (112 Guías)'}
              </span>
            </div>
          )}
        </div>

        {/* Contingency Notification if cloud environment cannot reach intranet */}
        {avisoContingencia && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl text-[12px] flex items-center justify-between gap-3 font-medium shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>{avisoContingencia}</span>
            </div>
            <button
              onClick={() => setAvisoContingencia(null)}
              className="text-emerald-700 hover:text-emerald-950 text-[11px] font-bold uppercase cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Main Content Area */}
        {datosStokes.length === 0 ? (
          /* Empty State / Call to Action */
          <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/60 p-12 text-center flex flex-col items-center justify-center gap-6 shadow-sm min-h-[420px]">
            <div className="w-20 h-20 rounded-3xl bg-[#461D77]/10 flex items-center justify-center text-[#461D77] shadow-inner">
              <FileSpreadsheet size={40} strokeWidth={1.75} />
            </div>

            <div className="max-w-xl space-y-2">
              <h3 className="text-xl font-black text-[#461D77] tracking-tight">
                Ningún Reporte Stokes Cargado en Esta Sesión
              </h3>
              <p className="text-slate-500 text-[13px] leading-relaxed">
                Haz clic en el botón <strong className="text-[#461D77]">"Generar Reporte Stokes (1-Clic)"</strong> para autenticarte vía NTLM con tus credenciales corporativas SQM y consultar en tiempo real el servidor interno de reportes Microsoft ReportServer.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setModalAbierto(true)}
                className="flex items-center gap-2 bg-[#461D77] hover:bg-[#35145b] text-white px-6 py-3.5 rounded-2xl text-[12px] font-black uppercase tracking-wider shadow-md shadow-[#461D77]/20 transition-all cursor-pointer"
              >
                <Lock size={15} />
                Ingresar Credenciales y Consultar
              </button>

              <button
                onClick={cargarDatosDemo}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-5 py-3.5 rounded-2xl text-[12px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer"
              >
                <Sparkles size={15} className="text-amber-500" />
                Probar con Datos Demo
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium mt-4">
              <Info size={14} />
              <span>Ruta de consulta: /produccion/operaciones/canchas/publico/Historico_guia_transportista</span>
            </div>
          </div>
        ) : (
          /* Processed Data Presentation */
          <div className="space-y-6">
            
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Registros */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/60 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Total Registros Stokes
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-[#461D77]">
                    <FileCheck size={16} />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-[#461D77]">
                    {kpis.total.toLocaleString('es-CL')}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">guías procesadas</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Extraídas desde fila 9 en adelante
                </p>
              </div>

              {/* Card 2: Total Toneladas */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/60 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Volumen Despachado
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-[#7177EC]">
                    <Scale size={16} />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-800">
                    {kpis.totalTon.toLocaleString('es-CL', { maximumFractionDigits: 1 })}
                  </span>
                  <span className="text-xs font-bold text-slate-500">TON</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Columna N (Cantidad Despacho)
                </p>
              </div>

              {/* Card 3: Consolidado Salar */}
              <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/80 backdrop-blur-md rounded-2xl border border-emerald-200/60 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                    Origen Salar (Normalizado)
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-emerald-800">
                    {kpis.salarTon.toLocaleString('es-CL', { maximumFractionDigits: 1 })}
                  </span>
                  <span className="text-xs font-bold text-emerald-700">TON ({kpis.salarPct.toFixed(1)}%)</span>
                </div>
                <p className="text-[11px] text-emerald-700/80 mt-1 font-medium">
                  {kpis.salarItemsCount} guías de canchas MOP consolidadas
                </p>
              </div>

              {/* Card 4: Transportistas */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/60 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Flota & Empresas
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Truck size={16} />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-800">
                    {kpis.transportistasCount}
                  </span>
                  <span className="text-xs font-bold text-slate-500">transportistas</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Columna R (Empresas de transporte)
                </p>
              </div>
            </div>

            {/* Detected MOP Variants breakdown */}
            {kpis.mopRawVariants.length > 0 && (
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2.5">
                  <Sparkles size={15} className="text-[#461D77]" />
                  <span className="text-[11px] font-black text-[#461D77] uppercase tracking-wider">
                    Variantes Crudas Detectadas en Columna O y Consolidadas a "Salar":
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {kpis.mopRawVariants.map((variant, idx) => (
                    <div 
                      key={idx}
                      className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl text-[11px] font-medium text-slate-700"
                    >
                      <span className="font-mono text-purple-900 font-semibold">{variant}</span>
                      <ChevronRight size={13} className="text-slate-400" />
                      <span className="font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                        Salar
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Context bar when rows are selected in table */}
            {guiasSeleccionadas.size > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 px-4 py-2.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-200/90 rounded-2xl shadow-xs">
                <div className="flex items-center gap-2 text-[#461D77] text-[11.5px] font-bold">
                  <CheckSquare size={16} className="text-[#461D77] shrink-0" />
                  <span>
                    Tarjetas dinámicas calculadas sobre las <strong className="underline decoration-purple-400 font-black">{guiasSeleccionadas.size} guías seleccionadas</strong> en la tabla.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setUsarSoloSeleccionadas(!usarSoloSeleccionadas)}
                    className={`px-3 py-1 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                      usarSoloSeleccionadas
                        ? 'bg-[#461D77] text-white border-[#461D77] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {usarSoloSeleccionadas ? 'Ver sólo seleccionadas' : `Ver todo lo filtrado (${datosFiltrados.length})`}
                  </button>
                  <button
                    onClick={limpiarSeleccionGuias}
                    className="text-[10px] text-red-600 hover:text-red-800 font-bold underline cursor-pointer ml-1"
                  >
                    Desmarcar todas
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic Analytical Cards: Tonelaje por producto & Cantidad de equipos por producto */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Tarjeta 1: Tonelaje por Producto */}
              <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100/90 text-[#461D77] flex items-center justify-center shrink-0 shadow-xs">
                      <Scale size={18} />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        Tonelaje por Producto
                        <span className="text-[9.5px] bg-purple-100 text-[#461D77] font-black px-2 py-0.5 rounded-full lowercase">
                          dinámica
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {guiasSeleccionadas.size > 0 && usarSoloSeleccionadas
                          ? `Basado en ${guiasSeleccionadas.size} guías seleccionadas`
                          : `Basado en ${datosFiltrados.length} guías filtradas`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">
                      Volumen Total
                    </span>
                    <span className="text-xl font-black text-[#461D77]">
                      {resumenSeleccion.totalTon.toLocaleString('es-CL', { maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 ml-1">TON</span>
                  </div>
                </div>

                {/* Product List */}
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {metricasPorProducto.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No hay registros para los filtros o selección actual.
                    </div>
                  ) : (
                    metricasPorProducto.map((item, idx) => {
                      const barWidth = maxTonelaje > 0 ? (item.tonelaje / maxTonelaje) * 100 : 0;
                      const estaEnFiltro = filtroProducto.includes(item.producto);
                      return (
                        <div 
                          key={idx}
                          onClick={() => toggleFiltroProductoRapido(item.producto)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                            estaEnFiltro 
                              ? 'bg-purple-50/80 border-[#461D77]/50 ring-1 ring-[#461D77]/20 shadow-xs' 
                              : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/70'
                          }`}
                          title={`Haga clic para ${estaEnFiltro ? 'quitar' : 'filtrar por'} ${item.producto}`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-purple-100 text-[#461D77] font-black text-[10px] flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-[12px] text-slate-800 truncate group-hover:text-[#461D77] transition-colors">
                                {item.producto}
                              </span>
                            </div>
                            <div className="text-right shrink-0 flex items-baseline gap-1.5">
                              <span className="text-[13px] font-black text-[#461D77]">
                                {item.tonelaje.toLocaleString('es-CL', { maximumFractionDigits: 1 })}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500">TON</span>
                              <span className="bg-purple-100 text-[#461D77] text-[10px] font-black px-1.5 py-0.2 rounded-md ml-1">
                                {item.porcentajeTonelaje.toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden mb-1.5">
                            <div 
                              className="bg-gradient-to-r from-[#461D77] to-[#7177EC] h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(barWidth, 3)}%` }}
                            />
                          </div>

                          {/* Sub details */}
                          <div className="flex items-center justify-between text-[10.5px] text-slate-500 font-medium">
                            <span>{item.cantidadViajes} {item.cantidadViajes === 1 ? 'guía / viaje' : 'guías / viajes'}</span>
                            <span>Promedio: <strong className="text-slate-700">{item.promedioTonPorEquipo.toLocaleString('es-CL', { maximumFractionDigits: 1 })} TON/equipo</strong></span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Card footer advice */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-400">
                  <span>Haz clic en un producto para filtrar la tabla</span>
                  <span className="font-semibold text-slate-600">{metricasPorProducto.length} productos</span>
                </div>
              </div>

              {/* Tarjeta 2: Cantidad de Equipos por Producto */}
              <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100/90 text-emerald-800 flex items-center justify-center shrink-0 shadow-xs">
                      <Truck size={18} />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        Cantidad de Equipos por Producto
                        <span className="text-[9.5px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-full lowercase">
                          dinámica
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {guiasSeleccionadas.size > 0 && usarSoloSeleccionadas
                          ? `Camiones activos en ${guiasSeleccionadas.size} guías seleccionadas`
                          : `Camiones activos en ${datosFiltrados.length} guías filtradas`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">
                      Flota Única
                    </span>
                    <span className="text-xl font-black text-emerald-800">
                      {resumenSeleccion.totalEquipos}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 ml-1">equipos</span>
                  </div>
                </div>

                {/* Equipment List */}
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {metricasPorProducto.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No hay registros para los filtros o selección actual.
                    </div>
                  ) : (
                    metricasPorProducto.map((item, idx) => {
                      const barWidth = maxEquipos > 0 ? (item.equiposUnicos / maxEquipos) * 100 : 0;
                      const pctEquipos = resumenSeleccion.totalEquipos > 0 ? (item.equiposUnicos / resumenSeleccion.totalEquipos) * 100 : 0;
                      const estaEnFiltro = filtroProducto.includes(item.producto);
                      return (
                        <div 
                          key={idx}
                          onClick={() => toggleFiltroProductoRapido(item.producto)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                            estaEnFiltro 
                              ? 'bg-emerald-50/80 border-emerald-500/50 ring-1 ring-emerald-500/20 shadow-xs' 
                              : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/70'
                          }`}
                          title={`Haga clic para ${estaEnFiltro ? 'quitar' : 'filtrar por'} ${item.producto}`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px] flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-[12px] text-slate-800 truncate group-hover:text-emerald-700 transition-colors">
                                {item.producto}
                              </span>
                            </div>
                            <div className="text-right shrink-0 flex items-baseline gap-1.5">
                              <span className="text-[13px] font-black text-emerald-800">
                                {item.equiposUnicos}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500">
                                {item.equiposUnicos === 1 ? 'equipo' : 'equipos'}
                              </span>
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-1.5 py-0.2 rounded-md ml-1">
                                {pctEquipos.toFixed(1)}% flota
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden mb-1.5">
                            <div 
                              className="bg-gradient-to-r from-emerald-600 to-teal-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(barWidth, 3)}%` }}
                            />
                          </div>

                          {/* Sub details */}
                          <div className="flex items-center justify-between text-[10.5px] text-slate-500 font-medium">
                            <span>{item.cantidadViajes} viajes despachados</span>
                            <span>Rotación: <strong className="text-slate-700">{item.promedioViajesPorEquipo.toFixed(1)} viajes/equipo</strong></span>
                          </div>

                          {/* Sample truck license plates */}
                          {item.patentes.length > 0 && (
                            <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9.5px] font-bold text-slate-400 uppercase">Patentes:</span>
                              {item.patentes.slice(0, 5).map((patente, pIdx) => (
                                <span key={pIdx} className="bg-white border border-slate-200 text-slate-700 font-mono text-[9px] font-bold px-1.5 py-0.2 rounded shadow-2xs">
                                  {patente}
                                </span>
                              ))}
                              {item.patentes.length > 5 && (
                                <span className="text-[9.5px] text-slate-400 font-semibold">
                                  +{item.patentes.length - 5} más
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Card footer advice */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-400">
                  <span>{resumenSeleccion.totalViajes} viajes totales registrados</span>
                  <span className="font-semibold text-emerald-800">{resumenSeleccion.totalEquipos} camiones</span>
                </div>
              </div>

            </div>

            {/* Table Controls & Filter Toolbar */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3 relative z-30">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
                {/* Search box */}
                <div className="relative w-full lg:w-96">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={filtroTexto}
                    onChange={(e) => {
                      setFiltroTexto(e.target.value);
                      setPaginaActual(1);
                    }}
                    placeholder="Buscar guía, producto, patente, transportista..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#461D77]/20 focus:border-[#461D77]"
                  />
                  {filtroTexto && (
                    <button 
                      onClick={() => setFiltroTexto('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Center quick origin tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full lg:w-auto justify-center overflow-x-auto">
                  <button
                    onClick={() => {
                      setFiltroOrigen('todos');
                      setPaginaActual(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                      filtroOrigen === 'todos' 
                        ? 'bg-white text-[#461D77] shadow-xs' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Todos ({datosStokes.length})
                  </button>
                  <button
                    onClick={() => {
                      setFiltroOrigen('salar');
                      setPaginaActual(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      filtroOrigen === 'salar' 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'text-slate-500 hover:text-emerald-700'
                    }`}
                  >
                    <CheckCircle2 size={12} />
                    Solo Salar ({kpis.salarItemsCount})
                  </button>
                  <button
                    onClick={() => {
                      setFiltroOrigen('otros');
                      setPaginaActual(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                      filtroOrigen === 'otros' 
                        ? 'bg-white text-slate-800 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Otros Orígenes ({datosStokes.length - kpis.salarItemsCount})
                  </button>
                </div>

                {/* Right controls: Filter toggle + Export */}
                <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                  <button
                    onClick={() => setPanelFiltrosExpandido(!panelFiltrosExpandido)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                      panelFiltrosExpandido || filtrosActivosCount > 0
                        ? 'bg-[#461D77] text-white border-[#461D77] shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <SlidersHorizontal size={14} />
                    <span>Filtros de Tabla</span>
                    {filtrosActivosCount > 0 && (
                      <span className="bg-amber-400 text-slate-900 px-1.5 py-0.2 rounded-full text-[9px] font-black">
                        {filtrosActivosCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => exportarExcelStokes('filtrados')}
                    className="flex items-center gap-2 bg-[#3FAA88] hover:bg-[#349274] text-white px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer shrink-0"
                    title="Exportar registros filtrados a archivo Excel (.xlsx)"
                  >
                    <Download size={14} />
                    <span>Exportar Excel</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Multi-Filter Panel without overflow-hidden */}
              {panelFiltrosExpandido && (
                <div className="pt-3 border-t border-slate-200/80 space-y-3 relative z-30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 text-[11px]">
                    {/* Filter 1: Fecha Guía (Multi-select) */}
                    <MultiSelectFilter
                      label="Fecha Guía"
                      placeholder="Todas las fechas"
                      options={fechasDisponibles}
                      selectedValues={filtroFecha}
                      onChange={(vals) => {
                        setFiltroFecha(vals);
                        setPaginaActual(1);
                      }}
                    />

                    {/* Filter 2: Producto (Multi-select) */}
                    <MultiSelectFilter
                      label="Producto"
                      placeholder="Todos los productos"
                      options={productosDisponibles}
                      selectedValues={filtroProducto}
                      onChange={(vals) => {
                        setFiltroProducto(vals);
                        setPaginaActual(1);
                      }}
                    />

                    {/* Filter 3: Almacén Despacho Raw (Columna O Multi-select) */}
                    <MultiSelectFilter
                      label="Almacén Raw (Col. O)"
                      placeholder="Todos los almacenes"
                      options={almacenesRawDisponibles}
                      selectedValues={filtroAlmacenRaw}
                      onChange={(vals) => {
                        setFiltroAlmacenRaw(vals);
                        setPaginaActual(1);
                      }}
                    />

                    {/* Filter 4: Almacén Destino (Multi-select) */}
                    <MultiSelectFilter
                      label="Almacén Destino"
                      placeholder="Todos los destinos"
                      options={destinosDisponibles}
                      selectedValues={filtroDestino}
                      alignRight={true}
                      onChange={(vals) => {
                        setFiltroDestino(vals);
                        setPaginaActual(1);
                      }}
                    />

                    {/* Filter 5: Transportista (Multi-select) */}
                    <MultiSelectFilter
                      label="Transportista"
                      placeholder="Todos los transportistas"
                      options={transportistasDisponibles}
                      selectedValues={filtroTransportista}
                      alignRight={true}
                      onChange={(vals) => {
                        setFiltroTransportista(vals);
                        setPaginaActual(1);
                      }}
                    />
                  </div>

                    {/* Active filter badges & Reset button */}
                    {filtrosActivosCount > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Filtros aplicados:</span>
                          {filtroOrigen !== 'todos' && (
                            <span className="inline-flex items-center gap-1 bg-[#461D77]/10 text-[#461D77] px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Origen: {filtroOrigen === 'salar' ? 'Solo Salar' : 'Otros Orígenes'}
                              <button onClick={() => setFiltroOrigen('todos')} className="hover:text-red-500 cursor-pointer"><X size={11} /></button>
                            </span>
                          )}
                          {filtroFecha.map(f => (
                            <span key={f} className="inline-flex items-center gap-1 bg-purple-50 text-[#461D77] border border-purple-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Fecha: {f}
                              <button onClick={() => setFiltroFecha(prev => prev.filter(v => v !== f))} className="hover:text-red-500 cursor-pointer"><X size={11} /></button>
                            </span>
                          ))}
                          {filtroProducto.map(p => (
                            <span key={p} className="inline-flex items-center gap-1 bg-indigo-50 text-[#461D77] border border-indigo-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Producto: {p}
                              <button onClick={() => setFiltroProducto(prev => prev.filter(v => v !== p))} className="hover:text-red-500 cursor-pointer"><X size={11} /></button>
                            </span>
                          ))}
                          {filtroAlmacenRaw.map(a => (
                            <span key={a} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Raw Col. O: {a}
                              <button onClick={() => setFiltroAlmacenRaw(prev => prev.filter(v => v !== a))} className="hover:text-red-500 cursor-pointer"><X size={11} /></button>
                            </span>
                          ))}
                          {filtroDestino.map(d => (
                            <span key={d} className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Destino: {d}
                              <button onClick={() => setFiltroDestino(prev => prev.filter(v => v !== d))} className="hover:text-red-500 cursor-pointer"><X size={11} /></button>
                            </span>
                          ))}
                          {filtroTransportista.map(t => (
                            <span key={t} className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Transporte: {t}
                              <button onClick={() => setFiltroTransportista(prev => prev.filter(v => v !== t))} className="hover:text-red-500 cursor-pointer"><X size={11} /></button>
                            </span>
                          ))}
                          {filtroTexto.trim() && (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Texto: "{filtroTexto}"
                              <button onClick={() => setFiltroTexto('')} className="hover:text-red-500 cursor-pointer"><X size={11} /></button>
                            </span>
                          )}
                        </div>

                        <button
                          onClick={limpiarFiltros}
                          className="inline-flex items-center gap-1 text-[10.5px] font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer ml-auto"
                        >
                          <RotateCcw size={12} />
                          Limpiar todos los filtros
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Filtered Subset KPI Banner */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/80 text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-[#461D77]/10 text-[#461D77] font-black px-2.5 py-0.5 rounded-lg uppercase text-[10px]">
                  Vista Filtrada
                </span>
                <span className="text-slate-600 font-medium">
                  Mostrando <strong className="text-slate-900 font-black">{datosFiltrados.length}</strong> de <strong className="text-slate-800">{datosStokes.length}</strong> guías en la solicitud
                </span>

                {datosFiltrados.length > 0 && (
                  <button
                    onClick={seleccionarTodasLasFiltradas}
                    className="text-[10px] text-[#461D77] hover:underline font-bold ml-2 cursor-pointer inline-flex items-center gap-1"
                    title="Seleccionar todas las filas que cumplen los filtros actuales"
                  >
                    <CheckSquare size={12} />
                    Seleccionar todas las filtradas ({datosFiltrados.length})
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4 font-mono text-[11px]">
                <span className="text-slate-600">
                  Volumen: <strong className="text-slate-900 font-bold">{kpisFiltrados.totalTon.toFixed(2)} TON</strong>
                </span>
                <span className="text-emerald-700 font-bold">
                  Salar: {kpisFiltrados.salarItemsCount} guías ({kpisFiltrados.salarTon.toFixed(2)} TON)
                </span>
              </div>
            </div>

            {/* Active Row Selection Banner */}
            {guiasSeleccionadas.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-r from-purple-900 via-[#461D77] to-indigo-900 text-white rounded-xl shadow-md text-[11px]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckSquare size={16} className="text-amber-300" />
                    <span>
                      <strong className="text-amber-300 font-black">{guiasSeleccionadas.size}</strong> {guiasSeleccionadas.size === 1 ? 'guía seleccionada' : 'guías seleccionadas'}
                    </span>
                  </div>
                  <div className="h-4 w-[1px] bg-white/30 hidden sm:block" />
                  <span className="text-purple-100 font-mono">
                    Total: <strong className="text-white font-bold">{kpisSeleccionados.totalTon.toFixed(2)} TON</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={copiarGuiasSeleccionadas}
                    className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1 rounded-lg text-[10.5px] font-bold transition-colors cursor-pointer"
                    title="Copiar números de guías al portapapeles"
                  >
                    <Copy size={12} />
                    <span>{copiadoFeedback ? '¡Copiadas al portapapeles!' : 'Copiar N° Guías'}</span>
                  </button>

                  <button
                    onClick={() => exportarExcelStokes('seleccionados')}
                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
                    title="Exportar únicamente las filas seleccionadas a Excel"
                  >
                    <Download size={12} />
                    <span>Exportar Seleccionadas</span>
                  </button>

                  <button
                    onClick={limpiarSeleccionGuias}
                    className="text-purple-200 hover:text-white text-[10.5px] font-semibold underline cursor-pointer ml-1"
                  >
                    Deseleccionar
                  </button>
                </div>
              </motion.div>
            )}

            {/* Table Container */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead className="sticky top-0 bg-[#461D77] text-white z-10 text-[10px] font-black uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">
                        <button
                          type="button"
                          onClick={toggleSeleccionarTodasVisibles}
                          className="text-white hover:text-amber-300 cursor-pointer flex items-center justify-center mx-auto"
                          title={todasLasVisiblesSeleccionadas ? "Deseleccionar todas las visibles" : "Seleccionar todas las visibles"}
                        >
                          {todasLasVisiblesSeleccionadas ? (
                            <CheckSquare size={16} className="text-amber-300" />
                          ) : algunaVisibleSeleccionada ? (
                            <CheckSquare size={16} className="text-white/60" />
                          ) : (
                            <Square size={16} className="text-white/60" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-4">Guía</th>
                      <th className="py-3 px-3">Fecha</th>
                      <th className="py-3 px-4">Producto</th>
                      <th className="py-3 px-3 text-right">Cant. Despacho</th>
                      <th className="py-3 px-4">Almacén Despacho (Raw / Columna O)</th>
                      <th className="py-3 px-4">Origen Normalizado</th>
                      <th className="py-3 px-4">Almacén Destino</th>
                      <th className="py-3 px-4">Transportista</th>
                      <th className="py-3 px-3">Patente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {datosPaginados.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-14 text-slate-400 font-medium">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <AlertCircle size={28} className="text-slate-300" />
                            <p className="font-semibold text-slate-600">No se encontraron registros que coincidan con los filtros aplicados.</p>
                            <p className="text-[11px] text-slate-400">Prueba ajustando la búsqueda o quitando filtros de producto, fecha o transportista.</p>
                            {filtrosActivosCount > 0 && (
                              <button
                                onClick={limpiarFiltros}
                                className="mt-2 px-3 py-1.5 bg-[#461D77] text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer"
                              >
                                Restablecer todos los filtros
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      datosPaginados.map((item, idx) => {
                        const esSalar = item.origenStokes === 'Salar';
                        const fueModificado = esSalar && item.almacenDespachoRaw !== 'Salar';
                        const estaSeleccionada = guiasSeleccionadas.has(item.guia);

                        return (
                          <tr 
                            key={idx}
                            onClick={() => toggleGuia(item.guia)}
                            className={`transition-colors cursor-pointer select-none ${
                              estaSeleccionada
                                ? 'bg-purple-100/75 text-[#461D77]'
                                : idx % 2 === 0
                                ? 'bg-white hover:bg-purple-50/50'
                                : 'bg-slate-50/50 hover:bg-purple-50/50'
                            }`}
                          >
                            <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleGuia(item.guia)}
                                className="text-slate-400 hover:text-[#461D77] flex items-center justify-center mx-auto cursor-pointer"
                              >
                                {estaSeleccionada ? (
                                  <CheckSquare size={16} className="text-[#461D77]" />
                                ) : (
                                  <Square size={16} className="text-slate-300 hover:text-slate-500" />
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-4 font-mono font-black text-[#461D77]">
                              {item.guia}
                            </td>
                            <td className="py-3 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                              {item.fechaGuia}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              {item.producto}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                              {Number(item.cantDespacho).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TON
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                {item.almacenDespachoRaw || '—'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {esSalar ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-1 rounded-full text-[10px] tracking-wide">
                                  <CheckCircle2 size={12} className="text-emerald-600" />
                                  Salar {fueModificado && <span className="text-[8px] bg-emerald-200/70 text-emerald-900 px-1 rounded ml-0.5">MOP</span>}
                                </span>
                              ) : (
                                <span className="inline-flex items-center bg-slate-200/80 text-slate-700 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                                  {item.origenStokes}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {item.almacenDestino}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-700">
                              {item.transportista}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-900 uppercase">
                              {item.patenteCamion}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer: Pagination & Totals */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
                <div className="flex items-center gap-3">
                  <span>
                    Mostrando <strong className="text-slate-800 font-bold">{datosPaginados.length}</strong> de <strong className="text-slate-800 font-bold">{datosFiltrados.length}</strong> guías filtradas (total solicitud: {datosStokes.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Por pág:</span>
                    <select
                      value={elementosPorPagina}
                      onChange={(e) => {
                        setElementosPorPagina(Number(e.target.value));
                        setPaginaActual(1);
                      }}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded font-medium text-slate-700 focus:outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={-1}>Todas</option>
                    </select>
                  </div>
                </div>

                {/* Pagination Controls */}
                {elementosPorPagina !== -1 && totalPaginas > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      disabled={paginaValida <= 1}
                      onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))}
                      className="p-1 rounded bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer"
                      title="Página anterior"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="px-2 font-mono font-bold text-slate-700 text-[11px]">
                      {paginaValida} / {totalPaginas}
                    </span>
                    <button
                      disabled={paginaValida >= totalPaginas}
                      onClick={() => setPaginaActual(prev => Math.min(totalPaginas, prev + 1))}
                      className="p-1 rounded bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer"
                      title="Página siguiente"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                <div className="font-mono">
                  Salar Normalizado: <strong className="text-emerald-700">{kpisFiltrados.salarItemsCount} guías ({kpisFiltrados.salarTon.toFixed(2)} TON)</strong>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Corporate Credentials Modal */}
      <AnimatePresence>
        {modalAbierto && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget && !cargando) {
                setModalAbierto(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
            >
              {/* Modal Top Header */}
              <div className="bg-[#461D77] p-6 text-white relative">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-black tracking-widest bg-white/15 px-2 py-0.5 rounded-full uppercase">
                    MICROSOFT REPORTSERVER NTLM
                  </span>
                </div>
                <h3 className="text-lg font-black tracking-tight">
                  Autenticación Corporativa
                </h3>
                <p className="text-[12px] text-purple-200 mt-1">
                  Ingresa tus credenciales de red corporativa para consultar el reporte interno en <span className="font-mono font-bold text-white">clanfdbsw06</span>.
                </p>
              </div>

              {/* Form Content */}
              <form onSubmit={ejecutarGeneracionStokes} className="p-6 space-y-4">
                {error && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-[11px] space-y-2">
                    <div className="flex items-start gap-2 font-bold">
                      <AlertCircle size={15} className="shrink-0 text-amber-600 mt-0.5" />
                      <span>{error}</span>
                    </div>
                    {errorDetalle && (
                      <p className="text-amber-800/90 pl-5 text-[10.5px] leading-relaxed">
                        {errorDetalle}
                      </p>
                    )}
                    <div className="pl-5 flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          cargarDatosDemo();
                          setModalAbierto(false);
                        }}
                        className="px-3 py-1.5 bg-gradient-to-r from-[#461D77] to-[#7177EC] hover:opacity-90 text-white rounded-xl font-black text-[10px] uppercase tracking-wider cursor-pointer shadow-sm"
                      >
                        Cargar Datos Normalizados de Contingencia
                      </button>
                    </div>
                  </div>
                )}

                {/* Username Input */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Usuario Red Corporativa:
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                      placeholder="ej: ctapia o SQM\ctapia"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#461D77]/20 focus:border-[#461D77]"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Contraseña Corporativa:
                  </label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={mostrarPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#461D77]/20 focus:border-[#461D77]"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPassword(!mostrarPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      {mostrarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Request Scope Badge */}
                <div className="p-3 bg-purple-50/70 border border-[#461D77]/20 rounded-2xl flex items-start gap-2.5 text-[11px]">
                  <Database size={16} className="text-[#461D77] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-black text-[#461D77] uppercase text-[10px] tracking-wider">
                      Alcance: Extracción Total (Todos los Datos)
                    </div>
                    <p className="text-slate-600 text-[11px] leading-snug mt-0.5">
                      Se obtendrán todas las guías del histórico operativo sin exclusión. Podrás filtrar dinámicamente en la tabla por fecha, producto, canchas MOP y transportistas.
                    </p>
                  </div>
                </div>

                {/* Optional Domain and Advanced Network */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setMostrarOpcionesAvanzadas(!mostrarOpcionesAvanzadas)}
                    className="text-[10.5px] font-bold text-[#461D77] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{mostrarOpcionesAvanzadas ? '▲ Ocultar opciones avanzadas de red' : '▼ Opciones avanzadas de red (Dominio / Host SSRS)'}</span>
                  </button>
                  {mostrarOpcionesAvanzadas && (
                    <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 uppercase">
                          Dominio Windows / NTLM:
                        </label>
                        <input
                          type="text"
                          value={dominio}
                          onChange={(e) => setDominio(e.target.value)}
                          placeholder="SQM"
                          className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 uppercase">
                          Servidor SSRS / IP alternativo:
                        </label>
                        <input
                          type="text"
                          value={servidorCustom}
                          onChange={(e) => setServidorCustom(e.target.value)}
                          placeholder="http://clanfdbsw06/ReportServer o IP VPN interna"
                          className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-mono text-slate-800"
                        />
                        <p className="text-[9.5px] text-slate-400 mt-1">
                          Servidor por defecto: <code>http://clanfdbsw06/ReportServer</code>. Si navegas en la nube sin VPN corporativa, se activará la normalización de contingencia con todo el dataset histórico.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Security Note */}
                <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-slate-500">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="leading-tight">
                    Tus credenciales se transmiten encriptadas exclusivamente para la autenticación NTLM con el ReportServer interno. No se almacenan en el sistema.
                  </p>
                </div>

                {/* Loading Status */}
                {cargando && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center space-y-1.5">
                    <div className="inline-block animate-spin text-[#461D77]">
                      <RefreshCw size={18} />
                    </div>
                    <p className="text-[11px] font-bold text-[#461D77]">
                      {etapaCarga || 'Procesando reporte...'}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    disabled={cargando}
                    onClick={() => setModalAbierto(false)}
                    className="w-1/3 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-2/3 py-3 rounded-2xl bg-[#461D77] hover:bg-[#35145b] text-white text-[11px] font-black uppercase tracking-wider shadow-md shadow-[#461D77]/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {cargando ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Consultando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} className="text-amber-300" />
                        <span>Conectar y Procesar</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

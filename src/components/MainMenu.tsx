import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Truck, 
  FileBarChart, 
  History, 
  ChevronRight, 
  BarChart3, 
  Image as ImageIcon, 
  RefreshCw, 
  ClipboardList, 
  FileText,
  Clock, 
  Calendar, 
  User, 
  Activity, 
  ShieldAlert,
  Sliders,
  ExternalLink,
  Key,
  Lock,
  X,
  CheckCircle,
  AlertTriangle,
  Building2,
  ArrowLeft,
  Layers,
  Factory,
  Warehouse,
  MapPin,
  Database
} from 'lucide-react';
import { NovandinoLogo } from './BrandLogo';
import { PasswordPrompt } from './PasswordPrompt';

interface MainMenuProps {
  onSelectView: (view: 'llegada' | 'informe-novandino' | 'informe-sqm' | 'memoria' | 'ddd' | 'galeria' | 'cambioTurno' | 'lce' | 'users' | 'logs' | 'slit' | 'cumplimiento-mq' | 'cumplimiento-jorquera' | 'informe-operativo' | 'stokes') => void;
  isJefeTurnoUnlocked: boolean;
  onUnlockJefeTurno: () => void;
  currentUser: any;
  onLogout: () => void;
  initialLocation?: string | null;
  onLocationChange?: (location: string | null) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ 
  onSelectView, 
  isJefeTurnoUnlocked, 
  onUnlockJefeTurno, 
  currentUser, 
  onLogout,
  initialLocation = null,
  onLocationChange
}) => {
  const [time, setTime] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'supervision' | 'jefe_turno'>('supervision');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [openedLocation, setOpenedLocation] = useState<string | null>(initialLocation);
  const [unlockedLocations, setUnlockedLocations] = useState<Record<string, boolean>>({});
  const [locationPasswordPrompt, setLocationPasswordPrompt] = useState<{ id: string; name: string } | null>(null);

  // Sync state if initialLocation changes
  useEffect(() => {
    setOpenedLocation(initialLocation);
  }, [initialLocation]);

  // Sync state upward when openedLocation changes
  useEffect(() => {
    if (onLocationChange) {
      onLocationChange(openedLocation);
    }
  }, [openedLocation, onLocationChange]);

  const locationModules = [
    {
      id: 'SdA',
      title: 'SdA',
      fullName: 'SALAR DE ATACAMA',
      subtitle: 'SALAR DE ATACAMA',
      badge: 'OPERACIÓN DE CAMPO',
      status: currentUser?.role === 'admin' ? '6 MÓDULOS ACTIVOS' : '5 MÓDULOS ACTIVOS',
      description: currentUser?.role === 'admin'
        ? 'Informes de Despacho Novandino y SQM NY, Reporte Stokes (clanfdbsw06), Llegada de Equipos, Análisis Técnico DdD y Galería Operativa.'
        : 'Informes de Despacho Novandino y SQM NY, Llegada de Equipos, Análisis Técnico DdD y Galería Operativa.',
      icon: Building2,
    },
    {
      id: 'PQL',
      title: 'PQL',
      fullName: 'PLANTA QUÍMICA LITIO',
      subtitle: 'PLANTA QUÍMICA LITIO',
      badge: 'PLANTA QUÍMICA',
      status: 'CONECTADO',
      description: 'Seguimiento de cumplimiento de despacho M&Q y Jorquera, volumen transportado y desviaciones operacionales.',
      icon: Factory,
    },
    {
      id: 'CLB',
      title: 'CLB',
      fullName: 'CENTRO LOGÍSTICO BAQUEDANO',
      subtitle: 'CENTRO LOGÍSTICO BAQUEDANO',
      badge: 'CENTRO LOGÍSTICO',
      status: 'EN PREPARACIÓN',
      description: 'Espacio operativo reservado para futuros módulos de consolidación y transferencia en Baquedano.',
      icon: Warehouse,
    },
    {
      id: 'PANG',
      title: 'PANG',
      fullName: 'PUERTO ANGAMOS',
      subtitle: 'PUERTO ANGAMOS',
      badge: 'BASE OPERATIVA',
      status: 'EN PREPARACIÓN',
      description: 'Espacio operativo reservado para trazabilidad de arribo y despacho portuario en Angamos.',
      icon: MapPin,
    },
  ];

  // Force active tab to supervision on load if supervisor
  useEffect(() => {
    if (currentUser?.role === 'supervision') {
      setActiveTab('supervision');
    }
  }, [currentUser]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));

      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };
      setDateStr(now.toLocaleDateString('es-CL', options));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleJefeTurnoClick = () => {
    if (isJefeTurnoUnlocked) {
      setActiveTab('jefe_turno');
    } else {
      setShowPasswordPrompt(true);
    }
  };

  const cardsData: Array<{
    id: 'llegada' | 'informe-novandino' | 'informe-sqm' | 'memoria' | 'ddd' | 'galeria' | 'cambioTurno' | 'lce' | 'users' | 'logs' | 'slit' | 'stokes';
    title: string;
    subtitle: string;
    description: string;
    icon: any;
    isFeature?: boolean;
    badge: string;
    status: string;
    group: 'supervision' | 'jefe_turno';
    adminOnly?: boolean;
  }> = [
    {
      id: 'informe-novandino',
      title: 'Informe Operativo Novandino',
      subtitle: 'Dashboard Principal',
      description: 'Informe diario consolidado de turnos, estadísticas de despachos de litio y exportación a PDF o PNG.',
      icon: FileBarChart,
      isFeature: true,
      badge: 'MÓDULO DESPACHO',
      status: 'ACTIVO',
      group: 'supervision' as const
    },
    {
      id: 'informe-sqm',
      title: 'Informe Operativo SQM NY',
      subtitle: 'Dashboard SQM NY',
      description: 'Consolidado diario de turnos orientado a seguimiento SQM NY con exportación automatizada.',
      icon: FileBarChart,
      isFeature: true,
      badge: 'MÓDULO DESPACHO',
      status: 'ACTIVO',
      group: 'supervision' as const
    },
    {
      id: 'llegada' as const,
      title: 'Llegada de Equipos',
      subtitle: 'Tránsito y Flujo',
      description: 'Verificación de arribo, frecuencia de cargas y control de flotas en tránsito hacia faenas de litio.',
      icon: Truck,
      isFeature: true,
      badge: 'LOGÍSTICA IN SITU',
      status: 'ACTIVO',
      group: 'supervision' as const
    },
    {
      id: 'lce' as const,
      title: 'Control LCE',
      subtitle: 'Cumplimiento Salar',
      description: 'Balance de cloruro de litio equivalente y monitoreo de cumplimiento in-situ en el Salar de Atacama.',
      icon: ClipboardList,
      badge: 'SALAR DE ATACAMA',
      status: 'ESTADÍSTICAS',
      group: 'jefe_turno' as const
    },
    {
      id: 'ddd' as const,
      title: 'Análisis Técnico',
      subtitle: 'Diálogo de Desempeño',
      description: 'Indicadores del Tablero M1 estructurados para reuniones operativas de Diálogo de Desempeño (DdD).',
      icon: BarChart3,
      badge: 'SALA REUNIÓN M1',
      status: 'ESTRATÉGICO',
      group: 'supervision' as const
    },
    {
      id: 'cambioTurno' as const,
      title: 'Cambio de Turno',
      subtitle: 'Relevo y Rendimiento',
      description: 'Entrega e inicio de jornadas con cálculo de traslape, tonelaje y rendimiento de flota.',
      icon: RefreshCw,
      badge: 'ENTREGA DE TURNO',
      status: 'SINCRONIZADO',
      group: 'jefe_turno' as const
    },
    {
      id: 'galeria' as const,
      title: 'Galería Operativa',
      subtitle: 'Registro de Evidencia',
      description: 'Archivo visual de reportes gráficos e incidencias operacionales en terreno.',
      icon: ImageIcon,
      badge: 'SOPORTE EN TERRENO',
      status: 'REGISTRO',
      group: 'supervision' as const
    },
    {
      id: 'memoria' as const,
      title: 'Memoria Histórica',
      subtitle: 'Historial de Respaldos',
      description: 'Bitácora de jornadas operativas anteriores con recuperación directa de consolidados.',
      icon: History,
      badge: 'ARCHIVO',
      status: 'HISTÓRICO',
      group: 'jefe_turno' as const
    },
    {
      id: 'stokes' as const,
      title: 'Reporte Stokes',
      subtitle: 'Extracción y Consolidado',
      description: 'Ingesta desde ReportServer (clanfdbsw06) y normalización de orígenes Salar Atacama (MOP 1 a 6).',
      icon: Database,
      isFeature: true,
      badge: 'REPORT SERVER',
      status: 'CONECTADO',
      group: 'supervision' as const,
      adminOnly: true
    }
  ];

  const roleLabel = currentUser?.role === 'admin'
    ? 'Administrador'
    : currentUser?.role === 'jefe_turno'
    ? 'Jefe de Turno'
    : 'Supervisión';

  return (
    <div className="min-h-screen w-full bg-[#ECEAE3] text-[#181615] flex flex-col justify-between">
      {/* Main Content Safe Area */}
      <div className="w-full max-w-[102rem] mx-auto px-4 sm:px-6 py-6 md:py-8 flex-grow flex flex-col gap-8">

        {/* ASYMMETRIC EDITORIAL HEADER (12-COL) WITH HIGH-CONTRAST SHIFT ANCHOR */}
        <section className="surface-card rounded-lg overflow-hidden border-t-2 border-t-[#461D77]">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left 8 cols: Operational Title & Context */}
            <div className="lg:col-span-8 p-6 sm:p-8 flex flex-col justify-between gap-6 bg-[#FFFFFF]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#461D77]">
                  <span>Subgerencia Logística Litio</span>
                  <span className="text-[#BDB8AC]" aria-hidden="true">/</span>
                  <span className="text-[#57534E]">Novandino</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-[-0.03em] text-[#181615] leading-[1.08] max-w-3xl text-balance">
                  CENTRO DE CONTROL LOGÍSTICA LITIO
                </h1>
                <p className="text-sm text-[#57534E] max-w-2xl leading-relaxed">
                  Plataforma operativa para control de despachos, arribo de equipos, análisis DdD y emisión de informes oficiales de jornada.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 border-t border-[#E5E2D9] font-mono text-[11px] text-[#57534E]">
                <span className="flex items-center gap-1.5">
                  <strong className="text-[#181615] font-bold tabular-nums text-xs">04</strong> ZONAS OPERATIVAS
                </span>
                <span className="text-[#BDB8AC]" aria-hidden="true">·</span>
                <span>SdA · PQL · CLB · PANG</span>
              </div>
            </div>

            {/* Right 4 cols: High-Contrast Carbon Ink Operator & Clock Anchor */}
            <div className="lg:col-span-4 bg-[#181615] text-[#F7F6F2] p-6 sm:p-8 flex flex-col justify-between gap-5 border-t lg:border-t-0 lg:border-l border-[#2E2A28]">
              <div className="flex items-center justify-between border-b border-white/12 pb-3">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#BDB8AC]">
                  Sesión de Turno
                </span>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#C4A6EB]">
                  En Línea
                </span>
              </div>

              <div className="space-y-4">
                <div className="font-mono text-3xl sm:text-4xl font-bold tabular-nums tracking-[-0.03em] text-white leading-none">
                  {time || '--:--:--'}
                </div>

                <div className="pt-1">
                  <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-[#A8A29E]">
                    Operador Activo
                  </p>
                  <p className="text-base font-bold text-white mt-0.5 tracking-tight">
                    {currentUser?.name || 'Analista Activo'}
                  </p>
                  <p className="font-mono text-xs text-[#D6D3CD] mt-0.5">
                    {roleLabel}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-white/12 font-mono text-[11px] text-[#A8A29E] capitalize truncate">
                {dateStr}
              </div>
            </div>
          </div>
        </section>

        {/* DIRECTORY / MODULE SELECTOR */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="space-y-6 w-full"
        >
          {!openedLocation ? (
            /* MAIN LEVEL: 4 OPERATIONAL ZONE MODULES (7/5 PRIMARY + 6/6 RECESSED RESERVED) */
            <div className="space-y-5">
              <div className="flex items-baseline justify-between pb-3 border-b border-[#D5D0C5]">
                <div>
                  <h2 className="text-sm font-bold text-[#181615] uppercase tracking-wider">
                    Zonas Operativas
                  </h2>
                  <p className="text-xs text-[#57534E] mt-0.5">
                    Seleccione una faena o centro logístico para acceder a sus módulos.
                  </p>
                </div>
                <span className="font-mono text-[11px] font-semibold text-[#57534E] hidden sm:inline tabular-nums">
                  02 ACTIVAS · 02 RESERVADAS
                </span>
              </div>

              {/* Tier 1: Active Operational Zones (7 + 5 = 12 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
                {locationModules
                  .filter(loc => loc.id === 'SdA' || loc.id === 'PQL')
                  .map((loc) => {
                    const IconComponent = loc.icon;
                    const isSdA = loc.id === 'SdA';
                    const isUnlocked = isSdA || unlockedLocations[loc.id];

                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => {
                          if (isUnlocked) {
                            setOpenedLocation(loc.id);
                          } else {
                            setLocationPasswordPrompt({
                              id: loc.id,
                              name: `${loc.title} - ${loc.fullName}`,
                            });
                          }
                        }}
                        className={`group surface-card-interactive rounded-lg p-6 sm:p-7 flex flex-col justify-between text-left cursor-pointer ${
                          isSdA
                            ? 'lg:col-span-7 border-t-2 border-t-[#461D77]'
                            : 'lg:col-span-5'
                        }`}
                      >
                        <div className="space-y-5 w-full">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-11 h-11 rounded-md flex items-center justify-center border transition-colors duration-150 ${
                                isSdA
                                  ? 'bg-[#461D77] text-white border-[#461D77] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                                  : 'bg-[#F2F0EA] text-[#461D77] border-[#D8D4CA] group-hover:bg-[#461D77] group-hover:text-white group-hover:border-[#461D77]'
                              }`}>
                                <IconComponent size={20} strokeWidth={1.75} />
                              </div>
                              <div>
                                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#57534E]">
                                  {loc.badge}
                                </p>
                                <p className="text-xs font-semibold text-[#181615] mt-0.5">
                                  {loc.subtitle}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className={`font-mono text-[11px] font-bold uppercase tabular-nums flex items-center justify-end gap-1.5 ${
                                isSdA ? 'text-[#461D77]' : isUnlocked ? 'text-[#15803D]' : 'text-[#B45309]'
                              }`}>
                                {!isUnlocked && <Lock size={11} />}
                                {loc.status}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h3 className={`font-extrabold text-[#181615] tracking-[-0.03em] leading-none ${
                              isSdA ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
                            }`}>
                              {loc.title}
                            </h3>
                            <p className="text-[#57534E] text-xs sm:text-[13px] leading-relaxed max-w-xl">
                              {loc.description}
                            </p>
                          </div>
                        </div>

                        <div className="w-full pt-4 mt-6 border-t border-[#E5E2D9] flex items-center justify-between text-xs font-bold">
                          <span className={isUnlocked ? 'text-[#461D77]' : 'text-[#B45309]'}>
                            {isSdA
                              ? 'Ingresar a Salar de Atacama'
                              : isUnlocked
                              ? 'Ingresar a Planta Química Litio'
                              : 'Desbloquear zona'}
                          </span>
                          <span className="text-[#57534E] group-hover:text-[#461D77] transition-colors duration-150">
                            {!isUnlocked ? (
                              <Lock size={15} />
                            ) : (
                              <ChevronRight size={17} className="group-hover:translate-x-0.5 transition-transform duration-150" />
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Tier 2: Reserved / In Preparation Zones (6 + 6 = 12 cols, compact recessed strip) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 w-full">
                {locationModules
                  .filter(loc => loc.id === 'CLB' || loc.id === 'PANG')
                  .map((loc) => {
                    const IconComponent = loc.icon;
                    const isUnlocked = unlockedLocations[loc.id];

                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => {
                          if (isUnlocked) {
                            setOpenedLocation(loc.id);
                          } else {
                            setLocationPasswordPrompt({
                              id: loc.id,
                              name: `${loc.title} - ${loc.fullName}`,
                            });
                          }
                        }}
                        className="group lg:col-span-6 surface-well hover:bg-[#FFFFFF] hover:border-[#BDB8AC] rounded-lg px-5 py-4 transition-all duration-150 ease-out flex items-center justify-between gap-4 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-md bg-[#FFFFFF] border border-[#D8D4CA] text-[#57534E] group-hover:text-[#461D77] flex items-center justify-center shrink-0 transition-colors duration-150">
                            <IconComponent size={18} strokeWidth={1.75} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#57534E]">
                              <span>{loc.badge}</span>
                              <span className="text-[#BDB8AC]" aria-hidden="true">·</span>
                              <span className={isUnlocked ? 'text-[#15803D]' : 'text-[#B45309]'}>
                                {isUnlocked ? 'DESBLOQUEADA' : loc.status}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-2.5 mt-0.5">
                              <h3 className="font-bold text-lg text-[#181615] tracking-tight shrink-0">
                                {loc.title}
                              </h3>
                              <span className="text-xs text-[#57534E] truncate">
                                {loc.fullName}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-xs font-semibold text-[#57534E] group-hover:text-[#461D77]">
                          <span className="hidden sm:inline font-mono text-[11px]">
                            {isUnlocked ? 'Abrir' : 'Clave'}
                          </span>
                          {!isUnlocked ? (
                            <Lock size={14} className="text-[#B45309]" />
                          ) : (
                            <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform duration-150" />
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* INSIDE OPENED LOCATION MODULE */
            <div className="space-y-6">
              {/* LOCATION HEADER */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3.5 border-b border-[#D5D0C5]">
                <div>
                  <span className="font-mono text-[11px] font-semibold text-[#461D77] uppercase tracking-wider">
                    {locationModules.find(l => l.id === openedLocation)?.id} · {locationModules.find(l => l.id === openedLocation)?.fullName}
                  </span>
                  <h2 className="text-2xl font-extrabold text-[#181615] tracking-[-0.025em] mt-0.5">
                    Módulos de {locationModules.find(l => l.id === openedLocation)?.title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenedLocation(null)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-[#FFFFFF] hover:bg-[#F2F0EA] border border-[#D8D4CA] shadow-[0_1px_2px_rgba(24,22,21,0.05)] rounded-md text-xs font-semibold text-[#181615] transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ArrowLeft size={14} /> Volver a Zonas
                </button>
              </div>

              {openedLocation === 'SdA' ? (
                <>
                  {/* TAB SWITCHER: SUPERVISIÓN / JEFE TURNO INSIDE SdA */}
                  {currentUser?.role !== 'supervision' && (
                    <div className="inline-flex items-center gap-1 surface-well p-1 rounded-md">
                      <button
                        type="button"
                        onClick={() => setActiveTab('supervision')}
                        className={`px-4 py-1.5 rounded text-xs font-semibold transition-all duration-150 cursor-pointer ${
                          activeTab === 'supervision'
                            ? 'bg-[#181615] text-white shadow-[0_1px_2px_rgba(24,22,21,0.2)]'
                            : 'text-[#57534E] hover:text-[#181615]'
                        }`}
                      >
                        Supervisión
                      </button>
                      <button
                        type="button"
                        onClick={handleJefeTurnoClick}
                        className={`px-4 py-1.5 rounded text-xs font-semibold transition-all duration-150 cursor-pointer ${
                          activeTab === 'jefe_turno'
                            ? 'bg-[#181615] text-white shadow-[0_1px_2px_rgba(24,22,21,0.2)]'
                            : 'text-[#57534E] hover:text-[#181615]'
                        }`}
                      >
                        Jefe Turno
                      </button>
                    </div>
                  )}

                  {/* CARDS GRID FOR SELECTED TAB INSIDE SdA */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
                    {cardsData
                      .filter(c => {
                        if (c.adminOnly && currentUser?.role !== 'admin') {
                          return false;
                        }
                        return c.group === activeTab;
                      })
                      .map((card, idx) => {
                        const IconComponent = card.icon;
                        const isNovandino = card.id === 'informe-novandino';

                        if (isNovandino) {
                          return (
                            <button
                              key={`${card.id}-${idx}`}
                              type="button"
                              onClick={() => onSelectView(card.id)}
                              className="group md:col-span-2 lg:col-span-2 surface-anchor-violet hover:bg-[#3B1766] rounded-lg p-6 sm:p-7 transition-all duration-150 ease-out flex flex-col justify-between text-left cursor-pointer hover:-translate-y-0.5"
                            >
                              <div className="flex items-center justify-between w-full mb-5">
                                <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[#DDD0F2] uppercase">
                                  {card.badge} · MÓDULO PRINCIPAL
                                </span>
                                <span className="font-mono text-[10px] font-bold text-white uppercase tracking-wider">
                                  {card.status}
                                </span>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center gap-5 my-auto">
                                <div className="w-12 h-12 rounded-md bg-white/12 border border-white/20 text-white flex items-center justify-center shrink-0">
                                  <IconComponent size={22} strokeWidth={1.75} />
                                </div>
                                <div className="space-y-1.5">
                                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#DDD0F2]">
                                    {card.subtitle}
                                  </p>
                                  <h3 className="font-extrabold text-white tracking-[-0.025em] text-2xl sm:text-3xl leading-tight">
                                    {card.title}
                                  </h3>
                                  <p className="text-[#EAE2F8] text-xs sm:text-[13px] leading-relaxed max-w-xl">
                                    {card.description}
                                  </p>
                                </div>
                              </div>

                              <div className="w-full pt-4 mt-6 border-t border-white/15 flex items-center justify-between text-xs font-bold text-white">
                                <span>Abrir módulo principal</span>
                                <ChevronRight size={17} className="group-hover:translate-x-1 transition-transform duration-150" />
                              </div>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={`${card.id}-${idx}`}
                            type="button"
                            onClick={() => onSelectView(card.id)}
                            className="group surface-card-interactive rounded-lg p-6 flex flex-col justify-between text-left cursor-pointer col-span-1"
                          >
                            <div className="flex items-center justify-between w-full mb-4 font-mono text-[10px] font-semibold uppercase tracking-wider">
                              <span className="text-[#57534E]">
                                {card.badge}
                              </span>
                              <span className="text-[#461D77] font-bold">
                                {card.status}
                              </span>
                            </div>

                            <div className="space-y-3 my-auto">
                              <div className="w-10 h-10 rounded-md flex items-center justify-center border bg-[#F2F0EA] text-[#461D77] border-[#D8D4CA] group-hover:bg-[#461D77] group-hover:text-white group-hover:border-[#461D77] transition-colors duration-150">
                                <IconComponent size={19} strokeWidth={1.75} />
                              </div>

                              <div className="space-y-1">
                                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#57534E]">
                                  {card.subtitle}
                                </p>
                                <h3 className="font-bold text-[#181615] tracking-tight text-lg">
                                  {card.title}
                                </h3>
                                <p className="text-[#57534E] text-xs leading-relaxed line-clamp-2">
                                  {card.description}
                                </p>
                              </div>
                            </div>

                            <div className="w-full pt-4 mt-5 border-t border-[#E5E2D9] flex items-center justify-between text-xs font-semibold">
                              <span className="text-[#57534E] group-hover:text-[#461D77] transition-colors">
                                Abrir módulo
                              </span>
                              <ChevronRight size={15} className="text-[#57534E] group-hover:text-[#461D77] group-hover:translate-x-0.5 transition-all duration-150" />
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </>
              ) : openedLocation === 'PQL' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
                  {/* CUMPLIMIENTO M&Q */}
                  <button
                    type="button"
                    onClick={() => onSelectView('cumplimiento-mq')}
                    className="group surface-card-interactive rounded-lg p-6 flex flex-col justify-between text-left cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full mb-4 font-mono text-[10px] font-semibold uppercase tracking-wider">
                      <span className="text-[#57534E]">PLANTA QUÍMICA</span>
                      <span className="text-[#461D77] font-bold">ACTIVO</span>
                    </div>
                    <div className="space-y-3 my-auto">
                      <div className="w-10 h-10 rounded-md flex items-center justify-center bg-[#F2F0EA] text-[#461D77] border border-[#D8D4CA] group-hover:bg-[#461D77] group-hover:text-white group-hover:border-[#461D77] transition-colors duration-150">
                        <ClipboardList size={19} strokeWidth={1.75} />
                      </div>
                      <div className="space-y-1">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#57534E]">
                          Desempeño y Productividad
                        </p>
                        <h3 className="font-bold text-[#181615] tracking-tight text-lg">
                          Cumplimiento M&Q
                        </h3>
                        <p className="text-[#57534E] text-xs leading-relaxed line-clamp-2">
                          Monitoreo de vueltas solicitadas vs reales, toneladas transportadas y días críticos del mes.
                        </p>
                      </div>
                    </div>
                    <div className="w-full pt-4 mt-5 border-t border-[#E5E2D9] flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#57534E] group-hover:text-[#461D77]">Abrir módulo</span>
                      <ChevronRight size={15} className="text-[#57534E] group-hover:text-[#461D77] group-hover:translate-x-0.5 transition-all duration-150" />
                    </div>
                  </button>

                  {/* CUMPLIMIENTO JORQUERA */}
                  <button
                    type="button"
                    onClick={() => onSelectView('cumplimiento-jorquera')}
                    className="group surface-card-interactive rounded-lg p-6 flex flex-col justify-between text-left cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full mb-4 font-mono text-[10px] font-semibold uppercase tracking-wider">
                      <span className="text-[#57534E]">PLANTA QUÍMICA</span>
                      <span className="text-[#461D77] font-bold">ACTIVO</span>
                    </div>
                    <div className="space-y-3 my-auto">
                      <div className="w-10 h-10 rounded-md flex items-center justify-center bg-[#F2F0EA] text-[#461D77] border border-[#D8D4CA] group-hover:bg-[#461D77] group-hover:text-white group-hover:border-[#461D77] transition-colors duration-150">
                        <ClipboardList size={19} strokeWidth={1.75} />
                      </div>
                      <div className="space-y-1">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#57534E]">
                          Desempeño y Productividad
                        </p>
                        <h3 className="font-bold text-[#181615] tracking-tight text-lg">
                          Cumplimiento Jorquera
                        </h3>
                        <p className="text-[#57534E] text-xs leading-relaxed line-clamp-2">
                          Monitoreo de vueltas solicitadas vs reales, toneladas transportadas y productividad diaria Jorquera.
                        </p>
                      </div>
                    </div>
                    <div className="w-full pt-4 mt-5 border-t border-[#E5E2D9] flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#57534E] group-hover:text-[#461D77]">Abrir módulo</span>
                      <ChevronRight size={15} className="text-[#57534E] group-hover:text-[#461D77] group-hover:translate-x-0.5 transition-all duration-150" />
                    </div>
                  </button>

                  {/* INFORME OPERATIVO SLIT (FEATURED ANCHOR) */}
                  <button
                    type="button"
                    onClick={() => onSelectView('informe-operativo')}
                    className="group surface-anchor-violet hover:bg-[#3B1766] rounded-lg p-6 transition-all duration-150 ease-out flex flex-col justify-between text-left cursor-pointer hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between w-full mb-4 font-mono text-[10px] font-semibold uppercase tracking-wider">
                      <span className="text-[#DDD0F2]">PLANTA QUÍMICA · SLIT</span>
                      <span className="text-white font-bold">ACTIVO</span>
                    </div>
                    <div className="space-y-3 my-auto">
                      <div className="w-10 h-10 rounded-md flex items-center justify-center bg-white/12 text-white border border-white/20">
                        <FileText size={19} strokeWidth={1.75} />
                      </div>
                      <div className="space-y-1">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#DDD0F2]">
                          Informe Operacional SLIT
                        </p>
                        <h3 className="font-extrabold text-white tracking-tight text-xl">
                          Informe Operativo
                        </h3>
                        <p className="text-[#EAE2F8] text-xs leading-relaxed line-clamp-2">
                          Informe operacional en dos piezas: resumen gerencial PNG para correo y adjunto PDF con tendencia.
                        </p>
                      </div>
                    </div>
                    <div className="w-full pt-4 mt-5 border-t border-white/15 flex items-center justify-between text-xs font-bold text-white">
                      <span>Abrir módulo principal</span>
                      <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform duration-150" />
                    </div>
                  </button>
                </div>
              ) : (
                <div className="w-full surface-well rounded-lg p-12 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="w-12 h-12 rounded-md bg-[#FFFFFF] border border-[#D8D4CA] flex items-center justify-center text-[#57534E]">
                    <Layers size={22} strokeWidth={1.5} />
                  </div>
                  <div className="max-w-md space-y-1.5">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#B45309]">
                      EN PREPARACIÓN
                    </span>
                    <h3 className="text-xl font-bold text-[#181615] tracking-tight pt-1">
                      {locationModules.find(l => l.id === openedLocation)?.title} · {locationModules.find(l => l.id === openedLocation)?.fullName}
                    </h3>
                    <p className="text-[#57534E] text-xs leading-relaxed">
                      Esta zona se encuentra reservada para la incorporación de futuros módulos operativos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenedLocation(null)}
                    className="px-5 py-2.5 bg-[#181615] hover:bg-[#2E2A28] text-white text-xs font-semibold uppercase tracking-wider rounded-md transition-colors duration-150 cursor-pointer"
                  >
                    Volver a Zonas
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* FOOTER BAR */}
      <footer className="py-5 bg-[#E5E2D9] border-t border-[#D5D0C5] mt-10">
        <div className="max-w-[102rem] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-[#44403C] uppercase tracking-wider">
            NOVANDINO · SUBGERENCIA LOGÍSTICA LITIO · DESPACHO LITIO
          </p>
          <p className="font-mono text-[11px] text-[#57534E]">
            PWA diseñada por Cristian Tapia Espinoza
          </p>
        </div>
      </footer>
      {/* PASSWORD PROTECTION FOR IN-PROCESS MODULES (PQL, CLB, PANG) */}
      {locationPasswordPrompt && (
        <PasswordPrompt
          correctPassword="MIRAME"
          moduleName={locationPasswordPrompt.name}
          onSuccess={() => {
            const targetId = locationPasswordPrompt.id;
            setUnlockedLocations(prev => ({ ...prev, [targetId]: true }));
            setLocationPasswordPrompt(null);
            setOpenedLocation(targetId);
          }}
          onCancel={() => setLocationPasswordPrompt(null)}
        />
      )}

      {/* PASSWORD PROTECTION FOR JEFE TURNO TAB */}
      {showPasswordPrompt && (
        <PasswordPrompt
          correctPassword="MIRAME"
          moduleName="Módulo Jefe Turno"
          onSuccess={() => {
            onUnlockJefeTurno();
            setShowPasswordPrompt(false);
            setActiveTab('jefe_turno');
          }}
          onCancel={() => setShowPasswordPrompt(false)}
        />
      )}
    </div>
  );
};

export default MainMenu;


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
  AlertTriangle
} from 'lucide-react';
import { NovandinoLogo } from './BrandLogo';
import { PasswordPrompt } from './PasswordPrompt';

interface MainMenuProps {
  onSelectView: (view: 'llegada' | 'informe' | 'memoria' | 'ddd' | 'galeria' | 'cambioTurno' | 'lce' | 'users' | 'logs') => void;
  isJefeTurnoUnlocked: boolean;
  onUnlockJefeTurno: () => void;
  currentUser: any;
  onLogout: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onSelectView, isJefeTurnoUnlocked, onUnlockJefeTurno, currentUser, onLogout }) => {
  const [time, setTime] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'supervision' | 'jefe_turno'>('supervision');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

  // Force active tab to supervision on load if supervisor
  useEffect(() => {
    if (currentUser?.role === 'supervision') {
      setActiveTab('supervision');
    }
  }, [currentUser]);

  // States for the custom Change Password modal
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState('');
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [passSaving, setPassSaving] = useState(false);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (passwordCurrent !== currentUser?.password) {
      setPassError('La contraseña actual es incorrecta.');
      return;
    }

    if (passwordNew.trim().length < 4) {
      setPassError('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (passwordNew !== passwordConfirm) {
      setPassError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    setPassSaving(true);
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db, logActivity } = await import('../services/firebase');
      
      const updatedUser = {
        ...currentUser,
        password: passwordNew
      };

      await setDoc(doc(db, 'users', currentUser.userId), updatedUser);
      
      // Sync change locally within persistent localStorage
      localStorage.setItem('sqm_current_user', JSON.stringify(updatedUser));
      
      // Overwrite current reference
      if (currentUser) {
        currentUser.password = passwordNew;
      }

      await logActivity(currentUser, 'Cambió Contraseña', `El usuario ${currentUser.name} actualizó su contraseña de acceso exitosamente.`);
      
      setPassSuccess('¡Contraseña actualizada correctamente!');
      setPasswordCurrent('');
      setPasswordNew('');
      setPasswordConfirm('');
      setTimeout(() => {
        setShowChangePassword(false);
        setPassSuccess('');
      }, 2000);
    } catch (err) {
      console.error('Error updating password:', err);
      setPassError('Fallo al registrar nueva clave. Intente de nuevo.');
    } finally {
      setPassSaving(false);
    }
  };

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

  // Stagger animations config
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 25 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: 'spring', 
        stiffness: 100, 
        damping: 15 
      }
    }
  };

  const cardsData = [
    {
      id: 'informe' as const,
      title: 'Informe Operativo',
      subtitle: 'Dashboard Principal',
      description: 'Informe diario consolidado de turnos, estadísticas de despachos de litio en tiempo real y exportación profesional automatizada a reportes PDF o formato de imagen de alta resolución.',
      icon: FileBarChart,
      color: 'from-violet-500/10 via-[#461D77]/5 to-[#461D77]/10 border-[#461D77]/20',
      iconBg: 'bg-[#461D77]/10 text-[#461D77]',
      accentColor: '#461D77',
      isFeature: true, // Takes more grid columns on desktop for visual weight
      badge: 'MÓDULO DESPACHO',
      status: 'ACTIVO',
      group: 'supervision' as const
    },
    {
      id: 'llegada' as const,
      title: 'Llegada de Equipos',
      subtitle: 'Tránsito & Flujo',
      description: 'Análisis minucioso del flujo de transporte, verificación de llegada, frecuencia de cargas estimadas y control integral de flotas en tránsito hacia faenas de litio.',
      icon: Truck,
      color: 'from-teal-500/10 via-[#3FAA88]/5 to-[#3FAA88]/10 border-[#3FAA88]/20',
      iconBg: 'bg-[#3FAA88]/10 text-[#3FAA88]',
      accentColor: '#3FAA88',
      isFeature: true,
      badge: 'LOGÍSTICA IN SITU',
      status: 'ACTIVO',
      group: 'supervision' as const
    },
    {
      id: 'lce' as const,
      title: 'Control LCE',
      subtitle: 'Cumplimiento Salar',
      description: 'Tablero de control y balance de cloruro de litio (LCE) equivalente. Monitoreo constante del cumplimiento de despacho in-situ en el Salar de Atacama.',
      icon: ClipboardList,
      color: 'from-cyan-500/10 via-[#4FD1C5]/5 to-[#4FD1C5]/10 border-[#4FD1C5]/20',
      iconBg: 'bg-[#4FD1C5]/15 text-[#2cbba5]',
      accentColor: '#4FD1C5',
      badge: 'SALAR DE ATACAMA',
      status: 'ESTADÍSTICAS',
      group: 'jefe_turno' as const
    },
    {
      id: 'ddd' as const,
      title: 'Análisis Técnico',
      subtitle: 'Diálogo de Desempeño',
      description: 'Análisis detallado de indicadores del Tablero M1. Herramientas técnicas estructuradas para reuniones operativas sistemáticas de Desempeño (DdD).',
      icon: BarChart3,
      color: 'from-amber-600/10 via-[#C59E4D]/5 to-[#C59E4D]/10 border-[#C59E4D]/25',
      iconBg: 'bg-[#C59E4D]/15 text-[#b28b3b]',
      accentColor: '#C59E4D',
      badge: 'SALA REUNIÓN M1',
      status: 'ESTRATÉGICO',
      group: 'supervision' as const
    },
    {
      id: 'cambioTurno' as const,
      title: 'Cambio de Turno',
      subtitle: 'Relevo & Rendimiento',
      description: 'Sincronización fluida de datos operativos para la entrega e inicio de jornadas de trabajo, con cálculo automático de traslape y rendimiento de flota.',
      icon: RefreshCw,
      color: 'from-sky-500/10 via-[#7177EC]/5 to-[#7177EC]/10 border-[#7177EC]/20',
      iconBg: 'bg-[#7177EC]/10 text-[#7177EC]',
      accentColor: '#7177EC',
      badge: 'ENTREGA DE SECCIÓN',
      status: 'SINCRONIZADO',
      group: 'jefe_turno' as const
    },
    {
      id: 'galeria' as const,
      title: 'Galería Operativa',
      subtitle: 'Registro de Evidencia',
      description: 'Galería visual autoadministrable de fotos y reportes gráficos tomados en terreno. Soporta carga instantánea, carrusel y catalogación de novedades.',
      icon: ImageIcon,
      color: 'from-purple-500/10 via-levanda/10 to-levanda/20 border-violeta/15',
      iconBg: 'bg-violeta/10 text-violeta',
      accentColor: '#7177EC',
      badge: 'SOPORTE EN TERRENO',
      status: 'REGISTRO',
      group: 'jefe_turno' as const
    },
    {
      id: 'memoria' as const,
      title: 'Memoria Histórica',
      subtitle: 'Historial de Respaldos',
      description: 'Base de conocimiento y bitácora de respaldo de jornadas operativas anteriores. Recupera, visualiza e importa consolidados históricos con un solo clic.',
      icon: History,
      color: 'from-zinc-500/10 via-slate-100 to-slate-200 border-slate-300/40',
      iconBg: 'bg-slate-500/10 text-slate-700',
      accentColor: '#171717',
      badge: 'ARCHIVO SEGURADO',
      status: 'SISTEMA LOCAL',
      group: 'jefe_turno' as const
    }
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED] relative overflow-x-hidden overflow-y-auto flex flex-col justify-between">
      
      {/* Decorative High-End Tech background grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#7177ec04_1px,transparent_1px),linear-gradient(to_bottom,#7177ec04_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-70 pointer-events-none z-0" />
      
      {/* Dynamic backdrop glows */}
      <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-[#7177EC]/4 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-[#461D77]/3 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-1/2 right-10 w-[300px] h-[300px] bg-[#3FAA88]/3 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Content Safe Area wrapper */}
      <div className="relative z-10 w-full max-w-[102rem] mx-auto px-6 py-6 md:py-10 flex-grow flex flex-col gap-6 md:gap-10">
        
        {/* TOP STATUS NAVIGATION BAR (Glassmorphism Header) */}
        <header className="w-full bg-white/60 backdrop-blur-md rounded-3xl border border-white/50 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <NovandinoLogo className="h-16 w-[200px]" variant="small" />
            <div className="hidden sm:block h-8 w-[1px] bg-slate-300/60" />
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 bg-nucleo/10 text-nucleo text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase">
                SISTEMA INFORMATIZADO M1
              </span>
              <p className="text-[11px] font-medium text-slate-500 tracking-wide">
                SUBGERENCIA LOGÍSTICA LITIO &bull; DESPACHO
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-3.5">
            {/* Admin actions (Users and logs) */}
            {currentUser?.role === 'admin' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectView('users')}
                  className="bg-[#461D77]/8 hover:bg-[#461D77]/15 border border-[#461D77]/20 rounded-2xl px-4 py-2.5 text-[10px] font-black text-[#461D77] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <User size={13} strokeWidth={2.5} /> Usuarios
                </button>
                <button
                  type="button"
                  onClick={() => onSelectView('logs')}
                  className="bg-indigo-500/8 hover:bg-indigo-500/15 border border-indigo-500/20 rounded-2xl px-4 py-2.5 text-[10px] font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Activity size={13} strokeWidth={2.5} /> Bitácora
                </button>
              </div>
            )}

            {/* Operator Live Profile */}
            <div className="bg-white/80 border border-slate-200/50 rounded-2xl px-4 py-2 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#461D77] rounded-xl flex items-center justify-center text-white font-extrabold text-xs shadow-inner uppercase">
                {currentUser?.name ? currentUser.name.substring(0, 2) : 'CT'}
              </div>
              <div className="text-left">
                <span className="text-[8px] font-black text-[#4e2283] tracking-widest uppercase block mb-0.5">
                  {currentUser?.role === 'admin' ? 'ADMINISTRADOR' : currentUser?.role === 'jefe_turno' ? 'JEFE TURNO' : 'SUPERVISOR'}
                </span>
                <p className="text-[11px] font-extrabold text-slate-700 leading-none">
                  {currentUser?.name || 'Analista Activo'}
                </p>
              </div>
            </div>

            {/* Change Password modal trigger button */}
            <button
              type="button"
              onClick={() => {
                setPassError('');
                setPassSuccess('');
                setShowChangePassword(true);
              }}
              className="bg-[#461D77]/8 hover:bg-[#461D77]/15 border border-[#461D77]/20 rounded-2xl px-4 py-2.5 text-[10px] font-black text-[#461D77] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Key size={13} strokeWidth={2.5} /> Clave
            </button>

            {/* Sign Out Trigger button */}
            <button
              type="button"
              onClick={onLogout}
              className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-2xl px-4 py-2.5 text-[10px] font-black text-rose-600 uppercase tracking-widest transition-all cursor-pointer"
            >
              Salir
            </button>

            {/* Real-time Clock Widget */}
            <div className="bg-white/80 border border-slate-200/50 rounded-2xl px-5 py-2 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#7177EC]" />
                <span className="font-mono text-sm font-extrabold text-tecnico tracking-tight">{time || '00:00:00'}</span>
              </div>
              <div className="w-[1px] h-4 bg-slate-200" />
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-[#3FAA88]" />
                <span className="text-[11px] font-bold text-slate-500 capitalize">{dateStr.replace(' de 2026', '') || 'Cargando fecha...'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* HERO SECTION - Welcome and general operational context */}
        <section className="w-full bg-gradient-to-r from-[#1e1b4b] via-[#311042] to-[#110e2e] rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-xl border-t border-white/10">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:1.5rem_1.5rem]" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-violeta/10 rounded-full blur-[100px] -mr-16 -mt-16 pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-litio/10 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="relative z-10 max-w-4xl space-y-4">
            <span className="inline-flex items-center gap-1.5 bg-[#4FD1C5]/10 text-[#4FD1C5] text-[10px] font-black tracking-widest px-3 py-1.5 rounded-xl uppercase">
              <Activity size={12} className="animate-pulse" /> CONTROL ADJUNTO DE OPERACIÓN 2026
            </span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-none">
              CENTRO DE CONTROL LITIO <span className="text-[#4FD1C5]">NOVANDINO</span>
            </h1>
            <p className="text-slate-300 font-medium text-sm md:text-base leading-relaxed">
              Plataforma y repositorio integral de control técnico para la Subgerencia de Logística de Litio. 
              Por favor, seleccione un módulo operativo para registrar despachos, verificar la llegada de equipos, 
              ejecutar diálogos de desempeño o exportar los informes oficiales de la jornada.
            </p>
          </div>
        </section>

        {/* MODULE FILTER TABS */}
        {currentUser?.role !== 'supervision' && (
          <div className="flex items-center justify-center gap-3 bg-white/50 border border-white p-2 md:p-2.5 rounded-3xl max-w-sm mx-auto backdrop-blur-md shadow-sm z-10 relative">
            <button 
              type="button"
              onClick={() => setActiveTab('supervision')}
              className={`flex-1 px-5 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all cursor-pointer text-center ${
                activeTab === 'supervision' 
                  ? 'bg-[#461D77] text-white shadow-sm' 
                  : 'text-slate-600 hover:text-[#461D77] hover:bg-white/50'
              }`}
            >
              Supervisión
            </button>
            <button 
              type="button"
              onClick={handleJefeTurnoClick}
              className={`flex-1 px-5 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all cursor-pointer text-center ${
                activeTab === 'jefe_turno' 
                  ? 'bg-[#7177EC] text-white shadow-sm' 
                  : 'text-slate-600 hover:text-[#7177EC] hover:bg-white/50'
              }`}
            >
              Jefe Turno
            </button>
          </div>
        )}

        {/* BENTO GRID MODULE SELECTOR */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-12 w-full z-10 relative"
        >
          {/* SECTION I: SUPERVISIÓN */}
          {activeTab === 'supervision' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-300/40">
                <div className="w-2.5 h-6 rounded-full bg-gradient-to-b from-[#461D77] to-indigo-500 shadow-sm" />
                <div>
                  <h3 className="text-xl font-black text-[#1e1b4b] uppercase tracking-wider leading-none">Módulo Supervisión</h3>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {cardsData.filter(c => c.group === 'supervision').map((card) => {
                  const IconComponent = card.icon;
                  const isFeature = card.isFeature && activeTab === 'todos';
                  return (
                    <motion.button
                      key={card.id}
                      variants={itemVariants}
                      onClick={() => onSelectView(card.id)}
                      className={`group relative bg-white/70 hover:bg-white border rounded-[2rem] p-7 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between text-left overflow-hidden cursor-pointer h-[21rem] ${
                        isFeature ? 'lg:col-span-2' : ''
                      } ${card.color}`}
                    >
                      {/* Background light gradient spot reflecting on hover */}
                      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-white/10 to-transparent rounded-bl-[4rem] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
                      
                      {/* Top Badge and Indicator line */}
                      <div className="flex items-center justify-between w-full relative z-10">
                        <span className="text-[9px] font-black tracking-widest text-slate-400 group-hover:text-tecnico transition-colors uppercase">
                          {card.badge}
                        </span>
                        
                        {/* Status bubble */}
                        <span className={`text-[8px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase ${
                          card.id === 'informe' || card.id === 'llegada'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-slate-400/10 text-slate-600'
                        }`}>
                          &bull; {card.status}
                        </span>
                      </div>

                      {/* Center Content: Large Icon and Title */}
                      <div className="space-y-4 my-auto relative z-10">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm ${card.iconBg} group-hover:scale-110 group-hover:rotate-3`}>
                          <IconComponent size={28} strokeWidth={1.5} />
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">{card.subtitle}</p>
                          <h2 className="text-2xl font-black text-tecnico tracking-tight group-hover:text-nucleo transition-colors">
                            {card.title}
                          </h2>
                          <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-3 font-medium">
                            {card.description}
                          </p>
                        </div>
                      </div>

                      {/* Bottom Access Arrow Line */}
                      <div className="w-full pt-4 border-t border-slate-100 flex items-center justify-between text-[9px] font-black tracking-widest uppercase transition-colors relative z-10">
                        <span className="text-slate-400 group-hover:text-tecnico transition-colors">ACCEDER AL COMPONENTE</span>
                        <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-nucleo group-hover:text-white flex items-center justify-center text-slate-500 transition-all duration-300">
                          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION II: JEFE TURNO */}
          {activeTab === 'jefe_turno' && currentUser?.role !== 'supervision' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-300/40">
                <div className="w-2.5 h-6 rounded-full bg-gradient-to-b from-[#7177EC] to-sky-400 shadow-sm" />
                <div>
                  <h3 className="text-xl font-black text-[#1e1b4b] uppercase tracking-wider leading-none">Módulo Jefe Turno</h3>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                {cardsData.filter(c => c.group === 'jefe_turno').map((card) => {
                  const IconComponent = card.icon;
                  return (
                    <motion.button
                      key={card.id}
                      variants={itemVariants}
                      onClick={() => onSelectView(card.id)}
                      className={`group relative bg-white/70 hover:bg-white border rounded-[2rem] p-7 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between text-left overflow-hidden cursor-pointer h-[21rem] ${card.color}`}
                    >
                      {/* Background light gradient spot reflecting on hover */}
                      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-white/10 to-transparent rounded-bl-[4rem] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
                      
                      {/* Top Badge and Indicator line */}
                      <div className="flex items-center justify-between w-full relative z-10">
                        <span className="text-[9px] font-black tracking-widest text-slate-400 group-hover:text-tecnico transition-colors uppercase">
                          {card.badge}
                        </span>
                        
                        {/* Status bubble */}
                        <span className={`text-[8px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase ${
                          card.id === 'lce'
                            ? 'bg-cyan-500/10 text-cyan-600'
                            : 'bg-slate-400/10 text-slate-600'
                        }`}>
                          &bull; {card.status}
                        </span>
                      </div>

                      {/* Center Content: Large Icon and Title */}
                      <div className="space-y-4 my-auto relative z-10">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm ${card.iconBg} group-hover:scale-110 group-hover:rotate-3`}>
                          <IconComponent size={28} strokeWidth={1.5} />
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">{card.subtitle}</p>
                          <h2 className="text-2xl font-black text-tecnico tracking-tight group-hover:text-nucleo transition-colors">
                            {card.title}
                          </h2>
                          <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-3 font-medium">
                            {card.description}
                          </p>
                        </div>
                      </div>

                      {/* Bottom Access Arrow Line */}
                      <div className="w-full pt-4 border-t border-slate-100 flex items-center justify-between text-[9px] font-black tracking-widest uppercase transition-colors relative z-10">
                        <span className="text-slate-400 group-hover:text-tecnico transition-colors">ACCEDER AL COMPONENTE</span>
                        <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-nucleo group-hover:text-white flex items-center justify-center text-slate-500 transition-all duration-300">
                          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* FOOTER BAR */}
      <footer className="relative z-10 py-8 bg-white/40 border-t border-slate-200/55 text-center mt-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.2em]">
            NOVANDINO &bull; SUBGERENCIA LOGÍSTICA LITIO &bull; DESPACHO LITIO
          </p>
          <p className="text-[10px] text-slate-400 font-bold tracking-widest">
            SISTEMA DIGITAL INTEGRADO &bull; VERSIÓN 2026.2
          </p>
        </div>
      </footer>
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

      {/* CUSTOM CHANGE PASSWORD MODAL */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Blur backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-[#1e1b4b]/60 backdrop-blur-sm"
            onClick={() => !passSaving && setShowChangePassword(false)}
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-white w-full max-w-md rounded-[2.5rem] border border-slate-200 shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Header branding lock top */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[1.2rem] bg-[#461D77]/10 flex items-center justify-center text-[#461D77]">
                  <Lock size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="text-[8px] font-black tracking-widest text-[#4e2283] uppercase bg-[#4e2283]/10 px-2 py-0.5 rounded-full">
                    SEGURIDAD DE SESIÓN
                  </span>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Cambiar Contraseña</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePassword(false)}
                disabled={passSaving}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error or Success banners */}
            {passError && (
              <div className="mb-5 bg-red-50 border border-red-100 text-red-700 rounded-2xl p-3.5 flex items-center gap-2 text-xs font-semibold">
                <AlertTriangle size={15} />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="mb-5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl p-3.5 flex items-center gap-2 text-xs font-semibold">
                <CheckCircle size={15} />
                <span>{passSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div className="space-y-1.55">
                <label className="text-[9px] font-black tracking-widest text-[#461D77] uppercase block">
                  Contraseña Actual
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={passwordCurrent}
                    onChange={(e) => setPasswordCurrent(e.target.value)}
                    placeholder="Ingrese su clave actual de acceso"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-[#461D77] rounded-xl text-xs font-bold text-slate-700 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.55">
                <label className="text-[9px] font-black tracking-widest text-[#461D77] uppercase block">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={passwordNew}
                    onChange={(e) => setPasswordNew(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-[#461D77] rounded-xl text-xs font-bold text-slate-700 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.55">
                <label className="text-[9px] font-black tracking-widest text-[#461D77] uppercase block">
                  Confirmar Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Re-ingrese la nueva clave"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-[#461D77] rounded-xl text-xs font-bold text-slate-700 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  disabled={passSaving}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 font-extrabold text-[10px] tracking-widest py-3 rounded-2xl uppercase transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={passSaving}
                  className="flex-1 bg-[#461D77] hover:bg-[#321159] disabled:bg-[#461D77]/50 text-white font-extrabold text-[10px] tracking-widest py-3 rounded-2xl flex items-center justify-center gap-2 hover:shadow-lg transition-all uppercase cursor-pointer"
                >
                  {passSaving ? 'Guardando...' : 'Guardar Clave'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MainMenu;


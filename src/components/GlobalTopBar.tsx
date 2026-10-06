import React, { useState, useRef, useEffect } from 'react';
import {
  Home,
  ChevronRight,
  Search,
  Maximize2,
  Minimize2,
  User,
  LogOut,
  ArrowLeft,
  Activity,
  Users,
  Shield,
  Sparkles,
  Command
} from 'lucide-react';
import { AppView, VIEW_TO_PATH } from './App';
import { SystemUser } from '../services/firebase';
import { NovandinoLogo } from './BrandLogo';
import { useMiningShiftClock } from '../hooks/useControlRoom';

interface GlobalTopBarProps {
  currentView: AppView;
  currentUser: SystemUser;
  activeLocation?: string | null;
  onNavigate: (view: AppView) => void;
  onBack: () => void;
  onLogout: () => void;
  onOpenCommandPalette: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const MODULE_NAMES: Partial<Record<AppView, { title: string; parent?: string }>> = {
  'stokes': { title: 'Reporte Stokes', parent: 'Salar de Atacama' },
  'cambioTurno': { title: 'Cambio de Turno', parent: 'Salar de Atacama' },
  'llegada': { title: 'Llegada de Equipos', parent: 'Salar de Atacama' },
  'lce': { title: 'Control LCE', parent: 'Salar de Atacama' },
  'ddd': { title: 'Tablero DdD', parent: 'Salar de Atacama' },
  'informe-novandino': { title: 'Informe Novandino', parent: 'Salar de Atacama' },
  'informe-sqm': { title: 'Informe SQM NY', parent: 'Salar de Atacama' },
  'memoria': { title: 'Módulo Memoria', parent: 'Salar de Atacama' },
  'galeria': { title: 'Galería de Informes', parent: 'Salar de Atacama' },
  'slit': { title: 'Dashboard SLIT', parent: 'Salar de Atacama' },
  'cumplimiento-mq': { title: 'Cumplimiento MQ', parent: 'Salar de Atacama' },
  'cumplimiento-jorquera': { title: 'Cumplimiento Jorquera', parent: 'Salar de Atacama' },
  'users': { title: 'Gestión de Usuarios', parent: 'Administración' },
  'logs': { title: 'Bitácora de Auditoría', parent: 'Administración' },
  '404': { title: 'Ruta No Encontrada (404)', parent: 'Navegación' }
};

export const GlobalTopBar: React.FC<GlobalTopBarProps> = ({
  currentView,
  currentUser,
  activeLocation,
  onNavigate,
  onBack,
  onLogout,
  onOpenCommandPalette,
  isFullscreen,
  onToggleFullscreen
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const shiftInfo = useMiningShiftClock();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const moduleInfo = MODULE_NAMES[currentView];
  const isMenu = currentView === 'menu';
  const locationLabel = activeLocation || 'Salar de Atacama';

  const userInitials = (currentUser?.name || 'U')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  const roleLabel =
    currentUser?.role === 'admin'
      ? 'Administrador'
      : currentUser?.role === 'jefe_turno'
      ? 'Jefe de Turno'
      : 'Supervisión';

  const roleColor =
    currentUser?.role === 'admin'
      ? 'bg-purple-100 text-[#461D77] border-purple-200'
      : currentUser?.role === 'jefe_turno'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-emerald-100 text-emerald-800 border-emerald-200';

  return (
    <header className="sticky top-0 z-40 w-full bg-white/85 backdrop-blur-md border-b border-slate-200/80 shadow-xs no-print transition-all">
      <div className="max-w-[102rem] mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
        
        {/* Left: Branding & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <NovandinoLogo className="h-9 w-auto shrink-0 hidden sm:block" variant="small" />

          <div className="hidden sm:block h-5 w-[1px] bg-slate-200 shrink-0" />

          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 overflow-hidden">
            <button
              onClick={() => onNavigate('menu')}
              className={`flex items-center gap-1.5 py-1 px-2 rounded-lg transition-colors cursor-pointer ${
                isMenu
                  ? 'text-[#461D77] font-bold bg-[#461D77]/8'
                  : 'hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Ir al Menú Principal"
            >
              <Home size={14} className="shrink-0" />
              <span>Inicio</span>
            </button>

            {!isMenu && (
              <>
                <ChevronRight size={13} className="text-slate-300 shrink-0" />
                <span className="text-slate-400 truncate hidden md:inline">
                  {moduleInfo?.parent || locationLabel}
                </span>

                <ChevronRight size={13} className="text-slate-300 shrink-0 hidden md:inline" />

                <span className="text-[#461D77] font-black truncate bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md">
                  {moduleInfo?.title || currentView}
                </span>

                <button
                  onClick={onBack}
                  className="ml-1.5 hidden lg:flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-[#461D77] bg-white border border-slate-200 hover:border-slate-300 px-2 py-0.5 rounded-md transition-all cursor-pointer shadow-2xs"
                  title="Volver a la vista anterior (←)"
                >
                  <ArrowLeft size={12} />
                  <span>Volver</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="flex-1 max-w-md mx-2 hidden md:block">
          <button
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between gap-3 px-3.5 py-1.5 bg-slate-100/80 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300 rounded-xl text-xs text-slate-400 hover:text-slate-600 transition-all cursor-pointer shadow-2xs group"
            title="Abrir búsqueda y atajos (Ctrl+K)"
          >
            <div className="flex items-center gap-2">
              <Search size={14} className="text-slate-400 group-hover:text-[#461D77] transition-colors" />
              <span className="font-medium text-slate-500 group-hover:text-slate-700">
                Buscar módulos, reportes o atajos...
              </span>
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-slate-500 shadow-2xs">
              <Command size={10} />
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Right: Fullscreen + Mobile Search + User Menu */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile search button */}
          <button
            onClick={onOpenCommandPalette}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
            title="Buscar"
          >
            <Search size={18} />
          </button>

          {/* Real-time Mining Shift Indicator */}
          <div
            className="hidden xl:flex items-center gap-2 px-2.5 py-1 bg-slate-100/80 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs select-none"
            title={`Jornada Minera: ${shiftInfo.shiftHours} · Restan ${shiftInfo.remainingShiftTime}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-black text-slate-800">{shiftInfo.shiftName}</span>
            <span className="text-slate-300">&bull;</span>
            <span className="font-mono text-[11px] text-[#461D77] font-bold">{shiftInfo.timeString}</span>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={onToggleFullscreen}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Modo Pantalla Completa (Sala de Control)'}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>

          <div className="h-5 w-[1px] bg-slate-200 mx-0.5" />

          {/* User Profile Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(prev => !prev)}
              className="flex items-center gap-2.5 p-1.5 pl-2 rounded-2xl hover:bg-slate-100/80 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#461D77] to-[#7177EC] text-white flex items-center justify-center text-[11px] font-black shadow-xs">
                {userInitials}
              </div>
              <div className="text-left hidden lg:block">
                <div className="text-xs font-bold text-slate-800 leading-tight">
                  {currentUser?.name || 'Usuario'}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {roleLabel}
                </div>
              </div>
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900">{currentUser?.name}</p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">@{currentUser?.username || currentUser?.userId}</p>
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${roleColor}`}>
                      <Shield size={10} />
                      {roleLabel}
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenCommandPalette();
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Search size={14} className="text-slate-400" />
                      Paleta de Comandos
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Ctrl+K</span>
                  </button>

                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onNavigate('users');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Users size={14} className="text-slate-400" />
                      Gestión de Usuarios
                    </button>
                  )}

                  {(currentUser?.role === 'admin' || currentUser?.role === 'jefe_turno') && (
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onNavigate('logs');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Activity size={14} className="text-slate-400" />
                      Bitácora de Auditoría
                    </button>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-1 mt-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <LogOut size={14} />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
};

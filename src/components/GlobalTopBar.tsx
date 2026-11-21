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
  Command,
  KeyRound
} from 'lucide-react';
import { AppView, VIEW_TO_PATH } from './App';
import { SystemUser } from '../services/firebase';
import { NovandinoLogo } from './BrandLogo';
import { useMiningShiftClock } from '../hooks/useControlRoom';
import { ChangePasswordModal } from './ChangePasswordModal';
import { PWAInstallButton } from './PWAStatusControls';

interface GlobalTopBarProps {
  currentView: AppView;
  currentUser: SystemUser;
  activeLocation?: string | null;
  onNavigate: (view: AppView) => void;
  onSelectLocation?: (location: string | null) => void;
  onBack: () => void;
  onLogout: () => void;
  onOpenCommandPalette: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenChangePassword?: () => void;
  onUpdateCurrentUser?: (user: SystemUser) => void;
}

const MODULE_NAMES: Partial<Record<AppView, { title: string; parent?: string; parentLocation?: string }>> = {
  'stokes': { title: 'Reporte Stokes', parent: 'Salar de Atacama', parentLocation: 'Salar de Atacama' },
  'cambioTurno': { title: 'Cambio de Turno', parent: 'Salar de Atacama', parentLocation: 'Salar de Atacama' },
  'llegada': { title: 'Llegada de Equipos', parent: 'Salar de Atacama', parentLocation: 'Salar de Atacama' },
  'lce': { title: 'Control LCE', parent: 'Salar de Atacama', parentLocation: 'Salar de Atacama' },
  'ddd': { title: 'Tablero DdD', parent: 'Salar de Atacama', parentLocation: 'Salar de Atacama' },
  'informe-novandino': { title: 'Informe Novandino', parent: 'Salar de Atacama', parentLocation: 'Salar de Atacama' },
  'informe-sqm': { title: 'Informe SQM NY', parent: 'Salar de Atacama', parentLocation: 'Salar de Atacama' },
  'memoria': { title: 'Módulo Memoria', parent: 'Salar de Atacama', parentLocation: 'Salar de Atacama' },
  'galeria': { title: 'Galería de Informes', parent: 'Salar de Atacama', parentLocation: 'Salar de Atacama' },
  'slit': { title: 'Dashboard SLIT', parent: 'Salar de Atacama', parentLocation: 'Salar de Atacama' },
  'cumplimiento-mq': { title: 'Cumplimiento MQ', parent: 'Planta Química Litio (PQL)', parentLocation: 'PQL' },
  'cumplimiento-jorquera': { title: 'Cumplimiento Jorquera', parent: 'Planta Química Litio (PQL)', parentLocation: 'PQL' },
  'informe-operativo': { title: 'Informe Operativo PQL', parent: 'Planta Química Litio (PQL)', parentLocation: 'PQL' },
  'users': { title: 'Gestión de Usuarios', parent: 'Administración' },
  'logs': { title: 'Bitácora de Auditoría', parent: 'Administración' },
  '404': { title: 'Ruta No Encontrada (404)', parent: 'Navegación' }
};

export const GlobalTopBar: React.FC<GlobalTopBarProps> = ({
  currentView,
  currentUser,
  activeLocation,
  onNavigate,
  onSelectLocation,
  onBack,
  onLogout,
  onOpenCommandPalette,
  isFullscreen,
  onToggleFullscreen,
  onOpenChangePassword,
  onUpdateCurrentUser
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [internalChangePasswordOpen, setInternalChangePasswordOpen] = useState(false);
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
      ? 'bg-[#461D77]/10 text-[#461D77] border-[#461D77]/20'
      : currentUser?.role === 'jefe_turno'
      ? 'bg-[#EFECE6] text-[#1C1917] border-[#E2DFD7]'
      : 'bg-emerald-50 text-[#15803D] border-emerald-200';

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FFFFFF] border-b border-[#D8D4CA] shadow-[0_1px_3px_rgba(24,22,21,0.06),0_6px_16px_-6px_rgba(24,22,21,0.06)] no-print transition-colors duration-150 ease-out">
      <div className="max-w-[102rem] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        
        {/* Left: Branding & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <NovandinoLogo className="h-8 w-auto shrink-0 hidden sm:block" variant="small" />

          <div className="hidden sm:block h-5 w-[1px] bg-[#D8D4CA] shrink-0" />

          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-medium text-[#57534E] overflow-hidden">
            <button
              onClick={() => onNavigate('menu')}
              className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-md transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                isMenu
                  ? 'text-[#461D77] font-bold bg-[#461D77]/8'
                  : 'hover:text-[#181615] hover:bg-[#EFECE4]'
              }`}
              title="Ir al Menú Principal"
            >
              <Home size={14} className="shrink-0" />
              <span>Inicio</span>
            </button>

            {!isMenu && (
              <>
                <ChevronRight size={13} className="text-[#B8B2A4] shrink-0" />
                {moduleInfo?.parentLocation ? (
                  <button
                    onClick={() => {
                      if (onSelectLocation) onSelectLocation(moduleInfo.parentLocation!);
                      onNavigate('menu');
                    }}
                    className="text-[#57534E] hover:text-[#461D77] hover:bg-[#EFECE4] px-2 py-1 rounded-md transition-colors duration-150 truncate hidden md:inline cursor-pointer whitespace-nowrap"
                    title={`Ir a ${moduleInfo.parent}`}
                  >
                    {moduleInfo?.parent}
                  </button>
                ) : (
                  <span className="text-[#57534E] truncate hidden md:inline whitespace-nowrap">
                    {moduleInfo?.parent || locationLabel}
                  </span>
                )}

                <ChevronRight size={13} className="text-[#B8B2A4] shrink-0 hidden md:inline" />

                <span className="text-[#181615] font-bold truncate px-1.5 py-0.5 border-b-2 border-[#461D77]">
                  {moduleInfo?.title || currentView}
                </span>

                <button
                  onClick={onBack}
                  className="ml-2 hidden lg:flex items-center gap-1 text-[11px] font-semibold text-[#44403C] hover:text-[#181615] bg-[#F5F3EE] hover:bg-[#E9E6DD] border border-[#D8D4CA] px-2.5 py-1 rounded-md transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                  title="Volver a la vista anterior (←)"
                >
                  <ArrowLeft size={12} />
                  <span>Volver</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Center: Command Palette Trigger (recessed control well) */}
        <div className="flex-1 max-w-md mx-2 hidden md:block">
          <button
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between gap-3 px-3 py-1.5 surface-well hover:bg-[#EAE7DE] hover:border-[#BDB8AC] rounded-md text-xs text-[#57534E] transition-colors duration-150 cursor-pointer group"
            title="Abrir búsqueda y atajos (Ctrl+K)"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search size={14} className="text-[#57534E] group-hover:text-[#461D77] transition-colors duration-150 shrink-0" />
              <span className="font-medium text-[#57534E] group-hover:text-[#181615] truncate">
                Buscar módulos, reportes o atajos...
              </span>
            </div>
            <div className="flex items-center gap-1 bg-[#FFFFFF] border border-[#D8D4CA] shadow-[0_1px_1px_rgba(24,22,21,0.06)] px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold text-[#181615] shrink-0">
              <Command size={10} />
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Right: Fullscreen + Mobile Search + Shift Instrument + User Menu */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile search button */}
          <button
            onClick={onOpenCommandPalette}
            className="md:hidden p-2 rounded-md text-[#57534E] hover:bg-[#EFECE4] cursor-pointer"
            title="Buscar"
          >
            <Search size={17} />
          </button>

          {/* Real-time Mining Shift Instrument (high-contrast dark anchor) */}
          <div
            className="hidden xl:flex items-center gap-2.5 px-3 py-1.5 bg-[#181615] text-[#F7F6F2] border border-[#181615] rounded-md text-xs select-none shadow-[0_1px_2px_rgba(24,22,21,0.18)]"
            title={`Jornada Minera: ${shiftInfo.shiftHours} · Restan ${shiftInfo.remainingShiftTime}`}
          >
            <span className="text-[11px] font-semibold text-[#E5E2D9] whitespace-nowrap">{shiftInfo.shiftName}</span>
            <span className="text-[#57534E]">|</span>
            <span className="font-mono tabular-nums text-[11px] text-[#FFFFFF] font-bold tracking-tight whitespace-nowrap">{shiftInfo.timeString}</span>
          </div>

          <PWAInstallButton />

          {/* Fullscreen Toggle */}
          <button
            onClick={onToggleFullscreen}
            className="p-2 rounded-md text-[#57534E] hover:text-[#181615] hover:bg-[#EFECE4] border border-transparent hover:border-[#D8D4CA] transition-colors duration-150 cursor-pointer"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Modo Pantalla Completa (Sala de Control)'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <div className="h-5 w-[1px] bg-[#D8D4CA] mx-0.5" />

          {/* User Profile Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(prev => !prev)}
              className="flex items-center gap-2.5 p-1 pr-2.5 rounded-md hover:bg-[#EFECE4] border border-transparent hover:border-[#D8D4CA] transition-colors duration-150 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-md bg-[#461D77] text-white flex items-center justify-center font-mono text-[11px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                {userInitials}
              </div>
              <div className="text-left hidden lg:block">
                <div className="text-xs font-semibold text-[#181615] leading-tight whitespace-nowrap">
                  {currentUser?.name || 'Usuario'}
                </div>
                <div className="text-[10px] text-[#57534E] font-medium whitespace-nowrap">
                  {roleLabel}
                </div>
              </div>
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-[#FFFFFF] rounded-lg shadow-[0_12px_32px_-8px_rgba(24,22,21,0.18),0_2px_6px_rgba(24,22,21,0.08)] border border-[#D8D4CA] py-1.5 z-50">
                <div className="px-4 py-3 border-b border-[#E5E2D9]">
                  <p className="text-xs font-bold text-[#181615]">{currentUser?.name}</p>
                  <p className="text-[11px] text-[#57534E] font-mono mt-0.5">@{currentUser?.username || currentUser?.userId}</p>
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${roleColor}`}>
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
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-[#1C1917] hover:bg-[#F7F6F2] cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Search size={14} className="text-[#57534E]" />
                      Paleta de Comandos
                    </span>
                    <span className="text-[10px] font-mono text-[#57534E]">Ctrl+K</span>
                  </button>

                  {/* Opción Cambiar Contraseña para cualquier usuario */}
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      if (onOpenChangePassword) {
                        onOpenChangePassword();
                      } else {
                        setInternalChangePasswordOpen(true);
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#1C1917] hover:bg-[#F7F6F2] cursor-pointer transition-colors"
                  >
                    <KeyRound size={14} className="text-[#461D77]" />
                    <span>Cambiar mi Contraseña</span>
                  </button>

                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onNavigate('users');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#1C1917] hover:bg-[#F7F6F2] cursor-pointer"
                    >
                      <Users size={14} className="text-[#57534E]" />
                      Gestión de Usuarios
                    </button>
                  )}

                  {(currentUser?.role === 'admin' || currentUser?.role === 'jefe_turno') && (
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onNavigate('logs');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#1C1917] hover:bg-[#F7F6F2] cursor-pointer"
                    >
                      <Activity size={14} className="text-[#57534E]" />
                      Bitácora de Auditoría
                    </button>
                  )}
                </div>

                <div className="border-t border-[#E2DFD7] pt-1 mt-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-[#B91C1C] hover:bg-red-50 transition-colors cursor-pointer"
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

      {/* Modal para cambio de contraseña */}
      <ChangePasswordModal
        isOpen={internalChangePasswordOpen}
        onClose={() => setInternalChangePasswordOpen(false)}
        currentUser={currentUser}
        onPasswordChanged={onUpdateCurrentUser}
      />
    </header>
  );
};

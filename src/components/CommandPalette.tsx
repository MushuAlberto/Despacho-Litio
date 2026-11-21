import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Sparkles,
  Command,
  FileSpreadsheet,
  Clock,
  Layers,
  Image as ImageIcon,
  History,
  FileText,
  Truck,
  Database,
  BarChart3,
  Users,
  Activity,
  Maximize2,
  LogOut,
  ArrowRight,
  ShieldAlert,
  X,
  KeyRound
} from 'lucide-react';
import { AppView } from './App';
import { SystemUser } from '../services/firebase';

export interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Operaciones Litio' | 'Informes y Análisis' | 'Administración' | 'Herramientas';
  icon: React.ElementType;
  view?: AppView;
  badge?: string;
  adminOnly?: boolean;
  jefeTurnoOnly?: boolean;
  action?: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SystemUser;
  onSelectView: (view: AppView) => void;
  onLogout: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  onOpenChangePassword?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectView,
  onLogout,
  onToggleFullscreen,
  isFullscreen,
  onOpenChangePassword
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items: CommandItem[] = useMemo(() => [
    {
      id: 'stokes',
      title: 'Reporte Stokes',
      subtitle: 'Conexión Microsoft ReportServer clanfdbsw06 y canchas Salar MOP',
      category: 'Operaciones Litio',
      icon: FileSpreadsheet,
      view: 'stokes',
      badge: 'Destacado',
      keywords: ['stokes', 'reportserver', 'excel', 'despacho', 'historico', 'guias']
    },
    {
      id: 'cambioTurno',
      title: 'Cambio de Turno',
      subtitle: 'Análisis de faena, justificaciones operativas y comparativo de turno',
      category: 'Operaciones Litio',
      icon: Clock,
      view: 'cambioTurno',
      badge: 'Operacional',
      keywords: ['cambio', 'turno', 'analisis', 'justificacion', 'faena', 'noche', 'dia']
    },
    {
      id: 'llegada',
      title: 'Llegada de Equipos',
      subtitle: 'Control y cronometraje de arribo de camiones a garita y planta',
      category: 'Operaciones Litio',
      icon: Truck,
      view: 'llegada',
      keywords: ['llegada', 'equipos', 'camiones', 'garita', 'patentes']
    },
    {
      id: 'lce',
      title: 'Control LCE',
      subtitle: 'Monitoreo de despacho de Litio Carbonato Equivalente',
      category: 'Operaciones Litio',
      icon: Layers,
      view: 'lce',
      keywords: ['lce', 'litio', 'carbonato', 'control', 'despacho']
    },
    {
      id: 'ddd',
      title: 'Tablero DdD',
      subtitle: 'Disponibilidad, Demanda y Despacho en tiempo real',
      category: 'Operaciones Litio',
      icon: BarChart3,
      view: 'ddd',
      keywords: ['ddd', 'tablero', 'demanda', 'disponibilidad', 'despacho']
    },
    {
      id: 'informe-novandino',
      title: 'Informe Operativo Novandino',
      subtitle: 'Desglose oficial por producto, faenas, horas y transportistas',
      category: 'Informes y Análisis',
      icon: FileText,
      view: 'informe-novandino',
      badge: 'Principal',
      keywords: ['informe', 'novandino', 'reporte', 'pdf', 'excel', 'kpi']
    },
    {
      id: 'informe-sqm',
      title: 'Informe Operativo SQM NY',
      subtitle: 'Vista de control consolidada para SQM Nueva York',
      category: 'Informes y Análisis',
      icon: FileText,
      view: 'informe-sqm',
      keywords: ['informe', 'sqm', 'ny', 'reporte', 'consolidado']
    },
    {
      id: 'memoria',
      title: 'Módulo Memoria e Historial',
      subtitle: 'Almacén histórico de turnos anteriores e informes guardados',
      category: 'Informes y Análisis',
      icon: History,
      view: 'memoria',
      keywords: ['memoria', 'historial', 'backup', 'informes anteriores', 'fechas']
    },
    {
      id: 'galeria',
      title: 'Galería de Informes',
      subtitle: 'Respaldos visuales en imagen PNG para compartir por Teams/Outlook',
      category: 'Informes y Análisis',
      icon: ImageIcon,
      view: 'galeria',
      keywords: ['galeria', 'imagenes', 'capturas', 'png', 'resumen visual']
    },
    {
      id: 'slit',
      title: 'Dashboard SLIT',
      subtitle: 'Seguimiento específico de salmuera de litio SLIT',
      category: 'Operaciones Litio',
      icon: Database,
      view: 'slit',
      adminOnly: true,
      keywords: ['slit', 'salmuera', 'litio']
    },
    {
      id: 'cumplimiento-mq',
      title: 'Cumplimiento M&Q (PQL)',
      subtitle: 'Control diario de transporte y cumplimiento de camiones M&Q Planta Química',
      category: 'Operaciones Litio',
      icon: Truck,
      view: 'cumplimiento-mq',
      keywords: ['mq', 'm&q', 'cumplimiento', 'pql', 'transporte', 'planta quimica']
    },
    {
      id: 'cumplimiento-jorquera',
      title: 'Cumplimiento Jorquera (PQL)',
      subtitle: 'Control diario de transporte y cumplimiento de camiones Jorquera Planta Química',
      category: 'Operaciones Litio',
      icon: Truck,
      view: 'cumplimiento-jorquera',
      keywords: ['jorquera', 'cumplimiento', 'pql', 'transporte', 'planta quimica']
    },
    {
      id: 'informe-operativo',
      title: 'Informe Operativo PQL (SLIT)',
      subtitle: 'Reporte diario operacional, recepción, descarga y acumulado mensual Planta Química Litio',
      category: 'Informes y Análisis',
      icon: FileText,
      view: 'informe-operativo',
      keywords: ['informe operativo', 'operativo', 'pql', 'slit', 'planta quimica', 'recepcion', 'descarga']
    },
    {
      id: 'users',
      title: 'Gestión de Usuarios',
      subtitle: 'Administración de accesos, roles y contraseñas del sistema',
      category: 'Administración',
      icon: Users,
      view: 'users',
      adminOnly: true,
      keywords: ['usuarios', 'roles', 'password', 'clave', 'accesos', 'admin']
    },
    {
      id: 'logs',
      title: 'Bitácora de Auditoría',
      subtitle: 'Registro de accesos, descargas y eventos del sistema',
      category: 'Administración',
      icon: Activity,
      view: 'logs',
      jefeTurnoOnly: true,
      keywords: ['bitacora', 'auditoria', 'logs', 'seguridad', 'historial de eventos']
    },
    {
      id: 'menu',
      title: 'Menú Principal / Dashboard SdA',
      subtitle: 'Regresar a la pantalla central de módulos y selección de faena',
      category: 'Herramientas',
      icon: Sparkles,
      view: 'menu',
      keywords: ['inicio', 'menu', 'dashboard', 'principal', 'home', 'sda']
    },
    {
      id: 'fullscreen',
      title: isFullscreen ? 'Salir de Pantalla Completa' : 'Modo Pantalla Completa (Sala de Control)',
      subtitle: 'Maximizar el sistema para monitores y proyectores de faena',
      category: 'Herramientas',
      icon: Maximize2,
      action: onToggleFullscreen,
      keywords: ['pantalla', 'completa', 'kiosk', 'monitor', 'fullscreen', 'proyector']
    },
    ...(onOpenChangePassword ? [{
      id: 'change-password',
      title: 'Cambiar mi Contraseña',
      subtitle: `Actualizar la clave de acceso personal de @${currentUser?.username || currentUser?.userId}`,
      category: 'Herramientas' as const,
      icon: KeyRound,
      action: onOpenChangePassword,
      keywords: ['password', 'contraseña', 'clave', 'seguridad', 'cambiar clave', 'credenciales']
    }] : []),
    {
      id: 'logout',
      title: 'Cerrar Sesión Segura',
      subtitle: `Finalizar sesión actual de ${currentUser?.name || 'usuario'}`,
      category: 'Herramientas',
      icon: LogOut,
      action: onLogout,
      keywords: ['cerrar', 'sesion', 'salir', 'logout']
    }
  ], [currentUser, isFullscreen, onLogout, onToggleFullscreen, onOpenChangePassword]);

  // Filter items based on user role and search query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(item => {
      // Permission filtering
      if (item.adminOnly && currentUser?.role !== 'admin') return false;
      if (item.jefeTurnoOnly && currentUser?.role !== 'admin' && currentUser?.role !== 'jefe_turno') return false;

      if (!q) return true;

      const inTitle = item.title.toLowerCase().includes(q);
      const inSubtitle = item.subtitle.toLowerCase().includes(q);
      const inCategory = item.category.toLowerCase().includes(q);
      const inKeywords = (item.keywords || []).some(k => k.toLowerCase().includes(q));

      return inTitle || inSubtitle || inCategory || inKeywords;
    });
  }, [items, currentUser, query]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keyboard navigation within the palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        executeItem(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const executeItem = (item: CommandItem) => {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.view) {
      onSelectView(item.view);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center pt-16 sm:pt-24 px-4 no-print">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#1C1917]/50"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative w-full max-w-2xl bg-[#FFFFFF] rounded-lg shadow-xl border border-[#E2DFD7] overflow-hidden flex flex-col z-10"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E2DFD7] bg-[#F7F6F2]">
              <Search className="text-[#461D77] shrink-0" size={18} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar módulos, reportes o funciones... (Esc para salir)"
                className="w-full bg-transparent text-[#1C1917] text-sm font-medium placeholder:text-[#8C877F] focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 rounded-md text-[#57534E] hover:text-[#1C1917] hover:bg-[#EFECE6]"
                  title="Borrar texto"
                >
                  <X size={15} />
                </button>
              )}
              <div className="hidden sm:flex items-center gap-1 bg-[#FFFFFF] border border-[#E2DFD7] px-2 py-0.5 rounded">
                <kbd className="text-[10px] font-semibold text-[#57534E] font-mono">ESC</kbd>
              </div>
            </div>

            {/* Results List */}
            <div
              ref={listRef}
              className="max-h-[380px] overflow-y-auto divide-y divide-[#E2DFD7]/60"
            >
              {filteredItems.length === 0 ? (
                <div className="py-12 text-center text-[#57534E] space-y-2">
                  <ShieldAlert size={28} className="mx-auto text-[#C7C2B6]" />
                  <p className="text-sm font-semibold text-[#1C1917]">No se encontraron resultados para &ldquo;{query}&rdquo;</p>
                  <p className="text-xs text-[#57534E]">Intenta buscar por &ldquo;stokes&rdquo;, &ldquo;turno&rdquo;, &ldquo;informe&rdquo; o &ldquo;pantalla&rdquo;.</p>
                </div>
              ) : (
                filteredItems.map((item, index) => {
                  const Icon = item.icon;
                  const isSelected = index === selectedIndex;

                  return (
                    <div
                      key={item.id}
                      data-active={isSelected}
                      onClick={() => executeItem(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`group flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-150 ease-out ${
                        isSelected
                          ? 'bg-[#461D77] text-white'
                          : 'hover:bg-[#F7F6F2] text-[#1C1917]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border transition-colors duration-150 ${
                            isSelected
                              ? 'bg-white/15 border-white/20 text-white'
                              : 'bg-[#F7F6F2] border-[#E2DFD7] text-[#461D77]'
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm tracking-tight truncate">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span
                                className={`font-mono text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-[#EFECE6] text-[#461D77] border border-[#E2DFD7]'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-xs truncate ${
                              isSelected ? 'text-white/80' : 'text-[#57534E]'
                            }`}
                          >
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-mono text-[10px] font-medium uppercase tracking-wider hidden sm:inline ${
                            isSelected ? 'text-white/75' : 'text-[#57534E]'
                          }`}
                        >
                          {item.category}
                        </span>
                        <ArrowRight
                          size={14}
                          className={`transition-transform duration-150 group-hover:translate-x-0.5 ${
                            isSelected ? 'text-white' : 'text-[#C7C2B6]'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer / Shortcuts Help */}
            <div className="px-4 py-2.5 bg-[#EFECE6]/60 border-t border-[#E2DFD7] flex items-center justify-between text-[11px] text-[#57534E] font-medium">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="bg-[#FFFFFF] border border-[#E2DFD7] px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold">↑</kbd>
                  <kbd className="bg-[#FFFFFF] border border-[#E2DFD7] px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold">↓</kbd>
                  <span>navegar</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-[#FFFFFF] border border-[#E2DFD7] px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold">↵</kbd>
                  <span>seleccionar</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider">
                <Command size={11} />
                <span>Despacho Litio</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

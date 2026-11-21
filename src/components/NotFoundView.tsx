import React from 'react';
import {
  Compass,
  ArrowLeft,
  Home,
  Search,
  FileSpreadsheet,
  Clock,
  Layers,
  FileText,
  Truck,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { AppView } from './App';
import { NovandinoLogo } from './BrandLogo';

interface NotFoundViewProps {
  attemptedPath: string;
  onNavigate: (view: AppView) => void;
  onBack: () => void;
  onOpenSearch: () => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  attemptedPath,
  onNavigate,
  onBack,
  onOpenSearch
}) => {
  const suggestedModules: Array<{
    title: string;
    subtitle: string;
    view: AppView;
    icon: React.ElementType;
    badge?: string;
  }> = [
    {
      title: 'Reporte Stokes',
      subtitle: 'Conexión Microsoft ReportServer clanfdbsw06 y canchas Salar',
      view: 'stokes',
      icon: FileSpreadsheet,
      badge: 'Destacado'
    },
    {
      title: 'Cambio de Turno',
      subtitle: 'Análisis de tonelaje, horas faena y justificaciones',
      view: 'cambioTurno',
      icon: Clock,
      badge: 'Operacional'
    },
    {
      title: 'Informe Novandino',
      subtitle: 'Desglose y conciliación operativa de la jornada',
      view: 'informe-novandino',
      icon: FileText
    },
    {
      title: 'Control LCE',
      subtitle: 'Monitoreo de despacho de Litio Carbonato',
      view: 'lce',
      icon: Layers
    },
    {
      title: 'Llegada de Equipos',
      subtitle: 'Control de arribo y tiempos de ciclo de camiones',
      view: 'llegada',
      icon: Truck
    }
  ];

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED]">
      <div className="w-full max-w-3xl bg-white/90 backdrop-blur-md rounded-[2.2rem] border border-white shadow-xl p-8 sm:p-10 space-y-7">
        <div className="flex flex-col items-start space-y-3 border-b border-slate-100 pb-6">
          <div className="w-full flex items-center justify-between gap-4">
            <NovandinoLogo className="h-9 w-auto" variant="small" />
            <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-[11px] font-bold uppercase">
              <ShieldAlert size={13} />
              <span>Error 404</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
            Módulo no encontrado
          </h1>

          <p className="text-sm text-slate-500 leading-relaxed">
            La ruta <code className="bg-slate-100 border border-slate-200 text-[#461D77] font-mono font-semibold px-2 py-0.5 rounded-lg text-xs">{attemptedPath || '/'}</code> no coincide con ningún servicio activo.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('menu')}
            className="flex items-center gap-2 bg-[#461D77] hover:bg-[#36155E] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors duration-150 cursor-pointer shadow-sm"
          >
            <Home size={14} />
            <span>Menú Principal</span>
          </button>

          <button
            onClick={onBack}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors duration-150 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Volver</span>
          </button>

          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 bg-white hover:bg-purple-50 text-[#461D77] border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors duration-150 cursor-pointer"
          >
            <Search size={14} />
            <span>Buscar (<span className="font-mono">Ctrl+K</span>)</span>
          </button>
        </div>

        {/* Suggested Modules Section */}
        <div className="pt-5 border-t border-slate-100 text-left">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-[#461D77]" />
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Módulos disponibles
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {suggestedModules.map(mod => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.view}
                  onClick={() => onNavigate(mod.view)}
                  className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 hover:border-[#461D77]/40 hover:bg-purple-50/40 transition-colors duration-150 text-left group cursor-pointer bg-white"
                >
                  <div className="p-2 rounded-xl bg-[#461D77]/10 text-[#461D77] group-hover:bg-[#461D77] group-hover:text-white transition-colors duration-150 shrink-0">
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-[#461D77] transition-colors truncate">
                        {mod.title}
                      </span>
                      {mod.badge && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full bg-purple-50 text-[#461D77] border border-purple-200">
                          {mod.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {mod.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-[11px] font-medium text-slate-400 pt-3 border-t border-slate-100 flex justify-between">
          <span>Subgerencia Logística Litio</span>
          <span>Despacho M1</span>
        </div>
      </div>
    </div>
  );
};

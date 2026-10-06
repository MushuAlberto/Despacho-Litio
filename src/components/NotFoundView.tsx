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
    <div className="min-h-[82vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl border border-slate-200/90 p-8 sm:p-12 text-center space-y-8 relative overflow-hidden">
        {/* Top ambient glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center space-y-4 relative z-10">
          <NovandinoLogo className="h-10 w-auto mb-2" variant="small" />

          {/* 404 Badge */}
          <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 px-3.5 py-1 rounded-full text-xs font-black tracking-wider uppercase">
            <ShieldAlert size={14} className="text-amber-600" />
            <span>Error 404 &bull; Ruta No Encontrada</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            El módulo solicitado no existe o cambió de ubicación
          </h1>

          <p className="text-sm text-slate-500 max-w-lg leading-relaxed">
            La dirección <code className="bg-slate-100 text-[#461D77] font-mono font-bold px-2 py-0.5 rounded-md text-xs">{attemptedPath || '/'}</code> no coincide con ningún servicio activo en la plataforma de Despacho Litio.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
          <button
            onClick={() => onNavigate('menu')}
            className="flex items-center gap-2 bg-[#461D77] hover:bg-[#35145b] text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-md shadow-[#461D77]/20 transition-all cursor-pointer"
          >
            <Home size={15} />
            <span>Volver al Menú Principal</span>
          </button>

          <button
            onClick={onBack}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>Volver a la vista anterior</span>
          </button>

          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-[#461D77] border border-purple-200 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
          >
            <Search size={15} />
            <span>Buscar con Ctrl+K</span>
          </button>
        </div>

        {/* Suggested Modules Section */}
        <div className="pt-6 border-t border-slate-100 text-left relative z-10">
          <div className="flex items-center gap-2 mb-3.5">
            <Sparkles size={14} className="text-[#461D77]" />
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Módulos recomendados para continuar:
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {suggestedModules.map(mod => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.view}
                  onClick={() => onNavigate(mod.view)}
                  className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200/80 hover:border-[#461D77]/40 hover:bg-slate-50/80 transition-all text-left group cursor-pointer"
                >
                  <div className="p-2 rounded-xl bg-slate-100 text-[#461D77] group-hover:bg-[#461D77] group-hover:text-white transition-colors shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-[#461D77] transition-colors truncate">
                        {mod.title}
                      </span>
                      {mod.badge && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {mod.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {mod.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100">
          Subgerencia Logística Litio SQM &bull; Sistema Despacho Litio M1
        </div>
      </div>
    </div>
  );
};

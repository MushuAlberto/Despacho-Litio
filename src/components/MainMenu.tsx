
import React from 'react';
import { Truck, FileBarChart, History, ChevronRight, BarChart3, Image as ImageIcon, RefreshCw, ClipboardList } from 'lucide-react';

interface MainMenuProps {
  onSelectView: (view: 'llegada' | 'informe' | 'memoria' | 'ddd' | 'galeria' | 'cambioTurno' | 'lce') => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onSelectView }) => {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-calido to-levanda p-6 gap-12 overflow-y-auto">
      <div className="text-center space-y-8 flex flex-col items-center">
        <img src="/novandino.png" alt="Novandino Logo" className="h-40 w-auto object-contain" />
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-tecnico tracking-tighter">SISTEMA DE GESTIÓN LOGÍSTICA</h1>
          <p className="text-violeta font-bold tracking-[0.3em] uppercase text-xs">Tablero M1</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-[98rem] w-full px-4">
        <button
          onClick={() => onSelectView('llegada')}
          className="group relative bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col items-center text-center space-y-6 overflow-hidden active:scale-95"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-calido rounded-bl-[4rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500 opacity-50" />
          <div className="w-16 h-16 bg-calido rounded-2xl flex items-center justify-center text-violeta/40 group-hover:bg-nucleo/10 group-hover:text-nucleo transition-colors duration-500">
            <Truck size={32} strokeWidth={1.5} />
          </div>
          <div className="space-y-2 relative z-10">
            <h2 className="text-xl font-black text-tecnico tracking-tight">Llegada de Equipos</h2>
            <p className="text-tecnico/60 text-[10px] leading-relaxed max-w-[150px] mx-auto font-medium">Control de flujo y frecuencias de transporte.</p>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black tracking-widest uppercase text-violeta/30 group-hover:text-nucleo transition-colors">
            Acceder <ChevronRight size={10} />
          </div>
        </button>

        <button
          onClick={() => onSelectView('informe')}
          className="group relative bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col items-center text-center space-y-6 overflow-hidden active:scale-95"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-calido rounded-bl-[4rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500 opacity-50" />
          <div className="w-16 h-16 bg-calido rounded-2xl flex items-center justify-center text-violeta/40 group-hover:bg-ionizado/10 group-hover:text-ionizado transition-colors duration-500">
            <FileBarChart size={32} strokeWidth={1.5} />
          </div>
          <div className="space-y-2 relative z-10">
            <h2 className="text-xl font-black text-tecnico tracking-tight">Informe Operativo</h2>
            <p className="text-tecnico/60 text-[10px] leading-relaxed max-w-[150px] mx-auto font-medium">Dashboard inteligente y reportes PDF.</p>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black tracking-widest uppercase text-violeta/30 group-hover:text-ionizado transition-colors">
            Acceder <ChevronRight size={10} />
          </div>
        </button>

        <button
          onClick={() => onSelectView('ddd')}
          className="group relative bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col items-center text-center space-y-6 overflow-hidden active:scale-95"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-calido rounded-bl-[4rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500 opacity-50" />
          <div className="w-16 h-16 bg-calido rounded-2xl flex items-center justify-center text-violeta/40 group-hover:bg-litio/10 group-hover:text-litio transition-colors duration-500">
            <BarChart3 size={32} strokeWidth={1.5} />
          </div>
          <div className="space-y-2 relative z-10">
            <h2 className="text-xl font-black text-tecnico tracking-tight">Análisis Técnico (DdD)</h2>
            <p className="text-tecnico/60 text-[10px] leading-relaxed max-w-[150px] mx-auto font-medium">Tablero M1: Estadísticas y Diálogos de Desempeño.</p>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black tracking-widest uppercase text-violeta/30 group-hover:text-litio transition-colors">
            Acceder <ChevronRight size={10} />
          </div>
        </button>

        <button
          onClick={() => onSelectView('memoria')}
          className="group relative bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col items-center text-center space-y-6 overflow-hidden active:scale-95"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-calido rounded-bl-[4rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500 opacity-50" />
          <div className="w-16 h-16 bg-calido rounded-2xl flex items-center justify-center text-violeta/40 group-hover:bg-mineral/10 group-hover:text-mineral transition-colors duration-500">
            <History size={32} strokeWidth={1.5} />
          </div>
          <div className="space-y-2 relative z-10">
            <h2 className="text-xl font-black text-tecnico tracking-tight">Memoria</h2>
            <p className="text-tecnico/60 text-[10px] leading-relaxed max-w-[150px] mx-auto font-medium">Archivo histórico de jornadas pasadas.</p>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black tracking-widest uppercase text-violeta/30 group-hover:text-mineral transition-colors">
            Acceder <ChevronRight size={10} />
          </div>
        </button>

        <button
          onClick={() => onSelectView('galeria')}
          className="group relative bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col items-center text-center space-y-6 overflow-hidden active:scale-95"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-calido rounded-bl-[4rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500 opacity-50" />
          <div className="w-16 h-16 bg-calido rounded-2xl flex items-center justify-center text-violeta/40 group-hover:bg-violeta/10 group-hover:text-violeta transition-colors duration-500">
            <ImageIcon size={32} strokeWidth={1.5} />
          </div>
          <div className="space-y-2 relative z-10">
            <h2 className="text-xl font-black text-tecnico tracking-tight">Galería Operativa</h2>
            <p className="text-tecnico/60 text-[10px] leading-relaxed max-w-[150px] mx-auto font-medium">Registro fotográfico y carrusel de imágenes.</p>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black tracking-widest uppercase text-violeta/30 group-hover:text-violeta transition-colors">
            Acceder <ChevronRight size={10} />
          </div>
        </button>

        <button
          onClick={() => onSelectView('cambioTurno')}
          className="group relative bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col items-center text-center space-y-6 overflow-hidden active:scale-95"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-calido rounded-bl-[4rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500 opacity-50" />
          <div className="w-16 h-16 bg-calido rounded-2xl flex items-center justify-center text-violeta/40 group-hover:bg-violeta/10 group-hover:text-violeta transition-colors duration-500">
            <RefreshCw size={32} strokeWidth={1.5} />
          </div>
          <div className="space-y-2 relative z-10">
            <h2 className="text-xl font-black text-tecnico tracking-tight">Cambio de Turno</h2>
            <p className="text-tecnico/60 text-[10px] leading-relaxed max-w-[150px] mx-auto font-medium">Análisis de traslape y rendimiento semanal.</p>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black tracking-widest uppercase text-violeta/30 group-hover:text-violeta transition-colors">
            Acceder <ChevronRight size={10} />
          </div>
        </button>

        <button
          onClick={() => onSelectView('lce')}
          className="group relative bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col items-center text-center space-y-6 overflow-hidden active:scale-95"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-calido rounded-bl-[4rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500 opacity-50" />
          <div className="w-16 h-16 bg-calido rounded-2xl flex items-center justify-center text-violeta/40 group-hover:bg-cyan-500/10 group-hover:text-cyan-600 transition-colors duration-500">
            <ClipboardList size={32} strokeWidth={1.5} />
          </div>
          <div className="space-y-2 relative z-10">
            <h2 className="text-xl font-black text-tecnico tracking-tight">Control LCE</h2>
            <p className="text-tecnico/60 text-[10px] leading-relaxed max-w-[150px] mx-auto font-medium">Indicadores y cumplimiento Salar de Atacama.</p>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black tracking-widest uppercase text-violeta/30 group-hover:text-cyan-600 transition-colors">
            Acceder <ChevronRight size={10} />
          </div>
        </button>
      </div>

      <div className="mt-20 text-[10px] text-violeta/40 font-bold uppercase tracking-[0.4em]">
        SUBGERENCIA LOGÍSTICA LITIO - DESPACHO LITIO - 2026
      </div>
    </div>
  );
};

export default MainMenu;

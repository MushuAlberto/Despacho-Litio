
import React from 'react';
import {
  X, Truck, FileBarChart, History, AlertCircle, Info, CheckCircle2,
  ChevronRight, FileSpreadsheet, FileJson
} from 'lucide-react';

interface InstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InstructionModal: React.FC<InstructionModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#461D77] to-[#7177EC] px-8 py-5 flex justify-between items-center shrink-0 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center text-white">
              <Info size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight leading-none uppercase">Guía de Operación</h2>
              <p className="text-[11px] text-purple-100 uppercase tracking-wider mt-1">Sistema de Gestión Logística</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors duration-150 ease-out cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-3 border border-slate-200 rounded-2xl divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-white">

            {/* Módulo 1 */}
            <div className="p-6 flex flex-col space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#461D77]/10 text-[#461D77] rounded-xl flex items-center justify-center shrink-0">
                  <Truck size={16} />
                </div>
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider">1. Llegada de Equipos</h3>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Archivo fuente</p>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={14} className="text-[#461D77] shrink-0" />
                  <span className="text-xs font-semibold text-slate-800">02.- Histórico Romanas</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">Procesa el flujo de entrada de camiones. Genera análisis de frecuencia por hora y tablas de control por empresa y destino.</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-xs text-slate-700"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Gráficos de frecuencia</li>
                  <li className="flex items-center gap-2 text-xs text-slate-700"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Reportes con branding</li>
                  <li className="flex items-center gap-2 text-xs text-slate-700"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> PDF para correo</li>
                </ul>
              </div>
            </div>

            {/* Módulo 2 */}
            <div className="p-6 flex flex-col space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#461D77]/10 text-[#461D77] rounded-xl flex items-center justify-center shrink-0">
                  <FileBarChart size={16} />
                </div>
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider">2. Informe Operativo</h3>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Archivo fuente</p>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={14} className="text-[#461D77] shrink-0" />
                  <span className="text-xs font-semibold text-slate-800">08.- Tablero Despachos 2026</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">Núcleo analítico diario. Compara tonelaje y tiempos meta contra real con redacción técnica para justificaciones.</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-xs text-slate-700"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Protocolo Redacción Técnica</li>
                  <li className="flex items-center gap-2 text-xs text-slate-700"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Exportación Oficio PDF</li>
                  <li className="flex items-center gap-2 text-xs text-slate-700"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Captura PNG</li>
                  <li className="flex items-center gap-2 text-xs text-slate-700"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Memoria JSON</li>
                </ul>
              </div>
            </div>

            {/* Módulo 3 */}
            <div className="p-6 flex flex-col space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#461D77]/10 text-[#461D77] rounded-xl flex items-center justify-center shrink-0">
                  <History size={16} />
                </div>
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider">3. Memoria Operativa</h3>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Archivo fuente</p>
                <div className="flex items-center gap-2">
                  <FileJson size={14} className="text-[#461D77] shrink-0" />
                  <span className="text-xs font-semibold text-slate-800">Respaldo Operacional (.json)</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">Centro de respaldo histórico. Permite importar justificaciones pasadas y auditar el historial sin re-procesar Excel.</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-xs text-slate-700"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Persistencia de datos</li>
                  <li className="flex items-center gap-2 text-xs text-slate-700"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Auditoría rápida</li>
                </ul>
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2">
                  <AlertCircle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] font-medium text-amber-800 leading-snug">
                    Si borras el caché, carga los archivos .json creados en el Informe Operativo.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Technical Note */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle size={16} className="text-[#461D77] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Nota técnica de compatibilidad</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Asegúrate de que los archivos Excel mantengan las cabeceras originales para que la detección automática de columnas funcione correctamente.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="flex items-center justify-center gap-2 bg-[#461D77] hover:bg-[#36155E] text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors duration-150 ease-out cursor-pointer shadow-sm"
          >
            Entendido
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstructionModal;

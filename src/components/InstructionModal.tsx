
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1C1917]/60">
      <div className="bg-[#FFFFFF] w-full max-w-4xl max-h-[90vh] rounded-lg shadow-sm border border-[#E2DFD7] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-[#F7F6F2] px-8 py-5 border-b border-[#E2DFD7] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#F3EEF8] border border-[#E2DFD7] rounded-md flex items-center justify-center text-[#461D77]">
              <Info size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1C1917] tracking-[-0.02em] leading-none">Guía de Operación</h2>
              <p className="text-[11px] font-mono text-[#78716C] uppercase tracking-wider mt-1">Sistema de Gestión Logística</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md border border-[#E2DFD7] bg-[#FFFFFF] text-[#78716C] hover:text-[#1C1917] hover:bg-[#EFECE6] flex items-center justify-center transition-colors duration-150 ease-out cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-3 border border-[#E2DFD7] rounded-lg divide-y md:divide-y-0 md:divide-x divide-[#E2DFD7] bg-[#FFFFFF]">

            {/* Módulo 1 */}
            <div className="p-6 flex flex-col space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#F7F6F2] border border-[#E2DFD7] text-[#461D77] rounded-md flex items-center justify-center shrink-0">
                  <Truck size={16} />
                </div>
                <h3 className="font-bold text-[#1C1917] uppercase text-xs tracking-wider">1. Llegada de Equipos</h3>
              </div>
              <div className="bg-[#F7F6F2] p-3 rounded-md border border-[#E2DFD7]">
                <p className="text-[10px] font-mono font-semibold text-[#78716C] uppercase tracking-wider mb-1">Archivo fuente</p>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={14} className="text-[#461D77] shrink-0" />
                  <span className="text-xs font-medium text-[#1C1917]">02.- Histórico Romanas</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-[#57534E] leading-relaxed">Procesa el flujo de entrada de camiones. Genera análisis de frecuencia por hora y tablas de control por empresa y destino.</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-xs text-[#1C1917]"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Gráficos de frecuencia</li>
                  <li className="flex items-center gap-2 text-xs text-[#1C1917]"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Reportes con branding</li>
                  <li className="flex items-center gap-2 text-xs text-[#1C1917]"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> PDF para correo</li>
                </ul>
              </div>
            </div>

            {/* Módulo 2 */}
            <div className="p-6 flex flex-col space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#F7F6F2] border border-[#E2DFD7] text-[#461D77] rounded-md flex items-center justify-center shrink-0">
                  <FileBarChart size={16} />
                </div>
                <h3 className="font-bold text-[#1C1917] uppercase text-xs tracking-wider">2. Informe Operativo</h3>
              </div>
              <div className="bg-[#F7F6F2] p-3 rounded-md border border-[#E2DFD7]">
                <p className="text-[10px] font-mono font-semibold text-[#78716C] uppercase tracking-wider mb-1">Archivo fuente</p>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={14} className="text-[#461D77] shrink-0" />
                  <span className="text-xs font-medium text-[#1C1917]">08.- Tablero Despachos 2026</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-[#57534E] leading-relaxed">Núcleo analítico diario. Compara tonelaje y tiempos meta contra real con redacción técnica para justificaciones.</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-xs text-[#1C1917]"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Protocolo Redacción Técnica</li>
                  <li className="flex items-center gap-2 text-xs text-[#1C1917]"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Exportación Oficio PDF</li>
                  <li className="flex items-center gap-2 text-xs text-[#1C1917]"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Captura PNG</li>
                  <li className="flex items-center gap-2 text-xs text-[#1C1917]"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Memoria JSON</li>
                </ul>
              </div>
            </div>

            {/* Módulo 3 */}
            <div className="p-6 flex flex-col space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#F7F6F2] border border-[#E2DFD7] text-[#461D77] rounded-md flex items-center justify-center shrink-0">
                  <History size={16} />
                </div>
                <h3 className="font-bold text-[#1C1917] uppercase text-xs tracking-wider">3. Memoria Operativa</h3>
              </div>
              <div className="bg-[#F7F6F2] p-3 rounded-md border border-[#E2DFD7]">
                <p className="text-[10px] font-mono font-semibold text-[#78716C] uppercase tracking-wider mb-1">Archivo fuente</p>
                <div className="flex items-center gap-2">
                  <FileJson size={14} className="text-[#461D77] shrink-0" />
                  <span className="text-xs font-medium text-[#1C1917]">Respaldo Operacional (.json)</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-[#57534E] leading-relaxed">Centro de respaldo histórico. Permite importar justificaciones pasadas y auditar el historial sin re-procesar Excel.</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-xs text-[#1C1917]"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Persistencia de datos</li>
                  <li className="flex items-center gap-2 text-xs text-[#1C1917]"><CheckCircle2 size={13} className="text-[#461D77] shrink-0" /> Auditoría rápida</li>
                </ul>
                <div className="p-2.5 bg-[#FFFBEB] rounded-md border border-[#B45309]/25 flex items-start gap-2">
                  <AlertCircle size={13} className="text-[#B45309] mt-0.5 shrink-0" />
                  <p className="text-[11px] font-medium text-[#B45309] leading-snug">
                    Si borras el caché, carga los archivos .json creados en el Informe Operativo.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Technical Note */}
          <div className="bg-[#F7F6F2] border border-[#E2DFD7] p-4 rounded-lg flex items-start gap-3">
            <AlertCircle size={16} className="text-[#57534E] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-[#1C1917] uppercase tracking-wider">Nota técnica de compatibilidad</p>
              <p className="text-xs text-[#57534E] leading-relaxed">
                Asegúrate de que los archivos Excel mantengan las cabeceras originales para que la detección automática de columnas funcione correctamente.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-[#F7F6F2] border-t border-[#E2DFD7] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="flex items-center justify-center gap-2 bg-[#461D77] hover:bg-[#36155E] text-white px-6 py-2.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors duration-150 ease-out cursor-pointer"
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

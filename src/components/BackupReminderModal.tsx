
import React from 'react';
import { Download, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { downloadBackupJSON } from '../utils/dataProcessor';

interface BackupReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BackupReminderModal: React.FC<BackupReminderModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-nucleo/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-calido overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="relative p-8 text-center space-y-6">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-violeta/20 hover:text-nucleo transition-colors"
          >
            <X size={20} />
          </button>

          <div className="mx-auto w-20 h-20 bg-violeta/10 rounded-3xl flex items-center justify-center text-violeta relative">
            <ShieldCheck size={40} />
            <div className="absolute -top-2 -right-2 bg-ionizado text-white p-1.5 rounded-full border-4 border-white">
              <AlertCircle size={14} />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-[900] text-nucleo tracking-tighter uppercase">¡Cambios Guardados!</h2>
            <p className="text-violeta/60 text-sm font-medium leading-relaxed">
              Tus justificaciones se han guardado en este dispositivo. Para evitar perderlas si borras el historial o el caché, te recomendamos descargar un **archivo de respaldo**.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button 
              onClick={() => { downloadBackupJSON(); onClose(); }}
              className="group flex items-center justify-center gap-3 w-full bg-nucleo hover:bg-black text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-nucleo/20 transition-all active:scale-95"
            >
              <Download size={16} className="group-hover:animate-bounce" />
              Descargar Respaldo JSON
            </button>
            <button 
              onClick={onClose}
              className="w-full bg-calido hover:bg-calido/80 text-violeta/40 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all"
            >
              Continuar trabajando
            </button>
          </div>
          
          <p className="text-[8px] font-bold text-violeta/20 uppercase tracking-widest">
            SQM Operaciones • Seguridad de Memoria v1.2
          </p>
        </div>
      </div>
    </div>
  );
};

export default BackupReminderModal;

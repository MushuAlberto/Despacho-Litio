
import React, { useState } from 'react';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';
import { syncBackupToFirebase } from '../utils/dataProcessor';
import { FirebaseSyncButton } from './FirebaseSyncButton';

interface BackupReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BackupReminderModal: React.FC<BackupReminderModalProps> = ({ isOpen, onClose }) => {
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const success = await syncBackupToFirebase();
      if (success) {
        setTimeout(() => {
          onClose();
        }, 1800);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#461D77] to-[#7177EC] text-white">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} />
            <h2 className="text-sm font-black uppercase tracking-wider">Respaldo en Nube</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors duration-150 ease-out cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl">
            <AlertCircle size={16} className="text-[#461D77] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#461D77]">Cambios guardados localmente</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tus observaciones están respaldadas en este navegador. Sincronízalas con Firebase para mantener acceso compartido desde cualquier equipo.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <FirebaseSyncButton
              onSync={handleSync}
              isSyncingExternal={isSyncing}
              className="py-3 text-xs"
            />
            <button
              onClick={onClose}
              className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors duration-150 ease-out cursor-pointer"
            >
              Continuar trabajando
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupReminderModal;

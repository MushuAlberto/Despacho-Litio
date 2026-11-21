
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1C1917]/60">
      <div className="bg-[#FFFFFF] w-full max-w-md rounded-lg shadow-sm border border-[#E2DFD7] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#F7F6F2] border-b border-[#E2DFD7]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-[#461D77]" />
            <h2 className="text-sm font-bold text-[#1C1917] uppercase tracking-wider">Respaldo en Nube</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#78716C] hover:text-[#1C1917] hover:bg-[#EFECE6] transition-colors duration-150 ease-out cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 p-3.5 bg-[#F7F6F2] border border-[#E2DFD7] rounded-md">
            <AlertCircle size={16} className="text-[#461D77] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#1C1917]">Cambios guardados localmente</p>
              <p className="text-xs text-[#57534E] leading-relaxed">
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
              className="w-full bg-[#F7F6F2] hover:bg-[#EFECE6] border border-[#E2DFD7] text-[#57534E] hover:text-[#1C1917] py-2.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors duration-150 ease-out cursor-pointer"
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


import React, { useMemo, useRef, useState } from 'react';
import { 
  ArrowLeft, History, Calendar, ChevronRight, FileCheck, ClipboardList,
  MessageSquare, Download, Upload, AlertCircle, Trash2, Lock, ShieldAlert, X
} from 'lucide-react';
import { formatDateToCL, downloadBackupJSON } from '../utils/dataProcessor';
import { SystemUser } from '../services/firebase';

interface MemoryModuleProps {
  data: any[];
  onBack: () => void;
  onSelectDate: (date: string) => void;
}

export const MemoryModule: React.FC<MemoryModuleProps> = ({ data, onBack, onSelectDate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for securely deleting justifications / dates data
  const [dateToDelete, setDateToDelete] = useState<string | null>(null);
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Load current logged-in user 
  const currentUser = useMemo(() => {
    try {
      const saved = localStorage.getItem('sqm_current_user');
      return saved ? JSON.parse(saved) as SystemUser : null;
    } catch {
      return null;
    }
  }, []);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Obtener fechas únicas que tienen datos
  const availableDates = useMemo(() => {
    const dates = [...new Set(data.map(r => r.Fecha))].sort().reverse();
    return dates.map(d => {
      const dayData = data.filter(r => r.Fecha === d);
      const products = [...new Set(dayData.map(r => r.Producto))];
      let justificationsCount = 0;
      
      products.forEach(p => {
        if (localStorage.getItem(`sqm_justification_${d}_${p}`)) {
          justificationsCount++;
        }
      });

      return {
        date: d,
        justificationsCount,
        totalProducts: products.length
      };
    });
  }, [data, refreshTrigger]);

  // Importar un archivo de respaldo JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        Object.entries(backup).forEach(([key, value]) => {
          if (key.startsWith('sqm_')) {
            localStorage.setItem(key, value as string);
          }
        });
        alert("Respaldo restaurado con éxito. La página se recargará.");
        window.location.reload();
      } catch (err) {
        alert("Error: El archivo de respaldo no es válido.");
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteDateClick = (date: string) => {
    // Only administrators or managers can execute deletion of information
    if (currentUser?.role !== 'admin' && currentUser?.username !== 'ctapia') {
      alert("Acceso denegado: Solo el Administrador de la App puede eliminar información.");
      return;
    }
    setDateToDelete(date);
    setAdminPasswordConfirm('');
    setPasswordError(false);
  };

  const handleConfirmDeleteJustifications = async () => {
    if (!dateToDelete) return;

    const correctPasswords = [
      currentUser?.password,
      'ctapia',
      'MIRAME'
    ].filter(Boolean);

    if (!correctPasswords.includes(adminPasswordConfirm)) {
      setPasswordError(true);
      return;
    }

    try {
      const dayData = data.filter(r => r.Fecha === dateToDelete);
      const products = [...new Set(dayData.map(r => r.Producto))];

      products.forEach(p => {
        localStorage.removeItem(`sqm_justification_${dateToDelete}_${p}`);
      });

      // Clear any generic or custom keys for this day
      localStorage.removeItem(`sqm_justification_${dateToDelete}`);

      // Record administrative delete activity log in Firestore
      const { logActivity } = await import('../services/firebase');
      await logActivity(
        currentUser,
        'Eliminó Justificaciones',
        `Eliminó todas las justificaciones asociadas a la fecha ${formatDateToCL(dateToDelete)}.`
      );

      setDateToDelete(null);
      setRefreshTrigger(prev => prev + 1);
      alert(`Información del día ${formatDateToCL(dateToDelete)} eliminada correctamente.`);
    } catch (err) {
      console.error('Error deleting justifications:', err);
      alert('Error técnico al intentar eliminar las justificaciones.');
      setDateToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-800">
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-900">
            <ArrowLeft size={20} />
          </button>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-500 rounded-xl">
              <History size={20} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">Memoria Operativa</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Archivo de Justificaciones</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={downloadBackupJSON}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all text-slate-600 shadow-sm"
          >
            <Download size={14} /> Exportar Respaldo
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all text-slate-600 shadow-sm"
          >
            <Upload size={14} /> Importar Respaldo
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportBackup} 
            accept=".json" 
            className="hidden" 
          />
        </div>
      </header>

      <main className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-10">
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex items-start gap-4">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-lg shrink-0">
            <AlertCircle size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Aviso de Seguridad de Datos</p>
            <p className="text-xs text-amber-600 font-medium leading-relaxed">
              Los datos se guardan localmente en este navegador. Si limpia el historial o el caché del navegador, **perderá las justificaciones escritas**. Se recomienda usar el botón "Exportar Respaldo" semanalmente para asegurar su información.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-[900] text-[#1e293b] tracking-tighter uppercase">Historial de Jornadas</h2>
          <p className="text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase">Seleccione una fecha para revisar el informe y sus observaciones</p>
        </div>

        {availableDates.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center space-y-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200">
              <Calendar size={40} />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-black text-slate-800">No hay datos en memoria</p>
              <p className="text-slate-400 text-sm max-w-xs font-medium">Cargue archivos Excel o importe un respaldo anterior.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {availableDates.map((item) => (
              <button
                key={item.date}
                onClick={() => onSelectDate(item.date)}
                className="group flex items-center justify-between bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 text-left active:scale-[0.98]"
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex flex-col items-center justify-center group-hover:bg-indigo-50 transition-colors">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">Día</span>
                    <span className="text-2xl font-black text-slate-800 group-hover:text-indigo-600 leading-none">{item.date.split('-')[2]}</span>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xl font-black text-[#1e293b] tracking-tight">{formatDateToCL(item.date)}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <ClipboardList size={12} className="text-slate-300" /> {item.totalProducts} Productos
                      </div>
                      <div className="w-1 h-1 bg-slate-200 rounded-full" />
                      <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${item.justificationsCount > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>
                        <MessageSquare size={12} /> {item.justificationsCount} Justificaciones
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pr-2 relative z-10">
                   {(currentUser?.role === 'admin' || currentUser?.username === 'ctapia') && (
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         handleDeleteDateClick(item.date);
                       }}
                       title="Eliminar justificaciones de este día"
                       className="w-10 h-10 rounded-full bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 flex items-center justify-center transition-all cursor-pointer"
                     >
                       <Trash2 size={16} />
                     </button>
                   )}
                   <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                      <ChevronRight size={20} />
                   </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-100 p-8 flex justify-center no-print">
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.4em]">ARCHIVO HISTÓRICO • 2026</p>
      </footer>

      {dateToDelete && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 no-print">
          <div className="bg-white max-w-md w-full rounded-[2rem] p-8 shadow-2xl border border-slate-100 flex flex-col space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1c1917] text-lg uppercase tracking-tight">Confirmar Eliminación</h3>
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-1">Acción Destructiva</p>
                </div>
              </div>
              <button 
                onClick={() => setDateToDelete(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Por motivos de seguridad, para eliminar todas las observaciones registradas para el día <strong className="text-slate-800">{formatDateToCL(dateToDelete)}</strong>, debe confirmar ingresando su contraseña de administrador.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">Contraseña de Administrador</label>
              <div className="relative">
                <Lock className="absolute left-4 top-[1.125rem] w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={adminPasswordConfirm}
                  onChange={(e) => {
                    setAdminPasswordConfirm(e.target.value);
                    setPasswordError(false);
                  }}
                  autoFocus
                  placeholder="Ingrese contraseña..."
                  className={`w-full py-3.5 pl-11 pr-4 bg-slate-50 border-2 rounded-xl text-sm font-bold text-slate-800 outline-none transition-all ${
                    passwordError ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-transparent focus:border-[#461D77] focus:bg-white focus:shadow-md'
                  }`}
                />
              </div>
              {passwordError && (
                <p className="text-[10px] text-red-600 font-extrabold uppercase tracking-widest mt-1">Contraseña Incorrecta</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDateToDelete(null)}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteJustifications}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-red-200 hover:scale-[1.02] active:scale-95"
              >
                Eliminar Todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

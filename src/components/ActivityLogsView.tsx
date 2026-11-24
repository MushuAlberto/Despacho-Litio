import React, { useState, useEffect } from 'react';
import { db, logActivity, SystemUser, handleFirestoreError, OperationType, waitForFirestoreReady, isQuotaExceededError, isConnectionUnavailableError } from '../services/firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { Calendar, Search, ArrowLeft, RefreshCw, ClipboardList, Clock, Loader2, Trash2, ShieldAlert, Lock, X, Download } from 'lucide-react';

interface ActivityLog {
  id?: string;
  userId: string;
  username: string;
  name: string;
  role: string;
  action: string;
  details: string;
  timestamp: string;
}

interface ActivityLogsViewProps {
  currentUser: SystemUser;
  onBack: () => void;
}

export const ActivityLogsView: React.FC<ActivityLogsViewProps> = ({ currentUser, onBack }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // States for secure admin-protected delete actions
  const [logToDelete, setLogToDelete] = useState<ActivityLog | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState<boolean>(false);
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState<string>('');
  const [passwordError, setPasswordError] = useState<boolean>(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (!(await waitForFirestoreReady())) {
        setLogs([]);
        setFilteredLogs([]);
        return;
      }
      const qSnap = await getDocs(collection(db, 'activity_logs'));
      const fetched: ActivityLog[] = [];
      qSnap.forEach((docSnap) => {
        const item = docSnap.data();
        fetched.push({
          id: docSnap.id,
          userId: item.userId || '',
          username: item.username || '',
          name: item.name || '',
          role: item.role || '',
          action: item.action || '',
          details: item.details || '',
          timestamp: item.timestamp || ''
        });
      });
      fetched.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setLogs(fetched);
      setFilteredLogs(fetched);
    } catch (error) {
      if (isQuotaExceededError(error) || isConnectionUnavailableError(error)) {
        setLogs([]);
        setFilteredLogs([]);
        return;
      }
      console.error('Error fetching logs from Firestore:', error);
      handleFirestoreError(error, OperationType.LIST, 'activity_logs');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLogClick = (log: ActivityLog) => {
    if (currentUser?.role !== 'admin' && currentUser?.username !== 'ctapia') {
      alert("Acceso denegado: Solo el Administrador de la App puede eliminar información.");
      return;
    }
    setLogToDelete(log);
    setIsDeletingAll(false);
    setAdminPasswordConfirm('');
    setPasswordError(false);
  };

  const handleClearAllLogsClick = () => {
    if (currentUser?.role !== 'admin' && currentUser?.username !== 'ctapia') {
      alert("Acceso denegado: Solo el Administrador de la App puede eliminar información.");
      return;
    }
    setIsDeletingAll(true);
    setLogToDelete(null);
    setAdminPasswordConfirm('');
    setPasswordError(false);
  };

  const handleConfirmDelete = async () => {
    if (adminPasswordConfirm.trim() !== 'MIRAME') {
      setPasswordError(true);
      return;
    }

    try {
      if (isDeletingAll) {
        // Clear all logs in Firestore
        const qSnap = await getDocs(collection(db, 'activity_logs'));
        const deletePromises: Promise<void>[] = [];
        qSnap.forEach((docSnap) => {
          deletePromises.push(deleteDoc(doc(db, 'activity_logs', docSnap.id)));
        });
        await Promise.all(deletePromises);

        // Record high severity log activity
        await logActivity(
          currentUser,
          'Historial Vaciado',
          'El administrador vació completamente el historial de registros de auditoría.'
        );

        alert('Historial de actividades eliminado correctamente.');
        setIsDeletingAll(false);
      } else if (logToDelete) {
        if (logToDelete.id) {
          await deleteDoc(doc(db, 'activity_logs', logToDelete.id));
          
          await logActivity(
            currentUser,
            'Registro Eliminado',
            `Se eliminó una entrada de auditoría (${logToDelete.action}: ${logToDelete.details}).`
          );
        }
        setLogToDelete(null);
      }

      await fetchLogs();
    } catch (error) {
      console.error('Error deleting logs:', error);
      alert('Hubo un error al intentar eliminar el registro.');
      handleFirestoreError(error, OperationType.DELETE, 'activity_logs');
    } finally {
      setIsDeletingAll(false);
      setLogToDelete(null);
    }
  };

  const downloadLogsToExcel = async () => {
    try {
      const { utils, writeFile } = await import('xlsx');
      
      const excelData = filteredLogs.map(log => ({
        'Fecha y Hora': formatDate(log.timestamp),
        'Nombre': log.name,
        'Cuenta': `@${log.username}`,
        'Rol': getRoleLabel(log.role),
        'Operación Realizada': log.action,
        'Detalles': log.details || ''
      }));

      const worksheet = utils.json_to_sheet(excelData);
      
      worksheet['!cols'] = [
        { wch: 22 }, // Fecha
        { wch: 25 }, // Nombre
        { wch: 15 }, // Cuenta
        { wch: 15 }, // Rol
        { wch: 25 }, // Operacion
        { wch: 60 }  // Detalles
      ];

      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, 'Auditoría');
      
      const fileName = `Historial_Auditoria_${new Date().toISOString().slice(0,10)}.xlsx`;
      writeFile(workbook, fileName);

      try {
        await logActivity(
          currentUser,
          'Exportó Historial',
          `Exportó ${filteredLogs.length} registros de auditoría a formato Excel (${fileName}).`
        );
      } catch (err) {
        console.error('Error logging Excel download:', err);
      }
    } catch (error) {
      console.error('Error exporting logs to excel:', error);
      alert('Ocurrió un error al intentar exportar los registros a Excel.');
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    let result = logs;

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        log => 
          log.name.toLowerCase().includes(term) || 
          log.username.toLowerCase().includes(term) || 
          log.action.toLowerCase().includes(term) ||
          log.details.toLowerCase().includes(term)
      );
    }

    if (selectedRole !== 'all') {
      result = result.filter(log => log.role === selectedRole);
    }

    if (selectedActionType !== 'all') {
      result = result.filter(log => {
        const actionLower = log.action.toLowerCase();
        if (selectedActionType === 'login') {
          return actionLower.includes('inicio') || 
                 actionLower.includes('sesión') || 
                 actionLower.includes('sesion') || 
                 actionLower.includes('cerró') || 
                 actionLower.includes('cerro') || 
                 actionLower.includes('ingres');
        }
        if (selectedActionType === 'export') {
          return actionLower.includes('export') || 
                 actionLower.includes('descarg') || 
                 actionLower.includes('pdf') || 
                 actionLower.includes('png') || 
                 actionLower.includes('imagen') || 
                 actionLower.includes('placa');
        }
        if (selectedActionType === 'file') {
          return actionLower.includes('excel') || 
                 actionLower.includes('archivo') || 
                 actionLower.includes('carga') || 
                 actionLower.includes('plantilla') || 
                 actionLower.includes('historial');
        }
        return true;
      });
    }

    if (startDate) {
      const startDateTime = new Date(startDate + 'T00:00:00').getTime();
      result = result.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= startDateTime;
      });
    }

    if (endDate) {
      const endDateTime = new Date(endDate + 'T23:59:59').getTime();
      result = result.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime <= endDateTime;
      });
    }

    setFilteredLogs(result);
  }, [searchTerm, selectedRole, selectedActionType, startDate, endDate, logs]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    if (role === 'admin') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (role === 'jefe_turno') return 'bg-[#461D77]/10 text-[#461D77] border-[#461D77]/20';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return 'ADMINISTRADOR';
    if (role === 'jefe_turno') return 'JEFE TURNO';
    return 'SUPERVISOR';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED] p-6 md:p-10 z-10 relative flex flex-col justify-between text-slate-800">
      <div className="max-w-6xl mx-auto w-full space-y-6 flex-grow">
        {/* HEADER SECTION */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 px-6 py-4 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-[#461D77] transition-colors duration-150 ease-out cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <p className="text-[11px] font-bold tracking-wider text-[#461D77] uppercase">
                Auditoría de Sistema
              </p>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Historial de Actividades</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {(currentUser?.role === 'admin' || currentUser?.username === 'ctapia') && (
              <button
                onClick={handleClearAllLogsClick}
                disabled={loading || logs.length === 0}
                className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl px-4 py-2 text-xs font-bold text-rose-700 tracking-wider transition-colors duration-150 ease-out cursor-pointer disabled:opacity-40"
              >
                <Trash2 size={14} /> Vaciar Historial
              </button>
            )}

            <button
              onClick={downloadLogsToExcel}
              disabled={loading || filteredLogs.length === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-[#461D77] to-[#7177EC] hover:opacity-95 rounded-xl px-4 py-2 text-xs font-bold text-white tracking-wider transition-all duration-150 ease-out cursor-pointer shadow-md shadow-[#461D77]/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={14} /> Descargar Excel
            </button>

            <button
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-800 tracking-wider transition-colors duration-150 ease-out cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-[#461D77]' : 'text-slate-500'} /> Refrescar
            </button>
          </div>
        </header>

        {/* CONTROLS AREA */}
        <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-slate-200/80 shadow-xl shadow-slate-200/40 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search inputs */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Buscar por usuario, acción o detalle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#461D77] focus:bg-white rounded-xl text-xs font-medium text-slate-900 outline-none transition-colors duration-150 placeholder:text-slate-400"
              />
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Role filter dropdown */}
            <div className="w-full md:w-48">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#461D77] focus:bg-white rounded-xl text-xs font-medium text-slate-900 outline-none transition-colors duration-150 cursor-pointer"
              >
                <option value="all">Todos los Roles</option>
                <option value="admin">Administrador</option>
                <option value="jefe_turno">Jefe Turno</option>
                <option value="supervision">Supervisor</option>
              </select>
            </div>

            {/* Action Group Filter option */}
            <div className="w-full md:w-48">
              <select
                value={selectedActionType}
                onChange={(e) => setSelectedActionType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#461D77] focus:bg-white rounded-xl text-xs font-medium text-slate-900 outline-none transition-colors duration-150 cursor-pointer"
              >
                <option value="all">Todas las Acciones</option>
                <option value="login">Inicios de Sesión</option>
                <option value="export">Exportaciones</option>
                <option value="file">Carga de Excel</option>
              </select>
            </div>
          </div>

          {/* Date range filter subpart */}
          <div className="pt-3.5 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                <Calendar size={13} className="text-[#461D77]" /> Período:
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Desde</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-[#461D77] focus:bg-white rounded-xl text-xs font-mono text-slate-900 outline-none transition-colors duration-150 cursor-pointer [color-scheme:light]"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Hasta</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-[#461D77] focus:bg-white rounded-xl text-xs font-mono text-slate-900 outline-none transition-colors duration-150 cursor-pointer [color-scheme:light]"
                />
              </div>

              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-[11px] font-bold uppercase tracking-wider text-rose-600 hover:bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl transition-colors duration-150 cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            <span className="text-xs font-mono tabular-nums text-slate-500 text-right">
              Mostrando {filteredLogs.length} de {logs.length} registros
            </span>
          </div>
        </div>

        {/* LOGS LIST OR SPINNER */}
        <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-3xl shadow-xl shadow-slate-200/40 overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#461D77] mb-3" />
              <p className="font-mono text-xs uppercase tracking-wider">Cargando registros...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-16 px-6">
              <ClipboardList className="mx-auto text-slate-400 mb-3" size={32} />
              <h3 className="font-bold text-slate-900 text-sm">Sin registros</h3>
              <p className="text-slate-500 text-xs mt-1">No hay operaciones registradas con los filtros actuales.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold tracking-wider text-slate-500 uppercase bg-slate-50">
                    <th className="py-3.5 px-4">Fecha / Hora</th>
                    <th className="py-3.5 px-4">Usuario</th>
                    <th className="py-3.5 px-4">Rol</th>
                    <th className="py-3.5 px-4">Operación</th>
                    <th className="py-3.5 px-4">Detalles</th>
                    {(currentUser?.role === 'admin' || currentUser?.username === 'ctapia') && (
                      <th className="py-3.5 px-4 text-center">Acción</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log, index) => (
                    <tr key={log.id || index} className="hover:bg-slate-50/80 transition-colors duration-150 group">
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock size={12} className="text-slate-400" />
                          {formatDate(log.timestamp)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-xs">{log.name}</span>
                          <span className="font-mono text-[10px] text-slate-400">@{log.username}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-block border text-[10px] font-mono font-bold tracking-wider px-2.5 py-0.5 rounded-full ${getRoleBadgeColor(log.role)}`}>
                          {getRoleLabel(log.role)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#461D77] text-xs">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-600 text-xs block max-w-sm break-words leading-relaxed">
                          {log.details || '-'}
                        </span>
                      </td>
                      {(currentUser?.role === 'admin' || currentUser?.username === 'ctapia') && (
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleDeleteLogClick(log)}
                            title="Eliminar registro de auditoría"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors duration-150 cursor-pointer opacity-0 group-hover:opacity-100 inline-flex items-center justify-center"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <footer className="py-6 text-center mt-10 border-t border-slate-200/80">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          NOVANDINO LOGÍSTICA · AUDITORÍA CLOUD
        </p>
      </footer>

      {/* CONFIRMATION PASSWORD MODAL */}
      {(logToDelete || isDeletingAll) && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Confirmar Eliminación</h3>
                  <p className="text-[10px] font-mono font-bold text-rose-600 uppercase tracking-wider">Acción Administrativa</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setLogToDelete(null);
                  setIsDeletingAll(false);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isDeletingAll ? (
                <span>¿Estás seguro de que deseas <strong className="text-rose-600">vaciar todo el historial de auditoría</strong>? Esta acción no se puede deshacer.</span>
              ) : (
                <span>Para eliminar el registro de <strong className="text-slate-900 font-mono">@{logToDelete?.username}</strong> ({logToDelete?.action}), confirma ingresando tu clave maestra.</span>
              )}
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-500 uppercase tracking-wider font-bold block">Clave Maestra de Autorización</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={adminPasswordConfirm}
                  onChange={(e) => {
                    setAdminPasswordConfirm(e.target.value);
                    setPasswordError(false);
                  }}
                  autoFocus
                  placeholder="Ingresa clave maestra..."
                  className={`w-full py-2.5 pl-10 pr-4 bg-slate-50 border rounded-xl text-xs font-mono text-slate-900 outline-none transition-colors duration-150 ${
                    passwordError ? 'border-rose-500 bg-rose-50' : 'border-slate-200 focus:border-[#461D77] focus:bg-white'
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmDelete();
                  }}
                />
              </div>
              {passwordError && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">Clave incorrecta</p>
              )}
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setLogToDelete(null);
                  setIsDeletingAll(false);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors duration-150 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors duration-150 cursor-pointer"
              >
                Confirmar y Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

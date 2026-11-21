
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { 
  ArrowLeft, History, Calendar, ChevronRight, FileCheck, ClipboardList,
  MessageSquare, Download, Upload, AlertCircle, Trash2, Lock, ShieldAlert, X,
  Cloud, CloudUpload, CloudDownload, Database, RefreshCw, CheckCircle2
} from 'lucide-react';
import { formatDateToCL, downloadBackupJSON, syncBackupToFirebase } from '../utils/dataProcessor';
import { 
  SystemUser, 
  getOperationalReportsFromFirebase, 
  deleteOperationalReportFromFirebase,
  OperationalReportDoc,
  safeParseBackupJSON
} from '../services/firebase';

interface MemoryModuleProps {
  data: any[];
  onBack: () => void;
  onSelectDate: (date: string) => void;
}

export const MemoryModule: React.FC<MemoryModuleProps> = ({ data, onBack, onSelectDate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for Firebase Cloud Operational Reports
  const [cloudReports, setCloudReports] = useState<OperationalReportDoc[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isSyncingToCloud, setIsSyncingToCloud] = useState(false);
  const [cloudSuccessMsg, setCloudSuccessMsg] = useState<string | null>(null);

  // States for securely deleting justifications / dates data
  const [dateToDelete, setDateToDelete] = useState<string | null>(null);
  const [cloudReportToDelete, setCloudReportToDelete] = useState<OperationalReportDoc | null>(null);
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

  // Load cloud reports from Firebase Firestore
  const loadCloudReports = async () => {
    setIsLoadingCloud(true);
    try {
      const reports = await getOperationalReportsFromFirebase();
      setCloudReports(reports);
    } catch (err) {
      console.error('Error fetching cloud reports:', err);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  useEffect(() => {
    loadCloudReports();
  }, [refreshTrigger]);

  // Sync current local backup to Firebase Cloud
  const handleSyncToFirebase = async () => {
    setIsSyncingToCloud(true);
    setCloudSuccessMsg(null);
    try {
      const success = await syncBackupToFirebase();
      if (success) {
        setCloudSuccessMsg("Historial .json guardado exitosamente en Firebase Cloud.");
        setTimeout(() => setCloudSuccessMsg(null), 4000);
        await loadCloudReports();
      } else {
        alert("No se pudo guardar el historial en Firebase. Verifique su conexión.");
      }
    } catch (err) {
      console.error('Error syncing to Firebase:', err);
      alert("Error al conectar con Firebase.");
    } finally {
      setIsSyncingToCloud(false);
    }
  };

  // Restore a cloud JSON report to current local browser storage
  const handleRestoreFromCloud = (report: OperationalReportDoc) => {
    try {
      const backup = safeParseBackupJSON(report.backupData);
      let count = 0;
      Object.entries(backup).forEach(([key, value]) => {
        if (key.startsWith('sqm_')) {
          localStorage.setItem(key, value as string);
          count++;
        }
      });
      alert(`Informe del ${formatDateToCL(report.date)} cargado correctamente (${count} claves restauradas desde Firebase). La página se actualizará.`);
      window.location.reload();
    } catch (err) {
      console.error('Error parsing cloud report backup JSON:', err);
      alert("Error: El formato de los datos guardados en la nube no es válido.");
    }
  };

  // Download Cloud JSON report file
  const handleDownloadCloudJSON = (report: OperationalReportDoc) => {
    try {
      const blob = new Blob([report.backupData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Memoria_SQM_Firebase_${report.date}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error al descargar el archivo desde la nube.");
    }
  };

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
    if (currentUser?.role !== 'admin' && currentUser?.username !== 'ctapia') {
      alert("Acceso denegado: Solo el Administrador de la App puede eliminar información.");
      return;
    }
    setDateToDelete(date);
    setAdminPasswordConfirm('');
    setPasswordError(false);
  };

  const handleDeleteCloudReportClick = (report: OperationalReportDoc) => {
    if (currentUser?.role !== 'admin' && currentUser?.username !== 'ctapia') {
      alert("Acceso denegado: Solo el Administrador de la App puede eliminar registros de Firebase.");
      return;
    }
    setCloudReportToDelete(report);
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

      localStorage.removeItem(`sqm_justification_${dateToDelete}`);

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

  const handleConfirmDeleteCloudReport = async () => {
    if (!cloudReportToDelete) return;

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
      await deleteOperationalReportFromFirebase(cloudReportToDelete.id, currentUser);
      setCloudReportToDelete(null);
      setRefreshTrigger(prev => prev + 1);
      alert(`Informe del ${formatDateToCL(cloudReportToDelete.date)} eliminado de Firebase.`);
    } catch (err) {
      console.error('Error deleting cloud report:', err);
      alert('Error al eliminar el registro de Firebase.');
      setCloudReportToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex flex-col font-sans text-[#1C1917]">
      <header className="bg-[#FFFFFF] border-b border-[#E2DFD7] px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-[#FFFFFF] hover:bg-[#F7F6F2] border border-[#E2DFD7] rounded-md transition-colors duration-150 ease-out text-[#57534E] hover:text-[#1C1917] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#461D77]"
            title="Volver"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="h-6 w-px bg-[#E2DFD7]" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F3EEF8] text-[#461D77] border border-[#461D77]/15 rounded-md">
              <History size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1C1917] tracking-[-0.02em] leading-tight">
                Memoria Operativa y Nube Firebase
              </h1>
              <p className="text-xs text-[#78716C]">
                Archivo de historiales JSON sincronizado
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncToFirebase}
            disabled={isSyncingToCloud}
            className="flex items-center gap-2 px-4 py-2 bg-[#461D77] hover:bg-[#36155E] disabled:opacity-50 text-white rounded-md text-xs font-semibold transition-colors duration-150 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#461D77]"
          >
            {isSyncingToCloud ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Guardando en nube...</span>
              </>
            ) : (
              <>
                <CloudUpload size={14} />
                <span>Guardar Historial en Firebase</span>
              </>
            )}
          </button>
          <button
            onClick={downloadBackupJSON}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FFFFFF] border border-[#E2DFD7] rounded-md text-xs font-semibold hover:bg-[#F7F6F2] transition-colors duration-150 ease-out text-[#1C1917] cursor-pointer"
          >
            <Download size={14} className="text-[#57534E]" />
            <span>Descargar .json</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FFFFFF] border border-[#E2DFD7] rounded-md text-xs font-semibold hover:bg-[#F7F6F2] transition-colors duration-150 ease-out text-[#1C1917] cursor-pointer"
          >
            <Upload size={14} className="text-[#57534E]" />
            <span>Importar .json</span>
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

      <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full space-y-8">
        {cloudSuccessMsg && (
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] px-4 py-3 rounded-lg flex items-center gap-3 text-[#15803D] text-xs font-semibold">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{cloudSuccessMsg}</span>
          </div>
        )}

        {/* Editorial Info Strip */}
        <div className="bg-[#FFFFFF] border border-[#E2DFD7] rounded-lg p-5 flex items-start gap-4">
          <div className="p-2.5 bg-[#F3EEF8] border border-[#461D77]/15 rounded-md text-[#461D77] shrink-0">
            <Database size={20} />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#78716C]">
              <span className="font-semibold text-[#461D77]">Firebase Firestore</span>
              <span aria-hidden="true">·</span>
              <span>Sincronización multidispositivo</span>
            </div>
            <h2 className="text-base font-bold text-[#1C1917] tracking-[-0.01em]">
              Historial Centralizado en la Nube
            </h2>
            <p className="text-xs text-[#57534E] leading-relaxed max-w-3xl">
              Los informes y respaldos .json guardados en Firebase Firestore quedan disponibles para consulta desde cualquier equipo. Al presionar Guardar Historial en Firebase, la memoria operativa actual se respalda en el servidor.
            </p>
          </div>
        </div>

        {/* Sección 1: Informes en Firebase Cloud */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Cloud size={17} className="text-[#461D77]" />
                <h2 className="text-lg font-bold text-[#1C1917] tracking-[-0.02em]">
                  Informes en Nube Firebase
                </h2>
              </div>
              <p className="text-xs text-[#78716C] mt-0.5">
                Respaldos .json guardados en el servidor central
              </p>
            </div>
            <button
              onClick={loadCloudReports}
              disabled={isLoadingCloud}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFFFF] border border-[#E2DFD7] hover:bg-[#F7F6F2] text-[#1C1917] rounded-md text-xs font-semibold transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoadingCloud ? "animate-spin text-[#461D77]" : "text-[#57534E]"} />
              <span>Actualizar</span>
            </button>
          </div>

          {isLoadingCloud ? (
            <div className="py-12 bg-[#FFFFFF] rounded-lg border border-[#E2DFD7] flex flex-col items-center justify-center space-y-2.5">
              <RefreshCw size={20} className="animate-spin text-[#461D77]" />
              <p className="text-xs font-mono text-[#78716C]">
                Consultando Firebase Firestore...
              </p>
            </div>
          ) : cloudReports.length === 0 ? (
            <div className="py-10 bg-[#FFFFFF] rounded-lg border border-[#E2DFD7] p-6 text-center space-y-2">
              <Cloud size={26} className="mx-auto text-[#A8A29E]" />
              <p className="text-sm font-semibold text-[#1C1917]">
                No hay informes .json guardados en Firebase
              </p>
              <p className="text-xs text-[#78716C] max-w-md mx-auto">
                Usa el botón Guardar Historial en Firebase para subir la memoria operativa actual a la nube.
              </p>
            </div>
          ) : (
            <div className="bg-[#FFFFFF] rounded-lg border border-[#E2DFD7] divide-y divide-[#E2DFD7] overflow-hidden">
              {cloudReports.map((report) => (
                <div
                  key={report.id}
                  className="px-5 py-4 hover:bg-[#F7F6F2]/70 transition-colors duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 bg-[#F3EEF8] border border-[#461D77]/15 rounded-md flex items-center justify-center text-[#461D77] shrink-0">
                      <CloudDownload size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-bold text-[#1C1917] font-mono tabular-nums">
                          {formatDateToCL(report.date)}
                        </span>
                        <span className="text-xs font-mono tabular-nums text-[#78716C]">
                          {report.date}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C] mt-0.5">
                        <span>
                          Guardado por <strong className="font-semibold text-[#1C1917]">{report.updatedBy || 'Sistema'}</strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(report.updatedAt).toLocaleDateString('es-CL')}{' '}
                          {new Date(report.updatedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRestoreFromCloud(report)}
                      title="Cargar este informe en esta computadora"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F3EEF8] hover:bg-[#461D77] text-[#461D77] hover:text-white border border-[#461D77]/20 rounded-md text-xs font-semibold transition-colors duration-150 cursor-pointer"
                    >
                      <CloudDownload size={14} />
                      <span>Cargar en Equipo</span>
                    </button>
                    <button
                      onClick={() => handleDownloadCloudJSON(report)}
                      title="Descargar archivo JSON"
                      className="p-2 bg-[#FFFFFF] border border-[#E2DFD7] hover:bg-[#F7F6F2] text-[#57534E] hover:text-[#1C1917] rounded-md transition-colors duration-150 cursor-pointer"
                    >
                      <Download size={14} />
                    </button>
                    {(currentUser?.role === 'admin' || currentUser?.username === 'ctapia') && (
                      <button
                        onClick={() => handleDeleteCloudReportClick(report)}
                        title="Eliminar de Firebase"
                        className="p-2 bg-[#FFFFFF] border border-[#E2DFD7] hover:bg-[#FEF2F2] hover:border-[#FECACA] text-[#B91C1C] rounded-md transition-colors duration-150 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sección 2: Historial de Jornadas Locales */}
        <section className="space-y-3 pt-4 border-t border-[#E2DFD7]">
          <div>
            <h2 className="text-lg font-bold text-[#1C1917] tracking-[-0.02em]">
              Jornadas en Memoria Local
            </h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              Selecciona una fecha para revisar o editar sus observaciones
            </p>
          </div>

          {availableDates.length === 0 ? (
            <div className="py-10 flex flex-col items-center text-center space-y-2.5 bg-[#FFFFFF] rounded-lg border border-[#E2DFD7]">
              <div className="w-11 h-11 bg-[#F7F6F2] border border-[#E2DFD7] rounded-md flex items-center justify-center text-[#78716C]">
                <Calendar size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#1C1917]">
                  No hay datos en memoria local
                </p>
                <p className="text-xs text-[#78716C] max-w-xs">
                  Carga archivos Excel o restaura un informe guardado en la nube.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#FFFFFF] rounded-lg border border-[#E2DFD7] divide-y divide-[#E2DFD7] overflow-hidden">
              {availableDates.map((item) => (
                <div
                  key={item.date}
                  onClick={() => onSelectDate(item.date)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectDate(item.date);
                    }
                  }}
                  className="group flex items-center justify-between px-5 py-3.5 hover:bg-[#F7F6F2]/80 transition-colors duration-150 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#461D77]"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 bg-[#F7F6F2] border border-[#E2DFD7] rounded-md flex flex-col items-center justify-center group-hover:bg-[#F3EEF8] group-hover:border-[#461D77]/30 transition-colors shrink-0">
                      <span className="text-[10px] font-medium text-[#78716C] leading-none mb-0.5">
                        Día
                      </span>
                      <span className="text-base font-bold font-mono tabular-nums text-[#1C1917] group-hover:text-[#461D77] leading-none">
                        {item.date.split('-')[2]}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1C1917] font-mono tabular-nums">
                        {formatDateToCL(item.date)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C] mt-0.5">
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <ClipboardList size={12} className="text-[#A8A29E]" />
                          {item.totalProducts} productos
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`inline-flex items-center gap-1 font-mono tabular-nums ${
                            item.justificationsCount > 0 ? 'text-[#15803D] font-semibold' : 'text-[#78716C]'
                          }`}
                        >
                          <MessageSquare size={12} />
                          {item.justificationsCount} justificaciones
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(currentUser?.role === 'admin' || currentUser?.username === 'ctapia') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDateClick(item.date);
                        }}
                        title="Eliminar justificaciones locales de este día"
                        className="w-8 h-8 rounded-md bg-[#FFFFFF] border border-[#E2DFD7] hover:bg-[#FEF2F2] hover:border-[#FECACA] text-[#B91C1C] flex items-center justify-center transition-colors duration-150 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <div className="w-8 h-8 rounded-md bg-[#F7F6F2] border border-[#E2DFD7] flex items-center justify-center text-[#78716C] group-hover:bg-[#461D77] group-hover:border-[#461D77] group-hover:text-white transition-colors duration-150">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="bg-[#FFFFFF] border-t border-[#E2DFD7] px-6 py-5 flex justify-center no-print">
        <p className="text-xs font-mono text-[#78716C]">
          Archivo Histórico Firebase · 2026
        </p>
      </footer>

      {/* Modal Confirmar Eliminación Local */}
      {dateToDelete && (
        <div className="fixed inset-0 z-[1000] bg-[#1C1917]/60 flex items-center justify-center p-4 no-print">
          <div className="bg-[#FFFFFF] max-w-md w-full rounded-lg p-6 shadow-lg border border-[#E2DFD7] flex flex-col space-y-5">
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-md">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-[#1C1917] text-base tracking-[-0.01em]">
                    Confirmar Eliminación Local
                  </h3>
                  <p className="text-xs font-mono text-[#B91C1C]">
                    Acción destructiva local
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDateToDelete(null)}
                className="p-1.5 hover:bg-[#F7F6F2] rounded-md transition-colors text-[#78716C] hover:text-[#1C1917] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-[#57534E] leading-relaxed">
              Para eliminar todas las observaciones registradas localmente del día{' '}
              <strong className="text-[#1C1917] font-mono tabular-nums">
                {formatDateToCL(dateToDelete)}
              </strong>
              , ingresa tu contraseña de administrador.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1C1917] block">
                Contraseña de Administrador
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="password"
                  value={adminPasswordConfirm}
                  onChange={(e) => {
                    setAdminPasswordConfirm(e.target.value);
                    setPasswordError(false);
                  }}
                  autoFocus
                  placeholder="Ingresa contraseña..."
                  className={`w-full py-2.5 pl-10 pr-3.5 bg-[#F7F6F2] border rounded-md text-sm font-medium text-[#1C1917] outline-none transition-colors ${
                    passwordError
                      ? 'border-[#B91C1C] bg-[#FEF2F2]'
                      : 'border-[#E2DFD7] focus:border-[#461D77] focus:bg-[#FFFFFF]'
                  }`}
                />
              </div>
              {passwordError && (
                <p className="text-xs text-[#B91C1C] font-semibold">
                  Contraseña incorrecta
                </p>
              )}
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setDateToDelete(null)}
                className="flex-1 py-2.5 bg-[#FFFFFF] border border-[#E2DFD7] hover:bg-[#F7F6F2] text-[#57534E] text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteJustifications}
                className="flex-1 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Eliminar Todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación en Firebase Cloud */}
      {cloudReportToDelete && (
        <div className="fixed inset-0 z-[1000] bg-[#1C1917]/60 flex items-center justify-center p-4 no-print">
          <div className="bg-[#FFFFFF] max-w-md w-full rounded-lg p-6 shadow-lg border border-[#E2DFD7] flex flex-col space-y-5">
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-md">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-[#1C1917] text-base tracking-[-0.01em]">
                    Eliminar de Firebase Nube
                  </h3>
                  <p className="text-xs font-mono text-[#B91C1C]">
                    Servidor Cloud
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCloudReportToDelete(null)}
                className="p-1.5 hover:bg-[#F7F6F2] rounded-md transition-colors text-[#78716C] hover:text-[#1C1917] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-[#57534E] leading-relaxed">
              Esta acción eliminará permanentemente el informe .json del día{' '}
              <strong className="text-[#1C1917] font-mono tabular-nums">
                {formatDateToCL(cloudReportToDelete.date)}
              </strong>{' '}
              de Firebase. Ingresa tu contraseña de administrador para confirmar.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1C1917] block">
                Contraseña de Administrador
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="password"
                  value={adminPasswordConfirm}
                  onChange={(e) => {
                    setAdminPasswordConfirm(e.target.value);
                    setPasswordError(false);
                  }}
                  autoFocus
                  placeholder="Ingresa contraseña..."
                  className={`w-full py-2.5 pl-10 pr-3.5 bg-[#F7F6F2] border rounded-md text-sm font-medium text-[#1C1917] outline-none transition-colors ${
                    passwordError
                      ? 'border-[#B91C1C] bg-[#FEF2F2]'
                      : 'border-[#E2DFD7] focus:border-[#461D77] focus:bg-[#FFFFFF]'
                  }`}
                />
              </div>
              {passwordError && (
                <p className="text-xs text-[#B91C1C] font-semibold">
                  Contraseña incorrecta
                </p>
              )}
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setCloudReportToDelete(null)}
                className="flex-1 py-2.5 bg-[#FFFFFF] border border-[#E2DFD7] hover:bg-[#F7F6F2] text-[#57534E] text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteCloudReport}
                className="flex-1 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Eliminar de Nube
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, CheckCircle2, AlertCircle, FileSpreadsheet, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface UploadResult {
  success: boolean;
  recordCount?: number;
  fileName?: string;
  error?: string;
}

interface ExcelUploadDropzoneProps {
  onProcessFile: (file: File) => Promise<UploadResult | void>;
  isProcessingExternal?: boolean;
  loadedRecordCount?: number;
  className?: string;
}

type DropzoneStatus = 'idle' | 'dragging' | 'loading' | 'success' | 'error';

export const ExcelUploadDropzone: React.FC<ExcelUploadDropzoneProps> = ({
  onProcessFile,
  isProcessingExternal = false,
  loadedRecordCount = 0,
  className = '',
}) => {
  const [status, setStatus] = useState<DropzoneStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStageText, setCurrentStageText] = useState('Cargando Base Excel...');
  const [uploadedInfo, setUploadedInfo] = useState<{
    fileName: string;
    recordCount: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean timers on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  // Synchronize if external processing ends
  useEffect(() => {
    if (!isProcessingExternal && status === 'loading') {
      // Completed through external state if not already handled
    }
  }, [isProcessingExternal, status]);

  const startLoadingAnimation = useCallback(() => {
    setStatus('loading');
    setProgress(15);
    setCurrentStageText('Leyendo archivo Excel...');

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    let current = 15;
    progressIntervalRef.current = setInterval(() => {
      current += Math.floor(Math.random() * 8) + 4;
      if (current > 92) {
        current = 92;
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      }
      setProgress(current);

      if (current >= 30 && current < 65) {
        setCurrentStageText('Analizando hojas y columnas...');
      } else if (current >= 65) {
        setCurrentStageText('Extrayendo registros operativos...');
      }
    }, 120);
  }, []);

  const handleFile = async (file: File) => {
    if (!file) return;

    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    setErrorMessage(null);
    startLoadingAnimation();

    const startTime = Date.now();

    try {
      // Run the processing function
      const result = await onProcessFile(file);

      // Ensure loading animation is visible for at least 650ms for satisfying UX
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 650 - elapsedTime);

      setTimeout(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setProgress(100);
        setCurrentStageText('¡Completado!');

        // Transition to success after reaching 100%
        setTimeout(() => {
          const count = result && typeof result.recordCount === 'number' 
            ? result.recordCount 
            : loadedRecordCount;

          setUploadedInfo({
            fileName: file.name,
            recordCount: count,
          });
          setStatus('success');

          // Auto-revert back to idle after celebratory presentation (3.8s)
          successTimeoutRef.current = setTimeout(() => {
            setStatus('idle');
          }, 3800);
        }, 250);
      }, remainingTime);

    } catch (err: any) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setStatus('error');
      setErrorMessage(err?.message || 'Error al procesar el archivo Excel.');
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Clear input so the user can re-select the same file if desired
    e.target.value = '';
  };

  // Drag & Drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status !== 'loading') {
      setStatus('dragging');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status === 'dragging') {
      setStatus('idle');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status === 'loading') return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xlsm') || file.name.endsWith('.xls')) {
        handleFile(file);
      } else {
        setStatus('error');
        setErrorMessage('Formato no soportado. Seleccione un archivo Excel (.xlsx, .xlsm).');
      }
    } else {
      setStatus('idle');
    }
  };

  const triggerSelect = () => {
    if (status !== 'loading' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={`space-y-2 select-none ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-violeta">
          Cargar Datos
        </p>
        {uploadedInfo && status === 'idle' && (
          <span className="text-[9px] font-bold text-ionizado uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-ionizado animate-pulse" />
            Base activa
          </span>
        )}
      </div>

      {/* Main Upload Dropzone Card */}
      <div
        onClick={triggerSelect}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative flex flex-col items-center justify-center w-full h-32 rounded-3xl cursor-pointer transition-all duration-300 overflow-hidden ${
          status === 'loading'
            ? 'bg-gradient-to-b from-violeta/[0.04] to-white border-2 border-violeta/50 shadow-md ring-4 ring-violeta/10 cursor-wait'
            : status === 'success'
            ? 'bg-gradient-to-b from-ionizado/[0.08] to-white border-2 border-ionizado shadow-lg ring-4 ring-ionizado/15'
            : status === 'dragging'
            ? 'bg-violeta/[0.08] border-2 border-dashed border-violeta scale-[1.02] shadow-md'
            : status === 'error'
            ? 'bg-red-50/50 border-2 border-red-300 shadow-sm'
            : 'bg-white border-2 border-dashed border-violeta/20 hover:border-ionizado hover:bg-calido/60 shadow-xs hover:shadow-md'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xlsm"
          onChange={onInputChange}
          disabled={status === 'loading'}
        />

        <AnimatePresence mode="wait">
          {/* ========================================================
              1. ESTADO: CARGANDO (Animación de Carga)
              ======================================================== */}
          {status === 'loading' && (
            <motion.div
              key="loading-state"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center w-full h-full px-5 py-3 text-center relative pointer-events-none"
            >
              {/* Background ambient radial glow */}
              <div className="absolute inset-0 bg-radial from-violeta/10 via-transparent to-transparent opacity-80" />

              {/* Central Animated Excel & Laser Scanner Glyph */}
              <div className="relative w-11 h-11 flex items-center justify-center mb-1.5">
                {/* Orbiting ring */}
                <div className="absolute inset-0 rounded-2xl border-2 border-violeta/25 border-t-violeta animate-spin" />
                
                {/* File card container with laser scanner */}
                <div className="relative w-8 h-9 bg-gradient-to-br from-violeta/15 to-violeta/5 rounded-lg border border-violeta/30 flex items-center justify-center overflow-hidden shadow-xs">
                  <FileSpreadsheet className="w-5 h-5 text-violeta" />
                  
                  {/* Laser scanning beam moving top-down */}
                  <div className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-violeta to-transparent shadow-[0_0_8px_rgba(113,119,236,0.9)] animate-[excel-laser-scanner_1.2s_ease-in-out_infinite]" />
                </div>

                {/* Floating data particles ascending */}
                <div className="absolute -left-1 bottom-1 w-1.5 h-1.5 rounded-full bg-violeta animate-[data-particle-ascend_1.4s_ease-in-out_infinite]" />
                <div className="absolute -right-1 bottom-2 w-1.5 h-1.5 rounded-full bg-ionizado animate-[data-particle-ascend_1.1s_ease-in-out_infinite_0.3s]" />
              </div>

              {/* Live Stage Text with subtle pulse */}
              <p className="text-[10px] text-violeta font-black uppercase tracking-wider animate-pulse line-clamp-1">
                {currentStageText}
              </p>

              {/* Smooth Gradient Progress Bar */}
              <div className="w-full max-w-[190px] h-2 bg-slate-100 rounded-full overflow-hidden mt-2 p-0.5 border border-violeta/20">
                <div
                  className="h-full bg-gradient-to-r from-violeta via-indigo-500 to-ionizado rounded-full transition-all duration-200 relative overflow-hidden"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[progress-shimmer_1s_linear_infinite]" />
                </div>
              </div>

              {/* Percentage indicator */}
              <span className="text-[8px] font-black text-slate-400 mt-1 tabular-nums">
                {progress}%
              </span>
            </motion.div>
          )}

          {/* ========================================================
              2. ESTADO: TÉRMINO DE CARGA (Animación de Éxito)
              ======================================================== */}
          {status === 'success' && (
            <motion.div
              key="success-state"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center justify-center w-full h-full px-4 py-2 text-center relative"
            >
              {/* Expanding Ripple Waves */}
              <div className="absolute w-14 h-14 rounded-full border-2 border-ionizado/60 animate-[success-ripple-wave_1.4s_ease-out_infinite] pointer-events-none" />
              <div className="absolute w-14 h-14 rounded-full border border-violeta/40 animate-[success-ripple-wave_1.4s_ease-out_infinite_0.4s] pointer-events-none" />

              {/* Animated Success Badge with pop-bounce */}
              <div className="relative z-10 w-10 h-10 rounded-full bg-gradient-to-tr from-ionizado to-emerald-400 flex items-center justify-center shadow-lg shadow-ionizado/30 animate-[success-pop-bounce_0.6s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards] mb-1.5">
                <CheckCircle2 className="w-6 h-6 text-white stroke-[2.5]" />
                <Sparkles className="w-3.5 h-3.5 text-calido absolute -top-1 -right-1 animate-ping" />
              </div>

              {/* Title & Feedback */}
              <h4 className="text-[11px] text-[#1e5843] font-black uppercase tracking-wider leading-tight flex items-center gap-1">
                ¡Carga Completada!
              </h4>

              {/* Info pills */}
              <div className="flex items-center gap-1.5 mt-1 bg-white/90 border border-ionizado/30 px-2.5 py-0.5 rounded-full shadow-2xs max-w-[200px]">
                <FileSpreadsheet size={10} className="text-ionizado shrink-0" />
                <span className="text-[9px] font-black text-slate-700 truncate tracking-wide">
                  {uploadedInfo?.recordCount ? `${uploadedInfo.recordCount.toLocaleString('es-CL')} reg.` : 'Base cargada'}
                </span>
                <span className="text-ionizado font-bold text-[8px] uppercase tracking-wider">✓ OK</span>
              </div>

              <span className="text-[8px] text-slate-400 mt-1 font-semibold">
                Clic para cargar otra base
              </span>
            </motion.div>
          )}

          {/* ========================================================
              3. ESTADO: ERROR AL CARGAR
              ======================================================== */}
          {status === 'error' && (
            <motion.div
              key="error-state"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex flex-col items-center justify-center w-full h-full px-4 py-2 text-center"
            >
              <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-1.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-[10px] font-black text-red-700 uppercase tracking-wider">
                Fallo al cargar
              </p>
              <p className="text-[8px] text-red-500 font-bold max-w-[190px] truncate mt-0.5">
                {errorMessage || 'Archivo inválido'}
              </p>
              <span className="mt-1 text-[8px] font-black uppercase tracking-widest text-violeta flex items-center gap-1 hover:underline">
                <RefreshCw size={8} /> Reintentar
              </span>
            </motion.div>
          )}

          {/* ========================================================
              4. ESTADO: REPOSO (Idle) / DRAGGING
              ======================================================== */}
          {(status === 'idle' || status === 'dragging') && (
            <motion.div
              key="idle-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center p-4 text-center w-full"
            >
              {/* Dynamic Upload Tray Icon */}
              <div className="relative mb-2">
                <Upload
                  className={`w-8 h-8 transition-all duration-300 ${
                    status === 'dragging'
                      ? 'text-violeta scale-125 -translate-y-1'
                      : 'text-violeta/40 group-hover:text-violeta group-hover:-translate-y-0.5'
                  }`}
                />
                {/* Subtle hover pulse background behind arrow */}
                <div className="absolute inset-0 rounded-full bg-violeta/10 scale-0 group-hover:scale-125 transition-transform duration-300 -z-10" />
              </div>

              {/* Main Label matching the user design */}
              <p
                className={`text-[10px] uppercase font-black tracking-widest transition-colors ${
                  status === 'dragging'
                    ? 'text-violeta font-black scale-105'
                    : 'text-violeta/60 group-hover:text-violeta'
                }`}
              >
                {status === 'dragging' ? 'Soltar Base Excel' : 'Base Excel'}
              </p>

              {/* Micro subtext with file extensions */}
              <span className="text-[8px] font-bold text-slate-400/80 tracking-wider mt-0.5">
                .xlsx · .xlsm
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Persistent subtle footer pill if data is loaded */}
      {uploadedInfo && status === 'idle' && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[9px]">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-ionizado shrink-0" />
            <span className="font-bold text-slate-600 truncate max-w-[130px]">
              {uploadedInfo.fileName}
            </span>
          </div>
          <span className="font-black text-violeta tabular-nums shrink-0">
            {uploadedInfo.recordCount.toLocaleString('es-CL')} reg.
          </span>
        </div>
      )}
    </div>
  );
};

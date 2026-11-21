import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
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
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
          Cargar Datos
        </p>
        {uploadedInfo && status === 'idle' && (
          <span className="text-[10px] font-mono font-semibold text-[#15803D] uppercase tracking-wider">
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
        className={`group relative flex flex-col items-center justify-center w-full h-32 rounded-lg cursor-pointer transition-colors duration-150 ease-out overflow-hidden ${
          status === 'loading'
            ? 'bg-[#F3EEF8]/60 border border-[#461D77] cursor-wait'
            : status === 'success'
            ? 'bg-[#F0FDF4] border border-[#15803D]'
            : status === 'dragging'
            ? 'bg-[#F3EEF8] border border-dashed border-[#461D77]'
            : status === 'error'
            ? 'bg-[#FEF2F2] border border-[#B91C1C]'
            : 'bg-[#FFFFFF] border border-dashed border-[#E2DFD7] hover:border-[#461D77] hover:bg-[#F7F6F2]'
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
          {status === 'loading' && (
            <motion.div
              key="loading-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center justify-center w-full h-full px-5 py-3 text-center pointer-events-none"
            >
              <div className="w-6 h-6 rounded-full border-2 border-[#E2DFD7] border-t-[#461D77] animate-spin mb-2" />
              <p className="text-[11px] text-[#461D77] font-semibold uppercase tracking-wider line-clamp-1">
                {currentStageText}
              </p>
              <div className="w-full max-w-[180px] h-1.5 bg-[#EFECE6] rounded-sm overflow-hidden mt-2">
                <div
                  className="h-full bg-[#461D77] transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-[#78716C] mt-1 tabular-nums">
                {progress}%
              </span>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              key="success-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center justify-center w-full h-full px-4 py-2 text-center"
            >
              <CheckCircle2 className="w-6 h-6 text-[#15803D] mb-1.5" />
              <h4 className="text-xs text-[#15803D] font-bold uppercase tracking-wider">
                Carga Completada
              </h4>
              <p className="text-[11px] font-mono font-medium text-[#1C1917] tabular-nums mt-0.5">
                {uploadedInfo?.recordCount ? `${uploadedInfo.recordCount.toLocaleString('es-CL')} registros` : 'Base cargada'}
              </p>
              <span className="text-[10px] text-[#78716C] mt-1">
                Clic para cargar otra base
              </span>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              key="error-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center w-full h-full px-4 py-2 text-center"
            >
              <AlertCircle className="w-6 h-6 text-[#B91C1C] mb-1.5" />
              <p className="text-xs font-bold text-[#B91C1C] uppercase tracking-wider">
                Fallo al cargar
              </p>
              <p className="text-[10px] text-[#B91C1C] font-medium max-w-[200px] truncate mt-0.5">
                {errorMessage || 'Archivo inválido'}
              </p>
              <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#461D77] flex items-center gap-1 hover:underline">
                <RefreshCw size={10} /> Reintentar
              </span>
            </motion.div>
          )}

          {(status === 'idle' || status === 'dragging') && (
            <motion.div
              key="idle-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center p-4 text-center w-full"
            >
              <Upload
                className={`w-6 h-6 mb-2 transition-colors duration-150 ${
                  status === 'dragging'
                    ? 'text-[#461D77]'
                    : 'text-[#78716C] group-hover:text-[#461D77]'
                }`}
              />
              <p
                className={`text-xs uppercase font-semibold tracking-wider transition-colors duration-150 ${
                  status === 'dragging'
                    ? 'text-[#461D77]'
                    : 'text-[#57534E] group-hover:text-[#461D77]'
                }`}
              >
                {status === 'dragging' ? 'Soltar Base Excel' : 'Cargar Base Excel'}
              </p>
              <span className="text-[10px] font-mono text-[#78716C] mt-0.5">
                .xlsx · .xlsm
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Persistent subtle footer if data is loaded */}
      {uploadedInfo && status === 'idle' && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#F7F6F2] border border-[#E2DFD7] rounded-md text-[11px]">
          <span className="font-medium text-[#57534E] truncate max-w-[140px]">
            {uploadedInfo.fileName}
          </span>
          <span className="font-mono font-semibold text-[#461D77] tabular-nums shrink-0">
            {uploadedInfo.recordCount.toLocaleString('es-CL')} reg.
          </span>
        </div>
      )}
    </div>
  );
};

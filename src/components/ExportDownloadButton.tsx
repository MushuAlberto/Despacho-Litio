import React, { useState, useRef, useEffect } from 'react';
import { FileText, ImageIcon, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type ExportButtonType = 'pdf' | 'png';

interface ExportDownloadButtonProps {
  type: ExportButtonType;
  onClick: () => Promise<boolean | void> | void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  defaultLabel?: string;
}

export const ExportDownloadButton: React.FC<ExportDownloadButtonProps> = ({
  type,
  onClick,
  isLoading: externalLoading = false,
  disabled = false,
  className = '',
  defaultLabel,
}) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [stageText, setStageText] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState(0);

  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync external loading if controlled from outside
  useEffect(() => {
    if (externalLoading && status === 'idle') {
      triggerLoadingState();
    }
  }, [externalLoading]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const triggerLoadingState = () => {
    setStatus('loading');
    setDownloadProgress(15);
    setStageText(type === 'pdf' ? 'Compilando páginas...' : 'Capturando pantalla...');

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    let curr = 15;
    progressIntervalRef.current = setInterval(() => {
      curr += Math.floor(Math.random() * 12) + 8;
      if (curr >= 92) {
        curr = 92;
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      }
      setDownloadProgress(curr);

      if (curr > 50 && curr < 85) {
        setStageText(type === 'pdf' ? 'Renderizando PDF...' : 'Procesando imagen...');
      } else if (curr >= 85) {
        setStageText('Generando archivo...');
      }
    }, 140);
  };

  const handleClick = async () => {
    if (disabled || status === 'loading') return;

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    triggerLoadingState();

    const startTime = Date.now();

    try {
      // Execute the actual export operation
      await onClick();

      // Ensure loading animation has a smooth, visible duration (minimum 600ms)
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 600 - elapsed);

      setTimeout(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setDownloadProgress(100);
        setStageText('¡Listo!');

        setTimeout(() => {
          setStatus('success');

          // Auto-revert back to idle after 2.4s
          resetTimerRef.current = setTimeout(() => {
            setStatus('idle');
            setDownloadProgress(0);
          }, 2400);
        }, 200);
      }, remaining);

    } catch (err) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setStatus('error');
      setStageText('Error al descargar');
      resetTimerRef.current = setTimeout(() => {
        setStatus('idle');
      }, 3000);
    }
  };

  const label = defaultLabel || (type === 'pdf' ? 'Exportar PDF' : 'Descargar PNG');

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || status === 'loading'}
      className={`group relative w-full overflow-hidden rounded-2xl py-3 px-4 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all duration-300 select-none shadow-sm cursor-pointer ${
        status === 'loading'
          ? 'bg-white border-2 border-violeta/50 shadow-md ring-4 ring-violeta/10 cursor-wait'
          : status === 'success'
          ? 'bg-ionizado/[0.08] border-2 border-ionizado text-[#1e5843] shadow-md ring-4 ring-ionizado/15'
          : status === 'error'
          ? 'bg-red-50 border-2 border-red-300 text-red-700'
          : 'bg-white border border-violeta/20 text-nucleo hover:border-violeta/60 hover:shadow-md hover:bg-violeta/[0.02] active:scale-[0.99]'
      } ${className}`}
      title={label}
    >
      {/* Background Progress Fill (active during loading) */}
      {status === 'loading' && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-violeta/[0.08] via-indigo-50 to-ionizado/[0.12] transition-all duration-200 pointer-events-none"
          style={{ width: `${downloadProgress}%` }}
        >
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-violeta/40 animate-pulse" />
        </div>
      )}

      {/* Subtle hover gleam shine across button in idle state */}
      {status === 'idle' && (
        <div className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-[-25deg] -translate-x-[200%] group-hover:animate-[button-sweep-gleam_0.9s_ease-in-out] pointer-events-none" />
      )}

      {/* Content wrapper with smooth animation transitions */}
      <AnimatePresence mode="wait">
        {/* ========================================================
            1. ESTADO: CARGANDO / DESCARGANDO
            ======================================================== */}
        {status === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 flex items-center justify-center gap-2 w-full text-violeta"
          >
            {/* Animated Download Glyph */}
            <div className="relative w-4 h-4 flex items-center justify-center">
              {/* Spinner ring */}
              <div className="absolute inset-0 rounded-full border-2 border-violeta/30 border-t-violeta animate-spin" />
              
              {/* Icon in center */}
              {type === 'pdf' ? (
                <FileText size={9} className="text-violeta animate-pulse" />
              ) : (
                <ImageIcon size={9} className="text-violeta animate-pulse" />
              )}
            </div>

            {/* Dynamic Stage Text */}
            <span className="truncate tracking-wider font-black text-[9px] text-violeta">
              {stageText}
            </span>

            {/* Micro percentage badge */}
            <span className="text-[8px] font-black tabular-nums bg-violeta/10 text-violeta px-1.5 py-0.5 rounded-full ml-auto">
              {downloadProgress}%
            </span>
          </motion.div>
        )}

        {/* ========================================================
            2. ESTADO: TÉRMINO DE DESCARGA (Éxito)
            ======================================================== */}
        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 flex items-center justify-center gap-2 w-full text-[#1e5843]"
          >
            {/* Pop bouncing check icon */}
            <div className="relative flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-ionizado text-white flex items-center justify-center shadow-xs animate-[success-pop-bounce_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">
                <CheckCircle2 size={12} className="stroke-[3]" />
              </div>
              <Sparkles size={8} className="text-emerald-500 absolute -top-1 -right-1 animate-ping" />
            </div>

            <span className="tracking-wider font-black text-[9px] text-[#1e5843]">
              {type === 'pdf' ? '¡PDF Descargado!' : '¡PNG Descargado!'}
            </span>

            {/* Mini confirmation pill */}
            <span className="text-[8px] font-black uppercase text-ionizado bg-white/90 border border-ionizado/30 px-1.5 py-0.5 rounded-full ml-auto shadow-2xs">
              ✓ OK
            </span>
          </motion.div>
        )}

        {/* ========================================================
            3. ESTADO: ERROR
            ======================================================== */}
        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex items-center justify-center gap-2 w-full text-red-600"
          >
            <AlertCircle size={12} className="shrink-0" />
            <span className="truncate tracking-wider font-black text-[9px]">
              {stageText || 'Fallo de descarga'}
            </span>
          </motion.div>
        )}

        {/* ========================================================
            4. ESTADO: REPOSO (Idle)
            ======================================================== */}
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative z-10 flex items-center justify-center gap-2 w-full"
          >
            {/* Icon with interactive hover float effect */}
            <div className="text-violeta group-hover:text-[#461D77] transition-transform duration-200 group-hover:translate-y-0.5">
              {type === 'pdf' ? (
                <FileText size={12} className="transition-transform group-hover:scale-110" />
              ) : (
                <ImageIcon size={12} className="transition-transform group-hover:scale-110" />
              )}
            </div>

            {/* Label */}
            <span className="text-nucleo group-hover:text-[#461D77] transition-colors tracking-widest font-black text-[9px]">
              {label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

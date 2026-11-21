import React, { useState, useRef, useEffect } from 'react';
import { FileText, ImageIcon, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

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
    setStageText(type === 'pdf' ? 'Compilando páginas...' : 'Capturando vista...');

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
      await onClick();

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 450 - elapsed);

      setTimeout(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setDownloadProgress(100);
        setStageText('Listo');

        setTimeout(() => {
          setStatus('success');

          resetTimerRef.current = setTimeout(() => {
            setStatus('idle');
            setDownloadProgress(0);
          }, 2200);
        }, 150);
      }, remaining);

    } catch {
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
      className={`relative w-full overflow-hidden rounded-md py-2.5 px-4 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors duration-150 select-none cursor-pointer ${
        status === 'loading'
          ? 'bg-[#F3EEF8] border border-[#461D77] text-[#461D77] cursor-wait'
          : status === 'success'
          ? 'bg-[#ECFDF5] border border-[#15803D]/40 text-[#15803D]'
          : status === 'error'
          ? 'bg-[#FEF2F2] border border-[#B91C1C]/40 text-[#B91C1C]'
          : 'bg-white border border-[#E2DFD7] text-[#1C1917] hover:border-[#461D77] hover:bg-[#F7F6F2]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      title={label}
    >
      {/* Background Progress Fill */}
      {status === 'loading' && (
        <div
          className="absolute inset-y-0 left-0 bg-[#461D77]/10 transition-all duration-150 pointer-events-none"
          style={{ width: `${downloadProgress}%` }}
        />
      )}

      {status === 'loading' && (
        <div className="relative z-10 flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 size={14} className="animate-spin text-[#461D77] shrink-0" />
            <span className="truncate">{stageText}</span>
          </div>
          <span className="text-[11px] font-mono tabular-nums font-bold shrink-0">
            {downloadProgress}%
          </span>
        </div>
      )}

      {status === 'success' && (
        <div className="relative z-10 flex items-center justify-center gap-2 w-full">
          <CheckCircle2 size={14} className="text-[#15803D] shrink-0" />
          <span>{type === 'pdf' ? 'PDF Descargado' : 'PNG Descargado'}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="relative z-10 flex items-center justify-center gap-2 w-full">
          <AlertCircle size={14} className="shrink-0" />
          <span className="truncate">{stageText || 'Fallo de descarga'}</span>
        </div>
      )}

      {status === 'idle' && (
        <div className="relative z-10 flex items-center justify-center gap-2 w-full">
          {type === 'pdf' ? (
            <FileText size={14} className="text-[#461D77]" />
          ) : (
            <ImageIcon size={14} className="text-[#461D77]" />
          )}
          <span>{label}</span>
        </div>
      )}
    </button>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { CloudUpload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface FirebaseSyncButtonProps {
  onSync: () => Promise<boolean | void>;
  isSyncingExternal?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export const FirebaseSyncButton: React.FC<FirebaseSyncButtonProps> = ({
  onSync,
  isSyncingExternal = false,
  disabled = false,
  className = '',
  label = 'Guardar Historial en Firebase',
}) => {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('Conectando...');

  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (isSyncingExternal && status === 'idle') {
      triggerSyncAnimation();
    }
  }, [isSyncingExternal]);

  const triggerSyncAnimation = () => {
    setStatus('syncing');
    setProgress(15);
    setStageText('Conectando...');

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    let curr = 15;
    progressIntervalRef.current = setInterval(() => {
      curr += Math.floor(Math.random() * 10) + 6;
      if (curr >= 92) {
        curr = 92;
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      }
      setProgress(curr);

      if (curr > 30 && curr < 70) {
        setStageText('Subiendo historial...');
      } else if (curr >= 70) {
        setStageText('Guardando en la nube...');
      }
    }, 130);
  };

  const handleClick = async () => {
    if (disabled || status === 'syncing') return;

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    triggerSyncAnimation();

    const startTime = Date.now();

    try {
      const result = await onSync();
      if (result === false) {
        throw new Error('Sincronización rechazada por el servidor');
      }

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 500 - elapsed);

      setTimeout(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setProgress(100);
        setStageText('Sincronizado');

        setTimeout(() => {
          setStatus('success');

          resetTimerRef.current = setTimeout(() => {
            setStatus('idle');
            setProgress(0);
          }, 2400);
        }, 150);
      }, remaining);

    } catch {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setStatus('error');
      setStageText('Error al guardar');
      resetTimerRef.current = setTimeout(() => {
        setStatus('idle');
        setProgress(0);
      }, 3000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || status === 'syncing'}
      className={`relative w-full overflow-hidden rounded-md py-2.5 px-4 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors duration-150 select-none cursor-pointer ${
        status === 'syncing'
          ? 'bg-[#36155E] text-white cursor-wait'
          : status === 'success'
          ? 'bg-[#15803D] text-white'
          : status === 'error'
          ? 'bg-[#B91C1C] text-white'
          : 'bg-[#461D77] text-white hover:bg-[#36155E]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      title={label}
    >
      {status === 'syncing' && (
        <div
          className="absolute inset-y-0 left-0 bg-white/15 transition-all duration-150 pointer-events-none"
          style={{ width: `${progress}%` }}
        />
      )}

      {status === 'syncing' && (
        <div className="relative z-10 flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 size={14} className="animate-spin shrink-0" />
            <span className="truncate">{stageText}</span>
          </div>
          <span className="text-[11px] font-mono tabular-nums font-bold shrink-0">
            {progress}%
          </span>
        </div>
      )}

      {status === 'success' && (
        <div className="relative z-10 flex items-center justify-center gap-2 w-full">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>Historial Guardado</span>
        </div>
      )}

      {status === 'error' && (
        <div className="relative z-10 flex items-center justify-center gap-2 w-full">
          <AlertCircle size={14} className="shrink-0" />
          <span className="truncate">{stageText}</span>
        </div>
      )}

      {status === 'idle' && (
        <div className="relative z-10 flex items-center justify-center gap-2 w-full">
          <CloudUpload size={14} />
          <span>{label}</span>
        </div>
      )}
    </button>
  );
};

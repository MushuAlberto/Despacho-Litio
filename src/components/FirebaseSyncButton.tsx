import React, { useState, useRef, useEffect } from 'react';
import { CloudUpload, CheckCircle2, AlertCircle, Sparkles, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const [stageText, setStageText] = useState('Conectando a Firestore...');

  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  // Sync external loading if controlled from outside
  useEffect(() => {
    if (isSyncingExternal && status === 'idle') {
      triggerSyncAnimation();
    }
  }, [isSyncingExternal]);

  const triggerSyncAnimation = () => {
    setStatus('syncing');
    setProgress(15);
    setStageText('Conectando a Firestore...');

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
        setStageText('Subiendo Historial JSON...');
      } else if (curr >= 70) {
        setStageText('Asegurando en la Nube...');
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
      // If the function explicitly returned false, consider it a failure
      if (result === false) {
        throw new Error('Sincronización rechazada por el servidor');
      }

      // Ensure animation duration is visible and satisfying (minimum 750ms)
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 750 - elapsed);

      setTimeout(() => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setProgress(100);
        setStageText('¡Sincronizado!');

        setTimeout(() => {
          setStatus('success');

          // Auto-revert back to idle after celebratory presentation (2.8s)
          resetTimerRef.current = setTimeout(() => {
            setStatus('idle');
            setProgress(0);
          }, 2800);
        }, 220);
      }, remaining);

    } catch (error) {
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
      className={`group relative w-full overflow-hidden rounded-2xl py-3 px-4 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all duration-300 select-none cursor-pointer shadow-lg active:scale-[0.99] ${
        status === 'syncing'
          ? 'bg-gradient-to-r from-[#461D77] via-[#652ca6] to-[#461D77] bg-[length:200%_100%] animate-[gradient-cloud-flow_2s_ease_infinite] text-white shadow-violeta/30 ring-4 ring-violeta/20 cursor-wait'
          : status === 'success'
          ? 'bg-gradient-to-r from-[#1e5843] via-[#237456] to-[#1e5843] text-white shadow-emerald-900/30 ring-4 ring-emerald-500/20'
          : status === 'error'
          ? 'bg-red-800 text-white shadow-red-900/30'
          : 'bg-[#461D77] text-white hover:bg-[#321159] hover:shadow-xl hover:shadow-nucleo/25'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      title={label}
    >
      {/* Background Progress Track on Syncing */}
      {status === 'syncing' && (
        <div
          className="absolute inset-0 bg-white/[0.08] transition-all duration-200 pointer-events-none"
          style={{ width: `${progress}%` }}
        >
          {/* Glowing vertical bar on progress head */}
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse" />
        </div>
      )}

      {/* Ambient hover light sweep sheen */}
      {status === 'idle' && (
        <div className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-25deg] -translate-x-[200%] group-hover:animate-[button-sweep-gleam_0.9s_ease-in-out] pointer-events-none" />
      )}

      {/* Ripple wave when successful */}
      {status === 'success' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="w-16 h-16 rounded-full border-2 border-emerald-400/80 animate-[cloud-success-ripple_1.2s_ease-out_forwards]" />
        </div>
      )}

      {/* Dynamic Content Container */}
      <AnimatePresence mode="wait">
        {/* ========================================================
            1. ESTADO: SINCRONIZANDO (Subiendo a la nube)
            ======================================================== */}
        {status === 'syncing' && (
          <motion.div
            key="syncing"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 flex items-center justify-center gap-2.5 w-full"
          >
            {/* Animated Cloud Upload Hub with rising particles */}
            <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
              {/* Spinning cloud orbit ring */}
              <div className="absolute inset-0 rounded-full border border-white/20 border-t-white animate-spin" />
              
              {/* Cloud icon */}
              <CloudUpload size={12} className="text-white animate-pulse" />
              
              {/* Upward data pulse particle */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full animate-[cloud-data-ascend_1s_ease-in-out_infinite]" />
            </div>

            {/* Dynamic Stage Text */}
            <span className="truncate tracking-wider font-black text-[9px] text-white">
              {stageText}
            </span>

            {/* Live percentage badge */}
            <span className="text-[8px] font-black tabular-nums bg-white/20 text-white px-1.5 py-0.5 rounded-full ml-auto shadow-2xs">
              {progress}%
            </span>
          </motion.div>
        )}

        {/* ========================================================
            2. ESTADO: TÉRMINO DE GUARDADO (Éxito en Firebase)
            ======================================================== */}
        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 flex items-center justify-center gap-2 w-full text-white"
          >
            {/* Pop bouncing Check Badge */}
            <div className="relative flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-emerald-400 text-emerald-950 flex items-center justify-center shadow-md shadow-emerald-900/40 animate-[success-pop-bounce_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">
                <CheckCircle2 size={12} className="stroke-[3]" />
              </div>
              <Sparkles size={9} className="text-emerald-200 absolute -top-1.5 -right-1.5 animate-ping" />
            </div>

            <span className="tracking-wider font-black text-[9px] text-white">
              ¡Historial Guardado en Firebase!
            </span>

            {/* Mini Cloud Pill */}
            <span className="text-[8px] font-black uppercase text-emerald-200 bg-emerald-900/60 border border-emerald-400/40 px-1.5 py-0.5 rounded-full ml-auto shadow-2xs flex items-center gap-1">
              <Database size={8} /> Nube OK
            </span>
          </motion.div>
        )}

        {/* ========================================================
            3. ESTADO: ERROR AL SINCRONIZAR
            ======================================================== */}
        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex items-center justify-center gap-2 w-full text-white"
          >
            <AlertCircle size={12} className="text-red-300 shrink-0" />
            <span className="truncate tracking-wider font-black text-[9px]">
              {stageText || 'Fallo de conexión con Firebase'}
            </span>
            <span className="text-[8px] font-black underline ml-auto text-red-200">
              Reintentar
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
            {/* Animated floating cloud icon */}
            <div className="transition-transform duration-300 group-hover:-translate-y-0.5">
              <CloudUpload size={12} className="transition-transform group-hover:scale-110" />
            </div>

            {/* Label in uppercase tracking-widest */}
            <span className="tracking-widest font-black text-[9px]">
              {label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

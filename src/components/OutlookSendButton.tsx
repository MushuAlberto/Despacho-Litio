import React, { useState, useRef, useEffect } from 'react';
import { Mail } from 'lucide-react';

interface OutlookSendButtonProps {
  onClick: () => void;
  autoreset?: number; // Defaults to 1800ms matching autoreset="1800"
  disabled?: boolean;
  className?: string;
}

export const OutlookSendButton: React.FC<OutlookSendButtonProps> = ({
  onClick,
  autoreset = 1800,
  disabled = false,
  className = '',
}) => {
  const [animState, setAnimState] = useState<'idle' | 'folding' | 'flying'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || animState !== 'idle') return;

    // Step 1: Start origami fold (sb-fold keyframe)
    setAnimState('folding');

    // Step 2: Transition into flight trajectory
    setTimeout(() => {
      setAnimState('flying');
    }, 550);

    // Step 3: Trigger the target action (open Outlook modal) during flight
    actionTimerRef.current = setTimeout(() => {
      onClick();
    }, 450);

    // Step 4: Auto-reset to initial state after the specified autoreset duration
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setAnimState('idle');
    }, autoreset);
  };

  const isAnimating = animState !== 'idle';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`group relative w-full bg-white border-2 border-violeta text-violeta py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all duration-200 premium-btn-transition cursor-pointer shadow-sm hover:bg-violeta/5 hover:border-violeta/70 hover:shadow-md active:scale-[0.99] overflow-hidden ${
        isAnimating ? 'ring-2 ring-violeta/20 bg-violeta/[0.03]' : ''
      } ${className}`}
      title="Compartir informe vía correo Outlook"
    >
      {/* Flight Canvas & Origami Sheet container */}
      <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
        {/* Default Mail Icon (fades and shrinks during origami fold) */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            isAnimating ? 'opacity-0 scale-50 rotate-[-20deg]' : 'opacity-100 scale-100 group-hover:scale-110'
          }`}
        >
          <Mail size={12} className="text-violeta transition-transform group-hover:-translate-y-0.5" />
        </div>

        {/* Origami Paper Plane (activates when folding/flying) */}
        {isAnimating && (
          <div
            className={`absolute inset-0 flex items-center justify-center pointer-events-none ${
              animState === 'flying'
                ? 'animate-[sb-takeoff-flight_0.65s_cubic-bezier(0.12,0.8,0.2,1)_forwards]'
                : ''
            }`}
          >
            {/* The origami folding sheet with left & right facets */}
            <div
              className="relative w-3.5 h-3.5 origin-center animate-[sb-fold_0.6s_cubic-bezier(0.25,1,0.5,1)_forwards]"
            >
              {/* Left facet with dynamic polygon clip-path */}
              <div
                className="facet facet--left absolute inset-0 bg-gradient-to-br from-[#7177EC] to-[#5459dc] animate-[sb-fold-facet-left_0.6s_cubic-bezier(0.25,1,0.5,1)_forwards] shadow-xs"
              />
              {/* Right facet with dynamic polygon clip-path */}
              <div
                className="facet facet--right absolute inset-0 bg-gradient-to-br from-[#9298f8] to-[#7177EC] animate-[sb-fold-facet-right_0.6s_cubic-bezier(0.25,1,0.5,1)_forwards] shadow-xs"
              />
              {/* Center crease line */}
              <div className="absolute top-0 bottom-0 left-1/2 w-[0.5px] bg-black/15 -translate-x-1/2 pointer-events-none" />
            </div>

            {/* Subtle vapor / flight dash particle behind the plane */}
            {animState === 'flying' && (
              <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-8 h-[1.5px] bg-gradient-to-r from-transparent via-violeta/40 to-transparent -rotate-12 animate-pulse" />
            )}
          </div>
        )}
      </div>

      {/* Button Text with smooth animated transitions */}
      <span
        className={`tracking-widest transition-all duration-300 select-none ${
          isAnimating
            ? 'text-violeta/90 tracking-[0.18em]'
            : 'text-violeta group-hover:text-[#461D77]'
        }`}
      >
        {animState === 'folding'
          ? 'Preparando Correo...'
          : animState === 'flying'
          ? 'Abriendo Outlook...'
          : 'Compartir por Outlook'}
      </span>

      {/* Ambient background hover shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violeta/[0.04] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />
    </button>
  );
};

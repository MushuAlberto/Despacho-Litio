import React, { useState, useEffect, useRef } from 'react';
import {
  Minimize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useMiningShiftClock, useScreenWakeLock } from '../hooks/useControlRoom';
import { AppView } from './App';

interface ControlRoomOverlayProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  zoomLevel: number;
  onSetZoomLevel: (zoom: number) => void;
}

export const ControlRoomOverlay: React.FC<ControlRoomOverlayProps> = ({
  isFullscreen,
  onToggleFullscreen,
  zoomLevel,
  onSetZoomLevel
}) => {
  const shiftInfo = useMiningShiftClock();
  useScreenWakeLock(isFullscreen);

  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!isFullscreen) {
      setIsIdle(false);
      document.body.classList.remove('control-room-cursor-hidden');
      return;
    }

    const resetIdleTimer = () => {
      setIsIdle(false);
      document.body.classList.remove('control-room-cursor-hidden');

      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setIsIdle(true);
        document.body.classList.add('control-room-cursor-hidden');
      }, 4000);
    };

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);

    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
      document.body.classList.remove('control-room-cursor-hidden');
    };
  }, [isFullscreen]);

  if (!isFullscreen) return null;

  return (
    <aside
      aria-label="Controles Sala de Control"
      className={`fixed top-4 right-4 z-[99] transition-opacity duration-200 ease-out no-print select-none ${
        isIdle ? 'opacity-25 hover:opacity-100' : 'opacity-100'
      }`}
    >
      <div className="bg-[#1C1917] border border-stone-700 text-white rounded-lg shadow-lg px-3 py-2 flex items-center gap-3">
        <div className="flex items-center gap-3 pr-3 border-r border-stone-700">
          <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
            <span className="font-semibold text-stone-200">{shiftInfo.shiftName}</span>
            <span className="text-stone-500">/</span>
            <span className="text-white font-bold">{shiftInfo.timeString}</span>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-stone-400 hidden sm:inline">
            -{shiftInfo.remainingShiftTime}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSetZoomLevel(Math.max(0.85, zoomLevel - 0.1))}
            className="p-1.5 hover:bg-stone-800 rounded-md text-stone-300 hover:text-white transition-colors duration-150 cursor-pointer"
            title="Reducir escala de pantalla"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs font-mono tabular-nums font-semibold px-1 text-stone-200">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            onClick={() => onSetZoomLevel(Math.min(1.4, zoomLevel + 0.1))}
            className="p-1.5 hover:bg-stone-800 rounded-md text-stone-300 hover:text-white transition-colors duration-150 cursor-pointer"
            title="Aumentar escala para monitores"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleFullscreen}
          className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white border border-stone-600 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150 cursor-pointer"
          title="Salir de pantalla completa (Esc)"
        >
          <Minimize2 size={13} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </aside>
  );
};

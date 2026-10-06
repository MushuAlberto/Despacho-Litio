import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize2,
  Minimize2,
  Clock,
  Tv,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
  Layers,
  Activity,
  X
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
  currentView,
  onNavigate,
  zoomLevel,
  onSetZoomLevel
}) => {
  const shiftInfo = useMiningShiftClock();
  useScreenWakeLock(isFullscreen);

  const [isIdle, setIsIdle] = useState(false);
  const [hudMinimized, setHudMinimized] = useState(false);
  const idleTimerRef = useRef<any>(null);

  // Auto-hide cursor and dim HUD after 4 seconds of mouse inactivity in fullscreen
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
    <>
      {/* Floating HUD at Top-Right */}
      <aside
        aria-label="Controles Sala de Control"
        className={`fixed top-4 right-4 z-[99] transition-all duration-300 no-print select-none ${
          isIdle ? 'opacity-25 hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 text-white rounded-2xl shadow-2xl p-2.5 flex items-center gap-3">
          
          {/* Shift Indicator and Live Clock */}
          <div className="flex items-center gap-2.5 px-2.5 py-1 bg-white/5 rounded-xl border border-white/10">
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-black tracking-wide uppercase text-emerald-400">
                <span>{shiftInfo.shiftName}</span>
                <span className="text-white/40">&bull;</span>
                <span className="font-mono text-white text-xs">{shiftInfo.timeString}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-medium">
                <span>Restan {shiftInfo.remainingShiftTime}</span>
                <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-1000"
                    style={{ width: `${shiftInfo.shiftProgressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Wallboard Zoom Controls for Large TV Screens */}
          <div className="flex items-center gap-1 bg-white/5 rounded-xl p-0.5 border border-white/10">
            <button
              onClick={() => onSetZoomLevel(Math.max(0.85, zoomLevel - 0.1))}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Reducir escala de pantalla"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-[10px] font-mono font-bold px-1 text-purple-200">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => onSetZoomLevel(Math.min(1.4, zoomLevel + 0.1))}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Aumentar escala para monitores de pared (TV)"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Quick Exit Fullscreen */}
          <button
            onClick={onToggleFullscreen}
            className="flex items-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/40 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
            title="Salir de pantalla completa (Esc)"
          >
            <Minimize2 size={13} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </aside>
    </>
  );
};

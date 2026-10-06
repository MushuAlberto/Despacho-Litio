import { useState, useEffect, useCallback, useRef } from 'react';

export interface MiningShiftInfo {
  timeString: string;
  dateString: string;
  shiftName: 'Turno Día' | 'Turno Noche';
  shiftHours: string;
  shiftProgressPercent: number;
  remainingShiftTime: string;
}

/**
 * Real-time clock and shift calculation hook calibrated for Chilean mining operations
 * Turno Día: 07:00 to 19:00 (12 hrs)
 * Turno Noche: 19:00 to 07:00 (12 hrs)
 */
export function useMiningShiftClock(): MiningShiftInfo {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  const isTurnoDia = hours >= 7 && hours < 19;
  const shiftName: 'Turno Día' | 'Turno Noche' = isTurnoDia ? 'Turno Día' : 'Turno Noche';
  const shiftHours = isTurnoDia ? '07:00 - 19:00' : '19:00 - 07:00';

  // Calculate elapsed seconds in current 12-hour shift
  let elapsedSeconds = 0;
  const totalShiftSeconds = 12 * 3600;

  if (isTurnoDia) {
    elapsedSeconds = (hours - 7) * 3600 + minutes * 60 + seconds;
  } else {
    if (hours >= 19) {
      elapsedSeconds = (hours - 19) * 3600 + minutes * 60 + seconds;
    } else {
      elapsedSeconds = (5 + hours) * 3600 + minutes * 60 + seconds;
    }
  }

  const shiftProgressPercent = Math.min(100, Math.max(0, (elapsedSeconds / totalShiftSeconds) * 100));
  const remainingSecs = Math.max(0, totalShiftSeconds - elapsedSeconds);
  const remainingHrs = Math.floor(remainingSecs / 3600);
  const remainingMins = Math.floor((remainingSecs % 3600) / 60);
  const remainingShiftTime = `${remainingHrs}h ${remainingMins}m`;

  const timeString = now.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const dateString = now.toLocaleDateString('es-CL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  });

  return {
    timeString,
    dateString,
    shiftName,
    shiftHours,
    shiftProgressPercent,
    remainingShiftTime
  };
}

/**
 * Screen WakeLock hook to prevent control room screens and TVs from sleeping or dimming
 */
export function useScreenWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<any>(null);

  const requestLock = useCallback(async () => {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch (err) {
        // Non-blocking (e.g. system battery saver policy)
      }
    }
  }, []);

  const releaseLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (e) {
        // Ignore
      }
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      requestLock();

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && enabled) {
          requestLock();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        releaseLock();
      };
    } else {
      releaseLock();
    }
  }, [enabled, requestLock, releaseLock]);
}

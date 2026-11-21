import React, { useState } from 'react';
import { Download, RefreshCw, Share, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 rounded-md bg-[#461D77] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#36155E] transition-colors duration-150 ease-out whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#461D77] focus-visible:ring-offset-1"
        title="Instalar Despacho-Litio como aplicación"
      >
        <Download size={13} />
        <span className="hidden sm:inline">Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-md border border-[#E2DFD7] bg-white px-3 py-1.5 text-xs font-semibold text-[#1C1917] hover:bg-[#EFECE6] transition-colors duration-150 ease-out whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#461D77]"
          title="Instalar en iPhone / iPad"
        >
          <Share size={13} className="text-[#461D77]" />
          <span className="hidden sm:inline">Instalar iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-950/60 p-4">
            <div className="w-full max-w-sm rounded-lg bg-white border border-[#E2DFD7] p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3">
                <h3 className="text-base font-bold text-[#1C1917]">Instalar en iPhone / iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-md text-[#57534E] hover:text-[#1C1917] hover:bg-[#EFECE6] transition-colors cursor-pointer"
                  aria-label="Cerrar guía"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-sm text-[#57534E] leading-relaxed">
                1. Toca el botón <strong className="text-[#1C1917]">Compartir</strong> en la barra inferior de Safari.<br />
                2. Selecciona <strong className="text-[#1C1917]">Agregar a inicio</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-md bg-[#461D77] py-2.5 text-xs font-semibold text-white hover:bg-[#36155E] transition-colors duration-150 cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const { isOnline, outboxCount, isSyncing, triggerSync } = useOnlineStatus();

  if (isOnline && outboxCount === 0) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-md px-3.5 py-2 text-xs font-medium shadow-md border ${
        !isOnline
          ? 'bg-amber-700 text-white border-amber-800'
          : 'bg-[#1C1917] text-white border-stone-700'
      }`}
      role="status"
      aria-live="polite"
    >
      {!isOnline ? (
        <>
          <WifiOff size={14} className="shrink-0" />
          <span className="font-mono tabular-nums">
            Sin conexión · Caché local activo
            {outboxCount > 0 ? ` (${outboxCount} pendientes)` : ''}
          </span>
        </>
      ) : (
        <>
          <RefreshCw size={14} className={`shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="font-mono tabular-nums">
            {isSyncing
              ? `Sincronizando ${outboxCount}...`
              : `${outboxCount} pendientes de envío`}
          </span>
          {!isSyncing && (
            <button
              type="button"
              onClick={() => triggerSync()}
              className="ml-1 rounded-md bg-white/15 hover:bg-white/25 px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              Sincronizar
            </button>
          )}
        </>
      )}
    </div>
  );
};

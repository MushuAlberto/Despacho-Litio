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
        className="flex items-center gap-1.5 rounded-lg bg-[#461D77] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#35145b] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="Instalar Despacho-Litio como aplicación"
      >
        <Download size={13} />
        <span className="hidden sm:inline">Instalar PWA</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Instalar en iPhone / iPad"
        >
          <Share size={13} className="text-[#461D77]" />
          <span className="hidden sm:inline">Instalar iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Instalar en iPhone / iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Cerrar guía"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                1. Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.<br />
                2. Desliza hacia abajo y selecciona <strong>Agregar a inicio</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-[#461D77] py-2.5 text-xs font-bold text-white hover:bg-[#35145b] transition-colors cursor-pointer"
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
      className={`fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-lg border ${
        !isOnline
          ? 'bg-amber-600 text-white border-amber-500'
          : 'bg-slate-900 text-white border-slate-700'
      }`}
      role="status"
      aria-live="polite"
    >
      {!isOnline ? (
        <>
          <WifiOff size={14} className="shrink-0" />
          <span>
            Modo Sin Conexión — Caché IndexedDB activo
            {outboxCount > 0 ? ` · ${outboxCount} pendiente${outboxCount > 1 ? 's' : ''}` : ''}
          </span>
        </>
      ) : (
        <>
          <RefreshCw size={14} className={`shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="tabular-nums">
            {isSyncing
              ? `Sincronizando ${outboxCount} registro(s)...`
              : `${outboxCount} registro(s) pendientes de envío`}
          </span>
          {!isSyncing && (
            <button
              type="button"
              onClick={() => triggerSync()}
              className="ml-1 rounded-md bg-white/15 hover:bg-white/25 px-2 py-0.5 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              Sincronizar
            </button>
          )}
        </>
      )}
    </div>
  );
};

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number; // in ms
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', title?: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, message, type, title, duration };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const success = useCallback((message: string, title?: string, duration?: number) => {
    toast(message, 'success', title || 'Éxito', duration);
  }, [toast]);

  const error = useCallback((message: string, title?: string, duration?: number) => {
    toast(message, 'error', title || 'Error', duration);
  }, [toast]);

  const warning = useCallback((message: string, title?: string, duration?: number) => {
    toast(message, 'warning', title || 'Advertencia', duration);
  }, [toast]);

  const info = useCallback((message: string, title?: string, duration?: number) => {
    toast(message, 'info', title || 'Información', duration);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
};

interface ToastCardProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onDismiss }) => {
  const { id, title, message, type, duration = 4000 } = toast;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remainingPct);
      if (elapsed >= duration) {
        clearInterval(interval);
        onDismiss(id);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [id, duration, onDismiss]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-[#15803D]" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-[#B91C1C]" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-[#B45309]" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-[#461D77]" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-[#15803D]/30';
      case 'error':
        return 'border-[#B91C1C]/30';
      case 'warning':
        return 'border-[#B45309]/30';
      case 'info':
      default:
        return 'border-[#E2DFD7]';
    }
  };

  const getProgressColor = () => {
    switch (type) {
      case 'success':
        return 'bg-[#15803D]';
      case 'error':
        return 'bg-[#B91C1C]';
      case 'warning':
        return 'bg-[#B45309]';
      case 'info':
      default:
        return 'bg-[#461D77]';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      className={`pointer-events-auto relative overflow-hidden p-4 rounded-lg border bg-[#FFFFFF] shadow-sm flex items-start gap-3 w-full ${getBorderColor()}`}
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
      
      <div className="flex-grow min-w-0 pr-4">
        {title && <h5 className="text-[#1C1917] text-xs font-bold uppercase tracking-wider mb-0.5">{title}</h5>}
        <p className="text-[#57534E] text-xs font-medium leading-relaxed break-words">{message}</p>
      </div>

      <button
        onClick={() => onDismiss(id)}
        className="flex-shrink-0 p-1 text-[#78716C] hover:text-[#1C1917] rounded-md hover:bg-[#EFECE6] transition-colors duration-150 ease-out cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Countdown progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#EFECE6]">
        <div
          className={`h-full transition-all duration-[16ms] linear ${getProgressColor()}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
};

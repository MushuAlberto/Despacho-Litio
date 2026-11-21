import React, { useState, useRef, useEffect } from 'react';
import { Mail, Loader2 } from 'lucide-react';

interface OutlookSendButtonProps {
  onClick: () => void;
  autoreset?: number;
  disabled?: boolean;
  className?: string;
}

export const OutlookSendButton: React.FC<OutlookSendButtonProps> = ({
  onClick,
  autoreset = 1800,
  disabled = false,
  className = '',
}) => {
  const [isOpening, setIsOpening] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = () => {
    if (disabled || isOpening) return;
    setIsOpening(true);
    onClick();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsOpening(false);
    }, Math.min(autoreset, 600));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`w-full bg-white border border-[#461D77] text-[#461D77] py-2.5 px-4 rounded-md text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer hover:bg-[#F3EEF8] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title="Compartir informe vía correo Outlook"
    >
      {isOpening ? (
        <Loader2 size={14} className="animate-spin text-[#461D77]" />
      ) : (
        <Mail size={14} className="text-[#461D77]" />
      )}
      <span>{isOpening ? 'Abriendo Outlook...' : 'Compartir por Outlook'}</span>
    </button>
  );
};

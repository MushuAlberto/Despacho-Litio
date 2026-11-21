
import React, { useState } from 'react';
import { Lock, X, KeyRound, AlertCircle } from 'lucide-react';

interface PasswordPromptProps {
  onSuccess: () => void;
  onCancel: () => void;
  correctPassword: string;
  moduleName: string;
}

export const PasswordPrompt: React.FC<PasswordPromptProps> = ({ 
  onSuccess, 
  onCancel, 
  correctPassword,
  moduleName 
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim().toUpperCase() === correctPassword.trim().toUpperCase() || password === correctPassword) {
      onSuccess();
    } else {
      setError(true);
      setPassword('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-[#1C1917]/60 flex items-center justify-center p-6">
      <div className={`
        bg-[#FFFFFF] w-full max-w-md rounded-lg p-8 shadow-sm border transition-colors duration-150 ease-out
        ${error ? 'border-[#B91C1C]' : 'border-[#E2DFD7]'}
      `}>
        <div className="flex justify-between items-start mb-6 pb-4 border-b border-[#E2DFD7]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[#F3EEF8] border border-[#E2DFD7] rounded-md flex items-center justify-center text-[#461D77] shrink-0">
              <Lock size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1C1917] tracking-[-0.02em]">Acceso Restringido</h2>
              <p className="text-xs font-mono text-[#78716C] mt-0.5">
                Módulo: {moduleName}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-md border border-[#E2DFD7] bg-[#F7F6F2] flex items-center justify-center text-[#57534E] hover:text-[#1C1917] hover:bg-[#EFECE6] transition-colors duration-150 ease-out cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-[#57534E] uppercase tracking-wider">
              Contraseña Requerida
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3.5 flex items-center text-[#78716C]">
                <KeyRound size={16} />
              </div>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`
                  w-full bg-[#F7F6F2] border rounded-md py-3 pl-10 pr-4 text-sm font-mono font-medium text-[#1C1917] outline-none transition-colors duration-150 ease-out
                  ${error ? 'border-[#B91C1C] bg-[#FFFFFF]' : 'border-[#E2DFD7] focus:border-[#461D77] focus:bg-[#FFFFFF]'}
                `}
              />
            </div>
            {error && (
              <div className="flex items-center gap-1.5 text-[#B91C1C] font-medium text-xs mt-1.5">
                <AlertCircle size={14} /> Contraseña incorrecta
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-[#461D77] hover:bg-[#36155E] text-white py-3 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors duration-150 ease-out cursor-pointer"
          >
            Verificar Acceso
          </button>
        </form>

        <p className="text-center mt-6 pt-4 border-t border-[#E2DFD7] text-[10px] font-mono text-[#78716C] uppercase tracking-wider">
          Control de Acceso · Novandino Litio
        </p>
      </div>
    </div>
  );
};

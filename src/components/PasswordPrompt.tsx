
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
    <div className="fixed inset-0 z-[10000] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
      <div className={`
        bg-white/95 backdrop-blur-xl w-full max-w-md rounded-3xl p-8 shadow-2xl border transition-all duration-150 ease-out
        ${error ? 'border-rose-500' : 'border-white'}
      `}>
        <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 bg-[#461D77]/10 border border-[#461D77]/15 rounded-2xl flex items-center justify-center text-[#461D77] shrink-0">
              <Lock size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Acceso Restringido</h2>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                Módulo: {moduleName}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-150 ease-out cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Contraseña Requerida
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                <KeyRound size={16} />
              </div>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`
                  w-full bg-slate-50 border rounded-xl py-3 pl-10 pr-4 text-sm font-mono font-medium text-slate-800 outline-none transition-colors duration-150 ease-out
                  ${error ? 'border-rose-500 bg-white' : 'border-slate-200 focus:border-[#461D77] focus:bg-white'}
                `}
              />
            </div>
            {error && (
              <div className="flex items-center gap-1.5 text-rose-600 font-semibold text-xs mt-1.5">
                <AlertCircle size={14} /> Contraseña incorrecta
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-[#461D77] to-[#7177EC] hover:opacity-95 text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 ease-out cursor-pointer shadow-md"
          >
            Verificar Acceso
          </button>
        </form>

        <p className="text-center mt-6 pt-4 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Control de Acceso · Novandino Litio
        </p>
      </div>
    </div>
  );
};

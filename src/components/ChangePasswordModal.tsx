import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  AlertCircle,
  X,
  Shield,
  Check,
  Sparkles
} from 'lucide-react';
import { SystemUser, updateUserPassword } from '../services/firebase';
import { setCurrentUserGlobal } from '../auth/authStore';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SystemUser;
  onPasswordChanged?: (updatedUser: SystemUser) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onPasswordChanged
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  // Reset form when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg('');
      setSuccess(false);
      setIsSubmitting(false);
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  // Compute password strength
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: 'Vacía', color: 'bg-slate-200', text: 'text-slate-400' };
    let score = 0;
    if (pwd.length >= 4) score += 1;
    if (pwd.length >= 7) score += 1;
    if (/[0-9]/.test(pwd) && /[a-zA-Z]/.test(pwd)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pwd) || /[A-Z]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Básica', color: 'bg-amber-400', text: 'text-amber-600' };
    if (score === 2) return { score: 2, label: 'Media', color: 'bg-blue-500', text: 'text-blue-600' };
    if (score === 3) return { score: 3, label: 'Segura', color: 'bg-teal-500', text: 'text-teal-600' };
    return { score: 4, label: 'Muy Fuerte', color: 'bg-emerald-500', text: 'text-emerald-600' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const currentClean = currentPassword.trim();
    const newClean = newPassword.trim();
    const confirmClean = confirmPassword.trim();

    // Verification 1: Current password check
    if (currentUser.password && currentUser.password.trim() !== '') {
      if (!currentClean) {
        setErrorMsg('Por favor ingresa tu contraseña actual para confirmar tu identidad.');
        return;
      }
      if (currentClean !== currentUser.password) {
        setErrorMsg('La contraseña actual ingresada es incorrecta.');
        return;
      }
    }

    // Verification 2: New password validations
    if (!newClean) {
      setErrorMsg('Debes ingresar una nueva contraseña.');
      return;
    }

    if (newClean.length < 4) {
      setErrorMsg('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (currentUser.password && newClean === currentUser.password) {
      setErrorMsg('La nueva contraseña debe ser diferente a la contraseña actual.');
      return;
    }

    // Verification 3: Confirmation match
    if (newClean !== confirmClean) {
      setErrorMsg('Las contraseñas no coinciden. Verifica la confirmación.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedUser = await updateUserPassword(currentUser, newClean);
      setCurrentUserGlobal(updatedUser);
      if (onPasswordChanged) {
        onPasswordChanged(updatedUser);
      }
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error('Error changing password:', err);
      setErrorMsg(err?.message || 'Ocurrió un error al actualizar la contraseña. Intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleLabel =
    currentUser.role === 'admin'
      ? 'Administrador'
      : currentUser.role === 'jefe_turno'
      ? 'Jefe de Turno'
      : 'Supervisor';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden transform animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#461D77] via-[#5c279d] to-[#7177EC] px-6 py-5 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
                <KeyRound size={20} className="text-white" />
              </div>
              <div>
                <h2 id="change-password-title" className="text-base font-black tracking-tight leading-none text-white">
                  Cambiar Contraseña
                </h2>
                <p className="text-[11px] text-white/80 mt-1 font-medium">
                  Actualiza tu clave de acceso personal
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
              title="Cerrar ventana"
            >
              <X size={16} />
            </button>
          </div>

          {/* User Account Pill */}
          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-white text-[#461D77] font-black text-[10px] flex items-center justify-center">
                {(currentUser.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <span className="font-bold text-white text-xs">{currentUser.name}</span>
                <span className="text-white/70 text-[11px] ml-1.5 font-mono">
                  @{currentUser.username || currentUser.userId}
                </span>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Content Body */}
        {success ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm animate-bounce">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-black text-slate-800">
              ¡Contraseña Actualizada!
            </h3>
            <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
              Tu clave de acceso ha sido modificada con éxito. Ya puedes iniciar sesión con tu nueva contraseña.
            </p>
            <div className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <Sparkles size={13} />
              Cambio registrado y sincronizado
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-150">
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div className="font-medium leading-relaxed">{errorMsg}</div>
              </div>
            )}

            {/* Current Password Field */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Contraseña Actual
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Ingresa tu contraseña actual"
                  required
                  autoFocus
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#461D77] focus:bg-white rounded-2xl px-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#461D77]/20 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showCurrentPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* New Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Nueva Contraseña
                </label>
                {newPassword && (
                  <span className={`text-[10px] font-bold ${strength.text}`}>
                    {strength.label}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Mínimo 4 caracteres (la que tú elijas)"
                  required
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#461D77] focus:bg-white rounded-2xl px-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#461D77]/20 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showNewPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {/* Password strength bar */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-1">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        strength.score >= 1 ? strength.color : 'bg-transparent'
                      }`}
                      style={{ width: `${Math.min(100, (strength.score / 4) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Recomendación: combina letras, números o símbolos para mayor seguridad.
                  </p>
                </div>
              )}
            </div>

            {/* Confirm New Password Field */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Confirmar Nueva Contraseña
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Repite la nueva contraseña"
                  required
                  disabled={isSubmitting}
                  className={`w-full bg-slate-50 border ${
                    confirmPassword && confirmPassword !== newPassword
                      ? 'border-amber-400 focus:border-amber-500'
                      : confirmPassword && confirmPassword === newPassword
                      ? 'border-emerald-400 focus:border-emerald-500'
                      : 'border-slate-200 focus:border-[#461D77]'
                  } focus:bg-white rounded-2xl px-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#461D77]/20 transition-all pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {confirmPassword && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                  {confirmPassword === newPassword ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <Check size={12} /> Las contraseñas coinciden
                    </span>
                  ) : (
                    <span className="text-amber-600 font-semibold flex items-center gap-1">
                      <AlertCircle size={12} /> Aún no coinciden
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !newPassword || !confirmPassword}
                className="px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-[#461D77] to-[#7177EC] hover:from-[#3b1765] hover:to-[#5e63d3] text-white shadow-md shadow-[#461D77]/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Lock size={13} />
                    <span>Guardar Contraseña</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

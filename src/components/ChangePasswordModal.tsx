import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  AlertCircle,
  X,
  Check
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
    if (!pwd) return { score: 0, label: 'Vacía', color: 'bg-[#E2DFD7]', text: 'text-[#78716C]' };
    let score = 0;
    if (pwd.length >= 4) score += 1;
    if (pwd.length >= 7) score += 1;
    if (/[0-9]/.test(pwd) && /[a-zA-Z]/.test(pwd)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pwd) || /[A-Z]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Básica', color: 'bg-[#B45309]', text: 'text-[#B45309]' };
    if (score === 2) return { score: 2, label: 'Media', color: 'bg-[#57534E]', text: 'text-[#57534E]' };
    if (score === 3) return { score: 3, label: 'Segura', color: 'bg-[#461D77]', text: 'text-[#461D77]' };
    return { score: 4, label: 'Muy Fuerte', color: 'bg-[#15803D]', text: 'text-[#15803D]' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const currentClean = currentPassword.trim();
    const newClean = newPassword.trim();
    const confirmClean = confirmPassword.trim();

    // Verification 1: Current password check
    const expectedCurrent = currentUser.password || currentUser.userId || '';
    if (expectedCurrent && expectedCurrent.trim() !== '') {
      if (!currentClean) {
        setErrorMsg('Por favor ingresa tu contraseña actual para confirmar tu identidad.');
        return;
      }
      const matchesCurrent = 
        currentClean === expectedCurrent ||
        currentClean.toLowerCase() === expectedCurrent.toLowerCase() ||
        currentClean.toLowerCase() === currentUser.userId.toLowerCase();

      if (!matchesCurrent) {
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-[#1C1917]/60">
      <div
        className="w-full max-w-md bg-[#FFFFFF] rounded-lg shadow-sm border border-[#E2DFD7] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        {/* Header Bar */}
        <div className="bg-[#F7F6F2] px-6 py-4 border-b border-[#E2DFD7]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-[#F3EEF8] border border-[#E2DFD7] flex items-center justify-center text-[#461D77]">
                <KeyRound size={17} />
              </div>
              <div>
                <h2 id="change-password-title" className="text-sm font-bold tracking-tight text-[#1C1917]">
                  Cambiar Contraseña
                </h2>
                <p className="text-[11px] text-[#78716C] mt-0.5">
                  Actualiza tu clave de acceso personal
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-8 h-8 rounded-md border border-[#E2DFD7] bg-[#FFFFFF] hover:bg-[#EFECE6] text-[#78716C] hover:text-[#1C1917] flex items-center justify-center transition-colors duration-150 ease-out cursor-pointer disabled:opacity-40"
              title="Cerrar ventana"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-[#E2DFD7] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-[#461D77] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                {(currentUser.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <span className="font-semibold text-[#1C1917] text-xs">{currentUser.name}</span>
                <span className="text-[#78716C] text-[11px] ml-1.5 font-mono">
                  @{currentUser.username || currentUser.userId}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase font-semibold tracking-wider px-2 py-0.5 rounded-md border border-[#E2DFD7] bg-[#FFFFFF] text-[#57534E] shrink-0">
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Content Body */}
        {success ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-lg bg-[#F0FDF4] border border-[#15803D]/20 text-[#15803D] flex items-center justify-center mb-4">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-base font-bold text-[#1C1917]">
              Contraseña Actualizada
            </h3>
            <p className="text-xs text-[#57534E] mt-1.5 max-w-xs leading-relaxed">
              Tu clave de acceso ha sido modificada y sincronizada. Ya puedes iniciar sesión con tu nueva contraseña.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-[#FEF2F2] border border-[#B91C1C]/30 rounded-md flex items-start gap-2.5 text-xs text-[#B91C1C]">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div className="font-medium leading-relaxed">{errorMsg}</div>
              </div>
            )}

            {/* Current Password Field */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">
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
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Ingresa tu contraseña actual"
                  required
                  autoFocus
                  disabled={isSubmitting}
                  className="w-full bg-[#F7F6F2] border border-[#E2DFD7] focus:border-[#461D77] focus:bg-[#FFFFFF] rounded-md px-3.5 py-2.5 text-xs font-mono text-[#1C1917] placeholder:text-[#78716C] focus:outline-none transition-colors duration-150 ease-out pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                  title={showCurrentPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* New Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
                  Nueva Contraseña
                </label>
                {newPassword && (
                  <span className={`text-[10px] font-mono font-semibold ${strength.text}`}>
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
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Mínimo 4 caracteres"
                  required
                  disabled={isSubmitting}
                  className="w-full bg-[#F7F6F2] border border-[#E2DFD7] focus:border-[#461D77] focus:bg-[#FFFFFF] rounded-md px-3.5 py-2.5 text-xs font-mono text-[#1C1917] placeholder:text-[#78716C] focus:outline-none transition-colors duration-150 ease-out pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                  title={showNewPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="w-full h-1 bg-[#EFECE6] rounded-sm overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${strength.score >= 1 ? strength.color : 'bg-transparent'}`}
                      style={{ width: `${Math.min(100, (strength.score / 4) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#78716C]">
                    Combina letras, números o símbolos para mayor seguridad.
                  </p>
                </div>
              )}
            </div>

            {/* Confirm New Password Field */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">
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
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Repite la nueva contraseña"
                  required
                  disabled={isSubmitting}
                  className={`w-full bg-[#F7F6F2] border ${
                    confirmPassword && confirmPassword !== newPassword
                      ? 'border-[#B45309] focus:border-[#B45309]'
                      : confirmPassword && confirmPassword === newPassword
                      ? 'border-[#15803D] focus:border-[#15803D]'
                      : 'border-[#E2DFD7] focus:border-[#461D77]'
                  } focus:bg-[#FFFFFF] rounded-md px-3.5 py-2.5 text-xs font-mono text-[#1C1917] placeholder:text-[#78716C] focus:outline-none transition-colors duration-150 ease-out pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                  title={showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {confirmPassword && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                  {confirmPassword === newPassword ? (
                    <span className="text-[#15803D] font-medium flex items-center gap-1">
                      <Check size={12} /> Las contraseñas coinciden
                    </span>
                  ) : (
                    <span className="text-[#B45309] font-medium flex items-center gap-1">
                      <AlertCircle size={12} /> Aún no coinciden
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-[#E2DFD7] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-md text-xs font-semibold text-[#57534E] hover:text-[#1C1917] hover:bg-[#EFECE6] border border-[#E2DFD7] transition-colors duration-150 ease-out cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !newPassword || !confirmPassword}
                className="px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wider bg-[#461D77] hover:bg-[#36155E] text-white transition-colors duration-150 ease-out cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
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

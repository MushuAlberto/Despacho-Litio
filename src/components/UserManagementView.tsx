import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db, logActivity, SystemUser, isFirestoreWriteBlocked } from '../services/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { Lock, Plus, Trash2, ArrowLeft, Loader2, CheckCircle, ShieldAlert, X, Cpu, Save } from 'lucide-react';
import { authenticatedFetch } from '../auth/authenticatedFetch';

interface UserManagementViewProps {
  currentUser: SystemUser;
  onBack: () => void;
  onUpdateCurrentUser?: (user: SystemUser) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser, onBack, onUpdateCurrentUser }) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    name: '',
    role: 'supervision' as 'admin' | 'jefe_turno' | 'supervision'
  });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);

  const [deleteCandidate, setDeleteCandidate] = useState<SystemUser | null>(null);
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // AI Configuration States
  const [aiSettings, setAiSettings] = useState({
    activeAi: 'gemini' as 'gemini' | 'glm',
    enableGemini: true,
    enableGlm: true,
    enableShiftAnalysis: true,
    enableJustificationRefinement: true
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // States for pending user AI configuration changes
  const [pendingUserAiChanges, setPendingUserAiChanges] = useState<Record<string, boolean>>({});
  const [savingUserAi, setSavingUserAi] = useState(false);

  // AI Diagnostic States
  const [testingAi, setTestingAi] = useState<'gemini' | 'glm' | null>(null);
  const [testResult, setTestResult] = useState<{
    model: 'gemini' | 'glm';
    success: boolean;
    message: string;
    latencyMs?: number;
    modelUsed?: string;
  } | null>(null);

  const handleTestAiConnection = async (model: 'gemini' | 'glm') => {
    setTestingAi(model);
    setTestResult(null);
    try {
      const response = await authenticatedFetch("/api/test-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        const snippet = text.slice(0, 100).replace(/<[^>]*>/g, '').trim();
        throw new Error(`El servidor no respondió con JSON (Código HTTP ${response.status}). Detalle: "${snippet || 'Vacío'}"`);
      }

      const result = await response.json();
      setTestResult({
        model,
        success: response.ok && result.success === true,
        message: result.message || "Error inesperado durante la prueba.",
        latencyMs: result.latencyMs,
        modelUsed: result.modelUsed
      });
    } catch (err: any) {
      setTestResult({
        model,
        success: false,
        message: `Error de conexión: ${err.message || err}`
      });
    } finally {
      setTestingAi(null);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const qSnap = await getDocs(collection(db, 'users'));
      const list: SystemUser[] = [];
      qSnap.forEach((docSnap) => {
        list.push(docSnap.data() as SystemUser);
      });
      setUsers(list);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const docRef = doc(db, 'system_config', 'ai_settings');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAiSettings({
          activeAi: data.activeAi || 'gemini',
          enableGemini: data.enableGemini !== false,
          enableGlm: data.enableGlm !== false,
          enableShiftAnalysis: data.enableShiftAnalysis !== false,
          enableJustificationRefinement: data.enableJustificationRefinement !== false
        });
      } else {
        // Bootstrap default config if non-existent
        const defaultSettings = {
          activeAi: 'gemini' as const,
          enableGemini: true,
          enableGlm: true,
          enableShiftAnalysis: true,
          enableJustificationRefinement: true,
          lastUpdatedBy: 'system',
          lastUpdatedAt: new Date().toISOString()
        };
        if (!isFirestoreWriteBlocked()) {
          try {
            await setDoc(docRef, defaultSettings);
          } catch (e) {
            // Ignore if quota exceeded
          }
        }
        setAiSettings({
          activeAi: 'gemini',
          enableGemini: true,
          enableGlm: true,
          enableShiftAnalysis: true,
          enableJustificationRefinement: true
        });
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setStatusMsg({ type: '', text: '' });
    try {
      const docRef = doc(db, 'system_config', 'ai_settings');
      const payload = {
        activeAi: aiSettings.activeAi,
        enableGemini: aiSettings.enableGemini,
        enableGlm: aiSettings.enableGlm,
        enableShiftAnalysis: aiSettings.enableShiftAnalysis,
        enableJustificationRefinement: aiSettings.enableJustificationRefinement,
        lastUpdatedBy: currentUser.name,
        lastUpdatedAt: new Date().toISOString()
      };
      await setDoc(docRef, payload);

      await logActivity(
        currentUser,
        'Configuración IA Actualizada',
        `Se actualizó la configuración de IA. Motor activo: ${aiSettings.activeAi.toUpperCase()}. Habilitados: Gemini=${aiSettings.enableGemini ? 'SÍ' : 'NO'}, GLM=${aiSettings.enableGlm ? 'SÍ' : 'NO'}. CambioTurno=${aiSettings.enableShiftAnalysis ? 'SÍ' : 'NO'}, RefinarJustif=${aiSettings.enableJustificationRefinement ? 'SÍ' : 'NO'}`
      );

      setStatusMsg({ type: 'success', text: 'Configuración de Inteligencia Artificial guardada correctamente.' });
    } catch (error) {
      console.error('Error saving AI settings:', error);
      setStatusMsg({ type: 'error', text: 'Error de red o permisos al guardar la configuración de IA.' });
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSettings();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });

    // Validate inputs
    const usernameClean = newUser.username.trim().toLowerCase();
    const nameClean = newUser.name.trim();
    if (!usernameClean || !nameClean || !newUser.password) {
      setStatusMsg({ type: 'error', text: 'Todos los campos son obligatorios.' });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(usernameClean)) {
      setStatusMsg({ type: 'error', text: 'El nombre de usuario solo debe contener letras, números o subguión [_].' });
      return;
    }

    // Check if user already exists
    if (users.some(u => u.username === usernameClean)) {
      setStatusMsg({ type: 'error', text: 'El nombre de usuario ya está registrado en el sistema.' });
      return;
    }

    setSaving(true);
    const userId = usernameClean;
    const userDocPayload: SystemUser = {
      userId,
      username: usernameClean,
      password: newUser.password,
      name: nameClean,
      role: newUser.role,
      lastLogin: '',
      enableAi: true
    };

    try {
      await setDoc(doc(db, 'users', userId), userDocPayload);
      
      // Log activity
      await logActivity(
        currentUser,
        'Usuario Creado',
        `Se creó el perfil de: ${nameClean} (Usuario: @${usernameClean}) con rol: ${newUser.role}`
      );

      setStatusMsg({ type: 'success', text: `Usuario @${usernameClean} creado exitosamente.` });
      setNewUser({ username: '', password: '', name: '', role: 'supervision' });
      await fetchUsers();
    } catch (error) {
      console.error('Error creating user profile:', error);
      setStatusMsg({ type: 'error', text: 'Error de red o permisos al almacenar el usuario.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = (userToDelete: SystemUser) => {
    if (userToDelete.userId === currentUser.userId) {
      alert('No puedes eliminar tu propio usuario en sesión.');
      return;
    }

    if (userToDelete.userId === 'admin') {
      alert('No se permite eliminar la cuenta de administración principal.');
      return;
    }

    setDeleteCandidate(userToDelete);
    setAdminPasswordConfirm('');
    setPasswordError(false);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteCandidate) return;

    // A fail-safe allows using the logged in user's password, 'ctapia', or master 'MIRAME'
    const correctPasswords = [
      currentUser.password,
      'ctapia',
      'MIRAME'
    ].filter(Boolean);

    if (!correctPasswords.includes(adminPasswordConfirm)) {
      setPasswordError(true);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', deleteCandidate.userId));
      
      // Log activity
      await logActivity(
        currentUser,
        'Usuario Eliminado',
        `Se eliminó la cuenta de: ${deleteCandidate.name} (Usuario: @${deleteCandidate.username}) - [Contraseña Confirmada]`
      );

      setStatusMsg({ type: 'success', text: `Usuario @${deleteCandidate.username} eliminado correctamente.` });
      setDeleteCandidate(null);
      await fetchUsers();
    } catch (e) {
      console.error('Error deleting user:', e);
      setStatusMsg({ type: 'error', text: 'Fallo al eliminar el registro en Firestore.' });
      setDeleteCandidate(null);
    }
  };

  const handleToggleUserAi = (targetUser: SystemUser) => {
    const isAiCurrentlyEnabled = targetUser.enableAi !== false;
    const newVal = !isAiCurrentlyEnabled;

    // Update locally in users array to slide toggle immediately
    setUsers(prev => prev.map(u => u.userId === targetUser.userId ? { ...u, enableAi: newVal } : u));

    // Store in pending changes
    setPendingUserAiChanges(prev => ({
      ...prev,
      [targetUser.userId]: newVal
    }));
  };

  const handleSaveUserAiChanges = async () => {
    setSavingUserAi(true);
    setStatusMsg({ type: '', text: '' });
    try {
      let loggedSelfUpdate = false;
      let selfUpdatedUser: SystemUser | null = null;
      const entries = Object.entries(pendingUserAiChanges);

      for (const [userId, enableAi] of entries) {
        const targetUser = users.find(u => u.userId === userId);
        if (targetUser) {
          const updatedUser = {
            ...targetUser,
            enableAi
          };
          await setDoc(doc(db, 'users', userId), updatedUser);
          
          if (userId === currentUser.userId) {
            loggedSelfUpdate = true;
            selfUpdatedUser = updatedUser;
          }

          await logActivity(
            currentUser,
            'Permisos IA Actualizados',
            `Se ${enableAi ? 'habilitó' : 'deshabilitó'} el uso de Inteligencia Artificial para el usuario ${targetUser.name} (@${targetUser.username})`
          );
        }
      }

      if (loggedSelfUpdate && selfUpdatedUser && onUpdateCurrentUser) {
        onUpdateCurrentUser(selfUpdatedUser);
      }

      setStatusMsg({ type: 'success', text: `Se guardaron con éxito los accesos de IA para ${entries.length} usuario(s) en Firestore.` });
      setPendingUserAiChanges({});
    } catch (error) {
      console.error('Error saving user AI changes:', error);
      setStatusMsg({ type: 'error', text: 'Error de red o permisos al guardar los accesos de IA en Firestore.' });
    } finally {
      setSavingUserAi(false);
    }
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return 'Administrador';
    if (role === 'jefe_turno') return 'Jefe Turno';
    return 'Supervisor';
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] p-6 md:p-10 z-10 relative flex flex-col justify-between text-[#1C1917]">
      <div className="max-w-6xl mx-auto w-full space-y-6 flex-grow">
        {/* HEADER */}
        <header className="flex items-center justify-between gap-4 bg-[#FFFFFF] rounded-lg border border-[#E2DFD7] px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 bg-[#F7F6F2] border border-[#E2DFD7] rounded-md hover:bg-[#EFECE6] text-[#57534E] hover:text-[#1C1917] transition-colors duration-150 ease-out cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <p className="text-[11px] font-mono font-semibold tracking-wider text-[#461D77] uppercase">
                Administración de Accesos
              </p>
              <h1 className="text-xl font-bold text-[#1C1917] tracking-[-0.02em]">Gestión de Usuarios</h1>
            </div>
          </div>
          <span className="hidden sm:inline-block font-mono text-xs text-[#78716C] tabular-nums">
            {users.length} cuentas
          </span>
        </header>

        {statusMsg.text && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className={`rounded-lg px-4 py-3 flex items-center gap-3 border text-xs font-medium ${
              statusMsg.type === 'success'
                ? 'bg-[#F0FDF4] border-[#15803D]/30 text-[#15803D]'
                : 'bg-[#FEF2F2] border-[#B91C1C]/30 text-[#B91C1C]'
            }`}
          >
            {statusMsg.type === 'success' ? <CheckCircle size={16} /> : <ShieldAlert size={16} />}
            <span>{statusMsg.text}</span>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
          {/* LEFT COLUMN: CREATE USER & AI CONFIGURATION */}
          <div className="lg:col-span-5 space-y-6">
            {/* CREATE PROFILE FORM */}
            <div className="bg-[#FFFFFF] border border-[#E2DFD7] rounded-lg p-6 space-y-5">
              <div className="pb-4 border-b border-[#E2DFD7]">
                <span className="text-[10px] font-mono font-semibold tracking-wider text-[#78716C] uppercase">Nuevo perfil</span>
                <h2 className="text-base font-bold text-[#1C1917] tracking-tight mt-0.5">Crear Usuario</h2>
                <p className="text-xs text-[#57534E] mt-0.5">Asigna clave de acceso y nivel de rol operativo.</p>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold tracking-wider text-[#57534E] uppercase block">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Ej. Juan Pérez"
                    className="w-full px-3.5 py-2.5 bg-[#F7F6F2] border border-[#E2DFD7] focus:border-[#461D77] focus:bg-[#FFFFFF] rounded-md text-xs font-medium text-[#1C1917] outline-none transition-colors duration-150 ease-out placeholder:text-[#78716C]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold tracking-wider text-[#57534E] uppercase block">
                    Nombre de Usuario (Login)
                  </label>
                  <input
                    type="text"
                    required
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Ej. jperez"
                    className="w-full px-3.5 py-2.5 bg-[#F7F6F2] border border-[#E2DFD7] focus:border-[#461D77] focus:bg-[#FFFFFF] rounded-md text-xs font-mono font-medium text-[#1C1917] outline-none transition-colors duration-150 ease-out placeholder:text-[#78716C]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold tracking-wider text-[#57534E] uppercase block">
                    Contraseña de acceso
                  </label>
                  <input
                    type="password"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Establecer contraseña"
                    className="w-full px-3.5 py-2.5 bg-[#F7F6F2] border border-[#E2DFD7] focus:border-[#461D77] focus:bg-[#FFFFFF] rounded-md text-xs font-mono font-medium text-[#1C1917] outline-none transition-colors duration-150 ease-out placeholder:text-[#78716C]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold tracking-wider text-[#57534E] uppercase block">
                    Rol y Permisos
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-[#F7F6F2] border border-[#E2DFD7] focus:border-[#461D77] focus:bg-[#FFFFFF] rounded-md text-xs font-medium text-[#1C1917] outline-none transition-colors duration-150 ease-out cursor-pointer"
                  >
                    <option value="supervision">Supervisor (Solo Módulo SdA)</option>
                    <option value="jefe_turno">Jefe Turno (Módulos de Jefe Turno y SdA)</option>
                    <option value="admin">Administrador (Acceso y Gestión Total)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-[#461D77] hover:bg-[#36155E] disabled:opacity-50 text-white font-semibold text-xs tracking-wider py-2.5 rounded-md flex items-center justify-center gap-2 transition-colors duration-150 ease-out uppercase cursor-pointer mt-2"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin text-white" />
                  ) : (
                    <>
                      <Plus size={14} /> Registrar Usuario
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* CONFIGURACIÓN IA (SOLO ADMIN) */}
            {currentUser.role === 'admin' && (
              <div className="bg-[#FFFFFF] border border-[#E2DFD7] rounded-lg p-6 space-y-5">
                <div className="pb-4 border-b border-[#E2DFD7]">
                  <span className="text-[10px] font-mono font-semibold tracking-wider text-[#461D77] uppercase">
                    Motores de Análisis
                  </span>
                  <h2 className="text-base font-bold text-[#1C1917] tracking-tight mt-0.5 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#461D77]" /> Configuración de IA
                  </h2>
                  <p className="text-xs text-[#57534E] mt-0.5">
                    Define los motores activos y el comportamiento por defecto.
                  </p>
                </div>

                {loadingSettings ? (
                  <div className="py-8 flex flex-col items-center justify-center text-[#78716C]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#461D77] mb-2" />
                    <p className="font-mono text-[10px] uppercase tracking-wider">Cargando parámetros...</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Disponibilidad de motores */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold tracking-wider text-[#57534E] uppercase block">
                        Habilitar Motores
                      </label>
                      <div className="grid grid-cols-2 border border-[#E2DFD7] rounded-md divide-x divide-[#E2DFD7] overflow-hidden">
                        {/* Gemini Switch */}
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !aiSettings.enableGemini;
                            if (!nextVal && !aiSettings.enableGlm) return;
                            setAiSettings({
                              ...aiSettings,
                              enableGemini: nextVal,
                              activeAi: !nextVal && aiSettings.activeAi === 'gemini' ? 'glm' : aiSettings.activeAi
                            });
                          }}
                          className={`p-3.5 transition-colors duration-150 text-left flex flex-col justify-between h-20 cursor-pointer ${
                            aiSettings.enableGemini
                              ? 'bg-[#F3EEF8]/60'
                              : 'bg-[#F7F6F2] opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-semibold text-xs text-[#1C1917]">Gemini 3.5</span>
                            <div className={`w-8 h-4 rounded-full transition-colors relative p-0.5 ${aiSettings.enableGemini ? 'bg-[#461D77]' : 'bg-[#D6D3CD]'}`}>
                              <div className={`w-3 h-3 bg-white rounded-full transition-transform ${aiSettings.enableGemini ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-[#78716C]">Google AI Flash</span>
                        </button>

                        {/* OpenRouter Gemma Switch */}
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !aiSettings.enableGlm;
                            if (!nextVal && !aiSettings.enableGemini) return;
                            setAiSettings({
                              ...aiSettings,
                              enableGlm: nextVal,
                              activeAi: !nextVal && aiSettings.activeAi === 'glm' ? 'gemini' : aiSettings.activeAi
                            });
                          }}
                          className={`p-3.5 transition-colors duration-150 text-left flex flex-col justify-between h-20 cursor-pointer ${
                            aiSettings.enableGlm
                              ? 'bg-[#F3EEF8]/60'
                              : 'bg-[#F7F6F2] opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-semibold text-xs text-[#1C1917]">Gemma Free</span>
                            <div className={`w-8 h-4 rounded-full transition-colors relative p-0.5 ${aiSettings.enableGlm ? 'bg-[#461D77]' : 'bg-[#D6D3CD]'}`}>
                              <div className={`w-3 h-3 bg-white rounded-full transition-transform ${aiSettings.enableGlm ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-[#78716C]">OpenRouter Free</span>
                        </button>
                      </div>
                    </div>

                    {/* Motor predeterminado */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold tracking-wider text-[#57534E] uppercase block">
                        Motor por Defecto
                      </label>
                      <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-md border border-[#E2DFD7]">
                        <button
                          type="button"
                          disabled={!aiSettings.enableGemini}
                          onClick={() => setAiSettings({ ...aiSettings, activeAi: 'gemini' })}
                          className={`flex-1 py-2 rounded-md text-[11px] font-semibold tracking-wider transition-colors duration-150 uppercase cursor-pointer ${
                            aiSettings.activeAi === 'gemini'
                              ? 'bg-[#461D77] text-white'
                              : 'text-[#57534E] hover:text-[#1C1917] disabled:opacity-40 disabled:cursor-not-allowed'
                          }`}
                        >
                          Gemini 3.5
                        </button>
                        <button
                          type="button"
                          disabled={!aiSettings.enableGlm}
                          onClick={() => setAiSettings({ ...aiSettings, activeAi: 'glm' })}
                          className={`flex-1 py-2 rounded-md text-[11px] font-semibold tracking-wider transition-colors duration-150 uppercase cursor-pointer ${
                            aiSettings.activeAi === 'glm'
                              ? 'bg-[#1C1917] text-white'
                              : 'text-[#57534E] hover:text-[#1C1917] disabled:opacity-40 disabled:cursor-not-allowed'
                          }`}
                        >
                          Gemma
                        </button>
                      </div>
                    </div>

                    {/* Habilitar en Módulos específicos */}
                    <div className="space-y-2 pt-3 border-t border-[#E2DFD7]">
                      <label className="text-[11px] font-semibold tracking-wider text-[#57534E] uppercase block">
                        Módulos Habilitados
                      </label>
                      <div className="border border-[#E2DFD7] rounded-md divide-y divide-[#E2DFD7]">
                        <div className="flex items-center justify-between p-3 bg-[#FFFFFF]">
                          <div>
                            <p className="font-semibold text-xs text-[#1C1917]">Cambio de Turno</p>
                            <p className="text-[11px] text-[#78716C]">Resumen y análisis operativo</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAiSettings({
                              ...aiSettings,
                              enableShiftAnalysis: !aiSettings.enableShiftAnalysis
                            })}
                            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${aiSettings.enableShiftAnalysis ? 'bg-[#461D77]' : 'bg-[#D6D3CD]'}`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${aiSettings.enableShiftAnalysis ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-[#FFFFFF]">
                          <div>
                            <p className="font-semibold text-xs text-[#1C1917]">Informe Operativo</p>
                            <p className="text-[11px] text-[#78716C]">Reescritura de justificación de desempeño</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAiSettings({
                              ...aiSettings,
                              enableJustificationRefinement: !aiSettings.enableJustificationRefinement
                            })}
                            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${aiSettings.enableJustificationRefinement ? 'bg-[#461D77]' : 'bg-[#D6D3CD]'}`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${aiSettings.enableJustificationRefinement ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="w-full bg-[#461D77] hover:bg-[#36155E] disabled:opacity-50 text-white font-semibold text-xs tracking-wider py-2.5 rounded-md flex items-center justify-center gap-2 transition-colors duration-150 ease-out uppercase cursor-pointer"
                    >
                      {savingSettings ? (
                        <Loader2 size={14} className="animate-spin text-white" />
                      ) : (
                        <>
                          <Save size={14} /> Guardar Configuración
                        </>
                      )}
                    </button>

                    {/* Panel de Diagnóstico y Conectividad */}
                    <div className="space-y-2.5 pt-4 border-t border-[#E2DFD7]">
                      <label className="text-[11px] font-semibold tracking-wider text-[#57534E] uppercase block">
                        Diagnóstico de Conectividad
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={testingAi !== null}
                          onClick={() => handleTestAiConnection('gemini')}
                          className="flex-1 py-2 px-3 bg-[#F7F6F2] hover:bg-[#EFECE6] border border-[#E2DFD7] rounded-md text-[11px] font-semibold text-[#1C1917] transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 uppercase tracking-wider"
                        >
                          {testingAi === 'gemini' ? (
                            <>
                              <Loader2 size={12} className="animate-spin text-[#461D77]" />
                              Probando...
                            </>
                          ) : (
                            <>
                              <Cpu size={12} className="text-[#461D77]" />
                              Probar Gemini
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={testingAi !== null}
                          onClick={() => handleTestAiConnection('glm')}
                          className="flex-1 py-2 px-3 bg-[#F7F6F2] hover:bg-[#EFECE6] border border-[#E2DFD7] rounded-md text-[11px] font-semibold text-[#1C1917] transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 uppercase tracking-wider"
                        >
                          {testingAi === 'glm' ? (
                            <>
                              <Loader2 size={12} className="animate-spin text-[#57534E]" />
                              Probando...
                            </>
                          ) : (
                            <>
                              <Cpu size={12} className="text-[#57534E]" />
                              Probar Gemma
                            </>
                          )}
                        </button>
                      </div>

                      {testResult && (
                        <div
                          className={`p-3 rounded-md border text-xs leading-relaxed flex flex-col gap-1 ${
                            testResult.success
                              ? 'bg-[#F0FDF4] border-[#15803D]/30 text-[#15803D]'
                              : 'bg-[#FEF2F2] border-[#B91C1C]/30 text-[#B91C1C]'
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold uppercase tracking-wider text-[10px]">
                            <span className="flex items-center gap-1.5">
                              {testResult.success ? <CheckCircle size={12} /> : <ShieldAlert size={12} />}
                              {testResult.model === 'gemini' ? 'Google Gemini' : 'Google Gemma'}
                            </span>
                            {testResult.success && testResult.latencyMs !== undefined && (
                              <span className="font-mono tabular-nums text-[10px]">
                                {testResult.latencyMs} ms
                              </span>
                            )}
                          </div>
                          <p className="text-[11px]">{testResult.message}</p>
                          {testResult.success && testResult.modelUsed && (
                            <div className="font-mono text-[10px] opacity-80 pt-1 border-t border-current/15 flex justify-between">
                              <span>Motor:</span>
                              <span>{testResult.modelUsed}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ACTIVE DIRECTORY LIST */}
          <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E2DFD7] rounded-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-[#E2DFD7]">
              <h2 className="text-base font-bold text-[#1C1917] tracking-tight">Directorio Activo</h2>
              <p className="text-xs text-[#57534E] mt-0.5">Usuarios autorizados en la base de datos Firestore.</p>
            </div>

            {Object.keys(pendingUserAiChanges).length > 0 && (
              <div className="bg-[#FFFBEB] border-b border-[#B45309]/25 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
                <div className="text-[#B45309]">
                  <p className="text-xs font-semibold uppercase tracking-wider">Permisos de IA Modificados</p>
                  <p className="text-xs">Hay cambios pendientes para {Object.keys(pendingUserAiChanges).length} usuario(s).</p>
                </div>
                <button
                  onClick={handleSaveUserAiChanges}
                  disabled={savingUserAi}
                  className="bg-[#461D77] hover:bg-[#36155E] disabled:opacity-50 text-white font-semibold text-xs tracking-wider px-4 py-2 rounded-md flex items-center gap-1.5 transition-colors duration-150 uppercase cursor-pointer"
                >
                  {savingUserAi ? (
                    <Loader2 size={12} className="animate-spin text-white" />
                  ) : (
                    <>
                      <Save size={12} /> Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            )}

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-[#78716C]">
                <Loader2 className="w-7 h-7 animate-spin text-[#461D77] mb-2" />
                <p className="font-mono text-xs uppercase tracking-wider">Leyendo base de datos...</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2DFD7]">
                {users.map((user) => (
                  <div key={user.userId} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-[#F7F6F2]/60 transition-colors duration-150">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-[#F3EEF8] border border-[#E2DFD7] flex items-center justify-center text-[#461D77] font-mono font-bold text-xs shrink-0">
                        {user.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[#1C1917] text-sm">{user.name}</span>
                          <span className="font-mono text-[10px] text-[#461D77] font-semibold uppercase bg-[#F3EEF8] px-2 py-0.5 rounded-md border border-[#E2DFD7]">
                            {getRoleLabel(user.role)}
                          </span>
                          {pendingUserAiChanges[user.userId] !== undefined && (
                            <span className="bg-[#FFFBEB] text-[#B45309] border border-[#B45309]/30 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md uppercase">
                              Pendiente
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#78716C] mt-0.5 font-mono truncate">
                          @{user.username} · Clave: <span className="font-semibold text-[#57534E]">{user.userId === currentUser.userId ? user.password : '••••••••'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-mono font-semibold uppercase text-[#78716C] tracking-wider mb-1">IA</span>
                        <button
                          type="button"
                          onClick={() => handleToggleUserAi(user)}
                          title={user.enableAi !== false ? 'Desactivar IA para este usuario' : 'Activar IA para este usuario'}
                          className={`w-9 h-4.5 rounded-full transition-colors relative p-0.5 cursor-pointer ${user.enableAi !== false ? 'bg-[#461D77]' : 'bg-[#D6D3CD]'}`}
                        >
                          <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${user.enableAi !== false ? 'translate-x-4.5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteUser(user)}
                        disabled={user.userId === currentUser.userId || user.userId === 'admin'}
                        className="p-2 text-[#78716C] hover:text-[#B91C1C] bg-[#F7F6F2] hover:bg-[#FEF2F2] border border-[#E2DFD7] rounded-md transition-colors duration-150 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                        title="Eliminar usuario"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="py-6 text-center mt-10 border-t border-[#E2DFD7]">
        <p className="text-[10px] font-mono text-[#78716C] uppercase tracking-widest">
          NOVANDINO LOGÍSTICA · GESTIÓN DE ACCESOS
        </p>
      </footer>

      {deleteCandidate && (
        <div className="fixed inset-0 z-[1000] bg-[#1C1917]/60 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] max-w-md w-full rounded-lg p-6 shadow-sm border border-[#E2DFD7] flex flex-col space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-[#E2DFD7]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#FEF2F2] border border-[#B91C1C]/20 text-[#B91C1C] rounded-md">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-[#1C1917] text-base">Confirmar Eliminación</h3>
                  <p className="text-[10px] font-mono font-semibold text-[#B91C1C] uppercase tracking-wider">Acción Destructiva</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteCandidate(null)}
                className="p-1.5 hover:bg-[#EFECE6] rounded-md transition-colors text-[#78716C] hover:text-[#1C1917] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-[#57534E] leading-relaxed">
              Para eliminar la cuenta de <strong className="text-[#1C1917] font-mono">@{deleteCandidate.username}</strong> ({deleteCandidate.name}), confirma ingresando tu contraseña de administrador.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] text-[#57534E] uppercase tracking-wider font-semibold block">Contraseña del Administrador</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="password"
                  value={adminPasswordConfirm}
                  onChange={(e) => {
                    setAdminPasswordConfirm(e.target.value);
                    setPasswordError(false);
                  }}
                  autoFocus
                  placeholder="Ingresa contraseña..."
                  className={`w-full py-2.5 pl-10 pr-4 bg-[#F7F6F2] border rounded-md text-xs font-mono text-[#1C1917] outline-none transition-colors duration-150 ${
                    passwordError ? 'border-[#B91C1C] bg-[#FEF2F2]' : 'border-[#E2DFD7] focus:border-[#461D77] focus:bg-[#FFFFFF]'
                  }`}
                />
              </div>
              {passwordError && (
                <p className="text-[11px] text-[#B91C1C] font-medium mt-1">Contraseña incorrecta</p>
              )}
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-[#E2DFD7]">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="flex-1 py-2.5 bg-[#F7F6F2] hover:bg-[#EFECE6] border border-[#E2DFD7] text-[#57534E] text-xs font-semibold uppercase tracking-wider rounded-md transition-colors duration-150 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-semibold uppercase tracking-wider rounded-md transition-colors duration-150 cursor-pointer"
              >
                Eliminar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

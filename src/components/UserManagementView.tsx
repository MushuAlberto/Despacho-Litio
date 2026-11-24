import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db, logActivity, SystemUser, INITIAL_PREDEFINED_USERS, isFirestoreWriteBlocked, waitForFirestoreReady, isQuotaExceededError, isConnectionUnavailableError } from '../services/firebase';
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
      if (!(await waitForFirestoreReady())) {
        setUsers(INITIAL_PREDEFINED_USERS);
        return;
      }
      const qSnap = await getDocs(collection(db, 'users'));
      const list: SystemUser[] = [];
      qSnap.forEach((docSnap) => {
        list.push(docSnap.data() as SystemUser);
      });
      setUsers(list.length > 0 ? list : INITIAL_PREDEFINED_USERS);
    } catch (error) {
      if (!isQuotaExceededError(error) && !isConnectionUnavailableError(error)) {
        console.error('Error loading users:', error);
      }
      setUsers(INITIAL_PREDEFINED_USERS);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      if (!(await waitForFirestoreReady())) {
        return;
      }
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
          } catch {
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
      if (!isQuotaExceededError(error) && !isConnectionUnavailableError(error)) {
        console.error('Error loading AI settings:', error);
      }
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
    <div className="min-h-screen bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED] p-6 md:p-10 z-10 relative flex flex-col justify-between text-slate-800">
      <div className="max-w-6xl mx-auto w-full space-y-6 flex-grow">
        {/* HEADER */}
        <header className="flex items-center justify-between gap-4 bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-[#461D77] transition-all duration-150 ease-out cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <p className="text-[11px] font-bold tracking-wider text-[#461D77] uppercase">
                Administración de Accesos
              </p>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Gestión de Usuarios</h1>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full bg-[#461D77]/10 text-[#461D77] font-mono text-xs font-bold tabular-nums">
            {users.length} cuentas
          </span>
        </header>

        {statusMsg.text && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className={`rounded-2xl px-4 py-3 flex items-center gap-3 border text-xs font-semibold shadow-sm ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border-rose-200 text-rose-700'
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
            <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-3xl shadow-xl shadow-slate-200/40 p-6 space-y-5">
              <div className="pb-4 border-b border-slate-100">
                <span className="text-[10px] font-bold tracking-wider text-[#7177EC] uppercase">Nuevo perfil</span>
                <h2 className="text-base font-black text-slate-900 tracking-tight mt-0.5">Crear Usuario</h2>
                <p className="text-xs text-slate-500 mt-0.5">Asigna clave de acceso y nivel de rol operativo.</p>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Ej. Juan Pérez"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#461D77] focus:bg-white rounded-xl text-xs font-medium text-slate-900 outline-none transition-colors duration-150 ease-out placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
                    Nombre de Usuario (Login)
                  </label>
                  <input
                    type="text"
                    required
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Ej. jperez"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#461D77] focus:bg-white rounded-xl text-xs font-mono font-medium text-slate-900 outline-none transition-colors duration-150 ease-out placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
                    Contraseña de acceso
                  </label>
                  <input
                    type="password"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Establecer contraseña"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#461D77] focus:bg-white rounded-xl text-xs font-mono font-medium text-slate-900 outline-none transition-colors duration-150 ease-out placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
                    Rol y Permisos
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#461D77] focus:bg-white rounded-xl text-xs font-medium text-slate-900 outline-none transition-colors duration-150 ease-out cursor-pointer"
                  >
                    <option value="supervision">Supervisor (Solo Módulo SdA)</option>
                    <option value="jefe_turno">Jefe Turno (Módulos de Jefe Turno y SdA)</option>
                    <option value="admin">Administrador (Acceso y Gestión Total)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-[#461D77] to-[#7177EC] hover:opacity-95 disabled:opacity-50 text-white font-bold text-xs tracking-wider py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-150 ease-out uppercase cursor-pointer shadow-lg shadow-[#461D77]/20 mt-2"
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
              <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-3xl shadow-xl shadow-slate-200/40 p-6 space-y-5">
                <div className="pb-4 border-b border-slate-100">
                  <span className="text-[10px] font-bold tracking-wider text-[#461D77] uppercase">
                    Motores de Análisis
                  </span>
                  <h2 className="text-base font-black text-slate-900 tracking-tight mt-0.5 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#461D77]" /> Configuración de IA
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define los motores activos y el comportamiento por defecto.
                  </p>
                </div>

                {loadingSettings ? (
                  <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin text-[#461D77] mb-2" />
                    <p className="font-mono text-[10px] uppercase tracking-wider">Cargando parámetros...</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Disponibilidad de motores */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
                        Habilitar Motores
                      </label>
                      <div className="grid grid-cols-2 border border-slate-200 rounded-2xl divide-x divide-slate-200 overflow-hidden">
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
                              ? 'bg-[#461D77]/5'
                              : 'bg-slate-50 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-bold text-xs text-slate-900">Gemini 3.5</span>
                            <div className={`w-8 h-4 rounded-full transition-colors relative p-0.5 ${aiSettings.enableGemini ? 'bg-[#461D77]' : 'bg-slate-300'}`}>
                              <div className={`w-3 h-3 bg-white rounded-full transition-transform ${aiSettings.enableGemini ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">Google AI Flash</span>
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
                              ? 'bg-[#461D77]/5'
                              : 'bg-slate-50 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-bold text-xs text-slate-900">Gemma Free</span>
                            <div className={`w-8 h-4 rounded-full transition-colors relative p-0.5 ${aiSettings.enableGlm ? 'bg-[#461D77]' : 'bg-slate-300'}`}>
                              <div className={`w-3 h-3 bg-white rounded-full transition-transform ${aiSettings.enableGlm ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">OpenRouter Free</span>
                        </button>
                      </div>
                    </div>

                    {/* Motor predeterminado */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
                        Motor por Defecto
                      </label>
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          disabled={!aiSettings.enableGemini}
                          onClick={() => setAiSettings({ ...aiSettings, activeAi: 'gemini' })}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-bold tracking-wider transition-colors duration-150 uppercase cursor-pointer ${
                            aiSettings.activeAi === 'gemini'
                              ? 'bg-[#461D77] text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
                          }`}
                        >
                          Gemini 3.5
                        </button>
                        <button
                          type="button"
                          disabled={!aiSettings.enableGlm}
                          onClick={() => setAiSettings({ ...aiSettings, activeAi: 'glm' })}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-bold tracking-wider transition-colors duration-150 uppercase cursor-pointer ${
                            aiSettings.activeAi === 'glm'
                              ? 'bg-[#461D77] text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
                          }`}
                        >
                          Gemma
                        </button>
                      </div>
                    </div>

                    {/* Habilitar en Módulos específicos */}
                    <div className="space-y-2 pt-3 border-t border-slate-100">
                      <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
                        Módulos Habilitados
                      </label>
                      <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                        <div className="flex items-center justify-between p-3 bg-white">
                          <div>
                            <p className="font-bold text-xs text-slate-900">Cambio de Turno</p>
                            <p className="text-[11px] text-slate-500">Resumen y análisis operativo</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAiSettings({
                              ...aiSettings,
                              enableShiftAnalysis: !aiSettings.enableShiftAnalysis
                            })}
                            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${aiSettings.enableShiftAnalysis ? 'bg-[#461D77]' : 'bg-slate-300'}`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${aiSettings.enableShiftAnalysis ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-white">
                          <div>
                            <p className="font-bold text-xs text-slate-900">Informe Operativo</p>
                            <p className="text-[11px] text-slate-500">Reescritura de justificación de desempeño</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAiSettings({
                              ...aiSettings,
                              enableJustificationRefinement: !aiSettings.enableJustificationRefinement
                            })}
                            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${aiSettings.enableJustificationRefinement ? 'bg-[#461D77]' : 'bg-slate-300'}`}
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
                      className="w-full bg-gradient-to-r from-[#461D77] to-[#7177EC] hover:opacity-95 disabled:opacity-50 text-white font-bold text-xs tracking-wider py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-150 ease-out uppercase cursor-pointer shadow-lg shadow-[#461D77]/20"
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
                    <div className="space-y-2.5 pt-4 border-t border-slate-100">
                      <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
                        Diagnóstico de Conectividad
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={testingAi !== null}
                          onClick={() => handleTestAiConnection('gemini')}
                          className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 uppercase tracking-wider"
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
                          className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 uppercase tracking-wider"
                        >
                          {testingAi === 'glm' ? (
                            <>
                              <Loader2 size={12} className="animate-spin text-slate-500" />
                              Probando...
                            </>
                          ) : (
                            <>
                              <Cpu size={12} className="text-slate-500" />
                              Probar Gemma
                            </>
                          )}
                        </button>
                      </div>

                      {testResult && (
                        <div
                          className={`p-3 rounded-xl border text-xs leading-relaxed flex flex-col gap-1 ${
                            testResult.success
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-rose-50 border-rose-200 text-rose-700'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold uppercase tracking-wider text-[10px]">
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
          <div className="lg:col-span-7 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-3xl shadow-xl shadow-slate-200/40 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/70">
              <h2 className="text-base font-black text-slate-900 tracking-tight">Directorio Activo</h2>
              <p className="text-xs text-slate-500 mt-0.5">Usuarios autorizados en la base de datos Firestore.</p>
            </div>

            {Object.keys(pendingUserAiChanges).length > 0 && (
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
                <div className="text-amber-700">
                  <p className="text-xs font-bold uppercase tracking-wider">Permisos de IA Modificados</p>
                  <p className="text-xs">Hay cambios pendientes para {Object.keys(pendingUserAiChanges).length} usuario(s).</p>
                </div>
                <button
                  onClick={handleSaveUserAiChanges}
                  disabled={savingUserAi}
                  className="bg-[#461D77] hover:bg-[#311042] disabled:opacity-50 text-white font-bold text-xs tracking-wider px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors duration-150 uppercase cursor-pointer"
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
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-[#461D77] mb-2" />
                <p className="font-mono text-xs uppercase tracking-wider">Leyendo base de datos...</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {users.map((user) => (
                  <div key={user.userId} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors duration-150">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#461D77] to-[#7177EC] flex items-center justify-center text-white font-mono font-bold text-xs shrink-0 shadow-sm">
                        {user.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{user.name}</span>
                          <span className="font-mono text-[10px] text-[#461D77] font-bold uppercase bg-[#461D77]/10 px-2.5 py-0.5 rounded-full border border-[#461D77]/20">
                            {getRoleLabel(user.role)}
                          </span>
                          {pendingUserAiChanges[user.userId] !== undefined && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase">
                              Pendiente
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono truncate">
                          @{user.username} · Clave: <span className="font-semibold text-slate-700">{user.userId === currentUser.userId ? user.password : '••••••••'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-mono font-bold uppercase text-slate-400 tracking-wider mb-1">IA</span>
                        <button
                          type="button"
                          onClick={() => handleToggleUserAi(user)}
                          title={user.enableAi !== false ? 'Desactivar IA para este usuario' : 'Activar IA para este usuario'}
                          className={`w-9 h-4.5 rounded-full transition-colors relative p-0.5 cursor-pointer ${user.enableAi !== false ? 'bg-[#461D77]' : 'bg-slate-300'}`}
                        >
                          <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${user.enableAi !== false ? 'translate-x-4.5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteUser(user)}
                        disabled={user.userId === currentUser.userId || user.userId === 'admin'}
                        className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 rounded-xl transition-colors duration-150 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
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

      <footer className="py-6 text-center mt-10 border-t border-slate-200/80">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          NOVANDINO LOGÍSTICA · GESTIÓN DE ACCESOS
        </p>
      </footer>

      {deleteCandidate && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Confirmar Eliminación</h3>
                  <p className="text-[10px] font-mono font-bold text-rose-600 uppercase tracking-wider">Acción Destructiva</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteCandidate(null)}
                className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Para eliminar la cuenta de <strong className="text-slate-900 font-mono">@{deleteCandidate.username}</strong> ({deleteCandidate.name}), confirma ingresando tu contraseña de administrador.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-500 uppercase tracking-wider font-bold block">Contraseña del Administrador</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={adminPasswordConfirm}
                  onChange={(e) => {
                    setAdminPasswordConfirm(e.target.value);
                    setPasswordError(false);
                  }}
                  autoFocus
                  placeholder="Ingresa contraseña..."
                  className={`w-full py-2.5 pl-10 pr-4 bg-slate-50 border rounded-xl text-xs font-mono text-slate-900 outline-none transition-colors duration-150 ${
                    passwordError ? 'border-rose-500 bg-rose-50' : 'border-slate-200 focus:border-[#461D77] focus:bg-white'
                  }`}
                />
              </div>
              {passwordError && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">Contraseña incorrecta</p>
              )}
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors duration-150 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors duration-150 cursor-pointer"
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

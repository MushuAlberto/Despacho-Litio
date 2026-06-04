import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db, logActivity, SystemUser } from '../services/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { User, Lock, KeyRound, Plus, Trash2, ArrowLeft, Loader2, Key, Users, CheckCircle, ShieldAlert } from 'lucide-react';

interface UserManagementViewProps {
  currentUser: SystemUser;
  onBack: () => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser, onBack }) => {
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

  useEffect(() => {
    fetchUsers();
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
      lastLogin: ''
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

  const handleDeleteUser = async (userToDelete: SystemUser) => {
    if (userToDelete.userId === currentUser.userId) {
      alert('No puedes eliminar tu propio usuario en sesión.');
      return;
    }

    if (userToDelete.userId === 'admin') {
      alert('No se permite eliminar la cuenta de administración principal.');
      return;
    }

    if (!window.confirm(`¿Esta seguro que desea eliminar la cuenta de ${userToDelete.name} (@${userToDelete.username})?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userToDelete.userId));
      
      // Log activity
      await logActivity(
        currentUser,
        'Usuario Eliminado',
        `Se eliminó la cuenta de: ${userToDelete.name} (Usuario: @${userToDelete.username})`
      );

      setStatusMsg({ type: 'success', text: `Usuario @${userToDelete.username} eliminado correctamente.` });
      await fetchUsers();
    } catch (e) {
      console.error('Error deleting user:', e);
      setStatusMsg({ type: 'error', text: 'Fallo al eliminar el registro en Firestore.' });
    }
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return 'Administrador';
    if (role === 'jefe_turno') return 'Jefe Turno';
    return 'Supervisor';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAF8F5] via-[#ECEAF0] to-[#E5E5ED] p-6 md:p-10 z-10 relative flex flex-col justify-between">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#7177ec02_1px,transparent_1px),linear-gradient(to_bottom,#7177ec02_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-70 pointer-events-none z-0" />

      <div className="max-w-6xl mx-auto w-full space-y-8 flex-grow">
        {/* HEADER */}
        <header className="flex items-center gap-4 bg-white/60 backdrop-blur-md rounded-3xl border border-white p-6 shadow-sm">
          <button 
            onClick={onBack}
            className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[9px] font-black tracking-widest text-[#4e2283] uppercase bg-[#4e2283]/10 px-2.5 py-1 rounded-full">
              ADMINISTRA ACCESOS
            </span>
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight mt-1">Gestión de Usuarios</h1>
          </div>
        </header>

        {statusMsg.text && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-4 flex items-center gap-3 border ${
              statusMsg.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {statusMsg.type === 'success' ? <CheckCircle size={18} /> : <ShieldAlert size={18} />}
            <span className="text-xs font-black tracking-wide">{statusMsg.text}</span>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
          {/* CREATE PROFILE FORM */}
          <div className="lg:col-span-5 bg-white border border-white rounded-[2rem] p-6 md:p-8 shadow-sm space-y-6">
            <div className="space-y-1">
              <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Añadir registro</span>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Crear Nuevo Usuario</h2>
              <p className="text-xs font-medium text-slate-500">Asigne clave de acceso y nivel de rol corporativo correspondiente.</p>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-widest text-[#461D77] uppercase flex items-center gap-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-widest text-[#461D77] uppercase flex items-center gap-1">
                  Nombre de Usuario (Para login)
                </label>
                <input
                  type="text"
                  required
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  placeholder="Ej. jperez (letras y números)"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-widest text-[#461D77] uppercase flex items-center gap-1">
                  Contraseña de acceso
                </label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  placeholder="Establezca contraseña"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black tracking-widest text-[#461D77] uppercase flex items-center gap-1">
                  Rol y Permisos
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-[#461D77] rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer appearance-none"
                >
                  <option value="supervision">Supervisor (Solo Módulo Supervisión)</option>
                  <option value="jefe_turno">Jefe Turno (Módulos de Jefe Turno y Supervisión)</option>
                  <option value="admin">Administrador (Acceso y Gestión Total)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-[#461D77] hover:bg-[#321159] disabled:bg-[#461D77]/50 text-white font-extrabold text-[10px] tracking-widest py-3 rounded-2xl flex items-center justify-center gap-2 hover:shadow-lg transition-all duration-300 uppercase cursor-pointer mt-2"
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

          {/* ACTIVE DIRECTORY LIST */}
          <div className="lg:col-span-7 bg-white/95 border border-white rounded-[2rem] p-6 md:p-8 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Directorio Activo</h2>
            <p className="text-xs font-medium text-slate-500">Listado general de usuarios autorizados en la base de datos Firestore.</p>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-[#461D77] mb-2" />
                <p className="font-mono text-[10px] uppercase tracking-widest">Leyendo base de datos...</p>
              </div>
            ) : (
              <div className="space-y-4 divide-y divide-slate-100">
                {users.map((user) => (
                  <div key={user.userId} className="pt-4 first:pt-0 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#461D77]/10 to-[#7177EC]/10 flex items-center justify-center text-[#461D77] font-black text-sm">
                        {user.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-800 text-sm">{user.name}</span>
                          <span className="font-mono text-[9px] text-[#4e2283] font-black uppercase bg-[#4e2283]/5 px-2 py-0.5 rounded-full border border-[#4e2283]/10">
                            {getRoleLabel(user.role)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">@{user.username} &bull; Contraseña: <span className="font-bold text-slate-700">{user.password}</span></p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteUser(user)}
                      disabled={user.userId === currentUser.userId || user.userId === 'admin'}
                      className="p-3.5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-2xl transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                      title="Eliminar usuario"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="py-8 text-center mt-12 border-t border-slate-200/50 relative z-10">
        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.2em]">
          NOVANDINO LOGÍSTICA &bull; GESTIÓN SECTORIAL SEGURA DE ACCESOS
        </p>
      </footer>
    </div>
  );
};

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { SystemUser, MedicalCredential } from '../types';
import { purgeAllCredentials } from '../lib/api';
import { 
  UserPlus, Edit2, Trash2, Key, Users, UserCheck, Shield, Mail,
  X, Check, AlertCircle, ArrowLeft, Settings, Info, Save, Trash
} from 'lucide-react';

interface UserSettingsProps {
  users: SystemUser[];
  activeOperator: SystemUser | null;
  credentials?: MedicalCredential[];
  userRole?: 'admin' | 'rh' | 'admision' | 'directorio' | 'guardias';
  onUpdateUsers: (newUsers: SystemUser[]) => void;
  onBackToDashboard: () => void;
  onNavigateToForm: () => void;
  onNavigateToCredentials: () => void;
  onNavigateToConsent: (id: string) => void;
  onLogout: () => void;
  firstCredentialId?: string;
}

export default function UserSettings({
  users,
  activeOperator,
  credentials = [],
  userRole = 'admin',
  onUpdateUsers,
  onBackToDashboard,
  onNavigateToForm,
  onNavigateToCredentials,
  onNavigateToConsent,
  onLogout,
  firstCredentialId
}: UserSettingsProps) {
  const [isEditing, setIsEditing] = useState<string | null>(null); // user ID
  const [isAdding, setIsAdding] = useState(false);
  
  // Form fields state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'rh' | 'admision' | 'directorio' | 'guardias'>('rh');

  // Granular permissions state
  const [permActivos, setPermActivos] = useState(true);
  const [permExpirados, setPermExpirados] = useState(true);
  const [permSanciones, setPermSanciones] = useState(true);
  const [permEditDirectorio, setPermEditDirectorio] = useState(false);
  const [permEditGuardias, setPermEditGuardias] = useState(false);
  const [permMoveFiles, setPermMoveFiles] = useState(false);
  const [permSignDocs, setPermSignDocs] = useState(false);
  
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const applyRolePreset = (selectedRole: 'admin' | 'rh' | 'admision' | 'directorio' | 'guardias') => {
    setRole(selectedRole);
    if (selectedRole === 'admin') {
      setPermActivos(true); setPermExpirados(true); setPermSanciones(true);
      setPermEditDirectorio(true); setPermEditGuardias(true); setPermMoveFiles(true); setPermSignDocs(true);
    } else if (selectedRole === 'rh') {
      setPermActivos(true); setPermExpirados(true); setPermSanciones(true);
      setPermEditDirectorio(false); setPermEditGuardias(false); setPermMoveFiles(false); setPermSignDocs(false);
    } else if (selectedRole === 'admision') {
      setPermActivos(true); setPermExpirados(true); setPermSanciones(false);
      setPermEditDirectorio(false); setPermEditGuardias(false); setPermMoveFiles(false); setPermSignDocs(false);
    } else if (selectedRole === 'directorio') {
      setPermActivos(true); setPermExpirados(false); setPermSanciones(false);
      setPermEditDirectorio(true); setPermEditGuardias(false); setPermMoveFiles(false); setPermSignDocs(false);
    } else if (selectedRole === 'guardias') {
      setPermActivos(true); setPermExpirados(false); setPermSanciones(false);
      setPermEditDirectorio(false); setPermEditGuardias(true); setPermMoveFiles(false); setPermSignDocs(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('rh');
    setPermActivos(true);
    setPermExpirados(true);
    setPermSanciones(true);
    setPermEditDirectorio(false);
    setPermEditGuardias(false);
    setPermMoveFiles(false);
    setPermSignDocs(false);
    setIsEditing(null);
    setIsAdding(false);
    setErrorMsg(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (user: SystemUser) => {
    resetForm();
    setIsEditing(user.id);
    setName(user.name);
    setEmail(user.email);
    setPassword(user.password || 'password123');
    setRole(user.role);
    setPermActivos(user.permissions?.canViewActivos ?? true);
    setPermExpirados(user.permissions?.canViewExpirados ?? true);
    setPermSanciones(user.permissions?.canViewSanciones ?? (user.role === 'admin' || user.role === 'rh'));
    setPermEditDirectorio(user.permissions?.canEditDirectorio ?? (user.role === 'admin' || user.role === 'directorio'));
    setPermEditGuardias(user.permissions?.canEditGuardias ?? (user.role === 'admin' || user.role === 'guardias'));
    setPermMoveFiles(user.permissions?.canMoveFiles ?? (user.role === 'admin'));
    setPermSignDocs(user.permissions?.canSignDocs ?? (user.role === 'admin'));
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('El nombre es requerido.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Proporcione un correo institucional válido.');
      return;
    }
    if (!password || password.length < 4) {
      setErrorMsg('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    // Check duplicate email
    const duplicate = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== isEditing);
    if (duplicate) {
      setErrorMsg('Este correo electrónico ya está registrado en otro usuario.');
      return;
    }

    const permissions = {
      canViewActivos: permActivos,
      canViewExpirados: permExpirados,
      canViewSanciones: permSanciones,
      canEditDirectorio: permEditDirectorio,
      canEditGuardias: permEditGuardias,
      canMoveFiles: permMoveFiles,
      canSignDocs: permSignDocs
    };

    if (isEditing) {
      // Update existing
      const updated = users.map(u => {
        if (u.id === isEditing) {
          return { ...u, name, email, role, password, permissions };
        }
        return u;
      });
      onUpdateUsers(updated);
      showToast(`Perfil y permisos de "${name}" actualizados.`);
    } else {
      // Add new
      const newUser: SystemUser = {
        id: 'usr-' + Math.floor(100 + Math.random() * 900),
        name,
        email,
        role,
        password,
        permissions,
        createdAt: new Date().toLocaleDateString('es-MX')
      };
      onUpdateUsers([newUser, ...users]);
      showToast(`Usuario "${name}" y sus permisos guardados exitosamente.`);
    }
    resetForm();
  };

  const handleDeleteUser = (id: string, userName: string) => {
    if (activeOperator && activeOperator.id === id) {
      alert('No puedes eliminar lógicamente al usuario con el que has iniciado sesión actualmente.');
      return;
    }
    
    if (users.length <= 1) {
      alert('Debe existir al menos un usuario activo en el sistema.');
      return;
    }

    if (window.confirm(`¿Está seguro de que desea eliminar al usuario administrativo "${userName}"? Esta acción revocará de inmediato sus privilegios de acceso.`)) {
      const filtered = users.filter(u => u.id !== id);
      onUpdateUsers(filtered);
      showToast(`Usuario "${userName}" removido del sistema.`);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-body text-slate-800 pb-24 select-none">
      
      {/* Top Navigation Bar Component */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm flex justify-between items-center px-8 h-17 no-print">
        <div className="flex items-center gap-8">
          <div className="text-2xl font-bold tracking-tighter text-[#af101a] font-headline flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            <span>CredSJ</span>
          </div>
          <div className="hidden md:flex gap-6 items-center font-headline text-sm font-medium tracking-tight">
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onBackToDashboard(); }}
              className="text-slate-600 hover:text-red-800 transition-colors"
            >
              Panel de Control
            </a>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onNavigateToForm(); }}
              className={`flex items-center gap-1 transition-colors ${
                userRole === 'admin' 
                  ? 'text-slate-600 hover:text-red-800' 
                  : 'text-slate-400 cursor-not-allowed'
              }`}
            >
              {userRole !== 'admin' && <span className="material-symbols-outlined text-[14px]">lock</span>}
              Registro Médicos
            </a>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onNavigateToCredentials(); }}
              className="text-slate-600 hover:text-red-800 transition-colors"
            >
              Credenciales
            </a>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                if (firstCredentialId) {
                  onNavigateToConsent(firstCredentialId);
                } else {
                  alert("Por favor, registre primero un médico para poder visualizar el consentimiento legal de incorporación.");
                }
              }}
              className="text-slate-600 hover:text-red-800 transition-colors"
            >
              Legal
            </a>
            <a 
              href="#" 
              className="text-red-700 font-bold border-b-2 border-red-700 pb-1"
              onClick={(e) => e.preventDefault()}
            >
              Ajustes
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Sesión de Operador</p>
            <p className="text-xs font-bold text-slate-800">{activeOperator?.name || 'Administrador'}</p>
          </div>
          <button 
            onClick={onLogout}
            className="bg-red-50 text-[#af101a] hover:bg-red-100 px-3.5 py-1.5 rounded-xl font-headline text-xs font-bold duration-150 cursor-pointer"
          >
            Cerrar Sesión
          </button>
        </div>
      </nav>

      {/* Toast alert system */}
      {toastMsg && (
        <div className="fixed top-20 right-8 z-[100] max-w-md bg-stone-900 text-white rounded-xl shadow-2xl p-4 flex items-center gap-3 border border-stone-800">
          <UserCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-xs font-semibold">{toastMsg}</p>
        </div>
      )}

      <main className="pt-24 px-4 md:px-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button 
              onClick={onBackToDashboard}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-xs font-bold uppercase tracking-wider mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Volver al Control
            </button>
            <h1 className="font-headline text-3xl font-extrabold text-slate-900 tracking-tight">
              Ajustes de Usuarios del Sistema
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Administración de cuentas con acceso restringido para directores y personal de Credencialización o Recursos Humanos.
            </p>
          </div>

          <button
            onClick={handleStartAdd}
            className="bg-primary text-white hover:bg-primary-hover px-5 py-3 rounded-xl font-headline text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Agregar Usuario
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Users Table Control Panel (Left column) */}
          <div className={`${isAdding || isEditing ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden`}>
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="font-headline font-bold text-lg text-slate-900">Nombres y Roles Autorizados</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Operador</th>
                    <th className="px-6 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Rol de Permisos</th>
                    <th className="px-6 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Clave Acceso</th>
                    <th className="px-6 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-right">Controles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => {
                    const isActive = activeOperator && activeOperator.id === u.id;
                    return (
                      <tr key={u.id} className={`hover:bg-slate-50/50 transition-colors ${isActive ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                              {u.name}
                              {isActive && (
                                <span className="text-[8px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded tracking-wider uppercase border border-amber-200">
                                  Tú
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{u.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {u.role === 'admin' ? (
                            <span className="bg-red-50 text-primary border border-red-100 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                              Administrador
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                              Recursos Humanos
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-mono font-medium text-slate-400 tracking-wider">••••••••</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleStartEdit(u)}
                              title="Editar Atributos de Usuario"
                              className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              disabled={isActive}
                              title={isActive ? "No puedes eliminar tu propia cuenta conectada" : "Eliminar Operador"}
                              className={`p-1.5 rounded-full transition-colors ${
                                isActive 
                                  ? 'text-slate-200 cursor-not-allowed' 
                                  : 'text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="bg-slate-50/50 p-4 border-t border-slate-100 text-xs text-slate-400 font-medium flex items-center gap-2">
              <Info className="w-4 h-4 text-primary flex-shrink-0" />
              <span>Cualquier cuenta administrativa registrada aquí puede usarse inmediatamente en la página de inicio de sesión.</span>
            </div>
          </div>

          {/* User addition or editing workspace sidebar card */}
          {(isAdding || isEditing) && (
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-md p-6 h-fit">
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <h3 className="font-headline font-bold text-base text-slate-900">
                    {isEditing ? 'Editar Operador' : 'Agregar Operador Oficial'}
                  </h3>
                </div>
                <button 
                  onClick={resetForm} 
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {errorMsg && (
                <div className="p-4 bg-red-50 text-red-800 border-l-4 border-red-600 rounded text-xs font-semibold mb-6 flex items-start gap-2">
                  <AlertCircle className="w-4.5 h-4.5 text-red-600 flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveUser} className="space-y-5">
                
                {/* Full name input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Nombre Completo</label>
                  <div className="relative">
                    <input 
                      required
                      type="text" 
                      placeholder="ej. Dra. Maria Esther Ruiz"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary p-3 text-slate-800 text-sm font-semibold focus:outline-none"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Email institutional */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Correo Institucional</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input 
                      required
                      type="email" 
                      placeholder="m.ruiz@medverify.pro"
                      className="w-full pl-9 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary p-3 text-slate-800 text-sm font-semibold focus:outline-none"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Secure Password access */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Clave de Acceso Segura</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Key className="w-4 h-4" />
                    </span>
                    <input 
                      required
                      type="text" 
                      placeholder="Mínimo 4 caracteres"
                      className="w-full pl-9 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary p-3 text-slate-800 text-sm font-semibold focus:outline-none"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {/* Role dropdown / selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Rol y Nivel de Privilegios</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-1 bg-slate-50 border border-slate-200 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => applyRolePreset('admin')}
                      className={`py-2 px-3 border rounded-xl text-[11px] font-extrabold uppercase tracking-wide transition-all cursor-pointer flex flex-col items-center justify-center gap-1 text-center ${
                        role === 'admin'
                          ? 'bg-[#af101a] text-white border-transparent shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                      Administrador
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRolePreset('rh')}
                      className={`py-2 px-3 border rounded-xl text-[11px] font-extrabold uppercase tracking-wide transition-all cursor-pointer flex flex-col items-center justify-center gap-1 text-center ${
                        role === 'rh'
                          ? 'bg-red-50 border-[#af101a] text-[#af101a] shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">supervised_user_circle</span>
                      Recursos (RH)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRolePreset('admision')}
                      className={`py-2 px-3 border rounded-xl text-[11px] font-extrabold uppercase tracking-wide transition-all cursor-pointer flex flex-col items-center justify-center gap-1 text-center ${
                        role === 'admision'
                          ? 'bg-red-50 border-[#af101a] text-[#af101a] shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Admisión (Lectura)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRolePreset('directorio')}
                      className={`py-2 px-3 border rounded-xl text-[11px] font-extrabold uppercase tracking-wide transition-all cursor-pointer flex flex-col items-center justify-center gap-1 text-center ${
                        role === 'directorio'
                          ? 'bg-red-50 border-[#af101a] text-[#af101a] shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">contacts</span>
                      Directorio
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRolePreset('guardias')}
                      className={`py-2 px-3 border rounded-xl text-[11px] font-extrabold uppercase tracking-wide transition-all cursor-pointer flex flex-col items-center justify-center gap-1 text-center col-span-2 md:col-span-1 ${
                        role === 'guardias'
                          ? 'bg-red-50 border-[#af101a] text-[#af101a] shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">calendar_month</span>
                      Guardias
                    </button>
                  </div>
                </div>

                {/* Granular Permissions Section */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#af101a]" />
                    Permisos Específicos (¿Qué puede ver o mover?)
                  </label>
                  <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                    <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800">
                      <input 
                        type="checkbox"
                        checked={permActivos}
                        onChange={(e) => setPermActivos(e.target.checked)}
                        className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      <span>Ver Médicos Activos</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800">
                      <input 
                        type="checkbox"
                        checked={permExpirados}
                        onChange={(e) => setPermExpirados(e.target.checked)}
                        className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      <span>Ver Documentos Expirados</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800">
                      <input 
                        type="checkbox"
                        checked={permSanciones}
                        onChange={(e) => setPermSanciones(e.target.checked)}
                        className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      <span>Ver y Gestionar Sanciones Médicas</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800">
                      <input 
                        type="checkbox"
                        checked={permEditDirectorio}
                        onChange={(e) => setPermEditDirectorio(e.target.checked)}
                        className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      <span>Editar Directorio Telefónico</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800">
                      <input 
                        type="checkbox"
                        checked={permEditGuardias}
                        onChange={(e) => setPermEditGuardias(e.target.checked)}
                        className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      <span>Editar Calendario de Guardias</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800">
                      <input 
                        type="checkbox"
                        checked={permMoveFiles}
                        onChange={(e) => setPermMoveFiles(e.target.checked)}
                        className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      <span>Mover, Cargar y Reorganizar Expedientes Digitales</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800">
                      <input 
                        type="checkbox"
                        checked={permSignDocs}
                        onChange={(e) => setPermSignDocs(e.target.checked)}
                        className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      <span>Firmar Documentos e Incorporaciones Legales</span>
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium leading-tight mt-1">
                    * Modifique manualmente los permisos según las responsabilidades asignadas al perfil del usuario.
                  </p>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-[#af101a] hover:bg-[#85040d] text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-red-900/10 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {isEditing ? 'Guardar Cambios' : 'Registrar Operador'}
                  </button>
                </div>

              </form>
            </div>
          )}

          {userRole === 'admin' && (
            <div className="bg-red-50/50 border border-red-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-red-900 flex items-center gap-2">
                    <Trash className="w-4 h-4 text-red-600" />
                    Depuración Crítica del Sistema (Iniciar en 0)
                  </h3>
                  <p className="text-xs text-red-700 mt-1 max-w-2xl leading-relaxed">
                    Utilice esta opción para eliminar de forma definitiva todos los expedientes médicos, archivos y registros fantasma guardados en la base de datos y en el servidor. Esto iniciará el sistema desde cero para produccion.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("⚠️ ¿ESTÁ ABSOLUTAMENTE SEGURO DE PURGAR EL SISTEMA?\n\nEsta acción eliminará todos los médicos registrados y expedientes en el servidor para iniciar desde 0. Esta acción NO se puede deshacer.")) {
                      const ok = await purgeAllCredentials();
                      if (ok) {
                        alert("🧹 Sistema depurado correctamente. Todos los datos iniciados en 0.");
                        window.location.reload();
                      } else {
                        alert("Error al intentar purgar el sistema.");
                      }
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow cursor-pointer whitespace-nowrap"
                >
                  DEPURAR SISTEMA Y EMPEZAR EN 0
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

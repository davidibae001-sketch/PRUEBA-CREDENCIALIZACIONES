import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MedicalCredential, INITIAL_CREDENTIALS, SystemUser } from './types';
import { getCredentials, saveCredential, getUsers, saveUser, safeSetLocalStorage } from './lib/api';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import LegalConsent from './components/LegalConsent';
import PhysicianForm from './components/PhysicianForm';
import UserSettings from './components/UserSettings';
import CredentialsDashboard from './components/CredentialsDashboard';
import MedicalDirectory from './components/MedicalDirectory';
import GuardCalendar from './components/GuardCalendar';
import BlacklistManager from './components/BlacklistManager';

export default function App() {
  // Primary persistent state
  const [credentials, setCredentials] = useState<MedicalCredential[]>(() => {
    const saved = localStorage.getItem('credsj_credentials');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error('Failed to parse credentials from localStorage', err);
      }
    }
    return [];
  });

  // Persistent System Users/Operators State
  const [users, setUsers] = useState<SystemUser[]>(() => {
    const saved = localStorage.getItem('credsj_users');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse system operators', e);
      }
    }
    return [
      { id: 'usr-1', name: 'Administrador General', email: 'admin@medverify.pro', role: 'admin', password: 'password123', createdAt: '2026-05-20' }
    ];
  });

  // Pull dynamic lists from backend database on startups
  useEffect(() => {
    async function loadBackendData() {
      try {
        const liveCreds = await getCredentials();
        if (Array.isArray(liveCreds)) {
          setCredentials(prev => {
            const map = new Map<string, MedicalCredential>();
            // 1. Add all server live credentials
            liveCreds.forEach(c => {
              if (c && c.id) {
                map.set(String(c.id), c);
              }
            });
            // 2. Retain any local credentials not yet on server or matching by folio/cedula
            prev.forEach(c => {
              if (!c || !c.id) return;
              const idStr = String(c.id);
              if (!map.has(idStr)) {
                const existingByFolio = c.folio ? Array.from(map.values()).find(item => item.folio && item.folio === c.folio) : null;
                const existingByCedula = (c.npi && c.npi !== 'SIN_CEDULA') ? Array.from(map.values()).find(item => item.npi && item.npi === c.npi) : null;
                if (!existingByFolio && !existingByCedula) {
                  map.set(idStr, c);
                }
              }
            });
            const merged = Array.from(map.values());
            safeSetLocalStorage('credsj_credentials', merged);
            return merged;
          });
        }

        const liveUsers = await getUsers();
        if (Array.isArray(liveUsers) && liveUsers.length > 0) {
          setUsers(liveUsers);
        }
      } catch (err) {
        console.error("[API Fail] Backend sync failed, offline cache active.", err);
      }
    }
    loadBackendData();
  }, []);

  // Track state changes to sync with local storage for offline resiliency
  useEffect(() => {
    safeSetLocalStorage('credsj_credentials', credentials);
  }, [credentials]);

  useEffect(() => {
    safeSetLocalStorage('credsj_users', users);
  }, [users]);

  // Synchronized Wrapper functions for DB integrations
  const handleUpdateCredentials = async (newVal: MedicalCredential[] | ((prev: MedicalCredential[]) => MedicalCredential[])) => {
    const updatedList = typeof newVal === 'function' ? newVal(credentials) : newVal;
    setCredentials(updatedList);

    // Save individual modified/added items
    const changedItems = updatedList.filter(item => {
      const match = credentials.find(c => c.id === item.id);
      return !match || JSON.stringify(match) !== JSON.stringify(item);
    });
    for (const item of changedItems) {
      await saveCredential(item);
    }

    // Process deletions
    const deletedItems = credentials.filter(item => !updatedList.some(c => c.id === item.id));
    for (const item of deletedItems) {
      try {
        await fetch(`/api/credentials/${item.id}`, { method: 'DELETE' });
      } catch(e) {}
    }
  };

  const handleUpdateUsers = async (newVal: SystemUser[]) => {
    setUsers(newVal);

    // Sync creations or modifications
    const changedUsers = newVal.filter(item => {
      const match = users.find(u => u.id === item.id);
      return !match || JSON.stringify(match) !== JSON.stringify(item);
    });
    for (const u of changedUsers) {
      await saveUser(u);
    }

    // Sync deletions
    const deletedUsers = users.filter(item => !newVal.some(u => u.id === item.id));
    for (const u of deletedUsers) {
      try {
        await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
      } catch (e) {}
    }
  };

  const [currentScreen, setCurrentScreen] = useState<'login' | 'dashboard' | 'legal' | 'register' | 'credentials' | 'settings' | 'directorio' | 'guardias' | 'blacklist'>('login');
  const [userRole, setUserRole] = useState<'admin' | 'rh' | 'admision' | 'directorio' | 'guardias'>('admin');
  const [selectedId, setSelectedId] = useState<string>('ER-9928');
  const [targetFormCredentialId, setTargetFormCredentialId] = useState<string | null>(null);

  // Active logged-in personnel
  const activeOperator = users.find(u => u.role === userRole) || users[0];

  // Route protection effect
  useEffect(() => {
    if (currentScreen === 'login') return;

    if (userRole === 'directorio' && currentScreen !== 'directorio') {
      setCurrentScreen('directorio');
    } else if (userRole === 'guardias' && currentScreen !== 'guardias') {
      setCurrentScreen('guardias');
    } else if (userRole !== 'admin') {
      if (currentScreen === 'register' || currentScreen === 'settings') {
        setCurrentScreen('dashboard');
      }
    }
  }, [currentScreen, userRole]);

  // Guarded navigation helpers
  const handleNavigateToForm = (targetId: string | null = null) => {
    if (userRole === 'admin') {
      setTargetFormCredentialId(targetId);
      setCurrentScreen('register');
    } else {
      alert('Acceso denegado: Se requieren permisos de Administrador para dar de alta o modificar registros de médicos.');
    }
  };

  const handleNavigateToSettings = () => {
    if (userRole === 'admin') {
      setCurrentScreen('settings');
    } else {
      alert('Acceso denegado: El menú de Ajustes y Operadores está reservado únicamente para Administradores.');
    }
  };

  // Authentication success handler
  const handleLoginSuccess = (role: 'admin' | 'rh' | 'admision' | 'directorio' | 'guardias') => {
    setUserRole(role);
    if (role === 'directorio') {
      setCurrentScreen('directorio');
    } else if (role === 'guardias') {
      setCurrentScreen('guardias');
    } else {
      setCurrentScreen('dashboard');
    }
  };

  // Handler for adding or updating registrations
  const handleAddOrUpdateCredential = async (updatedCred: MedicalCredential, navigateToLegal: boolean = false) => {
    setCredentials(prev => {
      const exists = prev.some(c => c.id === updatedCred.id || (c.folio && updatedCred.folio && c.folio === updatedCred.folio));
      if (exists) {
        return prev.map(c => (c.id === updatedCred.id || (c.folio && updatedCred.folio && c.folio === updatedCred.folio)) ? updatedCred : c);
      } else {
        return [updatedCred, ...prev];
      }
    });

    if (navigateToLegal) {
      setSelectedId(updatedCred.id);
      setCurrentScreen('legal');
      setTargetFormCredentialId(null);
    }

    // Live update save to PostgreSQL and local storage
    const savedRes = await saveCredential(updatedCred);
    if (savedRes && typeof savedRes === 'object' && savedRes.id) {
      setCredentials(prev => prev.map(c => (c.id === updatedCred.id || (c.folio && savedRes.folio && c.folio === savedRes.folio)) ? { ...c, ...savedRes } : c));
    }
  };

  // Selection trigger for dashboard actions
  const handleSelectCredentialToEdit = (id: string) => {
    if (userRole === 'admin') {
      setTargetFormCredentialId(id);
      setCurrentScreen('register');
    } else {
      alert('Acceso denegado: Se requieren permisos de Administrador para editar expedientes de médicos.');
    }
  };

  const handleSelectCredentialToViewConsent = (id: string) => {
    if (userRole === 'directorio' || userRole === 'guardias') {
      alert('Acceso restringido para ver Consentimiento Legal de Incorporaciones.');
      return;
    }
    setSelectedId(id);
    setCurrentScreen('legal');
  };

  const handleUpdateStatus = async (id: string, newStatus: 'VERIFICADO' | 'PENDIENTE') => {
    setCredentials(prev => prev.map(c => {
      if (c.id === id) {
        const updated = { ...c, status: newStatus };
        saveCredential(updated);
        return updated;
      }
      return c;
    }));
  };

  const handleExitToLogin = () => {
    setCurrentScreen('login');
    setTargetFormCredentialId(null);
  };

  // Pre-load target dynamic credential for form rendering
  const activeFormCredential = targetFormCredentialId 
    ? credentials.find(c => c.id === targetFormCredentialId) 
    : null;

  return (
    <div className="bg-slate-50 min-h-screen text-slate-900 overflow-x-hidden select-none font-body antialiased">
      <AnimatePresence mode="wait">
        {currentScreen === 'login' && (
          <motion.div
            key="login-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <LoginForm onLoginSuccess={handleLoginSuccess} />
          </motion.div>
        )}

        {currentScreen === 'dashboard' && (
          <motion.div
            key="dashboard-screen"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
          >
            <Dashboard 
              credentials={credentials}
              userRole={userRole}
              onSelectCredential={handleSelectCredentialToEdit}
              onNavigateToForm={() => handleNavigateToForm(null)}
              onNavigateToConsent={handleSelectCredentialToViewConsent}
              onNavigateToCredentials={() => setCurrentScreen('credentials')}
              onNavigateToSettings={handleNavigateToSettings}
              onNavigateToDirectory={() => setCurrentScreen('directorio')}
              onNavigateToCalendar={() => setCurrentScreen('guardias')}
              onNavigateToBlacklist={() => setCurrentScreen('blacklist')}
              onUpdateCredentials={handleUpdateCredentials}
              onLogout={handleExitToLogin}
            />
          </motion.div>
        )}

        {currentScreen === 'credentials' && (
          <motion.div
            key="credentials-screen"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
          >
            <CredentialsDashboard 
              credentials={credentials}
              userRole={userRole}
              onBackToDashboard={() => setCurrentScreen('dashboard')}
              onNavigateToForm={() => handleNavigateToForm(null)}
              onNavigateToConsent={handleSelectCredentialToViewConsent}
              onNavigateToSettings={handleNavigateToSettings}
              onLogout={handleExitToLogin}
            />
          </motion.div>
        )}

        {currentScreen === 'settings' && (
          <motion.div
            key="settings-screen"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
          >
            <UserSettings 
              users={users}
              activeOperator={activeOperator}
              credentials={credentials}
              userRole={userRole}
              onUpdateUsers={handleUpdateUsers}
              onBackToDashboard={() => setCurrentScreen('dashboard')}
              onNavigateToForm={() => handleNavigateToForm(null)}
              onNavigateToCredentials={() => setCurrentScreen('credentials')}
              onNavigateToConsent={handleSelectCredentialToViewConsent}
              onLogout={handleExitToLogin}
              firstCredentialId={credentials[0]?.id}
            />
          </motion.div>
        )}

        {currentScreen === 'legal' && (
          <motion.div
            key="legal-screen"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <LegalConsent 
              credentialId={selectedId}
              credentials={credentials}
              userRole={userRole}
              onBackToDashboard={() => setCurrentScreen('dashboard')}
              onNavigateToForm={() => handleNavigateToForm(null)}
              onNavigateToCredentials={() => setCurrentScreen('credentials')}
              onNavigateToSettings={handleNavigateToSettings}
              onUpdateStatus={handleUpdateStatus}
            />
          </motion.div>
        )}

        {currentScreen === 'register' && (
          <motion.div
            key="register-screen"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
          >
            <PhysicianForm 
              onAddOrUpdateCredential={handleAddOrUpdateCredential}
              onCancel={() => { setCurrentScreen('dashboard'); setTargetFormCredentialId(null); }}
              initialCredential={activeFormCredential}
              credentials={credentials}
              userRole={userRole}
              onNavigateToCredentials={() => setCurrentScreen('credentials')}
              onNavigateToConsent={handleSelectCredentialToViewConsent}
              onNavigateToSettings={handleNavigateToSettings}
              firstCredentialId={credentials[0]?.id}
            />
          </motion.div>
        )}

        {currentScreen === 'directorio' && (
          <motion.div
            key="directorio-screen"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
          >
            <MedicalDirectory 
              onBackToDashboard={() => setCurrentScreen('dashboard')}
              onNavigateToCalendar={() => setCurrentScreen('guardias')}
              userRole={userRole}
            />
          </motion.div>
        )}

        {currentScreen === 'guardias' && (
          <motion.div
            key="guardias-screen"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
          >
            <GuardCalendar 
              onBackToDashboard={() => setCurrentScreen('dashboard')}
              onNavigateToDirectory={() => setCurrentScreen('directorio')}
              userRole={userRole}
            />
          </motion.div>
        )}

        {currentScreen === 'blacklist' && (
          <motion.div
            key="blacklist-screen"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
          >
            <BlacklistManager 
              onBackToDashboard={() => setCurrentScreen('dashboard')}
              userRole={userRole}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

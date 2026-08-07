import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MedicalCredential, VerificationStatus, Sanction } from '../types';
import { 
  Plus, Search, SlidersHorizontal, Eye, Edit2, 
  Printer, CheckSquare, ShieldCheck, Mail, Info, FileText, ChevronLeft, ChevronRight,
  LogOut, Settings, Bell, HelpCircle, AlertCircle, AlertTriangle, User,
  Gavel, Trash2, Folder, FolderOpen, Upload, Download, CheckCircle, FileX, ShieldAlert,
  UserX, UserCheck
} from 'lucide-react';
import { getSanctions, saveSanction, deleteSanction, getCredentials } from '../lib/api';
import { exportCredentialingRosterToExcel } from '../lib/excelExport';
import ConfirmAuthModal from './ConfirmAuthModal';

interface DashboardProps {
  credentials: MedicalCredential[];
  userRole?: 'admin' | 'rh' | 'admision' | 'directorio' | 'guardias';
  onSelectCredential: (id: string) => void;
  onNavigateToForm: () => void;
  onNavigateToConsent: (id: string) => void;
  onNavigateToCredentials: () => void;
  onNavigateToSettings: () => void;
  onNavigateToDirectory: () => void;
  onNavigateToCalendar: () => void;
  onNavigateToBlacklist?: () => void;
  onUpdateCredentials: (updater: (prev: MedicalCredential[]) => MedicalCredential[]) => void;
  onLogout: () => void;
}

export default function Dashboard({ 
  credentials, 
  userRole = 'admin',
  onSelectCredential, 
  onNavigateToForm, 
  onNavigateToConsent,
  onNavigateToCredentials,
  onNavigateToSettings,
  onNavigateToDirectory,
  onNavigateToCalendar,
  onNavigateToBlacklist,
  onUpdateCredentials,
  onLogout 
}: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampusFilter, setSelectedCampusFilter] = useState<string>('todos');
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<'todos' | 'activos' | 'desactivados'>('todos');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'activos' | 'expirados' | 'sanciones'>('activos');
  const [selectedPhysicianId, setSelectedPhysicianId] = useState(credentials[0]?.id || '');
  const [assignedUsername, setAssignedUsername] = useState('e.rodriguez_medpro');
  const [vaultPin, setVaultPin] = useState('123456');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [credToDelete, setCredToDelete] = useState<MedicalCredential | null>(null);

  // Sanciones new states
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [isSancionadosModalOpen, setIsSancionadosModalOpen] = useState(false);
  const [formPhysicianId, setFormPhysicianId] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formType, setFormType] = useState('Extrañamiento Laboral');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formFilename, setFormFilename] = useState('');
  const [formPdfBase64, setFormPdfBase64] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [expandedFolderDoctor, setExpandedFolderDoctor] = useState<string | null>(null);

  // Folder migration states for C:\Users\Administrador.SANJOSE-HMO\Documents\CREDENCIALIZACION
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationSummary, setMigrationSummary] = useState<any>(null);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);

  const handleScanExistingFolders = async () => {
    setIsMigrating(true);
    try {
      const res = await fetch('/api/scan-existing-folders', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMigrationSummary(data);
        setIsMigrationModalOpen(true);
        showToast(`¡Escaneo exitoso! Se procesaron ${data.totalFolders} carpetas de médicos.`);
        const freshCreds = await getCredentials();
        if (freshCreds && freshCreds.length > 0) {
          onUpdateCredentials(() => freshCreds);
        }
      } else {
        alert("Error al escanear carpetas: " + (data.error || "Asegúrese de que existan carpetas en C:\\Users\\Administrador.SANJOSE-HMO\\Documents\\CREDENCIALIZACION"));
      }
    } catch (err: any) {
      console.error("Migration error:", err);
      alert("Error de conexión al servidor: " + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  // Fetch Sanciones from server when entering dashboard or switching tab
  useEffect(() => {
    async function loadSanctions() {
      try {
        const data = await getSanctions();
        setSanctions(data);
      } catch (err) {
        console.error("Failed to load list of legal sanctions:", err);
      }
    }
    loadSanctions();
  }, [activeSidebarTab]);

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert("Por favor, suba únicamente un archivo en formato PDF.");
      return;
    }
    
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        setFormPdfBase64(base64);
        setFormFilename(file.name);
        showToast(`Archivo "${file.name}" cargado listo para ser guardado.`);
      } catch (err) {
        console.error("FileReader conversion error:", err);
        alert("No se pudo procesar el archivo PDF.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setIsUploading(false);
      alert("Error en la lectura del archivo.");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitSanction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPhysicianId) {
      alert("Por favor, elija al médico que recibe esta sanción.");
      return;
    }
    if (!formReason.trim()) {
      alert("Por favor, especifique el motivo oficial de la sanción.");
      return;
    }
    if (!formPdfBase64) {
      alert("Es obligatorio adjuntar o cargar el archivo PDF firmado.");
      return;
    }

    const selectedPhysician = credentials.find(c => c.id === formPhysicianId);
    if (!selectedPhysician) {
      alert("El médico elegido no existe.");
      return;
    }

    const physicianFullName = `Dr. ${selectedPhysician.firstName} ${selectedPhysician.lastName}`;
    const newSanction: Sanction = {
      id: `SNC-${Date.now()}`,
      physicianId: selectedPhysician.id,
      physicianName: physicianFullName,
      reason: formReason,
      type: formType,
      date: formDate,
      filename: formFilename,
      pdfUrl: `/api/sanciones-files?physician=${encodeURIComponent(physicianFullName)}&file=${encodeURIComponent(formFilename)}`
    };

    const success = await saveSanction(newSanction, formPdfBase64);
    if (success) {
      showToast("La sanción ha sido debidamente archivada en el servidor.");
      // Soft reset form fields
      setFormPhysicianId('');
      setFormReason('');
      setFormType('Extrañamiento Laboral');
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormFilename('');
      setFormPdfBase64('');
      
      // Reload
      const updated = await getSanctions();
      setSanctions(updated);
    } else {
      alert("No se pudo completar el registro de la sanción.");
    }
  };

  const handleDeleteSanctionClick = async (sanctionId: string) => {
    if (!window.confirm("¿Está seguro que desea eliminar este registro de sanción?")) return;
    const success = await deleteSanction(sanctionId);
    if (success) {
      showToast("Registro de sanción removido.");
      const updated = await getSanctions();
      setSanctions(updated);
    }
  };

  // Reference configurations for analysis of dates
  const todayDateObj = new Date('2026-05-28');
  const sixMonthsLaterDateObj = new Date(todayDateObj);
  sixMonthsLaterDateObj.setMonth(sixMonthsLaterDateObj.getMonth() + 6);

  const docConfigMapping: Record<string, { name: string, severity: 'REQUERIDO' | 'PREVISIÓN' }> = {
    ine: { name: 'Identificación Oficial (INE)', severity: 'REQUERIDO' },
    acta: { name: 'Acta de Nacimiento Certificada', severity: 'PREVISIÓN' },
    curp: { name: 'CURP Oficial Validado', severity: 'REQUERIDO' },
    sat: { name: 'Cédula Fiscal (Situación SAT)', severity: 'REQUERIDO' },
    domicilio: { name: 'Comprobante de Domicilio', severity: 'PREVISIÓN' },
    banco: { name: 'Carátula de Cuenta de Banco', severity: 'PREVISIÓN' },
    titulo_prof: { name: 'Título de Médico Cirujano', severity: 'REQUERIDO' },
    cedula_prof: { name: 'Cédula Profesional Federal', severity: 'REQUERIDO' },
    permiso_son_prof: { name: 'Registro Estatal de Sonora (Gral)', severity: 'REQUERIDO' },
    cv: { name: 'Curriculum Vitae', severity: 'PREVISIÓN' },
    titulo_esp: { name: 'Título de la Especialidad', severity: 'REQUERIDO' },
    cedula_esp: { name: 'Cédula de Especialista Federal', severity: 'REQUERIDO' },
    permiso_son_esp: { name: 'Registro Estatal de Sonora (Esp)', severity: 'REQUERIDO' },
    consejo: { name: 'Certificación del Consejo', severity: 'PREVISIÓN' },
    acls: { name: 'Certificación de ACLS', severity: 'PREVISIÓN' },
    diplomas: { name: 'Diplomas y Formación', severity: 'PREVISIÓN' },
    solicitud_cred: { name: 'Solicitud de Credencialización', severity: 'REQUERIDO' },
    solicitud_priv: { name: 'Solicitud de Privilegios HSJ', severity: 'REQUERIDO' },
    cartas_rec: { name: 'Cartas de Recomendación', severity: 'PREVISIÓN' },
    carta_comp: { name: 'Carta Compromiso', severity: 'PREVISIÓN' }
  };

  const checkCredentialDocs = (c: MedicalCredential) => {
    const expired: Array<{ 
      name: string; 
      key: string;
      date: string; 
      severity: 'REQUERIDO' | 'PREVISIÓN';
      status: 'VENCIDO' | 'PROXIMO';
    }> = [];
    const expiries: Record<string, string> = {};

    if (c.cedulaExpiryDate && c.cedulaExpiryDate !== 'N/A') expiries['cedula_prof'] = c.cedulaExpiryDate;
    if (c.consejoExpiryDate && c.consejoExpiryDate !== 'N/A') expiries['consejo'] = c.consejoExpiryDate;
    if (c.ineExpiryDate && c.ineExpiryDate !== 'N/A') expiries['ine'] = c.ineExpiryDate;
    if (c.tituloExpiryDate && c.tituloExpiryDate !== 'N/A') expiries['titulo_prof'] = c.tituloExpiryDate;

    if (c.documentExpirations) {
      Object.entries(c.documentExpirations).forEach(([key, value]) => {
        if (value && value !== 'N/A') {
          expiries[key] = value;
        }
      });
    }

    Object.entries(expiries).forEach(([key, value]) => {
      const fileDate = new Date(value);
      const isExpiredObj = fileDate < todayDateObj;
      const isSoonObj = fileDate >= todayDateObj && fileDate <= sixMonthsLaterDateObj;

      if (isExpiredObj || isSoonObj) {
        const config = docConfigMapping[key] || { name: key.replace('_', ' ').toUpperCase(), severity: 'PREVISIÓN' };
        if (!expired.some(item => item.name === config.name)) {
          expired.push({ 
            name: config.name, 
            key: key,
            date: value, 
            severity: config.severity,
            status: isExpiredObj ? 'VENCIDO' : 'PROXIMO'
          });
        }
      }
    });

    return expired;
  };

  const docsWithAlerts = credentials.map(c => ({
    ...c,
    alerts: checkCredentialDocs(c)
  }));

  const allExpiredList = docsWithAlerts.flatMap(c => 
    c.alerts.filter(a => a.status === 'VENCIDO').map(a => ({ physician: c, doc: a }))
  );

  const allSoonList = docsWithAlerts.flatMap(c => 
    c.alerts.filter(a => a.status === 'PROXIMO').map(a => ({ physician: c, doc: a }))
  );

  const isRH = userRole === 'rh' || userRole === 'admision' || userRole === 'directorio' || userRole === 'guardias';
  const isDirectorioUser = userRole === 'directorio';
  const isGuardiasUser = userRole === 'guardias';

  // Dynamic search and active status filtering
  const filteredCredentials = credentials.filter(cred => {
    const fullName = `${cred.firstName} ${cred.lastName}`.toLowerCase();
    const npiMatches = cred.npi.includes(searchTerm);
    const searchMatches = fullName.includes(searchTerm.toLowerCase()) || npiMatches;
    
    const campusMatches = selectedCampusFilter === 'todos' || cred.campus === selectedCampusFilter;

    const isDeactivated = cred.status === 'DESACTIVADO' || cred.active === false;
    let activeMatches = true;
    if (selectedActiveFilter === 'activos') {
      activeMatches = !isDeactivated;
    } else if (selectedActiveFilter === 'desactivados') {
      activeMatches = isDeactivated;
    }

    return searchMatches && campusMatches && activeMatches;
  });

  // Toggle physician active / deactivated status
  const handleTogglePhysicianActive = (cred: MedicalCredential) => {
    const isCurrentlyDisabled = cred.status === 'DESACTIVADO' || cred.active === false;
    const actionText = isCurrentlyDisabled ? 'activar' : 'desactivar';
    
    if (window.confirm(`¿Está seguro de que desea ${actionText} al médico Dr. ${cred.firstName} ${cred.lastName}?`)) {
      onUpdateCredentials(prev => prev.map(c => {
        if (c.id === cred.id) {
          if (isCurrentlyDisabled) {
            const restoredStatus = (c.hasCedula && c.hasTitulo) ? 'VERIFICADO' : 'PENDIENTE';
            return { ...c, status: restoredStatus, active: true };
          } else {
            return { ...c, status: 'DESACTIVADO', active: false };
          }
        }
        return c;
      }));

      showToast(
        isCurrentlyDisabled 
          ? `Dr. ${cred.firstName} ${cred.lastName} ha sido REACTIVADO exitosamente.` 
          : `Dr. ${cred.firstName} ${cred.lastName} ha sido DESACTIVADO del sistema.`
      );
    }
  };

  // Permanently delete physician with confirmation and password modal
  const handleDeletePhysician = (cred: MedicalCredential) => {
    setCredToDelete(cred);
  };

  const handleConfirmDeletePhysician = () => {
    if (!credToDelete) return;
    onUpdateCredentials(prev => prev.filter(c => c.id !== credToDelete.id));
    showToast(`El médico Dr. ${credToDelete.firstName} ${credToDelete.lastName} ha sido ELIMINADO permanentemente del sistema.`);
    setCredToDelete(null);
  };

  // Handle Target select update for Identity Card
  const handlePhysicianSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPhysicianId(id);
    const found = credentials.find(c => c.id === id);
    if (found) {
      setAssignedUsername(`${found.firstName.charAt(0).toLowerCase()}.${found.lastName.toLowerCase()}_medpro`);
    }
  };

  // Assign Username and trigger enrollment
  const handleInitializeEnrollment = () => {
    const target = credentials.find(c => c.id === selectedPhysicianId);
    if (!target) return;

    onUpdateCredentials(prev => prev.map(c => {
      if (c.id === selectedPhysicianId) {
        return {
          ...c,
          identityAssigned: assignedUsername,
          // Shift to pending verification if missing documents doesn't block it
          status: c.status === 'FALTAN_DOCUMENTOS' ? 'PENDIENTE' : c.status
        };
      }
      return c;
    }));

    showToast(`Inscripción iniciada para ${target.firstName} ${target.lastName}. Invitación enviada a ${assignedUsername}@medverify.pro`);
  };

  // Vault Security PIN Setup
  const handleUpdateVaultKey = () => {
    showToast(`PIN de firma criptográfica actualizado correctamente.`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleBatchVerify = () => {
    onUpdateCredentials(prev => prev.map(c => ({
      ...c,
      status: 'VERIFICADO'
    })));
    showToast('Verificación por lote ejecutada. Todos los registros médicos autorizados en la cadena.');
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-body text-slate-900 pb-16 selection:bg-red-100 selection:text-red-900">
      
      {/* Top Navbar Header */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm flex justify-between items-center px-8 h-16 no-print">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-bold tracking-tighter text-red-900 flex items-center gap-1 font-headline">
            CredSJ
          </span>
          <nav className="hidden md:flex items-center space-x-6">
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                if (isDirectorioUser) {
                  showToast('Su perfil de Directorio está restringido al módulo de Directorio.');
                } else if (isGuardiasUser) {
                  showToast('Su perfil de Guardias está restringido al calendario de Guardias.');
                }
              }}
              className={`font-headline text-sm font-bold tracking-tight pb-1 border-b-2 ${
                isDirectorioUser || isGuardiasUser
                  ? 'text-slate-400 border-transparent cursor-not-allowed'
                  : 'text-red-700 border-red-700'
              }`}
            >
              Panel de Control
            </a>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                if (isDirectorioUser || isGuardiasUser || userRole === 'rh' || userRole === 'admision') {
                  showToast('No tiene permisos para dar de alta o firmar nuevos registros de médicos.');
                } else {
                  onNavigateToForm(); 
                }
              }}
              className={`font-headline text-sm font-medium tracking-tight transition-colors flex items-center gap-1 ${
                isRH ? 'text-slate-450 cursor-not-allowed' : 'text-slate-600 hover:text-red-800'
              }`}
            >
              {isRH && <span className="material-symbols-outlined text-[14px]">lock</span>}
              Registro Médicos
            </a>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                if (isDirectorioUser) {
                  showToast('Acceso denegado: El perfil de Directorio no puede visualizar expedientes clínicos o de credenciales.');
                } else if (isGuardiasUser) {
                  showToast('Acceso denegado: El perfil de Guardias no puede visualizar expedientes clínicos o de credenciales.');
                } else {
                  onNavigateToCredentials(); 
                }
              }}
              className={`font-headline text-sm font-medium tracking-tight transition-colors flex items-center gap-1 ${
                isDirectorioUser || isGuardiasUser ? 'text-slate-450 cursor-not-allowed' : 'text-slate-600 hover:text-red-800'
              }`}
            >
              {(isDirectorioUser || isGuardiasUser) && <span className="material-symbols-outlined text-[14px]">lock</span>}
              Credenciales
            </a>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                if (isGuardiasUser) {
                  showToast('Su rol de Guardias está enfocado al Calendario de Guardias.');
                } else {
                  onNavigateToDirectory(); 
                }
              }}
              className={`font-headline text-sm font-medium tracking-tight transition-colors flex items-center gap-1 ${
                isGuardiasUser ? 'text-slate-450 cursor-not-allowed' : 'text-slate-600 hover:text-red-800'
              }`}
            >
              {isGuardiasUser && <span className="material-symbols-outlined text-[14px]">lock</span>}
              Directorio Médico
            </a>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                if (isDirectorioUser) {
                  showToast('Su rol de Directorio está limitado a administrar el Directorio.');
                } else {
                  onNavigateToCalendar(); 
                }
              }}
              className={`font-headline text-sm font-medium tracking-tight transition-colors flex items-center gap-1 ${
                isDirectorioUser ? 'text-slate-450 cursor-not-allowed' : 'text-slate-600 hover:text-red-800'
              }`}
            >
              {isDirectorioUser && <span className="material-symbols-outlined text-[14px]">lock</span>}
              Calendario Guardias
            </a>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                if (isDirectorioUser || isGuardiasUser) {
                  showToast('Acceso restringido para ver Consentimiento Legal de Incorporaciones.');
                } else if (credentials.length > 0) {
                  onNavigateToConsent(credentials[0].id);
                } else {
                  alert("Por favor, registre primero un médico para poder visualizar el consentimiento legal de incorporación.");
                }
              }}
              className={`font-headline text-sm font-medium tracking-tight transition-colors flex items-center gap-1 ${
                isDirectorioUser || isGuardiasUser ? 'text-slate-450 cursor-not-allowed' : 'text-slate-600 hover:text-red-800'
              }`}
            >
              {(isDirectorioUser || isGuardiasUser) && <span className="material-symbols-outlined text-[14px]">lock</span>}
              Legal
            </a>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                if (userRole !== 'admin') {
                  showToast('Acceso denegado: El menú de Ajustes y Operadores está reservado únicamente para Administradores.');
                } else {
                  onNavigateToSettings(); 
                }
              }}
              className={`font-headline text-sm font-medium tracking-tight transition-colors flex items-center gap-1 ${
                userRole !== 'admin' ? 'text-slate-450 cursor-not-allowed' : 'text-slate-600 hover:text-red-800'
              }`}
            >
              {userRole !== 'admin' && <span className="material-symbols-outlined text-[14px]">lock</span>}
              Ajustes
            </a>

            {/* Unnamed Lock Icon Section for Blacklist / Vetados */}
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                if (onNavigateToBlacklist) onNavigateToBlacklist();
              }}
              title="Sección Restringida - Médicos Vetados"
              className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg transition-all flex items-center justify-center cursor-pointer hover:scale-105"
            >
              <span className="material-symbols-outlined text-[18px] text-red-700 font-bold">lock</span>
            </a>
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            type="button"
            onClick={onNavigateToSettings}
            title="Configuración de Usuarios, Permisos y Servidor"
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </button>

          {userRole !== 'admin' && (
            <span className="bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider select-none flex items-center gap-1.5 shadow-2xs">
              <span className={`w-1.5 h-1.5 rounded-full ${userRole === 'directorio' || userRole === 'guardias' ? 'bg-[#ff7b00] animate-pulse' : 'bg-amber-500 animate-ping'}`} />
              {userRole === 'rh' ? 'Solo Lectura (Recursos)' :
               userRole === 'admision' ? 'Solo Lectura (Admisión)' :
               userRole === 'directorio' ? 'Gestión Directorio' :
               userRole === 'guardias' ? 'Gestión Guardias' : 'Solo Lectura'}
            </span>
          )}

          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700 shadow-2xs cursor-pointer" title="Usuario Conectado">
            <User className="w-4.5 h-4.5 text-slate-700" />
          </div>

          <button 
            onClick={onLogout}
            title="Cerrar Sesión"
            className="p-2 text-[#af101a] hover:bg-red-50 rounded-full transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Floating alert toast notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-[100] max-w-md bg-slate-900 text-white rounded-xl shadow-2xl p-4 flex items-center gap-3 border border-slate-800">
          <Info className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-xs font-semibold">{toastMessage}</p>
        </div>
      )}

      {/* Side Navigation Block - Silver Grey Background */}
      <aside className="h-screen w-64 fixed left-0 top-16 bg-slate-200/90 backdrop-blur-xs flex flex-col py-6 space-y-1 z-30 no-print border-r border-slate-300 shadow-xs">
        <div className="px-5 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-350 flex items-center justify-center text-slate-700 shadow-2xs flex-shrink-0">
            <User className="w-5.5 h-5.5 text-slate-700" />
          </div>
          <div className="min-w-0">
            <p className="font-headline font-bold text-sm text-slate-900 truncate">
              {userRole === 'admin' ? 'Administrador' :
               userRole === 'rh' ? 'Recursos Humanos' :
               userRole === 'admision' ? 'Operador Admisión' :
               userRole === 'directorio' ? 'Gestor Directorio' :
               userRole === 'guardias' ? 'Coord. Guardias' : 'Operador'}
            </p>
            <p className="text-[10px] text-slate-600 font-extrabold uppercase tracking-widest mt-0.5 truncate">
              {userRole === 'admin' ? 'Supervisión Activa' :
               userRole === 'rh' ? 'Consulta de RRHH' :
               userRole === 'admision' ? 'Lectura Admisión' :
               userRole === 'directorio' ? 'Edición Directorio' :
               userRole === 'guardias' ? 'Coordinador Guardia' : 'Consulta'}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 px-3">
          <a 
            href="#" 
            className={`flex items-center px-4 py-3 font-body text-xs uppercase tracking-wider transition-all rounded-xl ${
              activeSidebarTab === 'activos' 
                ? 'bg-white text-[#af101a] font-extrabold shadow-sm border border-slate-300/80' 
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-300/70 font-bold'
            }`}
            onClick={(e) => { e.preventDefault(); setActiveSidebarTab('activos'); showToast('Mostrando listado de médicos registrados.'); }}
          >
            <span className="material-symbols-outlined mr-3 text-lg font-bold">clinical_notes</span>
            Médicos Activos
          </a>
          <a 
            href="#" 
            className={`flex items-center px-4 py-3 font-body text-xs uppercase tracking-wider transition-all rounded-xl ${
              activeSidebarTab === 'expirados' 
                ? 'bg-white text-[#af101a] font-extrabold shadow-sm border border-slate-300/80' 
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-300/70 font-bold'
            }`}
            onClick={(e) => { e.preventDefault(); setActiveSidebarTab('expirados'); showToast('Análisis de documentos fuera de vigencia.'); }}
          >
            <span className="material-symbols-outlined mr-3 text-lg">history_edu</span>
            Docs. Expirados
          </a>
          <a 
            href="#" 
            className={`flex items-center px-4 py-3 font-body text-xs uppercase tracking-wider transition-all rounded-xl relative ${
              activeSidebarTab === 'sanciones' 
                ? 'bg-white text-[#af101a] font-extrabold shadow-sm border border-slate-300/80' 
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-300/70 font-bold'
            }`}
            onClick={(e) => { e.preventDefault(); setActiveSidebarTab('sanciones'); showToast('Control de sanciones y actas administrativas.'); }}
          >
            <span className="material-symbols-outlined mr-3 text-lg text-rose-600">gavel</span>
            Sanciones Médicas
            {sanctions.length > 0 && (
              <span className="ml-auto bg-red-650 text-white font-mono text-[9px] font-black px-1.5 py-0.5 rounded-full">
                {sanctions.length}
              </span>
            )}
          </a>
          <a 
            href="#" 
            className="flex items-center px-4 py-3 font-body text-xs uppercase tracking-wider transition-all rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-300/70 font-bold"
            onClick={(e) => { e.preventDefault(); onNavigateToDirectory(); }}
          >
            <span className="material-symbols-outlined mr-3 text-lg font-bold">contacts</span>
            Directorio Médico
          </a>
          <a 
            href="#" 
            className="flex items-center px-4 py-3 font-body text-xs uppercase tracking-wider transition-all rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-300/70 font-bold"
            onClick={(e) => { e.preventDefault(); onNavigateToCalendar(); }}
          >
            <span className="material-symbols-outlined mr-3 text-lg font-bold">calendar_month</span>
            Calendario Guardias
          </a>
        </nav>

        {!isRH && (
          <div className="px-4 mb-4 space-y-2">
            <button 
              onClick={onNavigateToForm}
              className="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-md hover:bg-primary-hover hover:translate-y-[-1px] transition-all cursor-pointer"
            >
              Nueva Credencial
            </button>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200">
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); alert('Verificación de nodos de cadena de bloques de CredSJ: Funcionando correctamente.'); }}
            className="flex items-center px-6 py-2.5 font-body text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined mr-3 text-lg">lan</span>
            Salud del Sistema
          </a>
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); alert('Soporte inmediato vía WhatsApp de TI: +52 (662) 200-XXXX'); }}
            className="flex items-center px-6 py-2.5 font-body text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined mr-3 text-lg">contact_support</span>
            Soporte Técnico
          </a>
        </div>
      </aside>

      {/* Main Container Area */}
      <main className="ml-64 mt-16 p-8 lg:p-10 bg-slate-50 min-h-[calc(100vh-64px)]">
        
        {/* Header Section Hero with Big Title */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-12">
          <div className="max-w-2xl">
            <h1 className="font-headline text-5xl xl:text-6xl font-extrabold text-slate-900 leading-none tracking-tight mb-3">
              Mando de <span className="text-primary">Credenciales</span>.
            </h1>
            <p className="font-body text-slate-500 text-lg">
              Supervisión meticulosa de las autorizaciones de práctica médica y el cumplimiento legal.
            </p>
          </div>
        </div>

        {/* Dynamic Bento Box Grid */}
        {activeSidebarTab === 'activos' ? (
          <>
            {/* Dynamic Compliance Alert Banner Dashboard */}
            <div className="mb-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Card 1: Expired Docs (Vencidos) */}
              <div id="vencidos-alertas-panel" className="bg-white rounded-2xl shadow-xs border border-red-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
                <div className="bg-[#af101a] px-5 py-3.5 flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-white animate-pulse" />
                    <h4 className="font-headline font-black text-xs uppercase tracking-widest">Documentos Expirados / Caducados</h4>
                  </div>
                  <span className="bg-white text-[#af101a] text-[11px] font-black px-2.5 py-0.5 rounded-full font-mono shadow-xs">
                    {allExpiredList.length} EXPIRADOS
                  </span>
                </div>
                
                <div className="p-5 flex-1 flex flex-col justify-between min-h-[220px]">
                  {allExpiredList.length === 0 ? (
                    <div className="py-6 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 shadow-sm border border-emerald-100">
                        <span className="material-symbols-outlined font-black text-lg">check_circle</span>
                      </div>
                      <p className="font-extrabold text-slate-800 text-xs">¡Excelente! Sin Documentos Vencidos</p>
                      <p className="text-slate-400 text-[11px] mt-1">Todos los médicos activos están operando con credenciales vigentes.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mb-4">
                      <p className="text-[11px] text-red-950 font-bold leading-relaxed flex items-center gap-1 bg-red-50 p-2 rounded-lg border border-red-100/60">
                        <AlertTriangle className="w-4.5 h-4.5 text-[#af101a] flex-shrink-0" />
                        <span>Alerta: Médicos bloqueados preventivamente para firmar notas clínicas:</span>
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                        {allExpiredList.map((item, idx) => (
                          <div 
                            key={idx} 
                            className="bg-red-50/50 border-l-4 border-l-[#af101a] p-2.5 rounded-r-xl border border-red-100/60 flex items-center justify-between gap-1.5 transition-all hover:bg-red-50"
                          >
                            <div className="min-w-0">
                              <p className="font-extrabold text-xs text-red-950 truncate">
                                {item.physician.firstName} {item.physician.lastName}
                              </p>
                              <p className="text-[10px] text-red-800 font-bold mt-0.5">
                                {item.doc.name}
                              </p>
                            </div>
                            <span className="bg-red-100 text-red-950 border border-red-200 text-[9px] font-black px-2 py-0.5 rounded font-mono flex-shrink-0">
                              Vencido: {item.doc.date}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <button 
                    id="btn-auditar-vencidos"
                    onClick={() => { setActiveSidebarTab('expirados'); showToast("Cargando portafolio de auditoría de documentos vencidos."); }}
                    className="w-full text-center py-2.5 bg-red-100/50 hover:bg-[#af101a] text-[#af101a] hover:text-white border border-red-200 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-xs active:scale-97 mt-2"
                  >
                    Ver Detalles de Expirados
                  </button>
                </div>
              </div>

              {/* Card 2: About to Expire Docs (Por Vencer) */}
              <div id="por-vencer-alertas-panel" className="bg-white rounded-2xl shadow-xs border border-amber-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
                <div className="bg-amber-600 px-5 py-3.5 flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[19px] text-white">schedule</span>
                    <h4 className="font-headline font-black text-xs uppercase tracking-widest">Documentos Próximos a Vencer (&lt; 6 meses)</h4>
                  </div>
                  <span className="bg-white text-amber-700 text-[11px] font-black px-2.5 py-0.5 rounded-full font-mono shadow-xs">
                    {allSoonList.length} POR VENCER
                  </span>
                </div>
                
                <div className="p-5 flex-1 flex flex-col justify-between min-h-[220px]">
                  {allSoonList.length === 0 ? (
                    <div className="py-6 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-2 shadow-sm border border-amber-100/60">
                        <span className="material-symbols-outlined font-black text-lg">verified_user</span>
                      </div>
                      <p className="font-extrabold text-slate-800 text-xs">Sin Vencimientos Próximos</p>
                      <p className="text-slate-400 text-[11px] mt-1">Ninguna credencial crítica expira dentro del colchón de 6 meses.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mb-4">
                      <p className="text-[11px] text-amber-950 font-bold leading-relaxed flex items-center gap-1 bg-amber-50/50 p-2 rounded-lg border border-amber-200/55">
                        <span className="material-symbols-outlined text-[16px] text-amber-700 flex-shrink-0 font-bold">hourglass_empty</span>
                        <span>Previsión Preventiva: Requieren re-validación médica próximamente:</span>
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                        {allSoonList.map((item, idx) => (
                          <div 
                            key={idx} 
                            className="bg-amber-50/30 border-l-4 border-l-amber-500 p-2.5 rounded-r-xl border border-amber-100/50 flex items-center justify-between gap-1.5 transition-all hover:bg-amber-50"
                          >
                            <div className="min-w-0">
                              <p className="font-extrabold text-xs text-slate-900 truncate">
                                {item.physician.firstName} {item.physician.lastName}
                              </p>
                              <p className="text-[10px] text-amber-800 font-bold mt-0.5">
                                {item.doc.name}
                              </p>
                            </div>
                            <span className="bg-amber-100/70 text-amber-900 border border-amber-200 text-[9px] font-black px-2 py-0.5 rounded font-mono flex-shrink-0">
                              Vence: {item.doc.date}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <button 
                    id="btn-auditar-por-vencer"
                    onClick={() => { setActiveSidebarTab('expirados'); showToast("Cargando planificador de renovaciones de documentos por vencer."); }}
                    className="w-full text-center py-2.5 bg-amber-50 hover:bg-amber-600 text-amber-900 hover:text-white border border-amber-150 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-xs active:scale-97 mt-2"
                  >
                    Ver Detalles por Vencer
                  </button>
                </div>
              </div>

              {/* Card 3: Sanciones (Disciplinary Actions) */}
              <div 
                id="sanciones-dashboard-card" 
                onClick={() => setIsSancionadosModalOpen(true)}
                className="bg-white rounded-2xl shadow-xs border border-red-200 overflow-hidden flex flex-col transition-all hover:shadow-md cursor-pointer group"
              >
                <div className="bg-slate-900 px-5 py-3.5 flex items-center justify-between text-white group-hover:bg-[#af101a] transition-colors">
                  <div className="flex items-center gap-2">
                    <Gavel className="w-5 h-5 text-red-500 group-hover:text-white transition-colors" />
                    <h4 className="font-headline font-black text-xs uppercase tracking-widest">Sanciones / Actas Activas</h4>
                  </div>
                  <span className="bg-red-700 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full font-mono shadow-xs">
                    {Array.from(new Set(sanctions.map(s => s.physicianId))).length} MDs
                  </span>
                </div>
                
                <div className="p-5 flex-1 flex flex-col justify-between min-h-[220px]">
                  {sanctions.length === 0 ? (
                    <div className="py-6 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mb-2 shadow-sm border border-slate-100">
                        <Gavel className="w-5 h-5" />
                      </div>
                      <p className="font-extrabold text-slate-800 text-xs">Sin Sanciones Clínicas</p>
                      <p className="text-slate-400 text-[11px] mt-1">Todos los médicos operan con conducta intachable en el expediente.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mb-4">
                      <p className="text-[11px] text-slate-600 font-bold leading-relaxed flex items-center gap-1 bg-slate-50 p-2 rounded-lg border border-slate-200/50">
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <span>Resumen disciplinario: {sanctions.length} total.</span>
                      </p>
                      <div className="max-h-36 overflow-y-auto space-y-2 pr-1 no-scrollbar text-left scroll-smooth">
                        {sanctions.slice(0, 3).map((s) => (
                          <div 
                            key={s.id} 
                            className="bg-slate-50/50 hover:bg-red-50 border-l-4 border-l-red-600 p-2 rounded-r-xl border border-slate-100 flex items-center justify-between gap-1.5 transition-all"
                          >
                            <div className="min-w-0">
                              <p className="font-extrabold text-[11px] text-slate-900 truncate">
                                {s.physicianName}
                              </p>
                              <p className="text-[9px] text-[#af101a] font-black mt-0.5 uppercase tracking-wide">
                                {s.type}
                              </p>
                            </div>
                            <span className="bg-slate-200 text-slate-800 text-[9px] font-bold px-1.5 py-0.5 rounded truncate max-w-24">
                              {s.reason}
                            </span>
                          </div>
                        ))}
                        {sanctions.length > 3 && (
                          <p className="text-[10px] text-slate-400 text-center font-bold italic">
                            + {sanctions.length - 3} registros adicionales...
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsSancionadosModalOpen(true); }}
                    className="w-full text-center py-2.5 bg-slate-100 hover:bg-[#af101a] text-slate-900 hover:text-white border border-slate-200 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-xs active:scale-97 mt-2"
                  >
                    Ver Informe Sancionados
                  </button>
                </div>
              </div>

            </div>

            {/* Dynamic Table: Registration logs ledger */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <h3 className="font-headline text-xl font-bold text-slate-900">Registro de Inscripciones Activas</h3>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                  {/* Export Base de Datos Excel Button */}
                  <button
                    onClick={async () => {
                      try {
                        // Fetch fresh live credentials directly from database
                        const res = await fetch('/api/credentials');
                        if (res.ok) {
                          const freshDbCredentials = await res.json();
                          exportCredentialingRosterToExcel(freshDbCredentials);
                        } else {
                          exportCredentialingRosterToExcel(credentials);
                        }
                      } catch (e) {
                        exportCredentialingRosterToExcel(credentials);
                      }
                    }}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-4 py-2.5 text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
                    title="Exportar base de datos completa de médicos a Excel (.xlsx)"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar Excel (.xlsx)</span>
                  </button>

                  {/* Dynamic campus selector */}
                  <select
                    value={selectedCampusFilter}
                    onChange={(e) => setSelectedCampusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#af101a] focus:border-[#af101a] transition-all cursor-pointer shadow-sm text-center"
                  >
                    <option value="todos">🏥 Todas las Sedes</option>
                    <option value="Hermosillo">🌵 Hermosillo</option>
                    <option value="Guaymas">🌊 Guaymas</option>
                    <option value="Obregón">🚜 Obregón</option>
                  </select>

                  {/* Active / Deactivated status selector */}
                  <select
                    value={selectedActiveFilter}
                    onChange={(e) => setSelectedActiveFilter(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#af101a] focus:border-[#af101a] transition-all cursor-pointer shadow-sm text-center"
                  >
                    <option value="todos">👥 Todos los Estados</option>
                    <option value="activos">✅ Solo Activos</option>
                    <option value="desactivados">🚫 Solo Desactivados</option>
                  </select>

                  {/* Dynamic search bar */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
                    <input 
                      type="text"
                      placeholder="Filtrar por nombre o Cédula..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-full pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary w-full text-slate-800"
                    />
                  </div>

                  <button 
                    onClick={() => { setSearchTerm(''); setSelectedCampusFilter('todos'); }}
                    title="Limpiar filtros"
                    className="p-2.5 text-slate-400 hover:text-slate-600 rounded-full transition-colors border border-slate-200 hidden sm:block self-center"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-8 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Detalles del Médico</th>
                      <th className="px-8 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Fecha de Inscripción</th>
                      <th className="px-8 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Estado de Verificación</th>
                      <th className="px-8 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Documentos</th>
                      <th className="px-8 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {credentials.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-8 py-16 text-center">
                          <div className="flex flex-col items-center justify-center space-y-4">
                            <div className="w-14 h-14 bg-slate-100 text-[#af101a] rounded-full flex items-center justify-center shadow-sm">
                              <span className="material-symbols-outlined text-2xl font-bold">clinical_notes</span>
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-800 text-sm">Roster de Médicos Vacío</p>
                              <p className="text-slate-400 text-xs mt-1">Actualmente no cuenta con médicos registrados para validación.</p>
                            </div>
                            <button 
                              onClick={onNavigateToForm}
                              className="bg-[#af101a] hover:bg-[#85040d] text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 cursor-pointer inline-flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm font-bold">person_add</span>
                              Registrar Primer Médico
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : filteredCredentials.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-medium">
                          No se encontraron registros médicos que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      filteredCredentials.map(cred => {
                        const isDeactivated = cred.status === 'DESACTIVADO' || cred.active === false;
                        return (
                        <tr key={cred.id} className={`hover:bg-slate-50/50 transition-colors group ${isDeactivated ? 'bg-slate-100/60 opacity-80' : ''}`}>
                          
                          {/* Column 1: Physician description with Avatar fallback */}
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center font-bold text-slate-500 text-sm tracking-wider border border-slate-200 overflow-hidden">
                                {cred.portraitUrl ? (
                                  <img 
                                    src={cred.portraitUrl} 
                                    alt="Portrait" 
                                    className="w-full h-full object-cover" 
                                    referrerPolicy="no-referrer" 
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  `${cred.firstName[0]}${cred.lastName[0]}`
                                )}
                              </div>
                              <div>
                                <div className="flex items-center flex-wrap gap-2">
                                  <p className={`font-bold text-sm ${isDeactivated ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                    {cred.firstName} {cred.lastName}, {cred.id.startsWith('MT') ? 'DO' : 'MD'}
                                  </p>
                                  {isDeactivated ? (
                                    <span className="bg-slate-200 text-slate-700 border border-slate-300 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                      DESACTIVADO
                                    </span>
                                  ) : (() => {
                                    const alerts = checkCredentialDocs(cred);
                                    const expiredCount = alerts.filter(a => a.status === 'VENCIDO').length;
                                    const soonCount = alerts.filter(a => a.status === 'PROXIMO').length;
                                    return (
                                      <div className="flex gap-1.5 flex-shrink-0">
                                        {expiredCount > 0 && (
                                          <span className="bg-red-100 text-red-950 border border-red-250 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow-xs animate-pulse flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-700 inline-block"></span>
                                            {expiredCount} VENCIDO{expiredCount > 1 ? 'S' : ''}
                                          </span>
                                        )}
                                        {soonCount > 0 && (
                                          <span className="bg-amber-100 text-amber-950 border border-amber-300 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow-xs flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                                            {soonCount} POR VENCER
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">
                                  Folio: <span className="font-extrabold text-slate-700 bg-slate-100 px-1 py-0.5 rounded mr-1">{cred.folio || 'N/A'}</span> | Cédula: {cred.npi} | {cred.specialty} | 
                                  Sede: <span className="text-[#af101a] font-bold uppercase text-[10px] bg-slate-100 px-1.5 py-0.5 rounded ml-0.5 mr-1">{cred.campus || 'Hermosillo'}</span> | 
                                  Tipo: <span className={`font-bold uppercase text-[10px] px-1.5 py-0.5 rounded ml-0.5 ${cred.physicianType === 'Externo' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-red-50 text-[#af101a] border border-red-100'}`}>{cred.physicianType === 'Externo' ? 'Externo' : 'Staff'}</span>
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Column 2: Date */}
                          <td className="px-8 py-5 text-sm font-medium text-slate-600 italic">
                            {cred.enrollmentDate}
                          </td>

                          {/* Column 3: Custom structured badges */}
                          <td className="px-8 py-5">
                            {isDeactivated ? (
                              <span className="bg-slate-200 text-slate-700 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-tighter ring-1 ring-slate-300 flex items-center gap-1 w-max">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                Desactivado
                              </span>
                            ) : cred.status === 'VERIFICADO' ? (
                              <span className="bg-[#a0f399]/30 text-[#002204] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter ring-1 ring-[#a0f399]/70">
                                Verificado
                              </span>
                            ) : cred.status === 'PENDIENTE' ? (
                              <span className="bg-[#bee9ff] text-[#001f2a] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter ring-1 ring-blue-200">
                                Pendiente
                              </span>
                            ) : (
                              <span className="bg-[#ffdad6] text-[#93000a] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter ring-1 ring-red-200">
                                Faltan Documentos
                              </span>
                            )}
                          </td>

                          {/* Column 4: Document icons status list */}
                          <td className="px-8 py-5">
                            <div className="flex -space-x-1">
                              {cred.hasCedula ? (
                                <div className="w-7 h-7 rounded border-2 border-white bg-slate-100 flex items-center justify-center shadow-sm" title="Cédula Federal Cargada">
                                  <span className="material-symbols-outlined text-xs text-primary font-bold">description</span>
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded border-2 border-white bg-red-50 flex items-center justify-center shadow-sm" title="Falta Cédula Profesional">
                                  <span className="material-symbols-outlined text-xs text-red-500 font-bold">priority_high</span>
                                </div>
                              )}

                              {cred.hasTitulo ? (
                                <div className="w-7 h-7 rounded border-2 border-white bg-slate-100 flex items-center justify-center shadow-sm" title="Título Universitario Cargado">
                                  <span className="material-symbols-outlined text-xs text-[#1b6d24] font-bold">verified_user</span>
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded border-2 border-white bg-slate-50 flex items-center justify-center shadow-sm" title="Falta Título Médico">
                                  <span className="material-symbols-outlined text-xs text-slate-300">hourglass_empty</span>
                                </div>
                              )}

                              {cred.fingerprintMapped && (
                                <div className="w-7 h-7 rounded border-2 border-white bg-slate-100 flex items-center justify-center shadow-sm" title="Registro biométrico verificado">
                                  <span className="material-symbols-outlined text-xs text-primary font-bold">badge</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Column 5: Group of row-specific actions */}
                          <td className="px-8 py-5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* Toggle Active / Deactivate Button */}
                              {!isRH && (
                                isDeactivated ? (
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePhysicianActive(cred)}
                                    title="Activar / Reactivar Médico"
                                    className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-full transition-all cursor-pointer"
                                  >
                                    <UserCheck className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePhysicianActive(cred)}
                                    title="Desactivar / Inactivar Médico"
                                    className="p-2 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                                  >
                                    <UserX className="w-4 h-4" />
                                  </button>
                                )
                              )}

                              <button 
                                type="button"
                                onClick={() => onNavigateToConsent(cred.id)}
                                title="Ver Consentimiento Legal"
                                className="p-2 text-slate-500 hover:text-primary hover:bg-red-50 rounded-full transition-all cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {!isRH && (
                                <>
                                  <button 
                                    type="button"
                                    onClick={() => onSelectCredential(cred.id)}
                                    title="Editar Atributos de Registro"
                                    className="p-2 text-slate-500 hover:text-primary hover:bg-red-50 rounded-full transition-all cursor-pointer"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleDeletePhysician(cred)}
                                    title="Eliminar Médico permanentemente"
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>

                        </tr>
                      );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Control Panel */}
              <div className="px-8 py-4 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500">
                  Mostrando {credentials.length === 0 ? 0 : filteredCredentials.length} de {credentials.length} médicos en total
                </p>
                <div className="flex items-center gap-1">
                  <button 
                    disabled 
                    className="p-2 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-30 cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="w-8 h-8 rounded-lg bg-primary text-white text-xs font-bold shadow-sm">1</button>
                  <button onClick={() => showToast('Abriendo página 2 de registros.')} className="w-8 h-8 rounded-lg hover:bg-slate-200 text-xs font-bold text-slate-600">2</button>
                  <button onClick={() => showToast('Abriendo página 3 de registros.')} className="w-8 h-8 rounded-lg hover:bg-slate-200 text-xs font-bold text-slate-600">3</button>
                  <button 
                    onClick={() => showToast('Siguiente página de registros.')} 
                    className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : activeSidebarTab === 'expirados' ? (
          /* "Docs. Expirados" Sidebar Tab: List expired files per physician */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100">
              <h3 className="font-headline text-xl font-bold text-slate-900">Análisis de Documentos Expirados por Médico</h3>
              <p className="text-xs text-slate-400 mt-1">Comparando el estado del portafolio médico con la fecha de corte auditada del hospital.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Profesional Clínico</th>
                    <th className="px-8 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Documento Vencido</th>
                    <th className="px-8 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Vence / Venció</th>
                    <th className="px-8 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Alerta de Seguridad</th>
                    <th className="px-8 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-right">Controles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {credentials.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <div className="w-14 h-14 bg-red-50 text-red-650 rounded-full flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined text-2xl font-bold">history_edu</span>
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-800 text-sm">Sin Médicos Registrados</p>
                            <p className="text-slate-400 text-xs mt-1">No hay médicos cargados en el sistema para evaluar vencimiento de documentos.</p>
                          </div>
                          <button 
                            onClick={onNavigateToForm}
                            className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase"
                          >
                            Registrar Médico
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (() => {
                    const doctorsWithExpired = credentials.map(c => {
                      const expired: Array<{ 
                        name: string; 
                        date: string; 
                        severity: 'REQUERIDO' | 'PREVISIÓN';
                        status: 'VENCIDO' | 'PROXIMO';
                      }> = [];
                      const todayDate = new Date('2026-05-28');
                      const sixMonthsLater = new Date(todayDate);
                      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
                      const expiries: Record<string, string> = {};

                      const docConfig: Record<string, { name: string, severity: 'REQUERIDO' | 'PREVISIÓN' }> = {
                        ine: { name: 'Identificación Oficial (INE)', severity: 'REQUERIDO' },
                        acta: { name: 'Acta de Nacimiento Certificada', severity: 'PREVISIÓN' },
                        curp: { name: 'CURP Oficial Validado', severity: 'REQUERIDO' },
                        sat: { name: 'Cédula Fiscal (Situación SAT)', severity: 'REQUERIDO' },
                        domicilio: { name: 'Comprobante de Domicilio', severity: 'PREVISIÓN' },
                        banco: { name: 'Carátula de Cuenta de Banco', severity: 'PREVISIÓN' },
                        titulo_prof: { name: 'Título de Médico Cirujano', severity: 'REQUERIDO' },
                        cedula_prof: { name: 'Cédula Profesional Federal', severity: 'REQUERIDO' },
                        permiso_son_prof: { name: 'Registro Estatal de Sonora (Gral)', severity: 'REQUERIDO' },
                        cv: { name: 'Curriculum Vitae', severity: 'PREVISIÓN' },
                        titulo_esp: { name: 'Título de la Especialidad', severity: 'REQUERIDO' },
                        cedula_esp: { name: 'Cédula de Especialista Federal', severity: 'REQUERIDO' },
                        permiso_son_esp: { name: 'Registro Estatal de Sonora (Esp)', severity: 'REQUERIDO' },
                        consejo: { name: 'Certificación del Consejo', severity: 'PREVISIÓN' },
                        acls: { name: 'Certificación de ACLS', severity: 'PREVISIÓN' },
                        diplomas: { name: 'Diplomas y Formación', severity: 'PREVISIÓN' },
                        solicitud_cred: { name: 'Solicitud de Credencialización', severity: 'REQUERIDO' },
                        solicitud_priv: { name: 'Solicitud de Privilegios HSJ', severity: 'REQUERIDO' },
                        cartas_rec: { name: 'Cartas de Recomendación', severity: 'PREVISIÓN' },
                        carta_comp: { name: 'Carta Compromiso', severity: 'PREVISIÓN' }
                      };

                      // 1. Populate from top-level fields
                      if (c.cedulaExpiryDate && c.cedulaExpiryDate !== 'N/A') expiries['cedula_prof'] = c.cedulaExpiryDate;
                      if (c.consejoExpiryDate && c.consejoExpiryDate !== 'N/A') expiries['consejo'] = c.consejoExpiryDate;
                      if (c.ineExpiryDate && c.ineExpiryDate !== 'N/A') expiries['ine'] = c.ineExpiryDate;
                      if (c.tituloExpiryDate && c.tituloExpiryDate !== 'N/A') expiries['titulo_prof'] = c.tituloExpiryDate;

                      // 2. Populate from c.documentExpirations Map
                      if (c.documentExpirations) {
                        Object.entries(c.documentExpirations).forEach(([key, value]) => {
                          if (value && value !== 'N/A') {
                            expiries[key] = value;
                          }
                        });
                      }

                      // 3. Evaluate expiry status & 6-month buffer warnings
                      Object.entries(expiries).forEach(([key, value]) => {
                        const fileDate = new Date(value);
                        const isExpiredObj = fileDate < todayDate;
                        const isSoonObj = fileDate >= todayDate && fileDate <= sixMonthsLater;

                        if (isExpiredObj || isSoonObj) {
                          const config = docConfig[key] || { name: key.replace('_', ' ').toUpperCase(), severity: 'PREVISIÓN' };
                          if (!expired.some(item => item.name === config.name)) {
                            expired.push({ 
                              name: config.name, 
                              date: value, 
                              severity: config.severity,
                              status: isExpiredObj ? 'VENCIDO' : 'PROXIMO'
                            });
                          }
                        }
                      });

                      return { ...c, expiredDocs: expired };
                    }).filter(c => c.expiredDocs.length > 0);

                    if (doctorsWithExpired.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="px-8 py-16 text-center">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <span className="material-symbols-outlined text-4xl text-emerald-600 font-bold">check_circle</span>
                              <p className="font-extrabold text-slate-800 text-sm">Todos los Expedientes Vigentes</p>
                              <p className="text-slate-400 text-xs">No se detectaron cédulas, INE o certificaciones de consejo vencidas o por vencer en los próximos 6 meses.</p>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return doctorsWithExpired.flatMap(doc => 
                      doc.expiredDocs.map((exp, expIdx) => {
                        const isExpired = exp.status === 'VENCIDO';
                        return (
                          <tr 
                            key={`${doc.id}-${expIdx}`} 
                            className={`transition-all border-b border-slate-100 ${
                              isExpired 
                                ? 'bg-red-50/35 hover:bg-red-50/60 border-l-4 border-l-[#af101a]' 
                                : 'bg-amber-50/20 hover:bg-amber-50/40 border-l-4 border-l-amber-500'
                            }`}
                          >
                            <td className="px-8 py-5.5 font-bold text-slate-800 text-sm">
                              {doc.firstName} {doc.lastName} <span className="font-semibold text-slate-400 text-xs block mt-0.5">({doc.specialty})</span>
                            </td>
                            <td className="px-8 py-5.5 text-xs font-black text-slate-800 font-body">
                              <span className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-700 animate-pulse' : 'bg-amber-500'}`} />
                                {exp.name}
                              </span>
                            </td>
                            <td className="px-8 py-5.5 text-xs font-mono font-black">
                              {isExpired ? (
                                <span className="text-[#af101a] bg-red-100/70 border border-red-200 px-2 py-0.5 rounded">Venció: {exp.date}</span>
                              ) : (
                                <span className="text-amber-900 bg-amber-100/70 border border-amber-250 px-2 py-0.5 rounded">Por vencer: {exp.date}</span>
                              )}
                            </td>
                            <td className="px-8 py-5.5 flex flex-wrap gap-2 items-center">
                              {isExpired ? (
                                <span className="bg-[#af101a] text-white text-[9px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase shadow-xs">
                                  🔴 CADUCADO / EXPIRADO
                                </span>
                              ) : (
                                <span className="bg-amber-500 text-white text-[9px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase shadow-xs">
                                  ⚠️ ALERTA: PRÓXIMO EN MENOS DE 6 MESES
                                </span>
                              )}
                              {exp.severity === 'REQUERIDO' ? (
                                <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-black px-2 py-1 rounded-md tracking-wider uppercase">
                                  CRÍTICO (Sanción / Bloqueo)
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold px-2 py-1 rounded-md tracking-wider uppercase">
                                  PREVENTIVO
                                </span>
                              )}
                            </td>
                            <td className="px-8 py-5.5 text-right whitespace-nowrap">
                              <button
                                onClick={() => onSelectCredential(doc.id)}
                                className={`text-[10px] font-black uppercase px-3 py-2 rounded-xl border transition-all cursor-pointer shadow-xs ${
                                  isExpired
                                    ? 'bg-red-50 hover:bg-[#af101a] text-[#af101a] hover:text-white border-red-200'
                                    : 'bg-amber-50 hover:bg-amber-600 text-amber-900 hover:text-white border-amber-200'
                                }`}
                              >
                                Actualizar Doc
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    );
                  })()}
                </tbody>
              </table>
            </div>
            
            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 font-semibold">
              <span>* Al detectar un documento crítico vencido, el médico no podrá firmar expedientes en el sistema SIHO de manera temporal.</span>
              <span className="uppercase text-slate-400 text-[10px]">Auditoría San José</span>
            </div>
          </div>
        ) : (
          /* "Sanciones Médicas" Sidebar Tab */
          <div className="space-y-8">
            <div className="bg-slate-900 rounded-2xl shadow-md border border-slate-800 p-8 text-white relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <div className="bg-red-500/10 text-red-400 text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full inline-block border border-red-500/20 mb-3">
                    ⚖️ CONTROL DE SANCIONES Y ACTAS ADMINISTRATIVAS
                  </div>
                  <h3 className="font-headline text-2xl font-black tracking-tight text-white">Gestión Disciplinaria y Expedientes Jurídicos</h3>
                  <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
                    Registre actas administrativas, extrañamientos laborales y amonestaciones de los profesionales clínicos, adjuntando e indexando las minutas firmadas digitalmente. Los expedientes se organizan automáticamente en carpetas físicas individuales por médico en el servidor local.
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="bg-slate-800 border border-slate-755 rounded-xl px-5 py-3 text-center min-w-[110px] shadow-sm">
                    <p className="text-2xl font-black text-white">{sanctions.length}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sanciones</p>
                  </div>
                  <div className="bg-slate-800 border border-slate-755 rounded-xl px-5 py-3 text-center min-w-[110px] shadow-sm">
                    <p className="text-2xl font-black text-rose-500">{Array.from(new Set(sanctions.map(s => s.physicianId))).length}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">MDs Implicados</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Form to register a new sanction */}
              <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                <div className="border-b border-slate-100 pb-4 mb-6">
                  <h4 className="font-headline text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-red-650" />
                    Registrar Nueva Sanción
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">Consolide el acta disciplinaria correspondiente.</p>
                </div>

                <form onSubmit={handleSubmitSanction} className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                      Seleccionar Médico *
                    </label>
                    <select
                      value={formPhysicianId}
                      onChange={(e) => setFormPhysicianId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold outline-hidden focus:ring-2 focus:ring-red-500/25 focus:border-red-650 transition-all cursor-pointer"
                      required
                    >
                      <option value="">-- Seleccione un médico --</option>
                      {credentials.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName} ({c.specialty || 'Especialidad'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                      Tipo de Sanción *
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold outline-hidden focus:ring-2 focus:ring-red-500/25 focus:border-red-650 transition-all cursor-pointer"
                      required
                    >
                      <option value="Extrañamiento Laboral">Extrañamiento Laboral</option>
                      <option value="Acta Administrativa">Acta Administrativa</option>
                      <option value="Amonestación Escrita">Amonestación Escrita</option>
                      <option value="Suspensión Temporal">Suspensión Temporal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                      Fecha del Suceso *
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold outline-hidden focus:ring-2 focus:ring-red-500/25 focus:border-red-650 transition-all font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                      Motivo / Descripción de la Sanción *
                    </label>
                    <textarea
                      value={formReason}
                      onChange={(e) => setFormReason(e.target.value)}
                      placeholder="Describa el motivo, incidentes o violaciones cometidas..."
                      className="w-full h-24 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 text-xs font-semibold outline-hidden focus:ring-2 focus:ring-red-500/25 focus:border-red-650 transition-all resize-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-550 mb-1.5">
                      Documento PDF Firmado *
                    </label>
                    
                    <div className="border-2 border-dashed border-slate-250 hover:border-red-400 rounded-xl p-5 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col items-center justify-center text-center relative cursor-pointer group">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handlePdfUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <Upload className="w-8 h-8 text-slate-400 group-hover:text-red-600 transition-colors mb-2" />
                      <p className="text-[11px] font-black text-slate-700">Arrastre o seleccione el acta PDF</p>
                      <p className="text-[9px] text-slate-400 mt-1 uppercase">Solo archivos PDF firmados</p>
                    </div>

                    {formFilename && (
                      <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-850 text-[10.5px] font-bold">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileText className="w-4.5 h-4.5 text-emerald-600 flex-shrink-0" />
                          <span className="truncate">{formFilename}</span>
                        </div>
                        <span className="text-[9px] text-emerald-600 font-extrabold tracking-wider uppercase font-mono px-2 py-0.5 bg-emerald-100 rounded-md">LISTO</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isUploading}
                    className="w-full py-3 bg-[#af101a] hover:bg-red-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Archivar Sanción
                  </button>
                </form>
              </div>

              {/* Right Column: Folders structure + Sanctions History list */}
              <div className="lg:col-span-7 space-y-8">
                {/* Simulated folder directory tree in server storage */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                  <div className="border-b border-slate-100 pb-4 mb-6 flex items-center justify-between">
                    <div>
                      <h4 className="font-headline text-lg font-extrabold text-slate-900 flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-amber-500" />
                        Archivo Físico del Servidor (Carpetas)
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">Directorio local con una subcarpeta por cada médico sancionado.</p>
                    </div>
                    <span className="bg-slate-100 border border-slate-200 text-slate-500 font-mono text-[9px] font-black px-2 py-1 rounded">
                      📁 /Sanciones
                    </span>
                  </div>

                  {sanctions.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <Folder className="w-12 h-12 text-slate-300 mb-3" />
                      <p className="font-extrabold text-slate-400 text-xs uppercase tracking-wide">Directorio Vacío</p>
                      <p className="text-slate-450 text-[11px] mt-1">No se han creado carpetas de sanción por el momento.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-150 rounded-xl overflow-hidden bg-slate-50/50 p-4 font-mono text-xs text-slate-705">
                      <div className="flex items-center gap-2 text-slate-500 pb-2.5 border-b border-slate-200/50 mb-3">
                        <span className="text-[11px] font-black text-slate-650">📂 Sanciones/</span>
                        <span className="text-[8px] bg-slate-200/80 text-slate-600 px-1 py-0.5 rounded font-bold">DRIVE</span>
                      </div>

                      <div className="space-y-2.5">
                        {Array.from(new Set(sanctions.map(s => s.physicianName))).map((doctorName) => {
                          const docSanctions = sanctions.filter(s => s.physicianName === doctorName);
                          const isExpanded = expandedFolderDoctor === doctorName;
                          return (
                            <div key={doctorName} className="pl-3 border-l-2 border-slate-200 ml-1">
                              <div 
                                onClick={() => setExpandedFolderDoctor(isExpanded ? null : doctorName)}
                                className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-150 hover:bg-amber-50/10 cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <FolderOpen className="w-4 h-4 text-amber-500 fill-amber-100" />
                                  ) : (
                                    <Folder className="w-4 h-4 text-amber-500 fill-amber-50" />
                                  )}
                                  <span className="font-extrabold text-slate-800 text-[11.5px]">{doctorName}</span>
                                </div>
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                  {docSanctions.length} archivo(s)
                                </span>
                              </div>

                              {isExpanded && (
                                <div className="pl-6 mt-1.5 space-y-1.5">
                                  {docSanctions.map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-1.5 bg-slate-50/50 hover:bg-slate-100 rounded border border-slate-150 transition-colors">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                        <span className="truncate text-[10.5px] font-semibold text-slate-650">{s.filename}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                                        <a
                                          href={s.pdfUrl}
                                          download={s.filename}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="p-1 px-1.5 text-[9px] font-black uppercase text-[#af101a] bg-red-50 hover:bg-red-650 hover:text-white rounded transition-colors"
                                        >
                                          DESCARGAR
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sanciones History list view */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
                  <div className="border-b border-slate-100 pb-4 mb-4">
                    <h4 className="font-headline text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <Gavel className="w-5 h-5 text-[#af101a]" />
                      Historial de Sanciones Clínicas
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">Registros disciplinarios guardados localmente.</p>
                  </div>

                  {sanctions.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <CheckCircle className="w-12 h-12 text-emerald-555 mb-3" />
                      <p className="font-extrabold text-slate-400 text-xs uppercase">Sin Sanciones Clínicas</p>
                      <p className="text-slate-450 text-[11px] mt-1">El personal de salud no tiene incidencias reportadas.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                      {sanctions.map((s) => (
                        <div
                          key={s.id}
                          className="p-4 bg-slate-50/50 border border-slate-150 rounded-xl hover:border-slate-350 transition-colors relative"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                                  s.type === 'Acta Administrativa'
                                    ? 'bg-rose-50 border-rose-200 text-[#af101a]'
                                    : 'bg-amber-50 border-amber-200 text-amber-800'
                                }`}>
                                  {s.type}
                                </span>
                                <span className="text-slate-450 font-mono text-[9px] font-bold">{s.date}</span>
                              </div>
                              <h5 className="font-extrabold text-slate-800 mt-2 text-xs">
                                {s.physicianName}
                              </h5>
                              <p className="text-slate-500 font-semibold mt-1 text-[11px] leading-relaxed">
                                {s.reason}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <a
                                href={s.pdfUrl}
                                download={s.filename}
                                target="_blank"
                                rel="noreferrer"
                                title="Ver Acta Firmada"
                                className="p-2 bg-white hover:bg-red-50 text-slate-600 hover:text-[#af101a] border border-slate-200 rounded-xl transition-all shadow-xs"
                              >
                                <Eye className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => handleDeleteSanctionClick(s.id)}
                                title="Eliminar Sanción"
                                className="p-2 bg-white hover:bg-rose-50 text-slate-600 hover:text-red-655 border border-slate-200 rounded-xl transition-all shadow-xs"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="border-t border-slate-150 mt-3 pt-2 flex items-center gap-1.5 text-slate-450 text-[10px] font-bold">
                            <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{s.filename}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Informe Detallado de Médicos Sancionados */}
      {isSancionadosModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto no-print animate-fadeIn">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-slate-800"
          >
            {/* Header */}
            <div className="bg-slate-900 px-6 py-5 flex items-center justify-between text-white border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Gavel className="w-5.5 h-5.5 text-red-500" />
                <div>
                  <h3 className="font-headline font-black text-sm uppercase tracking-wider text-white">Informe Detallado de Conducta</h3>
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Estadísticas disciplinarias de médicos</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSancionadosModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block font-bold leading-none">Médicos con Incidencias</span>
                  <span className="text-3xl font-black text-slate-955 mt-2 block leading-none">
                    {Array.from(new Set(sanctions.map(s => s.physicianId))).length}
                  </span>
                </div>
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest block font-extrabold text-red-750 leading-none">Total Sanciones Registradas</span>
                  <span className="text-3xl font-black text-[#af101a] mt-2 block leading-none">
                    {sanctions.length}
                  </span>
                </div>
              </div>

              {/* Doctors breakdown list */}
              <div>
                <h4 className="font-headline font-black text-[#af101a] text-xs uppercase tracking-widest mb-3 border-b border-red-100 pb-3">
                  Médicos Sancionados en el Registro de Personal
                </h4>
                
                {sanctions.length === 0 ? (
                  <div className="py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 font-bold text-xs">
                    No se han registrado sanciones activas aún.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.from(new Set(sanctions.map(s => s.physicianName))).map((doctorName) => {
                      const docSanctions = sanctions.filter(s => s.physicianName === doctorName);
                      const docId = docSanctions[0]?.physicianId;
                      const credDetails = credentials.find(c => c.id === docId);
                      
                      return (
                        <div key={doctorName} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="text-left">
                              <h5 className="font-black text-slate-900 text-sm">
                                {doctorName}
                              </h5>
                              <p className="text-[10px] text-slate-405 font-bold uppercase tracking-wider mt-0.5">
                                {credDetails?.specialty || 'General'} • Sede {credDetails?.campus || 'Hospital General'}
                              </p>
                            </div>
                            <span className="bg-red-50 border border-red-200 text-[#af101a] font-mono text-[10.5px] font-black px-2.5 py-0.5 rounded-full flex-shrink-0">
                              {docSanctions.length} {docSanctions.length === 1 ? 'Sanción' : 'Sanciones'}
                            </span>
                          </div>

                          {/* Sanction records details list */}
                          <div className="space-y-2">
                            {docSanctions.map((s, idx) => (
                              <div key={s.id} className="bg-slate-50 border border-slate-150 p-3 rounded-lg text-xs space-y-1 text-left">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase text-red-700">
                                    {idx + 1}. {s.type}
                                  </span>
                                  <span className="text-slate-400 font-mono text-[9px] font-semibold">{s.date}</span>
                                </div>
                                <p className="text-slate-700 font-semibold leading-relaxed">
                                  <span className="font-extrabold text-slate-800">Motivo: </span>{s.reason}
                                </p>
                                <div className="flex items-center justify-between gap-1.5 text-slate-500 text-[10px] font-bold mt-2 bg-white px-2 py-1.5 rounded border border-slate-200">
                                  <div className="flex items-center gap-1 min-w-0">
                                    <FileText className="w-3.5 h-3.5 text-red-550 scroll-shrink-0" />
                                    <span className="truncate">{s.filename}</span>
                                  </div>
                                  <a 
                                    href={s.pdfUrl} 
                                    download={s.filename}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="bg-red-50 text-[#af101a] font-black text-[9px] uppercase px-2 py-0.5 rounded-md hover:bg-[#af101a] hover:text-white transition-colors"
                                  >
                                    VER PDF
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-right">
              <button 
                onClick={() => setIsSancionadosModalOpen(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-[#af101a] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Cerrar Informe
              </button>
            </div>
          </motion.div>
        </div>
      )}



      {/* Floating Action Help Trigger */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-4 no-print z-40">
        <button 
          onClick={() => showToast('Mesa de Ayuda MedVerify Pro: TI de guardia disponible en ext. 1040.')}
          className="w-14 h-14 bg-white text-primary rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-all border border-slate-200 cursor-pointer"
        >
          <HelpCircle className="w-6 h-6" />
        </button>
      </div>

      {/* Delete Confirmation Password Modal */}
      {credToDelete && (
        <ConfirmAuthModal
          isOpen={!!credToDelete}
          onClose={() => setCredToDelete(null)}
          onConfirm={handleConfirmDeletePhysician}
          title="Eliminación Permanente de Expediente Médico"
          badgeText="ACCION DE SEGURIDAD PROTEGIDA"
          description={`Está a punto de borrar definitivamente al médico Dr. ${credToDelete.firstName} ${credToDelete.lastName} (${credToDelete.id}) del sistema. Esta acción eliminará su registro de forma permanente. Ingrese su contraseña de autorización:`}
          confirmText="Eliminar Definitivamente"
          cancelText="Cancelar"
          variant="danger"
        />
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BlacklistPhysician, MedicalCredential, DirectoryPhysician } from '../types';
import { getBlacklist, saveBlacklistPhysician, deleteBlacklistPhysician, getCredentials, getDirectory } from '../lib/api';
import { exportBlacklistToExcel } from '../lib/excelExport';
import ConfirmAuthModal from './ConfirmAuthModal';
import { 
  ShieldAlert, Lock, UserX, Search, Plus, ArrowLeft, 
  Trash2, AlertTriangle, Building2, Calendar, Phone, 
  Mail, FileText, CheckCircle2, RefreshCw, X, Shield, Download, LayoutGrid, Table
} from 'lucide-react';

interface BlacklistManagerProps {
  onBackToDashboard: () => void;
  userRole?: string;
}

export default function BlacklistManager({ onBackToDashboard, userRole = 'admin' }: BlacklistManagerProps) {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('credsj_blacklist_unlocked') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [blacklist, setBlacklist] = useState<BlacklistPhysician[]>([]);
  const [credentials, setCredentials] = useState<MedicalCredential[]>([]);
  const [directory, setDirectory] = useState<DirectoryPhysician[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampus, setSelectedCampus] = useState<'Todos' | 'Hermosillo' | 'Guaymas' | 'Obregón'>('Todos');
  const [viewMode, setViewMode] = useState<'tabla' | 'tarjetas'>('tabla');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isModalRegisteredOpen, setIsModalRegisteredOpen] = useState(false);
  const [isModalExternalOpen, setIsModalExternalOpen] = useState(false);
  const [vetoToRemove, setVetoToRemove] = useState<BlacklistPhysician | null>(null);

  // Registered physician selection form state
  const [selectedRegisteredId, setSelectedRegisteredId] = useState('');
  const [registeredReason, setRegisteredReason] = useState('');
  const [registeredDate, setRegisteredDate] = useState(new Date().toISOString().split('T')[0]);
  const [registeredNotes, setRegisteredNotes] = useState('');

  // External physician registration form state
  const [extFirstName, setExtFirstName] = useState('');
  const [extLastName, setExtLastName] = useState('');
  const [extSpecialty, setExtSpecialty] = useState('');
  const [extNpi, setExtNpi] = useState('');
  const [extRfc, setExtRfc] = useState('');
  const [extPhone, setExtPhone] = useState('');
  const [extEmail, setExtEmail] = useState('');
  const [extCampus, setExtCampus] = useState<'Hermosillo' | 'Guaymas' | 'Obregón'>('Hermosillo');
  const [extReason, setExtReason] = useState('');
  const [extBannedAt, setExtBannedAt] = useState(new Date().toISOString().split('T')[0]);
  const [extNotes, setExtNotes] = useState('');

  // Load data on start
  useEffect(() => {
    async function loadData() {
      try {
        const [bl, creds, dir] = await Promise.all([
          getBlacklist(),
          getCredentials(),
          getDirectory()
        ]);
        setBlacklist(bl);
        setCredentials(creds);
        setDirectory(dir);
      } catch (e) {
        console.error("Failed loading blacklist manager data", e);
      }
    }
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === 'sanjose2026$') {
      setIsUnlocked(true);
      sessionStorage.setItem('credsj_blacklist_unlocked', 'true');
      setAuthError('');
      showToast('Acceso autorizado a la Lista Negra Institucional.');
    } else {
      setAuthError('Contraseña de seguridad incorrecta. Intente nuevamente.');
    }
  };

  // Add registered doctor to blacklist
  const handleSaveRegisteredToBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegisteredId) {
      showToast('⚠️ Por favor elija a un médico de la lista.');
      return;
    }
    if (!registeredReason.trim()) {
      showToast('⚠️ Es obligatorio especificar el motivo oficial de veto.');
      return;
    }

    const credMatch = credentials.find(c => c.id === selectedRegisteredId);
    const dirMatch = directory.find(d => d.id === selectedRegisteredId);

    let fullName = '';
    let specialty = '';
    let npi = '';
    let rfc = '';
    let phone = '';
    let email = '';
    let campus: 'Hermosillo' | 'Guaymas' | 'Obregón' = 'Hermosillo';

    if (credMatch) {
      fullName = `Dr. ${credMatch.firstName} ${credMatch.lastName}`.trim();
      specialty = credMatch.specialty || 'General';
      npi = credMatch.npi || '';
      rfc = credMatch.rfc || '';
      phone = credMatch.phone || '';
      email = credMatch.email || '';
      campus = credMatch.campus || 'Hermosillo';
    } else if (dirMatch) {
      fullName = dirMatch.fullName;
      specialty = dirMatch.specialty || dirMatch.especialidadUnificada || 'General';
      phone = dirMatch.cellPhone || '';
      email = dirMatch.correo || '';
    } else {
      showToast('⚠️ Médico no encontrado.');
      return;
    }

    const newItem: BlacklistPhysician = {
      id: `BLK-${Date.now()}`,
      physicianId: selectedRegisteredId,
      fullName,
      specialty,
      npi,
      rfc,
      phone,
      email,
      campus,
      reason: registeredReason.trim(),
      bannedAt: registeredDate,
      isExternal: false,
      notes: registeredNotes.trim() || undefined,
      status: 'VETADO'
    };

    const ok = await saveBlacklistPhysician(newItem);
    if (ok) {
      setBlacklist(prev => [newItem, ...prev.filter(b => b.id !== newItem.id)]);
      showToast(`✅ ${fullName} ha sido incorporado a la Lista Negra.`);
      setIsModalRegisteredOpen(false);
      setSelectedRegisteredId('');
      setRegisteredReason('');
      setRegisteredNotes('');
    } else {
      showToast('❌ Error al guardar en el servidor.');
    }
  };

  // Save external non-registered doctor to blacklist
  const handleSaveExternalToBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extFirstName.trim() || !extLastName.trim()) {
      showToast('⚠️ Por favor ingrese el nombre y apellidos completos.');
      return;
    }
    if (!extReason.trim()) {
      showToast('⚠️ El motivo del veto es obligatorio.');
      return;
    }

    let fullName = `${extFirstName.trim()} ${extLastName.trim()}`;
    if (!fullName.toUpperCase().startsWith('DR.') && !fullName.toUpperCase().startsWith('DRA.')) {
      fullName = `Dr. ${fullName}`;
    }

    const newItem: BlacklistPhysician = {
      id: `BLK-EXT-${Date.now()}`,
      fullName,
      firstName: extFirstName.trim(),
      lastName: extLastName.trim(),
      specialty: extSpecialty.trim() || 'Médico General',
      npi: extNpi.trim() || undefined,
      rfc: extRfc.trim() || undefined,
      phone: extPhone.trim() || undefined,
      email: extEmail.trim() || undefined,
      campus: extCampus,
      reason: extReason.trim(),
      bannedAt: extBannedAt,
      isExternal: true,
      notes: extNotes.trim() || undefined,
      status: 'VETADO'
    };

    const ok = await saveBlacklistPhysician(newItem);
    if (ok) {
      setBlacklist(prev => [newItem, ...prev.filter(b => b.id !== newItem.id)]);
      showToast(`✅ ${fullName} (Médico Externo) registrado en la Lista Negra.`);
      setIsModalExternalOpen(false);
      setExtFirstName('');
      setExtLastName('');
      setExtSpecialty('');
      setExtNpi('');
      setExtRfc('');
      setExtPhone('');
      setExtEmail('');
      setExtReason('');
      setExtNotes('');
    } else {
      showToast('❌ Error al guardar en el servidor.');
    }
  };

  // Confirm removal of veto
  const handleConfirmRemoveVeto = async () => {
    if (!vetoToRemove) return;
    const ok = await deleteBlacklistPhysician(vetoToRemove.id);
    if (ok) {
      setBlacklist(prev => prev.filter(b => b.id !== vetoToRemove.id));
      showToast(`✅ Veto removido exitosamente para ${vetoToRemove.fullName}.`);
    } else {
      showToast('❌ Error al eliminar registro en el servidor.');
    }
    setVetoToRemove(null);
  };

  // Filter list
  const filteredList = blacklist.filter(item => {
    const matchesSearch = 
      item.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.specialty && item.specialty.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.npi && item.npi.includes(searchTerm)) ||
      (item.rfc && item.rfc.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.reason && item.reason.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCampus = selectedCampus === 'Todos' || item.campus === selectedCampus;

    return matchesSearch && matchesCampus;
  });

  // LOCK SCREEN VIEW (Light Theme)
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white border border-red-200 rounded-3xl p-8 shadow-2xl relative text-center font-body"
        >
          <div className="mx-auto w-16 h-16 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center text-red-700 mb-6 shadow-xs">
            <ShieldAlert className="w-9 h-9" />
          </div>

          <h2 className="text-xl font-extrabold font-headline text-slate-900 tracking-tight mb-2">
            Módulo de Médicos Vetados
          </h2>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed font-medium">
            Control de Restricción e Incompatibilidad Sanitaria San José.
            Ingrese su clave institucional para desbloquear el registro general de vetados.
          </p>

          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div>
              <input 
                type="password"
                required
                autoFocus
                placeholder="Contraseña de autorización..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 text-center font-mono tracking-widest focus:outline-none focus:border-[#af101a] focus:ring-2 focus:ring-[#af101a]/20"
              />
            </div>

            {authError && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{authError}</span>
              </motion.div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onBackToDashboard}
                className="flex-1 py-3 px-4 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Regresar
              </button>
              <button
                type="submit"
                className="flex-1 py-3 px-4 bg-[#af101a] hover:bg-[#85040d] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Desbloquear
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  // MAIN BLACKLIST VIEW (WHITE THEME AS REQUESTED)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-body pb-24">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToDashboard}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Regresar al Panel de Control"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700 shadow-xs">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-red-100 text-red-800 border border-red-200 text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded-full uppercase">
                    SEGURIDAD INSTITUCIONAL
                  </span>
                  <h1 className="text-lg font-black font-headline tracking-tight text-slate-900 flex items-center gap-2">
                    Nómina de Médicos Vetados
                  </h1>
                </div>
                <p className="text-xs text-slate-500">
                  Registro de Restricción e Incompatibilidad Sanitaria - Hospital San José
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => exportBlacklistToExcel(blacklist)}
              className="flex-1 md:flex-initial px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              title="Exportar archivo Excel (.xlsx)"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Tabla Vetados (.xlsx)</span>
            </button>

            <button
              onClick={() => setIsModalRegisteredOpen(true)}
              className="flex-1 md:flex-initial px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-900 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <UserX className="w-4 h-4 text-red-700" />
              <span>Vetar Médico Registrado</span>
            </button>

            <button
              onClick={() => setIsModalExternalOpen(true)}
              className="flex-1 md:flex-initial px-4 py-2.5 bg-[#af101a] hover:bg-[#85040d] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Vetado Externo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Banner Alert */}
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3.5 shadow-xs">
          <ShieldAlert className="w-6 h-6 text-red-700 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900 leading-relaxed font-medium">
            <strong className="text-red-950 font-bold block mb-0.5">RESTRICCIÓN SANITARIA Y DE INGRESO PERMANENTE:</strong>
            Los profesionales incluidos en esta nómina tienen prohibido el acceso o práctica médica en cualquiera de los campus del Hospital San José. Notifique de inmediato a la Dirección Médica ante cualquier discrepancia.
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-8 flex flex-col md:flex-row gap-4 justify-between items-center shadow-xs">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Buscar por médico vetado, cédula, RFC, especialidad o motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#af101a] focus:ring-1 focus:ring-[#af101a]"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-xs text-slate-500 font-bold whitespace-nowrap">Campus:</span>
            <select
              value={selectedCampus}
              onChange={(e: any) => setSelectedCampus(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#af101a] cursor-pointer"
            >
              <option value="Todos">Todos los Campus</option>
              <option value="Hermosillo">Hermosillo</option>
              <option value="Guaymas">Guaymas</option>
              <option value="Obregón">Obregón</option>
            </select>

            {/* View switcher: Table vs Cards */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('tabla')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'tabla' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista de Tabla"
              >
                <Table className="w-3.5 h-3.5" />
                <span>Tabla Vetados</span>
              </button>
              <button
                onClick={() => setViewMode('tarjetas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'tarjetas' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista de Tarjetas"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Tarjetas</span>
              </button>
            </div>
          </div>
        </div>

        {/* TABLA DE MÉDICOS VETADOS */}
        {filteredList.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-3xl p-8 shadow-xs">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">No hay registros de veto</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              No se encontraron médicos en la lista negra que coincidan con los criterios de búsqueda.
            </p>
          </div>
        ) : viewMode === 'tabla' ? (
          /* Structured Table View */
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-headline text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Tabla Oficial de Médicos Vetados</span>
                <span className="bg-red-50 text-red-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-red-200">
                  {filteredList.length} registros
                </span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-body text-slate-800">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Médico Vetado</th>
                    <th className="px-6 py-3.5">Cédula / RFC</th>
                    <th className="px-6 py-3.5">Especialidad</th>
                    <th className="px-6 py-3.5">Campus</th>
                    <th className="px-6 py-3.5">Motivo Oficial de Veto</th>
                    <th className="px-6 py-3.5">Fecha Registro</th>
                    <th className="px-6 py-3.5">Tipo</th>
                    <th className="px-6 py-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredList.map((item) => (
                    <tr key={item.id} className="hover:bg-red-50/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-red-100 text-red-800 font-black text-xs flex items-center justify-center shrink-0 border border-red-200">
                            {item.fullName.replace('Dr. ', '').replace('Dra. ', '').charAt(0)}
                          </div>
                          <div>
                            <span className="block font-bold text-slate-900 text-xs">{item.fullName}</span>
                            {item.phone && <span className="text-[10px] text-slate-400 font-normal">{item.phone}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-semibold text-slate-700 block">{item.npi || 'S/N'}</span>
                        {item.rfc && <span className="font-mono text-[10px] text-slate-400 block">{item.rfc}</span>}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {item.specialty || 'General'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                          {item.campus || 'Hermosillo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-red-900 font-medium italic text-xs leading-snug line-clamp-2">
                          "{item.reason}"
                        </p>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-semibold whitespace-nowrap">
                        {item.bannedAt}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                          item.isExternal 
                            ? 'bg-amber-50 text-amber-800 border-amber-200' 
                            : 'bg-red-50 text-red-800 border-red-200'
                        }`}>
                          {item.isExternal ? 'Externo' : 'Registrado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setVetoToRemove(item)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover Veto</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Cards Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredList.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-red-200 hover:border-red-400 rounded-2xl overflow-hidden shadow-xs flex flex-col transition-all duration-200"
              >
                <div className="bg-red-900 px-4 py-2 border-b border-red-950 flex items-center justify-between text-white">
                  <span className="text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5">
                    <UserX className="w-3.5 h-3.5 text-red-200" />
                    VETADO - ACCESO PROHIBIDO
                  </span>
                  <span className="text-[9px] bg-red-950/80 text-red-200 font-bold px-2 py-0.5 rounded-full uppercase border border-red-800">
                    {item.isExternal ? 'Externo' : 'Registrado'}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="mb-3">
                    <h3 className="text-base font-black text-slate-900 font-headline tracking-tight">
                      {item.fullName}
                    </h3>
                    <p className="text-xs text-red-800 font-bold flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      {item.specialty} • Campus {item.campus || 'Hermosillo'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 border border-slate-200 p-3 rounded-xl mb-4 text-slate-700">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Cédula Prof:</span>
                      <span className="font-mono font-semibold">{item.npi || 'S/N'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">RFC:</span>
                      <span className="font-mono font-semibold">{item.rfc || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Teléfono:</span>
                      <span className="font-semibold">{item.phone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Fecha Veto:</span>
                      <span className="font-semibold">{item.bannedAt}</span>
                    </div>
                  </div>

                  <div className="bg-red-50/70 border border-red-200 p-3.5 rounded-xl mb-4 flex-1">
                    <span className="text-[10px] font-extrabold text-red-900 uppercase tracking-widest block mb-1">
                      Motivo Oficial de Restricción:
                    </span>
                    <p className="text-xs text-red-950 font-medium leading-relaxed italic">
                      "{item.reason}"
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => setVetoToRemove(item)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remover Veto</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL 1: Vetar Médico Registrado */}
      <AnimatePresence>
        {isModalRegisteredOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-red-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-slate-800 font-body"
            >
              <button 
                onClick={() => setIsModalRegisteredOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-headline text-slate-900">
                    Vetar Médico Registrado en Sistema
                  </h3>
                  <p className="text-xs text-slate-500">
                    Seleccione al médico activo para aplicarle restricción sanitaria de ingreso.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveRegisteredToBlacklist} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1.5">
                    Seleccionar Médico Registrado *
                  </label>
                  <select
                    required
                    value={selectedRegisteredId}
                    onChange={(e) => setSelectedRegisteredId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#af101a] font-semibold cursor-pointer"
                  >
                    <option value="">-- Buscar / Elegir Médico del Sistema --</option>
                    <optgroup label="Médicos en Credenciales / Expedientes">
                      {credentials.map(c => (
                        <option key={c.id} value={c.id}>
                          Dr. {c.firstName} {c.lastName} ({c.specialty} - Céd: {c.npi || 'S/N'})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Médicos en Directorio">
                      {directory.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.fullName} ({d.specialty})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-red-900 uppercase tracking-widest mb-1.5">
                    Motivo Oficial del Veto / Causa de Incompatibilidad *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Especifique detalladamente la razón por la cual no puede ingresar a las instalaciones del hospital..."
                    value={registeredReason}
                    onChange={(e) => setRegisteredReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#af101a] resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1.5">
                    Fecha de Entrada en Vigor
                  </label>
                  <input
                    type="date"
                    required
                    value={registeredDate}
                    onChange={(e) => setRegisteredDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#af101a]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1.5">
                    Observaciones Adicionales (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Instrucciones para caseta de seguridad, folios, etc."
                    value={registeredNotes}
                    onChange={(e) => setRegisteredNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#af101a]"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalRegisteredOpen(false)}
                    className="flex-1 py-2.5 px-4 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold uppercase cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 bg-[#af101a] hover:bg-[#85040d] text-white rounded-xl text-xs font-black uppercase cursor-pointer shadow-md"
                  >
                    Confirmar Veto
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Registrar Médico Vetado Externo */}
      <AnimatePresence>
        {isModalExternalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-red-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative text-slate-800 font-body my-8"
            >
              <button 
                onClick={() => setIsModalExternalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-headline text-slate-900">
                    Registrar Médico Vetado Externo
                  </h3>
                  <p className="text-xs text-slate-500">
                    Formulario completo para médicos externos no registrados en el sistema.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveExternalToBlacklist} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">
                      Nombre(s) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Juan Carlos"
                      value={extFirstName}
                      onChange={(e) => setExtFirstName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#af101a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">
                      Apellidos *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Pérez Gómez"
                      value={extLastName}
                      onChange={(e) => setExtLastName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#af101a]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">
                      Especialidad
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Cirugía General"
                      value={extSpecialty}
                      onChange={(e) => setExtSpecialty(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#af101a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">
                      Cédula Profesional
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 12345678"
                      value={extNpi}
                      onChange={(e) => setExtNpi(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-[#af101a]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">
                      RFC
                    </label>
                    <input
                      type="text"
                      placeholder="PEJU800101XXX"
                      value={extRfc}
                      onChange={(e) => setExtRfc(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-[#af101a] uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">
                      Teléfono Celular
                    </label>
                    <input
                      type="text"
                      placeholder="6621234567"
                      value={extPhone}
                      onChange={(e) => setExtPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#af101a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">
                      Campus San José
                    </label>
                    <select
                      value={extCampus}
                      onChange={(e: any) => setExtCampus(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#af101a] font-bold cursor-pointer"
                    >
                      <option value="Hermosillo">Hermosillo</option>
                      <option value="Guaymas">Guaymas</option>
                      <option value="Obregón">Obregón</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="medico@ejemplo.com"
                    value={extEmail}
                    onChange={(e) => setExtEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#af101a]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-red-900 uppercase tracking-widest mb-1">
                    Motivo Oficial del Veto / Causa de Restricción *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Escriba la causa oficial del veto o prohibición de acceso..."
                    value={extReason}
                    onChange={(e) => setExtReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#af101a] resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">
                      Fecha de Veto
                    </label>
                    <input
                      type="date"
                      required
                      value={extBannedAt}
                      onChange={(e) => setExtBannedAt(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#af101a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">
                      Observaciones (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Notas de apoyo..."
                      value={extNotes}
                      onChange={(e) => setExtNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#af101a]"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalExternalOpen(false)}
                    className="flex-1 py-2.5 px-4 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold uppercase cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 bg-[#af101a] hover:bg-[#85040d] text-white rounded-xl text-xs font-black uppercase cursor-pointer shadow-md"
                  >
                    Guardar Vetado Externo
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Authorization Modal for Removing Veto */}
      {vetoToRemove && (
        <ConfirmAuthModal
          isOpen={!!vetoToRemove}
          onClose={() => setVetoToRemove(null)}
          onConfirm={handleConfirmRemoveVeto}
          title="Levantar Restricción y Veto Médico"
          badgeText="AUTORIZACIÓN REQUERIDA"
          description={`Está a punto de remover el veto de ${vetoToRemove.fullName}. Esta acción permitirá restablecer sus permisos de acceso a las instalaciones. Ingrese su contraseña para autorizar:`}
          confirmText="Confirmar Levantar Veto"
          cancelText="Cancelar"
          variant="danger"
        />
      )}

      {/* Toast notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold font-body"
          >
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

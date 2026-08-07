import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MedicalCredential } from '../types';
import { 
  Award, Shield, Calendar, Users, AlertCircle, CheckCircle2, FileText, ChevronRight,
  TrendingUp, Clock, FileCheck, ArrowUpRight, HelpCircle, Briefcase, PlusCircle, ArrowLeft,
  UserCheck, UserPlus, Building2
} from 'lucide-react';

interface CredentialsDashboardProps {
  credentials: MedicalCredential[];
  userRole?: 'admin' | 'rh' | 'admision' | 'directorio' | 'guardias';
  onBackToDashboard: () => void;
  onNavigateToForm: () => void;
  onNavigateToConsent: (id: string) => void;
  onNavigateToSettings: () => void;
  onLogout: () => void;
}

export default function CredentialsDashboard({
  credentials,
  userRole = 'admin',
  onBackToDashboard,
  onNavigateToForm,
  onNavigateToConsent,
  onNavigateToSettings,
  onLogout
}: CredentialsDashboardProps) {

  const [selectedCampusFilter, setSelectedCampusFilter] = useState<string>('todos');

  // Filter credentials by campus selection
  const filteredCredentials = credentials.filter(c => {
    if (selectedCampusFilter === 'todos') return true;
    return c.campus === selectedCampusFilter;
  });

  // Quantities computations
  const totalRegistered = filteredCredentials.length;
  const verifiedCount = filteredCredentials.filter(c => c.status === 'VERIFICADO').length;
  const pendingCount = filteredCredentials.filter(c => c.status === 'PENDIENTE').length;
  const missingDocsCount = filteredCredentials.filter(c => c.status === 'FALTAN_DOCUMENTOS').length;
  
  // Staff vs Externo breakdown
  const staffCount = filteredCredentials.filter(c => c.physicianType !== 'Externo').length;
  const externoCount = filteredCredentials.filter(c => c.physicianType === 'Externo').length;
  const staffPercentage = totalRegistered > 0 ? Math.round((staffCount / totalRegistered) * 100) : 0;
  const externoPercentage = totalRegistered > 0 ? Math.round((externoCount / totalRegistered) * 100) : 0;
  
  // Expiration detection
  const currentLocalTime = new Date('2026-05-28');
  
  const getExpiredDocuments = (cred: MedicalCredential) => {
    const expiredList: string[] = [];
    const expiries: Record<string, string> = {};

    const docNames: Record<string, string> = {
      ine: 'Identificación Oficial (INE)',
      acta: 'Acta de Nacimiento Certificada',
      curp: 'CURP Oficial Validado',
      sat: 'Cédula Fiscal (Situación SAT)',
      domicilio: 'Comprobante de Domicilio',
      banco: 'Carátula de Cuenta de Banco',
      titulo_prof: 'Título de Médico Cirujano',
      cedula_prof: 'Cédula Profesional Federal',
      permiso_son_prof: 'Registro Estatal de Sonora (Gral)',
      cv: 'Curriculum Vitae',
      titulo_esp: 'Título de la Especialidad',
      cedula_esp: 'Cédula de Especialista Federal',
      permiso_son_esp: 'Registro Estatal de Sonora (Esp)',
      consejo: 'Certificación del Consejo',
      acls: 'Certificación de ACLS',
      diplomas: 'Diplomas y Formación',
      solicitud_cred: 'Solicitud de Credencialización',
      solicitud_priv: 'Solicitud de Privilegios HSJ',
      cartas_rec: 'Cartas de Recomendación',
      carta_comp: 'Carta Compromiso'
    };

    // 1. Populate from top-level fields
    if (cred.cedulaExpiryDate && cred.cedulaExpiryDate !== 'N/A') expiries['cedula_prof'] = cred.cedulaExpiryDate;
    if (cred.consejoExpiryDate && cred.consejoExpiryDate !== 'N/A') expiries['consejo'] = cred.consejoExpiryDate;
    if (cred.ineExpiryDate && cred.ineExpiryDate !== 'N/A') expiries['ine'] = cred.ineExpiryDate;
    if (cred.tituloExpiryDate && cred.tituloExpiryDate !== 'N/A') expiries['titulo_prof'] = cred.tituloExpiryDate;

    // 2. Populate from c.documentExpirations
    if (cred.documentExpirations) {
      Object.entries(cred.documentExpirations).forEach(([key, value]) => {
        if (value && value !== 'N/A') {
          expiries[key] = value;
        }
      });
    }

    // 3. Evaluate each one
    const sixMonthsLater = new Date(currentLocalTime);
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    Object.entries(expiries).forEach(([key, dateStr]) => {
      const docDate = new Date(dateStr);
      const isExpired = docDate < currentLocalTime;
      const isSoon = docDate >= currentLocalTime && docDate <= sixMonthsLater;

      if (isExpired || isSoon) {
        const friendlyName = docNames[key] || key.replace('_', ' ').toUpperCase();
        const label = isExpired 
          ? `${friendlyName} Expirado (Venció: ${dateStr})`
          : `${friendlyName} Próximo a Vencer (Vence: ${dateStr} - en < 6 meses)`;
        if (!expiredList.includes(label)) {
          expiredList.push(label);
        }
      }
    });

    return expiredList;
  };

  const getPendingItems = (cred: MedicalCredential) => {
    const items: string[] = [];
    if (cred.status === 'FALTAN_DOCUMENTOS') {
      if (!cred.hasCedula) items.push('Falta Archivo Cédula Federal');
      if (!cred.hasTitulo) items.push('Falta Archivo Título Profesional');
    }
    if (!cred.signatureUrl) {
      items.push('Firma Autógrafa Legal Pendiente');
    }
    if (!cred.fingerprintMapped) {
      items.push('Registro Biométrico de Huella Requerido');
    }
    // Expired documents count too
    const expired = getExpiredDocuments(cred);
    items.push(...expired);

    if (cred.status === 'PENDIENTE' && items.length === 0) {
      items.push('Sello de Aprobación de Credencialización en espera');
    }

    return items;
  };

  // List of doctors with pending processes
  const doctorsWithPending = filteredCredentials.map(c => ({
    ...c,
    pendings: getPendingItems(c)
  })).filter(c => c.status !== 'VERIFICADO' || c.pendings.length > 0);

  // Specialties distribution map
  const specialtyStats: Record<string, number> = {};
  filteredCredentials.forEach(c => {
    specialtyStats[c.specialty] = (specialtyStats[c.specialty] || 0) + 1;
  });

  const topSpecialties = Object.entries(specialtyStats).map(([name, count]) => ({
    name,
    count,
    percentage: totalRegistered > 0 ? Math.round((count / totalRegistered) * 100) : 0
  })).sort((a,b) => b.count - a.count);

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-body text-slate-800 pb-20 selection:bg-red-100 selection:text-red-900">
      
      {/* Top Navigation Frame */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm flex justify-between items-center px-8 h-17 no-print">
        <div className="flex items-center gap-8">
          <div className="text-2xl font-bold tracking-tighter text-[#af101a] font-headline flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            <span>CredSJ</span>
          </div>
          <div className="hidden md:flex gap-6 items-center font-headline text-sm font-medium tracking-tight">
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onBackToDashboard(); }}
              className="text-slate-600 hover:text-[#af101a] transition-colors"
            >
              Panel de Control
            </a>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onNavigateToForm(); }}
              className={`flex items-center gap-1 transition-colors ${
                userRole === 'admin' 
                  ? 'text-slate-600 hover:text-[#af101a]' 
                  : 'text-slate-400 cursor-not-allowed'
              }`}
            >
              {userRole !== 'admin' && <span className="material-symbols-outlined text-[14px]">lock</span>}
              Registro Médicos
            </a>
            <a 
              href="#" 
              onClick={(e) => e.preventDefault()}
              className="text-red-700 font-bold border-b-2 border-red-700 pb-1"
            >
              Credenciales
            </a>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                if (userRole === 'directorio' || userRole === 'guardias') {
                  alert('Acceso restringido para ver Consentimiento Legal de Incorporaciones.');
                  return;
                }
                if (credentials.length > 0) onNavigateToConsent(credentials[0].id); 
                else alert('Registre un médico primero.'); 
              }}
              className="text-slate-600 hover:text-[#af101a] transition-colors"
            >
              Legal
            </a>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onNavigateToSettings(); }}
              className={`flex items-center gap-1 transition-colors ${
                userRole === 'admin' 
                  ? 'text-slate-600 hover:text-[#af101a]' 
                  : 'text-slate-400 cursor-not-allowed'
              }`}
            >
              {userRole !== 'admin' && <span className="material-symbols-outlined text-[14px]">lock</span>}
              Ajustes
            </a>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-right">
            <p className="text-[9px] font-black uppercase text-slate-400">Rol Activo</p>
            <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{userRole === 'admin' ? 'Administrador' : 'RH / Auditor'}</p>
          </div>
          <button 
            type="button"
            onClick={onLogout}
            className="text-xs font-bold text-slate-500 hover:text-[#af101a] px-3.5 py-1.5 bg-slate-100 rounded-xl transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </nav>

      {/* Main Container Workspace */}
      <main className="pt-24 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <button 
              onClick={onBackToDashboard}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-xs font-bold uppercase tracking-wider mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Volver al Panel Principal
            </button>
            <h1 className="font-headline text-3xl font-extrabold text-slate-900 tracking-tight">
              Dashboard de Credencialización Médica
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Análisis cuantitativo de certificaciones, licencias vigentes y requerimientos regulativos del hospital.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <select
              value={selectedCampusFilter}
              onChange={(e) => setSelectedCampusFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-xs cursor-pointer"
            >
              <option value="todos">🏥 Todas las Sedes (Hermosillo, Guaymas, Obregón)</option>
              <option value="Hermosillo">🌵 Campus Hermosillo</option>
              <option value="Guaymas">🌊 Campus Guaymas</option>
              <option value="Obregón">🚜 Campus Obregón</option>
            </select>

            <button
              onClick={onNavigateToForm}
              className="bg-primary hover:bg-primary-hover text-white px-5 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" />
              Nuevo Registro
            </button>
          </div>
        </div>

        {/* Dynamic Metric Block Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* Card 1: TOTAL PHYSICIANS */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Médicos Registrados</span>
              <span className="text-4xl font-black text-slate-900 font-headline block">{totalRegistered}</span>
              <span className="text-[10px] font-bold text-slate-400 tracking-wide block">Roster oficial HSJ</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: VERIFIED DOCTORS & PERCENTAGE */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-sm flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold text-[#113e16] uppercase tracking-widest block">Credencializados Activos</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-[#1b6d24] font-headline">{verifiedCount}</span>
                  <span className="text-xs font-bold text-slate-500">de {totalRegistered}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-2xl font-black text-emerald-700 font-headline bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                  {totalRegistered > 0 ? Math.round((verifiedCount / totalRegistered) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="space-y-1">
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500" 
                  style={{ width: `${totalRegistered > 0 ? Math.min(100, Math.round((verifiedCount / totalRegistered) * 100)) : 0}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-emerald-700 tracking-wide flex items-center justify-between pt-0.5">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Expediente Completo
                </span>
                <span>{verifiedCount} / {totalRegistered} ({totalRegistered > 0 ? Math.round((verifiedCount / totalRegistered) * 100) : 0}%)</span>
              </span>
            </div>
          </div>

          {/* Card 3: PENDIENTE */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-widest block">Trámites Pendientes</span>
              <span className="text-4xl font-black text-amber-600 font-headline block">{pendingCount}</span>
              <span className="text-[10px] font-bold text-amber-600 tracking-wide block">En revisión de legal</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: MISSING OR EXPIRED PAPERS */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-red-900 uppercase tracking-widest block">Faltantes o Expirados</span>
              <span className="text-4xl font-black text-[#af101a] font-headline block">{missingDocsCount}</span>
              <span className="text-[10px] font-bold text-red-600 tracking-wide block">Requieren actualización</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#af101a] flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main workspace (Left 8/12 - Pending items breakdown per physician) */}
          <div className="col-span-12 lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#af101a]" />
                <h2 className="font-headline font-bold text-lg text-slate-900">Detalle de Trámites y Requerimientos Pendientes</h2>
              </div>
              
              {doctorsWithPending.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-medium">
                  {totalRegistered === 0 ? (
                    <div className="space-y-4">
                      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="text-sm">No hay médicos registrados actualmente en el hospital.</p>
                      <button 
                        onClick={onNavigateToForm}
                        className="bg-primary text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl hover:bg-primary-hover shadow-sm"
                      >
                        Registrar Primer Médico
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="text-sm text-slate-800 font-bold">¡Excelente! Todos los médicos están completamente validados.</p>
                      <p className="text-xs text-slate-400">No se detectaron expedientes inconclusos ni firmas pendientes.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {doctorsWithPending.map(dr => (
                    <div key={dr.id} className="p-6 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center flex-wrap gap-2">
                            <p className="font-bold text-sm text-slate-800 uppercase tracking-tight">{dr.firstName} {dr.lastName}</p>
                            <span className="bg-slate-100 text-slate-700 text-[9.5px] font-black uppercase px-2 py-0.5 rounded border border-slate-200">
                              🏥 {dr.campus || 'Hermosillo'}
                            </span>
                            <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded border ${dr.physicianType === 'Externo' ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-red-50 text-[#af101a] border-red-100'}`}>
                              {dr.physicianType === 'Externo' ? 'Médico Externo' : 'Médico Staff'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-bold mt-1">{dr.specialty} • Cédula ID: {dr.npi} • Registrado el: {dr.enrollmentDate}</p>
                        </div>

                        {/* Specific listed pendings */}
                        <div className="space-y-2.5">
                          <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Pendientes documentados:</p>
                          <ul className="space-y-1.5 ml-1">
                            {dr.pendings.map((p, i) => (
                              <li key={i} className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-650" />
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="flex sm:flex-col justify-end items-end gap-2 self-start sm:self-auto w-full sm:w-auto">
                        <div className="flex-1 sm:flex-initial text-right">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded inline-block ${
                            dr.status === 'FALTAN_DOCUMENTOS' 
                              ? 'bg-red-50 text-red-850 border border-red-100'
                              : 'bg-amber-50 text-amber-850 border border-amber-100'
                          }`}>
                            {dr.status}
                          </span>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => onNavigateToConsent(dr.id)}
                            className="text-[10px] font-black uppercase tracking-widest text-[#af101a] bg-slate-50 border border-slate-200 hover:bg-red-50 px-3 py-1.5 rounded"
                          >
                            Firmar Acuerdo
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-500">
                Se requiere actualizar estos documentos antes de la auditoría de COFEPRIS.
              </span>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Hospital San José Hermosillo</span>
            </div>
          </div>

          {/* Right column (Specialties Analysis & upcoming review timeline dates) */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            
            {/* Specialties Distribution Card */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                <Briefcase className="w-5 h-5 text-primary" />
                <h3 className="font-headline font-bold text-base text-slate-900">Especialidades del Hospital</h3>
              </div>

              {topSpecialties.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 font-medium">No hay registros para clasificar.</p>
              ) : (
                <div className="space-y-4">
                  {topSpecialties.map((spec, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-700">{spec.name}</span>
                        <span className="text-slate-400">{spec.count} {spec.count === 1 ? 'médico' : 'médicos'} ({spec.percentage}%)</span>
                      </div>
                      {/* Stylized custom CSS progress bar */}
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${spec.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card: Distribución de Médicos (Staff vs. Externos) */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <h3 className="font-headline font-bold text-base text-slate-900">Médicos de Staff vs. Externos</h3>
                </div>
                <span className="text-[10px] font-extrabold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  Clasificación
                </span>
              </div>

              <div className="space-y-4 font-semibold text-xs">
                {/* Staff Physicians Card */}
                <div className="p-4 bg-red-50/60 rounded-xl border border-red-150/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#af101a] text-white rounded-lg shadow-xs">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-slate-900 font-extrabold text-sm">Médicos de Staff</p>
                      <p className="text-slate-500 text-[11px] font-medium">Médicos adscritos al hospital</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-[#af101a] font-headline">{staffCount}</span>
                    <span className="text-[10px] font-extrabold text-red-800 block">{staffPercentage}% del total</span>
                  </div>
                </div>

                {/* External Physicians Card */}
                <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-600 text-white rounded-lg shadow-xs">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-slate-900 font-extrabold text-sm">Médicos Externos</p>
                      <p className="text-slate-500 text-[11px] font-medium">Médicos interconsultantes e invitados</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-amber-700 font-headline">{externoCount}</span>
                    <span className="text-[10px] font-extrabold text-amber-800 block">{externoPercentage}% del total</span>
                  </div>
                </div>

                {/* Comparative Visual Bar */}
                <div className="pt-2 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-500 font-bold">
                    <span>Proporción del Roster</span>
                    <span>{staffCount} Staff / {externoCount} Externos</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-[#af101a] transition-all duration-500" 
                      style={{ width: `${staffPercentage}%` }} 
                      title={`Staff: ${staffCount}`}
                    />
                    <div 
                      className="h-full bg-amber-500 transition-all duration-500" 
                      style={{ width: `${externoPercentage}%` }} 
                      title={`Externos: ${externoCount}`}
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </main>

    </div>
  );
}

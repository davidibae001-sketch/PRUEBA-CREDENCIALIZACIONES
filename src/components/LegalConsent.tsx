import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MedicalCredential } from '../types';
import { 
  Printer, Bell, Settings, ShieldCheck, User, 
  CheckCircle, ArrowLeft, Heart, CheckSquare, Sparkles, ChevronLeft,
  Stethoscope, Award, FileText, CheckCircle2
} from 'lucide-react';

interface LegalConsentProps {
  credentialId: string;
  credentials: MedicalCredential[];
  userRole?: 'admin' | 'rh' | 'admision' | 'directorio' | 'guardias';
  onBackToDashboard: () => void;
  onNavigateToForm: () => void;
  onNavigateToCredentials: () => void;
  onNavigateToSettings: () => void;
  onUpdateStatus: (id: string, status: 'VERIFICADO' | 'PENDIENTE') => void;
}

export default function LegalConsent({ 
  credentialId, 
  credentials, 
  userRole = 'admin',
  onBackToDashboard,
  onNavigateToForm,
  onNavigateToCredentials,
  onNavigateToSettings,
  onUpdateStatus 
}: LegalConsentProps) {
  const selectedCredential = credentials.find(c => c.id === credentialId) || credentials[0];
  const [isExecuted, setIsExecuted] = useState(selectedCredential?.status === 'VERIFICADO');
  const [signatureType, setSignatureType] = useState<'digital' | 'fisica'>('digital');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsExecuted(selectedCredential?.status === 'VERIFICADO');
  }, [selectedCredential]);

  const isRH = userRole === 'rh';

  const handleExecute = () => {
    if (isRH) return;
    setIsExecuted(true);
    onUpdateStatus(selectedCredential.id, 'VERIFICADO');
    setToastMsg(`¡Acuerdo Ejecutado! El estado de ${selectedCredential.firstName} ${selectedCredential.lastName} ha sido elevado a VERIFICADO.`);
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  const handlePrint = () => {
    window.print();
  };

  const today = new Date();

  const dateLong = today.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const dateShort = today
    .toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
    .replace(/\//g, '-');

  return (
    <div className="min-h-screen bg-slate-50 font-body text-slate-800 selection:bg-red-100 selection:text-red-900 pb-20">
      
      {/* Stylesheet supporting exact printing layout and page breaks */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: letter;
                margin: 15mm 15mm 15mm 15mm;
              }

              html, body {
                background: white !important;
                color: #000 !important;
                font-size: 11pt !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              nav, aside, .no-print, footer, [role="button"], button {
                display: none !important;
              }

              main {
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
              }

              .print-area {
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                background: transparent !important;
              }

              .print-page {
                border: none !important;
                box-shadow: none !important;
                padding: 10px 0 !important;
                page-break-after: always !important;
                min-height: auto !important;
              }

              .print-page:last-child {
                page-break-after: avoid !important;
              }

              .avoid-break {
                page-break-inside: avoid !important;
              }

              .signatures-grid {
                display: grid !important;
                grid-template-columns: 1fr 1fr 1fr !important;
                gap: 24px !important;
                margin-top: 32px !important;
              }
            }
          `
        }}
      />

      {/* Top Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm flex justify-between items-center px-8 h-17 no-print">
        <div className="flex items-center gap-8">
          <div className="text-2xl font-bold tracking-tighter text-[#af101a] font-headline flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
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
              Médicos
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
              onClick={(e) => e.preventDefault()}
              className="text-red-700 font-bold border-b-2 border-red-700 pb-1"
            >
              Legal
            </a>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onNavigateToSettings(); }}
              className={`flex items-center gap-1 transition-colors ${
                userRole === 'admin' 
                  ? 'text-slate-600 hover:text-red-800' 
                  : 'text-slate-400 cursor-not-allowed'
              }`}
            >
              {userRole !== 'admin' && <span className="material-symbols-outlined text-[14px]">lock</span>}
              Configuración
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => alert('Firma segura habilitada en nodo TLS')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-all">
            <Bell className="w-5 h-5" />
          </button>
          <button onClick={() => alert('Configuración Legal encriptada')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-all">
            <Settings className="w-5 h-5" />
          </button>
          {isRH ? (
            <span className="bg-slate-100 text-slate-500 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider select-none">
              Solo Lectura (RH)
            </span>
          ) : (
            <button 
              type="button" 
              onClick={handleExecute}
              disabled={isExecuted}
              className="bg-[#af101a] text-white px-4 py-2 rounded-xl font-headline text-sm font-bold shadow-sm active:scale-95 duration-200 cursor-pointer disabled:opacity-50"
            >
              {isExecuted ? 'Firmado' : 'Firmar Documento'}
            </button>
          )}
        </div>
      </nav>

      {/* Floating dynamic status toast */}
      {toastMsg && (
        <div className="fixed top-20 right-8 z-[100] max-w-md bg-stone-900 text-white rounded-xl shadow-2xl p-4 flex items-center gap-3 border border-stone-800">
          <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-xs font-semibold">{toastMsg}</p>
        </div>
      )}

      {/* Main Layout Container */}
      <div className="pt-24 pb-16 px-4 md:px-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Nav */}
        <aside className="hidden md:flex flex-col py-6 space-y-1 h-fit w-64 bg-white rounded-xl no-print border border-slate-200/50 shadow-sm">
          <div className="px-6 mb-6">
            <p className="font-headline text-xs font-black uppercase tracking-wider text-red-800">Centro de Mando</p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase">Supervisión de Precisión</p>
          </div>
          <a href="#" onClick={(e) => {e.preventDefault(); onBackToDashboard();}} className="text-slate-500 px-6 py-3 font-body text-xs font-bold uppercase tracking-wider hover:translate-x-1 transition-transform">Médicos Activos</a>
          <a href="#" onClick={(e) => {e.preventDefault(); onBackToDashboard();}} className="text-slate-500 px-6 py-3 font-body text-xs font-bold uppercase tracking-wider hover:translate-x-1 transition-transform">Revisiones Pendientes</a>
          <a href="#" onClick={(e) => {e.preventDefault(); onBackToDashboard();}} className="text-slate-500 px-6 py-3 font-body text-xs font-bold uppercase tracking-wider hover:translate-x-1 transition-transform">Docs. Expirados</a>
          <a href="#" onClick={(e) => e.preventDefault()} className="bg-slate-50 text-red-700 rounded-l-full ml-4 shadow-sm px-6 py-3 font-body text-xs font-bold uppercase tracking-wider border-l-4 border-red-700 select-none">Retenciones Legales</a>
          <a href="#" onClick={(e) => {e.preventDefault(); onBackToDashboard();}} className="text-slate-500 px-6 py-3 font-body text-xs font-bold uppercase tracking-wider hover:translate-x-1 transition-transform">Archivo</a>
        </aside>

        {/* Legal Preview area */}
        <main className="flex-1 print:p-0">
          <div className="max-w-4xl mx-auto print:max-w-none print:w-full">
            
            {/* Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 no-print">
              <button 
                onClick={onBackToDashboard}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-xs font-bold uppercase tracking-wider cursor-pointer pr-4 border-r border-slate-200"
              >
                <ArrowLeft className="w-4 h-4" /> Volver al Control
              </button>

              <h1 className="font-headline text-lg font-bold tracking-tight text-slate-900 flex-1">
                Vista Previa de Consentimiento Legal
              </h1>

              <div className="flex flex-wrap items-center gap-3">
                {/* Selector de Modalidad de Firma */}
                <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl border border-slate-300/60 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setSignatureType('digital')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      signatureType === 'digital'
                        ? 'bg-[#af101a] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Firma Digital
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureType('fisica')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      signatureType === 'fisica'
                        ? 'bg-[#af101a] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Firma en Físico
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#af101a] hover:bg-red-800 text-white transition-all text-xs font-extrabold shadow-md cursor-pointer uppercase tracking-wider"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Consentimiento
                </button>
              </div>
            </div>

            {/* Banner Informativo si se elige Firma en Físico */}
            {signatureType === 'fisica' && (
              <div className="mb-6 p-3.5 bg-amber-50/90 border border-amber-300/80 rounded-xl text-amber-900 text-xs font-medium flex items-center gap-3 no-print shadow-sm">
                <span className="material-symbols-outlined text-amber-700 text-lg flex-shrink-0">info</span>
                <div>
                  <strong className="font-bold">Modalidad de Firma en Físico activa:</strong> El aviso legal omitirá la firma digital en esta vista e impresión para permitir estampación manuscrita en papel. {selectedCredential?.signatureUrl ? 'La firma digital guardada previamente se mantendrá resguardada en su expediente.' : ''}
                </div>
              </div>
            )}

            {/* Document wrapper */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-lg print-area relative print:border-none print:shadow-none p-12 md:p-16 space-y-16"
            >
              
              {/* PAGE 1 */}
              <div className="print-page relative">
                <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none">
                  <ShieldCheck className="w-32 h-32 text-red-900" />
                </div>

                <div className="flex justify-between items-start mb-10 border-b-2 border-slate-100 pb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#af101a] flex items-center justify-center rounded-xl text-white shadow-sm">
                      <Stethoscope className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="font-headline text-xl font-bold text-red-950 tracking-tight">
                        Hospital San José {selectedCredential.campus || 'Hermosillo'}
                      </h2>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        Departamento de Credencialización
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">ID del Documento</p>
                    <p className="text-xs font-mono font-bold mt-1 text-slate-800">HSJ-LC-2026-{selectedCredential.npi.slice(0, 5)}</p>
                  </div>
                </div>

                <div className="mb-10 text-center">
                  <span className="text-[9px] font-extrabold text-primary bg-red-50 px-3 py-1 rounded border border-red-100 uppercase tracking-widest">
                    ACUERDO DE CONFORMIDAD JURÍDICA
                  </span>
                  <h3 className="font-headline text-3xl font-extrabold text-slate-900 mt-4 mb-2 tracking-tight">
                    Acuerdo de Uso de Datos Médicos
                  </h3>
                  <p className="text-xs text-slate-500 font-medium font-body leading-relaxed">
                    Fecha de Emisión: {dateLong} | Efectivo de inmediato
                  </p>
                </div>

                <div className="space-y-8 text-slate-700 leading-relaxed text-justify text-sm">
                  <section>
                    <h4 className="font-headline text-base font-extrabold text-red-900 mb-3">
                      1. Definiciones y Alcance
                    </h4>

                    <p className="text-slate-600 font-normal">
                      Este Consentimiento de Uso de Datos Médicos, Acreditación Profesional y Firma Digital se celebra entre el <span className="font-bold text-slate-800">Hospital San José de {selectedCredential.campus || 'Hermosillo'}</span> y el profesional médico con Cédula Profesional Federal No. <span className="underline font-bold text-slate-900">{selectedCredential.npi}</span>, correspondiente a <span className="underline font-bold text-slate-900">{selectedCredential.firstName} {selectedCredential.lastName}</span>, en adelante denominado “el Médico”, con el propósito de establecer los lineamientos legales, administrativos y tecnológicos que regulan la acreditación, certificación y uso de la firma digital dentro del ecosistema institucional del hospital. El presente acuerdo tiene como finalidad avalar legalmente que el Médico ha entregado de manera digital toda la documentación oficial, legal y profesional requerida por el Departamento de Credencialización del Hospital San José de {selectedCredential.campus || 'Hermosillo'}, incluyendo, pero no limitándose a:
                    </p>

                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs text-slate-500 font-semibold list-disc marker:text-red-600 ml-6 mt-4">
                      <li>Título y Cédula profesional</li>
                      <li>Certificaciones médicas del consejo vigentes</li>
                      <li>Especialidades y subespecialidades registradas</li>
                      <li>Identificación oficial INE y documentación fiscal SAT</li>
                      <li>Constancias de acreditación y licencias estatales de Sonora</li>
                      <li>Documentos de cumplimiento normativo institucional</li>
                      <li>Huellas biométricas y registro facial de seguridad</li>
                      <li>Firma autógrafa digitalizada en tableta/periférico</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-headline text-base font-extrabold text-red-900 mb-3">
                      2. Autorización para el Uso de Datos
                    </h4>

                    <p className="text-slate-600 font-normal">
                      Por medio del presente documento, el Médico autoriza de manera expresa, voluntaria y consciente al Hospital San José de {selectedCredential.campus || 'Hermosillo'} para acceder, verificar, validar, almacenar, resguardar y utilizar su información profesional, certificaciones, documentación legal y datos biométricos con el único fin de mantener su acreditación activa dentro del hospital en los siguientes procesos:
                    </p>

                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs text-slate-600 font-bold ml-6 list-disc marker:text-red-600 mt-4">
                      <li>Credencialización médica y validación de licencias federales</li>
                      <li>Control de acceso al sistema hospitalario e instalaciones clínicas</li>
                      <li>Registro de actividades médicas y expedientes clínicos computados</li>
                      <li>Cumplimiento normativo de salud y auditorías de COFEPRIS</li>
                    </ul>

                    <p className="text-xs text-red-900 font-bold italic mt-4 bg-red-50 p-3 rounded-lg border border-red-100">
                      El Hospital se compromete firmemente a no utilizar la información con fines comerciales o ajenos a los procesos médicos institucionales y de acreditación correspondientes.
                    </p>
                  </section>

                  <section>
                    <h4 className="font-headline text-base font-extrabold text-red-900 mb-3">
                      3. Validez de la Firma Digital
                    </h4>

                    <p className="text-xs text-red-900 italic border-l-4 border-red-700 pl-4 py-2 bg-red-50/50 rounded-r-lg">
                      De conformidad con lo dispuesto por la Ley de Firma Electrónica Avanzada, la Normatividad Mexicana en materia de documentos electrónicos, la Ley General de Salud, la NOM-004-SSA3-2012 del Expediente Clínico, y demás normativas aplicables, la firma digital del Médico tendrá pleno valor jurídico, legal y probatorio, equivalente a una firma autógrafa física manuscrita.
                    </p>

                    <p className="text-slate-600 mt-4">
                      Cada acción registrada en el sistema SIHO bajo su firma digital (notas médicas, prescripciones de medicamentos, diagnósticos firmados, etc.) generará un registro electrónico de responsabilidad que permitirá identificar inequívocamente:
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] text-slate-600 font-extrabold uppercase tracking-wider mt-4">
                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60 text-center">
                        Quién realizó
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60 text-center">
                        Cuándo realizó
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60 text-center">
                        Qué modificó
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60 text-center">
                        Qué autorizó
                      </div>
                    </div>
                  </section>

                  <section>
                    <h4 className="font-headline text-base font-extrabold text-red-900 mb-3">
                      4. Protocolos de Privacidad y Seguridad
                    </h4>

                    <p className="text-slate-600 font-normal">
                      El sistema digital seguro CredSJ y el Expediente Clínico de SIHO garantizan la seguridad de sus datos e historial profesional mediante encriptación AES-256 bits, control granular de accesos y meticulosos registros de auditoría informática en vivo. El acceso de lectura está estrictamente restringido a personal de recursos humanos y directivos legales autorizados.
                    </p>
                  </section>
                </div>
              </div>

              {/* PAGE 2 */}
              <div className="print-page border-t border-slate-200 pt-16 relative">
                <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none">
                  <ShieldCheck className="w-32 h-32 text-red-900" />
                </div>

                <div className="mb-12">
                  <h4 className="font-headline text-base font-extrabold text-red-900 mb-3">
                    5. Declaración de Autenticidad y Cierre de Acuerdo
                  </h4>
                  <p className="text-slate-600 text-sm leading-relaxed text-justify">
                    El Médico abajo firmante declara bajo protesta de decir verdad que toda la información académica, certificaciones de consejo, licencias federales de ejercicio profesional de la salud, datos de identidad y registros cargados por medios electrónicos en su expediente de credencialización de <span className="font-bold text-slate-800">CredSJ</span> son válidos, vigentes, auténticos y fidedignos.
                  </p>
                </div>

                <div className="mt-16 pt-12">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-10 signatures-grid avoid-break">
                    
                    {/* 1. Physician Signature Column */}
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-red-900 border-b border-red-200 pb-1">
                        FIRMA MÉDICO
                      </p>

                      <div className="h-28 bg-slate-50/60 rounded-xl border border-slate-200 border-b-2 border-red-700 flex flex-col items-center justify-center relative overflow-hidden group p-2">
                        {signatureType === 'digital' ? (
                          selectedCredential.signatureUrl ? (
                            <img 
                              src={selectedCredential.signatureUrl} 
                              alt={`Firma de ${selectedCredential.lastName}`} 
                              className="h-16 opacity-95 mix-blend-darken object-contain pointer-events-none" 
                              referrerPolicy="no-referrer" 
                            />
                          ) : (
                            <span className="text-xs font-bold text-slate-400 select-none italic text-center">Firma Digital Pendiente</span>
                          )
                        ) : (
                          <div className="w-full text-center pt-8">
                            <div className="border-b border-slate-400 w-4/5 mx-auto mb-1.5"></div>
                            <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block">
                              Firma Autógrafa en Físico
                            </span>
                          </div>
                        )}
                        {selectedCredential.fingerprintMapped && signatureType === 'digital' && (
                          <span className="absolute right-2 top-2 text-[7px] font-extrabold bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded tracking-wide border border-emerald-100">
                            HUELLA
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 font-semibold text-slate-600">
                        <p className="text-[11px] font-extrabold text-slate-900">
                          Dr(a). {selectedCredential.firstName} {selectedCredential.lastName}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Cédula Prof: <span className="font-mono font-bold text-slate-700">{selectedCredential.npi}</span>
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Fecha: {dateShort}
                        </p>
                      </div>
                    </div>

                    {/* 2. Dianna Jiménez Signature Column */}
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-red-900 border-b border-red-200 pb-1">
                        FIRMA Dianna Jiménez
                      </p>

                      <div className="h-28 bg-slate-50/60 rounded-xl border border-slate-200 border-b-2 border-red-700 flex flex-col items-center justify-center relative p-2 overflow-hidden">
                        <img 
                          src="/api/firmas/diannajimenez.png" 
                          alt="Firma Dianna Jiménez" 
                          className="max-h-20 max-w-full object-contain mx-auto"
                          onError={(e) => {
                            // Fallback if local image file has not been copied to folder yet
                            (e.target as HTMLElement).style.display = 'none';
                            const fallback = (e.target as HTMLElement).nextElementSibling;
                            if (fallback) (fallback as HTMLElement).style.display = 'block';
                          }}
                        />
                        <div className="text-center px-3 py-1 hidden">
                          <span className="text-[8px] font-extrabold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded border border-emerald-200/80 uppercase tracking-wider block shadow-2xs">
                            ✓ VALIDADO Y REGISTRADO
                          </span>
                          <span className="text-[9px] font-bold text-slate-700 mt-1.5 block">
                            Dianna Jiménez
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 font-semibold text-slate-600">
                        <p className="text-[11px] font-extrabold text-slate-900">
                          Dianna Jiménez
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Departamento de Credencialización
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Hospital San José {selectedCredential.campus || 'Hermosillo'}
                        </p>
                      </div>
                    </div>

                    {/* 3. Dr. García Lafarga Signature Column */}
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-red-900 border-b border-red-200 pb-1">
                        FIRMA Dr. García Lafarga
                      </p>

                      <div className="h-28 bg-slate-50/60 rounded-xl border border-slate-200 border-b-2 border-red-700 flex flex-col items-center justify-center relative overflow-hidden p-2">
                        {isExecuted ? (
                          <div className="flex flex-col items-center justify-center">
                            <img 
                              alt="Firma Dr. García Lafarga" 
                              className="h-14 opacity-90 mix-blend-darken object-contain pointer-events-none" 
                              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB-bysGwDR6H2OwzURYoufO-fvJNwLu-QYQ2FAX2W2q3Q6yo6YyHVTJH9aBDNA2N46MT2PXA39Oh_gA4Xq51HmTgqJC_TDYXb0HV9edrNkR-xh0Ea4d0zkykIVTWLjeCPhSIQvtrRGhDdxMEUod03XyOQDTjQDKsaNjcKtO1_WWhCqD_q0lxbZsj96J6R1Dd6BD6y0m1OLINQdj_1ek-LJ_T7WcnOrYz8TLqAJI2U3A5ftINiFDkeGcfFSgtJ7VGIZuQ9OFZq0IjA"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="w-full text-center pt-8">
                            <div className="border-b border-slate-300 w-4/5 mx-auto mb-1.5"></div>
                            <span className="text-[8px] font-bold text-slate-400 select-none italic block">
                              Aprobación Dirección Médica
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 font-semibold text-slate-600">
                        <p className="text-[11px] font-extrabold text-slate-900">
                          Dr. Luis Eduardo García Lafarga
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Director Médico / Representante Legal
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Hospital San José {selectedCredential.campus || 'Hermosillo'}
                        </p>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="mt-20 text-[10px] font-bold text-slate-400 text-center border-t border-slate-100 pt-6">
                  <p>
                    Marco de Confianza Digital CredSJ • Hospital San José {selectedCredential.campus || 'Hermosillo'} • Acuerdo de Uso de Datos Médicos
                  </p>
                  <p className="text-[8px] font-mono tracking-wider mt-1.5 opacity-60 uppercase">
                    Hash digital de transacciones: d7c-33b-{selectedCredential.id}-2026-SHA256
                  </p>
                </div>
              </div>

            </motion.div>
          </div>
        </main>
      </div>

      {/* Floating Action Glassmorphic Bar info */}
      <div className="fixed bottom-8 right-8 z-40 no-print">
        <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl flex items-center gap-8 border border-slate-200">
          <div className="flex items-center gap-3">
            <span className={`w-3.5 h-3.5 rounded-full ${isExecuted ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Estado del Documento</p>
              <p className="text-xs font-bold text-slate-800">
                {isExecuted ? 'Legalizado y Ejecutado' : 'Listo para Ejecución'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleExecute}
            disabled={isExecuted || isRH}
            className={`px-8 py-3 rounded-xl font-headline text-xs font-extrabold shadow-lg transition-all ${
              isRH
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-[#af101a] text-white hover:bg-red-850 active:scale-95 cursor-pointer disabled:opacity-50 disabled:bg-emerald-700 disabled:cursor-not-allowed'
            }`}
          >
            {isRH ? 'Firma Inactiva (RH)' : isExecuted ? 'Acuerdo Firmado ✓' : 'Ejecutar Acuerdo'}
          </button>
        </div>
      </div>

    </div>
  );
}

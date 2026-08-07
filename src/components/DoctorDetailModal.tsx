import React, { useState, useEffect } from 'react';
import { DoctorCredential } from '../types';
import { X, Upload, CheckCircle2, FileText, User, Award, Phone, Mail, Building, MapPin, Calendar, FileCheck, ShieldAlert, Trash2, FolderPlus, Save, PenTool, ArrowRight, Folder } from 'lucide-react';

interface DoctorDetailModalProps {
  doctor: DoctorCredential;
  onClose: () => void;
  onSave: (updated: DoctorCredential) => void;
  onDelete: (id: string) => void;
}

export const DoctorDetailModal: React.FC<DoctorDetailModalProps> = ({
  doctor,
  onClose,
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState<DoctorCredential>({ ...doctor });
  const [activeStep, setActiveStep] = useState<'profile' | 'documentos' | 'firma'>('profile');
  const [folderFiles, setFolderFiles] = useState<Record<string, any[]>>({});
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [signatureCanvas, setSignatureCanvas] = useState<string>('');
  const [isSavingSignature, setIsSavingSignature] = useState(false);

  // Compute live folder path preview
  const getLiveFolderPath = () => {
    const fullName = `${formData.firstName || ''} ${formData.paternalLastName || formData.lastName || ''} ${formData.maternalLastName || ''}`.trim();
    if (!fullName) return 'C:\\Users\\Administrador.SANJOSE-HMO\\Documents\\CREDENCIALIZACION\\MEDICO_SIN_NOMBRE';
    const cleanFolder = fullName
      .replace(/^(DR_|DRA_|DR\.|DRA\.|DR\s+|DRA\s+)/i, '')
      .replace(/[\/\\?%*:|"<>]/g, '')
      .replace(/\s+/g, '_')
      .toUpperCase();
    
    let campusPrefix = 'CREDENCIALIZACION';
    if (formData.campus === 'Guaymas') campusPrefix = 'CREDENCIALIZACION-GYM';
    if (formData.campus === 'Caborca') campusPrefix = 'CREDENCIALIZACION-OBG';

    return `C:\\Users\\Administrador.SANJOSE-HMO\\Documents\\${campusPrefix}\\${cleanFolder}`;
  };

  const currentFolderPath = formData.rutaArchivos || getLiveFolderPath();

  // Fetch real physical folder files from server for this physician
  const fetchFolderFiles = async () => {
    const doctorFullName = `${formData.firstName || ''} ${formData.lastName || formData.paternalLastName || ''}`.trim();
    if (!doctorFullName) return;
    setIsLoadingFiles(true);
    try {
      const res = await fetch('/api/get-doctor-folder-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorName: doctorFullName, campus: formData.campus }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.filesByCategory) setFolderFiles(data.filesByCategory);
        if (data.rutaArchivos) handleChange('rutaArchivos', data.rutaArchivos);
      }
    } catch (err) {
      console.error('Error fetching folder files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (formData.firstName || formData.lastName) {
      fetchFolderFiles();
    }
  }, []);

  const handleChange = (field: keyof DoctorCredential, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Step 1: Confirm Profile and Create Folder
  const handleConfirmProfileAndCreateFolder = async () => {
    if (!formData.firstName || !formData.paternalLastName) {
      alert('Por favor ingrese al menos el Nombre y Apellido Paterno del médico.');
      return;
    }

    setIsSubmittingProfile(true);
    try {
      const fullLastName = [formData.paternalLastName, formData.maternalLastName].filter(Boolean).join(' ') || formData.lastName || '';
      const doctorFullName = `${formData.firstName} ${fullLastName}`.trim();

      // 1. Save or Update Profile in Database
      const credRes = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          lastName: fullLastName,
          rutaArchivos: currentFolderPath
        }),
      });

      const credData = await credRes.json();
      if (!credData.success) {
        alert('Error al guardar la información del perfil del médico.');
        setIsSubmittingProfile(false);
        return;
      }

      // Update state with returned assigned DB ID and folio
      const assignedId = credData.id;
      const assignedFolio = credData.folio;
      const assignedPath = credData.rutaArchivos || currentFolderPath;

      // 2. Create physical folder on server disk
      const folderRes = await fetch('/api/create-doctor-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: assignedId,
          doctorName: doctorFullName,
          campus: formData.campus,
        }),
      });

      const folderData = await folderRes.json();
      const finalFolderPath = folderData.rutaArchivos || folderData.fullFolderPath || assignedPath;

      const updatedCred: DoctorCredential = {
        ...formData,
        id: assignedId,
        folio: assignedFolio,
        lastName: fullLastName,
        rutaArchivos: finalFolderPath
      };

      setFormData(updatedCred);
      await fetchFolderFiles();

      // Advance to Step 2 (Documentos)
      setActiveStep('documentos');
    } catch (err) {
      console.error('Error processing profile and folder:', err);
      alert('Ocurrió un error al crear la carpeta y confirmar el perfil.');
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  // Handle uploading files in Step 2
  const handleFileUpload = async (categoryKey: string, file: File) => {
    const fullLastName = [formData.paternalLastName, formData.maternalLastName].filter(Boolean).join(' ') || formData.lastName || '';
    const doctorFullName = `${formData.firstName || ''} ${fullLastName}`.trim();
    
    if (!doctorFullName) {
      alert('Primero confirme el perfil profesional del médico.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const fileBase64 = event.target?.result as string;
      try {
        const res = await fetch('/api/upload-doctor-documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctorId: formData.id,
            doctorName: doctorFullName,
            campus: formData.campus,
            documents: [{ categoryKey, fileName: file.name, fileBase64 }],
          }),
        });
        const data = await res.json();
        if (data.success) {
          if (data.rutaArchivos) {
            handleChange('rutaArchivos', data.rutaArchivos);
          }
          if (categoryKey === 'foto_perfil' && data.savedFiles?.[0]?.path) {
            handleChange('portraitUrl', data.savedFiles[0].path);
          }
          await fetchFolderFiles();
        } else {
          alert('Error al subir el archivo: ' + (data.error || 'Desconocido'));
        }
      } catch (err) {
        console.error('Error uploading document:', err);
        alert('Error al adjuntar el documento.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Save Progress (Guardar - pendiente de firmar)
  const handleSaveProgress = async () => {
    try {
      const fullLastName = [formData.paternalLastName, formData.maternalLastName].filter(Boolean).join(' ') || formData.lastName || '';
      const newStatus = formData.status === 'VERIFICADO' ? 'VERIFICADO' : 'PENDIENTE';
      
      const payload: DoctorCredential = {
        ...formData,
        lastName: fullLastName,
        status: newStatus,
        rutaArchivos: currentFolderPath
      };

      onSave(payload);
      alert('Información del expediente guardada correctamente.');
      onClose();
    } catch (err) {
      console.error('Error saving progress:', err);
    }
  };

  // Finalize and Sign (Firmar - expediente verificado)
  const handleSignAndFinalize = async () => {
    try {
      const fullLastName = [formData.paternalLastName, formData.maternalLastName].filter(Boolean).join(' ') || formData.lastName || '';
      
      const payload: DoctorCredential = {
        ...formData,
        lastName: fullLastName,
        status: 'VERIFICADO',
        active: true,
        rutaArchivos: currentFolderPath
      };

      onSave(payload);
      alert('Expediente del médico verificado y firmado exitosamente.');
      onClose();
    } catch (err) {
      console.error('Error signing credential:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-600 to-red-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-red-900/30">
              {formData.firstName?.[0] || 'M'}{formData.paternalLastName?.[0] || formData.lastName?.[0] || 'E'}
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">
                {formData.firstName ? `Dr. ${formData.firstName} ${formData.paternalLastName || formData.lastName || ''}` : 'Nuevo Expediente Médico'}
              </h2>
              <p className="text-xs text-slate-400 flex items-center space-x-2 mt-0.5">
                <span>Folio: <strong className="text-slate-200">{formData.folio || formData.id || 'POR ASIGNAR'}</strong></span>
                <span>•</span>
                <span>Campus: <strong className="text-red-400">{formData.campus || 'Hermosillo'}</strong></span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step Indicator */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center space-x-2 sm:space-x-6 w-full">
            {/* Step 1 */}
            <button
              onClick={() => setActiveStep('profile')}
              className={`flex items-center space-x-2 py-1 px-3 rounded-lg transition cursor-pointer ${
                activeStep === 'profile' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${activeStep === 'profile' ? 'bg-white text-red-600' : 'bg-slate-200 text-slate-700'}`}>
                1
              </span>
              <span>Perfil Profesional</span>
            </button>

            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />

            {/* Step 2 */}
            <button
              onClick={() => {
                if (!formData.firstName || !formData.paternalLastName) {
                  alert('Complete los datos del perfil antes de pasar a documentos.');
                  return;
                }
                setActiveStep('documentos');
              }}
              className={`flex items-center space-x-2 py-1 px-3 rounded-lg transition cursor-pointer ${
                activeStep === 'documentos' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${activeStep === 'documentos' ? 'bg-white text-red-600' : 'bg-slate-200 text-slate-700'}`}>
                2
              </span>
              <span>Adjuntar Documentos</span>
            </button>

            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />

            {/* Step 3 */}
            <button
              onClick={() => {
                if (!formData.firstName || !formData.paternalLastName) {
                  alert('Complete los datos del perfil antes de pasar a la firma.');
                  return;
                }
                setActiveStep('firma');
              }}
              className={`flex items-center space-x-2 py-1 px-3 rounded-lg transition cursor-pointer ${
                activeStep === 'firma' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${activeStep === 'firma' ? 'bg-white text-red-600' : 'bg-slate-200 text-slate-700'}`}>
                3
              </span>
              <span>Firma y Verificación</span>
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 max-h-[68vh] overflow-y-auto">

          {/* STEP 1: PERFIL PROFESIONAL */}
          {activeStep === 'profile' && (
            <div className="space-y-5 text-xs">
              
              {/* Folder Path Banner */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center space-x-3 shadow-inner">
                <Folder className="w-5 h-5 text-red-400 shrink-0" />
                <div className="overflow-hidden">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Ruta de Carpeta Física en Servidor</span>
                  <span className="font-mono text-red-300 font-semibold text-[11px] truncate block" title={currentFolderPath}>
                    {currentFolderPath}
                  </span>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nombre(s) *</label>
                  <input
                    type="text"
                    placeholder="Ej. David"
                    value={formData.firstName || ''}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Apellido Paterno *</label>
                  <input
                    type="text"
                    placeholder="Ej. Ibarra"
                    value={formData.paternalLastName || formData.lastName || ''}
                    onChange={(e) => {
                      handleChange('paternalLastName', e.target.value);
                      handleChange('lastName', e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Apellido Materno</label>
                  <input
                    type="text"
                    placeholder="Ej. Estrada"
                    value={formData.maternalLastName || ''}
                    onChange={(e) => handleChange('maternalLastName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Cédula Profesional</label>
                  <input
                    type="text"
                    placeholder="Ej. 12345678"
                    value={formData.npi || ''}
                    onChange={(e) => handleChange('npi', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Especialidad Principal *</label>
                  <input
                    type="text"
                    placeholder="Ej. Anestesiología"
                    value={formData.specialty || ''}
                    onChange={(e) => handleChange('specialty', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Subespecialidad</label>
                  <input
                    type="text"
                    placeholder="Ej. Medicina Crítica"
                    value={formData.subspecialty || ''}
                    onChange={(e) => handleChange('subspecialty', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tipo de Médico</label>
                  <select
                    value={formData.physicianType || 'Médico de Staff'}
                    onChange={(e) => handleChange('physicianType', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="Médico de Staff">Médico de Staff</option>
                    <option value="Médico Interconsultante">Médico Interconsultante</option>
                    <option value="Médico Residente">Médico Residente</option>
                    <option value="Médico Externo">Médico Externo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Campus / Sede *</label>
                  <select
                    value={formData.campus || 'Hermosillo'}
                    onChange={(e) => handleChange('campus', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-white font-bold text-red-600"
                  >
                    <option value="Hermosillo">Hermosillo (HER)</option>
                    <option value="Guaymas">Guaymas (GYM)</option>
                    <option value="Obregón">Obregón (OBG)</option>
                    <option value="Caborca">Caborca (CAB)</option>
                    <option value="Hermosillo/Guaymas">Hermosillo / Guaymas</option>
                    <option value="Hermosillo/Obregón">Hermosillo / Obregón</option>
                    <option value="Guaymas/Obregón">Guaymas / Obregón</option>
                    <option value="Hermosillo/Guaymas/Obregón">Hermosillo / Guaymas / Obregón</option>
                    {formData.campus && ![
                      'Hermosillo', 'Guaymas', 'Obregón', 'Caborca',
                      'Hermosillo/Guaymas', 'Hermosillo/Obregón', 'Guaymas/Obregón', 'Hermosillo/Guaymas/Obregón'
                    ].includes(formData.campus) && (
                      <option value={formData.campus}>{formData.campus}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Sexo / Género</label>
                  <select
                    value={formData.gender || 'MASCULINO'}
                    onChange={(e) => handleChange('gender', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="MASCULINO">MASCULINO</option>
                    <option value="FEMENINO">FEMENINO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">¿Es Médico Socio?</label>
                  <select
                    value={formData.isPartner ? 'SI' : 'NO'}
                    onChange={(e) => handleChange('isPartner', e.target.value === 'SI')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="NO">NO</option>
                    <option value="SI">SÍ - Socio Institucional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="doctor@sanjose.com.mx"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Teléfono / Celular</label>
                  <input
                    type="text"
                    placeholder="662 123 4567"
                    value={formData.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">CURP</label>
                  <input
                    type="text"
                    value={formData.curpIne || ''}
                    onChange={(e) => handleChange('curpIne', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50/50 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">RFC</label>
                  <input
                    type="text"
                    value={formData.rfc || ''}
                    onChange={(e) => handleChange('rfc', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50/50 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Vencimiento CONACEM / Consejo</label>
                  <input
                    type="date"
                    value={formData.consejoExpiryDate || ''}
                    onChange={(e) => handleChange('consejoExpiryDate', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50/50 font-medium"
                  />
                </div>
              </div>

              {/* Wizard Next Button in Step 1 */}
              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={handleConfirmProfileAndCreateFolder}
                  disabled={isSubmittingProfile}
                  className="inline-flex items-center space-x-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white text-xs font-extrabold px-6 py-3 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>{isSubmittingProfile ? 'Creando Carpeta...' : 'Siguiente: Confirmar Perfil y Crear Carpeta'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ADJUNTAR DOCUMENTOS */}
          {activeStep === 'documentos' && (
            <div className="space-y-5 text-xs">
              
              {/* Folder Info Banner */}
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-start space-x-3 text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-emerald-950">Perfil Confirmado y Carpeta Física Asignada</p>
                  <p className="font-mono text-[11px] text-emerald-800 mt-0.5">
                    Ruta del Servidor: <strong>{currentFolderPath}</strong>
                  </p>
                </div>
              </div>

              {/* Document Dropzones */}
              {isLoadingFiles ? (
                <div className="text-center py-8 text-slate-400 font-semibold">Cargando archivos del expediente físico...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'solicitud_cred', label: '1. Solicitud de Credencialización' },
                    { key: 'titulo_profesional', label: '2. Título Profesional' },
                    { key: 'cedula_profesional', label: '3. Cédula Profesional' },
                    { key: 'ine_identificacion', label: '4. Identificación Oficial (INE)' },
                    { key: 'certificacion_consejo', label: '5. Certificación de Consejo de Especialidad' },
                    { key: 'constancia_situacion_fiscal', label: '6. Constancia Situación Fiscal (RFC)' },
                    { key: 'foto_perfil', label: '7. Fotografía de Perfil' },
                    { key: 'curriculum_vitae', label: '8. Curriculum Vitae y Adicionales' },
                  ].map((cat) => {
                    const files = folderFiles[cat.key] || [];
                    return (
                      <div key={cat.key} className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 hover:bg-slate-50 transition">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-slate-800 text-xs">{cat.label}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${files.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                            {files.length > 0 ? 'Adjuntado' : 'Pendiente'}
                          </span>
                        </div>

                        {files.length > 0 ? (
                          <div className="space-y-1.5 mb-3">
                            {files.map((f, i) => {
                              const isImage = /\.(jpg|jpeg|png|webp)$/i.test(f.name) || cat.key === 'foto_perfil';
                              return (
                                <div key={i} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center space-x-2.5 shadow-2xs">
                                  {isImage && (
                                    <img
                                      src={f.previewUrl}
                                      alt={f.name}
                                      className="w-10 h-10 object-cover rounded-md border border-slate-200 shrink-0 bg-slate-100"
                                      onError={(e) => {
                                        // Hide image element if file URL cannot be rendered as image
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <a
                                    href={f.previewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-red-600 hover:underline text-[11px] font-semibold truncate flex-1 block"
                                  >
                                    📄 {f.name}
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-slate-400 italic mb-3 text-[11px]">Sin archivo adjuntado</p>
                        )}

                        <label className="inline-flex items-center space-x-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition shadow-2xs">
                          <Upload className="w-3.5 h-3.5 text-red-600" />
                          <span>Adjuntar Documento</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleFileUpload(cat.key, e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: FIRMA DIGITAL */}
          {activeStep === 'firma' && (
            <div className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                El proceso de verificación requiere la confirmación autógrafa o representación digital de la firma del médico para completar el expediente formal.
              </p>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 text-center">
                <textarea
                  placeholder="Ingrese el trazo, clave de certificación o representación en Base64 de la firma..."
                  value={signatureCanvas}
                  onChange={(e) => setSignatureCanvas(e.target.value)}
                  className="w-full h-28 p-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                />
              </div>

              {formData.signatureUrl && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center space-x-2 text-emerald-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Firma digital verificada en servidor.</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Bottom Finish Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Está seguro de eliminar el expediente de Dr. ${formData.firstName} ${formData.paternalLastName || formData.lastName}?`)) {
                  onDelete(formData.id);
                }
              }}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar Expediente</span>
            </button>
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Cancelar
            </button>

            {/* BOTÓN GUARDAR (Para guardar avance si faltan archivos o está pendiente de firmar) */}
            <button
              type="button"
              onClick={handleSaveProgress}
              className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-2xs cursor-pointer"
              title="Guardar expediente (Pendiente de firmar)"
            >
              <Save className="w-4 h-4 text-slate-300" />
              <span>Guardar (Pendiente)</span>
            </button>

            {/* BOTÓN FIRMAR (Cuando ya está verificado todo el registro) */}
            <button
              type="button"
              onClick={handleSignAndFinalize}
              className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-5 py-2 rounded-lg transition shadow-sm cursor-pointer"
              title="Firmar y marcar expediente como verificado"
            >
              <PenTool className="w-4 h-4" />
              <span>Firmar (Verificado)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

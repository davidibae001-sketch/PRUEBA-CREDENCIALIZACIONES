import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { DirectoryPhysician } from '../types';
import { getDirectory, saveDirectory, bulkSaveDirectory, deleteDirectory, safeSetLocalStorage } from '../lib/api';
import { 
  Plus, Search, Edit2, Trash2, Download, FileSpreadsheet, 
  UploadCloud, ArrowLeft, Check, AlertCircle, X, Users, 
  Building2, Phone, Sparkles, Filter, CheckCircle, Mail, FileText
} from 'lucide-react';

interface MedicalDirectoryProps {
  onBackToDashboard: () => void;
  onNavigateToCalendar: () => void;
  userRole?: 'admin' | 'rh' | 'admision' | 'directorio' | 'guardias';
}

// 12 Required Excel Columns in exact sequence:
export const REQUIRED_EXCEL_HEADERS = [
  "MODULO",
  "EXTENSION MODULO",
  "EXTENSION CONSULTORIO",
  "SUITE",
  "PRIMER APELLIDO",
  "SEGUNDO APELLIDO",
  "NOMBRE",
  "ESPECIALIDAD",
  "ESPECIALIDAD UNIFICADA",
  "CORREO",
  "CEL",
  "MARCADO RAPIDO"
];

const DEFAULT_DIRECTORY: DirectoryPhysician[] = [
  {
    id: 'DIR-001',
    fullName: 'Dr. MARTIN ALBERTO SITTEN AYALA',
    cellPhone: '662-111-0716',
    hospitalExtension: 'Ext. 1103',
    moduleAndOffice: 'MODULO A, Suite 103-A',
    specialty: 'ORTOPEDIA Y TRAUMATOLOGÍA',
    shortCode: '##095',
    modulo: 'MODULO A',
    extensionModulo: 'EXT.1100',
    extensionConsultorio: 'Ext. 1103',
    suite: '103-A',
    primerApellido: 'SITTEN',
    segundoApellido: 'AYALA',
    nombre: 'MARTIN ALBERTO',
    especialidadUnificada: 'ORTOPEDIA',
    correo: 'drsitten@hotmail.com'
  },
  {
    id: 'DIR-002',
    fullName: 'Dr. ENRIQUE ALONSO COVARRUBIAS SANCHEZ',
    cellPhone: '662-848-0218',
    hospitalExtension: 'Ext. 1104',
    moduleAndOffice: 'MODULO A, Suite 104-A',
    specialty: 'ORTOPEDIA Y TRAUMATOLOGÍA',
    shortCode: '##429',
    modulo: 'MODULO A',
    extensionModulo: 'EXT.1100',
    extensionConsultorio: 'Ext. 1104',
    suite: '104-A',
    primerApellido: 'COVARRUBIAS',
    segundoApellido: 'SANCHEZ',
    nombre: 'ENRIQUE ALONSO',
    especialidadUnificada: 'ORTOPEDIA',
    correo: 'covarrubias_ort@hotmail.com'
  },
  {
    id: 'DIR-003',
    fullName: 'Dr. ALBERTO BERNABE SOTO GRACIA',
    cellPhone: '662-115-0954',
    hospitalExtension: 'Ext. 1105',
    moduleAndOffice: 'MODULO A, Suite 105-A',
    specialty: 'ORTOPEDIA Y TRAUMATOLOGÍA',
    shortCode: '##099',
    modulo: 'MODULO A',
    extensionModulo: 'EXT.1100',
    extensionConsultorio: 'Ext. 1105',
    suite: '105-A',
    primerApellido: 'SOTO',
    segundoApellido: 'GRACIA',
    nombre: 'ALBERTO BERNABE',
    especialidadUnificada: 'ORTOPEDIA',
    correo: 'albertosotog@hotmail.com'
  },
  {
    id: 'DIR-004',
    fullName: 'Dr. RAMIRO CRUZ VERGARA',
    cellPhone: '662-257-1819',
    hospitalExtension: 'Ext. 1106',
    moduleAndOffice: 'MODULO A, Suite 106-A',
    specialty: 'ORTOPEDIA Y TRAUMATOLOGÍA',
    shortCode: '##026',
    modulo: 'MODULO A',
    extensionModulo: 'EXT.1100',
    extensionConsultorio: 'Ext. 1106',
    suite: '106-A',
    primerApellido: 'CRUZ',
    segundoApellido: 'VERGARA',
    nombre: 'RAMIRO',
    especialidadUnificada: 'ORTOPEDIA',
    correo: 'drcruzvergara@gmail.com'
  },
  {
    id: 'DIR-005',
    fullName: 'Dr. ALEJANDRO GONZALEZ MARES',
    cellPhone: '662-170-5350',
    hospitalExtension: 'Ext. 2101',
    moduleAndOffice: 'MODULO C, Suite 201-C',
    specialty: 'INFECTOLOGO PEDIATRIA',
    shortCode: '##791',
    modulo: 'MODULO C',
    extensionModulo: 'EXT. 2100',
    extensionConsultorio: 'Ext. 2101',
    suite: '201-C',
    primerApellido: 'GONZALEZ',
    segundoApellido: 'MARES',
    nombre: 'ALEJANDRO',
    especialidadUnificada: 'INFECTOLOGIA',
    correo: 'dralejandrogm@hotmail.com'
  }
];

export default function MedicalDirectory({ onBackToDashboard, onNavigateToCalendar, userRole = 'admin' }: MedicalDirectoryProps) {
  const canEdit = userRole === 'admin' || userRole === 'directorio';
  const [physicians, setPhysicians] = useState<DirectoryPhysician[]>(() => {
    const saved = localStorage.getItem('credsj_directory');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse directory state', e);
      }
    }
    return DEFAULT_DIRECTORY;
  });

  // Sync live directory from API
  useEffect(() => {
    async function loadDir() {
      try {
        const liveDir = await getDirectory();
        if (liveDir && liveDir.length > 0) {
          setPhysicians(liveDir);
        }
      } catch (err) {
        console.error("Directory component live sync:", err);
      }
    }
    loadDir();
  }, []);

  useEffect(() => {
    safeSetLocalStorage('credsj_directory', physicians);
  }, [physicians]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('Todas');
  
  // Modal & Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPhysician, setEditingPhysician] = useState<DirectoryPhysician | null>(null);
  
  // Form fields matching the 12 columns
  const [modulo, setModulo] = useState('');
  const [extensionModulo, setExtensionModulo] = useState('');
  const [extensionConsultorio, setExtensionConsultorio] = useState('');
  const [suite, setSuite] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [segundoApellido, setSegundoApellido] = useState('');
  const [nombre, setNombre] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [especialidadUnificada, setEspecialidadUnificada] = useState('');
  const [correo, setCorreo] = useState('');
  const [cellPhone, setCellPhone] = useState('');
  const [shortCode, setShortCode] = useState('');

  // Import states
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState(0); // 0: drop, 1: parsing, 2: preview, 3: ready
  const [importedPreview, setImportedPreview] = useState<DirectoryPhysician[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Diacritics/Accents and case-insensitive string normalizer
  const normalizeStr = (str?: string | null) => {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  };

  // List of specialties for dropdown filter
  const specialties = ['Todas', ...Array.from(new Set(
    physicians
      .flatMap(p => [p.especialidadUnificada, p.specialty])
      .map(s => (s || '').trim())
      .filter(Boolean)
  ))].sort((a: string, b: string) => a === 'Todas' ? -1 : b === 'Todas' ? 1 : a.localeCompare(b));

  const handleShowToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleOpenAddForm = () => {
    setEditingPhysician(null);
    setModulo('');
    setExtensionModulo('');
    setExtensionConsultorio('');
    setSuite('');
    setPrimerApellido('');
    setSegundoApellido('');
    setNombre('');
    setEspecialidad('');
    setEspecialidadUnificada('');
    setCorreo('');
    setCellPhone('');
    setShortCode('');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (physician: DirectoryPhysician) => {
    setEditingPhysician(physician);
    setModulo(physician.modulo || '');
    setExtensionModulo(physician.extensionModulo || '');
    setExtensionConsultorio(physician.extensionConsultorio || physician.hospitalExtension || '');
    setSuite(physician.suite || '');
    setPrimerApellido(physician.primerApellido || '');
    setSegundoApellido(physician.segundoApellido || '');
    setNombre(physician.nombre || '');
    setEspecialidad(physician.specialty || '');
    setEspecialidadUnificada(physician.especialidadUnificada || physician.specialty || '');
    setCorreo(physician.correo || '');
    setCellPhone(physician.cellPhone || '');
    setShortCode(physician.shortCode || '');
    setIsFormOpen(true);
  };

  const handleDeletePhysician = async (id: string, name: string) => {
    if (window.confirm(`¿Está seguro de que desea eliminar al ${name} del directorio?`)) {
      setPhysicians(prev => prev.filter(p => p.id !== id));
      await deleteDirectory(id);
      handleShowToast(`Médico eliminado: ${name}`);
    }
  };

  const handleSavePhysician = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!nombre && !primerApellido) || !cellPhone) {
      alert('Por favor complete al menos el nombre/apellido y número celular.');
      return;
    }

    const cleanShortCode = shortCode.trim() 
      ? (shortCode.trim().startsWith('##') ? shortCode.trim() : `##${shortCode.trim()}`) 
      : undefined;

    let fullDoctorName = [nombre, primerApellido, segundoApellido].filter(Boolean).join(' ').trim();
    if (!fullDoctorName) fullDoctorName = 'Sin Nombre Registrado';
    if (!fullDoctorName.toUpperCase().startsWith('DR.') && !fullDoctorName.toUpperCase().startsWith('DRA.')) {
      fullDoctorName = `Dr. ${fullDoctorName}`;
    }

    let modOffice = '';
    if (modulo && suite) {
      modOffice = `${modulo}, Suite ${suite}`;
    } else if (modulo) {
      modOffice = modulo;
    } else if (suite) {
      modOffice = `Suite ${suite}`;
    } else {
      modOffice = 'Sin módulo especificado';
    }

    const extHospital = extensionConsultorio || extensionModulo || 'Ext. N/A';

    const physicianObj: DirectoryPhysician = {
      id: editingPhysician ? editingPhysician.id : `DIR-${Date.now().toString().slice(-4)}`,
      fullName: fullDoctorName,
      cellPhone: cellPhone,
      hospitalExtension: extHospital.startsWith('Ext') ? extHospital : `Ext. ${extHospital}`,
      moduleAndOffice: modOffice,
      specialty: especialidad || especialidadUnificada || 'Medicina General',
      shortCode: cleanShortCode,

      modulo: modulo || undefined,
      extensionModulo: extensionModulo || undefined,
      extensionConsultorio: extensionConsultorio || undefined,
      suite: suite || undefined,
      primerApellido: primerApellido || undefined,
      segundoApellido: segundoApellido || undefined,
      nombre: nombre || undefined,
      especialidadUnificada: especialidadUnificada || undefined,
      correo: correo || undefined
    };

    if (editingPhysician) {
      setPhysicians(prev => prev.map(p => p.id === editingPhysician.id ? physicianObj : p));
      await saveDirectory(physicianObj);
      handleShowToast(`Datos de ${fullDoctorName} guardados exitosamente.`);
    } else {
      setPhysicians(prev => [physicianObj, ...prev]);
      await saveDirectory(physicianObj);
      handleShowToast(`Médico ${fullDoctorName} incorporado al directorio.`);
    }

    setIsFormOpen(false);
  };

  // Real Excel file reader using XLSX sheet_to_json
  const processExcelFile = async (file: File) => {
    setIsImporting(true);
    setImportStep(1);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("El archivo no contiene hojas de cálculo procesables.");

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        alert("El archivo subido está vacío o no contiene filas con datos.");
        setIsImporting(false);
        setImportStep(0);
        return;
      }

      const parsed: DirectoryPhysician[] = rawRows.map((row, index) => {
        const getVal = (keys: string[]) => {
          for (const k of Object.keys(row)) {
            const cleanKey = k.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ");
            for (const key of keys) {
              const cleanTarget = key.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ");
              if (cleanKey === cleanTarget) {
                return String(row[k] ?? '').trim();
              }
            }
          }
          return '';
        };

        const colModulo = getVal(['MODULO']);
        const colExtModulo = getVal(['EXTENSION MODULO', 'EXT MODULO', 'EXT. MODULO']);
        const colExtConsultorio = getVal(['EXTENSION CONSULTORIO', 'EXT CONSULTORIO', 'EXT. CONSULTORIO']);
        const colSuite = getVal(['SUITE', 'CONSULTORIO']);
        const colPrimerApellido = getVal(['PRIMER APELLIDO', 'APELLIDO PATERNO', 'PRIMER_APELLIDO']);
        const colSegundoApellido = getVal(['SEGUNDO APELLIDO', 'APELLIDO MATERNO', 'SEGUNDO_APELLIDO']);
        const colNombre = getVal(['NOMBRE', 'NOMBRES']);
        const colEspecialidad = getVal(['ESPECIALIDAD']);
        const colEspecialidadUnificada = getVal(['ESPECIALIDAD UNIFICADA', 'ESPECIALIDAD_UNIFICADA']);
        const colCorreo = getVal(['CORREO', 'EMAIL', 'CORREO ELECTRONICO']);
        const colCel = getVal(['CEL', 'CELULAR', 'TELEFONO', 'TEL']);
        const colMarcadoRapido = getVal(['MARCADO RAPIDO', 'MARCADO_RAPIDO', 'CODIGO', 'MARCADO RÁPIDO']);

        let fullDoctorName = [colNombre, colPrimerApellido, colSegundoApellido].filter(Boolean).join(' ').trim();
        if (!fullDoctorName) {
          fullDoctorName = getVal(['NOMBRE COMPLETO', 'FULL NAME', 'MEDICO']) || `Médico Excel ${index + 1}`;
        }

        if (!fullDoctorName.toUpperCase().startsWith('DR.') && !fullDoctorName.toUpperCase().startsWith('DRA.')) {
          fullDoctorName = `Dr. ${fullDoctorName}`;
        }

        let phone = colCel;
        if (phone && /^\d{10}$/.test(phone.replace(/\D/g, ''))) {
          const d = phone.replace(/\D/g, '');
          phone = `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
        }

        let ext = colExtConsultorio || colExtModulo || '';
        if (ext && !ext.toUpperCase().startsWith('EXT')) {
          ext = `Ext. ${ext}`;
        }

        let modOff = '';
        if (colModulo && colSuite) {
          modOff = `${colModulo}, Suite ${colSuite}`;
        } else if (colModulo) {
          modOff = colModulo;
        } else if (colSuite) {
          modOff = `Suite ${colSuite}`;
        }

        let shortC = colMarcadoRapido;
        if (shortC && !shortC.startsWith('##')) {
          shortC = `##${shortC}`;
        }

        const finalSpec = colEspecialidadUnificada || colEspecialidad || 'Medicina General';

        return {
          id: `DIR-XLS-${Date.now().toString().slice(-4)}-${index + 1}`,
          fullName: fullDoctorName,
          cellPhone: phone || 'Sin celular',
          hospitalExtension: ext || 'Ext. N/A',
          moduleAndOffice: modOff || 'Sin módulo',
          specialty: finalSpec,
          shortCode: shortC || undefined,

          modulo: colModulo || undefined,
          extensionModulo: colExtModulo || undefined,
          extensionConsultorio: colExtConsultorio || undefined,
          suite: colSuite || undefined,
          primerApellido: colPrimerApellido || undefined,
          segundoApellido: colSegundoApellido || undefined,
          nombre: colNombre || undefined,
          especialidadUnificada: colEspecialidadUnificada || undefined,
          correo: colCorreo || undefined
        };
      }).filter(p => p.fullName && p.fullName !== 'Dr.');

      setImportedPreview(parsed);
      setImportStep(2);
      setTimeout(() => {
        setImportStep(3);
      }, 700);
    } catch (err: any) {
      console.error("Error al leer archivo Excel:", err);
      alert(`Error al analizar el archivo Excel: ${err.message || 'Compruebe el formato'}`);
      setIsImporting(false);
      setImportStep(0);
    }
  };

  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processExcelFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      processExcelFile(file);
    } else {
      alert('Formato no soportado. Por favor suba un archivo Excel (.xlsx, .xls) o archivo de valores (.csv).');
    }
  };

  const handleApplyImport = async () => {
    const newlyImported: DirectoryPhysician[] = [];
    importedPreview.forEach(imp => {
      const finalImp = { ...imp, id: `DIR-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900) + 100}` };
      newlyImported.unshift(finalImp);
    });

    setPhysicians(prev => [...newlyImported, ...prev]);

    // Persist all imported physicians to PostgreSQL DB in bulk
    await bulkSaveDirectory(newlyImported);

    setIsImportOpen(false);
    setIsImporting(false);
    setImportStep(0);
    setImportedPreview([]);
    handleShowToast(`¡Éxito! Se han guardado e importado ${newlyImported.length} médicos en la base de datos.`);
  };

  // Download exact 12-column Excel template (blank sample)
  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        "MODULO": "MODULO A",
        "EXTENSION MODULO": "EXT.1100",
        "EXTENSION CONSULTORIO": "Ext. 1103",
        "SUITE": "103-A",
        "PRIMER APELLIDO": "SITTEN",
        "SEGUNDO APELLIDO": "AYALA",
        "NOMBRE": "MARTIN ALBERTO",
        "ESPECIALIDAD": "ORTOPEDIA Y TRAUMATOLOGÍA",
        "ESPECIALIDAD UNIFICADA": "ORTOPEDIA",
        "CORREO": "drsitten@hotmail.com",
        "CEL": "6621110716",
        "MARCADO RAPIDO": "##095"
      },
      {
        "MODULO": "MODULO A",
        "EXTENSION MODULO": "EXT.1100",
        "EXTENSION CONSULTORIO": "Ext. 1104",
        "SUITE": "104-A",
        "PRIMER APELLIDO": "COVARRUBIAS",
        "SEGUNDO APELLIDO": "SANCHEZ",
        "NOMBRE": "ENRIQUE ALONSO",
        "ESPECIALIDAD": "ORTOPEDIA Y TRAUMATOLOGÍA",
        "ESPECIALIDAD UNIFICADA": "ORTOPEDIA",
        "CORREO": "covarrubias_ort@hotmail.com",
        "CEL": "6628480218",
        "MARCADO RAPIDO": "##429"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: REQUIRED_EXCEL_HEADERS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla Directorio");
    XLSX.writeFile(workbook, "Plantilla_Directorio_Medico_HSJ.xlsx");
    handleShowToast("Plantilla Excel (.xlsx) descargada.");
  };

  // Export ALL current directory physicians to Excel (.xlsx) with all 12 headers
  const handleExportAllToExcel = async () => {
    let listToExport = physicians;
    try {
      const dbList = await getDirectory();
      if (dbList && dbList.length > 0) {
        listToExport = dbList;
        setPhysicians(dbList);
      }
    } catch (e) {
      console.warn("Could not fetch DB directory prior to export, using state list", e);
    }

    if (listToExport.length === 0) {
      alert("No hay médicos en el directorio para exportar.");
      return;
    }

    const exportRows = listToExport.map(p => ({
      "MODULO": p.modulo || (p.moduleAndOffice?.includes('MODULO') ? p.moduleAndOffice.split(',')[0].trim() : ''),
      "EXTENSION MODULO": p.extensionModulo || '',
      "EXTENSION CONSULTORIO": p.extensionConsultorio || p.hospitalExtension || '',
      "SUITE": p.suite || (p.moduleAndOffice?.includes('Suite') ? p.moduleAndOffice.split('Suite')[1].trim() : ''),
      "PRIMER APELLIDO": p.primerApellido || '',
      "SEGUNDO APELLIDO": p.segundoApellido || '',
      "NOMBRE": p.nombre || (p.fullName ? p.fullName.replace(/^(DR\.|DRA\.)\s*/i, '') : ''),
      "ESPECIALIDAD": p.specialty || '',
      "ESPECIALIDAD UNIFICADA": p.especialidadUnificada || p.specialty || '',
      "CORREO": p.correo || '',
      "CEL": p.cellPhone || '',
      "MARCADO RAPIDO": p.shortCode || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: REQUIRED_EXCEL_HEADERS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Directorio Completo");
    XLSX.writeFile(workbook, `Directorio_Medico_Completo_HSJ_${new Date().toISOString().split('T')[0]}.xlsx`);
    handleShowToast(`Éxito: Se exportaron ${exportRows.length} médicos del directorio a Excel.`);
  };

  // Search filter matching all fields with normalized diacritics and case tolerance
  const filtered = physicians.filter(p => {
    const term = normalizeStr(searchTerm);
    const matchesSearch = !term || 
      normalizeStr(p.fullName).includes(term) || 
      normalizeStr(p.specialty).includes(term) ||
      normalizeStr(p.especialidadUnificada).includes(term) ||
      normalizeStr(p.moduleAndOffice).includes(term) ||
      normalizeStr(p.correo).includes(term) ||
      normalizeStr(p.cellPhone).includes(term) ||
      normalizeStr(p.shortCode).includes(term) ||
      normalizeStr(p.primerApellido).includes(term) ||
      normalizeStr(p.segundoApellido).includes(term) ||
      normalizeStr(p.nombre).includes(term) ||
      normalizeStr(p.hospitalExtension).includes(term) ||
      normalizeStr(p.extensionModulo).includes(term) ||
      normalizeStr(p.extensionConsultorio).includes(term) ||
      normalizeStr(p.modulo).includes(term) ||
      normalizeStr(p.suite).includes(term);

    if (!matchesSearch) return false;

    if (selectedSpecialty === 'Todas') return true;

    const targetSpecNorm = normalizeStr(selectedSpecialty);
    const pSpecNorm = p.specialty ? normalizeStr(p.specialty) : '';
    const pUnifNorm = p.especialidadUnificada ? normalizeStr(p.especialidadUnificada) : '';

    const matchSpec = pSpecNorm !== '' && (pSpecNorm === targetSpecNorm || pSpecNorm.includes(targetSpecNorm) || targetSpecNorm.includes(pSpecNorm));
    const matchUnif = pUnifNorm !== '' && (pUnifNorm === targetSpecNorm || pUnifNorm.includes(targetSpecNorm) || targetSpecNorm.includes(pUnifNorm));

    return matchSpec || matchUnif;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 selection:bg-red-100 selection:text-red-900">
      
      {/* Header Bar */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm flex justify-between items-center px-8 h-16 no-print">
        <div className="flex items-center gap-4">
          <button 
            type="button" 
            onClick={onBackToDashboard}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors font-semibold text-xs uppercase cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />Volver
          </button>
          <span className="h-6 w-px bg-slate-200"></span>
          <span className="text-xl font-black text-red-900 tracking-tight font-headline">CredSJ</span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 py-1 bg-slate-100 rounded-lg">Directorio</span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (userRole === 'directorio') {
                handleShowToast("Su rol de Directorio está enfocado exclusivamente al Directorio Médico.");
              } else {
                onNavigateToCalendar();
              }
            }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-850 border border-slate-200 px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wide transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm font-bold">calendar_month</span>
            Calendario Guardias
          </button>
          <button
            onClick={() => {
              if (canEdit) {
                handleOpenAddForm();
              } else {
                handleShowToast("Acceso denegado: Su rol actual no cuenta con privilegios de escritura.");
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wide transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              canEdit
                ? 'bg-[#af101a] text-white hover:bg-red-800'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            <Plus className="w-4 h-4" /> Registrar Médico
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto pt-24 px-6 md:px-8">
        
        {/* Banner Title */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 pb-6 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 mb-1.5 text-[#af101a] font-bold text-xs uppercase tracking-widest">
              <Users className="w-4 h-4" /> Hospital San José de Hermosillo
            </div>
            <h1 className="font-headline text-4xl font-extrabold text-slate-900 tracking-tight">
              Directorio Médico General
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-body">
              Gobernanza activa con mapeo estructurado de 12 encabezados de Excel para importación directa de reportes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleExportAllToExcel}
              className="px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-black uppercase tracking-wider transition-colors inline-flex items-center gap-2 cursor-pointer shadow-xs"
              title="Exporta TODOS los médicos del directorio actual a un archivo Excel (.xlsx) con las 12 columnas"
            >
              <Download className="w-4 h-4 text-emerald-700" /> Exportar Directorio ({physicians.length})
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white shadow-sm hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 cursor-pointer"
              title="Descarga la plantilla muestra con los 12 encabezados de Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Plantilla Muestra
            </button>
            <button
              onClick={() => {
                if (canEdit) {
                  setImportStep(0);
                  setImportedPreview([]);
                  setIsImportOpen(true);
                } else {
                  handleShowToast("Acceso denegado: Su rol no permite importar archivos.");
                }
              }}
              className={`px-4 py-2.5 rounded-xl border font-extrabold text-xs uppercase tracking-wider transition-all inline-flex items-center gap-2 cursor-pointer ${
                canEdit 
                  ? 'border-red-250 bg-red-50 text-[#af101a] hover:bg-red-100' 
                  : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
            >
              <UploadCloud className="w-4 h-4" /> Importar Excel .xlsx
            </button>
          </div>
        </div>

        {/* Excel Header Structure Indicator Banner */}
        <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 mb-6 shadow-md border border-slate-800">
          <div className="flex items-center justify-between gap-4 mb-2">
            <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-400" /> Mapeo Oficial de Encabezados Excel Requeridos (12 Columnas en Orden)
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-mono">Compatibilidad .XLSX / .CSV</span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
            {REQUIRED_EXCEL_HEADERS.map((hdr, idx) => (
              <span key={hdr} className="bg-slate-800 border border-slate-700/80 px-2.5 py-1 rounded-md text-amber-200/90 font-bold">
                <span className="text-slate-500 mr-1">{idx + 1}.</span>{hdr}
              </span>
            ))}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-4 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
            <input
              type="text"
              placeholder="Buscar por médico, módulo, suite, correo o ## marcación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary w-full text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1 flex-shrink-0">
              <Filter className="w-3.5 h-3.5" /> Especialidad:
            </span>
            <select
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary w-full md:w-56"
            >
              {specialties.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Directory Table displaying detailed Excel fields */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600">
                  <th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-wider">Módulo y Suite</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-wider">Extensiones</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-wider">Nombre del Médico</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-wider">Especialidad</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-wider">Contacto & Correo</th>
                  <th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-wider text-right">Controles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="max-w-md mx-auto flex flex-col items-center justify-center space-y-3">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                          <Users className="w-6 h-6" />
                        </div>
                        <p className="font-bold text-slate-800 text-sm">No se encontraron médicos</p>
                        <p className="text-xs text-slate-400">Importe un archivo Excel con los 12 encabezados o registre médicos manualmente.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Modulo / Extension Modulo / Suite */}
                      <td className="px-5 py-3.5 text-xs">
                        <div className="font-extrabold text-slate-800">{p.modulo || p.moduleAndOffice.split(',')[0]}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Suite: <span className="font-bold text-slate-700">{p.suite || p.moduleAndOffice.split(',')[1] || 'N/A'}</span>
                        </div>
                      </td>

                      {/* Extensiones */}
                      <td className="px-5 py-3.5 text-xs font-mono">
                        <div className="text-slate-700 font-bold">{p.extensionConsultorio || p.hospitalExtension}</div>
                        {p.extensionModulo && (
                          <div className="text-[10px] text-slate-400">Módulo: {p.extensionModulo}</div>
                        )}
                      </td>

                      {/* Doctor Name */}
                      <td className="px-5 py-3.5 text-xs">
                        <div className="font-extrabold text-slate-900 text-sm">{p.fullName}</div>
                        {(p.primerApellido || p.segundoApellido) && (
                          <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                            {p.primerApellido} {p.segundoApellido}, {p.nombre}
                          </div>
                        )}
                      </td>

                      {/* Specialty / Especialidad Unificada */}
                      <td className="px-5 py-3.5 text-xs font-medium">
                        <span className="px-2.5 py-1 rounded-md bg-red-50 text-red-900 border border-red-100 font-bold inline-block">
                          {p.especialidadUnificada || p.specialty}
                        </span>
                        {p.specialty && p.especialidadUnificada && p.specialty !== p.especialidadUnificada && (
                          <div className="text-[10px] text-slate-400 mt-1">{p.specialty}</div>
                        )}
                      </td>

                      {/* Contact, Correo, Celular, Short Code */}
                      <td className="px-5 py-3.5 text-xs">
                        <div className="font-mono text-slate-800 font-bold flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> {p.cellPhone}
                        </div>
                        {p.correo && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400" /> {p.correo}
                          </div>
                        )}
                        {p.shortCode && (
                          <div className="text-[10px] text-[#af101a] font-extrabold tracking-wider mt-1 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded w-max inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px] font-bold">phone_in_talk</span> {p.shortCode}
                          </div>
                        )}
                      </td>

                      {/* Controls */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEdit ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditForm(p)}
                                className="p-2 text-slate-500 hover:text-red-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                                title="Editar datos del médico"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePhysician(p.id, p.fullName)}
                                className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                title="Eliminar médico"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100/80 px-2 py-1 rounded border border-slate-200/55 flex items-center gap-1 select-none">
                              Solo Consulta
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">
              Registros Totales: {filtered.length} de {physicians.length} médicos en directorio
            </span>
            <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1 tracking-wide">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Sincronizado con Conmutador y Base de Datos
            </span>
          </div>
        </div>

      </main>

      {/* Floating System Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-800 text-white rounded-xl shadow-xl px-5 py-3 flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-xs font-bold">{toast}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CRUD Form Modal Drawer */}
      <AnimatePresence>
        {isFormOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="fixed inset-0 bg-black z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-full sm:max-w-lg bg-white z-50 shadow-2xl flex flex-col no-print border-l border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="font-headline text-lg font-black text-slate-900">
                    {editingPhysician ? 'Editar Médico (12 Campos Excel)' : 'Registrar Nuevo Médico'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Estructura homologada con importador Excel .xlsx</p>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePhysician} className="flex-1 overflow-y-auto p-6 space-y-4">
                
                {/* Names */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Nombre(s) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. MARTIN"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Primer Apellido *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. SITTEN"
                      value={primerApellido}
                      onChange={(e) => setPrimerApellido(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Segundo Apellido</label>
                    <input
                      type="text"
                      placeholder="Ej. AYALA"
                      value={segundoApellido}
                      onChange={(e) => setSegundoApellido(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Specialties */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Especialidad Completa</label>
                    <input
                      type="text"
                      placeholder="ORTOPEDIA Y TRAUMATOLOGÍA"
                      value={especialidad}
                      onChange={(e) => setEspecialidad(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Especialidad Unificada *</label>
                    <input
                      type="text"
                      required
                      placeholder="ORTOPEDIA"
                      value={especialidadUnificada}
                      onChange={(e) => setEspecialidadUnificada(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none font-bold"
                    />
                  </div>
                </div>

                {/* Module & Suite */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Módulo</label>
                    <input
                      type="text"
                      placeholder="Ej. MODULO A"
                      value={modulo}
                      onChange={(e) => setModulo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Suite / Consultorio</label>
                    <input
                      type="text"
                      placeholder="Ej. 103-A"
                      value={suite}
                      onChange={(e) => setSuite(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Extensions */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Extensión Módulo</label>
                    <input
                      type="text"
                      placeholder="EXT.1100"
                      value={extensionModulo}
                      onChange={(e) => setExtensionModulo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Extensión Consultorio *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ext. 1103"
                      value={extensionConsultorio}
                      onChange={(e) => setExtensionConsultorio(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Contact: Email, Cel, Short Code */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="ejemplo@hotmail.com"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Celular *</label>
                    <input
                      type="text"
                      required
                      placeholder="6621110716"
                      value={cellPhone}
                      onChange={(e) => setCellPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-[#af101a] uppercase mb-1">Marcado Rápido (##)</label>
                    <input
                      type="text"
                      placeholder="##095"
                      value={shortCode}
                      onChange={(e) => setShortCode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-250 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-[#af101a] focus:outline-none font-extrabold text-[#af101a] font-mono"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex items-start gap-2.5 text-[11px] text-slate-500 leading-normal">
                  <Building2 className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p>Guarda la estructura exacta para sincronización continua con la base de datos central y conmutador.</p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-[#af101a] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-red-800 transition-colors cursor-pointer"
                  >
                    Guardar Médico
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Excel File Import Modal */}
      <AnimatePresence>
        {isImportOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!isImporting) setIsImportOpen(false); }}
              className="fixed inset-0 bg-black/70 z-[1000] no-print"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-[1001] overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-headline text-lg font-black text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Analizador de Archivos Excel (.xlsx / .csv)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Soporta la estructura exacta de 12 columnas en el orden correspondiente.</p>
                </div>
                <button
                  disabled={isImporting && importStep === 1}
                  onClick={() => setIsImportOpen(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {!isImporting && (
                  <div className="space-y-4">
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center hover:border-emerald-500 hover:bg-slate-50 transition-all cursor-pointer group text-center"
                    >
                      <input
                        type="file"
                        id="excel-file-uploader"
                        className="hidden"
                        accept=".csv, .xlsx, .xls"
                        onChange={handleExcelFileSelect}
                      />
                      <label htmlFor="excel-file-uploader" className="cursor-pointer flex flex-col items-center justify-center">
                        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-3 ring-4 ring-emerald-500/10 group-hover:scale-110 transition-transform">
                          <UploadCloud className="w-7 h-7" />
                        </div>
                        <p className="text-sm font-extrabold text-slate-800">
                          Arrastra tu archivo Excel (.xlsx) aquí o haz <span className="text-emerald-700 underline">clic para buscar</span>
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-wide">
                          Acepta formatos .XLSX, .XLS o .CSV
                        </p>
                      </label>
                    </div>

                    <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 text-xs">
                      <p className="font-extrabold text-slate-700 mb-1 flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-600" /> Mapeo de Encabezados Detectados Automáticamente:
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                        MODULO · EXTENSION MODULO · EXTENSION CONSULTORIO · SUITE · PRIMER APELLIDO · SEGUNDO APELLIDO · NOMBRE · ESPECIALIDAD · ESPECIALIDAD UNIFICADA · CORREO · CEL · MARCADO RAPIDO
                      </p>
                    </div>
                  </div>
                )}

                {isImporting && (
                  <div className="space-y-6">
                    {importStep === 1 && (
                      <div className="py-8 flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-700 rounded-full animate-spin mb-4" />
                        <p className="font-extrabold text-slate-800 text-sm">Leyendo hojas de cálculo y procesando las 12 columnas...</p>
                        <p className="text-xs text-slate-400 mt-1 font-mono">Estado: Extrayendo nombres, especialidades, módulos y marcación rápida</p>
                      </div>
                    )}

                    {importStep >= 2 && importedPreview.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold uppercase tracking-wide">
                          <span className="flex items-center gap-1 text-emerald-700">
                            <Check className="w-4 h-4" /> Registros Listos para Importar
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 font-mono px-2.5 py-0.5 rounded-full font-black">{importedPreview.length} médicos</span>
                        </div>

                        <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 shadow-inner">
                          {importedPreview.map((imp, idx) => (
                            <div key={idx} className="p-3 text-xs flex justify-between bg-slate-50/70 hover:bg-slate-100 transition-colors">
                              <div>
                                <p className="font-extrabold text-slate-900">{imp.fullName}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                  {imp.modulo} | Suite: {imp.suite} | {imp.especialidadUnificada}
                                </p>
                                {imp.correo && <p className="text-[10px] text-slate-400">{imp.correo}</p>}
                              </div>
                              <div className="text-right font-mono text-[10px] text-slate-600">
                                <p className="font-bold text-slate-800">{imp.cellPhone}</p>
                                <p>{imp.hospitalExtension}</p>
                                {imp.shortCode && <p className="text-red-700 font-extrabold">{imp.shortCode}</p>}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <AlertCircle className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                          <p className="text-xs font-medium text-emerald-950">
                            Confirmación: Al hacer clic en "Importar e Incorporar", se guardarán los {importedPreview.length} registros en el directorio activo y base de datos.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setIsImporting(false);
                          setIsImportOpen(false);
                        }}
                        className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={importStep < 2 || importedPreview.length === 0}
                        onClick={handleApplyImport}
                        className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Check className="w-4 h-4" /> Importar e Incorporar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

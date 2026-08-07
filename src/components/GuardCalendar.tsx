import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DirectoryPhysician, GuardShift, MedicalCredential } from '../types';
import { getGuards, saveGuard, deleteGuard, getDirectory, getCredentials, safeSetLocalStorage } from '../lib/api';
import { 
  ArrowLeft, Calendar as CalIcon, UserX, AlertTriangle, 
  Check, X, FileText, Plus, ChevronLeft, ChevronRight, 
  Sparkles, CheckCircle, Info, Bookmark, HelpCircle
} from 'lucide-react';

interface GuardCalendarProps {
  onBackToDashboard: () => void;
  onNavigateToDirectory: () => void;
  userRole?: 'admin' | 'rh' | 'admision' | 'directorio' | 'guardias';
}

const DEFAULT_SHIFTS: GuardShift[] = [
  {
    id: 'SFT-101',
    physicianId: 'DIR-001', // Dr. Alejandro Hermosillo
    date: '2026-06-10',
    specialty: 'Cardiología',
    missed: true,
    note: 'Inconveniente de salud imprevisto (gripe).'
  },
  {
    id: 'SFT-102',
    physicianId: 'DIR-001', // Dr. Alejandro Hermosillo
    date: '2026-06-12',
    specialty: 'Cardiología',
    missed: true,
    note: 'Faltó sin previo aviso.'
  },
  {
    id: 'SFT-103',
    physicianId: 'DIR-002', // Dra. Gabriela Moreno
    date: '2026-06-15',
    specialty: 'Pediatría',
    missed: false,
    note: 'Guardia completada exitosamente.'
  },
  {
    id: 'SFT-104',
    physicianId: 'DIR-003', // Dr. Francisco Ruiz
    date: '2026-06-16',
    specialty: 'Ginecología y Obstetricia',
    missed: false,
    note: 'Asiste de relevo por contingencia.'
  },
  {
    id: 'SFT-105',
    physicianId: 'DIR-007', // Dr. Jorge Arturo Peralta
    date: '2026-06-08',
    specialty: 'Urgencias Médicas',
    missed: true,
    note: 'No se reportó a piso. Guardia abandonada.'
  }
];

export default function GuardCalendar({ onBackToDashboard, onNavigateToDirectory, userRole = 'admin' }: GuardCalendarProps) {
  const canEdit = userRole === 'admin' || userRole === 'guardias';
  // Read Physicians from directory state
  const [physicians, setPhysicians] = useState<DirectoryPhysician[]>(() => {
    const saved = localStorage.getItem('credsj_directory');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    // Return empty if none, or import from DEFAULT_DIRECTORY if missing
    return [];
  });

  const [credentials, setCredentials] = useState<MedicalCredential[]>([]);
  const [shifts, setShifts] = useState<GuardShift[]>(() => {
    const saved = localStorage.getItem('credsj_guard_shifts');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_SHIFTS;
  });

  // Load live guard shifts, directory physicians, and credentials from DB Backend
  useEffect(() => {
    async function loadData() {
      try {
        const [liveShifts, liveDir, liveCreds] = await Promise.all([getGuards(), getDirectory(), getCredentials()]);
        setShifts(liveShifts);
        if (liveDir && liveDir.length > 0) {
          setPhysicians(liveDir);
        }
        if (liveCreds && liveCreds.length > 0) {
          setCredentials(liveCreds);
        }
      } catch (err) {
        console.error("Guards component failed live sync:", err);
      }
    }
    loadData();
  }, []);

  // Helper to verify if physician is a Partner / Socio (required for guard assignment)
  const isPhysicianSocio = (p: DirectoryPhysician) => {
    if (p.isPartner === 'NO' || p.isPartner === false) return false;
    if (p.isPartner === 'SI' || p.isPartner === true || p.isSocio === true) return true;
    const cred = credentials.find(c => c.id === p.id || (c.firstName && c.lastName && p.fullName.toLowerCase().includes(c.lastName.toLowerCase())));
    if (cred) {
      if (cred.isPartner === 'NO' || cred.isPartner === false || cred.physicianType === 'Externo') return false;
      if (cred.isPartner === 'SI' || cred.isPartner === true || cred.physicianType === 'Staff') return true;
    }
    return true; // Default to true if not explicitly marked as non-socio
  };

  useEffect(() => {
    safeSetLocalStorage('credsj_guard_shifts', shifts);
  }, [shifts]);

  // Sync state changes with local storage for directory in case changes occurred elsewhere
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('credsj_directory');
      if (saved) {
        try { setPhysicians(JSON.parse(saved)); } catch (e) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    handleStorageChange(); // Run once initially
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Calendar display state: starting June 2026
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(5); // June is index 5
  const [selectedSpecialty, setSelectedSpecialty] = useState('Todas');
  const [selectedDate, setSelectedDate] = useState<string | null>('2026-06-15');
  const [toast, setToast] = useState<string | null>(null);

  // Assignment Modal Fields
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignSpecialty, setAssignSpecialty] = useState('');
  const [assignPhysicianId, setAssignPhysicianId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignBackupId, setAssignBackupId] = useState('');
  const [assignBackupId3, setAssignBackupId3] = useState('');
  const [assignEscalationNote, setAssignEscalationNote] = useState('');

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const normalizeStr = (str?: string | null) => {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  };

  const matchSpecialty = (doctor: DirectoryPhysician, targetSpecialty: string): boolean => {
    if (!targetSpecialty || targetSpecialty === 'Todas') return true;
    const targetNorm = normalizeStr(targetSpecialty);
    const specNorm = doctor.specialty ? normalizeStr(doctor.specialty) : '';
    const unifNorm = doctor.especialidadUnificada ? normalizeStr(doctor.especialidadUnificada) : '';

    const matchSpec = specNorm !== '' && (specNorm === targetNorm || specNorm.includes(targetNorm) || targetNorm.includes(specNorm));
    const matchUnif = unifNorm !== '' && (unifNorm === targetNorm || unifNorm.includes(targetNorm) || targetNorm.includes(unifNorm));

    return matchSpec || matchUnif;
  };

  const specialties = ['Todas', ...Array.from(new Set([
    'Cardiología', 'Pediatría', 'Ginecología y Obstetricia', 'Medicina Interna', 'Traumatología y Ortopedia', 'Anestesiología', 'Urgencias Médicas', 'Ortopedia',
    ...physicians.map(p => (p.especialidadUnificada || p.specialty || '').trim()).filter(Boolean)
  ]))].sort((a: string, b: string) => a === 'Todas' ? -1 : b === 'Todas' ? 1 : a.localeCompare(b));

  const handleShowToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Helper calculation for absences (tachas)
  const getAbsenceCount = (physicianId: string) => {
    return shifts.filter(s => s.physicianId === physicianId && s.missed).length;
  };

  // Recommend doctors to remove (who have 2 or more missed absences across any guards)
  const removalRecommendations = physicians.map(p => {
    const absences = getAbsenceCount(p.id);
    return { physician: p, absences };
  }).filter(r => r.absences >= 2);

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  // Quick Action to resolve recommendation by removing a doctor from future shifts
  const handleExcludeDoctorFromShifts = async (physicianId: string, name: string) => {
    if (window.confirm(`¿Recomienda remover a ${name} de todas las guardias futuras? Esto cancelará sus asignaciones sin registro de asistencia.`)) {
      const futureShifts = shifts.filter(s => (s.physicianId === physicianId && !s.missed && new Date(s.date) >= new Date('2026-06-15')));
      setShifts(prev => prev.filter(s => !(s.physicianId === physicianId && !s.missed && new Date(s.date) >= new Date('2026-06-15'))));
      
      for (const shift of futureShifts) {
        await deleteGuard(shift.id);
      }
      handleShowToast(`Exclusión procesada. ${name} fue retirado de roles futuros.`);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !assignPhysicianId || !assignSpecialty) {
      alert('Por favor complete todos los datos.');
      return;
    }

    const doctor = physicians.find(p => p.id === assignPhysicianId);
    if (!doctor) return;

    // Check if physician already has a guard on this date
    const exists = shifts.some(s => s.physicianId === assignPhysicianId && s.date === selectedDate);
    if (exists) {
      alert(`El ${doctor.fullName} ya está asignado a una guardia para este día.`);
      return;
    }

    // Safety: warn immediately if they have already 2 or more tachas
    const prevAbsences = getAbsenceCount(assignPhysicianId);
    if (prevAbsences >= 2) {
      const proceed = window.confirm(`¡ADVERTENCIA: RECOMENDACIÓN DE EXCLUSIÓN ACTIVA!\nEl ${doctor.fullName} cuenta con ${prevAbsences} inasistencias o inasistencias reportadas (tachas). ¿Desea asignarlo a pesar de la recomendación de sanción?`);
      if (!proceed) return;
    }

    const newShift: GuardShift = {
      id: `SFT-${Date.now().toString().slice(-4)}`,
      physicianId: assignPhysicianId,
      date: selectedDate,
      specialty: assignSpecialty,
      missed: false,
      note: assignNote,
      backupPhysicianId: assignBackupId || undefined,
      backupPhysicianId3: assignBackupId3 || undefined,
      escalationNote: assignEscalationNote || undefined
    };

    setShifts(prev => [...prev, newShift]);
    await saveGuard(newShift);
    
    setIsAssigning(false);
    setAssignNote('');
    setAssignPhysicianId('');
    setAssignBackupId('');
    setAssignBackupId3('');
    setAssignEscalationNote('');
    handleShowToast(`Nueva guardia asignada a ${doctor.fullName} el ${selectedDate}.`);
  };

  const toggleAbsence = async (shiftId: string) => {
    let targetShift: GuardShift | undefined;
    
    setShifts(prev => prev.map(s => {
      if (s.id === shiftId) {
        const nextMissed = !s.missed;
        const doctor = physicians.find(p => p.id === s.physicianId);
        const docName = doctor ? doctor.fullName : 'Médico';
        
        handleShowToast(
          nextMissed 
            ? `Se ha colocado una TACHA (Faltó) a ${docName}.`
            : `Se ha registrado asistencia para ${docName}.`
        );

        targetShift = { ...s, missed: nextMissed };
        return targetShift;
      }
      return s;
    }));

    if (targetShift) {
      await saveGuard(targetShift);
    }
  };

  const deleteShift = async (shiftId: string) => {
    if (window.confirm('¿Desea eliminar este registro de guardia?')) {
      setShifts(prev => prev.filter(s => s.id !== shiftId));
      await deleteGuard(shiftId);
      handleShowToast('Guardia eliminada del calendario.');
    }
  };

  // Helper date parsing
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const fday = new Date(year, month, 1).getDay();
    // Adjust Sunday index to make Monday the first index (0-6 starting Monday) or leave standard (0 starting Sunday)
    return fday;
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  // Render arrays for grid slots
  const blankSlots = Array(firstDay).fill(null);
  const monthDaySlots = Array.from({ length: daysInMonth }, (_, index) => index + 1);

  // Dynamic filter for on-screen physicians
  const filteredShifts = (dayNum: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    return shifts.filter(s => s.date === dateStr && (selectedSpecialty === 'Todas' || s.specialty === selectedSpecialty));
  };

  const getDayClass = (dayNum: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayShifts = shifts.filter(s => s.date === dateStr && (selectedSpecialty === 'Todas' || s.specialty === selectedSpecialty));
    const hasMissed = dayShifts.some(s => s.missed);
    const hasActive = dayShifts.some(s => !s.missed);

    let classes = "h-24 md:h-28 border p-2 relative text-left align-top transition-all duration-150 cursor-pointer ";
    
    if (selectedDate === dateStr) {
      classes += "ring-4 ring-red-800/25 border-[#af101a] z-10 ";
      if (hasMissed) {
        classes += "bg-red-100 ";
      } else if (hasActive) {
        classes += "bg-emerald-100 ";
      } else {
        classes += "bg-slate-150 ";
      }
    } else {
      if (hasMissed) {
        classes += "bg-red-50 border-red-200 hover:bg-red-100/70 ";
      } else if (hasActive) {
        classes += "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100/50 ";
      } else {
        classes += "bg-white border-slate-100 hover:bg-slate-50 ";
      }
    }
    return classes;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 selection:bg-red-100 selection:text-red-900">
      
      {/* Header Bar */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm flex justify-between items-center px-8 h-16 no-print">
        <div className="flex items-center gap-4">
          <button 
            type="button" 
            onClick={onBackToDashboard}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors font-semibold text-xs uppercase"
          >
            <ArrowLeft className="w-5 h-5" />Volver
          </button>
          <span className="h-6 w-px bg-slate-200"></span>
          <span className="text-xl font-black text-red-900 tracking-tight font-headline">CredSJ</span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 py-1 bg-slate-100 rounded-lg">Calendario Guardias</span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (userRole === 'guardias') {
                handleShowToast("Su rol de Guardias está enfocado exclusivamente al Calendario de Guardias.");
              } else {
                onNavigateToDirectory();
              }
            }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-850 border border-slate-200 px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wide transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm font-bold">contacts</span>
            Directorio Médico
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto pt-24 px-6 md:px-8">
        
        {/* Banner */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8 pb-6 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 mb-1.5 text-[#af101a] font-bold text-xs uppercase tracking-widest">
              <CalIcon className="w-4 h-4" /> Roles de Guardia General
            </div>
            <h1 className="font-headline text-4xl font-extrabold text-slate-900 tracking-tight">
              Calendario de Guardias Médicas
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-body">
              Monitoreo diario de asistencia por especialidades. Sistema activo de alerta de inasistencias y recomendaciones de exclusión.
            </p>
          </div>

          {/* Quick Stats Panel */}
          <div className="flex gap-4 p-3 bg-slate-100 rounded-xl border border-slate-200/70 text-xs">
            <div className="px-3 border-r border-slate-200 text-center">
              <span className="block text-slate-400 font-extrabold text-[10px] uppercase">Roster Total</span>
              <span className="text-base font-bold text-slate-850">{physicians.length} Médicos</span>
            </div>
            <div className="px-3 border-r border-slate-200 text-center">
              <span className="block text-slate-400 font-extrabold text-[10px] uppercase">Guardias Registradas</span>
              <span className="text-base font-bold text-slate-850">{shifts.length} Roles</span>
            </div>
            <div className="px-3 text-center">
              <span className="block text-slate-450 font-extrabold text-[10px] uppercase text-red-700">Tachas (Faltas)</span>
              <span className="text-base font-black text-red-700">{shifts.filter(s => s.missed).length} Unidades</span>
            </div>
          </div>
        </div>

        {/* Outer Split Pane Structure */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT 2 COLS: Calendar Core Interface */}
          <div className="lg:col-span-2 space-y-6">

            {/* Specialty filter and Month controls */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              
              {/* Month Picker controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-black text-slate-800 min-w-32 text-center">
                  {monthNames[currentMonth]} {currentYear}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Specialty filter drop */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-500 flex-shrink-0">Especialidad:</span>
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 w-full sm:w-52"
                >
                  {specialties.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Main Calendar Grid Canvas */}
            <div className="bg-white border border-slate-250/70 shadow-sm rounded-2xl overflow-hidden">
              
              {/* Day numbers label bar */}
              <div className="grid grid-cols-7 bg-slate-50/80 border-b border-slate-200 text-center font-bold text-[10px] text-slate-500 uppercase tracking-widest py-3">
                <div>Do</div>
                <div>Lu</div>
                <div>Ma</div>
                <div>Mi</div>
                <div>Ju</div>
                <div>Vi</div>
                <div>Sá</div>
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 border-collapse">
                {blankSlots.map((_, idx) => (
                  <div key={`blank-${idx}`} className="h-24 md:h-28 border border-slate-50 bg-slate-55/35 opacity-40" />
                ))}

                {monthDaySlots.map(day => {
                  const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayShiftsList = filteredShifts(day);

                  return (
                    <div
                      key={`day-${day}`}
                      onClick={() => setSelectedDate(dateStr)}
                      className={getDayClass(day)}
                    >
                      {/* Day Number Label */}
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        selectedDate === dateStr ? 'bg-red-800 text-white shadow-sm' : 'text-slate-700'
                      }`}>
                        {day}
                      </span>

                      {/* Render Shift Mini Indicators */}
                      <div className="mt-1.5 space-y-1 overflow-y-auto max-h-16 no-scrollbar">
                        {dayShiftsList.slice(0, 3).map((s, idx) => {
                          const doc = physicians.find(p => p.id === s.physicianId);
                          const lastName = doc ? doc.fullName.split(' ').slice(-2, -1)[0] || doc.fullName.split(' ')[1] || 'Doctor' : 'Médico';
                          const phoneDisplay = doc?.shortCode ? ` (${doc.shortCode})` : '';
                          return (
                            <div
                              key={idx}
                              title={`${doc?.fullName || 'Médico'} - Specialty: ${s.specialty} ${phoneDisplay}`}
                              className={`text-[8.5px] px-1.5 py-0.5 rounded-md truncate font-black border leading-none flex items-center justify-between shadow-sm transition-colors ${
                                s.missed 
                                  ? 'bg-red-700 text-white border-red-850' 
                                  : 'bg-emerald-700 text-white border-emerald-850'
                              }`}
                            >
                              <span className="truncate">{lastName}{phoneDisplay}</span>
                              {s.missed ? (
                                <span className="font-extrabold text-[8.5px] ml-0.5">✗</span>
                              ) : (
                                <span className="font-extrabold text-[8.5px] ml-0.5">✓</span>
                              )}
                            </div>
                          );
                        })}
                        {dayShiftsList.length > 3 && (
                          <div className="text-[7.5px] font-bold text-slate-400 text-center uppercase tracking-wide">
                            + {dayShiftsList.length - 3} más
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Instruction footnote info */}
            <div className="text-xs text-slate-400 leading-normal flex items-start gap-2 bg-slate-100 p-4 border border-slate-200/60 rounded-xl font-body">
              <Info className="w-4.5 h-4.5 text-slate-500 mt-0.5 flex-shrink-0" />
              <p>Selecciona un día en la cuadrícula mensual para ver las guardias programadas, registrar la asistencia (marcar inasistencias tachándolas de rojo), o asignar un nuevo médico de guardia.</p>
            </div>
          </div>

          {/* RIGHT PANES: Selection Sidebar controls */}
          <div className="space-y-6">

            {/* SECTOR 1: Selected Day's active Guards panel */}
            <div className="bg-white border border-slate-250/70 shadow-sm rounded-2xl p-5">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-150">
                <span className="text-xs font-black text-slate-450 uppercase tracking-widest">
                  Guardias del Día
                </span>
                <span className="text-xs font-mono font-extrabold text-[#af101a] italic">
                  {selectedDate || 'Ninguno'}
                </span>
              </div>

              {selectedDate ? (() => {
                const dayShifts = shifts.filter(s => s.date === selectedDate);
                return (
                  <div className="pt-4 space-y-4">
                    {/* Add action */}
                    <button
                      onClick={() => {
                        if (!canEdit) {
                          handleShowToast("Acceso denegado: Su rol de consulta no cuenta con privilegios para asignar guardias.");
                          return;
                        }
                        if (physicians.length === 0) {
                          alert('Por favor registre médicos en el directorio antes de intentar agregarlos a las guardias.');
                          return;
                        }
                        setIsAssigning(true);
                      }}
                      className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm ${
                        canEdit 
                          ? 'bg-[#af101a] hover:bg-neutral-900 text-white cursor-pointer active:scale-95' 
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      }`}
                    >
                      <Plus className="w-4.5 h-4.5 stroke-[3px]" /> Programar Nueva Guardia
                    </button>

                    {dayShifts.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6 font-medium italic">
                        No hay guardias asignadas para esta fecha.
                      </p>
                    ) : (
                      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                        {dayShifts.map(s => {
                          const doc = physicians.find(p => p.id === s.physicianId);
                          const totalTachas = doc ? getAbsenceCount(doc.id) : 0;

                          const backupDoc = s.backupPhysicianId ? physicians.find(p => p.id === s.backupPhysicianId) : null;
                          const backupDoc3 = s.backupPhysicianId3 ? physicians.find(p => p.id === s.backupPhysicianId3) : null;

                          return (
                            <div 
                              key={s.id}
                              className={`p-4 rounded-xl border-l-4 transition-all shadow-sm ${
                                s.missed 
                                  ? 'bg-red-50/90 border border-red-250 border-l-red-650 shadow-red-50/50' 
                                  : 'bg-emerald-50/40 border border-emerald-200 border-l-emerald-600 shadow-emerald-50/20'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                  s.missed 
                                    ? 'bg-red-100 text-red-800 border border-red-200' 
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}>
                                  {s.missed ? '✗ Sanción / Falta' : '✓ Guardia Activa'}
                                </span>
                                {totalTachas >= 2 && (
                                  <span className="text-[8px] font-black text-red-900 bg-red-200/80 px-1.5 py-0.5 rounded animate-pulse">
                                    RECOMENDACIÓN EXCLUSIÓN
                                  </span>
                                )}
                              </div>

                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className={`font-black text-xs ${s.missed ? 'text-red-950 font-extrabold' : 'text-slate-900 font-extrabold'}`}>
                                    {doc ? doc.fullName : 'Médico Desconocido'}
                                  </h4>
                                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                    {s.specialty} · {doc?.moduleAndOffice || 'Sin módulo'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (canEdit) {
                                      deleteShift(s.id);
                                    } else {
                                      handleShowToast("Acceso denegado: Su perfil es de Solo Consulta y no puede remover guardias.");
                                    }
                                  }}
                                  className={`p-1 rounded-md transition-colors ${
                                    canEdit ? 'text-slate-400 hover:text-red-700 cursor-pointer' : 'text-slate-350 cursor-not-allowed'
                                  }`}
                                  title={canEdit ? "Quitar guardia" : "Quitar guardia bloqueado (Solo Consulta)"}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              {/* DIRECT CALL CODE */}
                              <div className="mt-2.5 bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-xs">
                                <div className="text-[9.5px] font-black uppercase tracking-widest text-slate-550 mb-1.5 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[13px] font-bold text-[#af101a]">phone_in_talk</span> 
                                  Celular Directo (1ro en Llamar):
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-extrabold text-slate-800">
                                    {doc?.fullName}
                                  </span>
                                  <span className="text-[11.5px] font-mono font-black text-white bg-[#af101a] px-2 py-0.5 rounded shadow-sm tracking-widest">
                                    {doc?.shortCode || '## No Conf'}
                                  </span>
                                </div>
                                {doc?.cellPhone && (
                                  <div className="text-[10px] text-slate-500 font-medium mt-1">
                                    Línea: <span className="font-mono">{doc.cellPhone}</span> · Ext: <span className="font-mono">{doc.hospitalExtension}</span>
                                  </div>
                                )}
                              </div>

                              {/* SEQUENTIAL BACKUPS ESCALATION */}
                              {(backupDoc || backupDoc3 || s.escalationNote) && (
                                <div className="mt-2.5 bg-slate-100 border border-slate-250 rounded-xl p-2.5 space-y-2">
                                  <div className="text-[8.5px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1 border-b border-slate-200/50 pb-1">
                                    <span className="material-symbols-outlined text-[12px] font-bold text-slate-600">call_split</span>
                                    En caso de no responder, marcar a:
                                  </div>

                                  {backupDoc && (
                                    <div className="flex items-center justify-between text-xs">
                                      <div className="truncate">
                                        <span className="text-slate-400 font-bold text-[10px] uppercase mr-1">2do:</span>
                                        <span className="font-bold text-slate-850 text-[11px]">{backupDoc.fullName}</span>
                                      </div>
                                      <span className="font-mono font-black text-[#af101a] bg-white border border-red-100 px-1.5 py-0.2 rounded text-[10.5px]">
                                        {backupDoc.shortCode || '## No Conf'}
                                      </span>
                                    </div>
                                  )}

                                  {backupDoc3 && (
                                    <div className="flex items-center justify-between text-xs">
                                      <div className="truncate">
                                        <span className="text-slate-400 font-bold text-[10px] uppercase mr-1">3ro:</span>
                                        <span className="font-bold text-slate-850 text-[11px]">{backupDoc3.fullName}</span>
                                      </div>
                                      <span className="font-mono font-black text-[#af101a] bg-white border border-red-100 px-1.5 py-0.2 rounded text-[10.5px]">
                                        {backupDoc3.shortCode || '## No Conf'}
                                      </span>
                                    </div>
                                  )}

                                  {s.escalationNote && (
                                    <div className="text-[10px] italic text-slate-600 bg-white border border-slate-150 p-2 rounded-lg leading-relaxed">
                                      <span className="font-extrabold text-slate-500 block uppercase text-[8px] tracking-wider mb-0.5 font-sans">Instrucciones críticas adicionales:</span>
                                      "{s.escalationNote}"
                                    </div>
                                  )}
                                </div>
                              )}

                              {s.note && (
                                <p className="text-[10.5px] italic text-slate-500 mt-2 bg-white/65 p-1.5 rounded border border-slate-150">
                                  "{s.note}"
                                </p>
                              )}

                              {/* Attendance controls & Warn notifications */}
                              <div className="mt-3 pt-2.5 border-t border-slate-200/65 flex items-center justify-between gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (canEdit) {
                                      toggleAbsence(s.id);
                                    } else {
                                      handleShowToast("Acceso denegado: Su perfil es de Solo Consulta y no puede registrar inasistencias.");
                                    }
                                  }}
                                  className={`px-3 py-2 rounded-xl text-[10.5px] font-extrabold uppercase tracking-widest transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm ${
                                    s.missed
                                      ? 'bg-red-650 hover:bg-red-700 text-white border border-red-700'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700'
                                  }`}
                                >
                                  {s.missed ? (
                                    <>
                                      <X className="w-3.5 h-3.5 stroke-[3px]" /> Faltó (Tacha Activa)
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5 stroke-[3px]" /> Asistencia Cumplida
                                    </>
                                  )}
                                </button>

                                {totalTachas >= 2 && (
                                  <span className="text-[8.5px] font-black text-red-800 bg-red-100 border border-red-200 px-1.5 py-1.5 rounded animate-pulse uppercase tracking-wider" title="Doctor cuenta con sanción. Se recomienda removerlo.">
                                    ⚠ EXCLUSIÓN
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })() : (
                <p className="text-xs text-slate-400 text-center py-6">
                  Cargando fecha de corte...
                </p>
              )}
            </div>

            {/* SECTOR 2: Real-time Live Removal Recommendations Panel */}
            <div className="bg-white border border-red-200 shadow-lg rounded-2xl p-5 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#af101a]" />
              
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-150/80">
                <span className="text-xs font-extrabold text-red-950 uppercase tracking-widest flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-red-700" /> Sanciones de Guardia (≥2 Faltas)
                </span>
                <span className="bg-red-100 text-[#af101a] text-[9px] font-black px-2 py-0.5 rounded-full">
                  {removalRecommendations.length} Alertas
                </span>
              </div>

              <div className="pt-4 space-y-4">
                {removalRecommendations.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    Excelente comportamiento del personal médico de Hermosillo. Ningún profesional sanitario ha provocado acumulación sancionable ( $\ge 2$ tachas de inasistencia ).
                  </p>
                ) : (
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                    {removalRecommendations.map(rec => (
                      <div 
                        key={rec.physician.id} 
                        className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <p className="font-extrabold text-slate-900">{rec.physician.fullName}</p>
                            <p className="text-[10px] text-[#af101a] font-bold mt-0.5">
                              {rec.absences} inasistencias ({Array(rec.absences).fill('✗').join(' ')})
                            </p>
                          </div>
                          <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded">
                            Sancionado
                          </span>
                        </div>

                        <p className="text-[10.5px] text-slate-500 mt-2">
                          El sistema detectó inasistencias recurrentes. Se genera recomendación automática para desvincularlo temporalmente de los roles para no alterar guardias.
                        </p>

                        <div className="mt-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (canEdit) {
                                handleExcludeDoctorFromShifts(rec.physician.id, rec.physician.fullName);
                              } else {
                                handleShowToast("Acceso denegado: Su rol actual no cuenta con privilegios para retirar personal.");
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[9.5px] font-black uppercase tracking-wide transition-all inline-flex items-center gap-1 ${
                              canEdit 
                                ? 'bg-[#af101a] text-white hover:bg-neutral-900 cursor-pointer' 
                                : 'bg-slate-150 text-slate-400 border border-slate-200 cursor-not-allowed'
                            }`}
                          >
                            <UserX className="w-3.5 h-3.5" /> Excluir de Guardias
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* Assignment Interactive Dialog Overlay */}
      <AnimatePresence>
        {isAssigning && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAssigning(false)}
              className="fixed inset-0 bg-black/70 z-[100] no-print"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl z-[101] overflow-hidden border border-slate-250"
            >
              <div className="p-5 border-b border-slate-100 bg-[#af101a] text-white flex items-center justify-between">
                <div>
                  <h3 className="font-headline text-base font-black tracking-wide">Programar Guardia Médica</h3>
                  <p className="text-[11px] text-red-100 font-extrabold mt-0.5 uppercase tracking-wider">Asignación Oficial para el: {selectedDate}</p>
                </div>
                <button
                  onClick={() => setIsAssigning(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full text-red-100 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>

              <form onSubmit={handleCreateAssignment} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
                
                {/* GRUPO 1: DATOS PRIMARIOS COMPULSORIOS */}
                <div className="bg-emerald-50/40 border border-emerald-150 p-3.5 rounded-xl space-y-3.5">
                  <div className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-emerald-150/40 pb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    Paso 1: Datos Principales de la Guardia
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">
                      Especialidad de Guardia *
                    </label>
                    <select
                      required
                      value={assignSpecialty}
                      onChange={(e) => {
                        setAssignSpecialty(e.target.value);
                        setAssignPhysicianId(''); // reset physician selection
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 focus:outline-none text-slate-800 font-bold shadow-xs"
                    >
                      <option value="">--Seleccione especialidad--</option>
                      {specialties.filter(s => s !== 'Todas').map(spec => (
                        <option key={spec} value={spec}>{spec}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">
                      Médico Principal (1ro en Llamar) *
                    </label>
                    <select
                      required
                      disabled={!assignSpecialty}
                      value={assignPhysicianId}
                      onChange={(e) => setAssignPhysicianId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 focus:outline-none text-slate-800 font-bold shadow-xs disabled:opacity-45"
                    >
                      <option value="">
                        {!assignSpecialty 
                          ? '--Seleccione primero la especialidad de la guardia--' 
                          : `--Médicos de ${assignSpecialty} disponibles--`
                        }
                      </option>
                      {physicians
                        .filter(p => {
                          if (!isPhysicianSocio(p)) return false;
                          if (!assignSpecialty) return true;
                          const targetNorm = normalizeStr(assignSpecialty);
                          const specNorm = normalizeStr(p.specialty);
                          const unifNorm = normalizeStr(p.especialidadUnificada);
                          return (
                            specNorm === targetNorm || 
                            unifNorm === targetNorm || 
                            specNorm.includes(targetNorm) || 
                            unifNorm.includes(targetNorm) || 
                            targetNorm.includes(specNorm) || 
                            targetNorm.includes(unifNorm)
                          );
                        })
                        .map(p => {
                          const totalTachas = getAbsenceCount(p.id);
                          const warningText = totalTachas > 0 ? ` (${totalTachas} faltas registradas)` : '';
                          return (
                            <option key={p.id} value={p.id}>
                              {p.fullName}{warningText} (Socio)
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>

                {/* GRUPO 2: PLAN DE ESCALACIÓN DE RESPALDO (OPCIONAL) */}
                <div className="bg-amber-50/40 border border-amber-200/80 p-3.5 rounded-xl space-y-3.5">
                  <div className="text-[10px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-amber-200/40 pb-1.5">
                    <span className="material-symbols-outlined text-[13px] font-bold text-amber-700">call_split</span>
                    Paso 2: Plan de Escalación Relevos (Opcional - Socios)
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-widest mb-1 flex items-center justify-between">
                      <span>2do en Llamar (Respaldo Opcional)</span>
                    </label>
                    <select
                      disabled={!assignSpecialty}
                      value={assignBackupId}
                      onChange={(e) => setAssignBackupId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-[#af101a] focus:border-[#af101a] focus:outline-none text-slate-800 shadow-xs disabled:opacity-45"
                    >
                      <option value="">--Seleccione un sustituto de respaldo--</option>
                      {physicians
                        .filter(p => isPhysicianSocio(p) && p.id !== assignPhysicianId && (!assignSpecialty || p.specialty === assignSpecialty))
                        .map(p => {
                          const directDesc = p.shortCode ? ` (${p.shortCode})` : '';
                          return (
                            <option key={p.id} value={p.id}>
                              {p.fullName}{directDesc} (Socio)
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-widest mb-1 flex items-center justify-between">
                      <span>3ro en Llamar (Remoto / Emergencia)</span>
                    </label>
                    <select
                      disabled={!assignSpecialty}
                      value={assignBackupId3}
                      onChange={(e) => setAssignBackupId3(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-[#af101a] focus:border-[#af101a] focus:outline-none text-slate-800 shadow-xs disabled:opacity-45"
                    >
                      <option value="">--Seleccione un sustituto terciario--</option>
                      {physicians
                        .filter(p => isPhysicianSocio(p) && p.id !== assignPhysicianId && p.id !== assignBackupId && (!assignSpecialty || p.specialty === assignSpecialty))
                        .map(p => {
                          const directDesc = p.shortCode ? ` (${p.shortCode})` : '';
                          return (
                            <option key={p.id} value={p.id}>
                              {p.fullName}{directDesc} (Socio)
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-[#af101a] uppercase tracking-widest mb-1 flex items-center justify-between">
                      <span>Instrucciones si nadie contesta</span>
                    </label>
                    <textarea
                      placeholder="Ej. Si nadie responde, llamar directo al conmutador central ##112 (Sistemas) o al Dr. Salinas..."
                      value={assignEscalationNote}
                      onChange={(e) => setAssignEscalationNote(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-[#af101a] focus:border-[#af101a] focus:outline-none text-slate-800 h-16 resize-none shadow-xs placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* GRUPO 3: OBSERVACIONES ADICIONALES */}
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-widest mb-1">
                    Paso 3: Inconvenientes / Observaciones Previas
                  </label>
                  <textarea
                    placeholder="Ej. Relevo de Dr. Peralta, Guardia extraordinaria, etc."
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-red-900 focus:border-red-900 focus:outline-none text-slate-800 h-16 resize-none shadow-xs"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAssigning(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-[#af101a] hover:bg-neutral-900 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer shadow-sm"
                  >
                    Guardar Guardia
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sticky Success/System Alert Toaster */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 25 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="fixed bottom-6 right-6 z-[1000] bg-slate-900 border border-slate-800 text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-xs font-bold">{toast}</p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

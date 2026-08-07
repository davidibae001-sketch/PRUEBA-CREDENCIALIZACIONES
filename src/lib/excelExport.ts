import XLSX from 'xlsx-js-style';
import { MedicalCredential, DirectoryPhysician, BlacklistPhysician } from '../types';
import { isConacemExpired } from '../utils/concacem';

/**
 * Determine Company Code based on campus location
 */
export function getEmpresaCode(campusStr?: string): string {
  if (!campusStr) return 'HSJH';
  const lower = campusStr.toLowerCase();
  const codes: string[] = [];
  if (lower.includes('hermosillo')) codes.push('HSJH');
  if (lower.includes('guaymas')) codes.push('HSJG');
  if (lower.includes('obregón') || lower.includes('obregon')) codes.push('HSJO');
  if (codes.length === 0) return 'HSJH';
  return codes.join('/');
}

/**
 * Robust document status checker matching PhysicianForm.tsx keys
 */
function checkDocStatus(cred: MedicalCredential, categoryKeys: string[], defaultText = 'COMPLETADO'): string {
  if (!cred) return 'PENDIENTE';
  const catFiles = cred.categoryFiles || {};

  // Check direct categoryKeys match
  for (const key of categoryKeys) {
    const val = catFiles[key];
    if (val) {
      if (Array.isArray(val) && val.length > 0) return defaultText;
      if (val.files && Array.isArray(val.files) && val.files.length > 0) return defaultText;
      if (val.file || val.name || val.previewUrl) return defaultText;
      if (typeof val === 'string' && val.trim().length > 0 && val !== 'PENDIENTE') return defaultText;
      if (val.status === 'RECIBIDA' || val.status === 'COMPLETADO' || val.status === 'VALIDADA' || val.status === 'OTORGADA') return defaultText;
    }
  }

  // Check normalized or sub-string key matches in catFiles
  for (const key of categoryKeys) {
    const keyLower = key.toLowerCase();
    for (const [catKey, catVal] of Object.entries(catFiles)) {
      if (catKey.toLowerCase() === keyLower || (keyLower.length > 3 && catKey.toLowerCase().includes(keyLower))) {
        if (catVal) {
          if (Array.isArray(catVal) && catVal.length > 0) return defaultText;
          if (catVal.files && Array.isArray(catVal.files) && catVal.files.length > 0) return defaultText;
          if (catVal.file || catVal.name || catVal.previewUrl) return defaultText;
          if (typeof catVal === 'string' && catVal.trim().length > 0 && catVal !== 'PENDIENTE') return defaultText;
        }
      }
    }
  }

  return 'PENDIENTE';
}

/**
 * Export full Doctor Credentialing database with professional styling and exact header layout.
 */
export function exportCredentialingRosterToExcel(
  credentials: MedicalCredential[],
  directory: DirectoryPhysician[] = []
) {
  // Title Row
  const titleText = "BASE DE DATOS REGISTRO GENERAL DE MÉDICOS PARA CREDENCIALIZACIÓN - HOSPITAL SAN JOSÉ";
  const titleRow = [titleText, ...Array(39).fill("")];

  // Category Header Row
  const categoryHeaderRow = [
    "DATOS GENERALES Y DE CONTACTO DEL MÉDICO", ...Array(13).fill(""),
    "DOCUMENTOS PERSONALES (1-10)", ...Array(10).fill(""),
    "DOCUMENTOS ACADEMICOS (11-13)", ...Array(2).fill(""),
    "DOCUMENTOS ESPECIALIDAD (14-16)", ...Array(5).fill(""),
    "CIRUGÍA ROBÓTICA DA VINCI",
    "DOCUMENTO ACADÉMICO ADICIONAL",
    "DOCUMENTACIÓN CON VIGENCIA (19-20)", ...Array(3).fill("")
  ];

  // Column Sub-headers
  const columnsRow = [
    "ESTATUS",
    "ID MÉDICO",
    "FOLIO",
    "FECHA DE CREDENCIALIZACION",
    "EMPRESA",
    "NOMBRE",
    "FECHA DE ATENCION",
    "MEDICO STAF / EXTERNO",
    "SOCIO SI /NO",
    "ESPECIALIDAD",
    "SUBESPECIALIDAD 1",
    "SUBESPECIALIDAD 2",
    "CELULAR",
    "CORREO ELECTRÓNICO",

    // Documentos Personales (1-10)
    "1 SOLICITUD DE CREDENCIALIZACION",
    "2 CV ACTUALIZADO (CON FOTOGRAFÍA)",
    "3 ACTA DE NACIMIENTO",
    "4 INE (AMBOS LADOS) O PASAPORTE VIGENTE",
    "5 CURP",
    "6 RFC (CONSTANCIA DE SITUACION FISCAL)",
    "7 CARATULA BANCARIA",
    "8 COMPROBANTE DE DOMICILIO",
    "9 CARTA DE RECOMENDACIÓN 1",
    "9 CARTA DE RECOMENDACIÓN 2",
    "10 RESPONSABILIDAD CIVIL",

    // Documentos Académicos (11-13)
    "11 TITULO PROFESIONAL",
    "12 CEDULA PROFESIONAL",
    "13 PERMISO PARA EJERCER DE MEDICO GENERAL EDO DE SONORA",

    // Documentos Especialidad (14-16)
    "VALIDACION DE LA FUENTE ORIGINAL (ESPECIALIDAD 1)",
    "14 TITULO ESPECIALIDAD (ES)",
    "15 CEDULA DE ESPECIALIDAD (ES)",
    "16 PERMISO PARA EJERCER ESPECIALIDAD (ES)",
    "DIPLOMA DE ESPECIALIDAD 2",
    "CEDULA DE ESPECIALIDAD 2",

    // Cirugía Robótica Da Vinci (17)
    "17 CONSTANCIA DE ENTRENAMIENTO (EN CASO DE APLICAR)",

    // Documento Académico Adicional (18)
    "18 DIPLOMAS / CONSTANCIAS DE CURSOS Y ENTRENAMIENTOS (ACTUALIZACIÓN CONSTANTE COMO MÉDICO)",

    // Documentación con Vigencia (19-20)
    "19 SOLICITUD DE PRIVILEGIOS DE LA ESPECIALIDAD (VIGENCIA 5 AÑOS)",
    "20 CONACEM",
    "CONACEM VENCIMIENTO",
    "VALIDACION DE LA FUENTE ORIGINAL CONACEM"
  ];

  // Counter tracking for Folio generation per campus
  let herCount = 1;
  let gymCount = 1;
  let obgCount = 1;

  const dataRows: any[][] = [];

  credentials.forEach((cred, index) => {
    const dirMatch = directory.find(d => d.id === cred.id || d.fullName.toLowerCase().includes(cred.lastName?.toLowerCase() || ''));

    const statusText = cred.status === 'VERIFICADO' ? 'CREDENCIALIZADO' : (cred.status === 'FALTAN_DOCUMENTOS' ? 'INCOMPLETO' : cred.status);
    const idMedico = index + 1; // Strict numeric order sequence for registry and counting
    const campusStr = cred.campus || 'Hermosillo';
    
    // Strictly assign sequential Folio per campus starting at 001
    const lowerCamp = campusStr.toLowerCase();
    let computedFolio = '';
    if (lowerCamp.includes('guaymas')) {
      computedFolio = `FOL-2026-GYM-${String(gymCount++).padStart(3, '0')}`;
    } else if (lowerCamp.includes('obregón') || lowerCamp.includes('obregon')) {
      computedFolio = `FOL-2026-OBG-${String(obgCount++).padStart(3, '0')}`;
    } else {
      computedFolio = `FOL-2026-HER-${String(herCount++).padStart(3, '0')}`;
    }

    const realFolio = (cred.folio && String(cred.folio).trim().length > 0) ? String(cred.folio).trim() : computedFolio;

    const dateCred = cred.enrollmentDate ? cred.enrollmentDate : new Date().toLocaleDateString('es-MX');
    const empresa = getEmpresaCode(campusStr);
    const nombreFull = `${cred.lastName?.toUpperCase() || ''} ${cred.firstName?.toUpperCase() || ''}`.trim();
    const tipoMedico = cred.physicianType || 'Staff';
    const esSocio = (cred.isPartner === 'SI' || cred.isPartner === true) ? 'SI' : 'NO';

    const row = [
      statusText,
      idMedico,
      realFolio,
      dateCred,
      empresa,
      nombreFull,
      dateCred,
      tipoMedico,
      esSocio,
      cred.specialty?.toUpperCase() || 'GENERAL',
      cred.subspecialty?.toUpperCase() || '',
      cred.subspecialty2?.toUpperCase() || '',
      cred.phone || dirMatch?.cellPhone || '',
      cred.email || dirMatch?.correo || '',

      // Documentos Personales (1-10)
      checkDocStatus(cred, ['solicitud_cred', '1_SOLICITUD_CREDENCIALIZACION', 'SOLICITUD'], 'OTORGADA'),
      checkDocStatus(cred, ['cv', '2_CURRICULUM_VITAE', 'CV']),
      checkDocStatus(cred, ['acta', '3_ACTA_NACIMIENTO', 'ACTA_NACIMIENTO']),
      checkDocStatus(cred, ['ine', '4_INE_VIGENTE_PASAPORTE', 'INE_PASAPORTE']),
      checkDocStatus(cred, ['curp', '5_CURP', 'CURP']),
      checkDocStatus(cred, ['sat', '6_RFC_CONSTANCIA_FISCAL', 'rfc', 'RFC']),
      checkDocStatus(cred, ['banco', '7_CARATULA_BANCARIA', 'CARATULA_BANCARIA']),
      checkDocStatus(cred, ['domicilio', '8_COMPROBANTE_DOMICILIO', 'COMPROBANTE_DOMICILIO']),
      checkDocStatus(cred, ['cartas_rec', '9_CARTAS_RECOMENDACION_SOCIOS', 'RECOMENDACION_1']),
      checkDocStatus(cred, ['cartas_rec', '9_CARTAS_RECOMENDACION_SOCIOS', 'RECOMENDACION_2']),
      checkDocStatus(cred, ['resp_civil', '10_RESPONSABILIDAD_CIVIL', 'RESPONSABILIDAD_CIVIL']),

      // Documentos Académicos (11-13)
      checkDocStatus(cred, ['titulo_prof', '11_TITULO_PROFESIONAL', 'TITULO_PROFESIONAL']),
      checkDocStatus(cred, ['cedula_prof', '12_CEDULA_PROFESIONAL', 'CEDULA_PROFESIONAL']),
      checkDocStatus(cred, ['permiso_son_prof', '13_PERMISO_EJERCER_SONORA_PROFESION', 'PERMISO_EJERCER_SONORA']),

      // Documentos Especialidad (14-16)
      checkDocStatus(cred, ['permiso_son_prof_val', '13_1_VALIDACION_FUENTE_ORIGINAL_PERMISO_PROFESION', 'VALIDACION_FUENT_ORIG'], 'VALIDADA'),
      checkDocStatus(cred, ['titulo_esp', '14_TITULO_ESPECIALIDAD', 'TITULO_ESPECIALIDAD']),
      checkDocStatus(cred, ['cedula_esp', '15_CEDULA_ESPECIALIDAD', 'CEDULA_ESPECIALIDAD']),
      checkDocStatus(cred, ['permiso_son_esp', '16_PERMISO_EJERCER_SONORA_ESPECIALIDAD', 'PERMISO_ESPECIALIDAD']),
      checkDocStatus(cred, ['diploma_subesp1', '14_1_DIPLOMA_SUBESPECIALIDAD_1', 'SUBESPECIALIDAD_1']),
      checkDocStatus(cred, ['cedula_subesp1', '15_1_CEDULA_SUBESPECIALIDAD_1']),

      // Cirugía Robótica Da Vinci (17)
      checkDocStatus(cred, ['robotica_davinci', '17_CONSTANCIA_CIRUGIA_ROBOTICA_DAVINCI', 'ROBOTICA_DAVINCI']),

      // Documento Académico Adicional (18)
      checkDocStatus(cred, ['diplomas', '18_DIPLOMAS_Y_CURSOS_2_ANOS', 'ENTRENAMIENTOS_CURSOS']),

      // Documentación con Vigencia (19-20)
      checkDocStatus(cred, ['solicitud_priv', '19_SOLICITUD_PRIVILEGIOS_ESPECIALIDAD', 'SOLICITUD_PRIVILEGIOS'], 'OTORGADA'),
      checkDocStatus(cred, ['consejo', '20_CERTIFICADO_CONSEJO_ESPECIALIDAD', 'CONACEM']),
      (() => {
        const conacemExpDate = cred.vigenciaConacem || cred.consejoExpiryDate || cred.documentExpirations?.['consejo'] || cred.documentExpirations?.['CONACEM'] || null;
        let estatusVigConacem = cred.estatusVigConacem;
        if (!estatusVigConacem) {
          if (conacemExpDate && typeof conacemExpDate === 'string') {
            estatusVigConacem = isConacemExpired(conacemExpDate) ? 'VENCIDA' : 'VIGENTE';
          } else if (checkDocStatus(cred, ['consejo', '20_CERTIFICADO_CONSEJO_ESPECIALIDAD', 'CONACEM']) === 'COMPLETADO') {
            estatusVigConacem = 'VIGENTE';
          } else {
            estatusVigConacem = 'VENCIDA';
          }
        }
        return conacemExpDate ? `${estatusVigConacem} (${conacemExpDate})` : estatusVigConacem;
      })(),
      checkDocStatus(cred, ['consejo_val_conacem', '20_1_VALIDACION_CONACEM'], 'VALIDADA')
    ];

    dataRows.push(row);
  });

  const sheetData = [
    titleRow,
    categoryHeaderRow,
    columnsRow,
    ...dataRows
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set Merges
  ws['!merges'] = [
    // Title A1:AN1 (0-39)
    { s: { r: 0, c: 0 }, e: { r: 0, c: 39 } },

    // Group Header Categories (Row 1)
    { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },  // DATOS GENERALES (cols 0-13)
    { s: { r: 1, c: 14 }, e: { r: 1, c: 24 } }, // DOCUMENTOS PERSONALES (cols 14-24)
    { s: { r: 1, c: 25 }, e: { r: 1, c: 27 } }, // DOCUMENTOS ACADEMICOS (cols 25-27)
    { s: { r: 1, c: 28 }, e: { r: 1, c: 33 } }, // DOCUMENTOS ESPECIALIDAD (cols 28-33)
    { s: { r: 1, c: 34 }, e: { r: 1, c: 34 } }, // CIRUGIA ROBOTICA
    { s: { r: 1, c: 35 }, e: { r: 1, c: 35 } }, // DOCUMENTO ACADEMICO ADICIONAL
    { s: { r: 1, c: 36 }, e: { r: 1, c: 39 } }, // DOCUMENTACION CON VIGENCIA (cols 36-39)
  ];

  // Set Row Heights
  ws['!rows'] = [
    { hpt: 36 }, // Row 0 (Title)
    { hpt: 26 }, // Row 1 (Categories)
    { hpt: 32 }, // Row 2 (Columns)
    ...dataRows.map(() => ({ hpt: 22 }))
  ];

  // Define Category Fill Colors
  const categoryFills: Record<number, string> = {};
  for (let c = 0; c <= 13; c++) categoryFills[c] = '1E293B';  // Slate Dark Navy
  for (let c = 14; c <= 24; c++) categoryFills[c] = '85040D'; // Hospital San José Red
  for (let c = 25; c <= 27; c++) categoryFills[c] = '1E3A8A'; // Deep Blue
  for (let c = 28; c <= 33; c++) categoryFills[c] = '1D4ED8'; // Royal Blue
  categoryFills[34] = '047857';                              // Emerald Green
  categoryFills[35] = '6D28D9';                              // Purple
  for (let c = 36; c <= 39; c++) categoryFills[c] = 'B45309'; // Gold / Amber

  // Apply Styles to Cells
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:AN100');

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddress]) {
        ws[cellAddress] = { t: 's', v: '' };
      }
      const cell = ws[cellAddress];

      if (R === 0) {
        // Title Cell Styling
        cell.s = {
          font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '85040D' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'medium', color: { rgb: '5C0309' } },
            bottom: { style: 'medium', color: { rgb: '5C0309' } }
          }
        };
      } else if (R === 1) {
        // Category Header Styling
        const bgHex = categoryFills[C] || '1E293B';
        cell.s = {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: bgHex } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'CBD5E1' } },
            bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } }
          }
        };
      } else if (R === 2) {
        // Column Sub-headers
        cell.s = {
          font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: '0F172A' } },
          fill: { fgColor: { rgb: 'F1F5F9' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: 'CBD5E1' } },
            bottom: { style: 'medium', color: { rgb: '94A3B8' } },
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } }
          }
        };
      } else {
        // Data Rows
        const isEven = R % 2 === 0;
        const cellValStr = String(cell.v || '').trim();

        if (C === 0) {
          // Status Badge Cell
          const isVerified = cellValStr.toUpperCase() === 'CREDENCIALIZADO' || cellValStr.toUpperCase() === 'VERIFICADO';
          cell.s = {
            font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: isVerified ? '166534' : '991B1B' } },
            fill: { fgColor: { rgb: isVerified ? 'DCFCE7' : 'FEE2E2' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'CBD5E1' } },
              bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
              left: { style: 'thin', color: { rgb: 'CBD5E1' } },
              right: { style: 'thin', color: { rgb: 'CBD5E1' } }
            }
          };
        } else if (C >= 14) {
          // Document Status & Expiration Date Cells
          const upperVal = cellValStr.toUpperCase();
          const isExplicitVencida = upperVal.includes('VENCIDA') || upperVal.includes('VENCIDO') || upperVal.includes('PENDIENTE') || isConacemExpired(cellValStr);
          const isCompleted = (upperVal.includes('COMPLETADO') || upperVal.includes('RECIBIDA') || upperVal.includes('OTORGADA') || upperVal.includes('VALIDADA') || upperVal.includes('VIGENTE')) && !isExplicitVencida;

          cell.s = {
            font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: isCompleted ? '137333' : 'C5221F' } },
            fill: { fgColor: { rgb: isCompleted ? 'E6F4EA' : 'FCE8E6' } }, // Green if VIGENTE/COMPLETADO, Red if VENCIDA/PENDIENTE
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'CBD5E1' } },
              bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
              left: { style: 'thin', color: { rgb: 'CBD5E1' } },
              right: { style: 'thin', color: { rgb: 'CBD5E1' } }
            }
          };
        } else {
          // General Data Cells
          const isCenter = [1, 2, 3, 4, 6, 7, 8, 12].includes(C);
          cell.s = {
            font: { name: 'Calibri', sz: 9, color: { rgb: '1E293B' } },
            fill: { fgColor: { rgb: isEven ? 'FFFFFF' : 'F8FAFC' } },
            alignment: { horizontal: isCenter ? 'center' : 'left', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'E2E8F0' } },
              bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
              left: { style: 'thin', color: { rgb: 'E2E8F0' } },
              right: { style: 'thin', color: { rgb: 'E2E8F0' } }
            }
          };
        }
      }
    }
  }

  // Set Column Widths
  const colWidths = columnsRow.map((header, idx) => {
    let maxLen = header.length;
    dataRows.forEach(row => {
      const cellStr = String(row[idx] || '');
      if (cellStr.length > maxLen) maxLen = cellStr.length;
    });
    return { wch: Math.min(Math.max(maxLen + 3, 14), 45) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Roster Médicos CredSJ');

  // Trigger Download
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `REGISTRO_GENERAL_MEDICOS_SAN_JOSE_${dateStr}.xlsx`);
}

/**
 * Export Blacklisted Physicians Table to Excel with Professional Styling
 */
export function exportBlacklistToExcel(blacklist: BlacklistPhysician[]) {
  const headers = [
    "STATUS VETO",
    "MÉDICO VETADO",
    "CÉDULA PROFESIONAL",
    "RFC",
    "ESPECIALIDAD",
    "CAMPUS / SEDE",
    "TIPO (INTERNO/EXTERNO)",
    "MOTIVO OFICIAL DE VETO",
    "FECHA DE REGISTRO VETO",
    "TELÉFONO DE CONTACTO",
    "CORREO ELECTRÓNICO",
    "OBSERVACIONES ADICIONALES"
  ];

  const rows = blacklist.map(item => [
    item.status || "VETADO",
    item.fullName,
    item.npi || "N/A",
    item.rfc || "N/A",
    item.specialty || "Médico General",
    item.campus || "Hermosillo",
    item.isExternal ? "EXTERNO" : "REGISTRADO",
    item.reason || "",
    item.bannedAt || new Date().toISOString().split('T')[0],
    item.phone || "",
    item.email || "",
    item.notes || ""
  ]);

  const titleRow = ["NÓMINA OFICIAL DE MÉDICOS VETADOS / RESTRINGIDOS - HOSPITAL SAN JOSÉ", ...Array(11).fill("")];

  const sheetData = [
    titleRow,
    headers,
    ...rows
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
  ws['!rows'] = [
    { hpt: 36 },
    { hpt: 28 },
    ...rows.map(() => ({ hpt: 22 }))
  ];

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:L50');

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: '' };
      const cell = ws[cellAddress];

      if (R === 0) {
        cell.s = {
          font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '85040D' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      } else if (R === 1) {
        cell.s = {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '1E293B' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'CBD5E1' } },
            bottom: { style: 'medium', color: { rgb: '94A3B8' } },
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } }
          }
        };
      } else {
        const isEven = R % 2 === 0;
        cell.s = {
          font: { name: 'Calibri', sz: 9, color: { rgb: '1E293B' } },
          fill: { fgColor: { rgb: C === 0 ? 'FEE2E2' : (isEven ? 'FFFFFF' : 'F8FAFC') } },
          alignment: { horizontal: [0, 2, 3, 5, 6, 8].includes(C) ? 'center' : 'left', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } }
          }
        };
      }
    }
  }

  ws['!cols'] = headers.map((h, idx) => {
    let maxLen = h.length;
    rows.forEach(r => {
      const s = String(r[idx] || '');
      if (s.length > maxLen) maxLen = s.length;
    });
    return { wch: Math.min(Math.max(maxLen + 3, 15), 50) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Médicos Vetados');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `MEDICOS_VETADOS_SAN_JOSE_${dateStr}.xlsx`);
}

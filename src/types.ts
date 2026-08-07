export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operador' | 'auditor';
  password?: string;
  createdAt?: string;
}

export interface DoctorCredential {
  id: string;
  firstName: string;
  lastName: string;
  paternalLastName?: string;
  maternalLastName?: string;
  npi?: string; // Cédula Profesional
  enrollmentDate?: string;
  specialty: string;
  subspecialty?: string;
  subspecialty2?: string;
  birthDate?: string;
  curpIne?: string;
  status: 'VERIFICADO' | 'PENDIENTE' | 'FALTAN_DOCUMENTOS' | 'DESACTIVADO';
  active: boolean;
  identityAssigned?: string;
  signatureUrl?: string;
  fingerprintMapped?: boolean;
  hasCedula?: boolean;
  hasTitulo?: boolean;
  portraitUrl?: string;
  campus: string;
  folio?: string;
  cedulaExpiryDate?: string | null;
  tituloExpiryDate?: string | null;
  consejoExpiryDate?: string | null;
  ineExpiryDate?: string | null;
  vigenciaPrivilegios?: string | null;
  vigenciaConacem?: string | null;
  estatusVigConacem?: 'VENCIDA' | 'VIGENTE' | 'PENDIENTE' | string;
  physicianType?: string;
  phone?: string;
  email?: string;
  rfc?: string;
  gender?: string; // 'MASCULINO' | 'FEMENINO'
  isPartner?: boolean;
  folderName?: string;
  rutaArchivos?: string;
  filesCount?: number;
  categoryFiles?: Record<string, any>;
  selectedFiles?: Record<string, any>;
  documentExpirations?: Record<string, string>;
}

export interface DirectoryPhysician {
  id: string;
  fullName: string;
  cellPhone?: string;
  hospitalExtension?: string;
  moduleAndOffice?: string;
  specialty: string;
  shortCode?: string;
  modulo?: string;
  extensionModulo?: string;
  extensionConsultorio?: string;
  suite?: string;
  primerApellido?: string;
  segundoApellido?: string;
  nombre?: string;
  especialidadUnificada?: string;
  correo?: string;
}

export interface Sancion {
  id: string;
  physicianId: string;
  physicianName: string;
  reason: string;
  type: string;
  date: string;
  filename: string;
  pdfUrl: string;
}

export interface BannedPhysician {
  id: string;
  physicianId?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  specialty?: string;
  npi?: string;
  rfc?: string;
  phone?: string;
  email?: string;
  campus?: string;
  reason: string;
  bannedAt: string;
  isExternal?: boolean;
  notes?: string;
  status: string;
}

export interface SystemStatus {
  online: boolean;
  version: string;
  hipaaCertified: boolean;
  soc2Type2: boolean;
  database: {
    connected: boolean;
    engine: string;
  };
}

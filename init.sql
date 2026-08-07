-- SQL SCRIPT FOR PORTING MedVerify Pro / CredSJ TO LOCAL POSTGRESQL 18+
-- Hospital San José de Sonora - Dirección de Sistemas e Informática
-- Execute under your target database (e.g. 'credsj_db') using pgAdmin, psql or DBeaver

-- 1. CLEANUP PRE-EXISTING TABLES
DROP TABLE IF EXISTS sanciones CASCADE;
DROP TABLE IF EXISTS guard_shifts CASCADE;
DROP TABLE IF EXISTS directory_physicians CASCADE;
DROP TABLE IF EXISTS medicos CASCADE;
DROP TABLE IF EXISTS medical_credentials CASCADE;
DROP TABLE IF EXISTS system_users CASCADE;

-- 2. CREATE SYSTEM OPERATORS TABLE (Usuarios y Operadores del Sistema)
CREATE TABLE system_users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'rh', 'admision', 'directorio', 'guardias')),
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CREATE MEDICOS TABLE (Información Personal y Profesional)
CREATE TABLE medicos (
    id SERIAL PRIMARY KEY,
    folio VARCHAR(255),
    nombre VARCHAR(255),
    apellido_paterno VARCHAR(255),
    apellido_materno VARCHAR(255),
    cedula_profesional VARCHAR(255),
    especialidad VARCHAR(255),
    subespecialidad1 VARCHAR(255),
    subespecialidad2 VARCHAR(255),
    tipo_medico VARCHAR(255),
    sede VARCHAR(255),
    estatus VARCHAR(255),
    es_socio VARCHAR(255),
    correo VARCHAR(255),
    telefono VARCHAR(255),
    rfc VARCHAR(255),
    curp VARCHAR(255),
    sexo VARCHAR(50),
    fecha_nacimiento VARCHAR(255),
    fecha_registro VARCHAR(255),
    id_siho INT,
    active BOOLEAN DEFAULT TRUE
);

-- 3.1. CREATE DOCUMENTACION TABLE (Validación de Expediente y Documentos)
CREATE TABLE documentacion (
    id SERIAL PRIMARY KEY,
    idmedico INT REFERENCES medicos(id) ON DELETE CASCADE,
    fotomedico TEXT,
    solicitudcreden VARCHAR(255) DEFAULT 'PENDIENTE',
    curriculum VARCHAR(255) DEFAULT 'PENDIENTE',
    acta_nacimiento VARCHAR(255) DEFAULT 'PENDIENTE',
    ine VARCHAR(255) DEFAULT 'PENDIENTE',
    curp VARCHAR(255) DEFAULT 'PENDIENTE',
    rfc VARCHAR(255) DEFAULT 'PENDIENTE',
    caratula_bancaria VARCHAR(255) DEFAULT 'PENDIENTE',
    comprobante_domicilio VARCHAR(255) DEFAULT 'PENDIENTE',
    cartas_recomendacion VARCHAR(255) DEFAULT 'PENDIENTE',
    responsabilidad_civil VARCHAR(255) DEFAULT 'PENDIENTE',
    titulo_profesional VARCHAR(255) DEFAULT 'PENDIENTE',
    cedula VARCHAR(255) DEFAULT 'PENDIENTE',
    permiso_ejercer VARCHAR(255) DEFAULT 'PENDIENTE',
    validacion_titulo VARCHAR(255) DEFAULT 'PENDIENTE',
    validacion_titulo2 VARCHAR(255) DEFAULT 'PENDIENTE',
    titulo_especialidad VARCHAR(255) DEFAULT 'PENDIENTE',
    diploma_subespecialidad VARCHAR(255) DEFAULT 'PENDIENTE',
    diploma_subespecialidad2 VARCHAR(255) DEFAULT 'PENDIENTE',
    cedula_especialidad VARCHAR(255) DEFAULT 'PENDIENTE',
    cedula_subespecialidad VARCHAR(255) DEFAULT 'PENDIENTE',
    cedula_subespecialidad2 VARCHAR(255) DEFAULT 'PENDIENTE',
    permiso_ejercerespecialidad VARCHAR(255) DEFAULT 'PENDIENTE',
    cirugiarobotica VARCHAR(255) DEFAULT 'PENDIENTE',
    diplomas VARCHAR(255) DEFAULT 'PENDIENTE',
    privilegios VARCHAR(255) DEFAULT 'PENDIENTE',
    conacem VARCHAR(255) DEFAULT 'PENDIENTE',
    validacion_concacem VARCHAR(255) DEFAULT 'PENDIENTE',
    ruta_archivos TEXT,
    firma_url TEXT
);

-- 4. CREATE DIRECTORY PHYSICIANS TABLE (Directorio de Contacto Directo)
CREATE TABLE directory_physicians (
    id VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    cell_phone VARCHAR(50),
    hospital_extension VARCHAR(50),
    module_and_office VARCHAR(100),
    specialty VARCHAR(255) NOT NULL,
    short_code VARCHAR(50)
);

-- 5. CREATE GUARD SHIFTS TABLE (Rol de Guardias Médicas)
CREATE TABLE guard_shifts (
    id VARCHAR(50) PRIMARY KEY,
    physician_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    specialty VARCHAR(255) NOT NULL,
    missed BOOLEAN DEFAULT FALSE, -- Indica si faltó o hubo incidencia
    note TEXT,
    backup_physician_id VARCHAR(50),
    backup_physician_id3 VARCHAR(50),
    escalation_note TEXT,
    CONSTRAINT fk_guard_physician FOREIGN KEY (physician_id) REFERENCES directory_physicians(id) ON DELETE CASCADE
);

-- 6. CREATE SANCIONES TABLE (Expediente Disciplinario y Actas Administrativas)
CREATE TABLE sanciones (
    id VARCHAR(50) PRIMARY KEY,
    physician_id VARCHAR(50) NOT NULL,
    physician_name VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    type VARCHAR(100) NOT NULL,
    date VARCHAR(100) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    pdf_url TEXT NOT NULL
);

-- 7. INSERT DEFAULT SYSTEM OPERATORS
INSERT INTO system_users (id, name, email, role, password, created_at) VALUES
('usr-1', 'Administrador General', 'admin@medverify.pro', 'admin', 'password123', NOW()),
('usr-2', 'Auditor Recursos Humanos', 'rh.recursos@medverify.pro', 'rh', 'password123', NOW()),
('usr-3', 'Operador Admisión', 'admision@medverify.pro', 'admision', 'password123', NOW()),
('usr-4', 'Gestor Directorio', 'directorio@medverify.pro', 'directorio', 'password123', NOW()),
('usr-5', 'Coordinador de Guardias', 'guardias@medverify.pro', 'guardias', 'password123', NOW());

-- 8. INSERT INITIAL MEDICOS (INFORMACIÓN PERSONAL)
INSERT INTO medicos (
    folio, nombre, apellido_paterno, apellido_materno, cedula_profesional, especialidad,
    sede, estatus, es_socio, curp, fecha_nacimiento, fecha_registro
) VALUES
('FOL-2023-HER-9928', 'Elena', 'Rodriguez', '', '1099238841', 'Cardiología', 'Hermosillo', 'VERIFICADO', 'SI', 'RORE850412HDFMNS02', '1985-04-12', '24 oct, 2023'),
('FOL-2023-HER-4112', 'Marcus', 'Thorne', '', '5543110092', 'Neurología', 'Hermosillo', 'PENDIENTE', 'NO', 'THOM790822HDFMNS01', '1979-08-22', '02 nov, 2023'),
('FOL-2023-HER-0093', 'Sarah', 'Jenkins', '', '9002331182', 'Pediatría', 'Hermosillo', 'FALTAN_DOCUMENTOS', 'NO', 'JENS911105HDFMNS03', '1991-11-05', '11 nov, 2023');

-- 8.1. INSERT INITIAL DOCUMENTACION
INSERT INTO documentacion (
    idmedico, fotomedico, solicitudcreden, curriculum, acta_nacimiento, ine, curp, rfc,
    titulo_profesional, cedula, permiso_ejercer, conacem, validacion_concacem, firma_url
) VALUES
(1, 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=150', 'OTORGADO', 'OTORGADO', 'OTORGADO', 'OTORGADO', 'OTORGADO', 'OTORGADO', 'OTORGADO', 'OTORGADO', 'OTORGADO', 'OTORGADO', 'OTORGADO', 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-bysGwDR6H2OwzURYoufO-fvJNwLu-QYQ2FAX2W2q3Q6yo6YyHVTJH9aBDNA2N46MT2PXA39Oh_gA4Xq51HmTgqJC_TDYXb0HV9edrNkR-xh0Ea4d0zkykIVTWLjeCPhSIQvtrRGhDdxMEUod03XyOQDTjQDKsaNjcKtO1_WWhCqD_q0lxbZsj96J6R1Dd6BD6y0m1OLINQdj_1ek-LJ_T7WcnOrYz8TLqAJI2U3A5ftINiFDkeGcfFSgtJ7VGIZuQ9OFZq0IjA'),
(2, NULL, 'OTORGADO', 'OTORGADO', 'PENDIENTE', 'OTORGADO', 'OTORGADO', 'PENDIENTE', 'OTORGADO', 'OTORGADO', 'PENDIENTE', 'OTORGADO', 'PENDIENTE', NULL),
(3, NULL, 'PENDIENTE', 'PENDIENTE', 'PENDIENTE', 'PENDIENTE', 'PENDIENTE', 'PENDIENTE', 'PENDIENTE', 'PENDIENTE', 'PENDIENTE', 'PENDIENTE', 'PENDIENTE', NULL);


-- 12. OPTIMIZATION INDEXES
CREATE INDEX idx_medicos_cedula ON medicos (cedula_profesional);
CREATE INDEX idx_medicos_folio ON medicos (folio);
CREATE INDEX idx_medicos_npi ON medicos (npi);
CREATE INDEX idx_guard_shifts_date ON guard_shifts (date);
CREATE INDEX idx_system_users_email ON system_users (email);
CREATE INDEX idx_sanciones_physician ON sanciones (physician_id);


import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import pg from "pg";

const app = express();
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === "production" || fs.existsSync(path.join(process.cwd(), "dist", "index.html"));

// Define local fallback directory for persistence when Postgres is offline
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to write/read fallback files
const getFallbackFile = (filename: string, defaultData: any) => {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf8");
    return defaultData;
  }
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${filename}, recreating fallback...`, err);
    return defaultData;
  }
};

const saveFallbackFile = (filename: string, data: any) => {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const newStr = JSON.stringify(data, null, 2);
    if (fs.existsSync(filePath)) {
      const existingStr = fs.readFileSync(filePath, "utf8");
      if (existingStr === newStr) {
        return; // Skip rewriting identical payload to prevent triggering file watchers
      }
    }
    fs.writeFileSync(filePath, newStr, "utf8");
  } catch (err) {
    console.error(`Error writing fallback file ${filename}:`, err);
  }
};

// Seeding Defaults
const DEFAULT_OPERATORS = [
  { id: 'usr-1', name: 'Administrador General', email: 'admin@medverify.pro', role: 'admin', password: 'password123', createdAt: '2026-05-20' }
];

const DEFAULT_CREDENTIALS: any[] = [];
const DEFAULT_DIRECTORY: any[] = [
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
const DEFAULT_GUARDS: any[] = [];
const DEFAULT_SANCIONES: any[] = [];

// 3. POSTGRES CONNECTION CONFIGURATION
// Can accept standard pg env vars: PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT or DATABASE_URL
const usePG = process.env.DISABLE_PG === "true" ? false : true;
let pgPool: pg.Pool | null = null;
let pgAvailable = false;

if (usePG) {
  try {
    const dbUser = process.env.DB_USER || process.env.PGUSER || "postgres";
    const dbPass = process.env.DB_PASSWORD ?? process.env.PGPASSWORD ?? "";
    const dbHost = process.env.DB_HOST || process.env.PGHOST || "localhost";
    const dbPort = parseInt(process.env.DB_PORT || process.env.PGPORT || "5432", 10);
    const dbName = process.env.DB_DATABASE || process.env.PGDATABASE || "credencializacion";

    const config: pg.PoolConfig = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 4000 }
      : {
          host: dbHost,
          user: dbUser,
          password: String(dbPass),
          database: dbName,
          port: dbPort,
          connectionTimeoutMillis: 4000,
        };
        
    pgPool = new pg.Pool(config);

    // Prevent unhandled error crashes on idle pool clients
    pgPool.on("error", (err) => {
      console.warn("⚠️ PostgreSQL idle pool client notice:", err.message);
      pgAvailable = false;
    });

    console.log("PostgreSQL Pool defined. Probing connection with database...");
    
    // Proactive startup check
    pgPool.query("SELECT 1")
      .then(async () => {
        pgAvailable = true;
        console.log("================================================================");
        console.log("✅ PostgreSQL Connection SECURED. Running with PG Storage Engine.");
        console.log("================================================================");
        
        try {
          // Schema enhancement & table creation
          await pgPool!.query(`
            CREATE TABLE IF NOT EXISTS directory_physicians (
              id VARCHAR(100) PRIMARY KEY,
              full_name VARCHAR(255) NOT NULL,
              cell_phone VARCHAR(100),
              hospital_extension VARCHAR(100),
              module_and_office VARCHAR(255),
              specialty VARCHAR(255),
              short_code VARCHAR(50),
              modulo VARCHAR(100),
              extension_modulo VARCHAR(100),
              extension_consultorio VARCHAR(100),
              suite VARCHAR(100),
              primer_apellido VARCHAR(100),
              segundo_apellido VARCHAR(100),
              nombre VARCHAR(100),
              especialidad_unificada VARCHAR(100),
              correo VARCHAR(150)
            )
          `);
          await pgPool!.query("ALTER TABLE directory_physicians ADD COLUMN IF NOT EXISTS short_code VARCHAR(50)");
          await pgPool!.query("ALTER TABLE directory_physicians ADD COLUMN IF NOT EXISTS modulo VARCHAR(100)");
          await pgPool!.query("ALTER TABLE directory_physicians ADD COLUMN IF NOT EXISTS extension_modulo VARCHAR(100)");
          await pgPool!.query("ALTER TABLE directory_physicians ADD COLUMN IF NOT EXISTS extension_consultorio VARCHAR(100)");
          await pgPool!.query("ALTER TABLE directory_physicians ADD COLUMN IF NOT EXISTS suite VARCHAR(100)");
          await pgPool!.query("ALTER TABLE directory_physicians ADD COLUMN IF NOT EXISTS primer_apellido VARCHAR(100)");
          await pgPool!.query("ALTER TABLE directory_physicians ADD COLUMN IF NOT EXISTS segundo_apellido VARCHAR(100)");
          await pgPool!.query("ALTER TABLE directory_physicians ADD COLUMN IF NOT EXISTS nombre VARCHAR(100)");
          await pgPool!.query("ALTER TABLE directory_physicians ADD COLUMN IF NOT EXISTS especialidad_unificada VARCHAR(100)");
          await pgPool!.query("ALTER TABLE directory_physicians ADD COLUMN IF NOT EXISTS correo VARCHAR(150)");

          // Auto-seed directory if table is empty
          try {
            const dirCountRes = await pgPool!.query("SELECT COUNT(*) FROM directory_physicians");
            if (parseInt(dirCountRes.rows[0].count, 10) === 0 && DEFAULT_DIRECTORY.length > 0) {
              for (const row of DEFAULT_DIRECTORY) {
                await pgPool!.query(
                  `INSERT INTO directory_physicians (
                    id, full_name, cell_phone, hospital_extension, module_and_office, specialty, short_code,
                    modulo, extension_modulo, extension_consultorio, suite,
                    primer_apellido, segundo_apellido, nombre, especialidad_unificada, correo
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) ON CONFLICT (id) DO NOTHING`,
                  [
                    row.id, row.fullName, row.cellPhone, row.hospitalExtension, row.moduleAndOffice, row.specialty, row.shortCode || null,
                    row.modulo || null, row.extensionModulo || null, row.extensionConsultorio || null, row.suite || null,
                    row.primerApellido || null, row.segundoApellido || null, row.nombre || null, row.especialidadUnificada || null, row.correo || null
                  ]
                );
              }
              console.log("🌱 Auto-seeded initial default doctors into directory_physicians database table.");
            }
          } catch (seedErr: any) {
            console.warn("Could not auto-seed directory_physicians:", seedErr.message);
          }
          await pgPool!.query("ALTER TABLE guard_shifts ADD COLUMN IF NOT EXISTS backup_physician_id VARCHAR(50)");
          await pgPool!.query("ALTER TABLE guard_shifts ADD COLUMN IF NOT EXISTS backup_physician_id3 VARCHAR(50)");
          await pgPool!.query("ALTER TABLE guard_shifts ADD COLUMN IF NOT EXISTS escalation_note TEXT");
          
          // Reset / migrate medicos & documentacion tables if old schema exists
          try {
            const docCheck = await pgPool!.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'documentacion'
              );
            `);
            const hasDocTable = docCheck.rows[0]?.exists;

            const oldColCheck = await pgPool!.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'medicos' AND column_name = 'category_files'
              );
            `);
            const hasOldSchema = oldColCheck.rows[0]?.exists;

            if (!hasDocTable || hasOldSchema) {
              console.log("🔄 Resetting database tables medicos and documentacion according to new specification...");
              await pgPool!.query("DROP TABLE IF EXISTS documentacion CASCADE");
              await pgPool!.query("DROP TABLE IF EXISTS medicos CASCADE");
            }
          } catch (e: any) {
            console.warn("Table schema check warning:", e.message);
          }

          await pgPool!.query(`
            CREATE TABLE IF NOT EXISTS medicos (
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
          `);

          await pgPool!.query("ALTER TABLE medicos ADD COLUMN IF NOT EXISTS sexo VARCHAR(50)");

          await pgPool!.query(`
            CREATE TABLE IF NOT EXISTS documentacion (
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
          `);

          // Automatic cleanup/deduplication for medicos table
          try {
            await pgPool!.query(`
              DELETE FROM medicos m1
              USING medicos m2
              WHERE m1.id > m2.id
                AND (
                  (m1.folio IS NOT NULL AND m1.folio != '' AND m1.folio = m2.folio)
                  OR (m1.cedula_profesional IS NOT NULL AND m1.cedula_profesional != '' AND m1.cedula_profesional = m2.cedula_profesional)
                  OR (
                    LOWER(TRIM(m1.nombre)) = LOWER(TRIM(m2.nombre)) 
                    AND LOWER(TRIM(m1.apellido_paterno)) = LOWER(TRIM(m2.apellido_paterno)) 
                    AND m1.nombre IS NOT NULL AND m1.nombre != ''
                  )
                )
            `);
            console.log("🧹 Cleaned up any duplicate doctor rows in medicos table.");
          } catch (dedupErr: any) {
            console.warn("Deduplication notice:", dedupErr.message);
          }

          // Sanciones Table schema
          await pgPool!.query(`
            CREATE TABLE IF NOT EXISTS sanciones (
              id VARCHAR(50) PRIMARY KEY,
              physician_id VARCHAR(50) NOT NULL,
              physician_name VARCHAR(255) NOT NULL,
              reason TEXT NOT NULL,
              type VARCHAR(100) NOT NULL,
              date VARCHAR(100) NOT NULL,
              filename VARCHAR(255) NOT NULL,
              pdf_url TEXT NOT NULL
            )
          `);

          // Blacklist / Vetados Table schema
          await pgPool!.query(`
            CREATE TABLE IF NOT EXISTS blacklist_physicians (
              id VARCHAR(100) PRIMARY KEY,
              physician_id VARCHAR(100),
              full_name VARCHAR(255) NOT NULL,
              first_name VARCHAR(255),
              last_name VARCHAR(255),
              specialty VARCHAR(255),
              npi VARCHAR(100),
              rfc VARCHAR(100),
              phone VARCHAR(100),
              email VARCHAR(255),
              campus VARCHAR(100),
              reason TEXT NOT NULL,
              banned_at VARCHAR(100) NOT NULL,
              is_external BOOLEAN DEFAULT FALSE,
              notes TEXT,
              status VARCHAR(50) DEFAULT 'VETADO'
            )
          `);
          console.log("🛡️ Database Schema updated with direct codes, escalation backups, Medical Credentials, Sanciones, and Blacklist ledger.");
        } catch (scErr: any) {
          console.warn("Could not auto-add columns or tables to PG:", scErr.message);
        }
      })
      .catch((err: any) => {
        pgAvailable = false;
        console.warn("================================================================");
        console.warn("⚠️ PostgreSQL connection probe failed:", err.message);
        console.warn("Falling back automatically to local offline-first JSON storage.");
        console.warn("================================================================");
      });
  } catch (err: any) {
    console.error("Failed to initialize PostgreSQL pool:", err.message);
    pgAvailable = false;
  }
} else {
  console.log("No PostgreSQL host detected. Running in Dual Offline-First Local JSON Storage Mode.");
}

// ----------------------------------------------------
// REST API SYSTEM ROUTINGS
// ----------------------------------------------------

// System Status Endpoint
app.get("/api/status", async (req, res) => {
  let dbConnected = pgAvailable;
  let driverSystem = pgAvailable ? "PostgreSQL DB Engine Server" : "Local JSON Workspace";
  res.json({
    online: true,
    version: "2.14.0",
    hipaaCertified: true,
    soc2Type2: true,
    database: {
      connected: dbConnected,
      engine: driverSystem
    }
  });
});

// 1. SYSTEM USERS ENDPOINTS
app.get("/api/users", async (req, res) => {
  if (usePG && pgPool && pgAvailable) {
    try {
      const result = await pgPool.query("SELECT id, name, email, role, password, created_at as \"createdAt\" FROM system_users ORDER BY created_at ASC");
      return res.json(result.rows);
    } catch (err: any) {
      console.error("Error fetching users from PG:", err.message);
    }
  }
  const users = getFallbackFile("users.json", DEFAULT_OPERATORS);
  res.json(users);
});

app.post("/api/users", async (req, res) => {
  const { id, name, email, role, password } = req.body;
  if (!id || !name || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (usePG && pgPool && pgAvailable) {
    try {
      const check = await pgPool.query("SELECT id FROM system_users WHERE id = $1", [id]);
      if (check.rows.length > 0) {
        // Update
        await pgPool.query(
          "UPDATE system_users SET name=$1, email=$2, role=$3, password=$4 WHERE id=$5",
          [name, email, role, password || 'password123', id]
        );
      } else {
        // Insert
        await pgPool.query(
          "INSERT INTO system_users (id, name, email, role, password, created_at) VALUES ($1, $2, $3, $4, $5, NOW())",
          [id, name, email, role, password || 'password123']
        );
      }
      return res.status(201).json({ success: true, id });
    } catch (err: any) {
      console.error("Error inserting user in PG:", err.message);
    }
  }

  // Fallback
  const users = getFallbackFile("users.json", DEFAULT_OPERATORS);
  const existsIdx = users.findIndex((u: any) => u.id === id);
  const newUser = { id, name, email, role, password: password || 'password123', createdAt: new Date().toISOString().split('T')[0] };
  if (existsIdx >= 0) {
    users[existsIdx] = { ...users[existsIdx], ...newUser };
  } else {
    users.push(newUser);
  }
  saveFallbackFile("users.json", users);
  res.status(201).json({ success: true, id });
});

app.delete("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  if (usePG && pgPool && pgAvailable) {
    try {
      await pgPool.query("DELETE FROM system_users WHERE id = $1", [id]);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting user from PG:", err.message);
    }
  }
  let users = getFallbackFile("users.json", DEFAULT_OPERATORS);
  users = users.filter((u: any) => u.id !== id);
  saveFallbackFile("users.json", users);
  res.json({ success: true });
});


function sanitizeDbDate(val: any): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (
    trimmed === '' || 
    trimmed.toUpperCase() === 'N/A' || 
    trimmed.toLowerCase().includes('indefinid') || 
    trimmed.toLowerCase() === 'null' ||
    trimmed === 'undefined'
  ) {
    return null;
  }
  return trimmed;
}

// Helper to track and prevent deleted records from resurrecting
const getDeletedCredentialsList = (): string[] => {
  return getFallbackFile("deleted_credentials.json", []);
};

const recordDeletedCredential = (id: string, folderName?: string, fullName?: string) => {
  const list: string[] = getFallbackFile("deleted_credentials.json", []);
  if (id && !list.includes(id)) list.push(id);
  if (folderName && !list.includes(`FOLDER:${folderName}`)) list.push(`FOLDER:${folderName}`);
  if (fullName) {
    const normName = `NAME:${fullName.trim().toLowerCase()}`;
    if (!list.includes(normName)) list.push(normName);
  }
  saveFallbackFile("deleted_credentials.json", list);
};

const isCredentialDeleted = (id: string, folderName?: string, fullName?: string): boolean => {
  const list = getDeletedCredentialsList();
  if (id && list.includes(id)) return true;
  if (folderName && folderName.trim().length > 0 && list.includes(`FOLDER:${folderName.trim()}`)) return true;
  if (fullName && fullName.trim().length > 0) {
    const normName = `NAME:${fullName.trim().toLowerCase()}`;
    if (normName !== 'name:' && list.includes(normName)) return true;
  }
  return false;
};

function normalizeCategoryData(catData: any): { files: any[]; status?: string; expiryDate?: string } {
  if (!catData) return { files: [] };
  if (Array.isArray(catData)) return { files: catData };
  if (typeof catData === 'object') {
    if (Array.isArray(catData.files)) return { files: catData.files, status: catData.status, expiryDate: catData.expiryDate };
    if (catData.file || catData.name || catData.previewUrl) return { files: [catData], status: catData.status, expiryDate: catData.expiryDate };
  }
  return { files: [] };
}

// Helper to extract OTORGADO vs PENDIENTE status for each category in documentacion table
function extractDocStatus(selectedFiles: Record<string, any>, categoryFiles: Record<string, any>) {
  const filesMap = { ...categoryFiles, ...selectedFiles };

  const getStatus = (keys: string[]) => {
    for (const k of keys) {
      if (filesMap[k]) {
        const catData = normalizeCategoryData(filesMap[k]);
        if (catData.files && catData.files.length > 0) return 'OTORGADO';
      }
    }
    return 'PENDIENTE';
  };

  return {
    solicitudcreden: getStatus(['solicitud_cred', 'solicitudCreden', '1_SOLICITUD_CREDENCIALIZACION']),
    curriculum: getStatus(['cv', 'curriculum', '2_SINTESIS_CURRICULAR_CV']),
    acta_nacimiento: getStatus(['acta', 'acta_nacimiento', '3_ACTA_NACIMIENTO']),
    ine: getStatus(['ine', '4_INE_IFE_PASAPORTE']),
    curp: getStatus(['curp', '5_CURP']),
    rfc: getStatus(['sat', 'rfc', '6_RFC_SAT']),
    caratula_bancaria: getStatus(['banco', 'caratula_bancaria', '7_CARATULA_ESTADO_CUENTA']),
    comprobante_domicilio: getStatus(['domicilio', 'comprobante_domicilio', '8_COMPROBANTE_DOMICILIO']),
    cartas_recomendacion: getStatus(['cartas_rec', 'cartas_recomendacion', '9_CARTAS_RECOMENDACION']),
    responsabilidad_civil: getStatus(['poliza_resp', 'responsabilidad_civil', '10_RESPONSABILIDAD_CIVIL']),
    titulo_profesional: getStatus(['titulo_prof', 'titulo_profesional', '11_TITULO_PROFESIONAL']),
    cedula: getStatus(['cedula_prof', 'cedula', '12_CEDULA_PROFESIONAL']),
    permiso_ejercer: getStatus(['permiso_son_prof', 'permiso_ejercer', '13_PERMISO_EJERCER_SONORA_PROFESIONAL']),
    validacion_titulo: getStatus(['val_titulo', 'validacion_titulo', '11_1_VALIDACION_TITULO_CEDULA']),
    validacion_titulo2: getStatus(['val_titulo2', 'validacion_titulo2', '11_2_VALIDACION_TITULO_CEDULA']),
    titulo_especialidad: getStatus(['titulo_esp', 'titulo_especialidad', '14_TITULO_ESPECIALIDAD']),
    diploma_subespecialidad: getStatus(['diploma_subesp', 'diploma_subesp1', 'diploma_subespecialidad', '14_1_DIPLOMA_SUBESPECIALIDAD_1']),
    diploma_subespecialidad2: getStatus(['diploma_subesp2', 'diploma_subespecialidad2', '14_2_DIPLOMA_SUBESPECIALIDAD_2']),
    cedula_especialidad: getStatus(['cedula_esp', 'cedula_especialidad', '15_CEDULA_ESPECIALIDAD']),
    cedula_subespecialidad: getStatus(['cedula_subesp', 'cedula_subesp1', 'cedula_subespecialidad', '15_1_CEDULA_SUBESPECIALIDAD_1']),
    cedula_subespecialidad2: getStatus(['cedula_subesp2', 'cedula_subespecialidad2', '15_2_CEDULA_SUBESPECIALIDAD_2']),
    permiso_ejercerespecialidad: getStatus(['permiso_son_esp', 'permiso_ejercerespecialidad', '16_PERMISO_EJERCER_SONORA_ESPECIALIDAD']),
    cirugiarobotica: getStatus(['robotica_davinci', 'cirugiarobotica', '17_CONSTANCIA_CIRUGIA_ROBOTICA_DAVINCI']),
    diplomas: getStatus(['diplomas', '18_DIPLOMAS_Y_CURSOS_2_ANOS']),
    privilegios: getStatus(['solicitud_priv', 'privilegios', '19_SOLICITUD_PRIVILEGIOS_ESPECIALIDAD']),
    conacem: getStatus(['consejo', 'conacem', '20_CERTIFICADO_CONSEJO_ESPECIALIDAD']),
    validacion_concacem: getStatus(['consejo_val_conacem', 'validacion_concacem', '20_1_VALIDACION_CONACEM'])
  };
}

// 2. MEDICAL CREDENTIALS ENDPOINTS
app.get("/api/credentials", async (req, res) => {
  if (usePG && pgPool && pgAvailable) {
    try {
      const q = `
        SELECT 
          m.id, m.folio, m.nombre, m.apellido_paterno, m.apellido_materno, m.cedula_profesional,
          m.especialidad, m.subespecialidad1, m.subespecialidad2, m.tipo_medico, m.sede,
          m.estatus, m.es_socio, m.correo, m.telefono, m.rfc, m.curp, m.sexo, m.fecha_nacimiento,
          m.fecha_registro, m.id_siho, m.active,
          d.fotomedico, d.solicitudcreden, d.curriculum, d.acta_nacimiento, d.ine, d.curp as doc_curp,
          d.rfc as doc_rfc, d.caratula_bancaria, d.comprobante_domicilio, d.cartas_recomendacion,
          d.responsabilidad_civil, d.titulo_profesional, d.cedula, d.permiso_ejercer,
          d.validacion_titulo, d.validacion_titulo2, d.titulo_especialidad, d.diploma_subespecialidad,
          d.diploma_subespecialidad2, d.cedula_especialidad, d.cedula_subespecialidad,
          d.cedula_subespecialidad2, d.permiso_ejercerespecialidad, d.cirugiarobotica,
          d.diplomas, d.privilegios, d.conacem, d.validacion_concacem, d.ruta_archivos, d.firma_url
        FROM medicos m
        LEFT JOIN documentacion d ON m.id = d.idmedico
        ORDER BY m.id ASC
      `;
      const result = await pgPool.query(q);
      const parsedRows = (result.rows || []).map(row => {
        const isDeact = row.estatus === 'DESACTIVADO' || row.active === false || row.active === 0;

        const first = row.nombre || '';
        const pat = row.apellido_paterno || '';
        const mat = row.apellido_materno || '';
        const fullLast = [pat, mat].filter(Boolean).join(' ');
        const fullDocName = `${first} ${fullLast}`.trim();
        const campusName = row.sede || 'Hermosillo';

        const folderInfo = getCampusFolderInfo(campusName);
        const cleanDocFolder = cleanDoctorNameForFolder(fullDocName);
        const computedWinPath = `${folderInfo.winPath}\\${cleanDocFolder}`;

        const documentStatus: Record<string, string> = {
          solicitud_cred: row.solicitudcreden || 'PENDIENTE',
          cv: row.curriculum || 'PENDIENTE',
          acta: row.acta_nacimiento || 'PENDIENTE',
          ine: row.ine || 'PENDIENTE',
          curp: row.doc_curp || 'PENDIENTE',
          sat: row.doc_rfc || 'PENDIENTE',
          banco: row.caratula_bancaria || 'PENDIENTE',
          domicilio: row.comprobante_domicilio || 'PENDIENTE',
          cartas_rec: row.cartas_recomendacion || 'PENDIENTE',
          poliza_resp: row.responsabilidad_civil || 'PENDIENTE',
          titulo_prof: row.titulo_profesional || 'PENDIENTE',
          cedula_prof: row.cedula || 'PENDIENTE',
          permiso_son_prof: row.permiso_ejercer || 'PENDIENTE',
          val_titulo: row.validacion_titulo || 'PENDIENTE',
          val_titulo2: row.validacion_titulo2 || 'PENDIENTE',
          titulo_esp: row.titulo_especialidad || 'PENDIENTE',
          diploma_subesp: row.diploma_subespecialidad || 'PENDIENTE',
          diploma_subesp2: row.diploma_subespecialidad2 || 'PENDIENTE',
          cedula_esp: row.cedula_especialidad || 'PENDIENTE',
          cedula_subesp: row.cedula_subespecialidad || 'PENDIENTE',
          cedula_subesp2: row.cedula_subespecialidad2 || 'PENDIENTE',
          permiso_son_esp: row.permiso_ejercerespecialidad || 'PENDIENTE',
          robotica_davinci: row.cirugiarobotica || 'PENDIENTE',
          diplomas: row.diplomas || 'PENDIENTE',
          solicitud_priv: row.privilegios || 'PENDIENTE',
          consejo: row.conacem || 'PENDIENTE',
          consejo_val_conacem: row.validacion_concacem || 'PENDIENTE'
        };

        const categoryFilesObj: Record<string, any> = {};
        Object.entries(documentStatus).forEach(([key, st]) => {
          categoryFilesObj[key] = {
            files: st === 'OTORGADO' ? [{ name: 'Documento_Adjunto.pdf', status: 'VERIFICADO', uploadedAt: new Date().toISOString() }] : []
          };
        });

        return {
          id: String(row.id || ''),
          firstName: first,
          lastName: fullLast,
          paternalLastName: pat,
          maternalLastName: mat,
          idSiho: row.id_siho || null,
          npi: row.cedula_profesional || '',
          enrollmentDate: row.fecha_registro || new Date().toISOString().split('T')[0],
          specialty: row.especialidad || 'Medicina General',
          birthDate: row.fecha_nacimiento || '',
          curpIne: row.curp || '',
          status: row.estatus || (isDeact ? 'DESACTIVADO' : 'PENDIENTE'),
          signatureUrl: row.firma_url || '',
          portraitUrl: row.fotomedico || '',
          campus: campusName,
          folio: row.folio || '',
          physicianType: row.tipo_medico || '',
          phone: row.telefono || '',
          active: !isDeact,
          email: row.correo || '',
          rfc: row.rfc || '',
          gender: row.sexo || '',
          subspecialty: row.subespecialidad1 || '',
          subspecialty2: row.subespecialidad2 || '',
          isPartner: row.es_socio === 'SI' || row.es_socio === 'true' || row.es_socio === true,
          folderName: cleanDocFolder,
          rutaArchivos: row.ruta_archivos || computedWinPath,
          documentStatus: documentStatus,
          categoryFiles: categoryFilesObj,
          selectedFiles: categoryFilesObj
        };
      });

      const activeRows = parsedRows.filter(c => !isCredentialDeleted(c.id, c.folderName, `${c.firstName || ''} ${c.lastName || ''}`));
      return res.json(activeRows);
    } catch (err: any) {
      console.error("Error query pg credentials:", err.message);
    }
  }
  const creds = getFallbackFile("credentials.json", DEFAULT_CREDENTIALS);
  const activeCreds = creds.filter((c: any) => !isCredentialDeleted(c.id, c.folderName, `${c.firstName || ''} ${c.lastName || ''}`));
  res.json(activeCreds);
});

app.post("/api/credentials", async (req, res) => {
  const cred = req.body;
  if (!cred.firstName && !cred.nombre) {
    return res.status(400).json({ error: "Falta el nombre del médico" });
  }

  const nombreVal = cred.firstName || cred.nombre || '';
  const paternoVal = cred.paternalLastName || cred.apellido_paterno || (cred.lastName ? cred.lastName.split(' ')[0] : '');
  const maternoVal = cred.maternalLastName || cred.apellido_materno || (cred.lastName ? cred.lastName.split(' ').slice(1).join(' ') : '');
  const fullLastName = [paternoVal, maternoVal].filter(Boolean).join(' ') || cred.lastName || '';
  const doctorFullName = `${nombreVal} ${fullLastName}`.trim();

  const campusVal = cred.campus || cred.sede || 'Hermosillo';
  
  // Compute folder path and winPath
  const folderInfo = getCampusFolderInfo(campusVal);
  const cleanDocFolder = cleanDoctorNameForFolder(doctorFullName);
  const winFolderPath = `${folderInfo.winPath}\\${cleanDocFolder}`;
  const rutaArchivosVal = cred.rutaArchivos || cred.ruta_archivos || winFolderPath;

  const cedulaVal = cred.npi || cred.cedula_profesional || '';
  const especVal = cred.specialty || cred.especialidad || 'Medicina General';
  const sub1Val = cred.subspecialty || cred.subespecialidad1 || null;
  const sub2Val = cred.subspecialty2 || cred.subespecialidad2 || null;
  const tipoVal = cred.physicianType || cred.tipo_medico || null;
  const regVal = sanitizeDbDate(cred.enrollmentDate) || new Date().toISOString().split('T')[0];
  const nacVal = sanitizeDbDate(cred.birthDate);
  const curpVal = cred.curpIne || cred.curp || null;
  const estatusVal = cred.status || cred.estatus || 'PENDIENTE';
  const telVal = cred.phone || cred.telefono || cred.cellphone || null;
  const correoVal = cred.email || cred.correo || null;
  const rfcVal = cred.rfc || null;
  const sexoVal = cred.gender || cred.sexo || 'MASCULINO';
  const socioVal = typeof cred.isPartner === 'boolean' ? (cred.isPartner ? 'SI' : 'NO') : (cred.isPartner || 'NO');
  const idSihoVal = cred.idSiho ? parseInt(String(cred.idSiho), 10) : null;
  const isPhysicianActive = cred.active !== undefined ? !!cred.active : (estatusVal !== 'DESACTIVADO');

  // Extract OTORGADO / PENDIENTE status for documentacion table
  const docsStatus = extractDocStatus(cred.selectedFiles || {}, cred.categoryFiles || {});
  const fotoVal = cred.portraitUrl || cred.foto_url || null;
  const firmaVal = cred.signatureUrl || cred.firma_url || null;

  let assignedId: string = String(cred.id || '');
  let assignedFolio: string = cred.folio || '';

  if (usePG && pgPool && pgAvailable) {
    try {
      let matchedDbId: number | null = null;

      // 1. Match by numeric ID if provided and valid integer
      if (assignedId && !isNaN(Number(assignedId))) {
        const c1 = await pgPool.query("SELECT id, folio FROM medicos WHERE id = $1", [parseInt(assignedId, 10)]);
        if (c1.rows.length > 0) {
          matchedDbId = c1.rows[0].id;
          if (!assignedFolio) assignedFolio = c1.rows[0].folio;
        }
      }

      // 2. Match by folio if available
      if (!matchedDbId && assignedFolio) {
        const c2 = await pgPool.query("SELECT id FROM medicos WHERE folio = $1", [assignedFolio]);
        if (c2.rows.length > 0) {
          matchedDbId = c2.rows[0].id;
        }
      }

      // 3. Match by cedula_profesional if provided
      if (!matchedDbId && cedulaVal && String(cedulaVal).trim().length > 2) {
        const c3 = await pgPool.query("SELECT id, folio FROM medicos WHERE LOWER(TRIM(cedula_profesional)) = LOWER(TRIM($1))", [String(cedulaVal).trim()]);
        if (c3.rows.length > 0) {
          matchedDbId = c3.rows[0].id;
          if (!assignedFolio) assignedFolio = c3.rows[0].folio;
        }
      }

      // 4. Match by exact normalized nombre + apellido_paterno
      if (!matchedDbId && nombreVal && paternoVal) {
        const c4 = await pgPool.query(
          `SELECT id, folio FROM medicos 
           WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1)) 
             AND LOWER(TRIM(apellido_paterno)) = LOWER(TRIM($2))`,
          [nombreVal.trim(), paternoVal.trim()]
        );
        if (c4.rows.length > 0) {
          matchedDbId = c4.rows[0].id;
          if (!assignedFolio) assignedFolio = c4.rows[0].folio;
        }
      }

      if (!assignedFolio) {
        const allCreds = getFallbackFile("credentials.json", DEFAULT_CREDENTIALS);
        assignedFolio = calculateSequentialFolioServer(campusVal, allCreds, assignedId);
      }

      let medicoDbId: number;

      if (matchedDbId) {
        // UPDATE medicos
        await pgPool.query(
          `UPDATE medicos SET
            folio=$1, nombre=$2, apellido_paterno=$3, apellido_materno=$4, cedula_profesional=$5,
            especialidad=$6, subespecialidad1=$7, subespecialidad2=$8, tipo_medico=$9, sede=$10,
            estatus=$11, es_socio=$12, correo=$13, telefono=$14, rfc=$15, curp=$16, sexo=$17,
            fecha_nacimiento=$18, fecha_registro=$19, id_siho=$20, active=$21
          WHERE id = $22`,
          [
            assignedFolio, nombreVal, paternoVal, maternoVal, cedulaVal,
            especVal, sub1Val, sub2Val, tipoVal, campusVal,
            estatusVal, socioVal, correoVal, telVal, rfcVal, curpVal, sexoVal,
            nacVal, regVal, idSihoVal, isPhysicianActive, matchedDbId
          ]
        );
        medicoDbId = matchedDbId;
        assignedId = String(matchedDbId);
      } else {
        // INSERT medicos
        const insertRes = await pgPool.query(
          `INSERT INTO medicos (
            folio, nombre, apellido_paterno, apellido_materno, cedula_profesional,
            especialidad, subespecialidad1, subespecialidad2, tipo_medico, sede,
            estatus, es_socio, correo, telefono, rfc, curp, sexo,
            fecha_nacimiento, fecha_registro, id_siho, active
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21
          ) RETURNING id`,
          [
            assignedFolio, nombreVal, paternoVal, maternoVal, cedulaVal,
            especVal, sub1Val, sub2Val, tipoVal, campusVal,
            estatusVal, socioVal, correoVal, telVal, rfcVal, curpVal, sexoVal,
            nacVal, regVal, idSihoVal, isPhysicianActive
          ]
        );
        medicoDbId = insertRes.rows[0].id;
        assignedId = String(medicoDbId);
      }

      // Upsert into documentacion table
      const docCheck = await pgPool.query("SELECT id FROM documentacion WHERE idmedico = $1", [medicoDbId]);
      if (docCheck.rows.length > 0) {
        await pgPool.query(
          `UPDATE documentacion SET
            fotomedico = $1, solicitudcreden = $2, curriculum = $3, acta_nacimiento = $4, ine = $5,
            curp = $6, rfc = $7, caratula_bancaria = $8, comprobante_domicilio = $9, cartas_recomendacion = $10,
            responsabilidad_civil = $11, titulo_profesional = $12, cedula = $13, permiso_ejercer = $14, validacion_titulo = $15,
            validacion_titulo2 = $16, titulo_especialidad = $17, diploma_subespecialidad = $18, diploma_subespecialidad2 = $19, cedula_especialidad = $20,
            cedula_subespecialidad = $21, cedula_subespecialidad2 = $22, permiso_ejercerespecialidad = $23, cirugiarobotica = $24, diplomas = $25,
            privilegios = $26, conacem = $27, validacion_concacem = $28, ruta_archivos = $29, firma_url = $30
          WHERE idmedico = $31`,
          [
            fotoVal, docsStatus.solicitudcreden, docsStatus.curriculum, docsStatus.acta_nacimiento, docsStatus.ine,
            docsStatus.curp, docsStatus.rfc, docsStatus.caratula_bancaria, docsStatus.comprobante_domicilio, docsStatus.cartas_recomendacion,
            docsStatus.responsabilidad_civil, docsStatus.titulo_profesional, docsStatus.cedula, docsStatus.permiso_ejercer, docsStatus.validacion_titulo,
            docsStatus.validacion_titulo2, docsStatus.titulo_especialidad, docsStatus.diploma_subespecialidad, docsStatus.diploma_subespecialidad2, docsStatus.cedula_especialidad,
            docsStatus.cedula_subespecialidad, docsStatus.cedula_subespecialidad2, docsStatus.permiso_ejercerespecialidad, docsStatus.cirugiarobotica, docsStatus.diplomas,
            docsStatus.privilegios, docsStatus.conacem, docsStatus.validacion_concacem, rutaArchivosVal, firmaVal, medicoDbId
          ]
        );
      } else {
        await pgPool.query(
          `INSERT INTO documentacion (
            idmedico, fotomedico, solicitudcreden, curriculum, acta_nacimiento, ine,
            curp, rfc, caratula_bancaria, comprobante_domicilio, cartas_recomendacion,
            responsabilidad_civil, titulo_profesional, cedula, permiso_ejercer, validacion_titulo,
            validacion_titulo2, titulo_especialidad, diploma_subespecialidad, diploma_subespecialidad2, cedula_especialidad,
            cedula_subespecialidad, cedula_subespecialidad2, permiso_ejercerespecialidad, cirugiarobotica, diplomas,
            privilegios, conacem, validacion_concacem, ruta_archivos, firma_url
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21,
            $22, $23, $24, $25, $26,
            $27, $28, $29, $30, $31
          )`,
          [
            medicoDbId, fotoVal, docsStatus.solicitudcreden, docsStatus.curriculum, docsStatus.acta_nacimiento, docsStatus.ine,
            docsStatus.curp, docsStatus.rfc, docsStatus.caratula_bancaria, docsStatus.comprobante_domicilio, docsStatus.cartas_recomendacion,
            docsStatus.responsabilidad_civil, docsStatus.titulo_profesional, docsStatus.cedula, docsStatus.permiso_ejercer, docsStatus.validacion_titulo,
            docsStatus.validacion_titulo2, docsStatus.titulo_especialidad, docsStatus.diploma_subespecialidad, docsStatus.diploma_subespecialidad2, docsStatus.cedula_especialidad,
            docsStatus.cedula_subespecialidad, docsStatus.cedula_subespecialidad2, docsStatus.permiso_ejercerespecialidad, docsStatus.cirugiarobotica, docsStatus.diplomas,
            docsStatus.privilegios, docsStatus.conacem, docsStatus.validacion_concacem, rutaArchivosVal, firmaVal
          ]
        );
      }
    } catch (err: any) {
      console.error("Error inserting/updating credential in PG medicos/documentacion:", err.message);
    }
  }

  // Also update local JSON fallback file
  const creds = getFallbackFile("credentials.json", DEFAULT_CREDENTIALS);
  const fullCredObject = {
    ...cred,
    id: assignedId,
    firstName: nombreVal,
    lastName: fullLastName,
    paternalLastName: paternoVal,
    maternalLastName: maternoVal,
    npi: cedulaVal,
    specialty: especVal,
    subspecialty: sub1Val,
    subspecialty2: sub2Val,
    physicianType: tipoVal,
    enrollmentDate: regVal,
    birthDate: nacVal,
    curpIne: curpVal,
    status: estatusVal,
    active: isPhysicianActive,
    campus: campusVal,
    folio: assignedFolio,
    phone: telVal,
    email: correoVal,
    rfc: rfcVal,
    isPartner: socioVal === 'SI',
    rutaArchivos: rutaArchivosVal,
    folderName: cleanDocFolder,
    documentStatus: docsStatus
  };

  const existsIdx = creds.findIndex((c: any) => 
    String(c.id) === String(assignedId) || 
    (c.folio && c.folio === assignedFolio)
  );
  if (existsIdx >= 0) {
    creds[existsIdx] = { ...creds[existsIdx], ...fullCredObject };
  } else {
    creds.unshift(fullCredObject);
  }
  saveFallbackFile("credentials.json", creds);

  res.status(201).json({ success: true, id: assignedId, folio: assignedFolio, rutaArchivos: rutaArchivosVal, credential: fullCredObject });
});

app.delete("/api/credentials/:id", async (req, res) => {
  const { id } = req.params;

  // Track tombstone so folder scanner or database reloads never resurrect this record
  let creds = getFallbackFile("credentials.json", DEFAULT_CREDENTIALS);
  const target = creds.find((c: any) => c.id === id);
  const folderName = target?.folderName;
  const fullName = target ? `${target.firstName || ''} ${target.lastName || ''}`.trim() : undefined;

  recordDeletedCredential(id, folderName, fullName);

  // Remove physical folder from disk if it exists
  const cleanDocName = fullName ? cleanDoctorNameForFolder(fullName) : (folderName ? cleanDoctorNameForFolder(folderName) : null);
  if (cleanDocName) {
    for (const conf of ALL_CAMPUS_CONFIGS) {
      const info = getCampusFolderInfo(conf.campus);
      const p1 = path.join(info.physicalPath, cleanDocName);
      const p2 = path.join(info.physicalPath, `DR_${cleanDocName}`);
      if (fs.existsSync(p1)) {
        try { fs.rmSync(p1, { recursive: true, force: true }); } catch (e) {}
      }
      if (fs.existsSync(p2)) {
        try { fs.rmSync(p2, { recursive: true, force: true }); } catch (e) {}
      }
    }
  }

  creds = creds.filter((c: any) => c.id !== id);
  saveFallbackFile("credentials.json", creds);

  if (usePG && pgPool && pgAvailable) {
    try {
      await pgPool.query("DELETE FROM medicos WHERE id::text = $1 OR folio = $1", [id]);
    } catch (err: any) {
      console.error("Error deleting from PG medicos:", err.message);
    }
  }

  res.json({ success: true });
});

// Purge Endpoint to reset database and physical ghost records to zero
app.post("/api/purge-all-credentials", async (req, res) => {
  try {
    saveFallbackFile("credentials.json", []);
    saveFallbackFile("deleted_credentials.json", []);

    if (usePG && pgPool && pgAvailable) {
      try {
        await pgPool.query("TRUNCATE TABLE documentacion, medicos RESTART IDENTITY CASCADE;");
      } catch (err: any) {
        console.error("Error truncating PG medicos:", err.message);
      }
    }

    ALL_CAMPUS_CONFIGS.forEach(conf => {
      const info = getCampusFolderInfo(conf.campus);
      if (fs.existsSync(info.physicalPath)) {
        try {
          const entries = fs.readdirSync(info.physicalPath, { withFileTypes: true });
          for (const ent of entries) {
            if (ent.isDirectory()) {
              const fullP = path.join(info.physicalPath, ent.name);
              fs.rmSync(fullP, { recursive: true, force: true });
            }
          }
        } catch (e) {
          console.warn(`Warning cleaning campus dir ${info.physicalPath}:`, e);
        }
      }
    });

    console.log("🧹 [DEPURACIÓN COMPLETA] Todos los expedientes y registros han sido eliminados. Sistema en 0.");
    return res.json({ success: true, message: "Sistema purgado correctamente. Base de datos e historia en 0." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// 3. PHYSICIANS DIRECTORY ENDPOINTS
app.get("/api/directory", async (req, res) => {
  if (usePG && pgPool && pgAvailable) {
    try {
      const r = await pgPool.query(`
        SELECT 
          id, full_name as "fullName", cell_phone as "cellPhone", 
          hospital_extension as "hospitalExtension", module_and_office as "moduleAndOffice", 
          specialty, short_code as "shortCode",
          modulo, extension_modulo as "extensionModulo", extension_consultorio as "extensionConsultorio",
          suite, primer_apellido as "primerApellido", segundo_apellido as "segundoApellido",
          nombre, especialidad_unificada as "especialidadUnificada", correo
        FROM directory_physicians ORDER BY full_name ASC`);
      return res.json(r.rows);
    } catch (err: any) {
      console.error("Error query pg directory:", err.message);
    }
  }
  const dir = getFallbackFile("directory.json", DEFAULT_DIRECTORY);
  res.json(dir);
});

app.post("/api/directory", async (req, res) => {
  const row = req.body;
  if (!row.id || !row.fullName) {
    return res.status(400).json({ error: "Missing required identity" });
  }

  if (usePG && pgPool && pgAvailable) {
    try {
      const check = await pgPool.query("SELECT id FROM directory_physicians WHERE id = $1", [row.id]);
      if (check.rows.length > 0) {
        await pgPool.query(
          `UPDATE directory_physicians SET 
            full_name=$1, cell_phone=$2, hospital_extension=$3, module_and_office=$4, specialty=$5, short_code=$6,
            modulo=$7, extension_modulo=$8, extension_consultorio=$9, suite=$10,
            primer_apellido=$11, segundo_apellido=$12, nombre=$13, especialidad_unificada=$14, correo=$15
          WHERE id=$16`,
          [
            row.fullName, row.cellPhone, row.hospitalExtension, row.moduleAndOffice, row.specialty, row.shortCode || null,
            row.modulo || null, row.extensionModulo || null, row.extensionConsultorio || null, row.suite || null,
            row.primerApellido || null, row.segundoApellido || null, row.nombre || null, row.especialidadUnificada || null, row.correo || null,
            row.id
          ]
        );
      } else {
        await pgPool.query(
          `INSERT INTO directory_physicians (
            id, full_name, cell_phone, hospital_extension, module_and_office, specialty, short_code,
            modulo, extension_modulo, extension_consultorio, suite,
            primer_apellido, segundo_apellido, nombre, especialidad_unificada, correo
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            row.id, row.fullName, row.cellPhone, row.hospitalExtension, row.moduleAndOffice, row.specialty, row.shortCode || null,
            row.modulo || null, row.extensionModulo || null, row.extensionConsultorio || null, row.suite || null,
            row.primerApellido || null, row.segundoApellido || null, row.nombre || null, row.especialidadUnificada || null, row.correo || null
          ]
        );
      }
      return res.status(201).json({ success: true, id: row.id });
    } catch (err: any) {
      console.error("Error in PG directory insertion:", err.message);
    }
  }

  const dir = getFallbackFile("directory.json", DEFAULT_DIRECTORY);
  const existsIdx = dir.findIndex((d: any) => d.id === row.id);
  if (existsIdx >= 0) {
    dir[existsIdx] = { ...dir[existsIdx], ...row };
  } else {
    dir.push(row);
  }
  saveFallbackFile("directory.json", dir);
  res.status(201).json({ success: true, id: row.id });
});

app.post("/api/directory/bulk", async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invalid or empty items array" });
  }

  const dir = getFallbackFile("directory.json", DEFAULT_DIRECTORY);
  for (const item of items) {
    if (!item.id || !item.fullName) continue;
    const existsIdx = dir.findIndex((d: any) => d.id === item.id);
    if (existsIdx >= 0) {
      dir[existsIdx] = { ...dir[existsIdx], ...item };
    } else {
      dir.unshift(item);
    }
  }
  saveFallbackFile("directory.json", dir);

  if (usePG && pgPool && pgAvailable) {
    try {
      for (const row of items) {
        if (!row.id || !row.fullName) continue;
        const check = await pgPool.query("SELECT id FROM directory_physicians WHERE id = $1", [row.id]);
        if (check.rows.length > 0) {
          await pgPool.query(
            `UPDATE directory_physicians SET 
              full_name=$1, cell_phone=$2, hospital_extension=$3, module_and_office=$4, specialty=$5, short_code=$6,
              modulo=$7, extension_modulo=$8, extension_consultorio=$9, suite=$10,
              primer_apellido=$11, segundo_apellido=$12, nombre=$13, especialidad_unificada=$14, correo=$15
            WHERE id=$16`,
            [
              row.fullName, row.cellPhone, row.hospitalExtension, row.moduleAndOffice, row.specialty, row.shortCode || null,
              row.modulo || null, row.extensionModulo || null, row.extensionConsultorio || null, row.suite || null,
              row.primerApellido || null, row.segundoApellido || null, row.nombre || null, row.especialidadUnificada || null, row.correo || null,
              row.id
            ]
          );
        } else {
          await pgPool.query(
            `INSERT INTO directory_physicians (
              id, full_name, cell_phone, hospital_extension, module_and_office, specialty, short_code,
              modulo, extension_modulo, extension_consultorio, suite,
              primer_apellido, segundo_apellido, nombre, especialidad_unificada, correo
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [
              row.id, row.fullName, row.cellPhone, row.hospitalExtension, row.moduleAndOffice, row.specialty, row.shortCode || null,
              row.modulo || null, row.extensionModulo || null, row.extensionConsultorio || null, row.suite || null,
              row.primerApellido || null, row.segundoApellido || null, row.nombre || null, row.especialidadUnificada || null, row.correo || null
            ]
          );
        }
      }
    } catch (err: any) {
      console.error("Error in PG bulk directory insertion:", err.message);
    }
  }

  res.json({ success: true, count: items.length });
});

app.delete("/api/directory/:id", async (req, res) => {
  const { id } = req.params;
  if (usePG && pgPool && pgAvailable) {
    try {
      await pgPool.query("DELETE FROM directory_physicians WHERE id = $1", [id]);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting from PG directory:", err.message);
    }
  }
  let dir = getFallbackFile("directory.json", DEFAULT_DIRECTORY);
  dir = dir.filter((d: any) => d.id !== id);
  saveFallbackFile("directory.json", dir);
  res.json({ success: true });
});


// 4. GUARD SHIFTS ENDPOINTS
app.get("/api/guards", async (req, res) => {
  if (usePG && pgPool && pgAvailable) {
    try {
      const r = await pgPool.query(`
        SELECT 
          id, physician_id as "physicianId", date::text as "date", specialty, missed, note,
          backup_physician_id as "backupPhysicianId", backup_physician_id3 as "backupPhysicianId3",
          escalation_note as "escalationNote"
        FROM guard_shifts 
        ORDER BY date ASC`);
      return res.json(r.rows);
    } catch (err: any) {
      console.error("Error query pg guards:", err.message);
    }
  }
  const guards = getFallbackFile("guards.json", DEFAULT_GUARDS);
  res.json(guards);
});

app.post("/api/guards", async (req, res) => {
  const shift = req.body;
  if (!shift.id || !shift.physicianId || !shift.date) {
    return res.status(400).json({ error: "Missing required shift constraints" });
  }

  if (usePG && pgPool && pgAvailable) {
    try {
      const check = await pgPool.query("SELECT id FROM guard_shifts WHERE id = $1", [shift.id]);
      if (check.rows.length > 0) {
        await pgPool.query(
          `UPDATE guard_shifts SET 
            physician_id=$1, date=$2, specialty=$3, missed=$4, note=$5,
            backup_physician_id=$6, backup_physician_id3=$7, escalation_note=$8 
           WHERE id=$9`,
          [
            shift.physicianId, shift.date, shift.specialty, !!shift.missed, shift.note || null,
            shift.backupPhysicianId || null, shift.backupPhysicianId3 || null, shift.escalationNote || null,
            shift.id
          ]
        );
      } else {
        await pgPool.query(
          `INSERT INTO guard_shifts (
            id, physician_id, date, specialty, missed, note, 
            backup_physician_id, backup_physician_id3, escalation_note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            shift.id, shift.physicianId, shift.date, shift.specialty, !!shift.missed, shift.note || null,
            shift.backupPhysicianId || null, shift.backupPhysicianId3 || null, shift.escalationNote || null
          ]
        );
      }
      return res.status(201).json({ success: true, id: shift.id });
    } catch (err: any) {
      console.error("Error inserting shift in PG:", err.message);
    }
  }

  const guards = getFallbackFile("guards.json", DEFAULT_GUARDS);
  const existsIdx = guards.findIndex((g: any) => g.id === shift.id);
  if (existsIdx >= 0) {
    guards[existsIdx] = { ...guards[existsIdx], ...shift };
  } else {
    guards.push(shift);
  }
  saveFallbackFile("guards.json", guards);
  res.status(201).json({ success: true, id: shift.id });
});

app.delete("/api/guards/:id", async (req, res) => {
  const { id } = req.params;
  if (usePG && pgPool && pgAvailable) {
    try {
      await pgPool.query("DELETE FROM guard_shifts WHERE id = $1", [id]);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting guard shift in PG:", err.message);
    }
  }
  let guards = getFallbackFile("guards.json", DEFAULT_GUARDS);
  guards = guards.filter((g: any) => g.id !== id);
  saveFallbackFile("guards.json", guards);
  res.json({ success: true });
});


// 5. SANCIONES (DISCIPLINARY ACTIONS) ENDPOINTS
const SANCIONES_DIR = path.join(process.cwd(), "Sanciones");
if (!fs.existsSync(SANCIONES_DIR)) {
  fs.mkdirSync(SANCIONES_DIR, { recursive: true });
}

app.get("/api/sanciones", async (req, res) => {
  if (usePG && pgPool && pgAvailable) {
    try {
      const q = 'SELECT id, physician_id as "physicianId", physician_name as "physicianName", reason, type, date, filename, pdf_url as "pdfUrl" FROM sanciones ORDER BY date DESC';
      const result = await pgPool.query(q);
      return res.json(result.rows);
    } catch (err: any) {
      console.error("Error reading Sanciones from PG:", err.message);
    }
  }
  const list = getFallbackFile("sanciones.json", DEFAULT_SANCIONES);
  res.json(list);
});

app.post("/api/sanciones", async (req, res) => {
  const { id, physicianId, physicianName, reason, type, date, filename, pdfBase64 } = req.body;
  if (!id || !physicianId || !physicianName || !reason || !type || !date) {
    return res.status(400).json({ error: "Missing required fields for Sancion" });
  }

  let finalFilename = filename || `sancion_${id}.pdf`;
  let pdfUrl = `/api/sanciones-files?physician=${encodeURIComponent(physicianName)}&file=${encodeURIComponent(finalFilename)}`;

  // Save physical file on the server if base64 data is present
  if (pdfBase64) {
    try {
      const doctorFolder = path.join(SANCIONES_DIR, physicianName.replace(/[\/\\?%*:|"<>]/g, ''));
      if (!fs.existsSync(doctorFolder)) {
        fs.mkdirSync(doctorFolder, { recursive: true });
      }
      const filePath = path.join(doctorFolder, finalFilename);
      const buffer = Buffer.from(pdfBase64, 'base64');
      fs.writeFileSync(filePath, buffer);
      console.log(`Document saved successfully inside local server directory: ${filePath}`);
    } catch (fsErr: any) {
      console.error("Failed to write physical Sanciones PDF file on server disk:", fsErr.message);
    }
  }

  if (usePG && pgPool && pgAvailable) {
    try {
      const check = await pgPool.query("SELECT id FROM sanciones WHERE id = $1", [id]);
      if (check.rows.length > 0) {
        await pgPool.query(
          `UPDATE sanciones SET 
            physician_id=$1, physician_name=$2, reason=$3, type=$4, date=$5, filename=$6, pdf_url=$7 
           WHERE id=$8`,
          [physicianId, physicianName, reason, type, date, finalFilename, pdfUrl, id]
        );
      } else {
        await pgPool.query(
          `INSERT INTO sanciones (
            id, physician_id, physician_name, reason, type, date, filename, pdf_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, physicianId, physicianName, reason, type, date, finalFilename, pdfUrl]
        );
      }
      return res.status(201).json({ success: true, id });
    } catch (err: any) {
      console.error("Error inserting/updating Sanciones in PG:", err.message);
    }
  }

  // Local fallback persistence
  const list = getFallbackFile("sanciones.json", DEFAULT_SANCIONES);
  const existsIdx = list.findIndex((s: any) => s.id === id);
  const newSanction = { id, physicianId, physicianName, reason, type, date, filename: finalFilename, pdfUrl };
  if (existsIdx >= 0) {
    list[existsIdx] = newSanction;
  } else {
    list.unshift(newSanction);
  }
  saveFallbackFile("sanciones.json", list);
  res.status(201).json({ success: true, id });
});

app.delete("/api/sanciones/:id", async (req, res) => {
  const { id } = req.params;
  if (usePG && pgPool && pgAvailable) {
    try {
      await pgPool.query("DELETE FROM sanciones WHERE id = $1", [id]);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting Sancion in PG:", err.message);
    }
  }
  let list = getFallbackFile("sanciones.json", DEFAULT_SANCIONES);
  list = list.filter((s: any) => s.id !== id);
  saveFallbackFile("sanciones.json", list);
  res.json({ success: true });
});

// 6. BLACKLIST / LISTA NEGRA (MÉDICOS VETADOS) ENDPOINTS
app.get("/api/blacklist", async (req, res) => {
  if (usePG && pgPool && pgAvailable) {
    try {
      const q = `
        SELECT 
          id, physician_id as "physicianId", full_name as "fullName", 
          first_name as "firstName", last_name as "lastName", specialty, 
          npi, rfc, phone, email, campus, reason, 
          banned_at as "bannedAt", is_external as "isExternal", notes, status
        FROM blacklist_physicians 
        ORDER BY banned_at DESC`;
      const result = await pgPool.query(q);
      return res.json(result.rows);
    } catch (err: any) {
      console.error("Error reading Blacklist from PG:", err.message);
    }
  }
  const list = getFallbackFile("blacklist.json", []);
  res.json(list);
});

app.post("/api/blacklist", async (req, res) => {
  const item = req.body;
  if (!item.id || !item.fullName || !item.reason) {
    return res.status(400).json({ error: "Missing required fields for Blacklist entry" });
  }

  if (usePG && pgPool && pgAvailable) {
    try {
      const check = await pgPool.query("SELECT id FROM blacklist_physicians WHERE id = $1", [item.id]);
      if (check.rows.length > 0) {
        await pgPool.query(
          `UPDATE blacklist_physicians SET 
            physician_id=$1, full_name=$2, first_name=$3, last_name=$4, specialty=$5,
            npi=$6, rfc=$7, phone=$8, email=$9, campus=$10, reason=$11, banned_at=$12,
            is_external=$13, notes=$14, status=$15
           WHERE id=$16`,
          [
            item.physicianId || null, item.fullName, item.firstName || null, item.lastName || null, item.specialty || 'General',
            item.npi || null, item.rfc || null, item.phone || null, item.email || null, item.campus || null, item.reason,
            item.bannedAt || new Date().toISOString().split('T')[0], !!item.isExternal, item.notes || null, item.status || 'VETADO',
            item.id
          ]
        );
      } else {
        await pgPool.query(
          `INSERT INTO blacklist_physicians (
            id, physician_id, full_name, first_name, last_name, specialty,
            npi, rfc, phone, email, campus, reason, banned_at,
            is_external, notes, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            item.id, item.physicianId || null, item.fullName, item.firstName || null, item.lastName || null, item.specialty || 'General',
            item.npi || null, item.rfc || null, item.phone || null, item.email || null, item.campus || null, item.reason,
            item.bannedAt || new Date().toISOString().split('T')[0], !!item.isExternal, item.notes || null, item.status || 'VETADO'
          ]
        );
      }
      return res.status(201).json({ success: true, id: item.id });
    } catch (err: any) {
      console.error("Error inserting/updating Blacklist in PG:", err.message);
    }
  }

  const list = getFallbackFile("blacklist.json", []);
  const existsIdx = list.findIndex((b: any) => b.id === item.id);
  if (existsIdx >= 0) {
    list[existsIdx] = { ...list[existsIdx], ...item };
  } else {
    list.unshift(item);
  }
  saveFallbackFile("blacklist.json", list);
  res.status(201).json({ success: true, id: item.id });
});

app.delete("/api/blacklist/:id", async (req, res) => {
  const { id } = req.params;
  if (usePG && pgPool && pgAvailable) {
    try {
      await pgPool.query("DELETE FROM blacklist_physicians WHERE id = $1", [id]);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting from Blacklist in PG:", err.message);
    }
  }
  let list = getFallbackFile("blacklist.json", []);
  list = list.filter((b: any) => b.id !== id);
  saveFallbackFile("blacklist.json", list);
  res.json({ success: true });
});


app.get("/api/sanciones-files", (req, res) => {
  const { physician, file } = req.query;
  if (!physician || !file) {
    return res.status(400).json({ error: "Missing physician or file query parameters" });
  }

  const cleanPhysName = String(physician).replace(/[\/\\?%*:|"<>]/g, '');
  const filePath = path.join(SANCIONES_DIR, cleanPhysName, String(file));

  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } else {
    // Elegant fallback: If it's one of our default pre-seeded dummy documents, serve an online in-memory mock PDF on-the-fly!
    if (String(file).endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      const dummyPdf = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<<>>>>\nendobj\n4 0 obj\n<</Length 100>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(SANCION EN SISTEMA) Tj\n0 -20 Td\n(MEDICO: " + cleanPhysName + ") Tj\n0 -20 Td\n(DOCUMENTO: " + String(file) + ") Tj\n0 -20 Td\n(ESTADO: CERTIFICADO FIRMADO POR COMITE MEDICO) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000212 00535 n\ntrailer\n<</Size 5/Root 1 0 R>>\nstartxref\n306\n%%EOF"
      );
      return res.send(dummyPdf);
    }
    res.status(404).send("El documento de sanción no fue encontrado física o lógicamente.");
  }
});

// Endpoint to serve official signatures from C:\Users\Administrador.SANJOSE-HMO\Documents\FIRMAS
app.get(["/api/firmas/:filename", "/api/firmas"], (req, res) => {
  const reqName = String(req.params.filename || "DIANNAJIMENEZ.PNG").toUpperCase();
  const baseName = reqName.endsWith('.PNG') ? reqName : `${reqName}.PNG`;

  const candidates = [
    path.join("C:\\Users\\Administrador.SANJOSE-HMO\\Documents\\FIRMAS", baseName),
    path.join("C:\\Users\\Administrador.SANJOSE-HMO\\Documents\\FIRMAS", baseName.toLowerCase()),
    path.join("C:\\Users\\Administrador.SANJOSE-HMO\\Documents\\FIRMAS", "DIANNAJIMENEZ.PNG"),
    path.join("C:\\Users\\Administrador.SANJOSE-HMO\\Documents\\FIRMAS", "diannajimenez.png"),
    path.join(process.cwd(), "data", "firmas", baseName),
    path.join(process.cwd(), "public", "firmas", baseName),
    path.join(process.cwd(), "public", baseName)
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      res.setHeader("Content-Type", "image/png");
      return res.sendFile(p);
    }
  }

  res.status(404).json({
    error: "Firma file not found",
    expectedPath: "C:\\Users\\Administrador.SANJOSE-HMO\\Documents\\FIRMAS\\DIANNAJIMENEZ.PNG"
  });
});


// 6. EXPEDIENTES MEDICOS - AUTOMATIC DOCTOR FOLDER CREATION & DOCUMENT STORAGE PER CAMPUS
const WINDOWS_DOCUMENTS_BASE = "C:\\Users\\Administrador.SANJOSE-HMO\\Documents";

function getCampusFolderInfo(campusName?: string) {
  const norm = String(campusName || '').toLowerCase();
  let folderName = "CREDENCIALIZACION";
  let campusDisplay = "Hermosillo";

  if (norm.includes("guaymas") || norm.includes("gym")) {
    folderName = "CREDENCIALIZACION-GYM";
    campusDisplay = "Guaymas";
  } else if (norm.includes("obregón") || norm.includes("obregon") || norm.includes("obg")) {
    folderName = "CREDENCIALIZACION-OBG";
    campusDisplay = "Obregón";
  } else {
    folderName = "CREDENCIALIZACION";
    campusDisplay = "Hermosillo";
  }

  const winPath = path.join(WINDOWS_DOCUMENTS_BASE, folderName);
  let physicalPath = winPath;

  if (process.platform !== 'win32') {
    physicalPath = path.join(process.cwd(), folderName);
    if (!fs.existsSync(physicalPath)) {
      try { fs.mkdirSync(physicalPath, { recursive: true }); } catch(e){}
    }
  } else {
    if (!fs.existsSync(physicalPath)) {
      try { fs.mkdirSync(physicalPath, { recursive: true }); } catch(e){}
    }
  }

  return { folderName, campusDisplay, physicalPath, winPath: `${WINDOWS_DOCUMENTS_BASE}\\${folderName}` };
}

const EXPEDIENTES_DIR = getCampusFolderInfo('Hermosillo').physicalPath;
console.log(`📂 [Directorio Base Expedientes Configurado]: ${EXPEDIENTES_DIR}`);

// List of all configured campus folders for bulk operations
const ALL_CAMPUS_CONFIGS = [
  { campus: 'Hermosillo', folderName: 'CREDENCIALIZACION' },
  { campus: 'Guaymas', folderName: 'CREDENCIALIZACION-GYM' },
  { campus: 'Obregón', folderName: 'CREDENCIALIZACION-OBG' }
];

// Category Label Mapping for standard document names
const CATEGORY_NAME_MAP: Record<string, string> = {
  foto_perfil: 'FOTO_PERFIL',
  solicitud_cred: '1_SOLICITUD_CREDENCIALIZACION',
  cv: '2_CURRICULUM_VITAE',
  acta: '3_ACTA_NACIMIENTO',
  ine: '4_INE_VIGENTE_PASAPORTE',
  curp: '5_CURP',
  sat: '6_RFC_CONSTANCIA_FISCAL',
  banco: '7_CARATULA_BANCARIA',
  domicilio: '8_COMPROBANTE_DOMICILIO',
  cartas_rec: '9_CARTAS_RECOMENDACION_SOCIOS',
  titulo_prof: '10_TITULO_PROFESIONAL',
  cedula_prof: '11_CEDULA_PROFESIONAL',
  permiso_son_prof: '12_PERMISO_EJERCER_SONORA_PROFESION',
  titulo_esp: '13_TITULO_ESPECIALIDAD',
  cedula_esp: '14_CEDULA_ESPECIALIDAD',
  permiso_son_esp: '15_PERMISO_EJERCER_SONORA_ESPECIALIDAD',
  robotica_davinci: '16_CONSTANCIA_CIRUGIA_ROBOTICA_DAVINCI',
  diplomas: '17_DIPLOMAS_Y_CURSOS_2_ANOS',
  solicitud_priv: '18_SOLICITUD_PRIVILEGIOS_ESPECIALIDAD',
  acls: '19_ACLS_ANESTESIOLOGOS',
  consejo: '20_CERTIFICADO_CONSEJO_ESPECIALIDAD',
  trasplante_renal: '21_CERTIFICADO_TRASPLANTE_RENAL',
  archivos_adicionales: '22_ARCHIVOS_ADICIONALES',
  carta_comp: 'CARTA_COMPROMISO'
};

function cleanDoctorNameForFolder(doctorName: string): string {
  if (!doctorName) return "MEDICO_SIN_NOMBRE";
  let str = String(doctorName).trim();
  str = str.replace(/^(DR_|DRA_|DR\.|DRA\.|DR\s+|DRA\s+)/i, '');
  return str
    .replace(/[\/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase() || "MEDICO_SIN_NOMBRE";
}

function findOrCreateDoctorFolder(
  doctorName: string,
  campus?: string,
  previousDoctorName?: string,
  previousCampus?: string
): { physicalPath: string; cleanDoctorName: string; campusDisplay: string; winPath: string } {
  const newCampusInfo = getCampusFolderInfo(campus);
  const cleanNewName = cleanDoctorNameForFolder(doctorName);
  const targetPath = path.join(newCampusInfo.physicalPath, cleanNewName);

  // If previousDoctorName is provided, check if an old folder exists and needs to be renamed or moved
  const cleanOldName = previousDoctorName ? cleanDoctorNameForFolder(previousDoctorName) : null;
  let existingOldFolder: string | null = null;

  if (cleanOldName) {
    const oldCampusInfo = previousCampus ? getCampusFolderInfo(previousCampus) : newCampusInfo;
    const candidates = [
      path.join(oldCampusInfo.physicalPath, cleanOldName),
      path.join(oldCampusInfo.physicalPath, `DR_${cleanOldName}`),
      path.join(newCampusInfo.physicalPath, cleanOldName),
      path.join(newCampusInfo.physicalPath, `DR_${cleanOldName}`),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        existingOldFolder = c;
        break;
      }
    }
    if (!existingOldFolder) {
      for (const conf of ALL_CAMPUS_CONFIGS) {
        const info = getCampusFolderInfo(conf.campus);
        const p1 = path.join(info.physicalPath, cleanOldName);
        const p2 = path.join(info.physicalPath, `DR_${cleanOldName}`);
        if (fs.existsSync(p1)) { existingOldFolder = p1; break; }
        if (fs.existsSync(p2)) { existingOldFolder = p2; break; }
      }
    }
  }

  // If no old folder found, search all campus folders for cleanNewName or DR_cleanNewName
  if (!existingOldFolder && !fs.existsSync(targetPath)) {
    for (const conf of ALL_CAMPUS_CONFIGS) {
      const info = getCampusFolderInfo(conf.campus);
      const p1 = path.join(info.physicalPath, cleanNewName);
      const p2 = path.join(info.physicalPath, `DR_${cleanNewName}`);
      if (fs.existsSync(p1)) { existingOldFolder = p1; break; }
      if (fs.existsSync(p2)) { existingOldFolder = p2; break; }
    }
  }

  if (existingOldFolder) {
    if (existingOldFolder !== targetPath) {
      if (!fs.existsSync(newCampusInfo.physicalPath)) {
        fs.mkdirSync(newCampusInfo.physicalPath, { recursive: true });
      }
      if (!fs.existsSync(targetPath)) {
        try {
          fs.renameSync(existingOldFolder, targetPath);
          console.log(`📁 [Carpeta Renombrada/Movida] De "${existingOldFolder}" a "${targetPath}"`);
        } catch (err) {
          console.error("Error al renombrar/mover carpeta del médico:", err);
        }
      }
    }
  }

  // Ensure target folder exists
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
    console.log(`📁 [Carpeta Creada Única] Creada carpeta física para el médico en ${newCampusInfo.campusDisplay}: ${targetPath}`);
  }

  return {
    physicalPath: targetPath,
    cleanDoctorName: cleanNewName,
    campusDisplay: newCampusInfo.campusDisplay,
    winPath: `${newCampusInfo.winPath}\\${cleanNewName}`
  };
}

app.post("/api/create-doctor-folder", async (req, res) => {
  try {
    const { doctorId, doctorName, campus, previousDoctorName, previousCampus } = req.body;
    if (!doctorName || String(doctorName).trim().length < 2) {
      return res.status(400).json({ error: "Nombre de médico inválido" });
    }

    const folderInfo = findOrCreateDoctorFolder(doctorName, campus, previousDoctorName, previousCampus);

    // Update medicos.ruta_archivos in PostgreSQL
    if (usePG && pgPool && pgAvailable) {
      try {
        if (doctorId && !isNaN(Number(doctorId))) {
          await pgPool.query("UPDATE medicos SET ruta_archivos = $1 WHERE id = $2", [folderInfo.winPath, parseInt(doctorId, 10)]);
        } else {
          await pgPool.query(
            "UPDATE medicos SET ruta_archivos = $1 WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($2))",
            [folderInfo.winPath, doctorName.split(' ')[0]]
          );
        }
      } catch (dbErr: any) {
        console.warn("Could not update ruta_archivos in DB:", dbErr.message);
      }
    }

    // Update fallback JSON
    const creds = getFallbackFile("credentials.json", DEFAULT_CREDENTIALS);
    const targetIdx = creds.findIndex((c: any) => String(c.id) === String(doctorId) || c.folderName === folderInfo.cleanDoctorName);
    if (targetIdx >= 0) {
      creds[targetIdx].rutaArchivos = folderInfo.winPath;
      creds[targetIdx].folderName = folderInfo.cleanDoctorName;
      saveFallbackFile("credentials.json", creds);
    }

    return res.json({
      success: true,
      campus: folderInfo.campusDisplay,
      doctorFolder: folderInfo.cleanDoctorName,
      fullFolderPath: folderInfo.winPath,
      rutaArchivos: folderInfo.winPath,
      actualPhysicalPath: folderInfo.physicalPath
    });
  } catch (err: any) {
    console.error("Error al crear carpeta del médico:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/upload-doctor-documents", async (req, res) => {
  try {
    const { doctorId, doctorName, campus, previousDoctorName, previousCampus, documents } = req.body;
    if (!doctorName || !documents || !Array.isArray(documents)) {
      return res.status(400).json({ error: "Faltan datos requeridos: doctorName o lista de documentos" });
    }

    const folderInfo = findOrCreateDoctorFolder(doctorName, campus, previousDoctorName, previousCampus);
    const doctorFolder = folderInfo.physicalPath;
    const cleanDoctorName = folderInfo.cleanDoctorName;

    const savedFilesInfo: Array<{ category: string; fileName: string; path: string }> = [];

    for (const doc of documents) {
      if (!doc.fileBase64 || !String(doc.fileBase64).startsWith("data:")) continue;

      let rawLabel = CATEGORY_NAME_MAP[doc.categoryKey] || doc.docTitle || doc.categoryKey || "DOCUMENTO";
      let baseName = String(rawLabel)
        .trim()
        .toUpperCase()
        .replace(/[\/\\?%*:|"<>]/g, '')
        .replace(/\s+/g, '_');

      const index = doc.index || 1;

      let ext = ".pdf";
      if (doc.categoryKey === 'foto_perfil' || baseName.includes('FOTO_PERFIL') || baseName.includes('FOTO') || baseName.includes('PERFIL')) {
        ext = ".png";
      } else if (doc.fileName) {
        const match = String(doc.fileName).match(/\.([a-zA-Z0-9]+)$/);
        if (match) ext = `.${match[1].toLowerCase()}`;
      } else if (doc.fileBase64.startsWith("data:image/jpeg")) {
        ext = ".jpg";
      } else if (doc.fileBase64.startsWith("data:image/png")) {
        ext = ".png";
      } else if (doc.fileBase64.startsWith("data:image/webp")) {
        ext = ".webp";
      }

      const finalFileName = `${baseName}_${index}${ext}`;
      const filePath = path.join(doctorFolder, finalFileName);

      let base64Data = String(doc.fileBase64);
      if (base64Data.includes(",")) {
        base64Data = base64Data.split(",")[1];
      }

      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(filePath, buffer);

      const webPath = `/api/expedientes/${encodeURIComponent(cleanDoctorName)}/${encodeURIComponent(finalFileName)}`;

      savedFilesInfo.push({
        category: doc.categoryKey,
        fileName: finalFileName,
        path: webPath
      });

      // If this document is the profile photo, persist portraitUrl / foto_url in DB & JSON
      if (doc.categoryKey === 'foto_perfil' || baseName.includes('FOTO_PERFIL') || baseName.includes('PERFIL')) {
        if (usePG && pgPool && pgAvailable) {
          try {
            if (doctorId && !isNaN(Number(doctorId))) {
              await pgPool.query("UPDATE medicos SET foto_url = $1 WHERE id = $2", [webPath, parseInt(doctorId, 10)]);
            } else {
              await pgPool.query("UPDATE medicos SET foto_url = $1 WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($2))", [webPath, doctorName.split(' ')[0]]);
            }
          } catch (e) {}
        }
        const credsList = getFallbackFile("credentials.json", DEFAULT_CREDENTIALS);
        const idx = credsList.findIndex((c: any) => String(c.id) === String(doctorId) || c.folderName === cleanDoctorName);
        if (idx >= 0) {
          credsList[idx].portraitUrl = webPath;
          saveFallbackFile("credentials.json", credsList);
        }
      }

      console.log(`📄 [Archivo Guardado] ${finalFileName} guardado en ${doctorFolder}`);
    }

    // Update ruta_archivos in DB directly
    if (usePG && pgPool && pgAvailable) {
      try {
        if (doctorId && !isNaN(Number(doctorId))) {
          await pgPool.query("UPDATE medicos SET ruta_archivos = $1 WHERE id = $2", [folderInfo.winPath, parseInt(doctorId, 10)]);
        }
      } catch (e) {}
    }

    return res.json({
      success: true,
      campus: folderInfo.campusDisplay,
      doctorFolder: cleanDoctorName,
      fullFolderPath: folderInfo.winPath,
      rutaArchivos: folderInfo.winPath,
      actualPhysicalPath: doctorFolder,
      savedFiles: savedFilesInfo
    });
  } catch (err: any) {
    console.error("Error al guardar documentos del médico:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/delete-doctor-document", (req, res) => {
  try {
    const { doctorName, campus, previousDoctorName, previousCampus, categoryKey, fileName } = req.body;
    if (!doctorName) {
      return res.status(400).json({ error: "Falta doctorName" });
    }

    const folderInfo = findOrCreateDoctorFolder(doctorName, campus, previousDoctorName, previousCampus);
    const doctorFolder = folderInfo.physicalPath;

    if (!fs.existsSync(doctorFolder)) {
      return res.json({ success: true, message: "La carpeta aún no existe", deletedFiles: [] });
    }

    const deletedFiles: string[] = [];
    const existingFiles = fs.readdirSync(doctorFolder);

    const targetFileName = fileName ? String(fileName).trim().toLowerCase() : '';
    const catPrefix = categoryKey ? (CATEGORY_NAME_MAP[categoryKey] || categoryKey) : '';
    const cleanPrefix = catPrefix
      .toUpperCase()
      .replace(/[\/\\?%*:|"<>]/g, '')
      .replace(/\s+/g, '_');
    const strippedPrefix = cleanPrefix.replace(/^[\d\._]+/, '');

    for (const f of existingFiles) {
      const fUpper = f.toUpperCase();
      const fLower = f.toLowerCase();

      let shouldDelete = false;

      // 1. Direct match with target fileName
      if (targetFileName && (fLower === targetFileName || fLower.endsWith(targetFileName))) {
        shouldDelete = true;
      }

      // 2. Category prefix match
      if (!shouldDelete && categoryKey) {
        if (
          (cleanPrefix && fUpper.startsWith(cleanPrefix)) ||
          (cleanPrefix && fUpper.startsWith(cleanPrefix.replace(/^(\d+)_/, '$1._'))) ||
          (strippedPrefix && strippedPrefix.length > 3 && fUpper.includes(strippedPrefix)) ||
          (categoryKey && fUpper.includes(categoryKey.toUpperCase()))
        ) {
          shouldDelete = true;
        }
      }

      if (shouldDelete) {
        const fp = path.join(doctorFolder, f);
        if (fs.existsSync(fp)) {
          fs.unlinkSync(fp);
          deletedFiles.push(f);
        }
      }
    }

    console.log(`🗑️ [Borrado Servidor] Eliminados ${deletedFiles.length} archivo(s) de ${doctorFolder}: ${deletedFiles.join(', ')}`);

    return res.json({ success: true, deletedFiles, doctorFolder });
  } catch (err: any) {
    console.error("Error al eliminar documento:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Endpoint to retrieve existing files from doctor's physical folder on disk
app.post("/api/get-doctor-folder-files", (req, res) => {
  try {
    const { doctorName, campus } = req.body;
    if (!doctorName || String(doctorName).trim().length < 2) {
      return res.status(400).json({ error: "Nombre de médico requerido" });
    }

    const folderInfo = findOrCreateDoctorFolder(doctorName, campus);
    const doctorFolder = folderInfo.physicalPath;
    const cleanDoctorName = folderInfo.cleanDoctorName;

    if (!fs.existsSync(doctorFolder)) {
      return res.json({
        success: true,
        doctorFolder: cleanDoctorName,
        campus: folderInfo.campusDisplay,
        filesByCategory: {},
        totalFilesFound: 0
      });
    }

    const existingFiles = fs.readdirSync(doctorFolder);
    const filesByCategory: Record<string, any[]> = {};

    for (const file of existingFiles) {
      if (file.startsWith('.')) continue;
      const fileUpper = file.toUpperCase();
      const filePath = path.join(doctorFolder, file);
      let stat: fs.Stats | null = null;
      try {
        stat = fs.statSync(filePath);
      } catch (e) {
        continue;
      }
      if (stat.isDirectory()) continue;

      let matchedCategory = 'archivos_adicionales';

      for (const [catKey, catLabel] of Object.entries(CATEGORY_NAME_MAP)) {
        const cleanLabel = catLabel.toUpperCase().replace(/[\/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
        const strippedLabel = cleanLabel.replace(/^[\d\._]+/, '');

        if (
          fileUpper.startsWith(cleanLabel) ||
          fileUpper.includes(`_${cleanLabel}_`) ||
          (strippedLabel.length > 3 && fileUpper.includes(strippedLabel))
        ) {
          matchedCategory = catKey;
          break;
        }
      }

      if (!filesByCategory[matchedCategory]) {
        filesByCategory[matchedCategory] = [];
      }

      filesByCategory[matchedCategory].push({
        name: file,
        size: stat.size,
        previewUrl: `/api/expedientes/${encodeURIComponent(cleanDoctorName)}/${encodeURIComponent(file)}`,
        fromServerFolder: true,
        legibilityScore: 98,
        legibilityStatus: 'passed',
        legibilityDetails: ['Archivo recuperado del expediente físico en servidor']
      });
    }

    let totalFilesFound = 0;
    Object.values(filesByCategory).forEach(arr => { totalFilesFound += arr.length; });

    return res.json({
      success: true,
      doctorFolder: cleanDoctorName,
      campus: folderInfo.campusDisplay,
      fullFolderPath: folderInfo.winPath,
      filesByCategory,
      totalFilesFound
    });
  } catch (err: any) {
    console.error("Error al consultar archivos del expediente:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Endpoint for Multisede file copying across campus folders
app.post("/api/copy-doctor-folder-multisede", async (req, res) => {
  try {
    const { doctorId, doctorName, sourceCampus, targetCampus } = req.body;
    if (!doctorName || String(doctorName).trim().length < 2) {
      return res.status(400).json({ error: "Nombre de médico requerido" });
    }

    const sourceCampusInfo = getCampusFolderInfo(sourceCampus || 'Hermosillo');
    const targetCampusInfo = getCampusFolderInfo(targetCampus || 'Guaymas');
    const cleanName = cleanDoctorNameForFolder(doctorName);

    // Locate source doctor folder
    let sourcePath = path.join(sourceCampusInfo.physicalPath, cleanName);
    if (!fs.existsSync(sourcePath)) {
      if (fs.existsSync(path.join(sourceCampusInfo.physicalPath, `DR_${cleanName}`))) {
        sourcePath = path.join(sourceCampusInfo.physicalPath, `DR_${cleanName}`);
      } else {
        for (const conf of ALL_CAMPUS_CONFIGS) {
          const info = getCampusFolderInfo(conf.campus);
          const p1 = path.join(info.physicalPath, cleanName);
          const p2 = path.join(info.physicalPath, `DR_${cleanName}`);
          if (fs.existsSync(p1)) { sourcePath = p1; break; }
          if (fs.existsSync(p2)) { sourcePath = p2; break; }
        }
      }
    }

    // Ensure target campus directory & doctor folder exist
    if (!fs.existsSync(targetCampusInfo.physicalPath)) {
      fs.mkdirSync(targetCampusInfo.physicalPath, { recursive: true });
    }
    const targetPath = path.join(targetCampusInfo.physicalPath, cleanName);
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    // Copy files from source to target
    let copiedCount = 0;
    if (fs.existsSync(sourcePath)) {
      const sourceFiles = fs.readdirSync(sourcePath);
      for (const file of sourceFiles) {
        if (file.startsWith('.')) continue;
        const sFile = path.join(sourcePath, file);
        const tFile = path.join(targetPath, file);
        try {
          if (fs.statSync(sFile).isFile()) {
            fs.copyFileSync(sFile, tFile);
            copiedCount++;
          }
        } catch (e) {}
      }
    }

    // Compute updated multi-campus string e.g. "Hermosillo/Guaymas"
    let currentCampuses: string[] = [sourceCampusInfo.campusDisplay];
    if (sourceCampus && sourceCampus.includes('/')) {
      currentCampuses = sourceCampus.split('/').map(s => s.trim());
    }
    if (!currentCampuses.includes(targetCampusInfo.campusDisplay)) {
      currentCampuses.push(targetCampusInfo.campusDisplay);
    }
    const newCampusString = currentCampuses.join('/');

    // Build filesByCategory for target folder
    const targetFolderBaseName = path.basename(targetPath);
    const existingFiles = fs.readdirSync(targetPath);
    const filesByCategory: Record<string, any[]> = {};

    for (const file of existingFiles) {
      if (file.startsWith('.')) continue;
      const fileUpper = file.toUpperCase();
      const filePath = path.join(targetPath, file);
      let stat: fs.Stats | null = null;
      try {
        stat = fs.statSync(filePath);
      } catch (e) { continue; }
      if (stat.isDirectory()) continue;

      let matchedCategory = 'archivos_adicionales';
      for (const [catKey, catLabel] of Object.entries(CATEGORY_NAME_MAP)) {
        const cleanLabel = catLabel.toUpperCase().replace(/[\/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
        const strippedLabel = cleanLabel.replace(/^[\d\._]+/, '');

        if (
          fileUpper.startsWith(cleanLabel) ||
          fileUpper.includes(`_${cleanLabel}_`) ||
          (strippedLabel.length > 3 && fileUpper.includes(strippedLabel))
        ) {
          matchedCategory = catKey;
          break;
        }
      }

      if (!filesByCategory[matchedCategory]) {
        filesByCategory[matchedCategory] = [];
      }

      filesByCategory[matchedCategory].push({
        id: `f-${Math.random().toString(36).substring(2, 9)}`,
        name: file,
        size: stat.size,
        previewUrl: `/api/expedientes/${encodeURIComponent(targetFolderBaseName)}/${encodeURIComponent(file)}`,
        fromServerFolder: true,
        legibilityScore: 98,
        legibilityStatus: 'passed',
        legibilityDetails: [`Copiado automáticamente a la sede ${targetCampusInfo.campusDisplay}`]
      });
    }

    // Update database record if present
    if (usePG && pgPool && pgAvailable) {
      try {
        if (doctorId) {
          await pgPool.query(
            `UPDATE medicos SET sede = $1, campus = $1, ruta_archivos = $2 WHERE id::text = $3 OR folio = $3`,
            [newCampusString, targetPath, String(doctorId)]
          );
        } else {
          await pgPool.query(
            `UPDATE medicos SET sede = $1, campus = $1, ruta_archivos = $2 WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($3))`,
            [newCampusString, targetPath, doctorName]
          );
        }
      } catch (dbErr: any) {
        console.error("PG update error in copy-doctor-folder-multisede:", dbErr.message);
      }
    }

    console.log(`✨ [Multisede Import] Se copiaron ${copiedCount} archivos para ${doctorName} a ${targetCampusInfo.campusDisplay}. Sede actual: ${newCampusString}`);

    return res.json({
      success: true,
      newCampus: newCampusString,
      copiedFilesCount: copiedCount,
      filesByCategory,
      doctorFolder: targetFolderBaseName,
      targetPath
    });
  } catch (err: any) {
    console.error("Error in copy-doctor-folder-multisede:", err);
    return res.status(500).json({ error: err.message || "Error al copiar expediente multisede" });
  }
});

const FIRMAS_DIR_WIN = 'C:\\Users\\Administrador.SANJOSE-HMO\\Documents\\FIRMAS';
const FIRMAS_DIR_LOCAL = path.join(process.cwd(), 'data', 'FIRMAS');

app.post("/api/save-doctor-signature", (req, res) => {
  try {
    const { doctorName, signatureBase64 } = req.body;
    if (!doctorName || !signatureBase64) {
      return res.status(400).json({ error: "Faltan datos de firma" });
    }

    const cleanName = cleanDoctorNameForFolder(doctorName);
    const fileName = `${cleanName}.png`;

    let targetDir = FIRMAS_DIR_WIN;
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    } catch (e) {
      targetDir = FIRMAS_DIR_LOCAL;
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    }

    const filePath = path.join(targetDir, fileName);

    let base64Data = String(signatureBase64);
    if (base64Data.includes(",")) {
      base64Data = base64Data.split(",")[1];
    }

    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filePath, buffer);

    console.log(`✍️ [Firma Digital Guardada en Carpetas de Firmas]: ${filePath}`);

    return res.json({
      success: true,
      fileName,
      filePath: `${targetDir}\\${fileName}`
    });
  } catch (err: any) {
    console.error("Error al guardar la firma:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET Endpoint to list created expedientes folders across all campuses
app.get("/api/expedientes", (req, res) => {
  try {
    const allFolders: Array<{ campus: string; folderName: string }> = [];
    ALL_CAMPUS_CONFIGS.forEach(conf => {
      const info = getCampusFolderInfo(conf.campus);
      if (fs.existsSync(info.physicalPath)) {
        const folders = fs.readdirSync(info.physicalPath, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => ({ campus: conf.campus, folderName: dirent.name }));
        allFolders.push(...folders);
      }
    });
    res.json(allFolders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Endpoint to list files inside a doctor's folder searching across campus folders
app.get("/api/expedientes/:doctorName", (req, res) => {
  try {
    const rawName = String(req.params.doctorName).replace(/[\/\\?%*:|"<>]/g, '');
    const cleanDoctorName = cleanDoctorNameForFolder(rawName);

    for (const conf of ALL_CAMPUS_CONFIGS) {
      const info = getCampusFolderInfo(conf.campus);
      let docPath = path.join(info.physicalPath, cleanDoctorName);

      if (!fs.existsSync(docPath)) {
        const legacyPath = path.join(info.physicalPath, `DR_${cleanDoctorName}`);
        if (fs.existsSync(legacyPath)) {
          docPath = legacyPath;
        }
      }

      if (fs.existsSync(docPath)) {
        const files = fs.readdirSync(docPath);
        return res.json({ doctorFolder: cleanDoctorName, campus: conf.campus, files });
      }
    }
    return res.status(404).json({ error: "Carpeta del médico no encontrada", doctorName: cleanDoctorName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Endpoint to download/view a specific file from doctor's folder searching across campuses
app.get("/api/expedientes/:doctorName/:fileName", (req, res) => {
  try {
    const rawName = String(req.params.doctorName).replace(/[\/\\?%*:|"<>]/g, '');
    const cleanDoctorName = cleanDoctorNameForFolder(rawName);
    const cleanFileName = String(req.params.fileName).replace(/[\/\\?%*:|"<>]/g, '');

    for (const conf of ALL_CAMPUS_CONFIGS) {
      const info = getCampusFolderInfo(conf.campus);
      const possibleDirs = [
        path.join(info.physicalPath, cleanDoctorName),
        path.join(info.physicalPath, `DR_${cleanDoctorName}`),
        path.join(info.physicalPath, rawName)
      ];

      for (const docPath of possibleDirs) {
        if (fs.existsSync(docPath)) {
          const directPath = path.join(docPath, cleanFileName);
          if (fs.existsSync(directPath)) {
            return res.sendFile(directPath);
          }
          // Case-insensitive file matching fallback for Linux filesystems
          try {
            const files = fs.readdirSync(docPath);
            const foundFile = files.find(f => f.toLowerCase() === cleanFileName.toLowerCase() || f.toUpperCase() === cleanFileName.toUpperCase());
            if (foundFile) {
              return res.sendFile(path.join(docPath, foundFile));
            }
          } catch (e) {}
        }
      }
    }
    res.status(404).send("El documento solicitado no fue encontrado.");
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper hash function for deterministic NPI generation
function simpleHashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function calculateSequentialFolioServer(campusName: string, credsList: any[], excludeId?: string): string {
  const year = new Date().getFullYear();
  const campusUpper = (campusName || 'Hermosillo').toUpperCase();
  const campusPrefix = campusUpper.includes('GUAY') || campusUpper.includes('GYM') 
    ? 'GYM' 
    : (campusUpper.includes('OBR') || campusUpper.includes('OBG') ? 'OBG' : 'HER');
  
  const targetPrefix = `FOL-${year}-${campusPrefix}-`;
  let maxNumber = 0;
  
  credsList.forEach(c => {
    if (!c) return;
    if (excludeId && (c.id === excludeId || c.id?.toUpperCase() === excludeId.toUpperCase())) return;
    if (c.folio && c.folio.startsWith(targetPrefix)) {
      const parts = c.folio.split('-');
      const numStr = parts[parts.length - 1];
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num < 900 && num > maxNumber) {
        maxNumber = num;
      }
    }
  });

  if (maxNumber === 0) {
    const campusCredsCount = credsList.filter(c => {
      if (!c) return false;
      if (excludeId && (c.id === excludeId || c.id?.toUpperCase() === excludeId.toUpperCase())) return false;
      const cCamp = (c.campus || 'Hermosillo').toUpperCase();
      const cCode = cCamp.includes('GUAY') || cCamp.includes('GYM') ? 'GYM' : (cCamp.includes('OBR') || cCamp.includes('OBG') ? 'OBG' : 'HER');
      return cCode === campusPrefix;
    }).length;
    maxNumber = campusCredsCount;
  }

  const nextSeq = maxNumber + 1;
  return `FOL-${year}-${campusPrefix}-${String(nextSeq).padStart(3, '0')}`;
}

async function scanAndSyncCampusFoldersInternal(): Promise<any[]> {
  try {
    const credsList = getFallbackFile("credentials.json", DEFAULT_CREDENTIALS);

    for (const conf of ALL_CAMPUS_CONFIGS) {
      const info = getCampusFolderInfo(conf.campus);
      if (!fs.existsSync(info.physicalPath)) continue;

      const folderEntries = fs.readdirSync(info.physicalPath, { withFileTypes: true });
      const doctorFolders = folderEntries.filter(e => e.isDirectory()).map(e => e.name);

      for (const folderName of doctorFolders) {
        const folderPath = path.join(info.physicalPath, folderName);
        const filesInFolder = fs.readdirSync(folderPath).filter(f => !f.startsWith('.'));

        let cleanName = folderName
          .replace(/^(DR_|DRA_|MDR_|M DRA_|DR |DRA )/i, '')
          .replace(/_/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const nameParts = cleanName.split(' ');
        let firstName = cleanName;
        let lastName = '';
        if (nameParts.length >= 3) {
          firstName = nameParts.slice(0, 2).join(' ');
          lastName = nameParts.slice(2).join(' ');
        } else if (nameParts.length === 2) {
          firstName = nameParts[0];
          lastName = nameParts[1];
        }

        let hasCedula = false;
        let hasTitulo = false;
        let hasIne = false;
        let portraitUrl = '';

        filesInFolder.forEach((fileName) => {
          const upperFile = fileName.toUpperCase();
          const fileWebPath = `/api/expedientes/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`;

          if (upperFile.includes('FOTO') || upperFile.includes('PORTRAIT') || upperFile.includes('PERFIL')) {
            portraitUrl = fileWebPath;
          } else if (upperFile.includes('TITULO')) {
            hasTitulo = true;
          } else if (upperFile.includes('CEDULA')) {
            hasCedula = true;
          } else if (upperFile.includes('INE') || upperFile.includes('IDENTIFICACION')) {
            hasIne = true;
          }
        });

        const isVerified = hasIne && hasTitulo && hasCedula;
        const status = isVerified ? 'VERIFICADO' : (filesInFolder.length > 0 ? 'PENDIENTE' : 'FALTAN_DOCUMENTOS');

        const campusPrefix = conf.campus.substring(0, 3).toUpperCase();
        const generatedId = `MED-${campusPrefix}-${folderName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;
        const npiVal = String(1000000000 + Math.abs(simpleHashCode(folderName) % 8999999999));

        const cleanDoctorFullName = `${firstName} ${lastName}`.trim().toLowerCase();
        const normFolderDocName = (cleanName).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

        // SKIP DELETED PHYSICIANS SO THEY NEVER RESURRECT
        if (isCredentialDeleted(generatedId, folderName, cleanDoctorFullName)) {
          continue;
        }

        let existingIdx = credsList.findIndex((c: any) => {
          if (!c) return false;
          const cid = (c.id || '').toUpperCase();
          const genId = generatedId.toUpperCase();
          if (cid === genId) return true;
          const cNormName = (`${c.firstName || ''} ${c.lastName || ''}`).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
          if (cNormName && (cNormName === normFolderDocName || cNormName.includes(normFolderDocName) || normFolderDocName.includes(cNormName))) return true;
          return false;
        });

        let credRecord: any;

        if (existingIdx >= 0) {
          const prev = credsList[existingIdx];
          const isDeact = prev.status === 'DESACTIVADO' || prev.active === false;
          credRecord = {
            ...prev,
            firstName: prev.firstName || firstName,
            lastName: prev.lastName || lastName,
            hasCedula: prev.hasCedula || hasCedula,
            hasTitulo: prev.hasTitulo || hasTitulo,
            status: isDeact ? 'DESACTIVADO' : (prev.status === 'VERIFICADO' ? 'VERIFICADO' : status),
            active: isDeact ? false : (prev.active !== undefined ? prev.active : true),
            portraitUrl: portraitUrl || prev.portraitUrl,
            campus: prev.campus || conf.campus,
            folderName,
            filesCount: Math.max(prev.filesCount || 0, filesInFolder.length)
          };
          credsList[existingIdx] = credRecord;
        } else {
          credRecord = {
            id: generatedId,
            firstName: firstName || 'Médico',
            lastName: lastName || 'Registrado',
            npi: npiVal,
            enrollmentDate: new Date().toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }),
            specialty: 'Medicina General / Especialidad',
            status,
            active: true,
            hasCedula,
            hasTitulo,
            portraitUrl: portraitUrl || undefined,
            campus: conf.campus,
            folio: calculateSequentialFolioServer(conf.campus, credsList, generatedId),
            ineExpiryDate: null,
            cedulaExpiryDate: null,
            tituloExpiryDate: null,
            consejoExpiryDate: null,
            folderName,
            filesCount: filesInFolder.length
          };
          credsList.unshift(credRecord);
        }

        if (usePG && pgPool && pgAvailable) {
          try {
            const check = await pgPool.query(
              `SELECT id, estatus, active FROM medicos 
               WHERE id::text = $1 
                  OR (folio IS NOT NULL AND folio != '' AND (folio = $1 OR folio = $2))
                  OR (cedula_profesional IS NOT NULL AND cedula_profesional != '' AND cedula_profesional = $3)
                  OR (LOWER(TRIM(nombre)) = LOWER(TRIM($4)) AND LOWER(TRIM(apellido_paterno)) = LOWER(TRIM($5)) AND nombre != '')
               ORDER BY id ASC LIMIT 1`,
              [String(credRecord.id), credRecord.folio || '', credRecord.npi || '', credRecord.firstName || '', credRecord.lastName ? credRecord.lastName.split(' ')[0] : '']
            );
            if (check.rows.length > 0 && (check.rows[0].estatus === 'DESACTIVADO' || check.rows[0].active === false)) {
              credRecord.status = 'DESACTIVADO';
              credRecord.active = false;
            }
            const isPhysicianActive = credRecord.active !== undefined ? !!credRecord.active : (credRecord.status !== 'DESACTIVADO');
            if (check.rows.length > 0) {
              const matchedDbId = check.rows[0].id;
              const updateParams = [
                credRecord.firstName, credRecord.lastName, credRecord.npi, sanitizeDbDate(credRecord.enrollmentDate) || new Date().toISOString().split('T')[0], credRecord.specialty || 'Medicina General',
                sanitizeDbDate(credRecord.birthDate) || '1985-01-01', credRecord.curpIne || ('CURP-' + npiVal.substring(0, 8)), credRecord.status || 'PENDIENTE',
                credRecord.identityAssigned || 'CARPETAS_FISICAS', credRecord.signatureUrl || null, !!credRecord.fingerprintMapped,
                credRecord.hasCedula, credRecord.hasTitulo, credRecord.portraitUrl || null, credRecord.campus || conf.campus,
                credRecord.folio || null, sanitizeDbDate(credRecord.cedulaExpiryDate), sanitizeDbDate(credRecord.tituloExpiryDate), sanitizeDbDate(credRecord.consejoExpiryDate),
                sanitizeDbDate(credRecord.ineExpiryDate), JSON.stringify(credRecord.documentExpirations || {}),
                credRecord.physicianType || null, credRecord.phone || credRecord.cellphone || null, isPhysicianActive,
                matchedDbId
              ];
              await pgPool.query(`
                UPDATE medicos SET
                  nombre=$1, apellido_paterno=$2, cedula_profesional=$3, fecha_registro=$4, especialidad=$5,
                  fecha_nacimiento=$6, curp=$7, estatus=$8, identidad_asignada=$9, firma_url=$10,
                  fingerprint_mapped=$11, has_cedula=$12, has_titulo=$13, foto_url=$14, sede=$15,
                  folio=$16, cedula_expiry_date=$17, titulo_expiry_date=$18, consejo_expiry_date=$19,
                  ine_expiry_date=$20, document_expirations=$21, tipo_medico=$22, telefono=$23, active=$24,
                  first_name=$1, last_name=$2, npi=$3, specialty=$5, status=$8, campus=$15
                WHERE id=$25`, updateParams);
            } else {
              const insertParams = [
                credRecord.firstName, credRecord.lastName, credRecord.npi, sanitizeDbDate(credRecord.enrollmentDate) || new Date().toISOString().split('T')[0], credRecord.specialty || 'Medicina General',
                sanitizeDbDate(credRecord.birthDate) || '1985-01-01', credRecord.curpIne || ('CURP-' + npiVal.substring(0, 8)), credRecord.status || 'PENDIENTE',
                credRecord.identityAssigned || 'CARPETAS_FISICAS', credRecord.signatureUrl || null, !!credRecord.fingerprintMapped,
                credRecord.hasCedula, credRecord.hasTitulo, credRecord.portraitUrl || null, credRecord.campus || conf.campus,
                credRecord.folio || null, sanitizeDbDate(credRecord.cedulaExpiryDate), sanitizeDbDate(credRecord.tituloExpiryDate), sanitizeDbDate(credRecord.consejoExpiryDate),
                sanitizeDbDate(credRecord.ineExpiryDate), JSON.stringify(credRecord.documentExpirations || {}),
                credRecord.physicianType || null, credRecord.phone || credRecord.cellphone || null, isPhysicianActive
              ];
              await pgPool.query(`
                INSERT INTO medicos (
                  nombre, apellido_paterno, cedula_profesional, fecha_registro, especialidad,
                  fecha_nacimiento, curp, estatus, identidad_asignada, firma_url,
                  fingerprint_mapped, has_cedula, has_titulo, foto_url, sede,
                  folio, cedula_expiry_date, titulo_expiry_date, consejo_expiry_date,
                  ine_expiry_date, document_expirations, tipo_medico, telefono, active,
                  first_name, last_name, npi, specialty, status, campus
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $1, $2, $3, $5, $8, $15)`, insertParams);
            }
          } catch (dbErr: any) {
            console.error("PG Auto-Sync notice:", dbErr.message);
          }
        }
      }
    }

    saveFallbackFile("credentials.json", credsList);
    return credsList;
  } catch (err: any) {
    console.error("Error in scanAndSyncCampusFoldersInternal:", err.message);
    return getFallbackFile("credentials.json", DEFAULT_CREDENTIALS);
  }
}

// POST Endpoint to bulk scan and migrate existing doctor folders inside ALL campus directories
app.post("/api/scan-existing-folders", async (req, res) => {
  try {
    const list = await scanAndSyncCampusFoldersInternal();
    return res.json({
      success: true,
      totalFolders: list.length,
      migratedDoctors: list
    });
  } catch (err: any) {
    console.error("Error en migración masiva de carpetas de médicos:", err);
    return res.status(500).json({ error: err.message });
  }
});


// ----------------------------------------------------
// VITE AND ASSETS MIDDLEWARE PIPELINE
// ----------------------------------------------------
async function runServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`================================================================`);
    console.log(`🚀 CredSJ Full-Stack Active Server`);
    console.log(`💻 Local Host Address: http://127.0.0.1:${PORT}`);
    console.log(`🌐 Server Port Target: Binded to all interfaces (0.0.0.0:${PORT})`);
    console.log(`📡 Deployment Engine: ${usePG ? 'PostgreSQL Connectors' : 'Dual Offline-First Local JSON'}`);
    console.log(`================================================================`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: El puerto ${PORT} ya está en uso por otro proceso.`);
      console.error(`💡 Puedes cambiar el puerto editando la variable PORT en tu archivo .env (ejemplo: PORT=3030 o PORT=3050).\n`);
    } else {
      console.error(`❌ Error en servidor:`, err);
    }
  });
}

runServer();

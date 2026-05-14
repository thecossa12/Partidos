/*
  Restauracion segura de una copia de seguridad.
  Uso:
    node scripts/restore-backup.js --file backups/backup-YYYYMMDD-HHmmss.json --force
    node scripts/restore-backup.js --latest-archive --force

  Requiere:
    MONGO_URI

  Opcional:
    DB_NAME (default: volleyball)

  Seguridad:
    - No restaura nada si falta --force.
    - Hace un borrado completo de las colecciones afectadas antes de reimportar.
*/

const fs = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'volleyball';
const COLLECTIONS = ['users', 'equipos', 'jugadores', 'jornadas', 'config', 'audit_logs'];

function required(name, value) {
  if (!value || !String(value).trim()) {
    throw new Error(`Falta variable requerida: ${name}`);
  }
}

function stripMongoInternalFields(value) {
  if (Array.isArray(value)) return value.map(stripMongoInternalFields);
  if (!value || typeof value !== 'object') return value;
  const cleaned = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (key === '_id') continue;
    cleaned[key] = stripMongoInternalFields(fieldValue);
  }
  return cleaned;
}

function parseArgs(argv) {
  const args = { force: false, file: null, latestArchive: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--force') {
      args.force = true;
    } else if (arg === '--latest-archive') {
      args.latestArchive = true;
    } else if (arg === '--file') {
      args.file = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function loadBackupFromFile(filePath) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`No existe el archivo de backup: ${absolutePath}`);
  }
  const raw = fs.readFileSync(absolutePath, 'utf8');
  return JSON.parse(raw);
}

async function loadLatestArchive(db) {
  const doc = await db.collection('backups_archive')
    .find({})
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();

  if (!doc.length) {
    throw new Error('No hay backups archivados en MongoDB');
  }

  return doc[0].data;
}

function normalizeBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('El backup no tiene una estructura valida');
  }

  if (payload.data) {
    return payload.data;
  }

  // Permite restaurar un objeto plano con colecciones directamente.
  return payload;
}

async function main() {
  required('MONGO_URI', MONGO_URI);

  const args = parseArgs(process.argv);
  if (!args.force) {
    throw new Error('Debes usar --force para ejecutar una restauracion real');
  }

  if (!args.file && !args.latestArchive) {
    throw new Error('Debes indicar --file <ruta> o --latest-archive');
  }

  const client = new MongoClient(MONGO_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    let backupPayload;
    if (args.latestArchive) {
      backupPayload = await loadLatestArchive(db);
    } else {
      backupPayload = loadBackupFromFile(args.file);
    }

    const data = normalizeBackupPayload(backupPayload);

    const summary = {};
    for (const collectionName of COLLECTIONS) {
      const docs = Array.isArray(data[collectionName]) ? data[collectionName] : [];
      summary[collectionName] = docs.length;
    }

    console.log('PREVIEW restore summary:', summary);

    // Vaciar colecciones antes de reimportar.
    for (const collectionName of COLLECTIONS) {
      await db.collection(collectionName).deleteMany({});
    }

    // Reimportar datos.
    for (const collectionName of COLLECTIONS) {
      const docs = Array.isArray(data[collectionName]) ? data[collectionName].map(stripMongoInternalFields) : [];
      if (docs.length > 0) {
        await db.collection(collectionName).insertMany(docs, { ordered: false });
      }
    }

    console.log('OK restore completado:', summary);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('FAIL restore-backup:', error.message);
  process.exit(1);
});

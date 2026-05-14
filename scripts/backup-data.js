/*
  Backup de datos de produccion/comercial.
  Uso:
    node scripts/backup-data.js

  Requiere:
    MONGO_URI

  Salida:
    backups/backup-YYYYMMDD-HHmmss.json
*/

const fs = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'volleyball';
const BACKUP_STORE_MODE = String(process.env.BACKUP_STORE_MODE || 'file').toLowerCase();

function required(name, value) {
  if (!value || !String(value).trim()) {
    throw new Error(`Falta variable requerida: ${name}`);
  }
}

function timestampForFile() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function stripMongoInternalFields(value) {
  if (Array.isArray(value)) {
    return value.map(stripMongoInternalFields);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const cleaned = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (key === '_id') continue;
    cleaned[key] = stripMongoInternalFields(fieldValue);
  }
  return cleaned;
}

async function main() {
  required('MONGO_URI', MONGO_URI);

  const client = new MongoClient(MONGO_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });

  const collections = ['users', 'equipos', 'jugadores', 'jornadas', 'config', 'audit_logs'];

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const data = {};
    for (const name of collections) {
      const docs = await db.collection(name).find({}).toArray();
      data[name] = stripMongoInternalFields(docs);
    }

    const payload = {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      dbName: DB_NAME,
      collections,
      counts: Object.fromEntries(collections.map(name => [name, data[name].length])),
      data
    };

    const shouldWriteFile = BACKUP_STORE_MODE === 'file' || BACKUP_STORE_MODE === 'both';
    const shouldWriteMongo = BACKUP_STORE_MODE === 'mongo' || BACKUP_STORE_MODE === 'both';

    if (shouldWriteFile) {
      const outputPath = path.join(backupDir, `backup-${timestampForFile()}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
      console.log('OK backup file generado:', outputPath);
    }

    if (shouldWriteMongo) {
      await db.collection('backups_archive').insertOne({
        createdAt: new Date().toISOString(),
        schemaVersion: payload.schemaVersion,
        exportedAt: payload.exportedAt,
        dbName: payload.dbName,
        collections: payload.collections,
        counts: payload.counts,
        data: payload.data
      });
      console.log('OK backup archivado en MongoDB (backups_archive)');
    }

    console.log('Conteos:', payload.counts);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('FAIL backup:', error.message);
  process.exit(1);
});

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'volleyball';
const BACKUP_STORE_MODE = String(process.env.BACKUP_STORE_MODE || 'mongo').toLowerCase();
const AUDIT_RETENTION_DAYS = Math.max(parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10), 1);
const BACKUP_ARCHIVE_RETENTION_DAYS = Math.max(parseInt(process.env.BACKUP_ARCHIVE_RETENTION_DAYS || '120', 10), 1);

function required(name, value) {
  if (!value || !String(value).trim()) {
    throw new Error(`Falta variable requerida: ${name}`);
  }
}

function cutoffIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
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

async function runBackup(db) {
  const collections = ['users', 'equipos', 'jugadores', 'jornadas', 'config', 'audit_logs'];
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

  const mode = BACKUP_STORE_MODE;
  const toFile = mode === 'file' || mode === 'both';
  const toMongo = mode === 'mongo' || mode === 'both';

  if (toFile) {
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const filePath = path.join(backupDir, `backup-${timestampForFile()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    console.log('OK backup file generado:', filePath);
  }

  if (toMongo) {
    await db.collection('backups_archive').insertOne({
      createdAt: new Date().toISOString(),
      schemaVersion: payload.schemaVersion,
      exportedAt: payload.exportedAt,
      dbName: payload.dbName,
      collections: payload.collections,
      counts: payload.counts,
      data: payload.data
    });
    console.log('OK backup archivado en MongoDB');
  }
}

async function cleanupArchive(db) {
  const cutoff = cutoffIso(BACKUP_ARCHIVE_RETENTION_DAYS);
  const col = db.collection('backups_archive');
  await col.createIndex({ createdAt: 1 });
  const result = await col.deleteMany({ createdAt: { $lt: cutoff } });
  console.log(`OK cleanup backups_archive: ${result.deletedCount}`);
}

async function cleanupAudit(db) {
  const cutoff = cutoffIso(AUDIT_RETENTION_DAYS);
  const col = db.collection('audit_logs');
  await col.createIndex({ timestamp: 1 });
  const result = await col.deleteMany({ timestamp: { $lt: cutoff } });
  console.log(`OK cleanup audit_logs: ${result.deletedCount}`);
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

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    await runBackup(db);
    await cleanupArchive(db);
    await cleanupAudit(db);

    console.log('OK cron-daily completado');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('FAIL cron-daily:', error.message);
  process.exit(1);
});

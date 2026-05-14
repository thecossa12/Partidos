/*
  Limpieza de backups archivados en Mongo por retencion.
  Uso:
    node scripts/cleanup-backup-archive.js

  Requiere:
    MONGO_URI

  Variables opcionales:
    DB_NAME                       (default: volleyball)
    BACKUP_ARCHIVE_RETENTION_DAYS (default: 120)
*/

const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'volleyball';
const RETENTION_DAYS = Math.max(parseInt(process.env.BACKUP_ARCHIVE_RETENTION_DAYS || '120', 10), 1);

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

async function main() {
  required('MONGO_URI', MONGO_URI);

  const client = new MongoClient(MONGO_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });

  const cutoff = cutoffIso(RETENTION_DAYS);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('backups_archive');

    await collection.createIndex({ createdAt: 1 });

    const result = await collection.deleteMany({ createdAt: { $lt: cutoff } });

    console.log(`OK: cleanup backups_archive completado. deleted=${result.deletedCount}, retention_days=${RETENTION_DAYS}, cutoff=${cutoff}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('FAIL cleanup-backup-archive:', error.message);
  process.exit(1);
});

/*
  Limpieza de audit logs por retencion.
  Uso:
    node scripts/cleanup-audit-logs.js

  Requiere:
    MONGO_URI

  Variables opcionales:
    DB_NAME             (default: volleyball)
    AUDIT_RETENTION_DAYS (default: 90)
*/

const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'volleyball';
const RETENTION_DAYS = Math.max(parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10), 1);

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
    const collection = db.collection('audit_logs');

    await collection.createIndex({ timestamp: 1 });

    const result = await collection.deleteMany({ timestamp: { $lt: cutoff } });

    console.log(`OK: cleanup audit_logs completado. deleted=${result.deletedCount}, retention_days=${RETENTION_DAYS}, cutoff=${cutoff}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('FAIL cleanup-audit-logs:', error.message);
  process.exit(1);
});

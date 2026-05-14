/*
  Rotacion de backups locales.
  Uso:
    node scripts/rotate-backups.js

  Variables opcionales:
    BACKUP_RETENTION_DAYS (default: 30)
    BACKUP_MIN_KEEP       (default: 7)
*/

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const RETENTION_DAYS = Math.max(parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10), 1);
const MIN_KEEP = Math.max(parseInt(process.env.BACKUP_MIN_KEEP || '7', 10), 1);
const BACKUP_DIR = path.join(process.cwd(), 'backups');

function isBackupFile(fileName) {
  return /^backup-\d{8}-\d{6}\.json$/i.test(fileName);
}

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function main() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('OK: no existe carpeta backups, nada que rotar');
    return;
  }

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(isBackupFile)
    .map(name => {
      const fullPath = path.join(BACKUP_DIR, name);
      const stats = fs.statSync(fullPath);
      return { name, fullPath, mtime: stats.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (files.length <= MIN_KEEP) {
    console.log(`OK: backups totales ${files.length}, no se elimina nada (min_keep=${MIN_KEEP})`);
    return;
  }

  const now = new Date();
  let deleted = 0;

  files.forEach((file, index) => {
    if (index < MIN_KEEP) return;

    const ageDays = daysBetween(now, file.mtime);
    if (ageDays >= RETENTION_DAYS) {
      fs.unlinkSync(file.fullPath);
      deleted += 1;
      console.log(`DEL: ${file.name} (${ageDays} dias)`);
    }
  });

  console.log(`OK: rotacion completada. eliminados=${deleted}, retention_days=${RETENTION_DAYS}, min_keep=${MIN_KEEP}`);
}

try {
  main();
} catch (error) {
  console.error('FAIL rotate-backups:', error.message);
  process.exit(1);
}

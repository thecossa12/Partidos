/*
  Auditoria y reparacion masiva para todos los usuarios.
  Usa scripts/repair-user-data.js para cada usuario.

  Uso:
    node scripts/repair-all-users.js           (audit dry-run de todos)
    node scripts/repair-all-users.js --apply   (aplica reparaciones necesarias)
*/

require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const { execSync } = require('child_process');

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function runRepair(user, apply) {
  const applyFlag = apply ? ' --apply' : '';
  const cmd = `node scripts/repair-user-data.js --user "${String(user).replace(/"/g, '')}"${applyFlag}`;
  const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const marker = out.indexOf('{\n  "mode"');
  const start = marker !== -1 ? marker : out.indexOf('{"mode"');
  const end = out.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No se pudo parsear JSON para user=${user}`);
  }
  const jsonText = out.slice(start, end + 1);
  return JSON.parse(jsonText);
}

async function main() {
  const apply = hasFlag('apply');
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('Falta MONGO_URI');

  const dbName = process.env.DB_NAME || 'volleyball';
  const client = new MongoClient(mongoUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });

  await client.connect();
  let users = [];
  try {
    const db = client.db(dbName);
    users = await db.collection('users').find({}, { projection: { _id: 0, username: 1 } }).toArray();
  } finally {
    await client.close();
  }

  const usernames = Array.from(new Set(users.map((u) => String(u.username || '').trim()).filter(Boolean))).sort();

  const report = [];
  for (const username of usernames) {
    const dry = runRepair(username, false);
    const hasActions =
      (dry.actions?.deleteEquiposCount || 0) > 0 ||
      (dry.actions?.deleteJugadorasCount || 0) > 0 ||
      (dry.actions?.deleteJornadasCount || 0) > 0 ||
      (dry.actions?.markJornadasCompletedCount || 0) > 0;

    let applied = null;
    if (apply && hasActions) {
      applied = runRepair(username, true);
    }

    report.push({
      user: username,
      dryRun: dry,
      applied
    });
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    usersTotal: report.length,
    usersWithIssues: report.filter((r) => {
      const a = r.dryRun.actions || {};
      return (a.deleteEquiposCount || 0) + (a.deleteJornadasCount || 0) + (a.markJornadasCompletedCount || 0) > 0;
    }).length,
    totalActionsPlanned: report.reduce((acc, r) => {
      const a = r.dryRun.actions || {};
      acc.deleteEquipos += a.deleteEquiposCount || 0;
      acc.deleteJugadoras += a.deleteJugadorasCount || 0;
      acc.deleteJornadas += a.deleteJornadasCount || 0;
      acc.markJornadasCompleted += a.markJornadasCompletedCount || 0;
      return acc;
    }, { deleteEquipos: 0, deleteJugadoras: 0, deleteJornadas: 0, markJornadasCompleted: 0 }),
    totalActionsApplied: report.reduce((acc, r) => {
      const a = r.applied?.actions || {};
      acc.deleteEquipos += a.deleteEquiposCount || 0;
      acc.deleteJugadoras += a.deleteJugadorasCount || 0;
      acc.deleteJornadas += a.deleteJornadasCount || 0;
      acc.markJornadasCompleted += a.markJornadasCompletedCount || 0;
      return acc;
    }, { deleteEquipos: 0, deleteJugadoras: 0, deleteJornadas: 0, markJornadasCompleted: 0 }),
    users: report.map((r) => ({
      user: r.user,
      dryRunActions: r.dryRun.actions,
      before: r.dryRun.before,
      afterIfApplied: r.applied ? r.applied.after : null
    }))
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('FAIL repair-all-users:', error.message);
  process.exit(1);
});

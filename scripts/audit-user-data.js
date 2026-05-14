/*
  Auditoria de datos por usuario (solo lectura).
  Uso:
    node scripts/audit-user-data.js --user Christian
*/

require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function normalizeId(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function buildDuplicateSummary(docs) {
  const counts = new Map();
  for (const doc of docs || []) {
    const key = normalizeId(doc && doc.id);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

function pickSample(arr, limit = 10) {
  return (arr || []).slice(0, limit);
}

async function main() {
  const userId = getArg('user');
  if (!userId) {
    throw new Error('Falta --user <username>');
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('Falta MONGO_URI en entorno');
  }

  const dbName = process.env.DB_NAME || 'volleyball';

  const client = new MongoClient(mongoUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });

  await client.connect();
  try {
    const db = client.db(dbName);

    const [equipos, jugadoras, jornadas] = await Promise.all([
      db.collection('equipos').find({ userId }).toArray(),
      db.collection('jugadores').find({ userId }).toArray(),
      db.collection('jornadas').find({ userId }).toArray()
    ]);

    const validEquipoIds = new Set(
      equipos
        .map((e) => normalizeId(e && e.id))
        .filter(Boolean)
    );

    const invalidEquipos = equipos.filter((e) => {
      const id = normalizeId(e && e.id);
      const nombre = normalizeId(e && e.nombre).toLowerCase();
      return !id || !nombre || nombre === 'undefined' || nombre === 'null';
    });

    const nestedEquiposDocs = equipos.filter((e) => Array.isArray(e && e.equipos) && e.equipos.length > 0);

    const orphanJugadoras = jugadoras.filter((j) => {
      const eq = normalizeId(j && j.equipoId);
      return eq && !validEquipoIds.has(eq);
    });

    const orphanJornadas = jornadas.filter((j) => {
      const eq = normalizeId(j && j.equipoId);
      return eq && !validEquipoIds.has(eq);
    });

    const jornadasCompletadas = jornadas.filter((j) => !!(j && j.completada));

    const byTeam = Array.from(validEquipoIds)
      .map((equipoId) => {
        const equipo = equipos.find((e) => normalizeId(e && e.id) === equipoId);
        const jugCount = jugadoras.filter((j) => normalizeId(j && j.equipoId) === equipoId).length;
        const jor = jornadas.filter((j) => normalizeId(j && j.equipoId) === equipoId);
        const jorCount = jor.length;
        const jorCompletadas = jor.filter((j) => !!(j && j.completada)).length;
        return {
          equipoId,
          nombre: equipo && equipo.nombre ? String(equipo.nombre) : '(sin nombre)',
          jugadoras: jugCount,
          jornadas: jorCount,
          jornadasCompletadas: jorCompletadas
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const report = {
      generatedAt: new Date().toISOString(),
      userId,
      dbName,
      totals: {
        equipos: equipos.length,
        jugadoras: jugadoras.length,
        jornadas: jornadas.length,
        jornadasCompletadas: jornadasCompletadas.length
      },
      duplicates: {
        equiposById: buildDuplicateSummary(equipos),
        jugadorasById: buildDuplicateSummary(jugadoras),
        jornadasById: buildDuplicateSummary(jornadas)
      },
      integrity: {
        invalidEquiposCount: invalidEquipos.length,
        orphanJugadorasCount: orphanJugadoras.length,
        orphanJornadasCount: orphanJornadas.length,
        nestedEquiposDocsCount: nestedEquiposDocs.length
      },
      samples: {
        invalidEquipos: pickSample(invalidEquipos).map((e) => ({ id: e.id, nombre: e.nombre })),
        orphanJugadoras: pickSample(orphanJugadoras).map((j) => ({ id: j.id, nombre: j.nombre, equipoId: j.equipoId })),
        orphanJornadas: pickSample(orphanJornadas).map((j) => ({ id: j.id, fechaLunes: j.fechaLunes, equipoId: j.equipoId, completada: !!j.completada })),
        nestedEquiposDocs: pickSample(nestedEquiposDocs).map((d) => ({ id: d.id, nombre: d.nombre, nestedCount: Array.isArray(d.equipos) ? d.equipos.length : 0 }))
      },
      byTeam
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('FAIL audit-user-data:', error.message);
  process.exit(1);
});

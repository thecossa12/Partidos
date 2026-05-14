/*
  Reparacion de datos por usuario.
  - Deduplica equipos por id
  - Elimina equipos invalidos/vacios
  - Deduplica jornadas por id (prioriza completada=true)
  - Marca como completadas las jornadas incompletas antiguas, dejando solo la mas reciente pendiente por equipo

  Uso:
    node scripts/repair-user-data.js --user Christian          (dry-run)
    node scripts/repair-user-data.js --user Christian --apply  (aplica cambios)
*/

require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function safeString(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function parseDate(v) {
  const t = Date.parse(v || '');
  return Number.isFinite(t) ? t : 0;
}

function qualityScore(doc) {
  if (!doc || typeof doc !== 'object') return 0;
  let score = 0;
  for (const [k, v] of Object.entries(doc)) {
    if (k === '_id') continue;
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && !v.trim()) continue;
    score += 1;
  }
  return score;
}

function chooseBestEquipo(docs) {
  return docs.slice().sort((a, b) => {
    const q = qualityScore(b) - qualityScore(a);
    if (q !== 0) return q;
    const u = parseDate(b.updatedAt) - parseDate(a.updatedAt);
    if (u !== 0) return u;
    const c = parseDate(b.createdAt) - parseDate(a.createdAt);
    if (c !== 0) return c;
    return String(b._id).localeCompare(String(a._id));
  })[0];
}

function chooseBestJornada(docs) {
  return docs.slice().sort((a, b) => {
    const completed = (b.completada ? 1 : 0) - (a.completada ? 1 : 0);
    if (completed !== 0) return completed;
    const u = parseDate(b.updatedAt) - parseDate(a.updatedAt);
    if (u !== 0) return u;
    const c = parseDate(b.createdAt) - parseDate(a.createdAt);
    if (c !== 0) return c;
    return String(b._id).localeCompare(String(a._id));
  })[0];
}

async function main() {
  const userId = getArg('user');
  const apply = hasFlag('apply');

  if (!userId) throw new Error('Falta --user <username>');
  if (!process.env.MONGO_URI) throw new Error('Falta MONGO_URI');

  const dbName = process.env.DB_NAME || 'volleyball';

  const client = new MongoClient(process.env.MONGO_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });

  await client.connect();
  try {
    const db = client.db(dbName);
    const equiposCol = db.collection('equipos');
    const jugadorasCol = db.collection('jugadores');
    const jornadasCol = db.collection('jornadas');

    const [equiposBefore, jugadorasBefore, jornadasBefore] = await Promise.all([
      equiposCol.find({ userId }).toArray(),
      jugadorasCol.find({ userId }).toArray(),
      jornadasCol.find({ userId }).toArray()
    ]);

    const actions = {
      deleteEquiposById: [],
      deleteJugadorasById: [],
      deleteJornadasById: [],
      setJornadasCompletadasTrueById: []
    };

    // 1) Equipos invalidos o contenedores legacy (equipos[] anidado sin id real)
    const invalidEquipos = equiposBefore.filter((e) => {
      const id = safeString(e && e.id);
      const nombre = safeString(e && e.nombre).toLowerCase();
      const legacyContainer = Array.isArray(e && e.equipos) && e.equipos.length > 0 && !id;
      const invalidName = !nombre || nombre === 'undefined' || nombre === 'null';
      return !id || invalidName || legacyContainer;
    });

    invalidEquipos.forEach((e) => actions.deleteEquiposById.push(String(e._id)));

    // 2) Deduplicar equipos por id, preservando el mejor documento
    const equiposValid = equiposBefore.filter((e) => !actions.deleteEquiposById.includes(String(e._id)));
    const equiposById = new Map();
    for (const e of equiposValid) {
      const key = safeString(e.id);
      if (!key) continue;
      if (!equiposById.has(key)) equiposById.set(key, []);
      equiposById.get(key).push(e);
    }

    for (const [, docs] of equiposById.entries()) {
      if (docs.length <= 1) continue;
      const best = chooseBestEquipo(docs);
      docs.forEach((d) => {
        if (String(d._id) !== String(best._id)) {
          actions.deleteEquiposById.push(String(d._id));
        }
      });
    }

    // 2b) Jugadoras invalidas o duplicadas por id
    const invalidJugadoras = jugadorasBefore.filter((j) => {
      const id = safeString(j && j.id);
      const nombre = safeString(j && j.nombre).toLowerCase();
      return !id || !nombre || nombre === 'undefined' || nombre === 'null';
    });

    invalidJugadoras.forEach((j) => actions.deleteJugadorasById.push(String(j._id)));

    const jugadorasValid = jugadorasBefore.filter((j) => !actions.deleteJugadorasById.includes(String(j._id)));
    const jugadorasById = new Map();
    for (const j of jugadorasValid) {
      const key = safeString(j.id);
      if (!key) continue;
      if (!jugadorasById.has(key)) jugadorasById.set(key, []);
      jugadorasById.get(key).push(j);
    }

    for (const [, docs] of jugadorasById.entries()) {
      if (docs.length <= 1) continue;
      const best = chooseBestEquipo(docs);
      docs.forEach((d) => {
        if (String(d._id) !== String(best._id)) {
          actions.deleteJugadorasById.push(String(d._id));
        }
      });
    }

    // 3) Deduplicar jornadas por id, priorizando completadas
    const jornadasById = new Map();
    for (const j of jornadasBefore) {
      const key = safeString(j.id);
      if (!key) continue;
      if (!jornadasById.has(key)) jornadasById.set(key, []);
      jornadasById.get(key).push(j);
    }

    const jornadasKept = [];
    for (const [, docs] of jornadasById.entries()) {
      if (docs.length === 1) {
        jornadasKept.push(docs[0]);
        continue;
      }
      const best = chooseBestJornada(docs);
      jornadasKept.push(best);
      docs.forEach((d) => {
        if (String(d._id) !== String(best._id)) {
          actions.deleteJornadasById.push(String(d._id));
        }
      });
    }

    // 4) Dejar solo una jornada incompleta por equipo (la mas reciente por fechaLunes)
    const byEquipo = new Map();
    for (const j of jornadasKept) {
      const eq = safeString(j.equipoId);
      if (!byEquipo.has(eq)) byEquipo.set(eq, []);
      byEquipo.get(eq).push(j);
    }

    for (const [, list] of byEquipo.entries()) {
      const incompletas = list
        .filter((j) => !j.completada)
        .sort((a, b) => parseDate(b.fechaLunes) - parseDate(a.fechaLunes));

      if (incompletas.length <= 1) continue;

      // Mantener la mas reciente incompleta, cerrar el resto
      incompletas.slice(1).forEach((j) => {
        actions.setJornadasCompletadasTrueById.push(String(j._id));
      });
    }

    // Deduplicar ids de acciones
    actions.deleteEquiposById = Array.from(new Set(actions.deleteEquiposById));
    actions.deleteJugadorasById = Array.from(new Set(actions.deleteJugadorasById));
    actions.deleteJornadasById = Array.from(new Set(actions.deleteJornadasById));
    actions.setJornadasCompletadasTrueById = Array.from(new Set(actions.setJornadasCompletadasTrueById));

    if (apply) {
      if (actions.deleteEquiposById.length > 0) {
        await equiposCol.deleteMany({ _id: { $in: actions.deleteEquiposById.map((id) => new ObjectId(id)) } });
      }

      if (actions.deleteJugadorasById.length > 0) {
        await jugadorasCol.deleteMany({ _id: { $in: actions.deleteJugadorasById.map((id) => new ObjectId(id)) } });
      }

      if (actions.deleteJornadasById.length > 0) {
        await jornadasCol.deleteMany({ _id: { $in: actions.deleteJornadasById.map((id) => new ObjectId(id)) } });
      }

      if (actions.setJornadasCompletadasTrueById.length > 0) {
        await jornadasCol.updateMany(
          { _id: { $in: actions.setJornadasCompletadasTrueById.map((id) => new ObjectId(id)) } },
          { $set: { completada: true, updatedAt: new Date().toISOString() } }
        );
      }
    }

    const [equiposAfter, jugadorasAfter, jornadasAfter] = apply
      ? await Promise.all([
          equiposCol.find({ userId }).toArray(),
          jugadorasCol.find({ userId }).toArray(),
          jornadasCol.find({ userId }).toArray()
        ])
      : [equiposBefore, jugadorasBefore, jornadasBefore];

    const summary = {
      mode: apply ? 'apply' : 'dry-run',
      userId,
      actions: {
        deleteEquiposCount: actions.deleteEquiposById.length,
        deleteJugadorasCount: actions.deleteJugadorasById.length,
        deleteJornadasCount: actions.deleteJornadasById.length,
        markJornadasCompletedCount: actions.setJornadasCompletadasTrueById.length
      },
      before: {
        equipos: equiposBefore.length,
        jugadoras: jugadorasBefore.length,
        jornadas: jornadasBefore.length,
        jornadasCompletadas: jornadasBefore.filter((j) => !!j.completada).length
      },
      after: {
        equipos: equiposAfter.length,
        jugadoras: jugadorasAfter.length,
        jornadas: jornadasAfter.length,
        jornadasCompletadas: jornadasAfter.filter((j) => !!j.completada).length
      }
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('FAIL repair-user-data:', error.message);
  process.exit(1);
});

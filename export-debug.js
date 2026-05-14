require('dotenv').config();
const { MongoClient } = require('mongodb');
(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'volleyball');
  const user = 'Christian';

  const equipos = await db.collection('equipos')
    .find({ userId: user })
    .project({ _id: 0, id: 1, nombre: 1, createdAt: 1, updatedAt: 1 })
    .toArray();

  const jugPorEq = await db.collection('jugadores').aggregate([
    { $match: { userId: user } },
    { $group: { _id: '$equipoId', c: { $sum: 1 } } }
  ]).toArray();

  const jorPorEq = await db.collection('jornadas').aggregate([
    { $match: { userId: user } },
    { $group: { _id: '$equipoId', c: { $sum: 1 }, comp: { $sum: { $cond: ['$completada', 1, 0] } } } }
  ]).toArray();

  console.log('EQUIPOS=', JSON.stringify(equipos, null, 2));
  console.log('JUG_POR_EQ=', JSON.stringify(jugPorEq, null, 2));
  console.log('JOR_POR_EQ=', JSON.stringify(jorPorEq, null, 2));

  await client.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

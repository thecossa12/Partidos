const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { connectDB } = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Ruta raíz - redirigir a login (ANTES de servir archivos estáticos)
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.use(express.static(__dirname)); // Servir archivos estáticos desde la raíz

let db;

// Conectar a MongoDB al iniciar el servidor
connectDB().then(database => {
    db = database;
    console.log('✅ Base de datos conectada');
}).catch(err => {
    console.error('❌ Error conectando a la base de datos:', err);
    process.exit(1);
});

// ==================== ENDPOINTS DE EQUIPOS ====================

// Obtener todos los equipos de un usuario
app.get('/api/equipos', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        const equipos = await db.collection('equipos').find({ userId }).toArray();
        res.json(equipos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear/Actualizar un equipo
app.post('/api/equipos', async (req, res) => {
    try {
        const equipo = req.body;
        
        if (!equipo.userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        if (!equipo.id) {
            return res.status(400).json({ error: 'id es requerido' });
        }
        
        // Usar updateOne con upsert para evitar duplicados
        const result = await db.collection('equipos').updateOne(
            { id: equipo.id, userId: equipo.userId },
            { $set: equipo },
            { upsert: true }
        );
        
        res.json({ success: true, equipo });
    } catch (error) {
        console.error('Error guardando equipo:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar un equipo
app.put('/api/equipos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const equipo = req.body;
        const userId = req.query.userId;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        await db.collection('equipos').updateOne(
            { id, userId },
            { $set: equipo }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar un equipo y todos sus datos asociados
app.delete('/api/equipos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.query.userId;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        console.log(`🗑️ Eliminando equipo ${id} del usuario ${userId}`);
        
        // Convertir ID a diferentes formatos para buscar
        const idNumber = parseInt(id);
        const idString = String(id);
        
        // Eliminar equipos directos (varios formatos de ID)
        const result1 = await db.collection('equipos').deleteMany({ 
            userId,
            $or: [
                { id: idString },
                { id: idNumber },
                { 'equipos.id': idString },
                { 'equipos.id': idNumber }
            ]
        });
        
        console.log(`✅ Equipos eliminados: ${result1.deletedCount}`);
        
        // Eliminar también documentos que contengan el equipo anidado
        const result2 = await db.collection('equipos').updateMany(
            { userId },
            { $pull: { equipos: { id: { $in: [idString, idNumber] } } } }
        );
        
        console.log(`✅ Equipos anidados eliminados: ${result2.modifiedCount}`);
        
        // Eliminar jugadores del equipo
        const result3 = await db.collection('jugadores').deleteMany({ 
            userId,
            $or: [
                { equipoId: idString },
                { equipoId: idNumber }
            ]
        });
        
        console.log(`✅ Jugadores eliminados: ${result3.deletedCount}`);
        
        // Eliminar jornadas del equipo
        const result4 = await db.collection('jornadas').deleteMany({ 
            userId,
            $or: [
                { equipoId: idString },
                { equipoId: idNumber }
            ]
        });
        
        console.log(`✅ Jornadas eliminadas: ${result4.deletedCount}`);
        
        res.json({ 
            success: true,
            deletedEquipos: result1.deletedCount + result2.modifiedCount,
            deletedJugadores: result3.deletedCount,
            deletedJornadas: result4.deletedCount
        });
    } catch (error) {
        console.error('Error eliminando equipo:', error);
        res.status(500).json({ error: error.message });
    }
});

// Limpiar todos los equipos de un usuario (para reorganización)
app.delete('/api/equipos/cleanup', async (req, res) => {
    try {
        const userId = req.query.userId;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        console.log(`🧹 Limpiando todos los equipos del usuario ${userId}`);
        
        const result = await db.collection('equipos').deleteMany({ userId });
        
        console.log(`✅ ${result.deletedCount} documentos de equipos eliminados`);
        
        res.json({ success: true, deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Error limpiando equipos:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== ENDPOINTS DE JUGADORES ====================

// Obtener todos los jugadores (filtrados por usuario)
app.get('/api/jugadores', async (req, res) => {
    try {
        const userId = req.query.userId;
        const equipoId = req.query.equipoId;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        const filter = { userId };
        if (equipoId) {
            filter.equipoId = equipoId;
        }
        
        const jugadores = await db.collection('jugadores').find(filter).toArray();
        res.json(jugadores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear un jugador
app.post('/api/jugadores', async (req, res) => {
    try {
        const jugador = req.body;
        
        if (!jugador.userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        const result = await db.collection('jugadores').insertOne(jugador);
        res.json({ ...jugador, _id: result.insertedId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar un jugador
app.put('/api/jugadores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const jugador = req.body;
        const userId = req.query.userId;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        await db.collection('jugadores').updateOne(
            { id: parseInt(id), userId },
            { $set: jugador }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar un jugador
app.delete('/api/jugadores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.query.userId;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        await db.collection('jugadores').deleteOne({ id: parseInt(id), userId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ENDPOINTS DE JORNADAS ====================

// Obtener todas las jornadas (filtradas por usuario y opcionalmente por equipo)
app.get('/api/jornadas', async (req, res) => {
    try {
        const userId = req.query.userId;
        const equipoId = req.query.equipoId;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        const filter = { userId };
        if (equipoId) {
            filter.equipoId = equipoId;
        }
        
        const jornadas = await db.collection('jornadas').find(filter).toArray();
        res.json(jornadas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear una jornada
app.post('/api/jornadas', async (req, res) => {
    try {
        const jornada = req.body;
        
        if (!jornada.userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        const result = await db.collection('jornadas').insertOne(jornada);
        res.json({ ...jornada, _id: result.insertedId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar una jornada
app.put('/api/jornadas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const jornada = req.body;
        const userId = req.query.userId;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        await db.collection('jornadas').updateOne(
            { id: parseInt(id), userId },
            { $set: jornada }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar una jornada
app.delete('/api/jornadas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.query.userId;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        await db.collection('jornadas').deleteOne({ id: parseInt(id), userId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar múltiples jornadas
app.post('/api/jornadas/delete-multiple', async (req, res) => {
    try {
        const { ids, userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        await db.collection('jornadas').deleteMany({ 
            id: { $in: ids.map(id => parseInt(id)) },
            userId
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ENDPOINTS DE USUARIOS ====================

// Obtener todos los usuarios
app.get('/api/users', async (req, res) => {
    try {
        const users = await db.collection('users').find({}).toArray();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear usuario
app.post('/api/users', async (req, res) => {
    try {
        const user = req.body;
        
        // Verificar si el usuario ya existe
        const existingUser = await db.collection('users').findOne({ username: user.username });
        if (existingUser) {
            return res.status(400).json({ error: 'El usuario ya existe' });
        }
        
        const newUser = {
            ...user,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
        
        const result = await db.collection('users').insertOne(newUser);
        res.json({ success: true, user: { ...newUser, _id: result.insertedId } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login (verificar credenciales)
app.post('/api/users/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await db.collection('users').findOne({ username });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        if (user.password !== password) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }
        
        // Actualizar último login
        await db.collection('users').updateOne(
            { username },
            { $set: { lastLogin: new Date().toISOString() } }
        );
        
        res.json({ success: true, user: { username: user.username, name: user.name, isAdmin: user.isAdmin } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ENDPOINT DE SINCRONIZACIÓN ====================

// Sincronización completa (usa upsert para actualizar o insertar)
app.post('/api/sync', async (req, res) => {
    try {
        const { jugadores, jornadas, equipos, userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        let jugadoresCount = 0;
        let jornadasCount = 0;
        let equiposCount = 0;
        
        // Sincronizar equipos usando bulkWrite con upsert
        if (equipos && equipos.length > 0) {
            const equiposOperations = equipos.map(equipo => {
                const { _id, ...equipoSinMongoId } = equipo;
                
                return {
                    updateOne: {
                        filter: { id: equipo.id, userId },
                        update: { $set: { ...equipoSinMongoId, userId } },
                        upsert: true
                    }
                };
            });
            
            const resultEquipos = await db.collection('equipos').bulkWrite(equiposOperations);
            equiposCount = resultEquipos.upsertedCount + resultEquipos.modifiedCount;
        }
        
        // Sincronizar jugadores usando bulkWrite con upsert
        if (jugadores && jugadores.length > 0) {
            const jugadoresOperations = jugadores.map(jugador => {
                // Eliminar _id de MongoDB si existe para evitar conflictos
                const { _id, ...jugadorSinMongoId } = jugador;
                
                return {
                    updateOne: {
                        filter: { id: jugador.id, userId },
                        update: { $set: { ...jugadorSinMongoId, userId } },
                        upsert: true
                    }
                };
            });
            
            const resultJugadores = await db.collection('jugadores').bulkWrite(jugadoresOperations);
            jugadoresCount = resultJugadores.upsertedCount + resultJugadores.modifiedCount;
        }
        
        // Sincronizar jornadas usando bulkWrite con upsert
        if (jornadas && jornadas.length > 0) {
            const jornadasOperations = jornadas.map(jornada => {
                // Eliminar _id de MongoDB si existe para evitar conflictos
                const { _id, ...jornadaSinMongoId } = jornada;
                
                return {
                    updateOne: {
                        filter: { id: jornada.id, userId },
                        update: { $set: { ...jornadaSinMongoId, userId } },
                        upsert: true
                    }
                };
            });
            
            const resultJornadas = await db.collection('jornadas').bulkWrite(jornadasOperations);
            jornadasCount = resultJornadas.upsertedCount + resultJornadas.modifiedCount;
        }
        
        res.json({ 
            success: true,
            equiposCount: equipos?.length || 0,
            jugadoresCount: jugadores?.length || 0,
            jornadasCount: jornadas?.length || 0
        });
    } catch (error) {
        console.error('Error en sync:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== ENDPOINTS DE CONFIGURACIÓN ====================

// Obtener configuración del usuario
app.get('/api/config', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        const config = await db.collection('config').findOne({ userId });
        
        // Si no existe, devolver configuración por defecto
        if (!config) {
            return res.json({
                polideportivoCasa: '',
                ubicacionesGuardadas: [],
                rivalesGuardados: []
            });
        }
        
        res.json({
            polideportivoCasa: config.polideportivoCasa || '',
            ubicacionesGuardadas: config.ubicacionesGuardadas || [],
            rivalesGuardados: config.rivalesGuardados || []
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Guardar/actualizar configuración del usuario
app.post('/api/config', async (req, res) => {
    try {
        const { userId, polideportivoCasa, ubicacionesGuardadas, rivalesGuardados } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        const configData = {
            userId,
            polideportivoCasa: polideportivoCasa || '',
            ubicacionesGuardadas: ubicacionesGuardadas || [],
            rivalesGuardados: rivalesGuardados || [],
            updatedAt: new Date().toISOString()
        };
        
        // Usar upsert para actualizar o insertar
        await db.collection('config').updateOne(
            { userId },
            { $set: configData },
            { upsert: true }
        );
        
        res.json({ success: true, config: configData });
    } catch (error) {
        console.error('Error guardando config:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== ENDPOINT DE MIGRACIÓN ====================

// Migrar datos de localStorage a MongoDB
app.post('/api/migrate', async (req, res) => {
    try {
        const { jugadores, jornadas, userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        // Agregar userId a todos los jugadores
        const jugadoresConUserId = jugadores?.map(j => ({ ...j, userId })) || [];
        
        // Agregar userId a todas las jornadas
        const jornadasConUserId = jornadas?.map(j => ({ ...j, userId })) || [];
        
        // Insertar jugadores si hay
        if (jugadoresConUserId.length > 0) {
            await db.collection('jugadores').insertMany(jugadoresConUserId);
        }
        
        // Insertar jornadas si hay
        if (jornadasConUserId.length > 0) {
            await db.collection('jornadas').insertMany(jornadasConUserId);
        }
        
        res.json({ 
            success: true, 
            jugadoresCount: jugadoresConUserId.length,
            jornadasCount: jornadasConUserId.length,
            userId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📱 Abrir en: http://localhost:${PORT}`);
});

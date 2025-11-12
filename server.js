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

// ==================== ENDPOINTS DE JUGADORES ====================

// Obtener todos los jugadores (filtrados por usuario)
app.get('/api/jugadores', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        const jugadores = await db.collection('jugadores').find({ userId }).toArray();
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

// Obtener todas las jornadas (filtradas por usuario)
app.get('/api/jornadas', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        const jornadas = await db.collection('jornadas').find({ userId }).toArray();
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
        const { jugadores, jornadas, userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        let jugadoresCount = 0;
        let jornadasCount = 0;
        
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
            jugadoresCount: jugadores?.length || 0,
            jornadasCount: jornadas?.length || 0
        });
    } catch (error) {
        console.error('Error en sync:', error);
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

// Ruta raíz - redirigir a login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📱 Abrir en: http://localhost:${PORT}`);
});

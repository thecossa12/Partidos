const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectDB } = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-jwt-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const AUTH_MODE = process.env.AUTH_MODE || 'compat';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
const ALLOW_BOOTSTRAP = typeof process.env.ALLOW_BOOTSTRAP !== 'undefined'
    ? String(process.env.ALLOW_BOOTSTRAP).toLowerCase() === 'true'
    : !IS_PRODUCTION;
const BOOTSTRAP_TOKEN = process.env.BOOTSTRAP_TOKEN || '';

if (IS_PRODUCTION) {
    const hasJwtSecret = typeof process.env.JWT_SECRET === 'string' && process.env.JWT_SECRET.trim().length >= 32;
    if (!hasJwtSecret || process.env.JWT_SECRET.includes('change-me')) {
        console.error('❌ Configuración insegura: JWT_SECRET es obligatorio en producción y debe tener al menos 32 caracteres.');
        process.exit(1);
    }

    if (AUTH_MODE !== 'strict') {
        console.error('❌ Configuración insegura: AUTH_MODE debe ser strict en producción.');
        process.exit(1);
    }
}

// Railway/proxies: necesario para que express-rate-limit use X-Forwarded-For correctamente.
// Valores válidos por env: TRUST_PROXY=true | false | <número de saltos>
if (typeof process.env.TRUST_PROXY !== 'undefined') {
    const raw = String(process.env.TRUST_PROXY).trim().toLowerCase();
    if (raw === 'true') {
        app.set('trust proxy', 1);
    } else if (raw === 'false') {
        app.set('trust proxy', false);
    } else {
        const hops = Number(raw);
        app.set('trust proxy', Number.isFinite(hops) ? hops : 1);
    }
} else if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

function normalizeOrigin(value) {
    if (!value) return '';
    return String(value).trim().replace(/\/$/, '').toLowerCase();
}

function isBcryptHash(value) {
    return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

function signUserToken(user) {
    return jwt.sign(
        {
            sub: user.username,
            name: user.name,
            isAdmin: !!user.isAdmin
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function handleInternalError(res, error, context = 'server') {
    if (error) {
        console.error(`❌ Error interno [${context}]:`, error);
    }
    return res.status(500).json({ error: 'Error interno del servidor' });
}

function stripMongoInternalFields(value) {
    if (Array.isArray(value)) {
        return value.map(item => stripMongoInternalFields(item));
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    const cleaned = {};
    for (const [key, fieldValue] of Object.entries(value)) {
        if (key === '_id') continue;
        cleaned[key] = stripMongoInternalFields(fieldValue);
    }
    return cleaned;
}

function sanitizeText(value, maxLength = 120) {
    if (value === undefined || value === null) return '';
    return String(value).trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function isValidUsername(username) {
    return /^[a-zA-Z0-9._-]{3,40}$/.test(String(username || ''));
}

function isStrongPassword(password) {
    return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}

async function writeAuditLog(eventType, req, details = {}) {
    const entry = {
        eventType,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl,
        userId: req.authUser?.sub || req.body?.userId || req.query?.userId || null,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
        details
    };

    console.log('📘 AUDIT', JSON.stringify(entry));

    if (!db) return;

    try {
        await db.collection('audit_logs').insertOne(entry);
    } catch (error) {
        console.warn('⚠️ No se pudo guardar audit log en MongoDB:', error.message);
    }
}


// ==================== HTTPS OBLIGATORIO EN PRODUCCIÓN ====================
if (IS_PRODUCTION) {
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
            // Redirigir a HTTPS
            return res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
        }
        if (!req.secure && (!req.headers['x-forwarded-proto'] || req.headers['x-forwarded-proto'] !== 'https')) {
            // Mostrar advertencia si no es seguro
            return res.status(400).send('⚠️ El acceso a este servicio debe realizarse siempre por HTTPS.');
        }
        next();
    });
}
// ==================== SEGURIDAD ====================

// Headers de seguridad HTTP
app.use(helmet({
    contentSecurityPolicy: false // Desactivado para no romper los assets inline existentes
}));

// CORS:
// - Si ALLOWED_ORIGINS está definido, se aplica lista blanca.
// - Si no está definido, se permite el origen recibido para evitar bloqueos
//   en despliegues cloud con mismo dominio.
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(item => normalizeOrigin(item)).filter(Boolean)
    : null;

app.use(cors({
    origin: function (origin, callback) {
        // Permitir peticiones sin origen (mismo servidor / curl en desarrollo)
        if (!origin) return callback(null, true);

        const normalizedOrigin = normalizeOrigin(origin);

        // Sin lista blanca explícita, permitir origen recibido (modo flexible).
        if (!allowedOrigins) return callback(null, true);

        if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);

        // No lanzar excepción aquí para evitar respuesta HTML 500.
        console.warn('⚠️ Origen bloqueado por CORS:', origin);
        return callback(null, false);
    },
    credentials: true
}));

// Rate limiting para el endpoint de login (máx 10 intentos por 15 min)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Demasiados intentos de login. Inténtalo de nuevo en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiting general para toda la API
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { error: 'Demasiadas peticiones. Inténtalo más tarde.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Middleware
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));
app.use('/api', apiLimiter);

app.use('/api', (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        writeAuditLog('api_access', req, {
            statusCode: res.statusCode,
            durationMs: Date.now() - start
        });
    });
    next();
});

// Auth de API:
// - compat: acepta cliente legacy sin token, pero si hay token lo valida y fuerza userId
// - strict: exige token JWT en todas las rutas /api excepto login
app.use('/api', (req, res, next) => {
    const publicPaths = new Set(['/users/login', '/health', '/health/ready']);
    if (publicPaths.has(req.path)) {
        return next();
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const strictMode = AUTH_MODE === 'strict';

    if (!token) {
        if (strictMode) {
            return res.status(401).json({ error: 'Token de autenticación requerido' });
        }
        return next();
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (!payload || !payload.sub) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        req.authUser = payload;
        const tokenUserId = String(payload.sub);

        const queryUserId = req.query && req.query.userId ? String(req.query.userId) : null;
        const bodyUserId = req.body && req.body.userId ? String(req.body.userId) : null;

        if ((queryUserId && queryUserId !== tokenUserId) || (bodyUserId && bodyUserId !== tokenUserId)) {
            return res.status(403).json({ error: 'No autorizado para operar sobre otro usuario' });
        }

        if (req.query) {
            req.query.userId = tokenUserId;
        }
        if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
            req.body.userId = tokenUserId;
        }

        return next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
});

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

// ==================== HEALTHCHECKS ====================

// Liveness: proceso vivo
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'partidos-api',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// Readiness: proceso + acceso a DB
app.get('/api/health/ready', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({
                status: 'error',
                ready: false,
                reason: 'db_not_initialized',
                timestamp: new Date().toISOString()
            });
        }

        await db.command({ ping: 1 });
        return res.json({
            status: 'ok',
            ready: true,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return res.status(503).json({
            status: 'error',
            ready: false,
            reason: 'db_unreachable',
            timestamp: new Date().toISOString()
        });
    }
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
        handleInternalError(res, error);
    }
});

// Crear/Actualizar un equipo
app.post('/api/equipos', async (req, res) => {
    try {
        const equipo = req.body;

        equipo.nombre = sanitizeText(equipo.nombre, 120);
        
        console.log('📥 POST /api/equipos - Recibiendo:', JSON.stringify(equipo));
        
        if (!equipo.userId) {
            console.error('❌ Error: userId faltante');
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        if (!equipo.id) {
            console.error('❌ Error: id faltante');
            return res.status(400).json({ error: 'id es requerido' });
        }
        
        if (!equipo.nombre || equipo.nombre === 'undefined') {
            console.error('❌ Error: nombre inválido');
            return res.status(400).json({ error: 'nombre es requerido y debe ser válido' });
        }
        
        // Verificar conexión a MongoDB
        if (!db) {
            console.error('❌ Error: MongoDB no conectado');
            return res.status(503).json({ error: 'Base de datos no disponible' });
        }
        
        // Crear copia del equipo SIN el campo _id para evitar error de MongoDB
        const { _id, ...equipoSinId } = equipo;
        
        // Usar updateOne con upsert para evitar duplicados
        const result = await db.collection('equipos').updateOne(
            { id: equipo.id, userId: equipo.userId },
            { $set: equipoSinId },
            { upsert: true }
        );
        
        console.log('✅ Equipo guardado:', result.upsertedCount > 0 ? 'nuevo' : 'actualizado');
        res.json({ success: true, equipo: equipoSinId });
    } catch (error) {
        console.error('❌ Error guardando equipo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
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
        handleInternalError(res, error);
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
        handleInternalError(res, error);
    }
});

// Endpoint para limpiar equipos inválidos (undefined, null, sin nombre)
app.delete('/api/equipos/cleanup-invalid', async (req, res) => {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        console.log('🧹 Limpiando equipos inválidos para userId:', userId);
        
        // Eliminar equipos con nombre undefined, null, vacío o sin ID
        const result = await db.collection('equipos').deleteMany({
            userId: userId,
            $or: [
                { nombre: { $in: [null, 'undefined', '', 'null'] } },
                { id: { $in: [null, 'undefined', ''] } },
                { id: { $exists: false } },
                { nombre: { $exists: false } }
            ]
        });
        
        console.log('✅ Equipos inválidos eliminados:', result.deletedCount);
        
        res.json({ 
            success: true, 
            deletedCount: result.deletedCount,
            message: `${result.deletedCount} equipos inválidos eliminados`
        });
    } catch (error) {
        console.error('❌ Error limpiando equipos inválidos:', error);
        handleInternalError(res, error);
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
        handleInternalError(res, error);
    }
});

// ==================== ENDPOINTS DE JUGADORES ====================

// Obtener todos los jugadores (filtrados por usuario)
app.get('/api/jugadores', async (req, res) => {
    try {
        const userId = req.query.userId;
        let equipoId = req.query.equipoId;

        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }

        const filter = { userId };
        if (equipoId) {
            // Convertir a número si es numérico
            equipoId = isNaN(equipoId) ? equipoId : parseInt(equipoId);
            // Buscar tanto como string como número
            filter.$or = [
                { equipoId: equipoId },
                { equipoId: String(equipoId) },
                { equipoId: parseInt(equipoId) }
            ];
        }

        const jugadores = await db.collection('jugadores').find(filter).toArray();
        console.log(`📥 GET /api/jugadores - userId: ${userId}, equipoId: ${equipoId}, encontrados: ${jugadores.length}`);
        res.json(jugadores);
    } catch (error) {
        console.error('❌ Error en GET /api/jugadores:', error);
        handleInternalError(res, error);
    }
});

// Crear o actualizar un jugador/a
app.post('/api/jugadores', async (req, res) => {
    try {
        const jugador = req.body; // jugador/a

        jugador.nombre = sanitizeText(jugador.nombre, 120);
        jugador.posicion = sanitizeText(jugador.posicion, 60);

        if (!jugador.userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }

        if (!jugador.id) {
            return res.status(400).json({ error: 'id es requerido' });
        }

        if (!jugador.nombre) {
            return res.status(400).json({ error: 'nombre es requerido' });
        }
        
        // Asegurar que equipoId sea número
        if (jugador.equipoId && !isNaN(jugador.equipoId)) {
            jugador.equipoId = parseInt(jugador.equipoId);
        }
        
        // Usar updateOne con upsert para crear o actualizar
        const result = await db.collection('jugadores').updateOne(
            { id: jugador.id, userId: jugador.userId },
            { $set: jugador },
            { upsert: true }
        );
        
        console.log(`${result.upsertedCount > 0 ? '✅ Jugador/a creado' : '🔄 Jugador/a actualizado'}: ${jugador.nombre}`);
        res.json({ success: true, created: result.upsertedCount > 0, jugador: jugador });
    } catch (error) {
        console.error('❌ Error en POST /api/jugadores:', error);
        handleInternalError(res, error);
    }
});

// Actualizar un jugador/a
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
        handleInternalError(res, error);
    }
});

// Eliminar un jugador/a
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
        handleInternalError(res, error);
    }
});

// ==================== ENDPOINTS DE JORNADAS ====================

// Obtener todas las jornadas (filtradas por usuario y opcionalmente por equipo)
app.get('/api/jornadas', async (req, res) => {
    try {
        const userId = req.query.userId;
        let equipoId = req.query.equipoId;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }
        
        const filter = { userId };
        if (equipoId) {
            // Convertir a número si es numérico
            equipoId = isNaN(equipoId) ? equipoId : parseInt(equipoId);
            // Buscar tanto como string como número
            filter.$or = [
                { equipoId: equipoId },
                { equipoId: String(equipoId) },
                { equipoId: parseInt(equipoId) }
            ];
        }
        
        const jornadas = await db.collection('jornadas').find(filter).toArray();
        console.log(`📥 GET /api/jornadas - userId: ${userId}, equipoId: ${equipoId}, encontradas: ${jornadas.length}`);
        res.json(jornadas);
    } catch (error) {
        console.error('❌ Error en GET /api/jornadas:', error);
        handleInternalError(res, error);
    }
});

// Crear una jornada
app.post('/api/jornadas', async (req, res) => {
    try {
        const jornada = req.body;

        jornada.rival = sanitizeText(jornada.rival, 120);
        jornada.ubicacion = sanitizeText(jornada.ubicacion, 200);
        jornada.nombreEquipo = sanitizeText(jornada.nombreEquipo, 120);
        
        if (!jornada.userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }

        if (!jornada.id) {
            return res.status(400).json({ error: 'id es requerido' });
        }
        
        // Normalizar equipoId a número si existe
        if (jornada.equipoId) {
            jornada.equipoId = parseInt(jornada.equipoId);
        }
        
        // Usar upsert para crear o actualizar
        const result = await db.collection('jornadas').updateOne(
            { id: jornada.id, userId: jornada.userId },
            { $set: jornada },
            { upsert: true }
        );
        
        console.log(`📅 Jornada ${result.upsertedCount > 0 ? 'creada' : 'actualizada'}:`, jornada.id);
        res.json({ ...jornada, _id: result.upsertedId });
    } catch (error) {
        handleInternalError(res, error);
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
        handleInternalError(res, error);
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
        handleInternalError(res, error);
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
        handleInternalError(res, error);
    }
});

// ==================== ENDPOINTS DE USUARIOS ====================

// Obtener todos los usuarios (sin exponer contraseñas)
app.get('/api/users', async (req, res) => {
    try {
        if (!req.authUser || !req.authUser.isAdmin) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Crear o actualizar usuario
app.post('/api/users', async (req, res) => {
    try {
        const user = req.body;
        user.username = sanitizeText(user.username, 40);
        user.name = sanitizeText(user.name, 120);

        // Solo admin autenticado puede crear/editar usuarios,
        // excepto bootstrap inicial cuando aún no existe ningún usuario y está permitido.
        const usersCount = await db.collection('users').countDocuments();
        const isBootstrapCandidate = usersCount === 0;
        const isAdminRequest = !!(req.authUser && req.authUser.isAdmin);
        const bootstrapHeader = String(req.headers['x-bootstrap-token'] || '');
        const bootstrapByToken = !!(BOOTSTRAP_TOKEN && bootstrapHeader && bootstrapHeader === BOOTSTRAP_TOKEN);
        const canBootstrap = isBootstrapCandidate && (ALLOW_BOOTSTRAP || bootstrapByToken);

        if (!canBootstrap && !isAdminRequest) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        if (!user.username) {
            return res.status(400).json({ error: 'El username es requerido' });
        }

        if (!isValidUsername(user.username)) {
            return res.status(400).json({ error: 'Username inválido. Usa 3-40 caracteres: letras, números, punto, guion o guion bajo.' });
        }
        
        // Verificar si el usuario ya existe
        const existingUser = await db.collection('users').findOne({ username: user.username });

        // Normalizar contraseña para soportar entradas numéricas desde el panel admin.
        const normalizedPassword = user.password === undefined || user.password === null
            ? ''
            : String(user.password);

        if (!existingUser && !normalizedPassword) {
            return res.status(400).json({ error: 'La contraseña es requerida para crear el usuario' });
        }

        if (normalizedPassword && !isStrongPassword(normalizedPassword)) {
            return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 128 caracteres.' });
        }

        // Hash de contraseña (compatibilidad: si no se envía nueva, conserva la existente)
        let passwordToStore = existingUser?.password || null;
        if (normalizedPassword.length > 0) {
            passwordToStore = await bcrypt.hash(normalizedPassword, 12);
        }

        const userData = {
            username: user.username,
            password: passwordToStore,
            name: user.name,
            isAdmin: canBootstrap ? true : !!user.isAdmin,
            lastLogin: existingUser?.lastLogin || null
        };
        
        // Si es nuevo, agregar createdAt
        if (!existingUser) {
            userData.createdAt = new Date().toISOString();
        } else {
            userData.createdAt = existingUser.createdAt;
        }
        
        // Usar updateOne con upsert para crear o actualizar
        const result = await db.collection('users').updateOne(
            { username: user.username },
            { $set: userData },
            { upsert: true }
        );
        
        console.log(`${result.upsertedCount > 0 ? '✅ Usuario creado' : '🔄 Usuario actualizado'}:`, user.username);
        await writeAuditLog('user_upsert', req, {
            targetUsername: user.username,
            created: result.upsertedCount > 0,
            byAdmin: !!req.authUser?.isAdmin
        });
        // No devolver la contraseña en la respuesta
        const { password: _pw, ...userSinPassword } = userData;
        res.json({ 
            success: true, 
            user: userSinPassword,
            created: result.upsertedCount > 0
        });
    } catch (error) {
        console.error('❌ Error en POST /api/users:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Login (verificar credenciales) — con rate limiting
app.post('/api/users/login', loginLimiter, async (req, res) => {
    try {
        const username = sanitizeText(req.body?.username, 40);
        const password = typeof req.body?.password === 'string' ? req.body.password : '';

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        }

        if (!isValidUsername(username)) {
            return res.status(400).json({ error: 'Formato de usuario inválido' });
        }

        if (password.length > 128) {
            return res.status(400).json({ error: 'Contraseña inválida' });
        }
        
        const user = await db.collection('users').findOne({ username });

        // Mensaje genérico para no revelar si el usuario existe
        if (!user || !user.password) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        let isValidPassword = false;

        // Compatibilidad hacia atrás: soportar contraseñas legacy en texto plano
        if (isBcryptHash(user.password)) {
            isValidPassword = await bcrypt.compare(password, user.password);
        } else {
            isValidPassword = user.password === password;

            // Migración automática a hash al primer login correcto
            if (isValidPassword) {
                const hashedPassword = await bcrypt.hash(password, 12);
                await db.collection('users').updateOne(
                    { username },
                    { $set: { password: hashedPassword } }
                );
                user.password = hashedPassword;
            }
        }

        if (!isValidPassword) {
            await writeAuditLog('login_failed', req, { username });
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        
        // Actualizar último login
        await db.collection('users').updateOne(
            { username },
            { $set: { lastLogin: new Date().toISOString() } }
        );

        const token = signUserToken(user);
        await writeAuditLog('login_success', req, { username, isAdmin: !!user.isAdmin });
        
        res.json({
            success: true,
            token,
            expiresIn: JWT_EXPIRES_IN,
            user: { username: user.username, name: user.name, isAdmin: user.isAdmin }
        });
    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Consulta de auditoría para soporte/compliance (solo admin)
app.get('/api/admin/audit-logs', async (req, res) => {
    try {
        if (!req.authUser || !req.authUser.isAdmin) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const limit = Math.min(Math.max(parseInt(req.query.limit || '100', 10), 1), 500);
        const eventType = sanitizeText(req.query.eventType || '', 80);
        const targetUserId = sanitizeText(req.query.userId || '', 80);

        const filter = {};
        if (eventType) filter.eventType = eventType;
        if (targetUserId) filter.userId = targetUserId;

        const logs = await db.collection('audit_logs')
            .find(filter)
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();

        res.json(stripMongoInternalFields(logs));
    } catch (error) {
        return handleInternalError(res, error, 'audit-logs-list');
    }
});

// Exportación GDPR completa de datos de un usuario.
app.get('/api/users/:username/export', async (req, res) => {
    try {
        const { username } = req.params;

        if (!req.authUser) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const isSelf = req.authUser.sub === username;
        const isAdmin = !!req.authUser.isAdmin;
        if (!isSelf && !isAdmin) {
            return res.status(403).json({ error: 'No autorizado para exportar los datos de este usuario' });
        }

        await writeAuditLog('user_export_requested', req, {
            targetUsername: username,
            requestedBy: req.authUser.sub
        });

        const [userDoc, equipos, jugadoras, jornadas, configDoc] = await Promise.all([
            db.collection('users').findOne(
                { username },
                { projection: { _id: 0, password: 0 } }
            ),
            db.collection('equipos').find({ userId: username }).toArray(),
            db.collection('jugadores').find({ userId: username }).toArray(),
            db.collection('jornadas').find({ userId: username }).toArray(),
            db.collection('config').findOne({ userId: username })
        ]);

        if (!userDoc) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const payload = {
            fechaExportacion: new Date().toISOString(),
            version: '2.0-gdpr',
            formato: 'application/json',
            titular: {
                username: userDoc.username,
                name: userDoc.name || '',
                isAdmin: !!userDoc.isAdmin,
                createdAt: userDoc.createdAt || null,
                lastLogin: userDoc.lastLogin || null
            },
            datos: {
                configuracion: stripMongoInternalFields(configDoc || {
                    userId: username,
                    polideportivoCasa: '',
                    ubicacionesGuardadas: [],
                    rivalesGuardados: []
                }),
                equipos: stripMongoInternalFields(equipos || []),
                jugadoras: stripMongoInternalFields(jugadoras || []),
                jornadas: stripMongoInternalFields(jornadas || [])
            },
            resumen: {
                totalEquipos: Array.isArray(equipos) ? equipos.length : 0,
                totalJugadoras: Array.isArray(jugadoras) ? jugadoras.length : 0,
                totalJornadas: Array.isArray(jornadas) ? jornadas.length : 0,
                totalJornadasCompletadas: Array.isArray(jornadas) ? jornadas.filter(j => !!j.completada).length : 0
            }
        };

        res.json(payload);
    } catch (error) {
        return handleInternalError(res, error, 'users-export');
    }
});

// El usuario autenticado puede borrar su propia cuenta. Un admin puede borrar cualquier usuario.
app.delete('/api/users/:username', async (req, res) => {
    try {
        const { username } = req.params;
        if (!req.authUser) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const isSelf = req.authUser.sub === username;
        const isAdmin = !!req.authUser.isAdmin;
        if (!isSelf && !isAdmin) {
            return res.status(403).json({ error: 'No autorizado para borrar este usuario' });
        }

        await writeAuditLog('user_delete_requested', req, {
            targetUsername: username,
            requestedBy: req.authUser.sub
        });

        const userResult = await db.collection('users').deleteOne({ username });
        const equiposResult = await db.collection('equipos').deleteMany({ userId: username });
        const jugadoresResult = await db.collection('jugadores').deleteMany({ userId: username });
        const jornadasResult = await db.collection('jornadas').deleteMany({ userId: username });

        res.json({
            success: true,
            deletedUser: userResult.deletedCount,
            deletedEquipos: equiposResult.deletedCount,
            deletedJugadores: jugadoresResult.deletedCount,
            deletedJornadas: jornadasResult.deletedCount
        });
    } catch (error) {
        console.error('❌ Error al borrar usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
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
                
                // Asegurar que equipoId sea número consistentemente
                if (jugadorSinMongoId.equipoId && !isNaN(jugadorSinMongoId.equipoId)) {
                    jugadorSinMongoId.equipoId = parseInt(jugadorSinMongoId.equipoId);
                }
                
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
            console.log(`☁️ Jugadores sincronizados: ${jugadoresCount}`);
        }
        
        // Sincronizar jornadas usando bulkWrite con upsert
        if (jornadas && jornadas.length > 0) {
            const jornadasOperations = jornadas.map(jornada => {
                // Eliminar _id de MongoDB si existe para evitar conflictos
                const { _id, ...jornadaSinMongoId } = jornada;
                
                // Asegurar que equipoId sea número consistentemente
                if (jornadaSinMongoId.equipoId && !isNaN(jornadaSinMongoId.equipoId)) {
                    jornadaSinMongoId.equipoId = parseInt(jornadaSinMongoId.equipoId);
                }
                
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
            console.log(`☁️ Jornadas sincronizadas: ${jornadasCount}`);
        }
        
        res.json({ 
            success: true,
            equiposCount: equipos?.length || 0,
            jugadoresCount: jugadores?.length || 0,
            jornadasCount: jornadas?.length || 0
        });
    } catch (error) {
        console.error('Error en sync:', error);
        handleInternalError(res, error);
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
        handleInternalError(res, error);
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
        handleInternalError(res, error);
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
        handleInternalError(res, error);
    }
});

// Manejo explícito para payload demasiado grande
app.use((err, req, res, next) => {
    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
        console.error('❌ Payload demasiado grande:', err.message);
        return res.status(413).json({
            error: 'Los datos a guardar son demasiado grandes. Reduce el tamaño de la jornada o divide el guardado.'
        });
    }

    return next(err);
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📱 Abrir en: http://localhost:${PORT}`);
});


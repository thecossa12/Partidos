const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { connectDB } = require('./db');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-jwt-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const AUTH_MODE = process.env.AUTH_MODE || 'compat';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
const MIN_PASSWORD_LENGTH = Number(process.env.MIN_PASSWORD_LENGTH || 8);
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

async function verifyPasswordAgainstStored(storedPassword, plainPassword) {
    if (!storedPassword || typeof plainPassword !== 'string') {
        return false;
    }

    if (isBcryptHash(storedPassword)) {
        return bcrypt.compare(plainPassword, storedPassword);
    }

    return storedPassword === plainPassword;
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
    return String(value)
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[<>]/g, '')
        .slice(0, maxLength);
}

function isValidUsername(username) {
    return /^[a-zA-Z0-9._-]{3,40}$/.test(String(username || ''));
}

function isStrongPassword(password) {
    return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH && password.length <= 128;
}

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}

function normalizeEntityId(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function parseIsoDate(value) {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
}

function getRequiredUserId(req, res, source = 'query') {
    const container = source === 'body' ? req.body : req.query;
    const userId = container?.userId;
    if (!userId) {
        res.status(400).json({ error: 'userId es requerido' });
        return null;
    }
    return String(userId);
}

function normalizeNumericValue(value) {
    if (value === undefined || value === null || value === '') return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
}

function buildFlexibleIdOrFilter(fieldName, rawValue) {
    const variants = new Set();
    const asString = String(rawValue);
    variants.add(asString);

    const asNumber = Number(rawValue);
    if (Number.isFinite(asNumber)) {
        variants.add(asNumber);
    }

    return { $or: Array.from(variants).map((variant) => ({ [fieldName]: variant })) };
}

function qualityScore(doc) {
    if (!doc || typeof doc !== 'object') return 0;

    let score = 0;
    for (const [key, value] of Object.entries(doc)) {
        if (key === '_id') continue;
        if (value === undefined || value === null) continue;
        if (typeof value === 'string' && !value.trim()) continue;
        score += 1;
    }

    return score;
}

function chooseBestDoc(docs, options = {}) {
    const { preferCompleted = false } = options;

    return (docs || []).slice().sort((a, b) => {
        if (preferCompleted) {
            const completedScore = (b?.completada ? 1 : 0) - (a?.completada ? 1 : 0);
            if (completedScore !== 0) return completedScore;
        }

        const qualityDiff = qualityScore(b) - qualityScore(a);
        if (qualityDiff !== 0) return qualityDiff;

        const updatedDiff = parseIsoDate(b?.updatedAt) - parseIsoDate(a?.updatedAt);
        if (updatedDiff !== 0) return updatedDiff;

        const createdDiff = parseIsoDate(b?.createdAt) - parseIsoDate(a?.createdAt);
        if (createdDiff !== 0) return createdDiff;

        return String(b?._id || '').localeCompare(String(a?._id || ''));
    })[0];
}

function countDuplicatesById(docs) {
    const counts = new Map();
    for (const doc of docs || []) {
        const key = normalizeEntityId(doc?.id);
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.values()).filter(count => count > 1).length;
}

async function runUserDataHealth(userId, applyChanges = false) {
    const [equiposBefore, jugadorasBefore, jornadasBefore] = await Promise.all([
        db.collection('equipos').find({ userId }).toArray(),
        db.collection('jugadores').find({ userId }).toArray(),
        db.collection('jornadas').find({ userId }).toArray()
    ]);

    const actions = {
        deleteEquiposIds: [],
        deleteJugadorasIds: [],
        deleteJornadasIds: [],
        markJornadasCompletedIds: []
    };

    const invalidEquipos = equiposBefore.filter((e) => {
        const id = normalizeEntityId(e?.id);
        const nombre = normalizeEntityId(e?.nombre).toLowerCase();
        const nestedLegacy = Array.isArray(e?.equipos) && e.equipos.length > 0 && !id;
        const invalidName = !nombre || nombre === 'undefined' || nombre === 'null';
        return !id || invalidName || nestedLegacy;
    });
    invalidEquipos.forEach((e) => actions.deleteEquiposIds.push(e._id));

    const validEquipos = equiposBefore.filter((e) => !actions.deleteEquiposIds.some(id => String(id) === String(e._id)));
    const equiposById = new Map();
    for (const equipo of validEquipos) {
        const key = normalizeEntityId(equipo?.id);
        if (!key) continue;
        if (!equiposById.has(key)) equiposById.set(key, []);
        equiposById.get(key).push(equipo);
    }
    for (const docs of equiposById.values()) {
        if (docs.length <= 1) continue;
        const best = chooseBestDoc(docs);
        docs.forEach((doc) => {
            if (String(doc._id) !== String(best._id)) actions.deleteEquiposIds.push(doc._id);
        });
    }

    const invalidJugadoras = jugadorasBefore.filter((j) => {
        const id = normalizeEntityId(j?.id);
        const nombre = normalizeEntityId(j?.nombre).toLowerCase();
        return !id || !nombre || nombre === 'undefined' || nombre === 'null';
    });
    invalidJugadoras.forEach((j) => actions.deleteJugadorasIds.push(j._id));

    const validJugadoras = jugadorasBefore.filter((j) => !actions.deleteJugadorasIds.some(id => String(id) === String(j._id)));
    const jugadorasById = new Map();
    for (const jugadora of validJugadoras) {
        const key = normalizeEntityId(jugadora?.id);
        if (!key) continue;
        if (!jugadorasById.has(key)) jugadorasById.set(key, []);
        jugadorasById.get(key).push(jugadora);
    }
    for (const docs of jugadorasById.values()) {
        if (docs.length <= 1) continue;
        const best = chooseBestDoc(docs);
        docs.forEach((doc) => {
            if (String(doc._id) !== String(best._id)) actions.deleteJugadorasIds.push(doc._id);
        });
    }

    const jornadasById = new Map();
    for (const jornada of jornadasBefore) {
        const key = normalizeEntityId(jornada?.id);
        if (!key) continue;
        if (!jornadasById.has(key)) jornadasById.set(key, []);
        jornadasById.get(key).push(jornada);
    }

    const jornadasKept = [];
    for (const docs of jornadasById.values()) {
        if (docs.length === 1) {
            jornadasKept.push(docs[0]);
            continue;
        }
        const best = chooseBestDoc(docs, { preferCompleted: true });
        jornadasKept.push(best);
        docs.forEach((doc) => {
            if (String(doc._id) !== String(best._id)) actions.deleteJornadasIds.push(doc._id);
        });
    }

    const jornadasByTeam = new Map();
    for (const jornada of jornadasKept) {
        const teamKey = normalizeEntityId(jornada?.equipoId);
        if (!jornadasByTeam.has(teamKey)) jornadasByTeam.set(teamKey, []);
        jornadasByTeam.get(teamKey).push(jornada);
    }

    for (const jornadas of jornadasByTeam.values()) {
        const incompletas = jornadas
            .filter((j) => !j?.completada)
            .sort((a, b) => parseIsoDate(b?.fechaLunes) - parseIsoDate(a?.fechaLunes));

        if (incompletas.length <= 1) continue;

        incompletas.slice(1).forEach((j) => {
            actions.markJornadasCompletedIds.push(j._id);
        });
    }

    actions.deleteEquiposIds = Array.from(new Set(actions.deleteEquiposIds.map(id => String(id))));
    actions.deleteJugadorasIds = Array.from(new Set(actions.deleteJugadorasIds.map(id => String(id))));
    actions.deleteJornadasIds = Array.from(new Set(actions.deleteJornadasIds.map(id => String(id))));
    actions.markJornadasCompletedIds = Array.from(new Set(actions.markJornadasCompletedIds.map(id => String(id))));

    if (applyChanges) {
        if (actions.deleteEquiposIds.length > 0) {
            await db.collection('equipos').deleteMany({ _id: { $in: actions.deleteEquiposIds.map(id => new ObjectId(id)) } });
        }
        if (actions.deleteJugadorasIds.length > 0) {
            await db.collection('jugadores').deleteMany({ _id: { $in: actions.deleteJugadorasIds.map(id => new ObjectId(id)) } });
        }
        if (actions.deleteJornadasIds.length > 0) {
            await db.collection('jornadas').deleteMany({ _id: { $in: actions.deleteJornadasIds.map(id => new ObjectId(id)) } });
        }
        if (actions.markJornadasCompletedIds.length > 0) {
            await db.collection('jornadas').updateMany(
                { _id: { $in: actions.markJornadasCompletedIds.map(id => new ObjectId(id)) } },
                { $set: { completada: true, updatedAt: new Date().toISOString() } }
            );
        }
    }

    const [equiposAfter, jugadorasAfter, jornadasAfter] = applyChanges
        ? await Promise.all([
            db.collection('equipos').find({ userId }).toArray(),
            db.collection('jugadores').find({ userId }).toArray(),
            db.collection('jornadas').find({ userId }).toArray()
        ])
        : [equiposBefore, jugadorasBefore, jornadasBefore];

    return {
        userId,
        actions: {
            deleteEquiposCount: actions.deleteEquiposIds.length,
            deleteJugadorasCount: actions.deleteJugadorasIds.length,
            deleteJornadasCount: actions.deleteJornadasIds.length,
            markJornadasCompletedCount: actions.markJornadasCompletedIds.length
        },
        before: {
            equipos: equiposBefore.length,
            jugadoras: jugadorasBefore.length,
            jornadas: jornadasBefore.length,
            jornadasCompletadas: jornadasBefore.filter(j => !!j.completada).length,
            duplicates: {
                equiposById: countDuplicatesById(equiposBefore),
                jugadorasById: countDuplicatesById(jugadorasBefore),
                jornadasById: countDuplicatesById(jornadasBefore)
            }
        },
        after: {
            equipos: equiposAfter.length,
            jugadoras: jugadorasAfter.length,
            jornadas: jornadasAfter.length,
            jornadasCompletadas: jornadasAfter.filter(j => !!j.completada).length,
            duplicates: {
                equiposById: countDuplicatesById(equiposAfter),
                jugadorasById: countDuplicatesById(jugadorasAfter),
                jornadasById: countDuplicatesById(jornadasAfter)
            }
        }
    };
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
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'none'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
            styleSrcElem: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
            fontSrc: ["'self'", 'data:', 'https://cdnjs.cloudflare.com'],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"]
        }
    },
    referrerPolicy: { policy: 'no-referrer' }
}));

// CORS:
// - Si ALLOWED_ORIGINS está definido, se aplica lista blanca.
// - Si no está definido, se permite el origen recibido para evitar bloqueos
//   en despliegues cloud con mismo dominio.
const configuredOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(item => normalizeOrigin(item)).filter(Boolean)
    : [];
const defaultDevOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const allowedOrigins = (IS_PRODUCTION ? configuredOrigins : configuredOrigins.concat(defaultDevOrigins));

app.use(cors({
    origin: function (origin, callback) {
        // Permitir peticiones sin origen (mismo servidor / curl en desarrollo)
        if (!origin) return callback(null, true);

        const normalizedOrigin = normalizeOrigin(origin);

        // En producción se exige lista blanca explícita.
        if (allowedOrigins.length === 0) {
            if (IS_PRODUCTION) {
                console.warn('⚠️ ALLOWED_ORIGINS no definido en producción. Se bloquean orígenes cross-site.');
                return callback(null, false);
            }
            return callback(null, true);
        }

        if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);

        // No lanzar excepción aquí para evitar respuesta HTML 500.
        console.warn('⚠️ Origen bloqueado por CORS:', origin);
        return callback(null, false);
    },
    credentials: true
}));

// Limitador progresivo para login.
// Penalización por fallo consecutivo: 10s, 30s, 1m, 2m, 3m...
// Se resetea al iniciar sesión correctamente.
const loginAttemptState = new Map();

function getLoginAttemptKey(req) {
    const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown').trim();
    const username = sanitizeText(req.body?.username, 40).toLowerCase() || 'unknown';
    return `${ip}::${username}`;
}

function getProgressiveLockMs(failureCount) {
    if (failureCount <= 1) return 10 * 1000; // 1er fallo: 10s
    if (failureCount === 2) return 30 * 1000; // 2do fallo: 30s
    if (failureCount === 3) return 60 * 1000; // 3er fallo: 1m
    const minutes = Math.min(failureCount - 2, 30); // 4to:2m, 5to:3m, etc.
    return minutes * 60 * 1000;
}

function pruneOldLoginAttemptState() {
    const now = Date.now();
    for (const [key, state] of loginAttemptState.entries()) {
        if (!state || !state.lockUntil || state.lockUntil < now - (24 * 60 * 60 * 1000)) {
            loginAttemptState.delete(key);
        }
    }
}

function registerLoginFailure(req) {
    const key = req.loginAttemptKey || getLoginAttemptKey(req);
    const previous = loginAttemptState.get(key) || { failures: 0, lockUntil: 0 };
    const failures = previous.failures + 1;
    const lockMs = getProgressiveLockMs(failures);
    const lockUntil = Date.now() + lockMs;
    loginAttemptState.set(key, { failures, lockUntil, updatedAt: Date.now() });
    return { failures, lockMs, lockUntil };
}

function clearLoginFailures(req) {
    const key = req.loginAttemptKey || getLoginAttemptKey(req);
    loginAttemptState.delete(key);
}

function loginLimiter(req, res, next) {
    pruneOldLoginAttemptState();

    const key = getLoginAttemptKey(req);
    req.loginAttemptKey = key;

    const state = loginAttemptState.get(key);
    if (!state || !state.lockUntil) {
        return next();
    }

    const now = Date.now();
    if (state.lockUntil <= now) {
        return next();
    }

    const waitSeconds = Math.max(1, Math.ceil((state.lockUntil - now) / 1000));
    return res.status(429).json({
        error: `Demasiados intentos de login. Espera ${waitSeconds} segundos.`,
        retryAfterSeconds: waitSeconds
    });
}

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
        const isAdminRequest = !!payload.isAdmin;

        const queryUserId = req.query && req.query.userId ? String(req.query.userId) : null;
        const bodyUserId = req.body && req.body.userId ? String(req.body.userId) : null;

        if (!isAdminRequest && ((queryUserId && queryUserId !== tokenUserId) || (bodyUserId && bodyUserId !== tokenUserId))) {
            return res.status(403).json({ error: 'No autorizado para operar sobre otro usuario' });
        }

        if (req.query && (!isAdminRequest || queryUserId)) {
            // Los admins pueden conservar un userId explícito para flujos de soporte.
            req.query.userId = isAdminRequest ? queryUserId : tokenUserId;
        }
        if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && (!isAdminRequest || bodyUserId)) {
            req.body.userId = isAdminRequest ? bodyUserId : tokenUserId;
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

// Evita exposición accidental de código fuente, scripts internos y backups.
app.use((req, res, next) => {
    const blockedPrefixes = ['/backups/', '/scripts/', '/railway/'];
    const blockedFiles = new Set(['/server.js', '/db.js']);

    if (blockedPrefixes.some(prefix => req.path.startsWith(prefix)) || blockedFiles.has(req.path)) {
        return res.status(404).json({ error: 'Recurso no encontrado' });
    }

    return next();
});

app.use(express.static(__dirname, {
    dotfiles: 'deny',
    index: false,
    extensions: ['html']
})); // Servir solo estáticos web públicos desde raíz

let db;

async function ensureDatabaseIndexes(database) {
    const indexJobs = [
        {
            collection: 'users',
            key: { username: 1 },
            options: { unique: true, name: 'uniq_username' }
        },
        {
            collection: 'equipos',
            key: { userId: 1, id: 1 },
            options: {
                unique: true,
                name: 'uniq_equipos_user_id',
                partialFilterExpression: { userId: { $exists: true }, id: { $exists: true } }
            }
        },
        {
            collection: 'jugadores',
            key: { userId: 1, id: 1 },
            options: {
                unique: true,
                name: 'uniq_jugadores_user_id',
                partialFilterExpression: { userId: { $exists: true }, id: { $exists: true } }
            }
        },
        {
            collection: 'jornadas',
            key: { userId: 1, id: 1 },
            options: {
                unique: true,
                name: 'uniq_jornadas_user_id',
                partialFilterExpression: { userId: { $exists: true }, id: { $exists: true } }
            }
        },
        {
            collection: 'audit_logs',
            key: { timestamp: -1 },
            options: { name: 'idx_audit_timestamp' }
        }
    ];

    for (const job of indexJobs) {
        try {
            await database.collection(job.collection).createIndex(job.key, job.options);
        } catch (error) {
            console.warn(`⚠️ No se pudo crear índice ${job.options.name}:`, error.message);
        }
    }
}

// Conectar a MongoDB al iniciar el servidor
connectDB().then(database => {
    db = database;
    ensureDatabaseIndexes(db).catch((error) => {
        console.warn('⚠️ Error creando índices recomendados:', error.message);
    });
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
        const userId = getRequiredUserId(req, res, 'query');
        if (!userId) return;
        
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
        const userId = getRequiredUserId(req, res, 'query');
        if (!userId) return;
        
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
        const userId = getRequiredUserId(req, res, 'query');
        if (!userId) return;
        
        console.log(`🗑️ Eliminando equipo ${id} del usuario ${userId}`);
        
        // Convertir ID a diferentes formatos para buscar
        const idNumber = Number(id);
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
        const userId = getRequiredUserId(req, res, 'query');
        if (!userId) return;
        
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
        const userId = getRequiredUserId(req, res, 'query');
        if (!userId) return;
        
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
        const userId = getRequiredUserId(req, res, 'query');
        if (!userId) return;
        const equipoId = req.query.equipoId;

        const filter = { userId };
        if (equipoId) {
            Object.assign(filter, buildFlexibleIdOrFilter('equipoId', equipoId));
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
        jugador.equipoId = normalizeNumericValue(jugador.equipoId);
        
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
        const userId = getRequiredUserId(req, res, 'query');
        if (!userId) return;
        
        await db.collection('jugadores').updateOne(
            { id: normalizeNumericValue(id), userId },
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
        const userId = getRequiredUserId(req, res, 'query');
        if (!userId) return;
        
        await db.collection('jugadores').deleteOne({ id: normalizeNumericValue(id), userId });
        res.json({ success: true });
    } catch (error) {
        handleInternalError(res, error);
    }
});

// ==================== ENDPOINTS DE JORNADAS ====================

// Obtener todas las jornadas (filtradas por usuario y opcionalmente por equipo)
app.get('/api/jornadas', async (req, res) => {
    try {
        const userId = getRequiredUserId(req, res, 'query');
        if (!userId) return;
        const equipoId = req.query.equipoId;
        
        const filter = { userId };
        if (equipoId) {
            Object.assign(filter, buildFlexibleIdOrFilter('equipoId', equipoId));
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
        jornada.equipoId = normalizeNumericValue(jornada.equipoId);
        
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
        const userId = getRequiredUserId(req, res, 'query');
        if (!userId) return;
        
        await db.collection('jornadas').updateOne(
            { id: normalizeNumericValue(id), userId },
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
        const userId = getRequiredUserId(req, res, 'query');
        if (!userId) return;
        
        await db.collection('jornadas').deleteOne({ id: normalizeNumericValue(id), userId });
        res.json({ success: true });
    } catch (error) {
        handleInternalError(res, error);
    }
});

// Eliminar múltiples jornadas
app.post('/api/jornadas/delete-multiple', async (req, res) => {
    try {
        const { ids } = req.body;
        const userId = getRequiredUserId(req, res, 'body');
        if (!userId) return;
        
        await db.collection('jornadas').deleteMany({ 
            id: { $in: ids.map(id => normalizeNumericValue(id)) },
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
            return res.status(400).json({ error: `La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y 128 caracteres.` });
        }

        // Hash de contraseña (compatibilidad: si no se envía nueva, conserva la existente)
        let passwordToStore = existingUser?.password || null;
        const passwordProvided = normalizedPassword.length > 0;
        if (normalizedPassword.length > 0) {
            passwordToStore = await bcrypt.hash(normalizedPassword, 12);
        }

        let mustChangePassword = !!existingUser?.mustChangePassword;
        let passwordChangedAt = existingUser?.passwordChangedAt || null;

        if (!existingUser && passwordProvided) {
            // Usuario nuevo creado por admin: contraseña inicial temporal.
            mustChangePassword = !canBootstrap;
            passwordChangedAt = canBootstrap ? new Date().toISOString() : null;
        } else if (existingUser && passwordProvided && isAdminRequest) {
            // Reset/cambio desde panel admin: forzar paso de primer inicio otra vez.
            mustChangePassword = true;
            passwordChangedAt = null;
        }

        const userData = {
            username: user.username,
            password: passwordToStore,
            name: user.name,
            isAdmin: canBootstrap ? true : !!user.isAdmin,
            lastLogin: existingUser?.lastLogin || null,
            mustChangePassword,
            passwordChangedAt
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
            const throttle = registerLoginFailure(req);
            return res.status(401).json({
                error: 'Usuario o contraseña incorrectos',
                retryAfterSeconds: Math.max(1, Math.ceil(throttle.lockMs / 1000))
            });
        }

        let isValidPassword = await verifyPasswordAgainstStored(user.password, password);

        // Compatibilidad hacia atrás: migrar texto plano a hash al primer login correcto
        if (isValidPassword && !isBcryptHash(user.password)) {
            const hashedPassword = await bcrypt.hash(password, 12);
            await db.collection('users').updateOne(
                { username },
                { $set: { password: hashedPassword } }
            );
            user.password = hashedPassword;
        }

        if (!isValidPassword) {
            const throttle = registerLoginFailure(req);
            await writeAuditLog('login_failed', req, { username });
            return res.status(401).json({
                error: 'Usuario o contraseña incorrectos',
                retryAfterSeconds: Math.max(1, Math.ceil(throttle.lockMs / 1000))
            });
        }

        clearLoginFailures(req);
        
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
            user: {
                username: user.username,
                name: user.name,
                isAdmin: user.isAdmin,
                mustChangePassword: !!user.mustChangePassword
            }
        });
    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Cambio de contraseña del usuario autenticado.
// Regla: si mustChangePassword=true, no pide contraseña actual.
app.post('/api/users/change-password', async (req, res) => {
    try {
        if (!req.authUser || !req.authUser.sub) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const username = sanitizeText(req.authUser.sub, 40);
        const oldPassword = typeof req.body?.oldPassword === 'string' ? req.body.oldPassword : '';
        const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({ error: `La nueva contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y 128 caracteres.` });
        }

        const user = await db.collection('users').findOne({ username });
        if (!user || !user.password) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const canSkipOldPassword = !!user.mustChangePassword;
        if (!canSkipOldPassword) {
            if (!oldPassword) {
                return res.status(400).json({ error: 'La contraseña actual es obligatoria.' });
            }

            const isOldPasswordValid = await verifyPasswordAgainstStored(user.password, oldPassword);
            if (!isOldPasswordValid) {
                await writeAuditLog('password_change_failed', req, {
                    username,
                    reason: 'old_password_invalid'
                });
                return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
            }
        }

        const newHashedPassword = await bcrypt.hash(newPassword, 12);
        await db.collection('users').updateOne(
            { username },
            {
                $set: {
                    password: newHashedPassword,
                    mustChangePassword: false,
                    passwordChangedAt: new Date().toISOString()
                }
            }
        );

        await writeAuditLog('password_change_success', req, {
            username,
            skippedOldPassword: canSkipOldPassword
        });

        return res.json({ success: true, mustChangePassword: false });
    } catch (error) {
        return handleInternalError(res, error, 'user-change-password');
    }
});

// Descarta el aviso de contraseña temporal sin cambiarla.
// El usuario decidió hacerlo más tarde; marcamos mustChangePassword=false
// para que no vuelva a aparecer hasta que el admin lo reestablezca.
app.post('/api/users/dismiss-password-reminder', async (req, res) => {
    try {
        if (!req.authUser || !req.authUser.sub) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        const username = sanitizeText(req.authUser.sub, 40);
        await db.collection('users').updateOne(
            { username },
            { $set: { mustChangePassword: false } }
        );
        return res.json({ success: true });
    } catch (error) {
        return handleInternalError(res, error, 'dismiss-password-reminder');
    }
});

// Reset de contraseña por admin para un usuario.
// Vuelve a marcar mustChangePassword=true para el siguiente login.
app.post('/api/users/:username/reset-password', async (req, res) => {
    try {
        if (!req.authUser || !req.authUser.isAdmin) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const targetUsername = sanitizeText(req.params.username, 40);
        const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

        if (!targetUsername) {
            return res.status(400).json({ error: 'Usuario objetivo inválido' });
        }

        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener entre 4 y 128 caracteres.' });
        }

        const targetUser = await db.collection('users').findOne({ username: targetUsername });
        if (!targetUser) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await db.collection('users').updateOne(
            { username: targetUsername },
            {
                $set: {
                    password: hashedPassword,
                    mustChangePassword: true,
                    passwordChangedAt: null,
                    lastPasswordResetAt: new Date().toISOString()
                }
            }
        );

        await writeAuditLog('admin_password_reset', req, {
            targetUsername,
            requestedBy: req.authUser.sub
        });

        return res.json({ success: true, mustChangePassword: true });
    } catch (error) {
        return handleInternalError(res, error, 'admin-reset-password');
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

// Auditoria/Reparacion de integridad de datos (solo admin)
app.post('/api/admin/data-health', async (req, res) => {
    try {
        if (!req.authUser || !req.authUser.isAdmin) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const apply = !!req.body?.apply;
        const targetUserId = sanitizeText(req.body?.userId || '', 80);

        let users = [];
        if (targetUserId) {
            users = [targetUserId];
        } else {
            const allUsers = await db.collection('users')
                .find({}, { projection: { _id: 0, username: 1 } })
                .toArray();
            users = Array.from(new Set(allUsers.map(u => sanitizeText(u.username || '', 80)).filter(Boolean))).sort();
        }

        const results = [];
        for (const userId of users) {
            const result = await runUserDataHealth(userId, apply);
            results.push(result);
        }

        const summary = {
            mode: apply ? 'apply' : 'dry-run',
            usersTotal: results.length,
            usersWithIssues: results.filter((r) => {
                const a = r.actions || {};
                return (a.deleteEquiposCount || 0) + (a.deleteJugadorasCount || 0) + (a.deleteJornadasCount || 0) + (a.markJornadasCompletedCount || 0) > 0;
            }).length,
            totals: results.reduce((acc, r) => {
                const a = r.actions || {};
                acc.deleteEquipos += a.deleteEquiposCount || 0;
                acc.deleteJugadoras += a.deleteJugadorasCount || 0;
                acc.deleteJornadas += a.deleteJornadasCount || 0;
                acc.markJornadasCompleted += a.markJornadasCompletedCount || 0;
                return acc;
            }, { deleteEquipos: 0, deleteJugadoras: 0, deleteJornadas: 0, markJornadasCompleted: 0 }),
            results
        };

        await writeAuditLog('admin_data_health_run', req, {
            apply,
            targetUserId: targetUserId || null,
            usersTotal: summary.usersTotal,
            usersWithIssues: summary.usersWithIssues,
            totals: summary.totals
        });

        res.json(summary);
    } catch (error) {
        return handleInternalError(res, error, 'admin-data-health');
    }
});

// Exportación GDPR de datos de un usuario.
// Soporta dos alcances:
// - scope=all (default): todos los datos del usuario
// - scope=current-team + equipoId: solo datos del equipo actual
app.get('/api/users/:username/export', async (req, res) => {
    try {
        const { username } = req.params;
        const scope = sanitizeText(req.query.scope || 'all', 40).toLowerCase();
        const equipoIdRaw = req.query.equipoId;

        if (!req.authUser) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const isSelf = req.authUser.sub === username;
        const isAdmin = !!req.authUser.isAdmin;
        if (!isSelf && !isAdmin) {
            return res.status(403).json({ error: 'No autorizado para exportar los datos de este usuario' });
        }

        if (scope === 'current-team' && (equipoIdRaw === undefined || equipoIdRaw === null || String(equipoIdRaw).trim() === '')) {
            return res.status(400).json({ error: 'equipoId es requerido cuando scope=current-team' });
        }

        const teamValues = scope === 'current-team'
            ? Array.from(new Set([
                String(equipoIdRaw),
                Number.isFinite(Number(equipoIdRaw)) ? Number(equipoIdRaw) : null
            ].filter(value => value !== null && value !== undefined)))
            : [];

        const equiposFilter = scope === 'current-team'
            ? { userId: username, id: { $in: teamValues } }
            : { userId: username };

        const relatedFilter = scope === 'current-team'
            ? { userId: username, equipoId: { $in: teamValues } }
            : { userId: username };

        await writeAuditLog('user_export_requested', req, {
            targetUsername: username,
            requestedBy: req.authUser.sub,
            scope,
            equipoId: scope === 'current-team' ? String(equipoIdRaw) : null
        });

        const [userDoc, equiposRaw, jugadorasRaw, jornadasRaw, configDoc] = await Promise.all([
            db.collection('users').findOne(
                { username },
                { projection: { _id: 0, password: 0 } }
            ),
            db.collection('equipos').find(equiposFilter).toArray(),
            db.collection('jugadores').find(relatedFilter).toArray(),
            db.collection('jornadas').find(relatedFilter).toArray(),
            db.collection('config').findOne({ userId: username })
        ]);

        if (!userDoc) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const dedupeById = (docs) => {
            const seen = new Set();
            const result = [];
            for (const doc of docs || []) {
                const key = String(doc?.id ?? '');
                if (!key || seen.has(key)) continue;
                seen.add(key);
                result.push(doc);
            }
            return result;
        };

        const equipos = dedupeById(equiposRaw);
        const jugadoras = dedupeById(jugadorasRaw);
        const jornadas = dedupeById(jornadasRaw);

        const payload = {
            fechaExportacion: new Date().toISOString(),
            version: '2.1-gdpr',
            formato: 'application/json',
            alcance: scope,
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


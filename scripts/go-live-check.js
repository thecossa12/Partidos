/*
  Verificacion rapida pre go-live comercial.
  Uso:
    node scripts/go-live-check.js

  Requiere:
    CHECK_BASE_URL (ej: https://tu-app.com)
*/

require('dotenv').config();

function fail(message) {
  console.error('FAIL:', message);
  process.exit(1);
}

function ok(message) {
  console.log('OK:', message);
}

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    fail(`Falta variable ${name}`);
  }
  return String(value).trim();
}

async function fetchJson(url) {
  const res = await fetch(url);
  const ct = res.headers.get('content-type') || '';
  let body;
  if (ct.includes('application/json')) {
    body = await res.json().catch(() => ({}));
  } else {
    body = await res.text().catch(() => '');
  }
  return { res, body };
}

(async () => {
  const baseUrl = required('CHECK_BASE_URL').replace(/\/$/, '');

  const requiredEnv = [
    'MONGO_URI',
    'JWT_SECRET',
    'AUTH_MODE',
    'TRUST_PROXY'
  ];

  for (const name of requiredEnv) {
    required(name);
  }

  if (String(process.env.AUTH_MODE).toLowerCase() !== 'strict') {
    fail('AUTH_MODE debe ser strict en go-live comercial');
  }

  if (String(process.env.JWT_SECRET || '').length < 32) {
    fail('JWT_SECRET debe tener al menos 32 caracteres');
  }

  const health = await fetchJson(`${baseUrl}/api/health`);
  if (!health.res.ok || health.body.status !== 'ok') {
    fail(`Healthcheck fallo: ${health.res.status}`);
  }
  ok('Healthcheck /api/health');

  const ready = await fetchJson(`${baseUrl}/api/health/ready`);
  if (!ready.res.ok || ready.body.ready !== true) {
    fail(`Readiness fallo: ${ready.res.status}`);
  }
  ok('Readiness /api/health/ready');

  const noToken = await fetchJson(`${baseUrl}/api/equipos`);
  if (noToken.res.status !== 401) {
    fail(`Esperado 401 en endpoint protegido sin token, recibi ${noToken.res.status}`);
  }
  ok('Proteccion JWT en endpoints');

  console.log('OK go-live-check completado');
})().catch((error) => {
  fail(error && error.message ? error.message : 'Error inesperado');
});

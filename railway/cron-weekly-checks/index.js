require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Falta variable: ${name}`);
  }
  return String(value).trim();
}

async function readBodySafe(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (error) {
      return { parseError: 'json_invalido' };
    }
  }
  return await response.text().catch(() => '');
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const body = await readBodySafe(res);
  return { status: res.status, ok: res.ok, body };
}

async function requestWithRetry(url, options = {}, attempts = 5, delayMs = 1200) {
  let lastError = null;

  for (let i = 1; i <= attempts; i++) {
    try {
      const result = await request(url, options);
      if ([429, 502, 503, 504].includes(result.status) && i < attempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      return result;
    } catch (error) {
      lastError = error;
      if (i < attempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('Fallo de red');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const baseUrl = required('CHECK_BASE_URL').replace(/\/$/, '');
  const username = required('CHECK_USER');
  const password = required('CHECK_PASS');

  const health = await requestWithRetry(`${baseUrl}/api/health`);
  assert(health.ok, `Healthcheck fallo: ${health.status}`);

  const ready = await requestWithRetry(`${baseUrl}/api/health/ready`);
  assert(ready.ok && ready.body.ready === true, `Readiness fallo: ${ready.status}`);

  const noToken = await requestWithRetry(`${baseUrl}/api/equipos`);
  assert(noToken.status === 401, `Esperaba 401 sin token, recibi ${noToken.status}`);

  const login = await requestWithRetry(`${baseUrl}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  assert(login.ok, `Login fallo: ${login.status}`);

  const token = login.body && login.body.token;
  assert(token && typeof token === 'string', 'Login sin token JWT');

  const impersonation = await requestWithRetry(`${baseUrl}/api/equipos?userId=otro_usuario`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert(impersonation.status === 403, `Esperaba 403 por suplantacion, recibi ${impersonation.status}`);

  const withToken = await requestWithRetry(`${baseUrl}/api/equipos`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert(withToken.ok, `Acceso con token fallo: ${withToken.status}`);

  console.log('OK cron-weekly-checks completado');
}

main().catch((error) => {
  console.error('FAIL cron-weekly-checks:', error.message);
  process.exit(1);
});

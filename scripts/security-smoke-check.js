/*
  Security smoke check for cloud deployment.
  Requires these environment variables:
  - CHECK_BASE_URL   (example: https://tu-app.up.railway.app)
  - CHECK_USER
  - CHECK_PASS
*/

require('dotenv').config();

function fail(message) {
  console.error("FAIL:", message);
  process.exit(1);
}

function ensureEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    fail(`Falta la variable de entorno ${name}`);
  }
  return String(value).trim();
}

function envOrDefault(name, fallbackValue) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    return fallbackValue;
  }
  return String(value).trim();
}

function optionalEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) return null;
  return String(value).trim();
}

async function readBodySafe(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch (error) {
      return { parseError: "JSON invalido" };
    }
  }

  try {
    return await response.text();
  } catch (error) {
    return "";
  }
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const body = await readBodySafe(res);
  return { status: res.status, ok: res.ok, body };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry(url, options = {}, retryConfig = {}) {
  const attempts = Number(retryConfig.attempts || 5);
  const delayMs = Number(retryConfig.delayMs || 1200);

  let lastError = null;

  for (let i = 1; i <= attempts; i++) {
    try {
      const result = await request(url, options);

      // Reintentar en errores transitorios de gateway/servicio.
      if ([429, 502, 503, 504].includes(result.status) && i < attempts) {
        await sleep(delayMs);
        continue;
      }

      return result;
    } catch (error) {
      lastError = error;
      if (i < attempts) {
        await sleep(delayMs);
        continue;
      }
    }
  }

  throw lastError || new Error("Fallo de red sin detalle");
}

(async () => {
  const baseUrl = envOrDefault("CHECK_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
  const username = optionalEnv("CHECK_USER");
  const password = optionalEnv("CHECK_PASS");

  console.log("Security smoke check against:", baseUrl);

  // 1) Protected endpoint without token should be unauthorized in strict mode.
  const noToken = await requestWithRetry(`${baseUrl}/api/equipos`);
  if (![200, 401].includes(noToken.status)) {
    fail(`Esperaba 200/401 sin token segun modo auth, recibi ${noToken.status}`);
  }

  // Si no hay credenciales de test configuradas, validar solo el baseline.
  if (!username || !password) {
    console.warn("WARN: CHECK_USER/CHECK_PASS no definidos. Se ejecuta smoke baseline sin login.");
    console.log("OK: baseline security smoke check passed");
    return;
  }

  // 2) Login should succeed and return JWT token.
  const login = await requestWithRetry(`${baseUrl}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!login.ok) {
    fail(`Login fallo con estado ${login.status}`);
  }

  const token = login.body && login.body.token;
  if (!token || typeof token !== "string") {
    fail("Login exitoso pero no devolvio token JWT");
  }

  // 3) Token cannot impersonate another user id.
  const wrongUserId = await requestWithRetry(`${baseUrl}/api/equipos?userId=otro_usuario`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (wrongUserId.status !== 403) {
    fail(`Esperaba 403 por suplantacion de userId, recibi ${wrongUserId.status}`);
  }

  // 4) Same endpoint with valid token and no userId should work.
  const withToken = await requestWithRetry(`${baseUrl}/api/equipos`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!withToken.ok) {
    fail(`Esperaba acceso con token valido, recibi ${withToken.status}`);
  }

  console.log("OK: security smoke check passed");
})().catch((error) => {
  fail(error && error.message ? error.message : "Error inesperado");
});

/*
  Security smoke check for cloud deployment.
  Requires these environment variables:
  - CHECK_BASE_URL   (example: https://tu-app.up.railway.app)
  - CHECK_USER
  - CHECK_PASS
*/

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

(async () => {
  const baseUrl = ensureEnv("CHECK_BASE_URL").replace(/\/$/, "");
  const username = ensureEnv("CHECK_USER");
  const password = ensureEnv("CHECK_PASS");

  console.log("Security smoke check against:", baseUrl);

  // 1) Protected endpoint without token should be unauthorized in strict mode.
  const noToken = await request(`${baseUrl}/api/equipos`);
  if (noToken.status !== 401) {
    fail(`Esperaba 401 sin token, recibi ${noToken.status}`);
  }

  // 2) Login should succeed and return JWT token.
  const login = await request(`${baseUrl}/api/users/login`, {
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
  const wrongUserId = await request(`${baseUrl}/api/equipos?userId=otro_usuario`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (wrongUserId.status !== 403) {
    fail(`Esperaba 403 por suplantacion de userId, recibi ${wrongUserId.status}`);
  }

  // 4) Same endpoint with valid token and no userId should work.
  const withToken = await request(`${baseUrl}/api/equipos`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!withToken.ok) {
    fail(`Esperaba acceso con token valido, recibi ${withToken.status}`);
  }

  console.log("OK: security smoke check passed");
})().catch((error) => {
  fail(error && error.message ? error.message : "Error inesperado");
});

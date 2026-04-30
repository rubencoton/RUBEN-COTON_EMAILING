"use strict";

/**
 * googleHub — adaptador a RUBEN-COTON_API-GOOGLE
 *
 * Proporciona clientes Google (Drive, Sheets, Gmail, etc.) autenticados con
 * la cuenta manager@rubencoton.com.
 *
 * Modo dev (local): usa config/token.json del hub en
 *   ../../RUBEN-COTON_API-GOOGLE/config/token.json
 * Modo producción (Coolify): usa variables de entorno
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_REFRESH_TOKEN
 *   (opcional) GOOGLE_ACCESS_TOKEN, GOOGLE_TOKEN_EXPIRY
 *
 * Si faltan credenciales, las funciones devuelven un cliente "vacío" y
 * `isGoogleReady()` devuelve false. NO rompen la app.
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const HUB_PATH = path.resolve(__dirname, "..", "..", "RUBEN-COTON_API-GOOGLE");
const TOKEN_LOCAL_PATH = path.join(HUB_PATH, "config", "token.json");

let _oauthClient = null;
let _ready = null; /* cached ready state */

function buildOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/oauth2/callback";

  /* Modo dev: reaprovecha token local del hub */
  let localToken = null;
  try {
    if (fs.existsSync(TOKEN_LOCAL_PATH)) {
      localToken = JSON.parse(fs.readFileSync(TOKEN_LOCAL_PATH, "utf8"));
    }
  } catch (_e) { /* ignore */ }

  /* Credenciales requeridas */
  const envClientId = clientId || process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = clientSecret || process.env.GOOGLE_CLIENT_SECRET;
  /* Aceptamos varios nombres: GOOGLE_REFRESH_TOKEN (estándar emailing) o
   * GOOGLE_OAUTH_REFRESH_TOKEN (convención del hub RUBEN-COTON_API-GOOGLE). */
  const envRefresh = process.env.GOOGLE_REFRESH_TOKEN
    || process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    || (localToken && localToken.refresh_token);

  if (!envClientId || !envClientSecret || !envRefresh) {
    return null; /* sin credenciales */
  }

  const client = new google.auth.OAuth2(envClientId, envClientSecret, redirectUri);

  const credentials = {};
  credentials.refresh_token = envRefresh;
  if (process.env.GOOGLE_ACCESS_TOKEN) credentials.access_token = process.env.GOOGLE_ACCESS_TOKEN;
  if (process.env.GOOGLE_TOKEN_EXPIRY) credentials.expiry_date = Number(process.env.GOOGLE_TOKEN_EXPIRY);
  if (localToken) {
    if (!credentials.access_token && localToken.access_token) credentials.access_token = localToken.access_token;
    if (!credentials.expiry_date && localToken.expiry_date) credentials.expiry_date = localToken.expiry_date;
    if (localToken.scope) credentials.scope = localToken.scope;
    if (localToken.token_type) credentials.token_type = localToken.token_type;
  }
  client.setCredentials(credentials);

  /* Persistir refreshes automáticos SOLO en local */
  client.on("tokens", (tokens) => {
    try {
      if (!fs.existsSync(path.dirname(TOKEN_LOCAL_PATH))) return;
      const existing = fs.existsSync(TOKEN_LOCAL_PATH)
        ? JSON.parse(fs.readFileSync(TOKEN_LOCAL_PATH, "utf8"))
        : {};
      const merged = { ...existing, ...tokens };
      fs.writeFileSync(TOKEN_LOCAL_PATH, JSON.stringify(merged, null, 2));
    } catch (_e) { /* ignore */ }
  });

  return client;
}

function getOAuthClient() {
  if (_oauthClient === null) {
    _oauthClient = buildOAuthClient();
  }
  return _oauthClient;
}

function isGoogleReady() {
  if (_ready !== null) return _ready;
  _ready = !!getOAuthClient();
  return _ready;
}

function requireClient() {
  const oauth = getOAuthClient();
  if (!oauth) {
    throw new Error(
      "Google no configurado. Faltan GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN " +
      "(o token local en RUBEN-COTON_API-GOOGLE/config/token.json)."
    );
  }
  return oauth;
}

/* Clientes Google */
const clients = {
  drive: () => google.drive({ version: "v3", auth: requireClient() }),
  sheets: () => google.sheets({ version: "v4", auth: requireClient() }),
  gmail: () => google.gmail({ version: "v1", auth: requireClient() }),
  calendar: () => google.calendar({ version: "v3", auth: requireClient() })
};

/* Prueba de conexión — usa Drive.about.get */
async function testConnection() {
  try {
    const drive = clients.drive();
    const r = await drive.about.get({ fields: "user(emailAddress,displayName),storageQuota" });
    return { ok: true, email: r.data.user?.emailAddress, name: r.data.user?.displayName };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { clients, isGoogleReady, testConnection, getOAuthClient };

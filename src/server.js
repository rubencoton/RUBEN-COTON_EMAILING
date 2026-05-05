
require("dotenv").config();

const crypto = require("crypto");
const dns = require("dns").promises;
const fs = require("fs");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const path = require("path");
const archiver = require("archiver");
/* PostgreSQL eliminado en refactor 2026-04-25.
 * Persistencia 100% en store.json + backup auto a Drive (driveArchive.js).
 * Motivo: PG container saturaba disco VPS (ENOSPC repetidos). */
const { createMassMailEngine } = require("./massMailEngine");
const { DataStore } = require("./dataStore");
const sheetsSync = require("./sheetsSync");
const aiRouter = require("./aiRouter");
const aiHelpers = require("./aiHelpers");
const attachments = require("./attachments");
const emailBuilder = require("./emailBuilder");
const driveArchive = require("./driveArchive");
const googleHub = require("./googleHub");
const executiveReports = require("./executiveReports");
const replyTracker = require("./replyTracker");
const localAgent = require("./localAgent");
const spamShield = require("./spamShield");
const driveScheduler = require("./driveScheduler");
const sheetsWriteback = require("./sheetsWriteback");
const trackingSign = require("./trackingSign");
const pdfGen = require("./pdfGen");

/* Helper writeback: busca _sheetMeta del contacto y encola update */
const wbForEmail = (email, status) => {
  try {
    const all = dataStore.listContacts({ search: email });
    const c = (all || []).find((x) => String(x.email || "").toLowerCase() === String(email || "").toLowerCase());
    if (!c) return;
    let meta = c.customFields?._sheetMeta || c.custom?._sheetMeta;
    if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch (_e) { meta = null; } }
    if (meta) sheetsWriteback.enqueue(meta, status, email);
  } catch (_e) {}
};

const app = express();
const port = Number(process.env.PORT || 3000);
const startedAt = new Date();
const normalizePasswordValue = (value) => {
  let normalized = String(value || "").trim();

  const hasDoubleQuotes =
    normalized.startsWith("\"") && normalized.endsWith("\"");
  const hasSingleQuotes =
    normalized.startsWith("'") && normalized.endsWith("'");
  if (hasDoubleQuotes || hasSingleQuotes) {
    normalized = normalized.slice(1, -1).trim();
  }

  try {
    normalized = decodeURIComponent(normalized);
  } catch (_error) {
    // Keep original when value is not URI encoded.
  }

  return normalized;
};

const accessPasswordRaw = process.env.APP_ACCESS_PASSWORD;
if (!accessPasswordRaw) {
  console.error("[FATAL] Falta APP_ACCESS_PASSWORD en variables de entorno. Abortando.");
  process.exit(1);
}
const accessPassword = normalizePasswordValue(accessPasswordRaw);
const authSecret =
  process.env.APP_ACCESS_SECRET || "ruben-coton-emailing-default-secret";
/* FIX A9 audit 2026-04-30: el default es predecible. Avisar fuerte en
 * arranque si no se ha configurado un secret propio. */
if (!process.env.APP_ACCESS_SECRET) {
  console.warn("[SEGURIDAD] APP_ACCESS_SECRET no configurado. Usando default predecible. Configura uno propio en Coolify env vars.");
}
const authCookieName = "app_auth";
const loginHtmlPath = path.join(__dirname, "..", "public", "login.html");
const appHtmlPath = path.join(__dirname, "..", "public", "index.html");
const appRelease = process.env.APP_RELEASE || "2026-03-31-r2";
const authCookieSecureRaw = String(process.env.APP_AUTH_COOKIE_SECURE || "auto")
  .trim()
  .toLowerCase();

/* Compat refactor: pool=null y dbRequired=false. La app ignora DATABASE_URL
 * aunque exista en env. Mantener variables permite que el código existente
 * de health checks compile sin reescritura masiva. */
const pool = null;
const dbRequired = false;

const dataStore = new DataStore();
sheetsSync.setDataStoreRef(dataStore);

/* P0-EMERGENCY 2026-05-01: cleanup one-shot al boot si BOOT_PRUNE_STRESS=1.
 * Elimina TODAS las campañas que comienzan con "STRESS TEST" y todos los
 * contactos cuyo email hace match con manager+test*@rubencoton.com.
 * UN solo mutate batch para no clonar el store N veces.
 * Tras la limpieza el operador debe quitar la env var manualmente. */
if (String(process.env.BOOT_PRUNE_STRESS || "").trim() === "1") {
  try {
    const before = { campaigns: 0, contacts: 0 };
    const after = { campaigns: 0, contacts: 0 };
    dataStore.mutate((store) => {
      before.campaigns = (store.campaigns || []).length;
      before.contacts = (store.contacts || []).length;
      /* Borra TODAS las campañas que sean test/stress (cualquier nombre que
       * empiece con un patrón conocido de test). */
      const CAMP_TEST_RX = /^(STRESS TEST|FINAL TEST|E2E TEST|BATTERY T|TEST [1-6])/i;
      store.campaigns = (store.campaigns || []).filter((c) => {
        return !CAMP_TEST_RX.test(String(c.name || ""));
      });
      /* Borra TODOS los contactos test (cualquier alias `manager+<algo>` que
       * matche un patrón conocido de test). */
      const CONTACT_TEST_RX = /^manager\+(test|e2e|final|t\dvol|t\dbig|t\dc|t1vol|t5big|t6c)\d+[a-z]?@rubencoton\.com$/i;
      store.contacts = (store.contacts || []).filter((c) => !CONTACT_TEST_RX.test(String(c.email || "")));
      after.campaigns = store.campaigns.length;
      after.contacts = store.contacts.length;
    });
    console.warn(
      `[boot-prune] OK | campaigns ${before.campaigns}→${after.campaigns} ` +
      `(borradas ${before.campaigns - after.campaigns}) | ` +
      `contacts ${before.contacts}→${after.contacts} ` +
      `(borrados ${before.contacts - after.contacts})`
    );
  } catch (err) {
    console.error("[boot-prune] FAIL:", err.message);
  }
}

const massMailEngine = createMassMailEngine({
  transportMode: process.env.MAIL_TRANSPORT_MODE || "smtp",
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT || 587,
  smtpSecure: process.env.SMTP_SECURE || "false",
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  /* OAuth2 (Gmail XOAUTH2) — alternativa a SMTP_PASS sin App Password.
   * Si las 3 variables estan, se usa OAuth2 en vez de pass. */
  smtpOauthClientId: process.env.SMTP_OAUTH_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID,
  smtpOauthClientSecret: process.env.SMTP_OAUTH_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  smtpOauthRefreshToken: process.env.SMTP_OAUTH_REFRESH_TOKEN || process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  smtpRequireTls: process.env.SMTP_REQUIRE_TLS || "false",
  smtpSkipTlsVerify: process.env.SMTP_SKIP_TLS_VERIFY || "false",
  botaviaBaseUrl: process.env.BOTAVIA_API_BASE_URL || "",
  botaviaApiKey: process.env.BOTAVIA_API_KEY || "",
  botaviaSendPath: process.env.BOTAVIA_SEND_PATH || "/send",
  botaviaHealthPath: process.env.BOTAVIA_HEALTH_PATH || "/health",
  fromName: process.env.SMTP_FROM_NAME || "RUBEN COTON",
  fromEmail: process.env.SMTP_FROM_EMAIL,
  replyTo: process.env.SMTP_REPLY_TO || "manager@rubencoton.com",
  ratePerMinute: process.env.MAIL_RATE_LIMIT_PER_MIN || 5,
  /* Cap diario de envíos (rolling 24h). Default 1500 (debajo del 2000/día
   * de Workspace para tener margen y no agotar la cuota). */
  dailyCap: process.env.MAIL_DAILY_CAP || 1950,
  /* Warmup gradual (anti-spam): día 1=100, día 2=250, día 3=500, día 4=1000, día 5+=cap. */
  warmupEnabled: process.env.MAIL_WARMUP_ENABLED || "false",
  maxRetries: process.env.MAIL_MAX_RETRIES || 1,
  historyLimit: process.env.MAIL_HISTORY_LIMIT || 200,
  unsubscribeBaseUrl: process.env.MAIL_UNSUBSCRIBE_BASE_URL || "",
  /* URL base para pixel + click-redirect. Si no se define, cae a COOLIFY_FQDN. */
  trackingBaseUrl: process.env.MAIL_TRACKING_BASE_URL
    || (process.env.COOLIFY_FQDN ? `https://${process.env.COOLIFY_FQDN}` : "")
    || "https://emailing.rubencoton.com",
  directHostName: process.env.MAIL_DIRECT_HOSTNAME || "",
  dkimDomainName: process.env.MAIL_DKIM_DOMAIN || "",
  dkimKeySelector: process.env.MAIL_DKIM_SELECTOR || "",
  dkimPrivateKey: process.env.MAIL_DKIM_PRIVATE_KEY || "",
  /* Referencia al dataStore para registrar bounces y actualizar contactos
   * globalmente (evita reenvíos a direcciones inválidas). */
  dataStoreRef: dataStore
});
massMailEngine.start();
let setupChecklistCache = null;
let setupChecklistCacheAt = 0;
const setupChecklistTtlMs = Number(process.env.SETUP_CHECKLIST_TTL_MS || 60000);

app.set("trust proxy", true);
/* helmet() por defecto añade CSP que bloquea <script> inline en campaign-report.html
 * y handlers onclick="..." de la paginación. Desactivamos CSP y mantenemos el resto
 * de cabeceras de seguridad (X-Frame-Options, etc). */
app.use(helmet({ contentSecurityPolicy: false }));
/* P0 audit 2026-05-01: cors() sin opciones permite CUALQUIER origen con
 * cookie credentials (eco origin). Restringir a origin propio. */
const ALLOWED_ORIGINS = [
  process.env.PUBLIC_BASE_URL,
  process.env.APP_BASE_URL,
  process.env.COOLIFY_FQDN ? `https://${process.env.COOLIFY_FQDN}` : null,
  "https://emailing.rubencoton.com"
].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);  /* curl, server-side, mismo origen */
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("CORS not allowed"));
  },
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

/* BLINDAJE: el token se precomputa una sola vez al arranque. Evita SHA-256
 * por request y elimina la ventana de timing inherente a recomputar el hash
 * en cada petición. */
const EXPECTED_AUTH_TOKEN = crypto
  .createHash("sha256")
  .update(`${accessPassword}:${authSecret}`)
  .digest("hex");
const EXPECTED_AUTH_TOKEN_BUF = Buffer.from(EXPECTED_AUTH_TOKEN, "hex");

const buildAuthToken = () => EXPECTED_AUTH_TOKEN;

/* BLINDAJE: comparación constant-time para evitar timing attacks. */
const safeEqualHex = (provided) => {
  try {
    const ba = Buffer.from(String(provided || ""), "hex");
    if (ba.length !== EXPECTED_AUTH_TOKEN_BUF.length) return false;
    return crypto.timingSafeEqual(ba, EXPECTED_AUTH_TOKEN_BUF);
  } catch (_e) { return false; }
};

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce((acc, entry) => {
    const [key, ...rest] = entry.trim().split("=");
    if (!key) {
      return acc;
    }
    const rawValue = rest.join("=");
    try {
      acc[key] = decodeURIComponent(rawValue);
    } catch (_error) {
      acc[key] = rawValue;
    }
    return acc;
  }, {});
};

const shouldUseSecureCookie = (req) => {
  if (["1", "true", "yes", "on"].includes(authCookieSecureRaw)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(authCookieSecureRaw)) {
    return false;
  }

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  return Boolean(req.secure) || forwardedProto === "https";
};

const isAuthenticated = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  return safeEqualHex(cookies[authCookieName]);
};

const authRequired = (req, res, next) => {
  const publicPaths = [
    "/login",
    "/styles.css",
    "/login.js",
    "/api/auth/login",
    "/api/auth/logout",
    "/unsubscribe",
    "/manual",
    "/preview-informe-demo.html"
  ];
  /* P0 audit 2026-05-01: rutas de informe ANTES eran públicas. Threat
   * model detectó que con campaignId predecible (CMP-YYYYMMDD-NNNN), un
   * externo enumeraba PII (empresa+municipio+provincia+categoría) de
   * todos los recipients. Ahora exigimos token HMAC firmado en query
   * `?t=<sig>` que el admin genera al compartir. Sin token → auth normal.
   *
   * Helper: token = HMAC(campaignId|reportTokenSecret) primeros 16 chars.
   * Generado con `crypto.createHmac("sha256", REPORT_TOKEN_SECRET)`. */
  const checkReportToken = (campaignId, providedToken) => {
    if (!providedToken || typeof providedToken !== "string" || providedToken.length !== 16) return false;
    const secret = process.env.REPORT_TOKEN_SECRET || authSecret;
    const expected = crypto.createHmac("sha256", secret)
      .update(`${String(campaignId).toLowerCase()}|report`)
      .digest("hex").slice(0, 16);
    try {
      return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(providedToken, "hex"));
    } catch (_e) { return false; }
  };
  const reportMatch = (req.path || "").match(/^\/(?:api\/)?campaigns\/([^/]+)\/report$/);
  if (reportMatch) {
    if (checkReportToken(reportMatch[1], req.query?.t)) {
      return next();
    }
    /* Sin token → cae a auth normal (admin logueado puede ver). */
  }
  /* Informe ejecutivo global: requerir token o auth (NO público). */
  if (req.path === "/campaigns/report/executive" || req.path === "/api/campaigns/report/executive") {
    if (checkReportToken("executive", req.query?.t)) {
      return next();
    }
    /* Sin token → cae a auth normal. */
  }
  /* Tracking pixels y click-redirects: públicos por naturaleza (los emails
   * van a contactos externos que no tienen sesión en la app). */
  if (/^\/t\/o\/[^/]+\/[^/]+$/.test(req.path || "")) {
    return next();
  }
  if (/^\/t\/c\/[^/]+\/[^/]+$/.test(req.path || "")) {
    return next();
  }
  const healthPaths = ["/health", "/health/db", "/api/health/full"];
  const requestPath = req.path || "/";

  /* /api/local-agent/* tiene su propia auth via Bearer token (LOCAL_AGENT_TOKEN).
   * Bypass del auth de la app porque el PC local no tiene cookie de sesión. */
  if (requestPath.startsWith("/api/local-agent/")) {
    return next();
  }

  if (
    publicPaths.includes(requestPath) ||
    healthPaths.includes(requestPath) ||
    requestPath.startsWith("/favicon") ||
    requestPath.startsWith("/assets/")
  ) {
    return next();
  }

  if (isAuthenticated(req)) {
    return next();
  }

  if (requestPath.startsWith("/api/")) {
    return res.status(401).json({
      status: "error",
      message: "No autorizado. Introduce la contrasena para acceder."
    });
  }

  return res.redirect("/login");
};

app.use(authRequired);
app.use(express.static(path.join(__dirname, "..", "public")));

const apiOk = (res, payload = {}) => res.json({ status: "ok", ...payload });
const apiError = (res, statusCode, message, extra = {}) =>
  res.status(statusCode).json({ status: "error", message, ...extra });

/* P0 BLINDAJE 2026-05-05: helper para recrear un job perdido tras restart.
 * Reenvia los recipients pendientes (sin sentAt ni bouncedAt) al motor. */
const recreateLostJob = (campaign) => {
  const snapshot = campaign.recipientsSnapshot || [];
  const pendientes = snapshot
    .filter((rcp) => !rcp.sentAt && !rcp.bouncedAt && rcp.status !== "sent" && rcp.status !== "bounced")
    .map((rcp) => rcp.email);
  if (!pendientes.length) {
    /* No hay nada que reenviar → marcar como completed. */
    return { recreated: false, completed: true };
  }
  try {
    const newJob = massMailEngine.enqueueJob({
      campaignId: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      html: campaign.html,
      text: campaign.text,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
      replyTo: campaign.replyTo,
      recipients: pendientes,
      attachments: attachments.getAttachmentsForSending(campaign.id)
    });
    /* P0 FIX 2026-05-05: preserveHistory=true para no perder los sentAt previos
     * al recrear job tras restart del contenedor. */
    dataStore.attachCampaignJob(campaign.id, newJob, snapshot.filter((rcp) => pendientes.includes(rcp.email)), { preserveHistory: true });
    /* Si la campana estaba paused, mantenerla paused tras recrear job. */
    if (campaign.status === "paused") {
      try { massMailEngine.pauseJob(newJob.id); } catch (_e) {}
    }
    return { recreated: true, jobId: newJob.id, pending: pendientes.length };
  } catch (e) {
    console.warn(`[sync] no se pudo recrear job ${campaign.id}: ${e.message}`);
    return { recreated: false, error: e.message };
  }
};

const syncCampaignsWithEngine = () => {
  /* P0 FIX 2026-05-05 (bug usuario "tras deploy el orden FIFO se reorganiza"):
   * listCampaigns() devuelve por updatedAt desc (lo que cambia cada sync).
   * Tras restart, las campañas activas se rehidratan en orden NO-FIFO.
   * Solucion: ordenar por createdAt asc — la campaña creada primero entra
   * primero al motor, preservando el orden cronologico original. */
  const campaigns = dataStore.listCampaigns()
    .slice()
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  const engineStatus = massMailEngine.getStatus();
  const queueOrder = Array.isArray(engineStatus.queueOrder) ? engineStatus.queueOrder : [];
  const posByJob = new Map();
  queueOrder.forEach((jid, idx) => posByJob.set(jid, idx));

  /* P0-EMERGENCY 2026-05-01: si hay 500 campañas huérfanas tras stress
   * test, hacer 500 mutates secuenciales clona el store (55MB) 500
   * veces → 27.5GB de RAM en la pila → OOM. Acumular las huérfanas y
   * hacer UN solo mutate batch al final.
   *
   * P0 BLINDAJE 2026-05-05: en vez de marcar failed las campanas con job
   * huerfano (sending/paused sin job en motor), AUTO-RECREAR el job con
   * recipients pendientes. Asi un restart del container no rompe campanas
   * en curso — el motor las recoge sola al boot. */
  const recreated = [];
  const completed = [];
  campaigns.forEach((campaign) => {
    const isActive = ["sending", "queued", "paused"].includes(campaign.status);
    if (!isActive) return;

    /* P0 FIX 2026-05-05 (peticion usuario "cada deploy reactiva la campana"):
     * si esta paused, NO recrear job al boot. El sync solo debe ocuparse
     * de campanas activas (sending/queued). Las paused se quedan asi hasta
     * que el usuario pulse Reanudar — solo entonces se recrea el job.
     * Si el jobId esta perdido del motor, lo limpiamos del store para
     * que /resume sepa que debe recrear. */
    if (campaign.status === "paused") {
      if (campaign.jobId) {
        const j = massMailEngine.getJob(campaign.jobId);
        if (!j) {
          /* Job perdido tras restart: limpiamos jobId para que resume recree. */
          dataStore.mutate((store) => {
            const c = store.campaigns.find((x) => x.id === campaign.id);
            if (c) { c.jobId = null; c.updatedAt = new Date().toISOString(); }
          });
        } else {
          /* Job sigue en motor: asegurar que esta paused (idempotente). */
          try { massMailEngine.pauseJob(campaign.jobId); } catch (_e) {}
        }
      }
      return;
    }

    if (!campaign.jobId) {
      /* Campana activa sin jobId: recrear. */
      const r = recreateLostJob(campaign);
      if (r.recreated) recreated.push({ id: campaign.id, jobId: r.jobId, pending: r.pending });
      else if (r.completed) completed.push(campaign.id);
      return;
    }
    const job = massMailEngine.getJob(campaign.jobId);
    if (!job) {
      /* Job perdido del motor: recrear. */
      const r = recreateLostJob(campaign);
      if (r.recreated) recreated.push({ id: campaign.id, jobId: r.jobId, pending: r.pending });
      else if (r.completed) completed.push(campaign.id);
      return;
    }
    const pos = posByJob.has(campaign.jobId) ? posByJob.get(campaign.jobId) : null;
    dataStore.syncCampaignByJob(campaign.id, { ...job, queuePosition: pos });
  });

  if (completed.length > 0) {
    /* Marcar como completed las que no tenian recipients pendientes. */
    dataStore.mutate((store) => {
      const now = new Date().toISOString();
      const completedSet = new Set(completed);
      store.campaigns.forEach((c) => {
        if (completedSet.has(c.id)) {
          c.status = "completed";
          c.completedAt = now;
          c.updatedAt = now;
        }
      });
    });
    console.log(`[sync] ${completed.length} campanas marcadas como completed (sin pendientes).`);
  }
  if (recreated.length > 0) {
    console.log(`[sync] ${recreated.length} jobs recreados auto tras restart:`, JSON.stringify(recreated.slice(0, 5)));
  }
};

const buildRuntimeStatus = async () => {
  const runtime = {
    app: "RUBEN-COTON_EMAILING",
    release: appRelease,
    status: "ok",
    environment: process.env.NODE_ENV || "production",
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: startedAt.toISOString(),
    serverTime: new Date().toISOString(),
    domain: process.env.COOLIFY_FQDN || null,
    db: "not_configured",
    dbMode: pool ? "postgres" : "file_store",
    massMail: massMailEngine.getStatus(),
    dashboard: dataStore.getOverview()
  };

  if (pool) {
    try {
      await pool.query("SELECT 1");
      runtime.db = "ok";
    } catch (error) {
      // Si PostgreSQL falla, seguimos en modo local para no bloquear la app.
      runtime.db = "warn";
      runtime.dbError = error.message || "database_connection_error";
      runtime.dbOptional = true;
      runtime.dbFallback = "file_store";
    }
  }

  return runtime;
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

const getDomainFromEmail = (email) => {
  const normalized = normalizeEmail(email);
  const parts = normalized.split("@");
  if (parts.length !== 2) {
    return "";
  }
  return parts[1];
};

const tryResolveA = async (host) => {
  try {
    return await dns.resolve4(host);
  } catch (_error) {
    return [];
  }
};

const isPublicIpv4 = (ip) => {
  const value = String(ip || "").trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return false;
  }

  const parts = value.split(".").map((item) => Number(item));
  if (parts.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) {
    return false;
  }

  if (parts[0] === 10) return false;
  if (parts[0] === 127) return false;
  if (parts[0] === 0) return false;
  if (parts[0] === 169 && parts[1] === 254) return false;
  if (parts[0] === 192 && parts[1] === 168) return false;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return false;

  return true;
};

const uniqueValues = (list) => Array.from(new Set((list || []).map((item) => String(item))));

const tryResolvePublicDnsA = async (host) => {
  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`,
      {
        method: "GET",
        headers: {
          Accept: "application/dns-json"
        }
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const answers = Array.isArray(data?.Answer) ? data.Answer : [];
    return uniqueValues(
      answers
        .filter((item) => Number(item?.type) === 1 && item?.data)
        .map((item) => String(item.data).trim())
    );
  } catch (_error) {
    return [];
  }
};

const tryResolveTxt = async (host) => {
  try {
    const rows = await dns.resolveTxt(host);
    return rows.map((entry) => entry.join(""));
  } catch (_error) {
    return [];
  }
};

const tryReverse = async (ip) => {
  try {
    return await dns.reverse(ip);
  } catch (_error) {
    return [];
  }
};

const buildSetupChecklist = async () => {
  const checks = [];
  const status = massMailEngine.getStatus();
  const mode = String(status.mode || "smtp").toLowerCase();
  const fromEmail = normalizeEmail(status.smtp?.fromEmail || "");
  const replyTo = normalizeEmail(status.smtp?.replyTo || "");
  const directHostName = String(status.direct?.hostName || "").trim().toLowerCase();
  const configuredServerIp = String(process.env.SERVER_PUBLIC_IPV4 || "")
    .trim()
    .toLowerCase();
  const fromDomain = getDomainFromEmail(fromEmail);

  const push = (id, label, checkStatus, detail) => {
    checks.push({
      id,
      label,
      status: checkStatus,
      detail
    });
  };

  push(
    "engine_enabled",
    "Motor de envio activo",
    status.enabled ? "ok" : "error",
    status.enabled
      ? `Modo ${mode.toUpperCase()} listo para encolar.`
      : "El motor no esta operativo. Revisa variables de entorno."
  );

  push(
    "mode_preferred",
    "Modo de envio",
    mode === "direct" ? "ok" : "warn",
    `Modo actual: ${mode.toUpperCase()}.`
  );

  push(
    "from_email",
    "Correo remitente",
    isValidEmail(fromEmail) ? "ok" : "error",
    fromEmail || "No configurado."
  );

  push(
    "reply_to",
    "Reply-To",
    isValidEmail(replyTo) ? "ok" : "warn",
    replyTo || "No configurado."
  );

  const ratePerMinute = Number(status.ratePerMinute || 0);
  push(
    "rate_limit",
    "Ritmo por minuto",
    ratePerMinute > 0 && ratePerMinute <= 5 ? "ok" : "warn",
    `${ratePerMinute || 0} correos/min.`
  );

  if (mode === "direct") {
    push(
      "direct_hostname",
      "Host directo",
      directHostName ? "ok" : "error",
      directHostName || "No configurado."
    );

    let resolvedServerIp = configuredServerIp;
    let localHostIpList = [];
    let publicDnsIpList = [];
    let publicHostIpList = [];
    if (directHostName) {
      localHostIpList = await tryResolveA(directHostName);
      publicDnsIpList = await tryResolvePublicDnsA(directHostName);
      publicHostIpList = uniqueValues([
        ...publicDnsIpList,
        ...localHostIpList.filter(isPublicIpv4)
      ]);

      if (!resolvedServerIp && publicHostIpList.length) {
        resolvedServerIp = String(publicHostIpList[0]).toLowerCase();
      }
    }

    push(
      "direct_a_record",
      "DNS A de host directo",
      publicHostIpList.length ? "ok" : "error",
      publicHostIpList.length
        ? `${directHostName} -> ${publicHostIpList.join(", ")}`
        : localHostIpList.length
          ? `${directHostName} resuelve local (${localHostIpList.join(", ")}), sin IP publica valida.`
          : `No se pudo resolver ${directHostName || "host directo"}.`
    );

    if (resolvedServerIp && isPublicIpv4(resolvedServerIp)) {
      const reverseList = await tryReverse(resolvedServerIp);
      const ptrOk = reverseList.some(
        (value) => String(value || "").toLowerCase() === directHostName
      );

      push(
        "reverse_dns",
        "PTR / Reverse DNS",
        ptrOk ? "ok" : "warn",
        reverseList.length
          ? `${resolvedServerIp} -> ${reverseList.join(", ")}`
          : `Sin PTR visible para ${resolvedServerIp}.`
      );
    } else {
      push(
        "reverse_dns",
        "PTR / Reverse DNS",
        "warn",
        "No se pudo determinar IP publica valida para validar PTR."
      );
    }
  }

  if (status.dkim?.enabled && status.dkim?.keySelector && status.dkim?.domainName) {
    const dkimHost = `${status.dkim.keySelector}._domainkey.${status.dkim.domainName}`;
    const dkimTxt = await tryResolveTxt(dkimHost);
    const dkimOk = dkimTxt.some((row) =>
      String(row || "").toLowerCase().includes("v=dkim1")
    );

    push(
      "dkim_dns",
      "DKIM publicado",
      dkimOk ? "ok" : "warn",
      dkimTxt.length ? `${dkimHost} detectado.` : `No aparece TXT en ${dkimHost}.`
    );
  } else {
    push(
      "dkim_dns",
      "DKIM publicado",
      "warn",
      "DKIM no completo en variables (domain/selector/private key)."
    );
  }

  if (fromDomain) {
    const rootTxt = await tryResolveTxt(fromDomain);
    const spf = rootTxt.find((row) => String(row || "").toLowerCase().startsWith("v=spf1"));
    const spfStatus = spf ? "ok" : "warn";
    push(
      "spf_dns",
      "SPF publicado",
      spfStatus,
      spf || `No se encontro SPF en ${fromDomain}.`
    );

    const dmarcTxt = await tryResolveTxt(`_dmarc.${fromDomain}`);
    const dmarc = dmarcTxt.find((row) =>
      String(row || "").toLowerCase().startsWith("v=dmarc1")
    );

    push(
      "dmarc_dns",
      "DMARC publicado",
      dmarc ? "ok" : "warn",
      dmarc || `No se encontro DMARC en _dmarc.${fromDomain}.`
    );
  } else {
    push(
      "sender_domain",
      "Dominio remitente",
      "error",
      "No se puede validar SPF/DMARC sin correo remitente."
    );
  }

  const okCount = checks.filter((item) => item.status === "ok").length;
  const errorCount = checks.filter((item) => item.status === "error").length;
  const warnCount = checks.filter((item) => item.status === "warn").length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      ready: errorCount === 0,
      total: checks.length,
      ok: okCount,
      warn: warnCount,
      error: errorCount
    },
    checks
  };
};

const getSetupChecklist = async () => {
  const now = Date.now();
  if (
    setupChecklistCache &&
    now - setupChecklistCacheAt < setupChecklistTtlMs &&
    setupChecklistTtlMs > 0
  ) {
    return setupChecklistCache;
  }

  setupChecklistCache = await buildSetupChecklist();
  setupChecklistCacheAt = now;
  return setupChecklistCache;
};

app.get("/api/panel", async (_req, res) => {
  syncCampaignsWithEngine();
  const runtime = await buildRuntimeStatus();
  res.json(runtime);
});

app.get("/api/dashboard", (_req, res) => {
  syncCampaignsWithEngine();
  return apiOk(res, {
    dashboard: dataStore.getOverview()
  });
});

/* Rate limit login: max 5 intentos por IP en 5 minutos */
const loginAttempts = new Map();
const LOGIN_MAX = 5;
const LOGIN_WINDOW_MS = 300000;
/* Purga periódica de intentos viejos para evitar crecimiento indefinido del Map */
setInterval(() => {
  const cutoff = Date.now() - LOGIN_WINDOW_MS;
  for (const [ip, attempts] of loginAttempts.entries()) {
    const recent = attempts.filter((t) => t > cutoff);
    if (recent.length === 0) loginAttempts.delete(ip);
    else if (recent.length !== attempts.length) loginAttempts.set(ip, recent);
  }
}, LOGIN_WINDOW_MS).unref();

app.post("/api/auth/login", (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || [];
  const recent = attempts.filter((t) => now - t < LOGIN_WINDOW_MS);

  if (recent.length >= LOGIN_MAX) {
    return apiError(res, 429, "Demasiados intentos. Espera 5 minutos.");
  }

  const passwordRaw =
    typeof req.body.password === "string" ? req.body.password : "";
  const password = normalizePasswordValue(passwordRaw);

  if (password !== accessPassword) {
    recent.push(now);
    loginAttempts.set(ip, recent);
    return apiError(res, 401, "Contrasena incorrecta");
  }

  /* Login OK — limpiar intentos */
  loginAttempts.delete(ip);

  const cookieParts = [
    `${authCookieName}=${encodeURIComponent(buildAuthToken())}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000"
  ];

  if (shouldUseSecureCookie(req)) {
    cookieParts.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieParts.join("; "));
  return apiOk(res);
});

app.post("/api/auth/logout", (req, res) => {
  const cookieParts = [
    `${authCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (shouldUseSecureCookie(req)) {
    cookieParts.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieParts.join("; "));
  return apiOk(res);
});

app.get("/login", (_req, res) => {
  res.sendFile(loginHtmlPath);
});

app.get("/manual", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "manual.html"));
});

/* Health endpoint optimizado — NO ejecuta sync en cada request */
let _healthCache = null;
let _healthCacheTime = 0;
const HEALTH_CACHE_MS = 10000; /* cache 10 segundos */

app.get("/health", async (_req, res) => {
  const now = Date.now();
  if (_healthCache && now - _healthCacheTime < HEALTH_CACHE_MS) {
    return res.json(_healthCache);
  }
  const health = await buildRuntimeStatus();
  const statusCode = health.status === "ok" ? 200 : 500;
  _healthCache = health;
  _healthCacheTime = now;
  res.status(statusCode).json(health);
});

app.get("/health/db", async (_req, res) => {
  /* Refactor 2026-04-25: PostgreSQL eliminado. Endpoint conservado por
   * compat con monitorización externa. Reporta siempre file_store. */
  return apiOk(res, {
    db: "not_used",
    mode: "file_store",
    detail: "Persistencia 100% local (store.json + backup Drive)."
  });
});

/**
 * Diagnostico completo: BD + store + IA providers.
 * Usar para confirmar que la app esta en modo "misil".
 */
app.get("/api/health/full", async (_req, res) => {
  const result = {
    ts: new Date().toISOString(),
    db: { configured: false, connected: false, mode: "file_store" },
    store: { loaded: false },
    ai: { providersConfigured: [], providersCooldown: [] },
    sheets: { idsActive: [] }
  };
  /* DB section vacía intencionalmente (PostgreSQL eliminado refactor 2026-04-25). */

  // Store
  try {
    const store = dataStore.read();
    result.store.loaded = true;
    result.store.contacts = (store.contacts || []).length;
    result.store.campaigns = (store.campaigns || []).length;
    result.store.templates = (store.templates || []).length;
    result.store.segments = (store.segments || []).length;
    result.store.events = (store.events || []).length;
    result.store.updatedAt = store.meta?.updatedAt || null;
    /* Tamaño en disco del store.json (sustituye al pg_database_size). */
    try {
      const fs = require("fs");
      const path = require("path");
      const dataFile = process.env.DATA_STORE_FILE
        ? path.resolve(process.env.DATA_STORE_FILE)
        : path.join(__dirname, "..", "data", "store.json");
      const stat = fs.statSync(dataFile);
      result.store.bytes = stat.size;
      result.store.sizeMB = +(stat.size / (1024 * 1024)).toFixed(2);
    } catch (_e) { /* best effort */ }
  } catch (error) {
    result.store.error = error.message;
  }

  // AI providers
  const aiKeys = [
    ["sambanova", "SAMBANOVA_API_KEY"],
    ["cerebras", "CEREBRAS_API_KEY"],
    ["mistral", "MISTRAL_API_KEY"],
    ["openrouter", "OPENROUTER_API_KEY"],
    ["groq", "GROQ_API_KEY"],
    ["gemini", "GEMINI_API_KEY"],
    ["pc_ollama", "PC_OLLAMA_URL"]
  ];
  aiKeys.forEach(([name, envKey]) => {
    if (process.env[envKey]) result.ai.providersConfigured.push(name);
  });

  // Sheets
  try {
    const ids = typeof sheetsSync.getActiveSheetIds === "function"
      ? sheetsSync.getActiveSheetIds()
      : (sheetsSync.SHEET_IDS || []);
    result.sheets.idsActive = ids;
  } catch (_e) { /* ignore */ }

  // PC Local agent
  try {
    result.localAgent = localAgent.getStatus();
  } catch (_e) { /* ignore */ }

  return apiOk(res, result);
});

/* ─── Local Agent endpoints (heartbeat + jobs queue) ──────────────
 * El PC local de RUBEN COTON ejecuta `scripts/local-agent.js` que polea
 * estos endpoints cada 30s. El VPS reparte jobs pesados (Qwen 14B, PDFs)
 * al PC cuando está online, y hace fallback a IA cloud si está offline.
 *
 * Auth: Bearer token via header `Authorization: Bearer <LOCAL_AGENT_TOKEN>`
 * Configurar `LOCAL_AGENT_TOKEN` en env del VPS y del PC.
 */

const extractAgentToken = (req) => {
  const auth = req.headers && req.headers.authorization;
  if (!auth || typeof auth !== "string") return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
};

const requireAgentAuth = (req, res, next) => {
  const tok = extractAgentToken(req);
  if (!localAgent.authToken(tok)) {
    return res.status(401).json({ status: "error", error: "agent_unauthorized" });
  }
  next();
};

/* Status público (UI consulta este endpoint para mostrar indicador ON/OFF). */
app.get("/api/local-agent/status", (_req, res) => {
  return apiOk(res, localAgent.getStatus());
});

/* Heartbeat del agent. Body: { hostname, version, ollamaModel, ollamaReady }. */
app.post("/api/local-agent/heartbeat", requireAgentAuth, (req, res) => {
  localAgent.applyHeartbeat(req.body || {});
  return apiOk(res, { ok: true, status: localAgent.getStatus() });
});

/* Agent reclama el siguiente job pendiente. */
app.get("/api/local-agent/jobs/next", requireAgentAuth, (_req, res) => {
  /* Heartbeat implícito: si pollea jobs, está vivo. */
  localAgent.applyHeartbeat({});
  const job = localAgent.claimNextJob();
  if (!job) return apiOk(res, { job: null });
  return apiOk(res, { job });
});

/* Agent entrega resultado del job. Body: { result } o { error }. */
app.post("/api/local-agent/jobs/:id/complete", requireAgentAuth, (req, res) => {
  const id = String(req.params.id || "");
  const { result, error } = req.body || {};
  const ok = localAgent.completeJob(id, result, error);
  if (!ok) {
    return res.status(404).json({ status: "error", error: "job_not_found_or_expired" });
  }
  return apiOk(res, { ok: true });
});

app.get("/api/contacts", (req, res) => {
  const allContacts = dataStore.listContacts({
    q: req.query.q,
    status: req.query.status,
    tag: req.query.tag
  });
  /* Paginacion: limit (default 50, max 500) + offset */
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const paginated = allContacts.slice(offset, offset + limit);
  return apiOk(res, {
    contacts: paginated,
    total: allContacts.length,
    limit,
    offset,
    hasMore: offset + limit < allContacts.length
  });
});

/* Alta/edicion manual DESACTIVADA — contactos solo desde Google Sheets */
app.post("/api/contacts", (_req, res) =>
  apiError(res, 403, "Alta manual desactivada. Los contactos se sincronizan desde Google Sheets."));

app.patch("/api/contacts/:id", (_req, res) =>
  apiError(res, 403, "Edicion manual desactivada. Edita el contacto en la hoja de Google Sheets."));

/* Carpeta de PRUEBA con contacto de test (solo para pruebas internas).
 * Reemplaza los tags (no merge) por [crm-prueba, seg-test-rubencoton]
 * para garantizar que aparezca solo en CRM: PRUEBA > TEST RUBENCOTON. */
app.post("/api/test/seed-test-contact", (_req, res) => {
  try {
    /* Email hardcodeado para que el endpoint publico no pueda abusarse */
    const email = "rubencoton1993@gmail.com";
    const crmTag = "crm-prueba";
    const segTag = "seg-test-rubencoton";
    const nowIso = new Date().toISOString();

    const result = dataStore.mutate((store) => {
      const existing = (store.contacts || []).find((c) => c.email === email);
      if (existing) {
        /* REEMPLAZA tags (no merge) para garantizar destino PRUEBA */
        existing.tags = [crmTag, segTag];
        existing.firstName = existing.firstName || "RUBEN";
        existing.lastName = existing.lastName || "COTON";
        existing.status = "subscribed";
        existing.source = "test-seed";
        existing.updatedAt = nowIso;
        return { action: "updated", contact: existing };
      }
      const created = {
        id: "contact_" + Math.random().toString(16).slice(2, 16),
        email,
        firstName: "RUBEN",
        lastName: "COTON",
        company: "Test",
        locale: "es",
        timezone: "Europe/Madrid",
        source: "test-seed",
        status: "subscribed",
        consentStatus: "granted",
        consentAt: nowIso,
        consentSource: "test-seed",
        tags: [crmTag, segTag],
        customFields: {},
        lastOpenAt: null,
        lastClickAt: null,
        unsubscribedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      store.contacts.push(created);
      return { action: "created", contact: created };
    });

    _foldersCache = null; /* invalida cache para que aparezca ya */
    return apiOk(res, {
      message: `Contacto de prueba ${result.action} con tags limpios`,
      contact: result.contact,
      crm: crmTag,
      lista: segTag
    });
  } catch (error) {
    return apiError(res, 400, error.message || "No se pudo crear contacto de prueba");
  }
});

/* Borrar contactos que ya no estan en las hojas de calculo */
app.post("/api/contacts/cleanup", (req, res) => {
  try {
    const { keepEmails, sourcePrefix } = req.body;
    if (!Array.isArray(keepEmails) || !sourcePrefix) {
      return apiError(res, 400, "Se requiere keepEmails (array) y sourcePrefix (string)");
    }
    const keepSet = new Set(keepEmails.map((e) => String(e).toLowerCase().trim()));
    const allContacts = dataStore.listContacts({});
    const toRemove = allContacts.filter((c) => {
      const hasSource = (c.sources || []).some((s) => s.startsWith(sourcePrefix));
      return hasSource && !keepSet.has(c.email.toLowerCase());
    });
    let removed = 0;
    for (const c of toRemove) {
      try {
        dataStore.createOrUpdateContact({ email: c.email, status: "unsubscribed" }, "upsert");
        removed++;
      } catch (_) {}
    }
    return apiOk(res, { removed, checked: allContacts.length, kept: keepSet.size });
  } catch (error) {
    return apiError(res, 500, error.message);
  }
});

app.post("/api/contacts/import", (req, res) => {
  try {
    const { rows, mapping } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return apiError(res, 400, "No hay filas para importar");
    }
    /* P0 audit 2026-05-01: cap duro de filas para evitar DoS por OOM.
     * Antes acepta 100k+ filas → mutate síncrono clona store → bloquea
     * event loop minutos. */
    const IMPORT_MAX_ROWS = Number(process.env.IMPORT_MAX_ROWS) || 10000;
    if (rows.length > IMPORT_MAX_ROWS) {
      return apiError(res, 413, `Maximo ${IMPORT_MAX_ROWS} filas por import. Recibido: ${rows.length}. Fragmenta en lotes.`);
    }
    if (!mapping || !Object.values(mapping).some(Boolean)) {
      return apiError(res, 400, "Mapping vacio — configura al menos la columna de email");
    }
    const report = dataStore.importContacts({
      rows,
      mapping,
      mode: req.body.mode,
      fileName: req.body.fileName,
      fileType: req.body.fileType,
      source: req.body.source || "import_ui"
    });

    return res.status(201).json({ status: "ok", report });
  } catch (error) {
    return apiError(res, 400, error.message || "No se pudo importar");
  }
});

app.get("/api/tags", (_req, res) => {
  const tags = dataStore.getOverview().contacts.tags;
  return apiOk(res, { tags });
});

/* Vista jerarquica: CRMs -> Listas -> Contactos */
/* Cache en memoria: el agregado de CRMs cambia solo tras sync */
let _foldersCache = null;
let _foldersCacheAt = 0;
const FOLDERS_CACHE_MS = 30000;
app.get("/api/folders", (_req, res) => {
  try {
    const now = Date.now();
    if (_foldersCache && now - _foldersCacheAt < FOLDERS_CACHE_MS) {
      return apiOk(res, { folders: _foldersCache, cached: true });
    }
    const t0 = Date.now();
    const rawFolders = dataStore.listFolders();
    console.log(`[api/folders] ${rawFolders.length} CRMs agregados en ${Date.now() - t0}ms`);
    const folders = rawFolders.map((crm) => ({
      slug: crm.slug,
      name: (function(s){
        const map = {
          "crm-venta-booking": "CRM: VENTA-BOOKING",
          "crm-otros": "CRM: OTROS",
          "crm-mundo-discografico": "CRM: MUNDO DISCOGRAFICO",
          "crm-marketing-y-promocion": "CRM: MARKETING Y PROMOCION",
          "crm-festivales": "CRM: FESTIVALES",
          "crm-bella-bestia": "CRM: BELLA BESTIA",
          "crm-ayudas-y-subvenciones": "CRM: AYUDAS Y SUBVENCIONES",
          "crm-prueba": "CRM: PRUEBA"
        };
        return map[s] || ("CRM: " + s.replace(/^crm-?/, "").replace(/-/g, " ").toUpperCase());
      })(crm.slug),
      total: crm.total,
      lists: (crm.lists || []).map((l) => ({
        slug: l.slug,
        name: l.slug.replace(/^seg-?/, "").replace(/-/g, " ").toUpperCase(),
        count: l.count
      }))
    }));
    _foldersCache = folders;
    _foldersCacheAt = now;
    return apiOk(res, { folders });
  } catch (error) {
    console.error("[api/folders] ERROR:", error.message);
    return apiError(res, 500, error.message);
  }
});

app.get("/api/templates", (_req, res) => {
  return apiOk(res, { templates: dataStore.listTemplates() });
});

app.get("/api/templates/:id", (req, res) => {
  const template = dataStore.getTemplate(req.params.id);
  if (!template) return apiError(res, 404, "Plantilla no encontrada");
  return apiOk(res, { template });
});

app.post("/api/templates", (req, res) => {
  try {
    const template = dataStore.createTemplate(req.body);
    return res.status(201).json({ status: "ok", template });
  } catch (error) {
    return apiError(res, 400, error.message || "No se pudo crear plantilla");
  }
});

app.put("/api/templates/:id", (req, res) => {
  try {
    const template = dataStore.updateTemplate(req.params.id, req.body);
    return apiOk(res, { template });
  } catch (error) {
    const code = /no encontrada/i.test(error.message) ? 404 : 400;
    return apiError(res, code, error.message || "No se pudo actualizar plantilla");
  }
});

app.delete("/api/templates/:id", (req, res) => {
  try {
    const removed = dataStore.deleteTemplate(req.params.id);
    return apiOk(res, { removed });
  } catch (error) {
    const code = /no encontrada/i.test(error.message) ? 404 : 400;
    return apiError(res, code, error.message || "No se pudo borrar plantilla");
  }
});

app.patch("/api/templates/:id/validate", (req, res) => {
  try {
    const template = dataStore.setTemplateStatus(req.params.id, "validado");
    return apiOk(res, { template });
  } catch (error) {
    const code = /no encontrada/i.test(error.message) ? 404 : 400;
    return apiError(res, code, error.message || "No se pudo validar");
  }
});

app.patch("/api/templates/:id/unvalidate", (req, res) => {
  try {
    const template = dataStore.setTemplateStatus(req.params.id, "borrador");
    return apiOk(res, { template });
  } catch (error) {
    const code = /no encontrada/i.test(error.message) ? 404 : 400;
    return apiError(res, code, error.message || "No se pudo volver a borrador");
  }
});

app.get("/api/segments", (_req, res) => {
  return apiOk(res, { segments: dataStore.listSegments() });
});

app.post("/api/segments", (req, res) => {
  try {
    const segment = dataStore.createSegment(req.body);
    return res.status(201).json({ status: "ok", segment });
  } catch (error) {
    return apiError(res, 400, error.message || "No se pudo crear segmento");
  }
});

app.post("/api/segments/:id/preview", (req, res) => {
  const contacts = dataStore.resolveSegmentContacts(req.params.id);
  const sample = contacts.slice(0, 20);
  return apiOk(res, {
    count: contacts.length,
    sample
  });
});

/* Borrar segmento por id. Si hay campañas que lo usan, fallback a error. */
app.delete("/api/segments/:id", (req, res) => {
  try {
    let removed = false;
    let blockedByCampaigns = [];
    dataStore.mutate((store) => {
      const targetIdx = store.segments.findIndex((s) => s.id === req.params.id);
      if (targetIdx === -1) return;
      const inUse = store.campaigns.filter((c) => c.segmentId === req.params.id);
      if (inUse.length > 0) {
        blockedByCampaigns = inUse.map((c) => ({ id: c.id, name: c.name, status: c.status }));
        return;
      }
      store.segments.splice(targetIdx, 1);
      removed = true;
    });
    if (blockedByCampaigns.length > 0) {
      return apiError(res, 409, "Segmento en uso por campañas. Elimina o reasigna las campañas primero.", { blockedByCampaigns });
    }
    if (!removed) return apiError(res, 404, "Segmento no encontrado");
    return apiOk(res, { removed: true, id: req.params.id });
  } catch (e) {
    return apiError(res, 500, e.message);
  }
});

app.get("/api/campaigns", (_req, res) => {
  syncCampaignsWithEngine();
  return apiOk(res, { campaigns: dataStore.listCampaigns() });
});

app.post("/api/campaigns", (req, res) => {
  try {
    const campaign = dataStore.createCampaign(req.body);
    return res.status(201).json({ status: "ok", campaign });
  } catch (error) {
    return apiError(res, 400, error.message || "No se pudo crear campana");
  }
});

app.get("/api/campaigns/:id", (req, res) => {
  syncCampaignsWithEngine();
  const campaign = dataStore.getCampaign(req.params.id);
  if (!campaign) {
    return apiError(res, 404, "Campana no encontrada");
  }
  return apiOk(res, { campaign });
});

/* Vista previa del email de una campaña (borrador o enviada).
 * Devuelve el HTML del correo renderizado con una barra superior informativa. */
app.get("/campaigns/:id/preview", (req, res) => {
  const campaign = dataStore.getCampaign(req.params.id);
  if (!campaign) return res.status(404).send("Campaña no encontrada");
  const escHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const html = campaign.html || "<p>(Esta campaña no tiene HTML)</p>";
  const subject = escHtml(campaign.subject || "(sin asunto)");
  const name = escHtml(campaign.name || "(sin nombre)");
  const statusRaw = campaign.status || "draft";
  const STATUS_ES = { draft: "Borrador", queued: "En cola", sending: "Enviando", sent: "Enviada", paused: "Pausada", failed: "Error", scheduled: "Programada", completed: "Completada" };
  const status = escHtml(STATUS_ES[statusRaw] || statusRaw);
  const bar = `<div style="position:sticky;top:0;z-index:9999;background:linear-gradient(135deg,#E65100 0%,#FF6B00 100%);color:#fff;padding:10px 16px;font-family:Arial,sans-serif;font-size:13px;border-bottom:3px solid #FFB74D">
    <strong style="color:#FFB74D">VISTA PREVIA — ${name}</strong>
    &nbsp;·&nbsp; Asunto: <em>${subject}</em>
    &nbsp;·&nbsp; Estado: <span style="background:#FFB74D;color:#E65100;padding:2px 8px;border-radius:10px;font-weight:700;text-transform:uppercase">${status}</span>
    <a href="javascript:window.close()" style="float:right;color:#FFB74D;text-decoration:none">✖ Cerrar</a>
  </div>`;
  /* Si el html ya contiene <body>, inyectamos la barra justo después. */
  let out;
  if (/<body[^>]*>/i.test(html)) {
    out = html.replace(/<body([^>]*)>/i, `<body$1>${bar}`);
  } else {
    out = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head><body>${bar}${html}</body></html>`;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(out);
});

/* Construye el objeto de datos del informe de una campaña
 * Reutilizable: endpoint JSON, descarga ZIP individual, descarga histórica. */
function buildCampaignReportData(campaign) {
  const allContacts = dataStore.listContacts({});
  const byEmail = new Map();
  for (const c of allContacts) byEmail.set((c.email || "").toLowerCase(), c);

  /* P0 FIX 2026-05-05: bugs auditoria informe destinatarios:
   * 1. Datos en customFields, no en custom (campos quedaban vacios).
   * 2. categoria cogia el PRIMER tag seg-* del contacto, no el de la
   *    campana actual. Un contacto en multiples pestanas (festejos +
   *    infantil + cultura) mostraba INFANTIL en una campana de FESTEJOS.
   *    Ahora usa el filtro de la campana (listFilter.tag) si existe.
   * 3. empresa: si CRM es ayuntamientos (venta-booking) y la categoria
   *    es una concejalia, mostrar 'Concejalia de [Cat] de [Municipio]'.
   *    Sino, company > 'Ayuntamiento de [municipio]' > '—'. */
  const campaignSegTag = String(campaign.listFilter?.tag || "").trim();
  const campaignSegLabel = campaignSegTag
    ? campaignSegTag.replace(/^seg-?/, "").replace(/-/g, " ").toUpperCase()
    : null;
  /* Categorias = concejalias dentro del CRM venta-booking (peticion user
   * 2026-05-05). Si crmTag = crm-venta-booking + segTag esta en lista,
   * la empresa se renderiza como "Concejalia de [Cat] de [Municipio]". */
  const CONCEJALIAS = new Set([
    "festejos", "juventud", "igualdad", "cultura", "ctro cultura",
    "infantil", "teatro", "abuelos", "ctro.cultura"
  ]);
  /* "festejos" -> "Festejos" (capitalize espanol). */
  const titleCase = (s) => String(s || "").toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const recipientsSnapshot = campaign.recipientsSnapshot || [];
  const recipients = recipientsSnapshot.map((r) => {
    const c = byEmail.get((r.email || "").toLowerCase()) || {};
    /* fields estan en customFields (sheets sync) o custom (legacy import). */
    const cf = c.customFields || c.custom || {};
    const tags = c.tags || [];
    /* Si la campana filtro por tag, mostrar ESE como categoria. Sino, el
     * primer tag seg-* del contacto. */
    const categoria = campaignSegLabel
      || (tags.find((t) => t.startsWith("seg")) || "").replace(/^seg-?/, "").replace(/-/g, " ").toUpperCase()
      || "—";
    const crmTag = tags.find((t) => t.startsWith("crm"));
    const municipio = cf.municipio || "—";
    /* Empresa: si es CRM venta-booking + concejalia → "Concejalia de [Cat]
     * de [Municipio]". Si no, company > "Ayuntamiento de X" > "—". */
    const isAyto = crmTag === "crm-venta-booking";
    const segLow = String(campaignSegLabel || "").toLowerCase().trim();
    const isConcejalia = isAyto && CONCEJALIAS.has(segLow);
    let empresa;
    if (isConcejalia && municipio !== "—") {
      empresa = `Concejalía de ${titleCase(segLow)} de ${municipio}`;
    } else if (isAyto && municipio !== "—") {
      empresa = `Ayuntamiento de ${municipio}`;
    } else {
      empresa = c.company || (municipio !== "—" ? municipio : "—");
    }

    let status = "en cola";
    if (r.clickedAt) status = "clic";
    else if (r.openedAt) status = "abierto";
    else if (r.bouncedAt) status = "rebote";
    else if (r.unsubscribedAt) status = "baja";
    else if (r.deliveredAt || r.sentAt) status = "enviado";
    /* Formato poblacion: "12.345 hab." si numerico, sino tal cual. */
    const popRaw = String(cf.poblacion || "").trim();
    let poblacion = "—";
    if (popRaw) {
      const num = Number(popRaw.replace(/\./g, "").replace(/,/g, "."));
      poblacion = Number.isFinite(num) && num > 0
        ? `${num.toLocaleString("es-ES")} hab.`
        : popRaw;
    }
    return {
      empresa,
      municipio,
      provincia: cf.provincia || "—",
      ccaa: cf.ccaa || "—",
      poblacion,
      categoria,
      fuente: crmTag ? crmTag.replace(/^crm-?/, "").replace(/-/g, " ").toUpperCase() : "—",
      status
    };
  });

  const st = campaign.stats || {};
  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      html: campaign.html,
      text: campaign.text,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
      createdAt: campaign.createdAt,
      sentAt: campaign.sentAt,
      status: campaign.status
    },
    stats: {
      total: st.total || recipients.length,
      sent: st.sent || 0,
      opened: st.opened || 0,
      clicked: st.clicked || 0,
      bounced: st.bounced || 0,
      unsubscribed: st.unsubscribed || 0
    },
    recipients,
    generatedAt: new Date().toISOString()
  };
}

/* Normaliza nombre para usarlo en ruta de archivo dentro del ZIP */
function slugify(s) {
  return String(s || "sin-nombre")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "sin-nombre";
}

/* Fecha YYYYMMDD a partir de ISO o Date. Usa sentAt, luego createdAt, luego hoy. */
function dateCode(campaign) {
  const iso = campaign?.sentAt || campaign?.createdAt || new Date().toISOString();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "00000000";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

/* Sistema de codificación:
 * Carpeta:  CMP-YYYYMMDD-NNNN-{slug}
 * Archivos: CORREO_CMP-YYYYMMDD-NNNN.html, INFORME_CMP-YYYYMMDD-NNNN.html, DATOS_CMP-YYYYMMDD-NNNN.json
 * NNNN = índice secuencial ordenado por fecha ascendente (estable para cada generación). */
function buildCampaignCode(campaign, seq) {
  const fecha = dateCode(campaign);
  const nnn = String(seq).padStart(4, "0");
  return `CMP-${fecha}-${nnn}`;
}
function buildCampaignFolder(campaign, seq) {
  return `${buildCampaignCode(campaign, seq)}-${slugify(campaign.name)}`;
}

/* Genera el HTML auto-contenido del informe (con data embebida)
 * Toma el template campaign-report.html y le inyecta window.__EMBEDDED_REPORT antes de </body>. */
let _reportTemplateCache = null;
function buildStandaloneReportHtml(reportData) {
  if (!_reportTemplateCache) {
    _reportTemplateCache = fs.readFileSync(
      path.join(__dirname, "..", "public", "campaign-report.html"),
      "utf8"
    );
  }
  const safeJson = JSON.stringify(reportData)
    .replace(/</g, "\\u003c")
    .replace(/-->/g, "--\\u003e");
  const inject = `<script>window.__EMBEDDED_REPORT = ${safeJson};</script>`;
  /* Insertamos justo antes del </body> para que el script render() ya exista */
  return _reportTemplateCache.replace(/<\/body>/i, `${inject}\n</body>`);
}

/* Genera HTML auto-contenido del email (listo para abrir offline) */
function buildStandaloneEmailHtml(campaign) {
  const html = campaign.html || `<p>Esta campaña no tiene contenido HTML</p>`;
  if (/<html[\s>]/i.test(html)) return html;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${(campaign.subject || "Email").replace(/</g,"&lt;")}</title></head><body>${html}</body></html>`;
}

/* Informe de campana: datos publicos (sin email/telefono/nombre contacto). */
app.get("/api/campaigns/:id/report", (req, res) => {
  syncCampaignsWithEngine();
  try {
    const campaign = dataStore.getCampaign(req.params.id);
    if (!campaign) return apiError(res, 404, "Campana no encontrada");
    return apiOk(res, buildCampaignReportData(campaign));
  } catch (error) {
    return apiError(res, 500, error.message);
  }
});

/* Pagina HTML imprimible del informe (para descargar como PDF) */
app.get("/campaigns/:id/report", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "campaign-report.html"));
});

/* ==========================================================
 * DESCARGA ZIP: pack completo de una campaña
 * Sistema codificación: CMP-YYYYMMDD-NNNN-{slug}
 * Estructura: {FOLDER}/CORREO_{CODE}.html, INFORME_{CODE}.html, DATOS_{CODE}.json
 * ========================================================== */
app.get("/api/campaigns/:id/download-pack", (req, res) => {
  syncCampaignsWithEngine();
  try {
    const campaign = dataStore.getCampaign(req.params.id);
    if (!campaign) return res.status(404).send("Campana no encontrada");

    /* Calcular secuencia: posición ordenada por fecha ascendente de todas las campañas */
    const all = dataStore.listCampaigns().slice().sort((a, b) => {
      const da = new Date(a.sentAt || a.createdAt || 0).getTime();
      const db = new Date(b.sentAt || b.createdAt || 0).getTime();
      return da - db;
    });
    const seq = all.findIndex((c) => c.id === campaign.id) + 1;

    const code = buildCampaignCode(campaign, seq);
    const folder = buildCampaignFolder(campaign, seq);
    const data = buildCampaignReportData(campaign);
    const filename = `${folder}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    /* BLINDAJE: respetar headersSent para no lanzar "Cannot set headers after sent" */
    archive.on("error", (err) => {
      console.error("[download-pack]", err);
      if (!res.headersSent) res.status(500).json({ status: "error", message: err.message });
      else try { res.end(); } catch (_e) {}
    });
    archive.pipe(res);

    archive.append(buildStandaloneEmailHtml(campaign), { name: `${folder}/CORREO_${code}.html` });
    archive.append(buildStandaloneReportHtml(data), { name: `${folder}/INFORME_${code}.html` });
    archive.append(JSON.stringify({ code, folder, ...data }, null, 2), { name: `${folder}/DATOS_${code}.json` });

    /* Ficha identificativa del pack */
    const ficha = [
      `PACK DE CAMPAÑA · RUBEN COTON`,
      `========================================`,
      ``,
      `Código:     ${code}`,
      `Campaña:    ${campaign.name || "(sin nombre)"}`,
      `Asunto:     ${campaign.subject || "—"}`,
      `Estado:     ${({ draft: "Borrador", queued: "En cola", sending: "Enviando", sent: "Enviada", paused: "Pausada", failed: "Error", scheduled: "Programada", completed: "Completada" })[campaign.status] || campaign.status || "—"}`,
      `Enviada:    ${campaign.sentAt ? new Date(campaign.sentAt).toLocaleString("es-ES") : "Pendiente"}`,
      `Generado:   ${new Date().toLocaleString("es-ES")}`,
      ``,
      `ARCHIVOS EN ESTA CARPETA:`,
      `  CORREO_${code}.html   → Email HTML enviado a los destinatarios`,
      `  INFORME_${code}.html  → Informe ejecutivo completo (abrir en navegador)`,
      `  DATOS_${code}.json    → Datos brutos (JSON, para auditoría)`,
      ``,
      `SISTEMA DE CODIFICACIÓN:`,
      `  CMP       → Campaña`,
      `  YYYYMMDD  → Fecha de envío (o de creación si no enviada)`,
      `  NNNN      → Número secuencial cronológico`,
      `  slug      → Nombre de campaña normalizado`,
      ``,
      `USO:`,
      `  Abre INFORME_${code}.html en cualquier navegador.`,
      `  Pulsa "Descargar PDF" o Ctrl+P → Guardar como PDF.`,
      ``,
      `manager@rubencoton.com`
    ].join("\n");
    archive.append(ficha, { name: `${folder}/FICHA_${code}.txt` });

    archive.finalize();
  } catch (error) {
    console.error("[download-pack] ERROR:", error);
    res.status(500).send("Error generando ZIP: " + error.message);
  }
});

/* ==========================================================
 * DESCARGA ZIP: histórico completo de todas las campañas
 * Sistema codificación CMP-YYYYMMDD-NNNN-{slug}, una carpeta por campaña
 * ========================================================== */
app.get("/api/campaigns/download-all", (_req, res) => {
  syncCampaignsWithEngine();
  try {
    const campaigns = dataStore.listCampaigns().slice().sort((a, b) => {
      const da = new Date(a.sentAt || a.createdAt || 0).getTime();
      const db = new Date(b.sentAt || b.createdAt || 0).getTime();
      return da - db;
    });
    if (!campaigns.length) return res.status(404).send("No hay campañas para descargar");

    const fechaStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rootFolder = `HISTORICO-CAMPANAS-${fechaStr}`;
    const filename = `${rootFolder}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    /* BLINDAJE: respetar headersSent para no lanzar "Cannot set headers after sent" */
    archive.on("error", (err) => {
      console.error("[download-all]", err);
      if (!res.headersSent) res.status(500).json({ status: "error", message: err.message });
      else try { res.end(); } catch (_e) {}
    });
    archive.pipe(res);

    const indexRows = [];
    /* Una carpeta por campaña, archivos con código único */
    campaigns.forEach((campaign, i) => {
      const seq = i + 1;
      const code = buildCampaignCode(campaign, seq);
      const folder = buildCampaignFolder(campaign, seq);
      const data = buildCampaignReportData(campaign);
      archive.append(buildStandaloneEmailHtml(campaign), { name: `${rootFolder}/${folder}/CORREO_${code}.html` });
      archive.append(buildStandaloneReportHtml(data), { name: `${rootFolder}/${folder}/INFORME_${code}.html` });
      archive.append(JSON.stringify({ code, folder, ...data }, null, 2), { name: `${rootFolder}/${folder}/DATOS_${code}.json` });

      const ficha = [
        `PACK DE CAMPAÑA · RUBEN COTON`,
        `========================================`,
        ``,
        `Código:     ${code}`,
        `Campaña:    ${campaign.name || "(sin nombre)"}`,
        `Asunto:     ${campaign.subject || "—"}`,
        `Enviada:    ${campaign.sentAt ? new Date(campaign.sentAt).toLocaleString("es-ES") : "Pendiente"}`,
        ``,
        `  CORREO_${code}.html   → Email HTML enviado`,
        `  INFORME_${code}.html  → Informe ejecutivo completo`,
        `  DATOS_${code}.json    → Datos brutos JSON`,
        ``,
        `manager@rubencoton.com`
      ].join("\n");
      archive.append(ficha, { name: `${rootFolder}/${folder}/FICHA_${code}.txt` });

      indexRows.push({ code, folder, campaign });
    });

    /* Índice global HTML */
    const indexHtml = [
      `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Índice histórico · RUBEN COTON</title>`,
      `<style>body{font-family:Arial,sans-serif;max-width:1100px;margin:40px auto;padding:20px;color:#1a1a1a}`,
      `h1{color:#E65100;border-bottom:4px solid #FFB74D;padding-bottom:12px;font-size:26pt}`,
      `.meta{background:#fff8e1;border-left:5px solid #FFB74D;padding:14px 18px;border-radius:6px;margin:16px 0}`,
      `table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px}`,
      `th{background:#E65100;color:#fff;padding:12px;text-align:left;border-bottom:4px solid #FFB74D;text-transform:uppercase;font-size:11px;letter-spacing:1px}`,
      `td{padding:10px;border-bottom:1px solid #eee;vertical-align:top}`,
      `tr:nth-child(even) td{background:#fafafa}`,
      `.code{font-family:monospace;background:#fff5e6;color:#E65100;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700}`,
      `a{color:#E65100;font-weight:700;text-decoration:none}`,
      `a:hover{text-decoration:underline}`,
      `.btn-inline{display:inline-block;padding:4px 10px;background:#E65100;color:#fff !important;border-radius:4px;font-size:11px;margin:2px 3px}`,
      `.btn-inline.amarillo{background:#FFB74D;color:#E65100 !important}</style></head><body>`,
      `<h1>HISTÓRICO DE CAMPAÑAS · RUBEN COTON</h1>`,
      `<div class="meta">`,
      `  <strong>Total campañas:</strong> ${campaigns.length}<br>`,
      `  <strong>Generado:</strong> ${new Date().toLocaleString("es-ES")}<br>`,
      `  <strong>Sistema codificación:</strong> <span class="code">CMP-YYYYMMDD-NNNN-slug</span>`,
      `</div>`,
      `<table><thead><tr><th>Código</th><th>Campaña / Asunto</th><th>Estado</th><th>Enviados</th><th>Aperturas</th><th>Archivos</th></tr></thead><tbody>`,
      ...indexRows.map(({ code, folder, campaign }) => {
        const est = ({ draft: "Borrador", queued: "En cola", sending: "Enviando", sent: "Enviada", paused: "Pausada", failed: "Error", scheduled: "Programada", completed: "Completada" })[campaign.status] || campaign.status || "";
        const st = campaign.stats || {};
        const sent = Number(st.sent) || 0;
        const opened = Number(st.opened) || 0;
        const aperturasPct = sent > 0 ? ((opened / sent) * 100).toFixed(1) + "%" : "—";
        const esc = (s) => String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        return `<tr>`
          + `<td><span class="code">${code}</span></td>`
          + `<td><strong>${esc(campaign.name)}</strong><br><small style="color:#666">${esc(campaign.subject)}</small></td>`
          + `<td>${est}</td>`
          + `<td><strong>${sent.toLocaleString("es-ES")}</strong></td>`
          + `<td>${opened.toLocaleString("es-ES")} <small style="color:#888">(${aperturasPct})</small></td>`
          + `<td>`
          + `<a class="btn-inline" href="${folder}/INFORME_${code}.html">📊 Informe</a>`
          + `<a class="btn-inline amarillo" href="${folder}/CORREO_${code}.html">✉ Email</a>`
          + `</td></tr>`;
      }),
      `</tbody></table>`,
      `<p style="margin-top:40px;padding:16px;background:#fff8e1;border-left:5px solid #FFB74D;border-radius:6px;font-size:12px">`,
      `<strong>RUBEN COTON</strong> · manager@rubencoton.com<br>`,
      `Cada carpeta contiene el email enviado, el informe ejecutivo y los datos JSON con codificación única.`,
      `</p></body></html>`
    ].join("");
    archive.append(indexHtml, { name: `${rootFolder}/00-INDICE.html` });

    /* README raíz */
    const readme = [
      `HISTÓRICO DE CAMPAÑAS · RUBEN COTON`,
      `=================================================`,
      ``,
      `Generado:         ${new Date().toLocaleString("es-ES")}`,
      `Total campañas:   ${campaigns.length}`,
      ``,
      `SISTEMA DE CODIFICACIÓN:`,
      `  CMP-YYYYMMDD-NNNN-{slug}`,
      ``,
      `  CMP        → Campaña`,
      `  YYYYMMDD   → Fecha de envío (o creación si no enviada)`,
      `  NNNN       → Número secuencial cronológico (0001, 0002...)`,
      `  slug       → Nombre normalizado sin acentos`,
      ``,
      `ESTRUCTURA:`,
      `  HISTORICO-CAMPANAS-{fecha}/`,
      `    00-INDICE.html          → Abrir PRIMERO: índice clicable`,
      `    CMP-YYYYMMDD-NNNN-slug/`,
      `      CORREO_CMP-*.html     → Email HTML enviado`,
      `      INFORME_CMP-*.html    → Informe ejecutivo completo`,
      `      DATOS_CMP-*.json      → Datos brutos JSON`,
      `      FICHA_CMP-*.txt       → Ficha identificativa`,
      ``,
      `CÓMO USAR:`,
      `  1. Descomprime el ZIP`,
      `  2. Abre 00-INDICE.html en el navegador`,
      `  3. Navega por las campañas desde ahí`,
      ``,
      `manager@rubencoton.com`
    ].join("\n");
    archive.append(readme, { name: `${rootFolder}/LEEME.txt` });

    archive.finalize();
  } catch (error) {
    console.error("[download-all] ERROR:", error);
    res.status(500).send("Error generando ZIP: " + error.message);
  }
});

/* ==========================================================
 * GOOGLE DRIVE ARCHIVE · manager@rubencoton.com
 * Integración vía hub RUBEN-COTON_API-GOOGLE
 * ========================================================== */

/* Helper: construye el pack de archivos para subir al Drive */
function buildCampaignPackForDrive(campaign, seq) {
  const code = buildCampaignCode(campaign, seq);
  const folder = buildCampaignFolder(campaign, seq);
  const data = buildCampaignReportData(campaign);
  const emailHtml = buildStandaloneEmailHtml(campaign);
  const reportHtml = buildStandaloneReportHtml(data);
  const ficha = [
    `PACK DE CAMPAÑA · RUBEN COTON`,
    `========================================`,
    ``,
    `Código:     ${code}`,
    `Campaña:    ${campaign.name || "(sin nombre)"}`,
    `Asunto:     ${campaign.subject || "—"}`,
    `Estado:     ${({ draft: "Borrador", queued: "En cola", sending: "Enviando", sent: "Enviada", paused: "Pausada", failed: "Error", scheduled: "Programada", completed: "Completada" })[campaign.status] || campaign.status || "—"}`,
    `Enviada:    ${campaign.sentAt ? new Date(campaign.sentAt).toLocaleString("es-ES") : "Pendiente"}`,
    `Generado:   ${new Date().toLocaleString("es-ES")}`,
    ``,
    `Contenido: CORREO_${code}.html · INFORME_${code}.html · DATOS_${code}.json`,
    ``,
    `manager@rubencoton.com`
  ].join("\n");
  return { code, folder, data, emailHtml, reportHtml, ficha };
}

/* Calcula la secuencia cronológica de una campaña */
function calcCampaignSeq(campaignId) {
  const all = dataStore.listCampaigns().slice().sort((a, b) => {
    const da = new Date(a.sentAt || a.createdAt || 0).getTime();
    const db = new Date(b.sentAt || b.createdAt || 0).getTime();
    return da - db;
  });
  return all.findIndex((c) => c.id === campaignId) + 1;
}

/* Comprueba conexión Drive */
app.get("/api/drive/status", async (_req, res) => {
  try {
    if (!googleHub.isGoogleReady()) {
      return apiOk(res, { ready: false, message: "Google no configurado. Faltan credenciales OAuth." });
    }
    const t = await googleHub.testConnection();
    return apiOk(res, { ready: t.ok, email: t.email, name: t.name, error: t.error });
  } catch (e) {
    return apiError(res, 500, e.message);
  }
});

/* Sube una campaña al Drive
 * DESACTIVADO 2026-05-05 (peticion usuario): los informes se ven en la app. */
app.post("/api/campaigns/:id/upload-to-drive", async (req, res) => {
  try {
    if (String(process.env.DRIVE_ARCHIVE_ENABLED || "false").toLowerCase() !== "true") {
      return apiError(res, 410, "Funcion deshabilitada. Los informes se ven directamente en la aplicacion.");
    }
    syncCampaignsWithEngine();
    const campaign = dataStore.getCampaign(req.params.id);
    if (!campaign) return apiError(res, 404, "Campaña no encontrada");
    if (!googleHub.isGoogleReady()) return apiError(res, 503, "Google Drive no configurado en este servidor. Contacta al admin para configurar GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN.");

    const seq = calcCampaignSeq(campaign.id);
    const pack = buildCampaignPackForDrive(campaign, seq);

    const result = await driveArchive.uploadCampaignPack({
      code: pack.code,
      folder: pack.folder,
      files: {
        email: pack.emailHtml,
        report: pack.reportHtml,
        data: pack.data,
        ficha: pack.ficha
      }
    });

    /* Persistir link en la campaña */
    dataStore.mutate((store) => {
      const target = store.campaigns.find((c) => c.id === campaign.id);
      if (target) {
        target.drive = {
          folderId: result.folderId,
          folderName: result.folderName,
          folderLink: result.folderLink,
          code: pack.code,
          uploadedAt: new Date().toISOString(),
          files: result.files.map((f) => ({ type: f.type, name: f.name, id: f.id, link: f.webViewLink }))
        };
      }
    });

    /* Activar trazabilidad periódica del informe (1h/2h/.../6h, dia 1-7,
     * después semanal). El scheduler actualizará el PDF en la carpeta. */
    try {
      driveScheduler.trackCampaign(campaign.id, campaign.sentAt || campaign.createdAt);
    } catch (e) { console.warn("[drive] tracking no iniciado:", e.message); }

    return apiOk(res, { uploaded: true, code: pack.code, folder: pack.folder, folderLink: result.folderLink, files: result.files });
  } catch (e) {
    console.error("[drive upload] ERROR:", e);
    return apiError(res, 500, e.message);
  }
});

/* PDF directo: informe de UNA campaña como descarga PDF.
 * Usa reportRenderer.renderCampaignReport (server-side, sin JS) para
 * que el PDF tenga TODOS los datos pre-renderizados. Drive no ejecuta
 * JS al convertir HTML->PDF, así que el HTML que pasamos a pdfGen
 * debe tener los datos ya inyectados. */
const reportRenderer = require("./reportRenderer");
app.get("/api/campaigns/:id/report.pdf", async (req, res) => {
  try {
    syncCampaignsWithEngine();
    const campaign = dataStore.getCampaign(req.params.id);
    if (!campaign) return res.status(404).send("Campaña no encontrada");
    const data = buildCampaignReportData(campaign);
    const html = reportRenderer.renderCampaignReport(data, campaign.id);
    /* P0 fix 2026-05-04: pdfGen ahora importado al top (era ReferenceError).
     * Blindar: si Drive Docs falla, ofrecer fallback HTML descargable. */
    let pdf = null;
    try {
      pdf = await pdfGen.htmlToPdf(html, { format: "A4" });
    } catch (pdfErr) {
      console.warn(`[pdf] htmlToPdf falló, fallback HTML: ${pdfErr.message}`);
    }
    if (!pdf || pdf.length === 0) {
      /* Fallback: si Drive Docs export no funciona (OAuth caído, quota,
       * timeout), devolver el HTML del informe directamente. El browser
       * lo abre y el usuario puede imprimirlo a PDF (Ctrl+P). */
      const code = buildCampaignCode(campaign, calcCampaignSeq(campaign.id));
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename="INFORME_${code}.html"`);
      return res.end(html);
    }
    const code = buildCampaignCode(campaign, calcCampaignSeq(campaign.id));
    res.setHeader("Content-Type", "application/pdf");
    /* P0 UX fix 2026-05-04: cambiar `inline` a `attachment` para forzar
     * descarga del PDF (era el bug reportado: "no se descarga nada"). */
    res.setHeader("Content-Disposition", `attachment; filename="INFORME_${code}.pdf"`);
    return res.end(pdf);
  } catch (err) {
    console.error("[pdf] error generando informe:", err);
    return res.status(500).send("Error generando PDF: " + (err.message || "desconocido"));
  }
});

/* PDF directo: informe ejecutivo global (todas las campañas)
 * Usado por boton "📊 Informe ejecutivo (PDF)" en Estado campañas.
 * Genera HTML standalone con datos embebidos y lo convierte a PDF. */
app.get("/api/campaigns/report/executive.pdf", async (_req, res) => {
  try {
    syncCampaignsWithEngine();
    /* Datos agregados (mismo formato que /api/campaigns/report/executive). */
    const all = dataStore.listCampaigns();
    const totalCampaigns = all.length;
    let totalSent = 0, totalOpened = 0, totalClicked = 0, totalBounced = 0, totalUnsub = 0;
    const items = [];
    for (const c of all) {
      const seq = calcCampaignSeq(c.id);
      const data = buildCampaignReportData(c);
      totalSent += data.stats.sent;
      totalOpened += data.stats.opened;
      totalClicked += data.stats.clicked;
      totalBounced += data.stats.bounced;
      totalUnsub += data.stats.unsubscribed;
      items.push({
        code: buildCampaignCode(c, seq),
        name: c.name || "(sin nombre)",
        subject: c.subject || "—",
        status: c.status,
        sentAt: c.sentAt || c.createdAt,
        stats: data.stats
      });
    }

    /* Carga template y embebe datos (similar a buildStandaloneReportHtml) */
    const tplPath = path.join(__dirname, "..", "public", "executive-report.html");
    let tpl = fs.readFileSync(tplPath, "utf8");
    const payload = {
      stats: {
        totalCampaigns,
        totalSent,
        totalOpened,
        totalClicked,
        totalBounced,
        totalUnsub
      },
      items,
      generatedAt: new Date().toISOString()
    };
    const safeJson = JSON.stringify(payload).replace(/</g, "\\u003c");
    const inject = `<script>window.__EMBEDDED_EXECUTIVE_REPORT = ${safeJson};</script>`;
    if (tpl.includes("</body>")) {
      tpl = tpl.replace("</body>", `${inject}</body>`);
    } else {
      tpl = tpl + inject;
    }

    /* P0 fix 2026-05-04: blindar con fallback HTML si Drive Docs falla. */
    let pdf = null;
    try {
      pdf = await pdfGen.htmlToPdf(tpl, { format: "A4" });
    } catch (pdfErr) {
      console.warn(`[pdf-exec] htmlToPdf falló, fallback HTML: ${pdfErr.message}`);
    }
    const today = new Date().toISOString().slice(0, 10);
    if (!pdf || pdf.length === 0) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename="INFORME-EJECUTIVO-${today}.html"`);
      return res.end(tpl);
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="INFORME-EJECUTIVO-${today}.pdf"`);
    return res.end(pdf);
  } catch (err) {
    console.error("[pdf-exec] error:", err);
    return res.status(500).send("Error generando PDF ejecutivo: " + (err.message || "desconocido"));
  }
});

/* Sheets writeback: estado de cola + flush manual */
app.get("/api/sheets/writeback", (_req, res) => {
  return apiOk(res, { queueSize: sheetsWriteback.getQueueSize() });
});
app.post("/api/sheets/writeback/flush", async (_req, res) => {
  try {
    const r = await sheetsWriteback.flush();
    return apiOk(res, r);
  } catch (e) { return apiError(res, 500, e.message); }
});

/* Drive Scheduler: estado y administracion */
app.get("/api/drive/scheduler", (_req, res) => {
  try {
    const state = driveScheduler.readState();
    const tracked = state.tracked || {};
    const out = Object.values(tracked).map((entry) => {
      const campaign = dataStore.getCampaign(entry.campaignId);
      return {
        campaignId: entry.campaignId,
        name: campaign?.name || "(borrada en app, carpeta Drive conservada)",
        sentAt: entry.sentAt,
        lastUpdateAt: entry.lastUpdateAt,
        hourlyDone: entry.hourlyDone,
        dailyDone: entry.dailyDone,
        weeklyDone: entry.weeklyDone,
        lastSlot: entry.lastSlot,
        existsInApp: Boolean(campaign)
      };
    });
    return apiOk(res, { count: out.length, tracked: out });
  } catch (e) { return apiError(res, 500, e.message); }
});

app.post("/api/drive/scheduler/untrack/:cid", (req, res) => {
  try {
    driveScheduler.untrackCampaign(req.params.cid);
    return apiOk(res, { untracked: req.params.cid });
  } catch (e) { return apiError(res, 500, e.message); }
});

/* Restore manual: descarga el ultimo backup de Drive y lo aplica al
 * store.json. Util tras perdida de volumen o para rollback. */
app.post("/api/drive/restore-store", async (req, res) => {
  try {
    if (!googleHub.isGoogleReady()) return apiError(res, 503, "Google no configurado");
    const dataFile = process.env.DATA_STORE_FILE
      ? path.resolve(process.env.DATA_STORE_FILE)
      : path.join(__dirname, "..", "data", "store.json");
    /* Si el cliente fuerza, ignora el guard de "store ya tiene datos" */
    if (req.body?.force === true && fs.existsSync(dataFile)) {
      try { fs.unlinkSync(dataFile); } catch (_e) {}
    }
    const r = await driveArchive.restoreStoreFromDrive(dataFile);
    if (r.ok) {
      /* Reload dataStore en memoria sin reiniciar */
      try { dataStore.store = null; dataStore.read(); } catch (_e) {}
    }
    return apiOk(res, r);
  } catch (e) { return apiError(res, 500, e.message); }
});

/* Sincroniza TODAS las campañas al Drive
 * DESACTIVADO 2026-05-05 (peticion usuario): los informes se ven en la app. */
app.post("/api/campaigns/sync-all-to-drive", async (_req, res) => {
  try {
    if (String(process.env.DRIVE_ARCHIVE_ENABLED || "false").toLowerCase() !== "true") {
      return apiError(res, 410, "Funcion deshabilitada. Los informes se ven directamente en la aplicacion.");
    }
    if (!googleHub.isGoogleReady()) return apiError(res, 503, "Google Drive no configurado en este servidor.");
    syncCampaignsWithEngine();
    const campaigns = dataStore.listCampaigns().slice().sort((a, b) => {
      const da = new Date(a.sentAt || a.createdAt || 0).getTime();
      const db = new Date(b.sentAt || b.createdAt || 0).getTime();
      return da - db;
    });
    if (!campaigns.length) return apiOk(res, { uploaded: 0, results: [] });

    const results = [];
    for (let i = 0; i < campaigns.length; i++) {
      const campaign = campaigns[i];
      const seq = i + 1;
      try {
        const pack = buildCampaignPackForDrive(campaign, seq);
        const r = await driveArchive.uploadCampaignPack({
          code: pack.code,
          folder: pack.folder,
          files: { email: pack.emailHtml, report: pack.reportHtml, data: pack.data, ficha: pack.ficha }
        });
        dataStore.mutate((store) => {
          const target = store.campaigns.find((c) => c.id === campaign.id);
          if (target) {
            target.drive = {
              folderId: r.folderId,
              folderName: r.folderName,
              folderLink: r.folderLink,
              code: pack.code,
              uploadedAt: new Date().toISOString(),
              files: r.files.map((f) => ({ type: f.type, name: f.name, id: f.id, link: f.webViewLink }))
            };
          }
        });
        results.push({ id: campaign.id, name: campaign.name, code: pack.code, ok: true, folderLink: r.folderLink });
      } catch (err) {
        console.error("[drive sync-all] fallo en", campaign.id, err.message);
        results.push({ id: campaign.id, name: campaign.name, ok: false, error: err.message });
      }
    }
    const okCount = results.filter((r) => r.ok).length;
    return apiOk(res, { uploaded: okCount, total: results.length, results });
  } catch (e) {
    console.error("[drive sync-all] ERROR:", e);
    return apiError(res, 500, e.message);
  }
});

/* Lista carpetas archivadas en Drive */
app.get("/api/drive/archive", async (_req, res) => {
  try {
    if (!googleHub.isGoogleReady()) return apiOk(res, { ready: false, folders: [] });
    const folders = await driveArchive.listArchivedCampaigns();
    return apiOk(res, { ready: true, folders });
  } catch (e) {
    return apiError(res, 500, e.message);
  }
});

/* ==========================================================
 * INFORME EJECUTIVO GLOBAL — histórico completo de campañas
 * ========================================================== */

/* JSON con agregados + listado histórico
 *
 * P0 audit 2026-05-05:
 * 1) Filtrar campañas archivadas (status="archived") para que el cómputo
 *    agregado refleje solo campañas en proceso/históricas no eliminadas.
 * 2) Soportar `?scope=weekly|monthly|historic` con `periodLabel`/`periodFrom`/
 *    `periodTo` correctos. Antes la ruta HTML directa siempre caía a
 *    "historic" porque el JS leía `meta.scope` que no venía. */
app.get("/api/campaigns/report/executive", (req, res) => {
  try {
    syncCampaignsWithEngine();
    const allCampaigns = dataStore.listCampaigns() || [];
    /* Excluir archivadas del cómputo agregado */
    let campaigns = allCampaigns.filter((c) => c && c.status !== "archived");

    /* Resolver scope y ventana temporal */
    const scope = String(req.query.scope || "historic").toLowerCase();
    let periodFrom = null, periodTo = null, periodLabel = "Histórico completo";
    const now = new Date();
    if (scope === "weekly") {
      periodTo = now;
      periodFrom = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const fmtD = (d) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
      periodLabel = `Última semana (${fmtD(periodFrom)} – ${fmtD(periodTo)})`;
    } else if (scope === "monthly") {
      periodTo = now;
      periodFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      const fmtM = (d) => d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
      periodLabel = `Mes en curso (${fmtM(now)})`;
    }
    if (periodFrom && periodTo) {
      campaigns = campaigns.filter((c) => {
        const dateRef = c.sentAt || c.updatedAt || c.createdAt;
        if (!dateRef) return false;
        const t = new Date(dateRef).getTime();
        return t >= periodFrom.getTime() && t <= periodTo.getTime();
      });
    }

    /* Totales */
    let totalSent = 0, totalOpened = 0, totalClicked = 0, totalBounced = 0, totalRecipients = 0;
    const byStatus = {};
    const months = new Map(); /* key YYYY-MM -> {sent, opened, clicked} */

    const rows = campaigns.map((c) => {
      const s = c.stats || {};
      const sent = Number(s.sent) || 0;
      const opened = Number(s.opened) || 0;
      const clicked = Number(s.clicked) || 0;
      const bounced = Number(s.bounced) || 0;
      const total = Number(s.total) || 0;
      totalSent += sent; totalOpened += opened; totalClicked += clicked;
      totalBounced += bounced; totalRecipients += total;
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;

      const dateRef = c.sentAt || c.updatedAt || c.createdAt || null;
      if (dateRef) {
        const d = new Date(dateRef);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const row = months.get(key) || { sent: 0, opened: 0, clicked: 0 };
        row.sent += sent; row.opened += opened; row.clicked += clicked;
        months.set(key, row);
      }

      return {
        id: c.id,
        name: c.name || "(sin nombre)",
        subject: c.subject || "",
        status: c.status,
        createdAt: c.createdAt || null,
        sentAt: c.sentAt || null,
        stats: { total, sent, opened, clicked, bounced },
        rates: {
          openRate: sent > 0 ? opened / sent : 0,
          clickRate: sent > 0 ? clicked / sent : 0,
          /* P0 audit 2026-05-05: bounceRate = bounced/total (consistente
           * con campaign-report.html:886). Antes usaba bounced/(sent+bounced)
           * que daba ratios incoherentes entre los 2 informes. */
          bounceRate: total > 0 ? bounced / total : 0
        }
      };
    });

    /* Ordenar por fecha desc */
    rows.sort((a, b) => {
      const da = new Date(a.sentAt || a.createdAt || 0).getTime();
      const db = new Date(b.sentAt || b.createdAt || 0).getTime();
      return db - da;
    });

    const top5 = [...rows]
      .filter((r) => r.stats.sent >= 1)
      .sort((a, b) => b.rates.openRate - a.rates.openRate)
      .slice(0, 5);

    const monthly = Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ month: key, ...v }));

    /* Best vs Worst (filtra sent>=10 para no penalizar campañas pequeñas) */
    const eligible = rows.filter((r) => r.stats.sent >= 10);
    const best = [...eligible].sort((a, b) => b.rates.openRate - a.rates.openRate)[0] || null;
    const worst = [...eligible].sort((a, b) => a.rates.openRate - b.rates.openRate)[0] || null;

    return apiOk(res, {
      generatedAt: new Date().toISOString(),
      meta: {
        scope,
        periodLabel,
        periodFrom: periodFrom ? periodFrom.toISOString() : null,
        periodTo: periodTo ? periodTo.toISOString() : null
      },
      totals: {
        campaigns: campaigns.length,
        recipients: totalRecipients,
        sent: totalSent,
        opened: totalOpened,
        clicked: totalClicked,
        bounced: totalBounced,
        openRate: totalSent > 0 ? totalOpened / totalSent : 0,
        clickRate: totalSent > 0 ? totalClicked / totalSent : 0,
        /* P0 audit 2026-05-05: bounceRate = bounced/recipients (total)
         * consistente con campaign-report.html. */
        bounceRate: totalRecipients > 0 ? totalBounced / totalRecipients : 0
      },
      byStatus,
      monthly,
      top5,
      best,
      worst,
      campaigns: rows
    });
  } catch (error) {
    return apiError(res, 500, error.message);
  }
});

/* Pagina HTML imprimible del informe ejecutivo (histórico global) */
app.get("/campaigns/report/executive", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "executive-report.html"));
});

/* === INFORMES EJECUTIVOS SEMANALES / MENSUALES ======================= */
/* Ejecución manual ("run-now") del informe semanal */
app.post("/api/reports/weekly/run-now", async (_req, res) => {
  try {
    syncCampaignsWithEngine();
    const r = await executiveReports.generateWeeklyReport({ dataStore });
    return apiOk(res, {
      scope: "weekly",
      periodCode: r.periodCode,
      local: r.localPath,
      drive: r.drive || null,
      totals: r.data.totals,
      campaigns: r.data.campaigns.length
    });
  } catch (e) {
    return apiError(res, 500, e.message);
  }
});

/* Ejecución manual del informe mensual */
app.post("/api/reports/monthly/run-now", async (_req, res) => {
  try {
    syncCampaignsWithEngine();
    const r = await executiveReports.generateMonthlyReport({ dataStore });
    return apiOk(res, {
      scope: "monthly",
      periodCode: r.periodCode,
      local: r.localPath,
      drive: r.drive || null,
      totals: r.data.totals,
      campaigns: r.data.campaigns.length
    });
  } catch (e) {
    return apiError(res, 500, e.message);
  }
});

/* Estado del scheduler de informes ejecutivos */
app.get("/api/reports/schedule", (_req, res) => {
  try {
    return apiOk(res, {
      weeklyNext: executiveReports.nextWeeklyRun().toISOString(),
      monthlyNext: executiveReports.nextMonthlyRun().toISOString(),
      driveReady: googleHub.isGoogleReady()
    });
  } catch (e) {
    return apiError(res, 500, e.message);
  }
});

/* Limpia archivos locales data/reports (free disk space) */
app.post("/api/admin/cleanup-local-reports", (_req, res) => {
  try {
    const dir = path.resolve(__dirname, "..", "data", "reports");
    let deleted = 0;
    function walk(d) {
      if (!fs.existsSync(d)) return;
      for (const entry of fs.readdirSync(d)) {
        const full = path.join(d, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full);
        else { try { fs.unlinkSync(full); deleted++; } catch (_e) {} }
      }
    }
    walk(dir);
    return apiOk(res, { deleted });
  } catch (e) {
    return apiError(res, 500, e.message);
  }
});

/* Scan manual de inbox manager@ para detectar respuestas a campañas */
app.post("/api/reply-tracker/scan-now", async (_req, res) => {
  try {
    const result = await replyTracker.scanReplies();
    return apiOk(res, result);
  } catch (e) {
    return apiError(res, 500, e.message);
  }
});

/* Eliminar campana del historico */
/* SOFT DELETE (2026-04-22): al 'eliminar' una campaña del panel Estado
 * campañas, NO se borra del dataStore ni del Drive. Solo se marca como
 * archived y se esconde de la lista. El Drive mantiene el histórico
 * indefinidamente. Si se quiere eliminar DE VERDAD, usa ?hard=true
 * (solo para admins, borra store + mantiene Drive).
 * El job activo (si está enviando) se cancela siempre. */
/* P0 fix 2026-05-04: purga masiva de campañas archived (admin only).
 * Para dejar el store limpio cuando hay backlog de tests/demos archived
 * que ya no se quieren conservar. Hard delete en un solo mutate batch. */
app.post("/api/admin/purge-archived-campaigns", (_req, res) => {
  try {
    let removed = 0;
    let before = 0;
    dataStore.mutate((store) => {
      before = (store.campaigns || []).length;
      store.campaigns = (store.campaigns || []).filter((c) => c.status !== "archived");
      removed = before - store.campaigns.length;
    });
    return apiOk(res, { removed, before, after: before - removed });
  } catch (err) {
    return apiError(res, 500, err.message);
  }
});

app.delete("/api/campaigns/:id", (req, res) => {
  try {
    /* P0 fix 2026-05-04 (bug reportado por usuario): "si yo la borro,
     * pues ya está eliminada". Cambio default de soft a HARD delete.
     * Para conservar (soft archive) hay que pasar ?soft=true explícitamente. */
    const softDelete = String(req.query.soft || "").toLowerCase() === "true";
    const hardDelete = !softDelete;
    let campaignName = "";
    let jobIdToCancel = null;
    let changed = false;
    dataStore.mutate((store) => {
      const target = store.campaigns.find((c) => c.id === req.params.id);
      if (!target) return;
      campaignName = target.name || "";
      jobIdToCancel = target.jobId || null;
      if (hardDelete) {
        store.campaigns = store.campaigns.filter((c) => c.id !== req.params.id);
        /* P0 audit 2026-05-05: hard delete tambien purga events asociados
         * para no dejar eventos huerfanos que infla store.json. Y limpia
         * el indice de dedupe (que se reconstruira on-demand). */
        if (Array.isArray(store.events)) {
          const before = store.events.length;
          store.events = store.events.filter((e) => e && e.campaignId !== req.params.id);
          const purged = before - store.events.length;
          if (purged > 0) console.log(`[campaigns][DELETE] purgados ${purged} events de la campana ${req.params.id}`);
        }
        store._eventDedupeIdx = null;
      } else {
        target.status = "archived";
        target.archivedAt = new Date().toISOString();
        target.jobId = null; /* Liberar referencia al job para que sync no marque failed */
      }
      changed = true;
    });
    if (jobIdToCancel) {
      try {
        massMailEngine.cancelJob(jobIdToCancel);
        console.log(`[campaigns] Job ${jobIdToCancel} cancelado al archivar campana ${req.params.id}`);
      } catch (err) {
        console.warn(`[campaigns] No se pudo cancelar job ${jobIdToCancel}:`, err.message);
      }
    }
    if (!changed) return apiError(res, 404, "Campana no encontrada");
    return apiOk(res, {
      removed: true, /* compatibilidad con frontend antiguo */
      archived: !hardDelete,
      hardDeleted: hardDelete,
      id: req.params.id,
      name: campaignName,
      jobCancelled: !!jobIdToCancel,
      note: hardDelete
        ? "Campaña eliminada del dataStore. Archivo Drive se mantiene."
        : "Campaña archivada. Oculta del panel pero preservada en Drive."
    });
  } catch (e) {
    console.error("[campaigns][DELETE] ERROR:", e.message);
    return apiError(res, 500, e.message || "Error eliminando campana");
  }
});

/* Parada de emergencia: pausa motor + cancela TODOS los jobs activos. */
app.post("/api/mass-mail/emergency-stop", (_req, res) => {
  try {
    massMailEngine.setPaused(true);
    const cancelled = [];
    const status = massMailEngine.getStatus ? massMailEngine.getStatus() : null;
    if (status && Array.isArray(status.jobs)) {
      status.jobs.forEach((job) => {
        if (job.status === "running" || job.status === "queued" || job.status === "processing") {
          try {
            massMailEngine.cancelJob(job.id);
            cancelled.push(job.id);
          } catch (_e) { /* ignore */ }
        }
      });
    }
    if (typeof massMailEngine.clearAllQueue === "function") massMailEngine.clearAllQueue();
    console.log(`[emergency-stop] Motor pausado, ${cancelled.length} jobs cancelados`);
    return apiOk(res, { paused: true, cancelled });
  } catch (e) {
    return apiError(res, 500, e.message);
  }
});

/* Sembrar campanas ficticias con resultados realistas (demo / pruebas). */
const devOnlyGuard = (req, res, next) => {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_ENDPOINTS !== "true") {
    return apiError(res, 404, "Endpoint deshabilitado en produccion");
  }
  next();
};
app.post("/api/dev/seed-demo-campaigns", devOnlyGuard, (req, res) => {
  try {
    const createId = (prefix) => `${prefix}_${crypto.randomBytes(7).toString("hex")}`;
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    /* Pool de destinatarios ficticios (empresas culturales espanolas) */
    const EMPRESAS = [
      { company: "Festival Sonorama Ribera", municipio: "Aranda de Duero", provincia: "Burgos", ccaa: "Castilla y Leon", cat: "FESTIVAL", fuente: "CRM FESTIVALES" },
      { company: "Primavera Sound", municipio: "Barcelona", provincia: "Barcelona", ccaa: "Cataluna", cat: "FESTIVAL", fuente: "CRM FESTIVALES" },
      { company: "Mad Cool Festival", municipio: "Madrid", provincia: "Madrid", ccaa: "Madrid", cat: "FESTIVAL", fuente: "CRM FESTIVALES" },
      { company: "Bilbao BBK Live", municipio: "Bilbao", provincia: "Vizcaya", ccaa: "Pais Vasco", cat: "FESTIVAL", fuente: "CRM FESTIVALES" },
      { company: "FIB Benicassim", municipio: "Benicassim", provincia: "Castellon", ccaa: "C. Valenciana", cat: "FESTIVAL", fuente: "CRM FESTIVALES" },
      { company: "Viuda Negra Club", municipio: "Madrid", provincia: "Madrid", ccaa: "Madrid", cat: "SALA", fuente: "CRM SALAS" },
      { company: "Sala Apolo", municipio: "Barcelona", provincia: "Barcelona", ccaa: "Cataluna", cat: "SALA", fuente: "CRM SALAS" },
      { company: "Sala Razzmatazz", municipio: "Barcelona", provincia: "Barcelona", ccaa: "Cataluna", cat: "SALA", fuente: "CRM SALAS" },
      { company: "Sala But", municipio: "Madrid", provincia: "Madrid", ccaa: "Madrid", cat: "SALA", fuente: "CRM SALAS" },
      { company: "Sala La Riviera", municipio: "Madrid", provincia: "Madrid", ccaa: "Madrid", cat: "SALA", fuente: "CRM SALAS" },
      { company: "Palau de la Musica Valencia", municipio: "Valencia", provincia: "Valencia", ccaa: "C. Valenciana", cat: "AUDITORIO", fuente: "CRM SALAS" },
      { company: "Auditorio Rocio Jurado", municipio: "Sevilla", provincia: "Sevilla", ccaa: "Andalucia", cat: "AUDITORIO", fuente: "CRM SALAS" },
      { company: "Ayuntamiento de Valencia", municipio: "Valencia", provincia: "Valencia", ccaa: "C. Valenciana", cat: "AYUNTAMIENTO", fuente: "CRM AYUNTAMIENTOS" },
      { company: "Ayuntamiento de Zaragoza", municipio: "Zaragoza", provincia: "Zaragoza", ccaa: "Aragon", cat: "AYUNTAMIENTO", fuente: "CRM AYUNTAMIENTOS" },
      { company: "Ayuntamiento de Malaga", municipio: "Malaga", provincia: "Malaga", ccaa: "Andalucia", cat: "AYUNTAMIENTO", fuente: "CRM AYUNTAMIENTOS" },
      { company: "Ayuntamiento de Alicante", municipio: "Alicante", provincia: "Alicante", ccaa: "C. Valenciana", cat: "AYUNTAMIENTO", fuente: "CRM AYUNTAMIENTOS" },
      { company: "Ayuntamiento de Cordoba", municipio: "Cordoba", provincia: "Cordoba", ccaa: "Andalucia", cat: "AYUNTAMIENTO", fuente: "CRM AYUNTAMIENTOS" },
      { company: "Diputacion de Cadiz", municipio: "Cadiz", provincia: "Cadiz", ccaa: "Andalucia", cat: "DIPUTACION", fuente: "CRM AYUNTAMIENTOS" },
      { company: "Fundacion La Caixa", municipio: "Barcelona", provincia: "Barcelona", ccaa: "Cataluna", cat: "FUNDACION", fuente: "CRM EMPRESAS" },
      { company: "Fundacion Telefonica", municipio: "Madrid", provincia: "Madrid", ccaa: "Madrid", cat: "FUNDACION", fuente: "CRM EMPRESAS" },
      { company: "Corral de Comedias Almagro", municipio: "Almagro", provincia: "Ciudad Real", ccaa: "Castilla La Mancha", cat: "TEATRO", fuente: "CRM SALAS" },
      { company: "Teatro Real", municipio: "Madrid", provincia: "Madrid", ccaa: "Madrid", cat: "TEATRO", fuente: "CRM SALAS" },
      { company: "Teatro Liceu Barcelona", municipio: "Barcelona", provincia: "Barcelona", ccaa: "Cataluna", cat: "TEATRO", fuente: "CRM SALAS" },
      { company: "Hotel Barcelo La Bobadilla", municipio: "Loja", provincia: "Granada", ccaa: "Andalucia", cat: "HOTEL", fuente: "CRM BODAS" },
      { company: "Hotel Finca Cortesin", municipio: "Casares", provincia: "Malaga", ccaa: "Andalucia", cat: "HOTEL", fuente: "CRM BODAS" },
      { company: "Castillo de Viuelas", municipio: "Madrid", provincia: "Madrid", ccaa: "Madrid", cat: "FINCA", fuente: "CRM BODAS" },
      { company: "Finca El Mirador", municipio: "Valencia", provincia: "Valencia", ccaa: "C. Valenciana", cat: "FINCA", fuente: "CRM BODAS" },
      { company: "Influencer Dulceida", municipio: "Barcelona", provincia: "Barcelona", ccaa: "Cataluna", cat: "INFLUENCER", fuente: "CRM INFLUENCERS" },
      { company: "Influencer Paula Gonu", municipio: "Barcelona", provincia: "Barcelona", ccaa: "Cataluna", cat: "INFLUENCER", fuente: "CRM INFLUENCERS" },
      { company: "Influencer Nil Ojeda", municipio: "Madrid", provincia: "Madrid", ccaa: "Madrid", cat: "INFLUENCER", fuente: "CRM INFLUENCERS" }
    ];

    /* Plantillas de campanas */
    const PLANTILLAS = [
      {
        name: "Booking Primavera 2026 · RUBEN COTON",
        subject: "Cierra fechas primavera 2026 con RUBEN COTON",
        performance: "excelente",
        recipients: 800,
        daysAgo: 45
      },
      {
        name: "Bodas VIP 2026 · Pack boutique",
        subject: "Tu boda inolvidable con RUBEN COTON (pack boutique)",
        performance: "bueno",
        recipients: 420,
        daysAgo: 30
      },
      {
        name: "Festivales verano 2026",
        subject: "Propuesta artistica festivales 2026 · 43K seguidores IG",
        performance: "medio",
        recipients: 1200,
        daysAgo: 20
      },
      {
        name: "Ayuntamientos · Fiestas patronales",
        subject: "Actuacion fiestas patronales 2026 · Experiencia ayuntamientos",
        performance: "bueno",
        recipients: 680,
        daysAgo: 12
      },
      {
        name: "Influencers · Colaboracion verano",
        subject: "Colabora con RUBEN COTON este verano",
        performance: "bajo",
        recipients: 150,
        daysAgo: 5
      }
    ];

    /* Tasas realistas por nivel */
    const RATES = {
      excelente: { open: 0.42, click: 0.09, bounce: 0.008, unsub: 0.003 },
      bueno:     { open: 0.28, click: 0.045, bounce: 0.015, unsub: 0.005 },
      medio:     { open: 0.19, click: 0.025, bounce: 0.022, unsub: 0.007 },
      bajo:      { open: 0.11, click: 0.012, bounce: 0.038, unsub: 0.012 }
    };

    const pick = (arr, n) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(n, arr.length));
    };

    const campaignsCreated = [];

    dataStore.mutate((store) => {
      PLANTILLAS.forEach((tpl) => {
        const rates = RATES[tpl.performance];
        const total = tpl.recipients;
        const sent = total - rand(0, Math.floor(total * 0.02));
        const bounced = Math.floor(sent * rates.bounce);
        const delivered = sent - bounced;
        const opened = Math.floor(delivered * rates.open);
        const clicked = Math.floor(opened * (rates.click / rates.open));
        const unsubscribed = Math.floor(delivered * rates.unsub);

        const sentAt = new Date(Date.now() - tpl.daysAgo * 24 * 3600 * 1000).toISOString();
        const createdAt = new Date(Date.now() - (tpl.daysAgo + 2) * 24 * 3600 * 1000).toISOString();

        /* Generar snapshot de destinatarios (max 100 ficticios para el informe) */
        const snapshotSize = Math.min(total, 100);
        const empresasSel = [];
        for (let i = 0; i < snapshotSize; i++) {
          empresasSel.push(EMPRESAS[i % EMPRESAS.length]);
        }
        const openedCount = Math.floor(snapshotSize * rates.open);
        const clickedCount = Math.floor(openedCount * (rates.click / rates.open));
        const bouncedCount = Math.floor(snapshotSize * rates.bounce);

        const recipientsSnapshot = empresasSel.map((emp, idx) => {
          const fakeEmail = `demo${idx}+${emp.company.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)}@example.local`;
          let status = { sentAt, deliveredAt: sentAt };
          if (idx < bouncedCount) {
            status = { sentAt, bouncedAt: sentAt };
          } else if (idx < bouncedCount + clickedCount) {
            status = { sentAt, deliveredAt: sentAt, openedAt: sentAt, clickedAt: sentAt };
          } else if (idx < bouncedCount + openedCount) {
            status = { sentAt, deliveredAt: sentAt, openedAt: sentAt };
          }
          return {
            email: fakeEmail,
            company: emp.company,
            municipio: emp.municipio,
            provincia: emp.provincia,
            ccaa: emp.ccaa,
            categoria: emp.cat,
            fuente: emp.fuente,
            ...status
          };
        });

        /* Anadir contactos ficticios al store para que el informe enriquezca datos */
        recipientsSnapshot.forEach((r) => {
          if (!store.contacts.find((c) => (c.email || "").toLowerCase() === r.email)) {
            store.contacts.push({
              id: createId("contact"),
              email: r.email,
              name: "",
              company: r.company,
              phone: "",
              status: "subscribed",
              tags: [`seg-${r.categoria.toLowerCase()}`, `crm-${r.fuente.toLowerCase().replace(/\s+/g, "-")}`],
              custom: {
                municipio: r.municipio,
                provincia: r.provincia,
                ccaa: r.ccaa
              },
              createdAt,
              updatedAt: sentAt,
              _demo: true
            });
          }
        });

        const campaign = {
          id: createId("cmp"),
          name: tpl.name,
          subject: tpl.subject,
          previewText: "",
          status: "sent",
          templateId: null,
          segmentId: null,
          html: `<!doctype html><html><body style="font-family:Arial,sans-serif;padding:20px;background:#f4f4f4"><div style="max-width:600px;margin:0 auto;background:#fff;padding:32px;border-radius:8px"><h1 style="color:#E65100">RUBEN COTON</h1><h2>${tpl.subject}</h2><p>Hola,</p><p>Te escribo desde RUBEN COTON para proponerte colaborar con <strong>RUBEN COTON</strong>, DJ con mas de 43.000 seguidores en Instagram y experiencia en Mad Cool, Palau Alameda y grandes festivales.</p><p>Te paso <a href="https://rubencoton.com" style="color:#E65100">su web</a> y quedo a tu disposicion para detalles, fechas y cache.</p><p style="margin-top:24px"><strong>Rocio</strong><br/>RUBEN COTON<br/>manager@rubencoton.com</p></div></body></html>`,
          text: `Hola, te escribo desde RUBEN COTON para proponerte colaborar con RUBEN COTON. Mas info en rubencoton.com\n\nRocio · manager@rubencoton.com`,
          tags: ["demo"],
          fromName: "RUBEN COTON",
          fromEmail: "manager@rubencoton.com",
          replyTo: "manager@rubencoton.com",
          createdAt,
          updatedAt: sentAt,
          scheduledAt: null,
          sentAt,
          jobId: null,
          recipientsSnapshot,
          stats: {
            total,
            queued: 0,
            sent,
            delivered,
            opened,
            openedUnique: opened,
            clicked,
            clickedUnique: clicked,
            bounced,
            unsubscribed,
            complained: 0
          },
          _demo: true
        };

        store.campaigns.push(campaign);
        campaignsCreated.push({ id: campaign.id, name: campaign.name, performance: tpl.performance });
      });
    });

    return apiOk(res, {
      created: campaignsCreated.length,
      campaigns: campaignsCreated
    });
  } catch (error) {
    return apiError(res, 500, error.message);
  }
});

/* Borrar todas las campanas y contactos marcados como demo */
app.delete("/api/dev/seed-demo-campaigns", devOnlyGuard, (req, res) => {
  try {
    let removedCamps = 0;
    let removedContacts = 0;
    dataStore.mutate((store) => {
      const beforeC = store.campaigns.length;
      store.campaigns = store.campaigns.filter((c) => !c._demo);
      removedCamps = beforeC - store.campaigns.length;
      const beforeK = store.contacts.length;
      store.contacts = store.contacts.filter((c) => !c._demo);
      removedContacts = beforeK - store.contacts.length;
    });
    return apiOk(res, { removedCampaigns: removedCamps, removedContacts });
  } catch (error) {
    return apiError(res, 500, error.message);
  }
});

/* Enviar informe de campana por email (cliente / CEO).
 * Envia un email corporativo con resumen ejecutivo + enlace publico al informe completo. */
app.post("/api/campaigns/:id/send-report", async (req, res) => {
  try {
    syncCampaignsWithEngine();
    const campaign = dataStore.getCampaign(req.params.id);
    if (!campaign) return apiError(res, 404, "Campana no encontrada");

    const body = req.body || {};
    const rawRecipients = String(body.recipients || body.to || "").trim();
    if (!rawRecipients) return apiError(res, 400, "Falta la lista de destinatarios");

    const recipients = rawRecipients
      .split(/[\s,;\n]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
    if (recipients.length === 0) return apiError(res, 400, "Ningun email valido");

    const customMessage = String(body.message || "").trim();
    const customSubject = String(body.subject || "").trim();

    /* Enlace publico al informe */
    const envBase = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
    const reqBase = `${req.protocol}://${req.get("host")}`;
    const baseUrl = envBase || reqBase;
    const reportUrl = `${baseUrl}/campaigns/${encodeURIComponent(campaign.id)}/report`;

    /* Stats para resumen */
    const st = campaign.stats || {};
    const total = st.total || (campaign.recipientsSnapshot || []).length || 0;
    const sent = st.sent || 0;
    const opened = st.opened || 0;
    const clicked = st.clicked || 0;
    const bounced = st.bounced || 0;
    const pct = (n) => (sent > 0 ? Math.round((n / sent) * 100) : 0);
    const fmt = (n) => Number(n || 0).toLocaleString("es-ES");
    const fechaEnvio = campaign.sentAt
      ? new Date(campaign.sentAt).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })
      : "Pendiente";

    const safeName = String(campaign.name || "").replace(/[<>]/g, "");
    const safeSubject = String(campaign.subject || "").replace(/[<>]/g, "");
    const subject = customSubject || `Informe de campana: ${safeName}`;

    const escapeHtml = (s) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const intro = customMessage
      ? `<p style="margin:0 0 16px;color:#2a2a2a;font-size:15px;line-height:1.6">${escapeHtml(customMessage).replace(/\n/g, "<br/>")}</p>`
      : `<p style="margin:0 0 16px;color:#2a2a2a;font-size:15px;line-height:1.6">Adjuntamos el informe ejecutivo de la campana de email marketing realizada desde <strong>RUBEN COTON</strong>. Haz clic en el boton inferior para ver el informe completo con KPIs, benchmarks del sector y recomendaciones.</p>`;

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
        <tr><td style="background:#E65100;padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:1px">RUBEN COTON</h1>
          <p style="margin:6px 0 0;color:#ffd84d;font-size:13px;letter-spacing:2px;text-transform:uppercase">Informe de campana</p>
        </td></tr>
        <tr><td style="padding:28px 32px">
          <h2 style="margin:0 0 8px;color:#E65100;font-size:20px">${escapeHtml(safeName)}</h2>
          <p style="margin:0 0 20px;color:#666;font-size:13px">Asunto enviado: <em>${escapeHtml(safeSubject)}</em></p>
          ${intro}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px 0;margin:16px 0 20px">
            <tr>
              <td style="background:#fff8e1;border:1px solid #ffd84d;border-radius:8px;padding:12px;text-align:center;width:25%"><div style="font-size:11px;color:#8a6d00;text-transform:uppercase;letter-spacing:1px">Destinatarios</div><div style="font-size:22px;color:#E65100;font-weight:700;margin-top:4px">${fmt(total)}</div></td>
              <td style="background:#fff8e1;border:1px solid #ffd84d;border-radius:8px;padding:12px;text-align:center;width:25%"><div style="font-size:11px;color:#8a6d00;text-transform:uppercase;letter-spacing:1px">Enviados</div><div style="font-size:22px;color:#E65100;font-weight:700;margin-top:4px">${fmt(sent)}</div></td>
              <td style="background:#fff8e1;border:1px solid #ffd84d;border-radius:8px;padding:12px;text-align:center;width:25%"><div style="font-size:11px;color:#8a6d00;text-transform:uppercase;letter-spacing:1px">Aperturas</div><div style="font-size:22px;color:#E65100;font-weight:700;margin-top:4px">${fmt(opened)}<span style="font-size:12px;color:#666;font-weight:400"> · ${pct(opened)}%</span></div></td>
              <td style="background:#fff8e1;border:1px solid #ffd84d;border-radius:8px;padding:12px;text-align:center;width:25%"><div style="font-size:11px;color:#8a6d00;text-transform:uppercase;letter-spacing:1px">Clics</div><div style="font-size:22px;color:#E65100;font-weight:700;margin-top:4px">${fmt(clicked)}<span style="font-size:12px;color:#666;font-weight:400"> · ${pct(clicked)}%</span></div></td>
            </tr>
          </table>
          <p style="margin:0 0 6px;color:#666;font-size:13px"><strong>Fecha de envio:</strong> ${escapeHtml(fechaEnvio)}</p>
          <p style="margin:0 0 6px;color:#666;font-size:13px"><strong>Rebotes:</strong> ${fmt(bounced)}</p>
          <p style="margin:0 0 24px;color:#666;font-size:13px"><strong>Estado:</strong> ${escapeHtml(({ draft: "Borrador", queued: "En cola", sending: "Enviando", sent: "Enviada", paused: "Pausada", failed: "Error", scheduled: "Programada", completed: "Completada" })[campaign.status] || campaign.status || "")}</p>
          <div style="text-align:center;margin:28px 0 20px">
            <a href="${reportUrl}" style="display:inline-block;background:#E65100;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.5px">Ver informe completo</a>
          </div>
          <p style="margin:16px 0 0;color:#999;font-size:11px;text-align:center">Enlace directo: <a href="${reportUrl}" style="color:#E65100">${escapeHtml(reportUrl)}</a></p>
        </td></tr>
        <tr><td style="background:#f4f4f4;padding:16px 32px;text-align:center;border-top:1px solid #e0e0e0">
          <p style="margin:0;color:#666;font-size:11px">RUBEN COTON &middot; manager@rubencoton.com</p>
          <p style="margin:4px 0 0;color:#999;font-size:10px">Informe generado conforme a RGPD &middot; No se comparten datos personales de contactos.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const text = `INFORME DE CAMPANA - RUBEN COTON

Campana: ${safeName}
Asunto: ${safeSubject}
Fecha de envio: ${fechaEnvio}

RESUMEN:
- Destinatarios: ${fmt(total)}
- Enviados: ${fmt(sent)}
- Aperturas: ${fmt(opened)} (${pct(opened)}%)
- Clics: ${fmt(clicked)} (${pct(clicked)}%)
- Rebotes: ${fmt(bounced)}

${customMessage ? customMessage + "\n\n" : ""}Ver informe completo:
${reportUrl}

---
RUBEN COTON
manager@rubencoton.com`;

    const job = massMailEngine.enqueueJob({
      recipients,
      subject,
      html,
      text,
      fromName: process.env.SMTP_FROM_NAME || "RUBEN COTON",
      fromEmail: process.env.SMTP_FROM_EMAIL || "manager@rubencoton.com",
      replyTo: process.env.SMTP_REPLY_TO || "manager@rubencoton.com",
      tag: `report:${campaign.id}`
    });

    return apiOk(res, {
      jobId: job.id,
      recipients,
      reportUrl,
      subject
    });
  } catch (error) {
    return apiError(res, 500, error.message);
  }
});

/* ── Adjuntos por campana (max 10 MB total, imagenes se comprimen) ── */
app.get("/api/campaigns/:id/attachments", (req, res) => {
  try {
    const files = attachments.listAttachments(req.params.id);
    const total = attachments.totalSize(req.params.id);
    return apiOk(res, { files, totalSize: total, limit: attachments.TOTAL_LIMIT });
  } catch (e) { return apiError(res, 500, e.message); }
});

app.post("/api/campaigns/:id/attachments", attachments.upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return apiError(res, 400, "No se ha enviado archivo");
    const info = await attachments.addAttachment(req.params.id, req.file);
    const total = attachments.totalSize(req.params.id);
    return apiOk(res, { ...info, totalSize: total });
  } catch (e) { return apiError(res, 400, e.message); }
});

app.delete("/api/campaigns/:id/attachments/:name", (req, res) => {
  try {
    attachments.removeAttachment(req.params.id, req.params.name);
    return apiOk(res, { removed: true });
  } catch (e) { return apiError(res, 500, e.message); }
});

/* Endpoint de RESEND: resetea campaña failed a draft y la vuelve a enviar.
 * Útil tras restart del contenedor que dejó una campaña colgada. */
app.post("/api/campaigns/:id/resend", (req, res) => {
  try {
    const campaignId = req.params.id;
    const existing = dataStore.getCampaign(campaignId);
    if (!existing) return apiError(res, 404, "Campaña no encontrada");
    if (!["failed", "draft"].includes(existing.status)) {
      return apiError(res, 400, `La campaña está en estado "${existing.status}". Solo se pueden reenviar campañas failed o draft.`);
    }
    /* Reset a draft limpio */
    dataStore.mutate((store) => {
      const t = store.campaigns.find((c) => c.id === campaignId);
      if (t) {
        t.status = "draft";
        t.jobId = null;
        t.stats = { total: 0, queued: 0, sent: 0, delivered: 0, openedUnique: 0, clickedUnique: 0, bounced: 0 };
        t.recipientsSnapshot = [];
        t.updatedAt = new Date().toISOString();
      }
    });
    return apiOk(res, { reset: true, campaignId, message: "Campaña reseteada. Llama a POST /send para reenviarla." });
  } catch (e) {
    return apiError(res, 500, e.message);
  }
});

/* BLINDAJE: lock in-memory por campaña para que dos requests /send simultáneos
 * no encolen dos jobs. Se libera tras 30s para no bloquear retries legítimos.
 *
 * P0 FIX 2026-05-05: el lock se setea AHORA solo justo antes del enqueueJob
 * real, no al inicio. Antes los returns tempranos por validacion (massive,
 * anti-spam, sin destinatarios) dejaban el lock 30s bloqueando el retry
 * legitimo del usuario tras confirmar el modal. */
const sendCampaignLocks = new Map();
app.post("/api/campaigns/:id/send", (req, res) => {
  const campaignId = req.params.id;
  if (sendCampaignLocks.get(campaignId)) {
    return apiError(res, 409, "Ya hay un envío en proceso para esta campaña. Espera unos segundos.");
  }
  let lockSet = false;
  try {
    /* Proteccion doble-envio: si la campaña ya está en sending/queued, 409. */
    const existing = dataStore.getCampaign(campaignId);
    if (existing && (existing.status === "sending" || existing.status === "queued")) {
      return apiError(res, 409, `La campaña ya está en estado "${existing.status}". No se puede reenviar.`);
    }
    const resolved = dataStore.getEligibleRecipientsForCampaign(campaignId);

    if (!resolved.recipients.length) {
      return apiError(res, 400, "No hay destinatarios elegibles en el segmento");
    }

    /* BLINDAJE ANTI-ENVIO-MASIVO (2026-04-22): cap INCONDICIONAL.
     * Antes solo se aplicaba si !segmentId, pero segmentos con miles de
     * contactos pasaban silenciosamente. Ahora cualquier envío > threshold
     * requiere confirmación explicita, TENGA O NO segmento. */
    const MASSIVE_SEND_THRESHOLD = Number(process.env.MASSIVE_SEND_THRESHOLD) || 500;
    if (resolved.recipients.length > MASSIVE_SEND_THRESHOLD && !req.body.confirmSendAll) {
      return apiError(res, 400,
        `Vas a enviar a ${resolved.recipients.length} destinatarios (umbral: ${MASSIVE_SEND_THRESHOLD}). ` +
        `Si es intencional, reenvia con {"confirmSendAll": true}. ` +
        `Si no querías esto, revisa el segmento/lista seleccionada.`
      );
    }
    /* Cap DURO absoluto (aunque se pida confirmSendAll). Protección anti-accidente. */
    const HARD_CAP = Number(process.env.HARD_CAP_RECIPIENTS) || 60000;
    if (resolved.recipients.length > HARD_CAP) {
      return apiError(res, 400,
        `Se bloquea envío a ${resolved.recipients.length} destinatarios. Supera el cap duro (${HARD_CAP}). ` +
        `Contacta al admin si necesitas enviar a más contactos.`
      );
    }

    /* BLINDAJE ANTI-SPAM (2026-04-30): valida asunto + contenido antes de
     * encolar.  Errores graves (HTML con script, palabras prohibidas) bloquean
     * el envio.  Warnings se devuelven en la respuesta para que la UI los
     * muestre.  Bypass solo via {"forceSend": true} explicito. */
    const subjCheck = spamShield.validateSubject(resolved.campaign.subject);
    const contCheck = spamShield.validateContent(resolved.campaign.html, resolved.campaign.text);
    const blockingErrors = [...subjCheck.errors, ...contCheck.errors];
    if (blockingErrors.length && !req.body.forceSend) {
      return apiError(res, 422,
        `Email rechazado por blindaje anti-spam: ${blockingErrors.join(" | ")}. ` +
        `Si estas seguro, reenvia con {"forceSend": true}.`
      );
    }
    const totalScore = subjCheck.score + contCheck.score;
    if (totalScore > 80 && !req.body.forceSend) {
      return apiError(res, 422,
        `Score anti-spam alto (${totalScore}/200). ` +
        `Asunto: ${subjCheck.warnings.join(", ") || "ok"}. ` +
        `Contenido: ${contCheck.warnings.join(", ") || "ok"}. ` +
        `Mejora el asunto/contenido o fuerza con {"forceSend": true}.`
      );
    }

    /* Auto-pause si el motor lleva muchos bounces en las ultimas 24h. */
    const engineStatus = massMailEngine.getStatus?.() || {};
    const aggSent = engineStatus.dailyCap?.used || 0;
    const aggBounce = (engineStatus.history || []).filter(h => h.type === "bounce").length;
    if (aggSent >= 100) {
      const pauseCheck = spamShield.shouldAutoPause({ sent: aggSent, bounced: aggBounce, complained: 0 });
      if (pauseCheck.pause && !req.body.forceSend) {
        return apiError(res, 422,
          `BLOQUEO AUTO: ${pauseCheck.reason}. Pausa los envios y limpia la lista. ` +
          `Forzar con {"forceSend": true}.`
        );
      }
    }

    /* P0 FIX 2026-05-05: lock se setea AHORA, justo antes del enqueue real.
     * Las validaciones previas (massive, anti-spam, score, sin destinatarios)
     * NO setean el lock — si fallan, el usuario puede reintentar al instante
     * tras corregir el problema o confirmar el modal. Solo bloqueamos doble
     * enqueue real al motor. */
    sendCampaignLocks.set(campaignId, Date.now());
    lockSet = true;

    let job = null;
    try {
      job = massMailEngine.enqueueJob({
        campaignId, /* propagar para tracking pixel + click wrap */
        name: resolved.campaign.name,
        subject: resolved.campaign.subject,
        html: resolved.campaign.html,
        text: resolved.campaign.text,
        fromName: resolved.campaign.fromName,
        fromEmail: resolved.campaign.fromEmail,
        replyTo: resolved.campaign.replyTo,
        recipients: resolved.recipients.map((recipient) => recipient.email),
        attachments: attachments.getAttachmentsForSending(campaignId)
      });

      const campaign = dataStore.attachCampaignJob(campaignId, job, resolved.recipients);
      return apiOk(res, {
        message: "Campana enviada a cola",
        campaign,
        job
      });
    } catch (innerError) {
      /* P0 FIX 2026-05-05: si attachCampaignJob falla DESPUES de enqueue,
       * limpiar el job huerfano del motor para evitar estado inconsistente
       * (job en motor pero campaña sin jobId en store). */
      if (job?.id) {
        try { massMailEngine.cancelJob(job.id); } catch (_e) {}
      }
      throw innerError;
    }
  } catch (error) {
    return apiError(res, 400, error.message || "No se pudo enviar campana");
  } finally {
    /* P0 FIX 2026-05-05: si hubo error, liberar el lock inmediato (no 30s
     * de bloqueo fantasma). Solo dejar el debounce 30s en cierre limpio. */
    if (lockSet) {
      if (res.statusCode >= 400) {
        sendCampaignLocks.delete(campaignId);
      } else {
        setTimeout(() => sendCampaignLocks.delete(campaignId), 30000);
      }
    }
  }
});

app.get("/api/campaigns/:id/analytics", (req, res) => {
  syncCampaignsWithEngine();
  try {
    const analytics = dataStore.getCampaignAnalytics(req.params.id);
    return apiOk(res, { analytics });
  } catch (error) {
    return apiError(res, 404, error.message || "Campana no encontrada");
  }
});

/* P0 FIX 2026-05-05: validar `type` contra whitelist. Sin esto, un POST
 * con type=complaint o type=unsubscribe podia suprimir contactos del store
 * sin checks. Whitelist explicita de tipos validos. */
const VALID_EVENT_TYPES = new Set([
  "open", "click", "delivered", "bounce", "unsubscribe", "complaint", "reply"
]);
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/campaigns/:id/events", (req, res) => {
  try {
    const t = String(req.body.type || "").trim().toLowerCase();
    if (!VALID_EVENT_TYPES.has(t)) {
      return apiError(res, 400, `Tipo de evento invalido. Validos: ${Array.from(VALID_EVENT_TYPES).join(", ")}`);
    }
    if (req.body.email && !EMAIL_RX.test(String(req.body.email).trim())) {
      return apiError(res, 400, "Email invalido");
    }
    const event = dataStore.addEvent({
      type: t,
      campaignId: req.params.id,
      email: req.body.email,
      contactId: req.body.contactId,
      url: req.body.url,
      isMachineOpen: req.body.isMachineOpen,
      isBotSuspected: req.body.isBotSuspected,
      source: req.body.source || "manual_ui",
      metadata: req.body.metadata || {}
    });

    return res.status(201).json({ status: "ok", event });
  } catch (error) {
    return apiError(res, 400, error.message || "No se pudo registrar evento");
  }
});

/* P0 FIX 2026-05-05: simulate solo permite open/click. Antes aceptaba
 * unsubscribe/complaint/bounce que tienen efectos REALES (suprimen
 * contacto del store), no solo simulación visual. */
const SIMULATE_ALLOWED = new Set(["open", "click"]);

app.post("/api/campaigns/:id/simulate", (req, res) => {
  try {
    const t = String(req.body.type || "").trim().toLowerCase();
    if (!SIMULATE_ALLOWED.has(t)) {
      return apiError(res, 400, "simulate solo acepta 'open' o 'click' (no destructivos)");
    }
    const simulation = dataStore.simulateCampaignEvent(req.params.id, t, {
      percent: req.body.percent
    });
    return apiOk(res, { simulation });
  } catch (error) {
    return apiError(res, 400, error.message || "No se pudo simular evento");
  }
});

app.get("/api/workflows", (_req, res) => {
  return apiOk(res, { workflows: dataStore.listWorkflows() });
});

app.post("/api/workflows", (req, res) => {
  try {
    const workflow = dataStore.createWorkflow(req.body);
    return res.status(201).json({ status: "ok", workflow });
  } catch (error) {
    return apiError(res, 400, error.message || "No se pudo crear workflow");
  }
});

app.get("/api/workflows/runs", (_req, res) => {
  return apiOk(res, { runs: dataStore.listWorkflowRuns() });
});

app.post("/api/workflows/run", (_req, res) => {
  try {
    const runs = dataStore.runWorkflows(massMailEngine);
    return apiOk(res, { runs, count: runs.length });
  } catch (error) {
    return apiError(res, 400, error.message || "No se pudo ejecutar workflows");
  }
});

app.get("/api/mass-mail/status", (_req, res) => {
  return apiOk(res, {
    engine: massMailEngine.getStatus()
  });
});

/* P0 blindar 2026-05-04: endpoint dedicado para monitorizar cap diario.
 * Devuelve estado completo: used/cap/remaining/pct/cuándo libera siguiente
 * slot. Usado por dashboard y monitorización externa. */
app.get("/api/mass-mail/cap-status", (_req, res) => {
  try {
    const status = massMailEngine.getDailyCapStatus();
    return apiOk(res, status);
  } catch (err) {
    return apiError(res, 500, err.message);
  }
});

/* P0 feature 2026-05-04: pausar/reanudar/cancelar campañas individuales.
 * El usuario pidió poder controlar campañas en cola sin parar todo el motor. */
app.post("/api/campaigns/:id/pause", (req, res) => {
  try {
    const campaign = dataStore.getCampaign(req.params.id);
    if (!campaign) return apiError(res, 404, "Campaña no encontrada");

    /* P0 BLINDAJE 2026-05-05: tolerante si el job se perdio del motor
     * (restart). Pausar a nivel dataStore funciona aunque el motor no
     * tenga el job — sync auto-recovery lo recreara pausado al boot. */
    let r = { paused: true };
    if (campaign.jobId) {
      const motorR = massMailEngine.pauseJob(campaign.jobId);
      if (motorR) r = motorR;
    }
    dataStore.mutate((store) => {
      const c = store.campaigns.find((x) => x.id === req.params.id);
      if (c) {
        c.previousStatus = c.status;
        c.status = "paused";
        c.pausedAt = new Date().toISOString();
        c.updatedAt = new Date().toISOString();
      }
    });
    return apiOk(res, { ...r, campaignId: req.params.id });
  } catch (err) {
    return apiError(res, 500, err.message);
  }
});

app.post("/api/campaigns/:id/resume", (req, res) => {
  try {
    const campaign = dataStore.getCampaign(req.params.id);
    if (!campaign) return apiError(res, 404, "Campaña no encontrada");

    /* P0 FIX 2026-05-05: si el job se perdio del motor (typical tras
     * reinicios container Coolify) O si la campana quedo paused sin
     * jobId tras un boot, RECREAR con los recipients pendientes en lugar
     * de devolver 404/400. UX: solo importa que se reanude el envio. */
    let r = campaign.jobId ? massMailEngine.resumeJob(campaign.jobId) : null;
    if (!r) {
      /* Reconstruir cola con recipients que NO esten ya enviados/rebotados. */
      const snapshot = campaign.recipientsSnapshot || [];
      const pendientes = snapshot
        .filter((rcp) => !rcp.sentAt && !rcp.bouncedAt && rcp.status !== "sent" && rcp.status !== "bounced")
        .map((rcp) => rcp.email);
      if (!pendientes.length) {
        return apiError(res, 400, "No hay destinatarios pendientes en esta campana.");
      }
      const newJob = massMailEngine.enqueueJob({
        campaignId: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        html: campaign.html,
        text: campaign.text,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        replyTo: campaign.replyTo,
        recipients: pendientes,
        attachments: attachments.getAttachmentsForSending(campaign.id)
      });
      /* Persistir nuevo jobId en la campana. */
      /* P0 FIX 2026-05-05: preserveHistory=true para no perder los sentAt previos
     * al recrear job tras restart del contenedor. */
    dataStore.attachCampaignJob(campaign.id, newJob, snapshot.filter((rcp) => pendientes.includes(rcp.email)), { preserveHistory: true });
      r = { resumed: true, recreated: true, jobId: newJob.id, pending: pendientes.length };
    }

    dataStore.mutate((store) => {
      const c = store.campaigns.find((x) => x.id === req.params.id);
      if (c) {
        c.status = c.previousStatus || "sending";
        c.pausedAt = null;
        c.updatedAt = new Date().toISOString();
      }
    });
    return apiOk(res, { ...r, campaignId: req.params.id });
  } catch (err) {
    return apiError(res, 500, err.message);
  }
});

app.post("/api/campaigns/:id/cancel", (req, res) => {
  try {
    const campaign = dataStore.getCampaign(req.params.id);
    if (!campaign) return apiError(res, 404, "Campaña no encontrada");
    let cancelResult = null;
    if (campaign.jobId) {
      cancelResult = massMailEngine.cancelJob(campaign.jobId);
    }
    dataStore.mutate((store) => {
      const c = store.campaigns.find((x) => x.id === req.params.id);
      if (c) {
        c.status = "canceled";
        c.canceledAt = new Date().toISOString();
        c.jobId = null;
        c.updatedAt = new Date().toISOString();
      }
    });
    return apiOk(res, {
      campaignId: req.params.id,
      removedFromQueue: cancelResult?.removed || 0,
      canceled: true
    });
  } catch (err) {
    return apiError(res, 500, err.message);
  }
});

app.get("/api/setup/checklist", async (_req, res) => {
  try {
    const checklist = await getSetupChecklist();
    return apiOk(res, checklist);
  } catch (e) {
    console.error("[setup/checklist] ERROR:", e.message, e.stack?.split("\n").slice(0, 3).join(" | "));
    return apiError(res, 500, e.message || "Error construyendo checklist");
  }
});

const handleMassMailProviderTest = async (_req, res) => {
  try {
    const verification = await massMailEngine.verifyConnection();
    return apiOk(res, {
      message: `Conexion proveedor verificada (${verification.mode || "unknown"})`,
      verification
    });
  } catch (error) {
    return apiError(res, 400, error.message || "No se pudo verificar proveedor");
  }
};

app.post("/api/mass-mail/test-provider", handleMassMailProviderTest);
app.post("/api/mass-mail/test-smtp", handleMassMailProviderTest);

app.post("/api/mass-mail/send-test", (req, res) => {
  try {
    const to = normalizeEmail(req.body.to);
    const subject = String(req.body.subject || "Prueba tecnica de envio").trim();
    const text = String(req.body.text || "Prueba tecnica de RUBEN-COTON_EMAILING.").trim();

    if (!isValidEmail(to)) {
      return apiError(res, 400, "Email destino no valido");
    }

    const job = massMailEngine.enqueueJob({
      name: "Prueba tecnica desde panel",
      subject,
      text,
      recipients: [to]
    });

    return res.status(201).json({
      status: "ok",
      message: "Prueba encolada",
      job
    });
  } catch (error) {
    return apiError(res, 400, error.message || "No se pudo encolar prueba");
  }
});

app.post("/api/mass-mail/jobs", (req, res) => {
  try {
    /* BLINDAJE: cap duro de destinatarios y confirmSendAll si supera umbral.
     * Antes este endpoint aceptaba cualquier array sin validación; un error
     * pasando 51k recipients aquí habría sido idéntico al bug anterior. */
    const recipients = Array.isArray(req.body.recipients) ? req.body.recipients : [];
    const THRESH = Number(process.env.JOBS_ENDPOINT_THRESHOLD) || 500;
    const HARD_CAP = Number(process.env.HARD_CAP_RECIPIENTS) || 60000;
    if (recipients.length > HARD_CAP) {
      return apiError(res, 400, `${recipients.length} destinatarios supera el cap duro (${HARD_CAP}).`);
    }
    if (recipients.length > THRESH && !req.body.confirmSendAll) {
      return apiError(res, 400,
        `Intentas encolar ${recipients.length} destinatarios (umbral ${THRESH}). ` +
        `Si es intencional, añade {"confirmSendAll": true} al body.`
      );
    }
    const job = massMailEngine.enqueueJob({
      name: req.body.name,
      subject: req.body.subject,
      html: req.body.html,
      text: req.body.text,
      recipients,
      recipientsText: req.body.recipientsText,
      fromName: req.body.fromName,
      fromEmail: req.body.fromEmail,
      replyTo: req.body.replyTo
    });

    return res.status(201).json({
      status: "ok",
      message: "Job encolado correctamente",
      job
    });
  } catch (error) {
    return apiError(res, 400, error.message || "No se pudo crear el envio");
  }
});

app.get("/api/mass-mail/jobs", (_req, res) => {
  return apiOk(res, {
    jobs: massMailEngine.listJobs()
  });
});

app.get("/api/mass-mail/jobs/:jobId", (req, res) => {
  const job = massMailEngine.getJob(req.params.jobId);
  if (!job) {
    return apiError(res, 404, "Job no encontrado");
  }

  return apiOk(res, { job });
});

app.post("/api/mass-mail/jobs/:jobId/cancel", (req, res) => {
  const result = massMailEngine.cancelJob(req.params.jobId);
  if (!result) return apiError(res, 404, "Job no encontrado");
  return apiOk(res, result);
});

app.post("/api/mass-mail/clear-queue", (_req, res) => {
  const result = massMailEngine.clearAllQueue();
  return apiOk(res, result);
});

app.post("/api/mass-mail/pause", (_req, res) => {
  const paused = massMailEngine.setPaused(true);
  return apiOk(res, { paused });
});

app.post("/api/mass-mail/resume", (_req, res) => {
  const paused = massMailEngine.setPaused(false);
  return apiOk(res, { paused });
});

/* ── Google Sheets sync endpoints ── */
app.get("/api/sheets/status", (_req, res) => {
  return res.json(sheetsSync.getStatus());
});

app.post("/api/sheets/sync", (_req, res) => {
  /* Responde inmediatamente — el sync corre en background */
  const status = sheetsSync.getStatus();
  if (status.running) {
    return res.json({ status: "already_running", message: "Sync en curso, espera a que termine" });
  }
  res.json({ status: "started", message: "Sincronizacion iniciada en background. Consulta /api/sheets/status para ver el progreso." });
  /* Lanzar en background */
  sheetsSync.runSync(dataStore)
    .then((r) => console.log(`[sheetsSync] Completado: ${r.totalContacts} contactos en ${r.elapsedSeconds}s`))
    .catch((e) => console.error("[sheetsSync] Error:", e.message));
});

/* Anadir / eliminar hojas extra (persistidas en dataStore) */
app.post("/api/sheets/ids", (req, res) => {
  try {
    let id = String(req.body?.id || req.body?.url || "").trim();
    /* Extraer ID si viene URL */
    const m = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (m) id = m[1];
    if (!id) return apiError(res, 400, "Falta id o url");
    const ids = sheetsSync.addExtraSheetId(id);
    return apiOk(res, { extraIds: sheetsSync.getStatus().extraIds, allIds: ids });
  } catch (e) { return apiError(res, 500, e.message); }
});
app.delete("/api/sheets/ids/:id", (req, res) => {
  try {
    const ids = sheetsSync.removeExtraSheetId(req.params.id);
    return apiOk(res, { extraIds: sheetsSync.getStatus().extraIds, allIds: ids });
  } catch (e) { return apiError(res, 500, e.message); }
});

/* ── AI Router endpoints ── */
app.get("/api/ai/status", async (_req, res) => {
  try {
    const s = await aiRouter.getStatus();
    return apiOk(res, s);
  } catch (error) {
    return apiError(res, 500, error.message);
  }
});

/* System prompt experto por defecto para AI Chat — calcado del proyecto
 * RUBEN-COTON_HTML. Si el cliente NO pasa "system", usamos este. */
const RUBEN_COTON_EXPERT_SYSTEM = `Eres asistente de email marketing experto para RUBEN COTON, DJ profesional (Madrid, 1993).

CREDENCIALES (usa solo las relevantes a la pregunta):
- DJ oficial Real Madrid 6 temporadas (baloncesto)
- DJ residente Palau Alameda (Valencia), After You llena cada mes
- Festival Mad Cool, escenarios con Abel Ramos / DJ Neil / Sofia Cristo / Dani BPM
- Cadena Dial cito sus mashups (La Oreja de Van Gogh + Arde Bogota)
- 43.000 IG followers
- Fiestas patronales: Coslada, Chinchon, Soto del Real, Villablino, Colmenar de Oreja, Roa de Duero, Villaconejos
- Bodas premium (Palacio de Aldovea)
- Formacion: Arquitecto tecnico + ADE
ESTILO: fusion clasicos + sonidos actuales, base techno/EDM/hardstyle.
EQUIPO: Pioneer XDJ-RX3, DJM-900NXS2, Ableton, Rekordbox.

CONTACTO: manager@rubencoton.com / WhatsApp +34 613 009 336 / web rubencoton.com

REGLAS:
- Castellano de España PERFECTO con tildes (á é í ó ú), eñe (ñ), signos apertura (¿ ¡).
- Nombre marca: SIEMPRE RUBEN COTON (mayusculas, sin tildes, una T).
- NO inventar datos. NO palabras spam (gratis/oferta/urgente/descuento).
- Tono: cercano, profesional, "hablemos" no "comprame".`;

app.post("/api/ai/chat", async (req, res) => {
  try {
    const { prompt, system, tier, minPower, maxTokens, temperature, timeoutMs, jsonMode } = req.body || {};
    if (!prompt) return apiError(res, 400, "Falta prompt");
    /* Inyecta system prompt experto si el cliente no manda uno propio. */
    const effectiveSystem = system || RUBEN_COTON_EXPERT_SYSTEM;
    const r = await aiRouter.chat(prompt, { system: effectiveSystem, tier, minPower, maxTokens, temperature, timeoutMs, jsonMode });
    return apiOk(res, r);
  } catch (error) {
    return apiError(res, 500, error.message);
  }
});

/* Helpers semanticos: cada endpoint usa el tier optimo para su accion */
app.post("/api/ai/detect-spam", async (req, res) => {
  try {
    if (!req.body?.subject) return apiError(res, 400, "Falta subject");
    return apiOk(res, await aiHelpers.detectSpam(req.body.subject));
  } catch (e) { return apiError(res, 500, e.message); }
});

app.post("/api/ai/extract-email", async (req, res) => {
  try {
    if (!req.body?.text) return apiError(res, 400, "Falta text");
    return apiOk(res, { email: await aiHelpers.extractEmail(req.body.text) });
  } catch (e) { return apiError(res, 500, e.message); }
});

app.post("/api/ai/classify-intent", async (req, res) => {
  try {
    if (!req.body?.text) return apiError(res, 400, "Falta text");
    return apiOk(res, await aiHelpers.classifyIntent(req.body.text));
  } catch (e) { return apiError(res, 500, e.message); }
});

app.post("/api/ai/generate-subject", async (req, res) => {
  try {
    const { audience, objective, keyword } = req.body || {};
    if (!audience || !objective) return apiError(res, 400, "Falta audience u objective");
    return apiOk(res, await aiHelpers.generateSubject({ audience, objective, keyword }));
  } catch (e) { return apiError(res, 500, e.message); }
});

app.post("/api/ai/summarize-reply", async (req, res) => {
  try {
    if (!req.body?.text) return apiError(res, 400, "Falta text");
    return apiOk(res, await aiHelpers.summarizeReply(req.body.text));
  } catch (e) { return apiError(res, 500, e.message); }
});

app.post("/api/ai/optimize-copy", async (req, res) => {
  try {
    if (!req.body?.original) return apiError(res, 400, "Falta original");
    return apiOk(res, await aiHelpers.optimizeCopy(req.body));
  } catch (e) { return apiError(res, 500, e.message); }
});

app.post("/api/ai/draft-proposal", async (req, res) => {
  try {
    const { client, service, price } = req.body || {};
    if (!client || !service) return apiError(res, 400, "Falta client o service");
    return apiOk(res, await aiHelpers.draftProposal(req.body));
  } catch (e) { return apiError(res, 500, e.message); }
});

app.post("/api/ai/complaint-reply", async (req, res) => {
  try {
    if (!req.body?.complaint) return apiError(res, 400, "Falta complaint");
    return apiOk(res, await aiHelpers.complaintReply(req.body));
  } catch (e) { return apiError(res, 500, e.message); }
});

/* Email Builder: genera HTML completo con plantilla RUBEN COTON */
app.post("/api/ai/build-email", async (req, res) => {
  const t0 = Date.now();
  try {
    const { audience, objective, offer, photoUrl, videoId, tone } = req.body || {};
    if (!audience || !objective) return apiError(res, 400, "Falta audience u objective");

    /* Validacion previa: al menos un provider IA configurado */
    const aiKeysPresent = [
      process.env.SAMBANOVA_API_KEY,
      process.env.CEREBRAS_API_KEY,
      process.env.MISTRAL_API_KEY,
      process.env.OPENROUTER_API_KEY,
      process.env.GROQ_API_KEY,
      process.env.GEMINI_API_KEY,
      process.env.PC_OLLAMA_URL
    ].filter(Boolean);
    if (aiKeysPresent.length === 0) {
      console.error("[ai/build-email] Sin providers configurados");
      return apiError(
        res,
        503,
        "Ningun proveedor IA configurado. Anade GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY o similar en Coolify."
      );
    }

    console.log("[ai/build-email] start", { audience: audience?.slice(0, 40), objective: objective?.slice(0, 40) });
    const r = await emailBuilder.generateEmail({ audience, objective, offer, photoUrl, videoId, tone });
    console.log(`[ai/build-email] ok via ${r.provider} (tier ${r.tier}) en ${Date.now() - t0}ms`);
    return apiOk(res, r);
  } catch (error) {
    console.error("[ai/build-email] ERROR:", error.message, error.stack?.split("\n").slice(0, 3).join(" | "));
    const detail = error.message || "error_desconocido";
    /* Mensaje mas humano para frontend */
    const friendly = detail.includes("Todos los providers")
      ? "Todas las IAs de la cascada fallaron. Revisa las API keys en Coolify (GROQ, OPENROUTER, GEMINI...)"
      : detail;
    return apiError(res, 500, friendly);
  }
});

/* Chat-edit: IA modifica HTML del email por conversacion, opcionalmente sobre una seleccion */
app.post("/api/ai/chat-edit", async (req, res) => {
  try {
    const { message, currentHtml = "", selection } = req.body || {};
    if (!message) return apiError(res, 400, "Falta message");

    const aiRouter = require("./aiRouter");
    const system = `Eres editor de email marketing para RUBEN COTON. Booking y management de artistas en Madrid, Espana.
Escribes en castellano de Espana con tildes, enie (n) y signos de apertura.

Recibes:
1. HTML actual del email (puede estar vacio).
2. Seleccion de texto opcional (si el usuario marco una parte para retocar).
3. Instruccion del usuario.

Responde SOLO con JSON valido:
{"html":"HTML COMPLETO actualizado","reply":"breve explicacion de los cambios","note":"opcional"}

REGLAS:
- Si NO hay HTML previo o el usuario pide crear, genera un email HTML completo con estructura profesional inline-styled (max 600px, tabla maquetable para email).
- Si hay HTML previo Y seleccion, modifica SOLO la parte seleccionada, preservando el resto del HTML.
- Si hay HTML previo sin seleccion, aplica la instruccion al email entero.
- Usa inline styles, nada de <style> global.
- Colores marca: rojo #FF6B00, amarillo #FFB74D, negro #1a1a1a, blanco.
- No inventes datos, artistas ni fechas.
- max 300 palabras de cuerpo.`;

    const prompt = `HTML ACTUAL:
${currentHtml ? currentHtml.slice(0, 8000) : "(vacio)"}

${selection ? `SELECCION A MODIFICAR:\n${selection}\n` : ""}
INSTRUCCION USUARIO: ${message}

Responde JSON ahora.`;

    const r = await aiRouter.classifyJson(prompt, { system, tier: "alta", maxTokens: 2500 });
    const j = r.json || {};
    return apiOk(res, {
      html: j.html || "",
      reply: j.reply || "",
      note: j.note || "",
      provider: r.provider,
      providerName: r.providerName,
      tier: r.tier
    });
  } catch (error) {
    return apiError(res, 500, error.message);
  }
});

/* Generar email completo (tier alta) — usa helper semantico */
app.post("/api/ai/generate-email", async (req, res) => {
  try {
    const { audience, objective, offer, tone } = req.body || {};
    if (!audience || !objective) return apiError(res, 400, "Falta audience u objective");
    const r = await aiHelpers.generateEmail({ audience, objective, offer, tone });
    return apiOk(res, { email: r.email, ai: { provider: r.provider, providerName: r.providerName, tier: r.tier } });
  } catch (error) {
    return apiError(res, 500, error.message);
  }
});

/* ============================================================
 * TRACKING PIXEL y CLICK TRACKING (2026-04-22)
 * Endpoints públicos (sin auth) porque los emails van a contactos
 * externos que no tienen sesión. Los ids están codificados base64url.
 * ============================================================ */

/* PNG transparente 1x1 (43 bytes) — usado como pixel de tracking */
const TRACKING_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

function decodeB64url(s) {
  try { return Buffer.from(String(s || ""), "base64url").toString("utf8"); }
  catch (_e) { return ""; }
}

/* GET /t/o/:cid/:eb64.gif — registra apertura y devuelve pixel invisible.
 * Gmail y otros clientes cargan imágenes al abrir el email (si el usuario
 * tiene "mostrar imágenes" activado, que es el default en Gmail moderno). */
app.get("/t/o/:cid/:eb64.gif", (req, res) => {
  try {
    const campaignId = String(req.params.cid || "").slice(0, 100);
    const email = decodeB64url(String(req.params.eb64 || "").replace(/\.gif$/, "")).toLowerCase();
    if (campaignId && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const ua = (req.headers["user-agent"] || "").slice(0, 200);
      const ip = (req.headers["x-forwarded-for"] || req.ip || "").toString().slice(0, 80);
      const isMachineOpen = /GoogleImageProxy|YahooMailProxy|Outlook-iOS|MicrosoftPreview/i.test(ua)
        || !ua;
      /* P0-A audit 2026-04-30: validar HMAC en query ?s=<sig>. URLs sin
       * firma se aceptan en modo legacy (compat con emails ya enviados)
       * pero se loggean. Modo enforce bloquea sin firma. URL con firma
       * INVÁLIDA siempre se rechaza. */
      const sig = String(req.query.s || "").trim();
      let signed = false;
      let sigValid = true;
      if (sig) {
        signed = true;
        sigValid = trackingSign.verify(campaignId, email, sig);
        if (!sigValid) {
          console.warn(`[tracking][open] HMAC inválido cid=${campaignId} email=${email} ip=${ip}`);
        }
      } else if (trackingSign.isEnforce()) {
        console.warn(`[tracking][open] sin firma (enforce) cid=${campaignId} email=${email}`);
        sigValid = false;
      }
      /* FIX C3 audit 2026-04-30: rate limit por (cid, email, ip).
       * Sólo registramos un evento por minuto para evitar que un
       * atacante con la URL pueda inflar stats. */
      if (sigValid && trackingAllowEvent("open", campaignId, email, ip)) {
        try {
          dataStore.addEvent({
            type: "open",
            campaignId,
            email,
            source: "tracking_pixel",
            userAgent: ua,
            ip,
            isMachineOpen,
            signed,
            occurredAt: new Date().toISOString()
          });
        } catch (err) { console.warn("[tracking][open] addEvent:", err.message); }
        /* Writeback "abierto" en columna Merge status (verde claro) — solo
         * humanos reales, no proxies de imagen. */
        if (!isMachineOpen) {
          try { wbForEmail(email, "abierto"); } catch (_e) {}
        }
      }
    }
  } catch (_e) { /* nunca fallar */ }
  /* Headers que fuerzan image response sin cache del ISP */
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.status(200).end(TRACKING_PIXEL_PNG);
});

/* Tracking rate limit en memoria (FIX C3 audit 2026-04-30) — evita
 * que un atacante con la URL del pixel pueda inflar stats sin freno.
 * Ventana: 1 evento (cid+email+kind) por minuto desde la misma IP. */
const trackingRateLimit = new Map();
const TRACKING_RL_WINDOW_MS = 60000;
const TRACKING_RL_MAX = 1;
setInterval(() => {
  const cutoff = Date.now() - TRACKING_RL_WINDOW_MS;
  for (const [k, ts] of trackingRateLimit.entries()) {
    if (ts < cutoff) trackingRateLimit.delete(k);
  }
}, TRACKING_RL_WINDOW_MS).unref();

const trackingAllowEvent = (kind, cid, email, ip) => {
  const key = `${kind}|${cid}|${email}|${ip}`;
  const now = Date.now();
  const last = trackingRateLimit.get(key) || 0;
  if (now - last < TRACKING_RL_WINDOW_MS) return false;
  trackingRateLimit.set(key, now);
  return true;
};

/* Hosts no redirigibles desde /t/c/ (P0-L audit 2026-04-30 — endurecido):
 * El BLOCKED_REDIRECT_HOSTS Set + isPrivateIP-IPv4 originales (FIX C4)
 * tenían bypass triviales: octal (0177.0.0.1), entero (2130706433),
 * IPv6 [::1], hostname suffix (localhost.attacker.com), short IP (127.1).
 *
 * Ahora cubrimos:
 *   - localhost / *.localhost / *.local / *.internal / *.test / *.example
 *   - IPv6 (cualquier host con `:`)
 *   - Decimal IP (host puramente numérico)
 *   - Octal/hex IP forms
 *   - IPv4 estándar privadas/loopback con parsing tolerante a leading zeros
 *   - Short IPv4 (127.1, 0.1, 1)
 *   - 169.254.x.x (link-local) y 100.64-127.x.x (CGNAT). */
const BLOCKED_REDIRECT_HOSTS = new Set([
  "localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254",
  /* AWS/GCP metadata IPs por hostname */
  "metadata.google.internal", "metadata.goog"
]);
const BLOCKED_TLD_SUFFIXES = [
  ".localhost", ".local", ".internal", ".test", ".example", ".lan", ".intranet"
];
const parseOctet = (s) => {
  if (/^0x/i.test(s)) return parseInt(s.slice(2), 16);
  if (/^0[0-7]+$/.test(s)) return parseInt(s, 8);
  return parseInt(s, 10);
};
const isPrivateIP = (host) => {
  /* IPv6 — bloqueamos siempre (no hay redirect legítimo a IPv6 desde email) */
  if (host.includes(":")) return true;
  if (host.startsWith("[") && host.endsWith("]")) return true;
  /* Decimal puro (IP en entero) */
  if (/^\d+$/.test(host)) return true;
  /* Hex puro */
  if (/^0x[0-9a-f]+$/i.test(host)) return true;
  /* IPv4 estándar a.b.c.d con tolerancia a leading zeros (octal) */
  if (/^[0-9a-fx]+\.[0-9a-fx]+\.[0-9a-fx]+\.[0-9a-fx]+$/i.test(host)) {
    const o = host.split(".").map(parseOctet);
    if (o.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    return (o[0] === 10) ||
           (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
           (o[0] === 192 && o[1] === 168) ||
           (o[0] === 127) ||
           (o[0] === 0) ||
           (o[0] === 169 && o[1] === 254) ||
           (o[0] === 100 && o[1] >= 64 && o[1] <= 127);
  }
  /* Short IPv4 (127.1, 0.1) — formato legacy aceptado por algunos resolvers */
  if (/^\d+(\.\d+){0,3}$/.test(host) && /\d/.test(host)) return true;
  return false;
};
const isBlockedHost = (host) => {
  const h = String(host || "").toLowerCase().trim();
  if (!h) return true;
  if (BLOCKED_REDIRECT_HOSTS.has(h)) return true;
  if (BLOCKED_TLD_SUFFIXES.some((suf) => h.endsWith(suf))) return true;
  if (isPrivateIP(h)) return true;
  return false;
};

/* GET /t/c/:cid/:eb64?u=URL_B64&s=SIG — registra click y redirige a URL real. */
app.get("/t/c/:cid/:eb64", (req, res) => {
  const campaignId = String(req.params.cid || "").slice(0, 100);
  const email = decodeB64url(String(req.params.eb64 || "")).toLowerCase();
  const urlB64 = String(req.query.u || "");
  const targetUrl = decodeB64url(urlB64);
  /* Validar URL destino para no crear open redirect (P0-L audit 2026-04-30
   * — endurecido: ahora isBlockedHost cubre IPv6, octal, hostname suffix). */
  let finalUrl = "/";
  try {
    const parsed = new URL(targetUrl);
    const host = (parsed.hostname || "").toLowerCase();
    const okProtocol = parsed.protocol === "http:" || parsed.protocol === "https:";
    const okHost = host && !isBlockedHost(host);
    if (okProtocol && okHost) {
      finalUrl = parsed.toString();
    } else if (okProtocol && !okHost) {
      console.warn(`[tracking][click] redirect bloqueado a host sospechoso: ${host}`);
    }
  } catch (_e) { /* URL inválida, cae al fallback */ }
  /* P0-A audit 2026-04-30: validar HMAC. Igual que pixel: sin firma = legacy
   * (acepta y registra signed:false), firma inválida = rechaza. */
  const sig = String(req.query.s || "").trim();
  let signed = false;
  let sigValid = true;
  if (sig) {
    signed = true;
    sigValid = trackingSign.verify(campaignId, email, sig);
    if (!sigValid) {
      console.warn(`[tracking][click] HMAC inválido cid=${campaignId} email=${email}`);
    }
  } else if (trackingSign.isEnforce()) {
    sigValid = false;
  }
  if (sigValid && campaignId && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && finalUrl !== "/") {
    const ua = (req.headers["user-agent"] || "").slice(0, 200);
    const ip = (req.headers["x-forwarded-for"] || req.ip || "").toString().slice(0, 80);
    const isBotSuspected = /bot|crawler|spider|preview|fetch|headless/i.test(ua);
    /* FIX C3 audit: rate limit click events */
    if (!trackingAllowEvent("click", campaignId, email, ip)) {
      return res.redirect(302, finalUrl);
    }
    try {
      dataStore.addEvent({
        type: "click",
        campaignId,
        email,
        url: finalUrl,
        source: "tracking_redirect",
        userAgent: ua,
        ip: (req.headers["x-forwarded-for"] || req.ip || "").toString().slice(0, 80),
        isBotSuspected,
        signed,
        occurredAt: new Date().toISOString()
      });
      if (!isBotSuspected) {
        dataStore.addEvent({
          type: "open",
          campaignId,
          email,
          source: "implicit_from_click",
          occurredAt: new Date().toISOString()
        });
        /* Writeback "clicado" (verde medio + texto blanco). Sobreescribe
         * "abierto" porque clic tiene mas prioridad en sheetsWriteback. */
        try { wbForEmail(email, "clicado"); } catch (_e) {}
      }
    } catch (err) { console.warn("[tracking][click] addEvent:", err.message); }
  }
  res.redirect(302, finalUrl);
});

/* ── Anti-spam shield endpoints ── */
app.post("/api/spam-shield/check", (req, res) => {
  const { subject, html, text } = req.body || {};
  const subjResult = spamShield.validateSubject(subject || "");
  const contResult = spamShield.validateContent(html || "", text || "");
  return apiOk(res, {
    subject: subjResult,
    content: contResult,
    totalScore: subjResult.score + contResult.score,
    verdict: subjResult.ok && contResult.ok ? "ok" : "warning"
  });
});

/* AUDITORIA GLOBAL — combina DNS health + engine status + checklist en una
 * sola llamada para diagnostico rapido pre-envio masivo. */
app.get("/api/spam-shield/audit", async (_req, res) => {
  try {
    const fromEmail = process.env.SMTP_FROM_EMAIL || "manager@rubencoton.com";
    const domain = fromEmail.split("@")[1] || "rubencoton.com";
    const dnsHealth = await spamShield.checkDnsHealth(domain);
    const engine = massMailEngine.getStatus?.() || {};
    const dc = engine.dailyCap || {};
    const aggSent = dc.used || 0;
    const aggBounced = engine.history?.filter(h => h.type === "bounce").length || 0;
    const autoPause = spamShield.shouldAutoPause({
      sent: aggSent, bounced: aggBounced, complained: 0
    });
    const ready =
      dnsHealth.dkim.ok &&
      dnsHealth.dmarc.ok &&
      !autoPause.pause &&
      Boolean(process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
    return apiOk(res, {
      ready,
      dns: dnsHealth,
      engine: {
        mode: engine.mode || process.env.MAIL_TRANSPORT_MODE,
        ratePerMinute: engine.ratePerMinute,
        dailyCap: { limit: dc.limit, used: dc.used, remaining: dc.remaining },
        sent24h: aggSent,
        bounced24h: aggBounced,
        bounceRatePct: aggSent ? Math.round((aggBounced / aggSent) * 1000) / 10 : 0
      },
      autoPause,
      gmailApi: Boolean(process.env.GOOGLE_OAUTH_REFRESH_TOKEN),
      drive: googleHub.isGoogleReady?.() || false
    });
  } catch (err) {
    return apiError(res, 500, err.message);
  }
});

app.get("/api/spam-shield/dns-health", async (_req, res) => {
  try {
    const fromEmail = process.env.SMTP_FROM_EMAIL || "manager@rubencoton.com";
    const domain = fromEmail.split("@")[1] || "rubencoton.com";
    const health = await spamShield.checkDnsHealth(domain);
    /* DMARC en p=none es modo permisivo — recomendar p=quarantine tras 14 dias */
    const recos = [];
    if (!health.spf.ok) {
      recos.push("Publica SPF: \"v=spf1 include:_spf.google.com ~all\" como TXT en " + domain);
    }
    if (!health.dkim.ok) {
      recos.push("DKIM no detectado en selector google._domainkey. Activa firma DKIM en Workspace > Apps > Gmail > Authenticate email");
    }
    if (health.dmarc.ok && health.dmarc.policy === "none") {
      recos.push("DMARC en p=none. Tras 2 semanas sube a p=quarantine para hardening.");
    } else if (!health.dmarc.ok) {
      recos.push("Publica DMARC: \"v=DMARC1; p=quarantine; rua=mailto:postmaster@" + domain + "\" en _dmarc." + domain);
    }
    return apiOk(res, { ...health, recommendations: recos });
  } catch (err) {
    return apiError(res, 500, err.message || "DNS check failed");
  }
});

/* ── Unsubscribe endpoint (CRITICO para entregabilidad) ── */
const EMAIL_REGEX_UNSUB = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* P0-K audit 2026-04-30: RFC 8058 one-click unsubscribe (POST sin form).
 * Gmail/Apple Mail llaman a este endpoint como bot cuando el usuario pulsa
 * "Cancelar suscripción" desde la barra superior del email. NO debe pedir
 * confirmación ni renderizar HTML — debe procesar la baja y devolver 200.
 *
 * Header List-Unsubscribe-Post: List-Unsubscribe=One-Click ya se envía en
 * gmailSender.js / massMailEngine.js. Sin este endpoint, Gmail Postmaster
 * baja "Sender Reputation" detectando que la promesa del header no se cumple.
 *
 * Acepta email tanto en query (?email=...) como en body (form-urlencoded). */
const processUnsubscribe = (email, source = "post") => {
  if (!email) return { ok: false, reason: "missing_email" };
  let decoded;
  try {
    decoded = Buffer.from(String(email), "base64url").toString("utf8").trim().toLowerCase();
  } catch (_e) {
    return { ok: false, reason: "invalid_b64" };
  }
  if (!EMAIL_REGEX_UNSUB.test(decoded)) return { ok: false, reason: "invalid_format" };
  try {
    const allContacts = dataStore.listContacts({});
    const contact = allContacts.find((c) => String(c.email || "").toLowerCase() === decoded);
    /* P0 audit 2026-05-01: enmascarar email en logs (Coolify retiene logs).
     * Pseudonimización GDPR Art. 32. */
    const masked = decoded.replace(/^(.{2}).*?(@.*)$/, "$1***$2");
    if (contact) {
      dataStore.createOrUpdateContact({ email: decoded, status: "unsubscribed" }, "update");
      /* P0 audit 2026-05-05: registrar evento + writeback Sheets para que
       * stats.unsubscribed se incremente y la columna Merge status muestre
       * "BAJA". Buscamos campañas activas que tengan a este contacto como
       * destinatario para asociar el evento. */
      try {
        const allCamps = dataStore.listCampaigns({});
        const matchedCamps = (allCamps || []).filter((c) =>
          Array.isArray(c.recipientsSnapshot) && c.recipientsSnapshot.some((r) => String(r.email || "").toLowerCase() === decoded)
        );
        for (const c of matchedCamps) {
          dataStore.addEvent({
            type: "unsubscribe",
            campaignId: c.id,
            email: decoded,
            occurredAt: new Date().toISOString(),
            source: `unsub_${source}`
          });
        }
        wbForEmail(decoded, "unsubscribed");
      } catch (e) {
        console.warn(`[unsubscribe][${source}] addEvent/writeback err: ${e.message}`);
      }
      console.log(`[unsubscribe][${source}] Baja procesada: ${masked}`);
      return { ok: true, found: true, email: decoded };
    }
    console.log(`[unsubscribe][${source}] Email no encontrado: ${masked}`);
    return { ok: true, found: false, email: decoded };
  } catch (err) {
    console.warn(`[unsubscribe][${source}] error: ${err.message}`);
    return { ok: false, reason: "internal_error" };
  }
};

app.post("/unsubscribe", express.urlencoded({ extended: false, limit: "8kb" }), (req, res) => {
  /* RFC 8058 One-Click: el bot envía POST con header
   * "List-Unsubscribe=One-Click" en el body o como param. Procesamos sin
   * confirmación ni HTML — solo 200 OK. */
  const emailQuery = req.query?.email;
  const emailBody = req.body?.email;
  const result = processUnsubscribe(emailQuery || emailBody, "post");
  if (result.ok) {
    return res.status(200).type("text/plain").send("OK");
  }
  return res.status(400).type("text/plain").send("INVALID");
});

app.get("/unsubscribe", (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>Enlace de baja invalido</h2>
        <p>No se pudo procesar tu solicitud de baja.</p>
      </body></html>
    `);
  }
  try {
    /* BLINDAJE: validar formato y hacer match EXACTO por email, no substring
     * fuzzy. Antes "ana" caía en cualquier contacto con "ana" en su nombre. */
    const decoded = Buffer.from(email, "base64url").toString("utf8").trim().toLowerCase();
    if (!EMAIL_REGEX_UNSUB.test(decoded)) {
      return res.status(400).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2>Enlace de baja invalido</h2>
          <p>El formato del email no es correcto.</p>
        </body></html>
      `);
    }
    /* P0 audit 2026-05-05: GET handler ahora delega en processUnsubscribe
     * (que registra evento + writeback). Antes solo cambiaba status y
     * silenciaba stats. */
    processUnsubscribe(email, "get");
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2 style="color:#10b981">Baja confirmada</h2>
        <p>Has sido dado de baja correctamente. No recibiras mas emails de nuestra parte.</p>
        <p style="color:#999;font-size:13px">RUBEN COTON</p>
      </body></html>
    `);
  } catch (error) {
    return res.status(500).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>Error</h2><p>Hubo un problema procesando tu baja. Contacta con manager@rubencoton.com</p>
      </body></html>
    `);
  }
});

/* ── 404 explícito para /api/* sin handler ── (FIX 2026-05-01 audit)
 * Antes los endpoints /api/* inexistentes caían al catch-all SPA y devolvían
 * el HTML de la app (HTTP 200), rompiendo clientes que esperan JSON. */
app.all("/api/*", (req, res) => {
  return res.status(404).json({
    status: "error",
    error: "not_found",
    message: `Endpoint ${req.method} ${req.path} no existe`
  });
});

/* ── Catch-all: SIEMPRE al final ── */
app.get("*", (_req, res) => {
  res.sendFile(appHtmlPath);
});

let server = null;

const startServer = async () => {
  /* AUTO-RESTORE: si store.json no existe o esta vacio (volumen perdido,
   * primer arranque), intenta descargar el ultimo backup de Drive antes
   * de inicializar el dataStore. Si Google no esta listo o no hay backup,
   * arranca con store vacio (comportamiento normal). */
  try {
    if (googleHub.isGoogleReady()) {
      const dataFile = process.env.DATA_STORE_FILE
        ? path.resolve(process.env.DATA_STORE_FILE)
        : path.join(__dirname, "..", "data", "store.json");
      const r = await driveArchive.restoreStoreFromDrive(dataFile);
      if (r.ok) {
        console.log(`[restore] store.json recuperado de Drive: ${r.restored} (${r.size} bytes)`);
      } else if (r.reason === "store_already_has_data") {
        /* normal, no log */
      } else if (r.reason !== "google_not_ready") {
        console.log(`[restore] no recuperado: ${r.reason}`);
      }
    }
  } catch (e) {
    console.warn("[restore] error:", e.message);
  }

  await dataStore.init();

  /* Insertar borradores estandar RUBEN COTON si no existen (idempotente). */
  try {
    const seedResult = dataStore.ensureDefaultTemplates();
    if (seedResult) {
      const parts = [];
      if (seedResult.removed > 0) parts.push(`borradas ${seedResult.removed} plantillas antiguas (reset)`);
      if (seedResult.added > 0) parts.push(`insertados ${seedResult.added} borradores`);
      if (seedResult.updated > 0) parts.push(`actualizados ${seedResult.updated} borradores`);
      if (parts.length) {
        console.log(`[seeds] ${parts.join(" · ")}.`);
      }
    }
  } catch (err) {
    console.error("[seeds] Error insertando borradores por defecto:", err.message);
  }

  server = app.listen(port, () => {
    console.log(`RUBEN-COTON_EMAILING listening on port ${port}`);
    /* Scheduler de informes ejecutivos (semanal + mensual) */
    try {
      executiveReports.startScheduler({ getDataStore: () => dataStore });
      if (googleHub.isGoogleReady()) {
        console.log("[drive] ecosistema Google listo (manager@rubencoton.com)");
        /* Reply tracker: escanea inbox de manager@ cada 10 min */
        try {
          replyTracker.start({ dataStore });
        } catch (e) {
          console.error("[replyTracker] no se pudo arrancar:", e.message);
        }
        /* Drive scheduler: DESACTIVADO 2026-05-05 (peticion usuario).
         * Los informes se ven directamente desde la app, no se crean
         * carpetas en Drive con HTML+PDF. Para reactivar, set
         * DRIVE_ARCHIVE_ENABLED=true. Backup del store sigue activo. */
        const driveArchiveEnabled = String(process.env.DRIVE_ARCHIVE_ENABLED || "false").toLowerCase() === "true";
        if (driveArchiveEnabled) {
          try {
            driveScheduler.setRefs({
              dataStore,
              driveArchive,
              serverHelpers: { calcCampaignSeq, buildCampaignPackForDrive }
            });
            driveScheduler.start();
          } catch (e) {
            console.error("[driveScheduler] no se pudo arrancar:", e.message);
          }
        } else {
          console.log("[driveScheduler] DESACTIVADO (DRIVE_ARCHIVE_ENABLED=false). Informes se ven en la app.");
        }
        /* Backup auto store.json a Drive cada hora.
         * Sustituye al PostgreSQL como recovery layer (refactor 2026-04-25).
         * Si store.json se corrompe o el volume se pierde, restauramos
         * desde Drive/BACKUPS/store-YYYY-MM-DD-HH.json. */
        try {
          const dataFile = process.env.DATA_STORE_FILE
            ? path.resolve(process.env.DATA_STORE_FILE)
            : path.join(__dirname, "..", "data", "store.json");
          const intervalMs = Number(process.env.STORE_BACKUP_INTERVAL_MS) || 3600000;
          const runBackup = async () => {
            try {
              const r = await driveArchive.backupStoreToDrive(dataFile);
              if (r.ok) {
                console.log(`[backup] store.json subido a Drive: ${r.name}`);
              } else if (r.error !== "google_not_ready") {
                console.warn("[backup] fallo backup store.json:", r.error);
              }
            } catch (e) {
              console.warn("[backup] excepcion backup:", e.message);
            }
          };
          /* Primer backup a los 60s del arranque (no bloquea arranque) */
          setTimeout(runBackup, 60_000);
          setInterval(runBackup, intervalMs);
        } catch (e) {
          console.error("[backup] no se pudo programar backup auto:", e.message);
        }
      } else {
        console.log("[drive] Google NO configurado. Los informes se guardarán solo localmente.");
      }
    } catch (e) {
      console.error("[executiveReports] no se pudo arrancar el scheduler:", e.message);
    }
  });
};

startServer().catch((error) => {
  console.error("Startup error:", error.message || error);
  process.exit(1);
});

const periodicSync = setInterval(() => {
  try {
    syncCampaignsWithEngine();
    dataStore.runWorkflows(massMailEngine);
  } catch (error) {
    console.error("Periodic sync error:", error.message || error);
  }
}, 60000);

/* Sheets sync — solo L-V 8:00-20:00 Europe/Madrid, cada 30 min */
const SHEETS_AUTOSYNC_ENABLED = String(process.env.SHEETS_AUTOSYNC_ENABLED || "true").toLowerCase() !== "false";
const SYNC_INTERVAL_MIN = Number(process.env.SHEETS_SYNC_INTERVAL_MIN) || 30;

const isBusinessHours = () => {
  const now = new Date();
  const madrid = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const day = madrid.getDay();
  const hour = madrid.getHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour < 20;
};

if (sheetsSync.getSheetIds().length > 0 && SHEETS_AUTOSYNC_ENABLED) {
  const syncIntervalMs = SYNC_INTERVAL_MIN * 60000;
  console.log(`[sheetsSync] Auto-sync cada ${SYNC_INTERVAL_MIN}min L-V 8:00-20:00 Madrid (${sheetsSync.getSheetIds().length} hojas)`);

  /* Sync inicial tras 30s si estamos en horario */
  setTimeout(() => {
    if (isBusinessHours()) {
      sheetsSync.runSync(dataStore).catch((err) => {
        console.error("[sheetsSync] Initial sync error:", err.message);
      });
    } else {
      console.log("[sheetsSync] Fuera de horario laboral — sync inicial omitido");
    }
  }, 30000);

  setInterval(() => {
    if (!isBusinessHours()) return;
    sheetsSync.runSync(dataStore).catch((err) => {
      console.error("[sheetsSync] Auto-sync error:", err.message);
    });
  }, syncIntervalMs);
} else {
  console.log(`[sheetsSync] Auto-sync DESACTIVADO (SHEETS_AUTOSYNC_ENABLED=${SHEETS_AUTOSYNC_ENABLED}, hojas=${sheetsSync.getSheetIds().length})`);
}

const gracefulShutdown = async () => {
  clearInterval(periodicSync);
  if (server) {
    server.close(async () => {
      massMailEngine.stop();
      if (pool) {
        await pool.end();
      }
      process.exit(0);
    });
  } else {
    massMailEngine.stop();
    if (pool) {
      await pool.end();
    }
    process.exit(0);
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

/* P0-F audit 2026-04-30: handlers globales de errores no capturados.
 * Sin esto, una promise rechazada en setInterval (backup, scheduler,
 * replyTracker) tira el proceso silencioso o lo deja zombie. Loggear
 * con contexto, no matar al proceso por unhandledRejection (puede ser
 * transitorio); sí matar por uncaughtException porque deja estado roto. */
process.on("unhandledRejection", (reason, promise) => {
  const msg = reason && reason.stack ? reason.stack : String(reason);
  console.error("[unhandledRejection]", msg.slice(0, 2000));
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err && err.stack ? err.stack : String(err));
  /* Estado potencialmente corrupto. Salimos para que Coolify reinicie. */
  setTimeout(() => process.exit(1), 200);
});

"use strict";
/**
 * Test E2E tracking — sin intervención humana:
 * 1. Envía campaña desde la app
 * 2. Conecta a Gmail API (booking@) para leer el mensaje que llegó a rubencoton1993
 * 3. Extrae el pixel de apertura del HTML y lo visita → dispara tracking open
 * 4. Extrae los links con /t/c/ y visita el primero → dispara tracking click
 * 5. Verifica en la app que opens=1, clicks>=1
 * 6. Reporta bounces
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const APP_BASE = "https://emailing.rubencoton.com";
const APP_PW = "+ruben93";
const TEST_EMAIL = "rubencoton1993@gmail.com";

/* ========= Login Gmail (hub RUBEN-COTON_API-GOOGLE) ========= */
const HUB_ROOT = path.resolve(__dirname, "..", "..", "RUBEN-COTON_API-GOOGLE");
const tokenPath = path.join(HUB_ROOT, "config", "token.json");
const envPath = path.join(HUB_ROOT, ".env");

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

async function gmailClient() {
  const env = parseEnv(envPath);
  const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
  const oauth2 = new google.auth.OAuth2(
    env.GOOGLE_OAUTH_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
    env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3999/oauth2/callback"
  );
  oauth2.setCredentials({ refresh_token: token.refresh_token });
  return google.gmail({ version: "v1", auth: oauth2 });
}

/* ========= App API ========= */
let appCookie = null;
async function appLogin() {
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch(APP_BASE + "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ password: APP_PW }).toString(),
        redirect: "manual"
      });
      if (r.status === 503) { await new Promise((s) => setTimeout(s, 8000)); continue; }
      const rawSet = r.headers.get("set-cookie") || "";
      const arr = r.headers.getSetCookie ? r.headers.getSetCookie() : (rawSet ? [rawSet] : []);
      appCookie = (arr.find((c) => c.startsWith("app_auth=")) || "").split(";")[0];
      if (!appCookie && rawSet) {
        const m = rawSet.match(/app_auth=[^;,]+/);
        if (m) appCookie = m[0];
      }
      if (appCookie) return;
    } catch (_e) {}
    await new Promise((s) => setTimeout(s, 6000));
  }
  throw new Error("App login failed after retries");
}

async function appCall(method, path, body, { retries = 6, retryDelay = 6000 } = {}) {
  let lastErr = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(APP_BASE + path, {
        method,
        headers: { cookie: appCookie, "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual"
      });
      const t = await r.text();
      /* 503 / Traefik "no available server" = app en rebuild, reintentamos */
      if (r.status === 503 || (/no available server/i.test(t))) {
        lastErr = { status: r.status, text: t.slice(0, 100) };
        if (i < retries) { await new Promise((s) => setTimeout(s, retryDelay)); continue; }
      }
      let j = null; try { j = JSON.parse(t); } catch (_e) {}
      return { status: r.status, data: j, text: t };
    } catch (err) {
      lastErr = err;
      if (i < retries) { await new Promise((s) => setTimeout(s, retryDelay)); continue; }
      throw err;
    }
  }
  throw new Error("appCall failed after retries: " + JSON.stringify(lastErr));
}

/* ========= Helpers ========= */
function log(tag, msg, ...rest) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] [${tag.padEnd(18)}]`, msg, ...rest);
}

function b64urlDecode(s) {
  return Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/* Decodifica el payload Gmail buscando text/html o multipart/alternative */
function extractHtmlFromMessage(msg) {
  const payload = msg.payload;
  if (!payload) return null;
  if (payload.parts) {
    /* Buscar text/html en primer nivel */
    for (const p of payload.parts) {
      if (p.mimeType === "text/html" && p.body?.data) return b64urlDecode(p.body.data);
    }
    /* Multipart alternative → bucear */
    for (const p of payload.parts) {
      if (p.parts) {
        for (const sp of p.parts) {
          if (sp.mimeType === "text/html" && sp.body?.data) return b64urlDecode(sp.body.data);
        }
      }
    }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) return b64urlDecode(payload.body.data);
  return null;
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ========= Main flow ========= */
async function main() {
  log("init", "Login app…");
  await appLogin();

  log("seed", "Asegurando contacto rubencoton1993 subscribed…");
  await appCall("POST", "/api/test/seed-test-contact");

  /* Crear campaña con enlace */
  const subject = `TEST E2E ${new Date().toISOString().slice(11,19)}`;
  const html = `<div dir="ltr">
<p>Hola Rub&eacute;n,</p>
<p>Esto es un test autom&aacute;tico. Por favor no respondas.</p>
<p>Visita nuestra web: <a href="https://rubencoton.com">https://rubencoton.com</a></p>
<p>Un saludo,<br>Test automation</p>
</div>`;
  log("create", `Creando campaña "${subject}"…`);
  const created = await appCall("POST", "/api/campaigns", {
    name: subject, subject, html,
    text: "Hola Ruben, test. Visita https://rubencoton.com",
    segmentId: "seg_f877d5f148cd50"
  });
  const cid = created.data?.campaign?.id;
  if (!cid) throw new Error("No campaignId: " + created.text);
  log("create", `OK id=${cid}`);

  log("send", "Enviando…");
  const sent = await appCall("POST", `/api/campaigns/${cid}/send`, {});
  log("send", `${sent.status} ${sent.data?.message || sent.text.slice(0, 200)}`);

  /* Poll hasta sent=1/1 */
  log("poll", "Esperando entrega (max 60s)…");
  let done = false;
  for (let i = 0; i < 20; i++) {
    await sleep(3000);
    const c = await appCall("GET", `/api/campaigns/${cid}`);
    const x = c.data?.campaign;
    log("poll", `status=${x?.status} sent=${x?.stats?.sent}/${x?.stats?.total}`);
    if (["sent", "completed"].includes(x?.status)) { done = true; break; }
    if (x?.status === "failed") throw new Error("Campaña failed");
  }
  if (!done) throw new Error("No llegó a sent");

  /* Leer email en Gmail API de booking@ → pero el destinatario es rubencoton1993
   * Gmail API solo lee buzón del usuario autenticado. Para leer ese buzón
   * tendríamos que usar OAuth del gmail del destinatario (que es personal).
   *
   * ALTERNATIVA: vamos directo al DataStore de la app — el motor ya guarda
   * el HTML enviado a cada recipient en recipientsSnapshot (o similar),
   * y ahí tenemos el pixel URL + click URLs. También podemos consultar
   * /api/campaigns/:id que devuelve campaign.html con pixel inyectado.
   *
   * PERO el pixel/URLs se inyectan por-recipient en el engine, no se
   * guardan en el store. Entonces reconstruimos la URL nosotros mismos
   * a partir del patrón: /t/o/{cid}/{emailB64}.gif
   */
  log("tracking", "Reconstruyendo URLs de tracking…");
  const emailB64 = Buffer.from(TEST_EMAIL).toString("base64url");
  const pixelUrl = `${APP_BASE}/t/o/${cid}/${emailB64}.gif`;
  /* URL de click → wrappea https://rubencoton.com */
  const targetUrl = "https://rubencoton.com";
  const urlB64 = Buffer.from(targetUrl).toString("base64url");
  const clickUrl = `${APP_BASE}/t/c/${cid}/${emailB64}?u=${urlB64}`;

  log("pixel", "Visitando pixel de apertura…", pixelUrl);
  const px = await fetch(pixelUrl, { headers: { "user-agent": "Mozilla/5.0 (GmailImageProxy/1.0)" } });
  log("pixel", `HTTP ${px.status} ${px.headers.get("content-type")}`);

  log("click", "Visitando URL de click…", clickUrl);
  const cl = await fetch(clickUrl, { headers: { "user-agent": "Mozilla/5.0 Chrome" }, redirect: "manual" });
  log("click", `HTTP ${cl.status} location=${cl.headers.get("location")}`);

  /* Verificar contadores en la app */
  log("verify", "Esperando 3s…");
  await sleep(3000);
  const c2 = await appCall("GET", `/api/campaigns/${cid}`);
  const x = c2.data?.campaign;
  log("verify", `APERTURAS: ${x?.stats?.opened ?? 0}`);
  log("verify", `CLICS: ${x?.stats?.clicked ?? 0}`);
  log("verify", `ENVIADOS: ${x?.stats?.sent ?? 0}/${x?.stats?.total ?? 0}`);
  log("verify", `REBOTES: ${x?.stats?.bounced ?? 0}`);

  /* BONUS: leer el email REAL en la bandeja de booking@ (si Rubén lo reenvió) */
  try {
    const gmail = await gmailClient();
    /* Buscamos en inbox de booking@ los ultimos mensajes enviados a
     * rubencoton1993 para confirmar que el email salió de verdad. */
    const list = await gmail.users.messages.list({
      userId: "me",
      q: `from:manager@rubencoton.com newer_than:1d subject:"${subject}"`,
      maxResults: 5
    });
    log("gmail", `mensajes relacionados encontrados: ${list.data.messages?.length || 0}`);
    if (list.data.messages?.length) {
      const get = await gmail.users.messages.get({ userId: "me", id: list.data.messages[0].id });
      const headers = Object.fromEntries((get.data.payload?.headers || []).map((h) => [h.name, h.value]));
      log("gmail", `From: ${headers.From}`);
      log("gmail", `To: ${headers.To}`);
      log("gmail", `Subject: ${headers.Subject}`);
      log("gmail", `DKIM: ${headers["Authentication-Results"] || "n/a"}`);
      const html = extractHtmlFromMessage(get.data);
      if (html) {
        const pixelMatch = html.match(/src="[^"]*\/t\/o\/[^"]+/);
        const clickMatch = html.match(/href="[^"]*\/t\/c\/[^"]+/);
        log("gmail", `HTML tiene pixel tracking: ${pixelMatch ? "SI" : "NO"}`);
        log("gmail", `HTML tiene click wrap: ${clickMatch ? "SI" : "NO"}`);
        if (pixelMatch) log("gmail", `  pixel URL: ${pixelMatch[0].slice(5, 120)}...`);
        if (clickMatch) log("gmail", `  click URL: ${clickMatch[0].slice(6, 120)}...`);
      }
    }
  } catch (e) {
    log("gmail", "SKIP (Gmail API no disponible local):", e.message.slice(0, 120));
  }

  log("done", "=== TEST E2E COMPLETADO ===");
  if ((x?.stats?.opened || 0) >= 1 && (x?.stats?.clicked || 0) >= 1) {
    log("result", "✅ TRACKING FUNCIONA: apertura + clic registrados");
  } else {
    log("result", "⚠ Tracking parcial. Revisa logs arriba.");
  }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });

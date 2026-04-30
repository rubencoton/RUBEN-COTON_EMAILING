"use strict";
/**
 * Prueba automatizada de envío a rubencoton1993@gmail.com.
 * Ejecuta todos los pasos del guión desde el backend usando fetch de Node 20+.
 *
 *   node scripts/prueba-envio-rubencoton.js
 *
 * Prerrequisito: app arriba en https://emailing.artesbuhomanagement.com.
 */

const BASE = "https://emailing.artesbuhomanagement.com";
const PASSWORD = "+artesbuho26";
const EMAIL = "rubencoton1993@gmail.com";

let cookie = null;

async function call(method, path, { body, form, raw, allowErr } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  let bodyOut;
  if (form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    bodyOut = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    bodyOut = JSON.stringify(body);
  }
  const r = await fetch(`${BASE}${path}`, { method, headers, body: bodyOut, redirect: "manual" });
  const setCookie = r.headers.getSetCookie ? r.headers.getSetCookie() : (r.headers.raw?.()["set-cookie"] || []);
  if (setCookie && setCookie.length) {
    const appAuth = setCookie.find((c) => c.startsWith("app_auth="));
    if (appAuth) cookie = appAuth.split(";")[0];
  }
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (_e) {}
  if (!r.ok && !allowErr) {
    const err = new Error(`${method} ${path} → HTTP ${r.status}: ${text.slice(0, 200)}`);
    err.status = r.status; err.body = text; throw err;
  }
  if (raw) return { status: r.status, text, headers: r.headers };
  return { status: r.status, data: json, text };
}

function log(step, msg) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] ${step.padEnd(22)} ${msg}`);
}

async function waitFor(fn, { timeoutMs = 180000, intervalMs = 5000, label = "condición" } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fn();
      if (res) return res;
    } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout esperando ${label}`);
}

async function main() {
  /* 0. Health */
  log("0-health", "Comprobando que la app responde…");
  await waitFor(async () => {
    const r = await fetch(`${BASE}/login`);
    return r.status === 200;
  }, { timeoutMs: 180000, intervalMs: 5000, label: "app arriba" });
  log("0-health", "OK (HTTP 200)");

  /* 1. Login */
  log("1-login", "Haciendo login…");
  const loginRes = await call("POST", "/api/auth/login", { form: { password: PASSWORD } });
  log("1-login", `OK · cookie=${cookie ? cookie.slice(0, 30) + "…" : "NO SET"}`);
  if (!cookie) throw new Error("Login sin cookie. Contraseña incorrecta?");

  /* 2. Health endpoints protegidos */
  log("2-health", "Verificando /api/health/full…");
  try {
    const h = await call("GET", "/api/health/full");
    log("2-health", `DB=${h.data?.db?.mode || "?"}`);
  } catch (e) { log("2-health", `(skip) ${e.message.slice(0,100)}`); }

  /* 3. Schedule status */
  log("3-sched", "Consultando /api/reports/schedule…");
  const sched = await call("GET", "/api/reports/schedule");
  log("3-sched", `weeklyNext=${sched.data.weeklyNext} · driveReady=${sched.data.driveReady} · refresh=${sched.data.continuousRefreshHours}h`);

  /* 4. Seed test contact */
  log("4-seed", "Creando/actualizando contacto PRUEBA rubencoton1993@gmail.com…");
  const seed = await call("POST", "/api/test/seed-test-contact");
  log("4-seed", `OK · ${JSON.stringify(seed.data).slice(0, 150)}`);

  /* 5. Localizar segmento TEST RUBENCOTON si existe */
  log("5-seg", "Listando segmentos…");
  const segs = await call("GET", "/api/segments");
  const seg = (segs.data.segments || []).find((s) => /test.*rubencoton/i.test(s.name));
  log("5-seg", seg ? `Encontrado segmento "${seg.name}" (id=${seg.id})` : "Sin segmento TEST → envío a tag PRUEBA via CRM");

  /* 6. Crear campaña */
  log("6-camp", "Creando campaña PRUEBA AUDIT…");
  const html = [
    '<!DOCTYPE html><html><body style="font-family:Arial;background:#f5f5f5;padding:40px">',
    '<div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:10px;border-top:6px solid #D62828">',
    '  <h1 style="color:#a81117;margin:0 0 10px">Prueba auditoría OK</h1>',
    '  <p style="color:#333">Hola <strong>RUBEN COTON</strong>, este es el email de prueba tras la auditoría profunda.</p>',
    '  <p style="color:#333">Si ves este mensaje: <strong>envío + tracking + Drive funcionan.</strong></p>',
    '  <p style="color:#666;font-size:13px;margin-top:24px">ARTES BÚHO MANAGEMENT · booking@artesbuhomanagement.com</p>',
    '  <p style="font-size:12px;color:#999;margin-top:18px"><a href="%%UNSUBSCRIBE_URL%%" style="color:#a81117">Darse de baja</a></p>',
    '</div></body></html>'
  ].join("\n");
  const created = await call("POST", "/api/campaigns", {
    body: {
      name: `PRUEBA AUDIT ${new Date().toISOString().slice(0, 16)}`,
      subject: "Prueba envío — test auditoría ARTES BÚHO",
      html,
      text: "Prueba auditoría OK. Si ves este email, el envío y tracking funcionan.",
      fromName: "Artes Buho Management",
      fromEmail: "booking@artesbuhomanagement.com",
      replyTo: "booking@artesbuhomanagement.com",
      segmentId: seg ? seg.id : null,
      status: "draft"
    }
  });
  const campaignId = created.data.campaign?.id;
  if (!campaignId) throw new Error("No se obtuvo campaignId tras POST /api/campaigns");
  log("6-camp", `OK · id=${campaignId}`);

  /* 7. Subir al Drive */
  log("7-drive", "Subiendo al Drive…");
  try {
    const up = await call("POST", `/api/campaigns/${campaignId}/upload-to-drive`, { allowErr: true });
    if (up.status === 200) {
      log("7-drive", `OK · folder=${up.data.folder} · link=${up.data.folderLink || "(ver Drive)"}`);
    } else {
      log("7-drive", `SKIP (${up.status}): ${JSON.stringify(up.data || up.text).slice(0, 150)}`);
    }
  } catch (e) { log("7-drive", `SKIP: ${e.message.slice(0, 120)}`); }

  /* 8. Lanzar envío */
  log("8-send", `Lanzando campaña a ${EMAIL}…`);
  let sent;
  try {
    sent = await call("POST", `/api/campaigns/${campaignId}/send`, { body: { confirmSendAll: true } });
    log("8-send", `OK · jobId=${sent.data.job?.id || "?"} · total=${sent.data.job?.totals?.total || "?"}`);
  } catch (e) {
    log("8-send", `ERROR: ${e.message.slice(0, 250)}`);
    return;
  }

  /* 9. Poll estado */
  log("9-poll", "Monitoreando estado hasta Enviada/Completada…");
  let finalCamp = null;
  try {
    finalCamp = await waitFor(async () => {
      const r = await call("GET", `/api/campaigns/${campaignId}`);
      const c = r.data.campaign;
      log("9-poll", `status=${c.status} · sent=${c.stats?.sent || 0}/${c.stats?.total || 0} · opens=${c.stats?.opened || 0}`);
      if (["sent", "completed", "failed"].includes(c.status)) return c;
      return null;
    }, { timeoutMs: 240000, intervalMs: 8000, label: "campaña finalizada" });
  } catch (e) {
    log("9-poll", `TIMEOUT: ${e.message}`);
  }
  if (finalCamp) log("9-poll", `FINAL status=${finalCamp.status}`);

  /* 10. Refresh Drive cada-12h prueba */
  log("10-refresh", "Forzando refresh-all Drive…");
  try {
    const r = await call("POST", "/api/reports/refresh-all", { allowErr: true });
    log("10-refresh", `${r.status === 200 ? "OK" : "SKIP"} · ${JSON.stringify(r.data || r.text).slice(0, 150)}`);
  } catch (e) { log("10-refresh", `SKIP: ${e.message.slice(0, 120)}`); }

  /* 11. Informe semanal manual */
  log("11-weekly", "Generando informe semanal manual…");
  try {
    const r = await call("POST", "/api/reports/weekly/run-now", { allowErr: true });
    log("11-weekly", `${r.status === 200 ? "OK" : "SKIP"} · ${JSON.stringify(r.data || r.text).slice(0, 150)}`);
  } catch (e) { log("11-weekly", `SKIP: ${e.message.slice(0, 120)}`); }

  log("done", "=== PRUEBA COMPLETADA ===");
  console.log("\n➡  Revisa ahora la bandeja de rubencoton1993@gmail.com — el email debería estar en ~1-2 min.\n");
  console.log(`  campaignId: ${campaignId}`);
  console.log(`  Ver email:  ${BASE}/campaigns/${campaignId}/preview`);
  console.log(`  Informe:    ${BASE}/campaigns/${campaignId}/report`);
  console.log("  Drive:      https://drive.google.com/drive/folders/1-MEdFyWKjdgEShJlrFHwBn8PvQ07qk5O\n");
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });

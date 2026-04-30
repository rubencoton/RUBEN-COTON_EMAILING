"use strict";
/**
 * Prueba SEGURA: envía UN SOLO email a rubencoton1993@gmail.com.
 * No usa segments ni campañas (que pueden ir a TODOS). Usa el endpoint
 * /api/mass-mail/jobs con recipients:[ÚNICO_EMAIL] directo.
 *
 * Guard rails:
 *  - Aborta si recipients.length != 1.
 *  - Verifica motor pausado antes de encolar.
 *  - Encola con rate=5/min (default) pero solo hay 1 destinatario.
 *  - Monitorea el job hasta "completed" o timeout.
 */

const BASE = "https://emailing.rubencoton.com";
const PASSWORD = "+ruben93";
const EMAIL = "rubencoton1993@gmail.com";

const FAIL = (m) => { console.error("❌", m); process.exit(1); };

async function main() {
  const t0 = Date.now();
  const log = (s, ...a) => console.log(`[${((Date.now()-t0)/1000).toFixed(1).padStart(5)}s] ${s}`, ...a);

  /* 1. Login */
  log("1. Login…");
  const lr = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: PASSWORD }).toString(),
    redirect: "manual"
  });
  const setC = lr.headers.getSetCookie ? lr.headers.getSetCookie() : [];
  const cookie = (setC.find((c) => c.startsWith("app_auth=")) || "").split(";")[0];
  if (!cookie) FAIL("Login sin cookie");
  log("   cookie OK:", cookie.slice(0, 40) + "…");

  const call = async (method, path, body) => {
    const r = await fetch(BASE + path, {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (_e) {}
    return { status: r.status, data: j, text: t };
  };

  /* 2. Estado motor */
  log("2. Comprobando estado motor…");
  const s1 = await call("GET", "/api/mass-mail/status");
  const eng1 = s1.data?.engine || {};
  log(`   paused=${eng1.paused} queueSize=${eng1.queueSize} jobsTotal=${eng1.jobsTotal} ratePerMin=${eng1.ratePerMinute}`);
  if (eng1.queueSize > 0) FAIL(`Hay ${eng1.queueSize} en cola. NO envío más.`);

  /* 3. Preparar payload SÓLO rubencoton1993 */
  const recipients = [EMAIL];
  if (recipients.length !== 1 || recipients[0] !== EMAIL) FAIL("Safety guard: recipients !== [único email]");

  const html = [
    '<!DOCTYPE html>',
    '<html><head><meta charset="UTF-8"></head>',
    '<body style="margin:0;font-family:Arial;background:#f5f5f5;padding:40px">',
    '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border-top:6px solid #D62828">',
    '  <div style="padding:32px 28px">',
    '    <h1 style="color:#E65100;margin:0 0 14px;font-size:26px">✅ Prueba auditoría</h1>',
    '    <p style="color:#333;font-size:15px;line-height:1.5">Hola <strong>RUBEN COTON</strong>,</p>',
    '    <p style="color:#333;font-size:15px;line-height:1.5">Este email confirma que el <strong>envío, el tracking y el HTML</strong> de tu app funcionan tras la auditoría profunda.</p>',
    '    <p style="color:#333;font-size:15px;line-height:1.5">Si lo ves, puedes marcar la prueba como ✅ OK.</p>',
    '  </div>',
    '  <div style="background:#F4B400;padding:14px 28px;text-align:center">',
    '    <span style="color:#E65100;font-weight:800;font-size:13px">RUBEN COTON</span>',
    '  </div>',
    '  <div style="background:#2a2a2a;padding:14px 28px;text-align:center">',
    '    <a href="%%UNSUBSCRIBE_URL%%" style="color:#F4B400;font-size:11px;text-decoration:underline">Darse de baja</a>',
    '  </div>',
    '</div></body></html>'
  ].join("\n");

  log(`3. Encolando job de PRUEBA con recipients=[${recipients[0]}]…`);
  const enq = await call("POST", "/api/mass-mail/jobs", {
    name: "TEST AUDITORIA · rubencoton1993",
    subject: "Prueba auditoría — RUBEN COTON EMAILING",
    html,
    text: "Prueba auditoria OK. Si ves este email, envio y tracking funcionan.",
    recipients
  });
  if (enq.status !== 201 || enq.data?.status !== "ok") {
    FAIL(`Enqueue falló: HTTP ${enq.status} ${enq.text.slice(0, 300)}`);
  }
  const jobId = enq.data.job?.id;
  if (!jobId) FAIL("Sin jobId en respuesta");
  log(`   jobId=${jobId} total=${enq.data.job?.totals?.total || 1}`);

  /* 4. Reanudar motor si paused */
  if (eng1.paused) {
    log("4. Motor paused → resume…");
    const r = await call("POST", "/api/mass-mail/resume");
    log(`   resume: ${r.status}`);
  } else {
    log("4. Motor ya running");
  }

  /* 5. Poll job hasta completed */
  log("5. Monitoreando job…");
  const tStart = Date.now();
  let finalJob = null;
  while (Date.now() - tStart < 180000) {
    const j = await call("GET", `/api/mass-mail/jobs/${jobId}`);
    const job = j.data?.job;
    if (!job) { log(`   (aún no visible, HTTP ${j.status})`); await new Promise((r) => setTimeout(r, 3000)); continue; }
    log(`   status=${job.status} sent=${job.totals?.sent || 0}/${job.totals?.total} failed=${job.totals?.failed || 0}`);
    if (["completed", "failed", "cancelled", "finished"].includes(job.status)) {
      finalJob = job; break;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  /* 6. Re-pausar motor para no seguir enviando accidentalmente nada en cola futura */
  log("6. Pausando motor de nuevo por seguridad…");
  await call("POST", "/api/mass-mail/pause");

  /* 7. Reporte final */
  if (!finalJob) FAIL("Job no completó en 180s");
  const sentOK = (finalJob.totals?.sent || 0) === 1 && (finalJob.totals?.failed || 0) === 0;
  log("");
  log("=== RESULTADO ===");
  log(`  jobId:     ${jobId}`);
  log(`  status:    ${finalJob.status}`);
  log(`  enviados:  ${finalJob.totals?.sent || 0}`);
  log(`  fallidos:  ${finalJob.totals?.failed || 0}`);
  log(`  motor:     paused (seguro)`);
  log("");
  if (sentOK) {
    log("✅ ÉXITO — revisa tu bandeja rubencoton1993@gmail.com (puede tardar 30s-2min).");
  } else {
    log("⚠️  Revisar logs del engine. Posible fallo SMTP/DKIM/MX.");
    if (finalJob.history) {
      const last = finalJob.history.slice(-3);
      for (const h of last) log(`    history: ${JSON.stringify(h).slice(0, 300)}`);
    }
  }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });

/**
 * Campaña real e2e: envía 1 email a rubencoton1993@gmail.com con
 * tracking apertura+click activo. Tras enviar monitorea cada 10s.
 */
const http = require("http");
const fs = require("fs");

const req = (method, path, body, cookie) =>
  new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body), "utf-8") : null;
    const r = http.request({
      method, hostname: "localhost", port: 3000, path,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(data ? { "Content-Length": data.length } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      }
    }, (res) => {
      let chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks).toString("utf-8");
        let json = null;
        try { json = JSON.parse(buf.replace(/^﻿/, "")); } catch {}
        resolve({ status: res.statusCode, body: json || buf, headers: res.headers });
      });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });

(async () => {
  // Restaurar contacto y resetear cualquier opened/clicked anterior
  const d = JSON.parse(fs.readFileSync("./data/store.json", "utf-8"));
  const cont = d.contacts.find((c) => /rubencoton1993/.test(c.email || ""));
  if (cont) {
    cont.status = "subscribed";
    cont.bouncedAt = null;
    cont.lastOpenAt = null;
    cont.lastClickAt = null;
    fs.writeFileSync("./data/store.json", JSON.stringify(d, null, 2), "utf-8");
  }

  const login = await req("POST", "/api/auth/login", { password: "+artesbuho26" });
  const cookie = (login.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");

  // Segmento limpio
  const segs = await req("GET", "/api/segments", null, cookie);
  let segId = (segs.body.segments || []).find((s) => s.name === "FINAL_E2E")?.id;
  if (!segId) {
    const seg = await req("POST", "/api/segments", {
      name: "FINAL_E2E",
      match: "all",
      rules: [{ field: "email", op: "equals", value: "rubencoton1993@gmail.com" }]
    }, cookie);
    segId = seg.body.segment.id;
  }

  // Campaña real
  const cmp = await req("POST", "/api/campaigns", {
    name: "FINAL E2E — Test completo tracking",
    subject: "🚀 Test FINAL — Sistema Artes Búho operativo",
    fromName: "Artes Búho Management",
    fromEmail: "booking@artesbuhomanagement.com",
    replyTo: "booking@artesbuhomanagement.com",
    segmentId: segId,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#fafafa">
<div style="background:#a81117;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
  <h1 style="margin:0;font-size:24px">🦉 Artes Búho Management</h1>
  <p style="margin:8px 0 0;opacity:0.9">Sistema de mensajería operativo</p>
</div>
<div style="background:#fff;padding:24px;border-radius:0 0 8px 8px">
  <h2 style="color:#a81117">¡Hola Rubén! 👋</h2>
  <p>Esta es la <strong>campaña final de verificación end-to-end</strong>. Si la lees:</p>
  <ul>
    <li>✅ Sistema de envío via Gmail API funcionando</li>
    <li>✅ Plantillas HTML renderizadas con tildes correctas</li>
    <li>✅ Tracking de apertura activo (ya registrado al abrir esto)</li>
    <li>✅ Tracking de click activo (probaremos abajo)</li>
    <li>✅ Cap diario 1500/24h funcionando</li>
    <li>✅ Velocidad 5/min anti-spam</li>
  </ul>
  <h3 style="color:#a81117;margin-top:24px">🖱 Haz click para verificar tracking de clics:</h3>
  <p style="text-align:center;margin:24px 0">
    <a href="https://artesbuhomanagement.com" style="display:inline-block;background:#a81117;color:#fff;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold">
      🌐 Ver web Artes Búho
    </a>
  </p>
  <p>Otros enlaces de prueba:</p>
  <ul>
    <li><a href="https://www.google.com">🔍 Google</a></li>
    <li><a href="https://drive.google.com">📁 Drive</a></li>
    <li><a href="https://www.youtube.com">📺 YouTube</a></li>
  </ul>
  <p style="margin-top:32px">Saludos,<br><strong>Booking — Artes Búho</strong></p>
</div>
<p style="text-align:center;font-size:11px;color:#999;margin-top:16px">
  Sistema construido por RUBEN COTON · Local + Cloudflare Tunnel
</p>
</div>`,
    plainText: "Test FINAL E2E - Sistema Artes Búho operativo. Saludos."
  }, cookie);

  const cmpId = cmp.body.campaign.id;
  console.log("Campaign:", cmpId);

  const send = await req("POST", `/api/campaigns/${cmpId}/send`, {}, cookie);
  console.log("Send:", send.body?.status, send.body?.message);

  // Monitor cada 10 segundos durante 2 minutos
  console.log("\nMonitoreando stats cada 10 seg (2 min total)...\n");
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const st = await req("GET", `/api/campaigns/${cmpId}`, null, cookie);
    const c = st.body.campaign || {};
    const s = c.stats || {};
    const r = (c.recipientsSnapshot || [])[0] || {};
    const tag = (s.openedUnique > 0 ? "👁️" : "  ") + (s.clickedUnique > 0 ? "🖱" : " ");
    console.log(`T+${(i + 1) * 10}s ${tag} | sent:${s.sent} delivered:${s.delivered} opened:${s.openedUnique} clicked:${s.clickedUnique} | openedAt:${r.openedAt || "—"} clickedAt:${r.clickedAt || "—"}`);
  }
  console.log("\n[TEST FINAL]");
  console.log("Campaign ID:", cmpId);
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });

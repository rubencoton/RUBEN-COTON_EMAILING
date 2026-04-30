/**
 * Lanzamiento end-to-end: crea segmento + campaña al CRM 7 PRUEBAS y la envía.
 * Uso: node scripts/test_send_campaign.js
 */
const http = require("http");

const BASE = "http://localhost:3000";
const PASSWORD = "+artesbuho26";

const req = (method, path, body, cookie) =>
  new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body), "utf-8") : null;
    const r = http.request(
      {
        method,
        hostname: "localhost",
        port: 3000,
        path,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...(data ? { "Content-Length": data.length } : {}),
          ...(cookie ? { Cookie: cookie } : {})
        }
      },
      (res) => {
        let chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks).toString("utf-8");
          let json = null;
          try { json = JSON.parse(buf); } catch {}
          resolve({ status: res.statusCode, body: json || buf, headers: res.headers });
        });
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });

(async () => {
  // 1. Login
  console.log("[1/5] Login…");
  const login = await req("POST", "/api/auth/login", { password: PASSWORD });
  const cookie = (login.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
  console.log("    OK", login.status);

  // 2. Buscar contacto rubencoton1993
  console.log("\n[2/5] Buscando contacto rubencoton1993…");
  const list = await req("GET", "/api/contacts?limit=500", null, cookie);
  const allContacts = list.body.contacts || [];
  const ruben = allContacts.find((c) => /rubencoton1993/.test(c.email || ""));
  console.log("    Total visible:", allContacts.length);
  console.log("    Ruben encontrado:", ruben ? `${ruben.email}` : "NO (puede estar fuera de los 500 primeros)");

  // 3. Crear segmento que filtra por email exacto
  console.log("\n[3/5] Creando segmento TEST_END_TO_END…");
  const seg = await req("POST", "/api/segments", {
    name: "TEST_END_TO_END",
    match: "all",
    rules: [{ field: "email", op: "equals", value: "rubencoton1993@gmail.com" }]
  }, cookie);
  console.log("    Segment:", seg.body?.segment?.id, "count:", seg.body?.segment?.count);

  // 4. Crear campaña
  console.log("\n[4/5] Creando campaña…");
  const campaign = await req("POST", "/api/campaigns", {
    name: "TEST End-to-End Local",
    subject: "✅ Test campaña local — Sistema operativo Artes Búho",
    fromName: "Artes Búho Management",
    fromEmail: "booking@artesbuhomanagement.com",
    replyTo: "booking@artesbuhomanagement.com",
    segmentId: seg.body.segment.id,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h1 style="color:#a81117;margin:0 0 16px">¡Hola Rubén! 👋</h1>
  <p>Esta campaña ha pasado por <strong>todo el flujo completo</strong>:</p>
  <ol>
    <li>Contacto leído desde Google Sheets (CRM 7 PRUEBAS)</li>
    <li>Filtrado por segmento TEST_END_TO_END</li>
    <li>Renderizado con plantilla HTML</li>
    <li>Enviado por motor massMailEngine</li>
    <li>Despachado por Gmail API (OAuth2)</li>
    <li>Tracking pixel + click redirect inyectados</li>
  </ol>
  <p>Sistema 100% operativo en local — listo para migrar a VPS cuando quieras.</p>
  <p style="margin-top:24px">Saludos,<br><strong>Artes Búho Management</strong></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:11px;color:#999">
    Test enviado desde localhost:3000 · Sistema construido por RUBEN COTON
  </p>
</div>`,
    plainText: "Hola Rubén, test end-to-end del sistema de emailing local Artes Búho. Sistema 100% operativo. Saludos."
  }, cookie);
  console.log("    Campaign:", campaign.body?.campaign?.id);

  // 5. Lanzar
  const cmpId = campaign.body.campaign.id;
  console.log("\n[5/5] Lanzando campaña…");
  const send = await req("POST", `/api/campaigns/${cmpId}/send`, {}, cookie);
  console.log("    Send:", send.body?.status, send.body?.message || "");

  // Esperar 8s y mostrar estado
  await new Promise((r) => setTimeout(r, 8000));
  const status = await req("GET", `/api/campaigns/${cmpId}`, null, cookie);
  const c = status.body.campaign;
  console.log("\n═══════════════════════════════════════════════");
  console.log("  RESULTADO FINAL");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Estado: ${c.status}`);
  console.log(`  Stats: ${JSON.stringify(c.stats, null, 0)}`);
  console.log(`  Errors: ${JSON.stringify(c.errors || [])}`);
  console.log("\n👀 Mira tu inbox de rubencoton1993@gmail.com");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});

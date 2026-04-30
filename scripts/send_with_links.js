const http = require("http");

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
        try { json = JSON.parse(buf); } catch {}
        resolve({ status: res.statusCode, body: json || buf, headers: res.headers });
      });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });

(async () => {
  // Restaurar contacto
  const fs = require("fs");
  const path = "./data/store.json";
  const d = JSON.parse(fs.readFileSync(path, "utf-8"));
  const cont = d.contacts.find(c => /rubencoton1993/.test(c.email || ""));
  if (cont) {
    cont.status = "subscribed";
    cont.bouncedAt = null;
    fs.writeFileSync(path, JSON.stringify(d, null, 2), "utf-8");
    console.log("Contacto restaurado");
  }

  // Necesito reiniciar para que el cambio se cargue, pero como ya esta corriendo voy a hacer login y forzar
  const login = await req("POST", "/api/auth/login", { password: "+ruben93" });
  const cookie = (login.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
  console.log("Login:", login.status);

  // Crear segmento
  const seg = await req("POST", "/api/segments", {
    name: "TEST_LINKS",
    match: "all",
    rules: [{ field: "email", op: "equals", value: "rubencoton1993@gmail.com" }]
  }, cookie);
  console.log("Segment:", seg.body?.segment?.id, "count:", seg.body?.segment?.count);

  // Crear campaña con LINKS clicables
  const campaign = await req("POST", "/api/campaigns", {
    name: "Test Links",
    subject: "🔗 Test enlaces — RUBEN COTON local",
    fromName: "RUBEN COTON",
    fromEmail: "manager@rubencoton.com",
    replyTo: "manager@rubencoton.com",
    segmentId: seg.body.segment.id,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h1 style="color:#E65100">¡Hola Rubén! 👋</h1>
  <p>Este email tiene <strong>varios links clicables</strong>. Cuando hagas click en cualquiera, la app va a registrar el click.</p>

  <h3 style="color:#E65100;margin-top:24px">Links de prueba:</h3>
  <ul style="line-height:2">
    <li><a href="https://www.google.com" style="color:#E65100;font-weight:bold">🔍 Buscar en Google</a></li>
    <li><a href="https://rubencoton.com" style="color:#E65100;font-weight:bold">🌐 Web RUBEN COTON</a></li>
    <li><a href="https://www.youtube.com" style="color:#E65100;font-weight:bold">📺 YouTube</a></li>
    <li><a href="https://drive.google.com" style="color:#E65100;font-weight:bold">📁 Drive</a></li>
  </ul>

  <p style="margin-top:24px">Cuando hagas click en cualquiera de los links, te llevará a la web pero <strong>antes</strong> pasará por nuestro tracking de la app local. Eso registrará el click.</p>

  <p>Saludos,<br><strong>RUBEN COTON</strong></p>

  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:11px;color:#999">
    Test enviado desde localhost:3000
  </p>
</div>`,
    plainText: "Test con links - RUBEN COTON local"
  }, cookie);
  console.log("Campaign:", campaign.body?.campaign?.id);

  // Lanzar
  const cmpId = campaign.body.campaign.id;
  const send = await req("POST", `/api/campaigns/${cmpId}/send`, {}, cookie);
  console.log("Send:", send.body?.status, send.body?.message || "");

  await new Promise((r) => setTimeout(r, 8000));
  const status = await req("GET", `/api/campaigns/${cmpId}`, null, cookie);
  const c = status.body.campaign;
  console.log("\n=== RESULTADO ===");
  console.log("Estado:", c.status);
  console.log("Stats:", JSON.stringify(c.stats));
  console.log("\n👀 Mira tu inbox: rubencoton1993@gmail.com");
  console.log("🖱  Haz click en cualquier link y verás el click registrado");
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });

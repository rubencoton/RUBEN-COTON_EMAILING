/**
 * Test cola: lanza 3 campañas seguidas a rubencoton1993@gmail.com
 * y muestra cómo se procesan a 5/min (1 cada 12 segundos).
 */
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
        try { json = JSON.parse(buf.replace(/^﻿/, "")); } catch {}
        resolve({ status: res.statusCode, body: json || buf, headers: res.headers });
      });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });

(async () => {
  // Restaurar contacto subscribed
  const fs = require("fs");
  const d = JSON.parse(fs.readFileSync("./data/store.json", "utf-8"));
  const cont = d.contacts.find(c => /rubencoton1993/.test(c.email || ""));
  if (cont) {
    cont.status = "subscribed";
    cont.bouncedAt = null;
    fs.writeFileSync("./data/store.json", JSON.stringify(d, null, 2), "utf-8");
  }

  const login = await req("POST", "/api/auth/login", { password: "+ruben93" });
  const cookie = (login.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
  console.log("[Login OK]");

  // Buscar/crear segmento "RUBEN_TEST"
  const segs = await req("GET", "/api/segments", null, cookie);
  let segId = (segs.body.segments || segs.body || []).find(s => s.name === "RUBEN_TEST")?.id;
  if (!segId) {
    const seg = await req("POST", "/api/segments", {
      name: "RUBEN_TEST",
      match: "all",
      rules: [{ field: "email", op: "equals", value: "rubencoton1993@gmail.com" }]
    }, cookie);
    segId = seg.body.segment.id;
  }
  console.log("[Segmento]", segId);

  const CAMPAIGNS = [
    {
      name: "Cola test 1/3 — Cinema",
      subject: "1️⃣ Test cola — Cinema",
      html: `<div style="font-family:Arial;padding:20px;max-width:600px;margin:auto">
<h1 style="color:#E65100">🎬 Email 1 de 3 — Cinema</h1>
<p>Esta es la <strong>PRIMERA</strong> campaña de la prueba de cola. Si lees esto, salió de la cola en su turno.</p>
<p><a href="https://www.imdb.com">🎬 IMDB</a> | <a href="https://www.netflix.com">📺 Netflix</a></p>
<p style="font-size:11px;color:#999">Hora previsto: T+0 seg</p>
</div>`
    },
    {
      name: "Cola test 2/3 — Música",
      subject: "2️⃣ Test cola — Música",
      html: `<div style="font-family:Arial;padding:20px;max-width:600px;margin:auto">
<h1 style="color:#E65100">🎵 Email 2 de 3 — Música</h1>
<p>Esta es la <strong>SEGUNDA</strong> campaña. Debería llegar 12 seg después de la 1ª.</p>
<p><a href="https://open.spotify.com">🎶 Spotify</a> | <a href="https://www.youtube.com/music">📻 YT Music</a></p>
<p style="font-size:11px;color:#999">Hora previsto: T+12 seg</p>
</div>`
    },
    {
      name: "Cola test 3/3 — Viaje",
      subject: "3️⃣ Test cola — Viaje",
      html: `<div style="font-family:Arial;padding:20px;max-width:600px;margin:auto">
<h1 style="color:#E65100">✈️ Email 3 de 3 — Viaje</h1>
<p>Esta es la <strong>TERCERA y última</strong> campaña. Debería llegar 12 seg después de la 2ª.</p>
<p><a href="https://www.skyscanner.es">✈️ Skyscanner</a> | <a href="https://www.booking.com">🏨 Booking</a></p>
<p style="font-size:11px;color:#999">Hora previsto: T+24 seg</p>
</div>`
    }
  ];

  const cmpIds = [];
  for (const c of CAMPAIGNS) {
    const cmp = await req("POST", "/api/campaigns", {
      ...c,
      fromName: "RUBEN COTON",
      fromEmail: "manager@rubencoton.com",
      replyTo: "manager@rubencoton.com",
      segmentId: segId,
      plainText: c.subject
    }, cookie);
    cmpIds.push(cmp.body.campaign.id);
    console.log("[Creada]", c.name, "→", cmp.body.campaign.id);
  }

  console.log("\n[Lanzando las 3 campañas a la cola con 1 segundo de diferencia]\n");

  for (const id of cmpIds) {
    const send = await req("POST", `/api/campaigns/${id}/send`, {}, cookie);
    console.log(`  → ${id}: ${send.body?.status} ${send.body?.message || ""}`);
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\n[Monitor — estado cola cada 5 seg]\n");
  const start = Date.now();
  for (let i = 0; i < 10; i++) {
    const st = await req("GET", "/api/mass-mail/status", null, cookie);
    const e = st.body?.engine || {};
    const cap = e.dailyCap || {};
    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(`T+${elapsed}s | Cola: ${e.queueSize} | Cap: ${cap.used}/${cap.limit} | Jobs: ${e.jobsTotal}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });

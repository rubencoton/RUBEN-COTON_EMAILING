/**
 * Crea una campaña FICTICIA con 2.000 destinatarios simulados.
 * Estadísticas realistas (industria emailing B2B promedio):
 *   - Delivered: 98%   (1960 / 2000)
 *   - Opened (uniq): 25% (500)
 *   - Clicked (uniq): 4.5% (90)
 *   - Bounced: 2%      (40)
 *   - Unsubscribed: 0.4% (8)
 *
 * NO ENVÍA NADA. Solo crea la campaña con stats fake en disco para
 * que veas el informe HTML/PDF.
 */
const fs = require("fs");
const path = require("path");

const STORE = path.join(__dirname, "..", "data", "store.json");
const d = JSON.parse(fs.readFileSync(STORE, "utf-8"));

const TOTAL = 2000;
const DELIVERED = 1960;
const OPENED_UNIQUE = 500;   // 25% apertura
const OPENED = 720;          // ~1.4 reaperturas por unique
const CLICKED_UNIQUE = 90;   // 4.5% click
const CLICKED = 132;         // ~1.5 clicks por unique
const BOUNCED = 40;          // 2%
const UNSUBSCRIBED = 8;      // 0.4%
const COMPLAINED = 1;

/* Generador de IDs */
const id = () => `cmp_FICTICIA_${Date.now().toString(36)}`;
const cId = () => `contact_FICT_${Math.random().toString(36).slice(2, 14)}`;

const campaignId = id();
const sentAt = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(); // ayer

/* Construir snapshot de 2000 destinatarios con estados realistas */
const recipients = [];
const FIRST_NAMES = ["Ana","Carlos","María","José","Lucía","Javier","Carmen","Luis","Marta","Pedro","Elena","Rubén","Sara","Antonio","Cristina","Pablo","Laura","Diego","Andrea","Sergio","Patricia","Juan","Isabel","Daniel","Eva","Manuel","Paula","Adrián","Nuria","Alberto"];
const LAST_NAMES = ["García","Rodríguez","Martínez","Sánchez","López","Pérez","Gómez","Ruiz","Hernández","Jiménez","Díaz","Moreno","Álvarez","Romero","Alonso","Torres","Vázquez","Ramos","Gil","Serrano"];
const COMPANIES = ["Sala Apolo","Teatro Real","Festival Sónar","Cultural Madrid","Centro Cívico","Ayto Barcelona","Universidad UCM","Palau Música","Sala BBK","Razzmatazz","Mad Cool","Rockodromo","Café Berlin","WiZink Center","Festejos Sevilla"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

let openedCount = 0, clickedCount = 0, bouncedCount = 0, unsubCount = 0;

for (let i = 0; i < TOTAL; i++) {
  const r = {
    contactId: cId(),
    email: `contacto.demo.${i + 1}@ejemplo.com`,
    firstName: pick(FIRST_NAMES),
    lastName: pick(LAST_NAMES),
    company: pick(COMPANIES),
    status: "sent",
    sentAt: new Date(Date.parse(sentAt) + i * 1000).toISOString(),
    deliveredAt: null,
    openedAt: null,
    clickedAt: null,
    bouncedAt: null,
    unsubscribedAt: null,
    complainedAt: null
  };
  // Distribuir estados
  if (bouncedCount < BOUNCED) {
    r.status = "bounced";
    r.bouncedAt = r.sentAt;
    bouncedCount++;
  } else {
    r.deliveredAt = new Date(Date.parse(r.sentAt) + 5000).toISOString();
    if (openedCount < OPENED_UNIQUE) {
      r.openedAt = new Date(Date.parse(r.deliveredAt) + 60000 + Math.random() * 3600000 * 12).toISOString();
      openedCount++;
      if (clickedCount < CLICKED_UNIQUE) {
        r.clickedAt = new Date(Date.parse(r.openedAt) + 30000).toISOString();
        clickedCount++;
      }
      if (unsubCount < UNSUBSCRIBED && Math.random() < 0.02) {
        r.unsubscribedAt = new Date(Date.parse(r.openedAt) + 120000).toISOString();
        unsubCount++;
      }
    }
  }
  recipients.push(r);
}

const campaign = {
  id: campaignId,
  name: "Campaña FICTICIA — Demo informe 2000 contactos",
  subject: "Promoción de bookings musicales — Temporada otoño 2026",
  fromName: "Artes Búho Management",
  fromEmail: "booking@artesbuhomanagement.com",
  replyTo: "booking@artesbuhomanagement.com",
  segmentId: null,
  listFilter: { tag: "demo-ficticio" },
  html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
<h1 style="color:#a81117">Promoción otoño 2026 — Artes Búho</h1>
<p>Hola {{firstName}},</p>
<p>Te escribimos desde <strong>Artes Búho Management</strong>. Tenemos disponibilidad para conciertos y actuaciones durante el otoño 2026:</p>
<ul>
  <li>🎵 Bandas tributo a artistas internacionales</li>
  <li>🎶 DJ sets para eventos privados</li>
  <li>🎭 Espectáculos teatrales y comedia</li>
  <li>🎤 Cantantes solistas</li>
</ul>
<p><a href="https://artesbuhomanagement.com" style="background:#a81117;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px">Ver catálogo completo</a></p>
<p>Saludos cordiales,<br><strong>Booking — Artes Búho</strong></p>
</div>`,
  plainText: "Promoción otoño 2026 - Artes Búho Management. Disponibilidad para conciertos.",
  status: "sent",
  sentAt,
  startedAt: sentAt,
  finishedAt: new Date(Date.parse(sentAt) + 5 * 60 * 60 * 1000).toISOString(), // 5h despues
  createdAt: sentAt,
  updatedAt: new Date().toISOString(),
  recipientsSnapshot: recipients,
  stats: {
    total: TOTAL,
    queued: 0,
    sent: TOTAL - BOUNCED,
    delivered: DELIVERED,
    opened: OPENED,
    openedUnique: OPENED_UNIQUE,
    clicked: CLICKED,
    clickedUnique: CLICKED_UNIQUE,
    bounced: BOUNCED,
    unsubscribed: UNSUBSCRIBED,
    complained: COMPLAINED,
    replied: 12
  },
  errors: []
};

d.campaigns.push(campaign);
fs.writeFileSync(STORE, JSON.stringify(d, null, 2), "utf-8");

console.log("═══════════════════════════════════════════════");
console.log("  CAMPAÑA FICTICIA CREADA");
console.log("═══════════════════════════════════════════════");
console.log("ID:        ", campaignId);
console.log("Nombre:    ", campaign.name);
console.log("Estado:    ", campaign.status);
console.log("");
console.log("STATS:");
console.log(`  Total enviados:    ${TOTAL.toLocaleString()}`);
console.log(`  Delivered:         ${DELIVERED.toLocaleString()} (${((DELIVERED / TOTAL) * 100).toFixed(1)}%)`);
console.log(`  Apertura única:    ${OPENED_UNIQUE.toLocaleString()} (${((OPENED_UNIQUE / DELIVERED) * 100).toFixed(1)}%)`);
console.log(`  Apertura total:    ${OPENED.toLocaleString()}`);
console.log(`  Click único:       ${CLICKED_UNIQUE.toLocaleString()} (${((CLICKED_UNIQUE / DELIVERED) * 100).toFixed(1)}%)`);
console.log(`  Click total:       ${CLICKED.toLocaleString()}`);
console.log(`  Rebote:            ${BOUNCED.toLocaleString()} (${((BOUNCED / TOTAL) * 100).toFixed(1)}%)`);
console.log(`  Baja (unsub):      ${UNSUBSCRIBED.toLocaleString()} (${((UNSUBSCRIBED / TOTAL) * 100).toFixed(2)}%)`);
console.log("");
console.log("URLs PARA VER:");
console.log(`  Informe HTML:    http://localhost:3000/campaigns/${campaignId}/report`);
console.log(`  Vista previa:    http://localhost:3000/campaigns/${campaignId}/preview`);
console.log(`  Datos JSON:      http://localhost:3000/api/campaigns/${campaignId}/report`);
console.log("");
console.log("Para descargar PDF: abre el informe HTML y Ctrl+P → Guardar como PDF");

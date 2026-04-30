"use strict";

/**
 * reportRenderer.js — Genera el HTML del informe de campaña server-side.
 *
 * Razón: pdfGen sube HTML a Drive y lo convierte a PDF. Drive NO ejecuta
 * JavaScript, así que un informe que carga datos via fetch queda como
 * "Cargando…" en el PDF. Este módulo construye el HTML completo con
 * todos los datos ya inyectados.
 *
 * Diseño visual: limpio, armónico, claro. Naranja/negro/blanco corporativos.
 * Sin emails ni teléfonos en el listado (RGPD).
 */

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const fmt = (n) => Number(n || 0).toLocaleString("es-ES");
const pct = (n, d) => d > 0 ? ((n / d) * 100).toFixed(1) + "%" : "—";

const STATUS_ES = {
  draft: "Borrador", queued: "En cola", sending: "Enviando",
  sent: "Enviada", paused: "Pausada", failed: "Error",
  scheduled: "Programada", completed: "Completada"
};
const tStatus = (s) => STATUS_ES[String(s || "").toLowerCase()] || s || "—";

const STATUS_PILL = {
  enviado: { bg: "#e0e7ff", fg: "#3730a3" },
  abierto: { bg: "#dbeafe", fg: "#1e40af" },
  clic: { bg: "#dcfce7", fg: "#166534" },
  rebote: { bg: "#fee2e2", fg: "#991b1b" },
  baja: { bg: "#fef3c7", fg: "#92400e" },
  "en cola": { bg: "#f3f4f6", fg: "#374151" }
};
const pill = (status) => {
  const s = String(status || "en cola").toLowerCase();
  const c = STATUS_PILL[s] || { bg: "#f3f4f6", fg: "#374151" };
  return `<span style="display:inline-block;padding:3px 10px;border-radius:10px;font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:${c.bg};color:${c.fg}">${esc(s)}</span>`;
};

/* Benchmarks B2B email marketing */
const BENCHMARK = {
  open: { low: 15, mid: 22, high: 35 },
  click: { low: 1.5, mid: 3, high: 7 },
  bounce: { low: 0.5, mid: 2, high: 5 }
};
const grade = (val, b, inverse) => {
  if (inverse) {
    if (val <= b.low) return { label: "EXCELENTE", color: "#10b981" };
    if (val <= b.mid) return { label: "BUENO", color: "#10b981" };
    if (val <= b.high) return { label: "ACEPTABLE", color: "#f59e0b" };
    return { label: "REVISAR", color: "#dc2626" };
  }
  if (val >= b.high) return { label: "EXCELENTE", color: "#10b981" };
  if (val >= b.mid) return { label: "BUENO", color: "#10b981" };
  if (val >= b.low) return { label: "ACEPTABLE", color: "#f59e0b" };
  return { label: "POR MEJORAR", color: "#dc2626" };
};

const LOGO_URL = "https://lh3.googleusercontent.com/d/16UZKQnCW0J9qqd9yLZ9t4jukrp3p9hcj=w200";

/**
 * Genera HTML completo del informe de UNA campaña, listo para PDF.
 * @param {object} reportData {campaign, stats, recipients, generatedAt}
 * @param {string} campaignId
 * @returns {string} HTML completo standalone
 */
function renderCampaignReport(reportData, campaignId) {
  const c = reportData.campaign || {};
  const s = reportData.stats || {};
  const recipients = reportData.recipients || [];
  const gen = new Date(reportData.generatedAt || Date.now());

  /* Métricas calculadas */
  const sent = Number(s.sent || 0);
  const total = Number(s.total || recipients.length || 0);
  const opened = Number(s.opened || s.openedUnique || 0);
  const clicked = Number(s.clicked || s.clickedUnique || 0);
  const bounced = Number(s.bounced || 0);
  const unsub = Number(s.unsubscribed || 0);
  const replied = Number(s.replied || 0);

  const openPct = sent > 0 ? (opened / sent) * 100 : 0;
  const clickPct = sent > 0 ? (clicked / sent) * 100 : 0;
  const bouncePct = total > 0 ? (bounced / total) * 100 : 0;
  const ctor = opened > 0 ? (clicked / opened) * 100 : 0;
  const deliv = sent > 0 ? ((sent - bounced) / sent) * 100 : 0;

  const gOpen = grade(openPct, BENCHMARK.open);
  const gClick = grade(clickPct, BENCHMARK.click);
  const gBounce = grade(bouncePct, BENCHMARK.bounce, true);

  /* Agrupaciones */
  const byCCAA = {}, byProv = {}, byCat = {};
  for (const r of recipients) {
    if (r.ccaa && r.ccaa !== "—") byCCAA[r.ccaa] = (byCCAA[r.ccaa] || 0) + 1;
    if (r.provincia && r.provincia !== "—") byProv[r.provincia] = (byProv[r.provincia] || 0) + 1;
    if (r.categoria && r.categoria !== "—") byCat[r.categoria] = (byCat[r.categoria] || 0) + 1;
  }
  const sortObj = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  const topCCAA = sortObj(byCCAA).slice(0, 8);
  const topProv = sortObj(byProv).slice(0, 10);
  const topCat = sortObj(byCat).slice(0, 8);
  const maxCCAA = Math.max(1, ...topCCAA.map((x) => x[1]));
  const maxProv = Math.max(1, ...topProv.map((x) => x[1]));
  const maxCat = Math.max(1, ...topCat.map((x) => x[1]));

  const barRow = (k, v, max) => `
    <tr>
      <td style="padding:6px 12px;font-size:10pt;font-weight:600;width:200px">${esc(k)}</td>
      <td style="padding:6px 12px"><div style="background:#f3f4f6;height:14px;border-radius:7px;overflow:hidden"><div style="height:100%;background:linear-gradient(90deg,#FF6B00,#E65100);width:${(v / max * 100).toFixed(1)}%"></div></div></td>
      <td style="padding:6px 12px;text-align:right;font-weight:700;color:#E65100;width:60px">${fmt(v)}</td>
    </tr>`;

  const recipientRows = recipients.map((r, i) => `
    <tr>
      <td style="padding:8px 10px;color:#9ca3af;font-family:monospace;font-size:9pt">${String(i + 1).padStart(3, "0")}</td>
      <td style="padding:8px 10px"><strong>${esc(r.empresa || "—")}</strong></td>
      <td style="padding:8px 10px">${esc(r.municipio || "—")}</td>
      <td style="padding:8px 10px">${esc(r.provincia || "—")}</td>
      <td style="padding:8px 10px">${esc(r.ccaa || "—")}</td>
      <td style="padding:8px 10px">${esc(r.categoria || "—")}</td>
      <td style="padding:8px 10px">${pill(r.status)}</td>
    </tr>`).join("") || `<tr><td colspan="7" style="padding:20px;text-align:center;color:#9ca3af">Sin destinatarios</td></tr>`;

  const recos = [];
  if (sent === 0) recos.push("La campaña aún no se ha enviado o está en cola. Las métricas se actualizarán tras el envío.");
  if (sent > 0) {
    if (openPct < BENCHMARK.open.low) recos.push("<strong>Apertura baja.</strong> Prueba asuntos más cortos (&lt;50 caracteres) y con gancho emocional. Evita palabras tipo \"gratis\" o \"urgente\".");
    if (openPct >= BENCHMARK.open.high) recos.push("<strong>Apertura excelente.</strong> Replica este estilo de asunto en futuras campañas.");
    if (clickPct < BENCHMARK.click.low && opened > 5) recos.push("<strong>Pocos clics.</strong> Revisa que el CTA sea claro, visible y único en el email.");
    if (clickPct >= BENCHMARK.click.high) recos.push("<strong>Clics por encima de la media.</strong> El contenido conecta con el destinatario.");
    if (bouncePct > BENCHMARK.bounce.high) recos.push("<strong>Rebotes altos.</strong> Depura la base: elimina bounced y suppressed antes del próximo envío.");
    if (ctor > 15) recos.push("<strong>CTOR muy alto.</strong> Cuando abren, clican. El diseño del email funciona.");
  }
  if (recos.length === 0) recos.push("La campaña se desempeña dentro de los parámetros habituales del sector. Mantener estrategia.");

  const code = "CMP-" + (c.sentAt || c.createdAt || "").slice(0, 10).replace(/-/g, "") + "-" + String(campaignId || "").slice(-4);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe ${esc(c.name)} | RUBEN COTON</title>
<style>
@page { size: A4 portrait; margin: 14mm 12mm 16mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Inter","Segoe UI",Arial,sans-serif; color: #1a1a1a; background: #fff; line-height: 1.5; font-size: 10.5pt; }
.cover { background: linear-gradient(145deg,#FF6B00,#E65100,#BF360C); color: #fff; padding: 48px 40px; border-radius: 12px; margin-bottom: 28px; page-break-after: always; }
.cover-top { display: flex; align-items: center; gap: 18px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.2); }
.cover-top img { width: 70px; height: 70px; border-radius: 12px; background: #fff; padding: 6px; }
.cover-top h1 { font-size: 24pt; letter-spacing: 5px; font-weight: 900; }
.cover-top .tag { color: #FFB74D; font-size: 10pt; letter-spacing: 3px; text-transform: uppercase; font-weight: 700; margin-top: 4px; }
.cover-doc { display: inline-block; background: rgba(255,183,77,0.18); border: 1.5px solid #FFB74D; color: #FFB74D; padding: 6px 18px; border-radius: 24px; font-size: 9pt; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; margin: 32px 0 24px; }
.cover h2 { font-size: 22pt; line-height: 1.2; margin-bottom: 12px; font-weight: 800; }
.cover .subj { font-size: 11pt; opacity: 0.92; font-style: italic; padding: 12px 16px; background: rgba(255,255,255,0.08); border-left: 3px solid #FFB74D; border-radius: 4px; margin-bottom: 28px; }
.meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
.meta-item { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 12px 16px; }
.meta-item .lbl { font-size: 8.5pt; color: #FFB74D; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; }
.meta-item .val { font-size: 11pt; margin-top: 3px; font-weight: 600; }
.cover-foot { padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.2); display: flex; justify-content: space-between; font-size: 9pt; }
.cover-foot .conf { background: #1a1a1a; padding: 3px 10px; border-radius: 4px; font-weight: 700; letter-spacing: 1.5px; font-size: 8.5pt; }
.section { padding: 8px 0 20px; page-break-inside: avoid; }
.section h3 { color: #E65100; font-size: 14pt; padding-bottom: 8px; border-bottom: 3px solid #FF6B00; margin-bottom: 14px; display: flex; align-items: center; gap: 12px; font-weight: 800; }
.section h3 .num { width: 32px; height: 32px; background: linear-gradient(135deg,#FF6B00,#E65100); color: #fff; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 12pt; font-weight: 900; }
.section h4 { color: #E65100; font-size: 11pt; margin: 16px 0 8px; padding-left: 10px; border-left: 3px solid #FFB74D; }
.kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin: 12px 0; }
.kpi { background: #fff; border: 1px solid #e5e7eb; border-top: 4px solid #FF6B00; padding: 12px 10px; border-radius: 8px; text-align: center; }
.kpi-num { font-size: 20pt; font-weight: 900; color: #E65100; line-height: 1.1; }
.kpi-lbl { font-size: 8.5pt; color: #6b7280; text-transform: uppercase; font-weight: 700; margin-top: 4px; letter-spacing: 0.5px; }
.kpi-sub { font-size: 8pt; color: #9ca3af; margin-top: 3px; font-weight: 600; }
.kpi.ok { border-top-color: #10b981; } .kpi.ok .kpi-num { color: #10b981; }
.kpi.warn { border-top-color: #f59e0b; } .kpi.warn .kpi-num { color: #f59e0b; }
.kpi.bad { border-top-color: #dc2626; } .kpi.bad .kpi-num { color: #dc2626; }
.kpi.neu { border-top-color: #6b7280; } .kpi.neu .kpi-num { color: #1a1a1a; }
.callout { padding: 14px 18px; border-radius: 8px; margin: 12px 0; font-size: 10pt; }
.callout.exec { background: linear-gradient(135deg,#fff5e6,#fff8e1); border-left: 4px solid #FF6B00; }
.callout.warn { background: #fff8e1; border-left: 4px solid #FFB74D; }
.callout.tip { background: #eef4ff; border-left: 4px solid #3b82f6; }
.callout p { margin: 4px 0; }
.callout strong { color: #1a1a1a; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5pt; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
table th { background: #FF6B00; color: #fff; padding: 8px 10px; text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; border-bottom: 3px solid #FFB74D; }
table td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; }
table tr:nth-child(even) td { background: #fafafa; }
.privacy { background: #FF6B00; color: #fff; padding: 12px 18px; border-radius: 8px; font-size: 9.5pt; margin: 12px 0; border-left: 5px solid #FFB74D; }
.privacy strong { color: #FFB74D; }
.email-card { border: 1.5px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin: 12px 0; }
.email-head { background: #FF6B00; color: #fff; padding: 12px 16px; }
.email-head .row { display: flex; gap: 10px; align-items: baseline; margin: 2px 0; font-size: 9.5pt; }
.email-head .lbl { background: #1a1a1a; color: #FFB74D; padding: 1px 8px; border-radius: 8px; font-size: 7.5pt; font-weight: 700; min-width: 64px; text-align: center; }
.email-head .val em { color: #FFB74D; font-style: normal; font-weight: 700; }
.email-body { padding: 16px; background: #fff; }
.bench-table td { padding: 10px 12px; }
.bench-table .label { font-weight: 700; }
.footer { margin-top: 24px; padding: 22px 18px; background: linear-gradient(135deg,#FF6B00,#E65100); color: #fff; border-radius: 12px; text-align: center; font-size: 9.5pt; border-top: 5px solid #FFB74D; }
.footer img { width: 50px; height: 50px; border-radius: 8px; background: #fff; padding: 4px; margin-bottom: 8px; }
.footer strong { color: #FFB74D; font-size: 11pt; letter-spacing: 1.5px; }
.glossary dt { font-weight: 700; color: #E65100; margin-top: 8px; font-size: 10pt; }
.glossary dd { color: #555; font-size: 9.5pt; margin-top: 2px; }
ul { margin-left: 20px; margin-top: 6px; }
ul li { margin: 4px 0; }
</style>
</head>
<body>

<!-- ========= PORTADA ========= -->
<div class="cover">
  <div class="cover-top">
    <img src="${LOGO_URL}" alt="RUBEN COTON">
    <div>
      <h1>RUBEN COTON</h1>
      <div class="tag">DJ · Booking · Management</div>
    </div>
  </div>
  <div class="cover-doc">Informe ejecutivo de campaña</div>
  <h2>${esc(c.name || "Campaña sin nombre")}</h2>
  <div class="subj">"${esc(c.subject || "—")}"</div>
  <div class="meta-grid">
    <div class="meta-item"><div class="lbl">Fecha del informe</div><div class="val">${gen.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</div></div>
    <div class="meta-item"><div class="lbl">Hora generación</div><div class="val">${gen.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} h</div></div>
    <div class="meta-item"><div class="lbl">Estado campaña</div><div class="val">${esc(tStatus(c.status))}</div></div>
    <div class="meta-item"><div class="lbl">Destinatarios</div><div class="val">${fmt(recipients.length)} entidades</div></div>
  </div>
  <div class="cover-foot">
    <div>Madrid, España &middot; manager@rubencoton.com</div>
    <div class="conf">Confidencial</div>
  </div>
</div>

<!-- ========= 1. RESUMEN EJECUTIVO ========= -->
<div class="section">
  <h3><span class="num">1</span>Resumen ejecutivo</h3>
  <div class="callout exec">
    <p>La campaña <strong>${esc(c.name)}</strong> impactó a <strong>${fmt(recipients.length)} entidades</strong> en <strong>${Object.keys(byCCAA).length} comunidades autónomas</strong>${sent > 0 ? ` con una tasa de apertura del <strong>${openPct.toFixed(1)}%</strong> y de clic del <strong>${clickPct.toFixed(2)}%</strong>` : ""}.</p>
  </div>
  <div class="kpis">
    <div class="kpi ${gOpen.label.includes("EXCEL") || gOpen.label.includes("BUEN") ? "ok" : gOpen.label.includes("ACEP") ? "warn" : "bad"}">
      <div class="kpi-num">${openPct.toFixed(1)}%</div><div class="kpi-lbl">Apertura</div><div class="kpi-sub">${gOpen.label}</div>
    </div>
    <div class="kpi ${gClick.label.includes("EXCEL") || gClick.label.includes("BUEN") ? "ok" : gClick.label.includes("ACEP") ? "warn" : "bad"}">
      <div class="kpi-num">${clickPct.toFixed(1)}%</div><div class="kpi-lbl">Clic</div><div class="kpi-sub">${gClick.label}</div>
    </div>
    <div class="kpi ${gBounce.label.includes("EXCEL") || gBounce.label.includes("BUEN") ? "ok" : gBounce.label.includes("ACEP") ? "warn" : "bad"}">
      <div class="kpi-num">${bouncePct.toFixed(1)}%</div><div class="kpi-lbl">Rebotes</div><div class="kpi-sub">${gBounce.label}</div>
    </div>
    <div class="kpi neu">
      <div class="kpi-num">${replied}</div><div class="kpi-lbl">Respuestas</div><div class="kpi-sub">contestaciones</div>
    </div>
  </div>
</div>

<!-- ========= 2. DATOS DE LA CAMPAÑA ========= -->
<div class="section">
  <h3><span class="num">2</span>Datos de la campaña</h3>
  <table>
    <tr><th style="width:30%">Concepto</th><th>Valor</th></tr>
    <tr><td><strong>Nombre interno</strong></td><td>${esc(c.name || "—")}</td></tr>
    <tr><td><strong>Asunto del email</strong></td><td>${esc(c.subject || "—")}</td></tr>
    <tr><td><strong>Remitente</strong></td><td>${esc(c.fromName || "RUBEN COTON")} &lt;${esc(c.fromEmail || "manager@rubencoton.com")}&gt;</td></tr>
    <tr><td><strong>Estado</strong></td><td>${esc(tStatus(c.status))}</td></tr>
    <tr><td><strong>Código</strong></td><td style="font-family:monospace;font-size:10pt">${esc(code)}</td></tr>
    <tr><td><strong>Fecha de creación</strong></td><td>${c.createdAt ? new Date(c.createdAt).toLocaleString("es-ES") : "—"}</td></tr>
    <tr><td><strong>Fecha de envío</strong></td><td>${c.sentAt ? new Date(c.sentAt).toLocaleString("es-ES") : "Pendiente"}</td></tr>
  </table>
</div>

<!-- ========= 3. MÉTRICAS DETALLADAS ========= -->
<div class="section">
  <h3><span class="num">3</span>Métricas detalladas</h3>
  <div class="kpis">
    <div class="kpi neu"><div class="kpi-num">${fmt(total)}</div><div class="kpi-lbl">Destinatarios</div></div>
    <div class="kpi neu"><div class="kpi-num">${fmt(sent)}</div><div class="kpi-lbl">Enviados</div><div class="kpi-sub">${pct(sent, total)} del total</div></div>
    <div class="kpi ok"><div class="kpi-num">${fmt(opened)}</div><div class="kpi-lbl">Aperturas</div><div class="kpi-sub">${pct(opened, sent)}</div></div>
    <div class="kpi ok"><div class="kpi-num">${fmt(clicked)}</div><div class="kpi-lbl">Clics</div><div class="kpi-sub">${pct(clicked, sent)}</div></div>
  </div>
  <div class="kpis">
    <div class="kpi bad"><div class="kpi-num">${fmt(bounced)}</div><div class="kpi-lbl">Rebotes</div><div class="kpi-sub">${pct(bounced, total)}</div></div>
    <div class="kpi warn"><div class="kpi-num">${fmt(unsub)}</div><div class="kpi-lbl">Bajas</div><div class="kpi-sub">${pct(unsub, sent)}</div></div>
    <div class="kpi neu"><div class="kpi-num">${ctor.toFixed(1)}%</div><div class="kpi-lbl">CTOR</div><div class="kpi-sub">clic / apertura</div></div>
    <div class="kpi ok"><div class="kpi-num">${deliv.toFixed(1)}%</div><div class="kpi-lbl">Entregabilidad</div></div>
  </div>
</div>

<!-- ========= 4. RENDIMIENTO VS SECTOR ========= -->
<div class="section">
  <h3><span class="num">4</span>Rendimiento vs. sector</h3>
  <table class="bench-table">
    <tr><th>Métrica</th><th>Campaña</th><th>Benchmark sector B2B</th><th>Valoración</th></tr>
    <tr><td class="label">Tasa de apertura</td><td><strong>${openPct.toFixed(1)}%</strong></td><td>22% media · 35% top</td><td><span style="color:${gOpen.color};font-weight:700">${gOpen.label}</span></td></tr>
    <tr><td class="label">Tasa de clic</td><td><strong>${clickPct.toFixed(2)}%</strong></td><td>3% media · 7% top</td><td><span style="color:${gClick.color};font-weight:700">${gClick.label}</span></td></tr>
    <tr><td class="label">Tasa de rebote</td><td><strong>${bouncePct.toFixed(2)}%</strong></td><td>≤ 2% (saludable)</td><td><span style="color:${gBounce.color};font-weight:700">${gBounce.label}</span></td></tr>
  </table>
  <div class="callout tip"><strong>Interpretación:</strong> las campañas B2B del sector cultural y booking suelen tener aperturas altas (25-30%) pero clics moderados (2-4%) porque el contenido es informativo, no de compra directa.</div>
</div>

<!-- ========= 5. EMAIL ENVIADO ========= -->
<div class="section">
  <h3><span class="num">5</span>Email enviado</h3>
  <div class="email-card">
    <div class="email-head">
      <div class="row"><span class="lbl">DE</span><span>${esc(c.fromName || "RUBEN COTON")} &lt;<em>${esc(c.fromEmail || "manager@rubencoton.com")}</em>&gt;</span></div>
      <div class="row"><span class="lbl">PARA</span><span>${fmt(recipients.length)} destinatarios</span></div>
      <div class="row"><span class="lbl">ASUNTO</span><span><strong>${esc(c.subject || "—")}</strong></span></div>
      <div class="row"><span class="lbl">FECHA</span><span>${c.sentAt ? new Date(c.sentAt).toLocaleString("es-ES") : "Pendiente"}</span></div>
    </div>
    <div class="email-body">
      ${c.html ? c.html : `<p style="color:#9ca3af;text-align:center;padding:30px">Email de texto plano — sin versión HTML</p>`}
    </div>
  </div>
</div>

<!-- ========= 6. DESTINATARIOS ========= -->
<div class="section">
  <h3><span class="num">6</span>Destinatarios (${fmt(recipients.length)})</h3>
  <div class="privacy">
    <strong>Confidencialidad &amp; RGPD:</strong> este listado solo muestra el <strong>nombre público</strong> de cada empresa/entidad, su localización y categoría.
    No se incluyen emails, teléfonos ni nombres de personas físicas.
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>Empresa / Entidad</th>
        <th>Municipio</th>
        <th>Provincia</th>
        <th>CCAA</th>
        <th>Categoría</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>${recipientRows}</tbody>
  </table>
</div>

<!-- ========= 7. GEOGRAFÍA ========= -->
${topCCAA.length || topProv.length ? `
<div class="section">
  <h3><span class="num">7</span>Distribución geográfica</h3>
  ${topCCAA.length ? `<h4>Top Comunidades Autónomas</h4><table>${topCCAA.map(([k, v]) => barRow(k, v, maxCCAA)).join("")}</table>` : ""}
  ${topProv.length ? `<h4>Top Provincias</h4><table>${topProv.map(([k, v]) => barRow(k, v, maxProv)).join("")}</table>` : ""}
</div>` : ""}

<!-- ========= 8. CATEGORÍAS ========= -->
${topCat.length ? `
<div class="section">
  <h3><span class="num">8</span>Análisis por categoría</h3>
  <table>${topCat.map(([k, v]) => barRow(k, v, maxCat)).join("")}</table>
</div>` : ""}

<!-- ========= 9. CONCLUSIONES ========= -->
<div class="section">
  <h3><span class="num">9</span>Conclusiones y recomendaciones</h3>
  <h4>Hallazgos principales</h4>
  <ul>
    <li>La campaña alcanzó a <strong>${fmt(sent)}</strong> destinatarios efectivos sobre ${fmt(total)} programados.</li>
    ${sent > 0 ? `<li>Tasa de apertura del <strong>${openPct.toFixed(1)}%</strong> (benchmark sector: 22%).</li>` : ""}
    ${sent > 0 ? `<li>Tasa de clic del <strong>${clickPct.toFixed(2)}%</strong> (benchmark sector: 3%).</li>` : ""}
    ${Object.keys(byCCAA).length > 0 ? `<li>Cobertura geográfica: <strong>${Object.keys(byCCAA).length}</strong> CCAA y <strong>${Object.keys(byProv).length}</strong> provincias.</li>` : ""}
    ${Object.keys(byCat).length > 0 ? `<li>Categorías profesionales impactadas: <strong>${Object.keys(byCat).length}</strong>.</li>` : ""}
  </ul>
  <h4>Recomendaciones estratégicas</h4>
  <div class="callout warn">
    ${recos.map((r) => `<p>${r}</p>`).join("")}
  </div>
</div>

<!-- ========= 10. GLOSARIO ========= -->
<div class="section">
  <h3><span class="num">10</span>Glosario de términos</h3>
  <dl class="glossary">
    <dt>Tasa de apertura (Open Rate)</dt>
    <dd>Porcentaje de destinatarios que abrieron el email al menos una vez.</dd>
    <dt>Tasa de clic (CTR)</dt>
    <dd>Porcentaje que hizo clic en algún enlace del email sobre los emails entregados.</dd>
    <dt>CTOR (Click-to-Open Ratio)</dt>
    <dd>Porcentaje de los que abrieron y además clicaron. Mide la calidad del contenido.</dd>
    <dt>Rebote (Bounce)</dt>
    <dd>Email que no pudo entregarse. Soft (temporal) o hard (permanente).</dd>
    <dt>Entregabilidad</dt>
    <dd>Porcentaje de emails que llegaron correctamente sin rebotar.</dd>
    <dt>RGPD</dt>
    <dd>Reglamento General de Protección de Datos. Marco legal UE que protege los datos personales.</dd>
  </dl>
</div>

<!-- ========= FOOTER ========= -->
<div class="footer">
  <img src="${LOGO_URL}" alt="RUBEN COTON">
  <p><strong>RUBEN COTON</strong></p>
  <p>DJ · Booking &amp; Management de Artistas</p>
  <p style="margin-top:6px">manager@rubencoton.com &middot; Madrid, España</p>
  <p style="margin-top:10px;font-size:8.5pt;opacity:0.85">Este informe respeta el RGPD. No se comparten datos personales (emails, teléfonos, nombres de personas físicas).</p>
  <p style="margin-top:4px;font-size:8pt;opacity:0.7">Documento generado automáticamente por la plataforma de Envío Masivo de RUBEN COTON</p>
</div>

</body>
</html>`;
}

module.exports = { renderCampaignReport };

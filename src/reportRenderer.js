"use strict";

/**
 * reportRenderer.js — Genera HTML del informe para PDF via Google Drive Docs.
 *
 * DISEÑO 2026-04-30 (refactor profundo):
 *   - Identidad RUBEN COTON: Negro / Blanco / Naranja oficial
 *   - Tipografia geometrica BOLD (la del logo)
 *   - Logo POS (negro sobre blanco) en portada
 *   - Logo NEG (RRSS, blanco sobre negro) en footer
 *   - Layout limpio, jerarquía visual clara
 *   - Compatible 100% con Drive Docs HTML→PDF
 *
 * REGLAS DURAS (Drive Docs export):
 *   NO usar: linear-gradient, flex, grid, rgba, border-radius, position
 *   SI usar: tablas con cellpadding/cellspacing, hex sólidos
 *
 * Logos públicos via emailing.rubencoton.com/assets (sin auth requerida).
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

const htmlToPlainText = (html) => {
  if (!html) return "";
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 800);
};

const grade = (val, low, mid, high, inverse) => {
  if (inverse) {
    if (val <= low) return "EXCELENTE";
    if (val <= mid) return "BUENO";
    if (val <= high) return "ACEPTABLE";
    return "REVISAR";
  }
  if (val >= high) return "EXCELENTE";
  if (val >= mid) return "BUENO";
  if (val >= low) return "ACEPTABLE";
  return "POR MEJORAR";
};

const gradeColor = (label) => {
  if (label === "EXCELENTE" || label === "BUENO") return "#10b981";
  if (label === "ACEPTABLE") return "#f59e0b";
  return "#dc2626";
};

const statusBg = (st) => {
  const s = String(st || "").toLowerCase();
  if (s === "clic") return "#dcfce7";
  if (s === "abierto") return "#dbeafe";
  if (s === "rebote") return "#fee2e2";
  if (s === "baja") return "#fef3c7";
  if (s === "enviado") return "#fef3c7";
  return "#f3f4f6";
};
const statusFg = (st) => {
  const s = String(st || "").toLowerCase();
  if (s === "clic") return "#166534";
  if (s === "abierto") return "#1e40af";
  if (s === "rebote") return "#991b1b";
  if (s === "baja") return "#92400e";
  if (s === "enviado") return "#78350f";
  return "#374151";
};

/* Logos oficiales — públicos via emailing.rubencoton.com/assets/.
 * Drive Docs los descarga al convertir HTML->PDF. */
const LOGO_POS = "https://emailing.rubencoton.com/assets/logo-ruben-coton-pos.png"; /* negro/blanco para portada */
const LOGO_NEG_RRSS = "https://emailing.rubencoton.com/assets/logo-rrss.png"; /* blanco/negro para footer */

/* PALETA OFICIAL RUBEN COTON */
const NARANJA = "#FF6B00";
const NARANJA_OSC = "#E65100";
const NEGRO = "#1a1a1a";
const NEGRO_2 = "#000000";
const BLANCO = "#ffffff";
const GRIS_BG = "#fafafa";
const GRIS_TXT = "#666";
const GRIS_LINE = "#e5e7eb";

function renderCampaignReport(reportData, campaignId) {
  const c = reportData.campaign || {};
  const s = reportData.stats || {};
  const recipients = reportData.recipients || [];
  const gen = new Date(reportData.generatedAt || Date.now());

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

  const gOpen = grade(openPct, 15, 22, 35);
  const gClick = grade(clickPct, 1.5, 3, 7);
  const gBounce = grade(bouncePct, 0.5, 2, 5, true);

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

  const recipientRows = recipients.slice(0, 100).map((r, i) => `
    <tr>
      <td style="padding:8px 8px;color:${GRIS_TXT};font-size:9pt;border-bottom:1px solid ${GRIS_LINE}">${String(i + 1).padStart(3, "0")}</td>
      <td style="padding:8px 8px;border-bottom:1px solid ${GRIS_LINE}"><strong>${esc(r.empresa || "—")}</strong></td>
      <td style="padding:8px 8px;border-bottom:1px solid ${GRIS_LINE}">${esc(r.municipio || "—")}</td>
      <td style="padding:8px 8px;border-bottom:1px solid ${GRIS_LINE}">${esc(r.provincia || "—")}</td>
      <td style="padding:8px 8px;border-bottom:1px solid ${GRIS_LINE}">${esc(r.ccaa || "—")}</td>
      <td style="padding:8px 8px;border-bottom:1px solid ${GRIS_LINE}">${esc(r.categoria || "—")}</td>
      <td style="padding:6px 10px;border-bottom:1px solid ${GRIS_LINE};background-color:${statusBg(r.status)};color:${statusFg(r.status)};font-weight:bold;text-transform:uppercase;font-size:8.5pt;letter-spacing:0.5px">${esc(r.status || "—")}</td>
    </tr>`).join("");
  const truncated = recipients.length > 100 ? `<tr><td colspan="7" style="padding:14px;text-align:center;color:${GRIS_TXT};background-color:${GRIS_BG};font-style:italic;border-bottom:1px solid ${GRIS_LINE}">+ ${fmt(recipients.length - 100)} destinatarios más (no listados por longitud)</td></tr>` : "";
  const recipientTbody = recipientRows + truncated || `<tr><td colspan="7" style="padding:18px;text-align:center;color:${GRIS_TXT}">Sin destinatarios</td></tr>`;

  const recos = [];
  if (sent === 0) recos.push("La campaña aún no se ha enviado o está en cola. Las métricas se actualizarán tras el envío.");
  if (sent > 0) {
    if (openPct < 15) recos.push("<strong>Apertura baja.</strong> Prueba asuntos más cortos y con gancho emocional.");
    if (openPct >= 35) recos.push("<strong>Apertura excelente.</strong> Replica este estilo de asunto en futuras campañas.");
    if (clickPct < 1.5 && opened > 5) recos.push("<strong>Pocos clics.</strong> Revisa que la llamada a la acción sea clara y única.");
    if (clickPct >= 7) recos.push("<strong>Clics por encima de la media.</strong> El contenido conecta con el destinatario.");
    if (bouncePct > 5) recos.push("<strong>Rebotes altos.</strong> Depura la base antes del próximo envío.");
    if (ctor > 15) recos.push("<strong>CTOR muy alto.</strong> Cuando abren, hacen clic.");
  }
  if (recos.length === 0) recos.push("La campaña se desempeña dentro de los parámetros del sector. Mantener estrategia.");

  const code = "CMP-" + (c.sentAt || c.createdAt || "").slice(0, 10).replace(/-/g, "") + "-" + String(campaignId || "").slice(-4);
  const emailPlain = htmlToPlainText(c.html || c.text || "");

  const barRows = (rows) => {
    if (!rows.length) return "";
    const max = Math.max(1, ...rows.map((x) => x[1]));
    return rows.map(([k, v]) => {
      const widthPct = Math.round(v / max * 100);
      return `<tr>
        <td style="padding:7px 10px;font-weight:bold;font-size:10pt;width:30%;border-bottom:1px solid #f0f0f0">${esc(k)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td style="background-color:${NARANJA};height:14px;width:${widthPct}%"></td>
            <td style="background-color:${GRIS_BG};width:${100 - widthPct}%"></td>
          </tr></table>
        </td>
        <td style="padding:7px 10px;text-align:right;color:${NARANJA_OSC};font-weight:bold;width:60px;border-bottom:1px solid #f0f0f0">${fmt(v)}</td>
      </tr>`;
    }).join("");
  };

  const kpiCell = (num, label, sub, accent) => `
    <td style="padding:18px 14px;background-color:${BLANCO};border:1px solid ${GRIS_LINE};border-top:5px solid ${accent};text-align:center;width:25%">
      <div style="font-size:24pt;font-weight:900;color:${accent};line-height:1.05;letter-spacing:-1px">${num}</div>
      <div style="font-size:9pt;color:${GRIS_TXT};text-transform:uppercase;font-weight:bold;letter-spacing:1px;margin-top:8px">${label}</div>
      ${sub ? `<div style="font-size:8.5pt;color:#9ca3af;margin-top:4px;font-weight:600">${sub}</div>` : ""}
    </td>`;
  const sep = `<td style="width:10px"></td>`;

  /* Encabezado de sección reutilizable: barra naranja + número + título */
  const sectionHeader = (num, title) => `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px">
      <tr>
        <td style="background-color:${NARANJA};color:${BLANCO};padding:8px 14px;font-weight:900;font-size:14pt;letter-spacing:1px;width:48px;text-align:center">${num}</td>
        <td style="background-color:${NEGRO};color:${BLANCO};padding:8px 18px;font-weight:bold;font-size:13pt;letter-spacing:0.5px">${esc(title)}</td>
      </tr>
    </table>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe ${esc(c.name)} | RUBEN COTON</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;color:${NEGRO};background-color:${BLANCO};margin:0;padding:0;font-size:11pt;line-height:1.55">

<!-- ╔════ PORTADA ════╗ -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:30px">
  <tr>
    <td style="background-color:${NEGRO};padding:32px 40px;text-align:center">
      <img src="${LOGO_POS}" alt="RUBEN COTON" style="max-width:340px;width:100%;height:auto;background-color:${BLANCO};padding:18px 32px;display:block;margin:0 auto">
      <p style="color:${NARANJA};font-size:11pt;margin:14px 0 0;letter-spacing:5px;text-transform:uppercase;font-weight:900">DJ &middot; Booking &middot; Management</p>
    </td>
  </tr>
  <tr>
    <td style="background-color:${NARANJA};color:${BLANCO};padding:6px 40px;text-align:center;font-size:9.5pt;font-weight:bold;letter-spacing:5px;text-transform:uppercase">
      Informe ejecutivo de campaña
    </td>
  </tr>
  <tr>
    <td style="padding:36px 40px 20px;background-color:${BLANCO}">
      <h1 style="color:${NEGRO};font-size:26pt;margin:0;font-weight:900;line-height:1.15;letter-spacing:-0.3px">${esc(c.name || "Campaña sin nombre")}</h1>
      <p style="color:${NARANJA_OSC};font-size:12pt;margin:14px 0 0;font-style:italic;border-left:4px solid ${NARANJA};padding-left:14px;font-weight:500">"${esc(c.subject || "—")}"</p>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 40px 30px;background-color:${BLANCO}">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="padding:14px 16px;background-color:${GRIS_BG};border-left:4px solid ${NARANJA};width:24%">
            <p style="color:${NARANJA_OSC};font-size:8.5pt;margin:0;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold">Fecha</p>
            <p style="color:${NEGRO};font-size:11pt;margin:5px 0 0;font-weight:bold">${gen.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</p>
          </td>
          <td style="width:8px"></td>
          <td style="padding:14px 16px;background-color:${GRIS_BG};border-left:4px solid ${NARANJA};width:24%">
            <p style="color:${NARANJA_OSC};font-size:8.5pt;margin:0;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold">Hora</p>
            <p style="color:${NEGRO};font-size:11pt;margin:5px 0 0;font-weight:bold">${gen.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} h</p>
          </td>
          <td style="width:8px"></td>
          <td style="padding:14px 16px;background-color:${GRIS_BG};border-left:4px solid ${NARANJA};width:24%">
            <p style="color:${NARANJA_OSC};font-size:8.5pt;margin:0;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold">Estado</p>
            <p style="color:${NEGRO};font-size:11pt;margin:5px 0 0;font-weight:bold">${esc(tStatus(c.status))}</p>
          </td>
          <td style="width:8px"></td>
          <td style="padding:14px 16px;background-color:${GRIS_BG};border-left:4px solid ${NARANJA};width:24%">
            <p style="color:${NARANJA_OSC};font-size:8.5pt;margin:0;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold">Destinatarios</p>
            <p style="color:${NEGRO};font-size:11pt;margin:5px 0 0;font-weight:bold">${fmt(recipients.length)} entidades</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 40px;background-color:${NEGRO};color:${BLANCO};font-size:9pt">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td>Madrid, España &middot; <span style="color:${NARANJA}">manager@rubencoton.com</span></td>
          <td style="text-align:right"><span style="background-color:${NARANJA};color:${BLANCO};padding:4px 14px;font-weight:bold;letter-spacing:2.5px;font-size:8.5pt">CONFIDENCIAL</span></td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<!-- 1. RESUMEN -->
<div style="padding:0 32px 22px">
  ${sectionHeader("01", "Resumen ejecutivo")}
  <p style="background-color:#fff5e6;border-left:4px solid ${NARANJA};padding:16px 20px;margin:0 0 18px;font-size:11pt;color:${NEGRO}">
    La campaña <strong>${esc(c.name)}</strong> impactó a <strong>${fmt(recipients.length)} entidades</strong> en <strong>${Object.keys(byCCAA).length} comunidades autónomas</strong>${sent > 0 ? ` con una tasa de apertura del <strong>${openPct.toFixed(1)}%</strong> y de clic del <strong>${clickPct.toFixed(2)}%</strong>` : ""}.
  </p>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      ${kpiCell(openPct.toFixed(1) + "%", "Apertura", gOpen, gradeColor(gOpen))}
      ${sep}
      ${kpiCell(clickPct.toFixed(1) + "%", "Clic", gClick, gradeColor(gClick))}
      ${sep}
      ${kpiCell(bouncePct.toFixed(1) + "%", "Rebotes", gBounce, gradeColor(gBounce))}
      ${sep}
      ${kpiCell(replied, "Respuestas", "contestaciones", NEGRO)}
    </tr>
  </table>
</div>

<!-- 2. DATOS -->
<div style="padding:8px 32px 22px">
  ${sectionHeader("02", "Datos de la campaña")}
  <table cellpadding="0" cellspacing="0" border="1" width="100%" style="border-collapse:collapse;border-color:${GRIS_LINE}">
    <tr><td style="padding:10px 14px;background-color:${GRIS_BG};font-weight:bold;width:30%;border:1px solid ${GRIS_LINE}">Nombre interno</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE}">${esc(c.name || "—")}</td></tr>
    <tr><td style="padding:10px 14px;background-color:${GRIS_BG};font-weight:bold;border:1px solid ${GRIS_LINE}">Asunto</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE}">${esc(c.subject || "—")}</td></tr>
    <tr><td style="padding:10px 14px;background-color:${GRIS_BG};font-weight:bold;border:1px solid ${GRIS_LINE}">Remitente</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE}">${esc(c.fromName || "RUBEN COTON")} &lt;${esc(c.fromEmail || "manager@rubencoton.com")}&gt;</td></tr>
    <tr><td style="padding:10px 14px;background-color:${GRIS_BG};font-weight:bold;border:1px solid ${GRIS_LINE}">Estado</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE}">${esc(tStatus(c.status))}</td></tr>
    <tr><td style="padding:10px 14px;background-color:${GRIS_BG};font-weight:bold;border:1px solid ${GRIS_LINE}">Código</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE};font-family:Courier,monospace;font-size:10pt;color:${NARANJA_OSC}">${esc(code)}</td></tr>
    <tr><td style="padding:10px 14px;background-color:${GRIS_BG};font-weight:bold;border:1px solid ${GRIS_LINE}">Creada</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE}">${c.createdAt ? new Date(c.createdAt).toLocaleString("es-ES") : "—"}</td></tr>
    <tr><td style="padding:10px 14px;background-color:${GRIS_BG};font-weight:bold;border:1px solid ${GRIS_LINE}">Enviada</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE}">${c.sentAt ? new Date(c.sentAt).toLocaleString("es-ES") : "Pendiente"}</td></tr>
  </table>
</div>

<!-- 3. METRICAS DETALLADAS -->
<div style="padding:8px 32px 22px">
  ${sectionHeader("03", "Métricas detalladas")}
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      ${kpiCell(fmt(total), "Destinatarios", "", "#6b7280")}
      ${sep}
      ${kpiCell(fmt(sent), "Enviados", pct(sent, total) + " del total", "#6b7280")}
      ${sep}
      ${kpiCell(fmt(opened), "Aperturas", pct(opened, sent), "#10b981")}
      ${sep}
      ${kpiCell(fmt(clicked), "Clics", pct(clicked, sent), "#10b981")}
    </tr>
  </table>
  <div style="height:10px"></div>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      ${kpiCell(fmt(bounced), "Rebotes", pct(bounced, total), "#dc2626")}
      ${sep}
      ${kpiCell(fmt(unsub), "Bajas", pct(unsub, sent), "#f59e0b")}
      ${sep}
      ${kpiCell(ctor.toFixed(1) + "%", "CTOR", "clic / apertura", "#6b7280")}
      ${sep}
      ${kpiCell(deliv.toFixed(1) + "%", "Entregabilidad", "", "#10b981")}
    </tr>
  </table>
</div>

<!-- 4. RENDIMIENTO VS SECTOR -->
<div style="padding:8px 32px 22px">
  ${sectionHeader("04", "Rendimiento vs. sector B2B")}
  <table cellpadding="0" cellspacing="0" border="1" width="100%" style="border-collapse:collapse;border-color:${GRIS_LINE}">
    <tr style="background-color:${NEGRO};color:${BLANCO}">
      <th style="padding:11px 14px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:1px;border:1px solid ${NEGRO}">Métrica</th>
      <th style="padding:11px 14px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:1px;border:1px solid ${NEGRO}">Campaña</th>
      <th style="padding:11px 14px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:1px;border:1px solid ${NEGRO}">Benchmark</th>
      <th style="padding:11px 14px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:1px;border:1px solid ${NEGRO}">Valoración</th>
    </tr>
    <tr><td style="padding:10px 14px;font-weight:bold;border:1px solid ${GRIS_LINE}">Tasa de apertura</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE}"><strong>${openPct.toFixed(1)}%</strong></td><td style="padding:10px 14px;color:${GRIS_TXT};border:1px solid ${GRIS_LINE}">22% media · 35% top</td><td style="padding:10px 14px;color:${gradeColor(gOpen)};font-weight:bold;border:1px solid ${GRIS_LINE}">${gOpen}</td></tr>
    <tr style="background-color:${GRIS_BG}"><td style="padding:10px 14px;font-weight:bold;border:1px solid ${GRIS_LINE}">Tasa de clic</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE}"><strong>${clickPct.toFixed(2)}%</strong></td><td style="padding:10px 14px;color:${GRIS_TXT};border:1px solid ${GRIS_LINE}">3% media · 7% top</td><td style="padding:10px 14px;color:${gradeColor(gClick)};font-weight:bold;border:1px solid ${GRIS_LINE}">${gClick}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:bold;border:1px solid ${GRIS_LINE}">Tasa de rebote</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE}"><strong>${bouncePct.toFixed(2)}%</strong></td><td style="padding:10px 14px;color:${GRIS_TXT};border:1px solid ${GRIS_LINE}">≤ 2% (saludable)</td><td style="padding:10px 14px;color:${gradeColor(gBounce)};font-weight:bold;border:1px solid ${GRIS_LINE}">${gBounce}</td></tr>
  </table>
  <p style="background-color:#eef4ff;border-left:4px solid #3b82f6;padding:12px 16px;margin:14px 0 0;font-size:10pt;color:${NEGRO}"><strong>Interpretación:</strong> las campañas B2B del sector cultural y booking suelen tener aperturas altas (25-30%) pero clics moderados (2-4%) porque el contenido es informativo, no de compra directa.</p>
</div>

<!-- 5. EMAIL ENVIADO -->
<div style="padding:8px 32px 22px">
  ${sectionHeader("05", "Email enviado")}
  <table cellpadding="0" cellspacing="0" border="1" width="100%" style="border-collapse:collapse;border-color:${GRIS_LINE}">
    <tr><td style="padding:10px 14px;background-color:${NEGRO};color:${NARANJA};font-weight:bold;width:25%;font-size:9pt;letter-spacing:1.2px;text-transform:uppercase;border:1px solid ${NEGRO}">DE</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE}">${esc(c.fromName || "RUBEN COTON")} &lt;${esc(c.fromEmail || "manager@rubencoton.com")}&gt;</td></tr>
    <tr><td style="padding:10px 14px;background-color:${NEGRO};color:${NARANJA};font-weight:bold;font-size:9pt;letter-spacing:1.2px;text-transform:uppercase;border:1px solid ${NEGRO}">PARA</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE}">${fmt(recipients.length)} destinatarios</td></tr>
    <tr><td style="padding:10px 14px;background-color:${NEGRO};color:${NARANJA};font-weight:bold;font-size:9pt;letter-spacing:1.2px;text-transform:uppercase;border:1px solid ${NEGRO}">ASUNTO</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE}"><strong>${esc(c.subject || "—")}</strong></td></tr>
    <tr><td style="padding:10px 14px;background-color:${NEGRO};color:${NARANJA};font-weight:bold;font-size:9pt;letter-spacing:1.2px;text-transform:uppercase;border:1px solid ${NEGRO}">FECHA</td><td style="padding:10px 14px;border:1px solid ${GRIS_LINE}">${c.sentAt ? new Date(c.sentAt).toLocaleString("es-ES") : "Pendiente"}</td></tr>
  </table>
  <p style="margin:18px 0 8px;font-weight:bold;color:${GRIS_TXT};font-size:9.5pt;text-transform:uppercase;letter-spacing:1.5px">Cuerpo del email (texto)</p>
  <div style="background-color:${GRIS_BG};border-left:4px solid ${NARANJA};padding:16px 20px;font-size:10.5pt;color:${NEGRO};white-space:pre-wrap">${esc(emailPlain) || "Email sin contenido textual."}</div>
</div>

<!-- 6. DESTINATARIOS -->
<div style="padding:8px 32px 22px">
  ${sectionHeader("06", "Destinatarios (" + fmt(recipients.length) + ")")}
  <p style="background-color:${NEGRO};color:${BLANCO};padding:12px 16px;margin:0 0 14px;font-size:10pt;border-left:4px solid ${NARANJA}"><strong style="color:${NARANJA}">Confidencialidad &amp; RGPD:</strong> sólo se muestra el nombre público de cada empresa/entidad y su localización. No incluimos emails, teléfonos ni nombres de personas físicas.</p>
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
    <tr style="background-color:${NEGRO};color:${NARANJA}">
      <th style="padding:9px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px;width:40px">#</th>
      <th style="padding:9px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px">Empresa / Entidad</th>
      <th style="padding:9px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px">Municipio</th>
      <th style="padding:9px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px">Provincia</th>
      <th style="padding:9px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px">CCAA</th>
      <th style="padding:9px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px">Categoría</th>
      <th style="padding:9px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px">Estado</th>
    </tr>
    ${recipientTbody}
  </table>
</div>

${topCCAA.length || topProv.length ? `
<!-- 7. GEOGRAFIA -->
<div style="padding:8px 32px 22px">
  ${sectionHeader("07", "Distribución geográfica")}
  ${topCCAA.length ? `<p style="color:${NEGRO};font-size:11pt;font-weight:bold;border-left:4px solid ${NARANJA};padding-left:12px;margin:8px 0 10px">Top Comunidades Autónomas</p><table cellpadding="0" cellspacing="0" border="0" width="100%">${barRows(topCCAA)}</table>` : ""}
  ${topProv.length ? `<p style="color:${NEGRO};font-size:11pt;font-weight:bold;border-left:4px solid ${NARANJA};padding-left:12px;margin:20px 0 10px">Top Provincias</p><table cellpadding="0" cellspacing="0" border="0" width="100%">${barRows(topProv)}</table>` : ""}
</div>` : ""}

${topCat.length ? `
<!-- 8. CATEGORIAS -->
<div style="padding:8px 32px 22px">
  ${sectionHeader("08", "Análisis por categoría")}
  <table cellpadding="0" cellspacing="0" border="0" width="100%">${barRows(topCat)}</table>
</div>` : ""}

<!-- 9. CONCLUSIONES -->
<div style="padding:8px 32px 22px">
  ${sectionHeader("09", "Conclusiones y recomendaciones")}
  <p style="color:${NEGRO};font-size:11pt;font-weight:bold;border-left:4px solid ${NARANJA};padding-left:12px;margin:0 0 10px">Hallazgos principales</p>
  <ul style="margin:0 0 18px 24px;padding:0;font-size:10.5pt;color:${NEGRO}">
    <li style="margin:7px 0">La campaña alcanzó a <strong>${fmt(sent)}</strong> destinatarios efectivos sobre ${fmt(total)} programados.</li>
    ${sent > 0 ? `<li style="margin:7px 0">Tasa de apertura del <strong>${openPct.toFixed(1)}%</strong> (benchmark sector: 22%).</li>` : ""}
    ${sent > 0 ? `<li style="margin:7px 0">Tasa de clic del <strong>${clickPct.toFixed(2)}%</strong> (benchmark sector: 3%).</li>` : ""}
    ${Object.keys(byCCAA).length > 0 ? `<li style="margin:7px 0">Cobertura geográfica: <strong>${Object.keys(byCCAA).length}</strong> CCAA y <strong>${Object.keys(byProv).length}</strong> provincias.</li>` : ""}
    ${Object.keys(byCat).length > 0 ? `<li style="margin:7px 0">Categorías profesionales impactadas: <strong>${Object.keys(byCat).length}</strong>.</li>` : ""}
  </ul>
  <p style="color:${NEGRO};font-size:11pt;font-weight:bold;border-left:4px solid ${NARANJA};padding-left:12px;margin:18px 0 10px">Recomendaciones</p>
  <div style="background-color:#fff8e1;border-left:4px solid #f59e0b;padding:14px 18px;font-size:10.5pt;color:${NEGRO}">
    ${recos.map((r) => `<p style="margin:7px 0">${r}</p>`).join("")}
  </div>
</div>

<!-- 10. GLOSARIO -->
<div style="padding:8px 32px 30px">
  ${sectionHeader("10", "Glosario")}
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="padding:7px 10px;font-weight:bold;color:${NARANJA_OSC};width:30%;vertical-align:top">Apertura (Open Rate)</td><td style="padding:7px 10px;color:${GRIS_TXT};font-size:10pt">% de destinatarios que abrieron el email al menos una vez.</td></tr>
    <tr><td style="padding:7px 10px;font-weight:bold;color:${NARANJA_OSC};vertical-align:top">Clic (CTR)</td><td style="padding:7px 10px;color:${GRIS_TXT};font-size:10pt">% que hizo clic en algún enlace, sobre los emails entregados.</td></tr>
    <tr><td style="padding:7px 10px;font-weight:bold;color:${NARANJA_OSC};vertical-align:top">CTOR</td><td style="padding:7px 10px;color:${GRIS_TXT};font-size:10pt">% de los que abrieron y además clicaron. Mide la calidad del contenido.</td></tr>
    <tr><td style="padding:7px 10px;font-weight:bold;color:${NARANJA_OSC};vertical-align:top">Rebote (Bounce)</td><td style="padding:7px 10px;color:${GRIS_TXT};font-size:10pt">Email que no pudo entregarse. Soft (temporal) o hard (permanente).</td></tr>
    <tr><td style="padding:7px 10px;font-weight:bold;color:${NARANJA_OSC};vertical-align:top">Entregabilidad</td><td style="padding:7px 10px;color:${GRIS_TXT};font-size:10pt">% de emails que llegaron correctamente sin rebotar.</td></tr>
    <tr><td style="padding:7px 10px;font-weight:bold;color:${NARANJA_OSC};vertical-align:top">RGPD</td><td style="padding:7px 10px;color:${GRIS_TXT};font-size:10pt">Reglamento General de Protección de Datos (UE 2016/679).</td></tr>
  </table>
</div>

<!-- ╚════ FOOTER ════╝ -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:0">
  <tr><td style="background-color:${NARANJA};height:8px"></td></tr>
  <tr>
    <td style="padding:30px 28px;background-color:${NEGRO};color:${BLANCO};text-align:center">
      <img src="${LOGO_NEG_RRSS}" alt="RUBEN COTON" style="width:120px;height:auto;display:block;margin:0 auto 14px">
      <p style="color:${NARANJA};font-size:9.5pt;margin:0 0 14px;letter-spacing:3px;text-transform:uppercase;font-weight:bold">DJ &middot; Booking &middot; Management</p>
      <p style="font-size:10pt;margin:0;color:${BLANCO}">manager@rubencoton.com &middot; Madrid, España</p>
      <p style="font-size:8.5pt;color:#aaa;margin:14px 0 0">Informe respeta el RGPD. No se comparten datos personales (emails, teléfonos, nombres de personas físicas).</p>
      <p style="font-size:8pt;color:#888;margin:6px 0 0">Documento generado automáticamente por la plataforma de Envío Masivo de RUBEN COTON</p>
    </td>
  </tr>
</table>

</body>
</html>`;
}

module.exports = { renderCampaignReport };

"use strict";

/**
 * reportRenderer.js — Genera HTML del informe para PDF via Google Drive Docs.
 *
 * REGLAS DURAS (Drive Docs HTML→PDF NO soporta):
 *   - linear-gradient / radial-gradient  → Drive las convierte a fondo plano feo
 *   - flex / grid                         → Drive ignora
 *   - rgba() backgrounds                  → mal renderizado
 *   - border-radius                       → ignorado en PDF
 *   - position absolute/fixed             → ignorado
 *   - <body> anidados                     → roto
 *   - CSS @page reglas avanzadas          → ignoradas
 *   - <iframe> con email                  → no se renderiza
 *
 * SI USA (testeado):
 *   - <table> con cellpadding/cellspacing/border para layout
 *   - colores hex sólidos (#FF6B00, #1a1a1a, #ffffff)
 *   - <h1>, <h2>, <p>, <strong>, <em>, <ul>, <li>
 *   - background-color hex en <td>
 *   - padding/margin inline en estilos
 *   - text-align, font-weight, font-size, color, font-family
 *
 * Diseño: portada FONDO BLANCO con marca limpia. Tipografía Arial.
 * Naranja de marca como acento (#FF6B00). Negro y gris para texto.
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
  if (s === "enviado") return "#e0e7ff";
  return "#f3f4f6";
};
const statusFg = (st) => {
  const s = String(st || "").toLowerCase();
  if (s === "clic") return "#166534";
  if (s === "abierto") return "#1e40af";
  if (s === "rebote") return "#991b1b";
  if (s === "baja") return "#92400e";
  if (s === "enviado") return "#3730a3";
  return "#374151";
};

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

  /* Filas de destinatarios — MAX 100 para que el PDF no sea gigante */
  const recipientRows = recipients.slice(0, 100).map((r, i) => `
    <tr>
      <td style="padding:7px 8px;color:#888;font-size:9pt;border-bottom:1px solid #e5e7eb">${String(i + 1).padStart(3, "0")}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb"><strong>${esc(r.empresa || "—")}</strong></td>
      <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${esc(r.municipio || "—")}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${esc(r.provincia || "—")}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${esc(r.ccaa || "—")}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${esc(r.categoria || "—")}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;background-color:${statusBg(r.status)};color:${statusFg(r.status)};font-weight:bold;text-transform:uppercase;font-size:9pt">${esc(r.status || "—")}</td>
    </tr>`).join("");
  const truncated = recipients.length > 100 ? `<tr><td colspan="7" style="padding:10px;text-align:center;color:#888;background-color:#fafafa;font-style:italic">+ ${fmt(recipients.length - 100)} destinatarios más (no listados por longitud)</td></tr>` : "";
  const recipientTbody = recipientRows + truncated || `<tr><td colspan="7" style="padding:14px;text-align:center;color:#888">Sin destinatarios</td></tr>`;

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
        <td style="padding:6px 8px;font-weight:bold;font-size:10pt;width:30%;border-bottom:1px solid #f0f0f0">${esc(k)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td style="background-color:#FF6B00;height:14px;width:${widthPct}%"></td>
            <td style="background-color:#f3f4f6;width:${100 - widthPct}%"></td>
          </tr></table>
        </td>
        <td style="padding:6px 8px;text-align:right;color:#E65100;font-weight:bold;width:60px;border-bottom:1px solid #f0f0f0">${fmt(v)}</td>
      </tr>`;
    }).join("");
  };

  /* Una métrica como celda blanca con borde superior de color */
  const kpiCell = (num, label, sub, accent) => `
    <td style="padding:14px 12px;background-color:#ffffff;border:1px solid #e5e7eb;border-top:4px solid ${accent};text-align:center;width:25%">
      <div style="font-size:22pt;font-weight:bold;color:${accent};line-height:1.1">${num}</div>
      <div style="font-size:9pt;color:#6b7280;text-transform:uppercase;font-weight:bold;letter-spacing:0.6px;margin-top:6px">${label}</div>
      ${sub ? `<div style="font-size:8.5pt;color:#9ca3af;margin-top:3px;font-weight:600">${sub}</div>` : ""}
    </td>`;
  const sep = `<td style="width:8px"></td>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe campaña — ${esc(c.name)}</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;background-color:#ffffff;margin:0;padding:0;font-size:11pt;line-height:1.5">

<!-- ============== PORTADA (FONDO BLANCO, MARCA EN NEGRO) ============== -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:30px">
  <tr>
    <td style="padding:34px 40px 22px;border-top:6px solid #FF6B00;border-bottom:1px solid #e5e7eb">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td>
            <div style="display:inline-block;background-color:#1a1a1a;padding:14px 22px;border-radius:0">
              <span style="color:#FF6B00;font-size:24pt;font-weight:bold;letter-spacing:5px">RUBEN COTON</span>
            </div>
            <p style="color:#1a1a1a;font-size:10pt;margin:10px 0 0;letter-spacing:3px;text-transform:uppercase;font-weight:bold">DJ &middot; Booking &middot; Management</p>
          </td>
          <td style="text-align:right;vertical-align:top">
            <div style="display:inline-block;background-color:#FF6B00;color:#ffffff;padding:5px 14px;font-size:9pt;font-weight:bold;letter-spacing:3px;text-transform:uppercase">Confidencial</div>
            <p style="color:#888;font-size:9pt;margin:8px 0 0">Madrid, España</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:30px 40px 8px">
      <p style="color:#FF6B00;font-size:9.5pt;font-weight:bold;letter-spacing:4px;text-transform:uppercase;margin:0 0 12px">INFORME EJECUTIVO DE CAMPAÑA</p>
      <h1 style="color:#1a1a1a;font-size:24pt;margin:0 0 8px;font-weight:bold;line-height:1.2">${esc(c.name || "Campaña sin nombre")}</h1>
      <p style="color:#555;font-size:11pt;margin:0;font-style:italic;border-left:4px solid #FF6B00;padding-left:12px">"${esc(c.subject || "—")}"</p>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 40px 30px">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="padding:12px 14px;background-color:#fafafa;border-left:3px solid #FF6B00;width:24%">
            <p style="color:#888;font-size:8.5pt;margin:0;letter-spacing:1.2px;text-transform:uppercase;font-weight:bold">Fecha informe</p>
            <p style="color:#1a1a1a;font-size:11pt;margin:4px 0 0;font-weight:bold">${gen.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</p>
          </td>
          <td style="width:8px"></td>
          <td style="padding:12px 14px;background-color:#fafafa;border-left:3px solid #FF6B00;width:24%">
            <p style="color:#888;font-size:8.5pt;margin:0;letter-spacing:1.2px;text-transform:uppercase;font-weight:bold">Hora generación</p>
            <p style="color:#1a1a1a;font-size:11pt;margin:4px 0 0;font-weight:bold">${gen.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} h</p>
          </td>
          <td style="width:8px"></td>
          <td style="padding:12px 14px;background-color:#fafafa;border-left:3px solid #FF6B00;width:24%">
            <p style="color:#888;font-size:8.5pt;margin:0;letter-spacing:1.2px;text-transform:uppercase;font-weight:bold">Estado</p>
            <p style="color:#1a1a1a;font-size:11pt;margin:4px 0 0;font-weight:bold">${esc(tStatus(c.status))}</p>
          </td>
          <td style="width:8px"></td>
          <td style="padding:12px 14px;background-color:#fafafa;border-left:3px solid #FF6B00;width:24%">
            <p style="color:#888;font-size:8.5pt;margin:0;letter-spacing:1.2px;text-transform:uppercase;font-weight:bold">Destinatarios</p>
            <p style="color:#1a1a1a;font-size:11pt;margin:4px 0 0;font-weight:bold">${fmt(recipients.length)} entidades</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<!-- ============== 1. RESUMEN EJECUTIVO ============== -->
<div style="padding:0 32px 22px">
  <h2 style="color:#1a1a1a;font-size:14pt;margin:0 0 4px;font-weight:bold">1 &middot; Resumen ejecutivo</h2>
  <div style="height:3px;background-color:#FF6B00;width:60px;margin-bottom:16px"></div>
  <p style="background-color:#fff5e6;border-left:4px solid #FF6B00;padding:14px 18px;margin:0 0 18px;font-size:11pt;color:#1a1a1a">
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
      ${kpiCell(replied, "Respuestas", "contestaciones", "#1a1a1a")}
    </tr>
  </table>
</div>

<!-- ============== 2. DATOS ============== -->
<div style="padding:8px 32px 22px">
  <h2 style="color:#1a1a1a;font-size:14pt;margin:0 0 4px;font-weight:bold">2 &middot; Datos de la campaña</h2>
  <div style="height:3px;background-color:#FF6B00;width:60px;margin-bottom:14px"></div>
  <table cellpadding="0" cellspacing="0" border="1" width="100%" style="border-collapse:collapse;border-color:#e5e7eb">
    <tr><td style="padding:8px 12px;background-color:#fafafa;font-weight:bold;width:30%;border:1px solid #e5e7eb">Nombre interno</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(c.name || "—")}</td></tr>
    <tr><td style="padding:8px 12px;background-color:#fafafa;font-weight:bold;border:1px solid #e5e7eb">Asunto</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(c.subject || "—")}</td></tr>
    <tr><td style="padding:8px 12px;background-color:#fafafa;font-weight:bold;border:1px solid #e5e7eb">Remitente</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(c.fromName || "RUBEN COTON")} &lt;${esc(c.fromEmail || "manager@rubencoton.com")}&gt;</td></tr>
    <tr><td style="padding:8px 12px;background-color:#fafafa;font-weight:bold;border:1px solid #e5e7eb">Estado</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(tStatus(c.status))}</td></tr>
    <tr><td style="padding:8px 12px;background-color:#fafafa;font-weight:bold;border:1px solid #e5e7eb">Código</td><td style="padding:8px 12px;border:1px solid #e5e7eb;font-family:Courier,monospace;font-size:10pt">${esc(code)}</td></tr>
    <tr><td style="padding:8px 12px;background-color:#fafafa;font-weight:bold;border:1px solid #e5e7eb">Creada</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${c.createdAt ? new Date(c.createdAt).toLocaleString("es-ES") : "—"}</td></tr>
    <tr><td style="padding:8px 12px;background-color:#fafafa;font-weight:bold;border:1px solid #e5e7eb">Enviada</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${c.sentAt ? new Date(c.sentAt).toLocaleString("es-ES") : "Pendiente"}</td></tr>
  </table>
</div>

<!-- ============== 3. MÉTRICAS DETALLADAS ============== -->
<div style="padding:8px 32px 22px">
  <h2 style="color:#1a1a1a;font-size:14pt;margin:0 0 4px;font-weight:bold">3 &middot; Métricas detalladas</h2>
  <div style="height:3px;background-color:#FF6B00;width:60px;margin-bottom:14px"></div>
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

<!-- ============== 4. RENDIMIENTO VS SECTOR ============== -->
<div style="padding:8px 32px 22px">
  <h2 style="color:#1a1a1a;font-size:14pt;margin:0 0 4px;font-weight:bold">4 &middot; Rendimiento vs. sector B2B</h2>
  <div style="height:3px;background-color:#FF6B00;width:60px;margin-bottom:14px"></div>
  <table cellpadding="0" cellspacing="0" border="1" width="100%" style="border-collapse:collapse;border-color:#e5e7eb">
    <tr style="background-color:#1a1a1a;color:#ffffff">
      <th style="padding:10px 12px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:1px;border:1px solid #1a1a1a">Métrica</th>
      <th style="padding:10px 12px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:1px;border:1px solid #1a1a1a">Campaña</th>
      <th style="padding:10px 12px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:1px;border:1px solid #1a1a1a">Benchmark</th>
      <th style="padding:10px 12px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:1px;border:1px solid #1a1a1a">Valoración</th>
    </tr>
    <tr><td style="padding:9px 12px;font-weight:bold;border:1px solid #e5e7eb">Tasa de apertura</td><td style="padding:9px 12px;border:1px solid #e5e7eb"><strong>${openPct.toFixed(1)}%</strong></td><td style="padding:9px 12px;color:#666;border:1px solid #e5e7eb">22% media · 35% top</td><td style="padding:9px 12px;color:${gradeColor(gOpen)};font-weight:bold;border:1px solid #e5e7eb">${gOpen}</td></tr>
    <tr style="background-color:#fafafa"><td style="padding:9px 12px;font-weight:bold;border:1px solid #e5e7eb">Tasa de clic</td><td style="padding:9px 12px;border:1px solid #e5e7eb"><strong>${clickPct.toFixed(2)}%</strong></td><td style="padding:9px 12px;color:#666;border:1px solid #e5e7eb">3% media · 7% top</td><td style="padding:9px 12px;color:${gradeColor(gClick)};font-weight:bold;border:1px solid #e5e7eb">${gClick}</td></tr>
    <tr><td style="padding:9px 12px;font-weight:bold;border:1px solid #e5e7eb">Tasa de rebote</td><td style="padding:9px 12px;border:1px solid #e5e7eb"><strong>${bouncePct.toFixed(2)}%</strong></td><td style="padding:9px 12px;color:#666;border:1px solid #e5e7eb">≤ 2% (saludable)</td><td style="padding:9px 12px;color:${gradeColor(gBounce)};font-weight:bold;border:1px solid #e5e7eb">${gBounce}</td></tr>
  </table>
  <p style="background-color:#eef4ff;border-left:4px solid #3b82f6;padding:10px 14px;margin:14px 0 0;font-size:10pt;color:#1a1a1a"><strong>Interpretación:</strong> las campañas B2B del sector cultural y booking suelen tener aperturas altas (25-30%) pero clics moderados (2-4%) porque el contenido es informativo, no de compra directa.</p>
</div>

<!-- ============== 5. EMAIL ENVIADO ============== -->
<div style="padding:8px 32px 22px">
  <h2 style="color:#1a1a1a;font-size:14pt;margin:0 0 4px;font-weight:bold">5 &middot; Email enviado</h2>
  <div style="height:3px;background-color:#FF6B00;width:60px;margin-bottom:14px"></div>
  <table cellpadding="0" cellspacing="0" border="1" width="100%" style="border-collapse:collapse;border-color:#e5e7eb">
    <tr><td style="padding:8px 12px;background-color:#1a1a1a;color:#FF6B00;font-weight:bold;width:25%;font-size:9pt;letter-spacing:1px;text-transform:uppercase;border:1px solid #1a1a1a">DE</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(c.fromName || "RUBEN COTON")} &lt;${esc(c.fromEmail || "manager@rubencoton.com")}&gt;</td></tr>
    <tr><td style="padding:8px 12px;background-color:#1a1a1a;color:#FF6B00;font-weight:bold;font-size:9pt;letter-spacing:1px;text-transform:uppercase;border:1px solid #1a1a1a">PARA</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${fmt(recipients.length)} destinatarios</td></tr>
    <tr><td style="padding:8px 12px;background-color:#1a1a1a;color:#FF6B00;font-weight:bold;font-size:9pt;letter-spacing:1px;text-transform:uppercase;border:1px solid #1a1a1a">ASUNTO</td><td style="padding:8px 12px;border:1px solid #e5e7eb"><strong>${esc(c.subject || "—")}</strong></td></tr>
    <tr><td style="padding:8px 12px;background-color:#1a1a1a;color:#FF6B00;font-weight:bold;font-size:9pt;letter-spacing:1px;text-transform:uppercase;border:1px solid #1a1a1a">FECHA</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${c.sentAt ? new Date(c.sentAt).toLocaleString("es-ES") : "Pendiente"}</td></tr>
  </table>
  <p style="margin:16px 0 6px;font-weight:bold;color:#888;font-size:9.5pt;text-transform:uppercase;letter-spacing:1px">Contenido (texto)</p>
  <div style="background-color:#fafafa;border-left:3px solid #FF6B00;padding:14px 18px;font-size:10.5pt;color:#333;white-space:pre-wrap">${esc(emailPlain) || "Email sin contenido textual."}</div>
</div>

<!-- ============== 6. DESTINATARIOS ============== -->
<div style="padding:8px 32px 22px">
  <h2 style="color:#1a1a1a;font-size:14pt;margin:0 0 4px;font-weight:bold">6 &middot; Destinatarios (${fmt(recipients.length)})</h2>
  <div style="height:3px;background-color:#FF6B00;width:60px;margin-bottom:14px"></div>
  <p style="background-color:#1a1a1a;color:#ffffff;padding:10px 14px;margin:0 0 12px;font-size:10pt;border-left:4px solid #FF6B00"><strong style="color:#FF6B00">Confidencialidad &amp; RGPD:</strong> sólo se muestra el nombre público de cada empresa/entidad y su localización. No incluimos emails, teléfonos ni nombres de personas físicas.</p>
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
    <tr style="background-color:#1a1a1a;color:#FF6B00">
      <th style="padding:8px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px;width:40px">#</th>
      <th style="padding:8px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px">Empresa / Entidad</th>
      <th style="padding:8px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px">Municipio</th>
      <th style="padding:8px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px">Provincia</th>
      <th style="padding:8px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px">CCAA</th>
      <th style="padding:8px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px">Categoría</th>
      <th style="padding:8px 8px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.8px">Estado</th>
    </tr>
    ${recipientTbody}
  </table>
</div>

${topCCAA.length || topProv.length ? `
<!-- ============== 7. GEOGRAFÍA ============== -->
<div style="padding:8px 32px 22px">
  <h2 style="color:#1a1a1a;font-size:14pt;margin:0 0 4px;font-weight:bold">7 &middot; Distribución geográfica</h2>
  <div style="height:3px;background-color:#FF6B00;width:60px;margin-bottom:14px"></div>
  ${topCCAA.length ? `<p style="color:#1a1a1a;font-size:11pt;font-weight:bold;border-left:3px solid #FF6B00;padding-left:10px;margin:8px 0 8px">Top Comunidades Autónomas</p><table cellpadding="0" cellspacing="0" border="0" width="100%">${barRows(topCCAA)}</table>` : ""}
  ${topProv.length ? `<p style="color:#1a1a1a;font-size:11pt;font-weight:bold;border-left:3px solid #FF6B00;padding-left:10px;margin:18px 0 8px">Top Provincias</p><table cellpadding="0" cellspacing="0" border="0" width="100%">${barRows(topProv)}</table>` : ""}
</div>` : ""}

${topCat.length ? `
<!-- ============== 8. CATEGORÍAS ============== -->
<div style="padding:8px 32px 22px">
  <h2 style="color:#1a1a1a;font-size:14pt;margin:0 0 4px;font-weight:bold">8 &middot; Análisis por categoría</h2>
  <div style="height:3px;background-color:#FF6B00;width:60px;margin-bottom:14px"></div>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">${barRows(topCat)}</table>
</div>` : ""}

<!-- ============== 9. CONCLUSIONES ============== -->
<div style="padding:8px 32px 22px">
  <h2 style="color:#1a1a1a;font-size:14pt;margin:0 0 4px;font-weight:bold">9 &middot; Conclusiones y recomendaciones</h2>
  <div style="height:3px;background-color:#FF6B00;width:60px;margin-bottom:14px"></div>
  <p style="color:#1a1a1a;font-size:11pt;font-weight:bold;border-left:3px solid #FF6B00;padding-left:10px;margin:0 0 8px">Hallazgos principales</p>
  <ul style="margin:0 0 16px 22px;padding:0;font-size:10.5pt;color:#1a1a1a">
    <li style="margin:6px 0">La campaña alcanzó a <strong>${fmt(sent)}</strong> destinatarios efectivos sobre ${fmt(total)} programados.</li>
    ${sent > 0 ? `<li style="margin:6px 0">Tasa de apertura del <strong>${openPct.toFixed(1)}%</strong> (benchmark sector: 22%).</li>` : ""}
    ${sent > 0 ? `<li style="margin:6px 0">Tasa de clic del <strong>${clickPct.toFixed(2)}%</strong> (benchmark sector: 3%).</li>` : ""}
    ${Object.keys(byCCAA).length > 0 ? `<li style="margin:6px 0">Cobertura geográfica: <strong>${Object.keys(byCCAA).length}</strong> CCAA y <strong>${Object.keys(byProv).length}</strong> provincias.</li>` : ""}
    ${Object.keys(byCat).length > 0 ? `<li style="margin:6px 0">Categorías profesionales impactadas: <strong>${Object.keys(byCat).length}</strong>.</li>` : ""}
  </ul>
  <p style="color:#1a1a1a;font-size:11pt;font-weight:bold;border-left:3px solid #FF6B00;padding-left:10px;margin:16px 0 8px">Recomendaciones</p>
  <div style="background-color:#fff8e1;border-left:4px solid #f59e0b;padding:12px 16px;font-size:10.5pt;color:#1a1a1a">
    ${recos.map((r) => `<p style="margin:6px 0">${r}</p>`).join("")}
  </div>
</div>

<!-- ============== 10. GLOSARIO ============== -->
<div style="padding:8px 32px 30px">
  <h2 style="color:#1a1a1a;font-size:14pt;margin:0 0 4px;font-weight:bold">10 &middot; Glosario</h2>
  <div style="height:3px;background-color:#FF6B00;width:60px;margin-bottom:14px"></div>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="padding:6px 8px;font-weight:bold;color:#FF6B00;width:30%;vertical-align:top">Apertura (Open Rate)</td><td style="padding:6px 8px;color:#555;font-size:10pt">% de destinatarios que abrieron el email al menos una vez.</td></tr>
    <tr><td style="padding:6px 8px;font-weight:bold;color:#FF6B00;vertical-align:top">Clic (CTR)</td><td style="padding:6px 8px;color:#555;font-size:10pt">% que hizo clic en algún enlace, sobre los emails entregados.</td></tr>
    <tr><td style="padding:6px 8px;font-weight:bold;color:#FF6B00;vertical-align:top">CTOR</td><td style="padding:6px 8px;color:#555;font-size:10pt">% de los que abrieron y además clicaron. Mide la calidad del contenido.</td></tr>
    <tr><td style="padding:6px 8px;font-weight:bold;color:#FF6B00;vertical-align:top">Rebote (Bounce)</td><td style="padding:6px 8px;color:#555;font-size:10pt">Email que no pudo entregarse. Soft (temporal) o hard (permanente).</td></tr>
    <tr><td style="padding:6px 8px;font-weight:bold;color:#FF6B00;vertical-align:top">Entregabilidad</td><td style="padding:6px 8px;color:#555;font-size:10pt">% de emails que llegaron correctamente sin rebotar.</td></tr>
    <tr><td style="padding:6px 8px;font-weight:bold;color:#FF6B00;vertical-align:top">RGPD</td><td style="padding:6px 8px;color:#555;font-size:10pt">Reglamento General de Protección de Datos (UE 2016/679).</td></tr>
  </table>
</div>

<!-- ============== FOOTER ============== -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px">
  <tr><td style="padding:24px 28px;background-color:#1a1a1a;color:#ffffff;text-align:center;border-top:6px solid #FF6B00">
    <p style="color:#FF6B00;font-size:18pt;margin:0;letter-spacing:5px;font-weight:bold">RUBEN COTON</p>
    <p style="color:#FFB74D;font-size:9pt;margin:4px 0 12px;letter-spacing:2.5px;text-transform:uppercase">DJ &middot; Booking &middot; Management</p>
    <p style="font-size:10pt;margin:0;color:#ffffff">manager@rubencoton.com &middot; Madrid, España</p>
    <p style="font-size:8.5pt;color:#aaa;margin:14px 0 0">Informe respeta el RGPD. No se comparten datos personales (emails, teléfonos, nombres de personas físicas).</p>
    <p style="font-size:8pt;color:#888;margin:4px 0 0">Documento generado automáticamente por la plataforma de Envío Masivo de RUBEN COTON</p>
  </td></tr>
</table>

</body>
</html>`;
}

module.exports = { renderCampaignReport };

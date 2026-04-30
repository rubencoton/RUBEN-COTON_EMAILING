"use strict";

/**
 * executiveReports — genera informes ejecutivos semanales y mensuales
 * y los sube al Drive de manager@rubencoton.com.
 *
 * Programación:
 *   - Semanal: cada lunes a las 08:00 (local) cubre la semana anterior (Lun–Dom).
 *   - Mensual: el día 1 de cada mes a las 08:00 (local) cubre el mes anterior.
 *
 * Archivos locales (fallback si Drive no está listo):
 *   data/reports/weekly/INFORME-SEM-YYYY-Www.html
 *   data/reports/monthly/INFORME-MEN-YYYY-MM.html
 */

const fs = require("fs");
const path = require("path");
const driveArchive = require("./driveArchive");
const googleHub = require("./googleHub");

const PUBLIC_DIR = path.resolve(__dirname, "..", "public");
const REPORTS_DIR = path.resolve(__dirname, "..", "data", "reports");
const TEMPLATE_PATH = path.join(PUBLIC_DIR, "executive-report.html");

let _templateCache = null;
function loadTemplate() {
  if (_templateCache) return _templateCache;
  _templateCache = fs.readFileSync(TEMPLATE_PATH, "utf8");
  return _templateCache;
}
function invalidateTemplateCache() { _templateCache = null; }

function ensureReportsDir(subdir) {
  const full = path.join(REPORTS_DIR, subdir);
  fs.mkdirSync(full, { recursive: true });
  return full;
}

/* =========================================================
 * Helpers de fecha — semanas ISO y meses naturales.
 * ========================================================= */
function pad2(n) { return String(n).padStart(2, "0"); }

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/* Devuelve año ISO + semana ISO (1-53) y fechas inicio/fin de esa semana. */
function isoWeekInfo(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

function weekRangeFor(date) {
  /* Lunes 00:00 → Domingo 23:59 */
  const d = new Date(date);
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: startOfDay(monday), to: endOfDay(sunday) };
}

/* Semana anterior a `ref` (Lun–Dom) */
function previousWeekRange(ref = new Date()) {
  const prev = new Date(ref);
  prev.setDate(prev.getDate() - 7);
  return weekRangeFor(prev);
}

/* Mes anterior a `ref` (YYYY-MM completo) */
function previousMonthRange(ref = new Date()) {
  const firstThisMonth = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const lastPrev = new Date(firstThisMonth.getTime() - 1);
  const from = startOfDay(new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1));
  const to = endOfDay(new Date(lastPrev.getFullYear(), lastPrev.getMonth() + 1, 0));
  return { from, to };
}

function fmtEs(d) {
  try {
    return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  } catch (_e) { return ""; }
}
function periodLabelRange(from, to) {
  return `${fmtEs(from)} — ${fmtEs(to)}`;
}

/* =========================================================
 * Cálculo de datos del informe dado un rango.
 * Reaprovecha la lógica del endpoint /api/campaigns/report/executive
 * pero filtrando por fecha.
 * ========================================================= */
function computeReportData(dataStore, { from, to, scope, periodCode }) {
  const campaigns = dataStore.listCampaigns();
  const filtered = campaigns.filter((c) => {
    const ref = c.sentAt || c.updatedAt || c.createdAt;
    if (!ref) return false;
    const t = new Date(ref).getTime();
    return t >= from.getTime() && t <= to.getTime();
  });

  let totalSent = 0, totalOpened = 0, totalClicked = 0, totalBounced = 0, totalRecipients = 0;
  const byStatus = {};
  const months = new Map();

  const rows = filtered.map((c) => {
    const s = c.stats || {};
    const sent = Number(s.sent) || 0;
    const opened = Number(s.opened) || 0;
    const clicked = Number(s.clicked) || 0;
    const bounced = Number(s.bounced) || 0;
    const total = Number(s.total) || 0;
    totalSent += sent; totalOpened += opened; totalClicked += clicked;
    totalBounced += bounced; totalRecipients += total;
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;

    const dateRef = c.sentAt || c.updatedAt || c.createdAt;
    if (dateRef) {
      const d = new Date(dateRef);
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      const row = months.get(key) || { sent: 0, opened: 0, clicked: 0 };
      row.sent += sent; row.opened += opened; row.clicked += clicked;
      months.set(key, row);
    }

    return {
      id: c.id,
      name: c.name || "(sin nombre)",
      subject: c.subject || "",
      status: c.status,
      createdAt: c.createdAt || null,
      sentAt: c.sentAt || null,
      stats: { total, sent, opened, clicked, bounced },
      rates: {
        openRate: sent > 0 ? opened / sent : 0,
        clickRate: sent > 0 ? clicked / sent : 0,
        bounceRate: (sent + bounced) > 0 ? bounced / (sent + bounced) : 0
      }
    };
  });

  rows.sort((a, b) => {
    const da = new Date(a.sentAt || a.createdAt || 0).getTime();
    const db = new Date(b.sentAt || b.createdAt || 0).getTime();
    return db - da;
  });

  const top5 = [...rows]
    .filter((r) => r.stats.sent >= 1)
    .sort((a, b) => b.rates.openRate - a.rates.openRate)
    .slice(0, 5);

  const monthly = Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({ month: key, ...v }));

  return {
    status: "ok",
    generatedAt: new Date().toISOString(),
    meta: {
      scope,
      periodCode,
      periodLabel: periodLabelRange(from, to),
      from: from.toISOString(),
      to: to.toISOString()
    },
    totals: {
      campaigns: filtered.length,
      recipients: totalRecipients,
      sent: totalSent,
      opened: totalOpened,
      clicked: totalClicked,
      bounced: totalBounced,
      openRate: totalSent > 0 ? totalOpened / totalSent : 0,
      clickRate: totalSent > 0 ? totalClicked / totalSent : 0,
      bounceRate: (totalSent + totalBounced) > 0 ? totalBounced / (totalSent + totalBounced) : 0
    },
    byStatus,
    monthly,
    top5,
    campaigns: rows
  };
}

/* Inyecta los datos en la plantilla como window.__EMBEDDED_REPORT_EXEC */
function buildStandaloneHtml(reportData) {
  const tpl = loadTemplate();
  const payload = JSON.stringify(reportData).replace(/<\/script>/g, "<\\/script>");
  const script = `<script id="__embedded_exec">window.__EMBEDDED_REPORT_EXEC = ${payload};</script>\n</body>`;
  if (tpl.includes("</body>")) return tpl.replace("</body>", script);
  return tpl + script;
}

/* =========================================================
 * Generadores públicos — weekly / monthly
 * ========================================================= */
async function generateWeeklyReport({ dataStore, ref = new Date(), uploadToDrive = true } = {}) {
  const { from, to } = previousWeekRange(ref);
  const iw = isoWeekInfo(from);
  const periodCode = `${iw.year}-W${pad2(iw.week)}`;
  const data = computeReportData(dataStore, { from, to, scope: "weekly", periodCode });
  const html = buildStandaloneHtml(data);

  /* Guardado local (fallback / archivo de registro) */
  const localDir = ensureReportsDir("weekly");
  const localPath = path.join(localDir, `INFORME-SEM-${periodCode}.html`);
  fs.writeFileSync(localPath, html, "utf8");
  const jsonPath = path.join(localDir, `INFORME-SEM-${periodCode}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), "utf8");

  let drive = null;
  if (uploadToDrive && googleHub.isGoogleReady()) {
    try {
      drive = await driveArchive.uploadExecutiveReport({
        scope: "weekly", period: periodCode, html, data
      });
    } catch (e) {
      console.error("[executiveReports] Error subiendo semanal al Drive:", e.message);
    }
  }

  return { scope: "weekly", periodCode, localPath, drive, data };
}

async function generateMonthlyReport({ dataStore, ref = new Date(), uploadToDrive = true } = {}) {
  const { from, to } = previousMonthRange(ref);
  const periodCode = `${from.getFullYear()}-${pad2(from.getMonth() + 1)}`;
  const data = computeReportData(dataStore, { from, to, scope: "monthly", periodCode });
  const html = buildStandaloneHtml(data);

  const localDir = ensureReportsDir("monthly");
  const localPath = path.join(localDir, `INFORME-MEN-${periodCode}.html`);
  fs.writeFileSync(localPath, html, "utf8");
  const jsonPath = path.join(localDir, `INFORME-MEN-${periodCode}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), "utf8");

  let drive = null;
  if (uploadToDrive && googleHub.isGoogleReady()) {
    try {
      drive = await driveArchive.uploadExecutiveReport({
        scope: "monthly", period: periodCode, html, data
      });
    } catch (e) {
      console.error("[executiveReports] Error subiendo mensual al Drive:", e.message);
    }
  }

  return { scope: "monthly", periodCode, localPath, drive, data };
}

/* =========================================================
 * Scheduler interno sin dependencias externas.
 * Usa setTimeout recursivo al próximo momento de disparo.
 * ========================================================= */
/* Hora de disparo configurable vía env. Por defecto 14 (14:00 Madrid).
 * El contenedor Docker tiene TZ=Europe/Madrid. Pedido del usuario: lunes
 * 14:00 para el refresh semanal de estado de campañas. */
const WEEKLY_HOUR_LOCAL = Number(process.env.REPORT_WEEKLY_HOUR) || 14;
const MONTHLY_HOUR_LOCAL = Number(process.env.REPORT_MONTHLY_HOUR) || 14;

function nextWeeklyRun(from = new Date()) {
  /* Próximo lunes a WEEKLY_HOUR_LOCAL:00 (hora local del contenedor = Madrid) */
  const d = new Date(from);
  const day = d.getDay();
  const offsetToMonday = (8 - (day === 0 ? 7 : day)) % 7 || 7;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetToMonday, WEEKLY_HOUR_LOCAL, 0, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 7);
  return next;
}

function nextMonthlyRun(from = new Date()) {
  /* Día 1 del mes siguiente a MONTHLY_HOUR_LOCAL:00 (hora local) */
  const next = new Date(from.getFullYear(), from.getMonth() + 1, 1, MONTHLY_HOUR_LOCAL, 0, 0, 0);
  if (next.getTime() <= from.getTime()) next.setMonth(next.getMonth() + 1);
  return next;
}

/* setTimeout tiene límite de ~24.8 días (2^31 ms). Dividimos en tramos. */
const MAX_TIMEOUT = 2 * 60 * 60 * 1000; /* 2h, así comprobamos re-cálculo */
function scheduleOnce(when, fn, onTick) {
  const tick = () => {
    const now = Date.now();
    const delta = when.getTime() - now;
    if (delta <= 0) {
      try { fn(); } catch (e) { console.error("[executiveReports] runtime error:", e); }
      return;
    }
    const wait = Math.min(delta, MAX_TIMEOUT);
    setTimeout(() => { if (onTick) onTick(); tick(); }, wait).unref?.();
  };
  tick();
}

function startScheduler({ getDataStore }) {
  if (typeof getDataStore !== "function") {
    throw new Error("startScheduler: getDataStore debe ser función");
  }
  const armWeekly = () => {
    const when = nextWeeklyRun(new Date());
    console.log(`[executiveReports] próximo informe SEMANAL programado: ${when.toLocaleString("es-ES")}`);
    scheduleOnce(when, async () => {
      try {
        console.log("[executiveReports] ejecutando informe semanal…");
        const res = await generateWeeklyReport({ dataStore: getDataStore() });
        console.log(`[executiveReports] semanal OK (${res.periodCode}). Drive=${res.drive ? res.drive.folderLink : "no"}`);
      } catch (e) {
        console.error("[executiveReports] error semanal:", e.message);
      } finally {
        armWeekly();
      }
    });
  };
  const armMonthly = () => {
    const when = nextMonthlyRun(new Date());
    console.log(`[executiveReports] próximo informe MENSUAL programado: ${when.toLocaleString("es-ES")}`);
    scheduleOnce(when, async () => {
      try {
        console.log("[executiveReports] ejecutando informe mensual…");
        const res = await generateMonthlyReport({ dataStore: getDataStore() });
        console.log(`[executiveReports] mensual OK (${res.periodCode}). Drive=${res.drive ? res.drive.folderLink : "no"}`);
      } catch (e) {
        console.error("[executiveReports] error mensual:", e.message);
      } finally {
        armMonthly();
      }
    });
  };
  armWeekly();
  armMonthly();
}

module.exports = {
  generateWeeklyReport,
  generateMonthlyReport,
  computeReportData,
  buildStandaloneHtml,
  startScheduler,
  invalidateTemplateCache,
  previousWeekRange,
  previousMonthRange,
  nextWeeklyRun,
  nextMonthlyRun
};

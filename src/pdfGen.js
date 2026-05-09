"use strict";

/**
 * pdfGen — convierte HTML a PDF con fidelidad CSS print.
 *
 * P0 REWRITE 2026-05-08 (peticion usuario "los PDFs deben respetar
 * dimensiones A4 210x297mm con paginacion correcta"):
 *
 * Antes: Drive Docs convertia HTML -> Doc -> PDF, lo que ignoraba
 * @media print, @page A4, page-breaks, headers/footers de print, etc.
 * Resultado: PDFs con dimensiones aleatorias, sin paginacion correcta.
 *
 * Ahora: puppeteer-core + chromium del sistema (Alpine apk).
 * page.pdf({ preferCSSPageSize: true }) respeta el @page del CSS al 100%.
 * Las dimensiones A4 (210x297mm) se aplican exactas, los page-breaks
 * funcionan, las @page :first y los counters de paginacion se honran.
 *
 * Memoria: chromium ~150MB por proceso. Con --single-process y
 * --disable-dev-shm-usage encaja en el mem_limit=1200m del compose.
 * Lanzamos browser nuevo por request y lo cerramos en finally para no
 * acumular procesos huerfanos.
 *
 * Fallback: si puppeteer falla (chromium no encontrado, OOM), retorna
 * null y el endpoint sirve el HTML con auto-print (red de seguridad).
 */

const puppeteer = require("puppeteer-core");

const CHROMIUM_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser";

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",   /* /dev/shm puede ser pequeno en Docker -> tmpfs */
  "--disable-gpu",
  "--single-process",          /* mas barato en RAM, suficiente para 1 PDF */
  "--no-zygote",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-sync",
  "--mute-audio",
  "--no-first-run"
];

async function htmlToPdf(html, opts = {}) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: "new",
      args: LAUNCH_ARGS,
      timeout: 30000
    });
    const page = await browser.newPage();
    /* setContent espera 'networkidle0' para que toda imagen/font cargue.
     * Timeout 30s por seguridad (algunos informes tienen muchos KPIs). */
    await page.setContent(html, {
      waitUntil: ["load", "domcontentloaded", "networkidle0"],
      timeout: 30000
    });
    /* Forzar emulacion print para que @media print aplique */
    await page.emulateMediaType("print");

    /* preferCSSPageSize=true -> respeta @page { size: A4 } del CSS.
     * printBackground=true -> respeta colores de fondo (cabeceros negros,
     * KPIs, etc) en el PDF (sin esto sale todo blanco).
     * margin se sobreescribe por @page del CSS si preferCSSPageSize=true. */
    const pdf = await page.pdf({
      format: "A4",                /* fallback si CSS no define @page */
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "15mm", right: "14mm", bottom: "18mm", left: "14mm" },
      displayHeaderFooter: false   /* el CSS @page ya define footer */
    });
    return pdf;
  } catch (err) {
    console.error("[pdfGen] puppeteer fallo:", err.message);
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_e) { /* no-op */ }
    }
  }
}

async function close() { /* no-op, no singleton browser */ }

module.exports = { htmlToPdf, close };

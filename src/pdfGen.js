"use strict";

/**
 * pdfGen — convierte HTML a PDF usando Google Drive API (Docs conversion).
 *
 * Flujo:
 *  1. Sube el HTML a Drive como Google Doc (mimeType doc → convierte auto).
 *  2. Exporta ese Doc como PDF (files.export con mimeType pdf).
 *  3. Borra el Doc temporal.
 *
 * Ventajas vs Puppeteer:
 *  - No requiere chromium (200MB menos de disk).
 *  - No requiere procesos headless extra (sin OOM/restart risk).
 *  - Usa la cuenta manager@ que ya tenemos conectada.
 *
 * Limitaciones:
 *  - Google Docs no respeta @media print ni page-breaks custom con 100%
 *    fidelidad. Para documentos internos y archivo es aceptable.
 */

const { clients, isGoogleReady } = require("./googleHub");
const { Readable } = require("stream");
const crypto = require("crypto");

async function htmlToPdf(html, opts = {}) {
  if (!isGoogleReady()) {
    console.warn("[pdfGen] Google no configurado, PDF omitido.");
    return null;
  }
  const drive = clients.drive();
  const tmpName = `_temp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.html`;
  let tempId = null;
  try {
    /* 1) Crear Google Doc a partir del HTML (Drive hace la conversion) */
    const docRes = await drive.files.create({
      requestBody: {
        name: tmpName,
        mimeType: "application/vnd.google-apps.document"
      },
      media: {
        mimeType: "text/html",
        body: Readable.from(Buffer.from(html, "utf8"))
      },
      fields: "id,name"
    });
    tempId = docRes.data.id;

    /* 2) Exportar como PDF */
    const pdfRes = await drive.files.export(
      { fileId: tempId, mimeType: "application/pdf" },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(pdfRes.data);
  } catch (err) {
    console.error("[pdfGen] Error convirtiendo HTML a PDF:", err.message);
    return null;
  } finally {
    /* 3) Limpiar el Doc temporal. No bloqueante. */
    if (tempId) {
      try {
        await drive.files.delete({ fileId: tempId });
      } catch (_e) { /* no-op */ }
    }
  }
}

async function close() { /* no-op, no singletons que cerrar */ }

module.exports = { htmlToPdf, close };

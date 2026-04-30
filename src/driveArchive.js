"use strict";

/**
 * driveArchive — Sube campañas (email + informe + datos) al Drive de
 * manager@rubencoton.com con sistema de codificación único.
 *
 * Estructura en Drive:
 *   Mi unidad/
 *     ENVIO MASIVO · Histórico de campañas/
 *       CMP-YYYYMMDD-NNNN-slug/
 *         CORREO_CMP-YYYYMMDD-NNNN.html
 *         INFORME_CMP-YYYYMMDD-NNNN.html
 *         DATOS_CMP-YYYYMMDD-NNNN.json
 *         FICHA_CMP-YYYYMMDD-NNNN.txt
 *
 * La carpeta raíz se crea una sola vez y su ID se guarda en data/drive-state.json
 * o en process.env.DRIVE_ROOT_FOLDER_ID.
 */

const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { clients, isGoogleReady } = require("./googleHub");
const pdfGen = require("./pdfGen");

const ROOT_FOLDER_NAME = "ENVIO MASIVO · Histórico de campañas";
const STATE_DIR = path.resolve(__dirname, "..", "data");
const STATE_FILE = path.join(STATE_DIR, "drive-state.json");

function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return {};
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch (_e) { return {}; }
}
function writeState(state) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (_e) { /* ignore */ }
}

/* Busca una carpeta por nombre dentro de un parent (o root si parent=null).
 * Si no existe, la crea. Devuelve el id. */
async function ensureFolder(drive, name, parentId) {
  const escName = String(name).replace(/'/g, "\\'");
  const q = [
    `name = '${escName}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    "trashed = false",
    parentId ? `'${parentId}' in parents` : null
  ].filter(Boolean).join(" and ");

  const found = await drive.files.list({
    q, fields: "files(id,name)", spaces: "drive", pageSize: 1
  });
  if (found.data.files && found.data.files.length) {
    return found.data.files[0].id;
  }
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined
    },
    fields: "id"
  });
  return created.data.id;
}

/* Carpeta oficial del usuario (Drive del owner manager@rubencoton.com).
 * URL compartida 2026-04-30:
 * https://drive.google.com/drive/folders/1HNxywrecpNWcXgkvyezmbNFD0ROkB8tI */
const DEFAULT_DRIVE_ROOT_FOLDER_ID = "1HNxywrecpNWcXgkvyezmbNFD0ROkB8tI";

async function getOrCreateRootFolder(drive) {
  /* 1) Prioridad env var */
  if (process.env.DRIVE_ROOT_FOLDER_ID) {
    return process.env.DRIVE_ROOT_FOLDER_ID;
  }
  /* 2) State file cache (validamos que sea el ID correcto) */
  const state = readState();
  if (state.rootFolderId && state.rootFolderId === DEFAULT_DRIVE_ROOT_FOLDER_ID) {
    try {
      await drive.files.get({ fileId: state.rootFolderId, fields: "id,trashed" });
      return state.rootFolderId;
    } catch (_e) { /* not found, fallback a default */ }
  }
  /* 3) Default hardcoded: verificamos acceso */
  try {
    const check = await drive.files.get({
      fileId: DEFAULT_DRIVE_ROOT_FOLDER_ID,
      fields: "id,name,trashed"
    });
    if (check.data && check.data.id && !check.data.trashed) {
      writeState({ ...state, rootFolderId: check.data.id });
      return check.data.id;
    }
  } catch (e) {
    console.warn("[driveArchive] No se pudo acceder al folder default:", e.message);
  }
  /* 4) Fallback: crear/encontrar por nombre */
  const id = await ensureFolder(drive, ROOT_FOLDER_NAME, null);
  writeState({ ...state, rootFolderId: id });
  return id;
}

/* Sube un string como archivo. Si ya existe con mismo nombre en el parent, lo actualiza. */
async function uploadStringFile(drive, parentId, filename, content, mimeType) {
  /* Busca existente */
  const escName = String(filename).replace(/'/g, "\\'");
  const q = `name = '${escName}' and '${parentId}' in parents and trashed = false`;
  const existing = await drive.files.list({ q, fields: "files(id,name)", spaces: "drive", pageSize: 1 });

  const body = Readable.from(Buffer.from(content, "utf8"));
  const media = { mimeType: mimeType || "text/plain", body };

  if (existing.data.files && existing.data.files.length) {
    const fileId = existing.data.files[0].id;
    const upd = await drive.files.update({
      fileId, media, fields: "id,name,webViewLink"
    });
    return { updated: true, ...upd.data };
  } else {
    const created = await drive.files.create({
      requestBody: { name: filename, parents: [parentId] },
      media,
      fields: "id,name,webViewLink"
    });
    return { created: true, ...created.data };
  }
}

/**
 * Sube una campaña completa al Drive.
 * @param {object} payload
 *   - campaign: objeto campaña
 *   - code: CMP-YYYYMMDD-NNNN
 *   - folder: nombre de subcarpeta CMP-YYYYMMDD-NNNN-slug
 *   - files: { email: htmlString, report: htmlString, data: obj, ficha: string }
 * @returns {Promise<{folderId, folderLink, files: [{name, id, link}]}>}
 */
async function uploadBinaryFile(drive, parentId, filename, buffer, mimeType) {
  const escName = String(filename).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = `name = '${escName}' and '${parentId}' in parents and trashed = false`;
  const existing = await drive.files.list({ q, fields: "files(id,name)", spaces: "drive", pageSize: 1 });
  const body = Readable.from(buffer);
  const media = { mimeType: mimeType || "application/octet-stream", body };
  if (existing.data.files && existing.data.files.length) {
    const fileId = existing.data.files[0].id;
    const upd = await drive.files.update({ fileId, media, fields: "id,name,webViewLink" });
    return { updated: true, ...upd.data };
  } else {
    const created = await drive.files.create({
      requestBody: { name: filename, parents: [parentId] },
      media, fields: "id,name,webViewLink"
    });
    return { created: true, ...created.data };
  }
}

async function uploadCampaignPack({ code, folder, files }) {
  if (!isGoogleReady()) {
    throw new Error("Google no configurado. Configura GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN.");
  }
  const drive = clients.drive();
  const rootId = await getOrCreateRootFolder(drive);
  const folderId = await ensureFolder(drive, folder, rootId);

  /* Petición usuario 2026-04-30: solo CORREO (.html) + INFORME (.pdf).
   * Sin datos.json ni ficha.txt en cada subcarpeta de campaña. */
  const results = [];
  const emailName = `CORREO_${code}.html`;
  const reportPdfName = `INFORME_${code}.pdf`;

  results.push({ type: "correo", ...(await uploadStringFile(drive, folderId, emailName, files.email, "text/html")) });

  /* PDF del informe generado con Chromium headless. Fallback a HTML si
   * chromium no está disponible (dev local sin instalar). */
  try {
    const pdfBuf = await pdfGen.htmlToPdf(files.report, { format: "A4" });
    if (pdfBuf && pdfBuf.length > 0) {
      results.push({ type: "informe-pdf", ...(await uploadBinaryFile(drive, folderId, reportPdfName, pdfBuf, "application/pdf")) });
    } else {
      console.warn("[driveArchive] PDF vacío, subiendo HTML como fallback.");
      const reportName = `INFORME_${code}.html`;
      results.push({ type: "informe-html", ...(await uploadStringFile(drive, folderId, reportName, files.report, "text/html")) });
    }
  } catch (err) {
    console.warn("[driveArchive] PDF no generado:", err.message);
    const reportName = `INFORME_${code}.html`;
    results.push({ type: "informe-html", ...(await uploadStringFile(drive, folderId, reportName, files.report, "text/html")) });
  }

  /* Link público a la carpeta */
  const folderInfo = await drive.files.get({ fileId: folderId, fields: "id,name,webViewLink" });

  return {
    rootFolderId: rootId,
    folderId,
    folderName: folder,
    folderLink: folderInfo.data.webViewLink,
    files: results
  };
}

/* Lista las subcarpetas dentro del root folder (para UI) */
async function listArchivedCampaigns() {
  if (!isGoogleReady()) return [];
  const drive = clients.drive();
  const rootId = await getOrCreateRootFolder(drive);
  const r = await drive.files.list({
    q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name,webViewLink,modifiedTime)",
    pageSize: 500,
    orderBy: "name"
  });
  return (r.data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    link: f.webViewLink,
    modifiedAt: f.modifiedTime
  }));
}

/**
 * Sube un informe ejecutivo (semanal o mensual) al Drive en la subcarpeta
 *   INFORMES EJECUTIVOS / {SEMANALES|MENSUALES}/ INFORME-{scope}-{period}.html
 *
 * @param {object} opts
 *   - scope: "weekly" | "monthly"
 *   - period: "2026-W17" (semanal) | "2026-04" (mensual)
 *   - html: contenido HTML standalone
 *   - data: objeto JSON con métricas (se sube como DATOS_{code}.json)
 */
async function uploadExecutiveReport({ scope, period, html, data }) {
  if (!isGoogleReady()) {
    throw new Error("Google no configurado.");
  }
  const drive = clients.drive();
  const rootId = await getOrCreateRootFolder(drive);
  const parentId = await ensureFolder(drive, "INFORMES EJECUTIVOS", rootId);
  const subName = scope === "monthly" ? "MENSUALES" : "SEMANALES";
  const subId = await ensureFolder(drive, subName, parentId);

  const scopeCode = scope === "monthly" ? "MEN" : "SEM";
  const base = `INFORME-${scopeCode}-${period}`;
  const pdfName = `${base}.pdf`;
  const jsonName = `DATOS_${base}.json`;

  const files = [];
  /* SOLO PDF (petición usuario 2026-04-22): los informes ejecutivos son
   * documento final de presentación, no útil como HTML editable. */
  try {
    const pdfBuf = await pdfGen.htmlToPdf(html, { format: "A4" });
    if (pdfBuf && pdfBuf.length > 0) {
      files.push({ type: "informe-pdf", ...(await uploadBinaryFile(drive, subId, pdfName, pdfBuf, "application/pdf")) });
    } else {
      /* Fallback: si chromium no disponible, subimos HTML (evitamos ruido
       * de "se queda sin documento"). */
      console.warn("[driveArchive] PDF no generado para informe ejecutivo, subiendo HTML como fallback.");
      files.push({ type: "informe-html", ...(await uploadStringFile(drive, subId, `${base}.html`, html, "text/html")) });
    }
  } catch (err) {
    console.warn("[driveArchive] Error generando PDF ejecutivo:", err.message);
    files.push({ type: "informe-html", ...(await uploadStringFile(drive, subId, `${base}.html`, html, "text/html")) });
  }
  files.push({ type: "datos", ...(await uploadStringFile(drive, subId, jsonName, JSON.stringify(data, null, 2), "application/json")) });

  const folderInfo = await drive.files.get({ fileId: subId, fields: "id,name,webViewLink" });
  return {
    rootFolderId: rootId,
    folderId: subId,
    folderName: subName,
    folderLink: folderInfo.data.webViewLink,
    files,
    fileName: pdfName
  };
}

/**
 * Backup automático de store.json a Drive.
 * Se llama desde server.js en intervalo (ej: cada hora). Sube como
 * BACKUPS/store-{YYYY-MM-DD-HH}.json. Mantiene últimos 24 backups (1 día).
 *
 * Refactor 2026-04-25: sustituye al PostgreSQL como recovery layer.
 * Si store.json se corrompe o el volume se pierde, restauramos desde Drive.
 *
 * @param {string} dataFilePath ruta absoluta al store.json
 * @returns {Promise<{ok:boolean, fileId?:string, link?:string, error?:string}>}
 */
async function backupStoreToDrive(dataFilePath) {
  if (!isGoogleReady()) {
    return { ok: false, error: "google_not_ready" };
  }
  let content;
  try {
    content = fs.readFileSync(dataFilePath, "utf8");
  } catch (err) {
    return { ok: false, error: `read_store_failed: ${err.message}` };
  }
  try {
    const drive = clients.drive();
    const rootId = await getOrCreateRootFolder(drive);
    const backupsId = await ensureFolder(drive, "BACKUPS", rootId);
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const hh = String(now.getUTCHours()).padStart(2, "0");
    const filename = `store-${yyyy}-${mm}-${dd}-${hh}.json`;
    const result = await uploadStringFile(
      drive, backupsId, filename, content, "application/json"
    );

    /* Rotación: mantener solo los últimos 24 backups (1 día completo). */
    try {
      const list = await drive.files.list({
        q: `'${backupsId}' in parents and trashed = false and name contains 'store-'`,
        fields: "files(id,name,createdTime)",
        orderBy: "createdTime desc",
        pageSize: 100
      });
      const files = list.data.files || [];
      if (files.length > 24) {
        const toDelete = files.slice(24);
        for (const f of toDelete) {
          try {
            await drive.files.update({ fileId: f.id, requestBody: { trashed: true } });
          } catch (_e) { /* best effort */ }
        }
      }
    } catch (_e) { /* rotation best effort */ }

    return { ok: true, fileId: result.id, link: result.webViewLink, name: filename };
  } catch (err) {
    return { ok: false, error: err.message || "drive_upload_failed" };
  }
}

module.exports = {
  uploadCampaignPack,
  uploadExecutiveReport,
  listArchivedCampaigns,
  getOrCreateRootFolder,
  backupStoreToDrive,
  ROOT_FOLDER_NAME
};

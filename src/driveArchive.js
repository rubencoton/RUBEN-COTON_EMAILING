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
const reportRenderer = require("./reportRenderer");

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

/* Flags Shared Drives: la carpeta raíz puede vivir en una unidad compartida
 * (parentId tipo "0AKZ-..."). Sin estos flags la API devuelve 404. */
const SHARED_DRIVE_FLAGS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true
};

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
    q,
    fields: "files(id,name)",
    pageSize: 1,
    corpora: "allDrives",
    ...SHARED_DRIVE_FLAGS
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
    fields: "id",
    supportsAllDrives: true
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
      await drive.files.get({
        fileId: state.rootFolderId,
        fields: "id,trashed",
        supportsAllDrives: true
      });
      return state.rootFolderId;
    } catch (_e) { /* not found, fallback a default */ }
  }
  /* 3) Default hardcoded: verificamos acceso */
  try {
    const check = await drive.files.get({
      fileId: DEFAULT_DRIVE_ROOT_FOLDER_ID,
      fields: "id,name,trashed",
      supportsAllDrives: true
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
  const existing = await drive.files.list({
    q,
    fields: "files(id,name)",
    pageSize: 1,
    corpora: "allDrives",
    ...SHARED_DRIVE_FLAGS
  });

  const body = Readable.from(Buffer.from(content, "utf8"));
  const media = { mimeType: mimeType || "text/plain", body };

  if (existing.data.files && existing.data.files.length) {
    const fileId = existing.data.files[0].id;
    const upd = await drive.files.update({
      fileId, media, fields: "id,name,webViewLink",
      supportsAllDrives: true
    });
    return { updated: true, ...upd.data };
  } else {
    const created = await drive.files.create({
      requestBody: { name: filename, parents: [parentId] },
      media,
      fields: "id,name,webViewLink",
      supportsAllDrives: true
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
  const existing = await drive.files.list({
    q, fields: "files(id,name)", pageSize: 1,
    corpora: "allDrives", ...SHARED_DRIVE_FLAGS
  });
  const body = Readable.from(buffer);
  const media = { mimeType: mimeType || "application/octet-stream", body };
  if (existing.data.files && existing.data.files.length) {
    const fileId = existing.data.files[0].id;
    const upd = await drive.files.update({
      fileId, media, fields: "id,name,webViewLink",
      supportsAllDrives: true
    });
    return { updated: true, ...upd.data };
  } else {
    const created = await drive.files.create({
      requestBody: { name: filename, parents: [parentId] },
      media, fields: "id,name,webViewLink",
      supportsAllDrives: true
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
   * El INFORME se actualiza periódicamente vía driveScheduler con stats
   * frescas (1h/2h/3h/4h/5h/6h, días 1-7, después semanal). */
  const results = [];
  const emailName = `CORREO_${code}.html`;
  const reportPdfName = `INFORME_${code}.pdf`;

  /* CORREO: solo se sube si no existe (no se actualiza, es fijo). */
  results.push({ type: "correo", ...(await uploadStringFile(drive, folderId, emailName, files.email, "text/html")) });

  /* INFORME PDF: se sobreescribe en cada llamada. Generamos HTML
   * server-side con renderCampaignReport — Drive Docs no ejecuta JS,
   * así que el HTML debe llegar con datos pre-inyectados.
   *
   * files.data es el reportData {campaign, stats, recipients, generatedAt}
   * que viene de buildCampaignReportData en server.js. */
  try {
    const printReadyHtml = files.data
      ? reportRenderer.renderCampaignReport(files.data, files.data.campaign?.id || code)
      : files.report; /* fallback al HTML viejo si no hay data */
    const pdfBuf = await pdfGen.htmlToPdf(printReadyHtml, { format: "A4" });
    if (pdfBuf && pdfBuf.length > 0) {
      results.push({ type: "informe-pdf", ...(await uploadBinaryFile(drive, folderId, reportPdfName, pdfBuf, "application/pdf")) });
    } else {
      console.warn(`[driveArchive] PDF vacío para ${code}, INFORME no actualizado.`);
    }
  } catch (err) {
    console.warn(`[driveArchive] PDF error para ${code}:`, err.message);
  }

  /* Link público a la carpeta */
  const folderInfo = await drive.files.get({
    fileId: folderId, fields: "id,name,webViewLink",
    supportsAllDrives: true
  });

  return {
    rootFolderId: rootId,
    folderId,
    folderName: folder,
    folderLink: folderInfo.data.webViewLink,
    files: results,
    updatedAt: new Date().toISOString()
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
    orderBy: "name",
    corpora: "allDrives",
    ...SHARED_DRIVE_FLAGS
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

  const folderInfo = await drive.files.get({
    fileId: subId, fields: "id,name,webViewLink",
    supportsAllDrives: true
  });
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
  /* P0-H audit 2026-04-30: validar JSON ANTES de subir. Si el flush dejó
   * un store truncado o corrupto, no replicamos la corrupción a Drive
   * (que luego sería usado por restoreStoreFromDrive como fuente de
   * verdad). Mejor abortar el backup y alertar. */
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "store_json_not_object" };
    }
    if (!Array.isArray(parsed.contacts) || !Array.isArray(parsed.events)) {
      return { ok: false, error: "store_json_missing_required_arrays" };
    }
  } catch (err) {
    return { ok: false, error: `store_json_invalid: ${err.message}` };
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

/**
 * Auto-restore: si el store.json local esta vacio o no existe, descarga el
 * backup mas reciente de Drive (BACKUPS/store-YYYY-MM-DD-HH.json) y lo
 * escribe al disco. Failsafe ante perdida de volumen.
 *
 * @param {string} dataFilePath ruta absoluta donde escribir store.json
 * @returns {Promise<{ok:boolean, restored?:string, reason?:string}>}
 */
async function restoreStoreFromDrive(dataFilePath) {
  if (!isGoogleReady()) {
    return { ok: false, reason: "google_not_ready" };
  }
  /* Solo restauramos si NO existe o esta vacio. Si tiene contenido,
   * no hacemos nada (los datos locales son la verdad). */
  try {
    if (fs.existsSync(dataFilePath)) {
      const stat = fs.statSync(dataFilePath);
      if (stat.size > 256) {
        /* > 256 bytes = parece tener datos reales */
        return { ok: false, reason: "store_already_has_data" };
      }
    }
  } catch (_e) { /* sigue */ }

  try {
    const drive = clients.drive();
    const rootId = await getOrCreateRootFolder(drive);
    /* Listar backups y elegir el mas reciente */
    const list = await drive.files.list({
      q: `'${rootId}' in parents and trashed = false and name contains 'store-'`,
      fields: "files(id,name,createdTime)",
      orderBy: "createdTime desc",
      pageSize: 5,
      corpora: "allDrives",
      ...SHARED_DRIVE_FLAGS
    }).catch(async () => {
      /* Si la carpeta raiz no contiene los backups, busca BACKUPS subfolder */
      const backupsId = await ensureFolder(drive, "BACKUPS", rootId);
      return drive.files.list({
        q: `'${backupsId}' in parents and trashed = false and name contains 'store-'`,
        fields: "files(id,name,createdTime)",
        orderBy: "createdTime desc",
        pageSize: 5,
        corpora: "allDrives",
        ...SHARED_DRIVE_FLAGS
      });
    });
    let candidates = list.data.files || [];
    if (candidates.length === 0) {
      /* Reintenta dentro de BACKUPS folder */
      const backupsId = await ensureFolder(drive, "BACKUPS", rootId);
      const list2 = await drive.files.list({
        q: `'${backupsId}' in parents and trashed = false`,
        fields: "files(id,name,createdTime)",
        orderBy: "createdTime desc",
        pageSize: 5,
        corpora: "allDrives",
        ...SHARED_DRIVE_FLAGS
      });
      candidates = list2.data.files || [];
    }
    if (candidates.length === 0) return { ok: false, reason: "no_backup_found" };

    const latest = candidates[0];
    const dl = await drive.files.get(
      { fileId: latest.id, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    const content = Buffer.from(dl.data).toString("utf8");
    /* P0 FIX 2026-05-07: validar JSON antes de sobrescribir disco.
     * Si Drive devuelve un backup corrupto/truncado mid-flight, NO
     * machacar el store local con basura. Mejor abortar y mantener
     * lo que haya en local (aunque sea vacío). */
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      return { ok: false, reason: `backup_corrupted_invalid_json: ${e.message}` };
    }
    /* Validar shape mínimo: debe tener arrays contacts y events */
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.contacts)) {
      return { ok: false, reason: "backup_invalid_shape (missing contacts array)" };
    }
    /* Validar tamaño mínimo: si es muy pequeño es sospechoso */
    if (content.length < 100) {
      return { ok: false, reason: `backup_too_small (${content.length} bytes)` };
    }
    fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
    fs.writeFileSync(dataFilePath, content, "utf8");
    return {
      ok: true,
      restored: latest.name,
      fileId: latest.id,
      size: content.length,
      contactsCount: parsed.contacts.length
    };
  } catch (err) {
    return { ok: false, reason: err.message || "restore_failed" };
  }
}

module.exports = {
  uploadCampaignPack,
  uploadExecutiveReport,
  listArchivedCampaigns,
  getOrCreateRootFolder,
  backupStoreToDrive,
  restoreStoreFromDrive,
  ROOT_FOLDER_NAME
};

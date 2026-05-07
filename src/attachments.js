/**
 * attachments.js — Gestor de adjuntos por campana con limite 10 MB.
 *
 * - Guarda archivos en ./data/attachments/:campaignId/
 * - Comprime imagenes (jpg/png) que pasen 1 MB usando Jimp
 * - Limite total: 10 MB. Si un upload haria pasar, rechaza.
 * - Tipos prohibidos: ejecutables (.exe, .bat, .msi, .sh, .cmd, .dll, .vbs)
 */

const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { Jimp } = require("jimp");

const ROOT = path.join(__dirname, "..", "data", "attachments");
const TOTAL_LIMIT = 10 * 1024 * 1024; // 10 MB
const IMG_COMPRESS_THRESHOLD = 1 * 1024 * 1024; // >1MB → comprimir
const BLOCKED_EXT = new Set([".exe", ".bat", ".msi", ".sh", ".cmd", ".dll", ".vbs", ".com", ".scr", ".ps1"]);

const ensureDir = (p) => {
  try {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  } catch (e) {
    console.warn(`[attachments] mkdir ${p}: ${e.message}`);
  }
};

const dirFor = (campaignId) => {
  const safe = String(campaignId).replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = path.join(ROOT, safe);
  ensureDir(dir);
  return dir;
};

const sanitizeFilename = (name) =>
  String(name || "archivo").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120);

/* P0 FIX 2026-05-07: try/catch en operaciones fs. Si el FS falla
 * (disco lleno, permisos, race), no debe crashear el endpoint que llama. */
const totalSize = (campaignId) => {
  try {
    const dir = dirFor(campaignId);
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).reduce((sum, f) => {
      try { return sum + fs.statSync(path.join(dir, f)).size; } catch (_) { return sum; }
    }, 0);
  } catch (e) {
    console.warn(`[attachments] totalSize ${campaignId}: ${e.message}`);
    return 0;
  }
};

const listAttachments = (campaignId) => {
  try {
    const dir = dirFor(campaignId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).map((name) => {
      try {
        const p = path.join(dir, name);
        const s = fs.statSync(p);
        return { name, size: s.size, modifiedAt: s.mtime.toISOString() };
      } catch (_) { return null; }
    }).filter(Boolean).sort((a, b) => a.modifiedAt.localeCompare(b.modifiedAt));
  } catch (e) {
    console.warn(`[attachments] listAttachments ${campaignId}: ${e.message}`);
    return [];
  }
};

const compressImage = async (filePath) => {
  try {
    const img = await Jimp.read(filePath);
    const ext = path.extname(filePath).toLowerCase();
    /* Redimensionar si >1920px */
    if (img.bitmap.width > 1920) {
      img.resize({ w: 1920 });
    }
    if (ext === ".jpg" || ext === ".jpeg") {
      await img.write(filePath, { quality: 75 });
    } else if (ext === ".png") {
      await img.write(filePath);
    }
    return fs.statSync(filePath).size;
  } catch (_) {
    return fs.statSync(filePath).size;
  }
};

/* P0 FIX 2026-05-07: mutex por campaignId para evitar race condition
 * en el cap 10MB. Dos POST simultáneos podrían pasar el check ambos a la vez. */
const _addLocks = new Map(); // campaignId -> Promise (cola de uploads)
const _withLock = async (campaignId, fn) => {
  const prev = _addLocks.get(campaignId) || Promise.resolve();
  let release;
  const next = new Promise((r) => { release = r; });
  _addLocks.set(campaignId, prev.then(() => next));
  try {
    await prev;
    return await fn();
  } finally {
    release();
    /* Si nadie más encoló, limpiar la entrada para evitar leak */
    setTimeout(() => {
      if (_addLocks.get(campaignId) === next) _addLocks.delete(campaignId);
    }, 100).unref?.();
  }
};

const addAttachment = async (campaignId, file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXT.has(ext)) {
    throw new Error(`Tipo de archivo no permitido: ${ext}`);
  }
  return _withLock(campaignId, async () => {
    const dir = dirFor(campaignId);
    const name = sanitizeFilename(file.originalname);
    const dest = path.join(dir, name);
    let written = false;
    try {
      /* Escribir primero */
      fs.writeFileSync(dest, file.buffer);
      written = true;
      /* Comprimir si es imagen y > threshold */
      if ([".jpg", ".jpeg", ".png"].includes(ext) && fs.statSync(dest).size > IMG_COMPRESS_THRESHOLD) {
        await compressImage(dest);
      }
      /* Verificar limite total (DENTRO del lock para evitar race) */
      const total = totalSize(campaignId);
      if (total > TOTAL_LIMIT) {
        try { fs.unlinkSync(dest); } catch (_) {}
        const mb = (total / 1024 / 1024).toFixed(2);
        throw new Error(`Limite de 10 MB superado (total seria ${mb} MB). Elimina archivos o comprime antes.`);
      }
      return { name, size: fs.statSync(dest).size };
    } catch (e) {
      /* P0 FIX 2026-05-07: limpiar archivo huérfano si fallo después del write */
      if (written) {
        try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch (_) {}
      }
      throw e;
    }
  });
};

const removeAttachment = (campaignId, filename) => {
  try {
    const safe = sanitizeFilename(filename);
    const p = path.join(dirFor(campaignId), safe);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (e) {
    console.warn(`[attachments] removeAttachment ${campaignId}/${filename}: ${e.message}`);
  }
};

/** Devuelve array compatible con nodemailer: [{filename, path}] */
const getAttachmentsForSending = (campaignId) => {
  try {
    const dir = dirFor(campaignId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).map((name) => ({
      filename: name,
      path: path.join(dir, name)
    }));
  } catch (e) {
    console.warn(`[attachments] getAttachmentsForSending ${campaignId}: ${e.message}`);
    return [];
  }
};

/* Multer con memoria (max 10 MB por archivo) */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = {
  upload,
  addAttachment,
  removeAttachment,
  listAttachments,
  totalSize,
  getAttachmentsForSending,
  TOTAL_LIMIT
};

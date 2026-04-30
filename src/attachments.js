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

const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };

const dirFor = (campaignId) => {
  const safe = String(campaignId).replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = path.join(ROOT, safe);
  ensureDir(dir);
  return dir;
};

const sanitizeFilename = (name) =>
  String(name || "archivo").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120);

const totalSize = (campaignId) => {
  const dir = dirFor(campaignId);
  return fs.readdirSync(dir).reduce((sum, f) => {
    try { return sum + fs.statSync(path.join(dir, f)).size; } catch (_) { return sum; }
  }, 0);
};

const listAttachments = (campaignId) => {
  const dir = dirFor(campaignId);
  return fs.readdirSync(dir).map((name) => {
    const p = path.join(dir, name);
    const s = fs.statSync(p);
    return { name, size: s.size, modifiedAt: s.mtime.toISOString() };
  }).sort((a, b) => a.modifiedAt.localeCompare(b.modifiedAt));
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

const addAttachment = async (campaignId, file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXT.has(ext)) {
    throw new Error(`Tipo de archivo no permitido: ${ext}`);
  }
  const dir = dirFor(campaignId);
  const name = sanitizeFilename(file.originalname);
  const dest = path.join(dir, name);

  /* Escribir primero */
  fs.writeFileSync(dest, file.buffer);

  /* Comprimir si es imagen y > threshold */
  if ([".jpg", ".jpeg", ".png"].includes(ext) && fs.statSync(dest).size > IMG_COMPRESS_THRESHOLD) {
    await compressImage(dest);
  }

  /* Verificar limite total */
  const total = totalSize(campaignId);
  if (total > TOTAL_LIMIT) {
    fs.unlinkSync(dest);
    const mb = (total / 1024 / 1024).toFixed(2);
    throw new Error(`Limite de 10 MB superado (total seria ${mb} MB). Elimina archivos o comprime antes.`);
  }

  return { name, size: fs.statSync(dest).size };
};

const removeAttachment = (campaignId, filename) => {
  const safe = sanitizeFilename(filename);
  const p = path.join(dirFor(campaignId), safe);
  if (fs.existsSync(p)) fs.unlinkSync(p);
};

/** Devuelve array compatible con nodemailer: [{filename, path}] */
const getAttachmentsForSending = (campaignId) => {
  const dir = dirFor(campaignId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map((name) => ({
    filename: name,
    path: path.join(dir, name)
  }));
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

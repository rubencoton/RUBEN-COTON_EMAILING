/**
 * Backup automático del store.json local.
 * Hace una copia con timestamp en data/backups/ cada vez que se ejecuta.
 * Mantiene los últimos 30 backups (uno por día).
 *
 * Uso manual: node scripts/backup-store.js
 * Uso automático: registrado como cron interno en server.js (cada 6h)
 */
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data", "store.json");
const BACKUP_DIR = path.join(__dirname, "..", "data", "backups");
const MAX_BACKUPS = 30;

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dest = path.join(BACKUP_DIR, `store-${ts}.json`);
fs.copyFileSync(DATA, dest);
const sizeMB = (fs.statSync(dest).size / 1024 / 1024).toFixed(2);
console.log(`✓ Backup creado: store-${ts}.json (${sizeMB} MB)`);

// Limpiar backups viejos (>30 días o sobrecuota)
const files = fs
  .readdirSync(BACKUP_DIR)
  .filter((f) => f.startsWith("store-") && f.endsWith(".json"))
  .map((f) => ({ f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime); // más reciente primero

const toDelete = files.slice(MAX_BACKUPS);
for (const { f } of toDelete) {
  fs.unlinkSync(path.join(BACKUP_DIR, f));
  console.log(`✗ Borrado backup viejo: ${f}`);
}
console.log(`Backups conservados: ${Math.min(files.length, MAX_BACKUPS)}/${MAX_BACKUPS}`);

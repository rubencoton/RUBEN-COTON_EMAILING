"use strict";

/**
 * sheetsWriteback.js — Escribe estado de envio en columna "Merge status"
 * de cada fila de cada hoja CRM. Peticion usuario 2026-04-30.
 *
 * Cada contacto guarda en customFields._sheetMeta {sheetId, gid, tabName,
 * row, col} (lo guarda sheetsSync al importar). Cuando hay un evento
 * (sent/bounce/open/click/reply), pushear a una cola en memoria. Cada 30s,
 * agrupar por sheetId y hacer batchUpdate con todos los cambios pendientes.
 *
 * Color por estado (peticion usuario, actualizado 2026-05-04):
 *   enviado     -> sin color de fondo (texto "enviado")
 *   rebotado    -> fondo ROJO + texto blanco (cambio user 2026-05-04)
 *   abierto     -> fondo VERDE CLARO
 *   clicado     -> fondo VERDE MEDIO + texto blanco
 *   respondido  -> fondo VERDE OSCURO + texto blanco
 */

const { google } = require("googleapis");
const { getOAuthClient } = require("./googleHub");

const FLUSH_INTERVAL_MS = Number(process.env.WRITEBACK_FLUSH_MS || 30000);
const MAX_BATCH_REQUESTS = 100;

/* Cola en memoria. Cada item: {sheetId, gid, tabName, row, col, status, email, at} */
const queue = [];
let _flushTimer = null;

/* Cache para evitar duplicados rapidos: status mas alto gana.
 * Ej: si el mismo contacto recibe sent y luego open, solo escribimos open
 * (que tiene mas peso). */
const STATUS_PRIORITY = {
  enviado: 1,
  rebotado: 2,
  abierto: 3,
  clicado: 4,
  respondido: 5
};

const STATUS_COLOR = {
  enviado:    { bg: { red: 1,    green: 1,    blue: 1    }, fg: { red: 0, green: 0, blue: 0 } },
  /* P0 user 2026-05-04: rebotado pasa de NEGRO a ROJO (#dc2626) */
  rebotado:   { bg: { red: 0.86, green: 0.15, blue: 0.15 }, fg: { red: 1, green: 1, blue: 1 } },
  abierto:    { bg: { red: 0.72, green: 0.88, blue: 0.80 }, fg: { red: 0, green: 0, blue: 0 } },
  clicado:    { bg: { red: 0.34, green: 0.73, blue: 0.54 }, fg: { red: 1, green: 1, blue: 1 } },
  respondido: { bg: { red: 0.18, green: 0.49, blue: 0.20 }, fg: { red: 1, green: 1, blue: 1 } }
};

/* Auth: usa el OAuth client SINGLETON de googleHub.js
 * P0-J refactor 2026-05-04: evita 4 instancias paralelas refrescando token
 * simultaneamente (Google revoca uno y el modulo muere hasta restart). */
const getAuth = () => getOAuthClient();

/**
 * Encola un cambio de estado para un contacto.
 * @param {object} sheetMeta {sheetId, gid, tabName, row, col}
 * @param {string} status enviado|rebotado|abierto|clicado|respondido
 * @param {string} email (para logging)
 */
const enqueue = (sheetMeta, status, email = "") => {
  if (!sheetMeta || !sheetMeta.sheetId || sheetMeta.gid == null || sheetMeta.row == null || sheetMeta.col == null) {
    return false;
  }
  if (!STATUS_COLOR[status]) {
    console.warn(`[writeback] status desconocido: ${status}`);
    return false;
  }
  /* Dedupe: si ya hay un item para esta (sheet,gid,row) en cola, mantener
   * el de mayor prioridad. */
  const key = `${sheetMeta.sheetId}|${sheetMeta.gid}|${sheetMeta.row}`;
  const existingIdx = queue.findIndex((q) => `${q.sheetId}|${q.gid}|${q.row}` === key);
  if (existingIdx >= 0) {
    const existing = queue[existingIdx];
    if ((STATUS_PRIORITY[status] || 0) > (STATUS_PRIORITY[existing.status] || 0)) {
      queue[existingIdx] = { ...sheetMeta, status, email, at: Date.now() };
    }
  } else {
    queue.push({ ...sheetMeta, status, email, at: Date.now() });
  }
  scheduleFlush();
  return true;
};

const scheduleFlush = () => {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flush().catch((e) => console.warn("[writeback] flush err:", e.message));
  }, FLUSH_INTERVAL_MS);
};

const flush = async () => {
  if (queue.length === 0) return { flushed: 0 };
  const auth = getAuth();
  if (!auth) {
    console.warn("[writeback] OAuth no configurado, descartando cola");
    queue.length = 0;
    return { flushed: 0, reason: "no_auth" };
  }
  const sheets = google.sheets({ version: "v4", auth });

  /* Agrupar por sheetId, max MAX_BATCH_REQUESTS por sheet */
  const bySheet = {};
  let processed = 0;
  while (queue.length > 0 && processed < MAX_BATCH_REQUESTS * 5) {
    const e = queue.shift();
    if (!bySheet[e.sheetId]) bySheet[e.sheetId] = [];
    if (bySheet[e.sheetId].length >= MAX_BATCH_REQUESTS) {
      /* Devolver al final de la cola para siguiente tick */
      queue.push(e);
      break;
    }
    bySheet[e.sheetId].push(e);
    processed++;
  }

  let totalUpdated = 0;
  for (const [sheetId, items] of Object.entries(bySheet)) {
    const requests = items.map((it) => {
      const colors = STATUS_COLOR[it.status];
      return {
        updateCells: {
          rows: [{
            values: [{
              userEnteredValue: { stringValue: it.status },
              userEnteredFormat: {
                backgroundColor: colors.bg,
                textFormat: { foregroundColor: colors.fg, bold: it.status === "rebotado" || it.status === "respondido" }
              }
            }]
          }],
          fields: "userEnteredValue,userEnteredFormat.backgroundColor,userEnteredFormat.textFormat",
          start: {
            sheetId: Number(it.gid),
            rowIndex: Number(it.row),
            columnIndex: Number(it.col)
          }
        }
      };
    });
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests }
      });
      totalUpdated += items.length;
    } catch (e) {
      console.warn(`[writeback] batchUpdate fallo en ${sheetId.slice(0,12)}: ${e.message}`);
      /* Re-encolar para reintento si es 429/503 */
      if (/429|503|quota/i.test(e.message)) {
        for (const it of items) queue.push(it);
      }
    }
  }

  if (totalUpdated > 0) {
    console.log(`[writeback] ${totalUpdated} celdas Merge status actualizadas (cola pendiente: ${queue.length})`);
  }

  /* Si quedan items, reagendar */
  if (queue.length > 0) scheduleFlush();
  return { flushed: totalUpdated, pending: queue.length };
};

const getQueueSize = () => queue.length;

module.exports = {
  enqueue,
  flush,
  getQueueSize,
  STATUS_COLOR
};

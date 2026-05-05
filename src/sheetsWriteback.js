"use strict";

/**
 * sheetsWriteback.js — Escribe estado de envio en columna "Merge status"
 * de cada fila de cada hoja CRM. Peticion usuario 2026-04-30.
 *
 * Cada contacto guarda en customFields._sheetMeta {sheetId, gid, tabName,
 * row, col} (lo guarda sheetsSync al importar). Cuando hay un evento
 * (sent/bounce/open/click/reply), pushear a una cola en memoria. Tras un
 * debounce corto (1.5s por defecto), agrupar por sheetId y hacer batchUpdate
 * con todos los cambios pendientes.
 *
 * Color por estado (peticion usuario, actualizado 2026-05-04):
 *   enviado     -> sin color de fondo (texto "enviado")
 *   rebotado    -> fondo ROJO + texto blanco (cambio user 2026-05-04)
 *   abierto     -> fondo VERDE CLARO
 *   clicado     -> fondo VERDE MEDIO + texto blanco
 *   respondido  -> fondo VERDE OSCURO + texto blanco
 *
 * PETICION USUARIO 2026-05-05: el usuario quiere ver el Merge status en
 * tiempo real desde Google Sheets mientras envía la campaña. Antes el
 * flush era cada 30s (acumulaba demasiado). Ahora cada 1.5s -> con cadencia
 * 3 emails/min sólo hay ~1 email por ventana, así que cada envío se refleja
 * casi al instante. Sigue siendo eficiente para ráfagas de opens/clicks
 * (se agrupan en una sola batchUpdate por sheetId).
 *
 * Rate-limit Google Sheets: 60 writes/min/user. Con 3 emails/min + opens/
 * clicks/replies puntuales estamos muy por debajo del límite.
 */

const { google } = require("googleapis");
const { getOAuthClient } = require("./googleHub");

const FLUSH_INTERVAL_MS = Number(process.env.WRITEBACK_FLUSH_MS || 1500);
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

/* PETICION USUARIO 2026-05-05: texto SIEMPRE NEGRO + MAYUSCULAS,
 * fondos PASTEL claros para que el texto se lea bien. */
const STATUS_COLOR = {
  enviado:    { bg: { red: 0.96, green: 0.96, blue: 0.97 }, fg: { red: 0, green: 0, blue: 0 } }, /* gris muy claro */
  rebotado:   { bg: { red: 0.99, green: 0.89, blue: 0.89 }, fg: { red: 0, green: 0, blue: 0 } }, /* rojo pastel #fee2e2 */
  abierto:    { bg: { red: 0.82, green: 0.98, blue: 0.90 }, fg: { red: 0, green: 0, blue: 0 } }, /* verde pastel claro #d1fae5 */
  clicado:    { bg: { red: 0.65, green: 0.95, blue: 0.81 }, fg: { red: 0, green: 0, blue: 0 } }, /* verde pastel medio #a7f3d0 */
  respondido: { bg: { red: 0.43, green: 0.91, blue: 0.72 }, fg: { red: 0, green: 0, blue: 0 } }  /* verde pastel oscuro #6ee7b7 */
};
/* Mapeo lowercase -> uppercase para escribir en celda. */
const STATUS_LABEL_UPPER = {
  enviado: "ENVIADO",
  rebotado: "REBOTADO",
  abierto: "ABIERTO",
  clicado: "CLICADO",
  respondido: "RESPONDIDO"
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
      const upperLabel = STATUS_LABEL_UPPER[it.status] || String(it.status).toUpperCase();
      return {
        updateCells: {
          rows: [{
            values: [{
              userEnteredValue: { stringValue: upperLabel },
              userEnteredFormat: {
                backgroundColor: colors.bg,
                textFormat: { foregroundColor: colors.fg, bold: true }
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

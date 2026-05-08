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
/* P1 ROBUSTEZ 2026-05-08: backoff exponencial cuando Sheets API responde
   con 429/503 (quota o servicio caido). Antes el reschedule era siempre
   FLUSH_INTERVAL_MS (1.5s), generando spam de errores y saturando quota
   si Sheets estaba 10 min down. Ahora: 1.5s, 3s, 6s, 12s... hasta 5 min. */
const BACKOFF_MAX_MS = 5 * 60 * 1000;

/* Cola en memoria. Cada item: {sheetId, gid, tabName, row, col, status, email, at} */
const queue = [];
let _flushTimer = null;
/* P0 FIX 2026-05-07: lock anti-reentrant. Si scheduleFlush dispara durante
 * un flush() lento (>1.5s en Sheets API), dos flushes concurrentes harían
 * queue.shift() simultáneo → mismo item escrito 2 veces. */
let _flushing = false;
/* P1 ROBUSTEZ 2026-05-08: contador de fallos transitorios consecutivos.
   Se incrementa en 429/503/quota; se resetea cuando un flush escribe ≥1
   celda con éxito. Determina el delay del proximo schedule. */
let _consecutiveTransientFailures = 0;
const _nextBackoffDelay = () => {
  if (_consecutiveTransientFailures <= 0) return FLUSH_INTERVAL_MS;
  const exp = Math.min(BACKOFF_MAX_MS, FLUSH_INTERVAL_MS * Math.pow(2, _consecutiveTransientFailures));
  /* jitter ±20% para no sincronizar todos los reintentos */
  const jitter = exp * (0.8 + Math.random() * 0.4);
  return Math.round(jitter);
};

/* P0 FIX 2026-05-06 (saturacion VPS por 411 errores/min):
 * circuit breaker. Si un sheet+gid devuelve "after last column in grid",
 * marca la combinacion como rota y skipea futuras escrituras para evitar
 * loop de errores. Se logea SOLO la primera vez por sheet+gid.
 *
 * P0 FIX 2026-05-07: TTL 24h. Antes el Map crecía permanentemente; tras
 * meses con sheets cambiantes, leak silencioso + bloqueo eterno aunque
 * el schema se arregle. Ahora se purga al check si la entrada tiene >24h. */
const skipBySheet = new Map(); // "sheetId|gid" -> { reason, at }
const SKIP_TTL_MS = 24 * 60 * 60 * 1000;
const isSheetSkipped = (key) => {
  const entry = skipBySheet.get(key);
  if (!entry) return false;
  if (Date.now() - entry.at > SKIP_TTL_MS) {
    skipBySheet.delete(key);
    console.log(`[writeback] circuit breaker reset por TTL para ${key}`);
    return false;
  }
  return true;
};

/* Cache para evitar duplicados rapidos: status mas alto gana.
 * Ej: si el mismo contacto recibe sent y luego open, solo escribimos open
 * (que tiene mas peso). */
const STATUS_PRIORITY = {
  enviado: 1,
  rebotado: 2,
  abierto: 3,
  clicado: 4,
  respondido: 5,
  /* P0 audit 2026-05-05: añadido "unsubscribed" como estado terminal de
   * mayor prioridad. Si un contacto se da de baja, se ve en la columna
   * Merge status y queda registrado en stats. */
  unsubscribed: 6
};

/* PETICION USUARIO 2026-05-05: texto SIEMPRE NEGRO + MAYUSCULAS,
 * fondos PASTEL claros para que el texto se lea bien. */
const STATUS_COLOR = {
  enviado:      { bg: { red: 0.96, green: 0.96, blue: 0.97 }, fg: { red: 0, green: 0, blue: 0 } }, /* gris muy claro */
  rebotado:     { bg: { red: 0.99, green: 0.89, blue: 0.89 }, fg: { red: 0, green: 0, blue: 0 } }, /* rojo pastel #fee2e2 */
  abierto:      { bg: { red: 0.82, green: 0.98, blue: 0.90 }, fg: { red: 0, green: 0, blue: 0 } }, /* verde pastel claro #d1fae5 */
  clicado:      { bg: { red: 0.65, green: 0.95, blue: 0.81 }, fg: { red: 0, green: 0, blue: 0 } }, /* verde pastel medio #a7f3d0 */
  respondido:   { bg: { red: 0.43, green: 0.91, blue: 0.72 }, fg: { red: 0, green: 0, blue: 0 } }, /* verde pastel oscuro #6ee7b7 */
  unsubscribed: { bg: { red: 0.97, green: 0.95, blue: 0.78 }, fg: { red: 0, green: 0, blue: 0 } }  /* amarillo pastel #f7f2c7 */
};
/* Mapeo lowercase -> uppercase para escribir en celda. */
const STATUS_LABEL_UPPER = {
  enviado: "ENVIADO",
  rebotado: "REBOTADO",
  abierto: "ABIERTO",
  clicado: "CLICADO",
  respondido: "RESPONDIDO",
  unsubscribed: "BAJA"
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
  /* P0 FIX 2026-05-06: circuit breaker con TTL 24h (refactor 2026-05-07). */
  const skipKey = `${sheetMeta.sheetId}|${sheetMeta.gid}`;
  if (isSheetSkipped(skipKey)) {
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
  /* P1 ROBUSTEZ 2026-05-08: delay calculado segun backoff exponencial.
     Si la API esta sana, sigue siendo el FLUSH_INTERVAL_MS de siempre. */
  const delay = _nextBackoffDelay();
  if (_consecutiveTransientFailures > 0) {
    console.log(`[writeback] backoff: proximo flush en ${Math.round(delay/1000)}s (fallos consecutivos: ${_consecutiveTransientFailures})`);
  }
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flush().catch((e) => console.warn("[writeback] flush err:", e.message));
  }, delay);
  _flushTimer.unref?.();
};

const flush = async () => {
  /* P0 FIX 2026-05-07: lock anti-reentrant. Si scheduleFlush dispara
   * durante un flush() lento, no permitir doble flush concurrente. */
  if (_flushing) return { flushed: 0, reason: "already_flushing" };
  if (queue.length === 0) return { flushed: 0 };
  _flushing = true;
  let totalUpdated = 0;
  try {
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
        /* P0 FIX 2026-05-06: detectar errores PERMANENTES de schema y marcar
         * sheet+gid como roto para no reintentar mas. Eliminamos el spam de
         * 411 errores/min que saturaba el VPS. */
        const isSchemaError = /after last column in grid|exceeds grid limits|invalid range|not found|gridcoordinate|not a valid|invalid requests/i.test(e.message);
        if (isSchemaError) {
          const failedKeys = new Set();
          for (const it of items) {
            const key = `${it.sheetId}|${it.gid}`;
            if (!skipBySheet.has(key)) {
              skipBySheet.set(key, { reason: e.message.slice(0, 120), at: Date.now() });
              failedKeys.add(key);
            }
          }
          if (failedKeys.size > 0) {
            console.warn(`[writeback] schema error PERMANENTE en ${Array.from(failedKeys).join(', ')}: ${e.message.slice(0, 100)}. NO reintentamos. Total skipped: ${skipBySheet.size}`);
          }
        } else {
          console.warn(`[writeback] batchUpdate fallo en ${sheetId.slice(0,12)}: ${e.message}`);
          /* P1 ROBUSTEZ 2026-05-08: re-encolar + ACTIVAR backoff exponencial
             si es 429/503/quota transitorio. Antes reintentaba a 1.5s
             generando spam si Sheets estaba caido. */
          if (/429|503|quota/i.test(e.message)) {
            for (const it of items) queue.push(it);
            _consecutiveTransientFailures++;
          }
        }
      }
    }

    if (totalUpdated > 0) {
      console.log(`[writeback] ${totalUpdated} celdas Merge status actualizadas (cola pendiente: ${queue.length})`);
      /* P1 ROBUSTEZ 2026-05-08: reset backoff al primer exito real.
         Cualquier escritura confirmada significa que la API responde. */
      if (_consecutiveTransientFailures > 0) {
        console.log(`[writeback] backoff reset (fallos consecutivos previos: ${_consecutiveTransientFailures})`);
        _consecutiveTransientFailures = 0;
      }
    }

    return { flushed: totalUpdated, pending: queue.length };
  } finally {
    /* P0 FIX 2026-05-07: garantizar release del lock + reschedule si quedan
     * items en cola, AUNQUE haya habido excepciones inesperadas. Antes el
     * reschedule estaba fuera del try, lo cual fallaba si el bucle lanzaba
     * antes de llegar al final. */
    _flushing = false;
    if (queue.length > 0) scheduleFlush();
  }
};

const getQueueSize = () => queue.length;

module.exports = {
  enqueue,
  flush,
  getQueueSize,
  STATUS_COLOR
};

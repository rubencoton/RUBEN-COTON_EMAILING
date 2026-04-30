"use strict";

/**
 * driveScheduler.js — Actualizacion periodica de los informes de campañas en Drive.
 *
 * Cronograma (peticion usuario 2026-04-30):
 *   - Snapshot inicial al subir la campaña (lo hace uploadCampaignPack)
 *   - Cada hora: 1h, 2h, 3h, 4h, 5h, 6h tras envio
 *   - Cada 24h durante la primera semana: dia 1, 2, 3, 4, 5, 6, 7
 *   - Despues: semanal (cada 7 dias) hasta cap maximo (90 dias por defecto)
 *
 * Almacena el estado en data/drive-schedule.json con la lista de campañas
 * que tienen trazabilidad activa, su sentAt, lastUpdate y nextUpdate.
 *
 * Si una campaña se BORRA en la app, su carpeta Drive permanece (peticion
 * usuario): el scheduler simplemente la desactiva del estado y deja de
 * actualizarla. El usuario hace el borrado manual si quiere.
 */

const fs = require("fs");
const path = require("path");

const STATE_FILE = path.join(__dirname, "..", "data", "drive-schedule.json");
const TICK_INTERVAL_MS = 5 * 60 * 1000; /* cada 5 min revisa si toca alguien */
const MAX_TRACKING_DAYS = Number(process.env.DRIVE_MAX_TRACKING_DAYS || 90);

/* Cronograma:
 * Tras N horas/dias de envio, se actualiza el PDF.
 * Marcamos cada slot como `done` cuando ya se ha ejecutado para no repetir. */
const HOURLY_SLOTS = [1, 2, 3, 4, 5, 6]; /* horas */
const DAILY_SLOTS = [1, 2, 3, 4, 5, 6, 7]; /* dias */
const WEEKLY_INTERVAL_DAYS = 7;

let _dataStoreRef = null;
let _driveArchiveRef = null;
let _serverHelpersRef = null;
let _ticker = null;

const setRefs = ({ dataStore, driveArchive, serverHelpers }) => {
  _dataStoreRef = dataStore;
  _driveArchiveRef = driveArchive;
  _serverHelpersRef = serverHelpers;
};

const readState = () => {
  try {
    if (!fs.existsSync(STATE_FILE)) return { tracked: {} };
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch (_e) { return { tracked: {} }; }
};

const writeState = (state) => {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.warn("[driveScheduler] no se pudo persistir estado:", e.message);
  }
};

/* Registra una campaña para trazabilidad Drive periodica.
 * Llamar tras uploadCampaignPack inicial. */
const trackCampaign = (campaignId, sentAtIso) => {
  const state = readState();
  if (!state.tracked) state.tracked = {};
  if (!state.tracked[campaignId]) {
    state.tracked[campaignId] = {
      campaignId,
      sentAt: sentAtIso || new Date().toISOString(),
      lastUpdateAt: new Date().toISOString(),
      hourlyDone: [],
      dailyDone: [],
      weeklyDone: []
    };
    writeState(state);
    console.log(`[driveScheduler] tracking iniciado: ${campaignId}`);
  }
  return state.tracked[campaignId];
};

/* Quita el tracking de una campaña (la carpeta Drive se conserva). */
const untrackCampaign = (campaignId) => {
  const state = readState();
  if (state.tracked && state.tracked[campaignId]) {
    delete state.tracked[campaignId];
    writeState(state);
    console.log(`[driveScheduler] tracking detenido: ${campaignId}`);
  }
};

/* Decide si una campaña tracked tiene un slot pendiente. Devuelve el slot
 * a ejecutar o null. Marca el slot como done si lo selecciona. */
const pickNextSlot = (entry) => {
  const sentMs = new Date(entry.sentAt).getTime();
  if (!Number.isFinite(sentMs)) return null;
  const now = Date.now();
  const elapsedMs = now - sentMs;
  const elapsedH = elapsedMs / (60 * 60 * 1000);
  const elapsedD = elapsedMs / (24 * 60 * 60 * 1000);

  /* Cap maximo: tras MAX_TRACKING_DAYS dejamos de actualizar. */
  if (elapsedD > MAX_TRACKING_DAYS) return null;

  /* Slots horarios (primeras 6h) */
  if (elapsedH < 7) {
    for (const h of HOURLY_SLOTS) {
      if (!entry.hourlyDone.includes(h) && elapsedH >= h) {
        return { kind: "hourly", value: h };
      }
    }
  }

  /* Slots diarios (dias 1-7) */
  if (elapsedD < 8) {
    for (const d of DAILY_SLOTS) {
      if (!entry.dailyDone.includes(d) && elapsedD >= d) {
        return { kind: "daily", value: d };
      }
    }
  }

  /* Slots semanales (cada 7 dias tras el dia 7) */
  const weeksSince = Math.floor((elapsedD - 7) / WEEKLY_INTERVAL_DAYS);
  if (weeksSince >= 1) {
    for (let w = 1; w <= weeksSince; w++) {
      if (!entry.weeklyDone.includes(w)) {
        return { kind: "weekly", value: w };
      }
    }
  }

  return null;
};

const markDone = (entry, slot) => {
  if (slot.kind === "hourly") entry.hourlyDone.push(slot.value);
  else if (slot.kind === "daily") entry.dailyDone.push(slot.value);
  else if (slot.kind === "weekly") entry.weeklyDone.push(slot.value);
  entry.lastUpdateAt = new Date().toISOString();
  entry.lastSlot = slot;
};

/* Ejecuta una actualizacion de Drive para una campaña. */
const updateOne = async (campaignId, slot) => {
  if (!_dataStoreRef || !_driveArchiveRef || !_serverHelpersRef) {
    console.warn("[driveScheduler] refs no inicializadas");
    return false;
  }
  const campaign = _dataStoreRef.getCampaign(campaignId);
  if (!campaign) {
    /* Campaña borrada en la app: dejamos de trackear, conservamos carpeta. */
    untrackCampaign(campaignId);
    return false;
  }
  try {
    const seq = _serverHelpersRef.calcCampaignSeq(campaignId);
    const pack = _serverHelpersRef.buildCampaignPackForDrive(campaign, seq);
    const result = await _driveArchiveRef.uploadCampaignPack({
      code: pack.code,
      folder: pack.folder,
      files: { email: pack.emailHtml, report: pack.reportHtml, data: pack.data, ficha: pack.ficha }
    });
    console.log(`[driveScheduler] ${campaignId} actualizado (slot ${slot.kind}/${slot.value}) -> ${result.folderLink}`);
    return true;
  } catch (e) {
    console.warn(`[driveScheduler] update fallo para ${campaignId}:`, e.message);
    return false;
  }
};

/* Tick principal: revisa todas las campañas tracked y ejecuta los slots
 * vencidos. Procesa una campaña por tick para no saturar Drive. */
const tick = async () => {
  const state = readState();
  if (!state.tracked) state.tracked = {};
  const ids = Object.keys(state.tracked);
  for (const id of ids) {
    const entry = state.tracked[id];
    const slot = pickNextSlot(entry);
    if (slot) {
      const ok = await updateOne(id, slot);
      if (ok) {
        markDone(entry, slot);
        writeState(state);
      }
      /* Solo una actualizacion por tick para no agolparse. */
      return;
    }
  }
};

const start = () => {
  if (_ticker) return;
  console.log(`[driveScheduler] arrancado (tick cada ${TICK_INTERVAL_MS / 60000}min, max ${MAX_TRACKING_DAYS}d)`);
  /* Primer tick a los 30s del arranque */
  setTimeout(() => { tick().catch((e) => console.warn("[driveScheduler] tick err:", e.message)); }, 30000);
  _ticker = setInterval(() => {
    tick().catch((e) => console.warn("[driveScheduler] tick err:", e.message));
  }, TICK_INTERVAL_MS);
};

const stop = () => {
  if (_ticker) clearInterval(_ticker);
  _ticker = null;
};

module.exports = {
  setRefs,
  start,
  stop,
  trackCampaign,
  untrackCampaign,
  readState
};

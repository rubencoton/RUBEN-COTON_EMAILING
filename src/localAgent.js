"use strict";

/**
 * localAgent.js — Gestiona el estado del PC local de RUBEN COTON.
 *
 * El PC local hace polling al VPS cada 30s para:
 *   1. Heartbeat → "estoy vivo"
 *   2. Pedir jobs pesados (generación email IA con Qwen 14B, render PDF)
 *   3. Subir resultados
 *
 * El VPS expone /api/ai/* y si el PC está online (heartbeat <120s)
 * ENCOLA el job para que lo procese el PC. Si está offline, fallback
 * inmediato a Cloud IA (Groq/Sambanova).
 *
 * Estado en memoria (no persistido): si VPS se reinicia, PC reenvía
 * heartbeat en máximo 30s.
 *
 * Refactor 2026-04-25: separar concerns, no inflar más el server.js.
 */

/* Tiempo máximo desde último heartbeat para considerar PC online */
const ONLINE_TIMEOUT_MS = Number(process.env.LOCAL_AGENT_ONLINE_TIMEOUT_MS) || 120_000; // 2 min

/* Token compartido para autenticar el agent. Si no se configura, agent
 * desactivado (no se aceptan heartbeats). */
const SHARED_TOKEN = process.env.LOCAL_AGENT_TOKEN || "";

const state = {
  lastHeartbeatAt: 0,
  lastHeartbeatMeta: null,
  /* Cola FIFO de jobs pendientes que necesitan PC local. */
  jobs: [],
  /* Jobs claimed por agent y a la espera de resultado. */
  inFlight: new Map(),
  stats: { jobsCreated: 0, jobsCompleted: 0, jobsFailed: 0, fallbackToCloud: 0 }
};

/* Genera id único para job. */
let jobCounter = 0;
const newJobId = () => `lj_${Date.now().toString(36)}_${(jobCounter++).toString(36)}`;

/* Verifica token compartido en request. */
function authToken(reqToken) {
  if (!SHARED_TOKEN) return false;
  if (!reqToken) return false;
  /* Comparación constant-time. */
  const a = Buffer.from(String(reqToken));
  const b = Buffer.from(SHARED_TOKEN);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* Aplica heartbeat, devuelve resumen del estado. */
function applyHeartbeat(meta = {}) {
  state.lastHeartbeatAt = Date.now();
  state.lastHeartbeatMeta = {
    hostname: String(meta.hostname || "").slice(0, 64),
    version: String(meta.version || "").slice(0, 32),
    ollamaModel: String(meta.ollamaModel || "").slice(0, 64),
    ollamaReady: !!meta.ollamaReady,
    ts: state.lastHeartbeatAt
  };
}

function isOnline() {
  if (!SHARED_TOKEN) return false;
  if (!state.lastHeartbeatAt) return false;
  return Date.now() - state.lastHeartbeatAt < ONLINE_TIMEOUT_MS;
}

function getStatus() {
  return {
    enabled: !!SHARED_TOKEN,
    online: isOnline(),
    lastHeartbeatAt: state.lastHeartbeatAt
      ? new Date(state.lastHeartbeatAt).toISOString()
      : null,
    secondsAgo: state.lastHeartbeatAt
      ? Math.round((Date.now() - state.lastHeartbeatAt) / 1000)
      : null,
    meta: state.lastHeartbeatMeta,
    queueSize: state.jobs.length,
    inFlightSize: state.inFlight.size,
    stats: state.stats
  };
}

/* Encola un job. Si PC offline, devuelve null (caller debe fallback). */
function enqueueJob({ kind, payload, ttlMs }) {
  if (!isOnline()) return null;
  const id = newJobId();
  const job = {
    id,
    kind: String(kind || "generic"),
    payload: payload || {},
    createdAt: Date.now(),
    expiresAt: Date.now() + (Number(ttlMs) || 60_000)
  };
  state.jobs.push(job);
  state.stats.jobsCreated++;
  return job;
}

/* Agent reclama el siguiente job (FIFO). */
function claimNextJob() {
  /* Limpia expirados primero. */
  const now = Date.now();
  while (state.jobs.length && state.jobs[0].expiresAt < now) {
    state.jobs.shift();
  }
  const job = state.jobs.shift();
  if (!job) return null;
  state.inFlight.set(job.id, { ...job, claimedAt: now });
  return job;
}

/* Agent completa un job con resultado (o error). */
function completeJob(id, result, error) {
  const job = state.inFlight.get(id);
  if (!job) return false;
  state.inFlight.delete(id);
  if (error) {
    state.stats.jobsFailed++;
    if (typeof job.reject === "function") job.reject(new Error(error));
  } else {
    state.stats.jobsCompleted++;
    if (typeof job.resolve === "function") job.resolve(result);
  }
  return true;
}

/**
 * Helper de alto nivel: ejecuta un job en PC local con timeout, fallback
 * automático a `cloudFallback()` si PC offline o timeout.
 *
 * @param {object} opts
 *   - kind: tipo de job (informativo)
 *   - payload: datos del job
 *   - timeoutMs: tiempo máximo esperando al PC
 *   - cloudFallback: async () => result (se llama si PC offline/timeout)
 */
async function runWithLocalOrCloud({ kind, payload, timeoutMs, cloudFallback }) {
  const tMax = Number(timeoutMs) || 30_000;

  if (!isOnline()) {
    state.stats.fallbackToCloud++;
    return { result: await cloudFallback(), provider: "cloud_fallback_pc_offline" };
  }

  const job = enqueueJob({ kind, payload, ttlMs: tMax });
  if (!job) {
    state.stats.fallbackToCloud++;
    return { result: await cloudFallback(), provider: "cloud_fallback_enqueue_failed" };
  }

  const result = await new Promise((resolve, reject) => {
    job.resolve = resolve;
    job.reject = reject;
    setTimeout(() => {
      if (state.inFlight.has(job.id) || state.jobs.includes(job)) {
        reject(new Error("local_agent_timeout"));
      }
    }, tMax);
  }).catch(async (err) => {
    state.stats.fallbackToCloud++;
    return { __fallback: true, value: await cloudFallback() };
  });

  if (result && result.__fallback) {
    return { result: result.value, provider: "cloud_fallback_timeout" };
  }
  return { result, provider: "pc_local" };
}

module.exports = {
  authToken,
  applyHeartbeat,
  isOnline,
  getStatus,
  claimNextJob,
  completeJob,
  enqueueJob,
  runWithLocalOrCloud,
  ONLINE_TIMEOUT_MS,
  SHARED_TOKEN_CONFIGURED: !!SHARED_TOKEN
};

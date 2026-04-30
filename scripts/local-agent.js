#!/usr/bin/env node
"use strict";

/**
 * local-agent.js — Agent que se ejecuta en el PC LOCAL de RUBEN COTON.
 *
 * Se conecta cada 30s al VPS:
 *   1. Heartbeat: "estoy vivo"
 *   2. Pide jobs pesados (generación email IA con Qwen 14B local, PDF)
 *   3. Sube resultados
 *
 * Uso:
 *   node scripts/local-agent.js
 *
 * Variables de entorno necesarias (cargar via .env.local-agent):
 *   VPS_BASE_URL=https://emailing.rubencoton.com
 *   LOCAL_AGENT_TOKEN=<el mismo token que tiene el VPS>
 *   OLLAMA_URL=http://localhost:11434       (default)
 *   OLLAMA_MODEL=qwen2.5:14b                (default)
 *   POLL_INTERVAL_MS=30000                  (default 30s)
 *
 * Para arrancar como servicio Windows:
 *   - Tarea Programada: "Al iniciar Windows" → ejecutar este script con node.
 *   - O usar nssm.exe para registrar como servicio.
 *   - Ver scripts/install-local-agent-windows.md
 *
 * Refactor 2026-04-25: parte de la arquitectura híbrida 3 capas.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

/* Cargar .env.local-agent si existe (formato KEY=VALUE) */
(function loadDotEnv() {
  const envFile = path.resolve(__dirname, "..", ".env.local-agent");
  if (!fs.existsSync(envFile)) return;
  try {
    const content = fs.readFileSync(envFile, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) return;
      const key = m[1];
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    });
  } catch (_e) { /* ignore */ }
})();

const VPS_BASE = (process.env.VPS_BASE_URL
  || "https://emailing.rubencoton.com").replace(/\/+$/, "");
const TOKEN = process.env.LOCAL_AGENT_TOKEN || "";
const OLLAMA_URL = (process.env.OLLAMA_URL
  || "http://localhost:11434").replace(/\/+$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:14b";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 30_000;
const VERSION = "1.0.0";

if (!TOKEN) {
  console.error("[FATAL] LOCAL_AGENT_TOKEN no configurado.");
  console.error("Crea archivo .env.local-agent en la raíz del proyecto con:");
  console.error("  VPS_BASE_URL=https://emailing.rubencoton.com");
  console.error("  LOCAL_AGENT_TOKEN=<token compartido con VPS>");
  process.exit(1);
}

/* fetch en Node 18+ es global. Compat para Node <18 con node-fetch. */
const _fetch = typeof fetch === "function"
  ? fetch
  : (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const log = (level, msg, extra) => {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}` + (extra ? " " + JSON.stringify(extra) : "");
  if (level === "ERROR") console.error(line);
  else console.log(line);
};

async function vpsRequest(method, pathSuffix, body) {
  const url = `${VPS_BASE}${pathSuffix}`;
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": `local-agent/${VERSION}`
    }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  opts.signal = ctrl.signal;
  try {
    const res = await _fetch(url, opts);
    clearTimeout(timer);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_e) { /* */ }
    return { status: res.status, ok: res.ok, body: json, raw: text };
  } catch (err) {
    clearTimeout(timer);
    return { status: 0, ok: false, error: err.message };
  }
}

async function ollamaCheckReady() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await _fetch(`${OLLAMA_URL}/api/tags`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { ready: false, reason: `tags_${res.status}` };
    const data = await res.json();
    const models = (data.models || []).map((m) => m.name);
    const has = models.some((m) => m.startsWith(OLLAMA_MODEL.split(":")[0]));
    return { ready: has, models, target: OLLAMA_MODEL };
  } catch (err) {
    return { ready: false, reason: err.message };
  }
}

async function ollamaGenerate({ system, prompt, jsonMode, maxTokens }) {
  const body = {
    model: OLLAMA_MODEL,
    stream: false,
    prompt: prompt,
    system: system || "",
    options: {
      num_predict: Number(maxTokens) || 1024,
      temperature: 0.7
    }
  };
  if (jsonMode) body.format = "json";

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 180_000);
  const res = await _fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: ctrl.signal
  });
  clearTimeout(t);
  if (!res.ok) {
    throw new Error(`ollama_${res.status}_${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  return { text: data.response || "", model: data.model, tokens: data.eval_count };
}

async function executeJob(job) {
  log("INFO", `Job recibido: ${job.id} kind=${job.kind}`);
  const t0 = Date.now();
  try {
    let result;
    switch (job.kind) {
      case "ai_generate": {
        result = await ollamaGenerate(job.payload || {});
        break;
      }
      default:
        throw new Error(`unsupported_kind_${job.kind}`);
    }
    const ms = Date.now() - t0;
    log("INFO", `Job ${job.id} completado en ${ms}ms`);
    await vpsRequest("POST", `/api/local-agent/jobs/${job.id}/complete`, { result });
  } catch (err) {
    log("ERROR", `Job ${job.id} falló: ${err.message}`);
    await vpsRequest("POST", `/api/local-agent/jobs/${job.id}/complete`, {
      error: err.message
    });
  }
}

let consecutiveFailures = 0;

async function tick() {
  /* 1) Verifica Ollama */
  const ollama = await ollamaCheckReady();

  /* 2) Heartbeat al VPS */
  const hbRes = await vpsRequest("POST", "/api/local-agent/heartbeat", {
    hostname: os.hostname(),
    version: VERSION,
    ollamaModel: OLLAMA_MODEL,
    ollamaReady: ollama.ready
  });

  if (!hbRes.ok) {
    consecutiveFailures++;
    if (consecutiveFailures % 10 === 1) {
      log("ERROR", `Heartbeat falla (status=${hbRes.status}): ${hbRes.error || hbRes.raw || ""}`);
    }
    return;
  }
  if (consecutiveFailures > 0) {
    log("INFO", `Heartbeat OK tras ${consecutiveFailures} fallos.`);
  }
  consecutiveFailures = 0;

  /* 3) Pide siguiente job */
  if (!ollama.ready) {
    /* Ollama no listo: heartbeat ya enviado, no hace falta pedir jobs. */
    return;
  }
  const jobRes = await vpsRequest("GET", "/api/local-agent/jobs/next");
  if (!jobRes.ok || !jobRes.body || !jobRes.body.job) return;
  await executeJob(jobRes.body.job);
}

async function main() {
  log("INFO", `=== LOCAL AGENT v${VERSION} arrancando ===`);
  log("INFO", `VPS: ${VPS_BASE}`);
  log("INFO", `Ollama: ${OLLAMA_URL} (modelo ${OLLAMA_MODEL})`);
  log("INFO", `Poll cada ${POLL_INTERVAL_MS}ms`);

  /* Primer tick inmediato */
  await tick().catch((e) => log("ERROR", "tick error: " + e.message));

  /* Loop infinito con setInterval */
  setInterval(() => {
    tick().catch((e) => log("ERROR", "tick error: " + e.message));
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  log("ERROR", "fatal: " + err.message);
  process.exit(1);
});

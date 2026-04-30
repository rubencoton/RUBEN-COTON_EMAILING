/**
 * aiRouter.js — Calco del brain_router.py de ARTES-BUHO_RAMON
 *
 * Cascada de 8 cerebros por potencia descendente con cooldowns automaticos:
 *   1. SambaNova DeepSeek-V3.2 (685B)
 *   2. Cerebras qwen-3 (235B)
 *   3. Mistral large (123B)
 *   4. OpenRouter gpt-oss-120b (120B)
 *   5. Groq llama-3.3-70b (70B)
 *   6. Gemini 2.5 Flash
 *   7. PC Local Ollama (Qwen 2.5 14B) via tunel
 *   (VPS Ollama eliminado)
 *
 * Cuando un provider devuelve 429 (rate limit), entra en cooldown automatico
 * y la cascada salta al siguiente. "Imposible tumbar el sistema."
 *
 * Env vars (identicas a Ramon):
 *   SAMBANOVA_API_KEY, SAMBANOVA_MODEL
 *   CEREBRAS_API_KEY, CEREBRAS_MODEL
 *   MISTRAL_API_KEY, MISTRAL_MODEL
 *   OPENROUTER_API_KEY, OPENROUTER_MODEL
 *   GROQ_API_KEY, GROQ_MODEL
 *   GEMINI_API_KEY, GEMINI_MODEL
 *   PC_OLLAMA_URL, PC_OLLAMA_MODEL
 *   OLLAMA_URL, OLLAMA_MODEL
 */

const env = (k, def = "") => (process.env[k] || def).toString().trim();

/* ─── Cooldowns (segundos) cuando un provider devuelve 429 ─── */
const COOLDOWN_S = {
  sambanova: 60, nvidia: 3600, cerebras: 60, mistral: 60,
  openrouter: 60, groq: 60, gemini: 300
};
const cooldowns = {}; // name -> timestamp fin
const inCooldown = (n) => (cooldowns[n] || 0) > Date.now();
const markCooldown = (n, s) => { cooldowns[n] = Date.now() + (s || COOLDOWN_S[n] || 60) * 1000; };
const cooldownsSnapshot = () => {
  const now = Date.now();
  const out = {};
  for (const [k, v] of Object.entries(cooldowns)) out[k] = Math.max(0, Math.round((v - now) / 100) / 10);
  return out;
};

/* ─── Stats ─── */
const stats = { sambanova:0, nvidia:0, cerebras:0, mistral:0, openrouter:0, groq:0, gemini:0, pc_local:0, failed:0 };

/* ─── HTTP helpers ─── */
const fetchWithTimeout = async (url, opts = {}, timeoutMs = 30000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
};

/**
 * Llamada OpenAI-compatible (SambaNova, Cerebras, Mistral, OpenRouter, Groq).
 * Retry 1 vez en errores de red; sin retry en errores HTTP (4xx/5xx).
 */
const openaiCompatCall = async (baseUrl, apiKey, model, { system, prompt, jsonMode, maxTokens = 2000, extraHeaders = {} }) => {
  const payload = {
    model,
    messages: [
      { role: "system", content: system || "Eres un asistente profesional en espanol." },
      { role: "user", content: prompt }
    ],
    max_tokens: maxTokens,
    temperature: 0.2
  };
  if (jsonMode) payload.response_format = { type: "json_object" };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(
        baseUrl.replace(/\/$/, "") + "/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...extraHeaders
          },
          body: JSON.stringify(payload)
        },
        30000
      );
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} ${(await res.text()).substring(0, 200)}`);
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      return (data.choices?.[0]?.message?.content || "").trim();
    } catch (err) {
      if (err.status) throw err; // error HTTP → no retry
      if (attempt === 0) { await new Promise(r => setTimeout(r, 500)); continue; }
      throw err;
    }
  }
};

const ollamaGenerate = async (url, model, { system, prompt, jsonMode, maxTokens = 2000 }) => {
  const payload = {
    model,
    stream: false,
    options: { temperature: 0.2, num_predict: maxTokens },
    messages: [
      { role: "system", content: system || "Eres un asistente profesional en espanol." },
      { role: "user", content: prompt }
    ]
  };
  if (jsonMode) payload.format = "json";
  const res = await fetchWithTimeout(
    url.replace(/\/$/, "") + "/api/chat",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    180000
  );
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return (data.message?.content || "").trim();
};

const ollamaAvailable = async (url) => {
  if (!url) return false;
  try {
    const r = await fetchWithTimeout(`${url.replace(/\/$/, "")}/api/tags`, {}, 3000);
    return r.ok;
  } catch (_) { return false; }
};

/* ─── Niveles 1-6: Cloud OpenAI-compat + Gemini ─── */
const gemini = {
  key: () => env("GEMINI_API_KEY"),
  model: () => env("GEMINI_MODEL", "gemini-2.5-flash"),
  available: () => Boolean(env("GEMINI_API_KEY")),
  call: async ({ system, prompt, jsonMode, maxTokens = 2000 }) => {
    const body = {
      systemInstruction: { parts: [{ text: system || "Eres un asistente profesional en espanol." }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: maxTokens,
        ...(jsonMode ? { responseMimeType: "application/json" } : {})
      }
    };
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${gemini.model()}:generateContent?key=${gemini.key()}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      60000
    );
    if (!res.ok) {
      const err = new Error(`Gemini ${res.status} ${(await res.text()).substring(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "").trim();
  }
};

const CLOUD_LEVELS = [
  {
    name: "sambanova", rank: 1, displayName: "SambaNova DeepSeek-V3.2 (685B)", power: 5,
    model: () => env("SAMBANOVA_MODEL", "DeepSeek-V3.2"),
    available: () => Boolean(env("SAMBANOVA_API_KEY")),
    call: (p) => openaiCompatCall("https://api.sambanova.ai/v1", env("SAMBANOVA_API_KEY"), env("SAMBANOVA_MODEL", "DeepSeek-V3.2"), p)
  },
  {
    name: "nvidia", rank: 2, displayName: "NVIDIA NIM llama-3.1 (405B)", power: 5,
    model: () => env("NVIDIA_MODEL", "meta/llama-3.1-405b-instruct"),
    available: () => Boolean(env("NVIDIA_API_KEY")),
    call: (p) => openaiCompatCall("https://integrate.api.nvidia.com/v1", env("NVIDIA_API_KEY"), env("NVIDIA_MODEL", "meta/llama-3.1-405b-instruct"), p)
  },
  {
    name: "cerebras", rank: 3, displayName: "Cerebras qwen-3-235b", power: 5,
    model: () => env("CEREBRAS_MODEL", "qwen-3-235b-a22b-instruct-2507"),
    available: () => Boolean(env("CEREBRAS_API_KEY")),
    call: (p) => openaiCompatCall("https://api.cerebras.ai/v1", env("CEREBRAS_API_KEY"), env("CEREBRAS_MODEL", "qwen-3-235b-a22b-instruct-2507"), p)
  },
  {
    name: "mistral", rank: 4, displayName: "Mistral large (123B)", power: 4,
    model: () => env("MISTRAL_MODEL", "mistral-large-latest"),
    available: () => Boolean(env("MISTRAL_API_KEY")),
    call: (p) => openaiCompatCall("https://api.mistral.ai/v1", env("MISTRAL_API_KEY"), env("MISTRAL_MODEL", "mistral-large-latest"), p)
  },
  {
    name: "openrouter", rank: 5, displayName: "OpenRouter gpt-oss-120b", power: 4,
    model: () => env("OPENROUTER_MODEL", "openai/gpt-oss-120b:free"),
    available: () => Boolean(env("OPENROUTER_API_KEY")),
    call: (p) => openaiCompatCall("https://openrouter.ai/api/v1", env("OPENROUTER_API_KEY"), env("OPENROUTER_MODEL", "openai/gpt-oss-120b:free"), p,
      { extraHeaders: { "HTTP-Referer": "https://emailing.rubencoton.com", "X-Title": "RUBEN COTON Emailing" } })
  },
  {
    name: "groq", rank: 6, displayName: "Groq llama-3.3-70b", power: 3,
    model: () => env("GROQ_MODEL", "llama-3.3-70b-versatile"),
    available: () => Boolean(env("GROQ_API_KEY")),
    call: (p) => openaiCompatCall("https://api.groq.com/openai/v1", env("GROQ_API_KEY"), env("GROQ_MODEL", "llama-3.3-70b-versatile"), p)
  },
  {
    name: "gemini", rank: 7, displayName: "Gemini 2.5 Flash", power: 3,
    model: () => gemini.model(),
    available: () => gemini.available(),
    call: gemini.call
  }
];

/* ─── Routing por TIER (calco de Ramon) ───
 *
 * Cada tier define el orden preferido de providers (cloud) para esa intensidad.
 * Si todos los del tier fallan/cooldown → fallback cascada completa por potencia.
 */
const TIERS = {
  trivial: ["groq", "mistral", "openrouter", "gemini"],
  normal:  ["groq", "mistral", "openrouter", "cerebras", "gemini"],
  alta:    ["cerebras", "nvidia", "mistral", "openrouter", "gemini"],
  critica: ["sambanova", "nvidia", "cerebras", "mistral"]
};

/* Clasificacion heuristica por palabras clave del prompt del usuario */
const classifyTier = (userPrompt = "") => {
  const p = userPrompt.toLowerCase();
  const has = (arr) => arr.some((kw) => p.includes(kw));
  if (has(["contrato", "firma digital", "factura alta", "negocia", "legal",
          "riesgo ", "cachet fuera", "exclusividad", "abogado"])) return "critica";
  if (has(["redacta ", "propuesta", "analiza ", "planifica", "estrategia",
          "resume el contrato", "revisa rider", "presupuesto completo",
          "email completo", "campana masiva"])) return "alta";
  if (userPrompt.length < 200 && has(["clasifica", "etiqueta", "si o no",
      "responde solo", "extrae el", "confirma si ", "devuelve un json",
      "spam", "archivar"])) return "trivial";
  return "normal";
};

/* Lookup rapido por nombre */
const providerByName = (name) => CLOUD_LEVELS.find((l) => l.name === name);

/* Intenta providers en un orden dado. Devuelve {text, provider} o null */
const tryProviders = async (names, { system, prompt, jsonMode, maxTokens }) => {
  for (const name of names) {
    const lvl = providerByName(name);
    if (!lvl || !lvl.available() || inCooldown(name)) continue;
    try {
      const text = await lvl.call({ system, prompt, jsonMode, maxTokens });
      if (text) { stats[name]++; return { text, provider: name, providerName: lvl.displayName }; }
    } catch (err) {
      if (err.status === 429 || err.status === 403) markCooldown(name);
    }
  }
  return null;
};

/* ─── Router principal ─── */
const chat = async (prompt, opts = {}) => {
  const { system, jsonMode = false, maxTokens = 2000, minPower = 1 } = opts;
  let { tier } = opts;
  const errors = [];

  /* 1. Tier-based routing (si aplica) */
  if (tier === undefined) tier = classifyTier(prompt);
  if (tier && TIERS[tier]) {
    const r = await tryProviders(TIERS[tier], { system, prompt, jsonMode, maxTokens });
    if (r) return { ...r, tier };
  }

  /* 2. Fallback: cascada completa por potencia (ultima red de seguridad) */
  for (const lvl of CLOUD_LEVELS) {
    if (lvl.power < minPower) continue;
    if (!lvl.available()) continue;
    if (inCooldown(lvl.name)) continue;
    try {
      const text = await lvl.call({ system, prompt, jsonMode, maxTokens });
      if (text) {
        stats[lvl.name]++;
        return { text, provider: lvl.name, providerName: lvl.displayName, tier: "fallback" };
      }
    } catch (err) {
      errors.push(`${lvl.name}:${err.message}`);
      if (err.status === 429 || err.status === 403) markCooldown(lvl.name);
    }
  }

  /* Nivel 7: PC local */
  const pcUrl = env("PC_OLLAMA_URL");
  if (pcUrl && (await ollamaAvailable(pcUrl))) {
    try {
      const text = await ollamaGenerate(pcUrl, env("PC_OLLAMA_MODEL", "qwen2.5:14b"), { system, prompt, jsonMode, maxTokens });
      if (text) { stats.pc_local++; return { text, provider: "pc_local", providerName: "PC Local (Qwen 2.5 14B)" }; }
    } catch (err) { errors.push(`pc_local:${err.message}`); }
  }

  /* VPS Ollama ELIMINADO: proveedor retirado de la cascada */

  stats.failed++;
  throw new Error(`Todos los cerebros fallaron: ${errors.join(" | ") || "ninguno configurado"}`);
};

const classifyJson = async (prompt, opts = {}) => {
  const r = await chat(prompt, { ...opts, jsonMode: true });
  let parsed = null;
  try { parsed = JSON.parse(r.text); }
  catch (_) {
    const s = r.text.indexOf("{"); const e = r.text.lastIndexOf("}");
    if (s >= 0 && e > s) { try { parsed = JSON.parse(r.text.slice(s, e + 1)); } catch (_) {} }
  }
  return { ...r, json: parsed || { _raw: r.text.slice(0, 500) } };
};

const getStatus = async () => {
  const cds = cooldownsSnapshot();
  const providers = CLOUD_LEVELS.map((lvl) => ({
    name: lvl.name,
    rank: lvl.rank,
    displayName: lvl.displayName,
    power: lvl.power,
    model: lvl.model(),
    configured: lvl.available(),
    cooldown_s: cds[lvl.name] || 0
  }));

  const pcUrl = env("PC_OLLAMA_URL");
  const pcUp = pcUrl ? await ollamaAvailable(pcUrl) : false;
  providers.push({
    name: "pc_local", rank: 8, displayName: "PC Local (Qwen 2.5 14B)", power: 3,
    url: pcUrl || "(sin configurar)", model: env("PC_OLLAMA_MODEL", "qwen2.5:14b"),
    configured: Boolean(pcUrl), available: pcUp
  });

  /* VPS Ollama ELIMINADO: ya no se expone en el estado */

  return { providers, cooldowns: cds, stats };
};

const refreshStatus = getStatus;

module.exports = { chat, classifyJson, getStatus, refreshStatus, classifyTier, TIERS };

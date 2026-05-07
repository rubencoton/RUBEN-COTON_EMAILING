"use strict";

/**
 * spamShield.js — Blindaje anti-spam para RUBEN COTON Emailing.
 *
 * Centraliza validaciones para que ningun email salga en condiciones
 * que disparen filtros de Gmail/Outlook/Yahoo.
 *
 *   validateSubject(subject) -> { ok, warnings, errors, score }
 *   validateContent(html, text) -> { ok, warnings, errors, score, ratio }
 *   buildAntiSpamHeaders(base) -> headers con Precedence, Auto-Submitted, etc.
 *   getWarmupCap(envelopedAt) -> numero de envios permitidos hoy
 *   shouldAutoPause(stats) -> { pause, reason }
 *   checkDnsHealth(domain) -> { spf, dkim, dmarc }  (async)
 */

const dns = require("dns").promises;

/* ---------------------------------------------------------------- *
 * 1) SUBJECT
 * ---------------------------------------------------------------- */

const SPAM_WORDS_HARD = [
  /* Disparan filtro al instante. Bloquear envio. */
  "viagra", "casino online", "lottery", "winner!!!", "click here now",
  "100% free", "100% gratis", "ganadores", "millones de euros",
  "dinero facil", "oportunidad unica", "trabajo desde casa"
];

const SPAM_WORDS_SOFT = [
  /* Suben score pero no bloquean. Aviso. */
  "gratis", "free", "oferta", "descuento", "promocion", "promo",
  "urgente", "ultima hora", "no te lo pierdas", "garantizado",
  "click aqui", "haz click", "actua ya", "limitado", "rebaja",
  "barato", "ganga", "dinero", "ingresos", "recompensa"
];

const validateSubject = (subject) => {
  const errors = [];
  const warnings = [];
  let score = 0;
  const s = String(subject || "").trim();

  if (!s) {
    errors.push("Asunto vacio.");
    return { ok: false, errors, warnings, score: 100 };
  }

  if (s.length > 78) {
    warnings.push(`Asunto largo (${s.length} chars). Recomendado <= 70.`);
    score += 10;
  }
  if (s.length < 10) {
    warnings.push("Asunto demasiado corto (<10 chars), poco descriptivo.");
    score += 5;
  }

  /* TODO MAYUSCULAS */
  const letters = s.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  if (letters.length >= 6 && letters === letters.toUpperCase()) {
    warnings.push("Asunto en MAYUSCULAS — los filtros lo penalizan.");
    score += 25;
  }

  /* Exclamaciones / interrogantes excesivos */
  const exclam = (s.match(/[!¡]/g) || []).length;
  if (exclam >= 2) {
    warnings.push(`${exclam} signos de exclamacion — usa maximo 1.`);
    score += 15 * exclam;
  }
  const interro = (s.match(/[?¿]/g) || []).length;
  if (interro >= 3) {
    warnings.push(`${interro} interrogantes — reduce a 1.`);
    score += 10;
  }

  /* Simbolos $ % € */
  const symbols = (s.match(/[$%€£¥]/g) || []).length;
  if (symbols >= 2) {
    warnings.push("Multiples simbolos de moneda/porcentaje.");
    score += 15;
  }

  /* Palabras spam */
  const lower = s.toLowerCase();
  const hits_hard = SPAM_WORDS_HARD.filter((w) => lower.includes(w));
  if (hits_hard.length) {
    errors.push(`Palabras prohibidas: ${hits_hard.join(", ")}`);
    score += 80;
  }
  const hits_soft = SPAM_WORDS_SOFT.filter((w) => lower.includes(w));
  if (hits_soft.length) {
    warnings.push(`Palabras spam-soft: ${hits_soft.join(", ")}`);
    score += 8 * hits_soft.length;
  }

  /* Emojis */
  const emojis = (s.match(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu) || []).length;
  if (emojis >= 2) {
    warnings.push(`${emojis} emojis — usa maximo 1.`);
    score += 8;
  }

  /* RE: / FW: falsificado */
  if (/^(RE:|FW:|FWD:)/i.test(s)) {
    warnings.push("Asunto simula respuesta/reenvio (RE: / FW:). Engañoso.");
    score += 20;
  }

  return {
    ok: errors.length === 0 && score < 50,
    errors,
    warnings,
    score: Math.min(100, score)
  };
};

/* ---------------------------------------------------------------- *
 * 2) CONTENIDO (HTML + TEXT)
 * ---------------------------------------------------------------- */

const stripTags = (html) => String(html || "")
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const SUSPICIOUS_LINK_HOSTS = [
  "bit.ly", "tinyurl.com", "goo.gl", "ow.ly", "t.co", "is.gd",
  "buff.ly", "cli.gs", "tiny.cc", "lnkd.in"
];

const validateContent = (html, text) => {
  const errors = [];
  const warnings = [];
  let score = 0;

  const htmlStr = String(html || "");
  const textStr = String(text || "");

  if (!htmlStr.trim()) {
    errors.push("HTML vacio.");
    return { ok: false, errors, warnings, score: 100, ratio: 0 };
  }

  if (!textStr.trim()) {
    warnings.push("Falta version texto plano. Gmail penaliza emails sin alternativa text/plain.");
    score += 15;
  }

  /* Tamaño del HTML */
  const htmlBytes = Buffer.byteLength(htmlStr, "utf-8");
  if (htmlBytes > 102400) {
    warnings.push(`HTML grande (${Math.round(htmlBytes / 1024)} KB) — Gmail recorta a 102 KB.`);
    score += 10;
  }

  /* Imagenes vs texto */
  const imgs = (htmlStr.match(/<img\b/gi) || []).length;
  const textOnly = stripTags(htmlStr);
  const textLen = textOnly.length;

  if (imgs >= 1 && textLen < 200) {
    warnings.push("Email con poco texto y muchas imagenes — clasificador bayesiano lo marca.");
    score += 25;
  }
  const ratio = imgs > 0 ? textLen / (imgs * 200) : 1;

  /* Imagenes inline base64 (peso desmesurado) */
  if (/<img[^>]+src=["']data:image/i.test(htmlStr)) {
    warnings.push("Imagenes inline base64 detectadas — duplican el peso. Mejor URL externa.");
    score += 20;
  }

  /* Imagenes sin alt */
  const imgsSinAlt = (htmlStr.match(/<img(?![^>]*\balt=)[^>]*>/gi) || []).length;
  if (imgsSinAlt > 0) {
    warnings.push(`${imgsSinAlt} imagenes sin atributo alt.`);
    score += 5 * imgsSinAlt;
  }

  /* Links: shorteners.
   * P0 FIX 2026-05-07: usar matchAll en lugar de regex.exec con /g.
   * El regex global mantiene lastIndex mutable; si validateContent se
   * llama concurrentemente (varios jobs paralelos), corrupción del
   * estado del regex compartido en módulo. matchAll crea iterator nuevo. */
  const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  const links = Array.from(htmlStr.matchAll(linkRegex), (m) => m[1]);
  const shortenerHits = links.filter((url) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return SUSPICIOUS_LINK_HOSTS.includes(host);
    } catch (_e) { return false; }
  });
  if (shortenerHits.length) {
    warnings.push(`URLs acortadas (${shortenerHits.length}): ${shortenerHits[0]}`);
    score += 25;
  }

  /* Links http (no https) */
  const httpLinks = links.filter((url) => url.startsWith("http://"));
  if (httpLinks.length) {
    warnings.push(`${httpLinks.length} links http:// (deberian ser https://).`);
    score += 5 * httpLinks.length;
  }

  /* Links a IPs en vez de dominios */
  const ipLinks = links.filter((url) => /^https?:\/\/\d+\.\d+\.\d+\.\d+/.test(url));
  if (ipLinks.length) {
    errors.push(`Links a IP (${ipLinks[0]}) — los filtros bloquean.`);
    score += 40;
  }

  /* JavaScript / handlers peligrosos */
  if (/\bon(click|load|error|mouseover)\s*=/i.test(htmlStr)) {
    errors.push("Atributos JS (onclick/onload) — bloqueados por todos los webmails.");
    score += 50;
  }
  if (/<script\b/i.test(htmlStr)) {
    errors.push("<script> en email — bloqueado.");
    score += 60;
  }
  if (/javascript:/i.test(htmlStr)) {
    errors.push("URL javascript: — bloqueada.");
    score += 50;
  }

  /* Forms */
  if (/<form\b/i.test(htmlStr)) {
    warnings.push("<form> en email — pocos clientes lo soportan.");
    score += 15;
  }

  /* iframe */
  if (/<iframe\b/i.test(htmlStr)) {
    errors.push("<iframe> en email — bloqueado por seguridad.");
    score += 50;
  }

  /* CSS posicionamiento absoluto */
  if (/position:\s*(absolute|fixed)/i.test(htmlStr)) {
    warnings.push("CSS position:absolute — Outlook lo ignora.");
    score += 5;
  }

  /* Texto blanco sobre blanco (truco spam).
   * P0 FIX 2026-05-05: la regla anterior daba falso positivo en cualquier
   * email con texto blanco en footer negro Y fondo blanco en secciones de
   * contenido (legitimo). Ahora exige que ambos estilos esten en la MISMA
   * declaracion CSS inline (mismo elemento o style block proximo, ventana
   * de 80 caracteres). Solo asi es realmente texto invisible spam. */
  const whiteOnWhitePattern = /style\s*=\s*["'][^"']{0,80}color:\s*#?fff(fff)?[^a-f0-9][^"']{0,80}background(-color)?:\s*#?fff(fff)?[^a-f0-9][^"']*["']/i;
  const whiteOnWhitePatternRev = /style\s*=\s*["'][^"']{0,80}background(-color)?:\s*#?fff(fff)?[^a-f0-9][^"']{0,80}color:\s*#?fff(fff)?[^a-f0-9][^"']*["']/i;
  if (whiteOnWhitePattern.test(htmlStr) || whiteOnWhitePatternRev.test(htmlStr)) {
    errors.push("Texto invisible: blanco sobre fondo blanco en el mismo elemento.");
    score += 60;
  }

  /* Falta unsubscribe visible */
  if (!/(unsubscribe|darse de baja|baja|cancelar)/i.test(textOnly)) {
    warnings.push("Sin enlace visible de baja en el texto.");
    score += 10;
  }

  /* Palabras spam-soft en cuerpo */
  const lower = textOnly.toLowerCase();
  const hits_soft = SPAM_WORDS_SOFT.filter((w) => lower.includes(w));
  if (hits_soft.length >= 3) {
    warnings.push(`Muchas palabras spam-soft en el cuerpo (${hits_soft.length}).`);
    score += 5 * hits_soft.length;
  }

  return {
    ok: errors.length === 0 && score < 60,
    errors,
    warnings,
    score: Math.min(100, score),
    ratio: Math.round(ratio * 100) / 100,
    stats: { htmlBytes, imgs, textLen, links: links.length }
  };
};

/* ---------------------------------------------------------------- *
 * 3) HEADERS RFC anti-spam
 * ---------------------------------------------------------------- */

const buildAntiSpamHeaders = (base = {}) => ({
  ...base,
  /* RFC 3834 — indica que es generado automaticamente, no respuesta humana. */
  "Auto-Submitted": "auto-generated",
  /* RFC 2076 — bulk = newsletter / marketing.  Reduce respuestas automaticas. */
  "Precedence": "bulk",
  /* Microsoft/Outlook — suprime auto-respuestas (out-of-office, vacation). */
  "X-Auto-Response-Suppress": "All",
  /* Marketing identifier interno. */
  "X-Mailer": base["X-Mailer"] || "RUBEN-COTON_EMAILING",
  /* Importance no-spam. */
  "X-Priority": "3",
  "Importance": "Normal"
});

/* ---------------------------------------------------------------- *
 * 4) WARMUP gradual (anti-flag por dominio nuevo)
 * ---------------------------------------------------------------- */

const WARMUP_PLAN = [
  /* dia, cap */
  [1, 50],
  [2, 100],
  [3, 200],
  [4, 400],
  [5, 700],
  [6, 1100],
  [7, 1500]
];

const getWarmupCap = (firstSendIso, todayCap = 1500) => {
  if (!firstSendIso) return todayCap;
  const start = new Date(firstSendIso);
  const now = new Date();
  const days = Math.floor((now - start) / (24 * 60 * 60 * 1000)) + 1;
  for (const [d, cap] of WARMUP_PLAN) {
    if (days <= d) return Math.min(cap, todayCap);
  }
  return todayCap;
};

/* ---------------------------------------------------------------- *
 * 5) AUTO-PAUSE por metricas
 * ---------------------------------------------------------------- */

const shouldAutoPause = (stats = {}) => {
  const sent = Number(stats.sent || 0);
  if (sent < 50) return { pause: false, reason: null };

  const bounced = Number(stats.bounced || 0);
  const complained = Number(stats.complained || 0);
  const bounceRate = bounced / sent;
  const complaintRate = complained / sent;

  if (bounceRate > 0.05) {
    return {
      pause: true,
      reason: `Bounce rate ${(bounceRate * 100).toFixed(1)}% > 5% (limite). Revisa lista.`
    };
  }
  if (complaintRate > 0.001) {
    return {
      pause: true,
      reason: `Complaint rate ${(complaintRate * 100).toFixed(2)}% > 0.1% (limite). Revisa contenido.`
    };
  }
  return { pause: false, reason: null };
};

/* ---------------------------------------------------------------- *
 * 6) DNS HEALTH CHECK
 * ---------------------------------------------------------------- */

const checkDnsHealth = async (domain) => {
  const out = {
    domain,
    spf: { ok: false, record: null, error: null },
    dkim: { ok: false, selector: null, record: null, error: null },
    dmarc: { ok: false, record: null, policy: null, error: null }
  };

  /* SPF */
  try {
    const txts = await dns.resolveTxt(domain);
    const flat = txts.map((arr) => arr.join(""));
    const spf = flat.find((r) => r.startsWith("v=spf1"));
    if (spf) {
      out.spf.ok = true;
      out.spf.record = spf;
    }
  } catch (e) { out.spf.error = e.code || e.message; }

  /* DMARC */
  try {
    const txts = await dns.resolveTxt(`_dmarc.${domain}`);
    const flat = txts.map((arr) => arr.join(""));
    const dmarc = flat.find((r) => r.startsWith("v=DMARC1"));
    if (dmarc) {
      out.dmarc.ok = true;
      out.dmarc.record = dmarc;
      const m = dmarc.match(/p=([a-z]+)/i);
      out.dmarc.policy = m ? m[1].toLowerCase() : null;
    }
  } catch (e) { out.dmarc.error = e.code || e.message; }

  /* DKIM Workspace (selector google) */
  try {
    const txts = await dns.resolveTxt(`google._domainkey.${domain}`);
    const flat = txts.map((arr) => arr.join(""));
    const dkim = flat.find((r) => r.includes("v=DKIM1"));
    if (dkim) {
      out.dkim.ok = true;
      out.dkim.selector = "google";
      out.dkim.record = dkim.slice(0, 80) + "...";
    }
  } catch (e) { out.dkim.error = e.code || e.message; }

  return out;
};

module.exports = {
  validateSubject,
  validateContent,
  buildAntiSpamHeaders,
  getWarmupCap,
  shouldAutoPause,
  checkDnsHealth,
  SPAM_WORDS_HARD,
  SPAM_WORDS_SOFT,
  WARMUP_PLAN
};

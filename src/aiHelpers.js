/**
 * aiHelpers.js — Helpers semanticos sobre aiRouter.
 *
 * Cada funcion mapea una accion concreta de la app a un tier apropiado,
 * para ser EFICIENTES con las cuotas.
 *
 * ESTUDIO DE TIERS POR ACCION (calco del pensamiento de RAMON):
 *
 *   TRIVIAL (~100-300 tokens, cerebros pequenos/rapidos):
 *     - detectSpam: ¿este asunto es spam?
 *     - extractEmail: extraer email de un texto libre
 *     - classifyIntent: intencion de la respuesta (interesado/no/pregunta)
 *     - tagContact: sugerir etiquetas a partir de empresa/cargo
 *     - yesNo: decision si/no sobre contenido
 *
 *   NORMAL (~300-600 tokens, cerebros medianos):
 *     - generateSubject: asunto de email (<70 chars)
 *     - summarizeReply: resumen de respuesta del cliente
 *     - personalizeGreeting: saludo adaptado al destinatario
 *     - translate: traduccion breve
 *
 *   ALTA (~600-1200 tokens, cerebros grandes):
 *     - generateEmail: cuerpo completo de email
 *     - optimizeCopy: mejorar copy para mayor conversion
 *     - generateFollowUp: secuencia de 2-3 emails de seguimiento
 *     - analyzeCampaign: analisis de metricas y sugerencias
 *
 *   CRITICA (~1500-2500 tokens, cerebros top):
 *     - draftProposal: propuesta comercial formal
 *     - negotiationReply: respuesta delicada a negociacion
 *     - reviewContract: revision de clausulas
 *     - complaintReply: respuesta a queja importante
 *
 * POLITICA DE CUOTAS (objetivo: NUNCA quedarse sin IA):
 *   - Las acciones TRIVIAL usan Groq/Gemini primero (cuota mas alta)
 *   - Reservamos SambaNova/NVIDIA para CRITICA (cuota mas baja)
 *   - 7 cerebros configurados = tolerancia a 6 caidas simultaneas
 */

const aiRouter = require("./aiRouter");

/* ─── Helpers TRIVIAL ─── */

/** ¿Un asunto de email parece spam? Devuelve {isSpam, reason}. */
const detectSpam = async (subject) => {
  const system = "Responde SOLO con JSON: {\"isSpam\":true|false,\"reason\":\"breve\"}. Nada mas.";
  const r = await aiRouter.classifyJson(
    `Clasifica si este asunto de email es spam: "${subject}"`,
    { system, tier: "trivial", maxTokens: 150 }
  );
  return { ...r.json, provider: r.provider };
};

/** Extrae email valido del texto libre. Devuelve string o null. */
const extractEmail = async (text) => {
  const system = "Extrae solo la direccion email del texto. Responde SOLO el email, sin comillas ni explicacion. Si no hay, responde NONE.";
  const r = await aiRouter.chat(
    `Texto: """${text.substring(0, 500)}"""`,
    { system, tier: "trivial", maxTokens: 100 }
  );
  const match = r.text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return match ? match[0] : null;
};

/** Clasifica intencion de respuesta de un contacto. */
const classifyIntent = async (replyText) => {
  const system = "Responde SOLO con JSON: {\"intent\":\"interesado|no_interesado|pregunta|baja|spam|otro\",\"confidence\":0-1}.";
  const r = await aiRouter.classifyJson(
    `Respuesta del cliente: """${replyText.substring(0, 1000)}"""`,
    { system, tier: "trivial", maxTokens: 150 }
  );
  return { ...r.json, provider: r.provider };
};

/* ─── Helpers NORMAL ─── */

/** Genera asunto de email optimo (max 70 chars). */
const generateSubject = async ({ audience, objective, keyword }) => {
  const system = "Eres experto en email marketing. Genera asunto max 70 chars, sin emojis, sin palabras spam (gratis/urgente/oferta). Responde SOLO el asunto, sin comillas.";
  const prompt = `Audiencia: ${audience}\nObjetivo: ${objective}\n${keyword ? `Palabra clave: ${keyword}` : ""}`;
  const r = await aiRouter.chat(prompt, { system, tier: "normal", maxTokens: 100 });
  return { subject: r.text.replace(/^["']|["']$/g, "").trim(), provider: r.provider };
};

/** Resume una respuesta de cliente en 1-2 frases. */
const summarizeReply = async (replyText) => {
  const system = "Resume en 1-2 frases el mensaje del cliente en espanol.";
  const r = await aiRouter.chat(
    replyText.substring(0, 2000),
    { system, tier: "normal", maxTokens: 200 }
  );
  return { summary: r.text, provider: r.provider };
};

/* ─── Helpers ALTA ─── */

/** Genera email completo (subject + intro + body + cta). */
const generateEmail = async ({ audience, objective, offer, tone = "profesional cercano" }) => {
  const system = `Eres copywriter senior de email marketing para ARTES BUHO MANAGEMENT
(booking & management de artistas). Castellano de Espana con tildes y n.
Responde SOLO JSON valido: {"subject":"max 70 chars","intro":"2 frases","body":"4-6 frases","cta":"1 llamada accion hacia booking@artesbuhomanagement.com"}.
Sin emojis, sin palabras spam (gratis/urgente/oferta).`;
  const prompt = `AUDIENCIA: ${audience}\nOBJETIVO: ${objective}\n${offer ? `OFERTA: ${offer}\n` : ""}TONO: ${tone}`;
  const r = await aiRouter.classifyJson(prompt, { system, tier: "alta", maxTokens: 800 });
  return { email: r.json, provider: r.provider, providerName: r.providerName, tier: r.tier };
};

/** Optimiza copy existente para mayor conversion. */
const optimizeCopy = async ({ original, goal = "aumentar clics" }) => {
  const system = "Eres copywriter senior. Mejora el texto manteniendo la idea, pero mas persuasivo. Responde SOLO el nuevo texto.";
  const r = await aiRouter.chat(
    `Objetivo: ${goal}\n\nTexto original:\n${original}`,
    { system, tier: "alta", maxTokens: 800 }
  );
  return { optimized: r.text, provider: r.provider };
};

/* ─── Helpers CRITICA ─── */

/** Redacta propuesta comercial formal para un cliente exigente. */
const draftProposal = async ({ client, service, price, context = "" }) => {
  const system = `Eres director comercial senior de ARTES BUHO MANAGEMENT. Redacta propuesta formal en espanol, tono profesional alto, cerrador. Incluye introduccion, descripcion servicio, precio, condiciones, call to action.`;
  const prompt = `CLIENTE: ${client}\nSERVICIO: ${service}\nPRECIO: ${price}\n${context ? `CONTEXTO: ${context}` : ""}`;
  const r = await aiRouter.chat(prompt, { system, tier: "critica", maxTokens: 2000 });
  return { proposal: r.text, provider: r.provider, tier: r.tier };
};

/** Responde a una queja delicada de cliente. */
const complaintReply = async ({ complaint, context = "" }) => {
  const system = `Eres director de atencion al cliente de ARTES BUHO. Redacta respuesta empatica, profesional, que resuelva la queja sin comprometer a la empresa. Nunca admitas culpa explicita. Castellano cuidado.`;
  const prompt = `QUEJA DEL CLIENTE:\n${complaint}\n${context ? `\nCONTEXTO INTERNO:\n${context}` : ""}`;
  const r = await aiRouter.chat(prompt, { system, tier: "critica", maxTokens: 1500 });
  return { reply: r.text, provider: r.provider, tier: r.tier };
};

module.exports = {
  /* TRIVIAL */
  detectSpam,
  extractEmail,
  classifyIntent,
  /* NORMAL */
  generateSubject,
  summarizeReply,
  /* ALTA */
  generateEmail,
  optimizeCopy,
  /* CRITICA */
  draftProposal,
  complaintReply
};

/**
 * emailBuilder.js — Integracion del proyecto RUBEN-COTON_HTML.
 *
 * Genera emails HTML profesionales usando la cascada de IA (aiRouter)
 * en vez de Ollama directo. Eficiente en tokens: usa tier "alta".
 *
 * Entrada:
 *   { audience, objective, offer, photoUrl, videoId, tone }
 *
 * Salida:
 *   { subject, html, text, provider, providerName }
 */

const aiRouter = require("./aiRouter");

const LOGO_COMPLETO_URL = "https://lh3.googleusercontent.com/d/1yvary28jzeD8nQyul9iSYqFPXKTn9Hyw=w240";
const LOGO_SENCILLO_URL = "https://lh3.googleusercontent.com/d/16UZKQnCW0J9qqd9yLZ9t4jukrp3p9hcj=w160";

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const markdownToHtml = (s) => String(s || "").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

/* Plantilla HTML email RUBEN COTON (header negro + barra roja + footer) */
const buildHtml = ({ asunto, saludo, intro, body, cta, photoUrl, videoId, unsubUrl }) => {
  const videoBlock = videoId ? `
    <tr><td style="padding:0 40px 24px;text-align:center">
      <a href="https://www.youtube.com/watch?v=${esc(videoId)}" target="_blank" style="display:inline-block;position:relative">
        <img src="https://img.youtube.com/vi/${esc(videoId)}/maxresdefault.jpg" width="520" alt="Video" style="display:block;border-radius:8px;max-width:100%;border:0">
      </a>
    </td></tr>` : "";
  const photoBlock = photoUrl ? `
    <tr><td style="padding:0"><img src="${esc(photoUrl)}" width="600" alt="" style="display:block;width:100%;max-width:600px;border:0"></td></tr>` : "";

  const whatsapp = "https://wa.me/34613009336?text=" + encodeURIComponent("Hola, me interesa " + (asunto || ""));
  const replyMailto = "mailto:manager@rubencoton.com?subject=" + encodeURIComponent("Re: " + (asunto || ""));

  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(asunto)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">${esc((intro || "").substring(0, 120))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4">
  <tr><td align="center" style="padding:20px 0">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden">
      <tr><td style="background:#1a1a1a;padding:24px 40px 18px;text-align:center">
        <img src="${LOGO_COMPLETO_URL}" width="90" alt="RUBEN COTON" style="display:block;margin:0 auto 8px;border:0">
        <h1 style="margin:4px 0 2px;color:#fff;font-size:22px;font-weight:bold;letter-spacing:4px">RUBEN COTON</h1>
        <p style="margin:0;color:#FFB74D;font-size:11px;letter-spacing:5px;text-transform:uppercase;font-weight:700">Management</p>
      </td></tr>
      <tr><td style="height:3px;background:#FF6B00"></td></tr>
      ${photoBlock}
      <tr><td style="padding:40px">
        <p style="margin:0 0 16px;color:#333;font-size:16px">${esc(saludo || "Hola")},</p>
        <p style="margin:0 0 16px;color:#555;font-size:15px;line-height:1.6">${markdownToHtml(esc(intro))}</p>
        <p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.6">${markdownToHtml(esc(body))}</p>
        ${videoBlock}
        <p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.6">${markdownToHtml(esc(cta))}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 10px">
          <tr>
            <td style="background:#25D366;border-radius:6px;padding:0">
              <a href="${esc(whatsapp)}" target="_blank" style="display:inline-block;padding:12px 22px;color:#fff;text-decoration:none;font-weight:bold;font-size:14px">💬 WhatsApp</a>
            </td>
            <td style="width:10px"></td>
            <td style="background:#FF6B00;border-radius:6px;padding:0">
              <a href="${esc(replyMailto)}" style="display:inline-block;padding:12px 22px;color:#fff;text-decoration:none;font-weight:bold;font-size:14px">✉ Responder</a>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0;color:#888;font-size:12px;text-align:center">+34 613 00 93 36</p>
      </td></tr>
      <tr><td style="background:#1a1a1a;padding:20px 40px;text-align:center">
        <p style="margin:0 0 6px;color:#fff;font-size:13px;font-weight:700;letter-spacing:2px">RUBEN COTON</p>
        <p style="margin:0 0 8px;color:#aaa;font-size:11px">Booking &amp; Management de Artistas</p>
        <p style="margin:0 0 6px;font-size:11px"><a href="mailto:manager@rubencoton.com" style="color:#FFB74D;text-decoration:none">manager@rubencoton.com</a></p>
        ${unsubUrl ? `<p style="margin:0;font-size:10px"><a href="${esc(unsubUrl)}" style="color:#777;text-decoration:underline">Darse de baja</a></p>` : ""}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
};

/**
 * Genera email completo con IA cascada.
 * System prompt experto adaptado del proyecto RUBEN-COTON_HTML.
 * @param {object} opts - { audience, objective, offer, photoUrl, videoId, tone }
 * @returns {Promise<{subject, html, text, provider, providerName}>}
 */
const generateEmail = async (opts = {}) => {
  const { audience, objective, offer = "", photoUrl, videoId, tone = "profesional cercano" } = opts;
  if (!audience || !objective) throw new Error("Faltan audience u objective");

  /* System prompt experto: equipo de 4 senior + credenciales completas
   * RUBEN COTON. Calcado del proyecto RUBEN-COTON_HTML 2026-04-30. */
  const system = `ROLE: Eres un equipo de 4 expertos SENIOR trabajando juntos en este email:
1. DIRECTOR COMERCIAL SENIOR - 20 años cerrando contratos de 6 cifras. Sabes que vende y que no.
2. COPYWRITER DE EMAIL MARKETING SENIOR - tus emails tienen un 40% de open rate. Dominas asuntos irresistibles.
3. EXPERTO EN VENTAS CONSULTIVAS - no vendes, haces que el cliente quiera comprarte. Usas psicologia de la persuasion.
4. ESTRATEGA DE MARCA PERSONAL - posicionas artistas como referentes. Sabes convertir logros en deseo.

JUNTOS escribis UN email que genera reuniones, llamadas y contratos. Vuestra arma: la emocion, los datos concretos y la urgencia sutil. Vendeis experiencias, no servicios.

=== QUIEN SOY ===
RUBEN COTON (Madrid, 1993). No soy un DJ mas. Soy un arquitecto sonoro que transforma eventos en experiencias que la gente recuerda años despues.

MIS CREDENCIALES (usa las que MAS impacten a este destinatario concreto):
- DJ oficial del Real Madrid durante 6 temporadas consecutivas - animando partidos de baloncesto del club mas grande del mundo
- DJ residente de Palau Alameda (Valencia) - fiesta After You, cada mes lleno completo
- Festival Mad Cool - miles de personas vibrando con mis sesiones
- Escenario compartido con Abel Ramos, DJ Neil, Sofia Cristo, Dani BPM
- Cadena Dial me reconocio publicamente por mis mashups (La Oreja de Van Gogh + Arde Bogota) - debate en tertulias de radio nacional
- 43.000 seguidores en Instagram - figuras del deporte y espectaculo entre mis fans
- Fiestas patronales en: Coslada, Chinchon, Soto del Real, Villablino (Leon), Colmenar de Oreja, Roa de Duero, Villaconejos, Pelahustan
- Bodas de alto nivel: Palacio de Aldovea y venues premium
- Formacion: Arquitecto tecnico + ADE - gestiono mi carrera con vision empresarial
- Booking y management de artistas de renombre

MI ESTILO: Fusiono los clasicos que marcaron tu infancia (Cadena Dial, Los 40, Cadena 100) con los sonidos que hoy revientan en TikTok e Instagram, todo sobre una base de techno, EDM y hardstyle con melodias indie.
EQUIPO: Pioneer XDJ-RX3, DJM-900NXS2, Ableton Live, Rekordbox.
RRSS: 43K Instagram, YouTube, TikTok, Facebook, X, SoundCloud. Web: rubencoton.com

=== TECNICAS DE COPYWRITING ===
1. ASUNTO: Genera curiosidad con pregunta o dato impactante. Max 70 chars, sin emojis.
2. APERTURA (intro): Las primeras 2 lineas deciden si sigue leyendo. Abre con el dato MAS impresionante para ESTE destinatario. Usa **negrita** en cifras/nombres clave.
3. CUERPO: SOLO 3-4 credenciales RELEVANTES para este destinatario. Concejal de fiestas: multitudes. Wedding planner: elegancia. Director sala: llenos. ADAPTA. **negrita** en datos clave.
4. CTA: Invitacion directa a contactar por WhatsApp (+34 613 009 336), videollamada o respondiendo a manager@rubencoton.com. Tono: "hablemos", no "comprame".

RESPONDE UNICAMENTE con JSON valido, SIN markdown, SIN texto extra:
{"subject":"max 70 chars","saludo":"corto, sin coma final","intro":"2 lineas con **negrita**","body":"4-6 frases con **negrita** en datos clave","cta":"1-2 lineas hacia manager@rubencoton.com o WhatsApp"}

REGLAS INQUEBRANTABLES:
- ORTOGRAFIA: castellano de España PERFECTO. Tildes (á, é, í, ó, ú), eñe (ñ), signos de apertura (¿, ¡), puntuacion correcta. Lo lee un cliente real.
- Nombre: SIEMPRE RUBEN COTON (mayusculas, sin tildes, una T). NUNCA Ruben, Coton, Cotton.
- Email: SOLO manager@rubencoton.com. Telefono: SOLO +34 613 009 336.
- NO inventar datos, cifras, lugares, fechas.
- NO palabras spam: gratis, oferta, urgente, descuento, promocion, dinero, garantizado.
- NO exclamaciones excesivas. NO mayusculas innecesarias salvo RUBEN COTON.
- Maximo 180 palabras totales entre todos los campos.
- Escribe como si este email pudiera cerrar un contrato de 5.000 euros.`;

  const prompt = `AUDIENCIA: ${audience}
OBJETIVO: ${objective}
${offer ? `OFERTA / QUE VENDEMOS: ${offer}\n` : ""}TONO: ${tone}

Genera el JSON ahora.`;

  const r = await aiRouter.classifyJson(prompt, {
    system,
    tier: "alta",
    maxTokens: 800
  });

  const j = r.json || {};

  /* Normalizacion post-IA: corregir errores frecuentes de los modelos
   * (nombre con tildes, emails inventados, telefonos inventados, doble
   * puntuacion). Calcado del proyecto RUBEN-COTON_HTML. */
  const fixBranding = (s) => String(s || "")
    .replace(/Rub[eé]n\s+Cot{1,2}[oó]n/gi, "RUBEN COTON")
    .replace(/RUB[EÉ]N\s+COT[OÓ]N/g, "RUBEN COTON")
    .replace(/RUBEN\s+COTTON/g, "RUBEN COTON")
    .replace(/contacto@rubencoton\.com/gi, "manager@rubencoton.com")
    .replace(/info@rubencoton\.com/gi, "manager@rubencoton.com")
    .replace(/hola@rubencoton\.com/gi, "manager@rubencoton.com")
    .replace(/rubencoton@gmail\.com/gi, "manager@rubencoton.com")
    .replace(/\+34\s*6\d{2}\s*\d{3}\s*\d{3}/g, (m) =>
      m.includes("613") ? m : "+34 613 009 336"
    )
    .replace(/\.\s*\,/g, ".")
    .replace(/\,\s*\./g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/\,{2,}/g, ",");

  const subject = fixBranding(String(j.subject || "").trim()).slice(0, 70);
  const saludo = fixBranding(String(j.saludo || "Hola").trim().replace(/[.,;:!?]+$/g, ""));
  const intro = fixBranding(String(j.intro || "").trim());
  const body = fixBranding(String(j.body || "").trim());
  const cta = fixBranding(String(j.cta || "Responde a manager@rubencoton.com").trim());

  if (!subject || !intro) {
    throw new Error("La IA no devolvio JSON valido: " + String(r.text || "").slice(0, 200));
  }

  const html = buildHtml({ asunto: subject, saludo, intro, body, cta, photoUrl, videoId });
  const text = `${saludo},\n\n${intro.replace(/\*\*(.+?)\*\*/g, "$1")}\n\n${body.replace(/\*\*(.+?)\*\*/g, "$1")}\n\n${cta}\n\n—\nRUBEN COTON\nmanager@rubencoton.com\nhttps://wa.me/34613009336`;

  return {
    subject,
    html,
    text,
    provider: r.provider,
    providerName: r.providerName,
    tier: r.tier
  };
};

module.exports = { generateEmail, buildHtml };

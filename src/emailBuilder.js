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
 * @param {object} opts - { audience, objective, offer, photoUrl, videoId, tone }
 * @returns {Promise<{subject, html, text, provider, providerName}>}
 */
const generateEmail = async (opts = {}) => {
  const { audience, objective, offer = "", photoUrl, videoId, tone = "profesional cercano" } = opts;
  if (!audience || !objective) throw new Error("Faltan audience u objective");

  const system = `Eres copywriter senior de email marketing para RUBEN COTON
(booking & management de artistas en Madrid, Espana).
Escribes en castellano de Espana con tildes, n y signos de apertura.

Responde UNICAMENTE con JSON valido, sin texto fuera del JSON:
{"subject":"...","saludo":"...","intro":"...","body":"...","cta":"..."}

REGLAS:
- subject: max 70 caracteres, gancho, SIN emojis, SIN palabras spam (gratis, urgente, oferta, descuento).
- saludo: saludo corto personalizado a la audiencia (sin coma final).
- intro: 2 frases impactantes. Puedes usar **palabra** para negrita.
- body: 4-6 frases adaptadas al perfil. **bold** en datos clave.
- cta: 1-2 frases con llamada a accion clara hacia manager@rubencoton.com.
- TOTAL max 180 palabras.
- NO inventar cifras, artistas ni fechas.`;

  const prompt = `AUDIENCIA: ${audience}
OBJETIVO: ${objective}
${offer ? `QUE VENDEMOS: ${offer}\n` : ""}TONO: ${tone}

Genera el JSON ahora.`;

  const r = await aiRouter.classifyJson(prompt, {
    system,
    tier: "alta",
    maxTokens: 800
  });

  const j = r.json || {};
  const subject = String(j.subject || "").trim().slice(0, 70);
  const saludo = String(j.saludo || "Hola").trim();
  const intro = String(j.intro || "").trim();
  const body = String(j.body || "").trim();
  const cta = String(j.cta || "Responde a manager@rubencoton.com").trim();

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

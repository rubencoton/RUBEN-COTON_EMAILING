
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/* ARQUITECTURA SIN POSTGRESQL (refactor 2026-04-25)
 * Antes: dual mode (PostgreSQL write-through opcional + JSON file local).
 * Ahora: 100% JSON file local (store.json).
 * Motivo: PostgreSQL container saturaba disco VPS (ENOSPC repetidos).
 * Persistencia: volume mount Coolify /app/data + backup auto a Drive cada hora. */

const DATA_FILE = process.env.DATA_STORE_FILE
  ? path.resolve(process.env.DATA_STORE_FILE)
  : path.join(__dirname, "..", "data", "store.json");
const DATA_DIR = path.dirname(DATA_FILE);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const nowIso = () => new Date().toISOString();

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const createId = (prefix) => `${prefix}_${crypto.randomBytes(7).toString("hex")}`;

/* PERF: structuredClone es ~5x mas rapido que JSON.parse(JSON.stringify) para
 * objetos grandes. En este store con ~50MB de JSON, cada clone() bajaba de ~1s
 * a ~200ms. Disponible nativo en Node 17+. */
const clone = (typeof structuredClone === "function")
  ? (value) => structuredClone(value)
  : (value) => JSON.parse(JSON.stringify(value));

const sanitizeTag = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]/g, "")
    .slice(0, 40);

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sortByCreatedDesc = (list) =>
  [...list].sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

/* ════════════════════════════════════════════════════════════════
   BORRADORES ESTANDAR RUBEN COTON (plantillas seed)
   Colores corporativos OFICIALES: NARANJA #FF6B00, NEGRO #1A1A1A,
   BLANCO #ffffff.
   Bump SEED_VERSION + SEED_RESET_VERSION para forzar limpieza total.
   ═══════════════════════════════════════════════════════════════ */
const SEED_VERSION = 4;
/* SEED_RESET_VERSION: al subir, se BORRAN TODAS las plantillas y se
 * reinstalan solo los seeds actuales. Usar SOLO cuando el usuario pida
 * explicitamente un reset completo de plantillas. */
const SEED_RESET_VERSION = 2;

const getDefaultDrafts = () => {
  /* HTML corporativo NOCHES DE NEÓN. Preservado VERBATIM desde el
   * artwork aprobado por RUBEN COTON (correo-noches-de-neon.html).
   * Colores oficiales: ROJO #FF6B00, AMARILLO #FFB74D, BLANCO #ffffff. */
  const nochesHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fiestas patronales 2026: quedan pocas fechas — Noches de Neón</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, Helvetica, sans-serif;">

  <!-- PREHEADER -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; color:#f4f4f4; line-height:1px;">
    +300 conciertos · 4 h de directo · 5 décadas (60-2000) · Músicos de O.T, Rozalén, La Pegatina. &#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;
  </div>

  <!-- WRAPPER -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:24px 10px;">

        <!-- CONTENEDOR PRINCIPAL -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; max-width:600px;">

          <!-- HEADER ROJO -->
          <tr>
            <td style="background-color:#FF6B00; padding:28px 40px 22px; text-align:center;">
              <img src="https://lh3.googleusercontent.com/d/1yvary28jzeD8nQyul9iSYqFPXKTn9Hyw=w240"
                   alt="RUBEN COTON" width="90"
                   style="display:block; margin:0 auto 10px; width:90px; height:auto; border:0; background-color:#ffffff; border-radius:50%; padding:6px;" border="0">
              <h1 style="margin:4px 0 2px; color:#ffffff; font-size:24px; font-weight:bold; letter-spacing:4px;">RUBEN COTON</h1>
              <p style="margin:0; color:#FFB74D; font-size:11px; letter-spacing:5px; text-transform:uppercase; font-weight:700;">Management</p>
            </td>
          </tr>

          <!-- BARRA AMARILLA -->
          <tr><td style="height:4px; background-color:#FFB74D;"></td></tr>

          <!-- BADGE ARTISTA -->
          <tr>
            <td style="background-color:#FFF8E7; padding:14px 40px; text-align:center; border-bottom:1px solid #f0e6c8;">
              <span style="font-size:11px; color:#888888; letter-spacing:2px; font-weight:700;">ARTISTA REPRESENTADO</span>
              <br>
              <span style="font-size:16px; color:#FF6B00; font-weight:bold; letter-spacing:1px;">NOCHES DE NEÓN</span>
            </td>
          </tr>

          <!-- HERO FOTO — PRIMERA PLANA, ANCHO COMPLETO -->
          <tr>
            <td style="padding:0; background-color:#000000; position:relative;">
              <a href="https://drive.google.com/file/d/1t34i6bMcqJjxvzwA2rHCL3eykHNMPC07/view" target="_blank" style="display:block; text-decoration:none;">
                <img src="https://lh3.googleusercontent.com/d/1t34i6bMcqJjxvzwA2rHCL3eykHNMPC07=w1200"
                     alt="Noches de Neón — banda de versiones y orquesta en directo"
                     width="600"
                     style="display:block; width:100%; max-width:600px; height:auto; border:0; margin:0;" border="0">
              </a>
            </td>
          </tr>

          <!-- BARRA TÍTULO BAJO FOTO -->
          <tr>
            <td style="background-color:#FF6B00; padding:14px 40px; text-align:center;">
              <p style="margin:0; color:#FFB74D; font-size:11px; letter-spacing:3px; font-weight:700; text-transform:uppercase;">El show de las 5 décadas</p>
              <p style="margin:4px 0 0; color:#ffffff; font-size:18px; font-weight:bold; letter-spacing:1px;">60 · 70 · 80 · 90 · 2000</p>
            </td>
          </tr>

          <!-- HERO / PREGUNTA -->
          <tr>
            <td style="padding:36px 40px 10px;">
              <h2 style="margin:0 0 18px; color:#1a1a1a; font-size:24px; line-height:1.3; font-weight:bold;">
                ¿Tiene ya cerrada la banda para las fiestas patronales de 2026?
              </h2>
              <p style="margin:0 0 18px; color:#444444; font-size:16px; line-height:1.55;">
                Le escribo porque representamos a <strong>Noches de Neón</strong>, una de las formaciones con más
                solvencia para grandes fiestas, eventos corporativos y bodas. Cerramos ya las últimas fechas del año.
              </p>
            </td>
          </tr>

          <!-- STATS BOX -->
          <tr>
            <td style="padding:0 40px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF8E7; border-left:4px solid #FF6B00; border-radius:4px;">
                <tr>
                  <td style="padding:16px 20px; text-align:center;">
                    <p style="margin:0; color:#1a1a1a; font-size:14px; font-weight:bold; line-height:1.5;">
                      +300 conciertos &nbsp;·&nbsp; 4 h de directo &nbsp;·&nbsp; 5 décadas (60 → 2000)
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CREDENCIALES -->
          <tr>
            <td style="padding:10px 40px 10px;">
              <p style="margin:0 0 14px; color:#444444; font-size:15px; line-height:1.6;">
                Soy Rubén, CEO de <strong>RUBEN COTON</strong>. Noches de Neón es una formación de
                <strong>músicos de sesión</strong> que han acompañado a Operación Triunfo, Antonio Orozco, Rozalén,
                La Pegatina, Andrés Suárez, Funambulista y Sara Socas, entre otros.
              </p>
              <p style="margin:0 0 14px; color:#444444; font-size:15px; line-height:1.6;">
                Acaban de pasar por la <strong>Plaza de Toros de Guadalajara</strong> y por las
                <strong>fiestas de Villaverde (Madrid)</strong>, y llegan con un show renovado que recorre los
                grandes éxitos de los 60, 70, 80, 90 y 2000.
              </p>
            </td>
          </tr>

          <!-- VÍDEO PROMOCIONAL -->
          <tr>
            <td style="padding:10px 40px 20px;">
              <p style="margin:0 0 10px; color:#1a1a1a; font-size:13px; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">
                Directo promocional
              </p>
              <a href="https://www.youtube.com/watch?v=trdXcBzJKf0" target="_blank" style="display:block; text-decoration:none;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px; overflow:hidden;">
                  <tr>
                    <td style="position:relative; background-color:#000000;">
                      <img src="https://img.youtube.com/vi/trdXcBzJKf0/hqdefault.jpg"
                           alt="Noches de Neón — vídeo promocional"
                           width="520"
                           style="display:block; width:100%; max-width:520px; height:auto; border:0;" border="0">
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color:#FF6B00; padding:10px; text-align:center;">
                      <span style="color:#ffffff; font-size:13px; font-weight:bold; letter-spacing:1px;">▶ VER DIRECTO EN YOUTUBE</span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>

          <!-- IDEAL PARA -->
          <tr>
            <td style="padding:10px 40px 24px;">
              <p style="margin:0 0 12px; color:#1a1a1a; font-size:13px; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">
                Ideal para
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" style="padding:10px 6px; background-color:#FFF8E7; text-align:center; border-radius:4px;">
                    <p style="margin:0; color:#1a1a1a; font-size:13px; font-weight:bold;">Fiestas patronales</p>
                  </td>
                  <td width="4"></td>
                  <td width="33%" style="padding:10px 6px; background-color:#FFF8E7; text-align:center; border-radius:4px;">
                    <p style="margin:0; color:#1a1a1a; font-size:13px; font-weight:bold;">Eventos corporativos</p>
                  </td>
                  <td width="4"></td>
                  <td width="33%" style="padding:10px 6px; background-color:#FFF8E7; text-align:center; border-radius:4px;">
                    <p style="margin:0; color:#1a1a1a; font-size:13px; font-weight:bold;">Bodas premium</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CAJA CIERRE -->
          <tr>
            <td style="padding:0 40px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFB74D; border-radius:6px;">
                <tr>
                  <td style="padding:22px 26px;">
                    <p style="margin:0 0 12px; color:#1a1a1a; font-size:16px; font-weight:bold; line-height:1.4;">
                      Si encaja en su agenda, le envío propuesta cerrada en 24 h.
                    </p>
                    <p style="margin:0 0 10px; color:#1a1a1a; font-size:14px; line-height:1.6;">
                      Solo necesito tres datos:
                    </p>
                    <p style="margin:0 0 4px; color:#1a1a1a; font-size:14px; line-height:1.7;">
                      <strong>1.</strong> Localidad y fecha tentativa<br>
                      <strong>2.</strong> Formato (orquesta 4 h · concierto · versión reducida)<br>
                      <strong>3.</strong> Aforo aproximado
                    </p>
                    <p style="margin:14px 0 0; color:#1a1a1a; font-size:14px; line-height:1.5;">
                      Simplemente responda a este correo con esos datos.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA 1: RESPONDER POR EMAIL -->
          <tr>
            <td style="padding:0 40px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#FF6B00; border-radius:6px;">
                    <a href="mailto:manager@rubencoton.com"
                       style="display:block; padding:16px 20px; color:#ffffff; text-decoration:none; font-size:16px; font-weight:bold;">
                      Responder a este correo
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA 2: WHATSAPP (chat vacío) -->
          <tr>
            <td style="padding:0 40px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#FFB74D; border-radius:6px;">
                    <a href="https://wa.me/34613009336" target="_blank"
                       style="display:block; padding:16px 20px; color:#1a1a1a; text-decoration:none; font-size:16px; font-weight:bold;">
                      Escribir por WhatsApp
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA 3: LLAMAR (teléfono grande) -->
          <tr>
            <td style="padding:0 40px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#ffffff; border:2px solid #FF6B00; border-radius:6px;">
                    <a href="tel:+34613009336"
                       style="display:block; padding:14px 20px; color:#1a1a1a; text-decoration:none;">
                      <span style="display:block; font-size:12px; font-weight:bold; color:#888888; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">Llamar o WhatsApp</span>
                      <span style="display:block; font-size:22px; font-weight:bold; color:#FF6B00; letter-spacing:1px;">+34 613 00 93 36</span>
                      <span style="display:block; font-size:11px; color:#888888; margin-top:4px;">Rubén · CEO RUBEN COTON</span>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FIRMA -->
          <tr>
            <td style="padding:0 40px 34px;">
              <p style="margin:0 0 2px; color:#1a1a1a; font-size:15px; font-weight:bold;">Rubén</p>
              <p style="margin:0; color:#666666; font-size:13px;">CEO · RUBEN COTON</p>
            </td>
          </tr>

          <!-- FOOTER ROJO -->
          <tr>
            <td style="background-color:#FF6B00; padding:24px 40px; text-align:center;">
              <img src="https://lh3.googleusercontent.com/d/16UZKQnCW0J9qqd9yLZ9t4jukrp3p9hcj=w160"
                   alt="RUBEN COTON" width="72"
                   style="display:block; margin:0 auto 10px; width:72px; height:auto; border:0; background-color:#ffffff; border-radius:50%; padding:5px;" border="0">
              <p style="margin:0 0 6px; color:#ffffff; font-size:13px; font-weight:700; letter-spacing:2px;">
                RUBEN COTON
              </p>
              <p style="margin:0 0 10px; color:#ffe8a8; font-size:11px;">
                DJ Profesional · Madrid
              </p>
              <p style="margin:0 0 4px; font-size:12px;">
                <a href="mailto:manager@rubencoton.com"
                   style="color:#ffffff; text-decoration:none; font-weight:bold;">manager@rubencoton.com</a>
              </p>
              <p style="margin:0 0 10px; font-size:12px;">
                <a href="tel:+34613009336"
                   style="color:#ffffff; text-decoration:none; font-weight:bold;">Tel. y WhatsApp · +34 613 00 93 36</a>
              </p>
              <p style="margin:12px 0 0; color:#ffd6a0; font-size:10px; line-height:1.5;">
                Si no desea seguir recibiendo comunicaciones comerciales, responda a este correo con la palabra BAJA.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  const nochesText = `Fiestas patronales 2026: quedan pocas fechas — Noches de Neón

RUBEN COTON
Artista representado: NOCHES DE NEÓN — El show de las 5 décadas (60 · 70 · 80 · 90 · 2000)

¿Tiene ya cerrada la banda para las fiestas patronales de 2026?

Le escribo porque representamos a Noches de Neón, una de las formaciones con más solvencia para grandes fiestas, eventos corporativos y bodas. Cerramos ya las últimas fechas del año.

+300 conciertos · 4 h de directo · 5 décadas (60 → 2000)

Soy Rubén, CEO de RUBEN COTON. Noches de Neón es una formación de músicos de sesión que han acompañado a Operación Triunfo, Antonio Orozco, Rozalén, La Pegatina, Andrés Suárez, Funambulista y Sara Socas, entre otros. Acaban de pasar por la Plaza de Toros de Guadalajara y por las fiestas de Villaverde (Madrid).

Vídeo del directo: https://www.youtube.com/watch?v=trdXcBzJKf0

IDEAL PARA
- Fiestas patronales
- Eventos corporativos
- Bodas premium

Si encaja en su agenda, le envío propuesta cerrada en 24 h. Solo necesito tres datos:
1. Localidad y fecha tentativa
2. Formato (orquesta 4 h · concierto · versión reducida)
3. Aforo aproximado

Responda a este correo con esos datos o contacte por:
- Email: manager@rubencoton.com
- WhatsApp: https://wa.me/34613009336
- Teléfono: +34 613 00 93 36

Rubén · CEO RUBEN COTON

Si no desea seguir recibiendo comunicaciones comerciales, responda a este correo con la palabra BAJA.`;

  return [
    {
      key: "noches-de-neon",
      name: "NOCHES DE NEÓN",
      subject: "Fiestas patronales 2026: quedan pocas fechas — Noches de Neón",
      html: nochesHtml,
      text: nochesText
    }
  ];
};

const createDemoStore = () => {
  const createdAt = nowIso();

  const contacts = [
    {
      id: createId("contact"),
      email: "ana@demo.com",
      firstName: "Ana",
      lastName: "Santos",
      company: "Acme",
      locale: "es",
      timezone: "Europe/Madrid",
      source: "seed",
      status: "subscribed",
      consentStatus: "granted",
      consentAt: createdAt,
      consentSource: "demo_seed",
      tags: ["leads", "newsletter"],
      customFields: { city: "Madrid" },
      lastOpenAt: null,
      lastClickAt: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("contact"),
      email: "luis@demo.com",
      firstName: "Luis",
      lastName: "Roca",
      company: "Beta",
      locale: "es",
      timezone: "Europe/Madrid",
      source: "seed",
      status: "subscribed",
      consentStatus: "granted",
      consentAt: createdAt,
      consentSource: "demo_seed",
      tags: ["clientes"],
      customFields: { city: "Valencia" },
      lastOpenAt: null,
      lastClickAt: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("contact"),
      email: "noelia@demo.com",
      firstName: "Noelia",
      lastName: "Ruiz",
      company: "Gamma",
      locale: "es",
      timezone: "Europe/Madrid",
      source: "seed",
      status: "unsubscribed",
      consentStatus: "revoked",
      consentAt: createdAt,
      consentSource: "demo_seed",
      tags: ["bajas"],
      customFields: {},
      lastOpenAt: null,
      lastClickAt: null,
      createdAt,
      updatedAt: createdAt
    }
  ];

  const templates = [
    {
      id: createId("tpl"),
      name: "Bienvenida",
      subject: "Bienvenido a RUBEN COTON",
      html: "<h1>Hola {{first_name}}</h1><p>Gracias por unirte.</p>",
      text: "Hola {{first_name}}. Gracias por unirte.",
      status: "borrador",
      validatedAt: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("tpl"),
      name: "Promo semanal",
      subject: "Novedades de la semana",
      html: "<h2>Novedades</h2><p>Mira nuestras novedades.</p><a href='https://rubencoton.com'>Ver</a>",
      text: "Novedades de la semana. Visita rubencoton.com",
      status: "borrador",
      validatedAt: null,
      createdAt,
      updatedAt: createdAt
    }
  ];

  const segments = [
    {
      id: createId("seg"),
      name: "Suscritos activos",
      match: "all",
      rules: [{ field: "status", op: "equals", value: "subscribed" }],
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("seg"),
      name: "Nunca hicieron click",
      match: "all",
      rules: [
        { field: "status", op: "equals", value: "subscribed" },
        { field: "lastClickAt", op: "is_empty" }
      ],
      createdAt,
      updatedAt: createdAt
    }
  ];

  const workflows = [
    {
      id: createId("wf"),
      name: "Reenvio no-openers 48h",
      type: "no_open_after_hours",
      delayHours: 48,
      status: "published",
      sourceCampaignId: null,
      templateId: templates[1].id,
      subjectOverride: "[Recordatorio] Novedades de la semana",
      textOverride: "Te reenviamos el correo porque aun no lo has abierto.",
      createdAt,
      updatedAt: createdAt,
      lastRunAt: null
    },
    {
      id: createId("wf"),
      name: "Follow-up opened sin click",
      type: "opened_no_click_after_hours",
      delayHours: 24,
      status: "published",
      sourceCampaignId: null,
      templateId: templates[0].id,
      subjectOverride: "¿Te ayudo con alguna duda?",
      textOverride: "Vimos que abriste el correo. Si quieres, te ayudamos por aqui.",
      createdAt,
      updatedAt: createdAt,
      lastRunAt: null
    }
  ];

  return {
    meta: {
      version: 1,
      createdAt,
      updatedAt: createdAt
    },
    settings: {
      workspaceName: "RUBEN-COTON_EMAILING",
      senderName: "RUBEN COTON",
      senderEmail: "manager@rubencoton.com",
      replyTo: "manager@rubencoton.com",
      addressLine: "RUBEN COTON, España"
    },
    contacts,
    templates,
    segments,
    campaigns: [],
    events: [],
    imports: [],
    workflows,
    workflowRuns: [],
    auditLogs: []
  };
};

const ensureDataFile = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const initial = createDemoStore();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
};

/* P0 audit 2026-05-04: helper de auditLog. Persiste mutaciones admin
 * (createCampaign, importContacts, sendCampaign, archive, etc.) en
 * store.auditLogs para repudio GDPR Art. 30. Bounded a 5000 entries
 * (rolling), retención 90 días. Hash de email NO completo (privacy). */
const AUDIT_LOG_MAX = 5000;
const auditMaskEmail = (e) => {
  if (!e) return null;
  const s = String(e);
  return s.replace(/^(.{2}).*?(@.*)$/, "$1***$2");
};
const pushAuditLog = (store, entry) => {
  if (!store) return;
  if (!Array.isArray(store.auditLogs)) store.auditLogs = [];
  const safe = {
    id: createId("audit"),
    action: String(entry.action || "unknown").slice(0, 60),
    targetType: String(entry.targetType || "").slice(0, 40),
    targetId: String(entry.targetId || "").slice(0, 60),
    email: auditMaskEmail(entry.email),
    actor: String(entry.actor || "admin").slice(0, 40),
    meta: typeof entry.meta === "object" && entry.meta !== null ? entry.meta : {},
    at: nowIso()
  };
  store.auditLogs.unshift(safe);
  if (store.auditLogs.length > AUDIT_LOG_MAX) {
    store.auditLogs.length = AUDIT_LOG_MAX;
  }
};

class DataStore {
  constructor() {
    this.store = null;
    /* Compat: estos flags quedan para no romper consumers que los lean.
     * Siempre false (no hay PG). */
    this.pgEnabled = false;
    this.pgError = null;
    this.pgPool = null;
    /* Deferred-write buffer para eventos de tracking de alto volumen.
     * Evita bloquear event-loop con write sincrono de JSON 50MB+ por click. */
    this._flushTimer = null;
    this._dirty = false;
    this._flushing = false; /* lock anti-concurrencia */
    ensureDataFile();
    /* Flush garantizado al cerrar el proceso (sync OK aqui, ya cerramos) */
    process.on("beforeExit", () => this._flushSync());
    process.on("SIGTERM", () => { this._flushSync(); process.exit(0); });
    process.on("SIGINT", () => { this._flushSync(); process.exit(0); });
  }

  _scheduleFlush() {
    this._dirty = true;
    if (this._flushTimer) return;
    /* 5s debounce: agrupa rafagas de eventos de tracking. Si crash, perdemos
     * <=5s de eventos de tracking — aceptable, no son critico financiero. */
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      this._flushAsync();
    }, 5000);
  }

  /* Flush ASINCRONO — no bloquea event-loop. Critico cuando JSON >10MB.
   * NOTA Windows: fs.promises.rename falla con EPERM si otro proceso tiene
   * handle abierto al destino. Usamos copyFile + unlink como fallback. */
  async _flushAsync() {
    if (!this._dirty || !this.store || this._flushing) return;
    this._flushing = true;
    this._dirty = false;
    const snapshot = this.store; /* referencia, no clonamos 50MB */
    try {
      snapshot.meta = snapshot.meta || {};
      snapshot.meta.updatedAt = nowIso();
      const tmp = `${DATA_FILE}.tmp-${process.pid}`;
      const json = JSON.stringify(snapshot, null, 2);
      await fs.promises.writeFile(tmp, json, "utf8");
      try {
        await fs.promises.rename(tmp, DATA_FILE);
      } catch (renameErr) {
        if (renameErr.code === "EPERM" || renameErr.code === "EBUSY") {
          /* Windows fallback: copy + delete */
          await fs.promises.copyFile(tmp, DATA_FILE);
          await fs.promises.unlink(tmp).catch(() => {});
        } else {
          throw renameErr;
        }
      }
    } catch (err) {
      console.error("[dataStore] async flush error:", err.message);
      this._dirty = true; /* reintentara en proximo schedule */
    } finally {
      this._flushing = false;
      /* Si llegaron mas eventos durante el flush, reagendar */
      if (this._dirty && !this._flushTimer) {
        this._flushTimer = setTimeout(() => {
          this._flushTimer = null;
          this._flushAsync();
        }, 5000);
      }
    }
  }

  /* Flush SINCRONO — solo para shutdown handlers (proceso cerrando). */
  _flushSync() {
    if (!this._dirty || !this.store) return;
    this._dirty = false;
    try {
      this.write(this.store);
    } catch (err) {
      console.error("[dataStore] sync flush error:", err.message);
    }
  }

  async init() {
    this.store = this.read();
  }

  /* P0-B audit 2026-05-01: read() devuelve referencia directa al store
   * en memoria, NO un clone de 55MB. Bajo stress (500 jobs, tracking
   * heavy) hacíamos cientos de read()/segundo → cientos de clones de
   * 55MB → OOM y event loop bloqueado.
   *
   * CONTRATO: el caller NO debe mutar el resultado. Para mutaciones
   * usar `mutate(fn)` que sí garantiza atomicidad y persistencia.
   * Los métodos públicos del store (listContacts, getCampaign, etc.)
   * ya clonan elementos individuales antes de devolverlos al exterior,
   * así que el riesgo de mutación accidental queda contenido.
   *
   * Bench: 55MB clone ~50ms cada call → 0.1ms (referencia directa).
   * Memoria: -55MB por call. */
  read() {
    ensureDataFile();
    if (this.store) {
      return this.store;
    }

    /* BLINDAJE: si el JSON está corrupto (crash a mitad de write, disco lleno),
     * NO crasheamos la app. Loggeamos, preservamos el corrupto para inspección
     * y regeneramos un store demo para que la app pueda arrancar. */
    let parsed;
    try {
      const content = fs.readFileSync(DATA_FILE, "utf8");
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("[dataStore] store.json ilegible/corrupto:", err.message);
      try {
        const backupPath = `${DATA_FILE}.corrupt-${Date.now()}`;
        fs.copyFileSync(DATA_FILE, backupPath);
        console.error(`[dataStore] backup preservado en ${backupPath}`);
      } catch (_e) { /* best effort */ }
      parsed = createDemoStore();
    }

    parsed.contacts = ensureArray(parsed.contacts);
    parsed.templates = ensureArray(parsed.templates);
    parsed.segments = ensureArray(parsed.segments);
    parsed.campaigns = ensureArray(parsed.campaigns);
    parsed.events = ensureArray(parsed.events);
    parsed.imports = ensureArray(parsed.imports);
    parsed.workflows = ensureArray(parsed.workflows);
    parsed.workflowRuns = ensureArray(parsed.workflowRuns);
    parsed.auditLogs = ensureArray(parsed.auditLogs);

    this.store = parsed;
    return parsed;
  }

  write(store) {
    store.meta = store.meta || {};
    store.meta.updatedAt = nowIso();
    this.store = store;
    /* Escritura atómica: temp + rename evita JSON corrupto si crash a mitad de write.
     * Crítico cuando hay riesgo ENOSPC. */
    const tmp = `${DATA_FILE}.tmp-${process.pid}`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
      fs.renameSync(tmp, DATA_FILE);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch (_e) {}
      throw err;
    }
  }

  mutate(mutator) {
    const store = this.read();
    const output = mutator(store);
    this.write(store);
    return output;
  }

  getOverview() {
    const store = this.read();

    const subscribed = store.contacts.filter((c) => c.status === "subscribed").length;
    const suppressed = store.contacts.filter((c) =>
      ["unsubscribed", "bounced", "complained", "suppressed"].includes(c.status)
    ).length;

    /* P0 fix 2026-05-04 (bug reportado por usuario): el dashboard mostraba
     * 18 campañas y 11 enviadas pero la tabla "Estado campañas" solo
     * tenía 2 visibles. Causa: getOverview contaba TODAS las campañas
     * (incluidas archived). Ahora filtra solo activas (no archived). */
    const activeCampaigns = store.campaigns.filter((c) => c.status !== "archived");
    const campaignStats = activeCampaigns.reduce(
      (acc, campaign) => {
        acc.total += 1;
        acc.sent += toNumber(campaign.stats?.sent, 0);
        acc.delivered += toNumber(campaign.stats?.delivered, 0);
        acc.opened += toNumber(campaign.stats?.openedUnique, 0);
        acc.clicked += toNumber(campaign.stats?.clickedUnique, 0);
        acc.unsubscribed += toNumber(campaign.stats?.unsubscribed, 0);
        acc.bounced += toNumber(campaign.stats?.bounced, 0);
        acc.complained += toNumber(campaign.stats?.complained, 0);
        if (campaign.status === "sent") acc.sentCampaigns += 1;
        return acc;
      },
      {
        total: 0,
        sentCampaigns: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        unsubscribed: 0,
        bounced: 0,
        complained: 0
      }
    );

    /* Lista de campañas activas para mostrar en dashboard inicio.
     * P0 FIX 2026-05-05 (bug usuario "falta FESTEJOS y otras"):
     *   - quitar limite slice(0,8) -> mostrar TODAS (max 30 prudente)
     *   - ordenar por createdAt asc (FIFO cronologico, primera creada arriba)
     *   - exponer campaign.number, sentAt, completedAt, openedUnique,
     *     clickedUnique para que el frontend renderice todo. */
    const recentCampaigns = activeCampaigns
      .slice()
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .slice(0, 30)
      .map((c) => ({
        id: c.id,
        number: c.number || null,
        name: c.name,
        subject: c.subject,
        status: c.status,
        queuePosition: typeof c.queuePosition === "number" ? c.queuePosition : null,
        sentAt: c.sentAt || null,
        completedAt: c.completedAt || null,
        stats: {
          sent: toNumber(c.stats?.sent, 0),
          opened: toNumber(c.stats?.openedUnique, 0),
          openedUnique: toNumber(c.stats?.openedUnique, 0),
          clicked: toNumber(c.stats?.clickedUnique, 0),
          clickedUnique: toNumber(c.stats?.clickedUnique, 0),
          bounced: toNumber(c.stats?.bounced, 0),
          replied: toNumber(c.stats?.replied, 0),
          total: toNumber(c.stats?.total, 0),
          totalRecipients: toNumber(c.stats?.total, 0)
        },
        createdAt: c.createdAt || null,
        updatedAt: c.updatedAt || c.createdAt
      }));

    return {
      contacts: {
        total: store.contacts.length,
        subscribed,
        suppressed,
        tags: this.getAllTags(store.contacts)
      },
      templates: {
        total: store.templates.length
      },
      campaigns: campaignStats,
      workflows: {
        total: store.workflows.length,
        published: store.workflows.filter((wf) => wf.status === "published").length
      },
      recentImports: sortByCreatedDesc(store.imports).slice(0, 8),
      recentEvents: sortByCreatedDesc(store.events).slice(0, 20),
      recentCampaigns
    };
  }

  getAllTags(contacts) {
    const set = new Set();
    contacts.forEach((contact) => {
      ensureArray(contact.tags).forEach((tag) => {
        const value = sanitizeTag(tag);
        if (value) {
          set.add(value);
        }
      });
    });
    return Array.from(set).sort();
  }

  /**
   * Devuelve agregado de CRMs y listas sin clonar 51K contactos.
   * MUY rapido: lee this.store directamente y solo agrega contadores.
   */
  listFolders() {
    const contacts = (this.store && this.store.contacts) || this.read().contacts || [];
    const crms = new Map();
    for (let i = 0; i < contacts.length; i++) {
      const tags = contacts[i].tags;
      if (!tags || !tags.length) continue;
      let crmTag = null;
      let segTag = null;
      for (let j = 0; j < tags.length; j++) {
        const t = tags[j];
        if (!crmTag && typeof t === "string" && t.startsWith("crm")) crmTag = t;
        else if (!segTag && typeof t === "string" && t.startsWith("seg")) segTag = t;
        if (crmTag && segTag) break;
      }
      if (!crmTag) continue;
      let crm = crms.get(crmTag);
      if (!crm) { crm = { slug: crmTag, total: 0, lists: new Map() }; crms.set(crmTag, crm); }
      crm.total++;
      if (segTag) {
        const s = crm.lists.get(segTag);
        if (s) s.count++;
        else crm.lists.set(segTag, { slug: segTag, count: 1 });
      }
    }
    return Array.from(crms.values()).map((crm) => ({
      slug: crm.slug,
      total: crm.total,
      lists: Array.from(crm.lists.values()).sort((a, b) => b.count - a.count)
    })).sort((a, b) => b.total - a.total);
  }

  listContacts(filters = {}) {
    const store = this.read();
    let list = [...store.contacts];

    const query = String(filters.q || "")
      .trim()
      .toLowerCase();

    if (query) {
      list = list.filter((contact) => {
        const haystack = [
          contact.email,
          contact.firstName,
          contact.lastName,
          contact.company,
          ensureArray(contact.tags).join(" ")
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    if (filters.status) {
      list = list.filter((contact) => contact.status === String(filters.status));
    }

    if (filters.tag) {
      const tag = sanitizeTag(filters.tag);
      list = list.filter((contact) => ensureArray(contact.tags).includes(tag));
    }

    return sortByCreatedDesc(list);
  }

  createOrUpdateContact(input, mode = "upsert") {
    return this.mutate((store) => {
      const email = normalizeEmail(input.email);
      if (!EMAIL_REGEX.test(email)) {
        throw new Error("Email no valido");
      }

      const now = nowIso();
      const existing = store.contacts.find((c) => c.email === email);

      if (existing && mode === "create_only_new") {
        return clone(existing);
      }

      const normalizedTags = ensureArray(input.tags)
        .map(sanitizeTag)
        .filter(Boolean)
        .slice(0, 30);

      const mergedTags = existing
        ? Array.from(new Set([...ensureArray(existing.tags), ...normalizedTags]))
        : normalizedTags;

      const payload = {
        email,
        firstName: String(input.firstName || "").trim(),
        lastName: String(input.lastName || "").trim(),
        company: String(input.company || "").trim(),
        locale: String(input.locale || "es").trim() || "es",
        timezone: String(input.timezone || "Europe/Madrid").trim() || "Europe/Madrid",
        source: String(input.source || "manual").trim() || "manual",
        status: String(input.status || "subscribed").trim() || "subscribed",
        consentStatus: String(input.consentStatus || "granted").trim() || "granted",
        consentAt: input.consentAt || now,
        consentSource: String(input.consentSource || "manual").trim() || "manual",
        tags: mergedTags,
        customFields:
          typeof input.customFields === "object" && input.customFields !== null
            ? input.customFields
            : {},
        updatedAt: now
      };

      if (existing) {
        Object.assign(existing, payload);
        return clone(existing);
      }

      const created = {
        id: createId("contact"),
        ...payload,
        lastOpenAt: null,
        lastClickAt: null,
        unsubscribedAt: null,
        createdAt: now
      };

      store.contacts.push(created);
      return clone(created);
    });
  }

  updateContact(id, input) {
    return this.mutate((store) => {
      const target = store.contacts.find((item) => item.id === id);
      if (!target) {
        throw new Error("Contacto no encontrado");
      }

      const now = nowIso();
      if (input.firstName !== undefined) {
        target.firstName = String(input.firstName || "").trim();
      }
      if (input.lastName !== undefined) {
        target.lastName = String(input.lastName || "").trim();
      }
      if (input.company !== undefined) {
        target.company = String(input.company || "").trim();
      }
      if (input.status !== undefined) {
        target.status = String(input.status || "").trim() || target.status;
      }
      if (input.tags !== undefined) {
        target.tags = ensureArray(input.tags)
          .map(sanitizeTag)
          .filter(Boolean)
          .slice(0, 30);
      }
      if (input.customFields !== undefined && input.customFields !== null) {
        target.customFields = input.customFields;
      }

      target.updatedAt = now;
      return clone(target);
    });
  }

  importContacts(payload) {
    return this.mutate((store) => {
      const rows = ensureArray(payload.rows);
      const mode = String(payload.mode || "create_or_update").toLowerCase();
      const mapping = payload.mapping || {};
      const fileName = String(payload.fileName || "archivo").trim();
      const source = String(payload.source || "import").trim() || "import";

      const report = {
        id: createId("import"),
        fileName,
        fileType: String(payload.fileType || "unknown"),
        source,
        mode,
        totalRows: rows.length,
        created: 0,
        updated: 0,
        invalid: 0,
        duplicates: 0,
        skipped: 0,
        errors: [],
        createdAt: nowIso()
      };

      const fieldBySourceColumn = {};
      Object.entries(mapping).forEach(([targetField, sourceColumn]) => {
        if (sourceColumn) {
          fieldBySourceColumn[String(sourceColumn)] = targetField;
        }
      });

      rows.forEach((row, index) => {
        try {
          const rowObj = typeof row === "object" && row ? row : {};
          const built = {
            tags: [],
            customFields: {}
          };

          Object.entries(rowObj).forEach(([column, value]) => {
            const targetField = fieldBySourceColumn[column];
            if (!targetField) {
              return;
            }

            const cleaned = String(value ?? "").trim();
            if (!cleaned) {
              return;
            }

            if (targetField === "tags") {
              cleaned
                .split(/[;,|]/g)
                .map((item) => sanitizeTag(item))
                .filter(Boolean)
                .forEach((tag) => built.tags.push(tag));
              return;
            }

            if (targetField.startsWith("custom:")) {
              built.customFields[targetField.replace("custom:", "")] = cleaned;
              return;
            }

            built[targetField] = cleaned;
          });

          const email = normalizeEmail(built.email);
          if (!EMAIL_REGEX.test(email)) {
            report.invalid += 1;
            report.errors.push({ row: index + 1, reason: "email_invalido", value: email });
            return;
          }

          const existing = store.contacts.find((contact) => contact.email === email);

          if (existing && mode === "create_only_new") {
            report.duplicates += 1;
            report.skipped += 1;
            return;
          }

          if (existing) {
            existing.firstName = built.firstName || existing.firstName;
            existing.lastName = built.lastName || existing.lastName;
            existing.company = built.company || existing.company;
            existing.source = source;
            existing.updatedAt = nowIso();
            existing.tags = Array.from(
              new Set([...ensureArray(existing.tags), ...ensureArray(built.tags)])
            );
            existing.customFields = {
              ...(existing.customFields || {}),
              ...(built.customFields || {})
            };
            report.updated += 1;
            return;
          }

          store.contacts.push({
            id: createId("contact"),
            email,
            firstName: built.firstName || "",
            lastName: built.lastName || "",
            company: built.company || "",
            locale: "es",
            timezone: "Europe/Madrid",
            source,
            status: "subscribed",
            consentStatus: "granted",
            consentAt: nowIso(),
            consentSource: source,
            tags: ensureArray(built.tags),
            customFields: built.customFields || {},
            lastOpenAt: null,
            lastClickAt: null,
            unsubscribedAt: null,
            createdAt: nowIso(),
            updatedAt: nowIso()
          });
          report.created += 1;
        } catch (error) {
          report.invalid += 1;
          report.errors.push({
            row: index + 1,
            reason: "error",
            value: error.message || "error"
          });
        }
      });

      store.imports.unshift(report);
      if (store.imports.length > 150) {
        store.imports.length = 150;
      }

      /* P0 audit 2026-05-04: repudio GDPR Art. 30 — auditLog import. */
      pushAuditLog(store, {
        action: "contacts.import",
        targetType: "import",
        targetId: report.id,
        meta: {
          source: report.source,
          fileName: report.fileName,
          totalRows: report.totalRows,
          created: report.created,
          updated: report.updated,
          invalid: report.invalid
        }
      });

      return clone(report);
    });
  }

  listTemplates() {
    const store = this.read();
    /* Normalizar registros antiguos sin status para retrocompatibilidad */
    return sortByCreatedDesc(store.templates).map((tpl) => ({
      ...tpl,
      status: tpl.status || "borrador",
      validatedAt: tpl.validatedAt || null
    }));
  }

  /* Inserta / actualiza los borradores estandar RUBEN COTON.
   * - Si no existe el seed por seedKey, lo INSERTA.
   * - Si existe y tiene seedKey (nunca editado por el usuario) y su
   *   seedVersion es menor que SEED_VERSION actual, lo ACTUALIZA.
   * - Si el usuario ha editado el template (seedKey se elimina en
   *   updateTemplate), NO se toca para no pisar sus cambios.
   * Fallback de reconocimiento: si existe por nombre sin seedKey,
   *   se le asigna seedKey para futuras actualizaciones solo la primera
   *   vez (migracion). */
  ensureDefaultTemplates() {
    const DEFAULT_DRAFTS = getDefaultDrafts();
    return this.mutate((store) => {
      store.meta = store.meta || {};
      let added = 0;
      let updated = 0;
      let removed = 0;

      /* RESET TOTAL: si el SEED_RESET_VERSION guardado en el store es
       * menor que el actual, el usuario ha pedido limpiar TODAS las
       * plantillas. Se borran completamente y se reinsertan solo los
       * seeds definidos arriba. Esto es un "hard reset" intencional. */
      const storedReset = Number(store.meta.lastSeedResetVersion) || 0;
      if (storedReset < SEED_RESET_VERSION) {
        removed = store.templates.length;
        store.templates = [];
        store.meta.lastSeedResetVersion = SEED_RESET_VERSION;
      }

      for (const draft of DEFAULT_DRAFTS) {
        const key = draft.key;
        /* Buscar por seedKey primero, luego por nombre exacto como fallback */
        let tpl = store.templates.find((t) => t.seedKey === key);
        if (!tpl) {
          tpl = store.templates.find(
            (t) => !t.seedKey && String(t.name || "").toLowerCase() === draft.name.toLowerCase()
          );
          if (tpl) {
            /* Migracion: asignar seedKey para gestionarlo en futuro */
            tpl.seedKey = key;
            tpl.seedVersion = tpl.seedVersion || 1;
          }
        }

        if (!tpl) {
          /* No existe: insertar nuevo */
          store.templates.push({
            id: createId("tpl"),
            name: draft.name,
            subject: draft.subject,
            html: draft.html,
            text: draft.text,
            status: "borrador",
            validatedAt: null,
            seedKey: key,
            seedVersion: SEED_VERSION,
            createdAt: nowIso(),
            updatedAt: nowIso()
          });
          added++;
        } else if ((tpl.seedVersion || 0) < SEED_VERSION) {
          /* Existe y esta desactualizado: sincronizar */
          tpl.name = draft.name;
          tpl.subject = draft.subject;
          tpl.html = draft.html;
          tpl.text = draft.text;
          tpl.seedVersion = SEED_VERSION;
          /* Al actualizar contenido, vuelve a borrador */
          tpl.status = "borrador";
          tpl.validatedAt = null;
          tpl.updatedAt = nowIso();
          updated++;
        }
      }
      return { added, updated, removed };
    });
  }

  getTemplate(id) {
    const store = this.read();
    const tpl = store.templates.find((item) => item.id === id);
    if (!tpl) return null;
    return {
      ...clone(tpl),
      status: tpl.status || "borrador",
      validatedAt: tpl.validatedAt || null
    };
  }

  createTemplate(input) {
    return this.mutate((store) => {
      const name = String(input.name || "").trim();
      const subject = String(input.subject || "").trim();
      const html = String(input.html || "").trim();
      const text = String(input.text || "").trim();

      if (!name) {
        throw new Error("Nombre de plantilla obligatorio");
      }
      if (!subject) {
        throw new Error("Asunto obligatorio");
      }
      if (!html && !text) {
        throw new Error("Debes poner HTML o texto");
      }

      const template = {
        id: createId("tpl"),
        name,
        subject,
        html,
        text,
        status: "borrador",
        validatedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };

      store.templates.push(template);
      return clone(template);
    });
  }

  updateTemplate(id, input) {
    return this.mutate((store) => {
      const tpl = store.templates.find((item) => item.id === id);
      if (!tpl) {
        throw new Error("Plantilla no encontrada");
      }

      if (input.name !== undefined) {
        const name = String(input.name).trim();
        if (!name) throw new Error("Nombre de plantilla obligatorio");
        tpl.name = name;
      }
      if (input.subject !== undefined) {
        const subject = String(input.subject).trim();
        if (!subject) throw new Error("Asunto obligatorio");
        tpl.subject = subject;
      }
      if (input.html !== undefined) {
        tpl.html = String(input.html).trim();
      }
      if (input.text !== undefined) {
        tpl.text = String(input.text).trim();
      }
      if (!tpl.html && !tpl.text) {
        throw new Error("Debes mantener HTML o texto");
      }

      /* Al editar el contenido, la plantilla vuelve a estado borrador
       * automaticamente para forzar revalidacion despues del cambio. */
      if (
        input.html !== undefined ||
        input.text !== undefined ||
        input.subject !== undefined
      ) {
        tpl.status = "borrador";
        tpl.validatedAt = null;
      }

      tpl.updatedAt = nowIso();
      return clone(tpl);
    });
  }

  deleteTemplate(id) {
    return this.mutate((store) => {
      const idx = store.templates.findIndex((item) => item.id === id);
      if (idx === -1) {
        throw new Error("Plantilla no encontrada");
      }
      const [removed] = store.templates.splice(idx, 1);
      return clone(removed);
    });
  }

  setTemplateStatus(id, status) {
    const normalized = status === "validado" ? "validado" : "borrador";
    return this.mutate((store) => {
      const tpl = store.templates.find((item) => item.id === id);
      if (!tpl) {
        throw new Error("Plantilla no encontrada");
      }
      if (normalized === "validado" && !tpl.html && !tpl.text) {
        throw new Error("No se puede validar una plantilla vacia");
      }
      tpl.status = normalized;
      tpl.validatedAt = normalized === "validado" ? nowIso() : null;
      tpl.updatedAt = nowIso();
      return clone(tpl);
    });
  }

  listSegments() {
    const store = this.read();
    return sortByCreatedDesc(store.segments).map((segment) => ({
      ...segment,
      count: this.resolveSegmentContactIdsFromStore(store, segment).length
    }));
  }

  createSegment(input) {
    return this.mutate((store) => {
      const name = String(input.name || "").trim();
      const match = String(input.match || "all").toLowerCase() === "any" ? "any" : "all";
      /* Acepta rules:[{...}] o el formato simple {field, op, value} */
      let rules = ensureArray(input.rules);
      if (!rules.length && input.field && input.op) {
        rules = [{ field: input.field, op: input.op, value: input.value || "" }];
      }

      if (!name) {
        throw new Error("Nombre de segmento obligatorio");
      }
      if (!rules.length) {
        throw new Error("Debes definir al menos una regla");
      }

      const segment = {
        id: createId("seg"),
        name,
        match,
        rules,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };

      store.segments.push(segment);

      return {
        ...clone(segment),
        count: this.resolveSegmentContactIdsFromStore(store, segment).length
      };
    });
  }

  listCampaigns(opts = {}) {
    const store = this.read();
    /* Por defecto ocultamos campañas archived del panel. Para ver todas
     * (incluida historia) pasar { includeArchived: true }. */
    const list = opts.includeArchived
      ? store.campaigns
      : store.campaigns.filter((c) => c.status !== "archived");
    return sortByCreatedDesc(list);
  }

  listAllCampaigns() {
    const store = this.read();
    return sortByCreatedDesc(store.campaigns);
  }

  getCampaign(id) {
    const store = this.read();
    const campaign = store.campaigns.find((item) => item.id === id);
    if (!campaign) {
      return null;
    }
    return clone(campaign);
  }

  createCampaign(input) {
    return this.mutate((store) => {
      const name = String(input.name || "").trim();
      const subject = String(input.subject || "").trim();

      if (!name) {
        throw new Error("Nombre de campana obligatorio");
      }
      if (!subject) {
        throw new Error("Asunto de campana obligatorio");
      }

      const templateId = String(input.templateId || "").trim() || null;
      let template = null;
      if (templateId) {
        template = store.templates.find((item) => item.id === templateId);
        if (!template) {
          throw new Error("Plantilla no encontrada");
        }
      }

      const segmentId = String(input.segmentId || "").trim() || null;
      if (segmentId && !store.segments.find((item) => item.id === segmentId)) {
        throw new Error("Segmento no encontrado");
      }

      /* listFilter: fallback cuando la UI no puede crear segmento ad-hoc.
       * Guarda el tag de la lista elegida para que el motor resuelva solo
       * contactos con ese tag (anti 51k). */
      let listFilter = null;
      if (input.listFilter && typeof input.listFilter === "object") {
        const tag = String(input.listFilter.tag || "").trim();
        if (tag) {
          listFilter = {
            tag,
            name: String(input.listFilter.name || tag).trim().slice(0, 120)
          };
        }
      }

      /* P0 FEATURE 2026-05-05 (peticion usuario): numeracion incremental
       * de campañas (0001, 0002, ...) para organizacion visual. Se asigna
       * el siguiente disponible al crear. Las campañas archived/eliminadas
       * NO liberan su numero (son inmutables historicos).
       *
       * P0 FIX 2026-05-05 (auditoria): contador atomico en `store._nextCampaignNumber`
       * para evitar race condition con dos POST concurrentes. Ambos verian el
       * mismo maxNumber sin contador y asignarian numeros duplicados.
       * El mutate envuelve read+write en una sola transaccion sincrona, asi
       * el incremento es atomico desde el punto de vista del JSON store. */
      if (typeof store._nextCampaignNumber !== "number") {
        const maxExisting = store.campaigns.reduce((max, c) => {
          const n = Number(c.number) || 0;
          return n > max ? n : max;
        }, 0);
        store._nextCampaignNumber = maxExisting + 1;
      }
      const nextNumber = store._nextCampaignNumber;
      store._nextCampaignNumber += 1;

      const campaign = {
        id: createId("cmp"),
        number: nextNumber,
        name,
        subject,
        previewText: String(input.previewText || "").trim(),
        status: "draft",
        templateId,
        segmentId,
        listFilter,
        html:
          String(input.html || "").trim() ||
          (template ? String(template.html || "").trim() : ""),
        text:
          String(input.text || "").trim() ||
          (template ? String(template.text || "").trim() : ""),
        tags: ensureArray(input.tags)
          .map(sanitizeTag)
          .filter(Boolean),
        fromName: String(input.fromName || store.settings.senderName || "").trim(),
        fromEmail: normalizeEmail(input.fromEmail || store.settings.senderEmail || ""),
        replyTo: normalizeEmail(input.replyTo || store.settings.replyTo || ""),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        scheduledAt: input.scheduledAt || null,
        sentAt: null,
        jobId: null,
        recipientsSnapshot: [],
        stats: {
          total: 0,
          queued: 0,
          sent: 0,
          delivered: 0,
          openedUnique: 0,
          clickedUnique: 0,
          bounced: 0,
          unsubscribed: 0,
          complained: 0
        }
      };

      if (!campaign.html && !campaign.text) {
        throw new Error("La campana necesita contenido html o texto");
      }

      if (!EMAIL_REGEX.test(campaign.fromEmail)) {
        throw new Error("From email no valido");
      }

      if (!EMAIL_REGEX.test(campaign.replyTo)) {
        throw new Error("Reply-To no valido");
      }

      store.campaigns.push(campaign);

      /* P0 audit 2026-05-04: auditLog createCampaign (repudio GDPR). */
      pushAuditLog(store, {
        action: "campaign.create",
        targetType: "campaign",
        targetId: campaign.id,
        meta: {
          name: campaign.name,
          subject: campaign.subject,
          segmentId: campaign.segmentId,
          listFilter: campaign.listFilter
        }
      });

      return clone(campaign);
    });
  }

  resolveSegmentContactIdsFromStore(store, segment) {
    const contacts = ensureArray(store.contacts);
    if (!segment) {
      return [];
    }

    const rules = ensureArray(segment.rules);
    const matchAll = (segment.match || "all") !== "any";

    const evaluateRule = (contact, rule) => {
      const field = String(rule.field || "").trim();
      const op = String(rule.op || "equals").trim();
      const value = rule.value;

      const raw = (() => {
        if (field === "tags") {
          return ensureArray(contact.tags);
        }
        if (field === "campaignOpened") {
          const campaignId = String(value || "").trim();
          return store.events.some(
            (evt) =>
              evt.type === "open" &&
              evt.campaignId === campaignId &&
              evt.email === contact.email
          );
        }
        if (field === "campaignClicked") {
          const campaignId = String(value || "").trim();
          return store.events.some(
            (evt) =>
              evt.type === "click" &&
              evt.campaignId === campaignId &&
              evt.email === contact.email
          );
        }
        if (field === "neverOpened") {
          return !contact.lastOpenAt;
        }
        if (field === "neverClicked") {
          return !contact.lastClickAt;
        }
        return contact[field];
      })();

      if (op === "is_empty") {
        return raw === null || raw === undefined || raw === "";
      }
      if (op === "is_not_empty") {
        return !(raw === null || raw === undefined || raw === "");
      }
      if (op === "contains") {
        return String(raw || "").toLowerCase().includes(String(value || "").toLowerCase());
      }
      if (op === "equals") {
        if (Array.isArray(raw)) {
          return raw.includes(String(value || "").trim());
        }
        return String(raw || "").toLowerCase() === String(value || "").toLowerCase();
      }
      if (op === "not_equals") {
        return String(raw || "").toLowerCase() !== String(value || "").toLowerCase();
      }
      if (op === "in") {
        const list = ensureArray(value).map((item) => String(item || "").toLowerCase());
        return list.includes(String(raw || "").toLowerCase());
      }
      if (op === "not_in") {
        const list = ensureArray(value).map((item) => String(item || "").toLowerCase());
        return !list.includes(String(raw || "").toLowerCase());
      }
      if (op === "is_true") {
        return Boolean(raw);
      }
      if (op === "is_false") {
        return !Boolean(raw);
      }
      if (op === "before") {
        return Date.parse(raw || 0) < Date.parse(value || 0);
      }
      if (op === "after") {
        return Date.parse(raw || 0) > Date.parse(value || 0);
      }
      return false;
    };

    return contacts
      .filter((contact) => {
        const decisions = rules.map((rule) => evaluateRule(contact, rule));
        return matchAll ? decisions.every(Boolean) : decisions.some(Boolean);
      })
      .map((contact) => contact.id);
  }

  resolveSegmentContacts(segmentId) {
    const store = this.read();
    const segment = store.segments.find((item) => item.id === segmentId);
    if (!segment) {
      return [];
    }
    /* FIX C5 (audit 2026-04-30): usar Set para lookup O(1) en vez de
     * Array.includes O(N). Con segmentos de 10K IDs y 41K contactos,
     * el filter previo costaba 410M operaciones bloqueando el event-loop
     * varios segundos. Con Set, lookup es O(1) -> 41K ops totales. */
    const ids = this.resolveSegmentContactIdsFromStore(store, segment);
    const idSet = new Set(ids);
    return store.contacts.filter((contact) => idSet.has(contact.id));
  }

  getEligibleRecipientsForCampaign(campaignId) {
    const store = this.read();
    const campaign = store.campaigns.find((item) => item.id === campaignId);
    if (!campaign) {
      throw new Error("Campana no encontrada");
    }

    /* BLINDAJE CRÍTICO (2026-04-22): hubo un incidente en el que una campaña
     * con segmentId=null (porque la UI selecciona CRM+Lista pero NO genera
     * segmentId) se envió a los 51.398 contactos de la base. A partir de
     * ahora, toda campaña DEBE tener un segmentId resoluble o un listFilter
     * explícito. Sin él, el envío se bloquea de raíz.
     *
     * Si necesitas enviar a TODOS los contactos, crea un segmento llamado
     * "Suscritos activos" y usa su ID explícitamente — así quedará en el
     * audit log y no será un "default" silencioso. */
    let contacts;
    if (campaign.segmentId) {
      const segment = store.segments.find((s) => s.id === campaign.segmentId);
      if (!segment) {
        throw new Error(
          `El segmento asignado a la campana no existe (${campaign.segmentId}). ` +
          `Revisa la campana o crea un segmento valido.`
        );
      }
      contacts = this.resolveSegmentContacts(campaign.segmentId);
      if (!contacts.length) {
        throw new Error(
          `El segmento "${segment.name}" no tiene contactos. ` +
          `Anade contactos al segmento o asigna otro.`
        );
      }
    } else if (campaign.listFilter && campaign.listFilter.tag) {
      /* BLINDAJE (2026-04-22): whitelist de prefijos permitidos para listFilter.
       * Solo 'list-', 'seg-' o nombres de lista pequeños. NO permitir 'crm-*'
       * que abarca miles de contactos. */
      const tag = String(campaign.listFilter.tag);
      const allowed = tag.startsWith("list-") || tag.startsWith("seg-") ||
        (tag.startsWith("crm-") && tag !== "crm-prueba" ? false : true);
      /* crm-prueba es lista especial de test, solo 1 contacto; resto crm-* bloqueado. */
      if (tag.startsWith("crm-") && tag !== "crm-prueba") {
        throw new Error(
          `listFilter con tag "${tag}" bloqueado: los tags CRM abarcan miles de contactos. ` +
          `Usa un segmento explícito o una lista (prefijo list-/seg-).`
        );
      }
      if (!allowed) {
        throw new Error(`listFilter con tag "${tag}" no está en la whitelist (prefijos permitidos: list-, seg-).`);
      }
      contacts = store.contacts.filter((c) => Array.isArray(c.tags) && c.tags.includes(tag));
      if (!contacts.length) {
        throw new Error(`La lista "${tag}" no tiene contactos.`);
      }
      /* Cap adicional: listFilter nunca debe resolver más de N destinatarios
       * sin segmento. Los envíos grandes deben ir por segmento explícito. */
      const LIST_FILTER_CAP = Number(process.env.LIST_FILTER_CAP) || 5000;
      if (contacts.length > LIST_FILTER_CAP) {
        throw new Error(
          `listFilter "${tag}" resolvió ${contacts.length} contactos (cap: ${LIST_FILTER_CAP}). ` +
          `Para envíos grandes crea un segmento explícito.`
        );
      }
    } else {
      throw new Error(
        "ENVÍO BLOQUEADO: esta campaña no tiene segmentId ni listFilter. " +
        "Debes asignar un SEGMENTO explícito antes de enviar. " +
        "El envío ciego a TODOS los contactos está deshabilitado."
      );
    }

    const eligible = contacts.filter(
      (contact) => !["unsubscribed", "bounced", "complained", "suppressed"].includes(contact.status)
    );

    return {
      campaign: clone(campaign),
      recipients: eligible.map((contact) => ({
        contactId: contact.id,
        email: contact.email,
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
        company: contact.company || "",
        status: contact.status
      }))
    };
  }

  attachCampaignJob(campaignId, job, recipients, opts = {}) {
    return this.mutate((store) => {
      const campaign = store.campaigns.find((item) => item.id === campaignId);
      if (!campaign) {
        throw new Error("Campana no encontrada");
      }

      const now = nowIso();
      campaign.jobId = job.id;
      campaign.status = "sending";
      campaign.updatedAt = now;

      /* P0 FIX 2026-05-05 (bug usuario "tras deploy las campañas pierden los
       * envíos hechos"): cuando recreateLostJob nos llama tras restart, NO
       * debemos sobrescribir el snapshot historico ni resetear stats.sent.
       * Modo `preserveHistory=true` mergea el subset de pendientes con el
       * snapshot existente, preservando los `sentAt` previos. */
      if (opts.preserveHistory) {
        const existing = Array.isArray(campaign.recipientsSnapshot)
          ? campaign.recipientsSnapshot
          : [];
        const byEmail = new Map(existing.map((r) => [r.email, r]));
        recipients.forEach((recipient) => {
          const prev = byEmail.get(recipient.email);
          if (!prev) {
            byEmail.set(recipient.email, {
              contactId: recipient.contactId,
              email: recipient.email,
              status: "queued",
              sentAt: null,
              deliveredAt: null,
              openedAt: null,
              clickedAt: null,
              bouncedAt: null,
              unsubscribedAt: null,
              complainedAt: null,
              workflowActions: {}
            });
          } else if (!prev.sentAt && !prev.bouncedAt) {
            /* Solo reseteamos status si esta pendiente (no enviado ni rebotado). */
            prev.status = "queued";
          }
        });
        campaign.recipientsSnapshot = Array.from(byEmail.values());
        const total = campaign.recipientsSnapshot.length;
        const sent = campaign.recipientsSnapshot.filter((r) => r.sentAt).length;
        const bounced = campaign.recipientsSnapshot.filter((r) => r.bouncedAt).length;
        const queued = Math.max(0, total - sent - bounced);
        campaign.stats.total = total;
        campaign.stats.queued = queued;
        campaign.stats.sent = sent;
        campaign.stats.bounced = bounced;
        /* No tocar sentAt de la campaña: ya estaba seteado al lanzamiento original. */
        return clone(campaign);
      }

      campaign.sentAt = now;
      campaign.recipientsSnapshot = recipients.map((recipient) => ({
        contactId: recipient.contactId,
        email: recipient.email,
        status: "queued",
        sentAt: null,
        deliveredAt: null,
        openedAt: null,
        clickedAt: null,
        bouncedAt: null,
        unsubscribedAt: null,
        complainedAt: null,
        workflowActions: {}
      }));

      campaign.stats.total = recipients.length;
      campaign.stats.queued = recipients.length;
      campaign.stats.sent = 0;

      return clone(campaign);
    });
  }

  syncCampaignByJob(campaignId, jobDetail) {
    return this.mutate((store) => {
      const campaign = store.campaigns.find((item) => item.id === campaignId);
      if (!campaign) {
        return null;
      }

      if (!jobDetail || !Array.isArray(jobDetail.recipients)) {
        return clone(campaign);
      }

      const byEmail = new Map(
        ensureArray(campaign.recipientsSnapshot).map((item) => [item.email, item])
      );

      let queued = 0;
      let sent = 0;

      jobDetail.recipients.forEach((entry) => {
        const target = byEmail.get(entry.email);
        if (!target) {
          return;
        }

        target.status = entry.status;

        if (["queued", "queued_retry", "sending"].includes(entry.status)) {
          queued += 1;
        }

        if (entry.status === "sent") {
          sent += 1;
          if (!target.sentAt) {
            target.sentAt = entry.sentAt || nowIso();
            this.pushEventInStore(store, {
              type: "delivered",
              campaignId: campaign.id,
              contactId: target.contactId,
              email: target.email,
              occurredAt: target.sentAt,
              source: "engine"
            });
          }
          if (!target.deliveredAt) {
            target.deliveredAt = target.sentAt;
          }
        }

        if (entry.status === "error" && !target.bouncedAt) {
          this.pushEventInStore(store, {
            type: "bounce",
            campaignId: campaign.id,
            contactId: target.contactId,
            email: target.email,
            occurredAt: nowIso(),
            source: "engine",
            metadata: {
              reason: entry.error || "smtp_error"
            }
          });
        }
      });

      /* P0 FIX 2026-05-05 (bug usuario "0 enviados pero 5 aperturas / 1 rebote / 1 respuesta"):
       * jobDetail.recipients trae solo los recipients del job ACTUAL (los
       * pendientes tras un restart con preserveHistory). Si contaramos sent
       * solo ahi, perderiamos los recipients ya enviados que viven en
       * recipientsSnapshot pero no en el job actual.
       *
       * P0 FIX 2026-05-06 (bug usuario "0 enviados con 1 rebote"):
       * `sent` ahora cuenta TODOS los recipients procesados (sentAt OR
       * bouncedAt). Logicamente: si rebotó es porque se intento enviar.
       * Si llego una respuesta es porque se envio. Igual con opens/clicks.
       * Imposible que un recipient tenga eventos sin haber sido enviado.
       * Asi el contador de la UI cuadra con rebotes/respuestas.
       *
       * Solucion: contar sent (=procesados) y bounced desde el SNAPSHOT
       * COMPLETO (que conserva la historia gracias a preserveHistory).
       * queued sigue viniendo del job actual porque solo el motor sabe
       * quien sigue vivo. */
      const finalSnap = ensureArray(campaign.recipientsSnapshot);
      const sentTotal = finalSnap.filter((r) => r.sentAt || r.bouncedAt).length;
      const bouncedTotal = finalSnap.filter((r) => r.bouncedAt).length;
      campaign.stats.queued = queued;
      campaign.stats.sent = sentTotal;
      campaign.stats.bounced = bouncedTotal;

      /* Posición en la cola global del motor (0 = activa ahora). */
      if (typeof jobDetail.queuePosition === "number" || jobDetail.queuePosition === null) {
        campaign.queuePosition = jobDetail.queuePosition;
      }

      /* P0 FIX 2026-05-06 (peticion usuario "diferenciar enviando ahora vs en cola"):
       * el motor distingue "running" (pos=0, con startedAt) y "queued"
       * (pos>0 esperando turno). Reflejar esa distincion en campaign.status:
       *  - jobDetail.running -> campaign.sending (esta enviando ahora mismo)
       *  - jobDetail.queued  -> campaign.queued (esperando turno en la cola)
       * Antes solo seteabamos sending en running, dejando "queued" inicial
       * congelado en sending al primer sync. */
      if (jobDetail.status === "running") {
        campaign.status = "sending";
      } else if (jobDetail.status === "queued" && campaign.status !== "paused") {
        campaign.status = "queued";
      }
      if (jobDetail.status === "completed" || jobDetail.status === "completed_with_errors") {
        campaign.status = "sent";
        /* PETICION USUARIO 2026-05-05: registrar fecha-hora de finalizacion. */
        if (!campaign.completedAt) campaign.completedAt = nowIso();
      }
      if (jobDetail.status === "failed") {
        campaign.status = "failed";
        if (!campaign.completedAt) campaign.completedAt = nowIso();
      }

      campaign.updatedAt = nowIso();
      this.recomputeCampaignStats(store, campaign.id);
      return clone(campaign);
    });
  }

  pushEventInStore(store, event) {
    const eventId = createId("evt");
    const safeType = String(event.type || "unknown").trim().toLowerCase();
    const occurredAt = event.occurredAt || nowIso();

    const dedupeKey = `${safeType}|${event.campaignId || ""}|${event.email || ""}|${event.url || ""}|${occurredAt}`;

    /* P0 perf 2026-05-04: dedupe lookup era O(N) sobre 100k events ~50ms
     * por addEvent. Construir Map index lazy (cached en `store._eventDedupeIdx`)
     * y reutilizar entre calls del mismo store ref. Bajamos a O(1).
     *
     * P0 FIX 2026-05-04: tras persist/reload, el Map se serializa como
     * objeto vacío `{}`. Verificar `instanceof Map` antes de usarlo. */
    if (!(store._eventDedupeIdx instanceof Map) || store._eventDedupeIdx._size !== store.events.length) {
      const idx = new Map();
      for (const e of store.events) {
        if (e && e.dedupeKey) idx.set(e.dedupeKey, e);
      }
      idx._size = store.events.length;
      store._eventDedupeIdx = idx;
    }
    const duplicated = store._eventDedupeIdx.get(dedupeKey);
    if (duplicated) {
      return duplicated;
    }

    const payload = {
      id: eventId,
      type: safeType,
      campaignId: event.campaignId || null,
      contactId: event.contactId || null,
      email: normalizeEmail(event.email),
      url: event.url || null,
      source: event.source || "manual",
      isMachineOpen: Boolean(event.isMachineOpen),
      isBotSuspected: Boolean(event.isBotSuspected),
      metadata:
        typeof event.metadata === "object" && event.metadata !== null
          ? event.metadata
          : {},
      occurredAt,
      createdAt: nowIso(),
      dedupeKey
    };

    store.events.unshift(payload);
    /* P0 perf 2026-05-04: actualizar el index dedupe sin rebuild completo.
     * Verificar instanceof Map (tras restore desde JSON puede ser {}). */
    if (store._eventDedupeIdx instanceof Map) {
      store._eventDedupeIdx.set(dedupeKey, payload);
      store._eventDedupeIdx._size = store.events.length;
    }
    /* Retención basada en tiempo: mínimo 7 días de historial.
     * Solo purgamos eventos > 7 días si superamos EVENT_MAX. */
    const EVENT_MAX = Number(process.env.EVENT_MAX) || 100000; /* P0 audit 2026-05-01: 25k → 100k para 56k contactos */
    const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
    if (store.events.length > EVENT_MAX) {
      const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
      const withinRetention = store.events.filter(e => (e.occurredAt || e.createdAt) >= cutoff);
      store.events = withinRetention.length >= EVENT_MAX
        ? withinRetention.slice(0, EVENT_MAX)
        : withinRetention;
      /* invalidar index tras purge */
      store._eventDedupeIdx = null;
    }

    const contact = store.contacts.find((item) => item.email === payload.email);
    if (contact) {
      payload.contactId = contact.id;
      if (safeType === "open") {
        contact.lastOpenAt = occurredAt;
      }
      if (safeType === "click") {
        contact.lastClickAt = occurredAt;
      }
      if (safeType === "unsubscribe") {
        contact.status = "unsubscribed";
        contact.unsubscribedAt = occurredAt;
      }
      if (safeType === "bounce") {
        contact.status = "bounced";
      }
      if (safeType === "complaint") {
        contact.status = "complained";
      }
      contact.updatedAt = nowIso();
    }

    if (payload.campaignId) {
      const campaign = store.campaigns.find((item) => item.id === payload.campaignId);
      if (campaign) {
        const recipient = ensureArray(campaign.recipientsSnapshot).find(
          (item) => item.email === payload.email
        );
        if (recipient) {
          /* P0 audit 2026-05-01: NO marcar openedAt si el evento es de
           * GoogleImageProxy/Apple MPP/Outlook preview (machine open).
           * Antes inflábamos openRate del informe a directiva con cargas
           * automáticas de proxies que NO equivalen a un humano abriendo. */
          if (safeType === "open" && !recipient.openedAt && !payload.isMachineOpen) {
            recipient.openedAt = occurredAt;
          }
          if (safeType === "click" && !recipient.clickedAt) {
            recipient.clickedAt = occurredAt;
          }
          if (safeType === "bounce" && !recipient.bouncedAt) {
            recipient.bouncedAt = occurredAt;
          }
          if (safeType === "unsubscribe" && !recipient.unsubscribedAt) {
            recipient.unsubscribedAt = occurredAt;
          }
          if (safeType === "complaint" && !recipient.complainedAt) {
            recipient.complainedAt = occurredAt;
          }
        }
        this.recomputeCampaignStats(store, campaign.id);
      }
    }

    return payload;
  }

  addEvent(event) {
    /* PERF: tracking de alto volumen. Antes hacia mutate() que bloqueaba el
     * event-loop 5-15s por click (read+write JSON 50MB+ sincrono). Ahora
     * pusheamos al store en memoria y agendamos flush debounced 2s. */
    if (!this.store) this.store = this.read();
    const inserted = this.pushEventInStore(this.store, event);
    this._scheduleFlush();
    return clone(inserted);
  }

  simulateCampaignEvent(campaignId, type, options = {}) {
    return this.mutate((store) => {
      const campaign = store.campaigns.find((item) => item.id === campaignId);
      if (!campaign) {
        throw new Error("Campana no encontrada");
      }

      const eventType = String(type || "open").trim().toLowerCase();
      const pct = Math.min(100, Math.max(1, toNumber(options.percent, 35)));

      const recipients = ensureArray(campaign.recipientsSnapshot);
      if (!recipients.length) {
        throw new Error("La campana no tiene destinatarios");
      }

      const candidates = recipients.filter((recipient) => {
        if (eventType === "open") {
          return !recipient.openedAt && recipient.sentAt;
        }
        if (eventType === "click") {
          return recipient.sentAt && !recipient.clickedAt;
        }
        if (eventType === "unsubscribe") {
          return !recipient.unsubscribedAt;
        }
        if (eventType === "bounce") {
          return !recipient.bouncedAt;
        }
        if (eventType === "complaint") {
          return !recipient.complainedAt;
        }
        return true;
      });

      const targetCount = Math.max(1, Math.ceil((candidates.length * pct) / 100));
      const selected = candidates.slice(0, targetCount);

      const inserted = selected.map((recipient) =>
        this.pushEventInStore(store, {
          type: eventType,
          campaignId,
          contactId: recipient.contactId,
          email: recipient.email,
          url:
            eventType === "click"
              ? "https://rubencoton.com/oferta"
              : null,
          occurredAt: nowIso(),
          source: "simulation"
        })
      );

      this.recomputeCampaignStats(store, campaignId);

      return {
        campaignId,
        type: eventType,
        generated: inserted.length,
        percent: pct
      };
    });
  }

  recomputeCampaignStats(store, campaignId) {
    const campaign = store.campaigns.find((item) => item.id === campaignId);
    if (!campaign) {
      return;
    }

    const recipients = ensureArray(campaign.recipientsSnapshot);

    const delivered = recipients.filter((item) => item.deliveredAt || item.sentAt).length;
    const opened = recipients.filter((item) => item.openedAt).length;
    const clicked = recipients.filter((item) => item.clickedAt).length;
    const bounced = recipients.filter((item) => item.bouncedAt).length;
    const unsubscribed = recipients.filter((item) => item.unsubscribedAt).length;
    const complained = recipients.filter((item) => item.complainedAt).length;

    /* Replies: contar events únicos (por email) de type=reply en esta campaña. */
    const replyEmails = new Set();
    for (const ev of ensureArray(store.events)) {
      if (ev.type === "reply" && ev.campaignId === campaign.id) {
        if (ev.email) replyEmails.add(String(ev.email).toLowerCase());
      }
    }
    const replied = replyEmails.size;

    campaign.stats.total = recipients.length;
    campaign.stats.delivered = delivered;
    campaign.stats.openedUnique = opened;
    campaign.stats.clickedUnique = clicked;
    /* ALIASES de compatibilidad con UI y frontend legacy. La UI
     * (public/app.js renderCampaigns) lee stats.opened / stats.clicked,
     * no openedUnique/clickedUnique. Antes quedaban siempre a 0. */
    campaign.stats.opened = opened;
    campaign.stats.clicked = clicked;
    campaign.stats.replied = replied;
    campaign.stats.bounced = bounced;
    campaign.stats.unsubscribed = unsubscribed;
    campaign.stats.complained = complained;
    campaign.updatedAt = nowIso();
  }

  getCampaignAnalytics(campaignId) {
    const store = this.read();
    const campaign = store.campaigns.find((item) => item.id === campaignId);
    if (!campaign) {
      throw new Error("Campana no encontrada");
    }

    this.recomputeCampaignStats(store, campaignId);

    const stats = campaign.stats;
    const total = Math.max(stats.total, 1);
    const delivered = stats.delivered;
    const opened = stats.openedUnique;
    const clicked = stats.clickedUnique;

    const events = store.events.filter((evt) => evt.campaignId === campaignId);
    const linkClicks = events
      .filter((evt) => evt.type === "click" && evt.url)
      .reduce((acc, evt) => {
        const key = evt.url;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

    const topLinks = Object.entries(linkClicks)
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      campaignId,
      name: campaign.name,
      status: campaign.status,
      totals: {
        totalRecipients: stats.total,
        delivered,
        opened,
        clicked,
        unsubscribed: stats.unsubscribed,
        bounced: stats.bounced,
        complained: stats.complained
      },
      rates: {
        deliveryRate: Number(((delivered / total) * 100).toFixed(2)),
        openRate: Number(((opened / Math.max(delivered, 1)) * 100).toFixed(2)),
        clickRate: Number(((clicked / Math.max(delivered, 1)) * 100).toFixed(2)),
        ctor: Number(((clicked / Math.max(opened, 1)) * 100).toFixed(2)),
        unsubscribeRate: Number(((stats.unsubscribed / total) * 100).toFixed(2)),
        bounceRate: Number(((stats.bounced / total) * 100).toFixed(2)),
        complaintRate: Number(((stats.complained / total) * 100).toFixed(2))
      },
      topLinks,
      recentEvents: sortByCreatedDesc(events).slice(0, 40)
    };
  }

  listWorkflows() {
    const store = this.read();
    return sortByCreatedDesc(store.workflows);
  }

  createWorkflow(input) {
    return this.mutate((store) => {
      const name = String(input.name || "").trim();
      const type = String(input.type || "").trim();

      if (!name) {
        throw new Error("Nombre del workflow obligatorio");
      }
      if (!["no_open_after_hours", "opened_no_click_after_hours"].includes(type)) {
        throw new Error("Tipo de workflow no valido");
      }

      const workflow = {
        id: createId("wf"),
        name,
        type,
        delayHours: Math.max(1, toNumber(input.delayHours, 24)),
        status: String(input.status || "published").trim(),
        sourceCampaignId: String(input.sourceCampaignId || "").trim() || null,
        templateId: String(input.templateId || "").trim() || null,
        subjectOverride: String(input.subjectOverride || "").trim(),
        textOverride: String(input.textOverride || "").trim(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastRunAt: null
      };

      store.workflows.push(workflow);
      return clone(workflow);
    });
  }

  runWorkflows(engine) {
    return this.mutate((store) => {
      const runs = [];
      const workflows = store.workflows.filter((wf) => wf.status === "published");

      workflows.forEach((workflow) => {
        const sourceCampaigns = workflow.sourceCampaignId
          ? store.campaigns.filter((cmp) => cmp.id === workflow.sourceCampaignId)
          : store.campaigns.filter((cmp) => cmp.status === "sent");

        sourceCampaigns.forEach((sourceCampaign) => {
          const template = workflow.templateId
            ? store.templates.find((tpl) => tpl.id === workflow.templateId)
            : null;

          const thresholdMs = workflow.delayHours * 60 * 60 * 1000;
          const now = Date.now();

          const eligibleRecipients = ensureArray(sourceCampaign.recipientsSnapshot).filter(
            (recipient) => {
              if (!recipient.sentAt) {
                return false;
              }

              const sentAtMs = Date.parse(recipient.sentAt);
              if (!Number.isFinite(sentAtMs) || now - sentAtMs < thresholdMs) {
                return false;
              }

              recipient.workflowActions = recipient.workflowActions || {};
              if (recipient.workflowActions[workflow.id]) {
                return false;
              }

              if (workflow.type === "no_open_after_hours") {
                return !recipient.openedAt && !recipient.bouncedAt && !recipient.unsubscribedAt;
              }

              if (workflow.type === "opened_no_click_after_hours") {
                return (
                  Boolean(recipient.openedAt) &&
                  !recipient.clickedAt &&
                  !recipient.bouncedAt &&
                  !recipient.unsubscribedAt
                );
              }

              return false;
            }
          );

          if (!eligibleRecipients.length) {
            return;
          }

          const recipients = eligibleRecipients.map((recipient) => recipient.email);

          const subject =
            workflow.subjectOverride ||
            (template ? template.subject : `[Follow-up] ${sourceCampaign.subject}`);
          const text =
            workflow.textOverride ||
            (template ? template.text : "Seguimos en contacto contigo.");
          const html = template ? template.html : "";

          let job = null;
          try {
            job = engine.enqueueJob({
              name: `${workflow.name} (${sourceCampaign.name})`,
              subject,
              text,
              html,
              recipients
            });
          } catch (error) {
            runs.push({
              id: createId("wfr"),
              workflowId: workflow.id,
              campaignId: sourceCampaign.id,
              status: "error",
              message: error.message || "error",
              createdAt: nowIso()
            });
            return;
          }

          eligibleRecipients.forEach((recipient) => {
            recipient.workflowActions[workflow.id] = nowIso();
          });

          const run = {
            id: createId("wfr"),
            workflowId: workflow.id,
            workflowName: workflow.name,
            campaignId: sourceCampaign.id,
            sourceCampaignName: sourceCampaign.name,
            status: "ok",
            jobId: job.id,
            recipients: recipients.length,
            createdAt: nowIso()
          };

          store.workflowRuns.unshift(run);
          if (store.workflowRuns.length > 500) {
            store.workflowRuns.length = 500;
          }

          runs.push(run);
        });

        workflow.lastRunAt = nowIso();
        workflow.updatedAt = nowIso();
      });

      return clone(runs);
    });
  }

  listWorkflowRuns() {
    const store = this.read();
    return sortByCreatedDesc(store.workflowRuns).slice(0, 200);
  }
}

module.exports = {
  DataStore,
  EMAIL_REGEX,
  normalizeEmail
};

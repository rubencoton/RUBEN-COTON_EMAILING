/**
 * Envío de emails via Gmail API (no SMTP).
 * Funciona EN LOCAL Y EN VPS sin necesidad de App Password ni puerto 25.
 *
 * Requiere: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN
 * con scope https://www.googleapis.com/auth/gmail.send
 */
const { google } = require("googleapis");

let gmailClient = null;

const getGmail = () => {
  if (gmailClient) return gmailClient;
  const oauth = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
  oauth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  gmailClient = google.gmail({ version: "v1", auth: oauth });
  return gmailClient;
};

const isConfigured = () =>
  Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  );

/* Codifica un string con caracteres no-ASCII en RFC 2047 base64. */
const encodeMime = (s) => {
  if (!s) return "";
  // Si solo ASCII, no codificar
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf-8").toString("base64")}?=`;
};

/* Construye el RFC 2822 raw message en base64url. */
const buildRawMessage = (mail) => {
  const fromName = mail.fromName || "";
  const fromEmail = mail.fromEmail;
  const from = fromName
    ? `${encodeMime(fromName)} <${fromEmail}>`
    : fromEmail;
  const to = Array.isArray(mail.to) ? mail.to.join(", ") : mail.to;
  const replyTo = mail.replyTo || mail.fromEmail;

  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${fromEmail.split("@")[1]}>`;
  const dateHeader = new Date().toUTCString();

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeMime(mail.subject || "")}`,
    `Date: ${dateHeader}`,
    `Message-ID: ${messageId}`,
    `X-Mailer: RUBEN-COTON_EMAILING`,
    `List-Unsubscribe: <mailto:${replyTo}?subject=unsubscribe>`,
    `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
    "MIME-Version: 1.0",
  ];

  if (mail.headers && typeof mail.headers === "object") {
    for (const [k, v] of Object.entries(mail.headers)) {
      lines.push(`${k}: ${v}`);
    }
  }

  if (mail.html && mail.text) {
    const boundary = `bnd_${Date.now().toString(36)}`;
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(Buffer.from(mail.text, "utf-8").toString("base64"));
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(Buffer.from(mail.html, "utf-8").toString("base64"));
    lines.push(`--${boundary}--`);
  } else if (mail.html) {
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(Buffer.from(mail.html, "utf-8").toString("base64"));
  } else {
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(Buffer.from(mail.text || "", "utf-8").toString("base64"));
  }

  const raw = lines.join("\r\n");
  return Buffer.from(raw, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

/* Envía un email via Gmail API. Devuelve {messageId, accepted}. */
const sendMail = async (mail) => {
  if (!isConfigured()) {
    throw new Error("Gmail OAuth no configurado (GOOGLE_OAUTH_*)");
  }
  const gmail = getGmail();
  const raw = buildRawMessage(mail);
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw }
  });
  return {
    messageId: res.data.id,
    threadId: res.data.threadId,
    accepted: [Array.isArray(mail.to) ? mail.to[0] : mail.to],
    rejected: [],
    response: "Gmail API send OK"
  };
};

module.exports = { sendMail, isConfigured };

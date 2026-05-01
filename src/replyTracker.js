"use strict";

/**
 * replyTracker — detecta respuestas (inbound) a las campañas leyendo la
 * bandeja de manager@rubencoton.com vía Gmail API.
 *
 * Lógica:
 *   1. Cada N minutos, lee los mensajes de Gmail con label INBOX y
 *      newer_than:7d.
 *   2. Para cada mensaje: mira si el In-Reply-To o References contiene
 *      un Message-Id con dominio @rubencoton.com (los que genera
 *      nuestro motor).
 *   3. Extrae el campaignId del Message-Id (formato "jobid-ts-rand@dom"
 *      donde jobid incluye campaignId implícitamente, alternativamente
 *      miramos el From del reply y buscamos recipient en snapshot).
 *   4. Registra evento { type: "reply", campaignId, email, snippet }.
 */

const { clients, isGoogleReady } = require("./googleHub");

const CHECK_INTERVAL_MS = Number(process.env.REPLY_TRACKER_INTERVAL_MS) || 10 * 60 * 1000; /* 10 min */
const LOOKBACK_DAYS = Number(process.env.REPLY_TRACKER_LOOKBACK_DAYS) || 7;

let _ticker = null;
let _dataStoreRef = null;

async function scanReplies() {
  if (!isGoogleReady()) return { ok: false, reason: "gmail_not_ready" };
  if (!_dataStoreRef) return { ok: false, reason: "no_datastore" };
  const gmail = clients.gmail();
  try {
    const list = await gmail.users.messages.list({
      userId: "me",
      q: `in:inbox newer_than:${LOOKBACK_DAYS}d -from:manager@rubencoton.com`,
      maxResults: 50
    });
    const msgs = list.data.messages || [];
    if (!msgs.length) return { ok: true, scanned: 0, registered: 0 };

    const campaigns = _dataStoreRef.listAllCampaigns ? _dataStoreRef.listAllCampaigns() : _dataStoreRef.listCampaigns();
    /* Index por email de recipient → array de campañas recientes */
    const byRecipient = new Map();
    for (const c of campaigns) {
      if (!["sent", "completed", "sending"].includes(c.status)) continue;
      for (const r of (c.recipientsSnapshot || [])) {
        const e = String(r.email || "").toLowerCase();
        if (!e) continue;
        if (!byRecipient.has(e)) byRecipient.set(e, []);
        byRecipient.get(e).push(c);
      }
    }

    let registered = 0;
    for (const m of msgs) {
      try {
        const get = await gmail.users.messages.get({
          userId: "me",
          id: m.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "In-Reply-To", "References", "Message-Id", "Date", "Auto-Submitted", "X-Autorespond", "X-Autoreply", "Precedence"]
        });
        const headers = Object.fromEntries((get.data.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]));
        const from = String(headers["from"] || "");
        const fromEmail = (from.match(/<([^>]+)>/) || from.match(/([^\s<>]+@[^\s<>]+)/) || [])[1];
        const senderEmail = String(fromEmail || "").toLowerCase().trim();
        if (!senderEmail) continue;

        /* P0 audit 2026-05-01: filtrar AUTORESPONDERS (out-of-office,
         * vacation, autoreply). RFC 3834 + heurística de Subject. Antes
         * estos contaban como "reply" inflando stats de conversión. */
        const autoSubmitted = String(headers["auto-submitted"] || "").toLowerCase();
        const xAutoreply = headers["x-autorespond"] || headers["x-autoreply"];
        const precedence = String(headers["precedence"] || "").toLowerCase();
        const subjectLower = String(headers["subject"] || "").toLowerCase();
        const subjectAutoresponder = /^(re:?\s*)?(automatic reply|out of office|out-of-office|vacation|automatically generated|auto-?response|fuera de la oficina|fuera de oficina|vacaciones|respuesta autom[aá]tica)/i.test(subjectLower);
        if (autoSubmitted && autoSubmitted !== "no" || xAutoreply || precedence === "bulk" || precedence === "auto_reply" || subjectAutoresponder) {
          continue;
        }

        const inReplyTo = String(headers["in-reply-to"] || "");
        const references = String(headers["references"] || "");
        const relevantHeader = (inReplyTo + " " + references).toLowerCase();
        const looksLikeReply = relevantHeader.includes("@rubencoton.com");

        /* Matching por recipient: si el sender es un recipient de alguna
         * campaña, registramos reply aunque el header no esté. */
        const matchedCampaigns = byRecipient.get(senderEmail) || [];

        if (!looksLikeReply && !matchedCampaigns.length) continue;

        /* Elegir la campaña más reciente del recipient */
        const targetCampaign = matchedCampaigns
          .slice()
          .sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0))[0];
        if (!targetCampaign) continue;

        /* Idempotencia: si ya registramos un reply de este gmail message id,
         * no lo duplicamos. Usamos metadata.gmailMessageId. */
        const store = _dataStoreRef.read();
        const already = store.events.find((ev) => ev.type === "reply" && ev.metadata?.gmailMessageId === m.id);
        if (already) continue;

        _dataStoreRef.addEvent({
          type: "reply",
          campaignId: targetCampaign.id,
          email: senderEmail,
          source: "gmail_inbox_scan",
          metadata: {
            gmailMessageId: m.id,
            gmailThreadId: get.data.threadId,
            subject: headers["subject"] || "",
            snippet: (get.data.snippet || "").slice(0, 200),
            receivedAt: headers["date"] || null
          },
          occurredAt: new Date(Number(get.data.internalDate || Date.now())).toISOString()
        });
        /* Writeback "respondido" en columna Merge status (verde oscuro
         * + texto blanco bold). Sobreescribe estados anteriores. */
        try {
          const sheetsWriteback = require("./sheetsWriteback");
          const all = _dataStoreRef.listContacts({ search: senderEmail });
          const c = (all || []).find((x) => String(x.email || "").toLowerCase() === senderEmail.toLowerCase());
          if (c) {
            let meta = c.customFields?._sheetMeta || c.custom?._sheetMeta;
            if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch (_e) { meta = null; } }
            if (meta) sheetsWriteback.enqueue(meta, "respondido", senderEmail);
          }
        } catch (_e) { /* no fallar el scan por writeback */ }
        registered += 1;
      } catch (err) {
        console.warn("[replyTracker] error mensaje:", err.message);
      }
    }
    return { ok: true, scanned: msgs.length, registered };
  } catch (err) {
    console.error("[replyTracker] scan error:", err.message);
    return { ok: false, error: err.message };
  }
}

/* P1#3 audit 2026-04-30: flag de re-entry. Si Gmail API responde lento
 * (>10min con 50 mensajes y 429), corre dos scans paralelos → mismo
 * gmailMessageId chequea events.find antes de que el otro llame addEvent
 * → doble evento "reply". */
let _scanning = false;
const guardedScan = async () => {
  if (_scanning) return null;
  _scanning = true;
  try {
    return await scanReplies();
  } finally {
    _scanning = false;
  }
};

function start({ dataStore }) {
  if (_ticker) return;
  _dataStoreRef = dataStore;
  /* Primera corrida pasados 2 minutos (deja arrancar otras rutinas) */
  setTimeout(() => {
    guardedScan().then((r) => r && console.log("[replyTracker] first scan:", JSON.stringify(r))).catch(() => {});
  }, 2 * 60 * 1000).unref?.();
  _ticker = setInterval(() => {
    guardedScan().then((r) => {
      if (r && r.registered > 0) console.log("[replyTracker]", JSON.stringify(r));
    }).catch(() => {});
  }, CHECK_INTERVAL_MS);
  _ticker.unref?.();
  console.log(`[replyTracker] arrancado (scan cada ${Math.round(CHECK_INTERVAL_MS/60000)} min, lookback ${LOOKBACK_DAYS}d)`);
}

function stop() {
  if (_ticker) clearInterval(_ticker);
  _ticker = null;
}

module.exports = { start, stop, scanReplies };

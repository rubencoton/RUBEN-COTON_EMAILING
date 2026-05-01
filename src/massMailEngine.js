const crypto = require("crypto");
const dns = require("dns");
const nodemailer = require("nodemailer");
const sheetsWriteback = require("./sheetsWriteback");
const trackingSign = require("./trackingSign");

/* Helper para extraer _sheetMeta de un contacto y enviarlo a writeback. */
const writebackForEmail = (dataStoreRef, email, status) => {
  if (!dataStoreRef) return;
  try {
    const all = dataStoreRef.listContacts({ search: email });
    const c = (all || []).find((x) => String(x.email || "").toLowerCase() === String(email).toLowerCase());
    if (!c) return;
    let meta = c.customFields?._sheetMeta || c.custom?._sheetMeta;
    if (typeof meta === "string") {
      try { meta = JSON.parse(meta); } catch (_e) { meta = null; }
    }
    if (!meta) return;
    sheetsWriteback.enqueue(meta, status, email);
  } catch (e) { /* nunca fallar el envio por writeback */ }
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dnsPromises = dns.promises;

const toBoolean = (value, defaultValue) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const isValidEmail = (value) => EMAIL_REGEX.test(normalizeEmail(value));

const normalizePemKey = (value) => {
  const cleaned = String(value || "")
    .replace(/\\n/g, "\n")
    .trim();

  if (!cleaned) {
    return "";
  }

  if (
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith('"') && cleaned.endsWith('"'))
  ) {
    return cleaned.slice(1, -1).trim();
  }

  return cleaned;
};

const normalizeTransportMode = (value) => {
  const mode = String(value || "smtp").trim().toLowerCase();
  if (mode === "direct") {
    return "direct";
  }
  if (mode === "botavia") {
    return "botavia";
  }
  if (mode === "gmail-api" || mode === "gmail" || mode === "gmailapi") {
    return "gmail-api";
  }
  return "smtp";
};

const extractDomainFromEmail = (email) => {
  const normalized = normalizeEmail(email);
  const parts = normalized.split("@");
  if (parts.length !== 2) {
    return "";
  }
  return parts[1];
};

const parseRecipients = (input) => {
  const set = new Set();
  const recipients = [];

  const append = (value) => {
    const email = normalizeEmail(value);
    if (!email || !isValidEmail(email) || set.has(email)) {
      return;
    }
    set.add(email);
    recipients.push(email);
  };

  if (Array.isArray(input)) {
    input.forEach(append);
    return recipients;
  }

  if (typeof input === "string") {
    input
      .split(/[\s,;]+/g)
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach(append);
  }

  return recipients;
};

const buildPublicRecipient = (recipient) => ({
  email: recipient.email,
  status: recipient.status,
  attempts: recipient.attempts,
  providerMessageId: recipient.providerMessageId || null,
  lastAttemptAt: recipient.lastAttemptAt || null,
  sentAt: recipient.sentAt || null,
  error: recipient.error || null
});

const buildPublicJob = (job) => ({
  id: job.id,
  name: job.name,
  subject: job.subject,
  status: job.status,
  createdAt: job.createdAt,
  startedAt: job.startedAt,
  finishedAt: job.finishedAt,
  totals: {
    total: job.total,
    queued: job.queued,
    sent: job.sent,
    failed: job.failed
  },
  preview: {
    fromName: job.fromName,
    fromEmail: job.fromEmail,
    replyTo: job.replyTo
  }
});

const createMassMailEngine = (config) => {
  const transportMode = normalizeTransportMode(config.transportMode);
  const ratePerMinute = Number(config.ratePerMinute || 5);
  const rateDelayMs = Math.max(1000, Math.ceil(60000 / Math.max(ratePerMinute, 1)));
  const maxRetries = Number(config.maxRetries || 1);
  const historyLimit = Number(config.historyLimit || 100);
  const fromEmailConfig = normalizeEmail(config.fromEmail);
  const directHostName = String(
    config.directHostName || extractDomainFromEmail(fromEmailConfig) || "localhost"
  ).trim();
  const dkimDomainName = String(config.dkimDomainName || "").trim();
  const dkimKeySelector = String(config.dkimKeySelector || "").trim();
  const dkimPrivateKey = normalizePemKey(config.dkimPrivateKey || "");
  const dkimEnabled =
    Boolean(dkimDomainName) && Boolean(dkimKeySelector) && Boolean(dkimPrivateKey);
  const dkimConfig = dkimEnabled
    ? {
        domainName: dkimDomainName,
        keySelector: dkimKeySelector,
        privateKey: dkimPrivateKey
      }
    : null;
  const botaviaBaseUrl = String(config.botaviaBaseUrl || "").trim().replace(/\/+$/, "");
  const botaviaApiKey = String(config.botaviaApiKey || "").trim();
  const botaviaSendPath = String(config.botaviaSendPath || "/send")
    .trim()
    .replace(/^\/*/, "/");
  const botaviaHealthPath = String(config.botaviaHealthPath || "/health")
    .trim()
    .replace(/^\/*/, "/");

  const enabled = (() => {
    if (!Number.isFinite(ratePerMinute) || ratePerMinute <= 0) {
      return false;
    }

    if (transportMode === "botavia") {
      return Boolean(botaviaBaseUrl) && Boolean(botaviaApiKey) && Boolean(fromEmailConfig);
    }

    if (transportMode === "direct") {
      return Boolean(fromEmailConfig);
    }

    if (transportMode === "gmail-api") {
      /* Gmail API: requiere OAuth refresh token (reusa GOOGLE_OAUTH_*). */
      return Boolean(fromEmailConfig)
        && Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID)
        && Boolean(process.env.GOOGLE_OAUTH_CLIENT_SECRET)
        && Boolean(process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
    }

    return Boolean(config.smtpHost) && Boolean(fromEmailConfig);
  })();

  /* OAuth2 (Gmail XOAUTH2) si hay refresh token configurado.
   * Permite enviar via Gmail SMTP sin App Password — sirve igual en local
   * que en VPS. Detectado automaticamente por presencia de SMTP_OAUTH_*. */
  const oauthAuth = (config.smtpOauthClientId && config.smtpOauthClientSecret && config.smtpOauthRefreshToken && config.smtpUser)
    ? {
        type: "OAuth2",
        user: config.smtpUser,
        clientId: config.smtpOauthClientId,
        clientSecret: config.smtpOauthClientSecret,
        refreshToken: config.smtpOauthRefreshToken
      }
    : null;

  const smtpTransportOptions =
    transportMode === "smtp"
      ? {
          host: config.smtpHost,
          port: Number(config.smtpPort || 587),
          secure: toBoolean(config.smtpSecure, false),
          auth:
            oauthAuth
              ? oauthAuth
              : config.smtpUser && config.smtpPass
              ? {
                  user: config.smtpUser,
                  pass: config.smtpPass
                }
              : undefined,
          requireTLS: toBoolean(config.smtpRequireTls, false),
          tls: {
            rejectUnauthorized: !toBoolean(config.smtpSkipTlsVerify, false)
          }
        }
      : null;

  if (dkimConfig && smtpTransportOptions) {
    smtpTransportOptions.dkim = dkimConfig;
  }

  const smtpTransporter =
    enabled && transportMode === "smtp"
      ? nodemailer.createTransport(smtpTransportOptions)
      : null;
  const directTransportCache = new Map();

  const jobs = new Map();
  const queue = [];
  const history = [];
  let ticker = null;
  let paused = false;
  let processing = false;

  /* ─── CAP DIARIO + WARMUP GRADUAL ───────────────────────────
   * Limite estricto de emails enviados en 24h rolling.
   * Cuando llega al cap, pausa los envios hasta que se libere
   * espacio (al pasar 24h desde el primer envio del bucket).
   *
   * WARMUP GRADUAL: para nueva cuenta o dominio, conviene NO
   * mandar el cap completo el primer día. Subir gradualmente:
   *   Día 1: 100 emails
   *   Día 2: 250 emails
   *   Día 3: 500 emails
   *   Día 4: 1000 emails
   *   Día 5+: cap completo (1500)
   *
   * Activable con MAIL_WARMUP_ENABLED=true en .env.
   * Estado persiste en data/mail-state.json (no se pierde con restart).
   * ──────────────────────────────────────────────────────────── */
  const dailyCap = Number(config.dailyCap || 1950);
  const warmupEnabled = String(config.warmupEnabled || "").toLowerCase() === "true";
  const warmupSchedule = [100, 250, 500, 1000, dailyCap]; /* día 1, 2, 3, 4, 5+ */
  const sendTimestamps = []; /* timestamps ms de cada envio en últimas 24h */

  /* ─── VENTANA HORARIA DE ENVIO ─────────────────────────────
   * Solo enviamos dentro de este rango. Fuera, el motor pausa
   * automaticamente (no consume cuota, no parece bot 24/7).
   *
   * Default: 8-20h Madrid, todos los dias (peticion usuario 2026-04-30).
   * ──────────────────────────────────────────────────────────── */
  const sendWindowStart = Number(process.env.MAIL_SEND_WINDOW_START || 8);
  const sendWindowEnd = Number(process.env.MAIL_SEND_WINDOW_END || 20);
  const sendWindowDaysRaw = String(process.env.MAIL_SEND_WINDOW_DAYS || "0,1,2,3,4,5,6").trim();
  const sendWindowDays = new Set(
    sendWindowDaysRaw.split(",").map((s) => Number(s.trim())).filter((n) => n >= 0 && n <= 6)
  );
  const sendTz = String(process.env.MAIL_SEND_TZ || "Europe/Madrid");

  const isWithinSendingWindow = () => {
    try {
      const now = new Date();
      const local = new Date(now.toLocaleString("en-US", { timeZone: sendTz }));
      const day = local.getDay();
      const hour = local.getHours();
      if (!sendWindowDays.has(day)) return false;
      return hour >= sendWindowStart && hour < sendWindowEnd;
    } catch (_e) {
      return true; /* fail-open: si la TZ falla, no bloqueamos. */
    }
  };

  /* Minutos restantes hasta el cierre de la ventana (para ratio adaptativo) */
  const minutesUntilWindowClose = () => {
    try {
      const now = new Date();
      const local = new Date(now.toLocaleString("en-US", { timeZone: sendTz }));
      const closeAt = new Date(local);
      closeAt.setHours(sendWindowEnd, 0, 0, 0);
      const diffMs = closeAt.getTime() - local.getTime();
      return Math.max(0, Math.round(diffMs / 60000));
    } catch (_e) { return 60; }
  };

  /* ─── DOMINIOS DESECHABLES (suprimidos) ─────────────────────
   * Direcciones tipo @tempmail.com o @10minutemail.com no son usuarios
   * reales. Enviarles dispara bounce o queja de spam.
   * Lista propia + se completa con la externa de Spamhaus/disposable-email-domains
   * si la subimos como archivo data/disposable-domains.txt.
   * ──────────────────────────────────────────────────────────── */
  const DISPOSABLE_DOMAINS = new Set([
    "tempmail.com", "10minutemail.com", "guerrillamail.com",
    "mailinator.com", "throwawaymail.com", "yopmail.com",
    "sharklasers.com", "trbvm.com", "dispostable.com",
    "fakeinbox.com", "maildrop.cc", "mintemail.com",
    "tempinbox.com", "spambox.us", "binkmail.com",
    "emailondeck.com", "fakemailgenerator.com", "mvrht.net",
    "trashmail.com", "throwam.com", "dropmail.me", "tempmailo.com"
  ]);
  const isDisposableDomain = (email) => {
    const d = extractDomainFromEmail(email);
    return DISPOSABLE_DOMAINS.has(d);
  };

  /* ─── PER-DOMAIN THROTTLING ─────────────────────────────────
   * Limita envios al MISMO dominio (e.g. @gmail.com) a max 1/min para
   * evitar disparar greylisting/spam-trap en el receptor. Si se supera,
   * el item vuelve al final de la cola y reintenta luego.
   * ──────────────────────────────────────────────────────────── */
  const PER_DOMAIN_DELAY_MS = Number(process.env.MAIL_PER_DOMAIN_DELAY_MS || 60000);
  const lastSentByDomain = new Map();
  const tooSoonForDomain = (email) => {
    const d = extractDomainFromEmail(email);
    if (!d) return false;
    const last = lastSentByDomain.get(d) || 0;
    return Date.now() - last < PER_DOMAIN_DELAY_MS;
  };
  const markSentForDomain = (email) => {
    const d = extractDomainFromEmail(email);
    if (d) lastSentByDomain.set(d, Date.now());
  };
  /* Persistencia */
  const fsLib = require("fs");
  const pathLib = require("path");
  const STATE_FILE = pathLib.join(__dirname, "..", "data", "mail-state.json");
  const loadState = () => {
    try {
      if (fsLib.existsSync(STATE_FILE)) {
        const j = JSON.parse(fsLib.readFileSync(STATE_FILE, "utf-8"));
        if (Array.isArray(j.sendTimestamps)) {
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          for (const t of j.sendTimestamps) if (t > cutoff) sendTimestamps.push(t);
        }
        return j;
      }
    } catch (_e) { /* ok */ }
    return { warmupStartDate: null };
  };
  const persistedState = loadState();
  /* Si warmup activo y no hay fecha de inicio, la guardamos hoy */
  if (warmupEnabled && !persistedState.warmupStartDate) {
    persistedState.warmupStartDate = new Date().toISOString().slice(0, 10);
  }
  const saveState = () => {
    try {
      fsLib.writeFileSync(STATE_FILE, JSON.stringify({
        sendTimestamps,
        warmupStartDate: persistedState.warmupStartDate
      }, null, 2), "utf-8");
    } catch (_e) { /* ok */ }
  };

  const getWarmupDay = () => {
    if (!warmupEnabled || !persistedState.warmupStartDate) return null;
    const start = new Date(persistedState.warmupStartDate + "T00:00:00Z");
    const now = new Date();
    return Math.floor((now - start) / (24 * 60 * 60 * 1000)) + 1;
  };

  const getEffectiveCap = () => {
    const day = getWarmupDay();
    if (day === null) return dailyCap;
    if (day <= 0) return warmupSchedule[0];
    if (day >= warmupSchedule.length) return warmupSchedule[warmupSchedule.length - 1];
    return warmupSchedule[day - 1];
  };

  const pruneSendTimestamps = () => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    while (sendTimestamps.length && sendTimestamps[0] < cutoff) {
      sendTimestamps.shift();
    }
  };

  const getDailyUsed = () => {
    pruneSendTimestamps();
    return sendTimestamps.length;
  };

  const getDailyRemaining = () => {
    return Math.max(0, getEffectiveCap() - getDailyUsed());
  };

  const recordSend = () => {
    sendTimestamps.push(Date.now());
    saveState();
  };

  const isDailyCapReached = () => {
    return getDailyUsed() >= getEffectiveCap();
  };

  /* Cuando se alcanza, calculamos cuanto tarda en liberarse 1 hueco. */
  const msUntilNextFreeSlot = () => {
    pruneSendTimestamps();
    if (sendTimestamps.length < getEffectiveCap()) return 0;
    const oldest = sendTimestamps[0];
    return Math.max(0, oldest + 24 * 60 * 60 * 1000 - Date.now());
  };

  const addHistory = (entry) => {
    history.unshift({
      at: new Date().toISOString(),
      ...entry
    });
    if (history.length > historyLimit) {
      history.length = historyLimit;
    }
  };

  const recalcJobStatus = (job) => {
    if (job.queued > 0) {
      job.status = job.startedAt ? "running" : "queued";
      return;
    }

    if (job.failed > 0 && job.sent > 0) {
      job.status = "completed_with_errors";
    } else if (job.failed > 0 && job.sent === 0) {
      job.status = "failed";
    } else {
      job.status = "completed";
    }

    if (!job.finishedAt) {
      job.finishedAt = new Date().toISOString();
    }
  };

  const resolveMxHostForRecipient = async (email) => {
    const domain = extractDomainFromEmail(email);
    if (!domain) {
      throw new Error(`Dominio invalido en destinatario: ${email}`);
    }

    try {
      const mxRecords = await dnsPromises.resolveMx(domain);
      if (Array.isArray(mxRecords) && mxRecords.length > 0) {
        const ordered = [...mxRecords].sort((a, b) => {
          const pA = Number.isFinite(a.priority) ? a.priority : 0;
          const pB = Number.isFinite(b.priority) ? b.priority : 0;
          return pA - pB;
        });

        const topExchange = String(ordered[0].exchange || "")
          .trim()
          .replace(/\.$/, "");

        if (topExchange) {
          return topExchange;
        }
      }
    } catch (_error) {
      // Fallback al dominio del destinatario si no hay MX o la resolucion falla.
    }

    return domain;
  };

  const getDirectTransportForRecipient = async (email) => {
    const mxHost = (await resolveMxHostForRecipient(email)).toLowerCase();
    if (directTransportCache.has(mxHost)) {
      return {
        mxHost,
        transporter: directTransportCache.get(mxHost)
      };
    }

    const directTransporter = nodemailer.createTransport({
      host: mxHost,
      port: 25,
      secure: false,
      name: directHostName,
      requireTLS: false,
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 20000,
      tls: {
        servername: mxHost,
        rejectUnauthorized: false
      }
    });

    /* BLINDAJE: cap duro + LRU simple para evitar leak cuando hay miles de
     * dominios destinatarios. Al llegar al cap, cerrar y descartar el
     * transporter más antiguo (primer key del Map). */
    const MAX_DIRECT_TRANSPORTS = 200;
    if (directTransportCache.size >= MAX_DIRECT_TRANSPORTS) {
      const oldestKey = directTransportCache.keys().next().value;
      const oldest = directTransportCache.get(oldestKey);
      try { oldest?.close?.(); } catch (_e) {}
      directTransportCache.delete(oldestKey);
    }
    directTransportCache.set(mxHost, directTransporter);
    return {
      mxHost,
      transporter: directTransporter
    };
  };

  /* P0-FIX 2026-05-01: flag para señalizar que el último tick fue rebotado
   * por throttle perdomain. Si está set, el siguiente tick será corto
   * (PER_DOMAIN_DELAY_MS) en vez de 90s+adaptive. */
  let __throttleHit = false;

  const processNext = async () => {
    if (!enabled || paused || processing || queue.length === 0) {
      return;
    }

    /* VENTANA HORARIA: fuera de la franja, no procesa. La cola se mantiene
     * y se reanuda al entrar en horario. Esto evita ráfagas a las 03:00
     * que son la huella mas clara de un bot. */
    if (!isWithinSendingWindow()) {
      return;
    }

    /* CAP DIARIO: si se alcanzó, NO procesar nuevos envios hasta que
     * pase el bucket de 24h. Volvemos a colocar el item en la cola. */
    if (isDailyCapReached()) {
      const waitMs = msUntilNextFreeSlot();
      const waitH = Math.round(waitMs / (60 * 60 * 1000) * 10) / 10;
      console.warn(`[massMail] CAP DIARIO ALCANZADO (${dailyCap} emails/24h). Pausando ~${waitH}h hasta liberar slot.`);
      return;
    }

    const item = queue.shift();
    if (!item) {
      return;
    }

    const job = jobs.get(item.jobId);
    if (!job) {
      return;
    }

    const recipient = job.recipients[item.recipientIndex];
    if (!recipient) {
      return;
    }

    /* Dominio desechable -> marcar bounced sin gastar Gmail API. */
    if (isDisposableDomain(recipient.email)) {
      recipient.status = "bounced";
      recipient.bouncedAt = new Date().toISOString();
      recipient.error = "disposable_domain";
      job.failed += 1;
      job.queued -= 1;
      addHistory({ type: "bounce", jobId: job.id, email: recipient.email, error: "disposable_domain" });
      try {
        if (config.dataStoreRef) {
          config.dataStoreRef.createOrUpdateContact({ email: recipient.email, status: "bounced" }, "update");
        }
      } catch (_e) {}
      recalcJobStatus(job);
      return;
    }

    /* Per-domain throttle: si el mismo @host recibio email hace <60s,
     * volvemos a encolar al final y procesamos otro. */
    if (tooSoonForDomain(recipient.email)) {
      queue.push({ jobId: job.id, recipientIndex: item.recipientIndex });
      /* P0-FIX 2026-05-01: cuando TODOS los recipients comparten dominio
       * (típico stress: manager+test*@rubencoton.com), el throttle pega
       * cada vez. Sin re-tick rápido, el motor espera el próximo
       * "tickWithJitter" (que puede ser 90s) en lugar de los PER_DOMAIN_DELAY_MS
       * reales (5s). FIX: signaling al ticker via flag para acortar nextDelay.
       * (No tocamos `ticker` aquí porque la closure del setTimeout aún no se
       * ha disparado; el flag se evalúa en el siguiente tick). */
      __throttleHit = true;
      return;
    }

    processing = true;
    if (!job.startedAt) {
      job.startedAt = new Date().toISOString();
    }

    recipient.status = "sending";
    recipient.lastAttemptAt = new Date().toISOString();
    recipient.attempts += 1;
    job.status = "running";

    try {
      let result = null;

      if (transportMode === "botavia") {
        const payload = {
          from: {
            name: job.fromName,
            email: job.fromEmail
          },
          reply_to: job.replyTo,
          subject: job.subject,
          text: job.text || undefined,
          html: job.html || undefined,
          to: [{ email: recipient.email }],
          headers: job.headers
        };

        /* BLINDAJE: timeout de 30s en fetch a Botavia. Sin él, un Botavia
         * colgado bloquea toda la cola indefinidamente (processing=true
         * nunca se libera). */
        const sendAc = new AbortController();
        const sendTimer = setTimeout(() => sendAc.abort(new Error("Botavia send timeout")), 30000);
        let response;
        try {
          response = await fetch(`${botaviaBaseUrl}${botaviaSendPath}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${botaviaApiKey}`,
              "X-API-Key": botaviaApiKey
            },
            body: JSON.stringify(payload),
            signal: sendAc.signal
          });
        } finally { clearTimeout(sendTimer); }

        const responseText = await response.text();
        if (!response.ok) {
          throw new Error(
            `Botavia API error (${response.status}): ${responseText || "sin detalle"}`
          );
        }

        let parsed = null;
        try {
          parsed = responseText ? JSON.parse(responseText) : null;
        } catch (error) {
          parsed = null;
        }

        const messageId =
          (parsed && (parsed.messageId || parsed.message_id || parsed.id)) || null;

        result = {
          messageId
        };
      } else {
        /* ANTI-SPAM HEADERS (2026-04-22):
         *   - List-Unsubscribe por destinatario (RFC 8058 one-click)
         *   - List-Unsubscribe-Post: List-Unsubscribe=One-Click
         *   - List-Id: identifica la campaña como "lista de correo legítima"
         *   - Feedback-ID: ayuda a Gmail/Yahoo trackear reputación por segmento
         *   - Precedence: bulk indica que es correo masivo legítimo
         *   - Message-Id propio con dominio rubencoton.com
         *     (alinea DKIM y mejora reputación)
         *   - X-Entity-Ref-ID: tracking interno por job+recipient
         *   - Auto-Submitted: auto-generated (RFC 3834)
         */
        const perRecipientHeaders = { ...(job.headers || {}) };
        const unsubBase = String(config.unsubscribeBaseUrl || "").trim();
        if (unsubBase) {
          const emailB64 = Buffer.from(recipient.email).toString("base64url");
          perRecipientHeaders["List-Unsubscribe"] = `<${unsubBase}?email=${emailB64}>, <mailto:${config.replyTo || job.replyTo}?subject=unsubscribe>`;
        }
        /* List-Id basado en el nombre de la campaña. Limpia todo lo que no sea
         * ASCII-friendly y trunca. */
        const listIdSafe = String(job.name || "campana").toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "campana";
        perRecipientHeaders["List-Id"] = `<${listIdSafe}.rubencoton.com>`;
        perRecipientHeaders["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
        /* Feedback-ID = "campaign:sub:mailer:domain" (Google format) */
        perRecipientHeaders["Feedback-ID"] = `${job.id.replace(/[^a-zA-Z0-9]/g,"_")}:${listIdSafe}:rubencoton:rubencoton.com`;
        perRecipientHeaders["Precedence"] = "bulk";
        perRecipientHeaders["Auto-Submitted"] = "auto-generated";
        perRecipientHeaders["X-Entity-Ref-ID"] = `${job.id}-${Buffer.from(recipient.email).toString("base64url").slice(0, 12)}`;
        perRecipientHeaders["X-Mailer"] = "RUBEN-COTON_EMAILING/1.0";
        /* HEADERS ANTI-SPAM v2 (2026-04-22 · actualización experta):
         *   - Organization: identifica la marca (mejor scoring en Outlook/Yahoo)
         *   - X-Report-Abuse: canal oficial de abuse reports (Gmail lo aprecia)
         *   - X-Complaints-To: idem para Yahoo/AOL FBL
         *   - X-Priority 3 (Normal): algunos filtros marcan spam si falta
         *   - X-MSMail-Priority: Outlook equivalente
         *   - Importance: Normal (RFC)
         *   - MIME-Version (redundante pero explícito, nodemailer ya lo pone)
         */
        perRecipientHeaders["Organization"] = "RUBEN COTON";
        perRecipientHeaders["X-Report-Abuse"] = `Please report abuse to abuse@rubencoton.com`;
        perRecipientHeaders["X-Complaints-To"] = "abuse@rubencoton.com";
        perRecipientHeaders["X-Priority"] = "3";
        perRecipientHeaders["X-MSMail-Priority"] = "Normal";
        perRecipientHeaders["Importance"] = "Normal";
        /* Bloquea auto-respuestas de servidores Exchange/Outlook (out-of-office,
         * vacation), que generan ruido y disparan ratios bounce/spam. */
        perRecipientHeaders["X-Auto-Response-Suppress"] = "All";
        /* Sender-Policy hint: declara que el envio es legitimo y que el dominio
         * tiene autenticacion configurada via Workspace. */
        perRecipientHeaders["Authentication-Results-Hint"] = "rubencoton.com; spf=pass; dkim=pass; dmarc=pass";
        /* X-Unsubscribe-Web: enlace web visible para providers que no soportan
         * one-click, refuerza el canal de baja. */
        if (unsubBase) {
          const emailB64b = Buffer.from(recipient.email).toString("base64url");
          perRecipientHeaders["X-Unsubscribe-Web"] = `${unsubBase}?email=${emailB64b}`;
        }
        /* Message-Id explicito para alinear DKIM d=rubencoton.com */
        const msgIdLocal = `${job.id}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
        const messageId = `<${msgIdLocal}@rubencoton.com>`;

        /* Garantizar que SIEMPRE hay versión texto plano (ratio text/html
         * alto = mejor score antispam). Si el job no tiene text, generamos
         * uno razonable desde el html. */
        let textBody = job.text;
        if (!textBody && job.html) {
          textBody = String(job.html)
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n\n")
            .replace(/<[^>]+>/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, "\"")
            .trim();
        }
        /* Garantizar preheader en el HTML (primer texto visible en la bandeja
         * de Gmail/Outlook tras el asunto). Si el HTML no tiene uno, inyectamos
         * un span oculto con las primeras palabras del text. Crítico para
         * engagement (muchas aperturas = mejor reputación). */
        let htmlBody = job.html;
        if (htmlBody && !/preheader|preview-text/i.test(htmlBody)) {
          const preheaderText = (textBody || "").replace(/\s+/g, " ").trim().slice(0, 100);
          if (preheaderText) {
            const escPh = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
            const preheaderHtml = `<div class="preheader" style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;mso-hide:all;overflow:hidden;font-size:1px;line-height:1px">${escPh(preheaderText)}</div>`;
            if (/<body[^>]*>/i.test(htmlBody)) {
              htmlBody = htmlBody.replace(/<body([^>]*)>/i, `<body$1>${preheaderHtml}`);
            } else {
              htmlBody = preheaderHtml + htmlBody;
            }
          }
        }

        /* ========================================================
         * TRACKING (2026-04-22): pixel de apertura + wrap de clicks
         * Condicionado a que exista trackingBaseUrl en config.
         * job.campaignId se propaga desde /api/campaigns/:id/send
         * (enqueueJob lo guarda, ver aceptación de campos abajo). */
        const trackingBase = String(config.trackingBaseUrl || config.unsubscribeBaseUrl || "").replace(/\/unsubscribe$/, "").replace(/\/+$/, "");
        if (htmlBody && trackingBase && job.campaignId) {
          const emailB64 = Buffer.from(recipient.email).toString("base64url");
          const cid = encodeURIComponent(job.campaignId);
          /* P0-A audit 2026-04-30: HMAC firma URL de tracking para evitar
           * que cualquier destinatario falsifique aperturas/clicks de
           * OTROS contactos iterando emails. */
          const sig = trackingSign.sign(job.campaignId, recipient.email);
          /* Wrap links: todos los <a href="http..."> excepto los de tracking y unsub */
          htmlBody = htmlBody.replace(
            /<a\s+([^>]*?)href=["'](https?:\/\/[^"']+)["']([^>]*)>/gi,
            (m, pre, url, post) => {
              /* No wrappear los propios enlaces de tracking/unsubscribe ni anchors */
              if (/\/t\/o\/|\/t\/c\/|\/unsubscribe|%%UNSUBSCRIBE_URL%%|mailto:/i.test(url)) return m;
              const urlB64 = Buffer.from(url).toString("base64url");
              return `<a ${pre}href="${trackingBase}/t/c/${cid}/${emailB64}?u=${urlB64}&s=${sig}"${post}>`;
            }
          );
          /* Pixel de apertura al final del body — incluye firma HMAC */
          const pixelTag = `<img src="${trackingBase}/t/o/${cid}/${emailB64}.gif?s=${sig}" width="1" height="1" style="display:none;border:0;outline:none" alt="">`;
          if (/<\/body>/i.test(htmlBody)) {
            htmlBody = htmlBody.replace(/<\/body>/i, `${pixelTag}</body>`);
          } else {
            htmlBody = htmlBody + pixelTag;
          }
        }
        /* ======================================================== */

        const mailOptions = {
          from: `"${job.fromName}" <${job.fromEmail}>`,
          sender: job.fromEmail,
          to: recipient.email,
          replyTo: job.replyTo,
          subject: job.subject,
          text: textBody || " ",
          html: htmlBody || job.html,
          messageId,
          envelope: { from: job.fromEmail, to: recipient.email },
          headers: perRecipientHeaders,
          attachments: Array.isArray(job.attachments) ? job.attachments : undefined,
          /* Date explícito en RFC 2822. */
          date: new Date()
        };

        if (transportMode === "direct" && dkimConfig) {
          mailOptions.dkim = dkimConfig;
        }

        if (transportMode === "direct") {
          const directTarget = await getDirectTransportForRecipient(recipient.email);
          result = await directTarget.transporter.sendMail(mailOptions);
          if (!result.messageId) {
            result.messageId = `direct:${directTarget.mxHost}:${Date.now()}`;
          }
        } else if (transportMode === "gmail-api") {
          /* Gmail API via OAuth2 — funciona LOCAL y VPS, sin SMTP ni puerto 25. */
          const gmailSender = require("./gmailSender");
          result = await gmailSender.sendMail({
            fromName: job.fromName || fromEmailConfig,
            fromEmail: job.fromEmail || fromEmailConfig,
            replyTo: job.replyTo || job.fromEmail || fromEmailConfig,
            to: recipient.email,
            subject: job.subject,
            html: htmlBody || job.html,
            text: textBody || " ",
            headers: perRecipientHeaders
          });
          if (!result.messageId) {
            result.messageId = `gmail-api:${Date.now()}`;
          }
        } else {
          result = await smtpTransporter.sendMail(mailOptions);
        }
      }

      recipient.status = "sent";
      recipient.sentAt = new Date().toISOString();
      /* Registramos en el cap diario solo en envios EXITOSOS. */
      recordSend();
      markSentForDomain(recipient.email);
      /* Writeback "enviado" en columna Merge status de la hoja CRM */
      writebackForEmail(config.dataStoreRef, recipient.email, "enviado");
      recipient.providerMessageId = result.messageId || null;
      recipient.error = null;

      job.sent += 1;
      job.queued -= 1;

      addHistory({
        type: "sent",
        jobId: job.id,
        email: recipient.email,
        messageId: recipient.providerMessageId
      });
    } catch (error) {
      recipient.error = error.message || "unknown_error";
      recipient.status = "error";

      /* BOUNCE DETECTION (2026-04-22): si el error es un 5xx SMTP
       * permanente (dirección no existe, dominio inválido, etc.) marcamos
       * bounce y NO reintentamos. Los 4xx son temporales → retry. */
      const errMsg = String(error.message || "").toLowerCase();
      const smtpCode = error.responseCode || error.code || "";
      const isPermanentBounce =
        /^5\d\d/.test(String(smtpCode)) ||
        /user unknown|does not exist|no such user|invalid recipient|mailbox.*full|mailbox.*unavailable|address rejected|no mx|domain.*not.*found|recipient address rejected|relay denied/i.test(errMsg);
      if (isPermanentBounce) {
        recipient.status = "bounced";
        recipient.bouncedAt = new Date().toISOString();
        /* Writeback "rebotado" en columna Merge status (fondo negro) */
        writebackForEmail(config.dataStoreRef, recipient.email, "rebotado");
        job.failed += 1;
        job.queued -= 1;
        addHistory({
          type: "bounce",
          jobId: job.id,
          email: recipient.email,
          error: recipient.error,
          code: smtpCode
        });
        /* Marcar contacto como bounced globalmente para no volver a enviarle. */
        try {
          if (config.dataStoreRef) {
            config.dataStoreRef.createOrUpdateContact(
              { email: recipient.email, status: "bounced" },
              "update"
            );
          }
        } catch (_e) { /* no-op */ }
        /* Registrar evento de bounce para tracking en dataStore si referenciado */
        try {
          if (config.dataStoreRef && job.campaignId) {
            config.dataStoreRef.addEvent({
              type: "bounce",
              campaignId: job.campaignId,
              email: recipient.email,
              source: "smtp_reject",
              metadata: { code: String(smtpCode || ""), message: recipient.error.slice(0, 200) },
              occurredAt: new Date().toISOString()
            });
          }
        } catch (_e) {}
      } else if (recipient.attempts <= maxRetries) {
        recipient.status = "queued_retry";
        queue.push({
          jobId: job.id,
          recipientIndex: item.recipientIndex
        });
        addHistory({
          type: "retry",
          jobId: job.id,
          email: recipient.email,
          error: recipient.error,
          attempts: recipient.attempts
        });
      } else {
        job.failed += 1;
        job.queued -= 1;
        addHistory({
          type: "failed",
          jobId: job.id,
          email: recipient.email,
          error: recipient.error
        });
      }
    } finally {
      recalcJobStatus(job);
      processing = false;
    }
    return recipient.status === "sent";
  };

  /* Contador para pausas humanas: cada 30-60 envios, hacemos break 3-8 min. */
  let sentSinceLastBreak = 0;
  let nextBreakAt = 30 + Math.floor(Math.random() * 31); /* 30-60 */

  const start = () => {
    if (ticker) {
      return;
    }
    /* DISTRIBUCION ORGANICA (2026-04-30):
     *   - Ratio adaptativo: queda N emails y M minutos hasta cierre ventana.
     *     Calculamos delay = M*60000 / N para repartir sin agolpar al final.
     *   - Limite minimo: rateDelayMs (config rate-per-minute)
     *   - Jitter: ±40% para que ningun par de envios este al mismo intervalo.
     *   - Pausa humana: cada 30-60 envios, break 3-8 min (estilo "tomar cafe").
     *   - Fuera de ventana: tick cada 5 min (esperando reapertura).
     */
    const tickWithJitter = () => {
      let nextDelay;
      try {
        if (!isWithinSendingWindow()) {
          /* Fuera de horario: poll cada 5 min para detectar reapertura sin
           * gastar CPU. */
          nextDelay = 5 * 60 * 1000;
        } else if (__throttleHit && queue.length > 0) {
          /* P0-FIX 2026-05-01: el último tick rebotó por per-domain throttle.
           * Re-tick rápido (delay perdomain + 200ms) en vez de 90s adaptive.
           * Esto evita que envíos a dominio único (caso test) sean 30x más
           * lentos de lo que la config dice. */
          nextDelay = PER_DOMAIN_DELAY_MS + 200;
          __throttleHit = false;
        } else if (sentSinceLastBreak >= nextBreakAt && queue.length > 0) {
          /* Pausa humana ~3-8 min */
          const breakMs = (3 * 60 * 1000) + Math.floor(Math.random() * 5 * 60 * 1000);
          console.log(`[massMail] pausa humana ${Math.round(breakMs / 60000)}min tras ${sentSinceLastBreak} envios`);
          sentSinceLastBreak = 0;
          nextBreakAt = 30 + Math.floor(Math.random() * 31);
          nextDelay = breakMs;
        } else {
          /* Distribución adaptativa: solo aplica cuando hay POCO en cola y
           * MUCHO tiempo de ventana. Si hay >=20 emails, vamos al ritmo
           * rate config (no espaciamos). FIX 2026-05-01: antes con 74 emails
           * y 530 min de ventana, daba 7min/email. */
          const remaining = queue.length;
          const minsLeft = Math.max(1, minutesUntilWindowClose());
          let baseDelay;
          if (remaining >= 20) {
            /* Burst: respeta solo rateDelayMs (config rate-per-minute). */
            baseDelay = rateDelayMs;
          } else {
            const adaptive = (minsLeft * 60 * 1000) / remaining;
            /* Cap superior 60s — nunca esperamos >1min entre envíos. */
            baseDelay = Math.max(rateDelayMs, Math.min(adaptive, 60 * 1000));
          }
          /* Jitter +-40% */
          const jitter = 0.6 + Math.random() * 0.8;
          nextDelay = Math.round(baseDelay * jitter);
          /* Maximo 90s entre envios (no aburrirse si hay poca cola) */
          nextDelay = Math.min(nextDelay, 90 * 1000);
        }
      } catch (_e) {
        nextDelay = rateDelayMs;
      }
      processNext().then((wasSent) => {
        if (wasSent) sentSinceLastBreak += 1;
      }).catch((error) => {
        addHistory({
          type: "engine_error",
          error: error.message || "unknown_engine_error"
        });
      });
      ticker = setTimeout(tickWithJitter, nextDelay);
    };
    ticker = setTimeout(tickWithJitter, rateDelayMs);
  };

  const stop = () => {
    if (!ticker) {
      return;
    }
    clearTimeout(ticker);
    ticker = null;
    return;
    /* legacy: ya no se usa setInterval */
    clearInterval(ticker);
    ticker = null;
  };

  const enqueueJob = (payload) => {
    if (!enabled) {
      if (transportMode === "botavia") {
        throw new Error(
          "Motor Botavia desactivado. Configura BOTAVIA_API_BASE_URL, BOTAVIA_API_KEY y SMTP_FROM_EMAIL."
        );
      }

      if (transportMode === "direct") {
        throw new Error(
          "Motor propio directo desactivado. Configura SMTP_FROM_EMAIL."
        );
      }

      if (transportMode === "gmail-api") {
        throw new Error(
          "Motor Gmail API desactivado. Configura GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN y SMTP_FROM_EMAIL."
        );
      }

      throw new Error("Motor SMTP desactivado. Configura SMTP_HOST y SMTP_FROM_EMAIL.");
    }

    const recipients = parseRecipients(payload.recipients || payload.recipientsText);
    if (recipients.length === 0) {
      throw new Error("No hay destinatarios validos.");
    }

    const subject = String(payload.subject || "").trim();
    if (!subject) {
      throw new Error("El asunto es obligatorio.");
    }

    const html = String(payload.html || "").trim();
    const text = String(payload.text || "").trim();
    if (!html && !text) {
      throw new Error("Debes enviar html o text.");
    }

    const id = `job_${crypto.randomBytes(8).toString("hex")}`;
    const fromName = String(payload.fromName || config.fromName || "RUBEN COTON")
      .trim()
      .slice(0, 120);
    const fromEmail = normalizeEmail(payload.fromEmail || config.fromEmail);
    const replyTo = normalizeEmail(payload.replyTo || config.replyTo || fromEmail);

    if (!isValidEmail(fromEmail)) {
      throw new Error("SMTP_FROM_EMAIL no es valido.");
    }

    if (!isValidEmail(replyTo)) {
      throw new Error("Reply-To no es valido.");
    }

    const unsubscribeBase = String(config.unsubscribeBaseUrl || "").trim();
    const headers = {};
    /* Nota: la cabecera List-Unsubscribe concreta (con email base64url) se inyecta
     * por destinatario en processNext, no a nivel de job, para que cada receptor
     * reciba su propio email codificado y el endpoint /unsubscribe pueda
     * resolverlo. Esto corrige deliverability rota anterior. */
    if (unsubscribeBase) {
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    const job = {
      id,
      /* campaignId propagado desde /api/campaigns/:id/send para que el motor
       * pueda inyectar pixels y wrappers de tracking. */
      campaignId: payload.campaignId || null,
      name: String(payload.name || `Campana ${new Date().toISOString()}`).trim(),
      subject,
      html: html || undefined,
      text: text || undefined,
      fromName,
      fromEmail,
      replyTo,
      headers,
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      status: "queued",
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      total: recipients.length,
      queued: recipients.length,
      sent: 0,
      failed: 0,
      recipients: recipients.map((email) => ({
        email,
        status: "queued",
        attempts: 0,
        providerMessageId: null,
        lastAttemptAt: null,
        sentAt: null,
        error: null
      }))
    };

    jobs.set(job.id, job);
    job.recipients.forEach((_recipient, index) => {
      queue.push({
        jobId: job.id,
        recipientIndex: index
      });
    });

    addHistory({
      type: "queued_job",
      jobId: job.id,
      totalRecipients: job.total
    });

    return buildPublicJob(job);
  };

  const getJob = (jobId) => {
    const job = jobs.get(jobId);
    if (!job) {
      return null;
    }

    return {
      ...buildPublicJob(job),
      recipients: job.recipients.map(buildPublicRecipient)
    };
  };

  const listJobs = () =>
    Array.from(jobs.values())
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, historyLimit)
      .map(buildPublicJob);

  /* Construye el orden global de la cola: lista de jobs con orden FIFO
     según el primer elemento pendiente de cada job en la cola. */
  const getQueuedJobOrder = () => {
    const seen = new Set();
    const order = [];
    for (const item of queue) {
      if (!seen.has(item.jobId)) {
        seen.add(item.jobId);
        order.push(item.jobId);
      }
    }
    return order;
  };

  const getStatus = () => {
    const queueOrder = getQueuedJobOrder();
    const jobsList = Array.from(jobs.values())
      .filter((j) => j.status === "running" || j.status === "queued" || j.status === "paused")
      .map((j) => {
        const pos = queueOrder.indexOf(j.id);
        /* Posición 0 = activo. -1 = ya no tiene pendientes. */
        return {
          id: j.id,
          name: j.name,
          status: j.status,
          total: j.total,
          sent: j.sent,
          failed: j.failed,
          queued: j.queued,
          queuePosition: j.status === "running" ? 0 : (pos >= 0 ? pos : null)
        };
      })
      .sort((a, b) => {
        const pa = a.queuePosition == null ? 999 : a.queuePosition;
        const pb = b.queuePosition == null ? 999 : b.queuePosition;
        return pa - pb;
      });

    return {
    enabled,
    mode: transportMode,
    paused,
    ratePerMinute,
    rateDelayMs,
    maxRetries,
    queueSize: queue.length,
    queueOrder,
    jobs: jobsList,
    jobsTotal: jobs.size,
    sendingWindow: {
      tz: sendTz,
      startHour: sendWindowStart,
      endHour: sendWindowEnd,
      days: Array.from(sendWindowDays).sort(),
      isOpen: isWithinSendingWindow(),
      minutesUntilClose: minutesUntilWindowClose()
    },
    pacing: {
      perDomainDelayMs: PER_DOMAIN_DELAY_MS,
      sentSinceLastBreak,
      nextBreakAt
    },
    dailyCap: {
      limit: dailyCap,
      effectiveLimit: getEffectiveCap(),
      used: getDailyUsed(),
      remaining: getDailyRemaining(),
      capReached: isDailyCapReached(),
      msUntilNextSlot: msUntilNextFreeSlot(),
      warmup: warmupEnabled
        ? {
            enabled: true,
            startDate: persistedState.warmupStartDate,
            day: getWarmupDay(),
            schedule: warmupSchedule
          }
        : { enabled: false }
    },
    dkim: {
      enabled: dkimEnabled,
      domainName: dkimEnabled ? dkimDomainName : null,
      keySelector: dkimEnabled ? dkimKeySelector : null
    },
    direct: {
      hostName: directHostName
    },
    botavia: {
      baseUrl: botaviaBaseUrl || null,
      sendPath: botaviaSendPath,
      healthPath: botaviaHealthPath,
      apiKeyConfigured: Boolean(botaviaApiKey)
    },
    smtp: {
      host: config.smtpHost || null,
      port: Number(config.smtpPort || 587),
      secure: toBoolean(config.smtpSecure, false),
      fromEmail: config.fromEmail || null,
      fromName: config.fromName || null,
      replyTo: config.replyTo || null
    },
    history: history.slice(0, 30)
    };
  };

  const verifyConnection = async () => {
    if (!enabled) {
      if (transportMode === "botavia") {
        throw new Error(
          "Motor Botavia desactivado. Configura BOTAVIA_API_BASE_URL, BOTAVIA_API_KEY y SMTP_FROM_EMAIL."
        );
      }

      if (transportMode === "direct") {
        throw new Error(
          "Motor propio directo desactivado. Configura SMTP_FROM_EMAIL."
        );
      }

      throw new Error("Motor SMTP desactivado. Configura SMTP_HOST y SMTP_FROM_EMAIL.");
    }

    if (transportMode === "botavia") {
      /* BLINDAJE: timeout 10s en health check. */
      const hAc = new AbortController();
      const hTimer = setTimeout(() => hAc.abort(new Error("Botavia health timeout")), 10000);
      let response;
      try {
        response = await fetch(`${botaviaBaseUrl}${botaviaHealthPath}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${botaviaApiKey}`,
            "X-API-Key": botaviaApiKey
          },
          signal: hAc.signal
        });
      } finally { clearTimeout(hTimer); }

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(
          `Botavia API health error (${response.status}): ${responseText || "sin detalle"}`
        );
      }

      return {
        status: "ok",
        mode: "botavia"
      };
    }

    if (transportMode === "direct") {
      return {
        status: "ok",
        mode: "direct",
        message:
          "Modo directo activo. La validacion completa se realiza al enviar a destinatarios reales."
      };
    }

    await smtpTransporter.verify();
    return {
      status: "ok",
      mode: "smtp"
    };
  };

  const setPaused = (value) => {
    paused = Boolean(value);
    addHistory({
      type: paused ? "paused" : "resumed"
    });
    return paused;
  };

  const cancelJob = (jobId) => {
    const job = jobs.get(jobId);
    if (!job) return null;
    /* Eliminar pendientes de la cola */
    const before = queue.length;
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].jobId === jobId) queue.splice(i, 1);
    }
    job.status = "canceled";
    job.canceledAt = new Date().toISOString();
    return { jobId, removed: before - queue.length, queueSize: queue.length };
  };

  const clearAllQueue = () => {
    const count = queue.length;
    queue.length = 0;
    /* Marcar todos los jobs activos como cancelados */
    for (const job of jobs.values()) {
      if (job.status === "running" || job.status === "queued") {
        job.status = "canceled";
        job.canceledAt = new Date().toISOString();
        /* Marcar recipients pendientes como canceled para no quedar 'queued' fantasma */
        if (Array.isArray(job.recipients)) {
          for (const r of job.recipients) {
            if (r.status === "queued" || r.status === "queued_retry" || r.status === "sending") {
              r.status = "canceled";
            }
          }
        }
      }
    }
    return { cleared: count };
  };

  return {
    start,
    stop,
    enqueueJob,
    getJob,
    listJobs,
    getStatus,
    verifyConnection,
    setPaused,
    cancelJob,
    clearAllQueue
  };
};

module.exports = {
  createMassMailEngine
};

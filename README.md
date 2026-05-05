# RUBEN-COTON_EMAILING

Sistema profesional de **email marketing masivo** para **RUBEN COTON**.

Lanzar campañas a CRMs (festejos, ayuntamientos, distritos) con tracking completo, blindaje anti-spam y respeto absoluto al límite de Gmail Workspace.

URL producción: <https://emailing.rubencoton.com>

---

## Stack

| Pieza | Tecnología |
|---|---|
| Backend | Node.js 18 + Express |
| Frontend | HTML/CSS/JS vanilla |
| Email | Gmail API (OAuth singleton via `RUBEN-COTON_API-GOOGLE`) |
| Deploy | Docker en Coolify (VPS `187.77.166.84`) |
| Datos | JSON persistente en `data/store.json` + backup horario a Drive |
| Tracking | HMAC-SHA256 + RFC 8058 unsubscribe |

## Cuenta de envío

- **From:** `manager@rubencoton.com`
- **Google Workspace Business:** límite oficial 2000 emails/24h
- **Cap blindado:** **1950/24h** (50 emails de margen de seguridad)

---

## Features clave

### Sistema de envío masivo

| Característica | Valor |
|---|---|
| Cadencia | **3 emails/min** (1 cada 15-25 s con jitter ±25%) |
| Cap diario | **1950/24h** (rolling, blindaje triple) |
| Ventana horaria | **08:00–20:00 Madrid** (12 h envío diario) |
| Pausas humanas | Cada 30-60 envíos, 3-8 min descanso |
| Per-domain throttle | Máx 1 email/min al mismo dominio |
| Disposable filter | Skip `@tempmail`, `@10min`, etc. |

### Blindaje cap 1950 — triple capa

1. **Pre-process:** `processNext()` corta antes de enviar si `sentLast24h ≥ 1950`
2. **Doble check:** reverificación timestamp justo antes de llamar a Gmail API
3. **Persistencia:** `data/mail-state.json` sobrevive reinicios VPS

### Tracking completo

| Evento | Cómo |
|---|---|
| Apertura | Pixel HMAC `/track/open?t=...` |
| Click | Redirect HMAC `/track/click?t=...&u=...` |
| Bounce | Webhook + parser bounce SMTP |
| Reply | Reply tracker via Gmail API |
| Unsubscribe | RFC 8058 one-click `/unsubscribe?t=...` |

### Dashboard y campañas

- **Estado por campaña:** tabla individual con stats de envío/apertura/clic/rebote/respuesta
- **Pausar / Reanudar / Cancelar** por campaña
- **Multi-cola FIFO:** procesa una campaña, luego siguiente, cap global compartido
- **Hard delete por defecto** (DELETE elimina, no archiva)
- **Cola purga** test residuals automática

### Informes por campaña

- Visualización HTML directa en la app (dark mode corporativo)
- Descarga PDF directa (Drive Docs export, fallback HTML imprimible)
- Token HMAC firmado obligatorio en URL (anti-PII leak)
- **Sin carpetas Drive:** todo se renderiza en la app (`DRIVE_ARCHIVE_ENABLED=false`)

### Optimización Inbox vs Promotions

Headers `Precedence:bulk`, `Auto-Submitted`, `Feedback-ID`, `List-Id` se omiten cuando `MAIL_DELIVER_TO_PRIMARY=true` (default). Se mantiene `List-Unsubscribe` (Gmail lo valora positivo).

---

## Estructura

```
RUBEN-COTON_EMAILING/
├── src/                  # Backend
│   ├── server.js         # Express + rutas
│   ├── massMailEngine.js # Motor envío + drip + ventana
│   ├── dataStore.js      # JSON persistence + GDPR audit log
│   ├── reportRenderer.js # Generador HTML informe (dark mode)
│   ├── pdfGen.js         # HTML→PDF via Drive Docs
│   ├── sheetsWriteback.js# Sheets sync + Merge status colors
│   ├── googleHub.js      # OAuth singleton (anti rate-limit)
│   └── ...
├── public/               # Frontend
│   ├── index.html        # Dashboard + Crear/Estado campañas
│   ├── app.js            # Lógica UI + KPIs en vivo
│   ├── campaign-report.html # Plantilla informe
│   └── ...
├── scripts/              # Utilidades, tests, deploy
├── docs/                 # Documentación técnica
├── data/                 # Runtime (no versionado): store.json
└── CHANGELOG.md          # Histórico de cambios
```

## Setup local

```bash
cp .env.example .env
# Edita .env con OAuth + API keys
npm install
node src/server.js
```

## Deploy

Auto-deploy via Coolify en push a `main`:

```bash
git push origin main
# Trigger manual si auto-deploy off:
curl -X POST "http://187.77.166.84:8000/api/v1/deploy?uuid=<UUID>&force=true" \
  -H "Authorization: Bearer <COOLIFY_TOKEN>"
```

UUID app emailing: `zal9cskfqsps8sbur3ypxxcw`

## Variables clave

| Var | Default | Descripción |
|---|---|---|
| `MAIL_DAILY_CAP` | `1950` | Cap rolling 24h |
| `MAIL_RATE_PER_MINUTE` | `3` | Cadencia base envío |
| `MAIL_SEND_WINDOW_START` | `8` | Hora inicio envío (Madrid) |
| `MAIL_SEND_WINDOW_END` | `20` | Hora fin envío |
| `MAIL_SEND_TZ` | `Europe/Madrid` | TZ ventana |
| `MAIL_DELIVER_TO_PRIMARY` | `true` | Omite headers bulk → Inbox |
| `DRIVE_ARCHIVE_ENABLED` | `false` | Carpetas Drive (off por defecto) |
| `WRITEBACK_FLUSH_MS` | `1500` | Debounce flush Sheets Merge status (casi tiempo real) |

Ver `.env.example` para lista completa.

## Trazabilidad

- **Commits:** repo `rubencoton/RUBEN-COTON_EMAILING` (privado)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)
- **Audit log GDPR Art. 30:** `data/audit.log` (importContacts, createCampaign, send, delete)
- **Logs runtime:** Coolify → app `RUBEN-COTON_EMAILING` → Logs

## Autor

**RUBEN COTON**

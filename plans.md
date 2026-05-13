# PLANS

## HITO 1 - BASE OPERATIVA

- [x] Login y shell de app.
- [x] Motor masivo propio desacoplado.
- [x] Scripts de operacion remota Coolify.

## HITO 2 - CORE DE PRODUCTO

- [x] Contactos CRUD.
- [x] Importacion CSV/TXT/XLSX.
- [x] Segmentos dinamicos simples.
- [x] Plantillas basicas.

## HITO 3 - CAMPANAS Y TRACKING

- [x] Crear campanas.
- [x] Encolar y enviar campanas.
- [x] Registrar delivered/open/click/bounce/unsubscribe/complaint.
- [x] Analitica de campanas.

## HITO 4 - AUTOMATIZACIONES

- [x] Workflows base no-open / opened-no-click.
- [x] Ejecucion manual y periodica.

## HITO 5 - HARDENING (EN CURSO)

### UX QA (sesiones manuales producción)
- [x] (2026-05-08) Loader + disable select en cambio de plantilla Crear Campaña.
- [x] (2026-05-08) `tplPreview` con cancel + cleanup en cambio de pestaña.
- [x] (2026-05-08) Banner cold-start con mensaje informativo + timing per-request en init.
- [x] (2026-05-08) **Causa raíz cold-start identificada y resuelta:** `buildSetupChecklist` con 6 DNS lookups secuenciales. Paralelizado + stale-while-revalidate + TTL 600s + pre-warm.
- [x] (2026-05-08) `syncCampaignsWithEngine()` diferido a `setImmediate` en `/api/campaigns`, `/api/panel`, `/api/dashboard`.
- [x] (2026-05-08) Validación URL en POST `/api/campaigns/:id/events` (anti-XSS/SSRF).
- [x] (2026-05-08) `.unref()` en timers `dataStore._flushTimer`.

### Trazabilidad y autonomía
- [x] (2026-05-08) `AGENTS.md` reforzado con sección "TRAZABILIDAD OBLIGATORIA".
- [x] (2026-05-08) `OPERATIONS.md` creado: runbook 11 secciones para incidencias y recovery.

### Cambios funcionales 2026-05-08 (post-hardening)
- [x] (2026-05-08) `importContacts` deduplica por (email+source) en vez de email global. Sheets se reflejan literales — un email en 2 pestañas → 2 contactos.
- [x] (2026-05-08) Dashboard: Puntuación global 0-10 + diagnóstico IA (alertas + wins) en el resumen de campañas en proceso.
- [x] (2026-05-08) sheetsWriteback: tachado de fila completa (strikethrough + bg gris) cuando estado=rebotado/unsubscribed. Motor ya excluía estos contactos de envíos; ahora también queda visible en el Sheet.
- [x] (2026-05-08) PDFs informes ahora respetan A4 210x297mm con paginación correcta. Reemplazado motor Drive Docs por puppeteer-core + chromium Alpine. preferCSSPageSize honra @page del CSS.

### Pendientes detectados en audit 2026-05-08 (estado tras hardening)
- [x] (2026-05-08) **CRITICO** `sendCampaignLocks`: ya tenía TTL 60s + purgeSendLocks. Añadido `.unref()` en cleanup setTimeout.
- [x] (2026-05-08) **CRITICO** `sync-all-to-drive`: status 502 si todas fallan + `partialSuccess` flag y contadores `uploaded/failed/total`.
- [x] (2026-05-08) **ALTO** `attachments.js`: cleanups silenciosos ahora con `console.warn` (cap excedido, huérfano, rollback).
- [x] (2026-05-08) **ALTO** `sheetsWriteback.flush`: backoff exponencial 1.5s → 5min con jitter, reset al primer éxito.
- [ ] **MEDIO** Considerar streaming / split colecciones para `dataStore.read()` 55MB. Postergado hasta migración Postgres.

### Hardening backend
- [x] Auditoria profunda con rotura controlada (`npm run audit:deep`).
- [x] Fix login + estaticos sin autenticacion (pantalla de acceso estable).
- [x] Fix cookie segura adaptable por entorno (`APP_AUTH_COOKIE_SECURE`).
- [x] Fix robustez ante cookies malformadas (sin 500).
- [x] Fix no-duplicacion de rebotes en sincronizacion repetida.
- [x] Health robusto con DB opcional (`DATABASE_REQUIRED=false` por defecto).
- [x] Panel de configuracion tecnica con checklist DNS/PTR + test provider + envio de prueba.
- [x] Fix checklist DNS/PTR para evitar falsos positivos por resolucion local (`127.x`).
- [ ] Migracion fuerte a PostgreSQL.
- [ ] Webhooks reales proveedor.
- [ ] Pruebas automatizadas y e2e.
- [ ] Dashboard avanzado de entregabilidad.

## HITO 6 - BLINDAJE TOTAL (2026-05-07) ✅

Auditoría exhaustiva 6 rondas con sub-agents Opus tras detectar bug crítico
del `__hardCounter` (motor congelado 18h). 33 fixes P0/P1 aplicados.

### Crítico
- [x] Bug `__hardCounter` resuelto: resync con archivo en cada chequeo del cap.
- [x] Cap reducido 1950 → 1500 tras 2 rebotes de Gmail (margen 500).
- [x] DNS `emailing.rubencoton.com` recreado en Hostinger (apuntaba a nada).

### Auto-recuperación
- [x] Watchdog interno motor (5min ventana abierta, 15min cerrada).
- [x] tickerEpoch validation anti doble-tick.
- [x] OAuth auto-retry tras fallo (5 min).
- [x] Reply tracker abort en 401 con alerta.
- [x] Gmail send retry exponencial (1s/2s/4s + jitter).
- [x] Sheets writeback lock anti-reentrant + circuit breaker TTL.

### Performance
- [x] `getContactByEmail` O(1) con índice lazy (antes O(N) en hot path).
- [x] `getOverview`, `recomputeCampaignStats` 1 loop en vez de N filters.
- [x] File snapshot cache TTL 1s.
- [x] `setIntervals` con `.unref()` para graceful shutdown.

### Robustez
- [x] Anti-thrashing throttle (>10 hits consecutivos, espera completa).
- [x] LRU `directTransportCache` delete-then-set.
- [x] Token write atómico con lock.
- [x] `driveArchive` valida JSON antes de sobrescribir disco.
- [x] `attachments` mutex 10MB cap + try/catch global.
- [x] `spamShield` matchAll en vez de regex.exec /g.
- [x] Frontend XSS: `esc()` en chat IA + sandbox sin `allow-scripts`.

### Documentación
- [x] CHANGELOG.md v2.1.0 con todos los fixes.
- [x] README actualizado con cap 1500 + sección auto-recuperación.
- [x] plans.md (este archivo) con HITO 6.

## HITO 7 - UX CAMPAÑAS (2026-05-08) ✅

Mejoras de usabilidad en el formulario de creación de campañas tras
detección de fricciones reales operando con tráfico de producción.

### Cap diario
- [x] Cap subido 1500 → 1600 → 1650 (Gmail estabilizado, sin más rebotes).
- [x] Cap subido 1650 → 1700 → 1900 (2026-05-09, sin rebotes, Gmail estable).
- [x] Cap bajado 1900 → 1800 (2026-05-09, Gmail devolvió "límite de mensajes alcanzado").
- [x] Cap bajado 1800 → 1700 (2026-05-09, conservar reputación cuenta Gmail).
- [x] Cap bajado 1700 → 1500 (2026-05-13, Gmail devolvió "límite de mensajes alcanzado" a los 1637).
- [x] DNS `emailing.rubencoton.com` arreglado vía Hostinger API (A record).

### Pre-header (texto gris junto al asunto)
- [x] Campo `previewText` en formulario de campaña (max 120 chars).
- [x] Campo `previewText` en plantillas (`POST /api/templates`).
- [x] Inyección automática en HTML del email vía `massMailEngine`
      (div oculto al inicio del body con `display:none`).
- [x] Trackeable y editable también desde plantillas guardadas.

### Sistema de plantillas reutilizables
- [x] Selector de plantilla en formulario campaña (`#campaignTemplateSelect`).
- [x] Botón "⭐ Guardar como plantilla" en formulario campaña (3ª acción).
- [x] Endpoint `POST /api/templates` reutilizado (CRUD ya existía).
- [x] Filtro: solo plantillas con status `validada` o `borrador`.
- [x] Selector → IMPORTA TODO el contenido (asunto + pre-header + HTML +
      texto + editor Gmail) y SALTA AUTOMÁTICO a "Vista previa" para
      que el usuario vea cómo queda el email.

### Branding
- [x] Favicon RUBEN COTON (logo RRSS) en `index.html`, `login.html`,
      `manual.html`. Reemplaza el círculo genérico del navegador.
      Fuente: Drive `1bFZ6RfoV96OFgvANj0nP5BCdCEQEWnCp` (4167x4167 PNG).

### Trazabilidad
- [x] CHANGELOG.md v2.2.0 con cambios HITO 7.
- [x] plans.md (este archivo) con HITO 7.
- [x] Commits descriptivos:
      - `0f38028` feat(campañas): pre-header en formulario + plantillas
      - `06c9a61` feat(plantillas): selector + botón guardar como plantilla
      - `36e5db7` feat: favicon RUBEN COTON (logo RRSS)
      - `459312e` feat(plantillas): seleccionar = importar TODO + Vista previa

## HITO 8 - BLINDAJE DEPLOY + GRACEFUL SHUTDOWN (2026-05-08) ✅

Auditoría adicional: 9 riesgos (3🔴 / 3🟠 / 3🟡), 7 fixes aplicados sin
tocar comportamiento del motor en caliente. Aplicados con producción
enviando, sin downtime perceptible.

### Resiliencia ante deploy
- [x] `saveState()` atómica (tmp+rename) — cap counter no se corrompe.
- [x] `stop()` async drena ciclo activo en curso (max 10s).
- [x] Tracking de conexiones HTTP keep-alive activas.
- [x] `gracefulShutdown` reescrito: server.close → cerrar keep-alive →
      drenar motor → exit. Hard-kill seguridad a 25s.
- [x] Flag `shuttingDown` previene re-entrada SIGTERM doble.

### Container hardening
- [x] `mem_limit: 1200m` + `memswap_limit: 1200m` en compose.
- [x] `stop_grace_period: 30s` (vs default 10s).
- [x] Healthcheck con `wget` (no spawn Node cada 30s).
- [x] `--max-old-space-size=1024` alineado con `mem_limit`.

### Seguridad y docs
- [x] Password real reemplazada por placeholder en COOLIFY_SETUP.md.

### Pendientes (borradores próxima iteración)
- [ ] Persistir snapshot jobs al dataStore (refactor mayor).
- [ ] Dockerfile USER no-root (requiere migrar permisos volumen).
- [ ] Coolify UI → "Deployment Strategy: Rolling" (manual, requiere acceso).
- [ ] Rotar `APP_ACCESS_PASSWORD` (quedó en git history).

## HITO 9 - ANTI-BLOQUEO GMAIL (2026-05-13)

Análisis tras 3º bloqueo Gmail "límite de mensajes alcanzado". Detectado
**bounce rate 11,34%** (1.010 bounces / 8.908 enviados). Gmail penaliza
cuentas con bounce > 5-10% → reducción cuota automática.

### Filtros de calidad en import (`dataStore.validateEmailQuality`)
- [x] Bloqueo typos de dominios populares (gmial→gmail, hotmial→hotmail, yahooo→yahoo).
- [x] Bloqueo TLDs invalidas (.con, .cm, .vom).
- [x] Bloqueo role-based emails (info@, admin@, noreply@, postmaster@, abuse@).
- [x] Validación local-part (mínimo 2 chars, sin puntos dobles, sin puntos en bordes).
- [x] TLD mínimo 2 caracteres.

### Circuit breaker en motor (massMailEngine)
- [x] Rolling window 100 últimos resultados por job (sent/bounce).
- [x] Si bounce rate > 8% con muestra ≥ 30 → pauseJob() automático.
- [x] `job.autoPausedReason = "bounce_rate_XX.X pct"` para diagnóstico.
- [x] Evento `circuit_breaker` registrado en history del motor.

### Rate más conservador (Coolify env)
- [x] `MAIL_RATE_SCHEDULE` cambiado: `8-13:10,13-14:3,14-18:4,18-20:1`
      → `8-13:5,13-14:2,14-18:3,18-20:1` (50% reducción hora pico).
- [x] Cap diario bajado 1700 → 1500 alineado con nuevo rate.

### Bloqueo oficial Workspace 2026-05-13 (17h)
- [x] Confirmado en Google Admin Console: cuenta `manager@rubencoton.com`
      bloqueada por "demasiados destinatarios externos únicos". 17h espera.
- [x] Motor pausado vía `POST /api/mass-mail/pause` para evitar reintentos
      en cola contra Gmail bloqueado.
- [ ] **Mañana 19:30:** reanudar con cap 1200, rate `8-13:3,13-14:2,14-18:2,18-20:1`.
- [ ] Considerar segunda cuenta Workspace para rotar envíos (futuro).
- [ ] Limpiar contactos con calidad dudosa (re-validar bd con
      `validateEmailQuality` retroactivo).

### Sistema sentinel anti-ban Gmail (auto-detección + auto-pausa)
- [x] Detección errores oficiales Gmail en catch del motor:
      `user-rate limit`, `daily sending quota`, `limite de mensajes`,
      códigos `5.4.5`, `550-5.4.5`, `454-4.7.0`.
- [x] Al detectar: `__gmailBlockUntil = now + 24h`, motor `paused = true`,
      persistido a `data/mail-state.json` (sobrevive restart container).
- [x] Recipient se re-encola al FRENTE (unshift) para reintento tras 24h —
      NO contado como bounce porque el email puede ser válido.
- [x] Auto-resume al expirar `__gmailBlockUntil` (check al inicio de cada tick).
- [x] Endpoints admin: `GET /api/anti-ban/status`, `POST /api/anti-ban/clear`,
      `POST /api/anti-ban/block?hours=N`.
- [x] Historial: eventos `gmail_block`, `gmail_block_expired`, `gmail_block_manual`.

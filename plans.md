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
- [ ] Investigar causa cold-start ~1 min (Coolify wakeup vs dataStore 55MB sync).

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

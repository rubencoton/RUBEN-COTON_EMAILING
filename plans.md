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

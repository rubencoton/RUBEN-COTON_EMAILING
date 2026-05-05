# Changelog

Histórico de cambios del proyecto **RUBEN-COTON_EMAILING**.

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)

---

## [2026-05-05] — Dashboard Inicio + tabla Estado campañas: armonía visual

### Añadido

- **Bloque "Resumen de campañas en proceso"** en dashboard de Inicio, encima de la tabla individual. Muestra totales agregados (destinatarios, número de campañas en proceso) y 5 cards con datos medios calculados sobre el conjunto: ENVIADOS, APERTURAS, CLICS, RESPUESTAS, REBOTES. Cada card incluye número, porcentaje y etiqueta de evaluación (`EXCELENTE` / `BUENO` / `NORMAL` / `POR MEJORAR`).
- **Porcentajes y etiqueta por métrica** en cada fila de la tabla de campañas activas del Inicio. Cada celda métrica muestra ahora 3 líneas: número, porcentaje y etiqueta de evaluación con color (verde / ámbar / rojo).
- **Columna "Respuestas"** añadida a la tabla del Inicio (antes solo había Enviados, Aperturas, Clics, Rebotes).

### Cambiado

- **Definición operativa de "campaña en proceso":** campaña no eliminada presente en `recentCampaigns` del endpoint `/api/dashboard` (que ya filtra archivadas). Si el usuario elimina una campaña, desaparece del resumen.
- **Subtítulo del card "Estado de campañas activas"** en `public/index.html` reformulado para reflejar que ahora muestra resumen agregado + detalle individual.
- **Cabeceras de la tabla del Inicio** centradas (`text-align:center`) para alinear con las celdas métricas.
- **Tabla "Estado campañas" (pestaña dedicada):**
  - **Porcentaje GRANDE** (22px, dato principal) en cada celda métrica. Antes era el número grande y el porcentaje pequeño.
  - **Número** pasa a 12px arriba; **etiqueta** sigue abajo.
  - **Alturas fijas** por bloque (16/28/20px) → todos los números, porcentajes y etiquetas alineados a la misma altura horizontal entre filas.
  - **Cabeceras** centradas (`text-align:center`) para todas las columnas excepto "Campaña".
  - **Celda DESTINATARIOS:** número agrandado a 22px para igualar visualmente al porcentaje de las métricas.
  - `vertical-align:middle` en todos los `<td>` de la fila para centrado vertical consistente.
- **Botón "⛔ Cancelar envío" → "⛔ Cancelar"** en la tabla Estado campañas. El texto largo se truncaba en la columna Acción.

### Justificación

Petición usuario 2026-05-05: necesita ver de un vistazo el rendimiento global y por campaña, con porcentajes como dato principal (no número crudo). El resumen agregado y las etiquetas de evaluación permiten interpretar el estado real (excelente / por mejorar) sin conocer benchmarks de email marketing.

Benchmarks compartidos entre `renderCampaigns.evalMetric` y el dashboard de Inicio (`public/app.js`) para coherencia visual.

---

## [2026-05-05] — Sesión armonía visual + ventana 8-20h

### Añadido

- **Ventana horaria 8-20h Madrid** activa por defecto. Motor envía solo entre 08:00 y 20:00, fuera de ese rango pausa automáticamente (`MAIL_SEND_WINDOW_START=8`, `MAIL_SEND_WINDOW_END=20`, `MAIL_SEND_TZ=Europe/Madrid`).
- **Indicador visual de ventana** en dashboard: bullet verde `● Ventana 8-20h` cuando abierta, ámbar `○ Fuera ventana` cuando cerrada.
- **Drip humano:** 3 emails/min con jitter ±25% + pausas humanas cada 30-60 envíos (3-8 min). Reparte 1950 emails en 12 horas.
- **Preview público del informe:** `/preview-informe-demo.html` accesible sin login para revisión visual rápida.

### Cambiado

- **Texto dashboard "MODO LOCAL" → "EN VPS"** para evitar confusión del usuario (que asocia "local" con su PC).
- **KPI Motor reorganizado** en 2 líneas: estado grande (`ACTIVO`) + tag canal pequeña (`GMAIL API`). Antes rompía en 2 líneas saturadas.
- **KPI Ritmo/Cola reorganizado** en 3 líneas: cifra grande naranja (`3/min`), `Cola: 0`, indicador ventana. Antes era todo amontonado en una línea.
- **README.md ampliado** con features clave, sistema envío, blindaje, variables clave y trazabilidad.

### Corregido

- **Visual audit dark mode:** 14 líneas con `background-color:BLANCO` invisibles (texto blanco sobre fondo blanco) corregidas en `reportRenderer.js`.
- **kpiCell + sectionHeader title:** fondo `NEGRO_CARD` para contraste visual (antes `NEGRO` plano).
- **KPI "Respuestas" en informe:** color del número cambiado de `NEGRO` (invisible sobre card oscura) a `NARANJA` corporativo.

### Eliminado

- **Creación automática de carpetas Drive con HTML+PDF.** Feature flag `DRIVE_ARCHIVE_ENABLED=false` (default) desactiva:
  - `driveScheduler.start()` (no ticks 5min)
  - `POST /api/campaigns/:id/upload-to-drive` (responde 410)
  - `POST /api/campaigns/sync-all-to-drive` (responde 410)
  - Botón "Sincronizar al Drive" del HTML
- Backup automático del `store.json` sigue activo (es seguridad, no archivo).

---

## [2026-05-04] — Blindaje cap + dark mode informes

### Añadido

- **Cap diario 1950/24h con blindaje triple:**
  1. Pre-process en `processNext()` antes de enviar
  2. Doble check timestamp pre-Gmail API
  3. Persistencia en `data/mail-state.json` (sobrevive reinicios)
- **Logs WARN al 90% (1755) y 100%** del cap.
- **Endpoint `GET /api/mass-mail/cap-status`** — monitorización detallada.
- **Headers anti-Promotions condicionales:** `MAIL_DELIVER_TO_PRIMARY=true` omite `Precedence:bulk`, `Auto-Submitted`, `Feedback-ID`, `List-Id`. Mantiene `List-Unsubscribe` (Gmail lo valora positivo).
- **Rediseño informe DARK MODE:** fondo negro (#0a0a0a) + cards (#1a1a1a) + naranja (#FF6B00) + logo NEG_RRSS.

### Corregido

- **Bug dedupe Map index:** `_eventDedupeIdx` se serializaba a `{}` después de `JSON.stringify`/`parse`. Añadido check `instanceof Map` antes de usar `.get()`. Afectaba a tests APERTURA/CLICK/RESPONDIDO.
- **Color "rebotado" en Sheets writeback:** fondo `NEGRO` → `ROJO` (#dc2626) + texto blanco (petición usuario).

---

## [2026-05-03] — Pausar/Reanudar + drip individual

### Añadido

- **Pausar/Reanudar/Cancelar por campaña** individual:
  - `POST /api/campaigns/:id/pause`
  - `POST /api/campaigns/:id/resume`
  - `POST /api/campaigns/:id/cancel`
- **Multi-cola FIFO:** si pauso campaña A y tengo B en cola, sigue procesando B. Cap global compartido.
- **Endpoint admin `POST /api/admin/purge-archived-campaigns`** — hard delete batch.
- **Tabla "Estado de campañas activas"** en dashboard con stats individuales (en lugar de KPIs agregados).
- **Indicador PC con texto claro + tooltip explicativo** (cascade fallback cloud).

### Cambiado

- **DELETE = hard delete** por defecto (era soft archive). Para mantener archive: `?soft=true`.
- **Dashboard `getOverview()` filtra archived** + retorna `recentCampaigns[]`.

### Corregido

- **Bug PDF "no se descarga nada":** `pdfGen` no estaba importado en `server.js` (ReferenceError). Añadido import + `Content-Disposition: attachment` para forzar descarga + fallback HTML si Drive Docs falla.
- **Audit log GDPR Art. 30** instrumentado en `importContacts` y `createCampaign`.

---

## [2026-04-30] — Tracking exhaustivo + Sheets writeback

### Añadido

- **Tracking 6/6 verificado:** opens, clicks, bounce, reply, unsubscribe, no-spam.
- **Sheets writeback:** columna "Merge status" con color por estado:
  - enviado → blanco
  - rebotado → rojo + blanco
  - abierto → verde claro
  - clicado → verde medio + blanco
  - respondido → verde oscuro + blanco
- **Cola batch** writeback cada 30s, agrupada por sheetId, max 100 requests/batch.

### Refactorizado

- **OAuth singleton** (`googleHub.js`) — evita 4 instancias paralelas refrescando token simultáneamente (Google revocaba uno).

---

## [2026-04-25] — JSON store + backup horario Drive

### Cambiado

- Migrado de PostgreSQL a **JSON persistente** en `data/store.json` (volume Coolify).
- **Backup horario** automático a Drive `BACKUPS/store-YYYY-MM-DD-HH.json`.
- **Recovery:** `restoreStoreFromDrive()` si volume se corrompe.

### Corregido

- **Refactor `read()` sin clone** (P0-B): 100x más rápido, evita OOM.
- **Eliminada distribución adaptativa:** simple `rateDelayMs` (era 30x más lento).

---

## Convenciones

- **feat:** nueva funcionalidad
- **fix:** corrección de bug
- **refactor:** reestructuración sin cambio funcional
- **perf:** optimización de rendimiento
- **docs:** documentación
- **chore:** mantenimiento

Cada cambio crítico va con etiqueta de prioridad: **P0** (urgente), **P1** (importante), **P2** (mejora).

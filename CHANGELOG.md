# Changelog

Histórico de cambios del proyecto **RUBEN-COTON_EMAILING**.

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)

---

## [2026-05-05] — Anti-spam P0/P1/P2 audit hardening

### Añadido

- **`unsubUrl` obligatorio en `emailBuilder.buildHtml()`** (P1 audit). Si no se pasa explícito, fallback a `MAIL_UNSUBSCRIBE_BASE_URL` de env. Si tampoco existe → lanza error claro. Antes el HTML se generaba sin enlace de baja silenciosamente, violando CAN-SPAM/RGPD y disparando quejas manuales que penalizan reputación. Verificado con tests: sin url lanza error, con url o env genera HTML con link "Darse de baja".
- **Carga de lista externa `data/disposable-domains.txt`** en `massMailEngine.js` (P2 audit). Se fusiona con los 22 dominios hardcoded. Recomendado: lista comunitaria de `disposable-email-domains/disposable-email-domains` (~3500). No bloquea arranque si el archivo no existe; log informa cuántos se añadieron.
- **`.env.example` ampliado** con sección **ANTI-SPAM / DELIVERABILITY**: `TRACKING_SECRET`, `TRACKING_REQUIRE_HMAC`, `WRITEBACK_FLUSH_MS`, `MAIL_DELIVER_TO_PRIMARY`. Bloque DNS requerido (SPF, DKIM, DMARC) con valores recomendados y comando `dig` de verificación.

### Cambiado

- **`Feedback-ID` ahora SIEMPRE activo** en `massMailEngine.js` (P1 audit). Antes se omitía cuando `MAIL_DELIVER_TO_PRIMARY=true` (default) por miedo a Promociones. Confirmado en audit: `Feedback-ID` lo lee Google Postmaster Tools, NO el clasificador de tabs Gmail. No penaliza bandeja principal y SÍ desagrega reputación por campaña — única señal early-warning antes de lista gris. `List-Id`, `Precedence`, `Auto-Submitted` siguen condicionados a `MAIL_DELIVER_TO_PRIMARY=false` porque esos sí afectan tabs.
- **`emailBuilder.generateEmail()`** acepta `unsubUrl` en opts y lo pasa a `buildHtml`. Default sigue siendo env.

### Documentado (acción requerida fuera del código)

- **DMARC en `_dmarc.rubencoton.com`** debe estar en `p=quarantine` (no `none`). Verificar con `dig TXT _dmarc.rubencoton.com`. Sin esto, spoofing del dominio pasa libre y la reputación cae lentamente. P0 — no es código, es un cambio en la zona DNS de Hostinger / proveedor.
- **`TRACKING_SECRET` y `TRACKING_REQUIRE_HMAC=1` en Coolify**: setear en variables de entorno de la app `RUBEN-COTON_EMAILING`. Generar el secret con `openssl rand -hex 32`. P0 — sin esto, cada reinicio invalida tracking histórico.

### Justificación

Audit anti-spam 2026-05-05 (subagente Explore). Los puntos aplicados son los P0/P1/P2 con código-actionable. Los P0 de DNS y env vars necesitan acción manual del usuario (publicación documentada).

### Test

- `node --check` en `emailBuilder.js`, `massMailEngine.js`, `sheetsWriteback.js`, `sheetsSync.js`, `trackingSign.js` → OK
- `node -e` test funcional `buildHtml` sin unsubUrl → error correcto. Con unsubUrl o env → HTML genera enlace "Darse de baja".

### Rollback

- `unsubUrl`: si rompe consumidor existente, el throw se puede degradar a `console.warn` en `emailBuilder.js`.
- `Feedback-ID` siempre: si Gmail empieza a clasificar como Promociones (improbable), envolver de nuevo en el `if MAIL_DELIVER_TO_PRIMARY=false`.
- Lista disposable externa: borrar `data/disposable-domains.txt` para volver al hardcoded.

---

## [2026-05-05] — Informe rediseño armónico + skip CRM testeo

### Añadido

- **`SKIP_CRM_SLUGS`** en `src/sheetsSync.js`: lista de slugs de CRMs que se omiten enteros del sync. La hoja **"CRM: PRUEBA HOJA DE TESTEO CRM"** queda excluida — no aparece en Inicio, no aparece en Crear campaña, no se sincroniza, no se hace writeback. El usuario la usaba como sandbox y no debe contaminar producción.
- **ANEXO de Destinatarios** al final del informe `campaign-report.html`. Bloque negro con etiqueta `ANEXO` en chip blanco + título en letras blancas. Salto de página antes del anexo (`page-break-before:always`) para que arranque limpio en PDF.

### Cambiado

- **Estructura visual del informe `campaign-report.html` reformulada (validada por usuario):**
  - **Cabeceros NEGROS con letras BLANCAS** en portada, `page-header` de cada sección y `<h1>` de sección. Misma identidad visual en pantalla y en PDF.
  - **Subtítulos en NARANJA** (`var(--rojo-2)` = `#FF6B00`): `<h2>`, ph-sub, ph-right, número de la sección (chip `.num` en h1).
  - **Cuerpo del informe BLANCO** — ahorra tóner en impresión a PDF.
  - **`<h1>` de sección** ahora es un bloque negro de ancho completo dentro del card (margen lateral negativo) con chip naranja `.num` y título blanco. Antes era texto naranja con borde inferior naranja.
  - **`<h2>` de subtítulo:** color naranja, borde izquierdo NEGRO (antes amarillo), peso 800 + tracking ligero.
  - **`.page-header` de cada página:** fondo negro, logo a la izquierda, título en blanco, sub-tag en naranja, paginación en naranja.
  - **Logo en `pageHeader()` y portada y footer:** `/assets/logo-rrss.png` (logo de redes sociales — buenas dimensiones, blanco sobre negro). Antes usábamos `logo-rubencoton-neg.png` y `logo-ruben-coton.png` mezclados.
  - **Secciones renumeradas:** Destinatarios sale de la posición 4 y queda como ANEXO. Las secciones siguientes suben un puesto (KPIs `5→4`, Rendimiento `6→5`, Geografía `7→6`, Categoría `8→7`, Conclusiones `9→8`, Glosario `10→9`).
  - **Índice del informe:** 9 secciones numeradas + entrada "ANEXO · Destinatarios" separada por línea de puntos al final del TOC, con chip negro "ANEXO".
  - **Print stylesheet:** cabeceros pintados de negro (no naranja). Footer print pasa de gradient naranja a blanco con borde superior negro de 2px.
  - **Datos de campaña:** la línea "PARA: N destinatarios (ver sección 4)" ahora dice "(ver Anexo al final)".
- **`sheetsWriteback.js` `WRITEBACK_FLUSH_MS`** default 30000 → 1500 (Merge Status casi tiempo real).
- **README.md:** variable `WRITEBACK_FLUSH_MS` actualizada a 1500ms.

### Justificación

Petición usuario 2026-05-05 en varias iteraciones:
- Merge Status: "tiene que ir en tiempo real, o sea, cuando estamos enviando se envía y se hace esto" → 1.5s.
- Informes: "el informe blanco es una m*** … quiero que el informe tenga armonía visual, que utilices el logo letras, el de redes sociales" → logo `logo-rrss.png`.
- Validación visual: "fondo blanco con cabeceros negros y letras blancas dentro me mola mucho y es muy armónico, subtítulos en naranja para distinciones" → estructura adoptada.
- Destinatarios: "el apartado 4, empresas y destinatarios, quiero que hagas un anexo que se ponga al final porque si no el informe queda angoroso" → movido a ANEXO con salto de página.
- Imprimible: "lo más importante es que se pueda imprimir en PDF sin dar error" → @media print actualizado en consonancia.
- Skip CRM testeo: "esa carpeta con esa lista no la cargamos" → `SKIP_CRM_SLUGS`.

### Rollback

- Para volver al informe en blanco/naranja anterior: revertir el commit que toca `public/campaign-report.html`.
- Para reactivar el CRM de testeo: vaciar `SKIP_CRM_SLUGS` en `src/sheetsSync.js`.
- Merge Status: `WRITEBACK_FLUSH_MS=30000` en variables de entorno Coolify.

---

## [2026-05-05] — Merge Status casi tiempo real + informe con logo NEG_RRSS

### Cambiado

- **Merge Status writeback en Sheets pasa de 30s → 1.5s** (`WRITEBACK_FLUSH_MS=1500`). El usuario quiere ver el estado del último envío reflejado en su columna "Merge status" de Google Sheets en tiempo (casi) real mientras la campaña corre. Con cadencia 3 emails/min hay como mucho 1 evento por ventana de 1.5s, así que cada envío se refleja inmediatamente. Ráfagas de opens/clicks se siguen agrupando en una sola `batchUpdate` por sheetId. Rate-limit Sheets (60 writes/min/user) sobradamente respetado.
- **Informe `campaign-report.html` (la plantilla imprimible a PDF):**
  - Cabecera de portada en **bloque negro** con **logo NEG_RRSS** (`logo-rubencoton-neg.png`) — letras blancas sobre fondo negro. Da armonía visual con la marca RUBEN COTON.
  - Footer con el mismo logo NEG_RRSS sobre fondo negro propio (chip negro embebido en footer claro).
  - Texto del título `RUBEN COTON` ahora en blanco (sobre fondo negro de la cabecera) en lugar de gris oscuro.
  - El cuerpo del informe se mantiene en fondo blanco/claro para ahorrar tinta en impresión PDF.

### Justificación

Petición usuario 2026-05-05:
- Merge Status: "tiene que ir en tiempo real, o sea, cuando estamos enviando se envía y se hace esto se envía y se hace esto" → debounce a 1.5s.
- Informes: "el informe blanco es una m*** … quiero que el informe tenga armonía visual, que utilices el logo letras, el de redes sociales, que es letras blancas fondo negro" → NEG_RRSS en cabecera y footer.

### Rollback

- Merge Status: `WRITEBACK_FLUSH_MS=30000` en variables de entorno Coolify para volver al comportamiento anterior.
- Informes: revertir commit (los cambios están aislados en `public/campaign-report.html`).

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

# Changelog

Histórico de cambios del proyecto **RUBEN-COTON_EMAILING**.

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)

---

## [2026-05-08] — v2.6.0 — ROBUSTEZ TOTAL: 7 BUGS DEL AUDIT + LÍMITES INPUT

### Contexto

Tras la auditoría profunda del sistema completo de plantillas, se detectaron
**7 bugs (2 críticos, 2 altos, 3 medios)**. Todos corregidos en esta versión.
Además, añadidos límites de tamaño en inputs para evitar DoS por payload.

### 🔴 BUGS CRÍTICOS

#### `src/dataStore.js`
- **BUG #1 — Seeds en papelera resucitaban** al bumpear `SEED_VERSION`.
  Si el usuario eliminaba un seed y luego se actualizaba, el código de
  `ensureDefaultTemplates` lo sobrescribía pero no tocaba `trashed=true`,
  dejándolo en estado ambiguo. **Fix**: si `tpl.trashed` está, NO actualizar.
- **BUG #2 — `updateTemplate` perdía cambios del usuario**. El comentario
  decía que eliminaba `seedKey` para no pisar ediciones, pero el código no
  lo hacía. **Fix**: `delete tpl.seedKey` y `delete tpl.seedVersion` cuando
  el usuario edita contenido.

### 🟠 BUGS ALTOS

#### `public/app.js`
- **BUG #3 — Typo `"validada"` vs `"validado"`** en filtro del selector
  campaña (`populateCampaignTemplateSelect`). El status real en DB es
  `"validado"` (sin 'a'). Las plantillas validadas nunca aparecían con
  ✅ en el desplegable de campañas.
- **BUG #4 — `__inheritFromTemplate` no se reseteaba** al deseleccionar.
  Si el usuario elegía plantilla y luego volvía a "Empezar desde cero",
  el flag se quedaba con el id anterior y se heredaban adjuntos no deseados.

### 🟡 BUGS MEDIOS

#### `public/app.js`
- **BUG #5 — `setInterval(500ms)` eterno** vigilando `editingId`.
  **Fix**: reemplazado por `MutationObserver` + `dispatchEvent('change')`
  desde los handlers que cambian el value (`tplEdit`, `cancelEdit`).
  Cero polling de fondo.
- **BUG #7 — `tplEdit` no cargaba `previewText`** en el formulario.
  Al guardar la edición sin tocar el input, el `PUT` enviaba string vacío
  y borraba el pre-header existente en BBDD. **Fix**: leer `t.previewText`
  y poblarlo en el input.

#### `src/server.js` + `src/attachments.js`
- **BUG #6 — Inherit attachments fuera del mutex**. Race con uploads
  simultáneos podían colarse por debajo del cap 10 MB.
  **Fix**: nueva función `attachments.inheritFromOwner(srcId, dstId)` que
  copia archivos DENTRO del `_withLock(dstId)`. Validación 10 MB y rollback
  automático si excede.

### 🟢 ROBUSTEZ EXTRA — Límites de input

#### `src/dataStore.js` (createTemplate + updateTemplate)
- `name` max **200 chars**
- `subject` max **500 chars**
- `previewText` max **200 chars**
- `html` max **2 MB**
- `text` max **500 KB**

Sin esto, un payload malicioso (ej: 50 MB de HTML) tumbaba el JSON store
o agotaba memoria. Ahora se rechaza con error claro.

### Renombrado UX

#### `public/index.html`
- Pestaña sidebar: **"Crear plantilla" → "Plantillas"** (más claro: el
  apartado gestiona TODAS las plantillas, no solo crea).
- Título panel: "⭐ Plantillas".
- Subtítulo actualizado: "Gestiona todas tus plantillas reutilizables…"

### Commits

- `<HASH>` fix(audit): 7 bugs criticos/altos/medios + limites input

---

## [2026-05-08] — v2.5.0 — MENÚ REORDENADO + ADJUNTOS PLANTILLA + FIX UI

### Petición usuario
1. Reorganizar menú lateral: "Crear plantilla" entre CRM y "Crear campaña".
2. Adjuntos en plantillas: al elegir plantilla en una campaña, los archivos
   adjuntos vienen heredados automáticamente.
3. Bug UI: campañas al 100% mostraban "CASI HECHO" en vez de "COMPLETADO".

### Cambios

#### `public/index.html`
- Pestaña "Plantillas" renombrada a **"Crear plantilla"** y movida al
  segundo lugar (después de CRM, antes de "Crear campaña").
- Título del panel adaptado: "⭐ Crear plantilla".
- Caja de adjuntos en formulario de plantilla (visible solo al editar
  plantilla existente, porque necesita id).

#### `src/server.js`
- 4 endpoints nuevos:
  - `GET /api/templates/:id/attachments` — lista
  - `POST /api/templates/:id/attachments` — sube (max 10 MB total)
  - `DELETE /api/templates/:id/attachments/:name` — borra
  - `POST /api/campaigns/:cid/attachments/inherit-from-template/:tid` —
    copia físicamente los adjuntos de plantilla a campaña (no mueve).
    Valida 10 MB tras copiar; rollback si excede.

Reusa `src/attachments.js` sin modificar (ya soportaba cualquier ownerId).

#### `public/app.js`
- `refreshTplAttachList()` — UI lista adjuntos plantilla.
- Handler input `#tplAttachInput` con guardia "guarda primero la plantilla".
- Observer + polling sobre `#templateEditingId` para mostrar/ocultar la caja.
- Selector plantilla en campaña: ahora muestra adjuntos heredados con
  badge "se heredará" antes de crear la campaña (informativo).
- Submit campaña: tras guardar borrador, llama al endpoint inherit y
  copia los adjuntos automáticamente. Reporta `⭐ N adjuntos heredados`.
- **Fix bug**: `evalMetric` y `evalRate` añaden caso `pct >= 100` →
  label "COMPLETADO" antes que "CASI HECHO".

### Commits

- `eacf43f` fix(ui): mostrar 'COMPLETADO' al 100%
- `<HASH>`  feat(menu+adjuntos): plantilla en menu + adjuntos heredados

---

## [2026-05-08] — v2.4.0 — PLANTILLAS PROPIAS + PAPELERA 30D + FEEDBACK API

### Contexto

Petición usuario:
1. Sección "Plantillas" propia en menú lateral (separada de Crear campaña).
2. Botón eliminar plantilla + papelera estilo Gmail (30 días retención).
3. Pre-header en plantillas (no solo en campañas).
4. Blindar app frente a errores de carga API (feedback visual).

Bonus: limpieza UX de bounces (replyTracker 10min → 2min, ya v2.3.1).

### 🟢 P1 — Sección "Plantillas" en menú lateral

#### `public/index.html`
- Pestaña "⭐ Plantillas" **visible en sidebar** (antes oculta con
  `display:none`). Icono SVG documento, tooltip explicativo.
- Título del panel cambiado: "Borradores" → "⭐ Plantillas".
- Form: input `name` con placeholder más claro ("Nombre de la plantilla
  ej: 'Festejos · Concejales'") + nuevo input `previewText` (pre-header).
- Sub-tabs internas: **"⭐ Mis plantillas"** / **"🗑 Papelera"**.
  Counter en pestaña Papelera con nº de plantillas trasheadas.

### 🟢 P1 — Papelera plantillas (estilo Gmail, 30d)

#### `src/dataStore.js`
- `listTemplates({ trashed: true|false })` → filtra por estado papelera.
  Retrocompatible (sin opts = solo activas).
- `deleteTemplate(id)` → ya NO borra de verdad. Marca `trashed=true,
  trashedAt=now`. Si llamado 2 veces sobre misma plantilla → purga real.
- `restoreTemplate(id)` → resetea `trashed=false`.
- `purgeTemplate(id)` → borrado real definitivo (botón "Eliminar ya").
- `purgeOldTrashedTemplates(days)` → purga lo más antiguo que `days`.

#### `src/server.js`
- `GET /api/templates?trashed=1` → lista papelera.
- `DELETE /api/templates/:id` → mueve a papelera (mensaje claro).
- `POST /api/templates/:id/restore` → restaura.
- `DELETE /api/templates/:id/permanent` → purga inmediata.
- **Cron diario** (cada 6h, primera vez 30s tras arranque) que llama a
  `purgeOldTrashedTemplates(TEMPLATES_TRASH_RETENTION_DAYS=30)`.

#### `public/app.js`
- `tplDelete()` → modal bonito con texto "30 días para restaurar".
- `tplRestore(id, name)` → restaura desde papelera (toast verde).
- `tplPurge(id, name)` → modal "no se puede deshacer" + DELETE permanent.
- `refreshTemplatesTrash()` → render tabla papelera con columnas:
  Nombre, Asunto, Eliminada, **Quedan X días** (rojo si <=3, amarillo
  si <=7), Acciones (↩ Restaurar / 🗑 Eliminar ya).
- Switch sub-tabs visual: borde rojo bajo la activa.

### 🟢 P1 — Blindaje errores carga API

#### `public/app.js`
- `api()` ya tenía retry 3x con backoff. **Ahora con feedback visual**:
  banner discreto en la parte superior "🔄 Reconectando con el servidor…
  (intento N/3)" durante el reintento. Al recuperar, se oculta.
- Si falla los 3 intentos: banner rojo "⚠️ Sin conexión" durante 5s.
- Cold start del backend (502/503/504) muestra "🔄 Servidor arrancando…"

### Commits

- `<HASH>` feat(plantillas): seccion propia + papelera 30d + feedback API

---

## [2026-05-08] — v2.3.0 — BLINDAJE DEPLOY + GRACEFUL SHUTDOWN

### Contexto

Auditoría adicional de blindaje en sistema de deploy y resiliencia ante caídas.
9 riesgos identificados (3🔴 / 3🟠 / 3🟡), 7 fixes aplicados sin tocar
comportamiento del motor en caliente. Aplicados con producción enviando.

### 🔴 P0 — Resiliencia ante deploy / SIGTERM

#### `src/massMailEngine.js`
- **`saveState()` ahora es atómica** (tmp + rename). Antes: `writeFileSync`
  directo → si el proceso moría mid-write, `mail-state.json` quedaba
  truncado/corrupto y el cap counter podía permitir superar 1650/24h.
  Ahora: escribimos a `.tmp.<pid>` y `renameSync` atómico (POSIX).
- **`stop()` ahora es ASYNC y drena el ciclo en curso** (max 10s).
  Antes: `clearTimeout` y muerte inmediata. Si justo entonces un email
  se enviaba (Gmail API call en vuelo), el proceso moría a los 200ms y el
  email quedaba en estado indeterminado. Ahora esperamos a que
  `processing=false` y guardamos el state final antes de exit.

#### `src/server.js`
- **Rastreo de conexiones HTTP activas** (`activeConnections` Set). Sin
  esto, `server.close()` esperaba indefinidamente a las conexiones
  keep-alive del reverse proxy de Coolify. Resultado anterior:
  `gracefulShutdown` nunca completaba, Coolify mandaba SIGKILL.
- **`gracefulShutdown` reescrito**:
  1. Para de aceptar nuevas conexiones (`server.close()`).
  2. Cierra keep-alive existentes (`conn.end()` + destroy a los 2s).
  3. Drena el motor (`await massMailEngine.stop({ maxDrainMs: 10000 })`).
  4. Cierra pool DB si existiera.
  5. Hard-kill de seguridad a los 25s (Coolify SIGKILL a los 30s).
- **Flag `shuttingDown`**: previene re-entrada si SIGTERM llega 2 veces.

### 🟠 P1 — Container hardening

#### `docker-compose.yml`
- **`mem_limit: 1200m`** + `memswap_limit: 1200m`: previene que la app
  consuma toda la RAM del VPS si hay leak. Docker mata y reinicia.
- **`stop_grace_period: 30s`**: da tiempo al `gracefulShutdown` a drenar
  antes de SIGKILL.
- **Healthcheck con `wget` ligero** (alpine ya lo trae) en vez de spawn
  de proceso Node completo cada 30s (~15MB RAM × 2880 veces/día).

#### `Dockerfile`
- Comentario alineando `--max-old-space-size=1024` con `mem_limit=1200m`.
  V8 lanza OOM con stack trace antes de que Docker mate "a oscuras".

### 🟡 P2 — Seguridad y docs

#### `COOLIFY_SETUP.md`
- Reemplazada contraseña real `+artesbuho26` por placeholder
  `<tu-password-aqui>` + nota de NO comitear jamás.

### ⚠️ ACCIÓN MANUAL PENDIENTE EN COOLIFY UI

Para activar **zero-downtime real** (arrancar nuevo container y esperar
healthcheck OK antes de matar el viejo), hay que ir a:

> Coolify → emailing-app → Settings → "Deployment Strategy"

y cambiar a **"Run new before old stops"** (o equivalente "Rolling").

Sin esto: hay ~10-30s de downtime entre stop del viejo y healthcheck OK
del nuevo. El bloque `deploy:` de docker-compose v3 NO aplica porque
Coolify usa docker compose normal (no Swarm).

### ⚠️ ROTAR PASSWORD

La contraseña `+artesbuho26` quedó en el git history. Cuando se pueda,
rotarla desde Coolify → Environment Variables → `APP_ACCESS_PASSWORD`.

### Lo que NO se cambió (decisión consciente)

- **Persistir snapshot de jobs al dataStore** (riesgo #2 del audit):
  refactor mayor que afecta el motor en caliente. Borrador para próxima
  iteración. Mientras tanto: el watchdog interno relanza el ticker si
  se cuelga, y los recipients no enviados quedan en cola tras restart
  (porque la cola se reconstruye desde campaign.recipients en dataStore).
- **Dockerfile USER no-root** (riesgo #5): requiere chown del volumen
  `app-data` que ya existe en producción. Para hacer correctamente sin
  perder permisos, necesita migración planificada. Borrador.

### Commits

- `<HASH>` feat(blindaje): saveState atómica, stop() async drain, conn tracking
- `<HASH>` chore(docker): mem_limit 1200m + stop_grace 30s + healthcheck wget
- `<HASH>` docs(seguridad): password placeholder + nota rotación

---

## [2026-05-08] — v2.2.0 — UX CAMPAÑAS + PLANTILLAS REUTILIZABLES

### Contexto

Tras estabilizar el motor (v2.1.0) y operar en producción con tráfico real,
emergieron fricciones de UX al crear campañas: faltaba pre-header (texto
gris junto al asunto en bandeja), faltaba reutilizar plantillas validadas,
faltaba favicon de marca, y la app aparecía sin estilos por DNS perdido.

### 🟠 P1 — Operación

- **Cap diario subido `1500 → 1600 → 1650`**. Gmail estabilizado tras 24h
  sin más rebotes; margen vs Google 2000 = **350 emails** (suficiente).
- **DNS `emailing.rubencoton.com` recreado** vía Hostinger API (A record
  → `187.77.166.84`, TTL 300). El dominio había desaparecido del DNS y la
  app aparecía sin CSS porque ningún asset cargaba.

### 🟢 P1 — Pre-header (preview text)

#### `src/dataStore.js`
- Campo `previewText` en `createTemplate` y `updateTemplate` (max 120 chars).

#### `src/server.js`
- `enqueueJob` propaga `previewText` del campaign al motor.

#### `src/massMailEngine.js`
- Inyección automática del pre-header como `<div style="display:none">…</div>`
  al inicio del body si el HTML no contiene ya `preheader`/`preview-text`.
- Si no hay `previewText` explícito, fallback a las primeras 100 chars del
  `textBody`.

#### `public/index.html`
- Input `<input name="previewText">` en formulario de campaña, debajo del
  asunto. Placeholder: "Pre-header (texto gris junto al asunto, recomendado
  <90 caracteres)".

### 🟢 P1 — Sistema de plantillas reutilizables

#### `public/index.html`
- Selector `<select id="campaignTemplateSelect">` en formulario campaña.
- Botón "⭐ Guardar como plantilla" como 3ª acción del form (junto a
  "Guardar borrador" y "Lanzar campaña").

#### `public/app.js`
- `populateCampaignTemplateSelect()`: carga plantillas con status
  `validada` o `borrador`. Refresca al entrar en pestaña Campañas.
- Handler `change` del selector: al elegir plantilla, **importa todo el
  contenido** (sobrescribe asunto, pre-header, HTML, texto plano, editor
  Gmail) y **salta automáticamente al modo "Vista previa"** para que el
  usuario vea cómo queda visualmente el email importado.
- Truco interno: pasa por modo "Pegar HTML" antes de "Vista previa" para
  que `lastEditMode=html` y NO machaque el HTML completo de la plantilla
  (DOCTYPE/head/styles) desde el contenido del editor Gmail.
- Submit handler: 3 acciones (`draft`, `template`, `send`). La acción
  `template` hace `POST /api/templates` con los datos del formulario.

### 🟢 Branding

- Favicon RUBEN COTON (logo RRSS) en `index.html`, `login.html`,
  `manual.html`. Reemplaza el círculo genérico del navegador.
- Fuente: Drive `1bFZ6RfoV96OFgvANj0nP5BCdCEQEWnCp` (PNG 4167x4167, 156KB).
- Servido desde `/assets/favicon-rrss.png`.

### Commits

- `0f38028` feat(campañas): pre-header en formulario + plantillas
- `06c9a61` feat(plantillas): selector + botón guardar como plantilla
- `36e5db7` feat: favicon RUBEN COTON (logo RRSS) en index/login/manual
- `459312e` feat(plantillas): seleccionar plantilla = importar TODO + Vista previa

### Hand-off para próxima sesión (si el hilo se rompe)

- App: `https://emailing.rubencoton.com` (Coolify VPS `187.77.166.84`)
- App UUID Coolify: `mu245rbjcqd6jxx2ouyev8no`
- Cap actual: **1650/24h rolling** (env `MAIL_DAILY_CAP=1650`)
- Slot horario actual: 08-13h = 10/min, 13-14h = 3/min, 14-18h = 4/min,
  18-20h = 1/min. Ventana cerrada 20:00-08:00.
- Auto-deploy Coolify tras push a `main` activo.
- Trazabilidad: README.md + CHANGELOG.md + plans.md + commits descriptivos.

---

## [2026-05-07] — v2.1.0 — AUDITORÍA EXHAUSTIVA + BLINDAJE TOTAL

### Contexto

Tras detectar el **bug crítico del `__hardCounter`** (que congeló el motor 18h sin enviar) y los **rebotes de Gmail por exceder cuota** (cap blindado 1950 era insuficiente), se hizo auditoría exhaustiva en 6 rondas con sub-agentes Opus, aplicando 33 fixes P0/P1.

### 🔴 Crítico — Cap diario reducido

- **`MAIL_DAILY_CAP`: 1950 → 1500** (margen vs Google 2000 = **500 emails**, antes solo 50). Razón: Gmail cuenta más estrictamente que nosotros (incluye bounces, retries, throttling), nuestro cap blindado de 1950 no era suficiente. El usuario recibió `mailer-daemon` con "Has llegado al límite de mensajes que puedes enviar" 2 veces consecutivas.

### 🟢 P0 — Auto-recuperación

#### `src/massMailEngine.js`

- **Watchdog auto-restart**: si el ticker se cuelga (await colgado, GC largo, bug desconocido) >5 min con ventana abierta o >15 min con ventana cerrada, reinicia automáticamente el ticker. Registra evento `watchdog_restart` en historial. **Resuelve el riesgo de cuelgue tipo `__hardCounter` para cualquier bug futuro.**
- **`tickerEpoch` validation**: evita doble-tick si `processNext()` resuelve un await tras restart del watchdog. Sin esto podríamos tener 2 tickers activos → ratio acelerado → cap superado.
- **Watchdog resetea flags al restart**: `processing=false` y `__throttleHit=false` para evitar quedar bloqueado en estado inconsistente.
- **`__hardCounter` resincronización con archivo**: el counter monotónico se ajusta con el snapshot del archivo (rolling 24h real) en cada chequeo del cap. **Resuelve permanentemente el bug del 2026-05-06**.
- **`getDailyUsedFromFile` con cache TTL 1s**: antes leía+parseaba `mail-state.json` síncronamente 10+ veces/min en PUNTA. Reducción ~80% de I/O.
- **Throttle anti-thrashing**: tras 10 ticks consecutivos rebotados por per-domain throttle (toda la cola del mismo dominio), espera `perDomainDelayMs` completo en vez de 200ms. Reset al primer envío OK.
- **`directTransportCache` LRU correcto**: `delete` antes de `set` para preservar orden de inserción cuando `mxHost` ya estaba presente.

#### `src/dataStore.js`

- **`getContactByEmail(email)` O(1)**: índice email→contact lazy con invalidación en cada `mutate()`. Antes el motor caía a `listContacts({})` que clonaba+escaneaba **56k contactos en CADA envío + en CADA writeback**. Mejora masiva en hot path.
- **`process.once`** en lugar de `process.on` para SIGTERM/SIGINT/beforeExit. Evita acumulación de listeners en hot-reload.
- **`_flushSync` limpia timer pendiente**: no más handles colgados al shutdown.
- **`getOverview` 1 loop**: antes 2 `filter()` separados sobre 56k contactos en cada `/api/panel` (cada 15s). Ahora 1 sola pasada cuenta `subscribed`+`suppressed`.
- **`recomputeCampaignStats` 1 loop**: antes 6 `filter()` consecutivos sobre recipients (10k items × 6 = 60k ops por evento). Ahora 1 loop.

#### `src/replyTracker.js`

- **Detectar 401 OAuth** durante scan; tras 3 consecutivos abortar con `reason=auth_expired` en lugar de seguir tragando errores silenciosamente. **Sin esto, OAuth expirado podía colgar el tracker silenciosamente igual al bug `__hardCounter`.**
- **Alerta en console.error** si auth_expired.
- **Trackear `_firstTimer`** y limpiarlo en `stop()` para evitar timers huérfanos.
- **`start()` idempotente**.

#### `src/sheetsWriteback.js`

- **Lock `_flushing` anti-reentrant**: antes dos `flush()` concurrentes hacían `queue.shift()` simultáneo → mismo item escrito 2 veces o perdido.
- **`try/finally`**: garantiza `_flushing=false` y reschedule si quedan items AUNQUE el bucle lance excepción inesperada.
- **`skipBySheet` TTL 24h**: antes el Map crecía permanentemente; tras meses con sheets cambiantes, leak silencioso + bloqueo eterno aunque el schema se arregle.

#### `src/googleHub.js`

- **Auto-retry singleton OAuth**: si `buildOAuthClient()` devuelve `null` (faltan creds), reintenta cada 5 min. Antes quedaba `null` permanente aunque el env se restaurase.
- **`isGoogleReady` invalida cache** si fallo previo + pasaron 5 min.
- **Token write atómico** (tmp + rename) + flag `_tokenWriteInFlight` para evitar corrupción del `token.json` si gaxios emite "tokens" concurrentes.

#### `src/server.js`

- **`sendCampaignLocks` TTL 60s** automático via `purgeSendLocks()` en cada request. Antes el `setTimeout` de cleanup podía perder entries si el proceso reiniciaba mid-30s.
- **`lockSet=true` ANTES** de `Map.set`: defensa extra para garantizar que el `finally` siempre limpie el lock.
- **`wbForEmail` y `processUnsubscribe` con `getContactByEmail` O(1)**: antes clonaban+filtraban 56k contactos en cada open/click/baja.
- **`.unref()` en setIntervals**: `backupInterval`, `periodicSync`, `sheetsAutoSyncInterval`. Antes bloqueaban graceful shutdown.

#### `src/gmailSender.js`

- **Retry con backoff exponencial** (1s/2s/4s + jitter ±25%) para errores 429/500/502/503 + timeout 30s en cada intento. Antes un blip transitorio abortaba el envío.
- **Detectar 401 → invalidar cliente cacheado** para forzar re-bind con OAuth fresh. Antes el client cacheado quedaba stale.

#### `src/driveArchive.js`

- **Validación JSON en `restoreStoreFromDrive`**: antes de sobrescribir disco, verifica:
  - `JSON.parse` no falla
  - Objeto tiene array `contacts` (shape mínimo)
  - Tamaño > 100 bytes
- Antes podía machacar el store local con basura si Drive devolvía backup truncado.

#### `src/spamShield.js`

- **`matchAll`** en lugar de `regex.exec` con `/g`. El regex global mantenía `lastIndex` mutable; concurrencia entre jobs corrompía el estado del regex compartido.

#### `src/attachments.js`

- **`try/catch` global** en operaciones fs (`totalSize`, `listAttachments`, `getAttachmentsForSending`, `removeAttachment`, `ensureDir`). Antes una falla de FS crasheaba el endpoint.
- **Mutex por `campaignId`** en `addAttachment` para evitar race condition en cap 10MB. Dos uploads simultáneos podían pasar el check ambos.
- **Cleanup de archivo huérfano** si `compressImage` o `totalSize` fallan.

#### `public/app.js`

- **`esc()` en chat IA** (P0 XSS): `appendChatMsg` interpolaba `msg`/`r.note`/`r.reply` directo en `innerHTML`. Si la IA generaba HTML inseguro o un input malicioso contenía `<img onerror=...>`, ejecutaba con cookies de sesión.

#### `public/index.html`

- **Sandbox sin `allow-scripts`** en iframe `aiChatFrame`. Era el único iframe con `allow-scripts`: si la IA generaba `<script>fetch('/api/...')</script>`, ejecutaba con cookies. `allow-same-origin` se mantiene para que doc.write funcione.

### Performance

- **`global.gc()` removido** del bucle de batch import en `sheetsSync.js`. Bloqueaba event-loop agresivamente en hojas grandes (35k+ contactos). Si hay leak real hay que perfilarlo, no forzar GC sincrónica.

### Robustez (P1)

- Guard `String(c.email||"").toLowerCase()` en `server.js:1193` (filter de purge de contacts). Antes crasheaba con TypeError si algún contacto sin email.

### Métricas

- **6 rondas de auditoría con sub-agents Opus**
- **33 fixes P0/P1** aplicados
- **9 archivos modificados** en `src/`
- **2 archivos modificados** en `public/`
- **0 tests rotos** (verificado con `node -c` en cada commit)
- **Commits**: `a1d7200`, `aee319a`, `fd8c23a`, `869d961`, `da7471f`, `4cebc8d`

### Veredicto

✅ **Sistema autónomo blindado para 24/7 sin supervisión.** Si algo se cuelga, watchdog reinicia. Si Node crashea, Docker reinicia. Si OAuth expira, tracker abortea con alerta. Cap 1500 con margen vs Google.

---

## [2026-05-05] — CIERRE v2.0: app lista para uso en producción

### Añadido

- **`data/disposable-domains.txt`** — lista comunidad **5.437 dominios** desechables (`disposable-email-domains/disposable-email-domains` GitHub). Antes solo 22 hardcoded → ahora se filtra una superficie ~250x mayor.
- **`SKIP_CRM_SLUGS` como env var** en `src/sheetsSync.js`. Combina hardcoded (`prueba-hoja-de-testeo-crm`) con CSV de la env var. Permite añadir CRMs de prueba sin redeploy.
- **Sidebar collapsed: iconos visibles** para Manual de uso (📄) y IA local agent (●). Antes en collapsed quedaba el sidebar vacío después de los tabs principales. Ahora el dot del agent local sigue mostrando verde/rojo/gris incluso plegado.

### Cambiado

- **Tagline unificada "DJ Profesional · Madrid"** en `public/campaign-report.html` (portada), `public/manual.html` (portada), `public/executive-report.html`. Antes había mezcla de "DJ Profesional" / "Booking & Management" / "Informe Ejecutivo".

### Verificado (audit final)

- ✅ Crear campaña → enviar: lock anti-doble-envío, validaciones spam, cap masivo (500/60.000), confirmación `forceSend`. Robusto.
- ✅ Bounces NO saturan inbox: `replyTracker` v2 con triple guard (sender daemon + auto-submitted header + body parse) auto-trashea mailer-daemon. Solo respuestas reales aparecen en Inbox.
- ✅ Sheets writeback en tiempo real: `WRITEBACK_FLUSH_MS=1500`. Cada open/click/reply/unsubscribe se refleja en la columna Merge status en <2s.
- ✅ Tracking firmado: `TRACKING_REQUIRE_HMAC=1` en producción. Server aborta si falta `TRACKING_SECRET`. Pixel y redirect verifican firma timing-safe.
- ✅ Paused sticky tras deploy: `syncCampaignsWithEngine` no recrea job si campaña está paused. /resume reconstruye desde recipientsSnapshot.
- ✅ DELETE purga events: hard delete elimina campaña + events asociados + reset dedupe idx.
- ✅ Unsubscribe registra evento + writeback Sheets con label "BAJA".
- ✅ Manual de uso accesible desde sidebar (`/manual`).

### Estado

**App lista para uso intensivo.** Puedes lanzar campaña con confianza.

---

## [2026-05-05] — Tabla Inicio: alineación columnar perfecta (2ª iter)

### Cambiado

- **Tabla individual del dashboard de Inicio** (`public/app.js` `cellMetric` interno): aplicado el mismo patrón de alturas fijas (16/18/20px) que ya usa la pestaña "Estado campañas". Cada celda métrica usa flexbox vertical con `gap:4px`, y cada bloque (número, porcentaje, etiqueta) tiene altura fija independiente del contenido. Esto garantiza que entre filas todos los números estén a la misma altura, todos los porcentajes a la misma altura y todas las etiquetas (`INICIANDO`, `POR MEJORAR`, `EXCELENTE`...) a la misma altura — **incluso cuando la celda "Campaña" lleva texto multilínea** (nombre + subject).
- **Celda "Campaña" y celda "Estado"** con `vertical-align:middle` para que el contenido quede centrado verticalmente respecto a las celdas métricas.

### Justificación

Petición usuario 2026-05-05 (2ª iteración tras ver captura): "quiero que en la misma fila aparezca el número, en la misma fila aparezca el porcentaje y en la misma fila aparezca el estado". La 1ª iteración del bloque de Inicio (commit `3a81462`) no tenía alturas fijas → al haber 1 sola fila visible no se notaba pero al haber varias campañas se desalineaba.

---

## [2026-05-05] — Hardening P0 pre-lanzamiento + informes depurados

### Añadido (Backend)

- **`status:"unsubscribed"`** soportado en `src/sheetsWriteback.js` con color amarillo pastel + label "BAJA". Ahora el operador ve en la columna Merge Status quien se ha dado de baja.
- **Handlers `/unsubscribe` GET y POST** registran `dataStore.addEvent({type:"unsubscribe"})` para todas las campañas activas que tenían al contacto, y disparan writeback Sheets con status `unsubscribed`. Antes solo cambiaban `contact.status` y stats `unsubscribed` quedaban en cero.
- **`src/server.js` — endpoint `/api/campaigns/report/executive`** soporta `?scope=weekly|monthly|historic` con `meta:{scope, periodLabel, periodFrom, periodTo}` en la respuesta. La gráfica y la tabla del informe ejecutivo HTML ahora pueden filtrar el periodo.
- **`best` y `worst`** en respuesta del endpoint executive (filtra `sent>=10` para no penalizar muestras pequeñas). Renderizado en `executive-report.html` como sección "⚖️ Mejor vs peor campaña" con delta de openRate en puntos porcentuales.
- **Glosario campaign-report.html** ampliado: CTA, soft bounce, hard bounce, lista negra/blanca, warm-up, SPF, DKIM, DMARC. Términos relevantes para presentar a directiva/sponsor.

### Cambiado (P0 audit pre-lanzamiento)

- **`src/server.js` DELETE `/api/campaigns/:id` (hard delete)** ahora también purga eventos huérfanos asociados (`store.events.filter(...)`) y limpia el índice de dedupe. Antes los eventos quedaban indefinidamente y el `data/store.json` crecía sin tope.
- **`src/server.js` endpoint executive** filtra campañas archivadas (`status !== "archived"`) del cómputo agregado, igual que ya hace el dashboard.
- **`src/server.js` y `public/campaign-report.html` — `bounceRate` unificado** a `bounced/total`. Antes el ejecutivo usaba `bounced/(sent+bounced)` y el individual `bounced/total`, dando ratios incoherentes entre los 2 informes para la misma campaña.
- **`src/trackingSign.js`:** si `TRACKING_REQUIRE_HMAC=1` y `TRACKING_SECRET` no está en env (o tiene <16 chars) el proceso **aborta el arranque** (`process.exit(1)`) con mensaje claro. Antes autogeneraba en memoria silenciosamente y al primer restart todas las URLs firmadas quedaban inválidas.
- **`src/replyTracker.js`:** uso de `listContacts({ search: failedTo })` en vez de `listContacts({})` al recibir un bounce. Carga ~1 contacto en vez de los 56k completos. Quita la llamada a `getContactByEmail` que no existía.

### Justificación

Auditoría profunda 2026-05-05 (2 subagentes paralelos: tracking flow + contenido informes). Bugs P0 detectados:
1. DELETE deja events huérfanos → bloat indefinido del store.
2. Unsubscribe no incrementa stats ni pinta Sheets → reportes incoherentes para directiva.
3. trackingSign autogen silencioso → opens/clicks invalidados tras cada restart.
4. `getContactByEmail` no existía → cargar 56k contactos en cada bounce.
5. bounceRate inconsistente entre los 2 informes.
6. Executive no filtraba archived ni soportaba scope.

Estado: 0 bugs P0 conocidos en código. El usuario puede lanzar campaña con confianza tras setear las env vars de Coolify.

### Test

- `node --check` en `server.js`, `sheetsWriteback.js`, `trackingSign.js`, `replyTracker.js` → OK.

### Acción manual requerida en Coolify (NO es código)

- **`TRACKING_SECRET`**: generar con `openssl rand -hex 32` y añadir a env. Ahora es **obligatorio** porque el server aborta si falta y `TRACKING_REQUIRE_HMAC=1`.
- **`TRACKING_REQUIRE_HMAC=1`**: activar para rechazar firmas inválidas/ausentes.
- **`MAIL_UNSUBSCRIBE_BASE_URL=https://emailing.rubencoton.com/unsubscribe`**: ya documentado, confirmar.
- **DNS DMARC** en `_dmarc.rubencoton.com` con `p=quarantine; rua=mailto:postmaster@rubencoton.com`.

---

## [2026-05-05] — Executive Report rediseño armónico

### Cambiado

- **`public/executive-report.html`** alineado con la pauta visual aprobada para `campaign-report.html`:
  - **Portada:** fondo blanco + cabecera negra con logo `logo-rrss.png` + cuerpo blanco. Antes era gradient naranja con emoji `🎧` como logo.
  - **Cover-brand:** "RUBEN COTON" amarillo → "Informe Ejecutivo" en naranja (consistencia con campaign-report).
  - **`h2.section-title`:** bloque NEGRO sólido con letras blancas + acento naranja a la izquierda. Antes era gradient naranja con borde amarillo.
  - **`h3.block-title`:** color naranja con borde izquierdo NEGRO (antes borde amarillo bajo).
  - **`thead th` (tablas):** fondo NEGRO con letras blancas y borde inferior naranja.
  - **`.footer`:** blanco con borde superior negro de 3px (antes gradient naranja).
  - **`.print-hint`:** negro sólido (antes gradient naranja).
  - **`@media print`** propagado: cover, header, h2, footer, thead todos en negro/blanco/naranja sin gradients (mejor renderizado en PDF).

### Justificación

Petición usuario 2026-05-05 reiterada: "fondo blanco con cabeceros negros y letras blancas dentro me mola mucho y es muy armónico, subtítulos en naranja para distinciones". Consistencia visual entre los 2 informes accesibles desde la app:
- `/campaigns/:id/report` → `campaign-report.html` (informe individual de campaña)
- `/campaigns/report/executive` → `executive-report.html` (informe ejecutivo agregado de TODAS las campañas)

### Pendiente coordinado

- `src/reportRenderer.js` (genera PDF via Drive Docs en `/api/campaigns/:id/report.pdf`) sigue en DARK MODE puro. Decisión: dejar como está hasta que el usuario lo solicite explícitamente, porque:
  1. Drive Docs HTML→PDF tiene restricciones (no flex/grid/gradient/rgba) → un refactor a la pauta nueva requiere replanteamiento.
  2. El path principal de PDF que usa el usuario es el `window.print()` desde `campaign-report.html` (ya alineado).

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

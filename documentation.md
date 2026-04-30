# DOCUMENTATION LOG

## 2026-03-31

### HECHO

- Se amplio la app de panel simple a plataforma de emailing funcional.
- Se creo `src/dataStore.js` con persistencia JSON y datos demo.
- Se rehizo `src/server.js` con APIs de:
  - contactos
  - importacion
  - segmentos
  - plantillas
  - campanas
  - eventos
  - analitica
  - workflows
  - motor masivo
- Se rehizo UI (`public/index.html`, `public/app.js`, `public/styles.css`).
- Se mantuvo login por contrasena.
- Se hizo auditoria profunda con rotura controlada y script automatizado `scripts/deep-audit.js`.
- Se corrigio `authRequired` para permitir `styles.css` sin romper la pantalla de login.
- Se corrigio parseo de cookies para evitar error 500 con cookies malformadas.
- Se corrigio politica de cookie `Secure` para no bloquear login en HTTP directo:
  - nuevo env `APP_AUTH_COOKIE_SECURE` (`auto|true|false`).
- Se corrigio duplicacion de eventos `bounce` en sincronizacion repetida de campanas.
- Se hizo tolerante el healthcheck ante fallo de DB cuando la DB es opcional:
  - nuevo env `DATABASE_REQUIRED` (por defecto `false`).
  - si `DATABASE_REQUIRED=true`, `/health` vuelve a modo estricto.

### VALIDACIONES

- `node --check src/server.js` OK.
- `node --check src/dataStore.js` OK.
- Login/API endpoints basicos probados con WebRequestSession.
- `/health` devuelve 200 en local.
- `npm run audit:deep` OK (3/3 tests verdes).
- Auditoria remota Coolify:
  - APP_ARTES-BUHO_EMAILING en `running:healthy`.
  - Healthcheck remoto ajustado a `/health`.
  - Canal masivo confirmado en `MAIL_TRANSPORT_MODE=direct`.
  - Ritmo confirmado en `MAIL_RATE_LIMIT_PER_MIN=5`.
  - Cookie segura remota en `APP_AUTH_COOKIE_SECURE=auto`.
  - Limpieza de variable de prueba `TEST_TEMP_DELETE`.
- Verificacion publica de dominio:
  - `https://emailing.artesbuhomanagement.com/health` responde 200.
  - `https://emailing.artesbuhomanagement.com/login` responde 200.
  - Login + cookie + dashboard autenticado responden correctamente.
- Rediseño corporativo profesional aplicado:
  - logo oficial integrado en `/public/assets/logo-artes-buho.jpg`.
  - nueva identidad visual roja/amarilla/blanca en `public/styles.css`.
  - firma de autoria visible en login y dashboard:
    - "Desarrollada por RUBEN COTON para Artes Búho."
  - footer corporativo añadido en la app.
- Auditoria tecnica post-rediseño:
  - `npm run audit:deep` OK (3/3 tests verdes tras cambios de marca).
- Ajuste de acceso publico de assets:
  - se habilito `requestPath.startsWith("/assets/")` en `authRequired`.
  - corregido logo roto en pantalla de login sin sesion.
- Renombre visual solicitado:
  - marca principal en login/panel: `Aplicaciones de Artes Buho`.
  - nombre de app visible: `Mailing y Envios Masivos`.
- Correccion critica del motor de envio propio:
  - se anadio dependencia `nodemailer-direct-transport`.
  - se actualizo `src/massMailEngine.js` para usar transporte directo real.
  - se normaliza la clave DKIM eliminando comillas envolventes si existen.
  - se mantuvo limite operativo en `5 correos/minuto`.
- Operacion remota ejecutada:
  - push en `main` con commit `7255629`.
  - redeploy remoto de `APP_ARTES-BUHO_EMAILING` lanzado por API Coolify.
  - auto-redeploy en lote aplicado a todas las apps `APP_*`.
- Prueba real de envio en produccion:
  - login remoto OK.
  - job `job_2b1f97ef8e007b8c` finalizado en `completed`.
  - resultado: `sent=1`, `failed=0` hacia `booking@artesbuhomanagement.com`.

### PENDIENTE

- Persistencia total en PostgreSQL (ahora fallback JSON para velocidad de entrega).
- Suite de tests automatizados ampliada (unit/integration/e2e completos).
- Webhooks externos reales para eventos proveedor.
- Endurecer reporting de bots y machine opens.

## 2026-03-31 (continuacion)

### HECHO

- Definicion de app reforzada en UI:
  - nueva pestana `Configuracion` en `public/index.html`.
  - acciones desde panel:
    - probar proveedor
    - pausar/reanudar motor
    - envio de prueba de 1 correo
  - checklist tecnico visible en panel para estado de produccion.
- Backend reforzado para checklist tecnico:
  - endpoint nuevo `GET /api/setup/checklist`.
  - validaciones automaticas de:
    - motor activo
    - modo de envio
    - remitente/reply-to
    - ritmo por minuto
    - DNS A del host directo
    - PTR/reverse DNS
    - DKIM DNS
    - SPF DNS
    - DMARC DNS
  - cache por TTL para no sobrecargar consultas DNS.
- Endpoint nuevo para prueba rapida:
  - `POST /api/mass-mail/send-test`.
  - encola 1 destinatario desde el panel.

### VALIDACIONES

- `node --check src/server.js` OK.
- `node --check public/app.js` OK.
- `npm run audit:deep` OK (3/3 tests verdes).
- smoke manual local:
  - login OK
  - `GET /api/setup/checklist` responde
  - `POST /api/mass-mail/send-test` valida email destino y devuelve error controlado si es invalido.

## 2026-03-31 (continuacion 2)

### HECHO

- Se reforzo la validacion DNS/PTR en `src/server.js` para evitar falsos positivos:
  - filtro de IP publica IPv4 (descarta loopback/local como `127.x`, `192.168.x`, etc.).
  - consulta DNS publica adicional (`dns.google`) para validar A record real.
  - combinacion y deduplicacion de resultados DNS local + publico.
  - validacion PTR solo si existe IP publica valida.
  - mensaje explicito cuando el host solo resuelve localmente.

### VALIDACIONES

- `node --check src/server.js` OK.
- `node --check public/app.js` OK.
- `npm run audit:deep` OK (3/3 tests verdes).

## 2026-03-31 (continuacion 3)

### HECHO

- Ajuste UX de login corporativo:
  - textos en espanol correcto con tildes y eñe.
  - prioridad visual de marca Artes Búho.
  - credito del desarrollador en linea secundaria.
  - boton "ojo" para mostrar/ocultar contraseña.
  - si llega `?password=...` en URL, se precarga y se limpia la URL a `/login`.

### VALIDACIONES

- `npm run audit:deep` OK (3/3 tests verdes tras ajustes de login).

## 2026-03-31 (continuacion 4 - auditoria profunda final)

### HECHO

- Auditoria de estres en produccion ejecutada de forma remota:
  - `GET /health` -> 600 peticiones concurrentes (sin 5xx).
  - `GET /api/dashboard` -> 500 peticiones concurrentes (sin 5xx).
  - `GET /api/setup/checklist` -> 350 peticiones concurrentes (sin 5xx).
  - `POST /api/contacts` (payload invalido) -> 250 peticiones (400 controlado, sin 5xx).
  - `POST /api/mass-mail/jobs` (payload invalido) -> 200 peticiones (400 controlado, sin 5xx).
- Prueba extra local de estres:
  - 5.700 peticiones (dashboard/checklist/jobs invalidos) con concurrencia alta.
  - resultado: 0 errores 5xx, servidor estable, health final 200.
- Auditoria de ecosistema Coolify renovada:
  - reporte actualizado en `coolify-apps-status.json`.
  - `APP_ARTES-BUHO_EMAILING` en `running:healthy`.
  - `auto_deploy_mode` via GitHub App confirmado en apps `APP_*`.
- Se detecto y corrigio vulnerabilidad critica de dependencias:
  - eliminada dependencia `nodemailer-direct-transport` (arrastraba `underscore` vulnerable).
  - `src/massMailEngine.js` migrado a transporte directo nativo de Nodemailer:
    - `createTransport({ direct: true, name: ... })`.
- Seguridad de dependencias tras correccion:
  - `npm audit --omit=dev` => 0 vulnerabilidades.

### ESTADO

- Aplicacion estable bajo carga.
- Sin errores 5xx durante pruebas de estres ejecutadas.
- Motor masivo configurado en modo propio `direct` a 5 correos/min.
- Checklist de produccion:
  - `ready: true`
  - `ok: 10`
  - `warn: 1`
  - `error: 0`
- Unico warning tecnico pendiente:
  - PTR inverso aun resuelve a `srv1533630.hstgr.cloud` en vez de `mailer.artesbuhomanagement.com`.
- Base de datos en produccion:
  - sigue en modo opcional con error de auth PostgreSQL (`postgres`), sin bloquear la app.

### VALIDACIONES

- `node --check src/massMailEngine.js` OK.
- `npm run audit:deep` OK (3/3).
- `npm audit --omit=dev` OK (0 vulnerabilidades).

## 2026-03-31 (continuacion 6 - validacion remota final)

### HECHO

- Push remoto realizado:
  - commit `2adf583` (seguridad dependencias + auditoria).
  - commit `05f9a9f` (motor directo por MX real).
- Redeploy remoto lanzado y aplicado en Coolify para `APP_ARTES-BUHO_EMAILING`.
- Validacion de salud post-redeploy:
  - app en `running:healthy`.
  - `/health` -> 200.
  - motor masivo activo en `direct`, `paused=false`, `queue=0`.
- Prueba real de envio post-fix:
  - job `job_ce9ec1314707eb12`.
  - estado `completed`.
  - `sent=1`, `failed=0` a `booking@artesbuhomanagement.com`.
- Stress final post-redeploy:
  - 1000 requests concurrentes (health/dashboard/checklist).
  - 0 errores 5xx.

### ESTADO

- Plataforma operativa en produccion.
- Envio masivo propio funcional a 5 correos/min.
- Login corporativo con logo y boton ojo funcional.
- Unico warning tecnico pendiente: PTR inverso.

### PENDIENTE

- Configurar rDNS/PTR en proveedor VPS:
  - `187.77.166.84 -> mailer.artesbuhomanagement.com`.
- Revisar credenciales PostgreSQL de produccion si se quiere usar DB real (ahora la app funciona con DB opcional).

## 2026-03-31 (continuacion 5 - correccion motor directo)

### HECHO

- Se detecto fallo funcional en produccion tras redeploy:
  - error de envio directo: `ECONNREFUSED ::1:587`.
- Se corrigio `src/massMailEngine.js` para modo propio `direct` real:
  - resolucion MX por dominio de cada destinatario.
  - conexion SMTP saliente a `mxHost:25` (sin proveedor externo).
  - cache de transportes por host MX para rendimiento.
  - soporte DKIM mantenido en modo directo.
- Se mantuvo la eliminacion de dependencia vulnerable `nodemailer-direct-transport`.

### VALIDACIONES

- `node --check src/massMailEngine.js` OK.
- `npm run audit:deep` OK (3/3).
- `npm audit --omit=dev` OK (0 vulnerabilidades).

## 2026-04-06 (auditoria profunda + estres end-to-end)

### HECHO

- Auditoria local profunda ejecutada:
  - `npm run audit:deep` -> 3/3 OK.
  - `npm audit --omit=dev` -> 0 vulnerabilidades.
- Estres en produccion (con login real + cookie de sesion):
  - `GET /health` -> 600 peticiones, concurrencia 60.
  - `GET /api/dashboard` -> 500 peticiones, concurrencia 50.
  - `GET /api/setup/checklist` -> 350 peticiones, concurrencia 35.
  - `POST /api/mass-mail/jobs` invalido -> 250 peticiones, 400 controlado.
  - `POST /api/mass-mail/send-test` invalido -> 200 peticiones, 400 controlado.
  - resultado global: 1900/1900 correctas, 0 bad, 0 netErr, 0 muestras 5xx.
- Estres local extremo adicional:
  - 5700 peticiones totales (health/dashboard/checklist/jobs invalidos).
  - resultado: 5700/5700 correctas, 0 bad, 0 netErr.
- Prueba funcional real de envio en produccion:
  - endpoint: `POST /api/mass-mail/send-test`.
  - destino: `booking@artesbuhomanagement.com`.
  - job: `job_fc4820dbc90fffb0`.
  - estado final: `completed`.
  - destinatario final: `sent`.
- Auditoria remota de ecosistema Coolify:
  - `APP_ARTES-BUHO_EMAILING` -> `running:healthy`.
  - resto de apps `APP_*` accesibles via API y en estado running.

### ESTADO

- Backend estable bajo carga en local y produccion.
- Motor de envio propio en modo `direct` operativo.
- Limite de envio configurado en `5 correos/min`.
- Checklist de setup en produccion:
  - `ready: true`
  - `ok: 10`
  - `warn: 1`
  - `error: 0`
- Warning pendiente:
  - `reverse_dns`: PTR de `187.77.166.84` sigue apuntando a `srv1533630.hstgr.cloud`.
- Nota de datos:
  - `/health` reporta `db: error` en produccion con `dbOptional: true` (no bloquea servicio).

### SIGUIENTE PASO TECNICO

- Ajustar PTR/rDNS en Hostinger:
  - `187.77.166.84 -> mailer.artesbuhomanagement.com`.
- Si se quiere persistencia SQL real:
  - revisar credenciales de `DATABASE_URL` para quitar `dbOptional`.

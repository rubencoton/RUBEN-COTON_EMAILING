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

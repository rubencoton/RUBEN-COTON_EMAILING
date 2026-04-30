# ESTUDIO TECNICO
## Plataformas de emailing masivo y arquitectura recomendada
Fecha: 2026-03-30

## 1) CONCLUSION RAPIDA

- Para enviar masivo de forma profesional:
  - No usar Gmail/Workspace como motor principal de envio.
  - Si usar Gmail para recibir respuestas (reply-to).
- Motor recomendado para tu caso:
  - `LocalProvider` para desarrollo y pruebas.
  - `Brevo` o `SendGrid` como proveedor real.
- Obligatorio para entregabilidad:
  - SPF + DKIM + DMARC.
  - One-click unsubscribe (RFC 8058).
  - Supresion inmediata de bajas, bounces y complaints.
  - Webhooks firmados y normalizados en tu propia BD.

## 2) COMO FUNCIONAN ESTAS PLATAFORMAS (RESUMEN)

Todas siguen este flujo:

1. Importan contactos.
2. Segmentan audiencias.
3. Crean campanas/automatizaciones.
4. Envio por cola (batch + throttling).
5. Tracking:
   - Open: pixel de 1x1.
   - Click: reescritura de enlaces.
6. Recepcion de eventos por webhook:
   - delivered, open, click, bounce, unsubscribe, complaint, etc.
7. Supresion y compliance automatica.
8. Dashboards y reglas de automatizacion por evento.

## 3) COMPARATIVA PRACTICA

### Mailchimp
- Muy fuerte en marketing UI y journeys.
- Reportes de open/click/delivered con advertencias de actividad bot/MPP.
- Webhooks en planes superiores para ciertos usos.

### Brevo
- Muy util para marketing + transaccional.
- Eventos webhook claros:
  sent, delivered, opened, clicked, soft/hard bounce, spam, unsubscribed, etc.
- Automations con triggers de opened/clicked/unsubscribed y mas.

### SendGrid
- Muy fuerte para enfoque API/backend.
- Event Webhook muy completo y casi real-time.
- Seguridad webhook robusta (firma y OAuth).
- Importante: su documentacion reconoce eventos no humanos (bots/filtros) en open/click.

### Amazon SES
- Potente y economico para volumen alto.
- Mas "infra", requiere montar mas piezas (tracking/UX) por tu cuenta.
- Event publishing a SNS/EventBridge/Firehose y control de suppression list.

## 4) REQUISITOS 2024+ QUE IMPACTAN DIRECTO EN TU PROYECTO

- Gmail (desde 1 febrero 2024):
  - Requisitos de autenticacion y calidad para remitentes.
  - Para bulk (5.000+/dia a Gmail): SPF + DKIM + DMARC, unsubscribe facil, spam bajo.
- Gmail:
  - Refuerzo de enforcement desde noviembre 2025 para trafico no conforme.
- Yahoo:
  - Requisitos equivalentes para bulk:
    SPF + DKIM + DMARC, unsubscribe facil/one-click, spam rate bajo.

## 5) LIMITES CLAVE DE GMAIL WORKSPACE (POR QUE NO ES MOTOR MASIVO)

- Limites de envio por usuario (rolling 24h) existen y no son para SaaS masivo.
- Ejemplos publicados por Google Workspace:
  - 2.000 mensajes/dia por cuenta.
  - 1.500 para mail merge.
  - 500 en trial.
- Resultado:
  - Gmail Workspace sirve para correo operativo normal.
  - No sirve como base de envio masivo de plataforma.

## 6) ARQUITECTURA RECOMENDADA PARA TU APP

1. Tu app gestiona contactos/segmentos/campanas/workflows.
2. Tu app encola envios (worker).
3. Adaptador de proveedor:
   - `LocalProvider` (demo/test)
   - `BrevoProvider` o `SendGridProvider` (real)
4. Todos los eventos entran por `/webhooks/provider`.
5. Normalizacion interna a eventos canonicos:
   - delivered/open/click/bounce/unsubscribe/complaint
6. Motor de supresion y compliance antes de enviar.
7. Analytics calculada desde eventos internos, no desde UI del proveedor.

## 7) RECOMENDACION DE EJECUCION REMOTA

Fase A (inmediata):
- Entorno local + Coolify con deploy automatico por push.
- LocalProvider + simulador de eventos.
- Dashboard y workflows demo funcionales.

Fase B (conexion real):
- Activar Brevo o SendGrid.
- Configurar DNS de dominio de envio.
- Activar webhooks firmados.
- Validar suppression y unsubscribe one-click.

Fase C (hardening):
- Alertas de spam/bounce rate.
- Reintentos controlados e idempotencia estricta.
- Observabilidad y auditoria completas.

## 8) RIESGOS SI SE HACE MAL

- Reputacion de dominio/IP dañada.
- Spam folder masivo.
- Bloqueos/rechazos (Gmail/Yahoo).
- Datos de open inflados por bots.
- Problemas legales por baja/supresion mal implementadas.

## 9) FUENTES OFICIALES

- Gmail sender guidelines:
  - https://support.google.com/mail/answer/81126?hl=en
- Gmail sender FAQ (enforcement):
  - https://support.google.com/a/answer/14229414?sjid=10839055942912047263-NA
- Limites Gmail Workspace:
  - https://support.google.com/a/answer/166852?hl=en
- Yahoo sender best practices:
  - https://senders.yahooinc.com/best-practices/?is_listing=false
- Yahoo one-click / subscription hub:
  - https://senders.yahooinc.com/subhub/
- Brevo transactional webhooks:
  - https://developers.brevo.com/docs/transactional-webhooks
- Brevo automations triggers/actions:
  - https://help.brevo.com/hc/en-us/articles/15445989568402-Available-triggers-actions-and-rules-in-an-automation
- SendGrid Event Webhook reference:
  - https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event
- SendGrid Event Webhook security:
  - https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/getting-started-event-webhook-security-features
- SendGrid tracking settings:
  - https://www.twilio.com/docs/sendgrid/ui/account-and-settings/tracking
- SES event publishing:
  - https://docs.aws.amazon.com/ses/latest/dg/monitor-using-event-publishing.html
- SES event payload:
  - https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
- SES suppression list:
  - https://docs.aws.amazon.com/ses/latest/dg/sending-email-suppression-list.html
- RFC 2369 (List-Unsubscribe):
  - https://www.rfc-editor.org/rfc/rfc2369
- RFC 8058 (One-click unsubscribe):
  - https://www.rfc-editor.org/rfc/rfc8058
- RFC 7489 (DMARC):
  - https://www.rfc-editor.org/rfc/rfc7489

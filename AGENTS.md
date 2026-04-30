# AGENTS.md

## OBJETIVO DEL PROYECTO

Construir una plataforma de emailing tipo SaaS para:

- contactos
- segmentos
- plantillas
- campanas
- envios masivos
- tracking
- automatizaciones

## REGLAS DE IMPLEMENTACION

1. Entregar funcionalidad usable en cada hito.
2. Mantener APIs simples y estables.
3. No bloquear por integraciones externas.
4. Motor local/demo siempre disponible.
5. Seguridad basica siempre activa (login por contrasena).

## CONVENCIONES

- Backend: Node.js + Express.
- Frontend: HTML/CSS/JS vanilla (sin build complejo).
- Persistencia actual: JSON (`data/store.json`) con estructura preparada para migrar a PostgreSQL.
- Nombres de variables y codigo en ingles.
- Documentacion principal en espanol.
- Nombre del desarrollador para UI y textos: `RUBEN COTON` (siempre en mayusculas, sin tildes).

## HERRAMIENTAS OPERATIVAS

- Coolify API scripts en `scripts/`.
- Estado remoto en `docs/`.

## PRIORIDADES INMEDIATAS

1. Estabilizar flujo end-to-end de campana.
2. Mejorar importador y mapeo avanzado.
3. Endurecer tracking y webhooks reales.
4. Migrar persistencia completa a PostgreSQL.

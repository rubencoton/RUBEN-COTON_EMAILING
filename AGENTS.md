# AGENTS.md

## OBJETIVO DEL PROYECTO

Construir una plataforma de emailing tipo SaaS, **autónoma 24/7**, para:

- contactos
- segmentos
- plantillas
- campanas
- envios masivos
- tracking
- automatizaciones

El sistema debe **funcionar solo, recuperarse solo y avisar solo** si algo se rompe.

## REGLAS DE IMPLEMENTACION

1. Entregar funcionalidad usable en cada hito.
2. Mantener APIs simples y estables.
3. No bloquear por integraciones externas.
4. Motor local/demo siempre disponible.
5. Seguridad basica siempre activa (login por contrasena).
6. Auto-recuperación obligatoria: watchdog, retries, fallback graceful.
7. Cero acciones silenciosas — todo log, todo audit.

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
- Runbook autorrecuperación: [`OPERATIONS.md`](OPERATIONS.md).

## PRIORIDADES INMEDIATAS

1. Estabilizar flujo end-to-end de campana.
2. Mejorar importador y mapeo avanzado.
3. Endurecer tracking y webhooks reales.
4. Migrar persistencia completa a PostgreSQL.

---

## TRAZABILIDAD OBLIGATORIA (regla irrenunciable)

Cualquier cambio en este repo **debe** quedar trazado en los siguientes archivos antes de dar la tarea por terminada. Sin trazabilidad → tarea NO terminada.

### Archivos a actualizar siempre

| Archivo | Cuándo se toca | Formato |
|---|---|---|
| `CHANGELOG.md` | **Cada sesión productiva** | Keep a Changelog en español. Bloque por fecha (ISO `YYYY-MM-DD`) con secciones: Añadido / Cambiado / Corregido / Eliminado / Pendiente. |
| `plans.md` | Si se completa o añade un ítem de HITO | Marcar `[x]` ítems hechos. Añadir nuevos pendientes. |
| `README.md` | Si cambia stack, env vars, features clave o flujo de deploy | Mantener tabla "Hand-off rápido" con valores reales. |
| `OPERATIONS.md` | Si cambia algo del runbook (restart, recovery, comandos, alertas) | Sección por tipo de incidencia + receta paso a paso. |
| `commit message` | Cada commit | `feat:` / `fix:` / `refactor:` / `perf:` / `docs:` / `chore:` con prioridad `P0/P1/P2` cuando aplique. |

### Niveles de detalle por tipo de cambio

- **`feat`/`refactor`** que toca features clave → README + CHANGELOG + plans.md.
- **`fix` con bug visible para el usuario** → CHANGELOG con sección **Contexto** (qué reportó el usuario, dónde lo vio).
- **`perf` con número** → CHANGELOG con benchmark antes/después en milisegundos o MB.
- **`chore`** sólo necesita commit descriptivo.

### Citar archivos y líneas

Cualquier mención de código en docs **debe** usar `archivo.js:LÍNEA` para que el ojo lo encuentre rápido. No citar funciones huérfanas sin ubicación.

### Política de comentarios en código

- Comentar **el porqué**, no el qué.
- Si un fix nace de un bug reportado por el usuario, el comentario inline debe llevar fecha + 1 línea de contexto: `/* P0 FIX 2026-05-08 (peticion usuario "no carga nada"): ... */`
- No borrar estos comentarios al refactorizar — son la única pista del origen.

### Anti-patrones prohibidos

- ❌ Commit "WIP" sin descripción.
- ❌ `catch (_) {}` sin comentario explicando por qué se ignora.
- ❌ Cambiar UI sin actualizar `CHANGELOG.md`.
- ❌ Marcar HITO `[x]` sin commit que demuestre el cierre.

---

## AUTO-FUNCIONAMIENTO

El sistema arranca con `node src/server.js` (o vía Docker en Coolify) y debe funcionar **sin intervención humana** hasta que se quiera apagar:

- **Watchdog motor** — vigila el ticker cada 60s; reinicia tick si lleva >5 min mudo en ventana abierta.
- **OAuth auto-retry** — si token Google falla, reintento cada 5 min; sin crashear.
- **Backup auto store.json** — a Drive cada hora (`STORE_BACKUP_INTERVAL_MS`).
- **Auto-restore** — si arranca con store vacío y Drive tiene backup, recupera automático.
- **Reply tracker** — escanea inbox cada 10 min sin tocar nada (solo registra y marca leído).
- **Sheets sync** — auto cada 30 min L-V 8-20h Madrid.
- **Trash purge** — plantillas en papelera >30 días se borran solas cada 6h.
- **Restart Docker** — `restart unless-stopped` en Coolify.

Si el sistema falla pese a todo → consultar [`OPERATIONS.md`](OPERATIONS.md) para diagnóstico y recuperación manual.

# Coolify Setup — APP_ARTES-BUHO_EMAILING

Guia paso a paso para montar la app en el VPS.

> **Refactor 2026-04-25**: PostgreSQL ELIMINADO. Persistencia 100% local
> en `/app/data/store.json` con backup horario auto a Drive. Motivo:
> el container PostgreSQL saturaba el disco del VPS (ENOSPC repetidos).

## Arquitectura actual

```
[Google Sheets] --(sync cada 2h + mirror)--> [App Node.js + store.json] --> SMTP
                                                       |
                                                       └─→ Backup horario
                                                           a Google Drive
```

- **Sheets = fuente de verdad para CONTACTOS**. MIRROR_MODE=true: si borras una pestaña, la lista desaparece.
- **store.json = fuente de verdad para CAMPAÑAS, TRACKING, PLANTILLAS**. Volume Coolify persistente.
- **Drive BACKUPS/ = recovery layer**. Últimos 24h de store.json (rotación auto).
- **IA cascada de 9 modelos** para generar emails.

---

## PASO 1 — Crear app en Coolify

1. Entra en Coolify.
2. **+ New Resource** → **Application** (Docker compose).
3. Apunta al repo del proyecto, branch `main`.
4. Coolify detectará `docker-compose.yml`.
5. **Importante**: NO crees recurso PostgreSQL. La app no lo usa.

---

## PASO 2 — Variables de entorno de la app

En la app de emailing → **Environment Variables** → añade:

### Auth (OBLIGATORIO)

```
APP_ACCESS_PASSWORD=+artesbuho26
APP_ACCESS_SECRET=cambia-este-secreto-en-produccion
```

### Google Sheets + Drive (OBLIGATORIO para sync + backup)

```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
SHEETS_SYNC_INTERVAL_HOURS=2
SHEETS_MIRROR=true
DRIVE_ROOT_FOLDER_ID=1-MEdFyWKjdgEShJlrFHwBn8PvQ07qk5O
```

### SMTP (OBLIGATORIO para envio)

```
MAIL_TRANSPORT_MODE=smtp
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM_EMAIL=booking@artesbuhomanagement.com
SMTP_FROM_NAME=ARTES BUHO MANAGEMENT
SMTP_REPLY_TO=booking@artesbuhomanagement.com
```

### IA cascada (AL MENOS UNA)

```
SAMBANOVA_API_KEY=...
CEREBRAS_API_KEY=...
MISTRAL_API_KEY=...
OPENROUTER_API_KEY=...
GROQ_API_KEY=...
GEMINI_API_KEY=...
```

Recomendado minimo: **GROQ_API_KEY** (gratis, rapida).

### Backup auto (opcional)

```
STORE_BACKUP_INTERVAL_MS=3600000   # 1h por defecto
```

---

## PASO 3 — Volume persistente

Coolify ya crea el volumen `app-data` montado en `/app/data` según
`docker-compose.yml`. **Verifica** en Coolify → Application → Storage:

- `app-data` → `/app/data` (debe estar tildado como persistente)

Si `store.json` se pierde (volumen recreado), restaurar desde Drive:
**Drive → ENVIO MASIVO · Histórico de campañas → BACKUPS** → último archivo
`store-YYYY-MM-DD-HH.json`.

---

## PASO 4 — Redeploy

1. Clic **Redeploy** en la app.
2. Mira logs: debe aparecer:
   - `APP_ARTES-BUHO_EMAILING listening on port 3000`
   - `[drive] ecosistema Google listo`
   - A los 60s: `[backup] store.json subido a Drive: store-XXXX.json`
3. Abre: `https://emailing.artesbuhomanagement.com/api/health/full`
4. Debe devolver:

```json
{
  "status": "ok",
  "data": {
    "db": { "configured": false, "connected": false, "mode": "file_store" },
    "store": {
      "loaded": true,
      "contacts": 51499,
      "templates": 2,
      "sizeMB": 12.3
    },
    "ai": { "providersConfigured": ["groq", "gemini"] },
    "sheets": { "idsActive": ["1_VK6eXq..."] }
  }
}
```

---

## PASO 5 — Sync inicial

1. Entra en la app con tu password.
2. **Configuracion** → **Sincronizar ahora**.
3. Espera. ~1-3 min con 51K contactos.
4. Los contactos se veran en **Contactos** y las listas en **Campañas → Selector de lista**.

---

## PASO 6 — Verificar MIRROR

1. En Google Sheets, crea una pestaña `TEST_MIRROR` con 3 contactos.
2. Sync manual.
3. Comprueba que aparece como lista `test-mirror`.
4. Borra la pestaña en Sheets.
5. Sync manual.
6. La lista `test-mirror` y sus 3 contactos desaparecen.

Si NO quieres el mirror: `SHEETS_MIRROR=false`.

---

## PASO 7 — Verificar backup auto

A los 60s del arranque y luego cada hora, los logs deben mostrar:
```
[backup] store.json subido a Drive: store-2026-04-25-13.json
```

En Drive: **ENVIO MASIVO · Histórico de campañas → BACKUPS/** debe
acumular hasta 24 archivos `store-*.json` (rotación 24h).

---

## Troubleshooting

### "Error de API" al generar email con IA
- Faltan API keys de IA. Añade al menos `GROQ_API_KEY`.
- Verifica en `/api/health/full` → `ai.providersConfigured` no vacío.

### Dropdown de CRM vacio
- No se hizo sync todavía. Botón "Sincronizar ahora".
- O falla auth de Google Sheets. Mira logs.

### `[backup]` no aparece en logs
- Faltan credenciales Google. Verifica `GOOGLE_*` env vars.
- O `DRIVE_ROOT_FOLDER_ID` mal escrito.

### store.json corrupto
- La app detecta JSON inválido y crea backup como `store.json.corrupt-{ts}`.
- La app arranca con un store demo nuevo.
- **Restauración manual**: descarga último archivo de Drive/BACKUPS, súbelo
  como `/app/data/store.json` vía Coolify Files o restart pod con el volumen.

### App muy lenta
- store.json grande (>50MB con muchos eventos).
- Auto-cleanup interno limita events a 5000 y workflowRuns a 200.
- Si crece más, revisar `recipientsSnapshot` de campañas viejas.

---

## Arquitectura final en VPS

```
┌────────────────────────────────────────────┐
│ Coolify VPS                                │
│                                            │
│  ┌──────────────┐                          │
│  │ emailing-app │                          │
│  │ (Node 20)    │                          │
│  │ :3000        │                          │
│  └──────┬───────┘                          │
│         │                                  │
│         └─→ Volume: app-data               │
│             /app/data/store.json           │
└────────────────────────────────────────────┘
           ↑                ↑              ↓
           │                │              │
     Google Sheets     SMTP externo   Google Drive
     (sync cada 2h)    (Brevo/SES)    BACKUPS/
                                       (cada hora)
```

## Recursos VPS necesarios

- **Disk**: ~200MB (app + node_modules + store.json hasta 50MB).
- **RAM**: 512MB (NODE_OPTIONS --max-old-space-size=512).
- **CPU**: 1 vCPU es suficiente para 35K contactos.

Sin PostgreSQL ahorras ~1-2GB de disk y ~256MB RAM.

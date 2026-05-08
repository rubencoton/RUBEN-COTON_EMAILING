# OPERATIONS.md — Runbook RUBEN-COTON_EMAILING

Última actualización: 2026-05-08

Cómo diagnosticar, recuperar y mantener el sistema cuando algo se rompe. Sigue el orden: arriba hay incidencias frecuentes; abajo, comandos de emergencia.

---

## 0. Datos de sistema

| Pieza | Valor |
|---|---|
| URL prod | `https://emailing.rubencoton.com` |
| VPS | `187.77.166.84` (Hostinger) |
| Coolify URL | `http://187.77.166.84:8000` |
| App UUID Coolify | `mu245rbjcqd6jxx2ouyev8no` |
| Repo | `github.com/rubencoton/RUBEN-COTON_EMAILING` (privado) |
| Branch deploy | `main` (autodeploy on push) |
| Cuenta envío | `manager@rubencoton.com` (Workspace Business) |
| Cap diario | `MAIL_DAILY_CAP=1650` rolling 24h |
| Ventana | 08:00-20:00 Madrid (`MAIL_SEND_WINDOW_*`) |

---

## 1. App no responde / 502 / 503

**Síntomas:** Banner "Servidor arrancando" persistente, errores 502/503 en consola del navegador.

**Diagnóstico (en orden):**

1. ¿Coolify cold start? (esperar 60s tras la 1ª request).
2. Comprobar contenedor:
   ```bash
   curl -s "http://187.77.166.84:8000/api/v1/applications/mu245rbjcqd6jxx2ouyev8no/status" \
     -H "Authorization: Bearer <COOLIFY_TOKEN>"
   ```
3. Si "stopped" → forzar deploy:
   ```bash
   curl -X POST "http://187.77.166.84:8000/api/v1/deploy?uuid=mu245rbjcqd6jxx2ouyev8no&force=true" \
     -H "Authorization: Bearer <COOLIFY_TOKEN>"
   ```
4. Logs en vivo: Coolify UI → app `RUBEN-COTON_EMAILING` → Logs → buscar `Startup error`, `EADDRINUSE`, `ENOTFOUND`.

---

## 2. Motor de envío congelado (no manda emails)

**Síntomas:** Cap NO sube, campañas sin pasar de "queued", logs sin `[mail] sent` en >5 min en horario.

**Auto-recovery esperado:**
- Watchdog interno cada 60s comprueba ticker. Si >5 min mudo en ventana abierta, reinicia tick.

**Recovery manual:**

1. SSH al VPS y mirar logs:
   ```bash
   docker logs <container-id> --tail 200 | grep -E "ticker|watchdog|hardCounter"
   ```
2. Si `__hardCounter` desincronizado → reinicio del contenedor:
   ```bash
   curl -X POST "http://187.77.166.84:8000/api/v1/applications/mu245rbjcqd6jxx2ouyev8no/restart" \
     -H "Authorization: Bearer <COOLIFY_TOKEN>"
   ```
3. Verificar ventana: `MAIL_SEND_WINDOW_START=8` y `END=20` en env Coolify.

---

## 3. OAuth Google rota

**Síntomas:** Logs con `invalid_grant`, `401`, "Google not ready". Reply tracker abortando.

**Recovery:**

1. Reintento auto: cada 5 min reintenta. Esperar 1-2 ciclos.
2. Si persiste, refresh token expirado → renovar en `RUBEN-COTON_API-GOOGLE`:
   - Visitar `/auth/google` desde un navegador autenticado en `manager@rubencoton.com`.
   - Aceptar consent.
   - Confirmar logs: `[drive] ecosistema Google listo`.
3. Reiniciar la app si el token cambió (Coolify → Restart).

---

## 4. store.json corrupto

**Síntomas:** Arranque con `[dataStore] store.json ilegible/corrupto`. App arranca con datos demo.

**Recovery:**

1. App preserva el corrupto en `data/store.json.corrupt-<ts>` automático.
2. Restaurar desde Drive:
   - El `driveArchive.restoreStoreFromDrive` corre automático en bootstrap si Google está listo.
   - Manual:
     ```bash
     # En Drive → manager@rubencoton.com → BACKUPS/store-YYYY-MM-DD-HH.json
     # Descargar y subir como data/store.json al volume Coolify
     ```
3. Reiniciar contenedor.

---

## 5. Disco lleno en VPS

**Síntomas:** `ENOSPC`, fallos al escribir store.json.

**Recovery:**

1. Limpiar Docker:
   ```bash
   docker system prune -af --volumes
   ```
2. Limpiar logs antiguos en `data/`:
   - `data/audit.log` (rotar si >100MB).
   - `data/store.json.corrupt-*` (archivar y borrar).

---

## 6. Cap diario alcanzado / rebotes Gmail

**Síntomas:** Logs con `daily cap reached`, o Gmail devuelve `4xx Mail sending limit exceeded`.

**Acción:**

1. **No subir el cap a la fuerza.** Gmail puede bloquear la cuenta 24-48h.
2. Si hay rebotes recientes, **bajar cap** progresivamente: 1650 → 1500 → 1200 (cambiar `MAIL_DAILY_CAP` en Coolify env).
3. Esperar 24-48h. Subir 100/día si no hay más rebotes.

---

## 7. Backup a Drive falla

**Síntomas:** Logs con `[backup] fallo backup store.json`.

**Diagnóstico:**

1. ¿Drive cuota llena? `manager@rubencoton.com` → drive.google.com → almacenamiento.
2. ¿Permiso de carpeta `BACKUPS` revocado? Recrear con permiso edición de la cuenta de servicio.
3. El último backup válido se ve en logs `[backup] store.json subido a Drive: store-YYYY-MM-DD-HH.json`.

---

## 8. Sheets sync no escribe

**Síntomas:** Pestaña CRM en Sheet sin actualizarse, columna "Merge status" sin colores.

**Diagnóstico:**

1. ¿Está dentro de horario L-V 8-20 Madrid? Si no, sync auto está pausado.
2. Forzar sync manual desde la app: pestaña CRMs → botón Sync.
3. Verificar `SHEETS_AUTOSYNC_ENABLED=true` en Coolify env.

---

## 9. Lista de comandos de emergencia

```bash
# Estado app
curl -s "http://187.77.166.84:8000/api/v1/applications/mu245rbjcqd6jxx2ouyev8no" \
  -H "Authorization: Bearer <COOLIFY_TOKEN>" | jq

# Restart
curl -X POST "http://187.77.166.84:8000/api/v1/applications/mu245rbjcqd6jxx2ouyev8no/restart" \
  -H "Authorization: Bearer <COOLIFY_TOKEN>"

# Force deploy último commit
curl -X POST "http://187.77.166.84:8000/api/v1/deploy?uuid=mu245rbjcqd6jxx2ouyev8no&force=true" \
  -H "Authorization: Bearer <COOLIFY_TOKEN>"

# Health endpoint app
curl -s https://emailing.rubencoton.com/health
```

---

## 10. Cuándo NO tocar nada

- **Cold start primer minuto.** Es normal. El cliente reintenta automático y el banner "Servidor arrancando" lo explica.
- **Cap rolling 24h.** No reiniciar para "resetear" el cap — es por diseño y se libera solo conforme expiran los timestamps.
- **Watchdog en marcha.** Si el log dice "watchdog: tick alive" cada 60s, el motor está sano.

---

## 11. Cómo subir un fix urgente

1. Branch `main` local.
2. `git add` solo los archivos del fix.
3. Commit con `fix(P0):` y descripción del bug + referencia a CHANGELOG.
4. `git push origin main` (autodeploy Coolify se dispara solo).
5. Verificar en logs que el deploy llegó a "running".
6. Probar el fix en producción inmediatamente.

Si autodeploy falla → forzar con curl (sección 9).

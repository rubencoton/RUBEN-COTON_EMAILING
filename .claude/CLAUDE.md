# CLAUDE.md - RUBEN-COTON_EMAILING

## Proyecto

Sistema de email marketing para RUBEN COTON.
Basado en el código de ARTES-BUHO_EMAILING, adaptado para la marca RUBEN COTON.

## Cuenta de envío

- **Email:** `manager@rubencoton.com`
- **Google APIs:** via `RUBEN-COTON_API-GOOGLE` (OAuth, Gmail, Drive, Sheets)
- **NO usar** booking@artesbuhomanagement.com (eso es ARTES BUHO)

## Infraestructura

- **VPS:** `187.77.166.84` (Hostinger)
- **Deploy:** Coolify
- **Dominio email:** `rubencoton.com`

## Reglas

1. Responder en español simple.
2. No romper flujos existentes.
3. HTML de emails: CSS inline para compatibilidad.
4. Imágenes: URLs absolutas, nunca rutas locales.
5. No inventar datos. Si falta acceso, indicarlo.
6. NO subir credenciales ni .env al repo.

## Ruta

`C:\Users\elrub\Desktop\CARPETA CODEX\01_PROYECTOS\RUBEN-COTON_EMAILING`

## Flujo Git

Si `git push` falla por política local:
```
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\elrub\Desktop\CARPETA CODEX\03_SCRIPTS_UTILIDAD\publicar_desde_local.ps1" -RepoPath "C:\Users\elrub\Desktop\CARPETA CODEX\01_PROYECTOS\RUBEN-COTON_EMAILING" -Remote origin -Branch main
```

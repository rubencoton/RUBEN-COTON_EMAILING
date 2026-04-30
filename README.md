# RUBEN-COTON_EMAILING

Sistema de email marketing para **RUBEN COTON**.

## Objetivo

Gestionar campañas de emailing masivo: plantillas HTML, listas CRM, envíos, tracking y reportes.

## Stack

- **Backend:** Node.js + Express
- **Frontend:** HTML/CSS/JS (panel de gestión)
- **Email:** Gmail API via `RUBEN-COTON_API-GOOGLE`
- **Deploy:** VPS Coolify (`187.77.166.84`)
- **Datos:** JSON local + backup a Drive

## Cuenta de envío

- **Email:** `manager@rubencoton.com`
- **Google APIs:** via proyecto `RUBEN-COTON_API-GOOGLE`

## Estructura

```
RUBEN-COTON_EMAILING/
├── src/                # Código backend (server, modules)
├── public/             # Frontend (panel web)
├── scripts/            # Utilidades, tests, deploy
├── docs/               # Documentación técnica
├── config/             # Configuración
├── data/               # Datos runtime (no versionado)
├── Dockerfile          # Container para Coolify
├── docker-compose.yml  # Orquestación local
└── .env.example        # Variables de entorno plantilla
```

## Setup local

```bash
cp .env.example .env
npm install
node src/server.js
```

## Deploy VPS

Desplegado en Coolify (VPS 187.77.166.84).
Ver `COOLIFY_SETUP.md` para configuración.

## Autor

RUBEN COTON

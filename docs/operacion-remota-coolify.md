# OPERACION REMOTA COOLIFY

## OBJETIVO

Automatizar desde script:
- estado de todas las apps,
- activacion de auto-deploy en bloque,
- redeploy en bloque opcional.

## QUE YA PUEDO HACER YO SIN QUE TOQUES NADA

- Preparar y mantener codigo.
- Hacer commits y push.
- Dejar scripts listos para operar Coolify por API.
- Ejecutar esos scripts en cuanto tengamos token temporal.

## UNICO DATO QUE FALTA PARA HACERLO 100% REMOTO

- `CoolifyBaseUrl` (ejemplo: `https://tu-coolify.com`)
- `CoolifyToken` (token temporal de API)

Sin token no hay permiso para cambiar configuracion de tus proyectos.

## SCRIPTS DISPONIBLES

Ruta:
- `scripts/coolify-bulk-status.ps1`
- `scripts/coolify-bulk-enable-autodeploy.ps1`
- `scripts/coolify-configure-emailing-channel.ps1`

## EJECUCION (MODO OCULTO)

### 1) Informe de estado de todas las apps APP_

```powershell
powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File .\scripts\coolify-bulk-status.ps1 `
  -CoolifyBaseUrl "https://TU-COOLIFY" `
  -CoolifyToken "TU_TOKEN_TEMPORAL" `
  -NamePrefix "APP_" `
  -OutFile ".\coolify-apps-status.json"
```

### 2) Activar auto-deploy en bloque

```powershell
powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File .\scripts\coolify-bulk-enable-autodeploy.ps1 `
  -CoolifyBaseUrl "https://TU-COOLIFY" `
  -CoolifyToken "TU_TOKEN_TEMPORAL" `
  -NamePrefix "APP_" `
  -EnableForceHttps `
  -RedeployAfterUpdate
```

## RESULTADO ESPERADO

- Todas las apps con nombre `APP_*` quedan con auto-deploy activo.
- Al hacer push a `main`, Coolify despliega sin tocar botones.
- Opcionalmente lanza redeploy inmediato en lote.

### 3) Configurar canal propio de APP_ARTES-BUHO_EMAILING

```powershell
powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File .\scripts\coolify-configure-emailing-channel.ps1 `
  -CoolifyBaseUrl "https://TU-COOLIFY" `
  -CoolifyToken "TU_TOKEN_TEMPORAL" `
  -AppName "APP_ARTES-BUHO_EMAILING" `
  -AccessPassword "+artesbuho26" `
  -FromEmail "manager@rubencoton.com" `
  -ReplyTo "manager@rubencoton.com" `
  -RatePerMinute 5 `
  -DirectHostname "mailer.rubencoton.com"
```

Resultado:
- App protegida con contrasena.
- Motor en modo `direct` (100% propio, sin Brevo).
- Reply-To configurado.
- Limite de envio en 5/min.
- DKIM listo en la variable `MAIL_DKIM_PRIVATE_KEY`.
- Registro publico DKIM guardado en `docs/dkim-mail-record.txt`.

### 4) Configurar modo Botavia API (opcional)

```powershell
powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File .\scripts\coolify-configure-emailing-channel.ps1 `
  -CoolifyBaseUrl "https://TU-COOLIFY" `
  -CoolifyToken "TU_TOKEN_TEMPORAL" `
  -AppName "APP_ARTES-BUHO_EMAILING" `
  -TransportMode "botavia" `
  -FromEmail "manager@rubencoton.com" `
  -ReplyTo "manager@rubencoton.com" `
  -RatePerMinute 5 `
  -BotaviaApiBaseUrl "https://api.tu-botavia.com" `
  -BotaviaApiKey "TU_API_KEY" `
  -BotaviaSendPath "/send" `
  -BotaviaHealthPath "/health"
```

Resultado:
- Motor en modo `botavia`.
- Envios por API HTTP.
- Si falla Botavia, la app lo muestra en estado y logs.

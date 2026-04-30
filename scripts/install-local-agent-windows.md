# Instalación Local Agent en Windows (RUBEN COTON)

Este agent se ejecuta en tu PC y se conecta al VPS para ejecutar tareas
pesadas de IA (Qwen 14B local) cuando tu PC esté encendido.

## Requisitos

- **Node.js 20+** instalado en el PC
- **Ollama** instalado y corriendo en el PC (`http://localhost:11434`)
- **Modelo Qwen 2.5 14B** descargado: `ollama pull qwen2.5:14b`
- **Token compartido** con el VPS (lo configuras en ambos)

## PASO 1 — Generar token compartido

En tu PC (PowerShell):

```powershell
$token = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$token | Set-Clipboard
Write-Host "Token generado y copiado al portapapeles: $token"
```

Guardalo, lo necesitas para 2 sitios:
- VPS Coolify env vars
- Archivo local `.env.local-agent`

## PASO 2 — Configurar VPS Coolify

Coolify → Application emailing → Environment Variables:

```
LOCAL_AGENT_TOKEN=<el token que generaste>
LOCAL_AGENT_ONLINE_TIMEOUT_MS=120000
```

Redeploy.

## PASO 3 — Configurar PC local

En la raíz del proyecto:
`C:\Users\elrub\Desktop\CARPETA CODEX\01_PROYECTOS\APP_ARTES-BUHO_EMAILING`

Crea archivo `.env.local-agent` (NO se commitea, está en .gitignore):

```
VPS_BASE_URL=https://emailing.rubencoton.com
LOCAL_AGENT_TOKEN=<el mismo token>
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b
POLL_INTERVAL_MS=30000
```

## PASO 4 — Test manual

```powershell
cd "C:\Users\elrub\Desktop\CARPETA CODEX\01_PROYECTOS\APP_ARTES-BUHO_EMAILING"
node scripts/local-agent.js
```

Debes ver:
```
[INFO] === LOCAL AGENT v1.0.0 arrancando ===
[INFO] VPS: https://emailing.rubencoton.com
[INFO] Ollama: http://localhost:11434 (modelo qwen2.5:14b)
[INFO] Poll cada 30000ms
```

Y en el VPS, abre `https://emailing.rubencoton.com/api/health/full`:
debe aparecer `localAgent.online: true`.

Ctrl+C para parar.

## PASO 5 — Arrancar al iniciar Windows (Tarea Programada)

Opción A — **Tarea Programada** (más simple, recomendado):

1. Abre **Programador de tareas** (Windows + R → `taskschd.msc`).
2. **Crear tarea básica** → nombre: `Emailing Local Agent`.
3. Desencadenador: **Al iniciar Windows** (con retraso 1 min).
4. Acción: **Iniciar un programa**.
5. Programa: `node`
6. Argumentos: `scripts/local-agent.js`
7. Iniciar en: `C:\Users\elrub\Desktop\CARPETA CODEX\01_PROYECTOS\APP_ARTES-BUHO_EMAILING`
8. **Marcar**: "Ejecutar tanto si el usuario inició sesión como si no" → introduce password.
9. **Marcar**: "Ejecutar con privilegios más altos".
10. Guardar.

Opción B — **NSSM** (servicio Windows real, más robusto):

```powershell
# Descargar nssm: https://nssm.cc/download
# Extraer y poner nssm.exe en C:\nssm\

C:\nssm\nssm.exe install EmailingLocalAgent
```

En la GUI de NSSM:
- **Path**: `C:\Program Files\nodejs\node.exe`
- **Startup directory**: `C:\Users\elrub\Desktop\CARPETA CODEX\01_PROYECTOS\APP_ARTES-BUHO_EMAILING`
- **Arguments**: `scripts/local-agent.js`
- **I/O tab**: redirigir stdout/stderr a logs:
  - `C:\Users\elrub\.local-agent.log`
- **Recovery tab**: restart on failure, after 5s.

Click **Install service**.

Para iniciar:
```powershell
net start EmailingLocalAgent
```

## PASO 6 — Verificar

Reinicia el PC. Tras 2 min, abre:
- `https://emailing.rubencoton.com/api/local-agent/status`

Debe responder:
```json
{
  "status": "ok",
  "enabled": true,
  "online": true,
  "secondsAgo": 23,
  "meta": {
    "hostname": "TU-PC",
    "ollamaModel": "qwen2.5:14b",
    "ollamaReady": true
  }
}
```

## Logs y diagnóstico

**Ver logs en vivo** (Tarea Programada no genera logs por defecto):

Si usaste NSSM: `C:\Users\elrub\.local-agent.log`

Si usaste Tarea Programada, modifica para que registre en archivo:
- Cambia "Argumentos" a:
  `scripts/local-agent.js > C:\Users\elrub\.local-agent.log 2>&1`
- Y "Programa" a `cmd.exe` con `/c node` antes.

## Detener

```powershell
# NSSM:
net stop EmailingLocalAgent

# Tarea Programada: 
# Programador de tareas → tu tarea → Detener
```

## Desinstalar

```powershell
# NSSM:
C:\nssm\nssm.exe remove EmailingLocalAgent confirm

# Tarea Programada: 
# Programador de tareas → tu tarea → Eliminar
```

## Troubleshooting

### `[ERROR] Heartbeat falla (status=0)`
- VPS apagado o sin internet en PC. Reintentará automáticamente.

### `[ERROR] Heartbeat falla (status=401)`
- Token mal escrito. Verifica `.env.local-agent` y env del VPS.

### `localAgent.online: false` aunque agent arrancado
- Espera 30-60s al primer poll.
- Verifica firewall: agent solo hace **outbound HTTPS**, no abre puertos.

### `ollamaReady: false`
- Ollama no arrancó: `ollama serve`
- Modelo no descargado: `ollama pull qwen2.5:14b`
- Cambia `OLLAMA_MODEL` si usas otro: ej `llama3.1:8b`

### El PC duerme y deja de responder
- Configuración de energía: NO suspender disco al estar enchufado.
- O usa NSSM con `WAKEFROMSLEEP=ON`.

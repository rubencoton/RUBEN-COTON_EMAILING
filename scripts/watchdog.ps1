# ============================================================
# watchdog.ps1 — Vigila app + tunnel cada 60 segundos
# Si algo cae, lo relanza automáticamente.
# ============================================================
$ErrorActionPreference = "Continue"
$projDir = "C:\Users\elrub\Desktop\CARPETA CODEX\01_PROYECTOS\ARTES-BUHO_EMAILING"
$logDir = Join-Path $projDir "logs"
$watchdogLog = Join-Path $logDir "watchdog.log"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Log {
  param($msg)
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
  Add-Content -Path $watchdogLog -Value $line
}

Log "Watchdog INICIADO"

while ($true) {
  try {
    # 1. ¿App emailing arriba en :3000?
    $app = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if (-not $app) {
      Log "[WARN] App caída. Relanzando..."
      & "$projDir\scripts\start-local-silent.ps1"
      Start-Sleep -Seconds 8
    }

    # 2. ¿Cloudflared corriendo?
    $cf = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
    if (-not $cf) {
      Log "[WARN] Tunnel caído. Relanzando..."
      & "$projDir\scripts\start-tunnel-permanent.ps1"
      Start-Sleep -Seconds 15
    } else {
      # 3. ¿Tunnel responde?
      $envContent = Get-Content "$projDir\.env" -Raw
      if ($envContent -match 'MAIL_TRACKING_BASE_URL=(https://[^\s]+)') {
        $url = $matches[1]
        try {
          $resp = Invoke-WebRequest -Uri "$url/login" -TimeoutSec 8 -UseBasicParsing -ErrorAction Stop
          if ($resp.StatusCode -ne 200) {
            Log "[WARN] Tunnel responde $($resp.StatusCode). Relanzando..."
            Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
            & "$projDir\scripts\start-tunnel-permanent.ps1"
          }
        } catch {
          Log "[WARN] Tunnel no responde: $($_.Exception.Message). Relanzando..."
          Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
          & "$projDir\scripts\start-tunnel-permanent.ps1"
        }
      }
    }
  } catch {
    Log "[ERR] Watchdog excepcion: $($_.Exception.Message)"
  }
  Start-Sleep -Seconds 60
}

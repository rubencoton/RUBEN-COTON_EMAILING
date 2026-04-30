# ============================================================
# start-tunnel-permanent.ps1
# Lanza Cloudflare Tunnel + actualiza .env automáticamente con
# la nueva URL pública. Si el PC reinicia, este script se ejecuta
# y la app se reconfigura sola.
# ============================================================
$ErrorActionPreference = "Stop"
$projDir = "C:\Users\elrub\Desktop\CARPETA CODEX\01_PROYECTOS\RUBEN-COTON_EMAILING"
$envFile = Join-Path $projDir ".env"
$logFile = Join-Path $projDir "logs\tunnel.log"

# Crear logs/
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null

# Matar tunnels previos
Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "[Tunnel] Lanzando cloudflared..." -ForegroundColor Cyan

# Lanzar tunnel en background
$proc = Start-Process -FilePath "cloudflared" `
  -ArgumentList "tunnel","--url","http://localhost:3000","--no-autoupdate" `
  -RedirectStandardOutput $logFile `
  -RedirectStandardError "$logFile.err" `
  -PassThru -WindowStyle Hidden

Write-Host "[Tunnel] PID:" $proc.Id

# Esperar URL pública (max 30s)
$tunnelUrl = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path "$logFile.err") {
    $content = Get-Content "$logFile.err" -Raw -ErrorAction SilentlyContinue
    if ($content -and ($content -match "(https://[a-z0-9-]+\.trycloudflare\.com)")) {
      $tunnelUrl = $matches[1]
      break
    }
  }
}

if (-not $tunnelUrl) {
  Write-Host "[Tunnel] ERROR: No se detectó URL en 30s" -ForegroundColor Red
  Get-Content "$logFile.err" | Select-Object -Last 10 | Write-Host
  exit 1
}

Write-Host "[Tunnel] URL pública:" $tunnelUrl -ForegroundColor Green

# Actualizar .env (linea MAIL_TRACKING_BASE_URL y MAIL_UNSUBSCRIBE_BASE_URL)
$envContent = Get-Content $envFile -Raw
$newContent = $envContent -replace 'MAIL_TRACKING_BASE_URL=.*', "MAIL_TRACKING_BASE_URL=$tunnelUrl"
$newContent = $newContent -replace 'MAIL_UNSUBSCRIBE_BASE_URL=.*', "MAIL_UNSUBSCRIBE_BASE_URL=$tunnelUrl/unsubscribe"
[System.IO.File]::WriteAllText($envFile, $newContent, [System.Text.UTF8Encoding]::new($false))

Write-Host "[Tunnel] .env actualizado" -ForegroundColor Green

# Reiniciar la app si está corriendo (para recoger nueva URL)
$app = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($app) {
  Stop-Process -Id $app[0].OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  & "$projDir\scripts\start-local-silent.ps1"
  Write-Host "[App] Reiniciada con nueva URL" -ForegroundColor Green
}

Write-Host ""
Write-Host "=========================================="
Write-Host "  TUNNEL ACTIVO"
Write-Host "  URL: $tunnelUrl"
Write-Host "  PID cloudflared: $($proc.Id)"
Write-Host "=========================================="

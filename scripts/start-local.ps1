# ============================================================
# start-local.ps1 — Arranque emailing local
# Uso: doble click desde el acceso directo del escritorio
# ============================================================

$ErrorActionPreference = "Continue"
$projDir = "C:\Users\elrub\Desktop\CARPETA CODEX\01_PROYECTOS\ARTES-BUHO_EMAILING"
Set-Location $projDir

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   📧 ARTES-BUHO EMAILING — Arranque local   ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# Matar instancia anterior en puerto 3000
$existing = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($existing) {
  $pid = $existing[0].OwningProcess
  Write-Host "  Cerrando instancia anterior (PID $pid)..." -ForegroundColor Yellow
  Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

# Arrancar
Write-Host "  Arrancando node src/server.js..." -ForegroundColor Cyan
$logPath = Join-Path $projDir "logs\local.log"
New-Item -ItemType Directory -Force -Path (Split-Path $logPath) | Out-Null

$node = Start-Process -FilePath "node" -ArgumentList "src/server.js" `
  -RedirectStandardOutput $logPath -RedirectStandardError "$logPath.err" `
  -PassThru -WindowStyle Hidden

Write-Host "  PID: $($node.Id)" -ForegroundColor Gray
Write-Host "  Esperando arranque..." -ForegroundColor Cyan

# Wait for /login responder
$ok = $false
for ($i = 1; $i -le 15; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/login" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
}

if ($ok) {
  Write-Host ""
  Write-Host "  ✅ Servidor arriba en http://localhost:3000/login" -ForegroundColor Green
  Write-Host "  🔐 Password: +artesbuho26" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  Abriendo navegador..." -ForegroundColor Cyan
  Start-Process "http://localhost:3000/login"
  Write-Host ""
  Write-Host "  Para parar: scripts\stop-local.ps1" -ForegroundColor Gray
  Write-Host "  Logs: Get-Content $logPath -Wait" -ForegroundColor Gray
} else {
  Write-Host ""
  Write-Host "  ❌ Servidor no arrancó. Mira: $logPath" -ForegroundColor Red
  Write-Host ""
  Get-Content $logPath -Tail 20 | Write-Host
}

Write-Host ""
Write-Host "  Pulsa Enter para cerrar esta ventana (servidor sigue corriendo)..." -ForegroundColor Gray
Read-Host

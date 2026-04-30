# ============================================================
# start-local-silent.ps1 — Arranque silencioso (auto-start)
# Sin ventana visible, ideal para tarea programada.
# ============================================================
$projDir = "C:\Users\elrub\Desktop\CARPETA CODEX\01_PROYECTOS\ARTES-BUHO_EMAILING"
Set-Location $projDir

# Si ya hay servidor en 3000, no arrancar otro
$existing = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($existing) {
  exit 0
}

# Crear logs/ si no existe
$logDir = Join-Path $projDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$logPath = Join-Path $logDir "autostart-$(Get-Date -Format 'yyyy-MM-dd').log"
$errPath = Join-Path $logDir "autostart-$(Get-Date -Format 'yyyy-MM-dd').err.log"

# Arrancar Node en background sin ventana
Start-Process -FilePath "node" `
  -ArgumentList "src/server.js" `
  -WindowStyle Hidden `
  -WorkingDirectory $projDir `
  -RedirectStandardOutput $logPath `
  -RedirectStandardError $errPath

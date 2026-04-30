# Para emailing local
$existing = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($existing) {
  $pid = $existing[0].OwningProcess
  Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  Write-Host "✅ Servidor parado (PID $pid)" -ForegroundColor Green
} else {
  Write-Host "ℹ️  No hay servidor en puerto 3000" -ForegroundColor Yellow
}
Start-Sleep -Seconds 1

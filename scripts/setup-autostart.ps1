# ============================================================
# setup-autostart.ps1 - Registra la app para arrancar con Windows
# ============================================================
$ErrorActionPreference = "Stop"
$taskName = "ArtesBuho_Emailing_Local"
$startScript = "C:\Users\elrub\Desktop\CARPETA CODEX\01_PROYECTOS\ARTES-BUHO_EMAILING\scripts\start-local-silent.ps1"

Write-Host ""
Write-Host "Registrando tarea programada: $taskName"
Write-Host "Trigger: AL INICIAR SESION del usuario"
Write-Host ""

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "  Borrando tarea anterior..." -ForegroundColor Yellow
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 0) -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "ARTES-BUHO Emailing local. Sync Sheets cada 2h. Disponible en http://localhost:3000"

Write-Host ""
Write-Host "[OK] Tarea creada. La app arrancara cada login del usuario." -ForegroundColor Green
Write-Host ""
Write-Host "Comandos utiles:"
Write-Host "  Iniciar ahora:  Start-ScheduledTask -TaskName $taskName"
Write-Host "  Ver estado:     Get-ScheduledTask -TaskName $taskName"
Write-Host "  Borrar tarea:   Unregister-ScheduledTask -TaskName $taskName"
Write-Host ""

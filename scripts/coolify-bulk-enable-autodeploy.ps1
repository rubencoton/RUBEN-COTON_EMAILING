param(
  [Parameter(Mandatory = $true)]
  [string]$CoolifyBaseUrl,
  [Parameter(Mandatory = $true)]
  [string]$CoolifyToken,
  [Parameter(Mandatory = $false)]
  [string]$NamePrefix = "APP_",
  [Parameter(Mandatory = $false)]
  [switch]$EnableForceHttps,
  [Parameter(Mandatory = $false)]
  [switch]$RedeployAfterUpdate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. "$PSScriptRoot\\coolify-common.ps1"

$apps = @(Get-CoolifyApplications -CoolifyBaseUrl $CoolifyBaseUrl -CoolifyToken $CoolifyToken)
$targets = @($apps | Where-Object {
    if ([string]::IsNullOrWhiteSpace($NamePrefix)) { return $true }
    return $_.name -like "$NamePrefix*"
  })

if ($targets.Count -eq 0) {
  Write-Host "No hay aplicaciones con prefijo $NamePrefix"
  exit 0
}

$updated = New-Object System.Collections.Generic.List[string]
$failed = New-Object System.Collections.Generic.List[string]
$skipped = New-Object System.Collections.Generic.List[string]

foreach ($app in $targets) {
  try {
    # In Coolify with Github App source, push-based deploy is managed by the Github App.
    # Some API versions do not expose is_auto_deploy_enabled in the application schema.
    $patchBody = @{}
    $sourceType = $app.source_type
    $isGithubApp = $sourceType -eq "App\Models\GithubApp"

    if ($EnableForceHttps.IsPresent) {
      # In this API version redirect=both keeps http+https entry with https redirection middleware.
      $patchBody["redirect"] = "both"
    }

    if ($patchBody.Count -gt 0) {
      Invoke-CoolifyPatch `
        -CoolifyBaseUrl $CoolifyBaseUrl `
        -CoolifyToken $CoolifyToken `
        -PathAndQuery "/applications/$($app.uuid)" `
        -Body $patchBody | Out-Null
      $updated.Add($app.name)
      Write-Host "OK actualizado: $($app.name)"
    }
    else {
      if ($isGithubApp) {
        $skipped.Add($app.name)
        Write-Host "OK auto deploy ya gestionado por Github App: $($app.name)"
      }
      else {
        $skipped.Add($app.name)
        Write-Host "WARN no se aplicaron cambios (API/version): $($app.name)"
      }
    }

    if ($RedeployAfterUpdate.IsPresent) {
      try {
        Invoke-CoolifyGet `
          -CoolifyBaseUrl $CoolifyBaseUrl `
          -CoolifyToken $CoolifyToken `
          -PathAndQuery "/deploy?uuid=$($app.uuid)&force=false" | Out-Null
        Write-Host "OK redeploy lanzado: $($app.name)"
      }
      catch {
        Write-Host "WARN no se pudo lanzar redeploy para $($app.name): $($_.Exception.Message)"
      }
    }
  }
  catch {
    $failed.Add($app.name)
    Write-Host "ERROR en $($app.name): $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "RESUMEN"
Write-Host "Actualizadas: $($updated.Count)"
Write-Host "Saltadas:    $($skipped.Count)"
Write-Host "Con error:   $($failed.Count)"
if ($skipped.Count -gt 0) {
  Write-Host "Apps saltadas: $($skipped -join ', ')"
}
if ($failed.Count -gt 0) {
  Write-Host "Apps con error: $($failed -join ', ')"
}

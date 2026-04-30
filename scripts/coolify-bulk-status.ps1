param(
  [Parameter(Mandatory = $true)]
  [string]$CoolifyBaseUrl,
  [Parameter(Mandatory = $true)]
  [string]$CoolifyToken,
  [Parameter(Mandatory = $false)]
  [string]$NamePrefix = "APP_",
  [Parameter(Mandatory = $false)]
  [string]$OutFile = ".\\coolify-apps-status.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. "$PSScriptRoot\\coolify-common.ps1"

$apps = @(Get-CoolifyApplications -CoolifyBaseUrl $CoolifyBaseUrl -CoolifyToken $CoolifyToken)

$getPropertyOrDefault = {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Object,
    [Parameter(Mandatory = $true)]
    [string]$PropertyName,
    [Parameter(Mandatory = $false)]
    [object]$DefaultValue = $null
  )

  if ($Object.PSObject.Properties.Match($PropertyName).Count -gt 0) {
    return $Object.$PropertyName
  }

  return $DefaultValue
}

$filtered = @($apps | Where-Object {
    if ([string]::IsNullOrWhiteSpace($NamePrefix)) { return $true }
    return $_.name -like "$NamePrefix*"
  })

$report = @(
  $filtered | ForEach-Object {
    $sourceType = & $getPropertyOrDefault -Object $_ -PropertyName "source_type" -DefaultValue ""
    $autoDeployFlag = & $getPropertyOrDefault -Object $_ -PropertyName "is_auto_deploy_enabled" -DefaultValue $null
    $autoDeployMode = if ($null -ne $autoDeployFlag) {
      if ($autoDeployFlag) { "enabled" } else { "disabled" }
    }
    elseif ($sourceType -eq "App\Models\GithubApp") {
      "github_app_auto"
    }
    else {
      "unknown"
    }

    [pscustomobject]@{
      name = $_.name
      uuid = $_.uuid
      fqdn = $_.fqdn
      git_repository = $_.git_repository
      git_branch = $_.git_branch
      source_type = $sourceType
      auto_deploy_mode = $autoDeployMode
      health_check_enabled = & $getPropertyOrDefault -Object $_ -PropertyName "health_check_enabled" -DefaultValue $false
      health_check_path = & $getPropertyOrDefault -Object $_ -PropertyName "health_check_path" -DefaultValue "/"
      redirect = & $getPropertyOrDefault -Object $_ -PropertyName "redirect" -DefaultValue "unknown"
      status = & $getPropertyOrDefault -Object $_ -PropertyName "status" -DefaultValue "unknown"
      updated_at = $_.updated_at
    }
  }
)

$report | ConvertTo-Json -Depth 5 | Set-Content -Path $OutFile -Encoding UTF8

Write-Host ""
Write-Host "OK: informe generado -> $OutFile"
Write-Host "Apps encontradas: $($report.Count)"
Write-Host ""
$report | Sort-Object name | Format-Table -AutoSize

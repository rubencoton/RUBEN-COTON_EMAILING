param(
  [Parameter(Mandatory = $true)]
  [string]$CoolifyBaseUrl,
  [Parameter(Mandatory = $true)]
  [string]$CoolifyToken,
  [Parameter(Mandatory = $false)]
  [string]$AppName = "ARTES-BUHO_EMAILING",
  [Parameter(Mandatory = $false)]
  [string]$AccessPassword = "+artesbuho26",
  [Parameter(Mandatory = $false)]
  [string]$AccessSecret = "",
  [Parameter(Mandatory = $false)]
  [ValidateSet("direct", "smtp", "botavia")]
  [string]$TransportMode = "direct",
  [Parameter(Mandatory = $false)]
  [string]$FromName = "Artes Buho Management",
  [Parameter(Mandatory = $false)]
  [string]$FromEmail = "booking@artesbuhomanagement.com",
  [Parameter(Mandatory = $false)]
  [string]$ReplyTo = "booking@artesbuhomanagement.com",
  [Parameter(Mandatory = $false)]
  [int]$RatePerMinute = 5,
  [Parameter(Mandatory = $false)]
  [ValidateSet("auto", "true", "false")]
  [string]$AuthCookieSecure = "auto",
  [Parameter(Mandatory = $false)]
  [string]$HealthCheckPath = "/health",
  [Parameter(Mandatory = $false)]
  [string]$DirectHostname = "mailer.artesbuhomanagement.com",
  [Parameter(Mandatory = $false)]
  [string]$BotaviaApiBaseUrl = "",
  [Parameter(Mandatory = $false)]
  [string]$BotaviaApiKey = "",
  [Parameter(Mandatory = $false)]
  [string]$BotaviaSendPath = "/send",
  [Parameter(Mandatory = $false)]
  [string]$BotaviaHealthPath = "/health"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. "$PSScriptRoot\\coolify-common.ps1"

function New-RandomSecret {
  param(
    [Parameter(Mandatory = $false)]
    [int]$Size = 48
  )

  $bytes = New-Object byte[] $Size
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes).TrimEnd("=")
}

function Get-EnvBody {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [Parameter(Mandatory = $true)]
    [string]$Value,
    [Parameter(Mandatory = $false)]
    [bool]$IsRuntime = $true,
    [Parameter(Mandatory = $false)]
    [bool]$IsBuildtime = $false,
    [Parameter(Mandatory = $false)]
    [bool]$IsLiteral = $false,
    [Parameter(Mandatory = $false)]
    [bool]$IsMultiline = $false,
    [Parameter(Mandatory = $false)]
    [bool]$IsPreview = $false
  )

  return @{
    key = $Key
    value = $Value
    is_runtime = $IsRuntime
    is_buildtime = $IsBuildtime
    is_literal = $IsLiteral
    is_multiline = $IsMultiline
    is_preview = $IsPreview
  }
}

function Upsert-AppEnv {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CoolifyBaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$CoolifyToken,
    [Parameter(Mandatory = $true)]
    [string]$AppUuid,
    [Parameter(Mandatory = $true)]
    [hashtable]$EnvBody
  )

  $existingList = @(Invoke-CoolifyGet `
      -CoolifyBaseUrl $CoolifyBaseUrl `
      -CoolifyToken $CoolifyToken `
      -PathAndQuery "/applications/$AppUuid/envs")

  $existing = $existingList | Where-Object {
    $_.key -eq $EnvBody.key -and $_.is_preview -eq $EnvBody.is_preview
  } | Select-Object -First 1

  if ($null -eq $existing) {
    Invoke-CoolifyPost `
      -CoolifyBaseUrl $CoolifyBaseUrl `
      -CoolifyToken $CoolifyToken `
      -PathAndQuery "/applications/$AppUuid/envs" `
      -Body $EnvBody | Out-Null
    Write-Host "OK creado: $($EnvBody.key)"
    return
  }

  $sameValue = "$($existing.real_value)" -eq "$($EnvBody.value)"
  $sameRuntime = [bool]$existing.is_runtime -eq [bool]$EnvBody.is_runtime
  $sameBuildtime = [bool]$existing.is_buildtime -eq [bool]$EnvBody.is_buildtime
  $sameLiteral = [bool]$existing.is_literal -eq [bool]$EnvBody.is_literal
  $sameMultiline = [bool]$existing.is_multiline -eq [bool]$EnvBody.is_multiline

  if ($sameValue -and $sameRuntime -and $sameBuildtime -and $sameLiteral -and $sameMultiline) {
    Write-Host "OK ya estaba: $($EnvBody.key)"
    return
  }

  Write-Host "WARN valor distinto detectado en: $($EnvBody.key)"
  Write-Host "WARN para cambiarlo por API en esta version, borralo en UI y vuelve a ejecutar el script."
}

$apps = @(Get-CoolifyApplications -CoolifyBaseUrl $CoolifyBaseUrl -CoolifyToken $CoolifyToken)
$target = $apps | Where-Object { $_.name -eq $AppName } | Select-Object -First 1

if ($null -eq $target) {
  throw "No encontre la app '$AppName' en Coolify."
}

$appSecret = if ([string]::IsNullOrWhiteSpace($AccessSecret)) {
  New-RandomSecret -Size 48
}
else {
  $AccessSecret
}

$appDomain = ""
if (-not [string]::IsNullOrWhiteSpace($target.fqdn)) {
  $appDomain = $target.fqdn.Trim().TrimEnd("/")
}

$unsubscribeUrl = if ([string]::IsNullOrWhiteSpace($appDomain)) {
  ""
}
else {
  "$appDomain/unsubscribe"
}

$variables = @(
  (Get-EnvBody -Key "APP_ACCESS_PASSWORD" -Value $AccessPassword),
  (Get-EnvBody -Key "APP_ACCESS_SECRET" -Value $appSecret),
  (Get-EnvBody -Key "APP_AUTH_COOKIE_SECURE" -Value $AuthCookieSecure),
  (Get-EnvBody -Key "MAIL_TRANSPORT_MODE" -Value $TransportMode),
  (Get-EnvBody -Key "SMTP_FROM_NAME" -Value $FromName),
  (Get-EnvBody -Key "SMTP_FROM_EMAIL" -Value $FromEmail),
  (Get-EnvBody -Key "SMTP_REPLY_TO" -Value $ReplyTo),
  (Get-EnvBody -Key "MAIL_RATE_LIMIT_PER_MIN" -Value "$RatePerMinute"),
  (Get-EnvBody -Key "MAIL_MAX_RETRIES" -Value "1"),
  (Get-EnvBody -Key "MAIL_HISTORY_LIMIT" -Value "200"),
  (Get-EnvBody -Key "MAIL_DIRECT_HOSTNAME" -Value $DirectHostname),
  (Get-EnvBody -Key "MAIL_UNSUBSCRIBE_BASE_URL" -Value $unsubscribeUrl)
)

if ($TransportMode -eq "botavia") {
  if ([string]::IsNullOrWhiteSpace($BotaviaApiBaseUrl) -or [string]::IsNullOrWhiteSpace($BotaviaApiKey)) {
    throw "Para modo botavia necesitas BotaviaApiBaseUrl y BotaviaApiKey."
  }

  $variables += @(
    (Get-EnvBody -Key "BOTAVIA_API_BASE_URL" -Value $BotaviaApiBaseUrl),
    (Get-EnvBody -Key "BOTAVIA_API_KEY" -Value $BotaviaApiKey),
    (Get-EnvBody -Key "BOTAVIA_SEND_PATH" -Value $BotaviaSendPath),
    (Get-EnvBody -Key "BOTAVIA_HEALTH_PATH" -Value $BotaviaHealthPath)
  )
}

Write-Host ""
Write-Host "Configurando app: $($target.name) [$($target.uuid)]"
Write-Host "Dominio detectado: $($target.fqdn)"
Write-Host ""

foreach ($item in $variables) {
  Upsert-AppEnv `
    -CoolifyBaseUrl $CoolifyBaseUrl `
    -CoolifyToken $CoolifyToken `
    -AppUuid $target.uuid `
    -EnvBody $item
}

try {
  $patchBody = @{
    health_check_enabled = $true
    health_check_path = $HealthCheckPath
    health_check_port = "3000"
    health_check_method = "GET"
    health_check_scheme = "http"
    health_check_host = "localhost"
    health_check_return_code = 200
    health_check_interval = 5
    health_check_timeout = 5
    health_check_retries = 10
    health_check_start_period = 5
    redirect = "both"
  }

  Invoke-CoolifyPatch `
    -CoolifyBaseUrl $CoolifyBaseUrl `
    -CoolifyToken $CoolifyToken `
    -PathAndQuery "/applications/$($target.uuid)" `
    -Body $patchBody | Out-Null

  Write-Host "OK healthcheck actualizado: $HealthCheckPath"
}
catch {
  Write-Host "WARN no se pudo ajustar healthcheck: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "LISTO: configuracion remota aplicada."
Write-Host "Siguiente accion: redeploy por push a main para aplicar variables nuevas."

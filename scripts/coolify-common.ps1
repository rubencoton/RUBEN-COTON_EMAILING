Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-CoolifyApiBase {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CoolifyBaseUrl
  )

  $trimmed = $CoolifyBaseUrl.TrimEnd("/")
  return "$trimmed/api/v1"
}

function Get-CoolifyHeaders {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CoolifyToken
  )

  return @{
    Authorization = "Bearer $CoolifyToken"
    "Content-Type" = "application/json"
    Accept = "application/json"
  }
}

function Invoke-CoolifyGet {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CoolifyBaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$CoolifyToken,
    [Parameter(Mandatory = $true)]
    [string]$PathAndQuery
  )

  $apiBase = Get-CoolifyApiBase -CoolifyBaseUrl $CoolifyBaseUrl
  $headers = Get-CoolifyHeaders -CoolifyToken $CoolifyToken
  $uri = "$apiBase$PathAndQuery"
  return Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 60
}

function Invoke-CoolifyPatch {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CoolifyBaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$CoolifyToken,
    [Parameter(Mandatory = $true)]
    [string]$PathAndQuery,
    [Parameter(Mandatory = $true)]
    [hashtable]$Body
  )

  $apiBase = Get-CoolifyApiBase -CoolifyBaseUrl $CoolifyBaseUrl
  $headers = Get-CoolifyHeaders -CoolifyToken $CoolifyToken
  $uri = "$apiBase$PathAndQuery"
  $json = $Body | ConvertTo-Json -Depth 10
  return Invoke-RestMethod -Method Patch -Uri $uri -Headers $headers -Body $json -TimeoutSec 60
}

function Invoke-CoolifyPost {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CoolifyBaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$CoolifyToken,
    [Parameter(Mandatory = $true)]
    [string]$PathAndQuery,
    [Parameter(Mandatory = $false)]
    [object]$Body = $null
  )

  $apiBase = Get-CoolifyApiBase -CoolifyBaseUrl $CoolifyBaseUrl
  $headers = Get-CoolifyHeaders -CoolifyToken $CoolifyToken
  $uri = "$apiBase$PathAndQuery"

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -TimeoutSec 60
  }

  $json = $Body | ConvertTo-Json -Depth 10
  return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $json -TimeoutSec 60
}

function Get-CoolifyApplications {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CoolifyBaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$CoolifyToken
  )

  $result = Invoke-CoolifyGet -CoolifyBaseUrl $CoolifyBaseUrl -CoolifyToken $CoolifyToken -PathAndQuery "/applications"

  if ($result -is [System.Array]) {
    return $result
  }

  if ($result.PSObject.Properties.Match("value").Count -gt 0 -and $result.value -is [System.Array]) {
    return $result.value
  }

  return @($result)
}

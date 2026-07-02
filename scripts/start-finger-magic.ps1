$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $PSScriptRoot
$port = 4173
$healthUrl = "http://127.0.0.1:$port/"

function Test-FingerMagicServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (Test-FingerMagicServer) {
  exit 0
}

$npx = Join-Path $env:ProgramFiles "nodejs\npx.cmd"
if (-not (Test-Path $npx)) {
  $npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
  if (-not $npxCommand) {
    throw "npx.cmd was not found. Install Node.js or add it to PATH."
  }
  $npx = $npxCommand.Source
}

$outLog = Join-Path $projectDir "server.out.log"
$errLog = Join-Path $projectDir "server.err.log"

Start-Process `
  -FilePath $npx `
  -ArgumentList @("http-server", ".", "-p", "$port", "-c-1", "--silent") `
  -WorkingDirectory $projectDir `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog

Start-Sleep -Seconds 3

if (-not (Test-FingerMagicServer)) {
  throw "Finger Magic server did not start on $healthUrl. Check server.err.log."
}

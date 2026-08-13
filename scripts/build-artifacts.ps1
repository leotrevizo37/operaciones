[CmdletBinding()]
param([switch]$Install)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$applications = @('app-shell', 'experiencia-digital', 'lecturas', 'dispositivos', 'smartaudits')
foreach ($application in $applications) {
    Push-Location (Join-Path $repositoryRoot "$application\frontend")
    try {
        if ($Install) {
            npm.cmd ci --ignore-scripts
            if ($LASTEXITCODE -ne 0) { throw "$application npm ci fallo." }
        }
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw "$application frontend build fallo." }
    } finally {
        Pop-Location
    }
}
$workspaceMount = "${repositoryRoot}:/workspace"
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal -v $workspaceMount -v duma-maven-cache:/root/.m2 -w /workspace maven:3.9.14-eclipse-temurin-17 mvn verify
if ($LASTEXITCODE -ne 0) { throw 'mvn verify fallo.' }
$artifactsRoot = Join-Path $repositoryRoot 'artifacts'
New-Item -ItemType Directory -Path $artifactsRoot -Force | Out-Null
$manifest = @()
foreach ($application in $applications) {
    $source = Get-ChildItem -LiteralPath (Join-Path $repositoryRoot "$application\backend\target") -Filter '*.jar' -File | Where-Object Name -NotLike '*.original' | Select-Object -First 1
    if (-not $source) { throw "No se genero JAR para $application." }
    $destinationDirectory = Join-Path $artifactsRoot $application
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    $destination = Join-Path $destinationDirectory "$application.jar"
    Copy-Item -LiteralPath $source.FullName -Destination $destination -Force
    $manifest += [ordered]@{ application = $application; file = "$application/$application.jar"; sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash; bytes = (Get-Item -LiteralPath $destination).Length }
}
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $artifactsRoot 'manifest.json') -Encoding utf8
Write-Output "Artifacts listos en $artifactsRoot"

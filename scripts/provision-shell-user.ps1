[CmdletBinding()]
param(
    [string]$Username,
    [string]$DisplayName,
    [string[]]$Roles = @('RESEARCHER'),
    [string[]]$Permissions = @(),
    [string[]]$TenantScope = @('carlsjr', 'emerson', 'valledelencino', 'mcdonalds', 'mcdonalds-cdp', 'smartfit', 'bafar-poc-gabinete'),
    [SecureString]$Password,
    [PSCredential]$SystemLogCredential,
    [string]$PortsFile = 'config\ports.local.ps1',
    [string]$RuntimeFile = 'config\runtime.local.ps1'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'runtime-common.ps1')
Import-DumaConfiguration -PortsFile $PortsFile -RuntimeFile $RuntimeFile
if ([string]::IsNullOrWhiteSpace($Username)) { $Username = Read-Host 'Usuario para iniciar sesion en el shell' }
if ([string]::IsNullOrWhiteSpace($DisplayName)) { $DisplayName = Read-Host 'Nombre visible' }
if (-not $Password) { $Password = Read-Host 'Password del usuario del shell' -AsSecureString }
if ($Username.Length -gt 255 -or $DisplayName.Length -gt 255) { throw 'Usuario y nombre visible admiten hasta 255 caracteres.' }
$credential = Get-DumaCredential -Credential $SystemLogCredential -Username $env:DUMA_SYSTEMLOG_MSSQL_USERNAME -Message 'Credencial SQL Server para crear el usuario del shell'
$jar = Get-ChildItem -LiteralPath (Join-Path $script:DumaRepositoryRoot 'app-shell\backend\target') -Filter '*.jar' -File | Where-Object Name -NotLike '*.original' | Select-Object -First 1
if (-not $jar) { throw 'Falta el JAR del shell. Ejecute scripts\build-artifacts.ps1.' }
$runtimeLogs = Join-Path $script:DumaRepositoryRoot '.runtime\logs'
New-Item -ItemType Directory -Path $runtimeLogs -Force | Out-Null
$hashError = Join-Path $runtimeLogs 'password-hash.stderr.log'
$plainPassword = ([PSCredential]::new('ignored', $Password)).GetNetworkCredential().Password
try {
    $dockerArguments = @('run', '--rm', '-i', '-v', "$($jar.FullName):/app/application.jar:ro", 'eclipse-temurin:17-jre', 'java', '-Dloader.main=com.duma.shell.security.PasswordHashCli', '-cp', '/app/application.jar', 'org.springframework.boot.loader.launch.PropertiesLauncher')
    $hash = $plainPassword | docker @dockerArguments 2> $hashError
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($hash) -or $hash -notmatch '^\$2') {
        throw "No fue posible generar el hash BCrypt. Revise $hashError."
    }
} finally {
    $plainPassword = $null
}

function Escape-SqlLiteral([string]$Value) {
    if ($null -eq $Value) { return '' }
    return $Value.Replace("'", "''")
}

$rolesCsv = $Roles -join ','
$permissionsCsv = $Permissions -join ','
$tenantScopeCsv = $TenantScope -join ','
$sql = @"
EXEC security.usp_UpsertAppUser
    @Username=N'$(Escape-SqlLiteral $Username)',
    @PasswordHash=N'$(Escape-SqlLiteral $hash.Trim())',
    @DisplayName=N'$(Escape-SqlLiteral $DisplayName)',
    @Enabled=1,
    @RolesCsv=N'$(Escape-SqlLiteral $rolesCsv)',
    @PermissionsCsv=N'$(Escape-SqlLiteral $permissionsCsv)',
    @TenantScopeCsv=N'$(Escape-SqlLiteral $tenantScopeCsv)';
"@
$previousPassword = $env:SQLCMDPASSWORD
$env:SQLCMDPASSWORD = $credential.GetNetworkCredential().Password
try {
    $sql | sqlcmd -S "$($env:DUMA_SYSTEMLOG_MSSQL_HOST),$($env:DUMA_SYSTEMLOG_MSSQL_PORT)" -U $credential.UserName -d $env:DUMA_SYSTEMLOG_MSSQL_DATABASE -b -C
    if ($LASTEXITCODE -ne 0) { throw "sqlcmd termino con codigo $LASTEXITCODE." }
} finally {
    if ($null -eq $previousPassword) { Remove-Item Env:SQLCMDPASSWORD -ErrorAction SilentlyContinue } else { $env:SQLCMDPASSWORD = $previousPassword }
    $hash = $null
    $sql = $null
}
Write-Output "Usuario '$Username' creado o actualizado. El password y su hash no se guardaron."

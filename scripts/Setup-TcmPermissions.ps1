# Setup-TcmPermissions.ps1
# Provisions the TCM service principal and grants it permissions for all workloads.
# Run once per tenant. Requires Application Administrator (or Global Admin).

param(
    [switch]$SkipConnect
)

$ErrorActionPreference = 'Stop'

# ── Ensure Microsoft Graph modules are ready ──
$requiredModules = @('Microsoft.Graph.Authentication', 'Microsoft.Graph.Applications')
$needsInstall = @()
$versions = @{}
foreach ($mod in $requiredModules) {
    $installed = Get-Module -ListAvailable -Name $mod | Sort-Object Version -Descending | Select-Object -First 1
    if (-not $installed) {
        $needsInstall += $mod
    } else {
        $versions[$mod] = $installed.Version
    }
}

if ($needsInstall.Count -gt 0) {
    Write-Host "`n📦 Installing missing Microsoft Graph modules..." -ForegroundColor Cyan
    foreach ($mod in $needsInstall) {
        Write-Host "   Installing $mod..." -ForegroundColor Yellow
        Install-Module $mod -Scope CurrentUser -Force -AllowClobber -Repository PSGallery
        $installed = Get-Module -ListAvailable -Name $mod | Sort-Object Version -Descending | Select-Object -First 1
        $versions[$mod] = $installed.Version
    }
    Write-Host "   ✅ Installed." -ForegroundColor Green
}

# Check for version mismatch between Authentication and Applications
$uniqueVersions = $versions.Values | Sort-Object -Unique
if ($uniqueVersions.Count -gt 1) {
    Write-Host "`n🔄 Microsoft Graph module version mismatch detected. Updating..." -ForegroundColor Yellow
    foreach ($mod in $requiredModules) {
        Update-Module $mod -Force -ErrorAction SilentlyContinue
        Install-Module $mod -Scope CurrentUser -Force -AllowClobber -Repository PSGallery -ErrorAction SilentlyContinue
    }
    Write-Host "   ✅ Updated. If you still get errors, close ALL PowerShell windows and re-run." -ForegroundColor Green
}

try {
    Import-Module Microsoft.Graph.Applications -Force -ErrorAction Stop
} catch {
    if ($_.Exception.Message -match 'Assembly with same name is already loaded') {
        Write-Host "`n❌ A different version of Microsoft.Graph is already loaded in this PowerShell session." -ForegroundColor Red
        Write-Host "Close ALL PowerShell windows, open a fresh one, and re-run this script." -ForegroundColor Yellow
        return
    }
    throw
}

$tcmAppId = '03b07b79-c5bc-4b5e-9bfa-13acf4a99998'
$adminServicesAppId = '6b91db1b-f05b-405a-a0b2-e3f60b28d645'
$graphAppId = '00000003-0000-0000-c000-000000000000'

# Permissions the TCM SP needs on Microsoft Graph to read all workloads
$graphPermissions = @(
    # Entra ID / Directory
    'Directory.Read.All',
    'Policy.Read.All',
    'RoleManagement.Read.Directory',
    'EntitlementManagement.Read.All',
    'IdentityProvider.Read.All',
    'User.Read.All',
    'Group.Read.All',
    'Application.Read.All',
    # Intune / Device Management
    'DeviceManagementConfiguration.Read.All',
    'DeviceManagementApps.Read.All',
    'DeviceManagementManagedDevices.Read.All',
    'DeviceManagementRBAC.Read.All',
    'DeviceManagementServiceConfig.Read.All',
    # Teams
    'TeamSettings.Read.All',
    'TeamsAppInstallation.ReadForUser.All',
    'Channel.ReadBasic.All',
    'Team.ReadBasic.All',
    # Security & Compliance
    'SecurityEvents.Read.All',
    'InformationProtectionPolicy.Read.All'
)

# ── Connect ──
if (-not $SkipConnect) {
    # Disconnect any existing session so the interactive prompt always appears
    Disconnect-MgGraph -ErrorAction SilentlyContinue | Out-Null
    Write-Host "`n🔑 Connecting to Microsoft Graph (interactive login)..." -ForegroundColor Cyan
    Write-Host "   Sign in with an admin account for the tenant you want to configure." -ForegroundColor Yellow
    Connect-MgGraph -Scopes @(
        'Application.ReadWrite.All',
        'AppRoleAssignment.ReadWrite.All'
    ) -UseDeviceCode:$false
}

$context = Get-MgContext
Write-Host "✅ Connected as $($context.Account) to tenant $($context.TenantId)" -ForegroundColor Green

# ── Provision TCM service principal ──
Write-Host "`n📦 Checking TCM service principal..." -ForegroundColor Cyan
$tcmSp = Get-MgServicePrincipal -Filter "AppId eq '$tcmAppId'" -ErrorAction SilentlyContinue
if (-not $tcmSp) {
    Write-Host "   Creating TCM service principal..." -ForegroundColor Yellow
    $tcmSp = New-MgServicePrincipal -AppId $tcmAppId
    Write-Host "   ✅ Created: $($tcmSp.DisplayName) ($($tcmSp.Id))" -ForegroundColor Green
} else {
    Write-Host "   ✅ Already exists: $($tcmSp.DisplayName) ($($tcmSp.Id))" -ForegroundColor Green
}

# ── Provision M365 Admin Services SP ──
Write-Host "`n📦 Checking M365 Admin Services service principal..." -ForegroundColor Cyan
$adminSp = Get-MgServicePrincipal -Filter "AppId eq '$adminServicesAppId'" -ErrorAction SilentlyContinue
if (-not $adminSp) {
    Write-Host "   Creating M365 Admin Services service principal..." -ForegroundColor Yellow
    $adminSp = New-MgServicePrincipal -AppId $adminServicesAppId
    Write-Host "   ✅ Created: $($adminSp.DisplayName) ($($adminSp.Id))" -ForegroundColor Green
} else {
    Write-Host "   ✅ Already exists: $($adminSp.DisplayName) ($($adminSp.Id))" -ForegroundColor Green
}

# ── Grant Graph permissions to TCM SP ──
Write-Host "`n🔐 Granting Microsoft Graph permissions to TCM SP..." -ForegroundColor Cyan
$graphSp = Get-MgServicePrincipal -Filter "AppId eq '$graphAppId'"

# Get existing assignments to avoid duplicates
$existingAssignments = Get-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $tcmSp.Id -All
$existingRoleIds = $existingAssignments | Where-Object { $_.ResourceId -eq $graphSp.Id } | Select-Object -ExpandProperty AppRoleId

$granted = 0
$skipped = 0
$failed = 0

foreach ($permName in $graphPermissions) {
    $appRole = $graphSp.AppRoles | Where-Object { $_.Value -eq $permName }
    if (-not $appRole) {
        Write-Host "   ⚠️  Role not found: $permName" -ForegroundColor Yellow
        $failed++
        continue
    }

    if ($appRole.Id -in $existingRoleIds) {
        Write-Host "   ⏭️  Already granted: $permName" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    try {
        $body = @{
            AppRoleId   = $appRole.Id
            ResourceId  = $graphSp.Id
            PrincipalId = $tcmSp.Id
        }
        New-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $tcmSp.Id -BodyParameter $body | Out-Null
        Write-Host "   ✅ Granted: $permName" -ForegroundColor Green
        $granted++
    } catch {
        Write-Host "   ❌ Failed: $permName — $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`n📊 Summary: $granted granted, $skipped already existed, $failed failed" -ForegroundColor Cyan
Write-Host "`n✅ TCM setup complete for tenant $($context.TenantId)" -ForegroundColor Green
Write-Host "   You can now create snapshots for Entra, Intune, Teams, and Security resources." -ForegroundColor Green
Write-Host "   For Exchange Online, see: https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac" -ForegroundColor Yellow

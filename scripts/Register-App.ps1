#Requires -Modules Microsoft.Graph.Applications

<#
.SYNOPSIS
    Creates the multi-tenant Entra ID app registration for Tenant Config Compare.

.DESCRIPTION
    Registers a multi-tenant SPA app with the following:
    - SignInAudience: AzureADMultipleOrgs (any Entra ID tenant)
    - Platform: SPA with redirect URIs for local dev + GitHub Pages
    - API permissions: User.Read + ConfigurationMonitoring.ReadWrite.All (delegated)
    No client secret is created — the SPA uses PKCE (public client).

    After creation, paste the Application (client) ID into app/config.js.

.NOTES
    Run once. Requires Microsoft.Graph.Applications module.
    Install with: Install-Module Microsoft.Graph.Applications -Scope CurrentUser
#>

param(
    [string]$AppName = "Tenant Config Compare",
    [string]$GitHubPagesUrl = ""  # e.g. "https://yourusername.github.io/tenant-config-mgmt/"
)

# --- Connect ---
Write-Host "Connecting to Microsoft Graph..." -ForegroundColor Cyan
Connect-MgGraph -Scopes "Application.ReadWrite.All" -NoWelcome

# --- Build redirect URIs ---
$redirectUris = @(
    "http://localhost:5500",
    "http://localhost:5500/app/",
    "http://localhost:5500/app/index.html",
    "http://localhost:8080/",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:5500/app/",
    "http://127.0.0.1:5500/app/index.html",
    "http://127.0.0.1:8080/",
    "https://t3blake.github.io/tenant-config-mgmt/"
)
if ($GitHubPagesUrl -and $GitHubPagesUrl -notin $redirectUris) {
    $redirectUris += $GitHubPagesUrl
    Write-Host "Including custom GitHub Pages redirect: $GitHubPagesUrl" -ForegroundColor Green
}

# --- Well-known Graph API permission IDs ---
# Microsoft Graph AppId: 00000003-0000-0000-c000-000000000000
$graphResourceId = "00000003-0000-0000-c000-000000000000"

# User.Read (delegated): e1fe6dd8-ba31-4d61-89e7-88639da4683d
# ConfigurationMonitoring.ReadWrite.All (delegated): 54505ce9-04db-4a9b-b8b1-1d26b0b1e14f
$permissions = @(
    @{
        ResourceAppId = $graphResourceId
        ResourceAccess = @(
            @{ Id = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"; Type = "Scope" },  # User.Read
            @{ Id = "54505ce9-04db-4a9b-b8b1-1d26b0b1e14f"; Type = "Scope" }   # ConfigurationMonitoring.ReadWrite.All
        )
    }
)

# --- Create app registration ---
Write-Host "Creating app registration: $AppName" -ForegroundColor Cyan

$app = New-MgApplication -DisplayName $AppName `
    -SignInAudience "AzureADMultipleOrgs" `
    -Spa @{ RedirectUris = $redirectUris } `
    -RequiredResourceAccess $permissions `
    -IsFallbackPublicClient

# --- Output ---
Write-Host ""
Write-Host "=======================================" -ForegroundColor Green
Write-Host " App Registration Created Successfully" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Display Name  : $($app.DisplayName)"
Write-Host "  Application ID: $($app.AppId)" -ForegroundColor Yellow
Write-Host "  Object ID     : $($app.Id)"
Write-Host "  Sign-in scope : AzureADMultipleOrgs (multi-tenant)"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Paste the Application ID into app/config.js:" -ForegroundColor White
Write-Host "     clientId: '$($app.AppId)'" -ForegroundColor Yellow
Write-Host "  2. Admin consent for ConfigurationMonitoring.ReadWrite.All" -ForegroundColor White
Write-Host "     is required per-tenant when users first sign in."
Write-Host ""

# Return the app object for pipeline use
$app

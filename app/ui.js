// ui.js — DOM rendering for auth state, tenant panels, and future diff view

function renderSetupGuide() {
    const guide = document.getElementById("setup-guide");
    if (!guide) return;

    const hasCustom = isUsingCustomClientId();
    const bothSignedIn = !!(sourceAccount && destAccount);

    // Hide guide once a custom client ID is set AND both tenants are signed in,
    // or if user dismissed it this session
    if ((hasCustom && bothSignedIn) || sessionStorage.getItem("tcm_guide_dismissed")) {
        guide.classList.add("d-none");
        guide.innerHTML = "";
        return;
    }

    guide.classList.remove("d-none");

    const currentOrigin = window.location.origin + window.location.pathname;

    guide.innerHTML = `
        <div class="card border-info-subtle mb-4">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h5 class="card-title mb-1">Getting Started</h5>
                        <p class="text-body-secondary small mb-0">
                            This tool compares Microsoft 365 tenant configurations via the
                            <a href="https://learn.microsoft.com/en-us/graph/api/resources/unified-tenant-configuration-monitoring?view=graph-rest-1.0" target="_blank" rel="noopener">TCM Graph APIs</a>.
                            Complete these steps before signing in.
                        </p>
                    </div>
                    ${hasCustom ? `<button class="btn btn-sm btn-outline-secondary ms-3 flex-shrink-0" id="dismiss-setup-guide" title="Dismiss">✕</button>` : ""}
                </div>

                <div class="row mt-3 g-3">
                    <!-- Step 1 -->
                    <div class="col-md-4">
                        <div class="d-flex align-items-start">
                            <span class="setup-step-num ${hasCustom ? "step-done" : "step-active"}">1</span>
                            <div>
                                <strong class="small">Register an Entra ID app</strong>
                                <ul class="small mb-1 ps-3 mt-1 text-body-secondary">
                                    <li>Entra admin center → App registrations → New</li>
                                    <li>Account type: <em>Accounts in any org directory</em></li>
                                    <li>Platform: <strong>SPA</strong>, redirect URI:<br>
                                        <code class="user-select-all">${escapeHtml(currentOrigin)}</code></li>
                                    <li>API permission: <code>ConfigurationMonitoring.ReadWrite.All</code> (Delegated)</li>
                                    <li>No client secret needed (PKCE)</li>
                                </ul>
                                <a class="small" href="https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app" target="_blank" rel="noopener">
                                    App registration guide →
                                </a>
                            </div>
                        </div>
                    </div>

                    <!-- Step 2 -->
                    <div class="col-md-4">
                        <div class="d-flex align-items-start">
                            <span class="setup-step-num ${hasCustom ? "step-done" : "step-active"}">2</span>
                            <div class="w-100">
                                <strong class="small">Enter your Client ID</strong>
                                <p class="small text-body-secondary mt-1 mb-2">Paste the <em>Application (client) ID</em> from your app registration.</p>
                                ${hasCustom ? `
                                    <div class="d-flex align-items-center gap-2">
                                        <code class="small">${escapeHtml(getActiveClientId())}</code>
                                        <span class="badge bg-success-subtle text-success-emphasis">Saved</span>
                                    </div>
                                ` : `
                                    <div class="input-group input-group-sm">
                                        <input type="text" class="form-control font-monospace" id="setup-client-id-input"
                                               placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                               pattern="^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$">
                                        <button class="btn btn-primary" id="setup-save-client-id">Save</button>
                                    </div>
                                    <div class="invalid-feedback">Enter a valid GUID.</div>
                                `}
                            </div>
                        </div>
                    </div>

                    <!-- Step 3 -->
                    <div class="col-md-4">
                        <div class="d-flex align-items-start">
                            <span class="setup-step-num ${hasCustom ? "step-active" : "step-pending"}">3</span>
                            <div>
                                <strong class="small">Provision TCM in each tenant</strong>
                                <p class="small text-body-secondary mt-1 mb-2">
                                    An admin (<em>Application Administrator</em> or higher) must run this script in each tenant to enable the TCM service principal and grant permissions.
                                </p>
                                <button class="btn btn-sm btn-outline-primary" id="setup-download-script">
                                    📥 Download Setup Script
                                </button>
                                <div class="mt-1">
                                    <a class="small" href="https://learn.microsoft.com/en-us/graph/utcm-authentication-setup" target="_blank" rel="noopener">
                                        TCM setup docs →
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                ${!hasCustom ? `
                    <div class="mt-3 pt-2 border-top">
                        <button class="btn btn-sm btn-link text-body-secondary p-0" id="dismiss-setup-guide">
                            Skip — I'm using the default shared app registration
                        </button>
                    </div>
                ` : ""}
            </div>
        </div>
    `;

    // Wire up events
    const saveBtn = guide.querySelector("#setup-save-client-id");
    if (saveBtn) {
        const input = guide.querySelector("#setup-client-id-input");
        const doSave = () => {
            const raw = input.value.trim();
            if (!raw || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(raw)) {
                input.classList.add("is-invalid");
                return;
            }
            input.classList.remove("is-invalid");
            const previous = getActiveClientId();
            setCustomClientId(raw);
            if (previous !== getActiveClientId()) {
                reinitMsal().then(() => {
                    renderSetupGuide();
                });
            } else {
                renderSetupGuide();
            }
        };
        saveBtn.addEventListener("click", doSave);
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSave(); });
    }

    const dlBtn = guide.querySelector("#setup-download-script");
    if (dlBtn) {
        dlBtn.addEventListener("click", () => downloadSetupScript());
    }

    const dismissBtn = guide.querySelector("#dismiss-setup-guide");
    if (dismissBtn) {
        dismissBtn.addEventListener("click", () => {
            sessionStorage.setItem("tcm_guide_dismissed", "1");
            guide.classList.add("d-none");
            guide.innerHTML = "";
        });
    }
}

function renderAuthState() {
    renderSetupGuide();
    renderTenantPanel("source", sourceAccount);
    renderTenantPanel("dest", destAccount);
    updateCompareButton();
}

function renderTenantPanel(side, account) {
    const card = document.getElementById(`${side}-card`);
    const authSection = document.getElementById(`${side}-auth`);
    const contentSection = document.getElementById(`${side}-content`);
    const errorSection = document.getElementById(`${side}-error`);

    // Clear any previous error
    errorSection.classList.add("d-none");
    errorSection.textContent = "";

    if (account) {
        const tenantId = account.tenantId;
        const username = account.username;

        authSection.innerHTML = `
            <div class="d-flex align-items-center justify-content-between">
                <div>
                    <span class="badge bg-success me-2">Connected</span>
                    <strong>${escapeHtml(username)}</strong>
                    <br>
                    <small class="text-body-secondary">Tenant: ${escapeHtml(tenantId)}</small>
                </div>
                <button class="btn btn-outline-secondary btn-sm" id="${side}-signout-btn">
                    Sign out
                </button>
            </div>
        `;
        document.getElementById(`${side}-signout-btn`).addEventListener("click", side === "source" ? signOutSource : signOutDest);
        contentSection.classList.remove("d-none");
        contentSection.innerHTML = `
            <div class="mt-3" id="${side}-snapshot-area">
                <div class="text-center text-body-secondary py-3">
                    <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                    Loading snapshots…
                </div>
            </div>
        `;
        card.classList.remove("border-secondary");
        card.classList.add(side === "source" ? "border-primary" : "border-warning");

        // Load existing snapshots for this tenant
        loadSnapshotJobs(side).catch(err => {
            console.error(`Failed to load ${side} snapshots:`, err);
            showError(side, "Failed to load snapshots: " + (err.message || String(err)));
        });
    } else {
        const label = side === "source" ? "Source" : "Destination";
        authSection.innerHTML = `
            <button class="btn btn-${side === "source" ? "primary" : "warning"} w-100" id="${side}-signin-btn">
                Sign in to ${label} Tenant
            </button>
        `;
        document.getElementById(`${side}-signin-btn`).addEventListener("click", side === "source" ? signInSource : signInDest);
        contentSection.classList.add("d-none");
        contentSection.innerHTML = "";
        card.classList.remove("border-primary", "border-warning");
        card.classList.add("border-secondary");
    }
}

function updateCompareButton() {
    const btn = document.getElementById("compare-btn");
    const sourceReady = snapshotState.source.snapshotData !== null;
    const destReady = snapshotState.dest.snapshotData !== null;
    if (sourceReady && destReady) {
        btn.disabled = false;
        btn.title = "";
    } else {
        btn.disabled = true;
        if (!sourceAccount || !destAccount) {
            btn.title = "Sign in to both tenants first";
        } else {
            btn.title = "Select a snapshot from each tenant first";
        }
    }


}

function isMirrorEnabled(side) {
    const toggle = document.querySelector(`.${side}-mirror-toggle`);
    return toggle ? toggle.checked : false;
}

function showError(side, message) {
    const errorSection = document.getElementById(`${side}-error`);
    // Convert newlines to <br> and bullet points to list items for readable formatting
    const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const formatted = escaped.replace(/\n/g, "<br>").replace(/• /g, "&bull; ");
    errorSection.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div>${formatted}</div>
            <button class="btn btn-sm btn-outline-secondary ms-2 flex-shrink-0 error-dismiss-btn" title="Dismiss" aria-label="Dismiss">✕</button>
        </div>
    `;
    errorSection.classList.remove("d-none");
    errorSection.querySelector(".error-dismiss-btn").addEventListener("click", () => errorSection.classList.add("d-none"));
}

function showSnapshotErrors(side, jobName, errorDetails) {
    const errorSection = document.getElementById(`${side}-error`);
    const errors = Array.isArray(errorDetails) ? errorDetails : [String(errorDetails)];
    errorSection.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <strong>⚠️ Snapshot errors: ${escapeHtml(jobName)}</strong>
            <button class="btn btn-sm btn-outline-secondary ms-2 flex-shrink-0 snapshot-errors-close" title="Dismiss" aria-label="Dismiss">✕</button>
        </div>
        <p class="mb-1 mt-2 small text-body-secondary">Some resource types failed to export. This is usually caused by missing licenses or permissions for specific workloads.</p>
        <div style="max-height:200px; overflow-y:auto">
            <ul class="small mb-0">
                ${errors.map(e => `<li>${escapeHtml(String(e).replace(/;$/, ""))}</li>`).join("")}
            </ul>
        </div>
        <button class="btn btn-outline-primary btn-sm mt-2 snapshot-errors-download">📥 Download Setup Script</button>
    `;
    errorSection.classList.remove("d-none");
    const closeBtn = errorSection.querySelector(".snapshot-errors-close");
    if (closeBtn) {
        closeBtn.addEventListener("click", () => errorSection.classList.add("d-none"));
    }
    const dlBtn = errorSection.querySelector(".snapshot-errors-download");
    if (dlBtn) {
        dlBtn.addEventListener("click", () => downloadSetupScript());
    }
}

function showSetupGuidance(side, errorCode) {
    const errorSection = document.getElementById(`${side}-error`);
    errorSection.classList.remove("d-none");

    const downloadBtn = `<button class="btn btn-outline-primary btn-sm mt-2 setup-script-download" data-side="${side}">📥 Download Setup Script</button>`;

    const dismissBtn = `<button class="btn btn-sm btn-outline-secondary ms-2 flex-shrink-0 error-dismiss-btn" title="Dismiss" aria-label="Dismiss">✕</button>`;

    if (errorCode === "TCM_SP_MISSING") {
        errorSection.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <strong>⚠️ TCM is not enabled in this tenant.</strong>
                ${dismissBtn}
            </div>
            <p class="mb-1 small">An admin needs to provision the TCM service principal and grant it permissions to read workload configurations.</p>
            <p class="mb-1 small">Download the setup script and run it in PowerShell as an admin for this tenant:</p>
            ${downloadBtn}
            <hr class="my-2">
            <p class="mb-0 small text-body-secondary">
                <a href="https://learn.microsoft.com/en-us/graph/utcm-authentication-setup" target="_blank" rel="noopener">TCM Authentication Setup docs →</a>
            </p>
        `;
    } else if (errorCode === "CONSENT_REQUIRED") {
        errorSection.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <strong>⚠️ Admin consent required.</strong>
                ${dismissBtn}
            </div>
            <p class="mb-1 small">A tenant admin needs to grant this app the <code>ConfigurationMonitoring.ReadWrite.All</code> permission, and ensure the TCM service principal has the right workload permissions.</p>
            ${downloadBtn}
            <hr class="my-2">
            <p class="mb-0 small text-body-secondary">
                <a href="https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent" target="_blank" rel="noopener">How to grant admin consent →</a>
            </p>
        `;
    } else {
        errorSection.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <strong>Error:</strong> ${escapeHtml(String(errorCode))}
                ${dismissBtn}
            </div>
            <p class="mb-1 mt-1 small">This may be a permissions issue. Download the setup script to configure TCM for this tenant:</p>
            ${downloadBtn}
            <hr class="my-2">
            <p class="mb-0 small text-body-secondary">
                <a href="https://learn.microsoft.com/en-us/graph/utcm-authentication-setup" target="_blank" rel="noopener">TCM setup guide →</a>
            </p>
        `;
    }

    // Wire up dismiss button
    const dismissBtnEl = errorSection.querySelector(".error-dismiss-btn");
    if (dismissBtnEl) {
        dismissBtnEl.addEventListener("click", () => errorSection.classList.add("d-none"));
    }

    // Wire up download button
    const btn = errorSection.querySelector(".setup-script-download");
    if (btn) {
        btn.addEventListener("click", () => downloadSetupScript());
    }
}

function downloadSetupScript() {
    const script = `# Setup-TcmPermissions.ps1
# Provisions the TCM service principal and grants it permissions for all workloads.
# Run once per tenant. Requires Application Administrator (or Global Admin).
#
# Usage:
#   .\\Setup-TcmPermissions.ps1
#
# Generated by Tenant Config Compare

$ErrorActionPreference = 'Stop'

# Ensure Microsoft Graph modules are ready
$requiredModules = @('Microsoft.Graph.Authentication', 'Microsoft.Graph.Applications')
$needsInstall = @()
foreach ($mod in $requiredModules) {
    $installed = Get-Module -ListAvailable -Name $mod | Sort-Object Version -Descending | Select-Object -First 1
    if (-not $installed) { $needsInstall += $mod }
}
if ($needsInstall.Count -gt 0) {
    Write-Host "\nInstalling missing Microsoft Graph modules..." -ForegroundColor Cyan
    foreach ($mod in $needsInstall) {
        Write-Host "  Installing $mod..." -ForegroundColor Yellow
        Install-Module $mod -Scope CurrentUser -Force -AllowClobber -Repository PSGallery
    }
}
try {
    Import-Module Microsoft.Graph.Applications -Force -ErrorAction Stop
} catch {
    if ($_.Exception.Message -match 'Assembly with same name is already loaded') {
        Write-Host "\nModule version conflict. Updating..." -ForegroundColor Yellow
        foreach ($mod in $requiredModules) {
            Install-Module $mod -Scope CurrentUser -Force -AllowClobber -Repository PSGallery -ErrorAction SilentlyContinue
        }
        Write-Host "Updated. Close ALL PowerShell windows, open a fresh one, and re-run." -ForegroundColor Yellow
        return
    }
    throw
}

$tcmAppId = '03b07b79-c5bc-4b5e-9bfa-13acf4a99998'
$adminServicesAppId = '6b91db1b-f05b-405a-a0b2-e3f60b28d645'
$graphAppId = '00000003-0000-0000-c000-000000000000'

$graphPermissions = @(
    'Directory.Read.All',
    'Policy.Read.All',
    'RoleManagement.Read.Directory',
    'EntitlementManagement.Read.All',
    'IdentityProvider.Read.All',
    'User.Read.All',
    'Group.Read.All',
    'Application.Read.All',
    'DeviceManagementConfiguration.Read.All',
    'DeviceManagementApps.Read.All',
    'DeviceManagementManagedDevices.Read.All',
    'DeviceManagementRBAC.Read.All',
    'DeviceManagementServiceConfig.Read.All',
    'TeamSettings.Read.All',
    'TeamsAppInstallation.ReadForUser.All',
    'Channel.ReadBasic.All',
    'Team.ReadBasic.All',
    'SecurityEvents.Read.All',
    'InformationProtectionPolicy.Read.All'
)

Write-Host "\\n=== TCM Setup Script ===" -ForegroundColor Cyan
Write-Host "This script will:" -ForegroundColor Cyan
Write-Host "  1. Provision the TCM service principal"
Write-Host "  2. Provision the M365 Admin Services service principal"
Write-Host "  3. Grant Microsoft Graph permissions to the TCM SP"
Write-Host ""

# Disconnect any existing session so the interactive prompt always appears
Disconnect-MgGraph -ErrorAction SilentlyContinue | Out-Null
Write-Host "Connecting to Microsoft Graph (interactive login)..." -ForegroundColor Cyan
Write-Host "  Sign in with an admin account for the tenant you want to configure." -ForegroundColor Yellow
Connect-MgGraph -Scopes @('Application.ReadWrite.All', 'AppRoleAssignment.ReadWrite.All')

$context = Get-MgContext
Write-Host "Connected as $($context.Account) to tenant $($context.TenantId)" -ForegroundColor Green

# Provision TCM SP
Write-Host "\\nChecking TCM service principal..." -ForegroundColor Cyan
$tcmSp = Get-MgServicePrincipal -Filter "AppId eq '$tcmAppId'" -ErrorAction SilentlyContinue
if (-not $tcmSp) {
    $tcmSp = New-MgServicePrincipal -AppId $tcmAppId
    Write-Host "  Created: $($tcmSp.DisplayName)" -ForegroundColor Green
} else {
    Write-Host "  Already exists: $($tcmSp.DisplayName)" -ForegroundColor Green
}

# Provision M365 Admin Services SP
Write-Host "\\nChecking M365 Admin Services service principal..." -ForegroundColor Cyan
$adminSp = Get-MgServicePrincipal -Filter "AppId eq '$adminServicesAppId'" -ErrorAction SilentlyContinue
if (-not $adminSp) {
    $adminSp = New-MgServicePrincipal -AppId $adminServicesAppId
    Write-Host "  Created: $($adminSp.DisplayName)" -ForegroundColor Green
} else {
    Write-Host "  Already exists: $($adminSp.DisplayName)" -ForegroundColor Green
}

# Grant permissions
Write-Host "\\nGranting Microsoft Graph permissions..." -ForegroundColor Cyan
$graphSp = Get-MgServicePrincipal -Filter "AppId eq '$graphAppId'"
$existing = Get-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $tcmSp.Id -All
$existingIds = $existing | Where-Object { $_.ResourceId -eq $graphSp.Id } | Select-Object -ExpandProperty AppRoleId

$granted = 0; $skipped = 0; $failed = 0
foreach ($perm in $graphPermissions) {
    $role = $graphSp.AppRoles | Where-Object { $_.Value -eq $perm }
    if (-not $role) { Write-Host "  Not found: $perm" -ForegroundColor Yellow; $failed++; continue }
    if ($role.Id -in $existingIds) { Write-Host "  Already granted: $perm" -ForegroundColor DarkGray; $skipped++; continue }
    try {
        New-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $tcmSp.Id -BodyParameter @{
            AppRoleId = $role.Id; ResourceId = $graphSp.Id; PrincipalId = $tcmSp.Id
        } | Out-Null
        Write-Host "  Granted: $perm" -ForegroundColor Green
        $granted++
    } catch {
        Write-Host "  Failed: $perm - $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

Write-Host "\\nSummary: $granted granted, $skipped already existed, $failed failed" -ForegroundColor Cyan
Write-Host "\\nDone! You can now create snapshots in Tenant Config Compare." -ForegroundColor Green
Write-Host "For Exchange Online permissions, see:" -ForegroundColor Yellow
Write-Host "  https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac" -ForegroundColor Yellow
`;

    const blob = new Blob([script], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Setup-TcmPermissions.ps1";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Snapshot panel rendering ---

function renderSnapshotPanel(side) {
    const area = document.getElementById(`${side}-snapshot-area`);
    if (!area) return;

    const state = snapshotState[side];
    const jobs = state.jobs;
    const selectedId = state.selectedSnapshotId;
    const snapshotData = state.snapshotData;

    let html = "";

    // Take Snapshot button with checklist dropdown
    const presetNames = Object.keys(RESOURCE_PRESETS);
    html += `
        <div class="d-flex align-items-center justify-content-between mb-3">
            <strong class="small">Snapshots</strong>
            <div>
                <button class="btn btn-outline-secondary btn-sm me-1 ${side}-refresh-snapshots-btn" title="Refresh">↻</button>
                <div class="dropdown d-inline-block">
                <button class="btn btn-outline-primary btn-sm dropdown-toggle" type="button"
                        data-bs-toggle="dropdown" data-bs-auto-close="outside" id="${side}-take-snapshot-btn">
                    Take Snapshot
                </button>
                <div class="dropdown-menu dropdown-menu-end p-2" style="min-width:300px; max-height:420px; overflow-y:auto">
                    <div class="mb-2">
                        <input type="text" class="form-control form-control-sm ${side}-snapshot-name"
                               placeholder="Snapshot name" data-side="${side}"
                               maxlength="64" value="">
                    </div>
                    <div class="form-check mb-1">
                        <input class="form-check-input" type="checkbox" id="${side}-preset-all" data-side="${side}" data-preset-all>
                        <label class="form-check-label fw-bold" for="${side}-preset-all">Select All</label>
                    </div>
                    <hr class="dropdown-divider my-1">
                    ${presetNames.map(name => {
                        const types = RESOURCE_PRESETS[name];
                        const safeWl = name.replace(/[^a-zA-Z]/g, "");
                        return `
                        <div class="mb-1">
                            <div class="d-flex align-items-center">
                                <input class="form-check-input me-1 ${side}-preset-check" type="checkbox"
                                       id="${side}-preset-${safeWl}"
                                       data-side="${side}" data-preset="${escapeHtml(name)}">
                                <label class="form-check-label fw-semibold" for="${side}-preset-${safeWl}">${escapeHtml(name)}</label>
                                <span class="ms-1 badge bg-secondary-subtle text-secondary-emphasis ${side}-wl-count d-none" data-workload="${escapeHtml(name)}" style="font-size:.65rem"></span>
                                <span class="flex-grow-1"></span>
                                <button type="button" class="btn btn-sm btn-link p-0 ms-1 text-body-secondary ${side}-wl-expand"
                                        data-target="${side}-types-${safeWl}" title="Show resource types"
                                        style="font-size:.7rem; line-height:1; text-decoration:none"><span class="expand-icon">▶</span> <span class="text-body-secondary">${types.length}</span></button>
                            </div>
                            <div class="d-none ps-3" id="${side}-types-${safeWl}">
                                ${types.map(t => {
                                    const short = t.split(".").slice(2).join(".") || t;
                                    const safeT = t.replace(/[^a-zA-Z0-9]/g, "_");
                                    return `
                                    <div class="form-check mb-0" style="font-size:.8rem">
                                        <input class="form-check-input ${side}-type-check" type="checkbox"
                                               id="${side}-type-${safeT}"
                                               data-side="${side}" data-resource-type="${escapeHtml(t)}" data-workload="${escapeHtml(name)}">
                                        <label class="form-check-label" for="${side}-type-${safeT}">${escapeHtml(short)}</label>
                                    </div>`;
                                }).join("")}
                            </div>
                        </div>`;
                    }).join("")}
                    <hr class="dropdown-divider my-1">${(() => {
                        const otherSide = side === "source" ? "dest" : "source";
                        const otherAccount = otherSide === "source" ? sourceAccount : destAccount;
                        if (otherAccount) {
                            return `
                    <div class="form-check form-switch mb-2">
                        <input class="form-check-input ${side}-mirror-toggle" type="checkbox" role="switch" id="${side}-mirror-toggle">
                        <label class="form-check-label small text-body-secondary" for="${side}-mirror-toggle">
                            Also snapshot the other tenant
                        </label>
                    </div>`;
                        }
                        return "";
                    })()}
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="small text-body-secondary ${side}-type-count">0 types selected</span>
                        <button class="btn btn-primary btn-sm ${side}-create-snapshot-btn" data-side="${side}" disabled>
                            Create Snapshot
                        </button>
                    </div>
                </div>
                </div>
            </div>
        </div>
    `;
    if (snapshotData && selectedId) {
        const selectedJob = jobs.find(j => j.id === selectedId);
        const summary = getSnapshotSummary(snapshotData);
        const totalResources = snapshotData.resources ? snapshotData.resources.length : 0;
        html += `
            <div class="alert alert-info py-2 mb-3">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong class="small">Selected:</strong>
                        <span class="small">${escapeHtml(selectedJob ? selectedJob.displayName : "Snapshot")}</span>
                        <br>
                        <span class="badge bg-info-subtle text-info-emphasis me-1">${totalResources} resources</span>
                        ${Object.entries(summary).sort((a, b) => b[1] - a[1]).map(([workload, count]) =>
                            `<span class="badge bg-secondary-subtle text-secondary-emphasis me-1">${escapeHtml(workload)}: ${count}</span>`
                        ).join("")}
                    </div>
                    <button class="btn btn-outline-secondary btn-sm ms-2 flex-shrink-0" id="${side}-deselect-btn" title="Deselect">✕</button>
                </div>
            </div>
        `;
    }

    // Snapshot jobs list
    if (jobs.length === 0) {
        html += `<p class="text-body-secondary small mb-0">No snapshots yet. Take a snapshot to get started.</p>`;
    } else {
        html += `<div class="list-group list-group-flush small">`;
        for (const job of jobs) {
            const isSelected = job.id === selectedId;
            const isCompleted = job.status === "completed" || job.status === "Completed";
            const isRunning = job.status === "running" || job.status === "notStarted";
            const hasSnapshot = !!job.resourceLocation;
            const hasErrors = job.errorDetails && job.errorDetails.length > 0;

            const created = new Date(job.createdDateTime).toLocaleString();
            let timeTaken = "";
            if (job.completedDateTime && job.completedDateTime !== "0001-01-01T00:00:00Z") {
                const diff = new Date(job.completedDateTime) - new Date(job.createdDateTime);
                timeTaken = ` · ${Math.floor(diff / 1000)}s`;
            }

            const activeClass = isSelected ? " active" : "";
            const clickable = hasSnapshot && !isSelected;

            html += `
                <div class="list-group-item list-group-item-action${activeClass} d-flex justify-content-between align-items-center${clickable ? "" : " pe-none-if-no-snapshot"}"
                     ${clickable ? `data-side="${side}" data-job-id="${job.id}" role="button"` : ""}
                     style="${clickable ? "cursor:pointer" : ""}">
                    <div class="text-truncate me-2">
                        <span class="fw-semibold">${escapeHtml(job.displayName)}</span>
                        <br>
                        <span class="text-body-secondary">${created}${timeTaken}</span>
                    </div>
                    <div class="text-end flex-shrink-0">
            `;

            if (isRunning) {
                html += `<span class="badge bg-warning-subtle text-warning-emphasis">
                    <span class="spinner-border spinner-border-sm" style="width:.7rem;height:.7rem"></span>
                    ${escapeHtml(job.status)}
                </span>`;
            } else if (isCompleted && hasSnapshot && hasErrors) {
                html += `<span class="badge bg-success-subtle text-success-emphasis">completed</span>`;
                html += `<br><a href="#" class="badge bg-danger-subtle text-danger-emphasis text-decoration-none snapshot-errors-link" data-job-index="${jobs.indexOf(job)}">⚠ errors</a>`;
            } else if (isCompleted && hasSnapshot) {
                html += `<span class="badge bg-success-subtle text-success-emphasis">completed</span>`;
            } else if (hasErrors) {
                html += `<a href="#" class="badge bg-danger-subtle text-danger-emphasis text-decoration-none snapshot-errors-link" data-job-index="${jobs.indexOf(job)}">errors</a>`;
            } else {
                html += `<span class="badge bg-secondary-subtle text-secondary-emphasis">${escapeHtml(job.status)}</span>`;
            }

            if (job.resources) {
                html += `<br><span class="text-body-secondary" style="font-size:.75rem">${job.resources.length} types</span>`;
            }

            html += `
                    </div>
                </div>
            `;
        }
        html += `</div>`;
    }

    area.innerHTML = html;

    // Wire up event listeners
    const nameInput = area.querySelector(`.${side}-snapshot-name`);
    const selectAllCheck = area.querySelector(`[data-preset-all][data-side="${side}"]`);
    const workloadChecks = area.querySelectorAll(`.${side}-preset-check`);
    const typeChecks = area.querySelectorAll(`.${side}-type-check`);
    const createBtn = area.querySelector(`.${side}-create-snapshot-btn`);
    const typeCountLabel = area.querySelector(`.${side}-type-count`);

    function getSelectedTypeCount() {
        let count = 0;
        // Count from fully-checked workloads
        workloadChecks.forEach(wc => {
            if (wc.checked) count += (RESOURCE_PRESETS[wc.dataset.preset] || []).length;
        });
        // Count individually checked types (not under a fully-checked workload)
        typeChecks.forEach(tc => {
            const wlCheck = area.querySelector(`.${side}-preset-check[data-preset="${tc.dataset.workload}"]`);
            if (!wlCheck || !wlCheck.checked) {
                if (tc.checked) count++;
            }
        });
        return count;
    }

    function updateWorkloadCounts() {
        area.querySelectorAll(`.${side}-wl-count`).forEach(badge => {
            const wlName = badge.dataset.workload;
            const wlCheck = area.querySelector(`.${side}-preset-check[data-preset="${wlName}"]`);
            const total = (RESOURCE_PRESETS[wlName] || []).length;
            const checked = area.querySelectorAll(`.${side}-type-check[data-workload="${wlName}"]:checked`).length;

            if (wlCheck && wlCheck.checked) {
                badge.textContent = `${total}/${total}`;
                badge.classList.remove('d-none');
            } else if (checked > 0) {
                badge.textContent = `${checked}/${total}`;
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
            }
        });
    }

    function updateCreateBtn() {
        const count = getSelectedTypeCount();
        const nameValid = nameInput.value.trim().length >= 8 && /^[a-zA-Z0-9\s]+$/.test(nameInput.value.trim());
        createBtn.disabled = !(count > 0 && nameValid);
        typeCountLabel.textContent = `${count} type${count !== 1 ? "s" : ""} selected`;
        updateWorkloadCounts();
    }

    if (nameInput) {
        nameInput.addEventListener("input", updateCreateBtn);
    }

    // Select All
    if (selectAllCheck) {
        selectAllCheck.addEventListener("change", () => {
            workloadChecks.forEach(c => {
                c.checked = selectAllCheck.checked;
                c.disabled = selectAllCheck.checked;
            });
            typeChecks.forEach(c => {
                c.checked = selectAllCheck.checked;
                c.disabled = selectAllCheck.checked;
            });
            updateCreateBtn();
        });
    }

    // Workload checkboxes — check/uncheck all child types
    workloadChecks.forEach(wc => {
        wc.addEventListener("change", () => {
            const childTypes = area.querySelectorAll(`.${side}-type-check[data-workload="${wc.dataset.preset}"]`);
            childTypes.forEach(tc => {
                tc.checked = wc.checked;
                tc.disabled = wc.checked;
            });
            // Sync Select All
            const allWlChecked = [...workloadChecks].every(c => c.checked);
            if (selectAllCheck) {
                selectAllCheck.checked = allWlChecked;
                if (allWlChecked) {
                    workloadChecks.forEach(c => c.disabled = true);
                    typeChecks.forEach(c => c.disabled = true);
                }
            }
            updateCreateBtn();
        });
    });

    // Individual type checkboxes — sync with parent workload
    typeChecks.forEach(tc => {
        tc.addEventListener("change", () => {
            const wlName = tc.dataset.workload;
            const siblings = area.querySelectorAll(`.${side}-type-check[data-workload="${wlName}"]`);
            const wlCheck = area.querySelector(`.${side}-preset-check[data-preset="${wlName}"]`);
            if (wlCheck) {
                const allSiblings = [...siblings].every(s => s.checked);
                wlCheck.checked = allSiblings;
                if (allSiblings) {
                    siblings.forEach(s => s.disabled = true);
                }
            }
            updateCreateBtn();
        });
    });

    // Workload expand/collapse buttons
    area.querySelectorAll(`.${side}-wl-expand`).forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = document.getElementById(btn.dataset.target);
            if (target) {
                const hidden = target.classList.contains("d-none");
                target.classList.toggle("d-none");
                const icon = btn.querySelector('.expand-icon') || btn.firstChild;
                icon.textContent = hidden ? "▼" : "▶";
            }
        });
    });

    // Create Snapshot button
    if (createBtn) {
        createBtn.addEventListener("click", () => {
            const name = nameInput.value.trim();
            if (name.length < 8 || !/^[a-zA-Z0-9\s]+$/.test(name)) {
                nameInput.classList.add("is-invalid");
                return;
            }
            nameInput.classList.remove("is-invalid");

            let presets = [];
            let individualTypes = [];

            if (selectAllCheck && selectAllCheck.checked) {
                presets = ["All"];
            } else {
                // Collect fully-checked workloads as presets
                presets = [...workloadChecks].filter(c => c.checked).map(c => c.dataset.preset);

                // Collect individually checked types not covered by a workload preset
                const coveredWorkloads = new Set(presets);
                typeChecks.forEach(tc => {
                    if (tc.checked && !coveredWorkloads.has(tc.dataset.workload)) {
                        individualTypes.push(tc.dataset.resourceType);
                    }
                });
            }
            if (presets.length === 0 && individualTypes.length === 0) return;

            // Close the dropdown
            const dropdownEl = area.querySelector(`#${side}-take-snapshot-btn`);
            const bsDropdown = bootstrap.Dropdown.getInstance(dropdownEl);
            if (bsDropdown) bsDropdown.hide();

            triggerSnapshot(side, presets, name, individualTypes);

            // Mirror: also trigger on the other side if enabled and authenticated
            if (isMirrorEnabled(side)) {
                const otherSide = side === "source" ? "dest" : "source";
                const otherAccount = otherSide === "source" ? sourceAccount : destAccount;
                if (otherAccount) {
                    triggerSnapshot(otherSide, presets, name, individualTypes);
                }
            }
        });
    }

    // Snapshot job selection
    area.querySelectorAll("[data-job-id]").forEach(el => {
        el.addEventListener("click", () => {
            selectSnapshot(el.dataset.side, el.dataset.jobId);
        });
    });

    // Error details links
    area.querySelectorAll(".snapshot-errors-link").forEach(el => {
        el.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const job = jobs[parseInt(el.dataset.jobIndex)];
            if (job && job.errorDetails) {
                showSnapshotErrors(side, job.displayName, job.errorDetails);
            }
        });
    });

    // Deselect button
    const deselectBtn = document.getElementById(`${side}-deselect-btn`);
    if (deselectBtn) {
        deselectBtn.addEventListener("click", () => deselectSnapshot(side));
    }

    // Refresh button
    const refreshBtn = area.querySelector(`.${side}-refresh-snapshots-btn`);
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            refreshBtn.disabled = true;
            loadSnapshotJobs(side).finally(() => { refreshBtn.disabled = false; });
        });
    }

    // If there are running jobs, ensure polling is active
    const hasRunning = jobs.some(j => j.status === "notStarted" || j.status === "running");
    if (hasRunning) startPolling(side);
}

// Helpers
function escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// --- Settings button → shows setup guide ---

document.addEventListener("DOMContentLoaded", () => {
    const settingsBtn = document.getElementById("settings-btn");
    if (settingsBtn) {
        settingsBtn.addEventListener("click", () => {
            sessionStorage.removeItem("tcm_guide_dismissed");
            renderSetupGuide();
            const guide = document.getElementById("setup-guide");
            if (guide) guide.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }
});

// signInSource, signInDest, signOutSource, signOutDest are defined in auth.js
// and called directly from onclick handlers in the rendered HTML.

// --- Compare results (property-level diff) ---

let _hideEntitiesState = true; // persists across re-renders

function renderCompareResults(sourceData, destData) {
    const diffSection = document.getElementById("diff-section");
    const diffOutput = document.getElementById("diff-output");
    diffSection.classList.remove("d-none");

    // Check if we have an existing toggle state
    const existingToggle = diffOutput.querySelector("#hide-entities");
    if (existingToggle) _hideEntitiesState = existingToggle.checked;

    // Run the diff engine
    const diff = diffSnapshots(sourceData, destData, { hideEntities: _hideEntitiesState });

    const sourceTotal = sourceData.resources ? sourceData.resources.length : 0;
    const destTotal = destData.resources ? destData.resources.length : 0;
    const typeCount = Object.keys(diff).length;
    const typesWithDiffs = Object.values(diff).filter(d => d.hasDifferences).length;

    // Group types by workload
    const workloads = {};
    for (const type of Object.keys(diff)) {
        const parts = type.split(".");
        const workload = parts.length >= 2 ? capitalize(parts[1]) : "Other";
        (workloads[workload] || (workloads[workload] = [])).push(type);
    }

    let html = `
        <div class="d-flex flex-wrap justify-content-between align-items-center mb-3">
            <p class="text-body-secondary mb-0">
                <strong>${sourceTotal}</strong> source vs <strong>${destTotal}</strong> dest resources
                across <strong>${typeCount}</strong> types.
                ${typesWithDiffs > 0
                    ? `<span class="text-warning-emphasis fw-semibold ms-1">${typesWithDiffs} type${typesWithDiffs > 1 ? "s" : ""} differ.</span>`
                    : '<span class="text-success-emphasis fw-semibold ms-1">All types match!</span>'}
            </p>
            <div class="d-flex align-items-center gap-2 mt-1">
                <div class="form-check form-check-inline mb-0">
                    <input class="form-check-input" type="checkbox" id="hide-entities" checked>
                    <label class="form-check-label small" for="hide-entities">Hide entities</label>
                </div>
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" class="btn btn-outline-secondary active compare-filter" data-filter="all">All</button>
                    <button type="button" class="btn btn-outline-secondary compare-filter" data-filter="diffs">Differences only</button>
                </div>
                <button type="button" class="btn btn-outline-primary btn-sm" id="export-csv-btn">📥 Export CSV</button>
            </div>
        </div>
        <div class="accordion" id="compare-accordion">
    `;

    let wIdx = 0;
    for (const [workload, types] of Object.entries(workloads).sort()) {
        const wSrc = types.reduce((s, t) => s + diff[t].sourceCount, 0);
        const wDst = types.reduce((s, t) => s + diff[t].destCount, 0);
        const wDiffs = types.some(t => diff[t].hasDifferences);
        const collapseId = `cw-${wIdx}`;
        const badgeCls = wDiffs ? "bg-warning-subtle text-warning-emphasis" : "bg-success-subtle text-success-emphasis";

        html += `
            <div class="accordion-item compare-wl" data-has-diffs="${wDiffs}">
                <h2 class="accordion-header">
                    <button class="accordion-button collapsed py-2" type="button"
                            data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                        <span class="me-2 fw-semibold">${escapeHtml(workload)}</span>
                        <span class="badge ${badgeCls} me-1">${wSrc} ↔ ${wDst}</span>
                        ${wDiffs
                            ? '<span class="badge bg-warning">differs</span>'
                            : '<span class="badge bg-success">match</span>'}
                    </button>
                </h2>
                <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#compare-accordion">
                    <div class="accordion-body p-0">
        `;

        for (let tIdx = 0; tIdx < types.length; tIdx++) {
            const type = types[tIdx];
            const td = diff[type];
            const shortName = type.split(".").slice(2).join(".") || type;
            const typeId = `ct-${wIdx}-${tIdx}`;

            const changedCount = td.matched.filter(m => !m.identical).length;
            const identicalCount = td.matched.filter(m => m.identical).length;

            let badges = "";
            if (td.sourceOnly.length) badges += `<span class="badge bg-info-subtle text-info-emphasis me-1">${td.sourceOnly.length} src only</span>`;
            if (td.destOnly.length) badges += `<span class="badge bg-primary-subtle text-primary-emphasis me-1">${td.destOnly.length} dest only</span>`;
            if (changedCount) badges += `<span class="badge bg-warning-subtle text-warning-emphasis me-1">${changedCount} differ</span>`;
            if (identicalCount > 0 && !td.hasDifferences) badges += `<span class="badge bg-success-subtle text-success-emphasis">${identicalCount} match</span>`;

            html += `
                <div class="border-bottom compare-type" data-has-diffs="${td.hasDifferences}">
                    <div class="d-flex align-items-center px-3 py-2 compare-type-hdr"
                         role="button" data-type="${escapeHtml(type)}" data-type-id="${typeId}">
                        <span class="compare-chv small text-body-secondary me-1">+</span>
                        <span class="small fw-semibold me-2">${escapeHtml(shortName)}</span>
                        <span class="ms-auto small text-nowrap">
                            <span class="text-body-secondary me-2">${td.sourceCount} ↔ ${td.destCount}</span>
                            ${badges}
                        </span>
                    </div>
                    <div class="d-none px-3 pb-2" id="${typeId}"></div>
                </div>
            `;
        }

        html += `</div></div></div>`;
        wIdx++;
    }

    html += `</div>`;
    diffOutput.innerHTML = html;

    // Wire up resource type expansion (lazy render on first click)
    diffOutput.querySelectorAll(".compare-type-hdr").forEach(hdr => {
        hdr.addEventListener("click", () => {
            const detail = document.getElementById(hdr.dataset.typeId);
            const chv = hdr.querySelector(".compare-chv");
            if (detail.classList.contains("d-none")) {
                if (!detail.dataset.rendered) {
                    detail.innerHTML = buildTypeDetail(diff[hdr.dataset.type]);
                    detail.dataset.rendered = "1";
                    wireResourceRows(detail);
                }
                detail.classList.remove("d-none");
                chv.textContent = "−";
            } else {
                detail.classList.add("d-none");
                chv.textContent = "+";
            }
        });
    });

    // Wire up filter buttons
    diffOutput.querySelectorAll(".compare-filter").forEach(btn => {
        btn.addEventListener("click", () => {
            diffOutput.querySelectorAll(".compare-filter").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const f = btn.dataset.filter;
            diffOutput.querySelectorAll(".compare-wl").forEach(el => {
                el.classList.toggle("d-none", f === "diffs" && el.dataset.hasDiffs === "false");
            });
            diffOutput.querySelectorAll(".compare-type").forEach(el => {
                el.classList.toggle("d-none", f === "diffs" && el.dataset.hasDiffs === "false");
            });
        });
    });

    // Wire up CSV export
    const exportBtn = diffOutput.querySelector("#export-csv-btn");
    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            // Export uses the full diff (including entities) so the CSV has everything
            const fullDiff = diffSnapshots(sourceData, destData, { hideEntities: false });
            exportDiffCsv(fullDiff);
        });
    }

    // Wire up "Hide entities" toggle — re-runs the diff
    const entityToggle = diffOutput.querySelector("#hide-entities");
    if (entityToggle) {
        entityToggle.addEventListener("change", () => {
            renderCompareResults(sourceData, destData);
        });
    }

    // Preserve the entity toggle state across re-renders
    const entityCheckbox = diffOutput.querySelector("#hide-entities");
    if (entityCheckbox) {
        entityCheckbox.checked = _hideEntitiesState;
    }

    diffSection.scrollIntoView({ behavior: "smooth" });
}

// Build the expanded detail view for a resource type
function buildTypeDetail(td) {
    const items = [];

    // Source-only resources
    for (const r of td.sourceOnly) {
        const propCount = Object.keys(r.resource.properties || {}).length;
        items.push(`
            <div class="d-flex align-items-center py-1 border-bottom">
                <span class="badge bg-info me-2">source only</span>
                <span class="small text-truncate" title="${escapeHtml(r.displayName)}">${escapeHtml(r.displayName)}</span>
                <span class="ms-auto small text-body-secondary text-nowrap">${propCount} props</span>
            </div>
        `);
    }

    // Dest-only resources
    for (const r of td.destOnly) {
        const propCount = Object.keys(r.resource.properties || {}).length;
        items.push(`
            <div class="d-flex align-items-center py-1 border-bottom">
                <span class="badge bg-primary me-2">dest only</span>
                <span class="small text-truncate" title="${escapeHtml(r.displayName)}">${escapeHtml(r.displayName)}</span>
                <span class="ms-auto small text-body-secondary text-nowrap">${propCount} props</span>
            </div>
        `);
    }

    // Matched resources with differences (expandable)
    for (const m of td.matched.filter(x => !x.identical)) {
        const dc = m.propertyDiffs.length;
        items.push(`
            <div class="compare-res-row border-bottom" role="button">
                <div class="d-flex align-items-center py-1">
                    <span class="compare-res-chv small text-body-secondary me-1">+</span>
                    <span class="badge bg-warning text-dark me-2">${dc} diff${dc > 1 ? "s" : ""}</span>
                    <span class="small fw-semibold text-truncate" title="${escapeHtml(m.displayName)}">${escapeHtml(m.displayName)}</span>
                </div>
                <div class="d-none compare-res-detail mb-2">
                    ${buildPropertyDiffTable(m.propertyDiffs)}
                </div>
            </div>
        `);
    }

    // Identical resources summary
    const identicalCount = td.matched.filter(x => x.identical).length;
    if (identicalCount > 0) {
        items.push(`
            <div class="d-flex align-items-center py-1 text-body-secondary">
                <span class="badge bg-success-subtle text-success-emphasis me-2">identical</span>
                <span class="small">${identicalCount} resource${identicalCount > 1 ? "s" : ""} match</span>
            </div>
        `);
    }

    if (items.length === 0) {
        return `<p class="text-body-secondary small mb-0">No resources in this type.</p>`;
    }

    return items.join("");
}

// Build the property diff table for a single resource
function buildPropertyDiffTable(diffs) {
    let html = `
        <table class="table table-sm table-bordered mb-0" style="font-size:.8rem">
            <thead class="table-light">
                <tr>
                    <th style="width:25%">Property</th>
                    <th style="width:37.5%">Source</th>
                    <th style="width:37.5%">Destination</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const d of diffs) {
        const srcCell = d.status === "dest-only"
            ? `<em class="text-body-secondary">—</em>`
            : `<code class="text-break">${escapeHtml(formatDiffValue(d.sourceValue))}</code>`;
        const dstCell = d.status === "source-only"
            ? `<em class="text-body-secondary">—</em>`
            : `<code class="text-break">${escapeHtml(formatDiffValue(d.destValue))}</code>`;
        const cls = d.status === "source-only" ? "table-info" : d.status === "dest-only" ? "table-primary" : "";

        html += `
            <tr class="${cls}">
                <td class="fw-semibold text-nowrap">${escapeHtml(d.property)}</td>
                <td style="max-width:300px; overflow:auto">${srcCell}</td>
                <td style="max-width:300px; overflow:auto">${dstCell}</td>
            </tr>
        `;
    }

    html += `</tbody></table>`;
    return html;
}

// Wire up expand/collapse on resource rows within a type detail
function wireResourceRows(container) {
    container.querySelectorAll(".compare-res-row").forEach(row => {
        row.addEventListener("click", () => {
            const detail = row.querySelector(".compare-res-detail");
            const chv = row.querySelector(".compare-res-chv");
            const hidden = detail.classList.contains("d-none");
            detail.classList.toggle("d-none");
            chv.textContent = hidden ? "−" : "+";
        });
    });
}

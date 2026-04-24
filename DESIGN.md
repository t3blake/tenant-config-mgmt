# Tenant Config Mgmt — Design Document

> **Status:** Draft — aligning on principles before any code is written.
>
> **Goal:** Build a **GitHub Pages SPA** that lets an admin authenticate to
> two Microsoft 365 tenants (source + destination), create **TCM snapshots**
> on each, and **visually compare** them with a structured diff view.
> No backend, no stored credentials — everything runs in the browser against
> Microsoft Graph.

---

## 1. Problem Statement

Organizations with multiple Microsoft 365 tenants (dev/test/prod) need
visibility into how their configurations differ. Today, comparing tenant
settings means manually clicking through admin portals side by side —
tedious, incomplete, and easy to miss critical differences.

The UTCM Control Panel (by Microsoft) provides snapshot and drift monitoring
for a **single** tenant but has no concept of comparing across tenants.

We want:

- **Authenticate** to two tenants (source + destination) in one session.
- **Snapshot** each tenant's configuration via TCM APIs.
- **Compare** the two snapshots visually — property-by-property diff.
- **Export** the diff as a downloadable report (JSON / HTML).
- **Zero backend** — static SPA on GitHub Pages, all API calls from browser.

---

## 2. Technology Choice: TCM APIs

### What TCM gives us

The [Tenant Configuration Management APIs](https://learn.microsoft.com/en-us/graph/unified-tenant-configuration-management-concept-overview)
(part of Microsoft Graph) provide:

| Capability | API | What it does |
|---|---|---|
| **Snapshot** | `configurationSnapshotJob` | Extracts current tenant config as declarative JSON across workloads |
| **Baseline** | `configurationBaseline` | Defines the *desired* configuration state |
| **Monitor** | `configurationMonitor` | Compares live config to a baseline every 6 hours |
| **Drift** | `configurationDrift` | Reports deviations from the baseline |

### Supported workloads (all GA as of April 2026)

| Workload | Status | Notes |
|---|:---:|---|
| **Microsoft Entra** | ✅ GA | Conditional Access, auth methods, groups, cross-tenant policies |
| **Microsoft Intune** | ✅ GA | Device configuration, compliance policies |
| **Microsoft Exchange Online** | ✅ GA | Transport rules, connectors, mailbox policies, anti-spam/phish |
| **Microsoft Teams** | ✅ GA | Meeting, messaging, calling, federation policies |
| **Microsoft Defender / Purview** | ✅ GA | DLP, retention, eDiscovery, sensitivity labels (single `securityandcompliance` namespace) |

### What TCM does NOT give us (confirmed gap — still true at GA)

> **Still read/monitor-only at GA (April 2026).** The GA announcement
> confirms monitors can detect drift, but remediation is manual: *"resolve
> these drifts by using the relevant admin centers or other available
> methods."* No deploy/auto-remediate capability shipped with GA.
>
> The preview-era roadmap language about deploying configuration changes
> via JSON templates is no longer mentioned — no timeline given.

**Our plan:** Use TCM for snapshot + comparison only. The app is read-only
by design — no writes to either tenant. When TCM deploy ships, we can add
an "apply" button to push selected changes from source → destination.

### Snapshot JSON structure (confirmed)

From Nik's blog, a TCM snapshot has this shape:

```json
{
  "resources": [
    {
      "displayName": "AADConditionalAccessPolicy-MFA for partners",
      "resourceType": "microsoft.entra.conditionalaccesspolicy",
      "properties": {
        "State": "enabledForReportingButNotEnforced",
        "IncludeUsers": ["All"],
        "ExcludeRoles": ["Directory Synchronization Accounts"],
        "Ensure": "Present",
        ...
      }
    }
  ]
}
```

Key facts:
- Each resource has a `resourceType` (e.g., `microsoft.entra.conditionalaccesspolicy`)
- Properties include `Ensure: "Present"` and an `Identity` field
- Snapshots expire after **7 days** — must download and commit to Git
- Snapshot jobs require **polling** (`GET` on the job ID) — push notifications coming later

### TCM-Utility PowerShell module

[Nik's TCM-Utility](https://github.com/nikcharlebois/tcm-utility) is a
PowerShell module that:
- Accepts a list of resource types or a JSON config template
- Returns the exact permissions and Entra ID roles needed by the TCM SP
- Can auto-assign permissions via `Add-TCMServicePrincipalPermissions`

We should use this in our setup scripts to automate permission grants.

### Why TCM over Microsoft365DSC?

[Microsoft365DSC](https://github.com/Microsoft365DSC/Microsoft365DSC) is a
mature alternative (2.3k stars, 223 releases, 100% PowerShell). We chose TCM
because:

1. **Learning goal** — understanding the raw Graph API primitives.
2. **Graph-native** — no DSC engine dependency; runs entirely in the browser.
3. **Declarative JSON** — snapshots are plain JSON, perfect for structured
   diffing.
4. **Future-proof** — TCM is Microsoft's newer investment in this space.
   Deploy + auto-remediate capabilities are on the roadmap.

Trade-off acknowledged: TCM snapshots may not cover every setting; users can
fill gaps manually or wait for broader workload coverage.

### Relationship to the UTCM Control Panel

Microsoft published a [UTCM Control Panel](https://github.com/microsoft/utcm-controlpanel)
SPA (JavaScript, by Nik Charlebois) that provides a browser UI for managing
snapshots, monitors, and drifts against **a single tenant**.

What it does well (patterns we'll reuse):
- API call patterns for snapshot creation, polling, and retrieval
- Monitor creation with baseline JSON passed directly
- Drift visualization with `currentValue` vs. `desiredValue`
- Full list of supported resource types across all workloads

What it lacks (our differentiator):
- **No source → destination concept** — single-tenant only
- **No cross-tenant comparison** — can view one snapshot at a time, no diff
- **No diff/export** — no way to see what's different between two configs

Our project adds the **dual-tenant compare** experience: authenticate to
two tenants, snapshot both, and get a structured visual diff.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                  GitHub Pages (Static SPA)                            │
│                                                                      │
│  index.html              ← Single page app shell                     │
│  auth.js                 ← MSAL.js multi-account login               │
│  graph.js                ← TCM API calls (snapshot, list, get)       │
│  diff.js                 ← Snapshot comparison engine                │
│  ui.js                   ← UI rendering (tenant panels, diff view)   │
│  style.css               ← Styling                                   │
│  config.js               ← MSAL config (client ID, scopes)          │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            │   User's Browser    │
            │                     │
            │  MSAL.js manages    │
            │  two accounts:      │
            │  • Source token     │
            │  • Destination token│
            └──────────┬──────────┘
                       │ Direct Graph API calls
       ┌───────────────┴───────────────┐
       │                               │
  ┌────▼──────────┐          ┌─────────▼────┐
  │ Source        │          │ Destination  │
  │ Tenant (dev)  │          │ Tenant (prod)│
  │               │          │              │
  │ TCM API       │          │ TCM API      │
  │ (read-only)   │          │ (read-only)  │
  └───────────────┘          └──────────────┘
```

### User flow

```
1. Open app → Sign in to Source tenant (MSAL popup)
2. Sign in to Destination tenant (MSAL popup, separate account)
3. For each tenant, see existing snapshots or create a new one:
   a. Select workload resource types
   b. Kick off snapshot job → poll until complete
   c. Snapshot appears in list
4. Select one snapshot from Source, one from Destination
5. Click "Compare" → structured diff view:
   - Resources only in Source (green, additions)
   - Resources only in Destination (red, removals)
   - Resources in both with differing properties (yellow, changes)
   - Matching resources (collapsed, no diff)
6. Download diff as JSON or formatted HTML report
```

### Data flow (security-critical)

```
Browser ──HTTPS──▶ Microsoft Graph (graph.microsoft.com)
                   ▲ Tokens never leave the browser
                   │ No backend / no proxy / no server
                   │ Snapshot data lives in browser memory only
                   │ Nothing persisted unless user downloads
```

**No tenant data touches our infrastructure. Ever.**

---

## 4. Authentication & Security

### Auth method: MSAL.js with Auth Code + PKCE

The app uses **MSAL.js 2.x** with the **Authorization Code Flow + PKCE**
(public client). This is the Microsoft-recommended pattern for SPAs — no
client secret exists anywhere.

| Property | Value |
|---|---|
| MSAL library | `@azure/msal-browser` 2.x |
| Flow | Authorization Code + PKCE |
| Client type | Public (SPA) |
| Interaction | Popup (not redirect, to keep both sessions alive) |
| Token cache | `sessionStorage` (cleared when tab closes) |

### Multi-tenant app registration

One **single app registration** configured as multi-tenant:

| Setting | Value |
|---|---|
| Supported account types | Accounts in any organizational directory |
| Redirect URI | `https://<org>.github.io/tenant-config-mgmt/` |
| Platform | SPA |
| Client secret | **None** — public client, PKCE only |

Users from any Entra tenant can sign in. The app requests delegated
permissions — it acts as the signed-in user, not as an application.

### Dual-account session

MSAL.js supports multiple accounts. The app maintains **two separate
authenticated sessions** — one per tenant:

```
sourceAccount  → token for Source tenant  → Graph calls scoped to Source
destAccount    → token for Dest tenant    → Graph calls scoped to Dest
```

Tokens are stored in `sessionStorage` (per-tab, cleared on close). We never
write tokens to `localStorage` or any persistent store.

### TCM service principal (per tenant)

Each tenant the user wants to snapshot must have **two service principals**
provisioned. This is a one-time admin setup:

```powershell
# One-time setup per tenant
Connect-MgGraph -Scopes 'Application.ReadWrite.All','AppRoleAssignment.ReadWrite.All'

# 1. TCM service principal
New-MgServicePrincipal -AppId '03b07b79-c5bc-4b5e-9bfa-13acf4a99998'

# 2. M365 Admin Services service principal (required by TCM)
New-MgServicePrincipal -AppId '6b91db1b-f05b-405a-a0b2-e3f60b28d645'
```

Then grant the TCM SP the required read permissions per workload (see
[auth setup docs](https://learn.microsoft.com/en-us/graph/utcm-authentication-setup)).
Since this app is **read-only**, only read permissions/roles are needed.

### Required permissions (delegated)

| Permission | Type | Why |
|---|---|---|
| `user.read` | Delegated | Display signed-in user info |
| `ConfigurationMonitoring.ReadWrite.All` | Delegated | Create snapshots, list monitors/drifts |

Note: Despite the `ReadWrite` name, this permission is required even for
read operations (snapshots). This matches the UTCM Control Panel's approach.

### Security guardrails

| Threat | Mitigation |
|---|---|
| Token theft via XSS | Strict CSP headers; `sessionStorage` (not `localStorage`); no inline scripts |
| Cross-tenant data leakage | Tokens are scoped per-tenant; API calls go direct to Graph; no backend proxy |
| Credential storage | Zero secrets — public client + PKCE, no client secret anywhere |
| Data at rest | Nothing persisted — snapshot data lives in browser memory only |
| Man-in-the-middle | All traffic over HTTPS (GitHub Pages enforces TLS) |

---

## 5. Project Structure

```
tenant-config-mgmt/
├── app/
│   ├── index.html              # SPA shell (Bootstrap 5)
│   ├── config.js               # MSAL configuration (client ID, scopes)
│   ├── auth.js                 # MSAL init, multi-account sign-in/out
│   ├── graph.js                # TCM Graph API calls (snapshot, list, get)
│   ├── diff.js                 # Snapshot comparison engine
│   ├── ui.js                   # DOM rendering (panels, tables, diff view)
│   ├── style.css               # Custom styles
│   └── images/                 # Workload icons (from UTCM Control Panel)
├── docs/                       # GitHub Pages serves from here (or root)
│   └── (symlink or copy of app/)
├── DESIGN.md                   # This document
├── README.md                   # Setup guide + walkthrough
├── .gitignore
└── LICENSE
```

### Module responsibilities

| File | Responsibility |
|---|---|
| `config.js` | MSAL client ID, redirect URI, scopes. No secrets. |
| `auth.js` | `signInSource()`, `signInDest()`, `signOut()`, `getSourceToken()`, `getDestToken()`. Manages two MSAL accounts via popup. |
| `graph.js` | `createSnapshot(token, resources)`, `getSnapshotJobs(token)`, `getSnapshot(token, id)`, `pollSnapshotJob(token, jobId)`. All accept a token param — caller decides which tenant. |
| `diff.js` | `compareSnapshots(sourceSnapshot, destSnapshot)` → returns `{ added[], removed[], changed[], unchanged[] }`. Pure function, no side effects. |
| `ui.js` | Renders the two-panel layout, snapshot lists, resource picker, diff table. All DOM manipulation here. |

---

## 6. Design Principles

1. **Zero trust with user data** — No backend, no proxy, no telemetry.
   Snapshot data exists only in browser memory. Nothing is persisted unless
   the user explicitly downloads it.

2. **No stored secrets** — Public client + PKCE. No client secret exists
   anywhere — not in code, not in config, not in environment variables.

3. **Read-only by design** — The app only calls TCM read APIs. No write
   permissions requested. When TCM deploy ships, write can be added as an
   opt-in feature.

4. **Tenant-agnostic** — Works with any two Entra tenants. No hardcoded
   tenant IDs. The user authenticates to whichever tenants they choose.

5. **Modular by workload** — Resource type list is data-driven. Adding a
   new workload means adding entries to the resource picker, not changing
   diff logic.

6. **Fail loud, not silent** — Every Graph API call checks for errors.
   Partial snapshot failures are surfaced clearly (like the UTCM Control
   Panel does).

7. **Minimal dependencies** — Vanilla JavaScript + Bootstrap 5 + MSAL.js +
   Microsoft Graph JS SDK. No build step, no framework, no bundler.

8. **Documentation-first** — Code is commented explaining *why*. README
   walks through app registration setup and first use step-by-step.

9. **Start narrow, expand later** — v1 supports all workloads for snapshot
   + compare. Future: apply, monitor management, Git export.

---

## 7. Open Questions (Resolved)

| # | Question | Status | Answer |
|---|---|---|---|
| 1 | Can MSAL.js handle two accounts from different tenants simultaneously? | ✅ Resolved | **Yes — single `PublicClientApplication` instance.** See details below. |
| 2 | Does `ConfigurationMonitoring.ReadWrite.All` work as a **delegated** permission? | ✅ Resolved | **Yes — confirmed in MS Graph permissions reference.** Both `Read.All` and `ReadWrite.All` exist as delegated. Admin consent required. |
| 3 | How do we match resources across tenants for diffing? | ✅ Resolved | **Match by `resourceType` + `displayName` as composite key.** See details below. |
| 4 | How do we handle tenant-specific GUIDs in snapshot properties? | ✅ Resolved | **Flag, don't ignore.** Show all diffs; let user judge. v2 can resolve GUIDs to display names. |
| 5 | Rate limits for snapshot creation via delegated permissions? | ✅ Resolved | **20K resources/month is a TCM tenant quota, applies equally to delegated calls.** Standard Graph 429 throttling also applies. |
| 6 | Can we register a single multi-tenant app, or does each customer need their own? | ✅ Resolved | **Yes — single multi-tenant registration works.** Admin consent required on first use per tenant. |

### Q1: MSAL dual-tenant accounts — detail

MSAL.js has built-in **multi-tenant account** support ([docs](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-common/docs/multi-tenant-accounts.md)).
A single `PublicClientApplication` configured with `authority: "https://login.microsoftonline.com/common"` can hold accounts from multiple tenants.

Our scenario: users sign in with **different accounts** to each tenant.
Per the MSAL docs: *"If a user uses different accounts to authenticate to each tenant, these will not be linked as tenant profiles of each other and will be treated as completely different accounts."*
This is exactly what we want — two independent accounts in the same MSAL cache.

**Implementation plan:**
- Configure MSAL with `common` authority (tenant-agnostic)
- User signs in twice via popup — once for source, once for destination
- Track each account object: `sourceAccount`, `destAccount`
- When acquiring tokens, pass the relevant account + authority override to the target tenant
- `getAllAccounts()` returns both; filter by `homeAccountId` to find the right one

**No need for two MSAL instances.**

### Q2: Delegated permissions — detail

From the official [MS Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference):

| Permission | Application ID | Delegated ID | Admin Consent |
|---|---|---|---|
| `ConfigurationMonitoring.Read.All` | `aca929ec-...` | `c645bb69-...` | Yes |
| `ConfigurationMonitoring.ReadWrite.All` | `cfa85bfb-...` | `54505ce9-...` | Yes |

Both exist as delegated permissions. The UTCM Control Panel uses `ReadWrite.All`
even for read-only operations (snapshot creation requires `ReadWrite`).

**Decision:** Request `ConfigurationMonitoring.ReadWrite.All` (delegated) to match the UTCM Control Panel pattern and support snapshot creation.

#### Can the SPA help users set up permissions?

**No — and it shouldn't.** Granting permissions programmatically would require
`Application.ReadWrite.All` and `AppRoleAssignment.ReadWrite.All`, which are
dangerously elevated for a read-only comparison tool. We intentionally keep our
permission surface minimal.

**What we CAN do — detect and guide:**

1. **Detect at runtime.** When a TCM API call returns `403 Forbidden` or an
   `Authorization_RequestDenied` error, `graph.js` catches it and surfaces a
   targeted setup guidance banner instead of a generic error.

2. **Distinguish the two setup failures:**
   - **TCM service principal not provisioned** — the tenant hasn't enabled TCM at all.
   - **Missing delegated permission consent** — our app hasn't been admin-consented in that tenant.

3. **Show actionable guidance with links and copy-paste commands:**

   **If TCM SP is missing:**
   > ⚠️ TCM is not enabled in this tenant. An admin needs to provision the
   > TCM and M365 Admin Services service principals. Run this in PowerShell:
   > ```
   > Connect-MgGraph -Scopes 'Application.ReadWrite.All'
   > New-MgServicePrincipal -AppId '03b07b79-c5bc-4b5e-9bfa-13acf4a99998'
   > New-MgServicePrincipal -AppId '6b91db1b-f05b-405a-a0b2-e3f60b28d645'
   > ```
   > Then grant the TCM SP the required read permissions per workload:
   > [TCM Authentication Setup →](https://learn.microsoft.com/en-us/graph/utcm-authentication-setup)
   >
   > Use [Nik's TCM-Utility module](https://github.com/nikcharlebois/tcm-utility)
   > to discover and auto-assign the exact permissions needed.

   **If admin consent is missing:**
   > ⚠️ This app needs admin consent in your tenant. Ask your tenant admin to
   > visit the app and approve the `ConfigurationMonitoring.ReadWrite.All`
   > permission, or use the direct admin consent URL:
   > `https://login.microsoftonline.com/{tenant-id}/adminconsent?client_id={client-id}`
   >
   > [Understanding admin consent →](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent)

4. **Reference links shown in-app:**
   - [TCM Authentication Setup](https://learn.microsoft.com/en-us/graph/utcm-authentication-setup) — SP provisioning + workload permissions
   - [Supported Entra Resources](https://learn.microsoft.com/en-us/graph/utcm-entra-resources) — what roles the TCM SP needs for Entra workloads
   - [Supported Intune Resources](https://learn.microsoft.com/en-us/graph/utcm-intune-resources) — what roles the TCM SP needs for Intune workloads
   - [Supported Exchange Resources](https://learn.microsoft.com/en-us/graph/utcm-exchange-resources) — Exchange Online workload permissions
   - [Supported Teams Resources](https://learn.microsoft.com/en-us/graph/utcm-teams-resources) — Teams workload permissions
   - [Supported Security & Compliance Resources](https://learn.microsoft.com/en-us/graph/utcm-securityandcompliance-resources) — Defender + Purview workload permissions
   - [TCM-Utility module](https://github.com/nikcharlebois/tcm-utility) — auto-discover and assign permissions

### Q3: Resource matching — detail

Based on the confirmed snapshot JSON shape, each resource has `resourceType` and `displayName`.

**Matching strategy:**
- **Primary key:** `resourceType` + `displayName` (composite)
- `displayName` is the admin-assigned name (e.g., "MFA for partners")
- For singleton resources (tenant-wide settings with only one instance per type), `resourceType` alone may suffice

**Edge cases:**
- If admins name the same policy differently across tenants, it won't auto-match — the diff surfaces these as separate adds/removes
- v2 could offer a manual matching UI for unmatched resources
- `Identity` field in properties may contain tenant-specific GUIDs; not reliable as a match key

### Q4: Tenant-specific GUIDs — detail

**v1 strategy: Flag everything, ignore nothing.**
- Properties like `ExcludeRoles`, `IncludeUsers` contain GUIDs (user/group/role IDs) that naturally differ between tenants even when the underlying intent is identical
- The diff view shows all differences — the user judges relevance
- Never automatically suppress a diff; that could hide real configuration issues

**v2 enhancement:** Add a "Resolve GUIDs" toggle that calls Graph APIs (`/users/{id}`, `/groups/{id}`) to replace GUIDs with display names. This would let users distinguish "same intent, different IDs" from "actually different config."

### Q5: Rate limits — detail

- The 20,000 resources/month figure from Nik's blog is a **TCM tenant quota** — it applies to all snapshot activity regardless of whether the call is delegated or application-level
- For a comparison tool used occasionally (a few snapshots per session), this is more than adequate
- Standard Microsoft Graph throttling (HTTP 429 with `Retry-After` header) also applies — `graph.js` should implement retry logic
- TCM-specific API docs are still evolving (some MS Learn URLs return 404), so we should handle unexpected errors gracefully

### Q6: Multi-tenant app registration — detail

A single multi-tenant app registration is the correct approach:

- **App registration:** Set "Supported account types" to *"Accounts in any organizational directory"*
- **Authority:** `https://login.microsoftonline.com/common` — MSAL resolves the tenant at sign-in time
- **Admin consent:** Required on first use per tenant (because `ConfigurationMonitoring.ReadWrite.All` requires admin consent). The first admin from each tenant sees a consent prompt, then all users from that tenant can use the app.
- **No per-customer app registration needed** — the whole point of multi-tenant apps

---

## 8. API Limits (GA, April 2026)

Formally documented limits now that TCM is GA:

| Area | Limit | Notes |
|---|---|---|
| **Snapshots** | 20,000 resources/month/tenant | Cumulative across all snapshot jobs |
| **Snapshot jobs visible** | 12 | Must delete old jobs to create new ones |
| **Snapshot retention** | 7 days | Auto-deleted; download/commit to Git |
| **Monitors** | 30 per tenant | |
| **Monitored resources** | 800/day/tenant | Across all monitors (each runs every 6 hours = 4 cycles/day) |
| **Fixed drifts** | Retained 30 days | Deleted 30 days after resolution |
| **Active drifts** | No expiry | Available until resolved |

---

## 9. Future: Baselines & Monitors

With GA, the baseline/monitor/drift loop is the core TCM value prop. Our
cross-tenant comparison tool could naturally extend to:

1. **Export baseline from snapshot** — Take a source tenant snapshot and
   convert it to a `configurationBaseline` for the destination tenant.
2. **Create monitor on destination** — Continuously compare the destination
   against the source-derived baseline (every 6 hours, automatic).
3. **Surface drift** — Show drifts between the two tenants as they occur,
   not just at manual snapshot time.

This would shift the tool from point-in-time comparison to **continuous
cross-tenant drift monitoring**. Parking for v2.

---

## 10. Milestones

| Phase | What | Deliverable |
|---|---|---|
| **Sprint 0** | App registration + MSAL dual-login working | `auth.js` + `config.js`, two accounts in one session |
| **Sprint 1** | Snapshot management for both tenants | `graph.js` + `ui.js` — create, list, poll, view snapshots per tenant |
| **Sprint 2** | Comparison engine + diff view | `diff.js` — structured diff with added/removed/changed/unchanged |
| **Sprint 3** | Diff export + polish | Download as JSON/HTML, error handling, loading states, responsive layout |
| **Sprint 4** | GitHub Pages deployment + README | Publish to `<org>.github.io/tenant-config-mgmt/`, setup walkthrough |

---

## 11. References

- [TCM Concept Overview](https://learn.microsoft.com/en-us/graph/unified-tenant-configuration-management-concept-overview)
- [TCM API Reference](https://learn.microsoft.com/en-us/graph/api/resources/unified-tenant-configuration-management-api-overview)
- [TCM Authentication Setup](https://learn.microsoft.com/en-us/graph/utcm-authentication-setup)
- [Supported Entra Resources](https://learn.microsoft.com/en-us/graph/utcm-entra-resources)
- [Supported Intune Resources](https://learn.microsoft.com/en-us/graph/utcm-intune-resources)
- [Supported Exchange Resources](https://learn.microsoft.com/en-us/graph/utcm-exchange-resources)
- [Workload Identity Federation](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation)
- [Microsoft365DSC (alternative)](https://github.com/Microsoft365DSC/Microsoft365DSC) — considered, chose TCM for learning goals
- [TCM Schema Store](https://json.schemastore.org/utcm-monitor.json)
- **[TCM GA Announcement (April 2026)](https://techcommunity.microsoft.com/blog/microsoft-entra-blog/tenant-configuration-management-apis-are-now-generally-available/4513157)** — GA blog post confirming all 6 workloads, 200+ settings, v1.0 endpoint
- **[Nik's Blog: Introducing TCM APIs](https://nik-charlebois.com/blog/posts/2026/introducing-tcm-apis/index.html)** — PM walkthrough with real API calls, snapshot/monitor examples, confirmed monitor-only limitation
- **[UTCM Control Panel (GitHub)](https://github.com/microsoft/utcm-controlpanel)** — Reference SPA by Nik Charlebois, single-tenant snapshot/monitor/drift UI, full resource type list
- **[TCM-Utility PowerShell Module](https://github.com/nikcharlebois/tcm-utility)** — Permission discovery and auto-assignment for the TCM service principal

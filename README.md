# Tenant Config Compare

**[Open the app →](https://t3blake.github.io/tenant-config-mgmt/)**

A zero-backend browser app that compares Microsoft 365 tenant configurations side-by-side using the [Tenant Configuration Management (TCM) APIs](https://learn.microsoft.com/en-us/graph/unified-tenant-configuration-management-concept-overview) in Microsoft Graph (v1.0 GA).

All data stays in your browser — no server, no secrets, no telemetry.

## What it does

1. **Sign in** to two Entra ID tenants (source + destination)
2. **Snapshot** workload configurations via TCM APIs
3. **Compare** snapshots with a property-level diff view

## Supported workloads

| Workload | Resource types |
|---|---|
| Entra ID | 36 (Conditional Access, auth methods, groups, cross-tenant access) |
| Exchange Online | 61 (transport rules, connectors, mailbox policies) |
| Teams | 51 (meeting, messaging, calling, federation policies) |
| Intune | 41 (device config, compliance, app management) |
| Security & Compliance | 23 (DLP, retention, sensitivity labels) |

## Getting started

The app walks you through setup on first visit. In short:

1. **Register an Entra ID app** — multi-tenant SPA with `ConfigurationMonitoring.ReadWrite.All` (delegated)
2. **Enter your Client ID** in the app
3. **Provision TCM** in each tenant by running the setup script (`scripts/Setup-TcmPermissions.ps1`)

See [DESIGN.md](DESIGN.md) for the full design document.

## Local development

```bash
npx serve app -l 8080
```

Then open http://localhost:8080/

## License

MIT

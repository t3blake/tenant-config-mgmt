# Tenant Config Mgmt

Promote Microsoft 365 tenant configuration from dev to prod using the
[Tenant Configuration Management (TCM) APIs](https://learn.microsoft.com/en-us/graph/unified-tenant-configuration-management-concept-overview)
in Microsoft Graph, orchestrated by GitHub Actions.

> **Status:** Design phase — see [DESIGN.md](DESIGN.md) for the full design
> document.

## What this does

1. **Export** — Snapshot dev tenant config as JSON via TCM APIs
2. **Compare** — Diff against the blessed config in this repo
3. **Deploy** — Apply approved changes to prod via Microsoft Graph
4. **Monitor** — Detect drift in prod using TCM baselines + monitors

## v1 Scope (all 6 GA workloads)

- Microsoft Entra (Conditional Access, auth methods, groups, cross-tenant)
- Microsoft Intune (device config, compliance policies)
- Microsoft Exchange Online (transport rules, connectors, mailbox policies)
- Microsoft Teams (meeting, messaging, calling, federation policies)
- Microsoft Defender / Purview (DLP, retention, eDiscovery, sensitivity labels)

## Prerequisites

- PowerShell 7+
- Two Microsoft 365 tenants (dev + prod)
- App registrations with federated credentials (see DESIGN.md § 4)
- TCM service principal + M365 Admin Services SP provisioned in both tenants

## Quick Start

> Setup instructions will be added after Sprint 0 spike.

## License

MIT

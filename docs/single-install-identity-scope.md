# Single-Install Identity and Managed Hosting Scope

Status: **Architecture direction / implementation scope.**

Page Builder CMS is a single-site application. Self-hosted users run one CMS installation for one website. The managed product uses the same application image and provisions **one CMS installation per site**. The hosted service's account, billing, provisioning, domain, backup, and upgrade logic belongs in a separate **control plane** that runs **outside the CMS runtime**.

This replaces the obsolete internal multi-site direction. The CMS database does not become tenant-scoped. The CMS does not grow a site picker, tenant memberships, or shared-database site isolation.

## Locked Decisions

| Area | Decision |
|---|---|
| CMS runtime shape | One Bun process serves one public site, one admin UI, one CMS API, one plugin runtime, and one media namespace. |
| Database shape | One CMS installation owns one database. Keep the singleton `site` table. Do not introduce `sites`, `site_id` columns on domain tables, or `user_site_*` tables. |
| Managed hosting shape | The managed service provisions one isolated CMS installation per customer site. Isolation is container/process/database/media-root level, not tenant rows in one CMS database. |
| Control plane boundary | The managed-service control plane owns customer accounts, billing, site catalog, provisioning, domains, TLS, backups, upgrades, and fleet health. It is outside the CMS runtime. |
| CMS awareness | A CMS installation should not need to know whether it is self-hosted or managed. It may expose health/version/bootstrap endpoints, but it does not orchestrate other sites. |
| Plugin model | Plugins run inside one installation and never need tenant-aware APIs. Plugin storage, routes, hooks, settings, and permissions are local to that installation. |

## CMS Identity Model

The CMS needs multiple admin users for collaboration inside one installation. That is not the same thing as multi-site hosting.

Keep identity scoped to the installation:

- `users` are installation-local.
- `roles` are installation-local.
- `sessions` are installation-local.
- audit events are installation-local.
- exactly one active owner remains an installation invariant.

The current single-role model is acceptable until product requirements prove multiple simultaneous roles are needed. If roles are expanded, expand them inside the installation only. Do not add `site_id`, site memberships, or cross-site role assignment tables to the CMS schema.

Frontend member accounts, if added later, are a public-site feature inside one installation. They do not imply managed-service tenancy. Treat them as local website users, not as control-plane customer accounts.

## Managed Service Model

The managed Page Builder product has two layers:

1. **Control plane**: a separate service/database for our business operations. It tracks customers, subscriptions, desired sites, domains, provisioned resources, image versions, backup policies, and upgrade state.
2. **CMS installations**: isolated Page Builder CMS deployments. Each installation has its own database and media storage. Each serves exactly one website.

The control plane may create installations through Docker, a container platform, VMs, or a future orchestration driver. That choice should not leak into the CMS schema.

The control plane can store records such as:

```txt
customer_id
site_id_in_control_plane
cms_base_url
database_resource_id
media_resource_id
container_or_service_id
domain_bindings
current_image_version
desired_image_version
backup_policy
provisioning_status
```

Those fields live outside the CMS runtime. They are not `site_id` columns inside Page Builder CMS.

## CMS-Control Plane Contract

Keep the contract small:

- health check: reports liveness and current image/app version.
- setup/bootstrap: creates the first owner and singleton site during provisioning.
- admin URL: `/admin`.
- public URL: the customer domain routed to the installation.
- optional maintenance actions later: backup trigger, restore import, upgrade readiness, or read-only mode.

The CMS should not call the control plane during normal page rendering or admin editing. Public traffic must continue to work if the control plane is temporarily unavailable.

## Database Policy

This project is pre-release. Local development databases are disposable. If a table or migration is wrong, rewrite it directly and recreate the database.

The clean schema direction is:

- keep `site`, not `sites`;
- keep globally unique page/content/media/plugin records within the installation;
- keep roles and users local to the installation;
- keep plugin records local to the installation;
- avoid tenant-scoped uniqueness such as `(site_id, slug)`.

Forbidden CMS-runtime schema shapes:

```txt
sites
site_id on domain tables
user_site_memberships
user_site_role_assignments
tenant_id
workspace_id for hosted site isolation
```

If the managed product needs those concepts, they belong in the external control plane database.

## What To Build Next

1. Keep the CMS database and repositories single-site.
2. Tighten admin identity inside the installation: owner invariant, roles, sessions, audit, invitations, password reset, optional MFA.
3. Add a separate managed-service control-plane design when we start hosted provisioning.
4. Ensure deployment docs describe managed hosting as isolated installations, not a shared CMS database.
5. Keep architecture tests guarding against CMS-internal multi-site schema returning.

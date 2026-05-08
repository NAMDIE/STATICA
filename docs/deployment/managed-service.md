# Managed Page Builder Service

This document covers the hosted Page Builder product we operate for customers. It is different from deploying the CMS to a third-party managed host such as Railway or Render.

The managed service provisions **one CMS installation per site**. Each installation runs the same Page Builder CMS image used for self-hosting. The service **control plane** runs **outside the CMS runtime** and is responsible for creating, upgrading, routing, backing up, and monitoring those isolated installations.

## Architecture

```txt
Managed service control plane
  - customers and billing
  - site catalog and desired state
  - provisioning jobs
  - domain and TLS ownership
  - image rollout state
  - backup and restore policy
  - fleet health

Isolated CMS installation A
  - Page Builder CMS container/process
  - database A
  - media storage A
  - public domain A

Isolated CMS installation B
  - Page Builder CMS container/process
  - database B
  - media storage B
  - public domain B
```

The CMS database stays single-site. It does not contain tenant rows for other customer sites. The control plane may know about many sites; each CMS installation knows about one.

## Provisioning Flow

1. Customer creates a site in the managed-service control plane.
2. The control plane allocates database and media storage resources for that site.
3. The control plane starts a CMS container or service using the production image.
4. The control plane bootstraps the CMS installation with its initial owner and singleton site.
5. The control plane binds domains and TLS routing to the installation.
6. The CMS serves public and admin traffic without depending on the control plane for normal requests.

## Isolation Rules

- No shared CMS database across customer sites.
- No `site_id` columns inside the CMS schema for hosted isolation.
- No CMS-internal site picker for managed hosting.
- No plugin tenant APIs.
- No cross-site plugin storage.
- No public request path that requires the control plane to answer before the CMS can render the site.

Isolation is achieved through deployment boundaries: process/container, database, media storage, domain routing, and backup scope.

## Control Plane Responsibilities

The control plane owns hosted-product concerns:

- customer accounts and subscriptions;
- billing status and plan limits;
- site provisioning and deletion;
- resource identifiers for databases, media volumes, buckets, and containers;
- domain verification, DNS guidance, and TLS routing;
- image rollout orchestration;
- scheduled backups and restore workflows;
- fleet health, logs, and operational alerts.

These are not CMS runtime responsibilities. A self-hosted user should not carry this complexity.

## CMS Responsibilities

Each CMS installation owns website concerns:

- admin users and roles for that installation;
- site settings;
- pages, content, media, plugins, and published snapshots;
- public rendering;
- plugin runtime;
- health/version reporting for the control plane.

The CMS may expose narrow operational endpoints for bootstrap, health, and future maintenance. Those endpoints must stay installation-local.

## Database Choice

Postgres and SQLite both remain valid per-installation choices.

- Postgres is the default for larger managed sites and high admin concurrency.
- SQLite is viable for small managed sites when paired with durable storage and backup replication.

In either case, the managed service still provisions one database per CMS installation. A single shared CMS database with tenant rows is not the architecture.

## Upgrade Model

The control plane decides target image versions. Each CMS installation runs its own migrations on boot. Because this project is pre-release, we can still rewrite migrations and ask developers to recreate local databases. Once the managed service has real customer data, upgrades must be tested per installation and coordinated by the control plane.

## Failure Boundaries

The control plane can be unavailable while existing CMS installations continue serving public pages and admin sessions. Provisioning, upgrades, domain changes, and billing-gated actions may pause, but normal website traffic should not depend on the control plane.

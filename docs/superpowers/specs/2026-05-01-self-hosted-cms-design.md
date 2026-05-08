# Self-Hosted CMS Design

## Summary

Page Builder will become a single-site, self-hosted CMS with an integrated page builder. The existing editor and document model stay as the foundation. The product will no longer export static HTML or downloadable React projects as its main deployment path. Instead, a Docker Compose stack will run the public website, admin UI, API server, Postgres database, and uploads volume.

The v1 scope is page CMS basics only: pages, drafts, published versions, site settings, media uploads, admin login, and public rendering from published snapshots. Posts, custom collections, forms, expanded roles, and managed-service provisioning are later slices.

## Product Decisions

- V1 is a single-install CMS. The managed service runs one isolated CMS installation per hosted site.
- V1 targets Docker Compose with Postgres.
- One installation serves the public site, admin app, and API.
- Public site lives at `/`.
- Admin page builder lives at `/admin`.
- API routes live under `/api`.
- Media is stored in an uploads volume and served through controlled upload routes.
- Public pages render from published snapshots, never editable drafts.
- V1 has one admin account created during setup.
- The current editor and `Project -> pages -> nodes -> modules -> classes` model are retained.

## Runtime Architecture

The Docker Compose stack has:

- `app`: Bun server for public routes, built admin assets, API routes, auth sessions, and uploaded media.
- `postgres`: durable CMS database.
- `uploads` volume: local file storage for uploaded media.

The existing React/Zustand editor remains the admin page builder. The main change is persistence: `usePersistence` should use a server-backed adapter instead of IndexedDB in CMS mode. Publishing becomes a CMS operation that validates the draft and writes immutable published versions. Public routes read active published snapshots by slug and render them with the module rendering pipeline.

## Data Model

V1 keeps the editor document shape mostly intact inside JSON columns. We should not split every node, prop, class, breakpoint, and module setting into relational tables yet. Postgres adds durability and CMS metadata around the document model without forcing an editor rewrite.

Core tables:

- `site`
  - `id`
  - `name`
  - `settings_json`
  - `created_at`
  - `updated_at`
- `admin_users`
  - `id`
  - `email`
  - `password_hash`
  - `created_at`
- `sessions`
  - `id_hash`
  - `admin_user_id`
  - `expires_at`
  - `created_at`
- `pages`
  - `id`
  - `title`
  - `slug`
  - `status`
  - `draft_document_json`
  - `created_at`
  - `updated_at`
- `page_versions`
  - `id`
  - `page_id`
  - `version`
  - `snapshot_json`
  - `published_at`
  - `published_by`
- `media_assets`
  - `id`
  - `filename`
  - `mime_type`
  - `size`
  - `storage_path`
  - `public_path`
  - `created_at`

Media uploaded through the CMS should become server files referenced by stable `/uploads/...` public paths. V1 should move away from base64 blobs inside `project.files[]` for image and file assets.

## Export Logic

The product should no longer present itself as a static-site or React-project generator.

Remove or retire from the core path:

- Toolbar export dropdown.
- `src/core/react-publisher/*` and its tests.
- `projectMode: 'html' | 'react'`.
- generated Vite/package manifest assumptions from the core CMS path.
- the old Convex/Vercel managed publishing plan.

Keep and repurpose:

- pure module `render()` contracts.
- static HTML page renderer logic, reframed as server/public rendering.
- preview, renamed from export preview to draft/published preview.
- persistence adapter boundary, extended with a server/Postgres adapter.

The old `publisher` area should become a renderer used by the live CMS. Publishing writes database snapshots; rendering turns published snapshots into public HTML.

## Workflows

### Setup And Login

On first boot, the app checks whether an admin user exists.

- If not, `/admin/setup` creates the site name and first admin account.
- If yes, `/admin/login` creates a server-side session.
- Admin session cookies are HttpOnly.
- Session rows are stored server-side.

### Editing

The admin editor loads the draft project through an authenticated API route. The current Zustand store should continue to hydrate through `loadProject()`.

Autosave keeps its current debounced behavior but writes to Postgres through server API routes. Draft preview can remain client-side initially. Server-rendered preview URLs can be added later.

### Publishing

Publishing validates the draft document, checks render support, creates immutable page version rows, and updates the active public version for each slug. Publish runs in a transaction. If it fails, the current public site remains unchanged.

### Public Rendering

Public route handling resolves the requested slug to an active published snapshot. The server renders full HTML with the existing module render pipeline and returns the response. Public routes must never read draft documents or require an admin session.

## Security And Failure Handling

- `/api/admin/*` routes require an authenticated admin session.
- Public routes never expose draft state.
- Passwords are stored as modern password hashes.
- Session cookies are HttpOnly and same-site.
- Uploads validate size, MIME type, filename/path, and storage destination.
- Upload files are stored outside the source tree and served through controlled routes.
- Publish is atomic and leaves the current published site unchanged on failure.
- Unknown or unsupported modules fail publish preflight or render safe placeholders.
- Existing escaping and sanitization behavior in the renderer remains required.

## Testing Strategy

The migration should be covered in layers:

- Database tests for migrations, repositories, publish transactions, and active version lookup.
- API tests for setup, login/logout, draft load/save, media upload, publish, and public page responses.
- Editor tests for the persistence adapter swap, Publish toolbar shortcut, removal of Export UI, and removal of project mode.
- Renderer tests for public HTML rendering from stored snapshots, 404 behavior, and no draft leakage.
- Docker smoke test for boot, setup, edit, publish, and public page view.

## Implementation Slices

1. Server foundation
   - Add Docker Compose, app server layout, Postgres connection, migrations, repositories, setup/login/session routes.
2. Server persistence adapter
   - Add admin project load/save APIs and point the existing editor persistence hook at the server adapter.
3. Publish and public rendering
   - Add publish transaction, active published snapshots, public route resolver, and server HTML rendering.
4. Remove old export path
   - Delete React ZIP publisher, remove project mode and generated-source assumptions, replace Export UI with Publish.
5. Media and polish
   - Move uploads to server storage, update image controls to use media assets, add publish status, rollback/history, and Docker smoke docs.

## Out Of Scope For V1

- Multi-site.
- Multiple CMS users and roles.
- Custom content collections.
- Posts/blog model.
- Form submissions.
- Ecommerce.
- User-owned deployment provider integrations.
- Exporting downloadable React projects as a supported product feature.

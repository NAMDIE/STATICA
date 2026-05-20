/**
 * Dashboard stats endpoint.
 *
 *   GET /admin/api/cms/dashboard/stats
 *
 * Returns the aggregated counters the admin dashboard widgets surface
 * (Pages / Posts / Media). One round-trip per dashboard mount —
 * subsequent widget updates re-fetch via `useDashboardStats`.
 *
 * No filtering / range tabs yet — the dashboard's "Today / 7d / 30d"
 * range affects only the analytics widgets (which live in the plugin's
 * own `/runtime/stats` route). The Pages / Posts / Media counters in
 * this response are point-in-time totals + a fixed "this week" delta.
 */
import type { DbClient } from '../../db/client'
import { requireAuthenticatedUser } from '../../auth/authz'
import { jsonResponse, methodNotAllowed } from '../../http'
import { CMS_API_PREFIX } from './shared'

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface PagesStats {
  total: number
  published: number
  drafts: number
  scheduled: number
  /**
   * How many pages were published in the trailing 7 days. Used by the
   * Pages widget's "+N this week" delta line.
   */
  deltaPublishedThisWeek: number
}

interface PostsStats {
  total: number
  /** Number of `kind: 'postType'` tables. */
  categories: number
  scheduled: number
  /**
   * Daily count of post publishes for the last 28 days, oldest first.
   * Drives the Posts widget's mini bar chart.
   */
  daily28: number[]
}

interface MediaStatsThumb {
  id: string
  publicPath: string
  altText: string
  mimeType: string
  width: number | null
  height: number | null
  variants: Array<{ width: number; height: number; format: string; path: string }>
}

interface MediaStats {
  count: number
  totalBytes: number
  /**
   * Up to 16 most-recently-uploaded image assets, each with the
   * variant ladder so the dashboard `<Image>` primitive can build a
   * srcset for the mosaic thumbnails.
   */
  latestThumbs: MediaStatsThumb[]
}

/**
 * Per-plugin row returned to the dashboard. Mirrors `InstalledPlugin`
 * but trimmed to the fields the Plugins widget actually renders —
 * manifest/permissions/settings stay server-side so the payload is small.
 */
interface PluginsStatsRow {
  id: string
  name: string
  version: string
  /**
   * Coarse health state for the widget's status dot. Computed
   * server-side from `enabled` + `lifecycle_status` so the widget
   * doesn't need to know the matrix.
   */
  state: 'active' | 'disabled' | 'error'
}

interface PluginsStats {
  total: number
  active: number
  disabled: number
  errored: number
  /** Up to 8 most-recently-installed plugin rows, newest first. */
  rows: PluginsStatsRow[]
}

/**
 * A single row in the "Publish lineup" widget. Surfaces what's coming
 * up (scheduled), what just shipped (published), and the drafts the
 * operator is still working on.
 *
 *   • `path` — public route ("/blog/sandbox-deep-dive") derived from
 *     the row's table.route_base + row.slug. Falls back to
 *     `/${tableId}/${slug}` when route_base is missing.
 *
 *   • `at` — ISO datetime relevant to the status:
 *       - 'scheduled' → scheduled_publish_at (future)
 *       - 'published' → published_at (past)
 *       - 'draft'     → null
 *
 *   The widget formats this client-side relative to "now" so the labels
 *   say "in 12m" / "2h ago" without the server having to know the
 *   user's clock.
 */
interface PublishLineupRow {
  id: string
  path: string
  status: 'scheduled' | 'published' | 'draft'
  at: string | null
}

interface PublishLineupStats {
  rows: PublishLineupRow[]
}

export interface DashboardStats {
  pages: PagesStats
  posts: PostsStats
  media: MediaStats
  plugins: PluginsStats
  publishLineup: PublishLineupStats
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

/**
 * Group counts of `data_rows.status` for a single table. Returns
 * {draft, published, scheduled, total} so the handler can derive
 * everything from one round-trip per table.
 */
async function readStatusCounts(
  db: DbClient,
  tableId: string,
): Promise<{ total: number; published: number; drafts: number; scheduled: number }> {
  const { rows } = await db<{ status: string; count: number | string }>`
    select status, count(*) as count
    from data_rows
    where table_id = ${tableId}
      and deleted_at is null
    group by status
  `
  let published = 0
  let drafts = 0
  let scheduled = 0
  for (const r of rows) {
    const n = typeof r.count === 'string' ? parseInt(r.count, 10) : r.count
    if (r.status === 'published') published += n
    else if (r.status === 'draft') drafts += n
    else if (r.status === 'scheduled') scheduled += n
  }
  return {
    total: published + drafts + scheduled,
    published,
    drafts,
    scheduled,
  }
}

/**
 * Count `data_rows` whose `published_at` lies in the trailing 7 days,
 * for one table. Used by the Pages widget's "+N this week" delta.
 */
async function readPublishedSinceCount(
  db: DbClient,
  tableId: string,
  sinceIso: string,
): Promise<number> {
  const { rows } = await db<{ count: number | string }>`
    select count(*) as count
    from data_rows
    where table_id = ${tableId}
      and deleted_at is null
      and status = 'published'
      and published_at is not null
      and published_at >= ${sinceIso}
  `
  const c = rows[0]?.count ?? 0
  return typeof c === 'string' ? parseInt(c, 10) : c
}

/**
 * 28-day publish histogram across ALL post-type tables. Groups by the
 * date portion of `published_at` (interpreted in UTC). The handler
 * post-processes the rows into a dense [28]-array so the front-end can
 * render bars without conditional gaps.
 */
async function readPostsHistogram(
  db: DbClient,
  postTypeTableIds: readonly string[],
  sinceIso: string,
): Promise<Map<string, number>> {
  if (postTypeTableIds.length === 0) return new Map()
  // ANSI-SQL date truncation: `substr(published_at::text, 1, 10)` keeps
  // it dialect-naive (Postgres `::text` cast is forbidden by
  // architecture gate db-postgres-isms; SQLite stores timestamps as
  // strings already). We rely on the fact that BOTH dialects emit
  // ISO-prefix strings from `published_at` when concatenated. The
  // approach: pull every published row in the window (cardinality is
  // bounded by the trailing-28-day window times the table count) and
  // bin client-side.
  const { rows } = await db<{ table_id: string; published_at: string | Date }>`
    select table_id, published_at
    from data_rows
    where deleted_at is null
      and status = 'published'
      and published_at is not null
      and published_at >= ${sinceIso}
  `
  const counts = new Map<string, number>()
  const postTypeSet = new Set(postTypeTableIds)
  for (const r of rows) {
    if (!postTypeSet.has(r.table_id)) continue
    const iso = typeof r.published_at === 'string'
      ? r.published_at
      : r.published_at.toISOString()
    const day = iso.slice(0, 10)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return counts
}

/**
 * Aggregated plugin stats for the Plugins dashboard widget.
 *
 *   • total       — every non-deleted installed plugin row
 *   • active      — rows with enabled=true AND lifecycle_status='active'
 *   • disabled    — rows with enabled=false OR lifecycle_status='disabled'
 *   • errored     — rows with lifecycle_status='error' (problem state)
 *   • rows        — up to 8 most-recently-installed plugins (id/name/
 *                   version/state) for the widget's body list
 *
 * `state` collapses `enabled` × `lifecycle_status` into a single value
 * the widget can dot-color directly. `'installed'` lifecycle rows show
 * as `'disabled'` for the widget (not yet activated).
 */
async function readPluginsStats(db: DbClient): Promise<PluginsStats> {
  const { rows } = await db<{
    id: string
    name: string
    version: string
    enabled: boolean | number
    lifecycle_status: string
  }>`
    select id, name, version, enabled, lifecycle_status
    from installed_plugins
    order by installed_at desc
  `

  let active = 0
  let disabled = 0
  let errored = 0
  const out: PluginsStatsRow[] = []

  for (const r of rows) {
    // SQLite returns integer booleans (0/1); PG returns boolean.
    const isEnabled = r.enabled === true || r.enabled === 1
    const lifecycle = r.lifecycle_status
    const state: PluginsStatsRow['state'] =
      lifecycle === 'error'
        ? 'error'
        : isEnabled && lifecycle === 'active'
          ? 'active'
          : 'disabled'

    if (state === 'active') active += 1
    else if (state === 'error') errored += 1
    else disabled += 1

    // Cap the per-row payload at the 8 most recent; the counts above
    // include every plugin so the widget can show "12 plugins · 3
    // disabled" alongside the truncated list.
    if (out.length < 8) {
      out.push({ id: r.id, name: r.name, version: r.version, state })
    }
  }

  return {
    total: rows.length,
    active,
    disabled,
    errored,
    rows: out,
  }
}

/**
 * Pull the rows that fill the dashboard "Publish lineup" widget.
 *
 *   • Up to 3 upcoming scheduled rows, soonest-first
 *   • Up to 2 recently-published rows, newest-first
 *   • Up to 2 drafts, most-recently-touched first
 *
 * Joined to `data_tables` so we can render the row's public path
 * (`route_base + slug`) — matches what the user sees in the editor.
 * Three separate queries (not one UNION) because:
 *   1. ANSI SQL UNION with mixed ORDER BY is dialect-painful, and
 *   2. The three slices have different sort keys, which a UNION would
 *      force into a single composite key.
 *
 * Combined and ordered client-side: scheduled rows (chronological,
 * soonest first) → published rows (newest first) → drafts. Same order
 * the original mocked widget used so the visual rhythm is preserved.
 */
async function readPublishLineup(db: DbClient): Promise<PublishLineupStats> {
  const scheduledRowsLimit = 3
  const publishedRowsLimit = 2
  const draftRowsLimit = 2

  type LineupRow = {
    id: string
    slug: string
    table_id: string
    route_base: string | null
    scheduled_publish_at: string | Date | null
    published_at: string | Date | null
  }

  // Upcoming scheduled — soonest first.
  const { rows: scheduledRows } = await db<LineupRow>`
    select r.id,
           r.slug,
           r.table_id,
           t.route_base,
           r.scheduled_publish_at,
           r.published_at
    from data_rows r
    join data_tables t on t.id = r.table_id
    where r.deleted_at is null
      and r.status = 'scheduled'
      and r.scheduled_publish_at is not null
    order by r.scheduled_publish_at asc
    limit ${scheduledRowsLimit}
  `

  // Recently published — newest first.
  const { rows: publishedRows } = await db<LineupRow>`
    select r.id,
           r.slug,
           r.table_id,
           t.route_base,
           r.scheduled_publish_at,
           r.published_at
    from data_rows r
    join data_tables t on t.id = r.table_id
    where r.deleted_at is null
      and r.status = 'published'
      and r.published_at is not null
    order by r.published_at desc
    limit ${publishedRowsLimit}
  `

  // Drafts — most-recently-touched first. We don't list the entire
  // backlog; the widget is a snapshot, not the Content workspace.
  const { rows: draftRows } = await db<LineupRow>`
    select r.id,
           r.slug,
           r.table_id,
           t.route_base,
           r.scheduled_publish_at,
           r.published_at
    from data_rows r
    join data_tables t on t.id = r.table_id
    where r.deleted_at is null
      and r.status = 'draft'
    order by r.updated_at desc
    limit ${draftRowsLimit}
  `

  function makePath(routeBase: string | null, tableId: string, slug: string): string {
    const safeSlug = slug || '(no slug)'
    const base = routeBase && routeBase.trim().length > 0 ? routeBase : `/${tableId}`
    const normalizedBase = base.startsWith('/') ? base : `/${base}`
    const trimmedBase = normalizedBase.endsWith('/') ? normalizedBase.slice(0, -1) : normalizedBase
    return `${trimmedBase}/${safeSlug}`
  }

  function toIsoOrNull(value: string | Date | null): string | null {
    if (value === null) return null
    return typeof value === 'string' ? value : value.toISOString()
  }

  const rows: PublishLineupRow[] = [
    ...scheduledRows.map((r): PublishLineupRow => ({
      id: r.id,
      path: makePath(r.route_base, r.table_id, r.slug),
      status: 'scheduled',
      at: toIsoOrNull(r.scheduled_publish_at),
    })),
    ...publishedRows.map((r): PublishLineupRow => ({
      id: r.id,
      path: makePath(r.route_base, r.table_id, r.slug),
      status: 'published',
      at: toIsoOrNull(r.published_at),
    })),
    ...draftRows.map((r): PublishLineupRow => ({
      id: r.id,
      path: makePath(r.route_base, r.table_id, r.slug),
      status: 'draft',
      at: null,
    })),
  ]

  return { rows }
}

/**
 * 16 most-recent image-type media assets. The dashboard widget renders
 * them as a thumbnail mosaic via the shared `<Image>` primitive,
 * which builds a srcset from the variant ladder.
 */
async function readLatestImageThumbs(db: DbClient, limit: number): Promise<MediaStatsThumb[]> {
  const { rows } = await db<{
    id: string
    public_path: string
    alt_text: string | null
    mime_type: string
    width: number | null
    height: number | null
    variants_json: unknown
  }>`
    select id, public_path, alt_text, mime_type, width, height, variants_json
    from media_assets
    where deleted_at is null
      and mime_type like 'image/%'
    order by created_at desc
    limit ${limit}
  `
  return rows.map((r) => ({
    id: r.id,
    publicPath: r.public_path,
    altText: r.alt_text ?? '',
    mimeType: r.mime_type,
    width: r.width,
    height: r.height,
    variants: Array.isArray(r.variants_json)
      ? r.variants_json
          .filter((v): v is { width: number; height: number; format: string; path: string } => {
            if (!v || typeof v !== 'object') return false
            const x = v as Record<string, unknown>
            return (
              typeof x.width === 'number' &&
              typeof x.height === 'number' &&
              typeof x.format === 'string' &&
              typeof x.path === 'string'
            )
          })
          .map((v) => ({ width: v.width, height: v.height, format: v.format, path: v.path }))
      : [],
  }))
}

// ---------------------------------------------------------------------------
// Top-level reader
// ---------------------------------------------------------------------------

async function readDashboardStats(db: DbClient): Promise<DashboardStats> {
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twentyEightDaysAgoIso = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()

  // Pages stats — table_id 'pages' is the system pages table.
  const pagesCounts = await readStatusCounts(db, 'pages')
  const pagesDelta = await readPublishedSinceCount(db, 'pages', sevenDaysAgoIso)

  // Posts stats — every table with kind='postType'.
  const { rows: postTypeRows } = await db<{ id: string }>`
    select id
    from data_tables
    where kind = 'postType'
      and deleted_at is null
  `
  const postTypeIds = postTypeRows.map((r) => r.id)
  let postsTotal = 0
  let postsScheduled = 0
  for (const id of postTypeIds) {
    const c = await readStatusCounts(db, id)
    postsTotal += c.total
    postsScheduled += c.scheduled
  }
  const histogram = await readPostsHistogram(db, postTypeIds, twentyEightDaysAgoIso)
  // Densify into [28] oldest-first.
  const daily28 = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(Date.now() - (27 - i) * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    return histogram.get(key) ?? 0
  })

  // Plugins stats — total + counts by state + the 8 most-recently-installed
  // rows for the widget's body list.
  const plugins = await readPluginsStats(db)

  // Publish lineup — upcoming scheduled rows + recent publishes + drafts.
  const publishLineup = await readPublishLineup(db)

  // Media stats — total count + bytes, plus 16 latest image thumbs.
  const { rows: mediaTotals } = await db<{ count: number | string; bytes: number | string | null }>`
    select count(*) as count, coalesce(sum(size_bytes), 0) as bytes
    from media_assets
    where deleted_at is null
  `
  const mediaCount = typeof mediaTotals[0]?.count === 'string'
    ? parseInt(mediaTotals[0].count, 10)
    : mediaTotals[0]?.count ?? 0
  const mediaBytes = mediaTotals[0]?.bytes === null || mediaTotals[0]?.bytes === undefined
    ? 0
    : typeof mediaTotals[0].bytes === 'string'
      ? parseInt(mediaTotals[0].bytes, 10)
      : mediaTotals[0].bytes
  const latestThumbs = await readLatestImageThumbs(db, 16)

  return {
    pages: {
      total: pagesCounts.total,
      published: pagesCounts.published,
      drafts: pagesCounts.drafts,
      scheduled: pagesCounts.scheduled,
      deltaPublishedThisWeek: pagesDelta,
    },
    posts: {
      total: postsTotal,
      categories: postTypeIds.length,
      scheduled: postsScheduled,
      daily28,
    },
    media: {
      count: mediaCount,
      totalBytes: mediaBytes,
      latestThumbs,
    },
    plugins,
    publishLineup,
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function handleDashboardRoutes(
  req: Request,
  db: DbClient,
): Promise<Response | null> {
  const url = new URL(req.url)
  if (url.pathname !== `${CMS_API_PREFIX}/dashboard/stats`) return null
  if (req.method !== 'GET') return methodNotAllowed()

  // Any authenticated admin user can read dashboard stats. The
  // dashboard widgets are visible to anyone with admin-app access; we
  // don't gate behind a specific capability (the underlying counts are
  // already non-sensitive — total counts, no row content).
  const user = await requireAuthenticatedUser(req, db)
  if (user instanceof Response) return user

  const stats = await readDashboardStats(db)
  return jsonResponse(stats)
}

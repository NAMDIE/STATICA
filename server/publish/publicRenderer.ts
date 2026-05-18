import '../../src/modules/base'
import '@core/loops/sources'
import { registry } from '@core/module-engine/registry'
import { publishPage } from '@core/publisher/render'
import { buildRouteFrame } from '@core/templates/contextFrames'
import { buildSiteCssBundle } from './siteCssBundle'
import { selectEntryTemplate } from '@core/templates/templateMatching'
import { prefetchLoopData, publishedDataRowToLoopItem } from './loopPrefetch'
import { prefetchMediaAssets } from './mediaPrefetch'
import type { PublishedDataRow } from '@core/data/schemas'
import type { DbClient } from '../db/client'
import type { PublishedPageSnapshot } from '../repositories/publish'
import { hookBus } from '@core/plugins/hookBus'
import { collectFrontendInjections } from './frontendInjections'

/**
 * URL prefix where the Bun server exposes the per-site CSS bundle. Mirrors
 * `/_pb/assets/` for runtime scripts. The matching route is registered in
 * `server/router.ts` and serves files with `Cache-Control: immutable`.
 */
const CSS_ASSET_BASE_URL = '/_pb/css/'

/** URL prefix for the loop data endpoint serving infinite-load fragments. */
const LOOP_ENDPOINT_BASE_URL = '/_pb/loop/'

export interface RenderPublishedSnapshotContext {
  db: DbClient
  /** Optional request URL — when present, drives per-loop pagination. */
  url?: URL
}

export async function renderPublishedSnapshot(
  snapshot: PublishedPageSnapshot,
  ctx: RenderPublishedSnapshotContext,
): Promise<string> {
  const page = snapshot.site.pages.find((candidate) => candidate.id === snapshot.pageId)
  if (!page) throw new Error(`Published page "${snapshot.pageId}" not found in snapshot`)
  await hookBus.emit('publish.before', { siteId: snapshot.site.id, pageId: snapshot.pageId })
  const cssBundle = buildSiteCssBundle(snapshot.site, registry)
  // Both pre-fetches run in parallel — neither depends on the other and
  // both hit the DB independently.
  const [loopData, mediaAssets] = await Promise.all([
    prefetchLoopData(page, snapshot.site, ctx.db, ctx.url),
    prefetchMediaAssets(page, registry, ctx.db),
  ])
  const baseHtml = publishPage(page, snapshot.site, registry, {
    runtimeAssets: snapshot.runtimeAssets,
    cssEmission: 'external',
    cssBundle,
    cssAssetBaseUrl: CSS_ASSET_BASE_URL,
    loopData,
    mediaAssets,
    loopEndpointBaseUrl: LOOP_ENDPOINT_BASE_URL,
    // Seed route frame from the actual request URL (when available) so
    // `{route.slug}` / `{route.path}` bindings resolve to live values.
    // publishPage falls back to the page permalink if no templateContext
    // is provided.
    templateContext: ctx.url
      ? { entryStack: [], route: buildRouteFrame(ctx.url.toString()) }
      : undefined,
  }).html
  const withInjections = injectFrontendAssets(baseHtml, await collectFrontendInjections(ctx.db))
  const filtered = await hookBus.applyFilter('publish.html', withInjections)
  await hookBus.emit('publish.after', { siteId: snapshot.site.id, pageId: snapshot.pageId })
  return filtered
}

export async function renderPublishedDataRowTemplate(
  snapshot: PublishedPageSnapshot,
  row: PublishedDataRow,
  ctx: RenderPublishedSnapshotContext,
): Promise<string | null> {
  const template = selectEntryTemplate(snapshot.site, row.tableSlug)
  if (!template) return null

  await hookBus.emit('publish.before', { siteId: snapshot.site.id, pageId: template.id })
  const cssBundle = buildSiteCssBundle(snapshot.site, registry)
  const [loopData, mediaAssets] = await Promise.all([
    prefetchLoopData(template, snapshot.site, ctx.db, ctx.url),
    prefetchMediaAssets(template, registry, ctx.db),
  ])
  const baseHtml = publishPage(template, snapshot.site, registry, {
    // Seed the entry stack with the published row + route frame from
    // the request URL. Loop interceptors push/pop iteration items on
    // top of this stack; nodes outside any loop resolve their
    // `currentEntry` bindings against this seed. page/site/viewer
    // frames are filled by `publishPage` from the document.
    templateContext: {
      entryStack: [publishedDataRowToLoopItem(row)],
      ...(ctx.url ? { route: buildRouteFrame(ctx.url.toString()) } : {}),
    },
    runtimeAssets: snapshot.runtimeAssets,
    cssEmission: 'external',
    cssBundle,
    cssAssetBaseUrl: CSS_ASSET_BASE_URL,
    loopData,
    mediaAssets,
    loopEndpointBaseUrl: LOOP_ENDPOINT_BASE_URL,
  }).html
  const withInjections = injectFrontendAssets(baseHtml, await collectFrontendInjections(ctx.db))
  const filtered = await hookBus.applyFilter('publish.html', withInjections)
  await hookBus.emit('publish.after', { siteId: snapshot.site.id, pageId: template.id })
  return filtered
}

/**
 * Inject `<script>` and `<link>` tags supplied by `frontend.scripts` /
 * `frontend.tracker` plugins. Tags are placed just before `</body>` so they
 * don't block layout. If the document has no `</body>` (defensive), tags
 * are appended.
 *
 * When any body tags are injected, also relax the publisher CSP so the
 * inline tracker runtime + plugin script tags can actually execute. The
 * publisher emits `script-src 'none'` for pages with no first-party
 * runtime scripts; plugin injections override that to `'self' 'unsafe-inline'`.
 */
function injectFrontendAssets(
  html: string,
  injections: { headTags: string[]; bodyTags: string[] },
): string {
  let next = html
  if (injections.headTags.length > 0) {
    const headTag = injections.headTags.join('\n')
    next = next.includes('</head>')
      ? next.replace('</head>', `${headTag}\n</head>`)
      : `${headTag}\n${next}`
  }
  if (injections.bodyTags.length > 0) {
    const bodyTag = injections.bodyTags.join('\n')
    next = next.includes('</body>')
      ? next.replace('</body>', `${bodyTag}\n</body>`)
      : `${next}\n${bodyTag}`
    next = relaxCspForFrontendPlugins(next)
  }
  return next
}

const CSP_META_PATTERN = /<meta http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*\/?>/i

function relaxCspForFrontendPlugins(html: string): string {
  return html.replace(CSP_META_PATTERN, (full, content: string) => {
    let next = content
    next = next.replace(/script-src [^;]*;/i, `script-src 'self' 'unsafe-inline';`)
    next = next.replace(/worker-src [^;]*;/i, `worker-src 'self' blob:;`)
    return full.replace(content, next)
  })
}

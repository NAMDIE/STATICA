/**
 * Standalone document renderer for published data rows.
 *
 * Used as a fallback when no page template is configured for a data row's
 * table. Generates a complete HTML document from the row's cells, rendering
 * the `body` cell (post-type markdown) to HTML and surfacing the post-type
 * built-in fields (title, seoTitle, seoDescription, featuredMediaPath) as
 * document metadata.
 *
 * Token interpolation: cells (title, seoTitle, seoDescription, body) may
 * contain `{currentEntry.field}` tokens. The renderer builds a minimal
 * render context with the row pushed onto the entry stack so authors can
 * embed dynamic values directly in their post text.
 *
 * For data-kind tables without post-type built-ins, the document renders
 * with a generic "Untitled" heading and an empty body — callers should
 * prefer always configuring a page template for public-facing tables.
 */

import { renderMarkdownToHtml } from '@core/markdown/renderMarkdown'
import type { PublishedDataRow } from '@core/data/schemas'
import type { SiteDocument } from '@core/page-tree/schemas'
import { readStringCell } from '@core/data/cells'
import { escapeHtml, safeUrl } from '@core/publisher/utils'
import {
  containsTokens,
  interpolateTokens,
} from '@core/templates/tokenInterpolation'
import type { TemplateRenderDataContext } from '@core/templates/dynamicBindings'
import {
  buildRouteFrame,
  buildSiteFrame,
  type PageFrame,
} from '@core/templates/contextFrames'
import { publishedDataRowToLoopItem } from './loopPrefetch'

export function renderDataRowDocumentHtml(
  row: PublishedDataRow,
  options: { site?: SiteDocument; url?: URL | string } = {},
): string {
  const cells = row.cells

  // Synthesize a `page` frame from the row itself. There's no real Page
  // object here — this is the fallback document — so we map the row's
  // identity to the same fields the editor's binding picker advertises
  // for the page source. That way `{page.title}` / `{page.permalink}`
  // resolve to sensible values when authors embed tokens in a post body.
  const rowTitle = readStringCell(cells, 'title') || 'Untitled'
  const permalink = `${row.tableRouteBase || `/${row.tableSlug}`}/${row.slug}`.replace(/\/+/g, '/')
  const pageFrame: PageFrame = {
    id: row.rowId,
    slug: row.slug,
    title: rowTitle,
    permalink,
    isTemplate: false,
    templateTableSlug: null,
    parentSlug: null,
  }

  const context: TemplateRenderDataContext = {
    entryStack: [publishedDataRowToLoopItem(row)],
    page: pageFrame,
    site: options.site ? buildSiteFrame(options.site) : undefined,
    viewer: null,
    route: buildRouteFrame(
      options.url
        ? typeof options.url === 'string' ? options.url : options.url.toString()
        : permalink,
    ),
  }
  const expand = (value: string): string =>
    containsTokens(value) ? interpolateTokens(value, context) : value

  const title = escapeHtml(expand(rowTitle))
  const seoTitle = escapeHtml(
    expand(readStringCell(cells, 'seoTitle') || rowTitle),
  )
  const seoDescription = escapeHtml(expand(readStringCell(cells, 'seoDescription') || ''))
  const bodyMarkdown = expand(readStringCell(cells, 'body'))
  const bodyHtml = renderMarkdownToHtml(bodyMarkdown)
  const featuredMedia = row.featuredMediaPath
    ? `<img class="featured-media" src="${safeUrl(row.featuredMediaPath)}" alt="" loading="lazy">`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${seoTitle}</title>
  ${seoDescription ? `<meta name="description" content="${seoDescription}">` : ''}
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; background: #f7f7f5; color: #141414; }
    main { width: min(760px, calc(100vw - 40px)); margin: 0 auto; padding: 72px 0 96px; }
    h1 { margin: 0 0 24px; font-size: clamp(40px, 7vw, 72px); line-height: .95; letter-spacing: 0; }
    .featured-media { display: block; width: 100%; margin: 0 0 32px; border-radius: 8px; object-fit: cover; }
    article { font-size: 18px; line-height: 1.72; }
    article h1, article h2, article h3 { margin: 1.5em 0 .5em; line-height: 1.15; letter-spacing: 0; }
    article h1 { font-size: 40px; }
    article h2 { font-size: 30px; }
    article h3 { font-size: 24px; }
    article p { margin: 0 0 1.1em; }
    article a { color: #3346d3; }
    article img, article video { display: block; max-width: 100%; height: auto; margin: 28px 0; border-radius: 8px; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    ${featuredMedia}
    <article>${bodyHtml}</article>
  </main>
</body>
</html>`
}

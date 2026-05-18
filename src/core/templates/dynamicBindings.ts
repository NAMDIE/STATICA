/**
 * Dynamic prop binding — resolves runtime values from the publisher's
 * entry stack into a node's static props at render time.
 *
 * The stack semantics are the heart of how templates compose with loops:
 *  - The publisher seeds the stack with the page's primary entry when
 *    rendering a single-entry content template.
 *  - The `base.loop` renderer pushes each iteration's item onto the stack
 *    before recursing into the loop's child subtree, then pops on exit.
 *  - `dynamicBindings.source: 'currentEntry'` always reads the stack top,
 *    i.e. "the closest enclosing entity". Inside a loop nested in a
 *    template, that's the loop iteration; outside the loop it's still
 *    the template entry.
 *  - `dynamicBindings.source: 'parentEntry'` reads one frame below the
 *    top — useful inside a loop nested in a template, where you want to
 *    refer to the outer template entry from inside an iteration.
 *
 * Field lookup is generic: each `LoopItem` carries a `fields` map, and
 * the resolver simply reads `fields[binding.field]`. Format coercions
 * (e.g. markdown → HTML for body bindings with `format: 'html'`) happen
 * here as a thin shim so already-persisted bindings keep working without
 * the source needing to pre-render every variant.
 */

import type { DynamicPropBinding } from '@core/page-tree'
import type { LoopItem } from '@core/loops/types'
import type { DataField, DataTable } from '@core/data/schemas'
import { renderMarkdownToHtml } from '@core/markdown/renderMarkdown'
import type {
  PageFrame,
  SiteFrame,
  ViewerFrame,
  RouteFrame,
} from './contextFrames'
import {
  containsTokens,
  interpolateTokens,
  readFrame,
  walkFieldPath,
} from './tokenInterpolation'

// ---------------------------------------------------------------------------
// Field-type filters for binding pickers
//
// Each module type can only meaningfully bind certain field types. These
// filters are used by the Properties Panel's binding picker to narrow the
// list of offered fields to only those that are semantically compatible.
// ---------------------------------------------------------------------------

/** Field types that supply meaningful values for image/media slots. */
const MEDIA_FIELD_TYPES: ReadonlySet<DataField['type']> = new Set(['media'])

/** Field types that supply meaningful values for text content slots. */
const TEXT_FIELD_TYPES: ReadonlySet<DataField['type']> = new Set([
  'text', 'longText', 'richText', 'url', 'email',
])

/** Field types that supply meaningful values for rich-text / markdown slots. */
const RICH_TEXT_FIELD_TYPES: ReadonlySet<DataField['type']> = new Set([
  'text', 'longText', 'richText',
])

/** Field types that supply meaningful values for URL slots. */
const URL_FIELD_TYPES: ReadonlySet<DataField['type']> = new Set(['url', 'text'])

/** Field types that supply meaningful values for numeric slots. */
const NUMBER_FIELD_TYPES: ReadonlySet<DataField['type']> = new Set(['number'])

/** All field types — no filter applied. */
const ANY_FIELD_TYPES: ReadonlySet<DataField['type']> = new Set([
  'text', 'longText', 'richText', 'url', 'email',
  'number', 'boolean', 'date', 'dateTime',
  'select', 'multiSelect', 'media', 'relation',
])

/**
 * Hint supplied by the module rendering the binding picker. Each hint maps
 * to the subset of `DataField` types that can provide a useful value.
 */
export type BindingModuleHint = 'image' | 'media' | 'text' | 'richText' | 'url' | 'number' | 'any'

const FIELD_TYPES_BY_HINT: Record<BindingModuleHint, ReadonlySet<DataField['type']>> = {
  image: MEDIA_FIELD_TYPES,
  media: MEDIA_FIELD_TYPES,
  text: TEXT_FIELD_TYPES,
  richText: RICH_TEXT_FIELD_TYPES,
  url: URL_FIELD_TYPES,
  number: NUMBER_FIELD_TYPES,
  any: ANY_FIELD_TYPES,
}

/**
 * Return the subset of a table's fields that can supply values for the given
 * module hint. Pass `'any'` (the default) to receive all fields unfiltered.
 *
 * Used by the Properties Panel binding picker so only semantically compatible
 * fields are shown for each prop slot:
 *   - image module  → `'image'` → only `media` fields
 *   - text module   → `'text'`  → `text`, `longText`, `richText`, `url`, `email`
 *   - etc.
 */
export function getBindableFields(
  table: DataTable,
  hint: BindingModuleHint = 'any',
): DataField[] {
  const allowed = FIELD_TYPES_BY_HINT[hint]
  return table.fields.filter((field) => allowed.has(field.type))
}

/**
 * Render-time context handed to the publisher.
 *
 * `entryStack` is mutated in place by the publisher's loop interceptor
 * (push on iteration enter, pop on iteration exit). Stack-top resolves
 * `source: 'currentEntry'`; one below resolves `source: 'parentEntry'`.
 *
 * The four named frames (`page`, `site`, `viewer`, `route`) are always
 * provided on every render — they're built once by the publisher and
 * referenced by the corresponding binding sources. Anonymous renders
 * pass `viewer: null`; bindings against null frames resolve to empty.
 *
 * Frames are stable references across the whole render pass; the loop
 * interceptor only mutates `entryStack`. This keeps the resolver
 * branchless for the common case (frame lookup is a property read).
 */
export interface TemplateRenderDataContext {
  entryStack: LoopItem[]
  page?: PageFrame
  site?: SiteFrame
  viewer?: ViewerFrame | null
  route?: RouteFrame
}

/**
 * Resolve a single binding to its runtime value.
 *
 * Dispatch by source:
 *   - `currentEntry` / `parentEntry` — read from the entry stack
 *     (top / second-from-top).
 *   - `page` / `site` / `viewer` / `route` — read from the corresponding
 *     named frame on the context.
 *
 * Returns `undefined` for fields that don't exist on the resolved frame
 * (or when the requested frame doesn't exist) — the caller decides
 * whether to fall back to the static prop or substitute an empty value.
 *
 * Field paths are dotted (`author.name`, `parent.slug`). The first
 * segment opens against the frame; subsequent segments walk plain
 * objects via `walkFieldPath`. Multi-segment paths against `currentEntry`
 * are how relation traversal will be wired (Phase 6) — until that lands,
 * only the first segment is meaningful for relations, which matches
 * legacy single-segment binding semantics.
 *
 * `readFrame` / `walkFieldPath` are shared with the token interpolator
 * — both live in `./tokenInterpolation.ts` to avoid duplication.
 */
function resolveBindingValue(
  binding: DynamicPropBinding,
  context: TemplateRenderDataContext,
): unknown {
  const frame = readFrame(binding.source, context)
  if (!frame) return undefined

  const value = walkFieldPath(frame, binding.field)

  // Markdown shim: when a binding targets the `body` cell (post-type rows)
  // or any `richText` field stored as markdown and the binding requests
  // `format: 'html'`, render markdown to HTML here so the module receives
  // ready-to-embed HTML rather than raw markdown. Tokens embedded inside
  // the body markdown are interpolated FIRST so authors can write
  // `Hello {viewer.displayName|guest}` directly in a blog post body and
  // have it resolve against the same render context as page props.
  if (
    binding.format === 'html' &&
    typeof value === 'string' &&
    (binding.field === 'body' || binding.field === 'bodyMarkdown')
  ) {
    const interpolated = containsTokens(value) ? interpolateTokens(value, context) : value
    return renderMarkdownToHtml(interpolated)
  }

  return value
}

export function resolveDynamicProps(
  staticProps: Record<string, unknown>,
  bindings: Record<string, DynamicPropBinding> | undefined,
  context: TemplateRenderDataContext | undefined,
): Record<string, unknown> {
  if (!context) {
    // No render context — still pass through static props. Tokens inside
    // strings need a context to resolve, so they're left untouched.
    return staticProps
  }

  // Step 1: legacy single-binding overrides (for non-string props, this
  // is the only way a prop gets a dynamic value).
  let resolved: Record<string, unknown> | null = null
  if (bindings) {
    resolved = { ...staticProps }
    for (const [propKey, binding] of Object.entries(bindings)) {
      const value = resolveBindingValue(binding, context)
      if (value === undefined || value === null) {
        if (binding.fallback === 'empty') resolved[propKey] = ''
        continue
      }
      resolved[propKey] = value
    }
  }

  // Step 2: token interpolation for every string-typed prop value. Both
  // the original static props and any string overwritten by step 1 are
  // re-examined — a binding result might itself contain tokens
  // (uncommon but well-defined). The fast path inside
  // `interpolateTokens` skips work for strings with no token markers.
  const target = resolved ?? staticProps
  let mutated = resolved !== null
  for (const key of Object.keys(target)) {
    const v = target[key]
    if (typeof v !== 'string') continue
    if (!containsTokens(v)) continue
    if (!mutated) {
      resolved = { ...staticProps }
      mutated = true
    }
    resolved![key] = interpolateTokens(v, context)
  }

  return resolved ?? staticProps
}

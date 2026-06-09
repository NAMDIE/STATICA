/**
 * scopeClasses — per-page class scoping for multi-stylesheet imports.
 *
 * ## The problem
 *
 * A multi-page site export ships one stylesheet per page, and those stylesheets
 * routinely reuse the SAME class name with DIFFERENT declarations — e.g.
 * `index.html`'s `instatic.css` defines `.btn { border-radius: 0 }` while
 * `original.html`'s `style.css` defines `.btn { border-radius: 999px }`.
 *
 * The CMS has ONE global class registry. Naively merging every stylesheet's
 * classes by name means one page's `.btn` silently overwrites the other's, so
 * the loser renders with the wrong styles. This is exactly the bug that made
 * imported buttons round + lose their uppercase and the hero collapse.
 *
 * ## The fix — scope colliding classes per stylesheet
 *
 * For each class NAME, we group the per-file definitions by their *content*
 * (base `styles` + `contextStyles`):
 *   - one distinct definition  → keep the bare name; the class is shared.
 *   - N distinct definitions   → the first keeps the bare name, the rest get a
 *     numeric suffix (`btn`, `btn-2`, `btn-3`). Files that share a definition
 *     share its scoped name.
 *
 * A rename is then applied CONSISTENTLY within each source stylesheet:
 *   1. the `kind:'class'` rule's `name` + `selector`,
 *   2. every `kind:'ambient'` selector in that file that references the class
 *      as a token (`.btn-solid:hover`, `.btn.btn-lg`, `.plan-cta .btn`), and
 *   3. the `classIds` (class-name tokens) on the nodes of every page that links
 *      that stylesheet.
 *
 * The result: every page renders with exactly the class definitions from its
 * own stylesheet, and pages whose definitions are identical still share one
 * class — no needless duplication.
 *
 * ## Limitation
 *
 * Pure element / attribute selectors (`body`, `h1`, `a:hover`) carry no class
 * token, so they cannot be scoped — they remain global and the last definition
 * in cascade order wins on every page. Class-based selectors (the overwhelming
 * majority of a design system's surface) are fully scoped.
 *
 * Bootstrap-like scaffold / utility names (`row`, `col-xl-3`, `d-flex`,
 * `align-items-stretch`, …) are the exception. Their behaviour is intentionally
 * assembled from many small rules and combinators (`.row`, `.row > *`,
 * `.col-*`) across one or more stylesheets. Splitting those names by content
 * makes the HTML point at one fragment while the layout declarations land on
 * another. Those shared utility names stay global.
 */

import { classKindSelector } from '@core/page-tree'
import type { PagePlan, NewStyleRule } from './types'
import type { CssFileResult } from './assetPlan'

export interface ScopeClassesResult {
  pagePlans: PagePlan[]
  cssFileResults: CssFileResult[]
  /** Class names that were scoped (renamed) to preserve per-page fidelity. */
  renames: Array<{ originalName: string; scopedName: string; cssPath: string }>
}

const BOOTSTRAP_BREAKPOINT_RE = '(?:sm|md|lg|xl|xxl)'
const BOOTSTRAP_SIZE_RE = '(?:0|1|2|3|4|5|auto)'
const BOOTSTRAP_GRID_SPAN_RE = '(?:auto|[1-9]|1[0-2])'
const BOOTSTRAP_SIDE_RE = '(?:t|b|s|e|x|y)'

const SHARED_UTILITY_CLASS_PATTERNS = [
  /^container(?:-(?:sm|md|lg|xl|xxl|fluid))?$/,
  /^row(?:-cols(?:-(?:sm|md|lg|xl|xxl))?-(?:auto|[1-6]))?$/,
  new RegExp(`^col(?:-${BOOTSTRAP_GRID_SPAN_RE}|-${BOOTSTRAP_BREAKPOINT_RE}(?:-${BOOTSTRAP_GRID_SPAN_RE})?)?$`),
  new RegExp(`^offset(?:-${BOOTSTRAP_BREAKPOINT_RE})?-(?:[0-9]|1[0-1])$`),
  new RegExp(`^order(?:-${BOOTSTRAP_BREAKPOINT_RE})?-(?:first|last|[0-5])$`),
  new RegExp(`^(?:g|gx|gy)(?:-${BOOTSTRAP_BREAKPOINT_RE})?-${BOOTSTRAP_SIZE_RE}$`),
  new RegExp(`^(?:m|p)${BOOTSTRAP_SIDE_RE}?(?:-${BOOTSTRAP_BREAKPOINT_RE})?-${BOOTSTRAP_SIZE_RE}$`),
  new RegExp('^d(?:-(?:sm|md|lg|xl|xxl))?-(?:none|inline|inline-block|block|grid|table|table-row|table-cell|flex|inline-flex)$'),
  new RegExp('^flex(?:-(?:sm|md|lg|xl|xxl))?-(?:row|column|row-reverse|column-reverse|wrap|nowrap|wrap-reverse|fill|grow-0|grow-1|shrink-0|shrink-1)$'),
  new RegExp('^justify-content(?:-(?:sm|md|lg|xl|xxl))?-(?:start|end|center|between|around|evenly)$'),
  new RegExp('^align-(?:items|content|self)(?:-(?:sm|md|lg|xl|xxl))?-(?:start|end|center|baseline|stretch)$'),
  /^position-(?:static|relative|absolute|fixed|sticky)$/,
  /^(?:top|bottom|start|end)-(?:0|50|100)$/,
  /^translate-middle(?:-[xy])?$/,
  /^[wh]-(?:25|50|75|100|auto)$/,
  /^mw-100$/,
  /^mh-100$/,
  /^min-vw-100$/,
  /^min-vh-100$/,
  /^vw-100$/,
  /^vh-100$/,
]

/**
 * Class names from Bootstrap's shared layout / utility vocabulary must remain
 * global. They are not component classes: their intended behaviour often spans
 * multiple rules and selectors, so per-stylesheet scoping can split a single
 * grid contract into unrelated names (`row-3`, `row-4`, …).
 */
export function isSharedUtilityClassName(name: string): boolean {
  return SHARED_UTILITY_CLASS_PATTERNS.some((pattern) => pattern.test(name))
}

/**
 * Resolve cross-stylesheet class-name collisions by scoping divergent
 * definitions per source stylesheet. Pure: returns new arrays, never mutates
 * the inputs.
 */
export function scopeCollidingClasses(
  pagePlans: PagePlan[],
  cssFileResults: CssFileResult[],
): ScopeClassesResult {
  // ── 1. Catalogue every class-kind definition, in first-encounter order ──────
  // name → ordered list of { cssPath, contentKey } as they appear across files.
  const defsByName = new Map<string, Array<{ cssPath: string; contentKey: string }>>()
  const allClassNames = new Set<string>()

  for (const { cssPath, rules } of cssFileResults) {
    for (const rule of rules) {
      if (rule.kind !== 'class') continue
      allClassNames.add(rule.name)
      const key = contentKey(rule)
      let list = defsByName.get(rule.name)
      if (!list) {
        list = []
        defsByName.set(rule.name, list)
      }
      list.push({ cssPath, contentKey: key })
    }
  }

  // ── 2. Assign a final name to each distinct definition of each class ────────
  // name → (contentKey → finalName). The first distinct definition keeps the
  // bare name; subsequent ones get the next free numeric suffix.
  const usedNames = new Set(allClassNames)
  const finalNameByNameAndKey = new Map<string, Map<string, string>>()

  for (const [name, defs] of defsByName) {
    const keyToFinal = new Map<string, string>()
    if (isSharedUtilityClassName(name)) {
      for (const { contentKey: key } of defs) keyToFinal.set(key, name)
      finalNameByNameAndKey.set(name, keyToFinal)
      continue
    }
    for (const { contentKey: key } of defs) {
      if (keyToFinal.has(key)) continue
      if (keyToFinal.size === 0) {
        keyToFinal.set(key, name) // first distinct def keeps the bare name
      } else {
        keyToFinal.set(key, nextFreeName(name, usedNames))
      }
    }
    finalNameByNameAndKey.set(name, keyToFinal)
  }

  // ── 3. Per-file map: original class name → final name (for THAT file's def) ──
  // Covers every class-kind def, including unchanged ones, so page-token
  // resolution can pick the file that actually owns the token.
  const fileClassFinal = new Map<string, Map<string, string>>()
  const renames: ScopeClassesResult['renames'] = []

  for (const { cssPath, rules } of cssFileResults) {
    const map = new Map<string, string>()
    for (const rule of rules) {
      if (rule.kind !== 'class') continue
      const final = finalNameByNameAndKey.get(rule.name)?.get(contentKey(rule)) ?? rule.name
      map.set(rule.name, final)
      if (final !== rule.name) {
        renames.push({ originalName: rule.name, scopedName: final, cssPath })
      }
    }
    fileClassFinal.set(cssPath, map)
  }

  // Fast exit: nothing collided, return inputs untouched.
  if (renames.length === 0) {
    return { pagePlans, cssFileResults, renames }
  }

  // ── 4. Rewrite each file's rules (class names + ambient selector tokens) ────
  const scopedCssFileResults: CssFileResult[] = cssFileResults.map((file) => {
    const map = fileClassFinal.get(file.cssPath)!
    const rules = file.rules.map((rule) => rewriteRule(rule, map))
    return { ...file, rules }
  })

  // ── 5. Rewrite class-name tokens on every page's nodes ──────────────────────
  const scopedPagePlans: PagePlan[] = pagePlans.map((plan) =>
    rewritePageTokens(plan, fileClassFinal),
  )

  return { pagePlans: scopedPagePlans, cssFileResults: scopedCssFileResults, renames }
}

// ---------------------------------------------------------------------------
// Rule rewriting
// ---------------------------------------------------------------------------

/**
 * Rewrite one rule using a file's `original → final` class-name map.
 * - class-kind: rename `name` + `selector` when its final differs.
 * - ambient:    rename every class token in the selector that the file renamed;
 *   the display `name` (which defaults to the selector text) follows.
 */
function rewriteRule(rule: NewStyleRule, map: Map<string, string>): NewStyleRule {
  if (rule.kind === 'class') {
    const final = map.get(rule.name)
    if (!final || final === rule.name) return rule
    return { ...rule, name: final, selector: classKindSelector(final) }
  }
  // ambient — rewrite class tokens referenced in the selector.
  const newSelector = rewriteSelectorClasses(rule.selector, map)
  if (newSelector === rule.selector) return rule
  // Ambient display names default to the selector text; keep them in sync when
  // the original name WAS the selector (the importer's default).
  const newName = rule.name === rule.selector ? newSelector : rule.name
  return { ...rule, selector: newSelector, name: newName }
}

/** A class token in a selector: a `.` followed by a CSS identifier. */
const SELECTOR_CLASS_TOKEN_RE = /\.(-?[A-Za-z_][\w-]*)/g

/**
 * Replace every `.token` in a selector whose `token` the file renamed.
 * Leaves untouched: class tokens the file didn't rename, element names,
 * pseudo-classes/elements, attribute selectors, combinators.
 */
function rewriteSelectorClasses(selector: string, map: Map<string, string>): string {
  return selector.replace(SELECTOR_CLASS_TOKEN_RE, (whole, token: string) => {
    const final = map.get(token)
    return final && final !== token ? `.${final}` : whole
  })
}

// ---------------------------------------------------------------------------
// Page-token rewriting
// ---------------------------------------------------------------------------

/**
 * Rewrite the class-name tokens on every node of a page. For each token, the
 * owning stylesheet is the LAST of the page's linked CSS files that defines it
 * (cascade winner); that file's final name replaces the token.
 */
function rewritePageTokens(
  plan: PagePlan,
  fileClassFinal: Map<string, Map<string, string>>,
): PagePlan {
  // Resolve a token to its scoped name for this page (or itself if unscoped).
  const resolve = (token: string): string => {
    let final = token
    for (const cssPath of plan.linkedCssPaths) {
      const mapped = fileClassFinal.get(cssPath)?.get(token)
      if (mapped !== undefined) final = mapped // later link wins (cascade)
    }
    return final
  }

  let touched = false
  const nodes: typeof plan.nodeFragment.nodes = {}
  for (const [id, node] of Object.entries(plan.nodeFragment.nodes)) {
    const classIds = node.classIds
    if (!classIds || classIds.length === 0) {
      nodes[id] = node
      continue
    }
    const rewritten = dedupe(classIds.map(resolve))
    if (sameOrder(rewritten, classIds)) {
      nodes[id] = node
      continue
    }
    touched = true
    nodes[id] = { ...node, classIds: rewritten }
  }

  const bodyClassIds = plan.nodeFragment.body?.classIds
  let body = plan.nodeFragment.body
  if (bodyClassIds?.length) {
    const rewritten = dedupe(bodyClassIds.map(resolve))
    if (!sameOrder(rewritten, bodyClassIds)) {
      touched = true
      body = { ...body, classIds: rewritten }
    }
  }

  if (!touched) return plan
  return { ...plan, nodeFragment: { ...plan.nodeFragment, nodes, ...(body ? { body } : {}) } }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A stable content fingerprint for a class rule: its base styles plus every
 * per-context override bag, with object keys sorted so declaration order can't
 * make two identical rules look different.
 */
function contentKey(rule: NewStyleRule): string {
  return stableStringify({ styles: rule.styles ?? {}, contextStyles: rule.contextStyles ?? {} })
}

/** Deterministic JSON with sorted object keys (arrays keep their order). */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/** First `name-2`, `name-3`, … not already taken; reserves the result. */
function nextFreeName(name: string, used: Set<string>): string {
  let n = 2
  let candidate = `${name}-${n}`
  while (used.has(candidate)) {
    n += 1
    candidate = `${name}-${n}`
  }
  used.add(candidate)
  return candidate
}

/** Remove duplicate strings, preserving first-seen order. */
function dedupe(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    if (seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out
}

/** Whether two string arrays are identical in length and order. */
function sameOrder(a: string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

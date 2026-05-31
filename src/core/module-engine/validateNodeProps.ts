/**
 * Publisher prop coercion — soft boundary, never throws.
 *
 * `validateNodeProps` is the single call site that closes the module-props
 * boundary leak: authored props coming from the database can be stale,
 * missing, or lightly malformed. Running them through `Value.Parse`
 * (Default + Convert + Clean + Check) normalises them to the schema's
 * declared shape before they reach the module's pure `render()`.
 *
 * Design constraints:
 *   - SOFT boundary — exceptions from coercion are caught; never bubbles.
 *   - Unknown/injected keys survive — merge is `{ ...rawProps, ...cleaned }`
 *     so publisher-injected fields (`_resolvedMediaByKey`, `_resolvedAutoSizes`)
 *     that arrive on rawProps are never stripped.
 *   - Pass-through when no schema — modules without `propsSchema` are
 *     unaffected; the function is a no-op for them.
 */

import { parseValue } from '@core/utils/typeboxHelpers'
import type { AnyModuleDefinition } from './types'

/**
 * Coerce and default-fill `rawProps` against `def.propsSchema`.
 *
 * Behaviour:
 *   - No schema → return `rawProps` unchanged.
 *   - Schema present, coercion succeeds → `{ ...rawProps, ...cleanedProps }`.
 *     Known props are coerced/defaulted by Value.Parse; unknown keys from
 *     rawProps survive untouched.
 *   - Schema present, coercion fails → `{ ...rawProps, ...def.defaults }`.
 *     Falls back to module defaults for known keys, unknown keys still survive.
 */
export function validateNodeProps(
  def: AnyModuleDefinition,
  rawProps: Record<string, unknown>,
): Record<string, unknown> {
  if (!def.propsSchema) return rawProps

  try {
    // parseValue = Value.Parse: Default + Convert + Clean + Check.
    // Clean strips unknown keys from the result, so `cleaned` contains only
    // schema-known props. The spread merge below restores everything else.
    const cleaned = parseValue(def.propsSchema, rawProps) as Record<string, unknown>
    return { ...rawProps, ...cleaned }
  } catch (_err) {
    // Value.Parse threw — the input is unrecoverable for this schema even
    // after applying defaults and type coercions. Fall back to the module's
    // declared defaults, while still preserving any injected unknown keys.
    return { ...rawProps, ...def.defaults }
  }
}

/**
 * Unit tests for validateNodeProps — the soft publisher-boundary coercion helper.
 *
 * Covers:
 *   (a) Junk / missing authored props coerce to module defaults via the schema.
 *   (b) Unknown injected fields (e.g. _resolvedMediaByKey) survive validation.
 *   (c) A module with no propsSchema returns rawProps unchanged (pass-through).
 */

import { describe, it, expect } from 'bun:test'
import { Type, Value } from '@core/utils/typeboxHelpers'
import type { AnyModuleDefinition } from '@core/module-engine/types'
import { validateNodeProps } from '@core/module-engine'
import { SquareSolidIcon } from 'pixel-art-icons/icons/square-solid'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stubDef(
  overrides: Partial<AnyModuleDefinition> = {},
): AnyModuleDefinition {
  return {
    id: 'test.stub',
    name: 'Stub',
    category: 'Test',
    version: '1.0.0',
    icon: SquareSolidIcon,
    trusted: true,
    canHaveChildren: false,
    schema: {},
    defaults: {},
    component: (() => null) as never,
    render: () => ({ html: '' }),
    ...overrides,
  }
}

// A minimal schema with per-field defaults for testing coercion.
const TestPropsSchema = Type.Object({
  text: Type.String({ default: 'Hello' }),
  count: Type.Number({ default: 42 }),
  visible: Type.Boolean({ default: true }),
})

const testDefaults = Value.Create(TestPropsSchema) as Record<string, unknown>

// ---------------------------------------------------------------------------
// (a) Missing / junk props coerce to schema defaults
// ---------------------------------------------------------------------------

describe('validateNodeProps — (a) coerce to schema defaults', () => {
  const def = stubDef({
    propsSchema: TestPropsSchema,
    defaults: testDefaults,
  })

  it('fills in missing props with schema defaults (empty rawProps)', () => {
    const result = validateNodeProps(def, {})
    expect(result.text).toBe('Hello')
    expect(result.count).toBe(42)
    expect(result.visible).toBe(true)
  })

  it('coerces a string number to a number when the schema declares number', () => {
    // Value.Convert turns "7" → 7 for a Type.Number field.
    const result = validateNodeProps(def, { count: '7' })
    expect(result.count).toBe(7)
  })

  it('preserves a correctly typed authored value (no coercion needed)', () => {
    const result = validateNodeProps(def, { text: 'World', count: 99, visible: false })
    expect(result.text).toBe('World')
    expect(result.count).toBe(99)
    expect(result.visible).toBe(false)
  })

  it('falls back to module defaults when coercion fails catastrophically', () => {
    // Provide a deeply invalid value that Value.Parse cannot recover.
    // We force a failure by using a schema whose type can't be coerced.
    const strictSchema = Type.Object({
      id: Type.String({ pattern: '^[a-z]+$', default: 'fallback' }),
    })
    const strictDef = stubDef({
      propsSchema: strictSchema,
      defaults: { id: 'fallback' },
    })
    // "123" fails the /^[a-z]+$/ pattern — coercion cannot fix it.
    const result = validateNodeProps(strictDef, { id: '123' })
    // Should fall back to defaults
    expect(result.id).toBe('fallback')
  })
})

// ---------------------------------------------------------------------------
// (b) Unknown injected fields survive validation
// ---------------------------------------------------------------------------

describe('validateNodeProps — (b) injected unknown fields survive', () => {
  const def = stubDef({
    propsSchema: TestPropsSchema,
    defaults: testDefaults,
  })

  it('preserves _resolvedMediaByKey on rawProps', () => {
    const injected = { propKey: { url: 'https://cdn.example.com/img.jpg' } }
    const result = validateNodeProps(def, { _resolvedMediaByKey: injected })
    expect(result._resolvedMediaByKey).toBe(injected)
  })

  it('preserves _resolvedAutoSizes on rawProps', () => {
    const result = validateNodeProps(def, { _resolvedAutoSizes: '(max-width: 800px) 100vw' })
    expect(result._resolvedAutoSizes).toBe('(max-width: 800px) 100vw')
  })

  it('preserves multiple unknown injected fields simultaneously', () => {
    const mediaByKey = { img: { url: 'https://example.com/a.jpg' } }
    const rawProps = {
      text: 'Hi',
      _resolvedMediaByKey: mediaByKey,
      _resolvedAutoSizes: '100vw',
      _customInjected: 'stays',
    }
    const result = validateNodeProps(def, rawProps)
    expect(result._resolvedMediaByKey).toBe(mediaByKey)
    expect(result._resolvedAutoSizes).toBe('100vw')
    expect(result._customInjected).toBe('stays')
    expect(result.text).toBe('Hi')
  })

  it('coerced schema props override rawProps while unknowns are preserved', () => {
    const rawProps = {
      count: '5',                  // will be coerced to 5
      _unknownField: 'preserved',  // must survive
    }
    const result = validateNodeProps(def, rawProps)
    expect(result.count).toBe(5)
    expect(result._unknownField).toBe('preserved')
  })
})

// ---------------------------------------------------------------------------
// (c) Module with no propsSchema — pass-through
// ---------------------------------------------------------------------------

describe('validateNodeProps — (c) no propsSchema is a pass-through', () => {
  it('returns rawProps reference-identical when propsSchema is absent', () => {
    const def = stubDef() // no propsSchema
    const rawProps = { text: 'hello', count: 1, _injected: true }
    const result = validateNodeProps(def, rawProps)
    // Should be the exact same object — no copy
    expect(result).toBe(rawProps)
  })

  it('returns rawProps unchanged even when they would fail a hypothetical schema', () => {
    const def = stubDef({ defaults: { text: 'default' } })
    const rawProps = { text: 123, garbage: true }
    const result = validateNodeProps(def, rawProps)
    expect(result).toStrictEqual({ text: 123, garbage: true })
  })
})

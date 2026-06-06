/**
 * Publisher richtext sanitization tests.
 *
 * Phase 5 requirement: escapeProps() applies sanitizeRichtext() at the publisher
 * boundary as defense-in-depth so that corrupted or injected richtext values
 * cannot reach published HTML as executable scripts.
 *
 * These tests exercise the publisher pipeline directly (not via VCs).
 */

import { describe, it, expect } from 'bun:test'
import { escapeProps, publishPage, renderNode } from '@core/publisher'
import { makeModule, makeRegistry, makePage, makeSite, makeAccumulators } from './helpers'

// ---------------------------------------------------------------------------
// escapeProps richtext sanitization
// ---------------------------------------------------------------------------

describe('escapeProps richtext sanitization', () => {
  it('strips <script> from html prop', () => {
    const result = escapeProps({ html: '<p>ok</p><script>bad()</script>' })
    expect(result.html as string).not.toContain('<script>')
    expect(result.html as string).not.toContain('bad()')
  })

  it('strips <script> from richtext prop', () => {
    const result = escapeProps({ richtext: '<p>safe</p><script>evil()</script>' })
    expect(result.richtext as string).not.toContain('<script>')
    expect(result.richtext as string).not.toContain('evil()')
  })

  it('strips <script> from bodyHtml prop (suffix match)', () => {
    const result = escapeProps({ bodyHtml: '<p>text</p><script>x()</script>' })
    expect(result.bodyHtml as string).not.toContain('<script>')
  })

  it('preserves safe HTML tags in richtext props', () => {
    // DOMPurify in happy-dom test environment preserves safe semantic tags
    const result = escapeProps({ html: '<p><strong>Bold</strong></p>' })
    expect(result.html as string).toContain('Bold')
    expect(result.html as string).not.toContain('<script>')
  })

  it('returns empty string for empty richtext prop', () => {
    const result = escapeProps({ html: '' })
    expect(result.html).toBe('')
  })
})

// ---------------------------------------------------------------------------
// publishPage richtext sanitization — end-to-end through the publisher
// ---------------------------------------------------------------------------

describe('publishPage richtext sanitization (Constraint #368)', () => {
  const site = makeSite()

  // content module: prop key is 'html' — a richtext key
  const contentModule = makeModule('test.content', {
    render: (props) => {
      const html = typeof props.html === 'string' ? props.html : ''
      return { html: `<article>${html}</article>` }
    },
  })
  const registry = makeRegistry({ 'test.content': contentModule })

  it('<script> in html prop is stripped from published HTML', () => {
    const page = makePage({
      root: {
        moduleId: 'test.content',
        props: { html: '<p>Safe content</p><script>alert(1)</script>' },
      },
    })
    const { html } = publishPage(page, site, registry)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert(1)')
  })

  it('safe content in html prop is preserved after sanitization', () => {
    const page = makePage({
      root: {
        moduleId: 'test.content',
        props: { html: '<p>Safe content</p><script>alert(1)</script>' },
      },
    })
    const { html } = publishPage(page, site, registry)
    // Safe text content survives regardless of whether DOMPurify preserves <p>
    expect(html).toContain('Safe content')
  })

  it('renderNode: richtext prop is sanitized before reaching render()', () => {
    // Verify at the renderNode level that the module's render() receives
    // sanitized props — not the raw HTML with <script>
    let receivedHtml = ''
    const spyModule = makeModule('spy.content', {
      render: (props) => {
        receivedHtml = typeof props.html === 'string' ? props.html : ''
        return { html: receivedHtml }
      },
    })
    const spyRegistry = makeRegistry({ 'spy.content': spyModule })
    const page = makePage({
      root: {
        moduleId: 'spy.content',
        props: { html: '<p>ok</p><script>bad()</script>' },
      },
    })
    renderNode(
      'root',
      { page, site, registry: spyRegistry, breakpointId: undefined },
      makeAccumulators(),
    )
    // The module's render() must never see the raw <script>
    expect(receivedHtml).not.toContain('<script>')
  })
})

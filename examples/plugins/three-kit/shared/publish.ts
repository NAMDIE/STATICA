/**
 * Build the data-only HTML each Three.js module renders.
 *
 * No inline `<script>` blocks. The plugin's `frontend/threekit.ts` bundle
 * runs once per page, scans for `[data-threekit-type]` elements, and boots
 * one Three.js scene per match. That gives us:
 *
 *   - One `<canvas>` per module instance, no per-instance scripts
 *   - ONE Three.js instance per page regardless of how many modules sit on
 *     it, resolved via the page's `<script type="importmap">`
 *   - Strict-CSP compatibility: published pages keep `script-src 'self'`,
 *     because the frontend bundle is served from the plugin's
 *     `assetBasePath` and the importmap-resolved deps are served from
 *     `/_pb/runtime/cache/...` — both same-origin.
 */
import { html } from '@core/plugin-sdk'

export type StageAspect = 'square' | 'wide' | 'ultrawide' | 'portrait' | 'banner'

interface StageRenderOptions {
  /** Module kind — drives which init code path the frontend runtime picks. */
  type: 'scene' | 'particles' | 'text' | 'model-viewer'
  aspect: StageAspect
  /** Plain JSON object handed to the frontend runtime. Stringified into a data attribute. */
  options: Record<string, unknown>
}

function encodeOptionsAttribute(value: Record<string, unknown>): string {
  // Embed as a JSON string in the attribute value. The `html` tag escapes
  // it for HTML context, and the frontend runtime parses it with JSON.parse.
  return JSON.stringify(value)
}

export function buildStageHtml(options: StageRenderOptions): string {
  return html`
    <div
      class="threekit-stage"
      data-aspect="${options.aspect}"
      data-threekit-type="${options.type}"
      data-threekit-options="${encodeOptionsAttribute(options.options)}"
    >
      <canvas aria-hidden="true"></canvas>
    </div>
  `
}

interface HeroRenderOptions {
  eyebrow: string
  title: string
  body: string
  options: Record<string, unknown>
}

export function buildHeroHtml(opts: HeroRenderOptions): string {
  return html`
    <section
      class="threekit-hero"
      data-threekit-type="hero-background"
      data-threekit-options="${encodeOptionsAttribute(opts.options)}"
    >
      <canvas aria-hidden="true"></canvas>
      <div class="threekit-hero__content">
        <span class="threekit-hero__eyebrow">${opts.eyebrow}</span>
        <h1 class="threekit-hero__title">${opts.title}</h1>
        <p class="threekit-hero__body">${opts.body}</p>
      </div>
    </section>
  `
}

/**
 * Markup used in the editor canvas preview. Same shape as the published
 * output — `dangerouslySetInnerHTML` skips scripts but the data attributes
 * survive. The frontend runtime won't be loaded in the editor canvas, so
 * the user sees an empty styled stage. Live previews still come from the
 * iframe-backed `editorRuntime.sandbox`.
 */
export function editorPlaceholderHtml(aspect: StageAspect): string {
  return html`
    <div class="threekit-stage threekit-stage--editor-empty" data-aspect="${aspect}"></div>
  `
}

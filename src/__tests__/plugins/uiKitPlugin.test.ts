/**
 * Smoke test for the UI Kit example plugin.
 *
 * The kit ships only declarative content (canvas modules + a Visual
 * Component / page / class pack). It must:
 *   - Validate against the canonical manifest schema.
 *   - Have a pack file the host can parse without lifecycle errors.
 *   - Use namespaced ids for every Visual Component, page, module, and
 *     class so install is idempotent and conflict-free.
 */
import { describe, expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePluginManifest } from '@core/plugins/manifest'
import { parsePluginPack } from '../../../server/plugins/pack'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const root = join(repoRoot, 'examples', 'plugins', 'ui-kit')

describe('UI Kit plugin', () => {
  it('parses against the canonical manifest schema', async () => {
    const raw = JSON.parse(await readFile(join(root, 'plugin.json'), 'utf-8'))
    const manifest = parsePluginManifest(raw)
    expect(manifest.id).toBe('acme.ui-kit')
    expect(manifest.permissions.sort()).toEqual(['modules.register', 'visualComponents.register'].sort())
    expect(manifest.entrypoints?.modules).toBe('modules/index.js')
    expect(manifest.pack?.path).toBe('pack/site.json')
    expect(manifest.adminPages).toEqual([])
    expect(manifest.resources).toEqual([])
  })

  it('parses its pack file successfully and uses namespaced ids', async () => {
    const raw = JSON.parse(await readFile(join(root, 'pack/site.json'), 'utf-8'))
    const pack = parsePluginPack('acme.ui-kit', raw)
    expect(pack.visualComponents.length).toBeGreaterThanOrEqual(3)
    expect(pack.classes.length).toBeGreaterThanOrEqual(8)
    expect(pack.pages.length).toBeGreaterThanOrEqual(1)

    for (const vc of pack.visualComponents) {
      expect(vc.id.startsWith('acme.ui-kit/')).toBe(true)
    }
    for (const cls of pack.classes) {
      expect(cls.id.startsWith('acme.ui-kit/')).toBe(true)
    }
  })

  it('module pack default-exports modules with namespaced ids', async () => {
    const text = await readFile(join(root, 'modules/index.js'), 'utf-8')
    expect(text).toMatch(/export default/)
    expect(text).toContain('feature-card')
    expect(text).toContain('pricing-tier')
    expect(text).toContain('testimonial')
    expect(text).toContain('stat')
  })
})

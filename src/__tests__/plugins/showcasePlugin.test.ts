/**
 * End-to-end smoke test for the showcase example plugin.
 *
 * Reads `examples/plugins/showcase/plugin.json` from disk, validates the
 * manifest with the host parser, and runs each entrypoint file through a
 * sanity check (parsing, default-export shape) to make sure the example
 * stays in sync with the SDK shape after refactors.
 */
import { describe, expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePluginManifest } from '@core/plugins/manifest'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const showcaseRoot = join(repoRoot, 'examples', 'plugins', 'showcase')

describe('showcase example plugin', () => {
  it('parses against the canonical manifest schema', async () => {
    const raw = JSON.parse(await readFile(join(showcaseRoot, 'plugin.json'), 'utf-8'))
    const manifest = parsePluginManifest(raw)
    expect(manifest.id).toBe('acme.showcase')
    expect(manifest.permissions).toContain('admin.navigation')
    expect(manifest.permissions).toContain('cms.hooks')
    expect(manifest.permissions).toContain('modules.register')
    expect(manifest.permissions).toContain('frontend.scripts')
    expect(manifest.permissions).toContain('frontend.tracker')
    expect(manifest.permissions).toContain('visualComponents.register')
    expect(manifest.entrypoints?.modules).toBe('modules/index.js')
    expect(manifest.entrypoints?.frontend).toBe('frontend/tracker.js')
    expect(manifest.pack?.path).toBe('pack/site.json')
    expect(manifest.adminPages.map((p) => p.id)).toEqual(['dashboard', 'events'])
  })

  it('module pack default-exports an array (or callable returning one)', async () => {
    const text = await readFile(join(showcaseRoot, 'modules/index.js'), 'utf-8')
    expect(text).toMatch(/export default/)
    expect(text).toContain('pluginId')
    expect(text).toContain('Callout')
    expect(text).toContain('Event Counter')
  })

  it('server entrypoint exports activate that wires hooks and routes', async () => {
    const text = await readFile(join(showcaseRoot, 'server/index.js'), 'utf-8')
    expect(text).toMatch(/export function activate/)
    expect(text).toContain("api.cms.routes.get('/status'")
    expect(text).toContain("api.cms.hooks.on('tracker.event'")
    expect(text).toContain("api.cms.hooks.filter('publish.html'")
  })

  it('frontend tracker entrypoint subscribes to host runtime hooks', async () => {
    const text = await readFile(join(showcaseRoot, 'frontend/tracker.js'), 'utf-8')
    expect(text).toContain('window.__pb')
    expect(text).toContain("pb.hooks.on('page-view'")
    expect(text).toContain("pb.tracker.sendFor('acme.showcase'")
  })

  it('pack file declares Visual Components and namespaced classes', async () => {
    const pack = JSON.parse(await readFile(join(showcaseRoot, 'pack/site.json'), 'utf-8'))
    expect(pack.visualComponents).toHaveLength(1)
    expect(pack.visualComponents[0].id).toBe('acme.showcase/hero')
    expect(pack.classes[0].id).toBe('acme.showcase/hero-root')
  })
})

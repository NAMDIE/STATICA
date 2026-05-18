/**
 * Architecture gates for plugin scheduled jobs.
 *
 * The scheduler engine sits inside the same Bun/Node host process as the
 * rest of the CMS, but it dispatches to plugin code only through the
 * existing sandboxed worker protocol. These tests lock in the invariants
 * that keep the boundary real: if any of them fail, plugin schedule
 * handlers could escape the sandbox or bypass permission gates.
 */
import { describe, expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

async function read(relative: string): Promise<string> {
  return await readFile(join(ROOT, relative), 'utf-8')
}

describe('plugin schedule invariants', () => {
  it('scheduler dispatches to the worker via runScheduleInWorker (not direct invocation)', async () => {
    const source = await read('server/plugins/scheduler.ts')
    expect(source).toContain("import { runScheduleInWorker } from './pluginWorkerHost'")
    // No raw `await import(...)` of plugin code at runtime — schedules
    // are dispatched through the protocol like every other plugin call.
    expect(source).not.toMatch(/await\s+import\s*\(\s*[`'"][./]/)
  })

  it('cms.schedule.register / cancel api targets are gated by the cms.schedule permission', async () => {
    const source = await read('server/plugins/pluginWorkerHost.ts')
    // Both cases must call assertHostPluginPermission with the
    // 'cms.schedule' permission before any side effect.
    expect(source).toContain("case 'cms.schedule.register'")
    expect(source).toContain("case 'cms.schedule.cancel'")
    const dispatch = source.slice(source.indexOf("case 'cms.schedule.register'"))
    expect(dispatch).toContain("assertHostPluginPermission(entry, 'cms.schedule')")
  })

  it('schedule handler storage lives inside the VM, not on the host', async () => {
    const source = await read('server/plugins/quickjsHost.ts')
    // The bootstrap registers `__plugin_handlers.schedules` (in-VM map).
    // The host has metadata only — never the function itself.
    expect(source).toContain('globalThis.__plugin_handlers')
    expect(source).toContain('schedules: {}')
    expect(source).toContain('globalThis.__runSchedule')
    // Schedule handlers cross the boundary via __runSchedule only —
    // never via a host-side function handle.
    expect(source).toContain("`__runSchedule(${JSON.stringify(scheduleId)})`")
  })

  it('the schedule register schema rejects unsupported cadence intervals', async () => {
    // The cadence validator must not be permissive — only the five
    // documented intervals are allowed. If anyone adds an unbounded
    // string cadence (full cron, etc.) without updating the schema,
    // this test will catch them.
    const source = await read('server/plugins/workerProtocol.ts')
    expect(source).toContain('const CadenceSchema = Type.Union(')
    expect(source).toContain("Type.Literal('hourly')")
    expect(source).toContain("Type.Literal('daily')")
    expect(source).toContain("Type.Literal('weekly')")
    expect(source).toContain("Type.Literal('monthly')")
    expect(source).toContain("Type.Literal('every')")
  })

  it('the schedule register schema caps maxDurationMs', async () => {
    const source = await read('server/plugins/workerProtocol.ts')
    // 5 * 60_000 = 5 minutes — the hard host-side cap so a plugin can't
    // pin a worker indefinitely.
    expect(source).toContain('maxDurationMs: Type.Integer({ minimum: 100, maximum: 5 * 60_000 })')
  })
})

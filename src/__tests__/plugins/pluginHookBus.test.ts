import { afterEach, describe, expect, it } from 'bun:test'
import { hookBus } from '@core/plugins/hookBus'

afterEach(() => {
  hookBus.reset()
})

describe('hookBus', () => {
  it('fires events to every registered listener in registration order', async () => {
    const calls: string[] = []
    hookBus.on('plugin.acme.x', 'publish.before', (payload) => {
      calls.push(`acme:${JSON.stringify(payload)}`)
    })
    hookBus.on('plugin.zeta.x', 'publish.before', (payload) => {
      calls.push(`zeta:${JSON.stringify(payload)}`)
    })

    await hookBus.emit('publish.before', { siteId: 's1', pageId: 'p1' })
    expect(calls).toEqual([
      'acme:{"siteId":"s1","pageId":"p1"}',
      'zeta:{"siteId":"s1","pageId":"p1"}',
    ])
  })

  it('runs filters in order, threading the previous handler\'s output', async () => {
    hookBus.filter('plugin.a', 'publish.html', (value) => `${value}-a`)
    hookBus.filter('plugin.b', 'publish.html', (value) => `${value}-b`)
    expect(await hookBus.applyFilter('publish.html', 'base')).toBe('base-a-b')
  })

  it('isolates listener errors so other listeners still run', async () => {
    const calls: string[] = []
    hookBus.on('plugin.bad', 'evt', () => {
      throw new Error('boom')
    })
    hookBus.on('plugin.good', 'evt', () => {
      calls.push('good')
    })
    await hookBus.emit('evt', {})
    expect(calls).toEqual(['good'])
  })

  it('falls back to the previous value if a filter throws', async () => {
    hookBus.filter('plugin.bad', 'pipe', () => {
      throw new Error('nope')
    })
    hookBus.filter('plugin.good', 'pipe', (value) => `${value}-good`)
    expect(await hookBus.applyFilter('pipe', 'seed')).toBe('seed-good')
  })

  it('unregisterPlugin removes both events and filters for that plugin id', async () => {
    hookBus.on('plugin.x', 'evt', () => {})
    hookBus.filter('plugin.x', 'pipe', (v) => v)
    hookBus.on('plugin.y', 'evt', () => {})
    hookBus.unregisterPlugin('plugin.x')

    expect(hookBus.hasListenersFor('evt')).toBe(true) // y still registered
    expect(hookBus.hasFiltersFor('pipe')).toBe(false)
  })
})

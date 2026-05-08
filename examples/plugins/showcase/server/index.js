/**
 * Showcase plugin — server entrypoint.
 *
 * Demonstrates the four major server surfaces:
 *   1. Storage     — CRUD over plugin-owned `events` records.
 *   2. Routes      — `/status` returns aggregate event counts.
 *   3. Hooks       — listens to `tracker.event` and stores incoming
 *                    events into the plugin's `events` resource.
 *   4. Filters     — appends a `<meta>` tag to every published page so
 *                    the frontend tracker bundle can pick up plugin id.
 */

const STATUS_TAG = '<!-- plugin:acme.showcase -->'

export function install(api) {
  api.plugin.log('Showcase plugin installed')
}

export function activate(api) {
  api.plugin.log('Showcase plugin activated')

  const events = api.cms.storage.collection('events')

  api.cms.routes.get('/status', 'plugins.manage', async () => {
    const all = await events.list()
    const byEvent = {}
    for (const record of all) {
      const name = String(record.data.name || 'unknown')
      byEvent[name] = (byEvent[name] || 0) + 1
    }
    return {
      ok: true,
      plugin: api.plugin.id,
      total: all.length,
      byEvent,
    }
  })

  api.cms.routes.post('/clear', 'plugins.manage', async () => {
    const all = await events.list()
    await Promise.all(all.map((r) => events.delete(r.id)))
    return { ok: true, deleted: all.length }
  })

  // Listen to all tracker events. Persist anything we own.
  api.cms.hooks.on('tracker.event', async (evt) => {
    if (evt.pluginId !== api.plugin.id && evt.pluginId !== '__implicit__') return
    try {
      await events.create({
        name: evt.eventName,
        page: evt.pagePath || '',
        visitor: evt.visitorId || '',
        session: evt.sessionId || '',
        payload: JSON.stringify(evt.payload || {}),
        'received-at': evt.receivedAt,
      })
    } catch (err) {
      api.plugin.log('storage failed', err && err.message ? err.message : err)
    }
  })

  // Filter the final HTML — append a tiny breadcrumb at the bottom of <body>
  // so we can verify in the browser that the filter pipeline ran. This is
  // pure demo: real plugins might inject CSP nonces, swap markers, etc.
  api.cms.hooks.filter('publish.html', (html) => {
    if (typeof html !== 'string') return html
    return html.replace('</body>', `${STATUS_TAG}\n</body>`)
  })
}

export function deactivate(api) {
  api.plugin.log('Showcase plugin deactivated')
}

export async function uninstall(api) {
  const events = api.cms.storage.collection('events')
  const all = await events.list()
  await Promise.all(all.map((r) => events.delete(r.id)))
  api.plugin.log(`Showcase plugin removed ${all.length} events`)
}

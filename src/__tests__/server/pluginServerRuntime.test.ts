import { beforeEach, describe, expect, it } from 'bun:test'
import {
  activateServerPlugin,
  handleServerPluginRuntimeRequest,
  runServerPluginLifecycleHook,
  serverPluginRuntime,
} from '../../../server/plugins/runtime'
import type { PluginManifest } from '@core/plugin-sdk'
import { createFakeDb } from './dbTestFake'
import { SESSION_COOKIE_NAME } from '../../../server/auth/tokens'

const fakeDb = createFakeDb(async (sql) => {
  const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase()
  if (normalized.includes('from sessions') && normalized.includes('join users')) {
    return {
      rows: [{
        id: 'owner_1',
        email: 'owner@example.com',
        email_normalized: 'owner@example.com',
        display_name: 'Owner',
        password_hash: 'hash',
        status: 'active',
        role_id: 'owner',
        last_login_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        role_slug: 'owner',
        role_name: 'Owner',
        role_description: '',
        role_is_system: true,
        role_capabilities_json: ['plugins.manage'],
      }],
      rowCount: 1,
    }
  }
  if (normalized.includes('update sessions') && normalized.includes('last_seen_at')) {
    return { rows: [], rowCount: 1 }
  }
  throw new Error(`Unexpected DB call in plugin runtime test: ${sql}`)
})

const workflowManifest: PluginManifest = {
  id: 'acme.workflow',
  name: 'Workflow Tools',
  version: '1.0.0',
  apiVersion: 1,
  permissions: ['cms.routes', 'cms.storage'],
  grantedPermissions: ['cms.routes', 'cms.storage'],
  resources: [],
  adminPages: [],
}

beforeEach(() => {
  serverPluginRuntime.reset()
})

describe('server plugin runtime SDK', () => {
  it('lets trusted server plugin code register authenticated backend routes', async () => {
    await activateServerPlugin(workflowManifest, {
      activate(api) {
        api.cms.routes.get('/approvals', 'plugins.manage', async () => ({
          approvals: [{ pageId: 'page_home', status: 'approved' }],
        }))
      },
    }, fakeDb)

    const req = new Request('http://localhost/admin/api/cms/plugins/acme.workflow/runtime/approvals')
    req.headers.set('cookie', `${SESSION_COOKIE_NAME}=token`)
    const res = await handleServerPluginRuntimeRequest(req, fakeDb)

    expect(res?.status).toBe(200)
    expect(await res?.json()).toEqual({
      approvals: [{ pageId: 'page_home', status: 'approved' }],
    })
  })

  it('lets plugins explicitly register public GET routes', async () => {
    await activateServerPlugin(workflowManifest, {
      activate(api) {
        api.cms.routes.getPublic('/status', async () => ({ ok: true }))
      },
    }, fakeDb)

    const res = await handleServerPluginRuntimeRequest(
      new Request('http://localhost/admin/api/cms/plugins/acme.workflow/runtime/status'),
      fakeDb,
    )

    expect(res?.status).toBe(200)
    expect(await res?.json()).toEqual({ ok: true })
  })

  it('blocks backend route registration without the cms.routes permission grant', async () => {
    await expect(activateServerPlugin({
      ...workflowManifest,
      grantedPermissions: ['cms.storage'],
    }, {
      activate(api) {
        api.cms.routes.get('/approvals', 'plugins.manage', async () => ({ ok: true }))
      },
    }, fakeDb)).rejects.toThrow('requires permission "cms.routes"')
  })

  it('uses the shared permission guard error format', async () => {
    await expect(activateServerPlugin({
      ...workflowManifest,
      grantedPermissions: [],
    }, {
      activate(api) {
        api.cms.routes.get('/blocked', 'plugins.manage', () => ({ ok: true }))
      },
    }, fakeDb)).rejects.toThrow('Plugin "acme.workflow" requires permission "cms.routes"')
  })

  it('runs optional lifecycle hooks with plugin metadata and logging helpers', async () => {
    const calls: string[] = []
    const mod = {
      install(api) {
        calls.push(`${api.plugin.id}:${api.plugin.version}:${api.plugin.permissions.join(',')}`)
        api.plugin.log('installed')
      },
    }

    await runServerPluginLifecycleHook(workflowManifest, mod, fakeDb, 'install')

    expect(calls).toEqual(['acme.workflow:1.0.0:cms.routes,cms.storage'])
  })
})

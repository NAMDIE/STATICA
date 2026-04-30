import { describe, expect, it } from 'bun:test'
import { handleServerRequest } from '../../../server/router'
import type { DbClient, DbResult } from '../../../server/cms/db'

class RouterFakeDb implements DbClient {
  async query<Row = Record<string, unknown>>(sql: string): Promise<DbResult<Row>> {
    const normalized = sql.toLowerCase()
    if (normalized.includes('count(*)::int as count from site')) {
      return { rows: [{ count: 0 } as Row], rowCount: 1 }
    }
    if (normalized.includes('count(*)::int as count from admin_users')) {
      return { rows: [{ count: 0 } as Row], rowCount: 1 }
    }
    return { rows: [], rowCount: 0 }
  }
}

describe('server router', () => {
  it('serves health checks', async () => {
    const res = await handleServerRequest(new Request('http://localhost/health'), { db: new RouterFakeDb() })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok' })
  })

  it('routes cms setup status', async () => {
    const res = await handleServerRequest(new Request('http://localhost/api/cms/setup/status'), { db: new RouterFakeDb() })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ needsSetup: true })
  })

  it('returns 404 for unknown routes', async () => {
    const res = await handleServerRequest(new Request('http://localhost/nope'), { db: new RouterFakeDb() })
    expect(res.status).toBe(404)
  })
})

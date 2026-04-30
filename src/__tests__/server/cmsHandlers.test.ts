import { describe, expect, it } from 'bun:test'
import { handleCmsRequest } from '../../../server/cms/handlers'
import type { DbClient, DbResult } from '../../../server/cms/db'
import { SESSION_COOKIE_NAME } from '../../../server/cms/auth'

class HandlerFakeDb implements DbClient {
  site: Record<string, unknown>[] = []
  admins: Record<string, unknown>[] = []
  sessions: Record<string, unknown>[] = []

  async query<Row = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<DbResult<Row>> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized === 'begin' || normalized === 'commit' || normalized === 'rollback') {
      return { rows: [], rowCount: 0 }
    }
    if (normalized.startsWith('select count(*)::int as count from site')) {
      return { rows: [{ count: this.site.length } as Row], rowCount: 1 }
    }
    if (normalized.startsWith('select count(*)::int as count from admin_users')) {
      return { rows: [{ count: this.admins.length } as Row], rowCount: 1 }
    }
    if (normalized.startsWith('insert into site')) {
      this.site.push({ id: 'default', name: params[0], settings_json: params[1] })
      return { rows: [], rowCount: 1 }
    }
    if (normalized.startsWith('insert into admin_users')) {
      this.admins.push({
        id: params[0],
        email: params[1],
        password_hash: params[2],
        created_at: new Date().toISOString(),
      })
      return { rows: [], rowCount: 1 }
    }
    if (normalized.startsWith('select id, email, password_hash')) {
      return { rows: this.admins.filter((a) => a.email === params[0]) as Row[], rowCount: 1 }
    }
    if (normalized.startsWith('insert into sessions')) {
      this.sessions.push({ id_hash: params[0], admin_user_id: params[1], expires_at: params[2] })
      return { rows: [], rowCount: 1 }
    }
    throw new Error(`Unhandled SQL: ${sql}`)
  }
}

async function json(res: Response) {
  return res.json() as Promise<Record<string, unknown>>
}

describe('CMS handlers', () => {
  it('reports setup status', async () => {
    const db = new HandlerFakeDb()
    const res = await handleCmsRequest(new Request('http://localhost/api/cms/setup/status'), db)
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ hasSite: false, hasAdmin: false, needsSetup: true })
  })

  it('creates the first site and admin account', async () => {
    const db = new HandlerFakeDb()
    const res = await handleCmsRequest(new Request('http://localhost/api/cms/setup', {
      method: 'POST',
      body: JSON.stringify({ siteName: 'Example', email: 'owner@example.com', password: 'long-enough-password' }),
      headers: { 'content-type': 'application/json' },
    }), db)
    expect(res.status).toBe(201)
    expect(await json(res)).toMatchObject({ ok: true })
    expect(db.site).toHaveLength(1)
    expect(db.admins).toHaveLength(1)
  })

  it('refuses setup after an admin exists', async () => {
    const db = new HandlerFakeDb()
    db.site.push({ id: 'default', name: 'Existing' })
    db.admins.push({ id: 'admin_1', email: 'owner@example.com', password_hash: 'hash' })
    const res = await handleCmsRequest(new Request('http://localhost/api/cms/setup', {
      method: 'POST',
      body: JSON.stringify({ siteName: 'Example', email: 'new@example.com', password: 'long-enough-password' }),
      headers: { 'content-type': 'application/json' },
    }), db)
    expect(res.status).toBe(409)
  })

  it('logs in and sets an HttpOnly session cookie', async () => {
    const db = new HandlerFakeDb()
    await handleCmsRequest(new Request('http://localhost/api/cms/setup', {
      method: 'POST',
      body: JSON.stringify({ siteName: 'Example', email: 'owner@example.com', password: 'long-enough-password' }),
      headers: { 'content-type': 'application/json' },
    }), db)
    const res = await handleCmsRequest(new Request('http://localhost/api/cms/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@example.com', password: 'long-enough-password' }),
      headers: { 'content-type': 'application/json' },
    }), db)
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(res.headers.get('set-cookie')).toContain('HttpOnly')
    expect(db.sessions).toHaveLength(1)
  })
})

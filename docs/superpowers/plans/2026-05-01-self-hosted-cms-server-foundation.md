# Self-Hosted CMS Server Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first self-hosted CMS foundation: Docker Compose, Postgres schema/migrations, database access boundaries, setup/login/session APIs, and tests.

**Architecture:** Keep the current Vite/React editor untouched in this slice. Add focused server modules under `server/cms` and route them from the existing Bun server. Use Postgres for CMS durability, but keep tests mostly unit-level by injecting a `DbClient` interface so server behavior is testable without requiring Docker for every test run.

**Tech Stack:** Bun 1.3, TypeScript, Bun test, Postgres, Docker Compose, `pg` for database pooling, Bun password hashing, HttpOnly cookies.

---

## File Structure

- Create `docker-compose.yml`: local self-host stack with app, postgres, and uploads volume.
- Create `.env.example`: documented runtime settings.
- Modify `package.json`: add CMS server scripts and `pg` dependency.
- Modify `tsconfig.node.json`: include all server TypeScript files, not only agent files.
- Create `server/config.ts`: typed environment config.
- Create `server/http.ts`: JSON responses, request body parsing, cookie parsing/serialization, method helpers.
- Create `server/cms/db.ts`: `DbClient` interface plus `pg` pool adapter.
- Create `server/cms/migrations.ts`: idempotent migration SQL and migration runner.
- Create `server/cms/types.ts`: CMS row/domain types.
- Create `server/cms/repositories.ts`: setup status, site/admin creation, session CRUD.
- Create `server/cms/auth.ts`: password hashing/verification, session token generation/hash, session cookie constants.
- Create `server/cms/handlers.ts`: setup status, setup create, login, logout, current admin handlers.
- Create `server/router.ts`: route `/api/cms/*`, `/api/agent`, `/health`, and fallback.
- Modify `server/index.ts`: delegate requests to `handleServerRequest()`.
- Create `src/__tests__/server/cmsMigrations.test.ts`: migration SQL checks.
- Create `src/__tests__/server/cmsRepositories.test.ts`: repository behavior using an in-memory fake DB.
- Create `src/__tests__/server/cmsAuth.test.ts`: password and session primitives.
- Create `src/__tests__/server/cmsHandlers.test.ts`: setup/login/logout/current admin HTTP behavior.

## Task 1: Migration And Database Boundary

**Files:**
- Create: `server/cms/db.ts`
- Create: `server/cms/migrations.ts`
- Create: `server/cms/types.ts`
- Test: `src/__tests__/server/cmsMigrations.test.ts`

- [ ] **Step 1: Write migration tests**

```ts
import { describe, expect, it } from 'bun:test'
import { CMS_MIGRATIONS } from '../../../server/cms/migrations'

describe('CMS migrations', () => {
  it('creates the required CMS tables', () => {
    const sql = CMS_MIGRATIONS.map((m) => m.sql).join('\n')
    expect(sql).toContain('create table if not exists site')
    expect(sql).toContain('create table if not exists admin_users')
    expect(sql).toContain('create table if not exists sessions')
    expect(sql).toContain('create table if not exists pages')
    expect(sql).toContain('create table if not exists page_versions')
    expect(sql).toContain('create table if not exists media_assets')
  })

  it('stores draft and published page documents as jsonb', () => {
    const sql = CMS_MIGRATIONS.map((m) => m.sql).join('\n')
    expect(sql).toContain('draft_document_json jsonb not null')
    expect(sql).toContain('snapshot_json jsonb not null')
  })

  it('enforces a single-site row', () => {
    const sql = CMS_MIGRATIONS.map((m) => m.sql).join('\n')
    expect(sql).toContain("id text primary key default 'default'")
    expect(sql).toContain("constraint site_singleton check (id = 'default')")
  })
})
```

- [ ] **Step 2: Run migration tests to verify they fail**

Run: `bun test src/__tests__/server/cmsMigrations.test.ts`

Expected: FAIL because `server/cms/migrations.ts` does not exist.

- [ ] **Step 3: Add database types and migrations**

```ts
// server/cms/db.ts
import pg from 'pg'

export interface DbResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  rows: Row[]
  rowCount: number
}

export interface DbClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<DbResult<Row>>
}

export function createPgPool(connectionString: string): DbClient {
  const pool = new pg.Pool({ connectionString })
  return {
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ): Promise<DbResult<Row>> {
      const result = await pool.query(sql, params)
      return { rows: result.rows as Row[], rowCount: result.rowCount ?? 0 }
    },
  }
}
```

```ts
// server/cms/migrations.ts
import type { DbClient } from './db'

export interface Migration {
  id: string
  sql: string
}

export const CMS_MIGRATIONS: Migration[] = [
  {
    id: '001_cms_foundation',
    sql: `
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      );

      create table if not exists site (
        id text primary key default 'default',
        name text not null,
        settings_json jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint site_singleton check (id = 'default')
      );

      create table if not exists admin_users (
        id text primary key,
        email text not null unique,
        password_hash text not null,
        created_at timestamptz not null default now()
      );

      create table if not exists sessions (
        id_hash text primary key,
        admin_user_id text not null references admin_users(id) on delete cascade,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      );

      create table if not exists pages (
        id text primary key,
        title text not null,
        slug text not null unique,
        status text not null default 'draft',
        draft_document_json jsonb not null,
        active_version_id text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists page_versions (
        id text primary key,
        page_id text not null references pages(id) on delete cascade,
        version integer not null,
        snapshot_json jsonb not null,
        published_at timestamptz not null default now(),
        published_by text references admin_users(id) on delete set null,
        unique (page_id, version)
      );

      create table if not exists media_assets (
        id text primary key,
        filename text not null,
        mime_type text not null,
        size_bytes bigint not null,
        storage_path text not null,
        public_path text not null unique,
        created_at timestamptz not null default now()
      );
    `,
  },
]

export async function runMigrations(db: DbClient): Promise<void> {
  await db.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `)

  for (const migration of CMS_MIGRATIONS) {
    const existing = await db.query<{ id: string }>(
      'select id from schema_migrations where id = $1',
      [migration.id],
    )
    if (existing.rows.length > 0) continue
    await db.query('begin')
    try {
      await db.query(migration.sql)
      await db.query('insert into schema_migrations (id) values ($1)', [migration.id])
      await db.query('commit')
    } catch (err) {
      await db.query('rollback')
      throw err
    }
  }
}
```

```ts
// server/cms/types.ts
export interface SiteRow {
  id: string
  name: string
  settings_json: Record<string, unknown>
  created_at: Date | string
  updated_at: Date | string
}

export interface AdminUserRow {
  id: string
  email: string
  password_hash: string
  created_at: Date | string
}

export interface SessionRow {
  id_hash: string
  admin_user_id: string
  expires_at: Date | string
  created_at: Date | string
}
```

- [ ] **Step 4: Run migration tests to verify they pass**

Run: `bun test src/__tests__/server/cmsMigrations.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/cms/db.ts server/cms/migrations.ts server/cms/types.ts src/__tests__/server/cmsMigrations.test.ts
git commit -m "feat: add cms database migrations"
```

## Task 2: Auth And Repository Primitives

**Files:**
- Create: `server/cms/auth.ts`
- Create: `server/cms/repositories.ts`
- Test: `src/__tests__/server/cmsAuth.test.ts`
- Test: `src/__tests__/server/cmsRepositories.test.ts`

- [ ] **Step 1: Write auth primitive tests**

```ts
import { describe, expect, it } from 'bun:test'
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from '../../../server/cms/auth'

describe('CMS auth primitives', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash).not.toBe('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
    expect(await verifyPassword('wrong password', hash)).toBe(false)
  })

  it('generates opaque session tokens and stores only hashes', async () => {
    const token = createSessionToken()
    const hash = await hashSessionToken(token)
    expect(token.length).toBeGreaterThan(32)
    expect(hash).not.toBe(token)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('uses a stable admin session cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('pb_admin_session')
  })
})
```

- [ ] **Step 2: Write repository tests with a fake DB**

```ts
import { describe, expect, it } from 'bun:test'
import type { DbClient, DbResult } from '../../../server/cms/db'
import {
  createAdminUser,
  createSession,
  createSite,
  findAdminByEmail,
  getSetupStatus,
} from '../../../server/cms/repositories'

class FakeDb implements DbClient {
  site: Record<string, unknown>[] = []
  admins: Record<string, unknown>[] = []
  sessions: Record<string, unknown>[] = []

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<DbResult<Row>> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase()
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
      this.admins.push({ id: params[0], email: params[1], password_hash: params[2] })
      return { rows: [], rowCount: 1 }
    }
    if (normalized.startsWith('select id, email, password_hash')) {
      return {
        rows: this.admins.filter((a) => a.email === params[0]) as Row[],
        rowCount: 1,
      }
    }
    if (normalized.startsWith('insert into sessions')) {
      this.sessions.push({ id_hash: params[0], admin_user_id: params[1], expires_at: params[2] })
      return { rows: [], rowCount: 1 }
    }
    throw new Error(`Unhandled SQL: ${sql}`)
  }
}

describe('CMS repositories', () => {
  it('reports setup incomplete until site and admin exist', async () => {
    const db = new FakeDb()
    expect(await getSetupStatus(db)).toEqual({ hasSite: false, hasAdmin: false, needsSetup: true })
    await createSite(db, 'Example Site', {})
    await createAdminUser(db, { id: 'admin_1', email: 'owner@example.com', passwordHash: 'hash' })
    expect(await getSetupStatus(db)).toEqual({ hasSite: true, hasAdmin: true, needsSetup: false })
  })

  it('creates and finds admins by normalized email', async () => {
    const db = new FakeDb()
    await createAdminUser(db, { id: 'admin_1', email: 'Owner@Example.com', passwordHash: 'hash' })
    expect(await findAdminByEmail(db, 'owner@example.com')).toMatchObject({
      id: 'admin_1',
      email: 'owner@example.com',
      password_hash: 'hash',
    })
  })

  it('stores session token hashes only', async () => {
    const db = new FakeDb()
    await createSession(db, { idHash: 'abc123', adminUserId: 'admin_1', expiresAt: new Date('2030-01-01') })
    expect(db.sessions[0]).toMatchObject({ id_hash: 'abc123', admin_user_id: 'admin_1' })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test src/__tests__/server/cmsAuth.test.ts src/__tests__/server/cmsRepositories.test.ts`

Expected: FAIL because `auth.ts` and `repositories.ts` do not exist.

- [ ] **Step 4: Implement auth primitives and repositories**

```ts
// server/cms/auth.ts
import { createHash, randomBytes } from 'node:crypto'

export const SESSION_COOKIE_NAME = 'pb_admin_session'
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'argon2id' })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash)
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export async function hashSessionToken(token: string): Promise<string> {
  return createHash('sha256').update(token).digest('hex')
}

export function sessionExpiry(now = Date.now()): Date {
  return new Date(now + SESSION_TTL_MS)
}
```

```ts
// server/cms/repositories.ts
import type { DbClient } from './db'
import type { AdminUserRow } from './types'

export interface SetupStatus {
  hasSite: boolean
  hasAdmin: boolean
  needsSetup: boolean
}

export async function getSetupStatus(db: DbClient): Promise<SetupStatus> {
  const [site, admin] = await Promise.all([
    db.query<{ count: number }>('select count(*)::int as count from site'),
    db.query<{ count: number }>('select count(*)::int as count from admin_users'),
  ])
  const hasSite = Number(site.rows[0]?.count ?? 0) > 0
  const hasAdmin = Number(admin.rows[0]?.count ?? 0) > 0
  return { hasSite, hasAdmin, needsSetup: !hasSite || !hasAdmin }
}

export async function createSite(
  db: DbClient,
  name: string,
  settings: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `insert into site (id, name, settings_json)
     values ('default', $1, $2)
     on conflict (id) do update set name = excluded.name, settings_json = excluded.settings_json, updated_at = now()`,
    [name, settings],
  )
}

export async function createAdminUser(
  db: DbClient,
  input: { id: string; email: string; passwordHash: string },
): Promise<void> {
  await db.query(
    'insert into admin_users (id, email, password_hash) values ($1, $2, $3)',
    [input.id, input.email.trim().toLowerCase(), input.passwordHash],
  )
}

export async function findAdminByEmail(
  db: DbClient,
  email: string,
): Promise<AdminUserRow | null> {
  const result = await db.query<AdminUserRow>(
    `select id, email, password_hash, created_at
     from admin_users
     where email = $1
     limit 1`,
    [email.trim().toLowerCase()],
  )
  return result.rows[0] ?? null
}

export async function createSession(
  db: DbClient,
  input: { idHash: string; adminUserId: string; expiresAt: Date },
): Promise<void> {
  await db.query(
    'insert into sessions (id_hash, admin_user_id, expires_at) values ($1, $2, $3)',
    [input.idHash, input.adminUserId, input.expiresAt],
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test src/__tests__/server/cmsAuth.test.ts src/__tests__/server/cmsRepositories.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/cms/auth.ts server/cms/repositories.ts src/__tests__/server/cmsAuth.test.ts src/__tests__/server/cmsRepositories.test.ts
git commit -m "feat: add cms auth repositories"
```

## Task 3: Setup And Session HTTP Handlers

**Files:**
- Create: `server/http.ts`
- Create: `server/cms/handlers.ts`
- Test: `src/__tests__/server/cmsHandlers.test.ts`

- [ ] **Step 1: Write handler tests**

```ts
import { describe, expect, it } from 'bun:test'
import { handleCmsRequest } from '../../../server/cms/handlers'
import type { DbClient, DbResult } from '../../../server/cms/db'
import { SESSION_COOKIE_NAME } from '../../../server/cms/auth'

class HandlerFakeDb implements DbClient {
  site: Record<string, unknown>[] = []
  admins: Record<string, unknown>[] = []
  sessions: Record<string, unknown>[] = []

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<DbResult<Row>> {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized === 'begin' || normalized === 'commit' || normalized === 'rollback') return { rows: [], rowCount: 0 }
    if (normalized.startsWith('select count(*)::int as count from site')) return { rows: [{ count: this.site.length } as Row], rowCount: 1 }
    if (normalized.startsWith('select count(*)::int as count from admin_users')) return { rows: [{ count: this.admins.length } as Row], rowCount: 1 }
    if (normalized.startsWith('insert into site')) {
      this.site.push({ id: 'default', name: params[0], settings_json: params[1] })
      return { rows: [], rowCount: 1 }
    }
    if (normalized.startsWith('insert into admin_users')) {
      this.admins.push({ id: params[0], email: params[1], password_hash: params[2], created_at: new Date().toISOString() })
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
```

- [ ] **Step 2: Run handler tests to verify they fail**

Run: `bun test src/__tests__/server/cmsHandlers.test.ts`

Expected: FAIL because handlers do not exist.

- [ ] **Step 3: Implement HTTP helpers and CMS handlers**

```ts
// server/http.ts
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  return new Response(JSON.stringify(body), { ...init, headers })
}

export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

export function methodNotAllowed(): Response {
  return jsonResponse({ error: 'Method not allowed' }, { status: 405 })
}

export function badRequest(message: string): Response {
  return jsonResponse({ error: message }, { status: 400 })
}

export function setCookieHeader(res: Response, value: string): Response {
  res.headers.append('set-cookie', value)
  return res
}
```

```ts
// server/cms/handlers.ts
import { nanoid } from 'nanoid'
import type { DbClient } from './db'
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  sessionExpiry,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from './auth'
import {
  createAdminUser,
  createSession,
  createSite,
  findAdminByEmail,
  getSetupStatus,
} from './repositories'
import { badRequest, jsonResponse, methodNotAllowed, readJsonObject, setCookieHeader } from '../http'

function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value.trim() : ''
}

function sessionCookie(token: string, expires: Date): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Expires=${expires.toUTCString()}; HttpOnly; SameSite=Lax`
}

export async function handleCmsRequest(req: Request, db: DbClient): Promise<Response> {
  const url = new URL(req.url)

  if (url.pathname === '/api/cms/setup/status') {
    if (req.method !== 'GET') return methodNotAllowed()
    return jsonResponse(await getSetupStatus(db))
  }

  if (url.pathname === '/api/cms/setup') {
    if (req.method !== 'POST') return methodNotAllowed()
    const status = await getSetupStatus(db)
    if (!status.needsSetup) return jsonResponse({ error: 'Setup already complete' }, { status: 409 })
    const body = await readJsonObject(req)
    const siteName = readString(body, 'siteName')
    const email = readString(body, 'email').toLowerCase()
    const password = readString(body, 'password')
    if (!siteName) return badRequest('Missing siteName')
    if (!email.includes('@')) return badRequest('Invalid email')
    if (password.length < 12) return badRequest('Password must be at least 12 characters')
    await db.query('begin')
    try {
      await createSite(db, siteName, {})
      await createAdminUser(db, {
        id: nanoid(),
        email,
        passwordHash: await hashPassword(password),
      })
      await db.query('commit')
      return jsonResponse({ ok: true }, { status: 201 })
    } catch (err) {
      await db.query('rollback')
      throw err
    }
  }

  if (url.pathname === '/api/cms/login') {
    if (req.method !== 'POST') return methodNotAllowed()
    const body = await readJsonObject(req)
    const email = readString(body, 'email').toLowerCase()
    const password = readString(body, 'password')
    const admin = await findAdminByEmail(db, email)
    if (!admin || !(await verifyPassword(password, admin.password_hash))) {
      return jsonResponse({ error: 'Invalid email or password' }, { status: 401 })
    }
    const token = createSessionToken()
    const expiresAt = sessionExpiry()
    await createSession(db, {
      idHash: await hashSessionToken(token),
      adminUserId: admin.id,
      expiresAt,
    })
    return setCookieHeader(jsonResponse({ ok: true }), sessionCookie(token, expiresAt))
  }

  if (url.pathname === '/api/cms/logout') {
    if (req.method !== 'POST') return methodNotAllowed()
    return setCookieHeader(
      jsonResponse({ ok: true }),
      `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    )
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 })
}
```

- [ ] **Step 4: Run handler tests to verify they pass**

Run: `bun test src/__tests__/server/cmsHandlers.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/http.ts server/cms/handlers.ts src/__tests__/server/cmsHandlers.test.ts
git commit -m "feat: add cms setup login handlers"
```

## Task 4: Server Routing And Runtime Config

**Files:**
- Create: `server/config.ts`
- Create: `server/router.ts`
- Modify: `server/index.ts`
- Modify: `tsconfig.node.json`
- Test: `src/__tests__/server/router.test.ts`

- [ ] **Step 1: Write router tests**

```ts
import { describe, expect, it } from 'bun:test'
import { handleServerRequest } from '../../../server/router'
import type { DbClient, DbResult } from '../../../server/cms/db'

class RouterFakeDb implements DbClient {
  async query<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string): Promise<DbResult<Row>> {
    if (sql.toLowerCase().includes('count(*)::int as count from site')) {
      return { rows: [{ count: 0 } as Row], rowCount: 1 }
    }
    if (sql.toLowerCase().includes('count(*)::int as count from admin_users')) {
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
```

- [ ] **Step 2: Run router tests to verify they fail**

Run: `bun test src/__tests__/server/router.test.ts`

Expected: FAIL because `server/router.ts` does not exist.

- [ ] **Step 3: Implement config, router, and server entry wiring**

```ts
// server/config.ts
export interface ServerConfig {
  port: number
  databaseUrl: string
  uploadsDir: string
}

export function readServerConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 3001),
    databaseUrl: env.DATABASE_URL ?? 'postgres://page_builder:page_builder@localhost:5432/page_builder',
    uploadsDir: env.UPLOADS_DIR ?? './uploads',
  }
}
```

```ts
// server/router.ts
import { handleAgentRequest } from './agentHandler'
import { handleCmsRequest } from './cms/handlers'
import type { DbClient } from './cms/db'
import { jsonResponse } from './http'

export interface ServerRuntime {
  db: DbClient
}

export async function handleServerRequest(req: Request, runtime: ServerRuntime): Promise<Response> {
  const url = new URL(req.url)
  if (url.pathname === '/health') {
    return jsonResponse({ status: 'ok', ts: Date.now() })
  }
  if (url.pathname.startsWith('/api/cms/')) {
    return handleCmsRequest(req, runtime.db)
  }
  if (url.pathname === '/api/agent') {
    return handleAgentRequest(req)
  }
  return jsonResponse({ error: 'Not found' }, { status: 404 })
}
```

```ts
// server/index.ts
import { createPgPool } from './cms/db'
import { runMigrations } from './cms/migrations'
import { readServerConfig } from './config'
import { handleServerRequest } from './router'

const config = readServerConfig()
const db = createPgPool(config.databaseUrl)
await runMigrations(db)

Bun.serve({
  port: config.port,
  fetch(req) {
    return handleServerRequest(req, { db })
  },
  error(err) {
    console.error('[server] Unhandled error:', err)
    return new Response('Internal Server Error', { status: 500 })
  },
})

console.log(`[server] Listening on http://localhost:${config.port}`)
```

- [ ] **Step 4: Run router tests and typecheck**

Run:

```bash
bun test src/__tests__/server/router.test.ts
bun run build
```

Expected: router tests PASS and TypeScript build PASS.

- [ ] **Step 5: Commit**

```bash
git add server/config.ts server/router.ts server/index.ts tsconfig.node.json src/__tests__/server/router.test.ts
git commit -m "feat: route cms api through bun server"
```

## Task 5: Docker Compose And Runtime Scripts

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Modify: `package.json`
- Modify: `bun.lock`
- Test: `src/__tests__/server/dockerConfig.test.ts`

- [ ] **Step 1: Write config tests**

```ts
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

describe('self-host docker config', () => {
  it('defines app and postgres services', () => {
    const compose = readFileSync('docker-compose.yml', 'utf8')
    expect(compose).toContain('app:')
    expect(compose).toContain('postgres:')
    expect(compose).toContain('postgres:16')
  })

  it('defines persistent postgres and uploads volumes', () => {
    const compose = readFileSync('docker-compose.yml', 'utf8')
    expect(compose).toContain('postgres_data:')
    expect(compose).toContain('uploads:')
    expect(compose).toContain('/app/uploads')
  })

  it('documents required environment variables', () => {
    const env = readFileSync('.env.example', 'utf8')
    expect(env).toContain('DATABASE_URL=')
    expect(env).toContain('SESSION_SECRET=')
    expect(env).toContain('UPLOADS_DIR=')
  })
})
```

- [ ] **Step 2: Run config tests to verify they fail**

Run: `bun test src/__tests__/server/dockerConfig.test.ts`

Expected: FAIL because Docker files do not exist.

- [ ] **Step 3: Add Docker Compose, env example, and dependencies**

Run:

```bash
bun add pg
bun add -d @types/pg
```

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: page_builder
      POSTGRES_USER: page_builder
      POSTGRES_PASSWORD: page_builder
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    image: oven/bun:1.3
    working_dir: /app
    command: sh -lc "bun install --frozen-lockfile && bun run build && bun run server/index.ts"
    ports:
      - "3001:3001"
    environment:
      PORT: "3001"
      DATABASE_URL: postgres://page_builder:page_builder@postgres:5432/page_builder
      SESSION_SECRET: change-me
      UPLOADS_DIR: /app/uploads
    volumes:
      - .:/app
      - uploads:/app/uploads
    depends_on:
      - postgres

volumes:
  postgres_data:
  uploads:
```

```dotenv
# .env.example
PORT=3001
DATABASE_URL=postgres://page_builder:page_builder@localhost:5432/page_builder
SESSION_SECRET=replace-with-a-long-random-secret
UPLOADS_DIR=./uploads
```

Add scripts:

```json
{
  "dev:server": "bun run server/index.ts",
  "docker:up": "docker compose up --build"
}
```

- [ ] **Step 4: Run config tests and targeted server tests**

Run:

```bash
bun test src/__tests__/server
bun run build
```

Expected: server tests PASS and TypeScript build PASS.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example package.json bun.lock src/__tests__/server/dockerConfig.test.ts
git commit -m "feat: add self hosted docker runtime"
```

## Plan Self-Review

- Spec coverage: this plan covers implementation slice 1 from the design: server foundation with Docker Compose, Postgres schema/migrations, setup/login/session APIs, and tests.
- Deliberately deferred: editor server persistence adapter, publish snapshots, public rendering, export removal, and media UI. Those are separate plans because they touch different subsystems and can be validated independently.
- Placeholder scan: no task contains `TBD`, `TODO`, or an undefined file path. Every code-producing task includes concrete test code, implementation snippets, exact commands, and expected results.
- Type consistency: database abstractions consistently use `DbClient`, `DbResult`, `AdminUserRow`, setup status, session token hash, and `SESSION_COOKIE_NAME`.

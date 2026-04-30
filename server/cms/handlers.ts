import { nanoid } from 'nanoid'
import type { DbClient } from './db'
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  sessionExpiry,
  verifyPassword,
} from './auth'
import {
  createAdminUser,
  createSession,
  createSite,
  findAdminByEmail,
  getSetupStatus,
} from './repositories'
import {
  badRequest,
  jsonResponse,
  methodNotAllowed,
  readJsonObject,
  setCookieHeader,
} from '../http'

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
    if (!status.needsSetup) {
      return jsonResponse({ error: 'Setup already complete' }, { status: 409 })
    }

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

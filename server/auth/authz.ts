import type { DbClient } from '../db/client'
import { SESSION_COOKIE_NAME, hashSessionToken } from './tokens'
import { roleHasCapability, type CoreCapability } from './capabilities'
import { findUserBySessionHash } from './sessions'
import { jsonResponse } from '../http'
import type { AuthUser } from '../repositories/users'

export function readCookie(req: Request, name: string): string {
  const cookie = req.headers.get('cookie') ?? ''
  for (const part of cookie.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (rawKey === name) return rawValue.join('=')
  }
  return ''
}

export async function getSessionHash(req: Request): Promise<string> {
  const token = readCookie(req, SESSION_COOKIE_NAME)
  return token ? hashSessionToken(token) : ''
}

export async function requireAuthenticatedUser(
  req: Request,
  db: DbClient,
): Promise<AuthUser | Response> {
  const idHash = await getSessionHash(req)
  const user = idHash ? await findUserBySessionHash(db, idHash) : null
  if (!user) return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
  return user
}

export async function requireCapability(
  req: Request,
  db: DbClient,
  capability: CoreCapability,
): Promise<AuthUser | Response> {
  const user = await requireAuthenticatedUser(req, db)
  if (user instanceof Response) return user
  if (!roleHasCapability(user.capabilities, capability)) {
    return jsonResponse({ error: 'Forbidden' }, { status: 403 })
  }
  return user
}

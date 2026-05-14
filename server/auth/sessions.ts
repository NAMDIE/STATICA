import type { DbClient } from '../db/client'
import { rowToUser, type AuthUser } from '../repositories/users'
import type { UserRow } from '../types'
import { deriveDeviceLabel } from './deviceLabel'

const SESSION_IDLE_TIMEOUT_MS = 1000 * 60 * 60 * 24 * 30

interface SessionUserRow extends UserRow {
  role_slug: string
  role_name: string
  role_description: string
  role_is_system: boolean | number
  role_capabilities_json: unknown
  avatar_public_path: string | null
}

function sessionIdleCutoff(now = Date.now()): Date {
  return new Date(now - SESSION_IDLE_TIMEOUT_MS)
}

export async function createSession(
  db: DbClient,
  input: {
    idHash: string
    userId: string
    expiresAt: Date
    ipAddress: string | null
    userAgent: string | null
    /**
     * Optional override for the device label. Falls back to a UA-derived
     * label, then the empty string. Empty is acceptable — the schema allows
     * it as a not-null sentinel and the UI renders "Unknown device".
     */
    deviceLabel?: string
  },
): Promise<void> {
  const deviceLabel = input.deviceLabel ?? deriveDeviceLabel(input.userAgent)
  await db`
    insert into sessions (id_hash, user_id, expires_at, ip_address, user_agent, device_label)
    values (${input.idHash}, ${input.userId}, ${input.expiresAt}, ${input.ipAddress}, ${input.userAgent}, ${deviceLabel})
  `
}

export async function findUserBySessionHash(
  db: DbClient,
  idHash: string,
  now = Date.now(),
): Promise<AuthUser | null> {
  const idleCutoff = sessionIdleCutoff(now)
  const currentTime = new Date(now)
  const { rows } = await db<SessionUserRow>`
    select users.id,
           users.email,
           users.email_normalized,
           users.display_name,
           users.password_hash,
           users.status,
           users.role_id,
           users.last_login_at,
           users.failed_login_count,
           users.locked_until,
           users.avatar_media_id,
           users.created_at,
           users.updated_at,
           users.deleted_at,
           roles.slug as role_slug,
           roles.name as role_name,
           roles.description as role_description,
           roles.is_system as role_is_system,
           roles.capabilities_json as role_capabilities_json,
           media_assets.public_path as avatar_public_path
    from sessions
    join users on users.id = sessions.user_id
    join roles on roles.id = users.role_id
    left join media_assets on media_assets.id = users.avatar_media_id
    where sessions.id_hash = ${idHash}
      and sessions.revoked_at is null
      and sessions.expires_at > ${currentTime}
      and sessions.last_seen_at > ${idleCutoff}
      and users.status = ${'active'}
      and users.deleted_at is null
    limit 1
  `
  const user = rows[0] ? rowToUser(rows[0]) : null
  if (!user) return null

  await db`
    update sessions
    set last_seen_at = current_timestamp
    where id_hash = ${idHash}
  `
  return user
}

export async function revokeSessionByHash(db: DbClient, idHash: string): Promise<void> {
  await db`
    update sessions
    set revoked_at = current_timestamp
    where id_hash = ${idHash}
  `
}

/**
 * Read the `step_up_expires_at` column for a single live session. Used by
 * `requireStepUp` in `authz.ts` to decide whether the cookie's owner is
 * inside their fresh re-auth window.
 *
 * Returns `null` when the session doesn't exist, has been revoked, or has
 * never had a step-up grant. Callers must treat null as "needs step-up".
 */
export async function getSessionStepUpExpiresAt(
  db: DbClient,
  idHash: string,
): Promise<Date | null> {
  const { rows } = await db<{ step_up_expires_at: Date | string | null }>`
    select step_up_expires_at
    from sessions
    where id_hash = ${idHash}
      and revoked_at is null
    limit 1
  `
  const value = rows[0]?.step_up_expires_at ?? null
  return value ? new Date(value) : null
}

/**
 * Open / refresh the step-up window on a session. Called by the
 * `/auth/step-up` endpoint after a successful password re-verification —
 * the caller computes `now + STEP_UP_WINDOW_MS` and passes it in.
 */
export async function markSessionStepUpFresh(
  db: DbClient,
  idHash: string,
  expiresAt: Date,
): Promise<void> {
  await db`
    update sessions
    set step_up_expires_at = ${expiresAt}
    where id_hash = ${idHash}
      and revoked_at is null
  `
}

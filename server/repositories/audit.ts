import { nanoid } from 'nanoid'
import type { DbClient } from '../db/client'
import { Type, Value, type Static } from '@core/utils/typeboxHelpers'

export const AuditActionSchema = Type.Union([
  Type.Literal('login.success'),
  Type.Literal('login.failure'),
  Type.Literal('logout'),
  Type.Literal('user.create'),
  Type.Literal('user.update'),
  Type.Literal('user.delete'),
  Type.Literal('user.suspend'),
  Type.Literal('password.change'),
  Type.Literal('role.create'),
  Type.Literal('role.update'),
  Type.Literal('role.delete'),
  Type.Literal('role.assign'),
  Type.Literal('content.author.assign'),
  Type.Literal('publish'),
  Type.Literal('plugin.install'),
  Type.Literal('plugin.enable'),
  Type.Literal('plugin.disable'),
  Type.Literal('plugin.delete'),
])

export const AuditMetadataSchema = Type.Record(
  Type.String(),
  Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null(), Type.Array(Type.String())]),
)

export type AuditAction = Static<typeof AuditActionSchema>
export type AuditMetadata = Static<typeof AuditMetadataSchema>

interface AuditEventRow {
  id: string
  actor_user_id: string | null
  action: AuditAction
  target_type: string | null
  target_id: string | null
  metadata_json: unknown
  ip_address: string | null
  user_agent: string | null
  created_at: Date | string
}

export interface AuditEvent {
  id: string
  actorUserId: string | null
  action: AuditAction
  targetType: string | null
  targetId: string | null
  metadata: AuditMetadata
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

function normalizeMetadata(value: unknown): AuditMetadata {
  return Value.Check(AuditMetadataSchema, value) ? Value.Decode(AuditMetadataSchema, value) : {}
}

function rowToAuditEvent(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: normalizeMetadata(row.metadata_json),
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function createAuditEvent(
  db: DbClient,
  input: {
    actorUserId: string | null
    action: AuditAction
    targetType?: string | null
    targetId?: string | null
    metadata?: AuditMetadata
    ipAddress?: string | null
    userAgent?: string | null
  },
): Promise<void> {
  await db`
    insert into audit_events (id, actor_user_id, action, target_type, target_id, metadata_json, ip_address, user_agent)
    values (
      ${nanoid()},
      ${input.actorUserId},
      ${input.action},
      ${input.targetType ?? null},
      ${input.targetId ?? null},
      ${input.metadata ?? {}},
      ${input.ipAddress ?? null},
      ${input.userAgent ?? null}
    )
  `
}

export async function listAuditEvents(db: DbClient, limit = 100): Promise<AuditEvent[]> {
  const { rows } = await db<AuditEventRow>`
    select id, actor_user_id, action, target_type, target_id, metadata_json, ip_address, user_agent, created_at
    from audit_events
    order by created_at desc
    limit ${limit}
  `
  return rows.map(rowToAuditEvent)
}

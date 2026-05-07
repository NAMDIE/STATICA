import type { DbClient } from '../db/client'

interface SetupStatus {
  hasSite: boolean
  hasAdmin: boolean
  hasOwner: boolean
  needsSetup: boolean
}

export async function getSetupStatus(db: DbClient): Promise<SetupStatus> {
  const [site, owner] = await Promise.all([
    db<{ count: number }>`select count(*) as count from site`,
    db<{ count: number }>`
      select count(*) as count
      from users
      where role_id = ${'owner'}
        and status = ${'active'}
        and deleted_at is null
    `,
  ])
  const hasSite = Number(site.rows[0]?.count ?? 0) > 0
  const hasOwner = Number(owner.rows[0]?.count ?? 0) > 0
  return { hasSite, hasAdmin: hasOwner, hasOwner, needsSetup: !hasSite || !hasOwner }
}

export async function createSite(
  db: DbClient,
  name: string,
  settings: Record<string, unknown>,
): Promise<void> {
  await db`
    insert into site (id, name, settings_json)
    values ('default', ${name}, ${settings})
    on conflict (id) do update
      set name = excluded.name,
          settings_json = excluded.settings_json,
          updated_at = current_timestamp
  `
}

/**
 * CRUD for content entries.
 *
 *   listContentEntries             — list non-deleted entries in a collection,
 *                                    optionally restricted to entries owned
 *                                    by the calling user
 *   getContentEntry                — read a single entry by id with hydrated
 *                                    author / createdBy / updatedBy / publishedBy
 *                                    user references
 *   listContentAuthorOptions       — list active users for the author picker
 *   createContentEntry             — insert a new draft
 *   saveContentEntryDraft          — overwrite the draft fields
 *   softDeleteContentEntry         — set deleted_at
 *   updateContentEntryCollection   — move an entry to another collection
 *                                    (rejects on slug conflict)
 *   updateContentEntryStatus       — flip between draft / unpublished
 *                                    (clears published metadata)
 *   updateContentEntryAuthor       — reassign the author user id
 *
 * Mutations (other than soft-delete) always RETURN id only, then re-read the
 * hydrated entry through `getContentEntry` so callers receive consistently
 * populated user references. Soft-delete is the one exception: a soft-deleted
 * row is filtered out by `getContentEntry`'s `deleted_at is null` clause, so
 * the row is mapped directly from RETURNING (without user references — the
 * delete handler only consumes id / collectionId / slug for audit logging).
 */
import { nanoid } from 'nanoid'
import type { DbClient } from '../../db/client'
import type { ContentEntry, ContentUserReference } from '@core/content/schemas'
import {
  mapAuthorOption,
  mapEntry,
  type ContentAuthorRow,
  type ContentEntryRow,
  type UpdateContentEntryCollectionResult,
} from './rowMapping'

interface CreateContentEntryInput {
  id?: string
  collectionId: string
  title: string
  slug: string
  bodyMarkdown?: string
  featuredMediaId?: string | null
  seoTitle?: string
  seoDescription?: string
}

interface SaveContentEntryDraftInput {
  title: string
  slug: string
  bodyMarkdown: string
  featuredMediaId: string | null
  seoTitle: string
  seoDescription: string
}

interface ListContentEntriesVisibility {
  /**
   * If set, only entries authored or (when no author is assigned) created by
   * this user are returned. Used by the editor list to scope visibility for
   * roles that can only see their own content.
   */
  ownerUserId?: string | null
}

/**
 * Tests whether the calling user (`ownerUserId`) is the effective owner of
 * `entry`. The author overrides; if no author is assigned, falls back to the
 * creator. Mirrors the SQL filter previously inlined in `listContentEntries`.
 */
function isOwnedByUser(entry: ContentEntry, ownerUserId: string): boolean {
  if (entry.authorUserId === ownerUserId) return true
  if (entry.authorUserId === undefined || entry.authorUserId === null) {
    return entry.createdByUserId === ownerUserId
  }
  return false
}

export async function listContentEntries(
  db: DbClient,
  collectionId: string,
  visibility: ListContentEntriesVisibility = {},
): Promise<ContentEntry[]> {
  const { rows } = await db<ContentEntryRow>`
    select content_entries.id,
           content_entries.collection_id,
           content_entries.title,
           content_entries.slug,
           content_entries.status,
           content_entries.body_markdown,
           content_entries.featured_media_id,
           content_entries.seo_title,
           content_entries.seo_description,
           content_entries.author_user_id,
           content_entries.created_by_user_id,
           content_entries.updated_by_user_id,
           content_entries.published_by_user_id,
           author_users.email as author_email,
           author_users.display_name as author_display_name,
           author_roles.slug as author_role_slug,
           author_roles.name as author_role_name,
           creator_users.email as created_by_email,
           creator_users.display_name as created_by_display_name,
           creator_roles.slug as created_by_role_slug,
           creator_roles.name as created_by_role_name,
           updater_users.email as updated_by_email,
           updater_users.display_name as updated_by_display_name,
           updater_roles.slug as updated_by_role_slug,
           updater_roles.name as updated_by_role_name,
           publisher_users.email as published_by_email,
           publisher_users.display_name as published_by_display_name,
           publisher_roles.slug as published_by_role_slug,
           publisher_roles.name as published_by_role_name,
           content_entries.created_at,
           content_entries.updated_at,
           content_entries.published_at,
           content_entries.deleted_at
    from content_entries
    left join users author_users on author_users.id = content_entries.author_user_id
    left join roles author_roles on author_roles.id = author_users.role_id
    left join users creator_users on creator_users.id = content_entries.created_by_user_id
    left join roles creator_roles on creator_roles.id = creator_users.role_id
    left join users updater_users on updater_users.id = content_entries.updated_by_user_id
    left join roles updater_roles on updater_roles.id = updater_users.role_id
    left join users publisher_users on publisher_users.id = content_entries.published_by_user_id
    left join roles publisher_roles on publisher_roles.id = publisher_users.role_id
    where content_entries.collection_id = ${collectionId}
      and content_entries.deleted_at is null
    order by content_entries.updated_at desc, content_entries.created_at desc
  `
  const entries = rows.map(mapEntry)
  if (visibility.ownerUserId) {
    const ownerUserId = visibility.ownerUserId
    return entries.filter((entry) => isOwnedByUser(entry, ownerUserId))
  }
  return entries
}

export async function getContentEntry(
  db: DbClient,
  entryId: string,
): Promise<ContentEntry | null> {
  const { rows } = await db<ContentEntryRow>`
    select content_entries.id,
           content_entries.collection_id,
           content_entries.title,
           content_entries.slug,
           content_entries.status,
           content_entries.body_markdown,
           content_entries.featured_media_id,
           content_entries.seo_title,
           content_entries.seo_description,
           content_entries.author_user_id,
           content_entries.created_by_user_id,
           content_entries.updated_by_user_id,
           content_entries.published_by_user_id,
           author_users.email as author_email,
           author_users.display_name as author_display_name,
           author_roles.slug as author_role_slug,
           author_roles.name as author_role_name,
           creator_users.email as created_by_email,
           creator_users.display_name as created_by_display_name,
           creator_roles.slug as created_by_role_slug,
           creator_roles.name as created_by_role_name,
           updater_users.email as updated_by_email,
           updater_users.display_name as updated_by_display_name,
           updater_roles.slug as updated_by_role_slug,
           updater_roles.name as updated_by_role_name,
           publisher_users.email as published_by_email,
           publisher_users.display_name as published_by_display_name,
           publisher_roles.slug as published_by_role_slug,
           publisher_roles.name as published_by_role_name,
           content_entries.created_at,
           content_entries.updated_at,
           content_entries.published_at,
           content_entries.deleted_at
    from content_entries
    left join users author_users on author_users.id = content_entries.author_user_id
    left join roles author_roles on author_roles.id = author_users.role_id
    left join users creator_users on creator_users.id = content_entries.created_by_user_id
    left join roles creator_roles on creator_roles.id = creator_users.role_id
    left join users updater_users on updater_users.id = content_entries.updated_by_user_id
    left join roles updater_roles on updater_roles.id = updater_users.role_id
    left join users publisher_users on publisher_users.id = content_entries.published_by_user_id
    left join roles publisher_roles on publisher_roles.id = publisher_users.role_id
    where content_entries.id = ${entryId}
      and content_entries.deleted_at is null
    limit 1
  `
  return rows[0] ? mapEntry(rows[0]) : null
}

export async function listContentAuthorOptions(db: DbClient): Promise<ContentUserReference[]> {
  const { rows } = await db<ContentAuthorRow>`
    select users.id,
           users.email,
           users.display_name,
           roles.slug as role_slug,
           roles.name as role_name
    from users
    join roles on roles.id = users.role_id
    where users.deleted_at is null
      and users.status = ${'active'}
    order by users.display_name asc, users.email asc
  `
  return rows.flatMap((row) => {
    const ref = mapAuthorOption(row)
    return ref ? [ref] : []
  })
}

export async function createContentEntry(
  db: DbClient,
  input: CreateContentEntryInput,
  actorUserId: string | null = null,
): Promise<ContentEntry> {
  const { rows } = await db<{ id: string }>`
    insert into content_entries (
      id,
      collection_id,
      title,
      slug,
      status,
      body_markdown,
      featured_media_id,
      seo_title,
      seo_description,
      author_user_id,
      created_by_user_id,
      updated_by_user_id
    )
    values (
      ${input.id ?? nanoid()},
      ${input.collectionId},
      ${input.title},
      ${input.slug},
      ${'draft'},
      ${input.bodyMarkdown ?? ''},
      ${input.featuredMediaId ?? null},
      ${input.seoTitle ?? ''},
      ${input.seoDescription ?? ''},
      ${actorUserId},
      ${actorUserId},
      ${actorUserId}
    )
    returning id
  `
  const created = await getContentEntry(db, rows[0].id)
  if (!created) throw new Error('content entry was created but could not be re-read')
  return created
}

export async function saveContentEntryDraft(
  db: DbClient,
  entryId: string,
  input: SaveContentEntryDraftInput,
  actorUserId: string | null = null,
): Promise<ContentEntry | null> {
  const { rows } = await db<{ id: string }>`
    update content_entries
    set title = ${input.title},
        slug = ${input.slug},
        body_markdown = ${input.bodyMarkdown},
        featured_media_id = ${input.featuredMediaId},
        seo_title = ${input.seoTitle},
        seo_description = ${input.seoDescription},
        updated_by_user_id = ${actorUserId},
        updated_at = current_timestamp
    where id = ${entryId}
      and deleted_at is null
    returning id
  `
  return rows[0] ? getContentEntry(db, rows[0].id) : null
}

/**
 * Soft-delete is the one mutation that returns the row directly from
 * RETURNING rather than re-reading via `getContentEntry`: the row now has
 * `deleted_at` set, so `getContentEntry`'s `deleted_at is null` filter would
 * mask it. The handler only consumes the id / collectionId / slug for audit
 * logging, so the absence of hydrated user references on the returned shape
 * is acceptable.
 */
export async function softDeleteContentEntry(
  db: DbClient,
  entryId: string,
  actorUserId: string | null = null,
): Promise<ContentEntry | null> {
  const { rows } = await db<ContentEntryRow>`
    update content_entries
    set deleted_at = current_timestamp,
        updated_by_user_id = ${actorUserId},
        updated_at = current_timestamp
    where id = ${entryId}
      and deleted_at is null
    returning id, collection_id, title, slug, status, body_markdown, featured_media_id,
              seo_title, seo_description, author_user_id, created_by_user_id,
              updated_by_user_id, published_by_user_id, created_at, updated_at,
              published_at, deleted_at
  `
  return rows[0] ? mapEntry(rows[0]) : null
}

/**
 * Move an entry to another collection. Refuses if the target collection is
 * missing or already has an entry with the same slug. Returns a discriminated
 * union so handlers can map the failure mode to the right HTTP status.
 */
export async function updateContentEntryCollection(
  db: DbClient,
  entryId: string,
  collectionId: string,
  actorUserId: string | null = null,
): Promise<UpdateContentEntryCollectionResult> {
  const entry = await getContentEntry(db, entryId)
  if (!entry) return { ok: false, reason: 'entry_not_found' }
  if (entry.collectionId === collectionId) return { ok: true, entry }

  const { rows: collectionRows } = await db<{ id: string }>`
    select id from content_collections
    where id = ${collectionId}
      and deleted_at is null
    limit 1
  `
  if (!collectionRows[0]) return { ok: false, reason: 'collection_not_found' }

  const { rows: conflictRows } = await db<{ id: string }>`
    select id from content_entries
    where collection_id = ${collectionId}
      and slug = ${entry.slug}
      and id <> ${entryId}
      and deleted_at is null
    limit 1
  `
  if (conflictRows[0]) return { ok: false, reason: 'slug_conflict' }

  const { rows } = await db<{ id: string }>`
    update content_entries
    set collection_id = ${collectionId},
        updated_by_user_id = ${actorUserId},
        updated_at = current_timestamp
    where id = ${entryId}
      and deleted_at is null
    returning id
  `
  if (!rows[0]) return { ok: false, reason: 'entry_not_found' }
  const updated = await getContentEntry(db, rows[0].id)
  if (!updated) return { ok: false, reason: 'entry_not_found' }
  return { ok: true, entry: updated }
}

/**
 * Flip an entry between `draft` and `unpublished` (the only states reachable
 * from this endpoint — `published` goes through the dedicated publish flow).
 * Always clears the `published_at` / `published_by_user_id` columns since
 * neither remains meaningful in the new state.
 */
export async function updateContentEntryStatus(
  db: DbClient,
  entryId: string,
  status: 'draft' | 'unpublished',
  actorUserId: string | null = null,
): Promise<ContentEntry | null> {
  const { rows } = await db<{ id: string }>`
    update content_entries
    set status = ${status},
        published_at = null,
        published_by_user_id = null,
        updated_by_user_id = ${actorUserId},
        updated_at = current_timestamp
    where id = ${entryId}
      and deleted_at is null
    returning id
  `
  return rows[0] ? getContentEntry(db, rows[0].id) : null
}

export async function updateContentEntryAuthor(
  db: DbClient,
  entryId: string,
  authorUserId: string,
  actorUserId: string | null = null,
): Promise<ContentEntry | null> {
  const { rows } = await db<{ id: string }>`
    update content_entries
    set author_user_id = ${authorUserId},
        updated_by_user_id = ${actorUserId},
        updated_at = current_timestamp
    where id = ${entryId}
      and deleted_at is null
    returning id
  `
  return rows[0] ? getContentEntry(db, rows[0].id) : null
}

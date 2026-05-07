/**
 * CRUD for content collections.
 *
 *   listContentCollections        — read every non-deleted collection
 *   createContentCollection       — insert a new collection
 *   updateContentCollection       — partial update (all fields optional)
 *   softDeleteContentCollection   — set deleted_at; refuses if entries exist
 *                                   or if it's the seeded `posts` collection
 */
import { nanoid } from 'nanoid'
import type { DbClient } from '../../db/client'
import { normalizeRouteBase } from '@core/templates/templateMatching'
import { normalizeContentCollectionFields } from '@core/content/fields'
import type {
  ContentCollection,
  ContentCollectionFields,
} from '@core/content/schemas'
import { mapCollection, type ContentCollectionRow } from './rowMapping'

/**
 * Repository-level inputs accept the same fields as the public schema, but
 * with `slug`, `singularLabel`, and `pluralLabel` required (the handlers
 * always derive them from `name` if missing) plus optional id and audit
 * columns.
 */
interface CreateContentCollectionInput {
  id?: string
  name: string
  slug: string
  routeBase?: string
  singularLabel: string
  pluralLabel: string
  fields?: ContentCollectionFields
  createdByUserId?: string | null
  updatedByUserId?: string | null
}

interface UpdateContentCollectionInput {
  name?: string
  slug?: string
  routeBase?: string
  singularLabel?: string
  pluralLabel?: string
  fields?: ContentCollectionFields
  updatedByUserId?: string | null
}

export async function listContentCollections(db: DbClient): Promise<ContentCollection[]> {
  const { rows } = await db<ContentCollectionRow>`
    select id, name, slug, route_base, singular_label, plural_label, fields_json,
           created_by_user_id, updated_by_user_id, created_at, updated_at
    from content_collections
    where deleted_at is null
    order by created_at asc
  `
  return rows.map(mapCollection)
}

export async function createContentCollection(
  db: DbClient,
  input: CreateContentCollectionInput,
): Promise<ContentCollection> {
  const fields = normalizeContentCollectionFields(input.fields)
  const { rows } = await db<ContentCollectionRow>`
    insert into content_collections (
      id,
      name,
      slug,
      route_base,
      singular_label,
      plural_label,
      fields_json,
      created_by_user_id,
      updated_by_user_id
    )
    values (
      ${input.id ?? nanoid()},
      ${input.name},
      ${input.slug},
      ${normalizeRouteBase(input.routeBase ?? input.slug)},
      ${input.singularLabel},
      ${input.pluralLabel},
      ${fields},
      ${input.createdByUserId ?? null},
      ${input.updatedByUserId ?? input.createdByUserId ?? null}
    )
    returning id, name, slug, route_base, singular_label, plural_label, fields_json,
              created_by_user_id, updated_by_user_id, created_at, updated_at
  `
  return mapCollection(rows[0])
}

export async function updateContentCollection(
  db: DbClient,
  collectionId: string,
  input: UpdateContentCollectionInput,
): Promise<ContentCollection | null> {
  const fields = input.fields === undefined ? null : normalizeContentCollectionFields(input.fields)
  const routeBase = input.routeBase === undefined ? null : normalizeRouteBase(input.routeBase)
  const { rows } = await db<ContentCollectionRow>`
    update content_collections
    set name = coalesce(${input.name ?? null}, name),
        slug = coalesce(${input.slug ?? null}, slug),
        route_base = coalesce(${routeBase}, route_base),
        singular_label = coalesce(${input.singularLabel ?? null}, singular_label),
        plural_label = coalesce(${input.pluralLabel ?? null}, plural_label),
        fields_json = coalesce(${fields}, fields_json),
        updated_by_user_id = coalesce(${input.updatedByUserId ?? null}, updated_by_user_id),
        updated_at = current_timestamp
    where id = ${collectionId}
      and deleted_at is null
    returning id, name, slug, route_base, singular_label, plural_label, fields_json,
              created_by_user_id, updated_by_user_id, created_at, updated_at
  `
  return rows[0] ? mapCollection(rows[0]) : null
}

/**
 * Refuses to delete the seeded `posts` collection or any collection that
 * still contains non-deleted entries. Both are guard rails enforced at the
 * repository layer rather than the handler so other callers (e.g. CLI tools)
 * inherit the safety check.
 */
export async function softDeleteContentCollection(
  db: DbClient,
  collectionId: string,
  actorUserId: string | null = null,
): Promise<ContentCollection | null> {
  if (collectionId === 'posts') return null

  const { rows: countRows } = await db<{ count: number }>`
    select count(*) as count
    from content_entries
    where collection_id = ${collectionId}
      and deleted_at is null
  `
  if (Number(countRows[0]?.count ?? 0) > 0) return null

  const { rows } = await db<ContentCollectionRow>`
    update content_collections
    set deleted_at = current_timestamp,
        updated_by_user_id = ${actorUserId},
        updated_at = current_timestamp
    where id = ${collectionId}
      and deleted_at is null
    returning id, name, slug, route_base, singular_label, plural_label, fields_json,
              created_by_user_id, updated_by_user_id, created_at, updated_at
  `
  return rows[0] ? mapCollection(rows[0]) : null
}

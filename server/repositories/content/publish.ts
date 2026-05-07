/**
 * Publishing flow + public-route lookups for content entries.
 *
 *   publishContentEntry              — append a new content_entry_versions row,
 *                                      flip the entry to `published`, and (when
 *                                      the slug changed) record a redirect from
 *                                      the previous public path
 *   getPublishedContentEntryByRoute  — resolve a public URL to the active
 *                                      published version of an entry
 *   getContentEntryRedirectByRoute   — resolve a public URL to a redirect
 *                                      target when the URL belongs to a
 *                                      previously-published slug
 */
import { nanoid } from 'nanoid'
import type { DbClient } from '../../db/client'
import type { ContentEntry } from '@core/content/schemas'
import { normalizeRouteBase } from '@core/templates/templateMatching'
import {
  mapPublishedEntry,
  mapRedirect,
  publicContentPath,
  type ContentEntryRedirect,
  type ContentEntryRedirectRow,
  type ContentEntryVersion,
  type PreviousPublishedRouteRow,
  type PublishedContentEntry,
  type PublishedContentEntryRow,
} from './rowMapping'
import { getContentEntry } from './entries'

export type { PublishedContentEntry, ContentEntryRedirect } from './rowMapping'

interface PublishContentEntryResult {
  entry: ContentEntry
  version: ContentEntryVersion
}

export async function publishContentEntry(
  db: DbClient,
  entryId: string,
  publisherUserId: string,
): Promise<PublishContentEntryResult> {
  return db.transaction(async (tx) => {
    const entry = await getContentEntry(tx, entryId)
    if (!entry) throw new Error('content entry not found')

    const previousRoute = await readPreviousPublishedRoute(tx, entryId)
    const versionNumber = await nextVersionNumber(tx, entryId)
    const versionId = nanoid()

    await tx`
      insert into content_entry_versions
        (
          id,
          entry_id,
          version_number,
          title,
          slug,
          body_markdown,
          featured_media_id,
          seo_title,
          seo_description,
          published_by_user_id
        )
      values (
        ${versionId},
        ${entry.id},
        ${versionNumber},
        ${entry.title},
        ${entry.slug},
        ${entry.bodyMarkdown},
        ${entry.featuredMediaId},
        ${entry.seoTitle},
        ${entry.seoDescription},
        ${publisherUserId}
      )
    `

    const { rows: updateRows } = await tx<{ id: string }>`
      update content_entries
      set status = 'published',
          active_version_id = ${versionId},
          published_by_user_id = ${publisherUserId},
          published_at = current_timestamp,
          updated_by_user_id = ${publisherUserId},
          updated_at = current_timestamp
      where id = ${entry.id}
        and deleted_at is null
      returning id
    `
    if (!updateRows[0]) throw new Error('content entry publish update failed')

    if (previousRoute && previousRouteChanged(previousRoute, entry.slug)) {
      await tx`
        insert into content_entry_redirects (id, collection_id, from_route_base, from_slug, target_entry_id)
        values (
          ${nanoid()},
          ${entry.collectionId},
          ${normalizeRouteBase(previousRoute.previous_route_base)},
          ${previousRoute.previous_slug},
          ${entry.id}
        )
        on conflict (from_route_base, from_slug) do update
          set collection_id = excluded.collection_id,
              target_entry_id = excluded.target_entry_id
      `
    }

    const publishedEntry = await getContentEntry(tx, entry.id)
    if (!publishedEntry) throw new Error('content entry could not be re-read after publish')

    return {
      entry: publishedEntry,
      version: buildVersionRecord({
        versionId,
        versionNumber,
        publisherUserId,
        entry: publishedEntry,
      }),
    }
  })
}

async function readPreviousPublishedRoute(
  db: DbClient,
  entryId: string,
): Promise<PreviousPublishedRouteRow | null> {
  const { rows } = await db<PreviousPublishedRouteRow>`
    select content_entry_versions.slug as previous_slug,
           coalesce(nullif(content_collections.route_base, ''), '/' || content_collections.slug) as previous_route_base
    from content_entries
    join content_collections on content_collections.id = content_entries.collection_id
    join content_entry_versions on content_entry_versions.id = content_entries.active_version_id
    where content_entries.id = ${entryId}
      and content_entries.deleted_at is null
      and content_collections.deleted_at is null
    limit 1
  `
  return rows[0] ?? null
}

async function nextVersionNumber(db: DbClient, entryId: string): Promise<number> {
  const { rows } = await db<{ next_version: number }>`
    select coalesce(max(version_number), 0) + 1 as next_version
    from content_entry_versions
    where entry_id = ${entryId}
  `
  return Number(rows[0]?.next_version ?? 1)
}

function previousRouteChanged(previous: PreviousPublishedRouteRow, currentSlug: string): boolean {
  return (
    previous.previous_slug.length > 0 &&
    publicContentPath(previous.previous_route_base, previous.previous_slug) !==
      publicContentPath(previous.previous_route_base, currentSlug)
  )
}

function buildVersionRecord(args: {
  versionId: string
  versionNumber: number
  publisherUserId: string
  entry: ContentEntry
}): ContentEntryVersion {
  const publishedAt = args.entry.publishedAt ?? new Date().toISOString()
  return {
    id: args.versionId,
    entryId: args.entry.id,
    versionNumber: args.versionNumber,
    title: args.entry.title,
    slug: args.entry.slug,
    bodyMarkdown: args.entry.bodyMarkdown,
    featuredMediaId: args.entry.featuredMediaId,
    seoTitle: args.entry.seoTitle,
    seoDescription: args.entry.seoDescription,
    publishedByUserId: args.publisherUserId,
    publishedAt,
    createdAt: publishedAt,
  }
}

export async function getPublishedContentEntryByRoute(
  db: DbClient,
  collectionRouteBase: string,
  entrySlug: string,
): Promise<PublishedContentEntry | null> {
  const { rows } = await db<PublishedContentEntryRow>`
    select content_entry_versions.id,
           content_entry_versions.entry_id,
           content_entries.collection_id,
           content_collections.slug as collection_slug,
           content_collections.route_base as collection_route_base,
           content_entry_versions.version_number,
           content_entry_versions.title,
           content_entry_versions.slug,
           content_entry_versions.body_markdown,
           content_entry_versions.featured_media_id,
           media_assets.public_path as featured_media_path,
           content_entry_versions.seo_title,
           content_entry_versions.seo_description,
           content_entries.author_user_id,
           author_users.display_name as author_display_name,
           author_roles.slug as author_role_slug,
           author_roles.name as author_role_name,
           content_entry_versions.published_by_user_id,
           publisher_users.display_name as published_by_display_name,
           publisher_roles.slug as published_by_role_slug,
           publisher_roles.name as published_by_role_name,
           content_entry_versions.published_at,
           content_entry_versions.created_at
    from content_entries
    join content_collections on content_collections.id = content_entries.collection_id
    join content_entry_versions on content_entry_versions.id = content_entries.active_version_id
    left join media_assets on media_assets.id = content_entry_versions.featured_media_id
    left join users author_users on author_users.id = content_entries.author_user_id
    left join roles author_roles on author_roles.id = author_users.role_id
    left join users publisher_users on publisher_users.id = content_entry_versions.published_by_user_id
    left join roles publisher_roles on publisher_roles.id = publisher_users.role_id
    where coalesce(nullif(content_collections.route_base, ''), '/' || content_collections.slug) = ${normalizeRouteBase(collectionRouteBase)}
      and content_entry_versions.slug = ${entrySlug}
      and content_entries.status = 'published'
      and content_entries.deleted_at is null
      and content_collections.deleted_at is null
    limit 1
  `
  return rows[0] ? mapPublishedEntry(rows[0]) : null
}

export async function getContentEntryRedirectByRoute(
  db: DbClient,
  collectionRouteBase: string,
  entrySlug: string,
): Promise<ContentEntryRedirect | null> {
  const { rows } = await db<ContentEntryRedirectRow>`
    select content_entry_redirects.id,
           content_entry_redirects.from_route_base,
           content_entry_redirects.from_slug,
           coalesce(nullif(target_collections.route_base, ''), '/' || target_collections.slug) as target_route_base,
           content_entry_versions.slug as target_slug
    from content_entry_redirects
    join content_entries target_entries on target_entries.id = content_entry_redirects.target_entry_id
    join content_collections target_collections on target_collections.id = target_entries.collection_id
    join content_entry_versions on content_entry_versions.id = target_entries.active_version_id
    where content_entry_redirects.from_route_base = ${normalizeRouteBase(collectionRouteBase)}
      and content_entry_redirects.from_slug = ${entrySlug}
      and target_entries.status = 'published'
      and target_entries.deleted_at is null
      and target_collections.deleted_at is null
    limit 1
  `
  return rows[0] ? mapRedirect(rows[0]) : null
}

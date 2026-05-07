/**
 * Row shapes, mappers, and small helpers shared across the content repository.
 *
 * Repository functions return domain objects — `ContentEntry`, `ContentCollection`,
 * `PublishedContentEntry`, etc. — that are derived by mapping raw DB rows. The
 * mappers, the row interfaces, and the shared utilities all live here so the
 * other repository modules (collections / entries / publish) focus solely on
 * the SQL they own.
 */
import { normalizeRouteBase } from '@core/templates/templateMatching'
import { normalizeContentCollectionFields } from '@core/content/fields'
import type {
  ContentCollection,
  ContentEntry,
  ContentEntryStatus,
  ContentUserReference,
} from '@core/content/schemas'

// ---------------------------------------------------------------------------
// Domain types not (yet) defined as TypeBox schemas in @core/content/schemas
// ---------------------------------------------------------------------------

export interface ContentEntryVersion {
  id: string
  entryId: string
  versionNumber: number
  title: string
  slug: string
  bodyMarkdown: string
  featuredMediaId: string | null
  seoTitle: string
  seoDescription: string
  publishedByUserId: string | null
  publishedAt: string
  createdAt: string
}

export interface PublishedContentEntry {
  id: string
  entryId: string
  collectionId: string
  collectionSlug: string
  collectionRouteBase: string
  versionNumber: number
  title: string
  slug: string
  bodyMarkdown: string
  featuredMediaId: string | null
  featuredMediaPath: string | null
  seoTitle: string
  seoDescription: string
  authorUserId: string | null
  authorName: string | null
  authorRoleSlug: string | null
  authorRoleName: string | null
  publishedByUserId: string | null
  publishedByName: string | null
  publishedByRoleSlug: string | null
  publishedByRoleName: string | null
  publishedAt: string
  createdAt: string
}

export interface ContentEntryRedirect {
  id: string
  fromPath: string
  targetPath: string
}

export type UpdateContentEntryCollectionResult =
  | { ok: true; entry: ContentEntry }
  | { ok: false; reason: 'entry_not_found' | 'collection_not_found' | 'slug_conflict' }

// ---------------------------------------------------------------------------
// Row shapes — the columns the repository SELECTs return
// ---------------------------------------------------------------------------

export interface ContentCollectionRow {
  id: string
  name: string
  slug: string
  route_base: string
  singular_label: string
  plural_label: string
  fields_json?: unknown
  created_by_user_id: string | null
  updated_by_user_id: string | null
  created_at: Date | string
  updated_at: Date | string
}

/**
 * Every column produced by the canonical "fetch entry with hydrated user
 * references" SELECT. The four user-ref groups (author, created_by,
 * updated_by, published_by) all share the same five-column shape:
 * `<group>_user_id`, `<group>_email`, `<group>_display_name`,
 * `<group>_role_slug`, `<group>_role_name`.
 */
export interface ContentEntryRow {
  id: string
  collection_id: string
  title: string
  slug: string
  status: ContentEntryStatus
  body_markdown: string
  featured_media_id: string | null
  seo_title: string
  seo_description: string
  author_user_id: string | null
  created_by_user_id: string | null
  updated_by_user_id: string | null
  published_by_user_id: string | null
  author_email?: string | null
  author_display_name?: string | null
  author_role_slug?: string | null
  author_role_name?: string | null
  created_by_email?: string | null
  created_by_display_name?: string | null
  created_by_role_slug?: string | null
  created_by_role_name?: string | null
  updated_by_email?: string | null
  updated_by_display_name?: string | null
  updated_by_role_slug?: string | null
  updated_by_role_name?: string | null
  published_by_email?: string | null
  published_by_display_name?: string | null
  published_by_role_slug?: string | null
  published_by_role_name?: string | null
  created_at: Date | string
  updated_at: Date | string
  published_at: Date | string | null
  deleted_at: Date | string | null
}

export interface ContentEntryVersionRow {
  id: string
  entry_id: string
  version_number: number
  title: string
  slug: string
  body_markdown: string
  featured_media_id: string | null
  seo_title: string
  seo_description: string
  published_by_user_id: string | null
  published_at: Date | string
  created_at: Date | string
}

export interface PublishedContentEntryRow extends ContentEntryVersionRow {
  collection_id: string
  collection_slug: string
  collection_route_base: string
  featured_media_path: string | null
  author_user_id: string | null
  author_display_name?: string | null
  author_role_slug?: string | null
  author_role_name?: string | null
  published_by_display_name?: string | null
  published_by_role_slug?: string | null
  published_by_role_name?: string | null
}

export interface PreviousPublishedRouteRow {
  previous_slug: string
  previous_route_base: string
}

export interface ContentEntryRedirectRow {
  id: string
  from_route_base: string
  from_slug: string
  target_route_base: string
  target_slug: string
}

export interface ContentAuthorRow {
  id: string
  email: string
  display_name: string | null
  role_slug: string | null
  role_name: string | null
}

// ---------------------------------------------------------------------------
// Tiny utility helpers
// ---------------------------------------------------------------------------

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toNullableIsoString(value: Date | string | null): string | null {
  return value ? toIsoString(value) : null
}

function nullableString(value: string | null | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function userReference(
  userId: string | null,
  email?: string | null,
  displayName?: string | null,
  roleSlug?: string | null,
  roleName?: string | null,
): ContentUserReference | null {
  if (!userId) return null
  return {
    id: userId,
    email: email ?? '',
    displayName: displayName ?? email ?? userId,
    roleSlug: roleSlug ?? null,
    roleName: roleName ?? null,
  }
}

/**
 * The user-join groups produced by the canonical entry SELECT all share the
 * same five-column layout. This helper extracts the user reference for any
 * one of them based on the column prefix.
 */
type UserJoinPrefix = 'author' | 'created_by' | 'updated_by' | 'published_by'

function userReferenceFromRow(
  row: ContentEntryRow,
  prefix: UserJoinPrefix,
): ContentUserReference | null {
  const idCol = `${prefix}_user_id` as const
  const emailCol = `${prefix}_email` as const
  const displayCol = `${prefix}_display_name` as const
  const slugCol = `${prefix}_role_slug` as const
  const nameCol = `${prefix}_role_name` as const
  return userReference(
    nullableString(row[idCol]),
    nullableString(row[emailCol]),
    nullableString(row[displayCol]),
    nullableString(row[slugCol]),
    nullableString(row[nameCol]),
  )
}

// ---------------------------------------------------------------------------
// Mappers — row → domain object
// ---------------------------------------------------------------------------

export function mapCollection(row: ContentCollectionRow): ContentCollection {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    routeBase: row.route_base ? normalizeRouteBase(row.route_base) : normalizeRouteBase(row.slug),
    singularLabel: row.singular_label,
    pluralLabel: row.plural_label,
    fields: normalizeContentCollectionFields(row.fields_json),
    createdByUserId: nullableString(row.created_by_user_id),
    updatedByUserId: nullableString(row.updated_by_user_id),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  }
}

export function mapEntry(row: ContentEntryRow): ContentEntry {
  return {
    id: row.id,
    collectionId: row.collection_id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    bodyMarkdown: row.body_markdown,
    featuredMediaId: row.featured_media_id,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    authorUserId: nullableString(row.author_user_id),
    createdByUserId: nullableString(row.created_by_user_id),
    updatedByUserId: nullableString(row.updated_by_user_id),
    publishedByUserId: nullableString(row.published_by_user_id),
    author: userReferenceFromRow(row, 'author'),
    createdBy: userReferenceFromRow(row, 'created_by'),
    updatedBy: userReferenceFromRow(row, 'updated_by'),
    publishedBy: userReferenceFromRow(row, 'published_by'),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    publishedAt: toNullableIsoString(row.published_at),
    deletedAt: toNullableIsoString(row.deleted_at),
  }
}

function mapVersion(row: ContentEntryVersionRow): ContentEntryVersion {
  return {
    id: row.id,
    entryId: row.entry_id,
    versionNumber: Number(row.version_number),
    title: row.title,
    slug: row.slug,
    bodyMarkdown: row.body_markdown,
    featuredMediaId: row.featured_media_id,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    publishedByUserId: nullableString(row.published_by_user_id),
    publishedAt: toIsoString(row.published_at),
    createdAt: toIsoString(row.created_at),
  }
}

export function mapPublishedEntry(row: PublishedContentEntryRow): PublishedContentEntry {
  return {
    ...mapVersion(row),
    collectionId: row.collection_id,
    collectionSlug: row.collection_slug,
    collectionRouteBase: row.collection_route_base
      ? normalizeRouteBase(row.collection_route_base)
      : normalizeRouteBase(row.collection_slug),
    featuredMediaPath: row.featured_media_path,
    authorUserId: nullableString(row.author_user_id),
    authorName: nullableString(row.author_display_name),
    authorRoleSlug: nullableString(row.author_role_slug),
    authorRoleName: nullableString(row.author_role_name),
    publishedByUserId: nullableString(row.published_by_user_id),
    publishedByName: nullableString(row.published_by_display_name),
    publishedByRoleSlug: nullableString(row.published_by_role_slug),
    publishedByRoleName: nullableString(row.published_by_role_name),
  }
}

export function mapAuthorOption(row: ContentAuthorRow): ContentUserReference | null {
  return userReference(
    row.id,
    nullableString(row.email),
    nullableString(row.display_name),
    nullableString(row.role_slug),
    nullableString(row.role_name),
  )
}

// ---------------------------------------------------------------------------
// Path helpers (shared by publish + redirect)
// ---------------------------------------------------------------------------

export function publicContentPath(routeBase: string, slug: string): string {
  const normalizedBase = normalizeRouteBase(routeBase)
  return `${normalizedBase === '/' ? '' : normalizedBase}/${slug}`
}

export function mapRedirect(row: ContentEntryRedirectRow): ContentEntryRedirect | null {
  const fromPath = publicContentPath(row.from_route_base, row.from_slug)
  const targetPath = publicContentPath(row.target_route_base, row.target_slug)
  if (fromPath === targetPath) return null
  return {
    id: row.id,
    fromPath,
    targetPath,
  }
}

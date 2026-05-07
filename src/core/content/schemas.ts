/**
 * Content module — TypeBox schemas and derived types.
 *
 * Schemas are the source of truth. Types are derived via `Static<typeof T>`.
 * No parallel TypeScript interfaces — schema definitions ARE the contract.
 */

import { Type, type Static } from '@sinclair/typebox'

// ---------------------------------------------------------------------------
// ContentEntryStatus
// ---------------------------------------------------------------------------

const ContentEntryStatusSchema = Type.Union([
  Type.Literal('draft'),
  Type.Literal('published'),
  Type.Literal('unpublished'),
])

export type ContentEntryStatus = Static<typeof ContentEntryStatusSchema>

// ---------------------------------------------------------------------------
// BuiltInContentCollectionField
// ---------------------------------------------------------------------------

const BuiltInContentCollectionFieldSchema = Type.Union([
  Type.Literal('body'),
  Type.Literal('featuredMedia'),
  Type.Literal('seo'),
])

export type BuiltInContentCollectionField = Static<typeof BuiltInContentCollectionFieldSchema>

// ---------------------------------------------------------------------------
// ContentCollectionBuiltInFields
// ---------------------------------------------------------------------------

const ContentCollectionBuiltInFieldsSchema = Type.Object({
  body: Type.Boolean(),
  featuredMedia: Type.Boolean(),
  seo: Type.Boolean(),
})


// ---------------------------------------------------------------------------
// ContentCustomFieldDefinition
// ---------------------------------------------------------------------------

const ContentCustomFieldDefinitionSchema = Type.Object({
  id: Type.String(),
  label: Type.String(),
  type: Type.String(),
})


// ---------------------------------------------------------------------------
// ContentCollectionFields
//
// Previously named ContentCollectionFieldSchema — renamed to drop the
// confusing *Schema suffix on a TypeScript type (not a TypeBox schema).
// ---------------------------------------------------------------------------

const ContentCollectionFieldsSchema = Type.Object({
  builtIn: ContentCollectionBuiltInFieldsSchema,
  custom: Type.Array(ContentCustomFieldDefinitionSchema),
})

export type ContentCollectionFields = Static<typeof ContentCollectionFieldsSchema>

// ---------------------------------------------------------------------------
// ContentCollection
// ---------------------------------------------------------------------------

const ContentCollectionSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  routeBase: Type.String(),
  singularLabel: Type.String(),
  pluralLabel: Type.String(),
  fields: Type.Optional(ContentCollectionFieldsSchema),
  createdByUserId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  updatedByUserId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  /** ISO datetime string from DB */
  createdAt: Type.String(),
  /** ISO datetime string from DB */
  updatedAt: Type.String(),
})

export type ContentCollection = Static<typeof ContentCollectionSchema>

// ---------------------------------------------------------------------------
// CreateContentCollectionInput
// ---------------------------------------------------------------------------

const CreateContentCollectionInputSchema = Type.Object({
  name: Type.String(),
  slug: Type.Optional(Type.String()),
  routeBase: Type.Optional(Type.String()),
  singularLabel: Type.Optional(Type.String()),
  pluralLabel: Type.Optional(Type.String()),
  fields: Type.Optional(ContentCollectionFieldsSchema),
})

export type CreateContentCollectionInput = Static<typeof CreateContentCollectionInputSchema>

// ---------------------------------------------------------------------------
// UpdateContentCollectionInput
// ---------------------------------------------------------------------------

const UpdateContentCollectionInputSchema = Type.Object({
  name: Type.Optional(Type.String()),
  slug: Type.Optional(Type.String()),
  routeBase: Type.Optional(Type.String()),
  singularLabel: Type.Optional(Type.String()),
  pluralLabel: Type.Optional(Type.String()),
  fields: Type.Optional(ContentCollectionFieldsSchema),
})

export type UpdateContentCollectionInput = Static<typeof UpdateContentCollectionInputSchema>

// ---------------------------------------------------------------------------
// ContentUserReference
// ---------------------------------------------------------------------------

const ContentUserReferenceSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  displayName: Type.String(),
  roleSlug: Type.Union([Type.String(), Type.Null()]),
  roleName: Type.Union([Type.String(), Type.Null()]),
})

export type ContentUserReference = Static<typeof ContentUserReferenceSchema>

const NullableContentUserReferenceSchema = Type.Union([ContentUserReferenceSchema, Type.Null()])
const NullableUserIdSchema = Type.Union([Type.String(), Type.Null()])

// ---------------------------------------------------------------------------
// ContentEntry
// ---------------------------------------------------------------------------

const ContentEntrySchema = Type.Object({
  id: Type.String(),
  collectionId: Type.String(),
  title: Type.String(),
  slug: Type.String(),
  status: ContentEntryStatusSchema,
  bodyMarkdown: Type.String(),
  featuredMediaId: Type.Union([Type.String(), Type.Null()]),
  seoTitle: Type.String(),
  seoDescription: Type.String(),
  // The user-reference columns are always populated by the repository mappers
  // (`null` when no user is assigned), so the schema models them as required
  // nullables rather than optionals. Handlers and admin UI code can assume
  // every key is present.
  authorUserId: NullableUserIdSchema,
  createdByUserId: NullableUserIdSchema,
  updatedByUserId: NullableUserIdSchema,
  publishedByUserId: NullableUserIdSchema,
  author: NullableContentUserReferenceSchema,
  createdBy: NullableContentUserReferenceSchema,
  updatedBy: NullableContentUserReferenceSchema,
  publishedBy: NullableContentUserReferenceSchema,
  /** ISO datetime string from DB */
  createdAt: Type.String(),
  /** ISO datetime string from DB */
  updatedAt: Type.String(),
  publishedAt: Type.Union([Type.String(), Type.Null()]),
  deletedAt: Type.Union([Type.String(), Type.Null()]),
})

export type ContentEntry = Static<typeof ContentEntrySchema>

// ---------------------------------------------------------------------------
// ContentEntryDraftInput
// ---------------------------------------------------------------------------

const ContentEntryDraftInputSchema = Type.Object({
  title: Type.String(),
  slug: Type.String(),
  bodyMarkdown: Type.String(),
  featuredMediaId: Type.Union([Type.String(), Type.Null()]),
  seoTitle: Type.String(),
  seoDescription: Type.String(),
})

export type ContentEntryDraftInput = Static<typeof ContentEntryDraftInputSchema>

// ---------------------------------------------------------------------------
// CreateContentEntryInput
// ---------------------------------------------------------------------------

const CreateContentEntryInputSchema = Type.Object({
  title: Type.String(),
  slug: Type.Optional(Type.String()),
  bodyMarkdown: Type.Optional(Type.String()),
  featuredMediaId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  seoTitle: Type.Optional(Type.String()),
  seoDescription: Type.Optional(Type.String()),
})

export type CreateContentEntryInput = Static<typeof CreateContentEntryInputSchema>

// ---------------------------------------------------------------------------
// UpdateContentEntryCollectionInput
// ---------------------------------------------------------------------------

const UpdateContentEntryCollectionInputSchema = Type.Object({
  collectionId: Type.String(),
})

export type UpdateContentEntryCollectionInput = Static<typeof UpdateContentEntryCollectionInputSchema>

// ---------------------------------------------------------------------------
// ContentMediaType
// ---------------------------------------------------------------------------

const ContentMediaTypeSchema = Type.Union([
  Type.Literal('image'),
  Type.Literal('video'),
])

export type ContentMediaType = Static<typeof ContentMediaTypeSchema>

// ---------------------------------------------------------------------------
// ContentBlock — discriminated union on `type`
// ---------------------------------------------------------------------------

const ContentBlockSchema = Type.Union([
  Type.Object({
    id: Type.String(),
    type: Type.Literal('paragraph'),
    text: Type.String(),
  }),
  Type.Object({
    id: Type.String(),
    type: Type.Literal('heading'),
    level: Type.Union([Type.Literal(2), Type.Literal(3), Type.Literal(4)]),
    text: Type.String(),
  }),
  Type.Object({
    id: Type.String(),
    type: Type.Literal('media'),
    mediaType: Type.Union([ContentMediaTypeSchema, Type.Null()]),
    src: Type.String(),
    alt: Type.String(),
  }),
])

export type ContentBlock = Static<typeof ContentBlockSchema>

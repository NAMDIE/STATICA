/**
 * Public surface of the content repository.
 *
 * The repository is split into three modules by responsibility:
 *
 *   collections.ts — content_collections CRUD
 *   entries.ts     — content_entries CRUD (drafts, status, author, move, delete)
 *   publish.ts     — content_entry_versions + redirects + public-route lookups
 *
 * Common row mappers, shared types, and tiny utilities live in `rowMapping.ts`.
 * Importers should keep using `import { ... } from '<path>/repositories/content'`
 * — this barrel re-exports everything they need.
 */
export {
  listContentCollections,
  createContentCollection,
  updateContentCollection,
  softDeleteContentCollection,
} from './collections'

export {
  listContentEntries,
  getContentEntry,
  listContentAuthorOptions,
  createContentEntry,
  saveContentEntryDraft,
  softDeleteContentEntry,
  updateContentEntryCollection,
  updateContentEntryStatus,
  updateContentEntryAuthor,
} from './entries'

export {
  publishContentEntry,
  getPublishedContentEntryByRoute,
  getContentEntryRedirectByRoute,
  type PublishedContentEntry,
} from './publish'

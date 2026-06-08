# Site Explorer Path Folders Design

This spec defines the Site Explorer folder model for routable pages and authored code files.

The source of truth for page URLs is `Page.slug` in `src/core/page-tree/page.ts`.
The source of truth for authored file locations is `SiteFile.path` in `src/core/files/schemas.ts`.
The Site Explorer derives structural folders from those two fields.

---

## TL;DR

- Pages, Styles, and Scripts use structural path folders.
- Templates and Components keep decorative folders in `site.explorer`.
- Page folder nesting is derived from slash-delimited `Page.slug` values.
- Style and script folder nesting is derived from slash-delimited `SiteFile.path` values.
- Folder rename, folder move, item move, and folder delete first produce an exact impact plan.
- The user confirms the impact before the store mutates.
- A blocked impact plan disables confirmation when any target slug/path is invalid or collides.
- Deleting a structural folder deletes every descendant page/file.
- Runtime script/style settings stay attached by file id during path rewrites and are removed on file deletion.

## Current State

`src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.tsx` renders Pages, Templates, Components, Styles, and Scripts through `SiteExplorerTreeSection`.

`src/core/page-tree/siteExplorer.ts` owns the persisted `SiteExplorerOrganization` shape:

```ts
type SiteExplorerOrganization = Record<SiteExplorerSectionId, {
  folders: SiteExplorerFolder[]
  items: SiteExplorerItemPlacement[]
}>
```

That model stores folders and item placements for all five sections. It is correct for non-routable concepts, but it gives Pages, Styles, and Scripts a second hierarchy that can disagree with public URLs and file paths.

Slash-delimited page slugs are already supported by `src/core/page-tree/slugs.ts`. Site import derives nested HTML routes in `src/core/siteImport/htmlPagePlan.ts`, so the import pipeline can produce paths that the Explorer presents as nested folders.

## Section Ownership

Site Explorer has two section kinds.

| Section | Folder kind | Source of truth |
|---|---|---|
| Pages | Structural | `Page.slug` |
| Styles | Structural | `SiteFile.path` where `file.type === 'style'` |
| Scripts | Structural | `SiteFile.path` where `file.type === 'script'` |
| Templates | Decorative | `site.explorer.templates` |
| Components | Decorative | `site.explorer.components` |

Structural sections do not persist item membership in folders. Membership is derived from the path segments of each item.

Decorative sections keep the existing `folders` and `items` placement arrays because templates and components do not have public URL or filesystem path semantics.

## Persisted Explorer Shape

Replace the all-sections organization model with one shape that separates structural UI state from decorative organization.

```ts
type StructuralExplorerSectionId = 'pages' | 'styles' | 'scripts'
type DecorativeExplorerSectionId = 'templates' | 'components'

type StructuralExplorerRowOrder = {
  kind: 'folder' | 'item'
  id: string        // folder path when kind is 'folder', item id when kind is 'item'
  parentPath?: string
  order: number
}

type StructuralExplorerSection = {
  expandedFolders: string[]
  emptyFolders: string[]
  rowOrder: StructuralExplorerRowOrder[]
}

type DecorativeExplorerSection = {
  folders: SiteExplorerFolder[]
  items: SiteExplorerItemPlacement[]
}

type SiteExplorerOrganization = {
  pages: StructuralExplorerSection
  styles: StructuralExplorerSection
  scripts: StructuralExplorerSection
  templates: DecorativeExplorerSection
  components: DecorativeExplorerSection
}
```

`expandedFolders` stores full folder paths such as `documentation/assets/js`.

`emptyFolders` stores full folder paths that have no descendant item yet. This supports an explicit New folder action without inventing item membership. Empty folders are not published and do not create pages or files. Once an item exists under the same path, the folder is still identified by that path and no separate folder id is needed.

`rowOrder` stores optional row ordering within a derived parent folder. It never decides membership. If a folder or item no longer belongs to the `parentPath` implied by an order entry, reconciliation drops that entry.

The parser in `src/core/page-tree/siteExplorer.ts` stays tolerant:

- Missing structural sections become empty `expandedFolders`, `emptyFolders`, and `rowOrder`.
- Invalid folder paths are dropped.
- Empty folder paths that collide with an item file path or page slug are dropped.
- Decorative sections parse the existing folder/item model.
- Stale decorative item placements are dropped during reconciliation.
- Stale structural order placements are dropped during reconciliation.

## Derived Structural Tree

Add a path tree model builder under `src/admin/pages/site/panels/SiteExplorerPanel/`.

The model consumes:

- `site.pages` for Pages.
- `site.files` for Styles and Scripts.
- `site.explorer[section].emptyFolders`.
- `site.explorer[section].expandedFolders`.
- `site.explorer[section].rowOrder`.

The model emits recursive rows:

```ts
type StructuralExplorerNode =
  | StructuralExplorerFolderNode
  | StructuralExplorerItemNode

type StructuralExplorerFolderNode = {
  kind: 'folder'
  path: string
  segment: string
  label: string
  landingItem?: StructuralExplorerItemNode
  children: StructuralExplorerNode[]
  empty: boolean
}

type StructuralExplorerItemNode = {
  kind: 'item'
  id: string
  label: string
  path: string
  meta: string
}
```

Folder identity is the full path. There are no structural folder ids.

### Pages

`Page.slug === 'index'` remains the homepage and renders as the pinned first Pages row.

For other pages:

- `documentation/getting-started` creates folder `documentation` and item `getting-started`.
- `documentation/assets/setup` creates folders `documentation` and `documentation/assets`.
- `documentation` is both a folder prefix and a route when descendants exist.

When a path prefix has a matching page slug and descendants, the folder node gets `landingItem`. Clicking the folder label opens the landing page; clicking the chevron expands/collapses. Context actions include both page actions and folder actions.

When a matching page has no descendants, it renders as a normal item row.

### Styles and Scripts

`SiteFile.path` segments build the tree.

For `documentation/assets/js/vendor/jquery.min.js`:

- `documentation`
- `documentation/assets`
- `documentation/assets/js`
- `documentation/assets/js/vendor`
- item `jquery.min.js`

Style and script rows keep their existing file id. Runtime config in `site.runtime.styles[file.id]`, `site.runtime.scripts[file.id]`, and the live editor `siteRuntime` mirror stays attached during path rewrites.

## Structural Operations

Structural operations do not directly mutate the site. They first create a plan.

```ts
type ExplorerPathChangePlan =
  | ExplorerPathRewritePlan
  | ExplorerPathDeletePlan

type ExplorerPathRewritePlan = {
  kind: 'rewrite'
  sectionId: StructuralExplorerSectionId
  operationLabel: string
  changes: ExplorerPathRewriteChange[]
  blockers: ExplorerPathChangeBlocker[]
  warnings: ExplorerPathChangeWarning[]
}

type ExplorerPathDeletePlan = {
  kind: 'delete'
  sectionId: StructuralExplorerSectionId
  operationLabel: string
  deletedItems: ExplorerPathDeletedItem[]
  blockers: ExplorerPathChangeBlocker[]
  warnings: ExplorerPathChangeWarning[]
}
```

The plan is the dialog contract. The commit path applies exactly what the plan lists.

### Rename Folder

Renaming folder `documentation/assets/js` to `documentation/assets/scripts` rewrites every descendant path:

```text
documentation/assets/js/main.js
  -> documentation/assets/scripts/main.js

documentation/assets/js/vendor/jquery.min.js
  -> documentation/assets/scripts/vendor/jquery.min.js
```

For Pages, the same operation rewrites slugs:

```text
documentation/setup
  -> docs/setup
```

### Move Folder

Moving a folder changes its prefix.

Moving `documentation/assets/js/vendor` into `download-version/assets/js` rewrites descendants from the old prefix to the new prefix.

Dragging a folder before/after another folder at the same parent only changes structural order metadata. Dragging a folder into a different parent rewrites paths and requires confirmation.

### Move Item

Moving an item into a folder rewrites only that item.

```text
about
  -> documentation/about
```

```text
src/scripts/main.ts
  -> documentation/assets/js/main.ts
```

Dragging an item before/after another item in the same parent only changes structural order metadata.

### Delete Folder

Deleting a structural folder deletes every descendant page/file. It does not move children up.

Deleting `documentation/assets/js` deletes:

```text
documentation/assets/js/main.js
documentation/assets/js/vendor/bootstrap.bundle.min.js
documentation/assets/js/vendor/jquery.min.js
```

Deleting a Pages folder deletes matching descendant pages, including a landing page whose slug equals the folder path.

Deleting a Styles/Scripts folder removes matching `SiteFile` rows. Script delete also removes `site.runtime.scripts[file.id]` and `siteRuntime.scripts[file.id]`. Style delete removes `site.runtime.styles[file.id]` and `siteRuntime.styles[file.id]`.

## Confirmation Dialog

Add `ExplorerPathChangeConfirmDialog` beside `SiteExplorerPanel` at `src/admin/pages/site/panels/SiteExplorerPanel/ExplorerPathChangeConfirmDialog.tsx`.

The dialog uses `Dialog` from `src/ui/components/Dialog` and `Button` from `src/ui/components/Button`. The lifecycle uses `createConfirmContext` from `src/admin/shared/dialogs/confirmContextFactory.ts`.

The dialog displays:

- operation summary, for example `Rename documentation/assets/js to documentation/assets/scripts`
- affected count by item type
- exact before -> after rows for rewrites
- exact deleted rows for deletes
- warnings
- blockers

Confirm is disabled when `blockers.length > 0`.

Rewrite copy states:

- Page/file ids stay the same.
- Runtime script/style settings stay attached.
- Page refs by id continue to resolve to the renamed route.
- Raw URLs in authored content are not rewritten.

Delete copy states:

- Listed pages/files are removed.
- Runtime script/style settings for deleted files are removed.
- This cannot be undone after save/reload unless editor history is still available in the current session.

## Blockers

Plans block confirmation when the exact target state is invalid.

For Pages:

- any target slug fails `pageSlugError` from `src/core/page-tree/slugs.ts`
- any target slug collides with an unaffected page
- two changed pages target the same slug
- the operation moves or deletes the homepage `index` without using the existing homepage action

For Styles and Scripts:

- any target path fails `isSafePath(normalizePath(path))` from `src/core/files/pathValidation.ts`
- any target path collides with an unaffected file
- two changed files target the same path
- a delete targets a generated non-ejected file hidden from the Explorer

Batch rewrites do not call `renamePage` or `renameFile` in a way that auto-suffixes targets. Auto-suffixing makes the confirmation dialog untrue. The batch commit validates exact targets, then writes exact targets.

## Warnings

Plans can warn without blocking.

Warnings include:

- Raw URLs in page content are not rewritten.
- Moving scripts can affect relative imports.
- Moving only part of a script folder can break imports that cross the moved boundary.

Use `extractRuntimeImportSpecifiers` from `src/core/site-runtime/importAnalysis.ts` to detect relative script specifiers. The first implementation warns; it does not rewrite script source text.

Moving a whole script folder preserves relative imports between files that both move together, but imports between moved and unmoved files can still change. The warning text names the affected script paths.

## Store Commit Rules

Commits are one undoable store mutation.

Pages:

- Apply exact slug rewrites to `site.pages`.
- Delete descendant pages for delete plans.
- Clear active page selection if the active page is deleted.
- Reconcile path order and expansion state.

Styles and Scripts:

- Apply exact path rewrites to `site.files`.
- Delete descendant files for delete plans.
- Clear `activeEditorFileId` if the active file is deleted.
- Remove runtime config for deleted files.
- Keep runtime config for rewritten files.
- Reconcile path order and expansion state.

Decorative Templates and Components keep the current organization store actions.

## UI Changes

`src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerTreeSection.tsx` must support recursive structural folders. The current one-level folder renderer is not enough for slash paths.

Proposed files:

| File | Responsibility |
|---|---|
| `src/core/page-tree/siteExplorer.ts` | Schema, parse, and reconciliation for decorative sections plus structural UI state. |
| `src/core/page-tree/explorerPathPlans.ts` | Pure plan builders for structural path rewrites/deletes. |
| `src/admin/pages/site/panels/SiteExplorerPanel/siteExplorerModel.ts` | Decorative section model and structural recursive tree model. |
| `src/admin/pages/site/panels/SiteExplorerPanel/useSiteExplorerDnd.ts` | DnD resolution for same-parent order vs path-changing moves. |
| `src/admin/pages/site/panels/SiteExplorerPanel/ExplorerPathChangeConfirmDialog.tsx` | Impact dialog if kept panel-local. |
| `src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.tsx` | Wires plan creation, confirmation, and commit callbacks. |

`SiteExplorerTreeSection` row semantics:

- Chevron toggles folders.
- Folder label opens `landingItem` when present.
- Folder context menu exposes Rename folder, Delete folder, New page/file inside, and folder-specific move actions.
- Landing page folder rows expose page actions without hiding folder actions.
- Item context menus keep existing page/file actions.

## Import Behavior

Site import does not create decorative folders for Pages, Styles, or Scripts.

The imported slugs and file paths naturally produce the Explorer tree:

```text
documentation/index.html
  -> page slug documentation

documentation/getting-started.html
  -> page slug documentation/getting-started

documentation/assets/js/vendor/jquery.min.js
  -> script path documentation/assets/js/vendor/jquery.min.js
```

The import conflict dialog compares full slugs/paths, not only basenames.

## Error Handling

Plan creation is pure and returns blockers instead of throwing for user-correctable issues.

Commit throws only for impossible stale-state cases, for example when the site changed after the dialog opened and the plan no longer matches current paths. UI handlers catch those errors and render a `role="alert"` message in the dialog.

Developer logs use:

```ts
console.error('[SiteExplorerPanel] Path change failed:', err)
```

No native `alert`, `confirm`, or `prompt`.

## Tests

Pure model tests:

- `src/__tests__/page-tree/siteExplorerOrganization.test.ts`
- `src/__tests__/site-explorer/siteExplorerPathModel.test.ts`
- `src/__tests__/site-explorer/siteExplorerPathPlans.test.ts`

Required cases:

- builds nested page folders from slash slugs
- builds nested style/script folders from file paths
- represents a folder landing page when a page slug equals a folder path
- keeps homepage pinned and outside structural path operations
- creates and prunes empty structural folders
- blocks page slug collisions
- blocks file path collisions
- blocks unsafe file paths
- warns on relative script imports crossing a moved boundary
- plans folder delete as descendant deletion

Store tests:

- structural page folder rename rewrites descendant slugs exactly
- structural page folder delete deletes descendants
- structural script folder rename rewrites descendant paths exactly
- structural script folder delete removes runtime config
- same-parent item/folder reorder changes only structural `rowOrder` metadata
- decorative template/component folders still use existing placement behavior

Panel tests:

- nested folders render recursively
- confirmation dialog lists before -> after rows
- blocked plan disables confirm
- deleting a folder lists deleted descendants
- imported nested pages/scripts display as folders without conflicts

Verification:

```sh
bun run build
bun test
bun run lint
```

## Documentation Updates During Implementation

Update these docs with the shipped behavior:

- `docs/editor.md`
- `docs/features/site-shell.md`
- `docs/features/site-import.md`
- `docs/reference/page-tree.md`

Delete or replace stale statements that describe Pages, Styles, or Scripts folders as decorative.

## Open Implementation Notes

- Keep path plan builders in core code so tests can exercise them without rendering React.
- Keep the dialog body small; cap visible rows and let the user expand the full list when many items are affected.
- Use exact validation before commit and again inside commit.
- Do not rewrite raw URLs in page content in this change.
- Do not rewrite script source text in this change.
- Do not preserve the old all-sections decorative placement model for Pages, Styles, or Scripts.

# Site Explorer Path Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Site Explorer folders structural for Pages, Styles, and Scripts by deriving nesting from page slugs and file paths, with an impact confirmation dialog before any path rewrite or cascade delete.

**Architecture:** `Page.slug` and `SiteFile.path` become the only source of truth for structural Explorer membership. `site.explorer` stores structural UI state (`expandedFolders`, `emptyFolders`, `rowOrder`) for Pages/Styles/Scripts and keeps decorative folder placement only for Templates/Components. Pure path-plan builders compute exact rewrites/deletes and blockers before the React panel opens a confirmation dialog and commits the plan in one undoable store mutation.

**Tech Stack:** Bun test, TypeScript, React 19 with React Compiler, Zustand Mutative store, TypeBox schemas, `@dnd-kit/core`, existing `Tree*` primitives, existing `Dialog` and `Button` primitives.

---

## File Structure

- Modify `docs/superpowers/specs/2026-06-08-site-explorer-path-folders-design.md`: keep the approved spec aligned with implementation naming.
- Modify `src/core/page-tree/siteExplorer.ts`: split structural and decorative Explorer schemas, parsing, reconciliation, and decorative-only mutation helpers.
- Modify `src/core/page-tree/index.ts`: export new structural/decorative section types and path-plan helpers.
- Create `src/core/page-tree/explorerPathPlans.ts`: pure structural path plan builders, blockers, warnings, and exact commit helpers.
- Modify `src/admin/pages/site/store/slices/site/types.ts`: replace structural placement actions with path-plan actions and keep decorative actions for Templates/Components.
- Modify `src/admin/pages/site/store/slices/site/explorerActions.ts`: route structural operations through path plans, keep decorative operations for Templates/Components.
- Modify `src/admin/pages/site/store/slices/filesSlice.ts`: remove style runtime config on style file delete and expose exact batch path commit through the site slice rather than per-file UI actions.
- Modify `src/admin/pages/site/panels/SiteExplorerPanel/siteExplorerModel.ts`: add recursive structural tree builder and keep decorative one-level builder.
- Modify `src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerTreeSection.tsx`: render recursive folder trees with landing-page folder rows.
- Modify `src/admin/pages/site/panels/SiteExplorerPanel/useSiteExplorerDnd.ts`: distinguish same-parent reorder from path-changing moves and produce structural plan requests.
- Create `src/admin/pages/site/panels/SiteExplorerPanel/ExplorerPathChangeConfirmDialog.tsx`: impact dialog with blocker/warning rendering.
- Create `src/admin/pages/site/panels/SiteExplorerPanel/explorerPathChangeConfirm.ts`: panel-local confirm context built with `createConfirmContext`.
- Modify `src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.tsx`: wire structural models, path plans, confirmation, and decorative-only folders.
- Modify `src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.module.css`: add dialog/body/list styles using existing editor tokens.
- Modify `src/__tests__/page-tree/siteExplorerOrganization.test.ts`: schema and reconciliation tests for structural/decorative sections.
- Create `src/__tests__/site-explorer/siteExplorerPathPlans.test.ts`: pure plan blocker/warning/delete/rewrite tests.
- Modify `src/__tests__/site-explorer/siteExplorerOrganizationStore.test.ts`: store commit tests for structural rewrites/deletes and decorative preservation.
- Modify `src/__tests__/site-explorer/siteExplorerPanel.test.tsx`: recursive rendering and confirmation dialog tests.
- Modify `docs/editor.md`, `docs/features/site-shell.md`, `docs/features/site-import.md`, and `docs/reference/page-tree.md`: replace decorative-folder statements with structural behavior.

## Task 1: Split Explorer Organization Schema

**Files:**
- Modify: `src/core/page-tree/siteExplorer.ts`
- Modify: `src/core/page-tree/index.ts`
- Test: `src/__tests__/page-tree/siteExplorerOrganization.test.ts`

- [ ] **Step 1: Add failing schema tests**

Add these tests inside `describe('site explorer organization', () => { ... })` in `src/__tests__/page-tree/siteExplorerOrganization.test.ts`.

```ts
  it('parses structural page style and script sections as path UI state', () => {
    const parsed = parseSiteExplorerOrganization({
      pages: {
        expandedFolders: ['documentation'],
        emptyFolders: ['documentation/assets'],
        rowOrder: [
          { kind: 'folder', id: 'documentation', order: 0 },
          { kind: 'item', id: 'pricing', order: 1 },
        ],
      },
      styles: {
        expandedFolders: ['src/styles'],
        emptyFolders: [],
        rowOrder: [{ kind: 'item', id: 'theme', parentPath: 'src/styles', order: 0 }],
      },
      scripts: {
        expandedFolders: ['src/scripts'],
        emptyFolders: ['src/scripts/vendor'],
        rowOrder: [],
      },
      templates: {
        folders: [{ id: 'folder-template', name: 'Layouts', order: 0 }],
        items: [{ id: 'post-template', parentFolderId: 'folder-template', order: 0 }],
      },
      components: {
        folders: [{ id: 'folder-component', name: 'Shared', order: 0 }],
        items: [{ id: 'hero', parentFolderId: 'folder-component', order: 0 }],
      },
    })

    expect(parsed.pages).toEqual({
      expandedFolders: ['documentation'],
      emptyFolders: ['documentation/assets'],
      rowOrder: [
        { kind: 'folder', id: 'documentation', order: 0 },
        { kind: 'item', id: 'pricing', order: 1 },
      ],
    })
    expect(parsed.styles).toEqual({
      expandedFolders: ['src/styles'],
      emptyFolders: [],
      rowOrder: [{ kind: 'item', id: 'theme', parentPath: 'src/styles', order: 0 }],
    })
    expect(parsed.templates.folders).toHaveLength(1)
    expect(parsed.components.items).toHaveLength(1)
  })

  it('drops invalid structural folder paths and stale structural row orders', () => {
    const parsed = parseSiteExplorerOrganization({
      pages: {
        expandedFolders: ['documentation', '../bad', '/absolute'],
        emptyFolders: ['documentation/assets', ''],
        rowOrder: [
          { kind: 'folder', id: 'documentation', parentPath: '', order: 0 },
          { kind: 'folder', id: '../bad', order: 1 },
          { kind: 'item', id: 'pricing', parentPath: 'documentation', order: Number.POSITIVE_INFINITY },
        ],
      },
    })

    expect(parsed.pages.expandedFolders).toEqual(['documentation'])
    expect(parsed.pages.emptyFolders).toEqual(['documentation/assets'])
    expect(parsed.pages.rowOrder).toEqual([{ kind: 'folder', id: 'documentation', order: 0 }])
  })
```

- [ ] **Step 2: Run schema tests and verify failure**

Run:

```sh
bun test src/__tests__/page-tree/siteExplorerOrganization.test.ts
```

Expected: FAIL because `pages` still parses as `{ folders, items }`.

- [ ] **Step 3: Replace all-section decorative types with structural/decorative types**

In `src/core/page-tree/siteExplorer.ts`, replace the section schema definitions with these exported shapes.

```ts
export const STRUCTURAL_SITE_EXPLORER_SECTION_IDS = ['pages', 'styles', 'scripts'] as const
export const DECORATIVE_SITE_EXPLORER_SECTION_IDS = ['templates', 'components'] as const
export const SITE_EXPLORER_SECTION_IDS = [
  ...STRUCTURAL_SITE_EXPLORER_SECTION_IDS,
  ...DECORATIVE_SITE_EXPLORER_SECTION_IDS,
] as const

export type StructuralSiteExplorerSectionId = (typeof STRUCTURAL_SITE_EXPLORER_SECTION_IDS)[number]
export type DecorativeSiteExplorerSectionId = (typeof DECORATIVE_SITE_EXPLORER_SECTION_IDS)[number]
export type SiteExplorerSectionId = (typeof SITE_EXPLORER_SECTION_IDS)[number]

const StructuralExplorerRowOrderSchema = Type.Object({
  kind: Type.Union([Type.Literal('folder'), Type.Literal('item')]),
  id: Type.String(),
  parentPath: Type.Optional(Type.String()),
  order: Type.Number(),
})

const StructuralExplorerSectionSchema = Type.Object({
  expandedFolders: Type.Array(Type.String()),
  emptyFolders: Type.Array(Type.String()),
  rowOrder: Type.Array(StructuralExplorerRowOrderSchema),
})

const DecorativeExplorerSectionSchema = Type.Object({
  folders: Type.Array(SiteExplorerFolderSchema),
  items: Type.Array(SiteExplorerItemPlacementSchema),
})

export const SiteExplorerOrganizationSchema = Type.Object({
  pages: StructuralExplorerSectionSchema,
  styles: StructuralExplorerSectionSchema,
  scripts: StructuralExplorerSectionSchema,
  templates: DecorativeExplorerSectionSchema,
  components: DecorativeExplorerSectionSchema,
})

export type StructuralExplorerRowOrder = Static<typeof StructuralExplorerRowOrderSchema>
export type StructuralExplorerSection = Static<typeof StructuralExplorerSectionSchema>
export type DecorativeExplorerSection = Static<typeof DecorativeExplorerSectionSchema>
```

Keep `SiteExplorerFolder` and `SiteExplorerItemPlacement` for decorative sections.

- [ ] **Step 4: Implement structural parser helpers**

Add these helpers in `src/core/page-tree/siteExplorer.ts`.

```ts
function createEmptyStructuralSection(): StructuralExplorerSection {
  return { expandedFolders: [], emptyFolders: [], rowOrder: [] }
}

function createEmptyDecorativeSection(): DecorativeExplorerSection {
  return { folders: [], items: [] }
}

function parseStructuralSection(raw: unknown): StructuralExplorerSection {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return createEmptyStructuralSection()
  const record = raw as Record<string, unknown>
  const expandedFolders = parseFolderPaths(record.expandedFolders)
  const emptyFolders = parseFolderPaths(record.emptyFolders)
    .filter((path) => !expandedFolders.includes(path))
  const rowOrder = parseStructuralRowOrder(record.rowOrder)
  return { expandedFolders, emptyFolders, rowOrder }
}

function parseFolderPaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const paths: string[] = []
  for (const value of raw) {
    if (typeof value !== 'string') continue
    const path = value.trim().replace(/^\/+|\/+$/g, '')
    if (!path || path.includes('\\') || path.split('/').some((segment) => !segment || segment === '.' || segment === '..')) continue
    if (seen.has(path)) continue
    seen.add(path)
    paths.push(path)
  }
  return paths
}

function parseStructuralRowOrder(raw: unknown): StructuralExplorerRowOrder[] {
  if (!Array.isArray(raw)) return []
  const rowOrder: StructuralExplorerRowOrder[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (!compiledCheck(StructuralExplorerRowOrderSchema, entry)) continue
    const decoded = compiledDecode(StructuralExplorerRowOrderSchema, entry)
    const id = decoded.id.trim()
    const parentPath = decoded.parentPath?.trim()
    if (!id || !Number.isFinite(decoded.order)) continue
    if (id.includes('\\') || id.split('/').some((segment) => segment === '.' || segment === '..')) continue
    const key = `${decoded.kind}:${parentPath ?? ''}:${id}`
    if (seen.has(key)) continue
    seen.add(key)
    rowOrder.push({
      kind: decoded.kind,
      id,
      ...(parentPath ? { parentPath } : {}),
      order: decoded.order,
    })
  }
  return rowOrder
}
```

- [ ] **Step 5: Update default creation and parsing**

Change `createDefaultSiteExplorerOrganization` and `parseSiteExplorerOrganization`.

```ts
export function createDefaultSiteExplorerOrganization(): SiteExplorerOrganization {
  return {
    pages: createEmptyStructuralSection(),
    styles: createEmptyStructuralSection(),
    scripts: createEmptyStructuralSection(),
    templates: createEmptyDecorativeSection(),
    components: createEmptyDecorativeSection(),
  }
}

export function parseSiteExplorerOrganization(raw: unknown): SiteExplorerOrganization {
  const parsed = createDefaultSiteExplorerOrganization()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return parsed
  const record = raw as Record<string, unknown>
  parsed.pages = parseStructuralSection(record.pages)
  parsed.styles = parseStructuralSection(record.styles)
  parsed.scripts = parseStructuralSection(record.scripts)
  parsed.templates = parseDecorativeSection(record.templates)
  parsed.components = parseDecorativeSection(record.components)
  return parsed
}
```

Rename the old `parseSection` helper to `parseDecorativeSection`.

- [ ] **Step 6: Update reconciliation**

Change `reconcileSiteExplorerOrganization` so Pages/Styles/Scripts call a new structural reconciliation function and Templates/Components call the existing decorative reconciliation.

```ts
function reconcileStructuralSection(
  section: StructuralExplorerSection,
  existingRows: {
    folders: ReadonlySet<string>
    items: ReadonlyMap<string, string | undefined>
  },
): StructuralExplorerSection {
  const folderSet = existingRows.folders
  const itemParentById = existingRows.items
  return {
    expandedFolders: section.expandedFolders.filter((path) => folderSet.has(path)),
    emptyFolders: section.emptyFolders.filter((path) => !folderSet.has(path)),
    rowOrder: section.rowOrder.filter((entry) => {
      if (entry.kind === 'folder') return folderSet.has(entry.id) && parentPathForPath(entry.id) === entry.parentPath
      return itemParentById.get(entry.id) === entry.parentPath
    }),
  }
}
```

Implement `parentPathForPath(path: string): string | undefined` by returning the path before the final `/`, or `undefined` for root-level rows.

- [ ] **Step 7: Export new types**

Update `src/core/page-tree/index.ts` to export:

```ts
  DECORATIVE_SITE_EXPLORER_SECTION_IDS,
  STRUCTURAL_SITE_EXPLORER_SECTION_IDS,
  type DecorativeSiteExplorerSectionId,
  type DecorativeExplorerSection,
  type StructuralSiteExplorerSectionId,
  type StructuralExplorerRowOrder,
  type StructuralExplorerSection,
```

- [ ] **Step 8: Run schema tests**

Run:

```sh
bun test src/__tests__/page-tree/siteExplorerOrganization.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```sh
git add src/core/page-tree/siteExplorer.ts src/core/page-tree/index.ts src/__tests__/page-tree/siteExplorerOrganization.test.ts
git commit -m "refactor: split structural and decorative site explorer state"
```

## Task 2: Add Structural Path Plan Builders

**Files:**
- Create: `src/core/page-tree/explorerPathPlans.ts`
- Modify: `src/core/page-tree/index.ts`
- Test: `src/__tests__/site-explorer/siteExplorerPathPlans.test.ts`

- [ ] **Step 1: Add failing plan tests**

Create `src/__tests__/site-explorer/siteExplorerPathPlans.test.ts`.

```ts
import { describe, expect, it } from 'bun:test'
import {
  buildDeleteExplorerPathPlan,
  buildMoveExplorerItemPlan,
  buildRenameExplorerFolderPlan,
  commitExplorerPathPlan,
} from '@core/page-tree'
import { makePage, makeSite } from '../fixtures'

describe('site explorer path plans', () => {
  it('plans exact descendant page slug rewrites for folder rename', () => {
    const site = makeSite({
      pages: [
        makePage({ id: 'home', slug: 'index', title: 'Home' }),
        makePage({ id: 'docs', slug: 'documentation', title: 'Documentation' }),
        makePage({ id: 'setup', slug: 'documentation/setup', title: 'Setup' }),
      ],
    })

    const plan = buildRenameExplorerFolderPlan(site, {
      sectionId: 'pages',
      folderPath: 'documentation',
      nextFolderPath: 'docs',
    })

    expect(plan.blockers).toEqual([])
    expect(plan.changes.map((change) => [change.id, change.from, change.to])).toEqual([
      ['docs', 'documentation', 'docs'],
      ['setup', 'documentation/setup', 'docs/setup'],
    ])
  })

  it('blocks page slug collisions instead of auto-suffixing', () => {
    const site = makeSite({
      pages: [
        makePage({ id: 'home', slug: 'index' }),
        makePage({ id: 'docs', slug: 'documentation' }),
        makePage({ id: 'setup', slug: 'documentation/setup' }),
        makePage({ id: 'collision', slug: 'docs/setup' }),
      ],
    })

    const plan = buildRenameExplorerFolderPlan(site, {
      sectionId: 'pages',
      folderPath: 'documentation',
      nextFolderPath: 'docs',
    })

    expect(plan.blockers).toEqual([
      { code: 'duplicate-page-slug', message: 'Page slug "/docs/setup" already exists.', target: 'docs/setup' },
    ])
  })

  it('plans exact script path rewrites and keeps file ids', () => {
    const site = makeSite({
      files: [
        { id: 'main', path: 'documentation/assets/js/main.js', type: 'script', content: '', createdAt: 1, updatedAt: 1 },
        { id: 'vendor', path: 'documentation/assets/js/vendor/jquery.min.js', type: 'script', content: '', createdAt: 1, updatedAt: 1 },
      ],
    })

    const plan = buildRenameExplorerFolderPlan(site, {
      sectionId: 'scripts',
      folderPath: 'documentation/assets/js',
      nextFolderPath: 'documentation/assets/scripts',
    })

    expect(plan.blockers).toEqual([])
    expect(plan.changes.map((change) => [change.id, change.from, change.to])).toEqual([
      ['main', 'documentation/assets/js/main.js', 'documentation/assets/scripts/main.js'],
      ['vendor', 'documentation/assets/js/vendor/jquery.min.js', 'documentation/assets/scripts/vendor/jquery.min.js'],
    ])
  })

  it('plans structural folder delete as descendant deletion', () => {
    const site = makeSite({
      pages: [
        makePage({ id: 'home', slug: 'index' }),
        makePage({ id: 'docs', slug: 'documentation' }),
        makePage({ id: 'setup', slug: 'documentation/setup' }),
        makePage({ id: 'pricing', slug: 'pricing' }),
      ],
    })

    const plan = buildDeleteExplorerPathPlan(site, { sectionId: 'pages', folderPath: 'documentation' })

    expect(plan.deletedItems.map((item) => [item.id, item.path])).toEqual([
      ['docs', 'documentation'],
      ['setup', 'documentation/setup'],
    ])
  })

  it('commits rewrite plans exactly', () => {
    const site = makeSite({
      pages: [
        makePage({ id: 'home', slug: 'index' }),
        makePage({ id: 'about', slug: 'about' }),
      ],
    })
    const plan = buildMoveExplorerItemPlan(site, {
      sectionId: 'pages',
      itemId: 'about',
      nextParentPath: 'documentation',
    })

    commitExplorerPathPlan(site, undefined, plan)

    expect(site.pages.find((page) => page.id === 'about')?.slug).toBe('documentation/about')
  })
})
```

- [ ] **Step 2: Run path plan tests and verify failure**

Run:

```sh
bun test src/__tests__/site-explorer/siteExplorerPathPlans.test.ts
```

Expected: FAIL because `explorerPathPlans.ts` does not exist.

- [ ] **Step 3: Create path plan types**

Create `src/core/page-tree/explorerPathPlans.ts` with these exported types.

```ts
import type { SiteRuntimeConfig } from '@core/site-runtime'
import { extractRuntimeImportSpecifiers } from '@core/site-runtime/importAnalysis'
import { isSafePath, normalizePath } from '@core/files/pathValidation'
import type { SiteFile } from '@core/files/schemas'
import type { SiteDocument } from './siteDocument'
import { isHomePage, pageSlugError } from './slugs'
import type { StructuralSiteExplorerSectionId } from './siteExplorer'

export type ExplorerPathPlanKind = 'rewrite' | 'delete'

export interface ExplorerPathChangeBlocker {
  code:
    | 'duplicate-page-slug'
    | 'invalid-page-slug'
    | 'duplicate-file-path'
    | 'unsafe-file-path'
    | 'homepage-protected'
    | 'hidden-generated-file'
  message: string
  target: string
}

export interface ExplorerPathChangeWarning {
  code: 'raw-url-not-rewritten' | 'relative-script-import'
  message: string
  sourcePath?: string
}

export interface ExplorerPathRewriteChange {
  id: string
  label: string
  from: string
  to: string
}

export interface ExplorerPathDeletedItem {
  id: string
  label: string
  path: string
}

export interface ExplorerPathRewritePlan {
  kind: 'rewrite'
  sectionId: StructuralSiteExplorerSectionId
  operationLabel: string
  changes: ExplorerPathRewriteChange[]
  blockers: ExplorerPathChangeBlocker[]
  warnings: ExplorerPathChangeWarning[]
}

export interface ExplorerPathDeletePlan {
  kind: 'delete'
  sectionId: StructuralSiteExplorerSectionId
  operationLabel: string
  deletedItems: ExplorerPathDeletedItem[]
  blockers: ExplorerPathChangeBlocker[]
  warnings: ExplorerPathChangeWarning[]
}

export type ExplorerPathChangePlan = ExplorerPathRewritePlan | ExplorerPathDeletePlan
```

- [ ] **Step 4: Implement path helpers**

Add these helpers below the types.

```ts
function parentPathForPath(path: string): string | undefined {
  const index = path.lastIndexOf('/')
  return index === -1 ? undefined : path.slice(0, index)
}

function basename(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? path : path.slice(index + 1)
}

function joinPath(parentPath: string | undefined, leaf: string): string {
  return parentPath ? `${parentPath}/${leaf}` : leaf
}

function isDescendantPath(path: string, folderPath: string): boolean {
  return path === folderPath || path.startsWith(`${folderPath}/`)
}

function replacePathPrefix(path: string, fromPrefix: string, toPrefix: string): string {
  if (path === fromPrefix) return toPrefix
  return `${toPrefix}${path.slice(fromPrefix.length)}`
}
```

- [ ] **Step 5: Implement item collection helpers**

Add collection helpers for structural sections.

```ts
interface StructuralItem {
  id: string
  label: string
  path: string
  file?: SiteFile
}

function structuralItems(site: SiteDocument, sectionId: StructuralSiteExplorerSectionId): StructuralItem[] {
  if (sectionId === 'pages') {
    return site.pages
      .filter((page) => !page.template)
      .map((page) => ({ id: page.id, label: page.title, path: page.slug }))
  }
  const type = sectionId === 'styles' ? 'style' : 'script'
  return site.files
    .filter((file) => file.type === type && (!file.generated || file.ejected))
    .map((file) => ({
      id: file.id,
      label: basename(file.path),
      path: file.path,
      file,
    }))
}
```

- [ ] **Step 6: Implement rewrite plan builders**

Add the three rewrite builders.

```ts
export function buildRenameExplorerFolderPlan(
  site: SiteDocument,
  input: { sectionId: StructuralSiteExplorerSectionId; folderPath: string; nextFolderPath: string },
): ExplorerPathRewritePlan {
  const changes = structuralItems(site, input.sectionId)
    .filter((item) => isDescendantPath(item.path, input.folderPath))
    .map((item) => ({
      id: item.id,
      label: item.label,
      from: item.path,
      to: replacePathPrefix(item.path, input.folderPath, input.nextFolderPath),
    }))
  return rewritePlan(site, input.sectionId, `Rename ${input.folderPath} to ${input.nextFolderPath}`, changes)
}

export function buildMoveExplorerFolderPlan(
  site: SiteDocument,
  input: { sectionId: StructuralSiteExplorerSectionId; folderPath: string; nextParentPath: string | undefined },
): ExplorerPathRewritePlan {
  const nextFolderPath = joinPath(input.nextParentPath, basename(input.folderPath))
  const changes = structuralItems(site, input.sectionId)
    .filter((item) => isDescendantPath(item.path, input.folderPath))
    .map((item) => ({
      id: item.id,
      label: item.label,
      from: item.path,
      to: replacePathPrefix(item.path, input.folderPath, nextFolderPath),
    }))
  return rewritePlan(site, input.sectionId, `Move ${input.folderPath} to ${nextFolderPath}`, changes)
}

export function buildMoveExplorerItemPlan(
  site: SiteDocument,
  input: { sectionId: StructuralSiteExplorerSectionId; itemId: string; nextParentPath: string | undefined },
): ExplorerPathRewritePlan {
  const item = structuralItems(site, input.sectionId).find((candidate) => candidate.id === input.itemId)
  const changes = item
    ? [{ id: item.id, label: item.label, from: item.path, to: joinPath(input.nextParentPath, basename(item.path)) }]
    : []
  return rewritePlan(site, input.sectionId, item ? `Move ${item.path} to ${changes[0].to}` : 'Move item', changes)
}
```

- [ ] **Step 7: Implement blockers and warnings**

Add `rewritePlan`, `deletePlan`, `blockersForRewrite`, and `warningsForRewrite`.

```ts
function rewritePlan(
  site: SiteDocument,
  sectionId: StructuralSiteExplorerSectionId,
  operationLabel: string,
  changes: ExplorerPathRewriteChange[],
): ExplorerPathRewritePlan {
  return {
    kind: 'rewrite',
    sectionId,
    operationLabel,
    changes,
    blockers: blockersForRewrite(site, sectionId, changes),
    warnings: warningsForRewrite(site, sectionId, changes),
  }
}

function blockersForRewrite(
  site: SiteDocument,
  sectionId: StructuralSiteExplorerSectionId,
  changes: ExplorerPathRewriteChange[],
): ExplorerPathChangeBlocker[] {
  const blockers: ExplorerPathChangeBlocker[] = []
  const changedIds = new Set(changes.map((change) => change.id))
  const targets = new Set<string>()
  for (const change of changes) {
    if (targets.has(change.to)) {
      blockers.push({ code: sectionId === 'pages' ? 'duplicate-page-slug' : 'duplicate-file-path', message: `Duplicate target "${change.to}".`, target: change.to })
    }
    targets.add(change.to)
    if (sectionId === 'pages') {
      const error = pageSlugError(change.to)
      if (error) blockers.push({ code: 'invalid-page-slug', message: error, target: change.to })
      const page = site.pages.find((candidate) => candidate.id === change.id)
      if (page && isHomePage(page)) blockers.push({ code: 'homepage-protected', message: 'The homepage cannot be moved by folder operations.', target: change.from })
      if (site.pages.some((candidate) => candidate.id !== change.id && !changedIds.has(candidate.id) && candidate.slug === change.to)) {
        blockers.push({ code: 'duplicate-page-slug', message: `Page slug "/${change.to}" already exists.`, target: change.to })
      }
    } else {
      const normalized = normalizePath(change.to)
      if (!isSafePath(normalized) || normalized !== change.to) {
        blockers.push({ code: 'unsafe-file-path', message: `File path "${change.to}" is not safe.`, target: change.to })
      }
      if (site.files.some((candidate) => candidate.id !== change.id && !changedIds.has(candidate.id) && candidate.path === change.to)) {
        blockers.push({ code: 'duplicate-file-path', message: `File path "${change.to}" already exists.`, target: change.to })
      }
    }
  }
  return blockers
}

function warningsForRewrite(
  site: SiteDocument,
  sectionId: StructuralSiteExplorerSectionId,
  changes: ExplorerPathRewriteChange[],
): ExplorerPathChangeWarning[] {
  if (sectionId !== 'scripts') return [{ code: 'raw-url-not-rewritten', message: 'Raw URLs in authored content are not rewritten.' }]
  const warnings: ExplorerPathChangeWarning[] = []
  const changedIds = new Set(changes.map((change) => change.id))
  for (const file of site.files) {
    if (file.type !== 'script' || !changedIds.has(file.id) || typeof file.content !== 'string') continue
    const relativeImports = extractRuntimeImportSpecifiers(file.content)
      .filter((entry) => entry.specifier.startsWith('.'))
    if (relativeImports.length > 0) {
      warnings.push({
        code: 'relative-script-import',
        sourcePath: file.path,
        message: `Moving "${file.path}" can affect relative imports: ${relativeImports.map((entry) => entry.specifier).join(', ')}`,
      })
    }
  }
  warnings.push({ code: 'raw-url-not-rewritten', message: 'Raw URLs in authored content are not rewritten.' })
  return warnings
}
```

- [ ] **Step 8: Implement delete plan and exact commit**

Add delete and commit exports.

```ts
export function buildDeleteExplorerPathPlan(
  site: SiteDocument,
  input: { sectionId: StructuralSiteExplorerSectionId; folderPath: string },
): ExplorerPathDeletePlan {
  const deletedItems = structuralItems(site, input.sectionId)
    .filter((item) => isDescendantPath(item.path, input.folderPath))
    .map((item) => ({ id: item.id, label: item.label, path: item.path }))
  const blockers = input.sectionId === 'pages' && deletedItems.some((item) => item.path === 'index')
    ? [{ code: 'homepage-protected' as const, message: 'The homepage cannot be deleted by folder operations.', target: 'index' }]
    : []
  return {
    kind: 'delete',
    sectionId: input.sectionId,
    operationLabel: `Delete ${input.folderPath}`,
    deletedItems,
    blockers,
    warnings: [{ code: 'raw-url-not-rewritten', message: 'Raw URLs in authored content are not rewritten.' }],
  }
}

export function commitExplorerPathPlan(
  site: SiteDocument,
  liveRuntime: SiteRuntimeConfig | undefined,
  plan: ExplorerPathChangePlan,
): void {
  if (plan.blockers.length > 0) {
    throw new Error('[SiteExplorer] Cannot commit a blocked path change plan')
  }
  if (plan.kind === 'rewrite') {
    for (const change of plan.changes) {
      if (plan.sectionId === 'pages') {
        const page = site.pages.find((candidate) => candidate.id === change.id)
        if (page) page.slug = change.to
      } else {
        const file = site.files.find((candidate) => candidate.id === change.id)
        if (file) {
          file.path = change.to
          file.updatedAt = Date.now()
        }
      }
    }
    site.updatedAt = Date.now()
    return
  }
  const deletedIds = new Set(plan.deletedItems.map((item) => item.id))
  if (plan.sectionId === 'pages') {
    site.pages = site.pages.filter((page) => !deletedIds.has(page.id))
  } else {
    site.files = site.files.filter((file) => !deletedIds.has(file.id))
    for (const id of deletedIds) {
      if (plan.sectionId === 'scripts') {
        if (site.runtime?.scripts) delete site.runtime.scripts[id]
        if (liveRuntime?.scripts) delete liveRuntime.scripts[id]
      } else {
        if (site.runtime?.styles) delete site.runtime.styles[id]
        if (liveRuntime?.styles) delete liveRuntime.styles[id]
      }
    }
  }
  site.updatedAt = Date.now()
}
```

- [ ] **Step 9: Export path plan APIs**

Update `src/core/page-tree/index.ts`:

```ts
export {
  buildDeleteExplorerPathPlan,
  buildMoveExplorerFolderPlan,
  buildMoveExplorerItemPlan,
  buildRenameExplorerFolderPlan,
  commitExplorerPathPlan,
  type ExplorerPathChangeBlocker,
  type ExplorerPathChangePlan,
  type ExplorerPathChangeWarning,
  type ExplorerPathDeletedItem,
  type ExplorerPathRewriteChange,
} from './explorerPathPlans'
```

- [ ] **Step 10: Run path plan tests**

Run:

```sh
bun test src/__tests__/site-explorer/siteExplorerPathPlans.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit**

```sh
git add src/core/page-tree/explorerPathPlans.ts src/core/page-tree/index.ts src/__tests__/site-explorer/siteExplorerPathPlans.test.ts
git commit -m "feat: add site explorer path change plans"
```

## Task 3: Add Store Commit Actions for Structural Sections

**Files:**
- Modify: `src/admin/pages/site/store/slices/site/types.ts`
- Modify: `src/admin/pages/site/store/slices/site/explorerActions.ts`
- Modify: `src/admin/pages/site/store/slices/filesSlice.ts`
- Test: `src/__tests__/site-explorer/siteExplorerOrganizationStore.test.ts`

- [ ] **Step 1: Add failing store tests**

Add these tests to `src/__tests__/site-explorer/siteExplorerOrganizationStore.test.ts`.

```ts
  it('commits a structural page folder rename by rewriting descendant slugs', () => {
    loadExplorerSite({
      pages: [
        makePage({ id: 'home', slug: 'index', title: 'Home' }),
        makePage({ id: 'docs', slug: 'documentation', title: 'Docs' }),
        makePage({ id: 'setup', slug: 'documentation/setup', title: 'Setup' }),
      ],
    })

    const plan = useEditorStore.getState().previewRenameExplorerFolder('pages', 'documentation', 'docs')
    useEditorStore.getState().commitExplorerPathChange(plan)

    const slugs = useEditorStore.getState().site!.pages.map((page) => page.slug).sort()
    expect(slugs).toEqual(['docs', 'docs/setup', 'index'])
  })

  it('commits a structural scripts folder delete and removes runtime config', () => {
    loadExplorerSite({
      files: [
        { id: 'main', path: 'documentation/assets/js/main.js', type: 'script', content: '', createdAt: 1, updatedAt: 1 },
        { id: 'theme', path: 'src/styles/theme.css', type: 'style', content: '', createdAt: 1, updatedAt: 1 },
      ],
      runtime: {
        dependencyLock: { version: 1, packages: {}, updatedAt: 0 },
        scripts: {
          main: { enabled: true, runInCanvas: true, format: 'classic', placement: 'body-end', timing: 'dom-ready', scope: { type: 'all-pages' }, priority: 100 },
        },
        styles: {},
      },
    })

    const plan = useEditorStore.getState().previewDeleteExplorerFolder('scripts', 'documentation/assets/js')
    useEditorStore.getState().commitExplorerPathChange(plan)

    expect(useEditorStore.getState().site!.files.some((file) => file.id === 'main')).toBe(false)
    expect(useEditorStore.getState().site!.runtime.scripts.main).toBeUndefined()
  })

  it('keeps decorative template folders using placement metadata', () => {
    loadExplorerSite()
    useEditorStore.getState().convertPageToTemplate('pricing', {
      enabled: true,
      target: { kind: 'postTypes', tableSlugs: ['posts'] },
      priority: 0,
    })

    const folderId = useEditorStore.getState().createExplorerFolder('templates', 'Layouts')
    useEditorStore.getState().moveExplorerItem('templates', 'pricing', folderId, 0)

    const explorer = useEditorStore.getState().site!.explorer
    expect(explorer.templates.folders).toEqual([{ id: folderId, name: 'Layouts', order: 1 }])
    expect(explorer.templates.items.find((item) => item.id === 'pricing')?.parentFolderId).toBe(folderId)
  })
```

- [ ] **Step 2: Run store tests and verify failure**

Run:

```sh
bun test src/__tests__/site-explorer/siteExplorerOrganizationStore.test.ts
```

Expected: FAIL because preview/commit structural actions do not exist.

- [ ] **Step 3: Update SiteSlice types**

In `src/admin/pages/site/store/slices/site/types.ts`, add structural preview/commit actions and narrow decorative placement actions.

```ts
  createExplorerFolder: (sectionId: DecorativeSiteExplorerSectionId | StructuralSiteExplorerSectionId, name: string, parentPath?: string) => string
  renameExplorerFolder: (sectionId: DecorativeSiteExplorerSectionId, folderId: string, name: string) => void
  deleteExplorerFolder: (sectionId: DecorativeSiteExplorerSectionId, folderId: string) => void
  moveExplorerFolder: (sectionId: DecorativeSiteExplorerSectionId, folderId: string, nextIndex: number) => void
  moveExplorerItem: (
    sectionId: DecorativeSiteExplorerSectionId,
    itemId: string,
    parentFolderId: string | null,
    nextIndex: number,
  ) => void
  moveExplorerItems: (
    sectionId: DecorativeSiteExplorerSectionId,
    itemIds: string[],
    parentFolderId: string | null,
    nextIndex: number,
  ) => void
  previewRenameExplorerFolder: (
    sectionId: StructuralSiteExplorerSectionId,
    folderPath: string,
    nextFolderPath: string,
  ) => ExplorerPathChangePlan
  previewMoveExplorerFolder: (
    sectionId: StructuralSiteExplorerSectionId,
    folderPath: string,
    nextParentPath: string | undefined,
  ) => ExplorerPathChangePlan
  previewMoveExplorerItem: (
    sectionId: StructuralSiteExplorerSectionId,
    itemId: string,
    nextParentPath: string | undefined,
  ) => ExplorerPathChangePlan
  previewDeleteExplorerFolder: (
    sectionId: StructuralSiteExplorerSectionId,
    folderPath: string,
  ) => ExplorerPathChangePlan
  commitExplorerPathChange: (plan: ExplorerPathChangePlan) => void
  toggleStructuralExplorerFolder: (sectionId: StructuralSiteExplorerSectionId, folderPath: string) => void
  moveStructuralExplorerRow: (
    sectionId: StructuralSiteExplorerSectionId,
    row: { kind: 'folder' | 'item'; id: string; parentPath?: string },
    nextIndex: number,
  ) => void
```

Import the new types from `@core/page-tree`.

- [ ] **Step 4: Update explorer actions**

In `src/admin/pages/site/store/slices/site/explorerActions.ts`, destructure `mutateSiteState` in addition to the existing helpers. Keep the existing decorative implementation for `templates` and `components`. Structural `createExplorerFolder` appends to `site.explorer[sectionId].emptyFolders`.

```ts
export function createExplorerActions({ mutateSite, mutateSiteState }: SiteSliceHelpers): ExplorerActions {
  return {
    // existing actions plus structural actions below
  }
}

function isStructuralSection(sectionId: SiteExplorerSectionId): sectionId is StructuralSiteExplorerSectionId {
  return sectionId === 'pages' || sectionId === 'styles' || sectionId === 'scripts'
}

function emptyFolderPath(name: string, parentPath?: string): string {
  const segment = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'new-folder'
  return parentPath ? `${parentPath}/${segment}` : segment
}
```

Implement `preview*` actions by calling path plan builders with the current site. Implement `commitExplorerPathChange` with one `mutateSite` call and pass `state.siteRuntime` as the live runtime mirror.

```ts
    commitExplorerPathChange: (plan) => {
      mutateSiteState((state, site) => {
        commitExplorerPathPlan(site, state.siteRuntime, plan)
        reconcileSiteExplorerInPlace(site)
        if (plan.kind === 'delete') {
          const deletedIds = new Set(plan.deletedItems.map((item) => item.id))
          if (plan.sectionId === 'pages' && state.activePageId && deletedIds.has(state.activePageId)) {
            state.activePageId = site.pages[0]?.id ?? null
            state.activeDocument = null
          }
          if ((plan.sectionId === 'styles' || plan.sectionId === 'scripts') && state.activeEditorFileId && deletedIds.has(state.activeEditorFileId)) {
            state.activeEditorFileId = null
          }
        }
        return true
      })
    },
```

Implement `toggleStructuralExplorerFolder` with `mutateSite`. It toggles membership in `site.explorer[sectionId].expandedFolders` and returns `false` when the folder path is empty.

```ts
    toggleStructuralExplorerFolder: (sectionId, folderPath) => {
      mutateSite((site) => {
        const path = folderPath.trim()
        if (!path) return false
        const expanded = site.explorer[sectionId].expandedFolders
        const index = expanded.indexOf(path)
        if (index === -1) expanded.push(path)
        else expanded.splice(index, 1)
        return true
      })
    },
```

Implement `moveStructuralExplorerRow` with `mutateSite`. It rewrites only `rowOrder` for the requested parent path.

```ts
    moveStructuralExplorerRow: (sectionId, row, nextIndex) => {
      mutateSite((site) => {
        const section = site.explorer[sectionId]
        const parentPath = row.parentPath
        const key = `${row.kind}:${row.id}`
        const siblings = section.rowOrder
          .filter((entry) => entry.parentPath === parentPath)
          .filter((entry) => `${entry.kind}:${entry.id}` !== key)
          .sort((a, b) => a.order - b.order)
        siblings.splice(Math.max(0, Math.min(nextIndex, siblings.length)), 0, {
          kind: row.kind,
          id: row.id,
          ...(parentPath ? { parentPath } : {}),
          order: 0,
        })
        section.rowOrder = [
          ...section.rowOrder.filter((entry) => entry.parentPath !== parentPath),
          ...siblings.map((entry, order) => ({ ...entry, order })),
        ]
        return true
      })
    },
```

- [ ] **Step 5: Update filesSlice style runtime deletion**

In `src/admin/pages/site/store/slices/filesSlice.ts`, update `deleteFile`.

```ts
        if (state.site.runtime?.scripts) delete state.site.runtime.scripts[id]
        if (state.site.runtime?.styles) delete state.site.runtime.styles[id]
        delete state.siteRuntime.scripts[id]
        delete state.siteRuntime.styles[id]
```

- [ ] **Step 6: Run store tests**

Run:

```sh
bun test src/__tests__/site-explorer/siteExplorerOrganizationStore.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```sh
git add src/admin/pages/site/store/slices/site/types.ts src/admin/pages/site/store/slices/site/explorerActions.ts src/admin/pages/site/store/slices/filesSlice.ts src/__tests__/site-explorer/siteExplorerOrganizationStore.test.ts
git commit -m "feat: commit structural explorer path changes"
```

## Task 4: Build Recursive Structural Explorer Models

**Files:**
- Modify: `src/admin/pages/site/panels/SiteExplorerPanel/siteExplorerModel.ts`
- Test: `src/__tests__/site-explorer/siteExplorerPathModel.test.ts`

- [ ] **Step 1: Add failing model tests**

Create `src/__tests__/site-explorer/siteExplorerPathModel.test.ts`.

```ts
import { describe, expect, it } from 'bun:test'
import { buildStructuralExplorerTreeSection } from '@site/panels/SiteExplorerPanel/siteExplorerModel'
import { createDefaultSiteExplorerOrganization } from '@core/page-tree'
import { makePage } from '../fixtures'

describe('buildStructuralExplorerTreeSection', () => {
  it('builds recursive page folders from slash slugs', () => {
    const explorer = createDefaultSiteExplorerOrganization()
    const model = buildStructuralExplorerTreeSection(
      'pages',
      explorer.pages,
      [
        { id: 'home', label: 'Home', path: 'index', meta: '/', active: false, pinned: true, target: { kind: 'page' as const, id: 'home' } },
        { id: 'docs', label: 'Docs', path: 'documentation', meta: '/documentation', active: false, target: { kind: 'page' as const, id: 'docs' } },
        { id: 'setup', label: 'Setup', path: 'documentation/setup', meta: '/documentation/setup', active: false, target: { kind: 'page' as const, id: 'setup' } },
      ],
    )

    expect(model.pinnedItems.map((item) => item.id)).toEqual(['home'])
    expect(model.rootEntries[0]).toMatchObject({
      kind: 'folder',
      folder: { path: 'documentation', name: 'documentation' },
    })
    const docs = model.rootEntries[0]
    if (docs.kind !== 'folder') throw new Error('Expected docs folder')
    expect(docs.landingItem?.id).toBe('docs')
    expect(docs.children.map((child) => child.kind === 'item' ? child.item.id : child.folder.path)).toEqual(['setup'])
  })

  it('builds script folders from file paths', () => {
    const explorer = createDefaultSiteExplorerOrganization()
    const model = buildStructuralExplorerTreeSection(
      'scripts',
      explorer.scripts,
      [
        { id: 'jquery', label: 'jquery.min.js', path: 'documentation/assets/js/vendor/jquery.min.js', meta: 'documentation/assets/js/vendor/jquery.min.js', active: false, target: { kind: 'file' as const, id: 'jquery' } },
      ],
    )

    expect(model.rootEntries[0]).toMatchObject({ kind: 'folder', folder: { path: 'documentation' } })
  })
})
```

- [ ] **Step 2: Run model tests and verify failure**

Run:

```sh
bun test src/__tests__/site-explorer/siteExplorerPathModel.test.ts
```

Expected: FAIL because `buildStructuralExplorerTreeSection` does not exist.

- [ ] **Step 3: Add structural model types**

In `siteExplorerModel.ts`, keep the existing decorative types and add structural types.

```ts
export interface SiteExplorerStructuralItem<TTarget> {
  id: string
  label: string
  path: string
  meta?: string
  icon: IconComponent
  active: boolean
  pinned?: boolean
  ariaLabel: string
  target: TTarget
}

export interface SiteExplorerStructuralFolder {
  path: string
  name: string
}

export type SiteExplorerStructuralEntry<TTarget> =
  | {
    kind: 'folder'
    folder: SiteExplorerStructuralFolder
    landingItem?: SiteExplorerStructuralItem<TTarget>
    children: SiteExplorerStructuralEntry<TTarget>[]
    empty: boolean
  }
  | { kind: 'item'; item: SiteExplorerStructuralItem<TTarget> }

export interface SiteExplorerStructuralSectionModel<TTarget> {
  kind: 'structural'
  sectionId: StructuralSiteExplorerSectionId
  expandedFolderPaths: string[]
  pinnedItems: SiteExplorerStructuralItem<TTarget>[]
  rootEntries: SiteExplorerStructuralEntry<TTarget>[]
}
```

- [ ] **Step 4: Implement recursive builder**

Add `buildStructuralExplorerTreeSection`.

```ts
export function buildStructuralExplorerTreeSection<TTarget>(
  sectionId: StructuralSiteExplorerSectionId,
  section: StructuralExplorerSection,
  items: readonly SiteExplorerStructuralItem<TTarget>[],
): SiteExplorerStructuralSectionModel<TTarget> {
  const pinnedItems = items.filter((item) => item.pinned)
  const unpinnedItems = items.filter((item) => !item.pinned)
  const folderByPath = new Map<string, Extract<SiteExplorerStructuralEntry<TTarget>, { kind: 'folder' }>>()
  const rootEntries: SiteExplorerStructuralEntry<TTarget>[] = []

  function ensureFolder(path: string): Extract<SiteExplorerStructuralEntry<TTarget>, { kind: 'folder' }> {
    const existing = folderByPath.get(path)
    if (existing) return existing
    const parent = parentPathForPath(path)
    const folder = {
      kind: 'folder' as const,
      folder: { path, name: basename(path) },
      children: [],
      empty: section.emptyFolders.includes(path),
    }
    folderByPath.set(path, folder)
    if (parent) ensureFolder(parent).children.push(folder)
    else rootEntries.push(folder)
    return folder
  }

  for (const path of section.emptyFolders) ensureFolder(path)

  for (const item of unpinnedItems) {
    const parent = parentPathForPath(item.path)
    const entry = { kind: 'item' as const, item }
    if (parent) {
      ensureFolder(parent).children.push(entry)
      const folderForItemPath = folderByPath.get(item.path)
      if (folderForItemPath) folderForItemPath.landingItem = item
    } else {
      const folderForItemPath = folderByPath.get(item.path)
      if (folderForItemPath) folderForItemPath.landingItem = item
      else rootEntries.push(entry)
    }
  }

  return {
    kind: 'structural',
    sectionId,
    expandedFolderPaths: section.expandedFolders,
    pinnedItems,
    rootEntries: orderStructuralEntries(rootEntries, section.rowOrder, undefined),
  }
}
```

Implement `parentPathForPath`, `basename`, and `orderStructuralEntries`. `orderStructuralEntries` sorts by matching `rowOrder` entries first and then by folder/item label, and it recursively orders every folder's `children`.

- [ ] **Step 5: Run model tests**

Run:

```sh
bun test src/__tests__/site-explorer/siteExplorerPathModel.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add src/admin/pages/site/panels/SiteExplorerPanel/siteExplorerModel.ts src/__tests__/site-explorer/siteExplorerPathModel.test.ts
git commit -m "feat: derive explorer trees from slugs and paths"
```

## Task 5: Render Recursive Structural Sections

**Files:**
- Modify: `src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerTreeSection.tsx`
- Modify: `src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.module.css`
- Test: `src/__tests__/site-explorer/siteExplorerPanel.test.tsx`

- [ ] **Step 1: Add failing recursive rendering tests**

Add this test to `src/__tests__/site-explorer/siteExplorerPanel.test.tsx`.

```ts
  it('renders nested page and script paths as recursive folders', () => {
    loadSite()
    useEditorStore.setState((state) => {
      if (!state.site) return
      state.site.pages.push(makePage({
        id: 'page-docs',
        title: 'Documentation',
        slug: 'documentation',
        rootNodeId: 'root-docs',
        nodes: { 'root-docs': makeNode({ id: 'root-docs', moduleId: 'base.body' }) },
      }))
      state.site.pages.push(makePage({
        id: 'page-setup',
        title: 'Setup',
        slug: 'documentation/setup',
        rootNodeId: 'root-setup',
        nodes: { 'root-setup': makeNode({ id: 'root-setup', moduleId: 'base.body' }) },
      }))
      state.site.files.push({
        id: 'script-vendor',
        path: 'documentation/assets/js/vendor/jquery.min.js',
        type: 'script',
        content: '',
        createdAt: 1,
        updatedAt: 1,
      })
    })

    render(<SiteExplorerPanel variant="docked" />)

    const panel = screen.getByTestId('site-explorer-panel')
    expect(within(panel).getByRole('button', { name: 'documentation' })).toBeDefined()
    fireEvent.click(within(panel).getByRole('button', { name: 'documentation' }))
    expect(within(panel).getByRole('button', { name: /open page setup/i })).toBeDefined()
    expect(within(panel).getByRole('button', { name: 'assets' })).toBeDefined()
    fireEvent.click(within(panel).getByRole('button', { name: 'assets' }))
    expect(within(panel).getByRole('button', { name: 'js' })).toBeDefined()
  })
```

- [ ] **Step 2: Run panel test and verify failure**

Run:

```sh
bun test src/__tests__/site-explorer/siteExplorerPanel.test.tsx -t "recursive folders"
```

Expected: FAIL because only one folder level is rendered.

- [ ] **Step 3: Add structural props to SiteExplorerTreeSection**

Change `SiteExplorerTreeSectionProps` to accept a union model.

```ts
type SiteExplorerAnySectionModel<TTarget> =
  | SiteExplorerTreeSectionModel<TTarget>
  | SiteExplorerStructuralSectionModel<TTarget>
```

Update `model` prop to `SiteExplorerAnySectionModel<TTarget>`.

- [ ] **Step 4: Render structural entries recursively**

Add a structural branch in `SiteExplorerTreeSection`.

```tsx
function renderStructuralEntry<TTarget>(
  entry: SiteExplorerStructuralEntry<TTarget>,
  depth: number,
  index: number,
  parentPath: string | undefined,
  props: StructuralRenderProps<TTarget>,
) {
  if (entry.kind === 'item') {
    return (
      <ExplorerItemRow
        key={entry.item.id}
        item={entry.item}
        sectionId={props.sectionId}
        depth={depth}
        index={index}
        parentFolderId={parentPath ?? null}
        dropPosition={dropPositionForItem(props.dropTarget, props.sectionId, entry.item.id)}
        renameActive={isInlineRenaming(props.inlineRenameTarget, 'item', props.sectionId, entry.item.id)}
        renameValue={props.inlineRenameTarget?.value ?? entry.item.label}
        selected={props.selectedItemIds.includes(entry.item.id)}
        selectedItemIds={props.selectedItemIds}
        onOpen={props.onOpenItem}
        onRename={props.onRenameItem}
        onCommitRename={props.onCommitInlineRename}
        onCancelRename={props.onCancelInlineRename}
        onContextMenu={props.onContextMenuItem}
        onKeyDown={props.onKeyDownItem}
      />
    )
  }

  const expanded = props.expandedFolderPaths.has(entry.folder.path)
  return (
    <Fragment key={entry.folder.path}>
      <ExplorerFolderRow
        folder={{ id: entry.folder.path, name: entry.folder.name, path: entry.folder.path }}
        sectionId={props.sectionId}
        rootIndex={index}
        itemCount={entry.children.length + (entry.landingItem ? 1 : 0)}
        expanded={expanded}
        depth={depth}
        dropPosition={dropPositionForFolder(props.dropTarget, props.sectionId, entry.folder.path)}
        renameActive={isInlineRenaming(props.inlineRenameTarget, 'folder', props.sectionId, entry.folder.path)}
        renameValue={props.inlineRenameTarget?.value ?? entry.folder.name}
        onToggle={() => props.onToggleFolder(entry.folder.path)}
        onRename={props.onRenameFolder}
        onCommitRename={props.onCommitInlineRename}
        onCancelRename={props.onCancelInlineRename}
        onContextMenu={props.onContextMenuFolder}
        onKeyDown={props.onKeyDownFolder}
      />
      {expanded && entry.children.map((child, childIndex) =>
        renderStructuralEntry(child, depth + 1, childIndex, entry.folder.path, props)
      )}
    </Fragment>
  )
}
```

Add `depth?: number` and `path?: string` to `SiteExplorerTreeFolder`. Preserve existing decorative rows by passing `depth={0}`.

- [ ] **Step 5: Persist expanded structural paths**

Move structural expanded state from component-local `useState` into `site.explorer[section].expandedFolders`. Use the store action from Task 3:

```ts
toggleStructuralExplorerFolder(sectionId: StructuralSiteExplorerSectionId, folderPath: string): void
```

For structural models, derive the expanded set from `model.expandedFolderPaths` and call `toggleStructuralExplorerFolder(model.sectionId, folderPath)` from folder chevrons. Keep component-local `useState` only for decorative Templates and Components.

- [ ] **Step 6: Run recursive rendering test**

Run:

```sh
bun test src/__tests__/site-explorer/siteExplorerPanel.test.tsx -t "recursive folders"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```sh
git add src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerTreeSection.tsx src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.module.css src/__tests__/site-explorer/siteExplorerPanel.test.tsx
git commit -m "feat: render structural explorer folders recursively"
```

## Task 6: Wire SiteExplorerPanel to Structural Models and Dialog

**Files:**
- Create: `src/admin/pages/site/panels/SiteExplorerPanel/explorerPathChangeConfirm.ts`
- Create: `src/admin/pages/site/panels/SiteExplorerPanel/ExplorerPathChangeConfirmDialog.tsx`
- Modify: `src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.tsx`
- Modify: `src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.module.css`
- Test: `src/__tests__/site-explorer/siteExplorerPanel.test.tsx`

- [ ] **Step 1: Add failing confirmation dialog tests**

Add this test to `src/__tests__/site-explorer/siteExplorerPanel.test.tsx`.

```ts
  it('confirms structural folder rename before rewriting page slugs', async () => {
    loadSite()
    useEditorStore.setState((state) => {
      if (!state.site) return
      state.site.pages.push(makePage({
        id: 'page-docs',
        title: 'Documentation',
        slug: 'documentation',
        rootNodeId: 'root-docs',
        nodes: { 'root-docs': makeNode({ id: 'root-docs', moduleId: 'base.body' }) },
      }))
      state.site.pages.push(makePage({
        id: 'page-setup',
        title: 'Setup',
        slug: 'documentation/setup',
        rootNodeId: 'root-setup',
        nodes: { 'root-setup': makeNode({ id: 'root-setup', moduleId: 'base.body' }) },
      }))
    })

    render(<SiteExplorerPanel variant="docked" />)
    const folderRow = screen.getByRole('button', { name: 'documentation' })
    fireEvent.contextMenu(folderRow)
    fireEvent.click(await screen.findByRole('menuitem', { name: /rename folder/i }))

    const input = screen.getByLabelText(/rename documentation/i)
    fireEvent.change(input, { target: { value: 'docs' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(await screen.findByRole('dialog', { name: /rename documentation to docs/i })).toBeDefined()
    expect(screen.getByText('documentation/setup')).toBeDefined()
    expect(screen.getByText('docs/setup')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /rename/i }))
    await waitFor(() => {
      expect(useEditorStore.getState().site!.pages.find((page) => page.id === 'page-setup')?.slug).toBe('docs/setup')
    })
  })
```

- [ ] **Step 2: Run confirmation test and verify failure**

Run:

```sh
bun test src/__tests__/site-explorer/siteExplorerPanel.test.tsx -t "confirms structural folder rename"
```

Expected: FAIL because no path confirmation dialog exists.

- [ ] **Step 3: Create confirm context hook**

Create `src/admin/pages/site/panels/SiteExplorerPanel/explorerPathChangeConfirm.ts`.

```ts
import { createConfirmContext } from '@admin/shared/dialogs/confirmContextFactory'
import type { ExplorerPathChangePlan } from '@core/page-tree'

export interface ConfirmExplorerPathChangeRequest {
  plan: ExplorerPathChangePlan
  commit: () => void
}

const explorerPathChangeConfirm = createConfirmContext<
  ConfirmExplorerPathChangeRequest,
  ExplorerPathChangePlan
>()

export const ExplorerPathChangeConfirmContext = explorerPathChangeConfirm.Context
export const useExplorerPathChangeConfirmController = explorerPathChangeConfirm.useConfirmController
export const useExplorerPathChangeConfirm = explorerPathChangeConfirm.useConfirm
```

- [ ] **Step 4: Create dialog component**

Create `ExplorerPathChangeConfirmDialog.tsx`.

```tsx
import { useRef } from 'react'
import { Button } from '@ui/components/Button'
import { Dialog } from '@ui/components/Dialog'
import type { ExplorerPathChangePlan } from '@core/page-tree'
import styles from './SiteExplorerPanel.module.css'

interface ExplorerPathChangeConfirmDialogProps {
  plan: ExplorerPathChangePlan
  onCancel: () => void
  onConfirm: () => void
}

export function ExplorerPathChangeConfirmDialog({
  plan,
  onCancel,
  onConfirm,
}: ExplorerPathChangeConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const blocked = plan.blockers.length > 0
  const title = plan.operationLabel
  return (
    <Dialog
      open
      tone={plan.kind === 'delete' ? 'danger' : 'default'}
      title={title}
      size="lg"
      onClose={onCancel}
      initialFocusRef={confirmRef}
      footer={
        <>
          <Button variant="secondary" size="sm" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            variant={plan.kind === 'delete' ? 'destructive' : 'primary'}
            size="sm"
            type="button"
            disabled={blocked}
            onClick={onConfirm}
          >
            {plan.kind === 'delete' ? 'Delete' : 'Rename'}
          </Button>
        </>
      }
    >
      <p className={styles.pathChangeSummary}>
        {plan.kind === 'delete'
          ? `${plan.deletedItems.length} ${plan.deletedItems.length === 1 ? 'item' : 'items'} will be deleted.`
          : `${plan.changes.length} ${plan.changes.length === 1 ? 'path' : 'paths'} will change.`}
      </p>
      {plan.blockers.length > 0 && (
        <ul className={styles.pathChangeBlockers} role="alert">
          {plan.blockers.map((blocker) => (
            <li key={`${blocker.code}:${blocker.target}`}>{blocker.message}</li>
          ))}
        </ul>
      )}
      {plan.warnings.length > 0 && (
        <ul className={styles.pathChangeWarnings}>
          {plan.warnings.map((warning) => (
            <li key={`${warning.code}:${warning.sourcePath ?? warning.message}`}>{warning.message}</li>
          ))}
        </ul>
      )}
      <ul className={styles.pathChangeList}>
        {plan.kind === 'rewrite'
          ? plan.changes.map((change) => (
            <li key={change.id} className={styles.pathChangeItem}>
              <code>{change.from}</code>
              <span>-></span>
              <code>{change.to}</code>
            </li>
          ))
          : plan.deletedItems.map((item) => (
            <li key={item.id} className={styles.pathChangeItem}>
              <code>{item.path}</code>
            </li>
          ))}
      </ul>
    </Dialog>
  )
}
```

- [ ] **Step 5: Add dialog styles**

Add token-only CSS to `SiteExplorerPanel.module.css`.

```css
.pathChangeSummary {
    margin: 0;
    color: var(--editor-text);
    font-size: 12px;
    line-height: 1.4;
}

.pathChangeBlockers,
.pathChangeWarnings,
.pathChangeList {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.pathChangeBlockers {
    color: var(--editor-danger);
}

.pathChangeWarnings {
    color: var(--editor-warning);
}

.pathChangeItem {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 8px;
    align-items: baseline;
    color: var(--editor-text-muted);
    font-size: 11px;
}

.pathChangeItem code {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--editor-text);
    font-family: var(--font-mono);
}
```

- [ ] **Step 6: Wire provider in SiteExplorerPanel**

In `SiteExplorerPanel.tsx`, call `useExplorerPathChangeConfirmController`.

```tsx
  const pathChangeConfirm = useExplorerPathChangeConfirmController((request) => {
    if (request.plan.kind === 'rewrite' && request.plan.changes.length === 0) {
      request.commit()
      return { status: 'handled' }
    }
    if (request.plan.kind === 'delete' && request.plan.deletedItems.length === 0) {
      request.commit()
      return { status: 'handled' }
    }
    return { status: 'confirm', impact: request.plan }
  })
```

Wrap the panel JSX in `ExplorerPathChangeConfirmContext.Provider` and render `ExplorerPathChangeConfirmDialog` when pending exists.

- [ ] **Step 7: Route structural folder rename through plan preview**

In the inline folder rename commit branch, detect structural section ids and call:

```ts
const nextPath = parentPath
  ? `${parentPath}/${normalizeStructuralSegment(value)}`
  : normalizeStructuralSegment(value)
const plan = previewRenameExplorerFolder(sectionId, folder.path, nextPath)
pathChangeConfirm.confirm({
  plan,
  commit: () => commitExplorerPathChange(plan),
})
```

Keep the existing decorative rename branch for Templates and Components.

- [ ] **Step 8: Run confirmation test**

Run:

```sh
bun test src/__tests__/site-explorer/siteExplorerPanel.test.tsx -t "confirms structural folder rename"
```

Expected: PASS.

- [ ] **Step 9: Commit**

```sh
git add src/admin/pages/site/panels/SiteExplorerPanel/explorerPathChangeConfirm.ts src/admin/pages/site/panels/SiteExplorerPanel/ExplorerPathChangeConfirmDialog.tsx src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.tsx src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.module.css src/__tests__/site-explorer/siteExplorerPanel.test.tsx
git commit -m "feat: confirm structural explorer path changes"
```

## Task 7: Update Drag and Context Menu Behavior

**Files:**
- Modify: `src/admin/pages/site/panels/SiteExplorerPanel/useSiteExplorerDnd.ts`
- Modify: `src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.tsx`
- Modify: `src/admin/pages/site/panels/SiteExplorerPanel/siteExplorerPanelUtils.ts`
- Test: `src/__tests__/site-explorer/siteExplorerPanel.test.tsx`

- [ ] **Step 1: Add failing delete-folder dialog test**

Add this test to `src/__tests__/site-explorer/siteExplorerPanel.test.tsx`.

```ts
  it('deletes structural folders by listing descendant pages before commit', async () => {
    loadSite()
    useEditorStore.setState((state) => {
      if (!state.site) return
      state.site.pages.push(makePage({
        id: 'page-docs',
        title: 'Documentation',
        slug: 'documentation',
        rootNodeId: 'root-docs',
        nodes: { 'root-docs': makeNode({ id: 'root-docs', moduleId: 'base.body' }) },
      }))
      state.site.pages.push(makePage({
        id: 'page-setup',
        title: 'Setup',
        slug: 'documentation/setup',
        rootNodeId: 'root-setup',
        nodes: { 'root-setup': makeNode({ id: 'root-setup', moduleId: 'base.body' }) },
      }))
    })
    render(<SiteExplorerPanel variant="docked" />)

    fireEvent.contextMenu(screen.getByRole('button', { name: 'documentation' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete folder/i }))

    expect(await screen.findByRole('dialog', { name: /delete documentation/i })).toBeDefined()
    expect(screen.getByText('documentation/setup')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(useEditorStore.getState().site!.pages.some((page) => page.slug.startsWith('documentation'))).toBe(false)
    })
  })
```

- [ ] **Step 2: Run delete-folder test and verify failure**

Run:

```sh
bun test src/__tests__/site-explorer/siteExplorerPanel.test.tsx -t "deletes structural folders"
```

Expected: FAIL because delete folder still uses decorative delete or does not show impact.

- [ ] **Step 3: Extend drag data with structural paths**

In `useSiteExplorerDnd.ts`, extend drag/drop data.

```ts
  | {
    kind: 'siteExplorerFolder'
    sectionId: SiteExplorerSectionId
    folderId: string
    folderPath?: string
    parentPath?: string
    label: string
    icon?: IconComponent
  }
```

For structural folder rows, set `folderId` and `folderPath` to the full path. For decorative rows, keep `folderId` as the nanoid and leave `folderPath` undefined.

- [ ] **Step 4: Split decorative and structural drop handlers**

In `handleFolderDrop` and `handleItemDrop`, branch on section id.

```ts
if (isStructuralSection(active.sectionId)) {
  handleStructuralDrop(active, target)
  return
}
```

`handleStructuralDrop` calls the store preview action and then the panel-level confirmation callback. Because `useSiteExplorerDnd` currently reads store directly, pass an `onPathChangePlan(plan)` callback into the hook from `SiteExplorerPanel` instead of committing inside the hook.

- [ ] **Step 5: Add same-parent row order updates**

For same-parent before/after drops, update only `site.explorer[sectionId].rowOrder`. Add store action:

```ts
moveStructuralExplorerRow(
  sectionId: StructuralSiteExplorerSectionId,
  row: { kind: 'folder' | 'item'; id: string; parentPath?: string },
  nextIndex: number,
): void
```

Implement by normalizing `rowOrder` for that `parentPath`, removing the dragged row key, inserting at `nextIndex`, and assigning zero-based `order`.

- [ ] **Step 6: Route structural folder delete through delete plan**

In `SiteExplorerPanel.tsx`, update the context menu delete handler:

```ts
if (target.kind === 'folder' && isStructuralSection(target.sectionId)) {
  const plan = previewDeleteExplorerFolder(target.sectionId, target.id)
  pathChangeConfirm.confirm({
    plan,
    commit: () => commitExplorerPathChange(plan),
  })
  return
}
```

For Templates/Components, keep `deleteExplorerFolder(sectionId, folderId)`.

- [ ] **Step 7: Run delete and DnD related tests**

Run:

```sh
bun test src/__tests__/site-explorer/siteExplorerPanel.test.tsx src/__tests__/site-explorer/siteExplorerOrganizationStore.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```sh
git add src/admin/pages/site/panels/SiteExplorerPanel/useSiteExplorerDnd.ts src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.tsx src/admin/pages/site/panels/SiteExplorerPanel/siteExplorerPanelUtils.ts src/__tests__/site-explorer/siteExplorerPanel.test.tsx src/__tests__/site-explorer/siteExplorerOrganizationStore.test.ts
git commit -m "feat: route explorer drag actions through path plans"
```

## Task 8: Update Import and Existing Tests for Path Folders

**Files:**
- Modify: `src/__tests__/siteImport/applyImport.test.ts`
- Modify: `src/__tests__/siteImport/htmlPagePlan.test.ts`
- Modify: `src/__tests__/site-explorer/siteExplorerPanel.test.tsx`
- Modify: `src/__tests__/page-tree/siteExplorerOrganization.test.ts`

- [ ] **Step 1: Add import display regression test**

Add this test to `src/__tests__/site-explorer/siteExplorerPanel.test.tsx`.

```ts
  it('shows imported nested pages and scripts as folders without decorative placements', () => {
    loadSite()
    useEditorStore.setState((state) => {
      if (!state.site) return
      state.site.pages.push(makePage({
        id: 'page-docs',
        title: 'Documentation',
        slug: 'documentation',
        rootNodeId: 'root-docs',
        nodes: { 'root-docs': makeNode({ id: 'root-docs', moduleId: 'base.body' }) },
      }))
      state.site.pages.push(makePage({
        id: 'page-download',
        title: 'Download',
        slug: 'download-version',
        rootNodeId: 'root-download',
        nodes: { 'root-download': makeNode({ id: 'root-download', moduleId: 'base.body' }) },
      }))
      state.site.files.push(
        { id: 'doc-main', path: 'documentation/assets/js/main.js', type: 'script', content: '', createdAt: 1, updatedAt: 1 },
        { id: 'download-main', path: 'download-version/assets/js/main.js', type: 'script', content: '', createdAt: 1, updatedAt: 1 },
      )
    })

    render(<SiteExplorerPanel variant="docked" />)

    expect(screen.getByRole('button', { name: 'documentation' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'download-version' })).toBeDefined()
    expect(useEditorStore.getState().site!.explorer.pages).not.toHaveProperty('folders')
    expect(useEditorStore.getState().site!.explorer.scripts).not.toHaveProperty('folders')
  })
```

- [ ] **Step 2: Run import display test**

Run:

```sh
bun test src/__tests__/site-explorer/siteExplorerPanel.test.tsx -t "imported nested"
```

Expected: PASS. A failure means structural model wiring is incomplete; fix that wiring before proceeding.

- [ ] **Step 3: Replace old decorative page/style/script assertions**

In `src/__tests__/page-tree/siteExplorerOrganization.test.ts` and `src/__tests__/site-explorer/siteExplorerOrganizationStore.test.ts`, replace expectations that `pages`, `styles`, or `scripts` have `folders`/`items` with structural expectations:

```ts
expect(explorer.pages).toMatchObject({ expandedFolders: [], emptyFolders: [], rowOrder: [] })
expect(explorer.styles).toMatchObject({ expandedFolders: [], emptyFolders: [], rowOrder: [] })
expect(explorer.scripts).toMatchObject({ expandedFolders: [], emptyFolders: [], rowOrder: [] })
```

Keep Templates and Components decorative expectations.

- [ ] **Step 4: Run site import and explorer tests**

Run:

```sh
bun test src/__tests__/siteImport src/__tests__/site-explorer src/__tests__/page-tree/siteExplorerOrganization.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/__tests__/siteImport/applyImport.test.ts src/__tests__/siteImport/htmlPagePlan.test.ts src/__tests__/site-explorer/siteExplorerPanel.test.tsx src/__tests__/page-tree/siteExplorerOrganization.test.ts src/__tests__/site-explorer/siteExplorerOrganizationStore.test.ts
git commit -m "test: cover path-derived site explorer imports"
```

## Task 9: Update Documentation

**Files:**
- Modify: `docs/editor.md`
- Modify: `docs/features/site-shell.md`
- Modify: `docs/features/site-import.md`
- Modify: `docs/reference/page-tree.md`
- Modify: `docs/superpowers/specs/2026-06-08-site-explorer-path-folders-design.md`

- [ ] **Step 1: Update editor Site Explorer section**

In `docs/editor.md`, replace the paragraph that says folders are decorative and flat with:

```md
Organization is persisted in `site.explorer` on the site shell, but section ownership differs by artifact type. Pages, Styles, and Scripts derive folder nesting from their own source fields: `Page.slug` for pages and `SiteFile.path` for styles/scripts. Templates and Components keep decorative folders because they do not publish as route or file paths.
```

Update the action table so structural actions are named as path operations:

```md
| `previewRenameExplorerFolder(sectionId, folderPath, nextFolderPath)` | Builds an exact path rewrite plan for Pages, Styles, or Scripts |
| `previewMoveExplorerFolder(sectionId, folderPath, nextParentPath)` | Builds an exact path rewrite plan for moving a structural folder |
| `previewMoveExplorerItem(sectionId, itemId, nextParentPath)` | Builds an exact path rewrite plan for moving one structural item |
| `previewDeleteExplorerFolder(sectionId, folderPath)` | Builds a delete plan for every descendant page/file |
| `commitExplorerPathChange(plan)` | Applies a confirmed structural rewrite/delete plan |
```

- [ ] **Step 2: Update site shell feature doc**

In `docs/features/site-shell.md`, replace the `SiteExplorerOrganization` type block with the structural/decorative split from the spec. State that `rowOrder` never decides membership.

- [ ] **Step 3: Update import docs**

In `docs/features/site-import.md`, add:

```md
Nested HTML paths and imported script/style paths do not create decorative Site Explorer folders. The Explorer derives the folder tree from the committed page slugs and file paths.
```

- [ ] **Step 4: Update page-tree reference**

In `docs/reference/page-tree.md`, keep the slash-slug notes and add that Site Explorer Pages uses those slugs as structural path folders.

- [ ] **Step 5: Run doc grep checks**

Run:

```sh
rg -n "decorative and flat|putting a page in a folder does not|folders are intentionally flat" docs
```

Expected: no matches outside the old superseded `docs/superpowers/specs/2026-06-01-site-explorer-organization-design.md`. If the old spec appears, add one sentence at the top of that old spec:

```md
Superseded by `docs/superpowers/specs/2026-06-08-site-explorer-path-folders-design.md`.
```

- [ ] **Step 6: Commit**

```sh
git add docs/editor.md docs/features/site-shell.md docs/features/site-import.md docs/reference/page-tree.md docs/superpowers/specs/2026-06-08-site-explorer-path-folders-design.md docs/superpowers/specs/2026-06-01-site-explorer-organization-design.md
git commit -m "docs: document path-derived explorer folders"
```

## Task 10: Final Verification

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run focused tests**

Run:

```sh
bun test src/__tests__/page-tree/siteExplorerOrganization.test.ts src/__tests__/site-explorer src/__tests__/siteImport
```

Expected: PASS.

- [ ] **Step 2: Run build**

Run:

```sh
bun run build
```

Expected: PASS. Vite chunk-size warnings are acceptable if no errors are emitted.

- [ ] **Step 3: Run lint**

Run:

```sh
bun run lint
```

Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run:

```sh
bun test
```

Expected: PASS for touched areas. If the only failure is the pre-existing unrelated `src/__tests__/architecture/module-size-budgets.test.ts` failure for `src/admin/pages/site/canvas/IframeFrameSurface.tsx`, record it in the final summary and do not modify that file.

- [ ] **Step 5: Run optional browser smoke**

Run:

```sh
bun run dev
```

Open `http://127.0.0.1:5173/admin/site` and use the seeded local credentials from `AGENTS.md`.

Smoke path:

1. Import or create pages with `documentation` and `documentation/setup` slugs.
2. Verify Pages shows `documentation` as a folder with `setup` nested.
3. Rename `documentation` to `docs`.
4. Confirm the dialog lists `documentation -> docs` and `documentation/setup -> docs/setup`.
5. Confirm and verify the row paths update.
6. Add scripts at `documentation/assets/js/main.js` and `documentation/assets/js/vendor/jquery.min.js`.
7. Verify Scripts shows nested folders.
8. Delete `documentation/assets/js`.
9. Confirm the dialog lists both scripts and verify both files disappear.

- [ ] **Step 6: Final status**

Run:

```sh
git status --short
```

Expected: only intentional files are modified. Do not revert unrelated dirty files from parallel sessions.

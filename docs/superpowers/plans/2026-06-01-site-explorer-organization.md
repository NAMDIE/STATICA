# Site Explorer Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build persisted decorative folders and ordering for every Site Explorer section while keeping the homepage pinned and preserving component drag-to-canvas.

**Architecture:** Add a `site.explorer` shell field backed by `src/core/page-tree/siteExplorer.ts`, then reconcile it against current pages, templates, components, styles, and scripts. Render all Site Explorer categories through one Tree-based section component that uses the existing canvas-level `DndContext` via `useDndMonitor`, so component rows can keep a separate canvas drag handle.

**Tech Stack:** Bun, TypeScript, TypeBox, React 19, Zustand + Immer, `@dnd-kit/core`, CSS Modules, pixel-art-icons.

---

### Task 1: Core Organization Model

**Files:**
- Create: `src/core/page-tree/siteExplorer.ts`
- Modify: `src/core/page-tree/siteDocument.ts`
- Modify: `src/core/page-tree/index.ts`
- Modify: `src/core/persistence/validate.ts`
- Modify: `src/__tests__/fixtures/index.ts`
- Test: `src/__tests__/page-tree/siteExplorerOrganization.test.ts`

- [ ] **Step 1: Write failing model tests**

Create `src/__tests__/page-tree/siteExplorerOrganization.test.ts` with tests for:

```ts
import { describe, expect, it } from 'bun:test'
import {
  createDefaultSiteExplorerOrganization,
  parseSiteExplorerOrganization,
  reconcileSiteExplorerOrganization,
  moveExplorerItem,
  createExplorerFolder,
} from '@core/page-tree'
import { makePage, makeSite } from '../fixtures'

describe('site explorer organization', () => {
  it('parses missing explorer data to empty sections', () => {
    expect(parseSiteExplorerOrganization(undefined).pages).toEqual({ folders: [], items: [] })
  })

  it('reconciles page/template/component/style/script placements from current site data', () => {
    const site = makeSite({
      pages: [
        makePage({ id: 'home', slug: 'index', title: 'Home' }),
        makePage({ id: 'pricing', slug: 'pricing', title: 'Pricing' }),
        makePage({
          id: 'post-template',
          slug: 'post-template',
          title: 'Post Template',
          template: { enabled: true, context: 'entry', tableSlug: 'posts', priority: 0, conditions: [] },
        }),
      ],
      visualComponents: [{
        id: 'hero',
        name: 'Hero',
        tree: { rootNodeId: 'hero-root', nodes: { 'hero-root': { id: 'hero-root', moduleId: 'base.body', props: {}, children: [], breakpointOverrides: {}, classIds: [] } } },
        params: [],
        classIds: [],
        createdAt: 1,
      }],
      files: [
        { id: 'theme', path: 'src/styles/theme.css', type: 'style', content: '', createdAt: 1, updatedAt: 1 },
        { id: 'analytics', path: 'src/scripts/analytics.ts', type: 'script', content: '', createdAt: 1, updatedAt: 1 },
      ],
    })

    const explorer = reconcileSiteExplorerOrganization(createDefaultSiteExplorerOrganization(), site)
    expect(explorer.pages.items.map((item) => item.id)).toEqual(['home', 'pricing'])
    expect(explorer.templates.items.map((item) => item.id)).toEqual(['post-template'])
    expect(explorer.components.items.map((item) => item.id)).toEqual(['hero'])
    expect(explorer.styles.items.map((item) => item.id)).toEqual(['theme'])
    expect(explorer.scripts.items.map((item) => item.id)).toEqual(['analytics'])
  })

  it('moves items into folders without changing item arrays', () => {
    const site = makeSite({ pages: [makePage({ id: 'home', slug: 'index' }), makePage({ id: 'pricing', slug: 'pricing' })] })
    const explorer = reconcileSiteExplorerOrganization(createDefaultSiteExplorerOrganization(), site)
    const folderId = createExplorerFolder(explorer, 'pages', 'Marketing')
    moveExplorerItem(explorer, 'pages', 'pricing', folderId, 0)
    expect(explorer.pages.items.find((item) => item.id === 'pricing')?.parentFolderId).toBe(folderId)
  })
})
```

Run: `bun test src/__tests__/page-tree/siteExplorerOrganization.test.ts`
Expected: FAIL because `@core/page-tree` does not export the organization helpers.

- [ ] **Step 2: Implement model helpers**

Create `src/core/page-tree/siteExplorer.ts` with:

```ts
export const SiteExplorerSectionIdSchema = Type.Union([
  Type.Literal('pages'),
  Type.Literal('templates'),
  Type.Literal('components'),
  Type.Literal('styles'),
  Type.Literal('scripts'),
])
export const SITE_EXPLORER_SECTION_IDS = ['pages', 'templates', 'components', 'styles', 'scripts'] as const
export type SiteExplorerSectionId = (typeof SITE_EXPLORER_SECTION_IDS)[number]
```

Implement `SiteExplorerOrganizationSchema`, `createDefaultSiteExplorerOrganization`, `parseSiteExplorerOrganization`, `reconcileSiteExplorerOrganization`, `createExplorerFolder`, `renameExplorerFolder`, `deleteExplorerFolder`, `moveExplorerFolder`, and `moveExplorerItem`.

Update `SiteShellSchema`, `parseSiteDocument`, `readStoredShell`, fixtures, and the barrel export.

- [ ] **Step 3: Verify model tests pass**

Run: `bun test src/__tests__/page-tree/siteExplorerOrganization.test.ts`
Expected: PASS.

### Task 2: Store Actions and Item Lifecycle

**Files:**
- Create: `src/admin/pages/site/store/slices/site/explorerActions.ts`
- Modify: `src/admin/pages/site/store/slices/site/types.ts`
- Modify: `src/admin/pages/site/store/slices/siteSlice.ts`
- Modify: `src/admin/pages/site/store/slices/site/lifecycleActions.ts`
- Modify: `src/admin/pages/site/store/slices/site/pageActions.ts`
- Modify: `src/admin/pages/site/store/slices/filesSlice.ts`
- Modify: `src/admin/pages/site/store/slices/visualComponentsSlice.ts`
- Test: `src/__tests__/site-explorer/siteExplorerOrganizationStore.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `siteExplorerOrganizationStore.test.ts` with tests that load a site, call `createExplorerFolder`, `moveExplorerItem`, `deleteExplorerFolder`, `convertPageToTemplate`, `createFile`, and `deleteVisualComponent`, then assert `site.explorer` updates.

Run: `bun test src/__tests__/site-explorer/siteExplorerOrganizationStore.test.ts`
Expected: FAIL because the store actions do not exist.

- [ ] **Step 2: Implement store action wiring**

Expose these actions on `SiteSlice`:

```ts
createExplorerFolder(sectionId: SiteExplorerSectionId, name: string): string
renameExplorerFolder(sectionId: SiteExplorerSectionId, folderId: string, name: string): void
deleteExplorerFolder(sectionId: SiteExplorerSectionId, folderId: string): void
moveExplorerFolder(sectionId: SiteExplorerSectionId, folderId: string, nextIndex: number): void
moveExplorerItem(sectionId: SiteExplorerSectionId, itemId: string, parentFolderId: string | null, nextIndex: number): void
setPageAsHomepage(pageId: string): void
```

Use `mutateSite` for all actions. Reconcile organization in `createSite`, `loadSite`, page/template conversions, file creates/deletes, and VC creates/deletes.

- [ ] **Step 3: Verify store tests pass**

Run: `bun test src/__tests__/site-explorer/siteExplorerOrganizationStore.test.ts`
Expected: PASS.

### Task 3: Tree-Based Site Explorer UI

**Files:**
- Create: `src/admin/pages/site/panels/SiteExplorerPanel/siteExplorerModel.ts`
- Create: `src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerTreeSection.tsx`
- Create: `src/admin/pages/site/panels/SiteExplorerPanel/useSiteExplorerDnd.ts`
- Modify: `src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.tsx`
- Modify: `src/admin/pages/site/panels/SiteExplorerPanel/SiteExplorerPanel.module.css`
- Test: `src/__tests__/site-explorer/siteExplorerPanel.test.tsx`
- Test: `src/__tests__/site-explorer/siteExplorerTemplates.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Extend `siteExplorerPanel.test.tsx` to assert:

```ts
expect(within(panel).getByRole('tree', { name: 'Pages' })).toBeDefined()
expect(within(panel).getByRole('treeitem', { name: /home/i }).getAttribute('data-pinned')).toBe('true')
```

Add a test that creates a folder with a section action, renames it, moves Pricing into it via `moveExplorerItem`, and sees Pricing nested under that folder.

Run: `bun test src/__tests__/site-explorer/siteExplorerPanel.test.tsx`
Expected: FAIL because the UI is still flat.

- [ ] **Step 2: Implement reusable tree section**

Build `SiteExplorerTreeSection` with `TreeContainer`, `TreeRow`, `TreeChevron`, `TreeIconSlot`, `TreeLabel`, and `TreeMeta`. Render homepage first and set `data-pinned="true"`. Do not attach organization drag handlers to the homepage.

Use `useDndMonitor` in `useSiteExplorerDnd` to listen to the existing outer `DndContext`, and ignore `visualComponentRef` payloads.

For component rows, keep a dedicated `site-explorer-component-drag-handle` using the existing `visualComponentRef` payload so canvas drops still work.

- [ ] **Step 3: Verify UI tests pass**

Run: `bun test src/__tests__/site-explorer/siteExplorerPanel.test.tsx src/__tests__/site-explorer/siteExplorerTemplates.test.tsx`
Expected: PASS.

### Task 4: Architecture, Docs, and Final Verification

**Files:**
- Modify: `src/__tests__/architecture/task455-tree-primitive.test.ts`
- Modify: `docs/features/site-shell.md`
- Modify: `docs/editor.md` or `docs/reference/ui-primitives.md` if needed

- [ ] **Step 1: Update architecture gate**

Change `task455-tree-primitive.test.ts` so Site Explorer must import from `@site/ui/Tree` and render `TreeContainer` / `TreeRow`.

- [ ] **Step 2: Update docs**

Document `site.explorer` in `docs/features/site-shell.md` and mention the Site Explorer now uses Tree primitives in the editor docs/reference docs.

- [ ] **Step 3: Run final verification**

Run:

```sh
bun test
bun run build
bun run lint
```

Expected: PASS, except for failures already attributable to unrelated work outside this worktree.

import { beforeEach, describe, expect, it } from 'bun:test'
import { useEditorStore } from '@site/store/store'
import { createDefaultSiteExplorerOrganization, type SiteDocument } from '@core/page-tree'
import type { VisualComponent } from '@core/visualComponents'
import { makeNode, makePage, makeSite } from '../fixtures'

function resetStore() {
  localStorage.clear()
  useEditorStore.setState({
    site: null,
    activePageId: null,
    activeDocument: null,
    activeEditorFileId: null,
    _historyPast: [],
    _historyFuture: [],
    canUndo: false,
    canRedo: false,
    hasUnsavedChanges: false,
  } as Parameters<typeof useEditorStore.setState>[0])
}

function makeVisualComponent(id: string, name: string): VisualComponent {
  const rootNodeId = `${id}-root`
  return {
    id,
    name,
    tree: {
      rootNodeId,
      nodes: {
        [rootNodeId]: {
          id: rootNodeId,
          moduleId: 'base.body',
          props: {},
          children: [],
          breakpointOverrides: {},
          classIds: [],
        },
      },
    },
    params: [],
    classIds: [],
    createdAt: 1,
  }
}

function loadExplorerSite(overrides: Partial<SiteDocument> = {}) {
  const home = makePage({
    id: 'home',
    title: 'Home',
    slug: 'index',
    rootNodeId: 'root-home',
    nodes: { 'root-home': makeNode({ id: 'root-home', moduleId: 'base.body' }) },
  })
  const pricing = makePage({
    id: 'pricing',
    title: 'Pricing',
    slug: 'pricing',
    rootNodeId: 'root-pricing',
    nodes: { 'root-pricing': makeNode({ id: 'root-pricing', moduleId: 'base.body' }) },
  })
  const site = makeSite({
    pages: [home, pricing],
    visualComponents: [makeVisualComponent('hero', 'Hero')],
    files: [
      {
        id: 'theme',
        path: 'src/styles/theme.css',
        type: 'style',
        content: '',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    explorer: createDefaultSiteExplorerOrganization(),
    ...overrides,
  })
  useEditorStore.getState().loadSite(site)
}

beforeEach(resetStore)

describe('Site Explorer organization store actions', () => {
  it('creates folders and moves page placements into them', () => {
    loadExplorerSite()

    const folderId = useEditorStore.getState().createExplorerFolder('pages', 'Marketing')
    useEditorStore.getState().moveExplorerItem('pages', 'pricing', folderId, 0)

    const explorer = useEditorStore.getState().site?.explorer
    expect(explorer?.pages.folders).toEqual([{ id: folderId, name: 'Marketing', order: 1 }])
    expect(explorer?.pages.items.find((item) => item.id === 'pricing')?.parentFolderId).toBe(folderId)
  })

  it('deleting a folder keeps its pages at the section root', () => {
    loadExplorerSite()
    const store = useEditorStore.getState()
    const folderId = store.createExplorerFolder('pages', 'Marketing')
    store.moveExplorerItem('pages', 'pricing', folderId, 0)

    useEditorStore.getState().deleteExplorerFolder('pages', folderId)

    const explorer = useEditorStore.getState().site?.explorer
    expect(explorer?.pages.folders).toEqual([])
    expect(explorer?.pages.items.find((item) => item.id === 'pricing')?.parentFolderId).toBeUndefined()
  })

  it('moves organization placement when a page becomes a template and back', () => {
    loadExplorerSite()

    useEditorStore.getState().convertPageToTemplate('pricing', {
      enabled: true,
      context: 'entry',
      tableSlug: 'posts',
      priority: 0,
      conditions: [],
    })

    let explorer = useEditorStore.getState().site?.explorer
    expect(explorer?.pages.items.some((item) => item.id === 'pricing')).toBe(false)
    expect(explorer?.templates.items.some((item) => item.id === 'pricing')).toBe(true)

    useEditorStore.getState().convertTemplateToPage('pricing')

    explorer = useEditorStore.getState().site?.explorer
    expect(explorer?.templates.items.some((item) => item.id === 'pricing')).toBe(false)
    expect(explorer?.pages.items.some((item) => item.id === 'pricing')).toBe(true)
  })

  it('updates file and component placements when items are created and deleted', () => {
    loadExplorerSite()

    const scriptId = useEditorStore.getState().createFile('src/scripts/analytics.ts', 'script', '')
    const componentId = useEditorStore.getState().createVisualComponent('Promo')

    let explorer = useEditorStore.getState().site?.explorer
    expect(explorer?.scripts.items.some((item) => item.id === scriptId)).toBe(true)
    expect(explorer?.components.items.some((item) => item.id === componentId)).toBe(true)

    useEditorStore.getState().deleteFile(scriptId)
    useEditorStore.getState().deleteVisualComponent(componentId)

    explorer = useEditorStore.getState().site?.explorer
    expect(explorer?.scripts.items.some((item) => item.id === scriptId)).toBe(false)
    expect(explorer?.components.items.some((item) => item.id === componentId)).toBe(false)
  })

  it('sets a page as homepage and clears its folder placement', () => {
    loadExplorerSite()
    const folderId = useEditorStore.getState().createExplorerFolder('pages', 'Marketing')
    useEditorStore.getState().moveExplorerItem('pages', 'pricing', folderId, 0)

    useEditorStore.getState().setPageAsHomepage('pricing')

    const site = useEditorStore.getState().site
    const pricing = site?.pages.find((page) => page.id === 'pricing')
    const previousHome = site?.pages.find((page) => page.id === 'home')
    const pricingPlacement = site?.explorer.pages.items.find((item) => item.id === 'pricing')
    expect(pricing?.slug).toBe('index')
    expect(previousHome?.slug).toBe('home')
    expect(pricingPlacement?.parentFolderId).toBeUndefined()
  })

  it('ignores attempts to move the homepage into a folder', () => {
    loadExplorerSite()
    const folderId = useEditorStore.getState().createExplorerFolder('pages', 'Marketing')

    useEditorStore.getState().moveExplorerItem('pages', 'home', folderId, 0)

    const homePlacement = useEditorStore.getState().site?.explorer.pages.items.find((item) => item.id === 'home')
    expect(homePlacement?.parentFolderId).toBeUndefined()
    expect(homePlacement?.order).toBe(0)
  })
})

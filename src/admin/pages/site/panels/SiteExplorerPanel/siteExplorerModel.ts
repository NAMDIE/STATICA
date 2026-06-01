import type { IconComponent } from 'pixel-art-icons/types'
import type {
  SiteExplorerFolder,
  SiteExplorerItemPlacement,
  SiteExplorerSectionId,
} from '@core/page-tree'

export interface SiteExplorerTreeItem<TTarget> {
  id: string
  label: string
  meta?: string
  icon: IconComponent
  active: boolean
  pinned?: boolean
  ariaLabel: string
  target: TTarget
  canvasDrag?: {
    id: string
    componentId: string
    ariaLabel: string
  }
}

export interface SiteExplorerTreeFolder {
  id: string
  name: string
}

export interface SiteExplorerTreeSectionModel<TTarget> {
  sectionId: SiteExplorerSectionId
  folders: SiteExplorerTreeFolder[]
  pinnedItems: SiteExplorerTreeItem<TTarget>[]
  rootEntries: Array<
    | { kind: 'folder'; folder: SiteExplorerTreeFolder; items: SiteExplorerTreeItem<TTarget>[] }
    | { kind: 'item'; item: SiteExplorerTreeItem<TTarget> }
  >
  rootItems: SiteExplorerTreeItem<TTarget>[]
  folderItems: Array<{
    folder: SiteExplorerTreeFolder
    items: SiteExplorerTreeItem<TTarget>[]
  }>
}

export function buildSiteExplorerTreeSection<TTarget>(
  sectionId: SiteExplorerSectionId,
  folders: readonly SiteExplorerFolder[],
  placements: readonly SiteExplorerItemPlacement[],
  items: readonly SiteExplorerTreeItem<TTarget>[],
): SiteExplorerTreeSectionModel<TTarget> {
  const itemById = new Map(items.map((item) => [item.id, item]))
  const placementById = new Map(placements.map((placement) => [placement.id, placement]))
  const sortedFolders = [...folders]
    .sort((a, b) => a.order - b.order)
    .map((folder) => ({ id: folder.id, name: folder.name }))
  const folderIds = new Set(sortedFolders.map((folder) => folder.id))
  const pinnedItems = items.filter((item) => item.pinned)
  const pinnedIds = new Set(pinnedItems.map((item) => item.id))
  const orderedItems = placements
    .filter((placement) => itemById.has(placement.id) && !pinnedIds.has(placement.id))
    .sort((a, b) => a.order - b.order)
    .map((placement) => itemById.get(placement.id)!)

  for (const item of items) {
    if (pinnedIds.has(item.id)) continue
    if (!placementById.has(item.id)) orderedItems.push(item)
  }

  const rootItems: SiteExplorerTreeItem<TTarget>[] = []
  const byFolder = new Map<string, SiteExplorerTreeItem<TTarget>[]>()
  for (const folder of sortedFolders) byFolder.set(folder.id, [])

  for (const item of orderedItems) {
    const parentFolderId = placementById.get(item.id)?.parentFolderId
    if (parentFolderId && folderIds.has(parentFolderId)) {
      byFolder.get(parentFolderId)!.push(item)
    } else {
      rootItems.push(item)
    }
  }

  const rootEntries = [
    ...folders.map((folder) => ({
      kind: 'folder' as const,
      order: folder.order,
      folder: { id: folder.id, name: folder.name },
      items: byFolder.get(folder.id) ?? [],
    })),
    ...rootItems.map((item) => ({
      kind: 'item' as const,
      order: placementById.get(item.id)?.order ?? Number.MAX_SAFE_INTEGER,
      item,
    })),
  ]
    .sort((a, b) => a.order - b.order)
    .map((entry) => {
      if (entry.kind === 'folder') {
        return {
          kind: 'folder' as const,
          folder: entry.folder,
          items: entry.items,
        }
      }
      return {
        kind: 'item' as const,
        item: entry.item,
      }
    })

  return {
    sectionId,
    folders: sortedFolders,
    pinnedItems,
    rootEntries,
    rootItems,
    folderItems: sortedFolders.map((folder) => ({
      folder,
      items: byFolder.get(folder.id) ?? [],
    })),
  }
}

import { useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { DragOverlay } from '@dnd-kit/core'
import { useEditorStore } from '@site/store/store'
import type { SiteFile } from '@core/files/schemas'
import type { Page, SiteExplorerSectionId } from '@core/page-tree'
import { createUniquePageSlug, pagePublicPath, isHomePage } from '@core/page-tree'
import { Panel, useAutoFocusPanel } from '@admin/shared/Panel'
import { SkeletonBlock } from '@ui/components/Skeleton'
import { FilePlusSolidIcon } from 'pixel-art-icons/icons/file-plus-solid'
import { FileTextSolidIcon } from 'pixel-art-icons/icons/file-text-solid'
import { BracesIcon } from 'pixel-art-icons/icons/braces'
import { PaintBucketSolidIcon } from 'pixel-art-icons/icons/paint-bucket-solid'
import { CodeIcon } from 'pixel-art-icons/icons/code'
import { ExternalLinkSolidIcon } from 'pixel-art-icons/icons/external-link-solid'
import { GlobeSolidIcon } from 'pixel-art-icons/icons/globe-solid'
import {
  SiteCreateDialog,
  buildScriptPath,
  buildStylePath,
  slugifySiteItemName,
  type SiteCreatePayload,
  type SiteCreateKind,
} from '@admin/shared/dialogs/SiteCreateDialog'
import { ExplorerItemContextMenu } from '@site/explorer-actions'
import { TemplateSettingsDialog, type TemplateSettingsPayload } from '@admin/shared/dialogs/TemplateSettingsDialog'
import { useVCDeletionConfirm } from '@admin/shared/dialogs/VCDeletionConfirmDialog'
import { TreeIconSlot, TreeLabel, TreeRow } from '@site/ui/Tree'
import { buildSiteExplorerTreeSection, type SiteExplorerTreeFolder, type SiteExplorerTreeItem } from './siteExplorerModel'
import { SiteExplorerTreeSection, type SiteExplorerInlineRenameTarget } from './SiteExplorerTreeSection'
import { useSiteExplorerDnd, type SiteExplorerDragData, type SiteExplorerDropTarget } from './useSiteExplorerDnd'
import styles from './SiteExplorerPanel.module.css'

interface SiteExplorerPanelProps {
  variant?: 'docked'
  organizationDndEnabled?: boolean
}

type FileBucket = 'styles' | 'scripts'

type SiteExplorerContextTarget =
  | { kind: 'page'; id: string; title: string; slug: string }
  | { kind: 'component'; id: string; name: string }
  | { kind: 'file'; id: string; path: string }
  | { kind: 'folder'; sectionId: SiteExplorerSectionId; id: string; name: string }

interface ContextMenuState {
  x: number
  y: number
  target: SiteExplorerContextTarget
}

const EMPTY_FILES: SiteFile[] = []
const EMPTY_DND: SiteExplorerDndState = { active: null, target: null }

interface SiteExplorerDndState {
  active: SiteExplorerDragData | null
  target: SiteExplorerDropTarget | null
}

function fileName(path: string) {
  return path.split('/').pop() ?? path
}

function fileExtension(path: string) {
  const name = fileName(path)
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index) : ''
}

function pathFromRenameInput(currentPath: string, value: string) {
  const trimmed = value.trim()
  if (trimmed.includes('/')) return trimmed

  const slash = currentPath.lastIndexOf('/')
  const directory = slash >= 0 ? currentPath.slice(0, slash + 1) : ''
  const extension = fileExtension(currentPath)
  const nextName = extension && !trimmed.endsWith(extension) ? `${trimmed}${extension}` : trimmed
  return `${directory}${nextName}`
}

function keyboardMenuPosition(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  return {
    x: rect.left + Math.min(rect.width - 8, 24),
    y: rect.top + Math.min(rect.height - 8, 24),
  }
}

function renameValueForTarget(target: SiteExplorerContextTarget): string {
  if (target.kind === 'page') return target.title
  if (target.kind === 'component') return target.name
  if (target.kind === 'folder') return target.name
  return fileName(target.path)
}

function folderTarget(sectionId: SiteExplorerSectionId, folder: SiteExplorerTreeFolder): SiteExplorerContextTarget {
  return { kind: 'folder', sectionId, id: folder.id, name: folder.name }
}

function groupSiteFiles(files: SiteFile[]) {
  const visible = files.filter((file) => !file.generated || file.ejected)
  return {
    styles: visible.filter((file) => file.type === 'style'),
    scripts: visible.filter((file) => file.type === 'script'),
  } satisfies Record<FileBucket, SiteFile[]>
}

export function SiteExplorerPanel({
  variant = 'docked',
  organizationDndEnabled = false,
}: SiteExplorerPanelProps) {
  const isOpen = useEditorStore((s) => s.siteExplorerPanelOpen)
  const site = useEditorStore((s) => s.site)
  const activePageId = useEditorStore((s) => s.activePageId)
  const activeDocument = useEditorStore((s) => s.activeDocument)
  const activeEditorFileId = useEditorStore((s) => s.activeEditorFileId)
  const setSiteExplorerPanelOpen = useEditorStore((s) => s.setSiteExplorerPanelOpen)
  const openPageInCanvas = useEditorStore((s) => s.openPageInCanvas)
  const setActiveDocument = useEditorStore((s) => s.setActiveDocument)
  const addPage = useEditorStore((s) => s.addPage)
  const renamePage = useEditorStore((s) => s.renamePage)
  const deletePage = useEditorStore((s) => s.deletePage)
  const convertPageToTemplate = useEditorStore((s) => s.convertPageToTemplate)
  const convertTemplateToPage = useEditorStore((s) => s.convertTemplateToPage)
  const createVisualComponent = useEditorStore((s) => s.createVisualComponent)
  const renameVisualComponent = useEditorStore((s) => s.renameVisualComponent)
  const deleteVisualComponent = useEditorStore((s) => s.deleteVisualComponent)
  const createFile = useEditorStore((s) => s.createFile)
  const renameFile = useEditorStore((s) => s.renameFile)
  const deleteFile = useEditorStore((s) => s.deleteFile)
  const openInEditor = useEditorStore((s) => s.openInEditor)
  const createExplorerFolder = useEditorStore((s) => s.createExplorerFolder)
  const renameExplorerFolder = useEditorStore((s) => s.renameExplorerFolder)
  const deleteExplorerFolder = useEditorStore((s) => s.deleteExplorerFolder)
  const setPageAsHomepage = useEditorStore((s) => s.setPageAsHomepage)
  const confirmVCDeletion = useVCDeletionConfirm()
  const [createKind, setCreateKind] = useState<SiteCreateKind | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [inlineRenameTarget, setInlineRenameTarget] = useState<SiteExplorerContextTarget | null>(null)
  const [templateSettingsTarget, setTemplateSettingsTarget] = useState<Page | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  const files = site?.files ?? EMPTY_FILES
  const fileBuckets = groupSiteFiles(files)

  useAutoFocusPanel(panelRef, isOpen)

  if (!isOpen || variant !== 'docked') return null

  function handleCreate({ name, slug }: SiteCreatePayload) {
    if (!createKind) return

    try {
      if (createKind === 'page') {
        const page = addPage(name, slug ?? slugifySiteItemName(name))
        openPageInCanvas(page.id)
      } else if (createKind === 'component') {
        const vcId = createVisualComponent(name)
        setActiveDocument({ kind: 'visualComponent', vcId })
      } else if (createKind === 'style') {
        const fileId = createFile(buildStylePath(name), 'style', '')
        openInEditor(fileId)
      } else {
        const fileId = createFile(buildScriptPath(name), 'script', '')
        openInEditor(fileId)
      }
      setCreateKind(null)
    } catch (err) {
      console.error('[SiteExplorerPanel] create site item error:', err)
    }
  }

  const pages = site?.pages ?? []
  const normalPages = pages.filter((page) => !page.template)
  const templatePages = pages.filter((page) => page.template)
  const components = site?.visualComponents ?? []

  function pageForTarget(target: SiteExplorerContextTarget): Page | null {
    if (target.kind !== 'page') return null
    return pages.find((page) => page.id === target.id) ?? null
  }

  function openContextMenu(target: SiteExplorerContextTarget, event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ x: event.clientX, y: event.clientY, target })
  }

  function openKeyboardContextMenu(target: SiteExplorerContextTarget, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ ...keyboardMenuPosition(event.currentTarget), target })
  }

  function inlineRenameSectionTarget(sectionId: SiteExplorerSectionId): SiteExplorerInlineRenameTarget | null {
    if (!inlineRenameTarget) return null
    if (inlineRenameTarget.kind === 'folder') {
      if (inlineRenameTarget.sectionId !== sectionId) return null
      return {
        kind: 'folder',
        sectionId,
        id: inlineRenameTarget.id,
        value: inlineRenameTarget.name,
      }
    }
    if (inlineRenameTarget.kind === 'page') {
      const page = pageForTarget(inlineRenameTarget)
      const targetSectionId: SiteExplorerSectionId = page?.template ? 'templates' : 'pages'
      if (targetSectionId !== sectionId) return null
    } else if (inlineRenameTarget.kind === 'component') {
      if (sectionId !== 'components') return null
    } else {
      const file = files.find((candidate) => candidate.id === inlineRenameTarget.id)
      if (!file) return null
      const targetSectionId: SiteExplorerSectionId | null = file.type === 'style'
        ? 'styles'
        : file.type === 'script'
          ? 'scripts'
          : null
      if (targetSectionId !== sectionId) return null
    }

    return {
      kind: 'item',
      sectionId,
      id: inlineRenameTarget.id,
      value: renameValueForTarget(inlineRenameTarget),
    }
  }

  function startInlineRename(target: SiteExplorerContextTarget) {
    setInlineRenameTarget(target)
    setContextMenu(null)
  }

  function handleInlineRename(value: string) {
    if (!inlineRenameTarget) return

    try {
      if (inlineRenameTarget.kind === 'page') {
        renamePage(inlineRenameTarget.id, value)
      } else if (inlineRenameTarget.kind === 'component') {
        renameVisualComponent(inlineRenameTarget.id, value)
      } else if (inlineRenameTarget.kind === 'folder') {
        renameExplorerFolder(inlineRenameTarget.sectionId, inlineRenameTarget.id, value)
      } else {
        renameFile(inlineRenameTarget.id, pathFromRenameInput(inlineRenameTarget.path, value))
      }
      setInlineRenameTarget(null)
    } catch (err) {
      console.error('[SiteExplorerPanel] rename site item error:', err)
    }
  }

  function handleDelete(target: SiteExplorerContextTarget) {
    if (target.kind === 'page') {
      deletePage(target.id)
    } else if (target.kind === 'component') {
      confirmVCDeletion({
        vcId: target.id,
        commit: () => {
          deleteVisualComponent(target.id)
          if (activeDocument?.kind === 'visualComponent' && activeDocument.vcId === target.id) {
            setActiveDocument(null)
          }
        },
      })
    } else if (target.kind === 'folder') {
      deleteExplorerFolder(target.sectionId, target.id)
    } else {
      deleteFile(target.id)
    }
    setContextMenu(null)
  }

  function handleCreateTemplate() {
    const slug = createUniquePageSlug('Post Template', pages)
    const page = addPage('Post Template', slug)
    openPageInCanvas(page.id)
    setTemplateSettingsTarget(page)
  }

  function handleSaveTemplateSettings(payload: TemplateSettingsPayload) {
    if (!templateSettingsTarget) return
    renamePage(templateSettingsTarget.id, payload.title, payload.slug)
    convertPageToTemplate(templateSettingsTarget.id, payload.template)
    setTemplateSettingsTarget(null)
    openPageInCanvas(templateSettingsTarget.id)
  }

  function templateMenuItems(target: SiteExplorerContextTarget) {
    const page = pageForTarget(target)
    if (!page) return []

    if (page.template) {
      return [
        {
          label: 'Template settings',
          icon: <FileTextSolidIcon size={13} />,
          action: () => {
            setTemplateSettingsTarget(page)
            setContextMenu(null)
          },
        },
        {
          label: 'Convert to page',
          icon: <FileTextSolidIcon size={13} />,
          action: () => {
            convertTemplateToPage(page.id)
            setContextMenu(null)
          },
        },
      ]
    }

    return [{
      label: 'Use as template',
      icon: <FileTextSolidIcon size={13} />,
      action: () => {
        setTemplateSettingsTarget(page)
        setContextMenu(null)
      },
    }]
  }

  function pageMenuItems(target: SiteExplorerContextTarget) {
    const page = pageForTarget(target)
    if (!page) return []

    return [
      ...(!page.template && !isHomePage(page) ? [{
        label: 'Set as homepage',
        icon: <GlobeSolidIcon size={13} />,
        action: () => {
          setPageAsHomepage(page.id)
          setContextMenu(null)
        },
      }] : []),
      {
        label: 'Open in new tab',
        icon: <ExternalLinkSolidIcon size={13} />,
        action: () => {
          window.open(pagePublicPath(page.slug), '_blank', 'noopener,noreferrer')
          setContextMenu(null)
        },
      },
      ...templateMenuItems(target),
    ]
  }

  function handleCreateFolder(sectionId: SiteExplorerSectionId) {
    const folderId = createExplorerFolder(sectionId, 'New folder')
    setInlineRenameTarget({ kind: 'folder', sectionId, id: folderId, name: 'New folder' })
  }

  function openExplorerItem(item: SiteExplorerTreeItem<SiteExplorerContextTarget>) {
    const target = item.target
    if (target.kind === 'page') {
      openPageInCanvas(target.id)
    } else if (target.kind === 'component') {
      setActiveDocument({ kind: 'visualComponent', vcId: target.id })
    } else if (target.kind === 'file') {
      openInEditor(target.id)
    }
  }

  function contextMenuForItem(item: SiteExplorerTreeItem<SiteExplorerContextTarget>, event: MouseEvent<HTMLButtonElement>) {
    openContextMenu(item.target, event)
  }

  function renameExplorerItem(item: SiteExplorerTreeItem<SiteExplorerContextTarget>) {
    startInlineRename(item.target)
  }

  function keyboardContextMenuForItem(
    item: SiteExplorerTreeItem<SiteExplorerContextTarget>,
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    openKeyboardContextMenu(item.target, event)
  }

  function renameExplorerFolderTarget(sectionId: SiteExplorerSectionId, folder: SiteExplorerTreeFolder) {
    startInlineRename(folderTarget(sectionId, folder))
  }

  const pageTreeModel = site
    ? buildSiteExplorerTreeSection<SiteExplorerContextTarget>(
      'pages',
      site.explorer.pages.folders,
      site.explorer.pages.items,
      normalPages.map((page) => ({
        id: page.id,
        label: page.title,
        meta: pagePublicPath(page.slug),
        icon: FileTextSolidIcon,
        active: page.id === activePageId && activeDocument?.kind !== 'visualComponent',
        pinned: isHomePage(page),
        ariaLabel: `Open page ${page.title}`,
        target: { kind: 'page', id: page.id, title: page.title, slug: page.slug },
      })),
    )
    : null
  const templateTreeModel = site
    ? buildSiteExplorerTreeSection<SiteExplorerContextTarget>(
      'templates',
      site.explorer.templates.folders,
      site.explorer.templates.items,
      templatePages.map((page) => ({
        id: page.id,
        label: page.title,
        meta: page.template?.tableSlug ?? '',
        icon: FileTextSolidIcon,
        active: page.id === activePageId && activeDocument?.kind !== 'visualComponent',
        ariaLabel: `Open template ${page.title}`,
        target: { kind: 'page', id: page.id, title: page.title, slug: page.slug },
      })),
    )
    : null
  const componentTreeModel = site
    ? buildSiteExplorerTreeSection<SiteExplorerContextTarget>(
      'components',
      site.explorer.components.folders,
      site.explorer.components.items,
      components.map((component) => ({
        id: component.id,
        label: component.name,
        meta: `${component.params.length} props`,
        icon: BracesIcon,
        active: activeDocument?.kind === 'visualComponent' && activeDocument.vcId === component.id,
        ariaLabel: `Open component ${component.name}`,
        target: { kind: 'component', id: component.id, name: component.name },
        canvasDrag: {
          id: `site-explorer-vc-${component.id}`,
          componentId: component.id,
          ariaLabel: `Drag component ${component.name} to canvas`,
        },
      })),
    )
    : null
  const styleTreeModel = site
    ? buildSiteExplorerTreeSection<SiteExplorerContextTarget>(
      'styles',
      site.explorer.styles.folders,
      site.explorer.styles.items,
      fileBuckets.styles.map((file) => ({
        id: file.id,
        label: fileName(file.path),
        meta: file.path,
        icon: PaintBucketSolidIcon,
        active: activeEditorFileId === file.id,
        ariaLabel: `Open ${fileName(file.path)}`,
        target: { kind: 'file', id: file.id, path: file.path },
      })),
    )
    : null
  const scriptTreeModel = site
    ? buildSiteExplorerTreeSection<SiteExplorerContextTarget>(
      'scripts',
      site.explorer.scripts.folders,
      site.explorer.scripts.items,
      fileBuckets.scripts.map((file) => ({
        id: file.id,
        label: fileName(file.path),
        meta: file.path,
        icon: CodeIcon,
        active: activeEditorFileId === file.id,
        ariaLabel: `Open ${fileName(file.path)}`,
        target: { kind: 'file', id: file.id, path: file.path },
      })),
    )
    : null

  function renderPanel(explorerDnd: SiteExplorerDndState) {
    return (
      <>
      <Panel
        ref={panelRef}
        panelId="site-explorer"
        title="Site"
        ariaLabel="Site Explorer"
        testId="site-explorer-panel"
        onClose={() => setSiteExplorerPanelOpen(false)}
      >
        {!site ? (
            <SkeletonBlock minHeight={160} ariaLabel="Loading site" />
          ) : (
            <>
              {pageTreeModel && (
                <SiteExplorerTreeSection
                title="Pages"
                count={normalPages.length}
                actionLabel="New page"
                actionIcon={FilePlusSolidIcon}
                onAction={() => setCreateKind('page')}
                model={pageTreeModel}
                dropTarget={explorerDnd.target}
                inlineRenameTarget={inlineRenameSectionTarget('pages')}
                onCreateFolder={() => handleCreateFolder('pages')}
                onRenameItem={renameExplorerItem}
                onRenameFolder={(folder) => renameExplorerFolderTarget('pages', folder)}
                onCommitInlineRename={handleInlineRename}
                onCancelInlineRename={() => setInlineRenameTarget(null)}
                onOpenItem={openExplorerItem}
                onContextMenuItem={contextMenuForItem}
                onKeyDownItem={keyboardContextMenuForItem}
                onContextMenuFolder={(folder, event) => openContextMenu(folderTarget('pages', folder), event)}
                onKeyDownFolder={(folder, event) => openKeyboardContextMenu(folderTarget('pages', folder), event)}
              />
              )}

              {templateTreeModel && (
                <SiteExplorerTreeSection
                title="Templates"
                count={templatePages.length}
                actionLabel="New template"
                actionIcon={FilePlusSolidIcon}
                onAction={handleCreateTemplate}
                model={templateTreeModel}
                dropTarget={explorerDnd.target}
                inlineRenameTarget={inlineRenameSectionTarget('templates')}
                onCreateFolder={() => handleCreateFolder('templates')}
                onRenameItem={renameExplorerItem}
                onRenameFolder={(folder) => renameExplorerFolderTarget('templates', folder)}
                onCommitInlineRename={handleInlineRename}
                onCancelInlineRename={() => setInlineRenameTarget(null)}
                onOpenItem={openExplorerItem}
                onContextMenuItem={contextMenuForItem}
                onKeyDownItem={keyboardContextMenuForItem}
                onContextMenuFolder={(folder, event) => openContextMenu(folderTarget('templates', folder), event)}
                onKeyDownFolder={(folder, event) => openKeyboardContextMenu(folderTarget('templates', folder), event)}
              />
              )}

              {componentTreeModel && (
                <SiteExplorerTreeSection
                title="Components"
                count={components.length}
                actionLabel="New component"
                actionIcon={BracesIcon}
                onAction={() => setCreateKind('component')}
                model={componentTreeModel}
                dropTarget={explorerDnd.target}
                inlineRenameTarget={inlineRenameSectionTarget('components')}
                onCreateFolder={() => handleCreateFolder('components')}
                onRenameItem={renameExplorerItem}
                onRenameFolder={(folder) => renameExplorerFolderTarget('components', folder)}
                onCommitInlineRename={handleInlineRename}
                onCancelInlineRename={() => setInlineRenameTarget(null)}
                onOpenItem={openExplorerItem}
                onContextMenuItem={contextMenuForItem}
                onKeyDownItem={keyboardContextMenuForItem}
                onContextMenuFolder={(folder, event) => openContextMenu(folderTarget('components', folder), event)}
                onKeyDownFolder={(folder, event) => openKeyboardContextMenu(folderTarget('components', folder), event)}
              />
              )}

              {styleTreeModel && (
                <SiteExplorerTreeSection
                title="Styles"
                count={fileBuckets.styles.length}
                actionLabel="New stylesheet"
                actionIcon={PaintBucketSolidIcon}
                onAction={() => setCreateKind('style')}
                model={styleTreeModel}
                dropTarget={explorerDnd.target}
                inlineRenameTarget={inlineRenameSectionTarget('styles')}
                onCreateFolder={() => handleCreateFolder('styles')}
                onRenameItem={renameExplorerItem}
                onRenameFolder={(folder) => renameExplorerFolderTarget('styles', folder)}
                onCommitInlineRename={handleInlineRename}
                onCancelInlineRename={() => setInlineRenameTarget(null)}
                onOpenItem={openExplorerItem}
                onContextMenuItem={contextMenuForItem}
                onKeyDownItem={keyboardContextMenuForItem}
                onContextMenuFolder={(folder, event) => openContextMenu(folderTarget('styles', folder), event)}
                onKeyDownFolder={(folder, event) => openKeyboardContextMenu(folderTarget('styles', folder), event)}
              />
              )}

              {scriptTreeModel && (
                <SiteExplorerTreeSection
                title="Scripts"
                count={fileBuckets.scripts.length}
                actionLabel="New script"
                actionIcon={CodeIcon}
                onAction={() => setCreateKind('script')}
                model={scriptTreeModel}
                dropTarget={explorerDnd.target}
                inlineRenameTarget={inlineRenameSectionTarget('scripts')}
                onCreateFolder={() => handleCreateFolder('scripts')}
                onRenameItem={renameExplorerItem}
                onRenameFolder={(folder) => renameExplorerFolderTarget('scripts', folder)}
                onCommitInlineRename={handleInlineRename}
                onCancelInlineRename={() => setInlineRenameTarget(null)}
                onOpenItem={openExplorerItem}
                onContextMenuItem={contextMenuForItem}
                onKeyDownItem={keyboardContextMenuForItem}
                onContextMenuFolder={(folder, event) => openContextMenu(folderTarget('scripts', folder), event)}
                onKeyDownFolder={(folder, event) => openKeyboardContextMenu(folderTarget('scripts', folder), event)}
              />
              )}
            </>
          )}
      </Panel>

      {createKind && (
        <SiteCreateDialog
          kind={createKind}
          pages={pages}
          onCancel={() => setCreateKind(null)}
          onCreate={handleCreate}
        />
      )}

      {contextMenu && (
        <ExplorerItemContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          ariaLabel="Site item options"
          deleteDisabled={contextMenu.target.kind === 'page' && pages.length <= 1}
          extraItems={pageMenuItems(contextMenu.target)}
          onClose={() => setContextMenu(null)}
          onRename={() => startInlineRename(contextMenu.target)}
          onDelete={() => handleDelete(contextMenu.target)}
        />
      )}

      {templateSettingsTarget && (
        <TemplateSettingsDialog
          page={templateSettingsTarget}
          pages={pages}
          onCancel={() => setTemplateSettingsTarget(null)}
          onSave={handleSaveTemplateSettings}
        />
      )}

      </>
    )
  }

  return (
    <SiteExplorerDndScope enabled={organizationDndEnabled}>
      {renderPanel}
    </SiteExplorerDndScope>
  )
}

interface SiteExplorerDndScopeProps {
  enabled: boolean
  children: (dnd: SiteExplorerDndState) => ReactNode
}

function SiteExplorerDndScope({ enabled, children }: SiteExplorerDndScopeProps) {
  if (!enabled) return <>{children(EMPTY_DND)}</>
  return <SiteExplorerDndEnabled>{children}</SiteExplorerDndEnabled>
}

function SiteExplorerDndEnabled({ children }: Pick<SiteExplorerDndScopeProps, 'children'>) {
  const explorerDnd = useSiteExplorerDnd({ enabled: true })

  return (
    <>
      {children(explorerDnd)}
      <SiteExplorerDragOverlay active={explorerDnd.active} />
    </>
  )
}

function SiteExplorerDragOverlay({ active }: { active: SiteExplorerDragData | null }) {
  const ActiveIcon = active?.icon

  return (
    <DragOverlay dropAnimation={null}>
      {active ? (
        <TreeRow depth={0} className={styles.dragOverlayRow}>
          {ActiveIcon && (
            <TreeIconSlot
              icon={ActiveIcon}
              iconSize={12}
              iconColor="var(--editor-text-subtle)"
            />
          )}
          <TreeLabel>{active.label}</TreeLabel>
        </TreeRow>
      ) : null}
    </DragOverlay>
  )
}

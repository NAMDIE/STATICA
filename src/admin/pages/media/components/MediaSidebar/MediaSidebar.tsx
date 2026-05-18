/**
 * MediaSidebar — left rail + panel slot for the Media workspace.
 *
 * Mirrors the structure of `ContentSidebar`: a panel rail with one toggle
 * for the Folders panel and a panel slot that mounts the panel body.
 *
 * The Folders panel itself owns the entire folder navigation: the regular
 * folder tree, the built-in smart folders (Recent uploads, Missing alt
 * text), and the Trash sentinel — all as rows in one tree. There are no
 * separate Smart / Trash panels.
 *
 * Reuses the editor's PanelRail / LeftSidebar CSS so the visual language is
 * identical across Site / Content / Media.
 */
import { useRef, type CSSProperties } from 'react'
import { Button } from '@ui/components/Button'
import { FolderGlyphIcon } from 'pixel-art-icons/icons/folder-glyph'
import { useEditorStore } from '@site/store/store'
import { SidebarResizeHandle } from '@admin/shared/SidebarResizeHandle'
import { Panel } from '@admin/shared/Panel'
import leftSidebarStyles from '@site/sidebars/LeftSidebar/LeftSidebar.module.css'
import panelRailStyles from '@site/sidebars/PanelRail/PanelRail.module.css'
import { MediaFolderPanel } from '../MediaFolderPanel/MediaFolderPanel'
import type { UseMediaWorkspaceResult } from '../../hooks/useMediaWorkspace'

export type MediaSidebarPanelId = 'folders'

interface MediaSidebarProps {
  workspace: UseMediaWorkspaceResult
  activePanel: MediaSidebarPanelId | null
  onActivePanelChange: (panel: MediaSidebarPanelId | null) => void
}

const RAIL_ITEMS: Array<{
  id: MediaSidebarPanelId
  label: string
  icon: typeof FolderGlyphIcon
  iconName: string
  accent: 'mint' | 'lilac' | 'sky' | 'peach'
}> = [
  { id: 'folders', label: 'Folders', icon: FolderGlyphIcon, iconName: 'folder', accent: 'sky' },
]

const PANEL_TITLES: Record<MediaSidebarPanelId, string> = {
  folders: 'Folders',
}

export function MediaSidebar({ workspace, activePanel, onActivePanelChange }: MediaSidebarProps) {
  const sidebarRef = useRef<HTMLElement | null>(null)
  const leftSidebarWidth = useEditorStore((s) => s.leftSidebarWidth)
  const setLeftSidebarWidth = useEditorStore((s) => s.setLeftSidebarWidth)
  const panelWidth = activePanel ? leftSidebarWidth : 0
  const style = {
    '--left-sidebar-panel-width': `${panelWidth}px`,
  } as CSSProperties

  function handleRailToggle(panelId: MediaSidebarPanelId) {
    const next = activePanel === panelId ? null : panelId
    onActivePanelChange(next)
  }

  return (
    <aside
      ref={sidebarRef}
      className={leftSidebarStyles.sidebar}
      data-testid="media-left-sidebar"
      data-expanded={activePanel ? 'true' : 'false'}
      data-active-panel={activePanel ?? 'none'}
      style={style}
    >
      <nav
        aria-label="Media panel dock"
        className={panelRailStyles.rail}
        data-testid="media-panel-rail"
      >
        <div className={panelRailStyles.itemGroup}>
          {RAIL_ITEMS.map((item) => {
            const Icon = item.icon
            const active = activePanel === item.id
            const action = active ? 'Close' : 'Open'
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="md"
                iconOnly
                pressed={active}
                aria-label={`${action} ${item.label} panel`}
                tooltip={`${item.label} panel`}
                data-testid={`media-panel-rail-${item.id}`}
                data-icon={item.iconName}
                data-accent={item.accent}
                onClick={() => handleRailToggle(item.id)}
                className={panelRailStyles.railButton}
              >
                <span className={panelRailStyles.activeIndicator} aria-hidden="true" />
                <Icon size={16} className={panelRailStyles.railIcon} />
              </Button>
            )
          })}
        </div>
      </nav>

      <div
        className={leftSidebarStyles.panelSlot}
        data-testid="media-left-sidebar-panel-slot"
        aria-hidden={activePanel ? undefined : 'true'}
      >
        <div className={leftSidebarStyles.panelMount}>
          {activePanel && (
            <Panel
              panelId={`media-${activePanel}`}
              title={PANEL_TITLES[activePanel]}
              ariaLabel={`${PANEL_TITLES[activePanel]} panel`}
              testId={`media-${activePanel}-panel`}
              onClose={() => onActivePanelChange(null)}
              body="bare"
            >
              <MediaFolderPanel workspace={workspace} />
            </Panel>
          )}
        </div>
      </div>

      {activePanel && (
        <SidebarResizeHandle
          side="left"
          width={leftSidebarWidth}
          targetRef={sidebarRef}
          cssVariable="--left-sidebar-panel-width"
          ariaLabel="Resize media sidebar"
          onResize={setLeftSidebarWidth}
        />
      )}
    </aside>
  )
}

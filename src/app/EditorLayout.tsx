/**
 * EditorLayout — root layout for the self-hosted CMS editor.
 *
 * Editor Overlay Layout (Guideline #410 — motion-editor style):
 *   ┌─────────────────────────────── Toolbar ──────────────────────────────────┐  z-60
 *   │ [SiteName] [Undo/Redo] [+ Add] ─────── [Zoom] [Save] [Publish] [⚙] [✦] │
 *   ├──────────────────────────── Canvas (full-bleed) ─────────────────────────┤
 *   │  [DOM Tree Panel ▓]     canvas          [Properties Panel ▓]            │
 *   │  position: absolute overlays (z-50)     [AI Panel ▓] (bottom-right)     │
 *   └──────────────────────────────────────────────────────────────────────────┘
 *
 * Five independent self-contained floating panels (Guideline #410):
 * - DomPanel (Layers) — top-left
 * - PropertiesPanel — top-right
 * - AgentPanel (AI) — bottom-right, independent visibility
 * - Site explorer panel — site concepts: pages, components, styles, scripts
 * - CodeEditorPanel (Task #432) — center-stage, code editing
 *
 * J12: usePersistence handles CMS draft load on mount, preference-gated
 * 30s auto-save, toolbar Save, and Cmd+S immediate save.
 *
 * Agent Panel: Phase D AI assistant — self-contained floating panel (Guideline #410).
 * Authenticates via ambient Claude Code credentials through the local Bun server.
 * No env vars, no API keys, no endpoint configuration required (Constraint #385).
 */
import { CanvasRoot } from '@editor/components/Canvas'
import { PropertiesPanel } from '@editor/components/PropertiesPanel'
import { CodeEditorPanel } from '@editor/components/CodeEditor'
import { Toolbar } from '@editor/components/Toolbar'
import { LeftSidebar } from '@editor/components/LeftSidebar'
import { RightSidebar } from '@editor/components/RightSidebar'
import { SettingsModal } from '@editor/components/Settings'
import { usePersistence } from '@editor/hooks/usePersistence'
import { useEditorLayoutPersistence } from '@editor/hooks/useEditorLayoutPersistence'
import { selectRightSidebarExpanded, useEditorStore } from '@core/editor-store/store'
import { cmsAdapter } from '@core/persistence'
import { cn } from '@ui/cn'
import { AppLoadingScreen } from './AppLoadingScreen'
import styles from './EditorLayout.module.css'
import type { ReactNode } from 'react'

interface EditorLayoutProps {
  workspace?: 'site' | 'content'
  contentLeftPanel?: ReactNode
  contentCanvas?: ReactNode
  contentRightPanel?: ReactNode
  toolbarRightSlot?: ReactNode
}

export default function EditorLayout({
  workspace = 'site',
  contentLeftPanel,
  contentCanvas,
  contentRightPanel,
  toolbarRightSlot,
}: EditorLayoutProps) {
  const site = useEditorStore((s) => s.site)
  const propertiesPanelMode = useEditorStore((s) => s.propertiesPanelMode)
  const rightSidebarExpanded = useEditorStore(selectRightSidebarExpanded)
  const contentRightSidebarExpanded = workspace === 'content' && Boolean(contentRightPanel)
  const hasRightSidebar = contentRightSidebarExpanded || rightSidebarExpanded

  // J12 — wire persistence: load, auto-save, toolbar Save, Cmd+S.
  const persistence = usePersistence('default', cmsAdapter, { markNewSiteUnsaved: true })
  useEditorLayoutPersistence()

  if (!site) {
    if (persistence.saveStatus.state === 'error') {
      return (
        <main className={styles.bootstrapError} role="alert">
          <h1>Could not load CMS site</h1>
          <p>{persistence.saveStatus.message ?? 'Reload the admin page and try again.'}</p>
        </main>
      )
    }

    return <AppLoadingScreen />
  }

  return (
    <div className={styles.shell}>
      {/* ── Top toolbar (z-60, Guideline #374) ───────────────────────────── */}
      <Toolbar
        onSave={persistence.saveSite}
        saveStatus={persistence.saveStatus}
        publishEnabled={workspace === 'site'}
        section={workspace}
        rightSlot={toolbarRightSlot}
      />

      {/* ── Canvas + floating overlay panels ──────────────────────────────── */}
      {/*
        position: relative makes this the containing block for absolutely
        positioned panels (Guideline #356 / Task #358 / Architect #504).
        flex is kept so CanvasRoot's flex:1 fills the full width.
      */}
      <div className={styles.editorBody}>
        <LeftSidebar workspace={workspace} contentPanel={contentLeftPanel} />
        <div
          className={cn(styles.canvasStage, hasRightSidebar && styles.canvasStageRightSidebarOpen)}
          data-right-sidebar-expanded={hasRightSidebar ? 'true' : 'false'}
        >
          {workspace === 'content' ? (
            contentCanvas
          ) : (
            <>
              {/* Canvas — fills the remaining space between sidebars */}
              <CanvasRoot />
              {/* Properties can be unpinned into the floating draggable overlay. */}
              {propertiesPanelMode === 'floating' && <PropertiesPanel variant="floating" />}
            </>
          )}
        </div>
        <RightSidebar contentPanel={workspace === 'content' ? contentRightPanel : undefined} />
      </div>

      {/* Code editor/media preview: viewport overlay, not constrained by the canvas stage. */}
      <CodeEditorPanel />

      {/* J10 — Settings Modal (portal-rendered, listens to store.settingsModalOpen) */}
      <SettingsModal />
    </div>
  )
}

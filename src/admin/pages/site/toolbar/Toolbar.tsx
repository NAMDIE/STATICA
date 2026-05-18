/**
 * Toolbar — fixed top bar for the editor.
 *
 * Layout (left → right):
 *   [Site name] [admin nav]
 *   [Plugin buttons] [spacer→] [ZoomControls] [Publish actions] [Settings]
 *
 * Undo/Redo lives inside the canvas notch (CanvasNotch), not the toolbar —
 * those controls only operate on the visual editor's page tree, so they have
 * no meaning on admin pages outside the canvas (Content, Plugins, …).
 *
 * Accessibility (WCAG 2.1 AA):
 * - role="banner" for the top-level landmark
 * - aria-label on the nav region
 * - All interactive children have 44×44px minimum touch targets
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArticleSolidIcon } from 'pixel-art-icons/icons/article-solid'
import { DatabaseSolidIcon } from 'pixel-art-icons/icons/database-solid'
import { ImagesSolidIcon } from 'pixel-art-icons/icons/images-solid'
import { LayoutSolidIcon } from 'pixel-art-icons/icons/layout-solid'
import { PackageSolidIcon } from 'pixel-art-icons/icons/package-solid'
import { useEditorStore } from '@site/store/store'
import { pluginRuntime } from '@core/plugins/runtime'
import type { RegisteredPluginToolbarButton } from '@core/plugin-sdk'
import { ZoomControls } from './ZoomControls'
import { PublishButton } from './PublishButton'
import { SettingsButton } from './SettingsButton'
import { AccountMenuButton } from '@admin/shared/AccountMenuButton'
import { PreviewOverlay } from '@site/preview/PreviewOverlay'
import VCBreadcrumb from './VCBreadcrumb'
import { Button } from '@ui/components/Button'
import { cn } from '@ui/cn'
import type { PersistenceSaveStatus } from '@site/hooks/usePersistence'
import type { AdminWorkspace } from '@admin/workspace'
import styles from './Toolbar.module.css'

const NAV_ICON_SIZE = 13

interface ToolbarProps {
  onSave?: () => void | Promise<void>
  saveStatus?: PersistenceSaveStatus
  publishEnabled?: boolean
  section?: AdminWorkspace
  adminNavigationSlot?: ReactNode
  rightSlot?: ReactNode
}

type PluginButtonStatus = {
  state: 'running' | 'success' | 'error'
  message: string
}

export function Toolbar({
  onSave,
  saveStatus,
  publishEnabled = true,
  section = 'site',
  adminNavigationSlot,
  rightSlot,
}: ToolbarProps) {
  const siteName = useEditorStore((s) => s.site?.name ?? 'Untitled Site')
  const faviconUrl = useEditorStore((s) => s.site?.settings.faviconUrl ?? null)
  const [pluginButtons, setPluginButtons] = useState<RegisteredPluginToolbarButton[]>(() =>
    pluginRuntime.getToolbarButtons(),
  )
  const [pluginStatuses, setPluginStatuses] = useState<Record<string, PluginButtonStatus>>({})
  const pluginStatusTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    return pluginRuntime.subscribe(() => {
      setPluginButtons(pluginRuntime.getToolbarButtons())
    })
  }, [])

  useEffect(() => {
    const timers = pluginStatusTimers.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  function pluginButtonKey(button: RegisteredPluginToolbarButton): string {
    return `${button.pluginId}:${button.id}`
  }

  function setPluginStatus(key: string, status: PluginButtonStatus): void {
    const currentTimer = pluginStatusTimers.current.get(key)
    if (currentTimer) {
      clearTimeout(currentTimer)
      pluginStatusTimers.current.delete(key)
    }

    setPluginStatuses((current) => ({ ...current, [key]: status }))

    if (status.state !== 'running') {
      const timer = setTimeout(() => {
        setPluginStatuses((current) => {
          const next = { ...current }
          delete next[key]
          return next
        })
        pluginStatusTimers.current.delete(key)
      }, 4000)
      pluginStatusTimers.current.set(key, timer)
    }
  }

  async function runPluginButtonCommand(button: RegisteredPluginToolbarButton): Promise<void> {
    const key = pluginButtonKey(button)
    setPluginStatus(key, {
      state: 'running',
      message: `${button.label} running`,
    })

    try {
      const result = await pluginRuntime.runCommand(button.command)
      setPluginStatus(key, {
        state: 'success',
        message: result && typeof result === 'object' && result.message
          ? result.message
          : `${button.label} complete`,
      })
    } catch (err) {
      console.error('[plugin-runtime] command failed:', err)
      setPluginStatus(key, {
        state: 'error',
        message: err instanceof Error ? err.message : `${button.label} failed`,
      })
    }
  }

  return (
    <>
      {/* Preview overlay rendered outside the toolbar so it can cover the whole screen */}
      <PreviewOverlay />
      <header
        role="banner"
        aria-label="Editor toolbar"
        data-testid="toolbar"
        className={styles.header}
      >
        {/* ── Left section ────────────────────────────────────────────────── */}

        {/* Site brand — favicon when configured (icon replaces text per
            operator preference); falls back to the site name text for fresh
            installs that haven't picked a logo yet. The image is rendered
            here purely as a visual brand mark: SafeURL'd assets land at
            `/uploads/...` from the picker, so we don't need extra escaping. */}
        {faviconUrl ? (
          <img
            className={styles.siteFavicon}
            src={faviconUrl}
            alt=""
            title={siteName}
            aria-label={`Site: ${siteName}`}
            draggable={false}
          />
        ) : (
          <span
            className={styles.siteName}
            title={siteName}
            aria-label={`Site: ${siteName}`}
          >
            {siteName}
          </span>
        )}
        {adminNavigationSlot ?? <DefaultAdminNavigation section={section} />}

        {/* ── VC breadcrumb — visible only in Visual Component edit mode ── */}
        <div className={styles.breadcrumbRegion}>
          <VCBreadcrumb />
        </div>

        <div className={styles.workspaceToolbarItems}>
          {pluginButtons.map((button) => {
            const key = pluginButtonKey(button)
            const status = pluginStatuses[key]
            const statusId = `plugin-command-status-${button.pluginId}-${button.id}`
            return (
              <div key={key} className={styles.pluginButtonWrapper}>
                <Button
                  variant="secondary"
                  size="sm"
                  className={styles.pluginButton}
                  aria-describedby={status ? statusId : undefined}
                  data-state={status?.state}
                  disabled={status?.state === 'running'}
                  onClick={() => {
                    void runPluginButtonCommand(button)
                  }}
                >
                  <span>{status?.state === 'running' ? `${button.label}...` : button.label}</span>
                </Button>
                {status && (
                  <span
                    id={statusId}
                    role="status"
                    aria-live="polite"
                    className={cn(
                      styles.pluginToast,
                      status.state === 'error' && styles.pluginToastError,
                    )}
                  >
                    {status.message}
                  </span>
                )}
              </div>
            )
          })}

          {/* ── Spacer ──────────────────────────────────────────────────────── */}
          <div className={styles.spacer} aria-hidden="true" />

          {/* ── Right section ───────────────────────────────────────────────── */}
          {rightSlot ?? (
            <>
              <ZoomControls />
              <Divider />
              <PublishButton enabled={publishEnabled} onSave={onSave} saveStatus={saveStatus} />
              <SettingsButton />
            </>
          )}
          {/* AccountMenuButton always rendered, regardless of `rightSlot`
              override. Users may need to switch accounts / sign out from
              every admin page (Users, Content, Plugins, etc.). */}
          <AccountMenuButton />
        </div>
      </header>
    </>
  )
}

function DefaultAdminNavigation({ section }: { section: AdminWorkspace }) {
  return (
    <>
      <DefaultNavSlot
        href="/admin/site"
        icon={<LayoutSolidIcon size={NAV_ICON_SIZE} aria-hidden="true" />}
        label="Site"
        active={section === 'site'}
      />
      <DefaultNavSlot
        href="/admin/content"
        icon={<ArticleSolidIcon size={NAV_ICON_SIZE} aria-hidden="true" />}
        label="Content"
        active={section === 'content'}
      />
      <DefaultNavSlot
        href="/admin/data"
        icon={<DatabaseSolidIcon size={NAV_ICON_SIZE} aria-hidden="true" />}
        label="Data"
        active={section === 'data'}
      />
      <DefaultNavSlot
        href="/admin/media"
        icon={<ImagesSolidIcon size={NAV_ICON_SIZE} aria-hidden="true" />}
        label="Media"
        active={section === 'media'}
      />
      <DefaultNavSlot
        href="/admin/plugins"
        icon={<PackageSolidIcon size={NAV_ICON_SIZE} aria-hidden="true" />}
        label="Plugins"
        active={section === 'plugins'}
      />
    </>
  )
}

function DefaultNavSlot({
  href,
  icon,
  label,
  active,
}: {
  href: string
  icon: ReactNode
  label: string
  active: boolean
}) {
  if (active) {
    return (
      <span className={styles.activeSection}>
        {icon}
        <span>{label}</span>
      </span>
    )
  }
  return (
    <a className={styles.adminLink} href={href}>
      {icon}
      <span>{label}</span>
    </a>
  )
}

function Divider() {
  return (
    <div
      aria-hidden="true"
      className={styles.divider}
    />
  )
}

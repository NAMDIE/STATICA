/**
 * Plugins widget — list of installed plugins with their status dot
 * (active / disabled / error). Reads from `useDashboardStats().plugins`
 * (one shared fetch with the other widgets), so the dashboard makes a
 * single network round-trip on mount even with multiple widgets active.
 */
import { PlugSolidIcon } from 'pixel-art-icons/icons/plug-solid'
import type { DashboardWidgetRendererProps } from '@core/dashboard'
import { Widget } from '@ui/components/Widget'
import { useDashboardStats, type DashboardPluginRow } from '../hooks/useDashboardStats'
import styles from './widgets.module.css'

function dotClass(state: DashboardPluginRow['state']): string {
  if (state === 'active') return styles.dotGreen
  if (state === 'error') return styles.dotAmber
  return styles.dotMuted
}

function stateLabel(state: DashboardPluginRow['state']): string {
  if (state === 'active') return 'active'
  if (state === 'error') return 'error'
  return 'off'
}

export function PluginsWidget({ span, editing }: DashboardWidgetRendererProps) {
  const stats = useDashboardStats()
  const plugins = stats?.plugins.rows ?? []
  const isLoading = stats === null
  const isEmpty = !isLoading && plugins.length === 0

  return (
    <Widget
      widgetId="plugins"
      title="Plugins"
      icon={PlugSolidIcon}
      tint="mint"
      span={span}
      editing={editing}
    >
      <div>
        {isLoading && (
          <p className={styles.feedTime} style={{ padding: '12px 0' }}>Loading…</p>
        )}
        {isEmpty && (
          <p className={styles.feedTime} style={{ padding: '12px 0' }}>
            No plugins installed yet.
          </p>
        )}
        {plugins.map((p) => (
          <div key={p.id} className={styles.pluginRow}>
            <span className={styles.pluginIcon}>
              <PlugSolidIcon size={12} aria-hidden="true" />
            </span>
            <span className={styles.pluginName}>
              {p.name}
              <small>v{p.version}</small>
            </span>
            <span className={styles.wlistMeta}>
              <span className={`${styles.dot} ${dotClass(p.state)}`} />
              {stateLabel(p.state)}
            </span>
          </div>
        ))}
      </div>
    </Widget>
  )
}

/**
 * Pages widget — total published / drafts / scheduled counts pulled
 * from `useDashboardStats()`. The "+N this week" delta reads
 * `pages.deltaPublishedThisWeek` from the server-side count of pages
 * whose `published_at` is within the trailing 7 days.
 */
import { FileTextSolidIcon } from 'pixel-art-icons/icons/file-text-solid'
import { StatValue, Delta } from '@ui/components/charts'
import type { DashboardWidgetRendererProps } from '@core/dashboard'
import { Widget } from '@ui/components/Widget'
import { useDashboardStats } from '../hooks/useDashboardStats'
import styles from './widgets.module.css'

export function PagesWidget({ span, editing }: DashboardWidgetRendererProps) {
  const stats = useDashboardStats()
  // Show em-dashes while loading rather than 0 / 0 — distinguishes a
  // fetch-in-flight from a genuinely empty state.
  const published = stats?.pages.published
  const drafts = stats?.pages.drafts
  const scheduled = stats?.pages.scheduled
  const delta = stats?.pages.deltaPublishedThisWeek

  return (
    <Widget
      widgetId="pages"
      title="Pages"
      icon={FileTextSolidIcon}
      tint="lilac"
      span={span}
      editing={editing}
    >
      <StatValue
        value={published === undefined ? '—' : published.toLocaleString()}
        sub={(
          <>
            <span>Published</span>
            {delta !== undefined && delta > 0 && (
              <Delta>+{delta} this week</Delta>
            )}
          </>
        )}
      />
      <div className={styles.subFootRow}>
        <span>{drafts === undefined ? '— drafts' : `${drafts} draft${drafts === 1 ? '' : 's'}`}</span>
        <span>{scheduled === undefined ? '— scheduled' : `${scheduled} scheduled`}</span>
      </div>
    </Widget>
  )
}

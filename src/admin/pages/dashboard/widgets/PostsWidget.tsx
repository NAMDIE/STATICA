/**
 * Posts widget — total post count + daily-publish histogram for the
 * last 28 days. Data comes from `useDashboardStats().posts.daily28`
 * (server-side aggregated from `data_rows.published_at` across every
 * `kind: 'postType'` table).
 */
import { PenSquareSolidIcon } from 'pixel-art-icons/icons/pen-square-solid'
import { Bars, StatValue } from '@ui/components/charts'
import type { DashboardWidgetRendererProps } from '@core/dashboard'
import { Widget } from '@ui/components/Widget'
import { useDashboardStats } from '../hooks/useDashboardStats'

// Last 6 days of the histogram are highlighted as the "current week".
const ACCENT_INDEXES = [22, 23, 24, 25, 26, 27]
// Empty fallback histogram so the chart still renders skeleton bars
// while data is loading.
const EMPTY_DAILY = Array.from({ length: 28 }, () => 0)

export function PostsWidget({ span, editing }: DashboardWidgetRendererProps) {
  const stats = useDashboardStats()
  const total = stats?.posts.total
  const categories = stats?.posts.categories
  const daily = stats?.posts.daily28 ?? EMPTY_DAILY

  const sub = (() => {
    if (total === undefined || categories === undefined) return <span>Loading…</span>
    if (categories === 0) return <span>Total · no categories yet</span>
    return <span>Total · {categories} categor{categories === 1 ? 'y' : 'ies'}</span>
  })()

  return (
    <Widget
      widgetId="posts"
      title="Posts"
      icon={PenSquareSolidIcon}
      tint="peach"
      span={span}
      editing={editing}
    >
      <StatValue value={total === undefined ? '—' : total.toLocaleString()} sub={sub} />
      <Bars data={daily} accentIndexes={ACCENT_INDEXES} />
    </Widget>
  )
}

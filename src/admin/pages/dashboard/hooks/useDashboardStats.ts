/**
 * useDashboardStats — fetches the aggregated counters that drive the
 * Pages / Posts / Media dashboard widgets.
 *
 * Single round-trip on mount. The widgets share the result via this
 * hook so we don't make three independent requests from three sibling
 * components mounting simultaneously.
 *
 * Validation: server returns a JSON envelope with a known shape;
 * we type-guard at the boundary. Mismatched payloads fall back to
 * `null` and the widgets render their skeleton state.
 */
import { useEffect, useState } from 'react'

export interface DashboardMediaThumb {
  id: string
  publicPath: string
  altText: string
  mimeType: string
  width: number | null
  height: number | null
  variants: Array<{ width: number; height: number; format: string; path: string }>
}

export interface DashboardPluginRow {
  id: string
  name: string
  version: string
  state: 'active' | 'disabled' | 'error'
}

export interface DashboardPublishLineupRow {
  id: string
  /** Public path (`/blog/sandbox-deep-dive`). */
  path: string
  status: 'scheduled' | 'published' | 'draft'
  /**
   * ISO datetime relevant to the status:
   *   - scheduled → future scheduled_publish_at
   *   - published → past published_at
   *   - draft     → null
   * The widget renders this as a relative-time label client-side.
   */
  at: string | null
}

export interface DashboardStats {
  pages: {
    total: number
    published: number
    drafts: number
    scheduled: number
    deltaPublishedThisWeek: number
  }
  posts: {
    total: number
    categories: number
    scheduled: number
    daily28: number[]
  }
  media: {
    count: number
    totalBytes: number
    latestThumbs: DashboardMediaThumb[]
  }
  plugins: {
    total: number
    active: number
    disabled: number
    errored: number
    rows: DashboardPluginRow[]
  }
  publishLineup: {
    rows: DashboardPublishLineupRow[]
  }
}

function isDashboardStats(value: unknown): value is DashboardStats {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.pages === 'object' &&
    v.pages !== null &&
    typeof v.posts === 'object' &&
    v.posts !== null &&
    typeof v.media === 'object' &&
    v.media !== null &&
    typeof v.plugins === 'object' &&
    v.plugins !== null &&
    typeof v.publishLineup === 'object' &&
    v.publishLineup !== null
  )
}

/**
 * Returns the stats payload, or `null` until the fetch completes (or
 * the server returns an unexpected shape — in which case we stay at
 * `null` indefinitely and the widgets render their skeleton).
 */
export function useDashboardStats(): DashboardStats | null {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/admin/api/cms/dashboard/stats', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) {
          console.warn('[dashboard] stats endpoint returned', res.status)
          return
        }
        const data: unknown = await res.json()
        if (cancelled) return
        if (isDashboardStats(data)) setStats(data)
        else console.warn('[dashboard] stats endpoint returned unexpected shape')
      } catch (err) {
        console.error('[dashboard] failed to load stats:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return stats
}

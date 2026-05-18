/**
 * Uptime Monitor — admin dashboard.
 *
 * Reads from the plugin's own `/status` route (defined in
 * `server/index.ts`) and renders a status card per monitored URL plus a
 * recent-checks log. Hot-refreshes every 15 seconds while the tab is
 * focused so operators can watch checks land in real time after they
 * click "Run now" in the Schedules dialog.
 *
 * Built on host-shared design-system primitives — `Alert`, `Card`,
 * `Heading`, `Stack`, `Text` resolve to the editor's React instance via
 * the host's import map, so this component shares the same look as the
 * rest of the admin.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Heading,
  Stack,
  Text,
} from '@pagebuilder/host-ui'
import { usePluginRoutes } from '@pagebuilder/host-hooks'
import { definePluginAdminApp } from '@pagebuilder/plugin-sdk'

interface CheckRecord {
  url: string
  /** Hyphenated keys match the resource field IDs in pb-plugin.config.ts. */
  'status-code': number | null
  'latency-ms': number
  ok: boolean
  error: string | null
  'checked-at': string
}

interface UrlSummary {
  url: string
  last: CheckRecord | null
  last24h: {
    checks: number
    ok: number
    failed: number
    uptime_pct: number | null
    avg_latency_ms: number
  }
}

interface StatusResponse {
  ok: boolean
  plugin: string
  urls: UrlSummary[]
  generated_at: string
}

function UptimeDashboard() {
  const routes = usePluginRoutes()
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await routes.fetch('status')
      const body = (await res.json()) as StatusResponse
      setStatus(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status')
    } finally {
      setLoading(false)
    }
  }, [routes])

  // Initial load + 15s polling refresh. Operators tab away frequently;
  // a slow tick is enough to feel live without hammering the server.
  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), 15_000)
    return () => clearInterval(id)
  }, [refresh])

  return (
    <Stack gap={16}>
      <Heading level={2}>Uptime Monitor</Heading>
      <Text variant="muted">
        Configured URLs are checked every 5 minutes. Edit the list and thresholds
        in <strong>Settings</strong>. Use <strong>Schedules</strong> to see the next
        run or fire one immediately.
      </Text>

      {error && (
        <Alert tone="danger" title="Could not load status">
          {error}
        </Alert>
      )}

      {!status && loading && <Text variant="muted">Loading…</Text>}

      {status && status.urls.length === 0 && (
        <Alert tone="info" title="No URLs configured">
          Open <strong>Settings</strong> on the plugin card and add a URL from one
          of the allowlisted hosts (httpbin.org, example.com, api.github.com).
        </Alert>
      )}

      {status && status.urls.length > 0 && (
        <Stack gap={12}>
          {status.urls.map((row) => (
            <UrlCard key={row.url} row={row} />
          ))}
        </Stack>
      )}

      <Stack direction="row" gap={8}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh now'}
        </Button>
      </Stack>

      {status && (
        <Text variant="muted">
          Last refreshed {new Date(status.generated_at).toLocaleTimeString()}.
        </Text>
      )}
    </Stack>
  )
}

function UrlCard({ row }: { row: UrlSummary }) {
  const last = row.last
  const tone = !last
    ? 'info'
    : last.ok
      ? 'success'
      : 'danger'

  return (
    <Card padding={16}>
      <Stack gap={8}>
        <Stack direction="row" gap={8}>
          <Heading level={4}>{row.url}</Heading>
          <Badge tone={tone}>{last ? (last.ok ? 'Up' : 'Down') : 'Pending'}</Badge>
        </Stack>

        {last && (
          <Stack gap={4}>
            <Text variant="muted">
              Last check {new Date(last['checked-at']).toLocaleString()} —{' '}
              {last.ok
                ? `HTTP ${last['status-code']} in ${last['latency-ms']}ms`
                : `failed: ${last.error ?? 'unknown'}`}
            </Text>
          </Stack>
        )}

        <Stack gap={4}>
          <Text>
            <strong>Last 24h:</strong> {row.last24h.ok} ok / {row.last24h.failed} failed (
            {row.last24h.uptime_pct ?? '—'}% uptime, avg{' '}
            {row.last24h.avg_latency_ms}ms over {row.last24h.checks} checks)
          </Text>
        </Stack>
      </Stack>
    </Card>
  )
}

function Badge({ tone, children }: { tone: 'success' | 'danger' | 'info'; children: React.ReactNode }) {
  // We don't have a dedicated Badge primitive yet — fake it with the
  // Alert tone tokens via inline styling. Plain enough for v1.
  const styles: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderRadius: 4,
    background:
      tone === 'success'
        ? 'var(--editor-success-bg)'
        : tone === 'danger'
          ? 'var(--editor-danger-bg)'
          : 'var(--panel-border)',
    color:
      tone === 'success'
        ? 'var(--editor-success-green)'
        : tone === 'danger'
          ? 'var(--editor-danger)'
          : 'var(--editor-text-muted)',
  }
  return <span style={styles}>{children}</span>
}

export default definePluginAdminApp(UptimeDashboard)

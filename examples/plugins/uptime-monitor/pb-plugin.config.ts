/**
 * Uptime Monitor — demo plugin built to exercise every piece of the
 * Page Builder plugin SDK as a useful, real-world tool:
 *
 *   • `cms.schedule`      — periodic checks (every 5 min by default) +
 *                            a daily summary roll-up
 *   • `network.outbound`  — sandboxed fetch against an allowlisted set of
 *                            hosts; the URLs configured in Settings must
 *                            resolve to hosts in `networkAllowedHosts`
 *   • `cms.storage`       — append-only history of every check
 *   • `cms.hooks`         — emits `uptime.failure` and `uptime.daily-summary`
 *                            events that other plugins / admin code can
 *                            subscribe to
 *   • `cms.routes`        — `/status` route returning live uptime stats
 *   • `admin.navigation`  — Dashboard page in the admin UI
 *   • `settings`          — operator-editable URL list + thresholds
 *
 * Build:   bun run pb-plugin build examples/plugins/uptime-monitor
 * Install: upload examples/plugins/uptime-monitor.plugin.zip from /admin/plugins
 *
 * After install, grant all the requested permissions, then open the
 * Uptime Monitor admin page to see live results — or click "Schedules" on
 * the plugin card to see the two registered jobs and run them on demand.
 */
import { definePlugin, permissions } from '@core/plugin-sdk'

export default definePlugin({
  id: 'acme.uptime',
  name: 'Uptime Monitor',
  version: '1.0.0',
  description:
    'Periodically pings a configurable list of URLs and reports uptime + latency. Demo plugin exercising scheduled jobs, gated outbound HTTP, storage, hooks, routes, and an admin app.',
  author: { name: 'Acme Engineering', email: 'plugins@acme.dev' },
  license: 'MIT',
  keywords: ['demo', 'uptime', 'monitoring', 'scheduled'],
  icon: 'icon.svg',

  // Every permission this plugin actually uses. The install dialog shows
  // each of these to the site operator before activation.
  permissions: [
    permissions.cmsSchedule,
    permissions.networkOutbound,
    permissions.cmsStorage,
    permissions.cmsHooks,
    permissions.cmsRoutes,
    permissions.adminNavigation,
  ],

  // Outbound allowlist — the host's gated fetch (server/plugins/pluginWorkerHost.ts:
  // performGatedFetch) rejects any call to a host not in this list, even with
  // `network.outbound` granted. We pick a couple of well-known hosts here so
  // the demo works out of the box; in a real plugin you'd publish a new
  // version to add hosts (since the manifest is the audit boundary).
  networkAllowedHosts: ['httpbin.org', 'example.com', 'api.github.com', '*.github.com'],

  // Plugin-owned table — every check fire appends one record. The Dashboard
  // reads from this via the plugin's own route + the `cms.storage` SDK.
  resources: [
    {
      id: 'checks',
      title: 'Uptime Checks',
      singularLabel: 'Check',
      pluralLabel: 'Checks',
      fields: [
        { id: 'url', label: 'URL', type: 'text', required: true },
        { id: 'status-code', label: 'Status Code', type: 'number' },
        { id: 'latency-ms', label: 'Latency (ms)', type: 'number' },
        { id: 'ok', label: 'OK?', type: 'boolean' },
        { id: 'error', label: 'Error', type: 'text' },
        { id: 'checked-at', label: 'Checked At', type: 'date' },
      ],
    },
  ],

  // Operator-editable settings — read live by the schedule handler each
  // fire so changes take effect immediately without a re-install.
  settings: [
    {
      id: 'urls',
      label: 'Monitored URLs',
      description:
        'Comma-separated. Must resolve to hosts in networkAllowedHosts (httpbin.org, example.com, api.github.com, *.github.com). Example: https://example.com, https://api.github.com/zen',
      type: 'textarea',
      default: 'https://example.com,https://api.github.com/zen',
      rows: 3,
    },
    {
      id: 'timeout_ms',
      label: 'Request timeout (ms)',
      description: 'Drop the check as a timeout if a single URL takes longer than this.',
      type: 'number',
      default: 5000,
      min: 500,
      max: 30000,
    },
    {
      id: 'failure_threshold',
      label: 'Failure alert threshold',
      description:
        'Emit an `uptime.failure` hook event after this many consecutive failures of the same URL. Other plugins can subscribe to that event for notifications.',
      type: 'number',
      default: 3,
      min: 1,
      max: 100,
    },
  ],

  adminPages: [
    {
      id: 'dashboard',
      title: 'Uptime Monitor',
      navLabel: 'Uptime',
      icon: 'heart-pulse',
      content: {
        kind: 'app',
        heading: 'Uptime Monitor',
        entry: 'admin/dashboard.js',
      },
    },
  ],
})

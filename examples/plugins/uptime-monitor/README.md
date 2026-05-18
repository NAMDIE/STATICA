# Uptime Monitor

A complete demo plugin for Page Builder. Periodically pings a list of URLs and reports uptime + latency, surfaced in a custom admin dashboard.

It's the most complete example in the repo — exercising **every** piece of the plugin SDK in one coherent, useful tool:

| Capability | What this plugin does |
|---|---|
| `cms.schedule` | Runs `check-urls` every 5 minutes and `daily-summary` every day at 00:05 UTC |
| `network.outbound` + `networkAllowedHosts` | `fetch()`-es each configured URL, gated to an explicit host allowlist |
| `cms.storage` | Appends one `checks` record per check, with status + latency |
| `cms.hooks` | Emits `uptime.failure` after N consecutive failures and `uptime.daily-summary` once a day |
| `cms.routes` | `GET /status` returns live stats — used by the admin dashboard |
| `admin.navigation` | Adds an **Uptime** tab to the admin shell |
| `settings` | Operator-editable URL list, timeout, and failure threshold |

Everything runs inside the QuickJS-WASM sandbox — the plugin has no Node, Bun, file system, or unfiltered network access. Every privileged thing goes through one of the SDK methods listed above.

## Install

```bash
bun pb-plugin build examples/plugins/uptime-monitor
```

This produces `examples/plugins/uptime-monitor.plugin.zip`. Upload it from `/admin/plugins` and approve all the requested permissions.

## What happens after install

1. The Uptime Monitor admin page appears in the nav.
2. On first activate, two schedules register themselves:
   - **`acme.uptime.check-urls`** — every 5 minutes, fires `checkOnce` for every URL in Settings.
   - **`acme.uptime.daily-summary`** — every day at 00:05 UTC, emits a roll-up `uptime.daily-summary` hook event.
3. Open **Settings** on the plugin card to edit the URL list. Default URLs (`https://example.com`, `https://api.github.com/zen`) are seeded so the demo works immediately.
4. Open **Schedules** on the plugin card to see both jobs, when they'll fire next, and click **Run now** to fire `check-urls` immediately and watch the dashboard update.
5. Open the **Uptime** tab to see each URL's last check, last-24-hour uptime %, and average latency. The dashboard refreshes every 15 seconds.

## Try a failure

Add a URL that doesn't exist (within the allowlisted hosts, e.g. `https://api.github.com/this-endpoint-does-not-exist`). After the next check:

- A `checks` record appears with `ok: false` and a 404 / connection error.
- The dashboard shows a red "Down" badge for that URL.
- After 3 consecutive failures (the default threshold), an `uptime.failure` hook event fires. The plugin subscribes to its own event and logs it; other plugins could subscribe to send Slack messages, write SMS alerts, etc.

## Try the sandbox

Add a URL OUTSIDE the allowlist, e.g. `https://example.org`:

- The next check records `ok: false`, `error: "Plugin \"acme.uptime\" requested fetch to \"example.org\", which is not in the manifest's networkAllowedHosts allowlist."`
- The dashboard shows the URL as Down with that exact error.

This is the network gate at work — the plugin code can call `fetch(...)` freely, but the host validates the hostname against the manifest's allowlist before issuing the request.

## Try the resource limits

Add a URL that streams a large response (e.g. a huge file). After the next check:

- If the response takes longer than the schedule's `maxDurationMs` (5 seconds for `check-urls`, 30 seconds for `daily-summary`), the QuickJS interrupt handler aborts the handler.
- The schedule's `lastStatus` flips to `timeout`.
- After 5 consecutive timeouts, the schedule auto-pauses. Resume it from the Schedules dialog after fixing the URL.

## File layout

```
examples/plugins/uptime-monitor/
├── pb-plugin.config.ts    ← manifest: id, permissions, settings, allowlist, admin page
├── server/index.ts        ← lifecycle hooks + schedules + route + hook listeners
├── admin/dashboard.tsx    ← React dashboard (runs in the browser, not the sandbox)
├── icon.svg               ← shown on the Plugins admin card
├── tsconfig.json
└── README.md (this file)
```

## What this plugin demonstrates that other examples don't

- **Cadence-driven work**: the schedule API drives the loop. No external cron, no client-side polling for the heavy lifting — the host's tick fires the handler every 5 minutes regardless of whether anyone has the dashboard open.
- **Per-fire wall-clock budget**: `daily-summary` declares `maxDurationMs: 30_000` because a 24-hour roll-up can take longer than the default 5-second budget. Schedule-level overrides like this are how plugin authors negotiate for more time without disabling the budget entirely.
- **Settings read live**: every fire reads from `api.cms.settings.get('urls')` fresh — operators can edit the URL list and the next check picks it up automatically. No re-install.
- **Self-emitting hooks**: the plugin emits and listens to its own events to keep responsibilities cleanly separated even within one plugin.
- **Gated `fetch` + allowlist**: the canonical pattern for any plugin that talks to external services.

## Build + install

```bash
# Build the zip
bun pb-plugin build examples/plugins/uptime-monitor

# Iterate with auto-sync into a running dev CMS
bun pb-plugin dev examples/plugins/uptime-monitor
```

When developing locally, `pb-plugin dev` writes built files directly into the host's `uploads/plugins/acme.uptime/1.0.0/`. The first install still goes through the admin UI so the operator approves permissions. After that, every rebuild flows in on the next plugin re-activation.

## Removing it

Click **Remove** on the plugin card. The host runs the `uninstall` hook, stops the schedules, deletes the `plugin_schedules` rows, drops the `checks` records, and removes the on-disk asset folder.

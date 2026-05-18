# Scheduled Jobs

Plugins can register handlers that fire on a cadence — hourly, daily, weekly, monthly, or every-N-minutes. Handlers run inside the same QuickJS-WASM sandbox as the rest of the plugin's server code, with a per-fire wall-clock budget that the plugin author declares.

## TL;DR

```ts
export function activate(api) {
  api.cms.schedule.daily('cleanup', '03:00', async () => {
    const events = await api.cms.storage.collection('events').list()
    for (const ev of events) {
      if (Date.now() - new Date(ev.createdAt).getTime() > 30 * 86_400_000) {
        await api.cms.storage.collection('events').delete(ev.id)
      }
    }
  })

  api.cms.schedule.hourly('refresh-cache', async () => { /* ... */ })
  api.cms.schedule.every(5, 'poll', async () => { /* ... */ })
}
```

Permission: declare `'cms.schedule'` in your `plugin.json`'s `permissions`.

## Cadence shapes

| Form | Example | Meaning |
|---|---|---|
| `daily(id, 'HH:MM', handler)` | `daily('reports', '08:00', fn)` | Once a day at the given UTC time |
| `hourly(id, handler)` | `hourly('refresh', fn)` | At the top of every UTC hour |
| `every(minutes, id, handler)` | `every(15, 'poll', fn)` | Every N minutes, rounded to the next boundary |
| `register({ ... })` (full form) | see below | Custom cadence + overlap + duration |

The full form gives you per-schedule overlap policy and duration override:

```ts
api.cms.schedule.register({
  id: 'shopify-sync',
  cadence: { interval: 'monthly', at: '02:00', dayOfMonth: 1 },
  overlap: 'skip',          // 'skip' | 'queue' | 'parallel'
  maxDurationMs: 60_000,    // override the default 5s budget
  handler: async () => { /* sync code */ },
})
```

All times are UTC. The full set of cadence values:

```ts
type PluginScheduleCadence =
  | { interval: 'hourly' }
  | { interval: 'daily';   at: 'HH:MM' }
  | { interval: 'weekly';  at: 'HH:MM'; day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' }
  | { interval: 'monthly'; at: 'HH:MM'; dayOfMonth: 1..28 }   // capped at 28 so February doesn't break
  | { interval: 'every';   minutes: 1..1440 }
```

Sub-minute cadences are intentionally not supported — the scheduler tick polls at 10 s resolution, and "every 30 seconds" would be misleading. If you need that, do periodic work inside an `every({ minutes: 1 })` handler.

## Lifecycle

- **Register during `activate`.** Schedules persist across restarts in the host's `plugin_schedules` table. Every time the plugin re-activates (boot, manual re-enable, upgrade), the host re-receives the cadence + handler from the plugin's call. The DB row is "claimed" by the active handler — schedules whose plugin doesn't re-register inside a grace window stay paused.
- **Cancel with `api.cms.schedule.cancel('id')`.** The row stays for audit; a future `register` re-enables it. To remove the row entirely, uninstall the plugin (cascades).
- **Per-fire wall-clock cap.** Each fire runs inside a deadline (default 5 s; configurable per schedule via `maxDurationMs`, host-capped at 5 minutes). If the handler exceeds it, the VM aborts with `InternalError: interrupted` and the schedule status is recorded as `'timeout'`.
- **Failure auto-pause.** After 5 consecutive non-`'ok'` fires, the schedule is auto-disabled and surfaced in the Plugins admin page. An operator must explicitly resume after fixing the cause.

## Overlap policies

What happens when a fire is due while the previous one is still running:

| Policy | Behavior |
|---|---|
| `'skip'` *(default)* | Drop the new fire. Recommended — fail-safe against slow handlers. |
| `'queue'` | FIFO queue, capped at 10 pending. Beyond that, oldest waiting fire is dropped. |
| `'parallel'` | Run concurrently. Handler must be safe under concurrency. |

Most plugins want `'skip'`. Pick `'queue'` only when you actually need to process every tick. Pick `'parallel'` only when each fire is fully independent (e.g. pure read-only metrics).

## HA + the leader election lock

When Page Builder runs against a managed Postgres database with multiple host instances, only ONE instance ticks at a time. Each tick tries `pg_try_advisory_lock(712830541)` — whoever wins is the leader for that tick. The lock is released at the end of the tick, so a crashed leader hands off naturally on the next interval.

For SQLite installs, the host is single-instance by definition and the lock is a no-op.

This means: if you run 5 Page Builder processes against the same Postgres, your `daily('cleanup', ...)` still fires exactly once per day, on whichever process happened to be the leader at the moment. No duplication, no coordination configuration needed.

## What runs where

```
┌─ Bun host (single-instance for SQLite, multi-instance for Postgres)
│  ┌─ scheduler.ts ─ leader-elected tick (~10s polling)
│  │   ├─ pg_try_advisory_lock (HA leader election)
│  │   ├─ selectDueSchedules
│  │   ├─ tryClaimSchedule (atomic row-level claim)
│  │   ├─ dispatch `run-schedule` to plugin's worker
│  │   └─ record outcome + advance next_run_at
│  │
│  └─ Bun.Worker (per plugin)
│     └─ QuickJS-WASM context
│        └─ __plugin_handlers.schedules[id] = handler  ← inside the sandbox
```

The handler itself is a normal async JavaScript function. It can do everything any other plugin code can do: `api.cms.storage.*`, `api.cms.hooks.emit`, `fetch(...)` (with `network.outbound`), and so on. Everything denied to plugins everywhere else is denied here too.

## Notes + caveats

- **10 s tick precision.** A `daily('reports', '08:00', ...)` handler fires somewhere in `[08:00:00 UTC, 08:00:10 UTC]` — fine for almost everything; surprising if you need second-precise scheduling.
- **No retry-with-backoff inside one cadence step.** A failed fire records the error and waits for the next cadence step. If you need retry semantics, implement them inside the handler.
- **Handlers share their plugin's worker.** A 30 s sync schedule blocks every other invocation for that plugin (routes, hooks, other schedules) until it finishes. Chunk long-running work and yield to the event loop.
- **Per-schedule timezones aren't yet supported.** Plan: a future `tz: 'Europe/Berlin'` field on the cadence object. Until then, do timezone math inside the handler (`new Date()` is UTC).

## Reference

- Plugin author SDK: `src/core/plugin-sdk/types.ts` → `ServerPluginScheduleApi`
- Permission: `'cms.schedule'` in `src/core/plugin-sdk/types.ts` → `PLUGIN_PERMISSION_VALUES`
- Engine: `server/plugins/scheduler.ts`
- Persistence: `server/repositories/pluginSchedules.ts` + migrations `002_plugin_schedules`
- Worker bridge: `server/plugins/quickjsHost.ts` → `__runSchedule`
- Architecture invariants gated by: `src/__tests__/architecture/plugin-schedule-invariants.test.ts`

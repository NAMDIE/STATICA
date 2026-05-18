/**
 * Plugin schedule admin endpoints.
 *
 *   GET    /admin/api/cms/plugins/:id/schedules
 *          → list every schedule the plugin has registered, with recent runs
 *          → `{ schedules: PluginSchedule[]; recent: { [scheduleId]: PluginScheduleRun[] } }`
 *
 *   POST   /admin/api/cms/plugins/:id/schedules/:scheduleId/run-now
 *          → fire the handler immediately, bypassing the cadence but
 *            respecting the row-level claim lock so a concurrent tick
 *            cannot fire it twice. Returns the outcome row.
 *
 *   POST   /admin/api/cms/plugins/:id/schedules/:scheduleId/pause
 *          → flip `enabled = false`. The tick stops dispatching until
 *            a `resume` arrives or the plugin re-activates.
 *
 *   POST   /admin/api/cms/plugins/:id/schedules/:scheduleId/resume
 *          → flip `enabled = true`, reset `consecutive_failures = 0`.
 *
 * All four routes require `plugins.manage`. Mutating routes
 * (run-now / pause / resume) additionally require step-up.
 */
import type { DbClient } from '../../../db/client'
import { jsonResponse, methodNotAllowed } from '../../../http'
import {
  enablePluginSchedule,
  disablePluginSchedule,
  listRecentRuns,
  listSchedulesForPlugin,
} from '../../../repositories/pluginSchedules'
import { runScheduleNow } from '../../../plugins/scheduler'

export async function handlePluginSchedulesList(
  req: Request,
  db: DbClient,
  pluginId: string,
): Promise<Response> {
  if (req.method !== 'GET') return methodNotAllowed()
  const schedules = await listSchedulesForPlugin(db, pluginId)
  const recent: Record<string, Awaited<ReturnType<typeof listRecentRuns>>> = {}
  for (const sched of schedules) {
    recent[sched.scheduleId] = await listRecentRuns(db, pluginId, sched.scheduleId, 20)
  }
  return jsonResponse({ schedules, recent })
}

export async function handlePluginScheduleRunNow(
  req: Request,
  db: DbClient,
  pluginId: string,
  scheduleId: string,
): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed()
  const outcome = await runScheduleNow(db, pluginId, scheduleId)
  if (!outcome.ok && outcome.error === 'schedule not found') {
    return jsonResponse({ error: 'Schedule not found' }, { status: 404 })
  }
  return jsonResponse({ outcome })
}

export async function handlePluginSchedulePause(
  req: Request,
  db: DbClient,
  pluginId: string,
  scheduleId: string,
): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed()
  await disablePluginSchedule(db, pluginId, scheduleId)
  return jsonResponse({ ok: true })
}

export async function handlePluginScheduleResume(
  req: Request,
  db: DbClient,
  pluginId: string,
  scheduleId: string,
): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed()
  await enablePluginSchedule(db, pluginId, scheduleId)
  return jsonResponse({ ok: true })
}

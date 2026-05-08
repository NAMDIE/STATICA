/**
 * Public tracker endpoint.
 *
 * The tracker runtime injected by `collectFrontendInjections` calls
 * `POST /_pb/tracker` with `{ pluginId, eventName, payload, ... }`. We
 * fan the event out through `hookBus.emit('tracker.event', ...)` so any
 * plugin with `cms.hooks` can handle it — typically by storing the event
 * in its own declared resource via `api.cms.storage.collection(...)`.
 *
 * The endpoint is intentionally simple: validate, normalize, fan out.
 * Persistence is the listening plugin's job — it knows the resource
 * shape it needs.
 *
 * Defenses:
 *   - Body capped at 32 KiB (decline larger payloads).
 *   - Field strings normalized + length-bound; payload limited in depth.
 *   - eventName matched against a safe allowlist regex.
 */
import type { DbClient } from '../../db/client'
import { jsonResponse, methodNotAllowed } from '../../http'
import { hookBus } from '@core/plugins/hookBus'

const PUBLIC_TRACKER_PATH = '/_pb/tracker'
const MAX_TRACKER_BODY_BYTES = 32 * 1024
const MAX_STRING_FIELD_LEN = 512
const SAFE_EVENT_NAME = /^[a-zA-Z0-9._:-]{1,64}$/

function pickString(input: Record<string, unknown>, key: string, max = MAX_STRING_FIELD_LEN): string | undefined {
  const value = input[key]
  if (typeof value !== 'string') return undefined
  if (value.length === 0) return undefined
  return value.slice(0, max)
}

export function isPublicTrackerPath(pathname: string): boolean {
  return pathname === PUBLIC_TRACKER_PATH
}

export async function handlePublicTrackerRequest(
  req: Request,
  _db: DbClient,
): Promise<Response> {
  if (req.method === 'GET') {
    // Health check / discovery — useful for plugin authors verifying the
    // runtime is wired up.
    return jsonResponse({ ok: true, listeners: hookBus.hasListenersFor('tracker.event') })
  }
  if (req.method !== 'POST') return methodNotAllowed()

  const raw = await req.text()
  if (raw.length > MAX_TRACKER_BODY_BYTES) {
    return jsonResponse({ error: 'Tracker payload too large' }, { status: 413 })
  }
  let body: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonResponse({ error: 'Tracker body must be a JSON object' }, { status: 400 })
    }
    body = parsed as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventName = pickString(body, 'eventName', 64)
  if (!eventName || !SAFE_EVENT_NAME.test(eventName)) {
    return jsonResponse({ error: 'Missing or invalid eventName' }, { status: 400 })
  }

  const pluginId = pickString(body, 'pluginId', 96) ?? '__implicit__'
  const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
    ? sanitizePayload(body.payload as Record<string, unknown>)
    : {}

  await hookBus.emit('tracker.event', {
    pluginId,
    eventName,
    payload,
    visitorId: pickString(body, 'visitorId', 64),
    sessionId: pickString(body, 'sessionId', 64),
    pagePath: pickString(body, 'pagePath', 256),
    referrer: pickString(body, 'referrer', 1024),
    receivedAt: new Date().toISOString(),
  })

  return jsonResponse({ ok: true })
}

/**
 * Drop nested arrays/objects deeper than two levels and cap string lengths.
 * Tracker payloads should be tiny — anything else is misuse.
 */
function sanitizePayload(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (out && Object.keys(out).length >= 32) break
    if (typeof value === 'string') {
      out[key] = value.length > MAX_STRING_FIELD_LEN ? value.slice(0, MAX_STRING_FIELD_LEN) : value
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      out[key] = value
    } else if (Array.isArray(value)) {
      out[key] = value.slice(0, 32).map((item) =>
        typeof item === 'string' ? item.slice(0, MAX_STRING_FIELD_LEN) : item,
      )
    } else if (value && typeof value === 'object') {
      // Allow one level of nested object; flatten deeper structures.
      const nested: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (Object.keys(nested).length >= 16) break
        if (typeof v === 'string') nested[k] = v.slice(0, MAX_STRING_FIELD_LEN)
        else if (typeof v === 'number' || typeof v === 'boolean' || v === null) nested[k] = v
      }
      out[key] = nested
    }
  }
  return out
}

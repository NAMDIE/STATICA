import { handleAgentRequest } from './agentHandler'
import { handleCmsRequest } from './cms/handlers'
import type { DbClient } from './cms/db'
import { jsonResponse } from './http'

export interface ServerRuntime {
  db: DbClient
}

export async function handleServerRequest(
  req: Request,
  runtime: ServerRuntime,
): Promise<Response> {
  const url = new URL(req.url)

  if (url.pathname === '/health') {
    return jsonResponse({ status: 'ok', ts: Date.now() })
  }

  if (url.pathname.startsWith('/api/cms/')) {
    return handleCmsRequest(req, runtime.db)
  }

  if (url.pathname === '/api/agent') {
    return handleAgentRequest(req)
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 })
}

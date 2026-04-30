export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  return new Response(JSON.stringify(body), { ...init, headers })
}

export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

export function methodNotAllowed(): Response {
  return jsonResponse({ error: 'Method not allowed' }, { status: 405 })
}

export function badRequest(message: string): Response {
  return jsonResponse({ error: message }, { status: 400 })
}

export function setCookieHeader(res: Response, value: string): Response {
  res.headers.append('set-cookie', value)
  return res
}

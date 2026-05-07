import { parseJsonResponse } from '@core/utils/jsonValidate'
import {
  CmsSetupStatusSchema,
  ErrorEnvelopeSchema,
  type CmsSetupStatus,
} from './responseSchemas'
import { Type } from '@sinclair/typebox'
import { readEnvelope } from './httpJson'

interface CmsSetupInput {
  siteName: string
  email: string
  password: string
}

interface CmsLoginInput {
  email: string
  password: string
}

export interface CmsCurrentUser {
  id: string
  email: string
  displayName: string
  status: 'active' | 'suspended'
  role: {
    id: string
    slug: string
    name: string
    description: string
    isSystem: boolean
    capabilities: string[]
  }
  capabilities: string[]
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

const CurrentUserEnvelope = Type.Object(
  {
    user: Type.Optional(Type.Unknown()),
    role: Type.Optional(Type.Unknown()),
    capabilities: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: true },
)

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

async function assertOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return
  try {
    const body = await parseJsonResponse(res, ErrorEnvelopeSchema)
    const errorText = typeof body.error === 'string' ? body.error : ''
    throw new Error(errorText || fallback)
  } catch (err) {
    if (err instanceof Error && err.message !== 'Unexpected end of JSON input') throw err
    throw new Error(fallback, { cause: err })
  }
}

export async function getCmsSetupStatus(
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
  basePath = '/admin/api/cms',
): Promise<CmsSetupStatus> {
  const res = await fetchImpl(`${basePath}/setup/status`, {
    method: 'GET',
    credentials: 'include',
  })
  await assertOk(res, `CMS setup status failed with ${res.status}`)
  return await parseJsonResponse(res, CmsSetupStatusSchema)
}

export async function setupCms(
  input: CmsSetupInput,
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
  basePath = '/admin/api/cms',
): Promise<void> {
  const res = await fetchImpl(`${basePath}/setup`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  await assertOk(res, `CMS setup failed with ${res.status}`)
}

export async function loginCms(
  input: CmsLoginInput,
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
  basePath = '/admin/api/cms',
): Promise<void> {
  const res = await fetchImpl(`${basePath}/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  await assertOk(res, `CMS login failed with ${res.status}`)
}

export async function logoutCms(
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
  basePath = '/admin/api/cms',
): Promise<void> {
  const res = await fetchImpl(`${basePath}/logout`, {
    method: 'POST',
    credentials: 'include',
  })
  await assertOk(res, `CMS logout failed with ${res.status}`)
}

export async function probeCmsSession(
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
  basePath = '/admin/api/cms',
): Promise<boolean> {
  const res = await fetchImpl(`${basePath}/me`, {
    method: 'GET',
    credentials: 'include',
  })

  if (res.ok) return true
  if (res.status === 401) return false
  await assertOk(res, `CMS session check failed with ${res.status}`)
  return false
}

export async function getCurrentCmsUser(
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
  basePath = '/admin/api/cms',
): Promise<CmsCurrentUser> {
  const res = await fetchImpl(`${basePath}/me`, {
    method: 'GET',
    credentials: 'include',
  })
  const body = await readEnvelope(res, CurrentUserEnvelope, `CMS current user failed with ${res.status}`)
  if (!body.user || typeof body.user !== 'object') throw new Error('CMS current user response was missing user')
  return body.user as CmsCurrentUser
}

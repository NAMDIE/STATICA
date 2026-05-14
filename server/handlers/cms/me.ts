/**
 * Self-targeted user mutations — endpoints any authenticated user can call
 * to change their own profile data without needing `users.manage`.
 *
 *   POST   /admin/api/cms/me/avatar — upload a new avatar image
 *   DELETE /admin/api/cms/me/avatar — clear the avatar, falling back to the
 *                                     Gravatar identicon served by the client
 *
 * `GET /admin/api/cms/me` lives in `./auth.ts` because it shares the session
 * helpers with login/logout. The avatar endpoints land here so the file
 * stays focused on self-mutation flows (display-name edit, avatar, future
 * password change all slot in next to each other).
 *
 * Avatars are stored as ordinary `media_assets` rows + an `avatar_media_id`
 * pointer on the user. We deliberately leave the old media row in the
 * library when the user replaces or clears their avatar — the bytes already
 * cost storage and tracking ownership-for-cascade-delete is out of scope
 * for this surface. Operators can prune via the media library.
 */
import type { DbClient } from '../../db/client'
import { requireAuthenticatedUser } from '../../auth/authz'
import { setUserAvatarMediaId } from '../../repositories/users'
import { createAuditEvent } from '../../repositories/audit'
import { badRequest, jsonResponse, methodNotAllowed } from '../../http'
import { CMS_API_PREFIX, requestAuditContext, type CmsHandlerOptions } from './shared'
import {
  IMAGE_MIMES,
  acceptUploadedMedia,
  readUploadedFile,
  uploadsDirRequired,
} from './mediaUpload'

/**
 * Avatars are capped at 5 MB — full-resolution camera output is wildly
 * oversized for a 96×96 portrait and the library cap (50 MB) is a footgun
 * here. 5 MB still comfortably accommodates a 4000×4000 PNG.
 */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export async function handleMeRoutes(
  req: Request,
  db: DbClient,
  options: CmsHandlerOptions,
): Promise<Response | null> {
  const url = new URL(req.url)

  if (url.pathname !== `${CMS_API_PREFIX}/me/avatar`) return null

  const user = await requireAuthenticatedUser(req, db)
  if (user instanceof Response) return user

  if (req.method === 'POST') {
    if (!options.uploadsDir) return uploadsDirRequired()

    const file = await readUploadedFile(req)
    if (!file) return badRequest('Missing file')

    const asset = await acceptUploadedMedia(db, {
      file,
      maxBytes: MAX_AVATAR_BYTES,
      allowedMimes: IMAGE_MIMES,
      uploadsDir: options.uploadsDir,
      uploadedByUserId: user.id,
      oversizedMessage: 'Avatar must be smaller than 5 MB',
      unsupportedMessage: 'Avatars must be a JPEG, PNG, GIF, or WebP image',
    })
    if (asset instanceof Response) return asset

    const updated = await setUserAvatarMediaId(db, user.id, asset.id)
    if (!updated) {
      // The user row vanished between auth and the update (e.g. concurrent
      // soft-delete). The uploaded asset stays in the media library — it's
      // already a first-class row and the caller can clean it up there.
      return jsonResponse({ error: 'User not found' }, { status: 404 })
    }

    await createAuditEvent(db, {
      actorUserId: user.id,
      action: 'user.update',
      targetType: 'user',
      targetId: user.id,
      metadata: { avatarMediaId: asset.id },
      ...requestAuditContext(req),
    })

    return jsonResponse({ user: updated })
  }

  if (req.method === 'DELETE') {
    const updated = await setUserAvatarMediaId(db, user.id, null)
    if (!updated) return jsonResponse({ error: 'User not found' }, { status: 404 })

    await createAuditEvent(db, {
      actorUserId: user.id,
      action: 'user.update',
      targetType: 'user',
      targetId: user.id,
      metadata: { avatarMediaId: null },
      ...requestAuditContext(req),
    })

    return jsonResponse({ user: updated })
  }

  return methodNotAllowed()
}

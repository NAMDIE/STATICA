export const CORE_CAPABILITIES = [
  'site.read',
  'site.edit',
  'pages.edit',
  'pages.publish',
  'content.edit',
  'content.publish',
  'media.manage',
  'runtime.manage',
  'plugins.manage',
  'users.manage',
  'roles.manage',
  'audit.read',
] as const

export type CoreCapability = typeof CORE_CAPABILITIES[number]

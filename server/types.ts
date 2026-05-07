export interface SiteRow {
  id: string
  name: string
  settings_json: Record<string, unknown>
  created_at: Date | string
  updated_at: Date | string
}

export type UserStatus = 'active' | 'suspended'

export interface RoleRow {
  id: string
  slug: string
  name: string
  description: string
  is_system: boolean | number
  capabilities_json: unknown
  created_at: Date | string
  updated_at: Date | string
}

export interface UserRow {
  id: string
  email: string
  email_normalized: string
  display_name: string
  password_hash: string
  status: UserStatus
  role_id: string
  last_login_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
  deleted_at: Date | string | null
}

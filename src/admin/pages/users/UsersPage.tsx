/**
 * UsersPage — `/admin/users`.
 *
 * Capability-gated workspace for managing CMS users, custom roles and the
 * audit log. The page itself is a thin shell: it figures out which tabs
 * the current admin is allowed to see (`users.manage`, `roles.manage`,
 * `audit.read`), loads the underlying data once via `useUsersPageData`,
 * and delegates rendering to the per-tab components in `./tabs/`.
 *
 * Each tab owns its own form state, busy flag, and dialog open/close
 * state — only the loaded data, the shared error string, and the
 * mutation refresh callback live here.
 */
import { useMemo, useState } from 'react'
import { Button } from '@ui/components/Button'
import { AdminPageLayout } from '@admin/layouts'
import { hasCapability } from '@admin/access'
import { useCurrentAdminUser } from '@admin/sessionContext'
import { AuditTab } from './tabs/AuditTab'
import { RolesTab } from './tabs/RolesTab'
import { UsersTab } from './tabs/UsersTab'
import { useUsersPageData } from './hooks/useUsersPageData'
import { tabLabel } from './utils/format'
import type { Tab, UsersPageLoadAccess } from './types'
import styles from './UsersPage.module.css'

export function UsersPage() {
  const currentUser = useCurrentAdminUser()
  const unrestricted = !currentUser
  const canManageUsers = unrestricted || hasCapability(currentUser, 'users.manage')
  const canManageRoles = unrestricted || hasCapability(currentUser, 'roles.manage')
  const canReadAudit = unrestricted || hasCapability(currentUser, 'audit.read')
  const canReadRoleOptions = canManageUsers || canManageRoles

  const loadAccess = useMemo<UsersPageLoadAccess>(
    () => ({ canManageUsers, canReadRoleOptions, canReadAudit }),
    [canManageUsers, canReadRoleOptions, canReadAudit],
  )
  const data = useUsersPageData(loadAccess)

  const availableTabs = useMemo<Tab[]>(() => {
    const tabs: Tab[] = []
    if (canManageUsers) tabs.push('users')
    if (canManageRoles) tabs.push('roles')
    if (canReadAudit) tabs.push('audit')
    return tabs
  }, [canManageUsers, canManageRoles, canReadAudit])

  const [tab, setTab] = useState<Tab>('users')
  const activeTab = availableTabs.includes(tab) ? tab : availableTabs[0] ?? 'users'

  const tabs = (
    <div role="tablist" aria-label="Users sections" className={styles.tabsRow}>
      {availableTabs.map((item) => (
        <Button
          key={item}
          type="button"
          variant={activeTab === item ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setTab(item)}
        >
          <span>{tabLabel(item)}</span>
        </Button>
      ))}
    </div>
  )

  return (
    <AdminPageLayout
      workspace="users"
      title="Users"
      titleId="users-title"
      description="Manage admin access, custom roles, and security audit events."
      tabs={tabs}
    >
      <div className={styles.body}>
        {data.error && <p className={styles.error} role="alert">{data.error}</p>}

        {activeTab === 'users' && <UsersTab data={data} canManageUsers={canManageUsers} />}
        {activeTab === 'roles' && <RolesTab data={data} canManageRoles={canManageRoles} />}
        {activeTab === 'audit' && <AuditTab data={data} />}
      </div>
    </AdminPageLayout>
  )
}

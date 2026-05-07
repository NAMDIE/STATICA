/**
 * AdminWorkspace — top-level admin section identifier.
 *
 * Defined here (not in AdminLayout.tsx) so editor chrome (e.g. Toolbar) can
 * reference the type without creating a cycle through AdminLayout.tsx, which
 * itself imports the editor chrome.
 */
export type AdminWorkspace = 'site' | 'content' | 'plugins' | 'users' | 'pluginPage'

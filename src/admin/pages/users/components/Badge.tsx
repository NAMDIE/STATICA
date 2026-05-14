/**
 * Pill badge used in tables on the Users workspace.
 *
 * Accent colour comes from `pillAccent(label)` so the same role/status name
 * always renders with the same hue across the page. The `muted` variant
 * drops the accent and uses neutral chrome.
 */
import { pillAccent } from '@ui/pillAccent'
import styles from '../UsersPage.module.css'

export function Badge({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span
      className={muted ? styles.badgeMuted : styles.badge}
      data-accent={pillAccent(label)}
    >
      {label}
    </span>
  )
}

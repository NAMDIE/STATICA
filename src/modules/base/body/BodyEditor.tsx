/**
 * base.body editor preview component.
 *
 * Component-only file so React Fast Refresh can hot-patch edits without
 * re-running module registration.
 *
 * The body wrapper stretches to fill the breakpoint viewport so user classes
 * (e.g. a background-color) paint the entire canvas frame, matching the
 * behaviour of the published <body> element. The CSS-module class is
 * concatenated with the user's `mcClassName` so a class-style `background:
 * red` applied to the body lands on this wrapper too.
 */
import type { ModuleComponentProps } from '@core/module-engine/types'
import { cn } from '@ui/cn'
import styles from './Body.module.css'

type BodyProps = Record<string, unknown>

export const BodyEditor = ({ children, mcClassName }: ModuleComponentProps<BodyProps>) => (
  <div className={cn(styles.body, mcClassName)}>
    {children}
  </div>
)

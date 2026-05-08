/**
 * ControlRow — shared layout shell used by every property control.
 *
 * Owns the wrapper div + label row so individual controls don't have to
 * duplicate the same boilerplate. Honors the `layout` variant from the
 * module schema:
 *
 *   - `inline` (default): 100px label column + control column.
 *   - `stacked`: label on its own line above a full-width control.
 *
 * The `labelSuffix` slot is used by controls that surface inline metadata
 * next to the label (e.g. NumberControl's unit, MediaLibraryControl /
 * UrlControl's validation error).
 */
import type { ReactNode } from 'react'
import type { PropertyControlLayout } from '@core/module-engine/types'
import { cn } from '@ui/cn'
import styles from './controls.module.css'

interface ControlRowProps {
  /** Property key — used for the `htmlFor`/`id` linkage when `inputId` is omitted. */
  propKey: string
  /** Visible label text. Falls back to `propKey` when omitted. */
  label?: string
  /** Override the input id used for the `htmlFor` attribute. */
  inputId?: string
  /** Render the row in inline (default) or stacked layout. */
  layout?: PropertyControlLayout
  /** Highlight the label as a breakpoint override. */
  isOverride?: boolean
  /** Dim the row to indicate the control is disabled. */
  disabled?: boolean
  /** Optional inline content rendered after the label (unit, validation error). */
  labelSuffix?: ReactNode
  /** The actual control input(s). */
  children: ReactNode
}

export function ControlRow({
  propKey,
  label,
  inputId,
  layout = 'inline',
  isOverride,
  disabled,
  labelSuffix,
  children,
}: ControlRowProps) {
  return (
    <div
      className={cn(
        styles.controlWrapper,
        layout === 'stacked' && styles.controlWrapperStacked,
        disabled && styles.controlWrapperDisabled,
      )}
    >
      <div className={styles.labelRow}>
        <label
          htmlFor={inputId ?? `ctrl-${propKey}`}
          className={isOverride ? styles.labelOverride : undefined}
        >
          {label ?? propKey}
        </label>
        {labelSuffix}
      </div>
      {children}
    </div>
  )
}

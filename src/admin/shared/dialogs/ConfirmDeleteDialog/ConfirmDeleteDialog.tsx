/**
 * ConfirmDeleteDialog — generic two-button "are you sure?" prompt for
 * destructive actions in the editor.
 *
 * Driven by the `confirmBeforeDelete` editor preference: callers don't render
 * this directly — they call `useConfirmDelete()` and the provider renders the
 * dialog only when the preference is on. When off, the action runs
 * immediately. See `ConfirmDeleteContext.tsx` for the wiring.
 *
 * Visual style mirrors FrameworkChangeConfirmDialog so the editor has one
 * consistent confirmation look.
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@ui/components/Button'
import { CloseIcon } from 'pixel-art-icons/icons/close'
import styles from './ConfirmDeleteDialog.module.css'

export interface ConfirmDeleteDialogProps {
  /** Short, action-style title. e.g. "Delete layer?" */
  title: string
  /** Optional secondary line shown beneath the title. */
  description?: string
  /** Confirm button label — defaults to "Delete". */
  confirmLabel?: string
  /** Cancel button label — defaults to "Cancel". */
  cancelLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Close on Escape — listening at document level so the dialog wins over
  // any editor keybindings (canvas Delete-key handler, etc.).
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCancel()
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        onConfirm()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel, onConfirm])

  // Auto-focus the confirm button so keyboard users can confirm with Enter
  // without tabbing. Pressing Escape still cancels (handled above).
  useEffect(() => {
    requestAnimationFrame(() => confirmRef.current?.focus())
  }, [])

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby={description ? 'confirm-delete-desc' : undefined}
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="confirm-delete-title" className={styles.title}>
            {title}
          </h2>
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            aria-label="Close dialog"
            onClick={onCancel}
          >
            <CloseIcon size={12} aria-hidden="true" />
          </Button>
        </div>

        {description && (
          <div className={styles.body}>
            <p id="confirm-delete-desc" className={styles.description}>
              {description}
            </p>
          </div>
        )}

        <div className={styles.actions}>
          <Button variant="secondary" size="sm" type="button" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant="destructive"
            size="sm"
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

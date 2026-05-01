import { useCallback, type ReactNode, type SyntheticEvent } from 'react'
import { registry } from '@core/module-engine/registry'
import { useInsertModule } from '../../hooks/useInsertModule'
import { ModulePickerDropdown } from '../Toolbar/ModulePickerDropdown'
import type { IconComponent } from '@ui/icons/types'
import { CheckboxSharpIcon } from '@ui/icons/icons/checkbox-sharp'
import { TypeIcon } from '@ui/icons/icons/type'
import { ImageIcon } from '@ui/icons/icons/image'
import { BoxIcon } from '@ui/icons/icons/box'
import { Button } from '@ui/components/Button'
import styles from './CanvasNotch.module.css'

const QUICK_ACTIONS = [
  { moduleId: 'base.container', label: 'Container', icon: CheckboxSharpIcon },
  { moduleId: 'base.text', label: 'Text', icon: TypeIcon },
  { moduleId: 'base.image', label: 'Image', icon: ImageIcon },
  { moduleId: 'base.button', label: 'Button', icon: BoxIcon },
] as const

const ADD_TRIGGER_TEST_ID = 'canvas-notch-add-btn'

export interface CanvasNotchAction {
  id: string
  label: string
  icon: IconComponent
  onClick: () => void
}

interface CanvasNotchProps {
  actions?: CanvasNotchAction[]
  addControl?: ReactNode
}

export function CanvasNotch({ actions, addControl }: CanvasNotchProps = {}) {
  const insertModule = useInsertModule()

  const stopCanvasInteraction = useCallback((event: SyntheticEvent) => {
    event.stopPropagation()
  }, [])

  const handleQuickInsert = useCallback(
    (moduleId: (typeof QUICK_ACTIONS)[number]['moduleId']) => {
      const mod = registry.get(moduleId)
      if (!mod) return
      insertModule(mod)
    },
    [insertModule],
  )

  return (
    <div
      className={styles.shell}
      aria-label="Insert modules"
      data-testid="canvas-notch"
      onClick={stopCanvasInteraction}
    >
      <div className={styles.notch}>
        {(actions ?? QUICK_ACTIONS.map((action) => ({
          ...action,
          id: action.moduleId,
          onClick: () => handleQuickInsert(action.moduleId),
        }))).map((action) => {
          const ActionIcon = action.icon
          return (
            <Button
              key={action.id}
              variant="ghost"
              size="sm"
              iconOnly
              className={styles.quickButton}
              onClick={action.onClick}
              aria-label={`Add ${action.label}`}
              title={`Add ${action.label}`}
              data-testid={`canvas-notch-${action.label.toLowerCase()}-btn`}
            >
              <ActionIcon size={14} aria-hidden="true" />
            </Button>
          )
        })}

        <span className={styles.divider} aria-hidden="true" />

        {addControl ?? (
          <ModulePickerDropdown
            triggerClassName={styles.addButton}
            triggerTestId={ADD_TRIGGER_TEST_ID}
          />
        )}
      </div>
    </div>
  )
}

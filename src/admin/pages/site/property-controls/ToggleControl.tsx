import type { ControlProps } from './shared'
import { Switch } from '@ui/components/Switch'
import { cn } from '@ui/cn'
import styles from './controls.module.css'

export function ToggleControl({
  propKey,
  value,
  onChange,
  label,
  isOverride,
  disabled,
}: ControlProps<boolean>) {
  const checked = Boolean(value)

  return (
    <div
      className={cn(
        styles.controlWrapper,
        styles.toggleWrapper,
        disabled && styles.controlWrapperDisabled,
      )}
    >
      <label
        htmlFor={`ctrl-${propKey}`}
        className={cn(
          styles.toggleLabel,
          disabled && styles.toggleLabelDisabled,
          isOverride && styles.toggleLabelOverride,
        )}
      >
        {label ?? propKey}
      </label>

      <Switch
        id={`ctrl-${propKey}`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(propKey, next)}
      />
    </div>
  )
}

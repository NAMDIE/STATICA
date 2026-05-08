import type { ControlProps } from './shared'
import { Input } from '@ui/components/Input'
import { ControlRow } from './ControlRow'
import styles from './controls.module.css'

interface NumberControlProps extends ControlProps<number> {
  min?: number
  max?: number
  step?: number
  unit?: string
}

export function NumberControl({
  propKey,
  value,
  onChange,
  label,
  min,
  max,
  step = 1,
  unit,
  isOverride,
  disabled,
  layout,
}: NumberControlProps) {
  return (
    <ControlRow
      propKey={propKey}
      label={label}
      layout={layout}
      isOverride={isOverride}
      disabled={disabled}
      labelSuffix={unit ? <span className={styles.labelUnit}>{unit}</span> : undefined}
    >
      <Input
        id={`ctrl-${propKey}`}
        type="number"
        value={value ?? 0}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        fieldSize="sm"
        onChange={(e) => {
          const v = e.target.valueAsNumber
          if (!isNaN(v)) onChange(propKey, v)
        }}
      />
    </ControlRow>
  )
}

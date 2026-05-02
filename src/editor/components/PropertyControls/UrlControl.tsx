import { useState } from 'react'
import type { ControlProps } from './shared'
import { isValidUrl } from '@core/utils/urlValidation'
import { Input } from '@ui/components/Input'
import { cn } from '@ui/cn'
import styles from './controls.module.css'

export function UrlControl({
  propKey,
  value,
  onChange,
  label,
  isOverride,
  disabled,
}: ControlProps<string>) {
  const [error, setError] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    const valid = isValidUrl(v)
    setError(!valid)
    if (valid) onChange(propKey, v)
  }

  return (
    <div className={cn(styles.controlWrapper, disabled && styles.controlWrapperDisabled)}>
      <div className={styles.labelRow}>
        <label
          htmlFor={`ctrl-${propKey}`}
          className={isOverride ? styles.labelOverride : undefined}
        >
          {label ?? propKey}
        </label>
        {error && (
          <span className={styles.labelError} role="alert">
            Invalid URL
          </span>
        )}
      </div>
      <Input
        id={`ctrl-${propKey}`}
        type="url"
        value={String(value ?? '')}
        placeholder="https://…"
        disabled={disabled}
        fieldSize="sm"
        onChange={handleChange}
        invalid={error}
      />
    </div>
  )
}

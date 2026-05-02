import type { AnyModuleDefinition, ModuleStyleBinding, PropertyControl } from '@core/module-engine/types'
import type { CSSPropertyBag } from '@core/page-tree/types'

export interface ResolvedModuleStyleBinding {
  key: string
  label: string
  control: PropertyControl
  binding: ModuleStyleBinding
}

export function getModuleStyleBindings(
  moduleDefinition: AnyModuleDefinition | null | undefined,
): ReadonlyArray<ResolvedModuleStyleBinding> {
  if (!moduleDefinition?.classStyleBindings) return []

  return Object.entries(moduleDefinition.classStyleBindings)
    .map(([key, binding]) => {
      const control = binding.control ?? moduleDefinition.schema[key]
      if (!control) return null
      return {
        key,
        label: binding.label ?? control.label,
        control,
        binding,
      }
    })
    .filter((binding): binding is ResolvedModuleStyleBinding => Boolean(binding))
}

export function isModuleStyleSet(
  binding: ResolvedModuleStyleBinding,
  styles: Partial<CSSPropertyBag>,
): boolean {
  return binding.binding.isSet?.(styles) ?? binding.binding.properties.some((prop) => hasStyleValue(styles[prop]))
}

export function clearModuleStylePatch(binding: ResolvedModuleStyleBinding): Partial<CSSPropertyBag> {
  return Object.fromEntries(binding.binding.properties.map((prop) => [prop, null])) as Partial<CSSPropertyBag>
}

function hasStyleValue(value: string | number | undefined): value is string | number {
  return value !== undefined && value !== null && value !== ''
}

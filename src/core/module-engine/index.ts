/**
 * Module engine — public barrel.
 *
 * External consumers import from here; internal files import via relative
 * paths directly from their sibling modules.
 */

export type {
  ModuleDefinition,
  AnyModuleDefinition,
  IModuleRegistry,
  ModuleDependencies,
  RenderOutput,
  ModuleComponentProps,
  NodeWrapperProps,
} from './types'

export type {
  PropertySchema,
  PropertyControl,
  PropertyControlLayout,
  PropertyCondition,
} from './propertySchema'

export type {
  NormalizedModuleDependency,
  SiteModuleDependencyUsage,
} from './dependencies'

export {
  normalizeModuleDependencies,
  getMissingModuleDependencies,
  getSiteModuleDependencyUsage,
  getSiteDependencyVersion,
} from './dependencies'

export { registry } from './registry'

export { validateNodeProps } from './validateNodeProps'

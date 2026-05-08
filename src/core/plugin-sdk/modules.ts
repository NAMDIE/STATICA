/**
 * Plugin module pack SDK — `modules.register` permission.
 *
 * A plugin can ship new modules that show up in the canvas module library
 * by setting `entrypoints.modules` in its `plugin.json`. The entrypoint is a
 * package-relative ESM file that default-exports an array of
 * `PluginModuleDefinition` objects (or a function returning one).
 *
 * The shape is **JSON-friendly** on purpose: only `render` and `preview` may
 * be functions; everything else (defaults, schema, css path) is plain data.
 * The host wraps the definition into a full `ModuleDefinition` registered
 * with the canvas module registry.
 */

// ---------------------------------------------------------------------------
// Property control — a JSON-friendly subset of the host PropertySchema.
// We only expose the controls a plugin module can usefully render. The host
// translates this into the full PropertySchema at registration time.
// ---------------------------------------------------------------------------

export interface PluginPropertyControlBase {
  label: string
  description?: string
}

export type PluginPropertyControl = PluginPropertyControlBase &
  (
    | { type: 'text'; placeholder?: string }
    | { type: 'textarea'; rows?: number; placeholder?: string }
    | { type: 'number'; min?: number; max?: number; step?: number; unit?: string }
    | { type: 'color'; format?: 'hex' | 'rgba' }
    | { type: 'select'; options: Array<{ label: string; value: unknown }> }
    | { type: 'toggle' }
    | { type: 'image' }
    | { type: 'url' }
  )

export type PluginPropertySchema = Record<string, PluginPropertyControl>

// ---------------------------------------------------------------------------
// Render output — same shape as host ModuleDefinition.render
// ---------------------------------------------------------------------------

export interface PluginRenderOutput {
  html: string
  css?: string
}

export type PluginRenderFn = (
  props: Record<string, unknown>,
  children: string[],
) => PluginRenderOutput

// ---------------------------------------------------------------------------
// Module definition
// ---------------------------------------------------------------------------

export interface PluginModuleDefinition {
  /**
   * Module ID. MUST be `<pluginId>.<name>` — host enforces the namespace
   * lock so no plugin can overwrite or shadow another plugin or a base
   * module. Validation happens at registration time.
   */
  id: string
  name: string
  description?: string
  category: string
  version: string
  /** Default property values matching `schema` keys. */
  defaults: Record<string, unknown>
  /** Property controls that drive the editor Properties Panel. */
  schema: PluginPropertySchema
  /** Whether the module can hold child modules. */
  canHaveChildren?: boolean
  /**
   * Pure render function used by the publisher and (by default) the
   * editor canvas preview. Receives escaped string props; must return
   * clean HTML. NEVER use document/window/React. NEVER call fetch.
   */
  render: PluginRenderFn
  /** Optional editor-canvas preview. Falls back to `render` when omitted. */
  preview?: PluginRenderFn
  /** Optional concrete root tag for layer/DOM tree display. */
  htmlTag?: string
}

// ---------------------------------------------------------------------------
// Entrypoint module shape
// ---------------------------------------------------------------------------

export interface PluginModulePackApi {
  pluginId: string
}

export type PluginModulePackEntrypoint = PluginModuleDefinition[] |
  ((api: PluginModulePackApi) => PluginModuleDefinition[])

export interface PluginModulesEntrypointModule {
  default: PluginModulePackEntrypoint
}

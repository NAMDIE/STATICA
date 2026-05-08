/**
 * @cms/plugin-sdk type declarations (preview).
 *
 * Until the SDK is published to npm, copy this file alongside your plugin
 * sources and reference it from your tsconfig (or use `// @ts-check` JSDoc
 * import to get IDE help). The shapes here mirror the runtime contract in
 * `src/core/plugin-sdk/types.ts` of the page-builder repo.
 */

export type PluginPermission =
  // Admin / nav
  | 'admin.navigation'
  // Storage
  | 'cms.storage'
  // Server runtime
  | 'cms.routes'
  | 'cms.hooks'
  // Editor surfaces
  | 'editor.toolbar'
  | 'editor.commands'
  | 'editor.canvas'
  | 'editor.panels'
  | 'editor.store.read'
  | 'editor.store.write'
  // Builder extensions
  | 'modules.register'
  | 'loops.register'
  | 'visualComponents.register'
  // Frontend / published pages
  | 'frontend.scripts'
  | 'frontend.tracker'
  // Reserved
  | 'unstable.internals'

export interface PluginManifest {
  id: string
  name: string
  version: string
  apiVersion: 1
  description?: string
  permissions: PluginPermission[]
  entrypoints?: {
    server?: string
    editor?: string
    admin?: string
    /** Module pack with canvas modules, registered via modules.register. */
    modules?: string
    /** Single bundle injected on every published page. */
    frontend?: string
  }
  resources: PluginResource[]
  adminPages: PluginAdminPage[]
  /** Visual Components / pages installed into the user's site on activate. */
  pack?: PluginPackManifest
}

export interface PluginPackManifest {
  /** Path inside the package zip relative to the manifest. */
  path: string
}

export interface PluginResource {
  id: string
  title: string
  singularLabel?: string
  pluralLabel?: string
  fields: Array<{
    id: string
    label: string
    type: 'text' | 'longtext' | 'number' | 'date' | 'boolean'
    required?: boolean
  }>
}

export interface PluginAdminPage {
  id: string
  title: string
  navLabel?: string
  icon?: string
  content: PluginPageContent
}

export type PluginPageContent =
  | { kind: 'markdown'; heading?: string; body: string }
  | { kind: 'resource'; heading: string; resource: string }
  | { kind: 'app'; heading: string; entry: string }

export interface PluginRecord {
  id: string
  pluginId: string
  resourceId: string
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Server SDK
// ---------------------------------------------------------------------------

export interface ServerPluginApi {
  plugin: {
    id: string
    version: string
    permissions: PluginPermission[]
    log: (...args: unknown[]) => void
  }
  cms: {
    routes: {
      get: (path: string, capability: string, handler: ServerPluginRouteHandler) => void
      post: (path: string, capability: string, handler: ServerPluginRouteHandler) => void
      patch: (path: string, capability: string, handler: ServerPluginRouteHandler) => void
      delete: (path: string, capability: string, handler: ServerPluginRouteHandler) => void
      getPublic: (path: string, handler: ServerPluginRouteHandler) => void
    }
    storage: {
      collection: (resourceId: string) => PluginStorageCollection<boolean>
    }
    /**
     * Server-side hooks API. Requires `cms.hooks` permission.
     */
    hooks: {
      /** Fired by the CMS at well-known lifecycle moments. Listener output is ignored. */
      on: <K extends keyof CmsServerEvents>(
        event: K,
        listener: (payload: CmsServerEvents[K]) => void | Promise<void>,
      ) => void
      /**
       * Filters mutate the value flowing through a named pipeline. Each
       * registered handler must return a value of the same type (or a Promise
       * resolving to one). Filters run in registration order; the host then
       * uses the final value.
       */
      filter: <K extends keyof CmsServerFilters>(
        filter: K,
        handler: (value: CmsServerFilters[K], context: { pluginId: string }) => CmsServerFilters[K] | Promise<CmsServerFilters[K]>,
      ) => void
      /**
       * Manually emit an event from your plugin. Other plugins can listen for
       * `plugin.<your-id>.<event>` if you publish a documented event surface.
       */
      emit: <K extends keyof CmsServerEvents>(event: K, payload: CmsServerEvents[K]) => Promise<void>
    }
  }
}

/**
 * Map of well-known server-side events fired by the CMS. Plugins can register
 * extra events at runtime via `api.cms.hooks.emit('plugin.<id>.<event>', payload)`.
 */
export interface CmsServerEvents {
  /** Fired before a publish snapshot is rendered. */
  'publish.before': { siteId: string; pageId?: string }
  /** Fired after a publish snapshot has been rendered and stored. */
  'publish.after': { siteId: string; pageId?: string }
  /** Fired after a content entry is created. */
  'content.entry.created': { collectionId: string; entryId: string }
  /** Fired after a content entry is updated. */
  'content.entry.updated': { collectionId: string; entryId: string }
  /** Fired after a content entry is deleted. */
  'content.entry.deleted': { collectionId: string; entryId: string }
  /** Fired after a tracker event arrives from a published page. */
  'tracker.event': {
    pluginId: string
    eventName: string
    payload: Record<string, unknown>
    visitorId?: string
    sessionId?: string
    pagePath?: string
    referrer?: string
    receivedAt: string
  }
  // Catch-all for plugin-defined events.
  [key: `plugin.${string}.${string}`]: Record<string, unknown>
}

/** Map of named filter pipelines and the value types they transform. */
export interface CmsServerFilters {
  /** The full HTML of a published page, before it's sent to the browser. */
  'publish.html': string
  /** The HTTP response headers for a published page. */
  'publish.headers': Record<string, string>
}

export interface ServerPluginRouteContext {
  req: Request
  body: Record<string, unknown>
  user: {
    id: string
    email: string
    capabilities: string[]
  } | null
}

export type ServerPluginRouteHandler = (
  context: ServerPluginRouteContext,
) => unknown | Promise<unknown>

export interface ServerPluginModule {
  install?: (api: ServerPluginApi) => void | Promise<void>
  activate?: (api: ServerPluginApi) => void | Promise<void>
  deactivate?: (api: ServerPluginApi) => void | Promise<void>
  uninstall?: (api: ServerPluginApi) => void | Promise<void>
}

// ---------------------------------------------------------------------------
// Editor SDK
// ---------------------------------------------------------------------------

export interface EditorPluginApi {
  editor: {
    commands: {
      register: (command: {
        id: string
        label: string
        run: () => void | { message?: string } | Promise<void | { message?: string }>
      }) => void
    }
    toolbar: {
      addButton: (button: {
        id: string
        label: string
        command: string
      }) => void
    }
    store: {
      read: () => unknown
      transaction: (mutate: (store: unknown) => void) => void
    }
  }
  cms: {
    storage: {
      collection: (resourceId: string) => PluginStorageCollection<void>
    }
  }
}

export interface EditorPluginModule {
  activate: (api: EditorPluginApi) => void | Promise<void>
}

// ---------------------------------------------------------------------------
// Module pack — modules.register
// ---------------------------------------------------------------------------

export interface PluginModuleDefinition {
  /** Required: must be `"<pluginId>.<name>"` (the `<pluginId>` part must match the plugin manifest id). */
  id: string
  name: string
  description?: string
  category: string
  version: string
  /** Default property values matching the schema. */
  defaults: Record<string, unknown>
  /** Property controls that drive the editor Properties Panel. */
  schema: Record<string, PluginModulePropertyControl>
  /** Whether the module can hold child modules. */
  canHaveChildren?: boolean
  /** Path inside the package zip to a CSS file with the module's styles. */
  styles?: string
  /** Path inside the package zip to a CSS file with the module's editor-only preview styles. */
  editorStyles?: string
  /**
   * Pure render function. Receives escaped string props; must return clean
   * HTML. NEVER use document/window/React. NEVER call fetch.
   */
  render: (props: Record<string, unknown>, children: string[]) => { html: string; css?: string }
  /** Optional renderer used for the editor canvas; falls back to `render` when omitted. */
  preview?: (props: Record<string, unknown>, children: string[]) => { html: string; css?: string }
  /** Optional concrete root tag for layer/DOM tree display. */
  htmlTag?: string
}

export type PluginModulePropertyControl = {
  label: string
  description?: string
} & (
  | { type: 'text'; placeholder?: string }
  | { type: 'textarea'; rows?: number; placeholder?: string }
  | { type: 'number'; min?: number; max?: number; step?: number; unit?: string }
  | { type: 'color'; format?: 'hex' | 'rgba' }
  | { type: 'select'; options: Array<{ label: string; value: unknown }> }
  | { type: 'toggle' }
  | { type: 'image' }
  | { type: 'url' }
)

/**
 * Module entrypoint. Default-export an array of definitions OR a function
 * returning an array; the host registers them when the editor mounts.
 */
export interface ModulesEntrypointModule {
  default: PluginModuleDefinition[] | ((api: ModulePackApi) => PluginModuleDefinition[])
}

export interface ModulePackApi {
  pluginId: string
}

// ---------------------------------------------------------------------------
// Frontend SDK — published page runtime
// ---------------------------------------------------------------------------

/**
 * Globally available on published pages once a `frontend.scripts`-granted
 * plugin is installed. Mounted as `window.__pb` by the host.
 */
export interface PublishedPageRuntime {
  tracker: {
    /** Send a structured event to the host. Requires `frontend.tracker`. */
    send: (eventName: string, payload?: Record<string, unknown>) => Promise<void>
  }
  hooks: {
    on: (event: PublishedPageEventName, listener: (detail: PublishedPageEventDetail) => void) => () => void
    emit: (event: string, detail: Record<string, unknown>) => void
  }
  visitorId: string
  sessionId: string
}

export type PublishedPageEventName =
  | 'page-view'
  | 'link-click'
  | 'scroll-depth'
  | 'visibility-change'
  | string

export interface PublishedPageEventDetail {
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Admin app SDK
// ---------------------------------------------------------------------------

export interface PluginAdminAppApi {
  cms: {
    routes: {
      fetch: (path: string, init?: RequestInit) => Promise<Response>
      /**
       * Validated JSON helper — pass a TypeBox schema. Plugins that don't want
       * to depend on TypeBox should use `routes.fetch(path).then(r => r.json())`.
       */
      json: <T>(path: string, schema: import('@sinclair/typebox').TSchema, init?: RequestInit) => Promise<T>
    }
    storage: {
      collection: (resourceId: string) => PluginStorageCollection<void>
    }
  }
}

export interface PluginAdminAppContext {
  root: HTMLElement
  page: {
    pluginId: string
    pluginName: string
    id: string
    title: string
  }
  api: PluginAdminAppApi
}

export interface PluginAdminAppModule {
  render: (context: PluginAdminAppContext) => void | Promise<void>
  cleanup?: (context: PluginAdminAppContext) => void | Promise<void>
}

export interface PluginStorageCollection<DeleteResult> {
  list: () => Promise<PluginRecord[]>
  create: (data: Record<string, unknown>) => Promise<PluginRecord>
  update: (recordId: string, data: Record<string, unknown>) => Promise<PluginRecord | null>
  delete: (recordId: string) => Promise<DeleteResult>
}

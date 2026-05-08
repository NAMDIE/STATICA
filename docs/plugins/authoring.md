# Plugin Authoring

Plugins are zip packages that contain a `plugin.json` manifest and optional JavaScript entrypoints. The current SDK lives in this repo at `src/core/plugin-sdk/`; the contract is structured as the future `@cms/plugin-sdk` package, with TypeScript declarations in `examples/plugins/plugin-sdk.d.ts`.

## Package Shape

```text
plugin.json
server/index.js
admin/dashboard.js
editor/index.js
modules/index.js
frontend/tracker.js
pack/site.json
```

Create a package with:

```bash
cd examples/plugins/template
zip -qr ../template.plugin.zip .
```

Upload the resulting zip from the Plugins admin page.

## Manifest

`plugin.json` declares identity, permissions, resources, admin pages, and entrypoints:

```json
{
  "id": "acme.template",
  "name": "Template Plugin",
  "version": "1.0.0",
  "apiVersion": 1,
  "permissions": ["admin.navigation", "cms.storage", "cms.routes"],
  "entrypoints": {
    "server": "server/index.js",
    "editor": "editor/index.js",
    "modules": "modules/index.js",
    "frontend": "frontend/tracker.js"
  },
  "resources": [],
  "adminPages": [],
  "pack": { "path": "pack/site.json" }
}
```

Plugin IDs must be namespaced, such as `acme.workflow`. Versions must be semver-like, such as `1.0.0`.

`apiVersion: 1` is the only currently supported value.

### Entrypoints

| Field | Required permission | Loaded by | Use it for |
| --- | --- | --- | --- |
| `server` | `cms.routes` (and any others your routes touch) | Server boot | Lifecycle hooks, CMS routes, hooks, storage |
| `editor` | `editor.commands` / `editor.toolbar` etc. | Editor mount | Toolbar buttons, commands, store transactions |
| `admin` | `admin.navigation` | Admin app pages | Custom admin app rendered into a plugin admin page |
| `modules` | `modules.register` | Editor mount + server boot | Adding new modules to the canvas library |
| `frontend` | `frontend.scripts` (+ `frontend.tracker` if posting events) | Published pages | Analytics, custom widgets, A/B testing |

### Pack

If `pack.path` is set, the plugin can ship Visual Components, page templates, and CSS classes. The site owner triggers an "Install pack" action from the Plugins admin page; the host validates and merges into the active site.

```jsonc
// pack/site.json
{
  "visualComponents": [/* VisualComponent[] */],
  "pages": [/* Page[] */],
  "classes": [/* CSSClass[] */]
}
```

CSS class ids must be namespaced under the plugin id (`acme.template/hero-root`).

## Server Entrypoint

```js
export function install(api) {}
export function activate(api) {}
export function deactivate(api) {}
export function uninstall(api) {}
```

`activate(api)` is the right place to register routes, hooks, and loop sources.

```js
export function activate(api) {
  api.cms.routes.get('/status', 'plugins.manage', () => ({ ok: true }))
  api.cms.hooks.on('publish.before', (e) => api.plugin.log('publish', e))
  api.cms.hooks.filter('publish.html', (html) => html.replace('</body>', '<!-- acme -->\n</body>'))
}
```

Routes mount under `/admin/api/cms/plugins/:pluginId/runtime/*`.

## Plugin Storage

Declare resources in the manifest, then use `cms.storage`:

```js
const items = api.cms.storage.collection('items')
await items.create({ title: 'Draft', status: 'pending' })
const records = await items.list()
```

## Admin Apps

Admin app pages use manifest content kind `app` and export `render`:

```js
export async function render({ root, api }) {
  const res = await api.cms.routes.fetch('status')
  root.textContent = JSON.stringify(await res.json())
}

export function cleanup() {}
```

## Editor Entrypoint

```js
export function activate(api) {
  api.editor.commands.register({
    id: 'plugin.action',
    label: 'Run Action',
    run: () => ({ message: 'Action complete' }),
  })

  api.editor.toolbar.addButton({
    id: 'plugin.action',
    label: 'Action',
    command: 'plugin.action',
  })
}
```

## Canvas Modules (`modules.register`)

`modules/index.js` default-exports an array of plugin module definitions. The host wraps each into a host `ModuleDefinition` and registers it with the canvas registry. Module ids must start with `<pluginId>.`.

```js
export default ({ pluginId }) => [
  {
    id: `${pluginId}.callout`,
    name: 'Callout',
    category: 'Acme',
    version: '1.0.0',
    canHaveChildren: false,
    defaults: { heading: 'Heads up', body: '...', tone: 'info' },
    schema: {
      heading: { type: 'text', label: 'Heading' },
      body: { type: 'textarea', label: 'Body', rows: 4 },
      tone: { type: 'select', label: 'Tone', options: [
        { label: 'Info', value: 'info' },
      ] },
    },
    htmlTag: 'aside',
    render: (props) => ({
      html: `<aside class="cb">${props.heading}\n${props.body}</aside>`,
      css: `.cb{padding:14px 18px;}`,
    }),
  },
]
```

Same `render(props, children)` runs on the publisher (server) and inside the editor canvas preview, so the markup you ship is exactly what visitors see.

## Frontend Tracker (`frontend.scripts` + `frontend.tracker`)

The host injects a tiny tracker runtime into every published page when any installed plugin has `frontend.scripts` or `frontend.tracker` granted. The runtime exposes `window.__pb`:

```ts
window.__pb.visitorId    // stable per-browser id
window.__pb.sessionId    // stable per-session id
window.__pb.tracker.send(name, payload)              // implicit pluginId
window.__pb.tracker.sendFor(pluginId, name, payload) // explicit
window.__pb.hooks.on(name, listener)                 // page-view, link-click, scroll-depth, ...
window.__pb.hooks.emit(name, detail)
```

Server-side, plugins listen with `api.cms.hooks.on('tracker.event', ...)` and persist into their own resource via `api.cms.storage.collection(...)`.

```js
// frontend/tracker.js
window.__pb.hooks.on('page-view', (detail) => {
  window.__pb.tracker.sendFor('acme.showcase', 'page-view', detail)
})
```

## Loop Sources (`loops.register`)

```js
export function activate(api) {
  api.cms.loops.registerSource({
    id: 'acme.products',
    label: 'Acme Products',
    filterSchema: {},
    orderByOptions: [{ id: 'name', label: 'Name' }],
    fields: [
      { id: 'title', label: 'Title' },
      { id: 'price', label: 'Price' },
    ],
    fetch: async (ctx) => ({ items: [], totalItems: 0 }),
    preview: () => [{ id: 'sample', fields: { title: 'Sample', price: '$10' } }],
  })
}
```

## Hooks Reference

Built-in events:

| Event | Payload |
| --- | --- |
| `publish.before` | `{ siteId, pageId? }` |
| `publish.after` | `{ siteId, pageId? }` |
| `tracker.event` | `{ pluginId, eventName, payload, visitorId, sessionId, pagePath, referrer, receivedAt }` |
| `content.entry.created/updated/deleted` | `{ collectionId, entryId }` |

Built-in filters:

| Filter | Type |
| --- | --- |
| `publish.html` | `string` (full HTML before sending to browser) |
| `publish.headers` | `Record<string, string>` |

Plugins can `emit` and `on` any event. If you publish a documented event under your namespace, prefix it with `plugin.<your-id>.`.

## Type Declarations

Until the SDK is published, copy:

```text
examples/plugins/plugin-sdk.d.ts
```

The starter package and end-to-end showcase live at:

```text
examples/plugins/template/
examples/plugins/showcase/
```

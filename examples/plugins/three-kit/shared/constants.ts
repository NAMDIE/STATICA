/**
 * Three.js version pinned by this plugin.
 *
 * Every module declares `dependencies: { three: THREE_VERSION_RANGE }`.
 * Inserting a module writes that range into the site's `package.json`,
 * the host's "Resolve runtime" pins it to a concrete version, and
 * `ensureRuntimeDependencyCache(lock)` then runs `bun install` so the
 * package lives under the host's runtime cache. The publisher emits a
 * `<script type="importmap">` mapping `three` → `/_pb/runtime/cache/...`
 * so the plugin's frontend bundle and editor sandbox both resolve bare
 * imports to the same locally-installed copy. Plugin code never names
 * a CDN URL.
 */
export const THREE_VERSION = '0.169.0'
export const THREE_VERSION_RANGE = `^${THREE_VERSION}`

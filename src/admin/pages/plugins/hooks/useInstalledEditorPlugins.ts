import { useEffect } from 'react'
import { activateInstalledEditorPlugins } from '@core/plugins/editorPluginLoader'
import { bindDashboardWidgetIconResolver } from '@core/plugins/runtime'
import { editorPluginModuleComponentFactory } from '@site/canvas/pluginModuleComponentFactory'
import { resolveDashboardWidgetIcon } from '@admin/pages/dashboard/widgetIcons'
import { CMS_PLUGINS_CHANGED_EVENT } from '@plugins/utils/pluginEvents'
import { setEditorActivationFailures } from './editorPluginActivationErrors'

// Bind the dashboard widget icon resolver at module-load time, BEFORE
// any React effect fires. Plugins call `api.dashboard.widgets.register`
// during their `activate()` hook, and that requires a bound resolver
// to map iconName strings to React components. The DashboardPage used
// to do this binding at its own module-load — but plugin activation
// runs at admin boot regardless of which route the user is on, so the
// dashboard module hadn't loaded yet when the analytics plugin tried
// to register its Visitors / Top pages widgets. Binding here, in the
// same file that owns `useInstalledEditorPlugins`, guarantees the
// resolver is ready before the activation pass it triggers.
bindDashboardWidgetIconResolver(resolveDashboardWidgetIcon)

export function useInstalledEditorPlugins(): void {
  useEffect(() => {
    let cancelled = false

    async function activatePlugins() {
      const result = await activateInstalledEditorPlugins({
        componentFactory: editorPluginModuleComponentFactory,
      })
      if (cancelled) return
      // Fan failures out to the activation-errors store so the Plugins admin
      // page can render them inline next to server-side `lastError`. The
      // store is replaced wholesale on every pass — successful re-activation
      // clears stale entries automatically.
      setEditorActivationFailures(result.failed)
      if (result.failed.length > 0) {
        console.error('Some editor plugins failed to activate', result.failed)
      }
    }

    function refreshPlugins() {
      void activatePlugins().catch(() => {
        // The editor remains usable when plugin metadata cannot be loaded.
      })
    }

    refreshPlugins()
    window.addEventListener(CMS_PLUGINS_CHANGED_EVENT, refreshPlugins)

    return () => {
      cancelled = true
      window.removeEventListener(CMS_PLUGINS_CHANGED_EVENT, refreshPlugins)
    }
  }, [])
}

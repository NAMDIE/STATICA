// admin/dashboard.tsx
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Code,
  Heading,
  Stack,
  Text
} from "@pagebuilder/host-ui";
import { usePluginRoutes } from "@pagebuilder/host-hooks";
import { definePluginAdminApp } from "@pagebuilder/plugin-sdk";
import { jsxDEV } from "react/jsx-dev-runtime";
function ShowcaseDashboard() {
  const routes = usePluginRoutes();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await routes.fetch("status");
      const body = await res.json();
      setStatus(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, [routes]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const clearAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await routes.fetch("clear", { method: "POST" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear");
      setLoading(false);
    }
  }, [refresh, routes]);
  return /* @__PURE__ */ jsxDEV(Stack, {
    gap: 16,
    children: [
      /* @__PURE__ */ jsxDEV(Heading, {
        level: 2,
        children: "Showcase"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV(Text, {
        variant: "muted",
        children: "Open a published page in another tab; events fire automatically and appear here in real time."
      }, undefined, false, undefined, this),
      error && /* @__PURE__ */ jsxDEV(Alert, {
        tone: "danger",
        title: "Error",
        children: error
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV(Card, {
        padding: 16,
        children: /* @__PURE__ */ jsxDEV(Stack, {
          gap: 12,
          children: [
            /* @__PURE__ */ jsxDEV(Heading, {
              level: 3,
              children: "Tracker status"
            }, undefined, false, undefined, this),
            loading ? /* @__PURE__ */ jsxDEV(Text, {
              variant: "muted",
              children: "Loading..."
            }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV(Code, {
              children: JSON.stringify(status, null, 2)
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV(Stack, {
              direction: "row",
              gap: 8,
              children: [
                /* @__PURE__ */ jsxDEV(Button, {
                  variant: "secondary",
                  size: "sm",
                  onClick: () => void refresh(),
                  disabled: loading,
                  children: "Refresh"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV(Button, {
                  variant: "destructive",
                  size: "sm",
                  onClick: () => void clearAll(),
                  disabled: loading || !status || status.total === 0,
                  children: "Clear events"
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var dashboard_default = definePluginAdminApp(ShowcaseDashboard);
export {
  dashboard_default as default
};

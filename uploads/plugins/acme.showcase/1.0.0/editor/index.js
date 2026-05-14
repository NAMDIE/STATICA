// editor/index.tsx
import { useState } from "react";
import {
  Button,
  Card,
  Stack,
  Text
} from "@pagebuilder/host-ui";
import {
  useCanvasNodeRect,
  useEditorStore
} from "@pagebuilder/host-hooks";
import {
  definePluginCanvasOverlay,
  definePluginPanel
} from "@pagebuilder/plugin-sdk";
import { jsxDEV } from "react/jsx-dev-runtime";
function ShowcasePanel() {
  const [count, setCount] = useState(0);
  return /* @__PURE__ */ jsxDEV(Stack, {
    gap: 12,
    children: [
      /* @__PURE__ */ jsxDEV(Text, {
        variant: "muted",
        children: "Demo panel registered via editor.panels."
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV(Card, {
        children: /* @__PURE__ */ jsxDEV(Stack, {
          gap: 8,
          children: [
            /* @__PURE__ */ jsxDEV(Text, {
              children: [
                "Click count: ",
                count
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV(Button, {
              variant: "primary",
              onClick: () => setCount(count + 1),
              children: "Increment"
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var reviewPanel = definePluginPanel({
  id: "acme.showcase.review",
  label: "Showcase",
  iconName: "box-stack",
  accent: "mint",
  component: ShowcasePanel
});
function SelectedNodePin() {
  const selectedId = useEditorStore((s) => s.selectedNodeId);
  const rect = useCanvasNodeRect(selectedId);
  if (!rect)
    return null;
  return /* @__PURE__ */ jsxDEV("div", {
    style: {
      position: "absolute",
      top: rect.top - 22,
      left: rect.left + rect.width / 2 - 6,
      width: 12,
      height: 12,
      borderRadius: 999,
      background: "#8ee6c8",
      boxShadow: "0 0 0 2px rgba(0, 0, 0, 0.6), 0 0 8px rgba(142, 230, 200, 0.5)",
      pointerEvents: "none"
    },
    "aria-hidden": "true"
  }, undefined, false, undefined, this);
}
var selectionPin = definePluginCanvasOverlay({
  id: "acme.showcase.selection-pin",
  component: SelectedNodePin
});
var mod = {
  activate(api) {
    api.editor.commands.register({
      id: "acme.showcase.ping",
      label: "Showcase Ping",
      run: () => ({ message: "Showcase command fired" })
    });
    api.editor.toolbar.addButton({
      id: "acme.showcase.ping",
      label: "Showcase",
      command: "acme.showcase.ping"
    });
    api.editor.panels.register(reviewPanel);
    api.editor.canvas.registerOverlay(selectionPin);
  }
};
var editor_default = mod;
var activate = mod.activate;
export {
  editor_default as default,
  activate
};

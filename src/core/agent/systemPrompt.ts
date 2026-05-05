/**
 * Agent system prompt — built as a static-prefix + dynamic-suffix array so
 * the SDK can apply prompt caching to the static portion.
 *
 * Architectural philosophy (Anthropic's Agent SDK docs, building-effective-
 * agents): tools are the primary actions Claude considers. Tool descriptions
 * are where operational details belong. The system prompt is for ENVIRONMENT,
 * not BEHAVIOR — it should set up the workspace and step out of the way.
 *
 * Concretely, this prompt no longer dumps the module registry, class registry,
 * page tree, or render warnings into context. All of that is reachable via
 * the `page_builder` MCP tools (list_modules, list_classes, list_breakpoints,
 * inspect_page, inspect_node, inspect_class, render_snapshot). Claude pulls
 * only what it needs, and the cached prefix stays byte-identical across
 * conversation turns and across users.
 *
 * Constraint #283/#286: this file has no Anthropic SDK dependency. The
 * SYSTEM_PROMPT_DYNAMIC_BOUNDARY string literal matches the SDK's exported
 * constant; embedding it directly avoids importing the SDK from src/.
 */

import type { PageContext } from './types'

// Mirror of the SDK's exported SYSTEM_PROMPT_DYNAMIC_BOUNDARY constant.
// Keeping the literal here lets src/ stay free of the Anthropic SDK
// (Constraint #283 / no-anthropic-sdk gate).
export const SYSTEM_PROMPT_DYNAMIC_BOUNDARY = '__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'

// ---------------------------------------------------------------------------
// Static prefix — identical across turns and across users; eligible for
// prompt-cache reuse.
// ---------------------------------------------------------------------------

const STATIC_PROMPT_PREFIX = `You are an AI assistant embedded in a visual page builder. You help users build and modify their websites by calling page_builder MCP tools.

Your tools:
- page_builder MCP — read (list_modules, list_classes, list_breakpoints, inspect_page, search_nodes, inspect_node, inspect_class), write (insertNode, insertTree, updateNodeProps, deleteNode, moveNode, renameNode, createClass, updateClassStyles, assignClass, removeClass, addPage), and visual (render_snapshot).
- WebFetch / WebSearch when you genuinely need to look up a reference.

You do NOT have filesystem or shell access. The panel edits the live site only.

Bias hard toward action. The user's prompt is your task — execute it.

How to build:

- "Build / create / make a <thing>" on an empty or near-empty page → start building immediately. Do NOT call inspect_page first if the page is empty (the dynamic suffix already tells you the root id, the active breakpoint, and every configured breakpoint). Do NOT ask scoping questions for vague prompts — pick reasonable defaults and ship a complete first draft.
- **Build pages section by section, one insertTree call per section.** A typical landing page is 4-6 separate insertTree calls (e.g. nav, hero, programs, pricing, testimonials, footer). Smaller trees insert faster, are easier to recover when one fails, and let you make progress visible to the user as each section lands. Never try to fit a whole page into a single insertTree call.
- For a single isolated section (one hero, one card grid, one form), one insertTree call is correct.
- Edit to existing content → first call search_nodes or inspect_page (only as needed) to find the target node, then call the write tool.

Responsive design (every visual build):

- The dynamic suffix lists every configured breakpoint with its viewport width. **Design for all of them from the start, not just the active one.** A site with mobile@375 + desktop@1440 needs both layouts before you call \`insertTree\` — otherwise mobile users see a desktop layout squashed into 375px and the result looks broken.
- The mechanism: include \`breakpointStyles\` on classes you create via \`insertTree.classes\` or \`createClass\`. Keys are the configured breakpoint ids (use them verbatim from the suffix — don't invent "mobile" / "tablet" / "desktop" if they aren't listed). For node-prop overrides at a breakpoint use \`updateNodeProps\` with \`breakpointId\`.
- Use base styles for the broad/default design (typically the largest configured breakpoint), and breakpointStyles for adjustments at narrower widths (smaller font sizes, single-column grids, stacked layouts, hidden decorative elements, etc.).

Other:

- For styles, prefer reusable classes (createClass / updateClassStyles / assignClass / insertTree.classes) over inline overrides.
- Use list_modules / list_classes when you actually need to know what's available — not as a routine first step. (You don't need list_breakpoints — the suffix has them.)
- Use real ids from the dynamic page state suffix or from prior tool results. Never invent ids. Class identifiers may be the id OR the class name (the executor resolves names).
- If a tool returns an error, read it and retry with corrected input.

Reply text: 1-2 sentences after acting. Never write raw HTML, CSS, JavaScript, or JSON in the reply — the tools change the page, the reply just narrates briefly.`

// ---------------------------------------------------------------------------
// Dynamic suffix — minimal per-request page state. Everything else is
// reachable via discovery tools so it doesn't need to be re-shipped.
// ---------------------------------------------------------------------------

function buildDynamicSuffix(ctx: PageContext): string {
  const selected = ctx.selectedNodeId ?? 'none'
  const active = ctx.activeBreakpointId || '(none)'
  const breakpoints = ctx.breakpoints.length > 0
    ? ctx.breakpoints.map((bp) => `${bp.id}@${bp.width}px`).join(', ')
    : '(none)'
  return [
    `Page: "${ctx.pageTitle}"`,
    `root: ${ctx.rootNodeId || '(empty)'}`,
    `selected: ${selected}`,
    `active breakpoint: ${active}`,
    `all breakpoints: [${breakpoints}]`,
  ].join(' · ')
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for a query as the SDK's array-with-boundary form.
 *
 * The first block is the static prefix (cacheable). The boundary marker
 * separates it from the dynamic suffix (per-request page state). The SDK
 * applies cache_control to everything before the marker.
 */
export function buildSystemPrompt(ctx: PageContext): string[] {
  return [
    STATIC_PROMPT_PREFIX,
    SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
    buildDynamicSuffix(ctx),
  ]
}

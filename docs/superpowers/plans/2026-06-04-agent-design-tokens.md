# Agent Design-Token Awareness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the site agent fully aware of the site's design system — its color tokens, typography scale, spacing scale, and font tokens — so generated/edited sections reference the design system (`var(--primary)`, `class="text-l text-primary"`) instead of hardcoding off-brand colors, sizes, and fonts. The agent must also be able to **create and edit** tokens, simply and flexibly, when a design needs a value the system doesn't yet have.

**Tech Stack:** Bun, TypeScript, TypeBox (boundary validation), React 19 admin, the in-house framework token engine (`src/core/framework`, `src/core/fonts`) and the agent layer (`server/ai/tools/site`, `src/admin/pages/site/agent`). Tests with `bun test`.

---

## Why this shape — facts from the current code

1. **The token data model is complete and centralized.** Everything lives in `site.settings.framework` (`colors`, `typography`, `spacing`, `preferences`) and `site.settings.fonts`. Pure generators already derive every output:
   - CSS vars: `generateFrameworkColorVariableSets`, `generateFrameworkTypographyVariables`, `generateFrameworkSpacingVariables` (`src/core/framework`), `fontTokenCssVariable` / `generateFontsCss` (`src/core/fonts`).
   - Utility classes: `generateFrameworkUtilityClasses` → reconciled into `site.styleRules` by `reconcileFrameworkClasses`.

2. **`var(--token)` already resolves — discovery is the only gap.** The framework `:root` block + `@font-face`/font vars are injected into **both** the canvas (`ClassStyleInjector` → `generateCanvasClassCSS`) and published output (`server/.../frameworkCss.ts`). So an agent-authored `<style>` referencing `var(--primary)` renders correctly today. The agent simply has no idea the variables exist.

3. **The agent snapshot is a single funnel.** `buildPageContext` (`src/admin/pages/site/agent/pageContext.ts`) → `PageContext`/`SiteSnapshot`. It currently emits `nodes`, `availableModules`, `breakpoints`, `classes`, `pages` — and **zero token data**. Adding a `tokens` section is one localized extension.

4. **Generated utility classes leak in, unlabeled.** Because they live in `styleRules`, framework classes (`text-primary`, `text-m`, `space-l`) already appear in snapshot `classes[]` — but `ClassInfo` strips the `StyleRule.generated` metadata, so the agent can't tell a locked token class from an ad-hoc one, and nothing tells it to prefer them.

5. **Clean write surface already exists.** The store exposes create/update/delete for every family:
   - Colors: `createFrameworkColorToken(input)`, `updateFrameworkColorToken(id, patch)`, `deleteFrameworkColorToken(id)` — `createFrameworkColorTokenFromInput` fills all defaults (utilities, shades/tints), so a minimal `{ name, lightValue }` is enough.
   - Scales (typography + spacing share one generic): `createGroup()`, `updateGroup(id, patch)`, `deleteGroup(id)` in `scaleGroups.ts`.
   - Fonts: `addFont(entry)`, `createFontToken(input)`, `updateFontToken(id, patch)`, `deleteFontToken(id)` in `fontActions.ts`.
   Each color/scale mutation calls `reconcileFrameworkClasses` itself, so utility classes stay in sync automatically.

### Locked decisions (from product owner)

- **Both delivery mechanisms:** an always-on compact token **digest** in the snapshot + dynamic suffix (awareness without a round-trip) **and** a `list_tokens` read tool (full detail on demand).
- **All four families** in v1: colors, typography scale, spacing scale, fonts.
- **Read + create/edit:** the agent can author new tokens and scale groups, not just consume them. Inputs must be minimal-required + flexible (lean on store defaults).
- **Generated scale classes are first-class:** the digest exposes the utility classes generated from typography/spacing scales, and the agent is told it may apply them directly.

---

## Single source of truth — `describeFrameworkTokens`

To avoid drift between *what is generated into `:root`* and *what is reported to the agent*, derive both reports from one pure function instead of re-deriving var names in `pageContext`.

**New — `src/core/framework/describe.ts`** (exported from `@core/framework`):

```ts
export interface TokenDescriptor {
  /** CSS custom property incl. leading dashes, e.g. "--primary". */
  cssVar: string
  /** var(--…) expression ready to drop into a style value. */
  ref: string
  /** Utility class names bound to this token, e.g. ["text-primary","bg-primary"]. */
  utilityClasses: string[]
  /** Human/agent-facing resolved value (light), for the digest. */
  value: string
}

export interface ColorTokenDescriptor extends TokenDescriptor {
  slug: string
  category: string
  darkValue?: string
  variants: TokenDescriptor[]   // shades / tints, each with cssVar+ref
}

export interface ScaleStepDescriptor extends TokenDescriptor {
  step: string                  // "xs","m","2xl"
}
export interface ScaleGroupDescriptor {
  id: string
  family: 'typography' | 'spacing'
  name: string
  namingConvention: string      // "text","space"
  steps: ScaleStepDescriptor[]
}

export interface FrameworkTokenDigest {
  colors: ColorTokenDescriptor[]
  typography: ScaleGroupDescriptor[]
  spacing: ScaleGroupDescriptor[]
}

export function describeFrameworkTokens(
  settings: FrameworkGenerationSettings | null | undefined,
): FrameworkTokenDigest
```

It reuses the existing color/scale variable + utility-class generators internally (the same ones `generate.ts` calls) and pairs each CSS var with the utility class(es) that target it via the `framework:<family>:…` id ↔ name map.

**New — `src/core/fonts/describe.ts`** (exported from `@core/fonts`):

```ts
export interface FontTokenDescriptor {
  name: string                  // display name
  cssVar: string                // "--font-primary"
  ref: string                   // "var(--font-primary)"
  family: string                // resolved family, e.g. "Inter"
  fallback: string              // "sans-serif"
}
export function describeFontTokens(fonts: SiteFontsSettings | null | undefined): FontTokenDescriptor[]
```

Both functions are framework-tested in isolation and consumed by the agent layer. No editor imports.

---

## Part 1 — Read: surface tokens in the snapshot

**`server/ai/tools/site/snapshot.ts`** — extend `SiteSnapshot`:

```ts
export interface SiteSnapshot {
  // …existing…
  tokens: SnapshotTokens
}
export interface SnapshotTokens {
  colors: SnapshotColorToken[]      // slug, cssVar, ref, value, darkValue?, utilityClasses, variants
  typography: SnapshotScaleGroup[]  // name, prefix, steps[{step,cssVar,ref,utilityClass}]
  spacing: SnapshotScaleGroup[]
  fonts: SnapshotFontToken[]        // name, cssVar, ref, family, fallback
}
```

**`server/ai/tools/site/snapshot.ts` — `ClassInfo`**: add `generated?: 'color' | 'typography' | 'spacing'` (the `family`, or omitted for user classes).

**`src/admin/pages/site/agent/types.ts`**: mirror the new `tokens` shape + `generated` on the class context (PageContext is the editor-side twin of SiteSnapshot).

**`src/admin/pages/site/agent/pageContext.ts`** (`buildPageContext`):
- Build `tokens` via `describeFrameworkTokens(state.site.settings.framework)` + `describeFontTokens(state.site.settings.fonts)`. Empty arrays when a family is absent.
- Forward `generated: cls.generated?.family` on each `ClassInfo`.
- Empty-state branch returns `tokens: { colors: [], typography: [], spacing: [], fonts: [] }`.

**Chat-handler boundary**: extend the snapshot validation schema (where `renderEvidence` is parsed server-side) with the `tokens` object + `generated` field so the new data is validated, not `as`-cast.

## Part 2 — Read tool: `list_tokens`

**`server/ai/tools/site/snapshotHelpers.ts`**: `listSiteTokens(snap, args?)` returning `snap.tokens`, optionally filtered by `family`. Pure, mirrors existing helpers.

**`server/ai/tools/site/readTools.ts`**: register `list_tokens` (`scope:'site'`, read). Description: "List the site's design tokens — color tokens, typography & spacing scale steps, and font tokens — each with its CSS variable (use as `var(--name)`) and the utility class(es) bound to it. Prefer these over hardcoded values."

## Part 3 — Prompt: teach token preference + digest

**`server/ai/tools/site/systemPrompt.ts`**:
- Static prefix, new short section after "Structure as HTML, styling as CSS":
  > Prefer the site's design tokens over hardcoded values. Reference a token as `var(--name)` inside a `<style>` block, or apply its utility class (e.g. `class="text-l text-primary"`). The dynamic suffix lists the palette, scales, and fonts; call `list_tokens` for full detail. Only hardcode a color/size/font when the design genuinely needs a value the system doesn't have — and prefer creating a token (`create_color_token` / `create_scale_group` / `create_font_token`) when it will be reused.
- Dynamic suffix (`buildDynamicSuffix`): append a compact digest — color slugs + primary var, each scale's prefix + step list, font names + vars. Cap length; if a family has many tokens, summarize counts and defer to `list_tokens`.

**`src/__tests__/architecture/agent-system-prompt-no-module-enumeration.test.ts`**: add markers for the new token guidance; keep the no-module-enumeration invariant (digest lists *tokens*, never modules).

## Part 4 — Write tools: create/edit tokens

Browser-execution tools (`execution:'browser'`, `mutates:true`), schemas in `writeTools.ts`, handlers in `executor.ts` mirroring `runCreateClass`. Minimal-required inputs; everything else optional (store fills defaults).

| Tool | Input (required → optional) | Store action |
|---|---|---|
| `create_color_token` | `name`, `lightValue` → `category?`, `darkValue?`, `generateShades?`, `generateTints?`, utilities? | `createFrameworkColorToken` |
| `update_color_token` | `tokenId`, `patch` | `updateFrameworkColorToken` |
| `delete_color_token` | `tokenId` | `deleteFrameworkColorToken` |
| `create_scale_group` | `family('typography'\|'spacing')` → `name?`, `namingConvention?`, `steps?`, base sizes/ratios? | `createGroup` then `updateGroup` for overrides |
| `update_scale_group` | `family`, `groupId`, `patch` | `updateGroup` |
| `delete_scale_group` | `family`, `groupId` | `deleteGroup` |
| `create_font_token` | `name`, `fallback` → `familyId?` (installed font) | `createFontToken` |
| `update_font_token` | `tokenId`, `patch` | `updateFontToken` |
| `delete_font_token` | `tokenId` | `deleteFontToken` |

Font *installation* (Google/custom upload via `addFont`) stays in the UI for v1 — the agent binds tokens to already-installed families via `familyId`, or creates fallback-only system-font tokens. (Note this limitation in the tool description.) Success payloads use explicit keys (`colorTokenId`, `scaleGroupId`, `fontTokenId`) consistent with the existing `classId`/`pageId` convention; the executor returns the created id.

**`server/ai/tools/site/index.ts`**: new write tools flow through `stampMutationFlag(siteWriteTools, true)` automatically — no change beyond adding them to the array.

## Part 5 — Tests & docs

- **`src/__tests__/architecture/agent-tool-surface.test.ts`**: add the new read+write tool names to the expected surface.
- **`src/__tests__/core/framework/describe.test.ts`** (new): `describeFrameworkTokens` pairs each var with its utility class; handles empty/partial settings. **`src/__tests__/core/fonts/describe.test.ts`** (new) for `describeFontTokens`.
- **`src/__tests__/agent/pageContext.test.ts`**: `tokens` populated from settings; `generated` flag forwarded on framework classes.
- **`src/__tests__/agent/executor.test.ts`**: each `create_*` / `update_*` / `delete_*` token tool drives the right store action and returns the id; reconcile keeps utility classes in sync (assert a generated class appears after `create_color_token`).
- **`list_tokens`** helper test in the agent read-tool suite.
- **Docs:** `docs/features/agent.md` (tool table + a "Design tokens" subsection: read via snapshot/`list_tokens`, write via the create/update tools, `var(--x)` resolves in canvas + publish). Cross-link from `docs/design.md`. Update `docs/reference/architecture-tests.md` for the new prompt markers + tool-surface entries.

---

## File Structure

**Engine — core**
- `src/core/framework/describe.ts` (new) + export in `src/core/framework/index.ts`
- `src/core/fonts/describe.ts` (new) + export in `src/core/fonts/index.ts`

**Agent — server**
- `server/ai/tools/site/snapshot.ts` (tokens types, ClassInfo.generated)
- `server/ai/tools/site/snapshotHelpers.ts` (`listSiteTokens`)
- `server/ai/tools/site/readTools.ts` (`list_tokens`)
- `server/ai/tools/site/writeTools.ts` (9 token write tools)
- `server/ai/tools/site/systemPrompt.ts` (guidance + digest)

**Agent — editor**
- `src/admin/pages/site/agent/types.ts` (token context types)
- `src/admin/pages/site/agent/pageContext.ts` (build tokens, forward generated)
- `src/admin/pages/site/agent/executor.ts` (token write handlers + schemas)
- chat-handler snapshot boundary schema (tokens validation)

**Tests + docs** as listed in Part 5.

---

## Implementation order (task-by-task)

1. [x] `describeFrameworkTokens` + `describeFontTokens` (+ barrels) and their unit tests.
2. [x] Snapshot/PageContext token types + `ClassInfo.generated`; build them in `buildPageContext`; boundary schema; pageContext test.
3. [x] `list_tokens` read tool + helper + test.
4. [ ] System-prompt guidance + suffix digest; update prompt-marker architecture test.
5. [ ] Token write tools (schemas + executor handlers) + executor tests; update agent-tool-surface test.
6. [ ] Docs (`agent.md`, `design.md`, `architecture-tests.md`).
7. [ ] Full verify: `bun run build`, `bun test`, `bun run lint`.

## Out of scope (v1)

- In-agent Google/custom **font installation** (binary upload) — agent binds to installed families only.
- Editing framework **preferences** (root font size, clamp anchors) via the agent.
- Conditional/per-breakpoint token *values* beyond what the scale model already emits.

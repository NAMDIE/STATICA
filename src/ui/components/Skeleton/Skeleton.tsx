/**
 * Skeleton primitives — the editor's loading-state vocabulary.
 *
 * Local CSS owns the shimmer animation, dimensions, and surface-token
 * colours; this file publishes the small set of named shapes the editor
 * uses so every loading region in the app reads identically.
 *
 *   • `<SkeletonBlock>` — a SINGLE three-bar shape (title / sub / fill).
 *     For confined surfaces: a widget body, a dialog body, an inline
 *     content slot. Don't use for full-page loading — use
 *     `<SkeletonCards>` instead.
 *
 *   • `<SkeletonCards count={N}>` — STACK of N card-shaped containers,
 *     each with a three-bar shape inside. Use for full-page loads
 *     (`<AdminPageLayout loading>` renders this), or anywhere a card
 *     list is about to appear. Matches the visual rhythm of the
 *     Plugins / Users / Posts pages.
 *
 *   • `<SkeletonRows count={N}>` — STACK of N thin shimmer bars.
 *     Use for list-style sidebars (Data tables list, Content
 *     collections list), table rows, and any other "list of compact
 *     items" loading.
 *
 * The host primitives (Widget, PluginCard, Dialog, AdminPageLayout)
 * each pick the appropriate shape internally — code that uses those
 * primitives only passes `loading={true}` and gets the right
 * skeleton for free.
 *
 * `<Skeleton>`, `<SkeletonText>`, `<SkeletonCircle>` at the bottom of
 * the file are bespoke escape hatches. Prefer one of the three named
 * shapes above whenever possible — they keep the editor visually
 * consistent.
 *
 * The shimmer uses `--editor-surface-3` / `--editor-surface-4` directly
 * and runs at the previous 1.4 s cadence.
 */
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@ui/cn'
import styles from './Skeleton.module.css'

type SkeletonCssProperties = CSSProperties & {
  '--skeleton-width'?: string
  '--skeleton-height'?: string
  '--skeleton-radius'?: string
}

type SkeletonBlockCssProperties = CSSProperties & {
  '--skeleton-block-min-height': string
}

function toCssLength(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === 'number' ? `${value}px` : value
}

function skeletonStyle({
  width,
  height,
  radius,
}: {
  width?: string | number
  height?: string | number
  radius?: string | number
}): SkeletonCssProperties | undefined {
  const style: SkeletonCssProperties = {}
  const cssWidth = toCssLength(width)
  const cssHeight = toCssLength(height)
  const cssRadius = toCssLength(radius)

  if (cssWidth) style['--skeleton-width'] = cssWidth
  if (cssHeight) style['--skeleton-height'] = cssHeight
  if (cssRadius) style['--skeleton-radius'] = cssRadius

  return Object.keys(style).length > 0 ? style : undefined
}

// ---------------------------------------------------------------------------
// SkeletonBlock — single three-bar shape, for one card-sized region.
// ---------------------------------------------------------------------------

export interface SkeletonBlockProps {
  /**
   * Minimum block height in px. Defaults to no minimum — the block
   * absorbs whatever vertical space the parent gives it via flex / grid.
   * Pass a value when the surrounding layout doesn't pin the height
   * (e.g. dialogs whose body height grows with content).
   */
  minHeight?: number
  /**
   * Optional className on the wrapper. Useful for layout positioning
   * (margin, gap) — the bars' shimmer paint is owned by the primitive.
   */
  className?: string
  /**
   * Optional `aria-label` for screen readers. Defaults to nothing —
   * the surrounding host (Widget, Dialog, AdminPageLayout, …) is
   * expected to announce its own `aria-busy="true"` instead.
   */
  ariaLabel?: string
}

/**
 * Universal three-bar skeleton — primary, secondary, fill. For SINGLE
 * card-sized regions; use `<SkeletonCards>` for stacked lists or
 * `<SkeletonRows>` for thin row lists.
 *
 * Each bar is one local `<span>` with the shared shimmer paint.
 */
export function SkeletonBlock({
  minHeight,
  className,
  ariaLabel,
}: SkeletonBlockProps) {
  const style: SkeletonBlockCssProperties | undefined =
    minHeight !== undefined
      ? { '--skeleton-block-min-height': `${minHeight}px` }
      : undefined
  return (
    <div
      className={cn(styles.skeletonBlock, className)}
      style={style}
      aria-label={ariaLabel}
      role={ariaLabel ? 'status' : undefined}
    >
      <Skeleton width="42%" height={22} />
      <Skeleton width="64%" height={12} />
      <Skeleton height={36} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// SkeletonCards — stack of card-shaped skeletons. For full-page lists.
// ---------------------------------------------------------------------------

export interface SkeletonCardsProps {
  /** How many cards to render. Defaults to 3. */
  count?: number
  /** Optional className on the wrapping container. */
  className?: string
  /**
   * Optional `aria-label`. Defaults to nothing — the parent surface
   * is expected to set `aria-busy="true"` itself.
   */
  ariaLabel?: string
}

/**
 * Stacked card-shaped skeletons. Each card has the same `--editor-surface-2`
 * background, padding, and radius as a real `PluginCard` or list item, so
 * full-page loading reads as "a list of cards is about to appear here"
 * rather than "the whole page is a single grey rectangle".
 *
 * `<AdminPageLayout loading>` renders this automatically. Use it
 * manually only when the page intentionally bypasses `AdminPageLayout`.
 */
export function SkeletonCards({
  count = 3,
  className,
  ariaLabel,
}: SkeletonCardsProps) {
  const cardIds = Array.from(
    { length: Math.max(1, count) },
    (_, index) => `skeleton-card-${index}`,
  )

  return (
    <div
      className={cn(styles.skeletonCards, className)}
      aria-label={ariaLabel}
      role={ariaLabel ? 'status' : undefined}
    >
      {cardIds.map((cardId) => (
        <div key={cardId} className={styles.skeletonCard}>
          <SkeletonBlock />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SkeletonRows — stack of thin shimmer rows. For list sidebars + tables.
// ---------------------------------------------------------------------------

export interface SkeletonRowsProps {
  /** How many rows to render. Defaults to 6. */
  count?: number
  /** Optional row height (px). Defaults to 24, matching typical list-row text height. */
  rowHeight?: number
  /** Optional className on the wrapping container. */
  className?: string
  /**
   * Optional `aria-label`. Defaults to nothing — the parent surface
   * is expected to set `aria-busy="true"` itself.
   */
  ariaLabel?: string
}

/**
 * Stacked thin shimmer rows — for list-style sidebars (Data tables
 * list, Content collections list), table rows, and any other
 * "list of compact items" surface.
 */
export function SkeletonRows({
  count = 6,
  rowHeight = 24,
  className,
  ariaLabel,
}: SkeletonRowsProps) {
  const rowIds = Array.from(
    { length: Math.max(1, count) },
    (_, index) => `skeleton-row-${index}`,
  )

  return (
    <div
      className={cn(styles.skeletonRows, className)}
      aria-label={ariaLabel}
      role={ariaLabel ? 'status' : undefined}
    >
      {rowIds.map((rowId) => (
        <Skeleton key={rowId} height={rowHeight} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Low-level primitives — for bespoke cases the three named shapes can't cover.
// ---------------------------------------------------------------------------

export interface SkeletonProps {
  /** Width — any CSS length. `'100%'` to fill the parent. */
  width?: string | number
  /** Height — any CSS length. Defaults to `'1em'` (matches surrounding text). */
  height?: string | number
  /**
   * Border radius. Defaults to `--editor-radius-sm`. Pass
   * `'50%'` for a circular slot (or use `SkeletonCircle`).
   */
  radius?: string | number
  /** Optional className escape hatch (layout positioning, margin, etc.). */
  className?: string
  /**
   * `aria-label` for screen readers. Defaults to nothing — skeletons
   * carry no semantic content; the surrounding wrapper should announce
   * its own `aria-busy="true"` instead.
   */
  ariaLabel?: string
}

export function Skeleton({
  width,
  height,
  radius,
  className,
  ariaLabel,
}: SkeletonProps): ReactNode {
  return (
    <span
      className={cn(styles.skeleton, className)}
      style={skeletonStyle({ width, height, radius })}
      role={ariaLabel ? 'status' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    />
  )
}

export interface SkeletonTextProps {
  /** Number of lines to render. Defaults to 3. */
  lines?: number
  /** Optional className for the wrapping container. */
  className?: string
  /** Per-line height (any CSS length). Defaults to `'0.9em'`. */
  lineHeight?: string | number
}

/**
 * Stacked text skeleton — N lines, last line narrower so the group
 * reads as a paragraph.
 */
export function SkeletonText({
  lines = 3,
  className,
  lineHeight = '0.9em',
}: SkeletonTextProps): ReactNode {
  const safeLines = Math.max(1, lines)
  const lineIds = Array.from(
    { length: safeLines },
    (_, index) => `skeleton-line-${index}`,
  )

  return (
    <div className={cn(styles.textGroup, className)}>
      {lineIds.map((lineId, index) => (
        <Skeleton
          key={lineId}
          width={safeLines > 1 && index === safeLines - 1 ? '72%' : undefined}
          height={lineHeight}
        />
      ))}
    </div>
  )
}

export interface SkeletonCircleProps {
  /** Diameter in px (sets both width and height). */
  size: number
  /** Optional className escape hatch. */
  className?: string
}

/**
 * Circular skeleton — for avatars, plug-status dots, image thumbnails
 * intended to read as round.
 */
export function SkeletonCircle({ size, className }: SkeletonCircleProps): ReactNode {
  return (
    <Skeleton width={size} height={size} radius="50%" className={className} />
  )
}

/**
 * pillAccent — deterministic accent token for tinted pills.
 *
 * Picks one of four rail-tint accents from a stable hash of the input string
 * so the same name always renders in the same tint across editor and admin
 * surfaces. Purely presentational; the accent has no semantic meaning.
 */

export type PillAccent = 'mint' | 'lilac' | 'sky' | 'peach'

const PILL_ACCENTS: readonly PillAccent[] = ['mint', 'lilac', 'sky', 'peach']

export function pillAccent(name: string): PillAccent {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(h, 31) + name.charCodeAt(i)) | 0
  }
  return PILL_ACCENTS[Math.abs(h) % PILL_ACCENTS.length]!
}

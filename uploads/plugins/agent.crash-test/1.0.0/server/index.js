
import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
const MARKER = "/Users/davidbabinec/Documents/Projekty/page-builder/.tmp/crash-test-marker.log"
const COUNTER = "/Users/davidbabinec/Documents/Projekty/page-builder/.tmp/crash-test-counter"

function readCounter() {
  if (!existsSync(COUNTER)) return 0
  return parseInt(readFileSync(COUNTER, 'utf-8'), 10) || 0
}
function writeCounter(n) {
  writeFileSync(COUNTER, String(n))
}

export function activate() {
  const next = readCounter() + 1
  writeCounter(next)
  appendFileSync(MARKER, 'activate#' + next + '\n')
  // Always crash on activate. Each activate is followed by a worker
  // crash; the host's recovery code respawns up to the threshold.
  setTimeout(() => {
    throw new Error('intentional worker crash from activate#' + next)
  }, 50)
}

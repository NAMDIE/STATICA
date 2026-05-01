import { nanoid } from 'nanoid'
import type { ContentBlock } from './types'

const HEADING_RE = /^(#{1,6})\s+(.+)$/
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/
const VIDEO_RE = /^@\[video\]\(([^)]+)\)$/

function blockId(): string {
  return `block_${nanoid(8)}`
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function createParagraphBlock(text = ''): ContentBlock {
  return { id: blockId(), type: 'paragraph', text }
}

export function createHeadingBlock(text = 'Heading', level: 1 | 2 | 3 | 4 | 5 | 6 = 2): ContentBlock {
  return { id: blockId(), type: 'heading', level, text }
}

export function createImageBlock(src: string, alt = ''): ContentBlock {
  return { id: blockId(), type: 'image', src, alt }
}

export function createVideoBlock(src: string): ContentBlock {
  return { id: blockId(), type: 'video', src }
}

export function serializeMarkdownBlocks(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'heading':
          return `${'#'.repeat(block.level)} ${block.text.trim()}`
        case 'paragraph':
          return block.text.trim()
        case 'image':
          return `![${block.alt.trim()}](${block.src.trim()})`
        case 'video':
          return `@[video](${block.src.trim()})`
      }
    })
    .filter((line) => line.length > 0)
    .join('\n\n')
}

export function parseMarkdownBlocks(markdown: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const paragraphLines: string[] = []

  function flushParagraph() {
    const text = normalizeText(paragraphLines.join(' '))
    paragraphLines.length = 0
    if (text) blocks.push(createParagraphBlock(text))
  }

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      continue
    }

    const image = line.match(IMAGE_RE)
    if (image) {
      flushParagraph()
      blocks.push(createImageBlock(image[2].trim(), image[1].trim()))
      continue
    }

    const video = line.match(VIDEO_RE)
    if (video) {
      flushParagraph()
      blocks.push(createVideoBlock(video[1].trim()))
      continue
    }

    const heading = line.match(HEADING_RE)
    if (heading) {
      flushParagraph()
      blocks.push(createHeadingBlock(heading[2].trim(), heading[1].length as 1 | 2 | 3 | 4 | 5 | 6))
      continue
    }

    paragraphLines.push(line)
  }

  flushParagraph()
  return blocks.length > 0 ? blocks : [createParagraphBlock()]
}

export function autoformatMarkdownShortcut(block: ContentBlock): ContentBlock {
  if (block.type !== 'paragraph') return block

  const heading = block.text.match(HEADING_RE)
  if (heading) {
    return {
      id: block.id,
      type: 'heading',
      level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
      text: heading[2].trim(),
    }
  }

  return block
}

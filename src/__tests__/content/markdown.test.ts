import { describe, expect, it } from 'bun:test'
import {
  autoformatMarkdownShortcut,
  parseMarkdownBlocks,
  serializeMarkdownBlocks,
} from '../../content/markdown'

describe('content Markdown model', () => {
  it('serializes rich blocks to Markdown source', () => {
    expect(serializeMarkdownBlocks([
      { id: 'b1', type: 'heading', level: 2, text: 'Intro' },
      { id: 'b2', type: 'paragraph', text: 'A paragraph.' },
      { id: 'b3', type: 'image', src: '/uploads/hero.png', alt: 'Hero' },
      { id: 'b4', type: 'video', src: '/uploads/movie.mp4' },
    ])).toBe([
      '## Intro',
      '',
      'A paragraph.',
      '',
      '![Hero](/uploads/hero.png)',
      '',
      '@[video](/uploads/movie.mp4)',
    ].join('\n'))
  })

  it('parses saved Markdown back into rich blocks', () => {
    expect(parseMarkdownBlocks([
      '# Title',
      '',
      'Body text.',
      '',
      '![Alt](/uploads/asset.png)',
      '',
      '@[video](/uploads/clip.mp4)',
    ].join('\n'))).toMatchObject([
      { type: 'heading', level: 1, text: 'Title' },
      { type: 'paragraph', text: 'Body text.' },
      { type: 'image', src: '/uploads/asset.png', alt: 'Alt' },
      { type: 'video', src: '/uploads/clip.mp4' },
    ])
  })

  it('autoformats Markdown heading shortcuts typed into a paragraph', () => {
    expect(autoformatMarkdownShortcut({
      id: 'b1',
      type: 'paragraph',
      text: '## Heading',
    })).toMatchObject({
      type: 'heading',
      level: 2,
      text: 'Heading',
    })
  })

  it('keeps plain paragraphs that are not supported shortcuts', () => {
    const block = { id: 'b1', type: 'paragraph' as const, text: 'Regular paragraph' }
    expect(autoformatMarkdownShortcut(block)).toEqual(block)
  })
})

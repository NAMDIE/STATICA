import type { FormEvent, KeyboardEvent } from 'react'
import { autoformatMarkdownShortcut, createParagraphBlock } from './markdown'
import type { ContentBlock } from './types'
import styles from './RichMarkdownEditor.module.css'

interface RichMarkdownEditorProps {
  blocks: ContentBlock[]
  onChange: (blocks: ContentBlock[]) => void
}

export function RichMarkdownEditor({ blocks, onChange }: RichMarkdownEditorProps) {
  function updateBlock(index: number, patch: ContentBlock) {
    const next = [...blocks]
    next[index] = autoformatMarkdownShortcut(patch)
    onChange(next)
  }

  function insertParagraphAfter(index: number) {
    const next = [...blocks]
    next.splice(index + 1, 0, createParagraphBlock())
    onChange(next)
  }

  function handleTextKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    insertParagraphAfter(index)
  }

  return (
    <div className={styles.editor} aria-label="Post body">
      {blocks.map((block, index) => {
        if (block.type === 'image') {
          return (
            <figure key={block.id} className={styles.mediaBlock}>
              <img src={block.src} alt={block.alt} />
              <figcaption>{block.alt || block.src}</figcaption>
            </figure>
          )
        }

        if (block.type === 'video') {
          return (
            <figure key={block.id} className={styles.mediaBlock}>
              <video controls src={block.src} />
              <figcaption>{block.src}</figcaption>
            </figure>
          )
        }

        const commonProps = {
          contentEditable: true,
          suppressContentEditableWarning: true,
          'data-testid': `content-block-${index}`,
          'data-placeholder': block.type === 'heading' ? 'Heading' : 'Write something...',
          onInput: (event: FormEvent<HTMLElement>) => {
            updateBlock(index, { ...block, text: event.currentTarget.textContent ?? '' })
          },
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => handleTextKeyDown(event, index),
        }

        if (block.type === 'heading') {
          const HeadingTag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
          return (
            <HeadingTag key={block.id} className={styles.headingBlock} {...commonProps}>
              {block.text}
            </HeadingTag>
          )
        }

        return (
          <p key={block.id} className={styles.paragraphBlock} {...commonProps}>
            {block.text}
          </p>
        )
      })}
    </div>
  )
}

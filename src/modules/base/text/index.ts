/**
 * base.text — unified semantic text module.
 *
 * Content and semantic tag are module settings; visual typography belongs to
 * class styles. Emits a bare semantic element with no default class or CSS.
 */
import type { ModuleDefinition } from '@core/module-engine/types'
import { registry } from '@core/module-engine/registry'
import { TextStartTIcon } from 'pixel-art-icons/icons/text-start-t'
import { Type, Value, type Static } from '@core/utils/typeboxHelpers'
import { TextEditor } from './TextEditor'

const TextPropsSchema = Type.Object({
  text: Type.String({ default: 'Add your text here.' }),
  tag: Type.Union(
    [
      Type.Literal('p'),
      Type.Literal('h1'),
      Type.Literal('h2'),
      Type.Literal('h3'),
      Type.Literal('h4'),
      Type.Literal('h5'),
      Type.Literal('h6'),
      Type.Literal('span'),
      Type.Literal('div'),
      Type.Literal('small'),
      Type.Literal('strong'),
      Type.Literal('em'),
    ],
    { default: 'p' },
  ),
})

type TextProps = Static<typeof TextPropsSchema>
type TextTag = TextProps['tag']

const TEXT_TAGS = new Set<TextTag>([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'div',
  'small',
  'strong',
  'em',
])

function normalizeTag(tag: unknown): TextTag {
  const value = String(tag || 'p').toLowerCase() as TextTag
  return TEXT_TAGS.has(value) ? value : 'p'
}

export const TextModule: ModuleDefinition<TextProps> = {
  id: 'base.text',
  name: 'Text',
  description: 'A semantic text element.',
  category: 'Typography',
  version: '2.0.0',
  icon: TextStartTIcon,
  trusted: true,
  canHaveChildren: false,

  schema: {
    text: { type: 'textarea', label: 'Text', rows: 4, placeholder: 'Enter text...' },
    // `tag` is a `select`, which defaults to category: 'layout' by the
    // type-based heuristic. Override to 'content' — a copy editor changing
    // a heading from h2 to h3 is editorial, not structural.
    tag: {
      type: 'select',
      label: 'Tag',
      category: 'content',
      options: [
        { label: 'Paragraph', value: 'p' },
        { label: 'Heading 1', value: 'h1' },
        { label: 'Heading 2', value: 'h2' },
        { label: 'Heading 3', value: 'h3' },
        { label: 'Heading 4', value: 'h4' },
        { label: 'Heading 5', value: 'h5' },
        { label: 'Heading 6', value: 'h6' },
        { label: 'Span', value: 'span' },
        { label: 'Div', value: 'div' },
        { label: 'Small', value: 'small' },
        { label: 'Strong', value: 'strong' },
        { label: 'Emphasis', value: 'em' },
      ],
    },
  },

  propsSchema: TextPropsSchema,

  defaults: Value.Create(TextPropsSchema),

  component: TextEditor,

  htmlTag: (props) => normalizeTag(props.tag),

  render: (props) => {
    const tag = normalizeTag(props.tag)
    return {
      html: `<${tag}>${String(props.text)}</${tag}>`,
    }
  },
}

registry.registerOrReplace(TextModule)

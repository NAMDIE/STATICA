/**
 * base.content — renders the current CMS entry body.
 *
 * Emits a bare `<article>` wrapper around the entry's HTML, with no default
 * class or default CSS. Visual styling is opt-in via user classes
 * (mcClassName / multi-class system).
 */
import type { ModuleDefinition } from '@core/module-engine/types'
import { registry } from '@core/module-engine/registry'
import { Type, Value, type Static } from '@core/utils/typeboxHelpers'
import { ArticleSolidIcon } from 'pixel-art-icons/icons/article-solid'
import { ContentEditor } from './ContentEditor'

const ContentPropsSchema = Type.Object({
  html: Type.String({ default: '' }),
})

type ContentProps = Static<typeof ContentPropsSchema>

export const ContentModule: ModuleDefinition<ContentProps> = {
  id: 'base.content',
  name: 'Content Body',
  description: 'Renders the current CMS entry body.',
  category: 'CMS',
  version: '1.0.0',
  icon: ArticleSolidIcon,
  trusted: true,
  canHaveChildren: false,

  schema: {
    html: { type: 'richtext', label: 'HTML' },
  },

  propsSchema: ContentPropsSchema,
  defaults: Value.Create(ContentPropsSchema) as ContentProps,

  component: ContentEditor,

  htmlTag: 'article',

  render: (props) => {
    const html = typeof props.html === 'string' ? props.html : ''
    // The `data-pb-content-region` marker is what the Content
    // workspace's Live mode looks for inside the rendered iframe so
    // it can mount a Tiptap editor against the real entry body. It is
    // emitted unconditionally (even when the body is empty) so that
    // an empty draft still gives the editor a node to attach to.
    if (!html) return { html: '<article data-pb-content-region></article>' }
    return {
      html: `<article data-pb-content-region>${html}</article>`,
    }
  },
}

registry.registerOrReplace(ContentModule)

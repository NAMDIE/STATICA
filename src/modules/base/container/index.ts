/**
 * base.container — semantic wrapper.
 *
 * Emits the chosen semantic tag with no default class or default CSS.
 * Visual styling is opt-in via user classes (mcClassName / multi-class system).
 *
 * Tag selection is shared with `base.loop` via `@modules/base/utils/htmlTag`:
 * built-in layout/list tags plus a 'custom' escape hatch (free-form `customTag`
 * text input) so authors can render any valid HTML element name.
 */
import type { ModuleDefinition } from '@core/module-engine/types'
import { registry } from '@core/module-engine/registry'
import { SquareSolidIcon } from 'pixel-art-icons/icons/square-solid'
import {
  customHtmlTagControl,
  htmlTagControl,
  resolveHtmlTag,
} from '@modules/base/utils/htmlTag'
import { Type, Value, type Static } from '@core/utils/typeboxHelpers'
import { ContainerEditor } from './ContainerEditor'

const ContainerPropsSchema = Type.Object({
  tag: Type.String({ default: 'div' }),
  customTag: Type.String({ default: '' }),
})

type ContainerProps = Static<typeof ContainerPropsSchema>

export const ContainerModule: ModuleDefinition<ContainerProps> = {
  id: 'base.container',
  name: 'Container',
  description: 'A semantic container.',
  category: 'Layout',
  version: '2.0.0',
  icon: SquareSolidIcon,
  trusted: true,
  canHaveChildren: true,

  schema: {
    tag: htmlTagControl(),
    customTag: customHtmlTagControl(),
  },

  propsSchema: ContainerPropsSchema,

  defaults: Value.Create(ContainerPropsSchema),

  component: ContainerEditor,

  htmlTag: (props) => resolveHtmlTag(props.tag, props.customTag),

  render: (props, renderedChildren) => {
    const tag = resolveHtmlTag(props.tag, props.customTag)
    return {
      html: `<${tag}>${renderedChildren.join('')}</${tag}>`,
    }
  },
}

registry.registerOrReplace(ContainerModule)

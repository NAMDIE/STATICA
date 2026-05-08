/**
 * Showcase plugin — canvas module pack.
 *
 * Default-exports an array of `PluginModuleDefinition` objects (or, as
 * shown here, a function that returns one). The host registers each as a
 * full canvas module, with the editor preview and publisher render() going
 * through the same `render()` you write here.
 */

function escape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default ({ pluginId }) => [
  {
    id: `${pluginId}.callout`,
    name: 'Callout',
    description: 'Boxed text with a tone color, perfect for tip/warning/info blocks.',
    category: 'Showcase',
    version: '1.0.0',
    canHaveChildren: false,
    defaults: {
      heading: 'Heads up',
      body: 'This is a Showcase callout — install the pack and add me from the module library.',
      tone: 'info',
    },
    schema: {
      heading: { type: 'text', label: 'Heading' },
      body: { type: 'textarea', label: 'Body', rows: 4 },
      tone: {
        type: 'select',
        label: 'Tone',
        options: [
          { label: 'Info (blue)', value: 'info' },
          { label: 'Warning (amber)', value: 'warning' },
          { label: 'Danger (red)', value: 'danger' },
          { label: 'Success (green)', value: 'success' },
        ],
      },
    },
    htmlTag: 'aside',
    render: (props) => {
      const tone = ['info', 'warning', 'danger', 'success'].includes(props.tone) ? props.tone : 'info'
      const palette = {
        info: '#1d4ed8',
        warning: '#d97706',
        danger: '#dc2626',
        success: '#16a34a',
      }
      const css = `
        .pb-showcase-callout{border-radius:8px;padding:14px 18px;border:1px solid ${palette[tone]};background:rgba(0,0,0,0.04);font-family:inherit;line-height:1.5;}
        .pb-showcase-callout--info{border-color:#1d4ed8;}
        .pb-showcase-callout--warning{border-color:#d97706;}
        .pb-showcase-callout--danger{border-color:#dc2626;}
        .pb-showcase-callout--success{border-color:#16a34a;}
        .pb-showcase-callout strong{display:block;margin-bottom:4px;font-size:0.95em;}
      `
      const html = `<aside class="pb-showcase-callout pb-showcase-callout--${tone}"><strong>${escape(props.heading)}</strong>${escape(props.body)}</aside>`
      return { html, css }
    },
  },
  {
    id: `${pluginId}.event-counter`,
    name: 'Event Counter',
    description: 'Renders a placeholder count badge — wired by the showcase frontend tracker bundle on the live page.',
    category: 'Showcase',
    version: '1.0.0',
    defaults: {
      label: 'Tracked events',
      eventName: 'page-view',
    },
    schema: {
      label: { type: 'text', label: 'Label' },
      eventName: { type: 'text', label: 'Event to count' },
    },
    htmlTag: 'div',
    render: (props) => {
      const css = `
        .pb-showcase-counter{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:#111;color:#fff;font-family:ui-monospace,monospace;font-size:0.85rem;}
        .pb-showcase-counter span{color:#9ca3af;}
        .pb-showcase-counter strong{color:#fff;}
      `
      const html = `<div class="pb-showcase-counter" data-pb-counter="${escape(props.eventName)}"><span>${escape(props.label)}</span><strong data-pb-counter-value>0</strong></div>`
      return { html, css }
    },
  },
]

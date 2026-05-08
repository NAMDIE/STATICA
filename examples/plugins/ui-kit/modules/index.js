/**
 * Modern UI Kit — canvas module pack.
 *
 * Four reusable, opinionated modules for landing pages and marketing sites.
 * Each render() emits semantic HTML and ships its own scoped CSS, so the
 * publisher dedupes the styles and visitors get clean markup.
 */

function escape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeUrl(url) {
  const value = String(url ?? '')
  if (/^javascript:/i.test(value) || /^vbscript:/i.test(value)) return '#'
  return value
}

const SHARED_CSS = `
  .uikit-card{background:var(--uikit-card-bg,#fff);color:var(--uikit-card-fg,#0f172a);border:1px solid var(--uikit-card-border,#e5e7eb);border-radius:12px;padding:24px;font-family:inherit;line-height:1.55;}
  .uikit-stat{display:grid;gap:6px;font-family:inherit;}
  .uikit-stat__value{font-size:clamp(2rem,4vw,3rem);font-weight:700;line-height:1;color:var(--uikit-accent,#1d4ed8);}
  .uikit-stat__label{font-size:0.95rem;color:var(--uikit-muted,#64748b);}
  .uikit-feature{display:grid;gap:10px;font-family:inherit;}
  .uikit-feature__icon{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:10px;background:var(--uikit-accent-soft,#dbeafe);color:var(--uikit-accent,#1d4ed8);font-size:22px;}
  .uikit-feature__title{margin:0;font-size:1.1rem;font-weight:600;}
  .uikit-feature__body{margin:0;color:var(--uikit-muted,#475569);}
  .uikit-pricing{display:grid;gap:16px;padding:28px 24px;border-radius:14px;border:1px solid var(--uikit-card-border,#e5e7eb);background:var(--uikit-card-bg,#fff);font-family:inherit;}
  .uikit-pricing--featured{border-color:var(--uikit-accent,#1d4ed8);box-shadow:0 12px 32px rgba(29,78,216,0.15);}
  .uikit-pricing__name{margin:0;font-size:1.1rem;font-weight:600;color:var(--uikit-muted,#475569);}
  .uikit-pricing__price{display:flex;align-items:baseline;gap:6px;}
  .uikit-pricing__price strong{font-size:2.4rem;font-weight:700;color:var(--uikit-card-fg,#0f172a);line-height:1;}
  .uikit-pricing__price span{color:var(--uikit-muted,#64748b);}
  .uikit-pricing__features{margin:0;padding:0;list-style:none;display:grid;gap:6px;color:var(--uikit-card-fg,#0f172a);}
  .uikit-pricing__features li{padding-left:22px;position:relative;}
  .uikit-pricing__features li::before{content:"✓";position:absolute;left:0;color:var(--uikit-accent,#1d4ed8);font-weight:700;}
  .uikit-pricing__cta{display:inline-block;margin-top:8px;padding:10px 18px;border-radius:8px;background:var(--uikit-accent,#1d4ed8);color:#fff;text-decoration:none;font-weight:600;text-align:center;}
  .uikit-pricing--featured .uikit-pricing__cta{background:var(--uikit-card-fg,#0f172a);}
  .uikit-testimonial{display:grid;gap:14px;padding:24px;border-radius:12px;background:var(--uikit-quote-bg,#f8fafc);font-family:inherit;}
  .uikit-testimonial__quote{margin:0;font-size:1.05rem;line-height:1.6;color:var(--uikit-card-fg,#0f172a);}
  .uikit-testimonial__author{display:flex;flex-direction:column;}
  .uikit-testimonial__author strong{font-size:0.95rem;color:var(--uikit-card-fg,#0f172a);}
  .uikit-testimonial__author span{font-size:0.85rem;color:var(--uikit-muted,#64748b);}
`

export default ({ pluginId }) => [
  {
    id: `${pluginId}.feature-card`,
    name: 'Feature Card',
    description: 'Icon + title + body block. Stack three of them in a Container for a feature row.',
    category: 'UI Kit',
    version: '1.0.0',
    canHaveChildren: false,
    htmlTag: 'div',
    defaults: {
      icon: '⚡',
      title: 'Fast by default',
      body: 'Built for performance — clean HTML, deduped CSS, no client runtime.',
    },
    schema: {
      icon: { type: 'text', label: 'Icon (emoji or symbol)' },
      title: { type: 'text', label: 'Title' },
      body: { type: 'textarea', label: 'Body', rows: 3 },
    },
    render: (props) => {
      const html = `<div class="uikit-feature"><span class="uikit-feature__icon" aria-hidden="true">${escape(props.icon)}</span><h3 class="uikit-feature__title">${escape(props.title)}</h3><p class="uikit-feature__body">${escape(props.body)}</p></div>`
      return { html, css: SHARED_CSS }
    },
  },
  {
    id: `${pluginId}.stat`,
    name: 'Stat Block',
    description: 'Large number + supporting label. Use in a Container row for at-a-glance metrics.',
    category: 'UI Kit',
    version: '1.0.0',
    canHaveChildren: false,
    htmlTag: 'div',
    defaults: {
      value: '99.9%',
      label: 'Uptime measured across our edge network',
    },
    schema: {
      value: { type: 'text', label: 'Value' },
      label: { type: 'text', label: 'Label' },
    },
    render: (props) => {
      const html = `<div class="uikit-stat"><div class="uikit-stat__value">${escape(props.value)}</div><div class="uikit-stat__label">${escape(props.label)}</div></div>`
      return { html, css: SHARED_CSS }
    },
  },
  {
    id: `${pluginId}.pricing-tier`,
    name: 'Pricing Tier',
    description: 'Single pricing card with name, price, feature list, and a CTA link. Mark "featured" for the highlighted tier.',
    category: 'UI Kit',
    version: '1.0.0',
    canHaveChildren: false,
    htmlTag: 'div',
    defaults: {
      name: 'Pro',
      price: '$29',
      cadence: '/ month',
      features: 'Unlimited pages\\nCustom domain\\nPriority support',
      ctaLabel: 'Start free trial',
      ctaHref: '#signup',
      featured: false,
    },
    schema: {
      name: { type: 'text', label: 'Tier name' },
      price: { type: 'text', label: 'Price' },
      cadence: { type: 'text', label: 'Cadence (e.g. /mo)' },
      features: { type: 'textarea', label: 'Features (one per line)', rows: 4 },
      ctaLabel: { type: 'text', label: 'CTA label' },
      ctaHref: { type: 'url', label: 'CTA href' },
      featured: { type: 'toggle', label: 'Highlight as featured' },
    },
    render: (props) => {
      const features = String(props.features || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<li>${escape(line)}</li>`)
        .join('')
      const featured = props.featured ? ' uikit-pricing--featured' : ''
      const html = `<div class="uikit-pricing${featured}"><h3 class="uikit-pricing__name">${escape(props.name)}</h3><div class="uikit-pricing__price"><strong>${escape(props.price)}</strong><span>${escape(props.cadence)}</span></div><ul class="uikit-pricing__features">${features}</ul><a class="uikit-pricing__cta" href="${escape(safeUrl(props.ctaHref))}">${escape(props.ctaLabel)}</a></div>`
      return { html, css: SHARED_CSS }
    },
  },
  {
    id: `${pluginId}.testimonial`,
    name: 'Testimonial',
    description: 'Customer quote with attribution. Drop into a card or onto its own background.',
    category: 'UI Kit',
    version: '1.0.0',
    canHaveChildren: false,
    htmlTag: 'figure',
    defaults: {
      quote: 'Page Builder is the first CMS we adopted that didn\'t fight us.',
      author: 'Alex Morgan',
      role: 'Head of Design, Acme Inc.',
    },
    schema: {
      quote: { type: 'textarea', label: 'Quote', rows: 3 },
      author: { type: 'text', label: 'Author name' },
      role: { type: 'text', label: 'Author role' },
    },
    render: (props) => {
      const html = `<figure class="uikit-testimonial"><blockquote class="uikit-testimonial__quote">“${escape(props.quote)}”</blockquote><figcaption class="uikit-testimonial__author"><strong>${escape(props.author)}</strong><span>${escape(props.role)}</span></figcaption></figure>`
      return { html, css: SHARED_CSS }
    },
  },
]

/**
 * Showcase plugin — frontend bundle.
 *
 * Loaded on every published page (frontend.scripts permission). Hooks into
 * the host tracker runtime (`window.__pb`) to count events and update any
 * `<div data-pb-counter>` modules placed on the page by the canvas module
 * `acme.showcase.event-counter`.
 */

(function init() {
  const pb = window.__pb
  if (!pb || !pb.tracker) {
    console.warn('[acme.showcase] page runtime not available')
    return
  }

  const counts = new Map()

  function bumpCounter(eventName) {
    const next = (counts.get(eventName) || 0) + 1
    counts.set(eventName, next)
    document.querySelectorAll(`[data-pb-counter="${CSS.escape(eventName)}"] [data-pb-counter-value]`).forEach((el) => {
      el.textContent = String(next)
    })
  }

  pb.hooks.on('page-view', (detail) => {
    bumpCounter('page-view')
    pb.tracker.sendFor('acme.showcase', 'page-view', {
      path: detail.path,
      title: detail.title,
    })
  })

  pb.hooks.on('link-click', (detail) => {
    bumpCounter('link-click')
    pb.tracker.sendFor('acme.showcase', 'link-click', {
      href: detail.href,
      text: detail.text,
    })
  })

  pb.hooks.on('scroll-depth', (detail) => {
    bumpCounter('scroll-depth')
    pb.tracker.sendFor('acme.showcase', 'scroll-depth', detail)
  })
})()

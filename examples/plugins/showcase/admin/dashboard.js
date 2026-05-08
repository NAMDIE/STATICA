/**
 * Showcase plugin — admin dashboard.
 *
 * Renders aggregate tracker counts via the plugin server route, and
 * surfaces a "Clear events" action backed by the plugin storage API.
 */

export async function render({ root, api }) {
  root.replaceChildren()

  const shell = document.createElement('section')
  shell.style.display = 'grid'
  shell.style.gap = '12px'
  shell.style.fontFamily = 'inherit'

  const heading = document.createElement('h2')
  heading.textContent = 'Showcase'
  heading.style.margin = '0'
  shell.appendChild(heading)

  const intro = document.createElement('p')
  intro.textContent =
    'This panel is the plugin SDK end-to-end test. Open a published page in another tab; events fire automatically and arrive here in real time.'
  intro.style.opacity = '0.7'
  intro.style.margin = '0'
  shell.appendChild(intro)

  const summary = document.createElement('pre')
  summary.style.background = 'rgba(255,255,255,0.05)'
  summary.style.border = '1px solid rgba(255,255,255,0.1)'
  summary.style.borderRadius = '6px'
  summary.style.padding = '12px'
  summary.textContent = 'Loading status...'
  shell.appendChild(summary)

  const buttonRow = document.createElement('div')
  buttonRow.style.display = 'flex'
  buttonRow.style.gap = '8px'

  const refresh = document.createElement('button')
  refresh.textContent = 'Refresh'
  refresh.style.padding = '6px 12px'
  buttonRow.appendChild(refresh)

  const clear = document.createElement('button')
  clear.textContent = 'Clear events'
  clear.style.padding = '6px 12px'
  buttonRow.appendChild(clear)

  shell.appendChild(buttonRow)
  root.appendChild(shell)

  async function refreshStatus() {
    summary.textContent = 'Loading status...'
    try {
      const res = await api.cms.routes.fetch('status')
      const body = await res.json()
      summary.textContent = JSON.stringify(body, null, 2)
    } catch (err) {
      summary.textContent = String(err && err.message ? err.message : err)
    }
  }

  refresh.addEventListener('click', () => {
    void refreshStatus()
  })

  clear.addEventListener('click', async () => {
    try {
      await api.cms.routes.fetch('clear', { method: 'POST' })
      await refreshStatus()
    } catch (err) {
      summary.textContent = String(err && err.message ? err.message : err)
    }
  })

  void refreshStatus()
}

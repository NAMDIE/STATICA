/**
 * Showcase plugin — editor entrypoint.
 *
 * Adds a toolbar button that triggers a no-op command, used to verify the
 * editor side of the SDK loads and the plugin runtime fans the click out.
 */

export function activate(api) {
  api.editor.commands.register({
    id: 'acme.showcase.ping',
    label: 'Showcase Ping',
    run: () => ({ message: 'Showcase command fired' }),
  })

  api.editor.toolbar.addButton({
    id: 'acme.showcase.ping',
    label: 'Showcase',
    command: 'acme.showcase.ping',
  })
}

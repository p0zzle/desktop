import { ipcRenderer } from 'electron'
import { ExecutableMenuItem } from '../models/app-menu'
import { MenuIDs } from '../models/menu-ids'
import { IMenuItemState } from '../lib/menu-update'
import { IMenuItem, ISerializableMenuItem } from '../lib/menu-item'
import { MenuLabelsEvent } from '../models/menu-labels'

/** Set the menu item's enabledness. */
export function updateMenuState(
  state: Array<{ id: MenuIDs; state: IMenuItemState }>
) {
  ipcRenderer.send('update-menu-state', state)
}

/** Tell the main process that the renderer is ready. */
export function sendReady(time: number) {
  ipcRenderer.send('renderer-ready', time)
}

/** Tell the main process to execute (i.e. simulate a click of) the menu item. */
export function executeMenuItem(item: ExecutableMenuItem) {
  ipcRenderer.send('execute-menu-item', { id: item.id })
}

/** Tell the main process to execute (i.e. simulate a click of) the menu item. */
export function executeMenuItemById(id: MenuIDs) {
  ipcRenderer.send('execute-menu-item', { id })
}

/**
 * Show the OS-provided certificate trust dialog for the certificate, using the
 * given message.
 */
export function showCertificateTrustDialog(
  certificate: Electron.Certificate,
  message: string
) {
  ipcRenderer.send('show-certificate-trust-dialog', { certificate, message })
}

/**
 * Tell the main process that we're going to quit. This means it should allow
 * the window to close.
 *
 * This event is sent synchronously to avoid any races with subsequent calls
 * that would tell the app to quit.
 */
export function sendWillQuitSync() {
  // eslint-disable-next-line no-sync
  ipcRenderer.sendSync('will-quit')
}

/**
 * Ask the main-process to send over a copy of the application menu.
 * The response will be send as a separate event with the name 'app-menu' and
 * will be received by the dispatcher.
 */
export function getAppMenu() {
  ipcRenderer.send('get-app-menu')
}

function findSubmenuItem(
  currentContextualMenuItems: ReadonlyArray<IMenuItem>,
  indices: ReadonlyArray<number>
): IMenuItem | undefined {
  let foundMenuItem: IMenuItem | undefined = {
    submenu: currentContextualMenuItems,
  }

  // Traverse the submenus of the context menu until we find the appropriate index.
  for (const index of indices) {
    if (foundMenuItem === undefined || foundMenuItem.submenu === undefined) {
      return undefined
    }

    foundMenuItem = foundMenuItem.submenu[index]
  }

  return foundMenuItem
}

/** Show the given menu items in a contextual menu. */
export async function showContextualMenu(items: ReadonlyArray<IMenuItem>) {
  const indices: ReadonlyArray<number> | null = await ipcRenderer.invoke(
    'show-contextual-menu',
    serializeMenuItems(items)
  )

  if (indices !== null) {
    const menuItem = findSubmenuItem(items, indices)

    if (menuItem !== undefined && menuItem.action !== undefined) {
      menuItem.action()
    }
  }
}

/**
 * Remove the menu items properties that can't be serializable in
 * order to pass them via IPC.
 */
function serializeMenuItems(
  items: ReadonlyArray<IMenuItem>
): ReadonlyArray<ISerializableMenuItem> {
  return items.map(item => ({
    ...item,
    action: undefined,
    submenu: item.submenu ? serializeMenuItems(item.submenu) : undefined,
  }))
}

/** Update the menu item labels with the user's preferred apps. */
export function updatePreferredAppMenuItemLabels(labels: MenuLabelsEvent) {
  ipcRenderer.send('update-preferred-app-menu-item-labels', labels)
}

function getIpcFriendlyError(error: Error) {
  return {
    message: error.message || `${error}`,
    name: error.name || `${error.name}`,
    stack: error.stack || undefined,
  }
}

export function reportUncaughtException(error: Error) {
  ipcRenderer.send('uncaught-exception', getIpcFriendlyError(error))
}

export function sendErrorReport(
  error: Error,
  extra: Record<string, string> = {},
  nonFatal?: boolean
) {
  const event = { error: getIpcFriendlyError(error), extra, nonFatal }
  ipcRenderer.send('send-error-report', event)
}

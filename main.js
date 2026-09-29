const { app, BrowserWindow, ipcMain, dialog, Notification, shell, Tray, Menu, globalShortcut } = require('electron/main')
const path = require('node:path')
const { updateElectronApp } = require('update-electron-app')
const Store = require('electron-store');
const store = new (Store.default || Store)();

let tray = null
let isQuitting = false

updateElectronApp() // Initialize the auto-updater cleanly

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1600,
    height: 1200,
    webPreferences: {
        preload: path.join(__dirname, 'preload.js')
    }
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  // Intercept the close button to minimize-to-tray instead of quitting
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
      return false
    }
  })

  return win
}

app.whenReady().then(async () => {

    ipcMain.handle('ping', () => 'pong')

    ipcMain.handle('open-external-url', async (event, url) => {
        // Optional security check: ensure it's a valid http/https URL
        if (url.startsWith('https://') || url.startsWith('http://')) {
            await shell.openExternal(url);
        }
    })

    ipcMain.handle('show-notification', (event, { title, body }) => {
        if (Notification.isSupported()) {
            new Notification({
                title: title || 'Electron Notice',
                body: body || 'Hello from your desktop app!'
            }).show()
        }
    })

    ipcMain.handle('get-preference', (event, key) => {
        return store.get(key);
    });

    ipcMain.handle('set-preference', (event, key, val) => {
        store.set(key, val);
        return true;
    });

    ipcMain.handle('dialog:openFile', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile']
        })
        if (!canceled) {
            return filePaths[0]
        }
    })

    // Register a global shortcut (e.g., Ctrl+Shift+Alt+I to trigger an action or focus app)
    globalShortcut.register('CommandOrControl+Shift+Alt+I', () => {
        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
            const win = windows[0]
            win.show()
            win.focus()
            // Optional: send message to renderer via webContents
            win.webContents.send('global-shortcut-triggered')
        }
    })

    const win = createWindow()

    // Create the System Tray icon
    // Note: Ensure you have an icon image (e.g., icon.png or icon.ico) in your project directory
    const iconPath = path.join(__dirname, 'placeholder.ico') 
    tray = new Tray(iconPath)
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show App', click: () => win.show() },
      { label: 'Quit', click: () => { isQuitting = true; app.quit() } }
    ])
    
    tray.setToolTip('Electron Showcase App')
    tray.setContextMenu(contextMenu)

    // Clicking tray icon also brings window back up
    tray.on('click', () => {
      win.isVisible() ? win.hide() : win.show()
    })

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
        }
    })

    // Clean up shortcuts when app terminates
    app.on('will-quit', () => {
        globalShortcut.unregisterAll()
    })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
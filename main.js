const { app, BrowserWindow, ipcMain, dialog, Notification, shell, Tray, Menu, globalShortcut, session } = require('electron/main')
const path = require('node:path')
const { updateElectronApp } = require('update-electron-app')
const Store = require('electron-store');
const store = new (Store.default || Store)();

let tray = null
let isQuitting = false

// Mandatory /v1 prefix for your backend API routes
const CENTRAL_API_URL = 'http://localhost:4000/api/v1';

updateElectronApp()

const createWindow = (isLoggedIn = false) => {
  const win = new BrowserWindow({
    width: 1600,
    height: 1200,
    webPreferences: {
        preload: path.join(__dirname, 'preload.js')
    }
  })

  if (!isLoggedIn) {
    win.loadFile(path.join(__dirname, 'renderer', 'login.html'))
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  }

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

    // Uncomment this line if you need to wipe your local cache once to see the login screen:
    store.clear();

    // Updated history handler with Electron session cookie forwarding & debug logs
    ipcMain.handle('simulation:getHistory', async () => {
        try {
            console.log('[IPC DEBUG] ----------------------------------------');
            console.log('[IPC DEBUG] "simulation:getHistory" invoked by renderer.');

            // Retrieve cookies stored in Electron's session
            const cookies = await session.defaultSession.cookies.get({ url: 'http://localhost:4000' });
            const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            console.log('[IPC DEBUG] Cookies attached to history request:', cookieHeader || '(No cookies found!)');

            const targetUrl = `${CENTRAL_API_URL}/history`;
            const response = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    'Cookie': cookieHeader
                }
            });

            console.log(`[IPC DEBUG] History response status: ${response.status} ${response.statusText}`);
            const responseText = await response.text();
            console.log('[IPC DEBUG] History raw response:', responseText);

            if (!response.ok) {
                console.warn('[IPC DEBUG] Response was not OK. Returning empty array.');
                return [];
            }

            const data = JSON.parse(responseText);
            const historyArray = Array.isArray(data) ? data : (data.history || []);
            console.log(`[IPC DEBUG] Successfully parsed ${historyArray.length} history items.`);
            console.log('[IPC DEBUG] ----------------------------------------');

            return historyArray;
        } catch (err) {
            console.error('[IPC ERROR] Failed to fetch history from backend:', err);
            return [];
        }
    });

    ipcMain.handle('ping', () => 'pong')

    // Save simulation configuration handler (mirrors Next.js API route)
    ipcMain.handle('simulation:save', async (event, payload) => {
        try {
            console.log('[IPC DEBUG] Saving simulation configuration...');
            const cookies = await session.defaultSession.cookies.get({ url: 'http://localhost:4000' });
            const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

            const response = await fetch('http://localhost:4000/api/v1/history', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': cookieHeader
                },
                body: JSON.stringify(payload)
            });

            const responseText = await response.text();
            console.log(`[IPC DEBUG] Save response status: ${response.status}`, responseText);

            if (!response.ok) {
                return { success: false, error: responseText };
            }

            const data = JSON.parse(responseText);
            return { success: true, data };
        } catch (err) {
            console.error('[IPC ERROR] Failed to save simulation:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('open-external-url', async (event, url) => {
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

    // Updated Login Handler to capture and store cookies from backend
    ipcMain.handle('auth:login', async (event, { username, password }) => {
      const targetUrl = `${CENTRAL_API_URL}/auth/login`;
      console.log(`[IPC] Attempting login to: ${targetUrl}`);
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const responseText = await response.text();
        console.log(`[IPC] Login response status: ${response.status}`, responseText);

        if (response.ok) {
          // Capture Set-Cookie from backend and store it in Electron session
          const setCookieHeader = response.headers.get('set-cookie');
          if (setCookieHeader) {
            console.log('[IPC] Capturing session cookie from backend on login:', setCookieHeader);
            const cookieParts = setCookieHeader.split(';')[0].split('=');
            if (cookieParts.length === 2) {
              await session.defaultSession.cookies.set({
                url: 'http://localhost:4000',
                name: cookieParts[0].trim(),
                value: cookieParts[1].trim(),
                path: '/'
              });
            }
          }

          store.set('session_user', username);
          return true;
        }
        return false;
      } catch (err) {
        console.error('Central auth error (Login):', err);
        return false;
      }
    });

    // Updated Register Handler to also capture cookies just in case auto-login occurs
    ipcMain.handle('auth:register', async (event, { username, password }) => {
      const targetUrl = `${CENTRAL_API_URL}/auth/register`;
      console.log(`[IPC] Attempting registration to: ${targetUrl}`);
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const responseText = await response.text();
        console.log(`[IPC] Registration response status: ${response.status}`, responseText);

        if (response.ok) {
          const setCookieHeader = response.headers.get('set-cookie');
          if (setCookieHeader) {
            console.log('[IPC] Capturing session cookie from backend on register:', setCookieHeader);
            const cookieParts = setCookieHeader.split(';')[0].split('=');
            if (cookieParts.length === 2) {
              await session.defaultSession.cookies.set({
                url: 'http://localhost:4000',
                name: cookieParts[0].trim(),
                value: cookieParts[1].trim(),
                path: '/'
              });
            }
          }

          store.set('session_user', username);
          return true;
        }
        return false;
      } catch (err) {
        console.error('Central auth error (Register):', err);
        return false;
      }
    });

    // Logout action with logging
    ipcMain.handle('auth:logout', async () => {
      const targetUrl = `${CENTRAL_API_URL}/auth/logout`;
      console.log(`[IPC] Attempting logout to: ${targetUrl}`);
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
        });
        const responseText = await response.text();
        console.log(`[IPC] Logout response status: ${response.status}`, responseText);
      } catch (err) {
        console.error('Central auth error (Logout):', err);
      }
      store.delete('session_user');
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

    globalShortcut.register('CommandOrControl+Shift+Alt+I', () => {
        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
            const win = windows[0]
            win.show()
            win.focus()
            win.webContents.send('global-shortcut-triggered')
        }
    })

    const currentSession = store.get('session_user');
    const win = createWindow(!!currentSession)

    const iconPath = path.join(__dirname, 'placeholder.ico') 
    tray = new Tray(iconPath)
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show App', click: () => win.show() },
      { label: 'Quit', click: () => { isQuitting = true; app.quit() } }
    ])
    
    tray.setToolTip('Electron Showcase App')
    tray.setContextMenu(contextMenu)

    tray.on('click', () => {
      win.isVisible() ? win.hide() : win.show()
    })

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          const activeSession = store.get('session_user');
          createWindow(!!activeSession)
        }
    })

    app.on('will-quit', () => {
        globalShortcut.unregisterAll()
    })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
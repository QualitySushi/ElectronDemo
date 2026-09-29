const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  ping: () => ipcRenderer.invoke('ping'),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  getPreference: (key) => ipcRenderer.invoke('get-preference', key),
  setPreference: (key, val) => ipcRenderer.invoke('set-preference', key, val),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),
  onGlobalShortcut: (callback) => ipcRenderer.on('global-shortcut-triggered', () => callback()),
  // we can also expose variables, not just functions
})
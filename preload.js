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
  getSimulationHistory: () => ipcRenderer.invoke('simulation:getHistory'),
  saveSimulation: (payload) => ipcRenderer.invoke('simulation:save', payload),
  
  // --- Authentication Exposed APIs ---
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  register: (credentials) => ipcRenderer.invoke('auth:register', credentials),
  logout: () => ipcRenderer.invoke('auth:logout'),
})
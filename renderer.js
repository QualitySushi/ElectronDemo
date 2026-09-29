const information = document.getElementById('info')
information.innerText = `This app is using Chrome (v${window.versions.chrome()}), Node.js (v${window.versions.node()}), and Electron (v${window.versions.electron()})`

// --- Ping / Pong Test ---
const pingBtn = document.getElementById('pingBtn')
const pingStatus = document.getElementById('pingStatus')

if (pingBtn) {
  pingBtn.addEventListener('click', async () => {
    try {
      const response = await window.versions.ping()
      pingStatus.innerText = response // Will output 'pong'
      console.log('Server response:', response)
    } catch (error) {
      console.error('Ping failed:', error)
    }
  })
}

// Listen for global shortcut triggers from the main process
window.versions.onGlobalShortcut(() => {
  console.log('Global shortcut Ctrl+Shift+Alt+I was pressed!')
  alert('Global shortcut triggered from outside the app!')
})

// --- External URL Handling ---
const externalLink = document.querySelector('.external-link')

if (externalLink) {
  externalLink.addEventListener('click', async (e) => {
    e.preventDefault() // Stop electron window from navigating to it
    const url = externalLink.getAttribute('id-link') || externalLink.href
    await window.versions.openExternal(url)
  })
}

// --- Notification Logic ---
const notifyBtn = document.getElementById('notifyBtn')

notifyBtn.addEventListener('click', async () => {
  await window.versions.showNotification(
    'Electron Showcase', 
    'This is a native desktop notification triggered by your app!'
  )
})

// --- Theme Preference Logic ---
const themeToggleBtn = document.getElementById('themeToggleBtn')
const themeLabel = document.getElementById('themeLabel')

// Helper function to apply theme styles to the document body
const applyTheme = (theme) => {
  if (theme === 'dark') {
    document.body.style.backgroundColor = '#1e1e1e'
    document.body.style.color = '#ffffff'
    themeLabel.innerText = 'Dark Mode'
  } else {
    document.body.style.backgroundColor = '#ffffff'
    document.body.style.color = '#000000'
    themeLabel.innerText = 'Light Mode'
  }
}

// 1. Load saved theme preference on startup
async function initTheme() {
  const savedTheme = await window.versions.getPreference('theme')
  if (savedTheme) {
    applyTheme(savedTheme)
  } else {
    // Default to light if none saved
    applyTheme('light')
  }
}
initTheme()

// 2. Toggle theme on button click and save to electron-store
themeToggleBtn.addEventListener('click', async () => {
  const currentTheme = await window.versions.getPreference('theme') || 'light'
  const newTheme = currentTheme === 'light' ? 'dark' : 'light'

  // Save via our IPC bridge to electron-store
  await window.versions.setPreference('theme', newTheme)
  applyTheme(newTheme)
})

// --- File Dialog Logic ---
const btn = document.getElementById('btn')
const filePathElement = document.getElementById('filePath')

btn.addEventListener('click', async () => {
  const filePath = await window.versions.openFile()
  if (filePath) {
    filePathElement.innerText = filePath
  }
})
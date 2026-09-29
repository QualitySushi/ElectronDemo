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

// ==========================================
// --- BOIDS CROWD DYNAMICS SIMULATION ---
// ==========================================
const canvas = document.getElementById('simulationCanvas')
if (canvas) {
  const ctx = canvas.getContext('2d')
  const statusEl = document.getElementById('sim-status')

  const sepSlider = document.getElementById('separation')
  const alignSlider = document.getElementById('alignment')
  const cohSlider = document.getElementById('cohesion')

  const sepVal = document.getElementById('sep-val')
  const alignVal = document.getElementById('align-val')
  const cohVal = document.getElementById('coh-val')

  let latestParticles = []
  let ws = null

  // DESIGN DEFENSE: Establish connection to Express gateway WebSocket proxy (Port 4000)
  function connectWebSocket() {
    if (statusEl) {
      statusEl.innerText = 'Connecting to Gateway...'
      statusEl.style.background = '#334155'
    }

    ws = new WebSocket('ws://localhost:5000')

    ws.onopen = () => {
      if (statusEl) {
        statusEl.innerText = 'Status: Connected (Live Stream)'
        statusEl.style.background = '#065f46' // Green success tint
      }
      sendConfigUpdate()
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.particles) {
          latestParticles = data.particles
        }
      } catch (err) {
        console.error('Failed to parse incoming WebSocket frame:', err)
      }
    }

    ws.onclose = () => {
      if (statusEl) {
        statusEl.innerText = 'Status: Disconnected. Retrying...'
        statusEl.style.background = '#991b1b' // Red error tint
      }
      // Reconnection fallback timer
      setTimeout(connectWebSocket, 2000)
    }

    ws.onerror = (err) => {
      console.error('WebSocket error encountered:', err)
      ws.close()
    }
  }

  // Send parameter changes upstream when sliders move
  function sendConfigUpdate() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload = {
        separation_weight: parseFloat(sepSlider.value),
        alignment_weight: parseFloat(alignSlider.value),
        cohesion_weight: parseFloat(cohSlider.value)
      }
      ws.send(JSON.stringify(payload))
    }
  }

  if (sepSlider && alignSlider && cohSlider) {
    sepSlider.addEventListener('input', (e) => { sepVal.innerText = e.target.value; sendConfigUpdate(); })
    alignSlider.addEventListener('input', (e) => { alignVal.innerText = e.target.value; sendConfigUpdate(); })
    cohSlider.addEventListener('input', (e) => { cohVal.innerText = e.target.value; sendConfigUpdate(); })
  }

  // --- RENDER LOOP ---
  // DESIGN DEFENSE: Decouple render frequency from network packets using requestAnimationFrame 
  // for butter-smooth visual interpolation on the HTML5 canvas.
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Render background grid lines for a technical dashboard aesthetic
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Render flocking particles
    ctx.fillStyle = '#38bdf8'
    for (const p of latestParticles) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }

    requestAnimationFrame(render)
  }

  // Initialize connection and start paint loop
  connectWebSocket()
  requestAnimationFrame(render)
}
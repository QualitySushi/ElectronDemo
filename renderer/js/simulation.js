let ws = null
let animationFrameId = null
let reconnectTimeoutId = null

let isInitialized = false

let latestParticles = []

let canvas = null
let ctx = null
let statusEl = null

let sepSlider = null
let alignSlider = null
let cohSlider = null

let sepVal = null
let alignVal = null
let cohVal = null
let saveBtn = null

export function initSimulation() {
    if (isInitialized) {
        return
    }

    canvas = document.getElementById('simulationCanvas')

    if (!canvas) {
        return
    }

    ctx = canvas.getContext('2d')

    if (!ctx) {
        return
    }

    statusEl = document.getElementById('sim-status')

    sepSlider = document.getElementById('separation')
    alignSlider = document.getElementById('alignment')
    cohSlider = document.getElementById('cohesion')

    sepVal = document.getElementById('sep-val')
    alignVal = document.getElementById('align-val')
    cohVal = document.getElementById('coh-val')

    saveBtn = document.getElementById('save-simulation-btn')

    isInitialized = true

    if (
        sepSlider &&
        alignSlider &&
        cohSlider
    ) {
        sepSlider.addEventListener(
            'input',
            handleSeparationInput
        )

        alignSlider.addEventListener(
            'input',
            handleAlignmentInput
        )

        cohSlider.addEventListener(
            'input',
            handleCohesionInput
        )
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', handleSaveConfiguration)
    }

    connectWebSocket()

    animationFrameId =
        requestAnimationFrame(render)

    console.log('[Simulation] Module enabled.')
}

export function destroySimulation() {
    if (!isInitialized) {
        return
    }

    isInitialized = false

    // Cancel any pending reconnect.
    if (reconnectTimeoutId !== null) {
        clearTimeout(reconnectTimeoutId)
        reconnectTimeoutId = null
    }

    // Stop the render loop.
    if (animationFrameId !== null) {
        cancelAnimationFrame(
            animationFrameId
        )

        animationFrameId = null
    }

    // Remove slider listeners.
    if (sepSlider) {
        sepSlider.removeEventListener(
            'input',
            handleSeparationInput
        )
    }

    if (alignSlider) {
        alignSlider.removeEventListener(
            'input',
            handleAlignmentInput
        )
    }

    if (cohSlider) {
        cohSlider.removeEventListener(
            'input',
            handleCohesionInput
        )
    }

    if (saveBtn) {
        saveBtn.removeEventListener('click', handleSaveConfiguration)
    }

    // Prevent socket callbacks from
    // reconnecting after destruction.
    if (ws) {
        ws.onopen = null
        ws.onmessage = null
        ws.onerror = null
        ws.onclose = null

        ws.close()

        ws = null
    }

    latestParticles = []

    if (ctx && canvas) {
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        )
    }

    canvas = null
    ctx = null

    statusEl = null

    sepSlider = null
    alignSlider = null
    cohSlider = null

    sepVal = null
    alignVal = null
    cohVal = null
    saveBtn = null

    console.log('[Simulation] Module disabled.')
}

export function exportSimulationSnapshot(filename = 'simulation-snapshot.png') {
    if (!isInitialized || !canvas) {
        console.warn('[Simulation] Cannot export snapshot: Module not initialized.')
        return null
    }

    const dataURL = canvas.toDataURL('image/png')

    // Automatically trigger file download
    const link = document.createElement('a')
    link.download = filename
    link.href = dataURL
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    console.log('[Simulation] Snapshot saved successfully.')
    return dataURL
}

function handleSeparationInput(event) {
    if (sepVal) {
        sepVal.innerText = event.target.value
    }

    sendConfigUpdate()
}

function handleAlignmentInput(event) {
    if (alignVal) {
        alignVal.innerText = event.target.value
    }

    sendConfigUpdate()
}

function handleCohesionInput(event) {
    if (cohVal) {
        cohVal.innerText = event.target.value
    }

    sendConfigUpdate()
}

async function handleSaveConfiguration() {
    if (!isInitialized) return

    const payload = {
        simulation_type: 'boids',
        sub_type: 'flocking',
        configuration: {
            separation: sepSlider ? parseFloat(sepSlider.value) : 1.5,
            alignment: alignSlider ? parseFloat(alignSlider.value) : 1.0,
            cohesion: cohSlider ? parseFloat(cohSlider.value) : 1.0
        }
    }

    console.log('[Simulation] Saving configuration to database...', payload)

    try {
        // Invoking the IPC method exposed by preload.js
        const result = await window.versions.saveSimulation(payload)

        if (result && result.success) {
            console.log('[Simulation] Successfully saved to database!')
            if (statusEl) {
                statusEl.innerText = 'Status: Configuration saved to history!'
            }
        } else {
            console.error('[Simulation] Failed to save configuration:', result?.error)
            if (statusEl) {
                statusEl.innerText = 'Status: Failed to save configuration.'
            }
        }
    } catch (err) {
        console.error('[Simulation] Error invoking save IPC:', err)
    }
}

function connectWebSocket() {
    if (
        !isInitialized ||
        ws
    ) {
        return
    }

    if (statusEl) {
        statusEl.innerText =
            'Connecting to Gateway...'

        statusEl.style.background =
            '#334155'
    }

    ws = new WebSocket(
        'ws://localhost:8000/api/ws/simulation'
    )

    ws.onopen = () => {
        if (!isInitialized) {
            return
        }

        if (statusEl) {
            statusEl.innerText =
                'Status: Connected (Live Stream)'

            statusEl.style.background =
                '#065f46'
        }

        sendConfigUpdate()
    }

    ws.onmessage = (event) => {
        if (!isInitialized) {
            return
        }

        try {
            const data =
                JSON.parse(event.data)

            if (data.particles) {
                latestParticles =
                    data.particles
            }
        } catch (err) {
            console.error(
                'Failed to parse WebSocket frame:',
                err
            )
        }
    }

    ws.onerror = (err) => {
        if (!isInitialized) {
            return
        }

        console.error(
            'Simulation WebSocket error:',
            err
        )
    }

    ws.onclose = () => {
        ws = null

        if (!isInitialized) {
            return
        }

        if (statusEl) {
            statusEl.innerText =
                'Status: Disconnected. Retrying...'

            statusEl.style.background =
                '#991b1b'
        }

        reconnectTimeoutId =
            setTimeout(() => {
                reconnectTimeoutId = null

                if (isInitialized) {
                    connectWebSocket()
                }
            }, 2000)
    }
}

function sendConfigUpdate() {
    if (
        !ws ||
        ws.readyState !== WebSocket.OPEN ||
        !sepSlider ||
        !alignSlider ||
        !cohSlider
    ) {
        return
    }

    ws.send(
        JSON.stringify({
            separation_weight:
                parseFloat(
                    sepSlider.value
                ),

            alignment_weight:
                parseFloat(
                    alignSlider.value
                ),

            cohesion_weight:
                parseFloat(
                    cohSlider.value
                )
        })
    )
}

function render() {
    if (
        !isInitialized ||
        !ctx ||
        !canvas
    ) {
        return
    }

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    )

    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1

    for (
        let x = 0;
        x < canvas.width;
        x += 50
    ) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(
            x,
            canvas.height
        )
        ctx.stroke()
    }

    for (
        let y = 0;
        y < canvas.height;
        y += 50
    ) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(
            canvas.width,
            y
        )
        ctx.stroke()
    }

    ctx.fillStyle = '#38bdf8'

    for (const particle of latestParticles) {
        ctx.beginPath()

        ctx.arc(
            particle.x,
            particle.y,
            3.5,
            0,
            Math.PI * 2
        )

        ctx.fill()
    }

    animationFrameId =
        requestAnimationFrame(render)
}
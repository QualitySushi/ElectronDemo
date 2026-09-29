export function initSimulation() {
    const canvas = document.getElementById('simulationCanvas')
    if (!canvas) return

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

    function connectWebSocket() {
        if (statusEl) {
            statusEl.innerText = 'Connecting to Gateway...'
            statusEl.style.background = '#334155'
        }

        const ws = new WebSocket('ws://localhost:8000/api/ws/simulation');

        ws.onopen = () => {
            if (statusEl) {
                statusEl.innerText = 'Status: Connected (Live Stream)'
                statusEl.style.background = '#065f46'
            }
            sendConfigUpdate()
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                if (data.particles) latestParticles = data.particles
            } catch (err) {
                console.error('Failed to parse WebSocket frame:', err)
            }
        }

        ws.onclose = () => {
            if (statusEl) {
                statusEl.innerText = 'Status: Disconnected. Retrying...'
                statusEl.style.background = '#991b1b'
            }
            setTimeout(connectWebSocket, 2000)
        }
    }

    function sendConfigUpdate() {
        if (ws && ws.readyState === WebSocket.OPEN && sepSlider) {
            ws.send(JSON.stringify({
                separation_weight: parseFloat(sepSlider.value),
                alignment_weight: parseFloat(alignSlider.value),
                cohesion_weight: parseFloat(cohSlider.value)
            }))
        }
    }

    if (sepSlider && alignSlider && cohSlider) {
        sepSlider.addEventListener('input', (e) => { sepVal.innerText = e.target.value; sendConfigUpdate(); })
        alignSlider.addEventListener('input', (e) => { alignVal.innerText = e.target.value; sendConfigUpdate(); })
        cohSlider.addEventListener('input', (e) => { cohVal.innerText = e.target.value; sendConfigUpdate(); })
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.strokeStyle = '#1e293b'
        ctx.lineWidth = 1
        for (let x = 0; x < canvas.width; x += 50) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 50) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        ctx.fillStyle = '#38bdf8'
        for (const p of latestParticles) {
            ctx.beginPath()
            ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
            ctx.fill()
        }

        requestAnimationFrame(render)
    }

    connectWebSocket()
    requestAnimationFrame(render)
}
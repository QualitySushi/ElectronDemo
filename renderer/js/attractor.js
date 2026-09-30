let socket = null

let canvas = null
let ctx = null

let latestPoints = []

let selectedAttractor = 'clifford'

let initialized = false

let selector = null
let resetButton = null

const MAX_RENDER_POINTS = 20000

const DEFAULT_PARAMS = {
    clifford: {
        a: -1.4,
        b: 1.6,
        c: 1.0,
        d: 0.7
    },

    dejong: {
        a: -2.2,
        b: 1.0,
        c: -2.0,
        d: 1.8
    },

    aizawa: {
        a: 0.95,
        b: 0.70,
        c: 0.60,
        d: 3.50,
        e: 0.25,
        f: 0.10
    },

    lorenz: {
        sigma: 10.0,
        rho: 28.0,
        beta: 8.0 / 3.0
    }
}

const DEFAULT_ZOOM = 120

let zoom = DEFAULT_ZOOM

const pan = {
    x: 400,
    y: 250
}

function getParameterKeys(type) {
    if (type === 'aizawa') {
        return ['a', 'b', 'c', 'd', 'e', 'f']
    }

    if (type === 'lorenz') {
        return ['sigma', 'rho', 'beta']
    }

    return ['a', 'b', 'c', 'd']
}

function sendConfiguration() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return
    }

    socket.send(JSON.stringify({
        attractor_type: selectedAttractor,
        ...DEFAULT_PARAMS[selectedAttractor]
    }))
}

function updateParameter(key, value) {
    const params = DEFAULT_PARAMS[selectedAttractor]

    params[key] = Number(value)

    const valueElement =
        document.getElementById(`attractor-${key}-value`)

    if (valueElement) {
        valueElement.textContent =
            Number(value).toFixed(2)
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return
    }

    socket.send(JSON.stringify({
        [key]: Number(value)
    }))
}

function resetView() {
    zoom = DEFAULT_ZOOM

    pan.x = 400
    pan.y = 250

    redrawCanvas()
}

function getSliderRange(type, key) {
    if (type === 'lorenz') {
        if (key === 'sigma') {
            return {
                min: 0.1,
                max: 30,
                step: 0.1
            }
        }

        if (key === 'rho') {
            return {
                min: 1,
                max: 60,
                step: 0.1
            }
        }

        if (key === 'beta') {
            return {
                min: 0.1,
                max: 10,
                step: 0.01
            }
        }
    }

    return {
        min: -3,
        max: 3,
        step: 0.01
    }
}

function createParameterControls() {
    const container =
        document.getElementById('attractor-parameters')

    if (!container) {
        return
    }

    container.innerHTML = ''

    const params =
        DEFAULT_PARAMS[selectedAttractor]

    const keys =
        getParameterKeys(selectedAttractor)

    for (const key of keys) {
        const range =
            getSliderRange(
                selectedAttractor,
                key
            )

        const wrapper =
            document.createElement('div')

        wrapper.style.display = 'flex'
        wrapper.style.flexDirection = 'column'
        wrapper.style.gap = '4px'

        const label =
            document.createElement('label')

        label.style.fontSize = '0.85rem'
        label.style.color = '#94a3b8'

        label.innerHTML = `
            ${key.toUpperCase()}:
            <span id="attractor-${key}-value">
                ${Number(params[key]).toFixed(2)}
            </span>
        `

        const slider =
            document.createElement('input')

        slider.type = 'range'
        slider.min = range.min
        slider.max = range.max
        slider.step = range.step
        slider.value = params[key]

        slider.addEventListener('input', () => {
            updateParameter(
                key,
                slider.value
            )
        })

        wrapper.appendChild(label)
        wrapper.appendChild(slider)

        container.appendChild(wrapper)
    }
}

function handleAttractorChange(event) {
    selectedAttractor = event.target.value

    createParameterControls()

    resetView()

    sendConfiguration()
}

function getRenderPoints() {
    if (
        !latestPoints ||
        latestPoints.length === 0
    ) {
        return []
    }

    if (
        latestPoints.length <=
        MAX_RENDER_POINTS
    ) {
        return latestPoints
    }

    const renderPoints = []

    const step =
        latestPoints.length /
        MAX_RENDER_POINTS

    for (
        let i = 0;
        i < MAX_RENDER_POINTS;
        i++
    ) {
        const index =
            Math.floor(i * step)

        renderPoints.push(
            latestPoints[index]
        )
    }

    return renderPoints
}

function redrawCanvas() {
    if (!canvas || !ctx) {
        return
    }

    ctx.fillStyle = '#090d16'

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    )

    if (
        !latestPoints ||
        latestPoints.length === 0
    ) {
        return
    }

    const renderPoints =
        getRenderPoints()

    if (renderPoints.length === 0) {
        return
    }

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    for (const point of renderPoints) {
        if (
            !Array.isArray(point) ||
            !Number.isFinite(point[0]) ||
            !Number.isFinite(point[1])
        ) {
            continue
        }

        minX = Math.min(
            minX,
            point[0]
        )

        maxX = Math.max(
            maxX,
            point[0]
        )

        minY = Math.min(
            minY,
            point[1]
        )

        maxY = Math.max(
            maxY,
            point[1]
        )
    }

    if (
        !Number.isFinite(minX) ||
        !Number.isFinite(maxX) ||
        !Number.isFinite(minY) ||
        !Number.isFinite(maxY)
    ) {
        return
    }

    const centerX =
        (minX + maxX) / 2

    const centerY =
        (minY + maxY) / 2

    const dataWidth =
        maxX - minX

    const dataHeight =
        maxY - minY

    if (
        dataWidth === 0 ||
        dataHeight === 0
    ) {
        return
    }

    const padding = 40

    const scaleX =
        (canvas.width - padding * 2) /
        dataWidth

    const scaleY =
        (canvas.height - padding * 2) /
        dataHeight

    const fitScale =
        Math.min(
            scaleX,
            scaleY
        )

    ctx.save()

    ctx.translate(
        pan.x,
        pan.y
    )

    const scale =
        fitScale *
        (zoom / DEFAULT_ZOOM)

    ctx.scale(
        scale,
        scale
    )

    ctx.fillStyle =
        'rgba(56, 189, 248, 0.65)'

    const radius =
        0.4 / fitScale

    for (const point of renderPoints) {
        if (
            !Array.isArray(point) ||
            !Number.isFinite(point[0]) ||
            !Number.isFinite(point[1])
        ) {
            continue
        }

        const x =
            point[0] - centerX

        const y =
            -(point[1] - centerY)

        ctx.beginPath()

        ctx.arc(
            x,
            y,
            radius,
            0,
            Math.PI * 2
        )

        ctx.fill()
    }

    ctx.restore()
}

function connectSocket() {
    if (
        !initialized ||
        socket
    ) {
        return
    }

    const status =
        document.getElementById(
            'attractor-status'
        )

    socket =
        new WebSocket(
            'ws://localhost:4000/ws/attractor'
        )

    socket.addEventListener(
        'open',
        () => {
            if (!initialized) {
                return
            }

            console.log(
                '[Attractor] Connected to gateway.'
            )

            if (status) {
                status.textContent =
                    'Connected'

                status.style.background =
                    '#166534'
            }

            sendConfiguration()
        }
    )

    socket.addEventListener(
        'message',
        (event) => {
            if (!initialized) {
                return
            }

            try {
                const data =
                    JSON.parse(event.data)

                if (
                    !data.success ||
                    !Array.isArray(data.points)
                ) {
                    return
                }

                latestPoints =
                    data.points

                redrawCanvas()

            } catch (error) {
                console.error(
                    '[Attractor] Failed to process message:',
                    error
                )
            }
        }
    )

    socket.addEventListener(
        'error',
        (error) => {
            if (!initialized) {
                return
            }

            console.error(
                '[Attractor] WebSocket error:',
                error
            )

            if (status) {
                status.textContent =
                    'Connection Error'

                status.style.background =
                    '#991b1b'
            }
        }
    )

    socket.addEventListener(
        'close',
        () => {
            console.log(
                '[Attractor] Disconnected from gateway.'
            )

            socket = null

            if (status) {
                status.textContent =
                    'Disabled'

                status.style.background =
                    '#334155'
            }
        }
    )
}

export function initAttractorModule() {
    if (initialized) {
        return
    }

    canvas =
        document.getElementById(
            'attractorCanvas'
        )

    ctx =
        canvas?.getContext('2d')

    if (!canvas || !ctx) {
        console.error(
            '[Attractor] Canvas element not found.'
        )

        return
    }

    initialized = true

    selector =
        document.getElementById(
            'attractorSelector'
        )

    if (selector) {
        selector.addEventListener(
            'change',
            handleAttractorChange
        )
    }

    resetButton =
        document.getElementById(
            'resetAttractorBtn'
        )

    if (resetButton) {
        resetButton.addEventListener(
            'click',
            resetView
        )
    }

    createParameterControls()

    resetView()

    connectSocket()

    console.log(
        '[Attractor] Module enabled.'
    )
}

export function destroyAttractorModule() {
    if (!initialized) {
        return
    }

    initialized = false

    if (selector) {
        selector.removeEventListener(
            'change',
            handleAttractorChange
        )
    }

    if (resetButton) {
        resetButton.removeEventListener(
            'click',
            resetView
        )
    }

    selector = null
    resetButton = null

    if (socket) {
        socket.close()
        socket = null
    }

    latestPoints = []

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

    console.log(
        '[Attractor] Module disabled.'
    )
}
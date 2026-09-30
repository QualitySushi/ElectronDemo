import * as THREE from '../../node_modules/three/build/three.module.js'

const globeContainer = document.getElementById('globeContainer')
const satStatusEl = document.getElementById('sat-status')
const satSelector = document.getElementById('satSelector')
const refreshSatBtn = document.getElementById('refreshSatBtn')
const satXEl = document.getElementById('sat-x')
const satYEl = document.getElementById('sat-y')
const satZEl = document.getElementById('sat-z')
const satTimeEl = document.getElementById('sat-time')

let scene
let camera
let renderer
let earthSphere

let satelliteMeshes = new Map()
let selectedSatId = null

let isInitialized = false
let animationFrameId = null

// Interaction state for click-and-drag orbit
let isDragging = false
let previousMousePosition = { x: 0, y: 0 }

let spherical = {
    radius: 1200,
    theta: 0,
    phi: Math.PI / 2
}

export function initGlobeModule() {
    if (isInitialized || !globeContainer) {
        return
    }

    isInitialized = true

    scene = new THREE.Scene()

    camera = new THREE.PerspectiveCamera(
        60,
        globeContainer.clientWidth / globeContainer.clientHeight,
        0.1,
        10000
    )

    updateCameraPosition()

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    })

    renderer.setSize(
        globeContainer.clientWidth,
        globeContainer.clientHeight
    )

    renderer.setPixelRatio(window.devicePixelRatio)

    globeContainer.innerHTML = ''
    globeContainer.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)

    const earthRadius = 300

    const sphereGeometry = new THREE.SphereGeometry(
        earthRadius,
        32,
        32
    )

    const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x1e3a8a,
        wireframe: true,
        transparent: true,
        opacity: 0.3
    })

    earthSphere = new THREE.Mesh(
        sphereGeometry,
        sphereMaterial
    )

    scene.add(earthSphere)

    globeContainer.addEventListener(
        'pointerdown',
        handlePointerDown
    )

    window.addEventListener(
        'pointermove',
        handlePointerMove
    )

    window.addEventListener(
        'pointerup',
        handlePointerUp
    )

    globeContainer.addEventListener(
        'wheel',
        handleWheel,
        { passive: false }
    )

    window.addEventListener(
        'resize',
        handleResize
    )

    if (satSelector) {
        satSelector.addEventListener(
            'change',
            handleSatelliteSelection
        )
    }

    if (refreshSatBtn) {
        refreshSatBtn.addEventListener(
            'click',
            fetchSatelliteSnapshot
        )
    }

    animateGlobe()

    fetchSatelliteSnapshot()

    console.log('[Globe] Module enabled.')
}

export function destroyGlobeModule() {
    if (!isInitialized) {
        return
    }

    isInitialized = false

    isDragging = false

    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
    }

    globeContainer?.removeEventListener(
        'pointerdown',
        handlePointerDown
    )

    window.removeEventListener(
        'pointermove',
        handlePointerMove
    )

    window.removeEventListener(
        'pointerup',
        handlePointerUp
    )

    globeContainer?.removeEventListener(
        'wheel',
        handleWheel
    )

    window.removeEventListener(
        'resize',
        handleResize
    )

    satSelector?.removeEventListener(
        'change',
        handleSatelliteSelection
    )

    refreshSatBtn?.removeEventListener(
        'click',
        fetchSatelliteSnapshot
    )

    satelliteMeshes.forEach((mesh) => {
        scene?.remove(mesh)

        mesh.geometry?.dispose()
        mesh.material?.dispose()
    })

    satelliteMeshes.clear()

    if (earthSphere) {
        scene?.remove(earthSphere)

        earthSphere.geometry?.dispose()
        earthSphere.material?.dispose()

        earthSphere = null
    }

    if (renderer) {
        renderer.dispose()

        renderer.domElement.remove()

        renderer = null
    }

    scene = null
    camera = null

    selectedSatId = null

    window._lastSatellitesData = null

    if (satStatusEl) {
        satStatusEl.innerText = 'Disabled'
        satStatusEl.style.background = '#334155'
    }

    console.log('[Globe] Module disabled.')
}

function handlePointerDown(event) {
    if (!isInitialized) {
        return
    }

    isDragging = true

    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    }
}

function handlePointerMove(event) {
    if (!isInitialized || !isDragging) {
        return
    }

    const deltaX = event.clientX - previousMousePosition.x
    const deltaY = event.clientY - previousMousePosition.y

    spherical.theta -= deltaX * 0.005
    spherical.phi -= deltaY * 0.005

    const EPS = 0.00001

    spherical.phi = Math.max(
        EPS,
        Math.min(Math.PI - EPS, spherical.phi)
    )

    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    }

    updateCameraPosition()
}

function handlePointerUp() {
    isDragging = false
}

function handleWheel(event) {
    if (!isInitialized) {
        return
    }

    event.preventDefault()

    spherical.radius += event.deltaY * 0.8

    spherical.radius = Math.max(
        350,
        Math.min(4000, spherical.radius)
    )

    updateCameraPosition()
}

function handleResize() {
    if (
        !isInitialized ||
        !globeContainer ||
        !renderer ||
        !camera
    ) {
        return
    }

    camera.aspect =
        globeContainer.clientWidth /
        globeContainer.clientHeight

    camera.updateProjectionMatrix()

    renderer.setSize(
        globeContainer.clientWidth,
        globeContainer.clientHeight
    )
}

function handleSatelliteSelection(event) {
    if (!isInitialized) {
        return
    }

    selectedSatId = event.target.value

    if (window._lastSatellitesData) {
        updateSatellitesInScene(
            window._lastSatellitesData
        )
    }
}

function updateCameraPosition() {
    if (!camera) {
        return
    }

    const x =
        spherical.radius *
        Math.sin(spherical.phi) *
        Math.sin(spherical.theta)

    const y =
        spherical.radius *
        Math.cos(spherical.phi)

    const z =
        spherical.radius *
        Math.sin(spherical.phi) *
        Math.cos(spherical.theta)

    camera.position.set(x, y, z)

    camera.lookAt(0, 0, 0)
}

function updateSatelliteDropdown(satellites) {
    if (!satSelector) {
        return
    }

    if (satSelector.options.length !== satellites.length) {
        const previousSelection = satSelector.value

        satSelector.innerHTML = ''

        satellites.forEach((sat) => {
            const satId = sat.id || sat.name

            const option = document.createElement('option')

            option.value = satId
            option.innerText = sat.name || satId

            satSelector.appendChild(option)
        })

        if (
            previousSelection &&
            satellites.some(
                (sat) =>
                    (sat.id || sat.name) === previousSelection
            )
        ) {
            satSelector.value = previousSelection
        } else if (satellites.length > 0) {
            satSelector.value =
                satellites[0].id ||
                satellites[0].name
        }
    }

    if (satSelector.value) {
        selectedSatId = satSelector.value
    }
}

function updateSatellitesInScene(satellites) {
    if (
        !isInitialized ||
        !satellites ||
        satellites.length === 0 ||
        !scene
    ) {
        return
    }

    updateSatelliteDropdown(satellites)

    const activeIds = new Set()

    let primarySat = null

    const EARTH_RADIUS_KM = 6371.0
    const THREE_EARTH_RADIUS = 300.0

    const scale =
        THREE_EARTH_RADIUS /
        EARTH_RADIUS_KM

    satellites.forEach((sat) => {
        const satId =
            sat.id ||
            sat.name ||
            'satellite'

        activeIds.add(satId)

        const isSelected =
            satId === selectedSatId ||
            (
                !selectedSatId &&
                satellites.indexOf(sat) === 0
            )

        if (isSelected) {
            primarySat = sat
        }

        let mesh = satelliteMeshes.get(satId)

        const posX =
            (sat.x || 0) *
            scale

        const posY =
            (sat.z || 0) *
            scale

        const posZ =
            (sat.y || 0) *
            scale

        if (!mesh) {
            const geometry =
                new THREE.SphereGeometry(
                    6,
                    16,
                    16
                )

            const material =
                new THREE.MeshBasicMaterial({
                    color: isSelected
                        ? 0xef4444
                        : 0x38bdf8
                })

            mesh = new THREE.Mesh(
                geometry,
                material
            )

            scene.add(mesh)

            satelliteMeshes.set(
                satId,
                mesh
            )
        } else {
            mesh.material.color.setHex(
                isSelected
                    ? 0xef4444
                    : 0x38bdf8
            )
        }

        mesh.position.set(
            posX,
            posY,
            posZ
        )
    })

    if (!primarySat && satellites.length > 0) {
        primarySat = satellites[0]
    }

    if (
        primarySat &&
        primarySat.x !== undefined
    ) {
        if (satXEl) {
            satXEl.innerText =
                Number(primarySat.x).toFixed(2)
        }

        if (satYEl) {
            satYEl.innerText =
                Number(primarySat.y).toFixed(2)
        }

        if (satZEl) {
            satZEl.innerText =
                Number(primarySat.z).toFixed(2)
        }

        if (satTimeEl) {
            satTimeEl.innerText =
                primarySat.time ||
                new Date().toISOString()
        }
    }

    satelliteMeshes.forEach(
        (mesh, id) => {
            if (!activeIds.has(id)) {
                scene.remove(mesh)

                mesh.geometry?.dispose()
                mesh.material?.dispose()

                satelliteMeshes.delete(id)
            }
        }
    )
}

function animateGlobe() {
    if (!isInitialized) {
        return
    }

    animationFrameId =
        requestAnimationFrame(
            animateGlobe
        )

    if (
        renderer &&
        scene &&
        camera
    ) {
        renderer.render(
            scene,
            camera
        )
    }
}

async function fetchSatelliteSnapshot() {
    if (!isInitialized) {
        return
    }

    if (satStatusEl) {
        satStatusEl.innerText =
            'Fetching Data Snapshot...'

        satStatusEl.style.background =
            '#334155'
    }

    try {
        const response = await fetch(
            'http://localhost:8000/api/satellites'
        )

        if (!response.ok) {
            throw new Error(
                `HTTP error! status: ${response.status}`
            )
        }

        const data = await response.json()

        if (!isInitialized) {
            return
        }

        const satArray =
            Array.isArray(data)
                ? data
                : (
                    data.satellites ||
                    [data]
                )

        window._lastSatellitesData =
            satArray

        updateSatellitesInScene(
            satArray
        )

        if (satStatusEl) {
            satStatusEl.innerText =
                'Status: Snapshot Loaded Successfully'

            satStatusEl.style.background =
                '#065f46'
        }
    } catch (err) {
        if (!isInitialized) {
            return
        }

        console.error(
            'Failed to fetch satellite snapshot:',
            err
        )

        if (satStatusEl) {
            satStatusEl.innerText =
                'Status: Fetch Failed (Check Server)'

            satStatusEl.style.background =
                '#991b1b'
        }
    }
}
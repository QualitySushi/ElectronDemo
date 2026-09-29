import * as THREE from '../../node_modules/three/build/three.module.js'

const globeContainer = document.getElementById('globeContainer')
const satStatusEl = document.getElementById('sat-status')
const satSelector = document.getElementById('satSelector')
const refreshSatBtn = document.getElementById('refreshSatBtn')
const satXEl = document.getElementById('sat-x')
const satYEl = document.getElementById('sat-y')
const satZEl = document.getElementById('sat-z')
const satTimeEl = document.getElementById('sat-time')

let scene, camera, renderer, earthSphere
let satelliteMeshes = new Map()
let selectedSatId = null

// Interaction state for click-and-drag orbit
let isDragging = false
let previousMousePosition = { x: 0, y: 0 }
let spherical = { radius: 1200, theta: 0, phi: Math.PI / 2 } // Spherical coordinates around origin

export function initGlobeModule() {
    if (!globeContainer) return

    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(60, globeContainer.clientWidth / globeContainer.clientHeight, 0.1, 10000)
    updateCameraPosition()

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(globeContainer.clientWidth, globeContainer.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    
    globeContainer.innerHTML = ''
    globeContainer.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)

    const earthRadius = 300
    const sphereGeometry = new THREE.SphereGeometry(earthRadius, 32, 32)
    const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x1e3a8a, wireframe: true, transparent: true, opacity: 0.3
    })
    earthSphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
    scene.add(earthSphere)

    // --- Orbit Controls Event Listeners ---
    globeContainer.addEventListener('pointerdown', (e) => {
        isDragging = true
        previousMousePosition = { x: e.clientX, y: e.clientY }
    })

    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return

        const deltaX = e.clientX - previousMousePosition.x
        const deltaY = e.clientY - previousMousePosition.y

        // Adjust rotation angles based on mouse movement speed
        spherical.theta -= deltaX * 0.005
        spherical.phi -= deltaY * 0.005

        // Clamp phi to prevent flipping upside down over the poles
        const EPS = 0.00001
        spherical.phi = Math.max(EPS, Math.min(Math.PI - EPS, spherical.phi))

        previousMousePosition = { x: e.clientX, y: e.clientY }
        updateCameraPosition()
    })

    window.addEventListener('pointerup', () => {
        isDragging = false
    })

    // Handle smooth zooming with the scroll wheel
    globeContainer.addEventListener('wheel', (e) => {
        e.preventDefault()
        spherical.radius += e.deltaY * 0.8
        spherical.radius = Math.max(350, Math.min(4000, spherical.radius)) // Keep within bounds
        updateCameraPosition()
    }, { passive: false })
    // --------------------------------------

    window.addEventListener('resize', () => {
        if (!globeContainer || !renderer) return
        camera.aspect = globeContainer.clientWidth / globeContainer.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(globeContainer.clientWidth, globeContainer.clientHeight)
    })

    if (satSelector) {
        satSelector.addEventListener('change', (event) => {
            selectedSatId = event.target.value
            if (window._lastSatellitesData) {
                updateSatellitesInScene(window._lastSatellitesData)
            }
        })
    }

    if (refreshSatBtn) {
        refreshSatBtn.addEventListener('click', fetchSatelliteSnapshot)
    }

    animateGlobe()
    fetchSatelliteSnapshot()
}

function updateCameraPosition() {
    // Convert spherical coordinates (radius, theta, phi) to Cartesian (x, y, z)
    // Note: Mapping spherical coordinates to align with Three.js Y-up orientation
    const x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta)
    const y = spherical.radius * Math.cos(spherical.phi)
    const z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta)

    camera.position.set(x, y, z)
    camera.lookAt(0, 0, 0)
}

function updateSatelliteDropdown(satellites) {
    if (!satSelector) return
    if (satSelector.options.length !== satellites.length) {
        const previousSelection = satSelector.value
        satSelector.innerHTML = ''
        satellites.forEach(sat => {
            const satId = sat.id || sat.name
            const option = document.createElement('option')
            option.value = satId
            option.innerText = sat.name || satId
            satSelector.appendChild(option)
        })
        if (previousSelection && satellites.some(s => (s.id || s.name) === previousSelection)) {
            satSelector.value = previousSelection
        } else if (satellites.length > 0) {
            satSelector.value = satellites[0].id || satellites[0].name
        }
    }
    if (satSelector.value) selectedSatId = satSelector.value
}

function updateSatellitesInScene(satellites) {
    if (!satellites || satellites.length === 0) return
    updateSatelliteDropdown(satellites)

    const activeIds = new Set()
    let primarySat = null

    // Correct Scale Mapping: Earth radius in km (~6371) maps to Three.js sphere radius (300)
    const EARTH_RADIUS_KM = 6371.0
    const THREE_EARTH_RADIUS = 300.0
    const scale = THREE_EARTH_RADIUS / EARTH_RADIUS_KM

    satellites.forEach(sat => {
        const satId = sat.id || sat.name || 'satellite'
        activeIds.add(satId)

        const isSelected = (satId === selectedSatId) || (!selectedSatId && satellites.indexOf(sat) === 0)
        if (isSelected) primarySat = sat
        
        let mesh = satelliteMeshes.get(satId)

        // Properly map ECI coordinates: Z is celestial north, mapped to Three.js Y
        const posX = (sat.x || 0) * scale
        const posY = (sat.z || 0) * scale 
        const posZ = (sat.y || 0) * scale

        if (!mesh) {
            const geometry = new THREE.SphereGeometry(6, 16, 16)
            const material = new THREE.MeshBasicMaterial({ color: isSelected ? 0xef4444 : 0x38bdf8 })
            mesh = new THREE.Mesh(geometry, material)
            scene.add(mesh)
            satelliteMeshes.set(satId, mesh)
        } else {
            mesh.material.color.setHex(isSelected ? 0xef4444 : 0x38bdf8)
        }

        mesh.position.set(posX, posY, posZ)
    })

    if (!primarySat && satellites.length > 0) primarySat = satellites[0]

    if (primarySat && primarySat.x !== undefined) {
        if (satXEl) satXEl.innerText = Number(primarySat.x).toFixed(2)
        if (satYEl) satYEl.innerText = Number(primarySat.y).toFixed(2)
        if (satZEl) satZEl.innerText = Number(primarySat.z).toFixed(2)
        if (satTimeEl) satTimeEl.innerText = primarySat.time || new Date().toISOString()
    }

    satelliteMeshes.forEach((mesh, id) => {
        if (!activeIds.has(id)) {
            scene.remove(mesh)
            satelliteMeshes.delete(id)
        }
    })
}

function animateGlobe() {
    requestAnimationFrame(animateGlobe)
    if (renderer && scene && camera) {
        renderer.render(scene, camera)
    }
}

async function fetchSatelliteSnapshot() {
    if (satStatusEl) {
        satStatusEl.innerText = 'Fetching Data Snapshot...'
        satStatusEl.style.background = '#334155'
    }

    try {
        const response = await fetch('http://localhost:8000/api/satellites')
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
        
        const data = await response.json()
        const satArray = Array.isArray(data) ? data : (data.satellites || [data])
        window._lastSatellitesData = satArray

        updateSatellitesInScene(satArray)

        if (satStatusEl) {
            satStatusEl.innerText = 'Status: Snapshot Loaded Successfully'
            satStatusEl.style.background = '#065f46'
        }
    } catch (err) {
        console.error('Failed to fetch satellite snapshot:', err)
        if (satStatusEl) {
            satStatusEl.innerText = 'Status: Fetch Failed (Check Server)'
            satStatusEl.style.background = '#991b1b'
        }
    }
}
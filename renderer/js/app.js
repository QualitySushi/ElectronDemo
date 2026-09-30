import { initUI } from './ui.js'

import {
    initSimulation,
    destroySimulation
} from './simulation.js'

import {
    initGlobeModule,
    destroyGlobeModule
} from './globe.js'

import {
    initMaritimeModule,
    destroyMaritimeModule
} from './maritime.js'

import {
    initAttractorModule,
    destroyAttractorModule
} from './attractor.js'

document.addEventListener('DOMContentLoaded', () => {

    initUI()

    const simulationToggle =
        document.getElementById('enableSimulation')

    const globeToggle =
        document.getElementById('enableGlobe')

    const maritimeToggle =
        document.getElementById('enableMaritime')

    const attractorToggle =
        document.getElementById('enableAttractor')

    simulationToggle?.addEventListener('change', () => {
        if (simulationToggle.checked) {
            initSimulation()
        } else {
            destroySimulation()
        }
    })

    globeToggle?.addEventListener('change', () => {
        if (globeToggle.checked) {
            initGlobeModule()
        } else {
            destroyGlobeModule()
        }
    })

    maritimeToggle?.addEventListener('change', () => {
        if (maritimeToggle.checked) {
            initMaritimeModule()
        } else {
            destroyMaritimeModule()
        }
    })

    attractorToggle?.addEventListener('change', () => {
        if (attractorToggle.checked) {
            initAttractorModule()
        } else {
            destroyAttractorModule()
        }
    })

})
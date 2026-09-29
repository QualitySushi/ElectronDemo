import { initUI } from './ui.js'
import { initSimulation } from './simulation.js'
import { initGlobeModule } from './globe.js'

// Initialize all features on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initUI()
    initSimulation()
    initGlobeModule()
})
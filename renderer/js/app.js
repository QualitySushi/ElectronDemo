import { initUI } from './ui.js'
import { initHistoryView } from './history-view.js'

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
    initHistoryView() // Initialize the simulation history table & filtering

    const simulationToggle =
        document.getElementById('enableSimulation')

    const globeToggle =
        document.getElementById('enableGlobe')

    const maritimeToggle =
        document.getElementById('enableMaritime')

    const attractorToggle =
        document.getElementById('enableAttractor')

    const logoutBtn =
        document.getElementById('logoutBtn')

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

    logoutBtn?.addEventListener('click', async () => {
        try {
            // Route the logout through the Electron IPC bridge 
            // which safely calls the backend with the correct /v1 prefix and clears the local store
            const success = await window.versions.logout();
            
            if (success) {
                // Navigate back to the login view
                window.location.href = 'login.html';
            } else {
                alert('Logout failed');
            }
        } catch (err) {
            console.error('Logout failed:', err);
            alert('An error occurred while attempting to log out.');
        }
    });

})
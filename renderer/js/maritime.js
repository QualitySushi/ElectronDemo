import * as THREE from '../../node_modules/three/build/three.module.js';

const maritimeContainer = document.getElementById('maritimeContainer');
const maritimeStatusEl = document.getElementById('maritime-status');
const vesselCountEl = document.getElementById('vessel-count');
const modeEl = document.getElementById('maritime-mode');

let scene, camera, renderer;
let meshGroup = new THREE.Group();
let socket = null;

let isInitialized = false;
let animationFrameId = null;
let reconnectTimeoutId = null;

// Button element for saving config/snapshot
let exportSimSnapshotBtn = null;

// Native 2D Pan & Zoom state for Orthographic Camera
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraZoom = 1.0;
let cameraPan = { x: 0, y: 0 };

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;

export function initMaritimeModule() {
    if (isInitialized || !maritimeContainer) {
        return;
    }

    isInitialized = true;

    const width = maritimeContainer.clientWidth || CANVAS_WIDTH;
    const height = maritimeContainer.clientHeight || CANVAS_HEIGHT;

    camera = new THREE.OrthographicCamera(
        -width / 2,
        width / 2,
        height / 2,
        -height / 2,
        1,
        1000
    );

    camera.position.set(0, 0, 100);

    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true // Required to capture reliable canvas snapshots
    });

    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    const canvas = renderer.domElement;

    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'auto';
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';

    maritimeContainer.innerHTML = '';
    maritimeContainer.appendChild(canvas);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);

    scene.add(ambientLight);
    scene.add(meshGroup);

    // Bind save / snapshot button
    exportSimSnapshotBtn = document.getElementById('exportMaritimeSnapshotBtn');
    if (exportSimSnapshotBtn) {
        exportSimSnapshotBtn.addEventListener('click', handleSaveMaritimeConfiguration);
    }

    canvas.addEventListener(
        'pointerdown',
        handlePointerDown
    );

    canvas.addEventListener(
        'pointermove',
        handlePointerMove
    );

    canvas.addEventListener(
        'pointerup',
        handlePointerUp
    );

    canvas.addEventListener(
        'pointercancel',
        handlePointerCancel
    );

    canvas.addEventListener(
        'wheel',
        handleWheel,
        { passive: false }
    );

    window.addEventListener(
        'resize',
        handleResize
    );

    updateCameraTransform(width, height);

    connectMaritimeWebSocket();

    animateMaritime();

    console.log('[Maritime] Module enabled.');
}

export function destroyMaritimeModule() {
    if (!isInitialized) {
        return;
    }

    isInitialized = false;

    isDragging = false;

    // Prevent a pending reconnect from starting another socket.
    if (reconnectTimeoutId !== null) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
    }

    // Stop the render loop.
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (exportSimSnapshotBtn) {
        exportSimSnapshotBtn.removeEventListener('click', handleSaveMaritimeConfiguration);
        exportSimSnapshotBtn = null;
    }

    const canvas = renderer?.domElement;

    if (canvas) {
        canvas.removeEventListener(
            'pointerdown',
            handlePointerDown
        );

        canvas.removeEventListener(
            'pointermove',
            handlePointerMove
        );

        canvas.removeEventListener(
            'pointerup',
            handlePointerUp
        );

        canvas.removeEventListener(
            'pointercancel',
            handlePointerCancel
        );

        canvas.removeEventListener(
            'wheel',
            handleWheel
        );
    }

    window.removeEventListener(
        'resize',
        handleResize
    );

    // Close the WebSocket.
    if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;

        socket.close();

        socket = null;
    }

    // Dispose all generated maritime meshes.
    clearMeshGroup();

    if (scene && meshGroup) {
        scene.remove(meshGroup);
    }

    // Release the Three.js renderer.
    if (renderer) {
        renderer.dispose();

        renderer.domElement.remove();

        renderer = null;
    }

    scene = null;
    camera = null;

    // Create a fresh group for the next activation.
    meshGroup = new THREE.Group();

    cameraZoom = 1.0;
    cameraPan = {
        x: 0,
        y: 0
    };

    if (vesselCountEl) {
        vesselCountEl.innerText = '0';
    }

    if (modeEl) {
        modeEl.innerText = 'DISABLED';
        modeEl.style.color = '#38bdf8';
    }

    if (maritimeStatusEl) {
        maritimeStatusEl.innerText = 'Disabled';
        maritimeStatusEl.style.background = '#334155';
    }

    console.log('[Maritime] Module disabled.');
}

export function exportMaritimeSnapshot(filename = 'maritime-snapshot.png') {
    if (!isInitialized || !renderer) {
        console.warn('[Maritime] Cannot export snapshot: Module not initialized.');
        return null;
    }

    // Force a render frame to ensure the canvas is up to date
    renderer.render(scene, camera);

    const canvas = renderer.domElement;
    const dataURL = canvas.toDataURL('image/png');

    // Automatically trigger a file download if running in a browser environment
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('[Maritime] Snapshot saved successfully.');
    return dataURL;
}

async function handleSaveMaritimeConfiguration() {
    if (!isInitialized) return;

    const payload = {
        simulation_type: 'maritime',
        sub_type: 'ais_drift',
        configuration: {
            zoom: cameraZoom,
            pan_x: cameraPan.x,
            pan_y: cameraPan.y
        }
    };

    console.log('[Maritime] Saving configuration to database...', payload);

    try {
        const result = await window.versions.saveSimulation(payload);

        if (result && result.success) {
            console.log('[Maritime] Successfully saved to database!');
            if (maritimeStatusEl) {
                maritimeStatusEl.innerText = 'Status: Configuration saved to history!';
            }
        } else {
            console.error('[Maritime] Failed to save configuration:', result?.error);
            if (maritimeStatusEl) {
                maritimeStatusEl.innerText = 'Status: Failed to save configuration.';
            }
        }
    } catch (err) {
        console.error('[Maritime] Error invoking save IPC:', err);
    }
}

function handlePointerDown(event) {
    if (!isInitialized || !renderer) {
        return;
    }

    const canvas = renderer.domElement;

    isDragging = true;

    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };

    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
}

function handlePointerMove(event) {
    if (!isInitialized || !isDragging) {
        return;
    }

    const deltaX =
        event.clientX -
        previousMousePosition.x;

    const deltaY =
        event.clientY -
        previousMousePosition.y;

    cameraPan.x -= deltaX / cameraZoom;
    cameraPan.y += deltaY / cameraZoom;

    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };

    const curWidth =
        maritimeContainer.clientWidth ||
        CANVAS_WIDTH;

    const curHeight =
        maritimeContainer.clientHeight ||
        CANVAS_HEIGHT;

    updateCameraTransform(
        curWidth,
        curHeight
    );
}

function handlePointerUp(event) {
    stopDragging(event);
}

function handlePointerCancel(event) {
    stopDragging(event);
}

function stopDragging(event) {
    isDragging = false;

    if (renderer) {
        renderer.domElement.style.cursor = 'grab';

        if (
            renderer.domElement.hasPointerCapture(
                event.pointerId
            )
        ) {
            renderer.domElement.releasePointerCapture(
                event.pointerId
            );
        }
    }
}

function handleWheel(event) {
    if (!isInitialized) {
        return;
    }

    event.preventDefault();

    const zoomFactor = 1.1;

    if (event.deltaY < 0) {
        cameraZoom *= zoomFactor;
    } else {
        cameraZoom /= zoomFactor;
    }

    cameraZoom = Math.max(
        0.2,
        Math.min(10.0, cameraZoom)
    );

    const curWidth =
        maritimeContainer.clientWidth ||
        CANVAS_WIDTH;

    const curHeight =
        maritimeContainer.clientHeight ||
        CANVAS_HEIGHT;

    updateCameraTransform(
        curWidth,
        curHeight
    );
}

function handleResize() {
    if (
        !isInitialized ||
        !maritimeContainer ||
        !renderer
    ) {
        return;
    }

    const newWidth =
        maritimeContainer.clientWidth ||
        CANVAS_WIDTH;

    const newHeight =
        maritimeContainer.clientHeight ||
        CANVAS_HEIGHT;

    renderer.setSize(
        newWidth,
        newHeight
    );

    updateCameraTransform(
        newWidth,
        newHeight
    );
}

function updateCameraTransform(width, height) {
    if (!camera) {
        return;
    }

    camera.left =
        -width /
        (2 * cameraZoom);

    camera.right =
        width /
        (2 * cameraZoom);

    camera.top =
        height /
        (2 * cameraZoom);

    camera.bottom =
        -height /
        (2 * cameraZoom);

    camera.position.x =
        cameraPan.x;

    camera.position.y =
        cameraPan.y;

    camera.updateProjectionMatrix();
}

function connectMaritimeWebSocket() {
    if (
        !isInitialized ||
        socket
    ) {
        return;
    }

    if (reconnectTimeoutId !== null) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
    }

    if (maritimeStatusEl) {
        maritimeStatusEl.innerText =
            'Connecting to Maritime Stream...';

        maritimeStatusEl.style.background =
            '#334155';
    }

    socket = new WebSocket(
        'ws://localhost:4000/ws/maritime'
    );

    socket.onopen = () => {
        if (!isInitialized) {
            return;
        }

        if (maritimeStatusEl) {
            maritimeStatusEl.innerText =
                'Status: Live Maritime Stream Active';

            maritimeStatusEl.style.background =
                '#065f46';
        }
    };

    socket.onmessage = (event) => {
        if (!isInitialized) {
            return;
        }

        try {
            const payload =
                JSON.parse(event.data);

            if (
                payload.success &&
                payload.data
            ) {
                updateMaritimeScene(
                    payload.data
                );
            }
        } catch (err) {
            console.error(
                'Failed to parse maritime socket frame:',
                err
            );
        }
    };

    socket.onerror = (err) => {
        if (!isInitialized) {
            return;
        }

        console.error(
            'Maritime WebSocket error:',
            err
        );

        if (maritimeStatusEl) {
            maritimeStatusEl.innerText =
                'Status: Stream Error';

            maritimeStatusEl.style.background =
                '#991b1b';
        }
    };

    socket.onclose = () => {
        socket = null;

        if (!isInitialized) {
            return;
        }

        if (maritimeStatusEl) {
            maritimeStatusEl.innerText =
                'Status: Disconnected. Reconnecting...';

            maritimeStatusEl.style.background =
                '#991b1b';
        }

        reconnectTimeoutId = setTimeout(() => {
            reconnectTimeoutId = null;

            if (isInitialized) {
                connectMaritimeWebSocket();
            }
        }, 3000);
    };
}

function clearMeshGroup() {
    while (meshGroup.children.length > 0) {
        const obj = meshGroup.children[0];

        meshGroup.remove(obj);

        if (obj.geometry) {
            obj.geometry.dispose();
        }

        if (
            obj.material &&
            !Array.isArray(obj.material)
        ) {
            obj.material.dispose();
        }
    }
}

function updateMaritimeScene(data) {
    if (
        !isInitialized ||
        !scene
    ) {
        return;
    }

    if (vesselCountEl) {
        vesselCountEl.innerText =
            data.vesselCount ??
            data.points?.length ??
            0;
    }

    if (modeEl) {
        modeEl.innerText =
            data.isLive
                ? 'LIVE AIS'
                : 'DRIFT SIM';

        modeEl.style.color =
            data.isLive
                ? '#22c55e'
                : '#38bdf8';
    }

    clearMeshGroup();

    const transformX = (x) =>
        x - CANVAS_WIDTH / 2;

    const transformY = (y) =>
        CANVAS_HEIGHT / 2 - y;

    if (data.polygons) {
        data.polygons.forEach(
            (poly) => {
                if (
                    !poly.vertices ||
                    poly.vertices.length < 3
                ) {
                    return;
                }

                const shape =
                    new THREE.Shape();

                poly.vertices.forEach(
                    (v, index) => {
                        if (
                            !isFinite(v[0]) ||
                            !isFinite(v[1])
                        ) {
                            return;
                        }

                        const px =
                            transformX(v[0]);

                        const py =
                            transformY(v[1]);

                        if (index === 0) {
                            shape.moveTo(
                                px,
                                py
                            );
                        } else {
                            shape.lineTo(
                                px,
                                py
                            );
                        }
                    }
                );

                const geometry =
                    new THREE.ShapeGeometry(
                        shape
                    );

                const normalizedDensity =
                    Math.min(
                        Math.max(
                            1000 /
                            (poly.area + 1),
                            0.1
                        ),
                        1.0
                    );

                const material =
                    new THREE.MeshBasicMaterial({
                        color: 0x38bdf8,
                        transparent: true,
                        opacity:
                            normalizedDensity *
                            0.15,
                        side: THREE.DoubleSide
                    });

                const mesh =
                    new THREE.Mesh(
                        geometry,
                        material
                    );

                meshGroup.add(mesh);

                const edgesGeometry =
                    new THREE.EdgesGeometry(
                        geometry
                    );

                const lineMaterial =
                    new THREE.LineBasicMaterial({
                        color: 0x38bdf8,
                        transparent: true,
                        opacity:
                            normalizedDensity *
                            0.5
                    });

                const wireframe =
                    new THREE.LineSegments(
                        edgesGeometry,
                        lineMaterial
                    );

                meshGroup.add(
                    wireframe
                );
            }
        );
    }

    if (data.points) {
        const pointGeo =
            new THREE.CircleGeometry(
                3,
                16
            );

        const pointMat =
            new THREE.MeshBasicMaterial({
                color: data.isLive
                    ? 0x22c55e
                    : 0x38bdf8
            });

        data.points.forEach(
            (pt) => {
                if (
                    !isFinite(pt[0]) ||
                    !isFinite(pt[1])
                ) {
                    return;
                }

                const px =
                    transformX(pt[0]);

                const py =
                    transformY(pt[1]);

                const pointMesh =
                    new THREE.Mesh(
                        pointGeo.clone(),
                        pointMat.clone()
                    );

                pointMesh.position.set(
                    px,
                    py,
                    1
                );

                meshGroup.add(
                    pointMesh
                );
            }
        );

        pointGeo.dispose();
        pointMat.dispose();
    }
}

function animateMaritime() {
    if (!isInitialized) {
        return;
    }

    animationFrameId =
        requestAnimationFrame(
            animateMaritime
        );

    if (
        renderer &&
        scene &&
        camera
    ) {
        renderer.render(
            scene,
            camera
        );
    }
}
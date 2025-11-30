// WebGL-only Neural Cellular Automata Application
// This application requires WebGL2 support and will not run without it

let nca;
let canvas;
let ctx;
let animationId = null;
let zoom = 1.0;
let panX = 0;
let panY = 0;

// FPS limiting
const TARGET_FPS = 120;
const FRAME_INTERVAL = 1000 / TARGET_FPS; // milliseconds per frame
let lastFrameTime = 0;

// Calculation display management
let calculationDisplayCollapsed = true;

// Loading state management
let isInitializing = false;

// Function to wait for NeuralCAWebGL class to be available
function waitForNeuralCAWebGL() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; // Wait up to 5 seconds
        
        function checkClass() {
            if (typeof NeuralCAWebGL !== 'undefined') {
                console.log('✅ NeuralCAWebGL class is now available');
                resolve();
            } else {
                attempts++;
                if (attempts >= maxAttempts) {
                    console.error('❌ Timeout waiting for NeuralCAWebGL class');
                    reject(new Error('NeuralCAWebGL class not available after timeout'));
                } else {
                    console.log(`⏳ Waiting for NeuralCAWebGL class... (${attempts}/${maxAttempts})`);
                    setTimeout(checkClass, 100);
                }
            }
        }
        
        checkClass();
    });
}

// Function to update the calculation display
function updateCalculationDisplay(action, data) {
    if (!nca) return;
    
    const config = nca.getNetworkConfig();
    
    // Update basic network configuration
    updateElement('calcGridSize', `${config.gridSize}×${config.gridSize}`);
    updateElement('calcChannels', config.numChannels);
    updateElement('calcWeightCount', config.weightCount);
    updateElement('calcActivation', config.activationFunc.toUpperCase());
    updateElement('calcWeightRange', `±${config.weightRange}`);
    updateElement('calcSteps', config.stepCount);
    updateElement('calcFPS', config.fps);
    updateElement('calcStatus', nca.running ? 'RUNNING' : 'STOPPED');
    
    // Update activation scale
    const activationScaleSelect = safeGetElement('activationScale');
    if (activationScaleSelect) {
        updateElement('calcActScale', parseFloat(activationScaleSelect.value).toFixed(1));
    }
    
    // Handle specific actions
    switch (action) {
        case 'init':
            updateElement('calcInitType', data.strategy.toUpperCase(), true);
            updateElement('calcInitTime', formatTime(data.timestamp), true);
            updateKernelMatrix(); // Let updateKernelMatrix get the effective weights itself
            break;
            
        case 'mutation':
            updateElement('calcMutationType', data.type.toUpperCase(), true);
            updateElement('calcMutationRate', `${(data.rate * 100).toFixed(1)}%`, true);
            updateElement('calcMutationStr', `${(data.strength * 100).toFixed(1)}%`, true);
            // Update kernel matrix with effective weights
            updateKernelMatrix();
            break;
            
        case 'reset':
            updateElement('calcSteps', 0, true);
            // Update kernel matrix with effective weights after reset
            updateKernelMatrix();
            break;
            
        case 'control_change':
            // Live update without animation for control changes
            updateKernelMatrix();
            break;
    }
}

// Helper function to update element with optional animation
function updateElement(id, value, animate = false) {
    const element = safeGetElement(id);
    if (element) {
        element.textContent = value;
        if (animate) {
            const parent = element.closest('.calc-item');
            if (parent) {
                parent.classList.add('updated');
                setTimeout(() => {
                    parent.classList.remove('updated');
                }, 500);
            }
        }
    }
}

// Function to update the kernel matrix display with effective (scaled) weights
function updateKernelMatrix(weights) {
    // Use effective weights if available, fallback to raw weights
    const effectiveWeights = nca && nca.getEffectiveWeights ? nca.getEffectiveWeights() : weights;
    
    if (!effectiveWeights || effectiveWeights.length < 9) return;
    
    const kernelPositions = [
        'kernel00', 'kernel01', 'kernel02',
        'kernel10', 'kernel11', 'kernel12',
        'kernel20', 'kernel21', 'kernel22'
    ];
    
    // Get current kernel selection to highlight the selected kernel
    const kernelSelect = safeGetElement('kernelSelect');
    const selectedKernel = kernelSelect ? parseInt(kernelSelect.value) : -1;
    
    kernelPositions.forEach((id, index) => {
        const element = safeGetElement(id);
        if (element && effectiveWeights[index] !== undefined) {
            const weight = effectiveWeights[index];
            const displayValue = weight >= 0 ? 
                `+${weight.toFixed(2)}` : 
                weight.toFixed(2);
            element.textContent = displayValue;
            
            // Add update animation
            element.classList.add('updated');
            setTimeout(() => {
                element.classList.remove('updated');
            }, 600);
            
            // Color code based on weight value
            let color = '#cccccc'; // neutral/zero
            if (weight > 0.01) {
                color = '#00ff00'; // positive - green
            } else if (weight < -0.01) {
                color = '#ff6666'; // negative - red
            }
            
            // Highlight selected kernel with brighter color and border
            if (index === selectedKernel) {
                element.style.border = '2px solid #ffff00'; // yellow border for selected
                element.style.backgroundColor = 'rgba(255, 255, 0, 0.1)'; // subtle yellow background
                if (weight > 0.01) {
                    color = '#00ff88'; // brighter green for selected positive
                } else if (weight < -0.01) {
                    color = '#ff8888'; // brighter red for selected negative
                } else {
                    color = '#ffffff'; // white for selected neutral
                }
            } else {
                element.style.border = '1px solid #444'; // default border
                element.style.backgroundColor = 'transparent'; // default background
            }
            
            element.style.color = color;
        }
    });
}

// Function to format time for display
function formatTime(date) {
    if (!date) return '--:--:--';
    return date.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Function to setup calculation display
function setupCalculationDisplay() {
    const calcDisplay = safeGetElement('calculationDisplay');
    const calcToggle = safeGetElement('toggleCalcDisplay');
    const calcHeader = safeGetElement('calculationDisplay')?.querySelector('.calc-header');
    
    if (!calcDisplay || !calcToggle) return;
    
    // Toggle calculation display
    const toggleCalcDisplay = () => {
        calculationDisplayCollapsed = !calculationDisplayCollapsed;
        if (calculationDisplayCollapsed) {
            calcDisplay.classList.add('collapsed');
        } else {
            calcDisplay.classList.remove('collapsed');
        }
    };
    
    // Add click handlers
    if (calcToggle) {
        calcToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCalcDisplay();
        });
    }
    
    if (calcHeader) {
        calcHeader.addEventListener('click', toggleCalcDisplay);
    }
    
    // Initialize display with comprehensive update
    setTimeout(() => {
        if (nca) {
            updateCalculationDisplay('init', {
                strategy: nca.weightInitStrategy || 'xavier',
                weightRange: nca.weightRange || 2.0,
                timestamp: new Date(),
                weights: nca.getSampleWeights ? nca.getSampleWeights() : null
            });
            
            // Trigger additional live updates to populate all current control values
            triggerCalculationUpdate();
        }
    }, 100);
}

function showWebGLError() {
    // Hide the canvas and controls
    const canvas = document.getElementById('ncaCanvas');
    const controls = document.getElementById('controls');
    const controlsToggle = document.getElementById('controlsToggle');
    const calcDisplay = document.getElementById('calculationDisplay');
    
    if (canvas) canvas.style.display = 'none';
    if (controls) controls.style.display = 'none';
    if (controlsToggle) controlsToggle.style.display = 'none';
    if (calcDisplay) calcDisplay.style.display = 'none';
    
    // Create and show error message
    const errorDiv = document.createElement('div');
    errorDiv.id = 'webgl-error';
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #000000;
        border: 2px solid #ffffff;
        border-radius: 8px;
        padding: 30px;
        color: #ffffff;
        font-family: 'Courier New', monospace;
        text-align: center;
        max-width: 600px;
        z-index: 10000;
    `;
    
    errorDiv.innerHTML = `
        <h2 style="color: #ff4141; margin-top: 0; text-transform: uppercase; letter-spacing: 2px;">
            ❌ WebGL2 Required ❌
        </h2>
        <p style="margin: 20px 0; line-height: 1.6;">
            Moonlight Pools requires <strong>WebGL2</strong> support to run.
        </p>
        <p style="margin: 20px 0; line-height: 1.6;">
            Your browser either doesn't support WebGL2 or it's disabled.
        </p>
        <div style="margin: 30px 0; padding: 20px; background: rgba(255, 65, 65, 0.1); border: 1px solid rgba(255, 65, 65, 0.3); border-radius: 4px;">
            <h3 style="margin-top: 0; color: #ff8888;">How to Fix:</h3>
            <ul style="text-align: left; margin: 0; padding-left: 20px;">
                <li>Use a modern browser (Chrome 56+, Firefox 51+, Safari 15+, Edge 79+)</li>
                <li>Enable hardware acceleration in your browser settings</li>
                <li>Update your graphics drivers</li>
                <li>Try a different browser if the issue persists</li>
            </ul>
        </div>
        <p style="margin: 20px 0; font-size: 0.9em; color: #cccccc;">
            WebGL2 support is required for GPU-accelerated neural network computations.
        </p>
    `;
    
    document.body.appendChild(errorDiv);
    
    console.error('Neural Cellular Automata: WebGL2 not supported. Application cannot run.');
}

function resizeCanvas() {
    const availableHeight = window.innerHeight;
    const availableWidth = window.innerWidth;
    
    // Set canvas internal resolution to match CSS size for pixel-perfect rendering
    canvas.width = availableWidth;
    canvas.height = availableHeight;
    
    // Position canvas to fill the entire viewport
    canvas.style.left = '0px';
    canvas.style.top = '0px';
    canvas.style.width = `${availableWidth}px`;
    canvas.style.height = `${availableHeight}px`;
    
    // Ensure the context settings are maintained after resize
    if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
    }
}

function getMinZoom() {
    // Calculate minimum zoom so grid fits entirely in canvas
    const minZoomX = canvas.width / nca.gridSize;
    const minZoomY = canvas.height / nca.gridSize;
    return Math.min(minZoomX, minZoomY);
}

async function init() {
    console.log('Initializing Moonlight Pools...');
    
    // Prevent multiple initialization attempts
    if (isInitializing) {
        console.log('Already initializing, skipping...');
        return;
    }
    
    isInitializing = true;
    
    // Test DOM elements first
    if (!testDOMElements()) {
        console.error('❌ DOM elements test failed, cannot proceed');
        isInitializing = false;
        return;
    }
    
    canvas = document.getElementById('ncaCanvas');
    if (!canvas) {
        console.error('Canvas element not found');
        showWebGLError();
        isInitializing = false;
        return;
    }
    
    console.log('Canvas found:', canvas);
    
    try {
        ctx = canvas.getContext('2d', { 
            alpha: false,
            imageSmoothingEnabled: false // Disable image smoothing for crisp pixels
        });
        if (!ctx) {
            console.error('Failed to get 2D context');
            showWebGLError();
            isInitializing = false;
            return;
        }
        
        // Set additional properties for crisp pixel rendering
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        
        console.log('2D context acquired successfully');
    } catch (error) {
        console.error('Error getting 2D context:', error);
        showWebGLError();
        isInitializing = false;
        return;
    }
    
    resizeCanvas();
    console.log('Canvas resized');
    
    // Large grid for high detail
    const gridSize = 1600;
    const channels = 2; // Start with color mode (2 channels)
    
    // Check if WebGL2 is available
    let webgl2Supported = false;
    try {
        const testCanvas = document.createElement('canvas');
        const testGL = testCanvas.getContext('webgl2');
        webgl2Supported = !!testGL;
        
        // Also try to get some basic WebGL info to ensure it's really working
        if (testGL) {
            const version = testGL.getParameter(testGL.VERSION);
            console.log('WebGL2 version detected:', version);
        }
    } catch (error) {
        console.error('Error testing WebGL2 support:', error);
        webgl2Supported = false;
    }
    
    // Check if WebGL class is loaded
    if (!webgl2Supported) {
        console.error('WebGL2 not supported by this browser');
        showWebGLError();
        isInitializing = false;
        return;
    }
    
    // Wait for NeuralCAWebGL class to be available
    try {
        await waitForNeuralCAWebGL();
    } catch (error) {
        console.error('NeuralCAWebGL class not available:', error);
        showWebGLError();
        isInitializing = false;
        return;
    }
    
    console.log('NeuralCAWebGL class is available');
    
    // Initialize WebGL implementation only
    try {
        console.log('Initializing WebGL Neural Cellular Automata...');
        nca = new NeuralCAWebGL(gridSize, channels);
        
        if (!nca || !nca.gl) {
            throw new Error('WebGL NCA initialization failed - no GL context');
        }
        
        console.log('✅ WebGL acceleration enabled');
        
        // Show WebGL indicator in UI
        const indicator = document.createElement('div');
        indicator.id = 'webgl-indicator';
        indicator.style.cssText = 'position: fixed; bottom: 10px; right: 10px; background: rgba(0,0,0,0.8); color: #fff; padding: 5px 10px; border: 1px solid #fff; border-radius: 4px; font-size: 12px; z-index: 1000; font-family: monospace;';
        indicator.textContent = '✅ WebGL2 Ready';
        document.body.appendChild(indicator);
        
        // Sync UI controls with NCA settings after creation
        console.log('Syncing UI controls...');
        syncUIControls();
        
        console.log('Resetting NCA state...');
        nca.reset();
        
        updateGridSizeDisplay();
        updateChannelModeDisplay();
        
        // Setup event listeners with error handling
        try {
            console.log('Setting up event listeners...');
            setupEventListeners();
            console.log('Setting up calculation display...');
            setupCalculationDisplay();
            console.log('Event listeners setup complete');
        } catch (error) {
            console.error('Error setting up event listeners:', error);
            console.warn('Some controls may not work properly, but the simulation should still function');
        }
        
        // Set initial zoom to fill viewport
        console.log('Setting initial view...');
        resetView();
        
        console.log('🎉 Neural Cellular Automata initialization complete');
        
        // Initial render
        console.log('Performing initial render...');
        render();
        
    } catch (error) {
        console.error('WebGL initialization failed:', error);
        showWebGLError();
        return;
    } finally {
        isInitializing = false;
    }
}

// Function to test DOM elements before full initialization
function testDOMElements() {
    console.log('🧪 Testing DOM elements...');
    
    const requiredElements = [
        'ncaCanvas',
        'controlsToggle',
        'controls',
        'calculationDisplay',
        'toggleCalcDisplay',
        'startBtn',
        'pauseBtn',
        'resetBtn',
        'randomizeBtn'
    ];
    
    let missing = [];
    
    for (const id of requiredElements) {
        const element = document.getElementById(id);
        if (!element) {
            missing.push(id);
        } else {
            console.log(`✅ ${id}:`, element.tagName, element.classList.toString());
        }
    }
    
    if (missing.length > 0) {
        console.error('❌ Missing DOM elements:', missing);
        return false;
    } else {
        console.log('✅ All required DOM elements found');
        return true;
    }
}

// Helper function to safely get element by ID with debugging
function safeGetElement(id) {
    try {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with ID '${id}' not found`);
        }
        return element;
    } catch (error) {
        console.error(`Error accessing element with ID '${id}':`, error);
        return null;
    }
}

// Sync UI controls with NCA settings
function syncUIControls() {
    // Sync steps per frame from UI to NCA
    const stepsPerFrameSelect = safeGetElement('stepsPerFrame');
    if (stepsPerFrameSelect && stepsPerFrameSelect.value) {
        nca.stepsPerFrame = parseInt(stepsPerFrameSelect.value);
    }
    
    // Sync activation function from UI to NCA
    const activationSelect = safeGetElement('activation');
    if (activationSelect && activationSelect.value) {
        nca.activationFunc = activationSelect.value;
    }
    
    // Sync weight range from UI to NCA
    const weightRangeSelect = safeGetElement('weightRange');
    if (weightRangeSelect && weightRangeSelect.value) {
        nca.weightRange = parseFloat(weightRangeSelect.value);
    }
    
    // Sync mutation rate from UI to NCA
    const mutationRateSelect = safeGetElement('mutationRate');
    if (mutationRateSelect && mutationRateSelect.value) {
        nca.setMutationRate(parseFloat(mutationRateSelect.value));
    }
    
    // Sync channel count from UI to NCA
    const channelCountSelect = safeGetElement('channelCount');
    if (channelCountSelect && channelCountSelect.value) {
        const selectedChannels = parseInt(channelCountSelect.value);
        if (selectedChannels !== nca.numChannels) {
            console.log(`UI shows ${selectedChannels} channels, NCA has ${nca.numChannels} channels`);
        }
    }
    
    // Sync new advanced controls
    syncActivationParams();
    syncKernelControls();
    syncAllKernelScales();
    syncWeightControls();
    syncMutationControls();
    syncChannelScales();
    syncMutationMasks();
}

function syncActivationParams() {
    const scaleSelect = safeGetElement('activationScale');
    
    if (scaleSelect && nca.setActivationParams) {
        const scale = parseFloat(scaleSelect.value) || 1.0;
        
        // Update activation parameters for current function
        const currentFunc = nca.activationFunc;
        nca.setActivationParams(currentFunc, { scale: scale });
    }
}

function syncKernelControls() {
    const kernelSelect = safeGetElement('kernelSelect');
    const kernelScale = safeGetElement('kernelScale');
    
    if (kernelSelect && kernelScale && nca.setKernelWeightScale) {
        const selectedKernel = parseInt(kernelSelect.value);
        const scale = parseFloat(kernelScale.value);
        
        // Apply scale to selected kernel position
        nca.setKernelWeightScale(selectedKernel, scale);
        
        // Update status display
        updateSelectedKernelDisplay();
        
        console.log(`Applied kernel scale ${scale}x to position ${selectedKernel}`);
    }
}

// Add a function to sync all kernel scales from the mask settings
function syncAllKernelScales() {
    if (!nca.setKernelWeightScale) return;
    
    // Reset all kernel scales to 1.0 first
    for (let i = 0; i < 9; i++) {
        nca.setKernelWeightScale(i, 1.0);
    }
    
    // Then apply the current selected kernel's scale
    const kernelSelect = safeGetElement('kernelSelect');
    const kernelScale = safeGetElement('kernelScale');
    
    if (kernelSelect && kernelScale) {
        const selectedKernel = parseInt(kernelSelect.value);
        const scale = parseFloat(kernelScale.value);
        nca.setKernelWeightScale(selectedKernel, scale);
    }
}

function syncWeightControls() {
    const initStrategySelect = safeGetElement('weightInitStrategy');
    
    if (initStrategySelect && nca.setWeightInitStrategy) {
        nca.setWeightInitStrategy(initStrategySelect.value);
    }
}

function syncMutationControls() {
    const patternSelect = safeGetElement('mutationPattern');
    const strengthSelect = safeGetElement('mutationStrength');
    
    if (patternSelect && nca.setMutationPattern) {
        nca.setMutationPattern(patternSelect.value);
        // Update status display
        const lastMutationType = safeGetElement('lastMutationType');
        if (lastMutationType) {
            lastMutationType.textContent = patternSelect.value.toUpperCase();
        }
    }
    
    if (strengthSelect && nca.setMutationStrength) {
        nca.setMutationStrength(parseFloat(strengthSelect.value));
    }
}

function syncChannelScales() {
    if (!nca.setChannelWeightScale) return;
    
    for (let i = 0; i < 4; i++) {
        const scaleSelect = safeGetElement(`channel${i}Scale`);
        if (scaleSelect) {
            nca.setChannelWeightScale(i, parseFloat(scaleSelect.value));
        }
    }
}

function syncMutationMasks() {
    // Channel mutation masks
    if (nca.setChannelMutationMask) {
        for (let i = 0; i < 4; i++) {
            const checkbox = safeGetElement(`mutateCh${i}`);
            if (checkbox) {
                nca.setChannelMutationMask(i, checkbox.checked);
            }
        }
    }
    
    // Kernel position mutation masks
    if (nca.setKernelMutationMask) {
        for (let i = 0; i < 9; i++) {
            const checkbox = safeGetElement(`kernel${i}`);
            if (checkbox) {
                nca.setKernelMutationMask(i, checkbox.checked);
            }
        }
    }
}

function updateGridSizeDisplay() {
    const gridSizeElements = document.querySelectorAll('#gridSize');
    gridSizeElements.forEach(el => {
        if (el && nca) {
            el.textContent = nca.gridSize;
        }
    });
}

function updateChannelModeDisplay() {
    const channelModeEl = safeGetElement('channelMode');
    const channelCountValueEl = safeGetElement('channelCountValue');
    
    if (channelModeEl && nca) {
        channelModeEl.textContent = nca.numChannels;
    }
    
    if (channelCountValueEl && nca) {
        channelCountValueEl.textContent = nca.numChannels;
    }
}

function constrainPan() {
    // Calculate the visible grid area in grid coordinates
    const visibleWidth = canvas.width / zoom;
    const visibleHeight = canvas.height / zoom;
    
    // Calculate maximum pan distances from center
    // When zoomed out enough to see the entire grid, don't allow panning
    const maxPanX = Math.max(0, (nca.gridSize - visibleWidth) / 2);
    const maxPanY = Math.max(0, (nca.gridSize - visibleHeight) / 2);
    
    // Constrain pan to prevent seeing beyond grid bounds
    panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
    panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
}

function setZoom(newZoom) {
    const minZoom = getMinZoom();
    zoom = Math.max(minZoom, Math.min(10, newZoom));
    constrainPan(); // Constrain pan after zoom change
    const zoomValueEl = safeGetElement('zoomValue');
    if (zoomValueEl) {
        zoomValueEl.textContent = zoom.toFixed(2);
    }
    render();
}

function resetView() {
    // Reset zoom to show a reasonable portion of the grid (not the entire grid which would be too zoomed out)
    // Since the grid is 1600x1600, showing the whole thing would make details too small
    // Instead, zoom to show roughly 1/4 of the grid (400x400) initially
    const targetViewSize = 400; // Show roughly 400x400 pixels of the grid initially
    const zoomToFitWidth = canvas.width / targetViewSize;
    const zoomToFitHeight = canvas.height / targetViewSize;
    zoom = Math.min(zoomToFitWidth, zoomToFitHeight);
    
    // Reset pan to center
    panX = 0;
    panY = 0;
    
    constrainPan(); // Ensure we're within bounds
    const zoomValueEl = safeGetElement('zoomValue');
    if (zoomValueEl) {
        zoomValueEl.textContent = zoom.toFixed(2);
    }
    render();
}

function setupEventListeners() {
    // Controls toggle functionality
    const controlsBox = safeGetElement('controls');
    const controlsToggle = safeGetElement('controlsToggle');
    const closeControls = safeGetElement('closeControls');
    
    // Function to show controls
    function showControls() {
        if (controlsBox) {
            controlsBox.classList.remove('collapsed');
        }
    }
    
    // Function to hide controls
    function hideControls() {
        if (controlsBox) {
            controlsBox.classList.add('collapsed');
        }
    }
    
    // Function to toggle controls
    function toggleControls() {
        if (controlsBox) {
            if (controlsBox.classList.contains('collapsed')) {
                showControls();
            } else {
                hideControls();
            }
        }
    }
    
    // Toggle button event
    if (controlsToggle) {
        controlsToggle.addEventListener('click', toggleControls);
    }
    
    // Close button event
    if (closeControls) {
        closeControls.addEventListener('click', hideControls);
    }
    
    // Close controls when clicking outside
    document.addEventListener('click', (e) => {
        if (controlsBox && controlsToggle && !controlsBox.contains(e.target) && !controlsToggle.contains(e.target)) {
            hideControls();
        }
    });
    
    // Prevent canvas interactions when clicking on controls
    if (controlsBox) {
        controlsBox.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ignore keyboard shortcuts when typing in form elements
        if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') {
            return;
        }
        
        // Prevent default behavior for our handled keys
        switch(e.key.toLowerCase()) {
            case 'r':
                e.preventDefault();
                if (e.shiftKey) {
                    // Shift+R: Randomize weights
                    nca.initializeWeights();
                    updateCalculationDisplay('init', {
                        strategy: nca.weightInitStrategy || 'xavier',
                        weightRange: nca.weightRange || 2.0,
                        timestamp: new Date()
                    });
                } else {
                    // R: Reset simulation
                    nca.initializeWeights();
                    nca.reset();
                    updateCalculationDisplay('reset', {
                        timestamp: new Date(),
                        gridSize: nca.gridSize
                    });
                    render();
                }
                break;
            case ' ':
                e.preventDefault();
                // Spacebar: Toggle play/pause
                if (nca.running) {
                    stopAnimation();
                } else {
                    startAnimation();
                }
                break;
            case 'm':
                e.preventDefault();
                // M: Mutate weights
                nca.mutateWeights();
                break;
            case 'e':
                e.preventDefault();
                // E: Toggle auto-evolve
                const autoEvolveBtn = safeGetElement('autoEvolveBtn');
                if (nca.autoEvolveEnabled) {
                    nca.disableAutoEvolve();
                    if (autoEvolveBtn) {
                        autoEvolveBtn.textContent = 'AUTO_EVOLVE';
                        autoEvolveBtn.classList.remove('active');
                    }
                } else {
                    nca.enableAutoEvolve();
                    if (autoEvolveBtn) {
                        autoEvolveBtn.textContent = 'STOP_EVOLVE';
                        autoEvolveBtn.classList.add('active');
                    }
                }
                break;
        }
    });
    
    // Resize canvas on window resize
    window.addEventListener('resize', () => {
        resizeCanvas();
        // Adjust zoom if it's now below minimum
        const minZoom = getMinZoom();
        if (zoom < minZoom) {
            setZoom(minZoom);
        }
        constrainPan();
        render();
    });
    
    // Zoom with mouse wheel
    if (canvas) {
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(zoom * zoomDelta);
        }, { passive: false });
    }
    
    // Zoom buttons - using safe element access
    const zoomInBtn = safeGetElement('zoomInBtn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            setZoom(zoom * 1.2);
        });
    }
    
    const zoomOutBtn = safeGetElement('zoomOutBtn');
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            setZoom(zoom / 1.2);
        });
    }
    
    const zoomResetBtn = safeGetElement('zoomResetBtn');
    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', () => {
            resetView();
        });
    }
    
    // Control buttons - using safe element access
    const startBtn = safeGetElement('startBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            startAnimation();
            // Immediately update the status in calculation display
            updateElement('calcStatus', 'RUNNING');
        });
    }
    
    const pauseBtn = safeGetElement('pauseBtn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            stopAnimation();
            // Immediately update the status in calculation display
            updateElement('calcStatus', 'STOPPED');
        });
    }
    
    const resetBtn = safeGetElement('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            nca.initializeWeights();
            nca.reset();
            updateCalculationDisplay('reset', {
                timestamp: new Date(),
                gridSize: nca.gridSize
            });
            render();
        });
    }
    
    const randomizeBtn = safeGetElement('randomizeBtn');
    if (randomizeBtn) {
        randomizeBtn.addEventListener('click', () => {
            nca.initializeWeights();
            updateCalculationDisplay('init', {
                strategy: nca.weightInitStrategy || 'xavier',
                weightRange: nca.weightRange || 2.0,
                timestamp: new Date()
            });
            updateInitStrategyDisplay();
        });
    }
    
    // Channel count control
    const channelCountSelect = safeGetElement('channelCount');
    if (channelCountSelect) {
        channelCountSelect.addEventListener('input', (e) => {
            const newChannels = parseInt(e.target.value);
            const wasRunning = nca.running;
            
            // Stop current animation
            stopAnimation();
            
            // Dispose of old WebGL instance
            if (nca.dispose) {
                nca.dispose();
            }
            
            const gridSize = nca.gridSize;
            
            // Create new WebGL instance
            nca = new NeuralCAWebGL(gridSize, newChannels);
            
            // Sync UI controls with the new NCA instance
            syncUIControls();
            
            nca.reset();
            
            updateGridSizeDisplay();
            updateChannelModeDisplay();
            
            // Update calculation display with new configuration
            triggerCalculationUpdate();
            
            // Restart animation if it was running
            if (wasRunning) {
                startAnimation();
            } else {
                render();
            }
        });
    }
    
    // Pan interaction
    let isPanning = false;
    let isLeftDragging = false;
    let lastPanX = 0;
    let lastPanY = 0;
    let mouseDownX = 0;
    let mouseDownY = 0;
    const dragThreshold = 5; // pixels to distinguish click from drag
    
    if (canvas) {
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                mouseDownX = e.clientX;
                mouseDownY = e.clientY;
                lastPanX = e.clientX;
                lastPanY = e.clientY;
                isLeftDragging = false;
            } else if (e.button === 1 || e.button === 2) { // Middle or right click
                e.preventDefault();
                isPanning = true;
                lastPanX = e.clientX;
                lastPanY = e.clientY;
                canvas.style.cursor = 'grabbing';
            }
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) { // Left button is down
                const dx = e.clientX - mouseDownX;
                const dy = e.clientY - mouseDownY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // If moved more than threshold, consider it a drag
                if (distance > dragThreshold) {
                    isLeftDragging = true;
                    canvas.style.cursor = 'grabbing';
                    
                    // Pan the canvas - FIXED: Reverse the delta direction for natural panning
                    const panDx = -(e.clientX - lastPanX) / canvas.width * nca.gridSize / zoom;
                    const panDy = -(e.clientY - lastPanY) / canvas.height * nca.gridSize / zoom;
                    panX += panDx;
                    panY += panDy;
                    constrainPan();
                    lastPanX = e.clientX;
                    lastPanY = e.clientY;
                    render();
                }
            } else if (isPanning) {
                // Pan the canvas - FIXED: Reverse the delta direction for natural panning
                const dx = -(e.clientX - lastPanX) / canvas.width * nca.gridSize / zoom;
                const dy = -(e.clientY - lastPanY) / canvas.height * nca.gridSize / zoom;
                panX += dx;
                panY += dy;
                constrainPan();
                lastPanX = e.clientX;
                lastPanY = e.clientY;
                render();
            }
        });
        
        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) { // Left click
                isLeftDragging = false;
                canvas.style.cursor = 'default';
            } else if (e.button === 1 || e.button === 2) {
                isPanning = false;
                canvas.style.cursor = 'default';
            }
        });
        
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    // Basic parameter controls - using safe element access
    const activationSelect = safeGetElement('activation');
    if (activationSelect) {
        activationSelect.addEventListener('change', (e) => {
            nca.activationFunc = e.target.value;
            syncActivationParams(); // Apply current activation parameters
            triggerCalculationUpdate(); // Update calculation display
        });
    }
    
    const stepsPerFrameSelect = safeGetElement('stepsPerFrame');
    if (stepsPerFrameSelect) {
        stepsPerFrameSelect.addEventListener('change', (e) => {
            nca.stepsPerFrame = parseInt(e.target.value);
            // Note: stepsPerFrame is not currently shown in calc display, but we could add it
        });
    }
    
    // Weight range control
    const weightRangeSelect = safeGetElement('weightRange');
    if (weightRangeSelect) {
        weightRangeSelect.addEventListener('change', (e) => {
            nca.weightRange = parseFloat(e.target.value);
            triggerCalculationUpdate(); // Update calculation display
        });
    }
    
    // Enhanced activation function parameter controls
    const activationScaleSelect = safeGetElement('activationScale');
    if (activationScaleSelect) {
        activationScaleSelect.addEventListener('change', (e) => {
            syncActivationParams();
            triggerCalculationUpdate(); // Update calculation display
        });
    }
    
    // Kernel selection and scaling controls
    const kernelSelect = safeGetElement('kernelSelect');
    if (kernelSelect) {
        kernelSelect.addEventListener('change', (e) => {
            syncAllKernelScales(); // Reset all and apply current
            updateSelectedKernelDisplay();
            triggerCalculationUpdate(); // Update calculation display
        });
    }
    
    const kernelScale = safeGetElement('kernelScale');
    if (kernelScale) {
        kernelScale.addEventListener('change', (e) => {
            syncKernelControls();
            triggerCalculationUpdate(); // Update calculation display
        });
    }
    
    // Weight initialization and constraints
    const weightInitStrategy = safeGetElement('weightInitStrategy');
    if (weightInitStrategy) {
        weightInitStrategy.addEventListener('change', (e) => {
            nca.setWeightInitStrategy(e.target.value);
            updateInitStrategyDisplay();
            triggerCalculationUpdate(); // Update calculation display
        });
    }
    
    // Mutation controls
    const mutateBtn = safeGetElement('mutateBtn');
    if (mutateBtn) {
        mutateBtn.addEventListener('click', () => {
            nca.mutateWeights();
        });
    }
    
    const autoEvolveBtn = safeGetElement('autoEvolveBtn');
    if (autoEvolveBtn) {
        autoEvolveBtn.addEventListener('click', (e) => {
            if (nca.autoEvolveEnabled) {
                nca.disableAutoEvolve();
                e.target.textContent = 'AUTO_EVOLVE';
                e.target.classList.remove('active');
            } else {
                nca.enableAutoEvolve();
                e.target.textContent = 'STOP_EVOLVE';
                e.target.classList.add('active');
            }
        });
    }
    
    const mutationRate = safeGetElement('mutationRate');
    if (mutationRate) {
        mutationRate.addEventListener('change', (e) => {
            nca.setMutationRate(parseFloat(e.target.value));
            triggerCalculationUpdate(); // Update calculation display
        });
    }
    
    // Enhanced mutation controls
    const mutationPattern = safeGetElement('mutationPattern');
    if (mutationPattern) {
        mutationPattern.addEventListener('change', (e) => {
            nca.setMutationPattern(e.target.value);
            updateMutationTypeDisplay();
            triggerCalculationUpdate(); // Update calculation display
        });
    }
    
    const mutationStrength = safeGetElement('mutationStrength');
    if (mutationStrength) {
        mutationStrength.addEventListener('change', (e) => {
            nca.setMutationStrength(parseFloat(e.target.value));
            triggerCalculationUpdate(); // Update calculation display
        });
    }
    
    // Channel weight scaling controls
    for (let i = 0; i < 4; i++) {
        const scaleControl = safeGetElement(`channel${i}Scale`);
        if (scaleControl) {
            scaleControl.addEventListener('change', (e) => {
                nca.setChannelWeightScale(i, parseFloat(e.target.value));
                triggerCalculationUpdate(); // Update calculation display
            });
        }
    }
    
    // Channel mutation mask controls
    for (let i = 0; i < 4; i++) {
        const checkbox = safeGetElement(`mutateCh${i}`);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                nca.setChannelMutationMask(i, e.target.checked);
                triggerCalculationUpdate(); // Update calculation display
            });
        }
    }
    
    // Kernel position mutation mask controls
    for (let i = 0; i < 9; i++) {
        const checkbox = safeGetElement(`kernel${i}`);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                nca.setKernelMutationMask(i, e.target.checked);
                triggerCalculationUpdate(); // Update calculation display
            });
        }
    }
}

// Helper function to trigger live calculation display updates
function triggerCalculationUpdate() {
    updateCalculationDisplay('control_change', {
        timestamp: new Date()
    });
    
    // Also update the mutation display values to reflect current UI settings
    const mutationRateSelect = safeGetElement('mutationRate');
    const mutationStrengthSelect = safeGetElement('mutationStrength');
    const mutationPatternSelect = safeGetElement('mutationPattern');
    
    if (mutationRateSelect) {
        const rate = parseFloat(mutationRateSelect.value);
        updateElement('calcMutationRate', `${(rate * 100).toFixed(1)}%`);
    }
    
    if (mutationStrengthSelect) {
        const strength = parseFloat(mutationStrengthSelect.value);
        updateElement('calcMutationStr', `${(strength * 100).toFixed(1)}%`);
    }
    
    if (mutationPatternSelect) {
        updateElement('calcMutationType', mutationPatternSelect.value.toUpperCase());
    }
}

function updateInitStrategyDisplay() {
    const currentInitStrategy = safeGetElement('currentInitStrategy');
    if (currentInitStrategy) {
        const strategySelect = safeGetElement('weightInitStrategy');
        if (strategySelect) {
            currentInitStrategy.textContent = strategySelect.value.toUpperCase();
        }
    }
}

function updateMutationTypeDisplay() {
    const lastMutationType = safeGetElement('lastMutationType');
    if (lastMutationType) {
        const patternSelect = safeGetElement('mutationPattern');
        if (patternSelect) {
            lastMutationType.textContent = patternSelect.value.toUpperCase();
        }
    }
}

function updateSelectedKernelDisplay() {
    const selectedKernelEl = safeGetElement('selectedKernel');
    if (selectedKernelEl) {
        const kernelSelect = safeGetElement('kernelSelect');
        if (kernelSelect) {
            const kernelIndex = parseInt(kernelSelect.value);
            const kernelNames = ['TL', 'T', 'TR', 'L', 'C', 'R', 'BL', 'B', 'BR'];
            const kernelName = kernelNames[kernelIndex] || 'C';
            selectedKernelEl.textContent = `${kernelName}(${kernelIndex})`;
        }
    }
}

// WebGL-only rendering
function render() {
    if (!nca || !canvas || !ctx) {
        return;
    }
    
    // Save context state and disable smoothing for crisp pixels
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    
    // Use WebGL rendering only
    nca.renderToCanvas(canvas, ctx, zoom, panX, panY);
    
    // Restore context state
    ctx.restore();
    
    // Update stats in the main controls
    const stepCountEl = safeGetElement('stepCount');
    if (stepCountEl) {
        stepCountEl.textContent = nca.stepCount;
    }
    
    const fpsEl = safeGetElement('fps');
    if (fpsEl) {
        fpsEl.textContent = nca.fps;
    }
    
    // Update calculation display stats (non-animated) - Live updates for running values
    updateElement('calcSteps', nca.stepCount);
    updateElement('calcFPS', nca.fps);
    updateElement('calcStatus', nca.running ? 'RUNNING' : 'STOPPED');
}

function animate(currentTime = 0) {
    // Early exit if not running or if another animation loop is already active
    if (!nca || !nca.running) {
        animationId = null;
        return;
    }
    
    // Calculate time elapsed since last frame
    const elapsed = currentTime - lastFrameTime;
    
    // Only update if enough time has passed (FPS limiting)
    if (elapsed >= FRAME_INTERVAL) {
        // Run multiple steps per frame based on stepsPerFrame setting
        for (let i = 0; i < nca.stepsPerFrame; i++) {
            nca.step();
        }
        render();
        lastFrameTime = currentTime;
    }
    
    // Continue animation loop
    animationId = requestAnimationFrame(animate);
}

function startAnimation() {
    if (!nca) {
        return;
    }
    
    // Prevent multiple animation loops
    if (animationId !== null) {
        return;
    }
    
    nca.running = true;
    lastFrameTime = performance.now();
    animationId = requestAnimationFrame(animate);
}

function stopAnimation() {
    if (nca) {
        nca.running = false;
    }
    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// Initialize when page loads
console.log('nca.js loaded, document ready state:', document.readyState);

if (document.readyState === 'loading') {
    console.log('Document still loading, adding DOMContentLoaded listener');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded fired, calling init()');
        // Add a small delay to ensure scripts are fully loaded
        setTimeout(init, 100);
    });
} else {
    console.log('Document already loaded, calling init() with delay');
    // Add a small delay to ensure all scripts are loaded
    setTimeout(init, 100);
}

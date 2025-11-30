// WebGL-accelerated Neural Cellular Automata Implementation
class NeuralCAWebGL {
    constructor(gridSize, numChannels) {
        console.log(`Initializing WebGL NCA with grid: ${gridSize}x${gridSize}, channels: ${numChannels}`);
        
        this.gridSize = gridSize;
        this.numChannels = numChannels;
        this.running = false;
        this.stepCount = 0;
        this.updateRate = 0.1;
        this.activationFunc = 'tanh';
        this.colorScheme = 'rainbow';
        this.weightRange = 2.0;
        this.stepsPerFrame = 2; // Add stepsPerFrame property to match CPU version
        
        // Enhanced mutation parameters
        this.mutationRate = 0.05; // 5% by default
        this.mutationStrength = 0.1; // How much to change weights (0.1 = 10% of weight range)
        this.mutationPattern = 'uniform'; // uniform, gaussian, selective, spatial, temporal
        this.mutationDecay = 0.98; // Decay factor for temporal mutations
        this.channelMutationMask = [true, true, true, true]; // Which channels to mutate
        this.kernelMutationMask = Array(9).fill(true); // Which kernel positions to mutate
        
        // Advanced weight control
        this.weightInitStrategy = 'xavier'; // xavier, he, uniform, custom
        this.weightConstraints = {
            min: -4.0,
            max: 4.0,
            l1Penalty: 0.001,
            l2Penalty: 0.001
        };
        
        // Per-layer and per-channel weight scaling
        this.channelWeightScales = [1.0, 1.0, 1.0, 1.0];
        this.kernelWeightScales = Array(9).fill(1.0);
        
        // Activation function parameters
        this.activationParams = {
            tanh: { scale: 1.0, bias: 0.0 },
            relu: { leak: 0.01, threshold: 0.0 },
            sigmoid: { scale: 1.0, bias: 0.0 },
            swish: { beta: 1.0 },
            gelu: { alpha: 1.0 }
        };
        
        this.autoEvolveEnabled = false;
        this.autoEvolveInterval = this.getRandomAutoEvolveInterval(); // Random between 30-60 seconds
        this.lastAutoEvolveTime = 0;
        
        // Mutation history for analysis
        this.mutationHistory = [];
        this.maxHistorySize = 100;
        
        // FPS tracking
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
        
        try {
            // Initialize WebGL
            this.initWebGL();
            this.initializeWeights();
            console.log('WebGL NCA initialized successfully');
        } catch (error) {
            console.error('Failed to initialize WebGL NCA:', error);
            throw error;
        }
   }
    
    // Initialize weights based on the selected strategy
    initializeWeights() {
        const weightData = new Float32Array(36 * 4); // 9 kernel positions * 4 channels * 4 output channels
        
        switch (this.weightInitStrategy) {
            case 'xavier':
                this.initializeXavierWeights(weightData);
                break;
            case 'he':
                this.initializeHeWeights(weightData);
                break;
            case 'uniform':
                this.initializeUniformWeights(weightData);
                break;
            case 'custom':
                this.initializeCustomWeights(weightData);
                break;
            default:
                this.initializeXavierWeights(weightData);
        }
        
        // Apply constraints
        this.applyWeightConstraints(weightData);
        
        // Upload to GPU
        this.uploadWeights(weightData);
        
        // Store for calculation display
        this.currentWeights = weightData.slice();
        
        console.log(`Weights initialized using ${this.weightInitStrategy} strategy`);
    }

    // Get sample weights for display (first 9 values for kernel visualization)
    getSampleWeights() {
        if (this.currentWeights && this.currentWeights.length >= 9) {
            return this.currentWeights.slice(0, 9);
        }
        return Array(9).fill(0);
    }
    
    // Get effective (scaled) weights for display - shows what's actually used in computation
    getEffectiveWeights() {
        if (!this.currentWeights || this.currentWeights.length < 9) {
            return Array(9).fill(0);
        }
        
        const effectiveWeights = [];
        const channelScale = this.channelWeightScales[0]; // Use first channel for display
        
        // Apply kernel scaling to first 9 weights (channel 0, kernel position i)
        for (let i = 0; i < 9; i++) {
            const baseWeight = this.currentWeights[i]; // These are stored as channel 0, kernel position i
            const kernelScale = this.kernelWeightScales[i];
            const effectiveWeight = baseWeight * channelScale * kernelScale;
            effectiveWeights.push(effectiveWeight);
        }
        
        return effectiveWeights;
    }
    
    // Helper method to get random auto-evolve interval between 30-60 seconds
    getRandomAutoEvolveInterval() {
        const minSeconds = 30;
        const maxSeconds = 60;
        const randomSeconds = minSeconds + Math.random() * (maxSeconds - minSeconds);
        return randomSeconds * 1000; // Convert to milliseconds
    }
    
    initWebGL() {
        console.log('Creating WebGL context...');
        
        // Create offscreen canvas for computation
        this.computeCanvas = document.createElement('canvas');
        this.computeCanvas.width = this.gridSize;
        this.computeCanvas.height = this.gridSize;
        
        // Get WebGL2 context (better than WebGL1 for compute tasks)
        const gl = this.computeCanvas.getContext('webgl2', {
            premultipliedAlpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: true
        });
        
        if (!gl) {
            throw new Error('WebGL2 not supported. Application cannot run without WebGL2.');
        }
        
        console.log('WebGL2 context created successfully');
        this.gl = gl;
        
        // Add WebGL error checking utility
        this.checkGLError = (operation) => {
            const error = gl.getError();
            if (error !== gl.NO_ERROR) {
                const errorString = this.getGLErrorString(error);
                console.error(`WebGL error during ${operation}: ${errorString} (${error})`);
                return false;
            }
            return true;
        };
        
        // Check WebGL capabilities
        console.log('WebGL Version:', gl.getParameter(gl.VERSION));
        console.log('GLSL Version:', gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
        console.log('Max Texture Size:', gl.getParameter(gl.MAX_TEXTURE_SIZE));
        console.log('Max Texture Units:', gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
        
        // Check for required extensions
        const requiredExts = ['EXT_color_buffer_float'];
        const supportedExts = gl.getSupportedExtensions();
        console.log('Supported extensions:', supportedExts);
        
        // Enable float textures
        const floatExt = gl.getExtension('EXT_color_buffer_float');
        if (!floatExt) {
            console.warn('Float textures not fully supported - this may cause issues');
        } else {
            console.log('Float texture extension enabled');
        }
        
        try {
            console.log('Creating shaders...');
            this.createShaders();
            this.checkGLError('shader creation');
            
            console.log('Creating state textures...');
            this.createStateTextures();
            this.checkGLError('state texture creation');
            
            console.log('Creating framebuffers...');
            this.createFramebuffers();
            this.checkGLError('framebuffer creation');
            
            console.log('Creating weight texture...');
            this.createWeightTexture();
            this.checkGLError('weight texture creation');
            
            console.log('Creating geometry...');
            this.createQuadGeometry();
            this.checkGLError('geometry creation');
            
            console.log('WebGL initialization complete');
        } catch (error) {
            console.error('WebGL setup failed:', error);
            this.checkGLError('WebGL setup');
            throw error;
        }
    }
    
    // WebGL error code to string mapping
    getGLErrorString(error) {
        const gl = this.gl;
        switch (error) {
            case gl.NO_ERROR: return 'NO_ERROR';
            case gl.INVALID_ENUM: return 'INVALID_ENUM';
            case gl.INVALID_VALUE: return 'INVALID_VALUE';
            case gl.INVALID_OPERATION: return 'INVALID_OPERATION';
            case gl.INVALID_FRAMEBUFFER_OPERATION: return 'INVALID_FRAMEBUFFER_OPERATION';
            case gl.OUT_OF_MEMORY: return 'OUT_OF_MEMORY';
            case gl.CONTEXT_LOST_WEBGL: return 'CONTEXT_LOST_WEBGL';
            default: return 'UNKNOWN_ERROR';
        }
    }
    
    createShaders() {
        const gl = this.gl;
        
        // Vertex shader (same for all programs)
        const vertexShaderSource = `#version 300 es
            in vec2 a_position;
            out vec2 v_texCoord;
            
            void main() {
                v_texCoord = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;
        
        // Fragment shader for computation step - Fixed array uniform issue
        const computeFragmentShaderSource = `#version 300 es
            precision highp float;
            precision highp sampler2D;
            
            uniform sampler2D u_state;
            uniform sampler2D u_weights;
            uniform vec2 u_resolution;
            uniform float u_updateRate;
            uniform int u_activationFunc; // 0=tanh, 1=relu, 2=sigmoid, 3=identity, 4=swish, 5=gelu
            uniform int u_numChannels;
            uniform vec4 u_activationParams; // scale, bias, leak/beta, threshold/alpha
            uniform vec4 u_channelScales; // Per-channel weight scaling
            // Changed to individual uniforms instead of array for better compatibility
            uniform float u_kernelScale0;
            uniform float u_kernelScale1;
            uniform float u_kernelScale2;
            uniform float u_kernelScale3;
            uniform float u_kernelScale4;
            uniform float u_kernelScale5;
            uniform float u_kernelScale6;
            uniform float u_kernelScale7;
            uniform float u_kernelScale8;
            
            in vec2 v_texCoord;
            out vec4 outColor;
            
            // Helper function to get kernel scale by index
            float getKernelScale(int index) {
                if (index == 0) return u_kernelScale0;
                if (index == 1) return u_kernelScale1;
                if (index == 2) return u_kernelScale2;
                if (index == 3) return u_kernelScale3;
                if (index == 4) return u_kernelScale4;
                if (index == 5) return u_kernelScale5;
                if (index == 6) return u_kernelScale6;
                if (index == 7) return u_kernelScale7;
                if (index == 8) return u_kernelScale8;
                return 1.0; // fallback
            }
            
            // Enhanced activation functions with parameters
            float activate(float x, int func, vec4 params) {
                if (func == 0) { // tanh with scale and bias
                    return tanh(x * params.x + params.y);
                } else if (func == 1) { // leaky relu with leak factor and threshold
                    float threshold = params.w;
                    float leak = params.z;
                    return x > threshold ? x : leak * x;
                } else if (func == 2) { // sigmoid with scale and bias
                    return 1.0 / (1.0 + exp(-(x * params.x + params.y)));
                } else if (func == 3) { // identity
                    return x;
                } else if (func == 4) { // swish (SiLU) with beta parameter
                    float beta = params.z;
                    return x / (1.0 + exp(-beta * x));
                } else if (func == 5) { // GELU approximation with alpha parameter
                    float alpha = params.w;
                    return 0.5 * x * (1.0 + tanh(sqrt(2.0 / 3.14159) * alpha * (x + 0.044715 * x * x * x)));
                }
                return x; // fallback
            }
            
            void main() {
                vec2 pixelSize = 1.0 / u_resolution;
                
                // Calculate neighbor color average for gradient effect
                float neighborHue = 0.0;
                float neighborBrightness = 0.0;
                float activeNeighbors = 0.0;
                
                if (u_numChannels >= 2) {
                    for (int dy = -1; dy <= 1; dy++) {
                        for (int dx = -1; dx <= 1; dx++) {
                            vec2 samplePos = v_texCoord + vec2(float(dx), float(dy)) * pixelSize;
                            samplePos = fract(samplePos);
                            
                            vec4 neighborState = texture(u_state, samplePos);
                            float nCh0 = neighborState.r;
                            float nCh1 = neighborState.g;
                            float nMag = sqrt(nCh0 * nCh0 + nCh1 * nCh1);
                            
                            if (nMag > 0.3) { // Only count active neighbors
                                neighborHue += nCh0;
                                neighborBrightness += nCh1;
                                activeNeighbors += 1.0;
                            }
                        }
                    }
                    
                    if (activeNeighbors > 0.0) {
                        neighborHue /= activeNeighbors;
                        neighborBrightness /= activeNeighbors;
                    }
                }
                
                // Sample 3x3 neighborhood for convolution
                vec4 result = vec4(0.0);
                
                for (int c = 0; c < 4; c++) {
                    if (c >= u_numChannels) break;
                    
                    float sum = 0.0;
                    int weightIdx = 0;
                    
                    // 3x3 convolution with per-channel and per-kernel scaling
                    float channelScale = u_channelScales[c];
                    
                    for (int dy = -1; dy <= 1; dy++) {
                        for (int dx = -1; dx <= 1; dx++) {
                            vec2 samplePos = v_texCoord + vec2(float(dx), float(dy)) * pixelSize;
                            
                            // Wrap around edges (toroidal topology)
                            samplePos = fract(samplePos);
                            
                            vec4 neighborState = texture(u_state, samplePos);
                            
                            // Get kernel scale for this position using helper function
                            float kernelScale = getKernelScale(weightIdx);
                            
                            // Read weights for this kernel position and output channel
                            for (int ic = 0; ic < 4; ic++) {
                                if (ic >= u_numChannels) break;
                                
                                float weight = texture(u_weights, 
                                    vec2(float(weightIdx * u_numChannels + ic) / 36.0, 
                                         float(c) / 4.0)).r;
                                
                                sum += neighborState[ic] * weight * channelScale * kernelScale;
                            }
                            weightIdx++;
                        }
                    }
                    
                    // Apply activation function with parameters
                    float activated = activate(sum, u_activationFunc, u_activationParams);
                    
                    // Blend with previous state
                    float oldVal = texture(u_state, v_texCoord)[c];
                    float newVal = oldVal * (1.0 - u_updateRate) + activated * u_updateRate;
                    
                    // Apply gradient blending for color channels
                    if (u_numChannels >= 2 && activeNeighbors > 0.0) {
                        float neighborInfluence = 0.15; // How much neighbors affect color
                        if (c == 0) { // Hue channel
                            newVal = newVal * (1.0 - neighborInfluence) + neighborHue * neighborInfluence;
                        } else if (c == 1) { // Brightness channel
                            newVal = newVal * (1.0 - neighborInfluence) + neighborBrightness * neighborInfluence;
                        }
                    }
                    
                    result[c] = clamp(newVal, -1.0, 1.0);
                }
                
                outColor = result;
            }
        `;
        
        // Fragment shader for rendering (unchanged)
        const renderFragmentShaderSource = `#version 300 es
            precision highp float;
            precision highp sampler2D;
            
            uniform sampler2D u_state;
            uniform int u_numChannels;
            
            in vec2 v_texCoord;
            out vec4 outColor;
            
            const float threshold = 0.2;
            const float thresholdSq = threshold * threshold;
            const float fadeRange = 0.3;
            const float fadeThreshold = threshold + fadeRange;
            const float fadeThresholdSq = fadeThreshold * fadeThreshold;
            const float invFadeRange = 1.0 / fadeRange;
            const float contrastBoost = 1.2;
            const float gammaCorrection = 1.4;
            const float invGamma = 1.0 / gammaCorrection;
            
            void main() {
                vec4 state = texture(u_state, v_texCoord);
                
                if (u_numChannels >= 2) {
                    // Color mode - use full rainbow colorspace
                    float ch0 = state.r;
                    float ch1 = state.g;
                    float magnitudeSq = ch0 * ch0 + ch1 * ch1;
                    
                    if (magnitudeSq > thresholdSq) {
                        float hue = (ch0 + 1.0) * 0.5; // Convert from [-1,1] to [0,1]
                        float brightness = (ch1 + 1.0) * 0.5;
                        
                        brightness = pow(brightness, invGamma);
                        brightness = min(1.0, brightness * contrastBoost);
                        
                        // Smooth fade for gradient effect
                        if (magnitudeSq < fadeThresholdSq) {
                            float magnitude = sqrt(magnitudeSq);
                            float fadeAmount = (magnitude - threshold) * invFadeRange;
                            // Smoothstep fade curve
                            float smoothFade = fadeAmount * fadeAmount * (3.0 - 2.0 * fadeAmount);
                            brightness *= smoothFade;
                        }
                        
                        // Rainbow color scheme - map hue to full spectrum
                        vec3 color;
                        float h = hue * 6.0; // Scale hue to 0-6 range for easier color wheel math
                        
                        if (h < 1.0) {
                            // Red to Yellow
                            color = vec3(1.0, h, 0.0);
                        } else if (h < 2.0) {
                            // Yellow to Green  
                            color = vec3(2.0 - h, 1.0, 0.0);
                        } else if (h < 3.0) {
                            // Green to Cyan
                            color = vec3(0.0, 1.0, h - 2.0);
                        } else if (h < 4.0) {
                            // Cyan to Blue
                            color = vec3(0.0, 4.0 - h, 1.0);
                        } else if (h < 5.0) {
                            // Blue to Magenta
                            color = vec3(h - 4.0, 0.0, 1.0);
                        } else {
                            // Magenta to Red
                            color = vec3(1.0, 0.0, 6.0 - h);
                        }
                        
                        // Apply brightness
                        color *= brightness;
                        
                        outColor = vec4(color, 1.0);
                    } else {
                        outColor = vec4(0.0, 0.0, 0.0, 1.0);
                    }
                } else {
                    // Monochrome mode - use brightness as white/gray
                    float val = state.r;
                    float absVal = abs(val);
                    
                    if (absVal > threshold) {
                        float brightness = (val + 1.0) * 0.5;
                        brightness = pow(brightness, invGamma);
                        brightness = min(1.0, brightness * contrastBoost);
                        
                        // Smooth fade
                        if (absVal < fadeThreshold) {
                            float fadeAmount = (absVal - threshold) * invFadeRange;
                            float smoothFade = fadeAmount * fadeAmount * (3.0 - 2.0 * fadeAmount);
                            brightness *= smoothFade;
                        }
                        
                        // Monochrome - white/gray based on brightness
                        outColor = vec4(vec3(brightness), 1.0);
                    } else {
                        outColor = vec4(0.0, 0.0, 0.0, 1.0);
                    }
                }
            }
        `;
        
        // Compile shaders with better error handling
        console.log('Compiling vertex shader...');
        const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        if (!vertexShader) {
            throw new Error('Failed to compile vertex shader');
        }
        
        console.log('Compiling compute fragment shader...');
        const computeFragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, computeFragmentShaderSource);
        if (!computeFragmentShader) {
            throw new Error('Failed to compile compute fragment shader');
        }
        
        console.log('Compiling render fragment shader...');
        const renderFragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, renderFragmentShaderSource);
        if (!renderFragmentShader) {
            throw new Error('Failed to compile render fragment shader');
        }
        
        // Create programs with better error handling
        console.log('Creating compute program...');
        this.computeProgram = this.createProgram(gl, vertexShader, computeFragmentShader);
        if (!this.computeProgram) {
            throw new Error('Failed to create compute program');
        }
        
        console.log('Creating render program...');
        this.renderProgram = this.createProgram(gl, vertexShader, renderFragmentShader);
        if (!this.renderProgram) {
            throw new Error('Failed to create render program');
        }
        
        // Get uniform locations for compute program
        this.computeUniforms = {
            state: gl.getUniformLocation(this.computeProgram, 'u_state'),
            weights: gl.getUniformLocation(this.computeProgram, 'u_weights'),
            resolution: gl.getUniformLocation(this.computeProgram, 'u_resolution'),
            updateRate: gl.getUniformLocation(this.computeProgram, 'u_updateRate'),
            activationFunc: gl.getUniformLocation(this.computeProgram, 'u_activationFunc'),
            numChannels: gl.getUniformLocation(this.computeProgram, 'u_numChannels'),
            activationParams: gl.getUniformLocation(this.computeProgram, 'u_activationParams'),
            channelScales: gl.getUniformLocation(this.computeProgram, 'u_channelScales'),
            // Individual kernel scale uniforms for better compatibility
            kernelScale0: gl.getUniformLocation(this.computeProgram, 'u_kernelScale0'),
            kernelScale1: gl.getUniformLocation(this.computeProgram, 'u_kernelScale1'),
            kernelScale2: gl.getUniformLocation(this.computeProgram, 'u_kernelScale2'),
            kernelScale3: gl.getUniformLocation(this.computeProgram, 'u_kernelScale3'),
            kernelScale4: gl.getUniformLocation(this.computeProgram, 'u_kernelScale4'),
            kernelScale5: gl.getUniformLocation(this.computeProgram, 'u_kernelScale5'),
            kernelScale6: gl.getUniformLocation(this.computeProgram, 'u_kernelScale6'),
            kernelScale7: gl.getUniformLocation(this.computeProgram, 'u_kernelScale7'),
            kernelScale8: gl.getUniformLocation(this.computeProgram, 'u_kernelScale8')
        };
        
        // Get uniform locations for render program
        this.renderUniforms = {
            state: gl.getUniformLocation(this.renderProgram, 'u_state'),
            numChannels: gl.getUniformLocation(this.renderProgram, 'u_numChannels')
        };
        
        console.log('Shaders compiled and programs created successfully');
    }
    
    compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        if (!shader) {
            console.error('Failed to create shader object');
            return null;
        }
        
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const shaderType = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
            const errorLog = gl.getShaderInfoLog(shader);
            console.error(`${shaderType} shader compilation error:`, errorLog);
            console.error('Shader source:', source);
            gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        if (!program) {
            console.error('Failed to create program object');
            return null;
        }
        
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const errorLog = gl.getProgramInfoLog(program);
            console.error('Program linking error:', errorLog);
            gl.deleteProgram(program);
            return null;
        }
        
        // Validate the program
        gl.validateProgram(program);
        if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
            const errorLog = gl.getProgramInfoLog(program);
            console.error('Program validation error:', errorLog);
            // Don't delete here - validation can fail on some drivers but still work
        }
        
        return program;
    }
    
    createStateTextures() {
        const gl = this.gl;
        
        // Create two textures for ping-pong rendering
        this.stateTextures = [
            this.createFloatTexture(gl),
            this.createFloatTexture(gl)
        ];
        
        this.currentStateIndex = 0;
    }
    
    createFloatTexture(gl) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // Use RGBA32F for better precision (4 channels)
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA32F,
            this.gridSize,
            this.gridSize,
            0,
            gl.RGBA,
            gl.FLOAT,
            null
        );
        
        // Use NEAREST filtering for crisp pixels when zoomed
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        
        return texture;
    }
    
    createFramebuffers() {
        const gl = this.gl;
        
        this.framebuffers = [
            gl.createFramebuffer(),
            gl.createFramebuffer()
        ];
        
        if (!this.framebuffers[0] || !this.framebuffers[1]) {
            throw new Error('Failed to create framebuffers');
        }
        
        // Attach textures to framebuffers with error checking
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[0]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.stateTextures[0], 0);
        
        // Check framebuffer completeness
        let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`Framebuffer 0 not complete: ${this.getFramebufferStatusString(status)}`);
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[1]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.stateTextures[1], 0);
        
        // Check second framebuffer completeness
        status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`Framebuffer 1 not complete: ${this.getFramebufferStatusString(status)}`);
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        console.log('Framebuffers created and validated successfully');
    }
    
    // Framebuffer status to string mapping
    getFramebufferStatusString(status) {
        const gl = this.gl;
        switch (status) {
            case gl.FRAMEBUFFER_COMPLETE: return 'COMPLETE';
            case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT: return 'INCOMPLETE_ATTACHMENT';
            case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: return 'INCOMPLETE_MISSING_ATTACHMENT';
            case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS: return 'INCOMPLETE_DIMENSIONS';
            case gl.FRAMEBUFFER_UNSUPPORTED: return 'UNSUPPORTED';
            case gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE: return 'INCOMPLETE_MULTISAMPLE';
            default: return `UNKNOWN_STATUS_${status}`;
        }
    }
    
    createWeightTexture() {
        const gl = this.gl;
        
        this.weightTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.weightTexture);
        
        // Weight texture dimensions: (9 * numChannels) x numChannels
        // Each row stores weights for one output channel
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.R32F,
            36, // 9 positions * 4 max channels
            4,  // 4 output channels
            0,
            gl.RED,
            gl.FLOAT,
            null
        );
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    
    createQuadGeometry() {
        const gl = this.gl;
        
        // Full-screen quad
        const positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1
        ]);
        
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        
        // Set up vertex attribute for both programs
        [this.computeProgram, this.renderProgram].forEach(program => {
            const positionLocation = gl.getAttribLocation(program, 'a_position');
            gl.useProgram(program);
            gl.enableVertexAttribArray(positionLocation);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        });
    }
    
    // Xavier/Glorot initialization
    initializeXavierWeights(weightData) {
        const fanIn = this.numChannels * 9; // Input channels * kernel size
        const fanOut = this.numChannels; // Output channels
        const limit = Math.sqrt(6.0 / (fanIn + fanOut));
        
        for (let i = 0; i < weightData.length; i++) {
            weightData[i] = (Math.random() * 2 - 1) * limit;
        }
    }
    
    // He initialization (good for ReLU)
    initializeHeWeights(weightData) {
        const fanIn = this.numChannels * 9;
        const stddev = Math.sqrt(2.0 / fanIn);
        
        for (let i = 0; i < weightData.length; i++) {
            // Box-Muller transform for Gaussian distribution
            const u1 = Math.random();
            const u2 = Math.random();
            const gaussian = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            weightData[i] = gaussian * stddev;
        }
    }
    
    // Uniform initialization
    initializeUniformWeights(weightData) {
        const range = this.weightRange;
        for (let i = 0; i < weightData.length; i++) {
            weightData[i] = (Math.random() * 2 - 1) * range;
        }
    }
    
    // Custom initialization (can be overridden)
    initializeCustomWeights(weightData) {
        // Default to uniform for now
        this.initializeUniformWeights(weightData);
    }
    
    // Apply weight constraints
    applyWeightConstraints(weightData) {
        for (let i = 0; i < weightData.length; i++) {
            weightData[i] = Math.max(this.weightConstraints.min, 
                           Math.min(this.weightConstraints.max, weightData[i]));
        }
    }
    
    // Upload weights to GPU
    uploadWeights(weightData) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.weightTexture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0, 0,
            36, 4,
            gl.RED,
            gl.FLOAT,
            weightData
        );
    }
    
    // Read weights from GPU (for mutation)
    readWeightsFromGPU() {
        const gl = this.gl;
        const weightData = new Float32Array(36 * 4);
        
        // Create temporary framebuffer to read from weight texture
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.weightTexture, 0);
        
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
            gl.readPixels(0, 0, 36, 4, gl.RED, gl.FLOAT, weightData);
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fb);
        
        return weightData;
    }
    
    // Enhanced mutation methods with finer control
    mutateWeights(mutationType = null) {
        const type = mutationType || this.mutationPattern;
        
        // Read existing weights from GPU before mutation
        const weightData = this.readWeightsFromGPU();
        
        // Apply mutations based on type
        switch (type) {
            case 'uniform':
                this.applyUniformMutation(weightData);
                break;
            case 'gaussian':
                this.applyGaussianMutation(weightData);
                break;
            case 'selective':
                this.applySelectiveMutation(weightData);
                break;
            case 'spatial':
                this.applySpatialMutation(weightData);
                break;
            case 'temporal':
                this.applyTemporalMutation(weightData);
                break;
            default:
                this.applyUniformMutation(weightData);
        }
        
        // Apply constraints and upload
        this.applyWeightConstraints(weightData);
        this.uploadWeights(weightData);
        
        // Store for calculation display
        this.currentWeights = weightData.slice();
        
        // Record mutation in history
        this.recordMutation(type, this.mutationRate, this.mutationStrength);
        
        // Notify calculation display of mutation
        if (typeof updateCalculationDisplay === 'function') {
            updateCalculationDisplay('mutation', {
                type: type,
                rate: this.mutationRate,
                strength: this.mutationStrength,
                timestamp: new Date()
            });
        }
    }
    
    // Uniform mutation
    applyUniformMutation(weightData) {
        const mutationStrength = this.mutationStrength * this.weightRange;
        
        for (let outChannel = 0; outChannel < 4; outChannel++) {
            if (!this.channelMutationMask[outChannel]) continue;
            
            for (let kernelPos = 0; kernelPos < 9; kernelPos++) {
                if (!this.kernelMutationMask[kernelPos]) continue;
                
                for (let inChannel = 0; inChannel < this.numChannels; inChannel++) {
                    if (Math.random() < this.mutationRate) {
                        const idx = (outChannel * 36) + (kernelPos * this.numChannels) + inChannel;
                        const mutation = (Math.random() * 2 - 1) * mutationStrength;
                        weightData[idx] += mutation;
                    }
                }
            }
        }
    }
    
    // Gaussian mutation
    applyGaussianMutation(weightData) {
        const mutationStrength = this.mutationStrength * this.weightRange;
        
        for (let outChannel = 0; outChannel < 4; outChannel++) {
            if (!this.channelMutationMask[outChannel]) continue;
            
            for (let kernelPos = 0; kernelPos < 9; kernelPos++) {
                if (!this.kernelMutationMask[kernelPos]) continue;
                
                for (let inChannel = 0; inChannel < this.numChannels; inChannel++) {
                    if (Math.random() < this.mutationRate) {
                        const idx = (outChannel * 36) + (kernelPos * this.numChannels) + inChannel;
                        // Box-Muller transform for Gaussian
                        const u1 = Math.random();
                        const u2 = Math.random();
                        const gaussian = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
                        const mutation = gaussian * mutationStrength;
                        weightData[idx] += mutation;
                    }
                }
            }
        }
    }
    
    // Selective mutation (based on weight magnitude)
    applySelectiveMutation(weightData) {
        const mutationStrength = this.mutationStrength * this.weightRange;
        
        for (let outChannel = 0; outChannel < 4; outChannel++) {
            if (!this.channelMutationMask[outChannel]) continue;
            
            for (let kernelPos = 0; kernelPos < 9; kernelPos++) {
                if (!this.kernelMutationMask[kernelPos]) continue;
                
                for (let inChannel = 0; inChannel < this.numChannels; inChannel++) {
                    const idx = (outChannel * 36) + (kernelPos * this.numChannels) + inChannel;
                    const weight = weightData[idx];
                    
                    // Higher chance to mutate smaller weights
                    const probability = this.mutationRate * (1.0 + Math.exp(-Math.abs(weight)));
                    
                    if (Math.random() < probability) {
                        const mutation = (Math.random() * 2 - 1) * mutationStrength;
                        weightData[idx] += mutation;
                    }
                }
            }
        }
    }
    
    // Spatial mutation (coherent kernel mutations)
    applySpatialMutation(weightData) {
        const mutationStrength = this.mutationStrength * this.weightRange;
        
        for (let outChannel = 0; outChannel < 4; outChannel++) {
            if (!this.channelMutationMask[outChannel]) continue;
            
            // Sometimes mutate entire kernels together
            if (Math.random() < this.mutationRate * 0.5) {
                const globalMutation = (Math.random() * 2 - 1) * mutationStrength * 0.5;
                
                for (let kernelPos = 0; kernelPos < 9; kernelPos++) {
                    if (!this.kernelMutationMask[kernelPos]) continue;
                    
                    for (let inChannel = 0; inChannel < this.numChannels; inChannel++) {
                        const idx = (outChannel * 36) + (kernelPos * this.numChannels) + inChannel;
                        weightData[idx] += globalMutation;
                    }
                }
            } else {
                // Normal mutation
                this.applyUniformMutation(weightData);
            }
        }
    }
    
    // Temporal mutation (with decay)
    applyTemporalMutation(weightData) {
        const decayedStrength = this.mutationStrength * Math.pow(this.mutationDecay, this.stepCount / 1000);
        const mutationStrength = decayedStrength * this.weightRange;
        
        for (let outChannel = 0; outChannel < 4; outChannel++) {
            if (!this.channelMutationMask[outChannel]) continue;
            
            for (let kernelPos = 0; kernelPos < 9; kernelPos++) {
                if (!this.kernelMutationMask[kernelPos]) continue;
                
                for (let inChannel = 0; inChannel < this.numChannels; inChannel++) {
                    if (Math.random() < this.mutationRate) {
                        const idx = (outChannel * 36) + (kernelPos * this.numChannels) + inChannel;
                        const mutation = (Math.random() * 2 - 1) * mutationStrength;
                        weightData[idx] += mutation;
                    }
                }
            }
        }
    }
    
    // Record mutation in history
    recordMutation(type, rate, strength) {
        this.mutationHistory.push({
            timestamp: Date.now(),
            type: type,
            rate: rate,
            strength: strength,
            stepCount: this.stepCount
        });
        
        // Keep history size manageable
        if (this.mutationHistory.length > this.maxHistorySize) {
            this.mutationHistory.shift();
        }
    }
    
    // Method to get network configuration for calculation display
    getNetworkConfig() {
        return {
            gridSize: this.gridSize,
            numChannels: this.numChannels,
            weightCount: 36 * this.numChannels, // 9 kernel positions * 4 channels * numChannels
            activationFunc: this.activationFunc,
            weightRange: this.weightRange,
            updateRate: this.updateRate,
            stepCount: this.stepCount,
            fps: this.fps
        };
    }
    
    reset() {
        const gl = this.gl;
        
        // Clear state textures
        const emptyData = new Float32Array(this.gridSize * this.gridSize * 4);
        
        for (let i = 0; i < 2; i++) {
            gl.bindTexture(gl.TEXTURE_2D, this.stateTextures[i]);
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0,
                0, 0,
                this.gridSize, this.gridSize,
                gl.RGBA,
                gl.FLOAT,
                emptyData
            );
        }
        
        this.stepCount = 0;
        
        // Add seeds near the center of the grid for better visibility
        const patterns = ['random', 'center', 'ring', 'gradient', 'checker', 'spiral', 'cross', 'dot'];
        const numSeeds = 1 + Math.floor(Math.random() * 3);
        
        for (let s = 0; s < numSeeds; s++) {
            // Place seeds in the central area of the grid for better initial visibility
            const centerX = this.gridSize / 2;
            const centerY = this.gridSize / 2;
            const spreadRadius = Math.min(200, this.gridSize / 8); // Seeds within 200 pixels of center
            
            const seedX = Math.floor(centerX + (Math.random() - 0.5) * spreadRadius * 2);
            const seedY = Math.floor(centerY + (Math.random() - 0.5) * spreadRadius * 2);
            const seedRadius = 5 + Math.floor(Math.random() * 16);
            const seedPattern = patterns[Math.floor(Math.random() * patterns.length)];
            
            this.seed(seedX, seedY, seedRadius, seedPattern);
        }
        
        // Notify calculation display of reset
        if (typeof updateCalculationDisplay === 'function') {
            updateCalculationDisplay('reset', {
                timestamp: new Date(),
                seedCount: numSeeds,
                gridSize: this.gridSize
            });
        }
    }
    
    seed(x, y, radius, pattern = 'random') {
        const gl = this.gl;
        const seedData = new Float32Array(radius * 2 * radius * 2 * 4);
        let index = 0;
        
        for (let dy = -radius; dy < radius; dy++) {
            for (let dx = -radius; dx < radius; dx++) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= radius) {
                    let values = [0, 0, 0, 0];
                    
                    switch (pattern) {
                        case 'random':
                            values = [
                                Math.random() * 2 - 1,
                                Math.random() * 2 - 1,
                                Math.random() * 2 - 1,
                                Math.random() * 2 - 1
                            ];
                            break;
                        case 'center':
                            const falloff = 1.0 - distance / radius;
                            values = [falloff, falloff, falloff, falloff];
                            break;
                        case 'ring':
                            const ringDistance = Math.abs(distance - radius * 0.7);
                            const ringFalloff = Math.max(0, 1.0 - ringDistance / (radius * 0.3));
                            values = [ringFalloff, ringFalloff, ringFalloff, ringFalloff];
                            break;
                        case 'gradient':
                            const angle = Math.atan2(dy, dx);
                            values = [Math.cos(angle), Math.sin(angle), 0, 0];
                            break;
                        default:
                            values = [Math.random() * 2 - 1, Math.random() * 2 - 1, 0, 0];
                    }
                    
                    // Only use as many channels as we have
                    for (let c = 0; c < Math.min(4, this.numChannels); c++) {
                        seedData[index * 4 + c] = values[c];
                    }
                }
                index++;
            }
        }
        
        // Upload seed data to current state texture
        gl.bindTexture(gl.TEXTURE_2D, this.stateTextures[this.currentStateIndex]);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            Math.max(0, Math.min(this.gridSize - radius * 2, x - radius)),
            Math.max(0, Math.min(this.gridSize - radius * 2, y - radius)),
            radius * 2,
            radius * 2,
            gl.RGBA,
            gl.FLOAT,
            seedData
        );
    }
    
    step() {
        const gl = this.gl;
        
        // Update FPS
        const currentTime = performance.now();
        this.frameCount++;
        if (currentTime - this.lastTime >= 1000) {
            this.fps = Math.round(this.frameCount / ((currentTime - this.lastTime) / 1000));
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
        
        // Auto-evolve check
        if (this.autoEvolveEnabled && currentTime - this.lastAutoEvolveTime >= this.autoEvolveInterval) {
            this.mutateWeights();
            this.lastAutoEvolveTime = currentTime;
            this.autoEvolveInterval = this.getRandomAutoEvolveInterval();
        }
        
        // Set up computation
        const inputIndex = this.currentStateIndex;
        const outputIndex = 1 - this.currentStateIndex;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[outputIndex]);
        gl.viewport(0, 0, this.gridSize, this.gridSize);
        
        gl.useProgram(this.computeProgram);
        
        // Set up textures
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.stateTextures[inputIndex]);
        gl.uniform1i(this.computeUniforms.state, 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.weightTexture);
        gl.uniform1i(this.computeUniforms.weights, 1);
        
        // Set uniforms
        gl.uniform2f(this.computeUniforms.resolution, this.gridSize, this.gridSize);
        gl.uniform1f(this.computeUniforms.updateRate, this.updateRate);
        gl.uniform1i(this.computeUniforms.numChannels, this.numChannels);
        
        // Set activation function
        const activationMap = { 'tanh': 0, 'relu': 1, 'sigmoid': 2, 'identity': 3, 'swish': 4, 'gelu': 5 };
        gl.uniform1i(this.computeUniforms.activationFunc, activationMap[this.activationFunc] || 0);
        
        // Set activation parameters
        const params = this.activationParams[this.activationFunc] || this.activationParams.tanh;
        gl.uniform4f(this.computeUniforms.activationParams, 
            params.scale || 1.0, 
            params.bias || 0.0,
            params.leak || params.beta || 0.01,
            params.threshold || params.alpha || 0.0
        );
        
        // Set channel scales
        gl.uniform4f(this.computeUniforms.channelScales, 
            this.channelWeightScales[0],
            this.channelWeightScales[1], 
            this.channelWeightScales[2],
            this.channelWeightScales[3]
        );
        
        // Set individual kernel scales
        for (let i = 0; i < 9; i++) {
            const uniformName = `kernelScale${i}`;
            gl.uniform1f(this.computeUniforms[uniformName], this.kernelWeightScales[i]);
        }
        
        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        // Swap state textures
        this.currentStateIndex = outputIndex;
        this.stepCount++;
    }
    
    renderToCanvas(canvas, ctx, zoom, panX, panY) {
        const gl = this.gl;
        
        // Render to offscreen canvas first
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.gridSize, this.gridSize);
        
        gl.useProgram(this.renderProgram);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.stateTextures[this.currentStateIndex]);
        gl.uniform1i(this.renderUniforms.state, 0);
        gl.uniform1i(this.renderUniforms.numChannels, this.numChannels);
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        // Copy to display canvas with zoom and pan using nearest neighbor sampling
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Ensure crisp pixel rendering
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        
        // Calculate what portion of the grid to display
        const viewportWidth = canvas.width / zoom;
        const viewportHeight = canvas.height / zoom;
        
        // Calculate the center point of the view (in grid coordinates)
        const viewCenterX = this.gridSize / 2 + panX;
        const viewCenterY = this.gridSize / 2 + panY;
        
        // Calculate the top-left corner of the source rectangle
        let sourceX = viewCenterX - viewportWidth / 2;
        let sourceY = viewCenterY - viewportHeight / 2;
        
        // Handle cases where the view extends beyond the grid bounds
        let destX = 0;
        let destY = 0;
        let destWidth = canvas.width;
        let destHeight = canvas.height;
        let srcWidth = viewportWidth;
        let srcHeight = viewportHeight;
        
        // If source extends beyond left edge
        if (sourceX < 0) {
            const overflow = -sourceX;
            const pixelRatio = canvas.width / viewportWidth;
            destX = overflow * pixelRatio;
            destWidth -= overflow * pixelRatio;
            srcWidth -= overflow;
            sourceX = 0;
        }
        
        // If source extends beyond right edge
        if (sourceX + srcWidth > this.gridSize) {
            const overflow = (sourceX + srcWidth) - this.gridSize;
            const pixelRatio = canvas.width / viewportWidth;
            destWidth -= overflow * pixelRatio;
            srcWidth -= overflow;
        }
        
        // If source extends beyond top edge
        if (sourceY < 0) {
            const overflow = -sourceY;
            const pixelRatio = canvas.height / viewportHeight;
            destY = overflow * pixelRatio;
            destHeight -= overflow * pixelRatio;
            srcHeight -= overflow;
            sourceY = 0;
        }
        
        // If source extends beyond bottom edge
        if (sourceY + srcHeight > this.gridSize) {
            const overflow = (sourceY + srcHeight) - this.gridSize;
            const pixelRatio = canvas.height / viewportHeight;
            destHeight -= overflow * pixelRatio;
            srcHeight -= overflow;
        }
        
        // Only draw if there's something to draw
        if (srcWidth > 0 && srcHeight > 0 && destWidth > 0 && destHeight > 0) {
            // Round coordinates to pixel boundaries for crisp rendering
            const roundedSourceX = Math.round(sourceX);
            const roundedSourceY = Math.round(sourceY);
            const roundedSrcWidth = Math.round(srcWidth);
            const roundedSrcHeight = Math.round(srcHeight);
            const roundedDestX = Math.round(destX);
            const roundedDestY = Math.round(destY);
            const roundedDestWidth = Math.round(destWidth);
            const roundedDestHeight = Math.round(destHeight);
            
            ctx.drawImage(
                this.computeCanvas,
                roundedSourceX, roundedSourceY, roundedSrcWidth, roundedSrcHeight,
                roundedDestX, roundedDestY, roundedDestWidth, roundedDestHeight
            );
        }
        
        ctx.restore();
    }
    
    // Setter methods for configuration
    setMutationRate(rate) {
        this.mutationRate = Math.max(0, Math.min(1, rate));
    }
    
    setMutationStrength(strength) {
        this.mutationStrength = Math.max(0, Math.min(1, strength));
    }
    
    setMutationPattern(pattern) {
        const validPatterns = ['uniform', 'gaussian', 'selective', 'spatial', 'temporal'];
        if (validPatterns.includes(pattern)) {
            this.mutationPattern = pattern;
        }
    }
    
    setWeightInitStrategy(strategy) {
        const validStrategies = ['xavier', 'he', 'uniform', 'custom'];
        if (validStrategies.includes(strategy)) {
            this.weightInitStrategy = strategy;
        }
    }
    
    setActivationParams(func, params) {
        if (this.activationParams[func]) {
            Object.assign(this.activationParams[func], params);
        }
    }
    
    setChannelWeightScale(channel, scale) {
        if (channel >= 0 && channel < 4) {
            this.channelWeightScales[channel] = Math.max(0.1, Math.min(5.0, scale));
        }
    }
    
    setKernelWeightScale(position, scale) {
        if (position >= 0 && position < 9) {
            this.kernelWeightScales[position] = Math.max(0.1, Math.min(5.0, scale));
        }
    }
    
    setChannelMutationMask(channel, enabled) {
        if (channel >= 0 && channel < 4) {
            this.channelMutationMask[channel] = enabled;
        }
    }
    
    setKernelMutationMask(position, enabled) {
        if (position >= 0 && position < 9) {
            this.kernelMutationMask[position] = enabled;
        }
    }
    
    enableAutoEvolve() {
        this.autoEvolveEnabled = true;
        this.lastAutoEvolveTime = performance.now();
    }
    
    disableAutoEvolve() {
        this.autoEvolveEnabled = false;
    }
    
    // Cleanup method
    dispose() {
        const gl = this.gl;
        if (gl) {
            // Delete textures
            if (this.stateTextures) {
                this.stateTextures.forEach(texture => gl.deleteTexture(texture));
            }
            if (this.weightTexture) {
                gl.deleteTexture(this.weightTexture);
            }
            
            // Delete framebuffers
            if (this.framebuffers) {
                this.framebuffers.forEach(fb => gl.deleteFramebuffer(fb));
            }
            
            // Delete buffers
            if (this.quadBuffer) {
                gl.deleteBuffer(this.quadBuffer);
            }
            
            // Delete programs
            if (this.computeProgram) {
                gl.deleteProgram(this.computeProgram);
            }
            if (this.renderProgram) {
                gl.deleteProgram(this.renderProgram);
            }
        }
    }
}

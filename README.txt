~Moonlight Pools~

Moonlight Pools implements WebGL2-accelerated Neural Cellular Automata (NCA), providing efficient, interactive simulations of cell-based systems governed by learned local rules. Instead of relying on conventional, hand-coded update rules, each cell utilizes a compact neural network to process its neighborhood and update its state. By harnessing GPU parallelism in the browser, Moonlight Pools makes it easy to explore sophisticated, emergent patterns in real time, offering a flexible environment for the study of artificial life, morphogenesis, and self-organization.

~Startup Guide~

1. Clone repo or download folder for latest release.
2. Start [Moonlight Pools] shortcut
	2a. You may move shortcut to any directory you wish, as long
	    as you keep the rest of the original folder in tact.
	2b. 

~Mathematical Foundation~

			~Convolution Operation~
The core computational step uses **2D convolution** to process each cell's neighborhood: 

	For each cell (x,y) and output channel c: newValue[x,y,c] = Σ Σ Σ (weights[dx,dy,ic,c] × inputValue[x+dx,y+dy,ic]) dx dy ic
	Where:
		- `dx, dy ∈ {-1, 0, 1}` (3×3 neighborhood)
		- `ic` = input channel index (0 to numChannels-1)
		- `c` = output channel index (0 to numChannels-1)

			~Kernel Structure~
The 3×3 convolution kernel positions are indexed as:
		
	0(TL) 1(T)  2(TR) 3(L)  4(C)  5(R) 6(BL) 7(B)  8(BR)


~Controls Reference~

		~Channels (channelCount):

	Sets how many information channels (e.g., grayscale, RGB) each cell uses.
	1 = grayscale; 2+ = various color encodings.

		~Steps Per Frame (stepsPerFrame):

	Changes the number of simulation steps performed per visual frame.
	Higher values accelerate the evolution of patterns, but increase GPU usage.

		~Activation Function (activation):

	Determines the cell update non-linearity. Options include:
	TANH, RELU, SIGMOID, SWISH, GELU, and IDENTITY.

		~Weight Range (weightRange):

	Adjusts the maximum absolute value of weights in the network.
	Larger ranges amplify the influence of neighboring cells.
	Advanced Controls

		~Activation Scale (activationScale):

	A multiplier applied before the activation function.
	Lower (<1.0): More gradual activations. Higher (>1.0): Sharper, more pronounced responses.

		~Weight Initialization (weightInitStrategy):

	Sets how initial weights are distributed:

	-	XAVIER (suited for tanh/sigmoid),

	-	HE (optimized for ReLU functions),

	-	UNIFORM, or

	-	CUSTOM (user-defined).

		~Kernel Controls:

	Kernel Select (kernelSelect): Choose which of the 9 spatial positions to adjust.
	Kernel Scale (kernelScale): Scale weights for the selected kernel position, allowing finer spatial influence control.

		~Mutation Controls:

	Mutation Rate (mutationRate): Probability of a weight mutating during an operation.
	Mutation Strength (mutationStrength): The magnitude of weight changes when mutated.
	Mutation Pattern (mutationPattern): Shape mutations to be uniform, Gaussian, selective, spatially/temporally coherent, etc.

		~Channel Weight Scaling:

	Individual multipliers for each channel (channel0Scale – channel3Scale), allowing selective emphasis on certain information streams.

		~Mutation Masks:

	Enable or disable mutations for specific channels or spatial positions, providing protection for parts of the network while others evolve.

		~Auto-Evolution (autoEvolveBtn):

	When enabled, weights mutate automatically at regular intervals, encouraging ongoing diversity and emergent behaviors.

~Keyboard Shortcuts~

	[Space] - Start / Stop Simulation
	[R] - Reset Weights and Seed
	[Shift+R] - Reset Weights
	[M] - Mutate
	[E] - Toggkle Auto_Evolve

~Referance~

	For further reading and background on neural cellular automata and deep learning initialization strategies:

	Mordvintsev, A., et al. “Growing Neural Cellular Automata” (2020)

	Glorot, X. & Bengio, Y. “Understanding the difficulty of training deep feedforward neural networks” (2010)

	He, K., et al. “Delving Deep into Rectifiers” (2015)
	Ramachandran, P., et al. “Searching for Activation Functions” (2017)
## Moonlight Pools ##
<img width="1920" height="1041" alt="MoonlightPools6" src="https://github.com/user-attachments/assets/5db425b5-188c-4370-a7c8-2444af593cc0" />

This project presents a WebGL2-accelerated implementation of Neural Cellular Automata (NCA), enabling efficient, real-time simulation of cell-based systems governed by learned, rather than hand-coded, local update rules. A compact neural network operates at each grid cell, processing the local neighborhood and iteratively updating cell states based on its parameters. Utilizing WebGL2 for parallel computation on the GPU, the system can evolve complex, emergent spatiotemporal patterns at interactive frame rates within the browser environment. This approach demonstrates how neural networks can generalize and extend traditional cellular automata frameworks, providing a flexible platform for studying pattern formation, morphogenesis, and artificial life in a technically accessible way.

## Table of Contents
- [Startup Guide](#startup-guide)
- [Mathematical Foundation](#mathematical-foundation)
- [Control Reference](#control-reference)
- [Keyboard Shortcuts](#keyboard-shortcuts)

## Startup Guide

1. Clone repo or download folder for latest release.
2. Start Moonlight Pools shortcut

	2a. You may move shortcut to any directory you wish, as long
	
	  as you keep the rest of the original folder in tact.


## Mathematical Foundation

### Convolution Operation

The core computational step uses **2D convolution** to process each cell's neighborhood: 

	For each cell (x,y) and output channel c: newValue[x,y,c] = Σ Σ Σ (weights[dx,dy,ic,c] × inputValue[x+dx,y+dy,ic]) dx dy ic
	Where:
		- `dx, dy ∈ {-1, 0, 1}` (3×3 neighborhood)
		- `ic` = input channel index (0 to numChannels-1)
		- `c` = output channel index (0 to numChannels-1)

#### Kernel Structure
The 3×3 convolution kernel positions are indexed as:
		
	0(TL) 1(T)  2(TR) 3(L)  4(C)  5(R) 6(BL) 7(B)  8(BR)

<img width="1027" height="864" alt="MoonlightPools5" src="https://github.com/user-attachments/assets/fb762125-f67d-454f-89d6-c56f92c087a7" />

## Control Reference

### Basic Controls

#### **Channels** (`channelCount`)
- **Function**: Sets the number of information channels per cell
- **Range**: 1-4 channels
- **Effect**: 
  - 1 channel: Monochrome patterns (grayscale)
  - 2+ channels: Color patterns with hue/brightness encoding
- **Math Impact**: Changes the dimensionality of the convolution operation

#### **Step Count** (`stepsPerFrame`)
- **Function**: Number of computation steps per animation frame
- **Range**: 1-20 steps
- **Effect**: Higher values = faster evolution, more computation per frame
- **Performance**: Directly affects GPU workload

#### **Activation Function** (`activation`)
- **TANH**: Bounded output (-1,1), smooth gradients
- **RELU**: Unbounded positive output, sparse activation
- **SIGMOID**: Bounded output (0,1), always positive
- **SWISH**: Smooth, unbounded, self-gated
- **GELU**: Smooth approximation to ReLU with probabilistic interpretation
- **IDENTITY**: Linear pass-through (no non-linearity)

#### **Weight Range** (`weightRange`)
- **Function**: Maximum absolute value for weight initialization
- **Range**: ±0.5 to ±5.0
- **Math**: Controls the scale of the convolution operation
- **Effect**: Higher values = stronger interactions between cells

### Advanced Activation Controls

#### **Activation Scale** (`activationScale`)
- **Function**: Multiplier applied to input before activation
- **Range**: 0.5 - 2.0
- **Math**: `f(scale × x)` instead of `f(x)`
- **Effect**: 
  - < 1.0: Softer, more gradual activation
  - > 1.0: Sharper, more pronounced activation

### Weight Initialization

#### **Weight Init Strategy** (`weightInitStrategy`)
- **XAVIER**: Balanced for sigmoid/tanh activations
- **HE**: Optimized for ReLU-family activations  
- **UNIFORM**: Simple uniform distribution
- **CUSTOM**: User-defined initialization

<img width="1920" height="1040" alt="MoonlightPools7" src="https://github.com/user-attachments/assets/94f15724-6c21-4fcf-a0e5-f002ab730908" />

### Kernel Manipulation

#### **Kernel Select** (`kernelSelect`)
- **Function**: Chooses which of the 9 kernel positions to modify
- **Positions**: TL(0), T(1), TR(2), L(3), C(4), R(5), BL(6), B(7), BR(8)
- **Visual**: Selected position is highlighted in the kernel matrix display

#### **Kernel Scale** (`kernelScale`)
- **Function**: Multiplier for weights at the selected kernel position
- **Range**: 0.1x - 3.0x
- **Math**: `effectiveWeight = baseWeight × kernelScale × channelScale`
- **Effect**: 
  - < 1.0: Reduces influence of that spatial position
  - > 1.0: Amplifies influence of that spatial position

### Mutation Controls

#### **Mutation Rate** (`mutationRate`)
- **Function**: Probability that each weight will be mutated
- **Range**: 1% - 30%
- **Math**: `if random() < mutationRate: mutate(weight)`

#### **Mutation Strength** (`mutationStrength`)
- **Function**: Magnitude of weight changes during mutation
- **Range**: 5% - 50% of weight range
- **Math**: `mutation = ±mutationStrength × weightRange`

#### **Mutation Type** (`mutationPattern`)
- **UNIFORM**: Random uniform distribution
- **GAUSSIAN**: Normal distribution (smoother changes)
- **SELECTIVE**: Probability inversely related to weight magnitude
- **SPATIAL**: Coherent mutations across kernel positions
- **TEMPORAL**: Mutation strength decays over time

### Channel Weight Scaling

#### **CH0-CH3 Scale** (`channel0Scale` - `channel3Scale`)
- **Function**: Per-channel weight multipliers
- **Range**: 0.5x - 2.0x
- **Math**: `effectiveWeight = baseWeight × channelScale × kernelScale`
- **Effect**: Allows differential emphasis on different information channels

### Mutation Masks

#### **Channel Mutation Mask** (`mutateCh0` - `mutateCh3`)
- **Function**: Enable/disable mutation for specific channels
- **Effect**: Allows preserving certain channels while evolving others

#### **Kernel Mutation Mask** (kernel position checkboxes)
- **Function**: Enable/disable mutation for specific spatial positions
- **Effect**: Allows preserving center vs. edge weights independently

### Auto-Evolution

#### **Auto Evolve** (`autoEvolveBtn`)
- **Function**: Automatically mutates weights at random intervals (30-60 seconds)
- **Effect**: Continuous evolution without manual intervention

<img width="1019" height="860" alt="MoonlightPools1" src="https://github.com/user-attachments/assets/daae48fc-f090-455e-97c0-f2fab94dbc29" />

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause simulation |
| `R` | Reset simulation |
| `Shift+R` | Randomize weights |
| `M` | Mutate weights |
| `E` | Toggle auto-evolution |

<img width="1920" height="1001" alt="MoonlightPools8" src="https://github.com/user-attachments/assets/02fb719a-9f53-4197-b7e0-38d67dbff6e0" />

## Mathematical References

1. **Mordvintsev, A., et al.** "Growing Neural Cellular Automata" (2020)
2. **Glorot, X. & Bengio, Y.** "Understanding the difficulty of training deep feedforward neural networks" (2010)
3. **He, K., et al.** "Delving Deep into Rectifiers" (2015)
4. **Ramachandran, P., et al.** "Searching for Activation Functions" (2017)

---



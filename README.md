# 🎨 Jewelry Editor by Lima Labs

A powerful web-based 3D jewelry design tool that generates parametric, organic jewelry models in real-time. Built with p5.js and WebGL, this application allows designers to create unique, customizable jewelry pieces with advanced procedural generation techniques.

[![Live Demo](https://img.shields.io/badge/Live-Demo-gold?style=for-the-badge)](https://limasietecode.github.io/Jewerly_Vibecoding_01/)

---

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Architecture Overview](#-architecture-overview)
- [Parameter Reference](#-parameter-reference)
- [How It Works](#-how-it-works)
- [Export Formats](#-export-formats)
- [Development](#-development)

---

## ✨ Features

### Design Tools
- **Parametric Generation**: Control every aspect of your jewelry design through intuitive sliders
- **Real-time Preview**: See changes instantly with WebGL-accelerated 3D rendering
- **6 Built-in Presets**: Minimalist, Organic, Futuristic, Vortex, Spiked, and Alien styles
- **Attractor System**: Local deformation tool for creating custom focal points
- **Procedural Noise**: Perlin noise-based organic variations

### Materials & Rendering
- **MatCap Shading**: Realistic Gold, Silver, and Copper materials
- **Custom Shaders**: GLSL vertex and fragment shaders for photorealistic rendering
- **Dark/Light Themes**: Comfortable viewing in any environment

### Export & Workflow
- **STL Export**: Ready for 3D printing with accurate dimensions
- **OBJ Export**: Compatible with all major 3D software
- **Preset Management**: Save and load your custom designs as JSON
- **Screenshot Capture**: High-quality PNG exports of your renders
- **Dimension Display**: Real-time size calculations in millimeters

### User Experience
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Touch-Optimized**: Full support for touch gestures and mobile interactions
- **Camera Controls**: Front, Top, Side, and Isometric view presets
- **Orbit Controls**: Intuitive 3D navigation with mouse/touch

---

## 🚀 Quick Start

### Online (Recommended)
Visit the [live demo](https://limasietecode.github.io/Jewerly_Vibecoding_01/) - no installation required!

### Local Development
```bash
# Clone the repository
git clone https://github.com/limasietecode/Jewerly_Vibecoding_01.git

# Navigate to the directory
cd Jewerly_Vibecoding_01

# Open index.html in your browser
# Or use a local server (recommended):
python -m http.server 8000
# Then visit http://localhost:8000
```

---

## 🏗️ Architecture Overview

### Technology Stack
- **p5.js**: Core rendering engine and WebGL wrapper
- **Tailwind CSS**: Modern, responsive UI framework
- **Custom GLSL Shaders**: MatCap material rendering
- **Vanilla JavaScript**: No heavy frameworks, pure performance

### File Structure
```
├── index.html          # Main HTML structure and UI
├── sketch.js           # Core application logic (673 lines)
├── shader.vert         # Vertex shader for MatCap rendering
├── shader.frag         # Fragment shader for MatCap rendering
├── style.css           # Custom CSS overrides
└── assets/
    └── matcaps/        # Material textures (Gold, Silver, Copper)
```

### Core Components

#### 1. **Parameter System** (`params` object)
Central configuration object containing all design parameters, visual settings, and action functions. This is the single source of truth for the application state.

#### 2. **Mesh Generation Pipeline**
```
buildMesh() → makeContour() → addRibbonExtrusion() → Vertex/Face Arrays
```

#### 3. **Rendering Loop** (`draw()`)
- Background rendering
- Lighting setup
- Mesh rebuild detection
- Camera orbit controls
- Material/shader application
- Triangle mesh rendering

#### 4. **UI System** (`buildUI()`)
- Dynamic slider binding with gradient color feedback
- Preset button handlers
- Export action triggers
- Theme toggle management
- Mobile menu controls

---

## 📊 Parameter Reference

### Shape Properties

#### `LAYERS` (1-30, default: 26)
**What it does**: Number of concentric ribbon layers that make up the jewelry piece.
- **1 layer** = Simple ring/band
- **10-15 layers** = Medium complexity, organic flow
- **25-30 layers** = Dense, intricate, vortex-like structures

**Technical**: Each layer is a closed contour extruded into a 3D ribbon. Layers are interpolated from `MIN_R` to `MAX_R`.

---

#### `MIN_R` (5-200, default: 90)
**What it does**: Inner radius in pixels for the first layer.
- **Low values (5-50)**: Tight center, creates hollow or cone-like structures
- **Medium values (50-100)**: Balanced, ring-like appearance
- **High values (100-200)**: Wide, open center

**Technical**: Starting radius for the innermost layer. Combined with `MAX_R` to create radial interpolation.

---

#### `MAX_R` (5-300, default: 156)
**What it does**: Outer radius in pixels for the last layer.
- **Close to MIN_R**: Cylindrical, uniform thickness
- **Much larger than MIN_R**: Conical, flared, or trumpet-like shapes

**Technical**: Ending radius for the outermost layer. The difference `(MAX_R - MIN_R)` determines the overall "spread" of the design.

---

#### `NOISE_FREQ` (0-3, default: 0)
**What it does**: Frequency of Perlin noise applied to each contour.
- **0**: Smooth, geometric shapes
- **0.5-1.5**: Gentle organic variations
- **2-3**: Chaotic, highly irregular surfaces

**Technical**: Multiplied with `cos(angle)` and `sin(angle)` in the noise function. Higher values create more "wrinkles" around the circumference.

---

#### `WOBBLE_PX` (0-100, default: 0)
**What it does**: Amplitude of noise-based radius variation in pixels.
- **0**: Perfectly circular contours
- **10-30**: Subtle organic feel
- **50-100**: Extreme, blob-like deformations

**Technical**: Scales the noise output `(noise - 0.5) * 2.0 * WOBBLE_PX` and adds it to the base radius.

---

#### `LOBES` (0-20, default: 5)
**What it does**: Number of symmetrical "petals" or protrusions around the ring.
- **0**: No lobes, pure noise/circular shape
- **3-6**: Flower-like, organic patterns
- **12-20**: Gear-like, highly geometric

**Technical**: Uses `sin(angle * LOBES)` to create periodic radial variations.

---

#### `LOBE_AMP` (0-100, default: 48)
**What it does**: How far lobes extend from the base radius in pixels.
- **0**: Lobes disabled
- **20-50**: Subtle scalloped edges
- **70-100**: Dramatic spikes or petals

**Technical**: Amplitude of the sine wave: `sin(angle * LOBES) * LOBE_AMP`.

---

#### `STEP_A` (0.01-0.1, default: 0.028)
**What it does**: Angular step size when generating contour points.
- **Smaller values (0.01-0.02)**: Smoother curves, more vertices, slower performance
- **Larger values (0.05-0.1)**: Faceted, low-poly look, faster performance

**Technical**: Increment for the loop `for (let a = 0; a <= TWO_PI; a += STEP_A)`. Determines mesh resolution.

---

### Attractor System

#### `ATTRACTOR_ON` (boolean, default: false)
**What it does**: Enables/disables the local deformation field.

**Technical**: When enabled, modifies vertex positions based on distance from `ATTRACTOR_X, ATTRACTOR_Y`.

---

#### `ATTRACTOR_X` / `ATTRACTOR_Y` (-200 to 200, default: 100, 0)
**What it does**: 2D position of the attractor point in pixel space.

**Technical**: Center point for radial influence calculation.

---

#### `ATTRACTOR_RADIUS` (10-300, default: 100)
**What it does**: Radius of influence in pixels.
- **Small (10-50)**: Localized "dent" or "bump"
- **Large (150-300)**: Affects entire design

**Technical**: Distance threshold for influence calculation. Uses linear falloff: `map(distance, 0, radius, 1, 0)`.

---

#### `ATTRACTOR_STRENGTH` (-100 to 100, default: 50)
**What it does**: Magnitude of deformation.
- **Positive values**: Push vertices away (expansion)
- **Negative values**: Pull vertices inward (contraction)

**Technical**: Added to radius: `r += ATTRACTOR_STRENGTH * influence`.

---

### Extrusion Properties

#### `RIBBON_W_MIN` / `RIBBON_W_MAX` (0.5-20, default: 1, 3.5)
**What it does**: Width of the ribbon cross-section in pixels.
- **MIN**: Width of the innermost layer
- **MAX**: Width of the outermost layer
- **Equal values**: Uniform thickness throughout
- **Diverging values**: Tapered or flared effect

**Technical**: Interpolated per layer: `lerp(RIBBON_W_MIN, RIBBON_W_MAX, t)` where `t` is layer position (0 to 1).

---

#### `EXTRUDE_Z` (1-30, default: 4)
**What it does**: Thickness/height of each ribbon in pixels.
- **Low (1-5)**: Thin, delicate, sheet-like
- **Medium (6-15)**: Balanced, structural
- **High (16-30)**: Chunky, bold, sculptural

**Technical**: Half-depth is `EXTRUDE_Z * 0.5`. Vertices are created at `+hz` and `-hz` along the Z-axis.

---

### Miscellaneous

#### `SEED` (0-100000, default: 79736)
**What it does**: Random seed for noise and randomization.
- **Same seed**: Reproducible designs
- **Different seed**: Unique variations

**Technical**: Passed to `noiseSeed()` and `randomSeed()` to ensure deterministic generation.

---

#### `TARGET_DIAM_MM` (10-200, default: 59)
**What it does**: Desired outer diameter in millimeters for export.
- **Standard ring sizes**: 15-22mm
- **Pendants**: 30-60mm
- **Bracelets**: 60-80mm

**Technical**: Used to calculate export scale: `scale = TARGET_DIAM_MM / currentOuterDiameterPx()`.

---

#### `autoRotate` (boolean, default: false)
**What it does**: Enables automatic turntable rotation.

**Technical**: Increments `turntable` by 0.005 radians per frame.

---

#### `materialType` (string, default: "Gold")
**Options**: `Gold`, `Silver`, `Copper`, `Flat`

**What it does**: Selects the MatCap texture for rendering.
- **Gold/Silver/Copper**: Photorealistic metallic materials
- **Flat**: Simple grey with black wireframe

**Technical**: Loads corresponding PNG from `assets/matcaps/` and applies via custom shader.

---

## 🔧 How It Works

### 1. Mesh Generation Algorithm

The jewelry is constructed using a **layered ribbon extrusion** technique:

```javascript
for each LAYER (0 to LAYERS-1):
    1. Calculate interpolation factor: t = layer / (LAYERS - 1)
    2. Interpolate radius: R = lerp(MIN_R, MAX_R, t)
    3. Generate 2D contour:
        for each angle (0 to 2π, step STEP_A):
            a. Apply Perlin noise: ripple = noise(...) * WOBBLE_PX
            b. Apply lobes: petals = sin(angle * LOBES) * LOBE_AMP
            c. Calculate radius: r = R + ripple + petals
            d. Apply attractor influence (if enabled)
            e. Convert to cartesian: (x, y) = (r*cos(angle), r*sin(angle))
    4. Extrude contour into 3D ribbon:
        a. Calculate normals for ribbon width
        b. Create 4 vertex rings: outer-top, inner-top, outer-bottom, inner-bottom
        c. Generate quad faces (2 triangles each) between consecutive points
```

### 2. Ribbon Extrusion Details

Each 2D contour is converted into a 3D ribbon with rectangular cross-section:

```
     outer-top -------- outer-top (next point)
         |                    |
         |    (ribbon)        |
         |                    |
     inner-top -------- inner-top (next point)

     (Same structure for bottom at -Z)
```

**Face generation** (8 triangles per segment):
- Top face: 2 triangles
- Bottom face: 2 triangles
- Outer wall: 2 triangles
- Inner wall: 2 triangles

### 3. MatCap Shader System

**MatCap** (Material Capture) is a technique that encodes lighting and material properties in a single texture:

1. **Vertex Shader** (`shader.vert`):
   - Transforms vertices to clip space
   - Calculates view-space normals
   - Passes normals to fragment shader

2. **Fragment Shader** (`shader.frag`):
   - Converts 3D normal to 2D UV coordinates: `uv = normal.xy * 0.5 + 0.5`
   - Samples MatCap texture at UV
   - Outputs final color

**Why MatCap?**
- No real-time lighting calculations needed
- Photorealistic results with minimal performance cost
- Perfect for metallic materials

### 4. Export Scaling

All internal calculations use **pixels** as units. For export:

```javascript
currentDiameter = max(boundingBox.width, boundingBox.height)
scale = TARGET_DIAM_MM / currentDiameter
exportedVertex = vertex * scale
```

This ensures the exported model matches the desired physical size.

---

## 📦 Export Formats

### STL (Stereolithography)
**Best for**: 3D printing, CNC machining

**Format**: ASCII text
```
solid jewelry
  facet normal nx ny nz
    outer loop
      vertex x1 y1 z1
      vertex x2 y2 z2
      vertex x3 y3 z3
    endloop
  endfacet
  ...
endsolid jewelry
```

**Scaling**: Automatically applied based on `TARGET_DIAM_MM`

---

### OBJ (Wavefront)
**Best for**: Import into Blender, Maya, 3ds Max, etc.

**Format**: ASCII text
```
# Vibecoding Jewelry
v x1 y1 z1
v x2 y2 z2
...
f v1 v2 v3
f v4 v5 v6
...
```

**Scaling**: Automatically applied based on `TARGET_DIAM_MM`

---

### JSON (Preset)
**Best for**: Saving and sharing designs

**Format**: JSON object containing all parameter values
```json
{
  "LAYERS": 26,
  "MIN_R": 90,
  "MAX_R": 156,
  "NOISE_FREQ": 0,
  ...
}
```

---

## 🛠️ Development

### Project Structure

```javascript
// Main Application Flow
preload()           // Load shaders and textures
  ↓
setup()             // Initialize canvas, noise, UI
  ↓
draw()              // Render loop (60 FPS)
  ├─ buildMesh()    // Generate geometry (if needed)
  ├─ orbitControl() // Handle camera
  └─ render mesh    // Draw triangles with shader
```

### Key Functions

#### `buildMesh()`
Generates the complete 3D geometry by iterating through layers and calling `makeContour()` and `addRibbonExtrusion()`.

#### `makeContour(R, amp, nfreq, lobes, lobeAmp, seedVal)`
Creates a single 2D closed curve with noise and lobe modulation.

#### `addRibbonExtrusion(poly, width, depth)`
Converts a 2D polygon into a 3D ribbon mesh by:
1. Computing normals for width offset
2. Creating 4 vertex loops (top-outer, top-inner, bottom-outer, bottom-inner)
3. Generating triangle faces to connect them

#### `updateDimensionsDisplay()`
Calculates bounding box and displays real-world dimensions in millimeters.

### Performance Optimizations

1. **Pixel Density**: Set to 1.0 on mobile for better performance
2. **Conditional Rebuild**: Mesh only regenerates when parameters change
3. **UI Interaction Detection**: Disables orbit controls when hovering over sidebar
4. **Efficient Mesh Storage**: Uses typed arrays (`Int32Array`) for index buffers

### Adding New Presets

Edit the `presets` object in `sketch.js`:

```javascript
const presets = {
    'YourPresetName': {
        LAYERS: 15,
        MIN_R: 60,
        MAX_R: 140,
        NOISE_FREQ: 1.0,
        WOBBLE_PX: 20,
        LOBES: 6,
        LOBE_AMP: 25,
        RIBBON_W_MIN: 5,
        RIBBON_W_MAX: 3,
        EXTRUDE_Z: 8
    }
};
```

Then add a button in `index.html`:
```html
<button class="preset-btn ..." data-preset="YourPresetName">
    Your Preset
</button>
```

---

## 🎨 Design Tips

### Creating Organic Jewelry
- Use **NOISE_FREQ** (0.8-1.5) and **WOBBLE_PX** (15-30)
- Set **LOBES** to 0 or low values (3-5)
- Vary **RIBBON_W** for natural taper

### Creating Geometric Jewelry
- Set **NOISE_FREQ** and **WOBBLE_PX** to 0
- Use **LOBES** (6-12) with high **LOBE_AMP** (40-80)
- Keep **RIBBON_W** uniform

### Creating Vortex/Spiral Effects
- High **LAYERS** (20-30)
- Moderate **NOISE_FREQ** (1.5-2.5)
- Gradual **MIN_R** to **MAX_R** transition
- Low **STEP_A** (0.02) for smooth spirals

### Using the Attractor
1. Enable **ATTRACTOR_ON**
2. Position with **ATTRACTOR_X/Y** (try 100, 0 for right side)
3. Set **ATTRACTOR_RADIUS** (50-150)
4. Adjust **ATTRACTOR_STRENGTH**:
   - Positive: Creates a "bump" or expansion
   - Negative: Creates a "dent" or contraction

---

## 📄 License

This project is created by **Lima Labs** for educational and commercial use.

---

## 🙏 Credits

- **Original Concept**: Lima Labs / Vibecoding
- **Web Port**: Lima Labs Development Team
- **MatCap Textures**: Standard PBR material captures
- **Libraries**: p5.js, Tailwind CSS

---

## 🔗 Links

- [Live Demo](https://limasietecode.github.io/Jewerly_Vibecoding_01/)
- [GitHub Repository](https://github.com/limasietecode/Jewerly_Vibecoding_01)
- [Lima Labs](https://github.com/limasietecode)

---

**Made with ❤️ by Lima Labs**

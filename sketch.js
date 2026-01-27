// Vibration Jewelry Editor - Ported to p5.js
// Original by Lima Labs / Vibecoding
// Ported for web deployment
// Updates: MatCaps, Presets, Camera Control, STL Export

// ------------------ Parameters ------------------
const params = {
    // Shape properies
    LAYERS: 26,
    MIN_R: 90,
    MAX_R: 156,
    NOISE_FREQ: 0,
    WOBBLE_PX: 0,
    LOBES: 5,
    LOBE_AMP: 48,
    STEP_A: 0.028,

    // Attractor
    ATTRACTOR_ON: false,
    ATTRACTOR_X: 100,
    ATTRACTOR_Y: 0,
    ATTRACTOR_RADIUS: 100,
    ATTRACTOR_STRENGTH: 50,

    // Extrusion properties
    RIBBON_W_MIN: 1,
    RIBBON_W_MAX: 3.5,
    EXTRUDE_Z: 4,

    // Misc
    SEED: 79736,
    TARGET_DIAM_MM: 59,
    autoRotate: false,
    autoRebuild: true,
    turntable: 7.004999999999873,
    displayWireframe: false,

    // Visuals
    materialType: 'Gold', // Gold, Silver, Copper, Flat
    bgColor: '#ffffff',

    // Actions
    RandomizeSeed: function () {
        params.SEED = Math.floor(Math.random() * 100000);
        noiseSeed(params.SEED);
        randomSeed(params.SEED);
        updateUISync();
        triggerRebuild();
    },
    Rebuild: function () {
        triggerRebuild();
    },
    Export_OBJ: function () {
        doExportOBJ();
    },
    Export_STL: function () {
        doExportSTL();
    },
    Screenshot: function () {
        saveCanvas('jewelry_design', 'png');
    },
    SavePreset: function () {
        doSavePreset();
    },
    LoadPreset: function () {
        doLoadPreset();
    },

    // Camera Views
    ViewFront: function () { setCameraView(0, 0, 800); params.autoRotate = false; },
    ViewTop: function () { setCameraView(0, -800, 0.1); params.autoRotate = false; }, // Y-up is negative in p5 webgl sometimes or just different
    ViewSide: function () { setCameraView(800, 0, 0); params.autoRotate = false; },
    ViewIso: function () { setCameraView(600, -600, 600); params.autoRotate = false; }
};

const presets = {
    'Minimalist': {
        LAYERS: 1, MIN_R: 60, MAX_R: 60, NOISE_FREQ: 0.1, WOBBLE_PX: 2, LOBES: 0, LOBE_AMP: 0, RIBBON_W_MIN: 12, RIBBON_W_MAX: 12
    },
    'Organic': {
        LAYERS: 12, MIN_R: 10, MAX_R: 180, NOISE_FREQ: 1.2, WOBBLE_PX: 25, LOBES: 5, LOBE_AMP: 15, RIBBON_W_MIN: 4, RIBBON_W_MAX: 2
    },
    'Futuristic': {
        LAYERS: 6, MIN_R: 40, MAX_R: 160, NOISE_FREQ: 0, WOBBLE_PX: 0, LOBES: 3, LOBE_AMP: 40, RIBBON_W_MIN: 2, RIBBON_W_MAX: 2, EXTRUDE_Z: 20
    },
    'Vortex': {
        LAYERS: 24, MIN_R: 20, MAX_R: 200, NOISE_FREQ: 2.5, WOBBLE_PX: 30, LOBES: 0, LOBE_AMP: 0, STEP_A: 0.02, RIBBON_W_MIN: 3, RIBBON_W_MAX: 1
    },
    'Spiked': {
        LAYERS: 5, MIN_R: 50, MAX_R: 140, NOISE_FREQ: 0.2, WOBBLE_PX: 5, LOBES: 12, LOBE_AMP: 50, RIBBON_W_MIN: 4, RIBBON_W_MAX: 4, EXTUDE_Z: 15
    },
    'Alien': {
        LAYERS: 12, MIN_R: 30, MAX_R: 170, NOISE_FREQ: 0.4, WOBBLE_PX: 60, LOBES: 4, LOBE_AMP: 10, RIBBON_W_MIN: 6, RIBBON_W_MAX: 2
    }
};

let gui;
let built = false;
let needsRebuild = true;
let matcapShader;
let matcaps = {};

// Mesh buffers
let V = []; // Vertices (p5.Vector)
let F = []; // Faces (int[3])

function preload() {
    matcapShader = loadShader('shader.vert', 'shader.frag');
    matcaps['Gold'] = loadImage('assets/matcaps/Gold.png');
    matcaps['Silver'] = loadImage('assets/matcaps/Silver.png');
    matcaps['Copper'] = loadImage('assets/matcaps/Copper.png');
}

function setup() {
    // Mobile optimization: Force 1.0 pixel density for performance
    pixelDensity(1);

    let c = createCanvas(windowWidth, windowHeight, WEBGL);
    c.parent('canvas-container');
    smooth();

    // Noise settings
    noiseSeed(params.SEED);
    randomSeed(params.SEED);
    noiseDetail(4, 0.5);

    buildUI();
}

function draw() {
    background(params.bgColor);

    // Lighting (only used if shader is not active or for wireframe)
    ambientLight(150);
    directionalLight(255, 255, 255, 0.5, 0.8, -1);

    if (!built || needsRebuild) {
        buildMesh();
        updateDimensionsDisplay();
        built = true;
        needsRebuild = false;
    }

    // Camera Orbit
    // Fix: Only orbit if not interacting with the sidebar
    let sidebar = document.getElementById('sidebar');
    let isOverSidebar = sidebar && sidebar.matches(':hover');
    // Also check if we are currently dragging on a UI element (active element inputs)
    let activeEl = document.activeElement;
    let isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'BUTTON');

    if (!isOverSidebar && !isInputActive) {
        orbitControl();
    }

    // Auto Rotation
    if (params.autoRotate) {
        params.turntable += 0.005;
    }

    push();
    // Apply rotation
    rotateY(params.turntable);
    // Initial tilt for cosmetic view
    rotateX(radians(-24));

    // Material Handling
    if (params.materialType !== 'Flat' && matcaps[params.materialType]) {
        shader(matcapShader);
        matcapShader.setUniform('uMatcapTexture', matcaps[params.materialType]);
        noStroke();
    } else {
        resetShader();
        fill(200); // Default grey if flat
        if (params.materialType === 'Flat') {
            stroke(0);
            strokeWeight(0.5);
        } else {
            noStroke();
        }
    }

    // Draw Mesh
    beginShape(TRIANGLES);
    for (let tri of F) {
        let a = V[tri[0]];
        let b = V[tri[1]];
        let c = V[tri[2]];

        // Check validity
        if (!a || !b || !c) continue;

        let n = faceNormal(a, b, c);
        normal(n.x, n.y, n.z);

        vertex(a.x, a.y, a.z, 0, 0);
        vertex(b.x, b.y, b.z, 1, 0);
        vertex(c.x, c.y, c.z, 0, 1);
    }
    endShape();

    // Draw Attractor Visualization (if on)
    if (params.ATTRACTOR_ON) {
        resetShader();
        push();
        translate(params.ATTRACTOR_X, params.ATTRACTOR_Y, 0);
        noStroke();
        fill(255, 0, 0, 150);
        sphere(5); // Center point
        noFill();
        stroke(255, 0, 0, 50);
        circle(0, 0, params.ATTRACTOR_RADIUS * 2); // Influence range
        pop();
    }

    pop();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

// ------------------ Camera Helper ------------------
function setCameraView(x, y, z) {
    // Reset turntable
    params.turntable = 0;
    camera(x, y, z, 0, 0, 0, 0, 1, 0);
}

// ------------------ Build UI (Tailwind Integration) ------------------

// Global helper for slider color gradient (Gold -> Copper)
function updateSliderColor(el) {
    let min = parseFloat(el.min);
    let max = parseFloat(el.max);
    let val = parseFloat(el.value);
    let t = (max - min) !== 0 ? (val - min) / (max - min) : 0;

    // Gold: 212, 175, 55 | Copper: 200, 117, 51
    let r = lerp(212, 200, t);
    let g = lerp(175, 117, t);
    let b = lerp(55, 51, t);

    el.style.setProperty('--thumb-color', `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`);
}

function buildUI() {
    // We no longer use lil-gui. We bind HTML elements to params.

    // --- Helper to bind slider ---
    const bindSlider = (id, paramKey, onChange = triggerRebuild) => {
        const el = document.getElementById(id);
        const valDisplay = document.getElementById('val-' + paramKey);
        if (!el) return;

        // Init value
        el.value = params[paramKey];
        updateSliderColor(el);

        el.oninput = (e) => {
            let val = parseFloat(e.target.value);
            params[paramKey] = val;
            if (valDisplay) valDisplay.innerText = val;
            updateSliderColor(e.target);
            onChange();
        };
    };

    // --- Helper to bind button ---
    const bindBtn = (id, callback) => {
        const el = document.getElementById(id);
        if (el) el.onclick = callback;
    };

    // --- Shape ---
    bindSlider('inp-LAYERS', 'LAYERS');
    bindSlider('inp-MIN_R', 'MIN_R');
    bindSlider('inp-MAX_R', 'MAX_R');
    bindSlider('inp-NOISE_FREQ', 'NOISE_FREQ');
    bindSlider('inp-WOBBLE_PX', 'WOBBLE_PX');

    // --- Extrusion ---
    bindSlider('inp-LOBES', 'LOBES');
    bindSlider('inp-LOBE_AMP', 'LOBE_AMP');
    bindSlider('inp-RIBBON_W_MIN', 'RIBBON_W_MIN');
    bindSlider('inp-RIBBON_W_MAX', 'RIBBON_W_MAX');
    bindSlider('inp-EXTRUDE_Z', 'EXTRUDE_Z');

    // --- Export Settings ---
    bindSlider('inp-TARGET_DIAM_MM', 'TARGET_DIAM_MM');

    // --- Attractor ---
    const attToggle = document.getElementById('inp-ATTRACTOR_ON');
    const attControls = document.getElementById('attractor-controls');
    if (attToggle) {
        attToggle.onchange = (e) => {
            params.ATTRACTOR_ON = e.target.checked;
            attControls.classList.toggle('opacity-50', !params.ATTRACTOR_ON);
            attControls.classList.toggle('pointer-events-none', !params.ATTRACTOR_ON);
            triggerRebuild();
        };
    }
    bindSlider('inp-ATTRACTOR_X', 'ATTRACTOR_X');
    bindSlider('inp-ATTRACTOR_Y', 'ATTRACTOR_Y');
    bindSlider('inp-ATTRACTOR_RADIUS', 'ATTRACTOR_RADIUS');
    bindSlider('inp-ATTRACTOR_STRENGTH', 'ATTRACTOR_STRENGTH');

    // --- Appearance ---
    // Material Buttons
    document.querySelectorAll('.material-btn').forEach(btn => {
        btn.onclick = () => {
            params.materialType = btn.dataset.mat;
            // Reset all borders
            document.querySelectorAll('.material-btn').forEach(b => b.classList.remove('border-brand', 'text-brand'));
            if (btn.dataset.mat !== 'Flat') btn.classList.add('border-brand');
            triggerRebuild();
        };
    });

    // BG Color
    const bgInput = document.getElementById('bg-color');
    if (bgInput) {
        bgInput.oninput = (e) => params.bgColor = e.target.value;
    }

    // Auto Rotate
    const rotInput = document.getElementById('auto-rotate');
    if (rotInput) {
        rotInput.onchange = (e) => params.autoRotate = e.target.checked;
    }

    // --- Presets ---
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.onclick = () => applyPreset(btn.dataset.preset);
    });

    // --- Camera ---
    document.querySelectorAll('.cam-btn').forEach(btn => {
        btn.onclick = () => {
            let view = btn.dataset.view;
            if (view === 'Front') params.ViewFront();
            if (view === 'Top') params.ViewTop();
            if (view === 'Side') params.ViewSide();
            if (view === 'Iso') params.ViewIso();
        };
    });

    // --- Actions ---
    bindBtn('btn-screenshot', params.Screenshot);
    bindBtn('btn-save-preset', doSavePreset);
    bindBtn('btn-load-preset', doLoadPreset);
    bindBtn('btn-export-obj', doExportOBJ);
    bindBtn('btn-export-stl', doExportSTL);
    bindBtn('btn-seed', params.RandomizeSeed);

    // Mobile Sidebar Toggle
    const sidebar = document.getElementById('sidebar');
    const mobileBtn = document.getElementById('mobile-menu-btn');

    if (mobileBtn) mobileBtn.onclick = () => {
        if (sidebar) {
            sidebar.classList.toggle('translate-x-full');
            // Toggle button icon between ☰ and ✕
            mobileBtn.textContent = sidebar.classList.contains('translate-x-full') ? '☰' : '✕';
        }
    };

    // Init Sidebar State (Desktop open, Mobile closed)
    if (window.innerWidth < 768 && sidebar) {
        sidebar.classList.add('translate-x-full');
    }

    // Theme Toggle
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.onclick = () => {
            document.documentElement.classList.toggle('dark');
            // Visual update if needed (canvas bg should update auto next draw frame if using CSS var, 
            // but we use params.bgColor in sketch. Syncing that is tricky if user picked custom color.
            // Let's force a default background for light/dark modes if they haven't manually picked one?)
        };
    }
}

// ------------------ Helpers ------------------
function updateUISync() {
    if (!document.getElementById('sidebar')) return;
    // Sync all sliders
    for (let key in params) {
        if (typeof params[key] !== 'function') {
            let el = document.getElementById('inp-' + key);
            let disp = document.getElementById('val-' + key);
            if (el) {
                el.value = params[key];
                updateSliderColor(el);
            }
            if (disp) disp.innerText = params[key];
        }
    }
    // Sync visual toggles if needed
    let attToggle = document.getElementById('inp-ATTRACTOR_ON');
    if (attToggle) attToggle.checked = params.ATTRACTOR_ON;
}

function applyPreset(name) {
    let p = presets[name];
    if (!p) return;
    Object.assign(params, p);
    updateUISync();
    triggerRebuild();
}

function doSavePreset() {
    // Filter out functions and keep only properties
    let data = {};
    for (let key in params) {
        if (typeof params[key] !== 'function') {
            data[key] = params[key];
        }
    }
    saveJSON(data, 'jewelry_preset.json');
}

function doLoadPreset() {
    // Create a hidden file input
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = (e) => {
        let file = e.target.files[0];
        if (!file) return;

        let reader = new FileReader();
        reader.onload = (event) => {
            try {
                let data = JSON.parse(event.target.result);
                Object.assign(params, data);
                updateUISync();
                triggerRebuild();
                console.log("Preset loaded successfully");
            } catch (err) {
                console.error("Error loading preset:", err);
                alert("Invalid JSON file");
            }
            document.body.removeChild(input);
        };
        reader.readAsText(file);
    };

    input.click();
}

// ------------------ Mesh Construction ------------------
function buildMesh() {
    V = [];
    F = [];
    noiseSeed(params.SEED);
    randomSeed(params.SEED);

    for (let i = 0; i < params.LAYERS; i++) {
        let t = (params.LAYERS === 1) ? 0 : map(i, 0, params.LAYERS - 1, 0, 1);
        let R = lerp(params.MIN_R, params.MAX_R, t);
        let amp = params.WOBBLE_PX * (1.1 - 0.5 * t);
        let seedVal = 2.38 * i;
        let ribbonW = lerp(params.RIBBON_W_MIN, params.RIBBON_W_MAX, t);

        let centerline = makeContour(R, amp, params.NOISE_FREQ, params.LOBES,
            params.LOBE_AMP * (1.2 - 0.6 * t), seedVal);
        addRibbonExtrusion(centerline, ribbonW, params.EXTRUDE_Z);
    }
}

function makeContour(R, amp, nfreq, lobes, lobeAmp, seedVal) {
    let pts = [];
    // Attractor Prep
    let attPos = createVector(params.ATTRACTOR_X, params.ATTRACTOR_Y);

    for (let a = 0; a <= TWO_PI + 0.0001; a += params.STEP_A) {
        let n = noise(cos(a) * nfreq + seedVal, sin(a) * nfreq + seedVal * 0.7);
        let ripple = (n - 0.5) * 2.0 * amp;
        let petals = sin(a * lobes + seedVal * 1.3) * lobeAmp;
        let r = Math.max(5, R + ripple + petals);

        // Convert to position
        let x = r * cos(a);
        let y = r * sin(a);

        // Attractor Influence
        if (params.ATTRACTOR_ON) {
            let d = dist(x, y, attPos.x, attPos.y);
            if (d < params.ATTRACTOR_RADIUS) {
                // Linear falloff 0 at radius, 1 at center
                let influence = map(d, 0, params.ATTRACTOR_RADIUS, 1, 0);

                // Modify the current radius 'r' based on attractor strength
                // Positive strength pushes away (expands radius?), negative pulls in?
                // Let's interpret strength as direct addition to density/radius

                let change = params.ATTRACTOR_STRENGTH * influence;
                r += change;
                r = Math.max(0.1, r); // Prevent negative radius

                // Recalculate XY because R changed
                x = r * cos(a);
                y = r * sin(a);
            }
        }

        pts.push(createVector(x, y, 0));
    }
    return pts;
}

function addRibbonExtrusion(poly, width, depth) {
    let n = poly.length;
    if (n < 3) return;
    let hw = width * 0.5;
    let hz = depth * 0.5;

    let idxOutTop = new Int32Array(n);
    let idxInTop = new Int32Array(n);
    let idxOutBot = new Int32Array(n);
    let idxInBot = new Int32Array(n);

    for (let i = 0; i < n; i++) {
        let p = poly[i];
        let p0 = poly[(i - 1 + n) % n];
        let p1 = poly[(i + 1) % n];
        let tangent = p5.Vector.sub(p1, p0);
        tangent.normalize();
        let normal2D = createVector(-tangent.y, tangent.x);
        let pout = p5.Vector.add(p, p5.Vector.mult(normal2D, hw));
        let pin = p5.Vector.add(p, p5.Vector.mult(normal2D, -hw));

        idxOutTop[i] = addVertex(createVector(pout.x, pout.y, hz));
        idxInTop[i] = addVertex(createVector(pin.x, pin.y, hz));
        idxOutBot[i] = addVertex(createVector(pout.x, pout.y, -hz));
        idxInBot[i] = addVertex(createVector(pin.x, pin.y, -hz));
    }

    for (let i = 0; i < n; i++) {
        let i2 = (i + 1) % n;
        addTri(idxOutTop[i], idxInTop[i], idxInTop[i2]);
        addTri(idxOutTop[i], idxInTop[i2], idxOutTop[i2]);
        addTri(idxOutBot[i], idxInBot[i2], idxInBot[i]);
        addTri(idxOutBot[i], idxOutBot[i2], idxInBot[i2]);
        addTri(idxOutTop[i], idxOutBot[i], idxOutBot[i2]);
        addTri(idxOutTop[i], idxOutBot[i2], idxOutTop[i2]);
        addTri(idxInTop[i], idxInBot[i2], idxInBot[i]);
        addTri(idxInTop[i], idxInTop[i2], idxInBot[i2]);
    }
}

function addVertex(v) {
    V.push(v);
    return V.length - 1;
}

function addTri(a, b, c) {
    F.push([a, b, c]);
}

function faceNormal(a, b, c) {
    let u = p5.Vector.sub(b, a);
    let v = p5.Vector.sub(c, a);
    let n = u.cross(v);
    n.normalize();
    return n;
}

function triggerRebuild() {
    built = false;
    needsRebuild = true;
}

// ------------------ Export / Dimensions ------------------
function currentOuterDiameterPx() {
    if (V.length === 0) return 0;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (let p of V) {
        if (p.x < minx) minx = p.x;
        if (p.x > maxx) maxx = p.x;
        if (p.y < miny) miny = p.y;
        if (p.y > maxy) maxy = p.y;
    }
    return Math.max(maxx - minx, maxy - miny);
}

function getExportScale() {
    let dpx = currentOuterDiameterPx();
    return (dpx > 0) ? (params.TARGET_DIAM_MM / dpx) : 1.0;
}

function updateDimensionsDisplay() {
    if (V.length === 0) return;

    // Bounds in Px
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, minz = Infinity, maxz = -Infinity;
    for (let p of V) {
        if (p.x < minx) minx = p.x;
        if (p.x > maxx) maxx = p.x;
        if (p.y < miny) miny = p.y;
        if (p.y > maxy) maxy = p.y;
        if (p.z < minz) minz = p.z;
        if (p.z > maxz) maxz = p.z;
    }

    let w = maxx - minx;
    let h = maxy - miny;
    let d = maxz - minz;

    // Scale to mm
    let scale = getExportScale();
    let mmW = w * scale;
    let mmH = h * scale;
    let mmD = d * scale;

    let el = document.getElementById('dim-display');
    if (el) {
        el.innerText = `${mmW.toFixed(1)} x ${mmH.toFixed(1)} x ${mmD.toFixed(1)} mm`;
    }
}

function doExportOBJ() {
    let scale = getExportScale();
    let fname = "jewelry_" + Date.now() + ".obj";
    let output = [];
    output.push("# Vibecoding Jewelry");
    for (let v of V) output.push(`v ${(v.x * scale).toFixed(6)} ${(v.y * scale).toFixed(6)} ${(v.z * scale).toFixed(6)}`);
    for (let tri of F) output.push(`f ${tri[0] + 1} ${tri[1] + 1} ${tri[2] + 1}`);
    let blob = new Blob([output.join('\n')], { type: 'text/plain' });
    downloadBlob(blob, fname);
}

function doExportSTL() {
    let scale = getExportScale();
    let fname = "jewelry_" + Date.now() + ".stl";
    let out = "solid jewelry\n";

    for (let tri of F) {
        let v1 = V[tri[0]];
        let v2 = V[tri[1]];
        let v3 = V[tri[2]];

        // Normal calculation
        let u = p5.Vector.sub(v2, v1);
        let v = p5.Vector.sub(v3, v1);
        let n = u.cross(v).normalize();

        out += `facet normal ${n.x.toFixed(6)} ${n.y.toFixed(6)} ${n.z.toFixed(6)}\n`;
        out += "outer loop\n";
        out += `vertex ${(v1.x * scale).toFixed(6)} ${(v1.y * scale).toFixed(6)} ${(v1.z * scale).toFixed(6)}\n`;
        out += `vertex ${(v2.x * scale).toFixed(6)} ${(v2.y * scale).toFixed(6)} ${(v2.z * scale).toFixed(6)}\n`;
        out += `vertex ${(v3.x * scale).toFixed(6)} ${(v3.y * scale).toFixed(6)} ${(v3.z * scale).toFixed(6)}\n`;
        out += "endloop\n";
        out += "endfacet\n";
    }
    out += "endsolid jewelry\n";
    let blob = new Blob([out], { type: 'text/plain' });
    downloadBlob(blob, fname);
}

function downloadBlob(blob, filename) {
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
}

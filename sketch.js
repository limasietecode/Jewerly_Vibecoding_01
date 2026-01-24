// Vibration Jewelry Editor - Ported to p5.js
// Original by Lima Labs / Vibecoding
// Ported for web deployment
// Updates: MatCaps, Presets, Camera Control, STL Export

// ------------------ Parameters ------------------
const params = {
    // Shape properies
    LAYERS: 9,
    MIN_R: 18,
    MAX_R: 170,
    NOISE_FREQ: 0.9,
    WOBBLE_PX: 15,
    LOBES: 6,
    LOBE_AMP: 12,
    STEP_A: 0.028,

    // Extrusion properties
    RIBBON_W_MIN: 8,
    RIBBON_W_MAX: 5,
    EXTRUDE_Z: 10,

    // Misc
    SEED: 1337,
    TARGET_DIAM_MM: 45,
    autoRotate: true,
    autoRebuild: true,
    turntable: 0,
    displayWireframe: false,

    // Visuals
    materialType: 'Gold', // Gold, Silver, Copper, Flat
    bgColor: '#ffffff',

    // Actions
    RandomizeSeed: function () {
        params.SEED = Math.floor(Math.random() * 100000);
        noiseSeed(params.SEED);
        randomSeed(params.SEED);
        gui.controllers.forEach(c => c.updateDisplay());
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
        built = true;
        needsRebuild = false;
    }

    // Camera Orbit
    orbitControl();

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

        // We don't use stroke in shader mode typically, usually wireframe is separate
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

        // Texture coordinates (UV) not strictly needed for MatCap in this simple implementation
        // as we use view-space normals, but good practice
        vertex(a.x, a.y, a.z, 0, 0);
        vertex(b.x, b.y, b.z, 1, 0);
        vertex(c.x, c.y, c.z, 0, 1);
    }
    endShape();
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

// ------------------ Build UI ------------------
function buildUI() {
    gui = new lil.GUI({ title: 'Jewelry Editor' });

    // Presets
    const gPresets = gui.addFolder('Presets');
    for (let name in presets) {
        let pObj = { [name]: function () { applyPreset(name); } };
        gPresets.add(pObj, name);
    }

    // Shape
    const gShape = gui.addFolder('Shape');
    gShape.add(params, 'LAYERS', 1, 30, 1).onChange(triggerRebuild).listen();
    gShape.add(params, 'MIN_R', 4, 150).onChange(triggerRebuild).listen();
    gShape.add(params, 'MAX_R', 10, 300).onChange(triggerRebuild).listen();
    gShape.add(params, 'NOISE_FREQ', 0.0, 3.0).onChange(triggerRebuild).listen();
    gShape.add(params, 'WOBBLE_PX', 0.0, 80.0).onChange(triggerRebuild).listen();
    gShape.add(params, 'LOBES', 0, 24, 1).onChange(triggerRebuild).listen();
    gShape.add(params, 'LOBE_AMP', 0.0, 80.0).onChange(triggerRebuild).listen();
    gShape.add(params, 'STEP_A', 0.005, 0.08).onChange(triggerRebuild).listen();

    // Extrusion
    const gExtrude = gui.addFolder('Extrusion');
    gExtrude.add(params, 'RIBBON_W_MIN', 0.5, 15).onChange(triggerRebuild).listen();
    gExtrude.add(params, 'RIBBON_W_MAX', 0.5, 15).onChange(triggerRebuild).listen();
    gExtrude.add(params, 'EXTRUDE_Z', 0.5, 25).onChange(triggerRebuild).listen();

    // Visuals
    const gVisuals = gui.addFolder('Appearance');
    gVisuals.add(params, 'materialType', ['Gold', 'Silver', 'Copper', 'Flat']).name('Material');
    gVisuals.addColor(params, 'bgColor').name('Background');
    gVisuals.add(params, 'autoRotate').listen();

    // View
    const gView = gui.addFolder('Camera / Export');
    gView.add(params, 'ViewFront').name('Front View');
    gView.add(params, 'ViewTop').name('Top View');
    gView.add(params, 'ViewSide').name('Side View');
    gView.add(params, 'ViewIso').name('Isometric');
    gView.add(params, 'Screenshot');

    // Data
    const gData = gui.addFolder('Data / Export');
    gData.add(params, 'SEED').listen().onChange(() => { noiseSeed(params.SEED); randomSeed(params.SEED); triggerRebuild(); });
    gData.add(params, 'RandomizeSeed');
    gData.add(params, 'TARGET_DIAM_MM', 10, 100);
    gData.add(params, 'SavePreset');
    gData.add(params, 'LoadPreset');
    gData.add(params, 'Rebuild');
    gData.add(params, 'Export_OBJ');
    gData.add(params, 'Export_STL');
}

function applyPreset(name) {
    let p = presets[name];
    if (!p) return;
    Object.assign(params, p);
    // Force update UI
    gui.controllersRecursive().forEach(c => c.updateDisplay());
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
                gui.controllersRecursive().forEach(c => c.updateDisplay());
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
    for (let a = 0; a <= TWO_PI + 0.0001; a += params.STEP_A) {
        let n = noise(cos(a) * nfreq + seedVal, sin(a) * nfreq + seedVal * 0.7);
        let ripple = (n - 0.5) * 2.0 * amp;
        let petals = sin(a * lobes + seedVal * 1.3) * lobeAmp;
        let r = Math.max(5, R + ripple + petals);
        pts.push(createVector(r * cos(a), r * sin(a), 0));
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

// ------------------ Export ------------------
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

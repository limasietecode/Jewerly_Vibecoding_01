// Vibration Jewelry Editor - Ported to p5.js
// Original by Lima Labs / Vibecoding
// Ported for web deployment

// ------------------ Parameters ------------------
const params = {
    LAYERS: 9,
    MIN_R: 18,
    MAX_R: 170,
    NOISE_FREQ: 0.9,
    WOBBLE_PX: 15,
    LOBES: 6,
    LOBE_AMP: 12,
    STEP_A: 0.028,
    RIBBON_W_MIN: 8,
    RIBBON_W_MAX: 5,
    EXTRUDE_Z: 10,
    SEED: 1337,
    TARGET_DIAM_MM: 45,
    autoRotate: true,
    autoRebuild: true,
    turntable: 0,
    displayWireframe: false,
    // Actions
    RandomizeSeed: function () {
        params.SEED = Math.floor(Math.random() * 100000);
        noiseSeed(params.SEED);
        randomSeed(params.SEED);
        // GUI update handled in loop or manually if needed, but lil-gui updates bound vars automatically usually unless listen() is used
        // We will use listen() on the controller
        triggerRebuild();
    },
    Rebuild: function () {
        triggerRebuild();
    },
    Export_OBJ: function () {
        doExport();
    }
};

let gui;
let built = false;
let needsRebuild = true;

// Mesh buffers
let V = []; // Vertices (p5.Vector)
let F = []; // Faces (int[3])

function setup() {
    createCanvas(windowWidth, windowHeight, WEBGL);
    smooth(); // p5.js equivalent, though antialiasing is usually on by default

    // Noise settings
    noiseSeed(params.SEED);
    randomSeed(params.SEED);
    noiseDetail(4, 0.5);

    buildUI();
}

function draw() {
    background(255);

    // Lighting
    ambientLight(100);
    directionalLight(255, 255, 255, 0.5, 0.5, -1);
    pointLight(200, 200, 200, 0, 0, 500);

    // Rebuild if needed
    if (!built || needsRebuild) {
        buildMesh();
        built = true;
        needsRebuild = false;
    }

    // Interaction
    orbitControl(); // p5.js built-in camera control, handles mouse drag

    // scene interaction overrides
    if (params.autoRotate) {
        params.turntable += 0.003;
    }

    push();
    // rotateX(radians(-24)); // orbitControl handles view, but we can add initial tilt or just let user control
    // We'll apply the turntable rotation to the object itself
    rotateY(params.turntable);
    rotateX(radians(-24)); // Keep the tilt from original sketch

    noStroke();
    fill(90, 70, 60); // Neutral brownish "ink"
    if (params.displayWireframe) {
        stroke(0);
        noFill();
    }

    beginShape(TRIANGLES);
    for (let tri of F) {
        let a = V[tri[0]];
        let b = V[tri[1]];
        let c = V[tri[2]];

        // Calculate normal
        let n = faceNormal(a, b, c);
        normal(n.x, n.y, n.z);

        vertex(a.x, a.y, a.z);
        vertex(b.x, b.y, b.z);
        vertex(c.x, c.y, c.z);
    }
    endShape();
    pop();

    // Overlay info (2D)
    // In WEBGL mode, drawing 2D text is a bit different or needs a separate pass/layer
    // limiting text for now or using minimal overlay logic if critical. 
    // lil-gui handles most info.
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

// ------------------ Build the mesh ------------------
function buildMesh() {
    V = [];
    F = [];

    // Reset seeds to ensure deterministic rebuild with same parameters
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
    // TWO_PI is approx 6.28. 
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

    // Indices mapping
    let idxOutTop = new Int32Array(n);
    let idxInTop = new Int32Array(n);
    let idxOutBot = new Int32Array(n);
    let idxInBot = new Int32Array(n);

    for (let i = 0; i < n; i++) {
        let p = poly[i];
        // Handling wrap-around for tangent calculation
        let p0 = poly[(i - 1 + n) % n];
        let p1 = poly[(i + 1) % n];

        // Tangent
        let tangent = p5.Vector.sub(p1, p0);
        tangent.normalize();

        // Normal 2D (-y, x)
        let normal2D = createVector(-tangent.y, tangent.x);

        let pout = p5.Vector.add(p, p5.Vector.mult(normal2D, hw));
        let pin = p5.Vector.add(p, p5.Vector.mult(normal2D, -hw));

        idxOutTop[i] = addVertex(createVector(pout.x, pout.y, hz));
        idxInTop[i] = addVertex(createVector(pin.x, pin.y, hz));
        idxOutBot[i] = addVertex(createVector(pout.x, pout.y, -hz));
        idxInBot[i] = addVertex(createVector(pin.x, pin.y, -hz));
    }

    // Faces generation
    for (let i = 0; i < n; i++) {
        let i2 = (i + 1) % n;

        // Top lids
        addTri(idxOutTop[i], idxInTop[i], idxInTop[i2]);
        addTri(idxOutTop[i], idxInTop[i2], idxOutTop[i2]);

        // Bottom lids (flipped winding)
        addTri(idxOutBot[i], idxInBot[i2], idxInBot[i]);
        addTri(idxOutBot[i], idxOutBot[i2], idxInBot[i2]);

        // Outer wall
        addTri(idxOutTop[i], idxOutBot[i], idxOutBot[i2]);
        addTri(idxOutTop[i], idxOutBot[i2], idxOutTop[i2]);

        // Inner wall
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

// ------------------ UI ------------------
function buildUI() {
    gui = new lil.GUI({ title: 'Jewelry Editor' });

    const gShape = gui.addFolder('Shape');
    gShape.add(params, 'LAYERS', 1, 30, 1).onChange(triggerRebuild);
    gShape.add(params, 'MIN_R', 4, 150).onChange(triggerRebuild);
    gShape.add(params, 'MAX_R', 10, 300).onChange(triggerRebuild);
    gShape.add(params, 'NOISE_FREQ', 0.0, 3.0).onChange(triggerRebuild);
    gShape.add(params, 'WOBBLE_PX', 0.0, 80.0).onChange(triggerRebuild);
    gShape.add(params, 'LOBES', 0, 24, 1).onChange(triggerRebuild);
    gShape.add(params, 'LOBE_AMP', 0.0, 80.0).onChange(triggerRebuild);
    gShape.add(params, 'STEP_A', 0.005, 0.08).onChange(triggerRebuild);

    const gExtrude = gui.addFolder('Extrusion');
    gExtrude.add(params, 'RIBBON_W_MIN', 0.5, 15).onChange(triggerRebuild);
    gExtrude.add(params, 'RIBBON_W_MAX', 0.5, 15).onChange(triggerRebuild);
    gExtrude.add(params, 'EXTRUDE_Z', 0.5, 25).onChange(triggerRebuild);

    const gExport = gui.addFolder('Export / Misc');
    gExport.add(params, 'SEED').listen().onChange(() => { noiseSeed(params.SEED); randomSeed(params.SEED); triggerRebuild(); });
    gExport.add(params, 'RandomizeSeed');
    gExport.add(params, 'TARGET_DIAM_MM', 10, 100);
    gExport.add(params, 'autoRebuild');
    gExport.add(params, 'autoRotate');
    // gExport.add(params, 'displayWireframe');
    gExport.add(params, 'Rebuild');
    gExport.add(params, 'Export_OBJ');
}

// ------------------ Export ------------------
function doExport() {
    let date = new Date();
    let stamp = date.getFullYear() +
        nf(date.getMonth() + 1, 2) +
        nf(date.getDate(), 2) + "_" +
        nf(date.getHours(), 2) +
        nf(date.getMinutes(), 2) +
        nf(date.getSeconds(), 2);

    let base = "arete_" + stamp;

    let dpx = currentOuterDiameterPx();
    let scale = 1.0;
    if (dpx > 0) {
        scale = params.TARGET_DIAM_MM / dpx;
    }

    let fname = base + "_D" + Math.round(params.TARGET_DIAM_MM) + "mm.obj";

    let output = [];
    output.push("# OBJ exported from Web Jewelry Editor");
    output.push("# Units: mm (scaled on export)");

    // Vertices
    for (let v of V) {
        output.push(`v ${(v.x * scale).toFixed(6)} ${(v.y * scale).toFixed(6)} ${(v.z * scale).toFixed(6)}`);
    }

    // Faces
    for (let tri of F) {
        // OBJ indices are 1-based
        output.push(`f ${tri[0] + 1} ${tri[1] + 1} ${tri[2] + 1}`);
    }

    saveStrings(output, fname);
    console.log("Exported: " + fname + " Scale: " + scale);
}

function currentOuterDiameterPx() {
    if (V.length === 0) return 0;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (let p of V) {
        if (p.x < minx) minx = p.x;
        if (p.x > maxx) maxx = p.x;
        if (p.y < miny) miny = p.y;
        if (p.y > maxy) maxy = p.y;
    }
    let w = maxx - minx;
    let h = maxy - miny;
    return Math.max(w, h);
}

// MIA_GAB_ARETES_v02_UI_OBJ — Processing 4.4.7 (P3D)
// Concentric organic rings → 3D ribbon extrusion with UI + OBJ export (3D-print minded)
//
// Dependencies:
//   - ControlP5 (Install in Processing via: Sketch → Import Library… → Add Library… → search "ControlP5")
//
// Notes for 3D print:
//   • Units in preview are pixels. Export scales to mm by targeting an outer diameter in mm.
//   • The mesh is closed (top/bottom + side walls) per ring. Multiple rings are separate shells.
//   • Keep ribbon width and Z thickness above your printer’s minimum feature size.
//
import java.util.*;
import controlP5.*;
// ------------------ Parameters (editable via UI) ------------------
int   LAYERS     = 9;     // number of rings
float MIN_R      = 18;    // inner radius (px)
float MAX_R      = 170;   // outer radius (px)
float NOISE_FREQ = 0.9;   // ripple frequency
float WOBBLE_PX  = 15;    // ripple amplitude (px)
int   LOBES      = 6;     // petal lobes
float LOBE_AMP   = 12;    // lobe amplitude (px)
float STEP_A     = 0.028; // angular sampling step (smaller = smoother)
float RIBBON_W_MIN = 8;   // ring stroke thickness (inner)
float RIBBON_W_MAX = 5;   // ring stroke thickness (outer)
float EXTRUDE_Z    = 10;  // total thickness in Z (px)
int   SEED         = 1337; // random/noise seed
// Export controls
float TARGET_DIAM_MM = 45;   // target outer diameter when exporting (mm)
// ------------------ Runtime / UI ------------------
float turntable = 0;
boolean built = false;
boolean autoRotate = true;
boolean autoRebuild = true;
boolean needsRebuild = true;   // flag from UI to trigger rebuild once
ControlP5 cp5;
// Global mesh buffers (OBJ uses 1-based indices; we store 0-based here)
ArrayList<PVector> V = new ArrayList<PVector>();    // vertices
ArrayList<int[]>   F = new ArrayList<int[]>();      // triangles (triplets of indices)
// ------------------ Setup / Draw ------------------
void setup() {
  size(800, 800, P3D);
  smooth(8);
  noiseSeed(SEED);
  randomSeed(SEED);
  noiseDetail(4, 0.5);
  buildUI();
}
void draw() {
  background(255);
  lights();
  // Rebuild if needed
  if (!built || needsRebuild) {
    buildMesh();
    built = true;
    needsRebuild = false;
  }
  // 3D preview
  pushMatrix();
  translate(width*0.62, height*0.5, 0); // shift right to leave space for UI
  rotateX(radians(-24));
  rotateY(turntable);
  noStroke();
  fill(90, 70, 60); // neutral brownish "ink"
  beginShape(TRIANGLES);
  for (int[] tri : F) {
    PVector a = V.get(tri[0]);
    PVector b = V.get(tri[1]);
    PVector c = V.get(tri[2]);
    PVector n = faceNormal(a, b, c);
    normal(n.x, n.y, n.z);
    vertex(a.x, a.y, a.z);
    vertex(b.x, b.y, b.z);
    vertex(c.x, c.y, c.z);
  }
  endShape();
  popMatrix();
  if (autoRotate) turntable += 0.003;
  // Small caption
  fill(60);
  noLights();
  textAlign(LEFT, BOTTOM);
  text("OBJ target Ø: " + nf(TARGET_DIAM_MM, 1, 1) + " mm   |   Seed: " + SEED
       + "   |   V: " + V.size() + "  F: " + F.size(),
       12, height - 12);
}
// ------------------ Interaction ------------------
void mouseDragged() {
  if (mouseX > width*0.35) {
    float dx = (mouseX - pmouseX) * 0.01;
    turntable += dx;
  }
}
void keyPressed() {
  if (key == 's' || key == 'S' || key == 'e' || key == 'E') {
    doExport();
  } else if (key == 'r' || key == 'R') {
    triggerRebuild();
  } else if (key == ' ') {
    autoRotate = !autoRotate;
  }
}
// ------------------ Build the mesh ------------------
void buildMesh() {
  V.clear();
  F.clear();
  for (int i = 0; i < LAYERS; i++) {
    float t = (LAYERS == 1) ? 0 : map(i, 0, LAYERS-1, 0, 1);
    float R = lerp(MIN_R, MAX_R, t);
    float amp = WOBBLE_PX * (1.1 - 0.5 * t);
    float seed = 2.38 * i;
    float ribbonW = lerp(RIBBON_W_MIN, RIBBON_W_MAX, t);
    ArrayList<PVector> centerline = makeContour(R, amp, NOISE_FREQ, LOBES,
                                                LOBE_AMP * (1.2 - 0.6*t), seed);
    addRibbonExtrusion(centerline, ribbonW, EXTRUDE_Z);
  }
}
// Generate one closed contour as a list of XY points (Z=0)
ArrayList<PVector> makeContour(float R, float amp, float nfreq, int lobes, float lobeAmp, float seed) {
  ArrayList<PVector> pts = new ArrayList<PVector>();
  for (float a = 0; a <= TWO_PI + 0.0001; a += STEP_A) { // +eps to close
    float n = noise(cos(a) * nfreq + seed, sin(a) * nfreq + seed * 0.7);
    float ripple = (n - 0.5) * 2.0 * amp;
    float petals = sin(a * lobes + seed * 1.3) * lobeAmp;
    float r = max(5, R + ripple + petals);
    pts.add(new PVector(r * cos(a), r * sin(a), 0));
  }
  return pts;
}
// Turn a centerline into a 3D ribbon with thickness and side walls
void addRibbonExtrusion(ArrayList<PVector> poly, float width, float depth) {
  int n = poly.size();
  if (n < 3) return;
  float hw = width * 0.5;
  float hz = depth * 0.5;
  // Precompute offset points (inner/outer) + duplicates for top/bottom
  int[] idxOutTop = new int[n];
  int[] idxInTop  = new int[n];
  int[] idxOutBot = new int[n];
  int[] idxInBot  = new int[n];
  for (int i = 0; i < n; i++) {
    PVector p  = poly.get(i);
    PVector p0 = poly.get((i - 1 + n) % n);
    PVector p1 = poly.get((i + 1) % n);
    PVector tangent = PVector.sub(p1, p0);
    tangent.normalize();
    PVector normal2D = new PVector(-tangent.y, tangent.x);
    PVector pout = PVector.add(p, PVector.mult(normal2D, hw));
    PVector pin  = PVector.add(p, PVector.mult(normal2D, -hw));
    idxOutTop[i] = addVertex(new PVector(pout.x, pout.y,  hz));
    idxInTop[i]  = addVertex(new PVector(pin.x,  pin.y,   hz));
    idxOutBot[i] = addVertex(new PVector(pout.x, pout.y, -hz));
    idxInBot[i]  = addVertex(new PVector(pin.x,  pin.y,  -hz));
  }
  // Top lids (two triangles per quad)
  for (int i = 0; i < n; i++) {
    int i2 = (i + 1) % n;
    addTri(idxOutTop[i], idxInTop[i], idxInTop[i2]);
    addTri(idxOutTop[i], idxInTop[i2], idxOutTop[i2]);
  }
  // Bottom lids (winding flipped)
  for (int i = 0; i < n; i++) {
    int i2 = (i + 1) % n;
    addTri(idxOutBot[i], idxInBot[i2], idxInBot[i]);
    addTri(idxOutBot[i], idxOutBot[i2], idxInBot[i2]);
  }
  // Outer wall
  for (int i = 0; i < n; i++) {
    int i2 = (i + 1) % n;
    addTri(idxOutTop[i], idxOutBot[i], idxOutBot[i2]);
    addTri(idxOutTop[i], idxOutBot[i2], idxOutTop[i2]);
  }
  // Inner wall
  for (int i = 0; i < n; i++) {
    int i2 = (i + 1) % n;
    addTri(idxInTop[i], idxInBot[i2], idxInBot[i]);
    addTri(idxInTop[i], idxInTop[i2], idxInBot[i2]);
  }
}
// ------------------ Export (OBJ) ------------------
void doExport() {
  String stamp = nf(year(), 4) + nf(month(), 2) + nf(day(), 2) + "_" + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
  String base = "arete_" + stamp;
  // Compute current outer diameter in px
  float dpx = currentOuterDiameterPx();
  float scale = 1.0;
  if (dpx > 0) {
    scale = TARGET_DIAM_MM / dpx; // mm per px
  }
  String fname = base + "_D" + int(TARGET_DIAM_MM) + "mm.obj";
  exportOBJ(fname, scale);
  println("Saved OBJ: " + fname + "  (scale: " + nf(scale, 1, 4) + " mm/px)");
}
float currentOuterDiameterPx() {
  if (V.isEmpty()) return 0;
  float minx =  1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (PVector p : V) {
    minx = min(minx, p.x);
    maxx = max(maxx, p.x);
    miny = min(miny, p.y);
    maxy = max(maxy, p.y);
  }
  float w = maxx - minx;
  float h = maxy - miny;
  return max(w, h);
}
void exportOBJ(String filename, float scaleMMperPx) {
  PrintWriter w = createWriter(filename);
  w.println("# OBJ exported from Processing " + getClass().getSimpleName());
  w.println("# Units: mm (scaled on export)");
  // Vertices (scaled)
  for (PVector p : V) {
    w.println("v " + (p.x * scaleMMperPx) + " " + (p.y * scaleMMperPx) + " " + (p.z * scaleMMperPx));
  }
  // Faces (triangles)
  for (int[] tri : F) {
    // OBJ indices are 1-based
    w.println("f " + (tri[0] + 1) + " " + (tri[1] + 1) + " " + (tri[2] + 1));
  }
  w.flush();
  w.close();
}
// ------------------ UI ------------------
void buildUI() {
  cp5 = new ControlP5(this);
  int x = 16, y = 16, w = 230, h = 16, pad = 8, groupPad = 12;
  int y0 = y;
  Group gShape = cp5.addGroup("Shape")
                    .setPosition(x, y)
                    .setWidth(w + 10)
                    .setBackgroundHeight(220)
                    .setColorBackground(color(255, 255, 255, 30))
                    .setBarHeight(20);
  y += 24;
  cp5.addSlider("LAYERS").setGroup(gShape)
     .setPosition(10, y - y0).setSize(w, h)
     .setRange(1, 30).setValue(LAYERS).setDecimalPrecision(0);
  y += h + pad;
  cp5.addSlider("MIN_R").setGroup(gShape)
     .setPosition(10, y - y0).setSize(w, h)
     .setRange(4, 150).setValue(MIN_R);
  y += h + pad;
  cp5.addSlider("MAX_R").setGroup(gShape)
     .setPosition(10, y - y0).setSize(w, h)
     .setRange(10, 300).setValue(MAX_R);
  y += h + pad;
  cp5.addSlider("NOISE_FREQ").setGroup(gShape)
     .setPosition(10, y - y0).setSize(w, h)
     .setRange(0.0, 3.0).setValue(NOISE_FREQ);
  y += h + pad;
  cp5.addSlider("WOBBLE_PX").setGroup(gShape)
     .setPosition(10, y - y0).setSize(w, h)
     .setRange(0.0, 80.0).setValue(WOBBLE_PX);
  y += h + pad;
  cp5.addSlider("LOBES").setGroup(gShape)
     .setPosition(10, y - y0).setSize(w, h)
     .setRange(0, 24).setValue(LOBES).setDecimalPrecision(0);
  y += h + pad;
  cp5.addSlider("LOBE_AMP").setGroup(gShape)
     .setPosition(10, y - y0).setSize(w, h)
     .setRange(0.0, 80.0).setValue(LOBE_AMP);
  y += h + pad;
  cp5.addSlider("STEP_A").setGroup(gShape)
     .setPosition(10, y - y0).setSize(w, h)
     .setRange(0.005, 0.08).setValue(STEP_A);
  y += h + pad;
  Group gExtrude = cp5.addGroup("Extrusion")
                      .setPosition(x, y + groupPad)
                      .setWidth(w + 10)
                      .setBackgroundHeight(130)
                      .setColorBackground(color(255, 255, 255, 30))
                      .setBarHeight(20);
  y0 = y + groupPad + 24;
  cp5.addSlider("RIBBON_W_MIN").setGroup(gExtrude)
     .setPosition(10, 0).setSize(w, h)
     .setRange(0.5, 15).setValue(RIBBON_W_MIN);
  cp5.addSlider("RIBBON_W_MAX").setGroup(gExtrude)
     .setPosition(10, h + pad).setSize(w, h)
     .setRange(0.5, 15).setValue(RIBBON_W_MAX);
  cp5.addSlider("EXTRUDE_Z").setGroup(gExtrude)
     .setPosition(10, (h + pad)*2).setSize(w, h)
     .setRange(0.5, 25).setValue(EXTRUDE_Z);
  Group gExport = cp5.addGroup("Export / Misc")
                      .setPosition(x, y + groupPad + 160)
                      .setWidth(w + 10)
                      .setBackgroundHeight(130)
                      .setColorBackground(color(255, 255, 255, 30))
                      .setBarHeight(20);
  cp5.addNumberbox("SEED").setGroup(gExport)
     .setPosition(10, 10).setSize(120, 18)
     .setRange(0, 100000).setValue(SEED).setScrollSensitivity(10);
  cp5.addButton("RandomizeSeed").setGroup(gExport)
     .setPosition(140, 10).setSize(90, 18).setLabel("Randomize");
  cp5.addSlider("TARGET_DIAM_MM").setGroup(gExport)
     .setPosition(10, 40).setSize(w, h)
     .setRange(10, 100).setValue(TARGET_DIAM_MM).setLabel("Target Ø (mm)");
  cp5.addToggle("autoRebuild").setGroup(gExport)
     .setPosition(10, 70).setSize(20, 20).setValue(autoRebuild).setLabel("Auto rebuild");
  cp5.addToggle("autoRotate").setGroup(gExport)
     .setPosition(120, 70).setSize(20, 20).setValue(autoRotate).setLabel("Auto rotate");
  cp5.addButton("Rebuild").setGroup(gExport)
     .setPosition(10, 100).setSize(90, 20);
  cp5.addButton("Export_OBJ").setGroup(gExport)
     .setPosition(110, 100).setSize(120, 20).setLabel("Export OBJ (S/E)");
  // Listen for changes -> mark for rebuild (ControlP5 generics safe)
  for (ControllerInterface<?> ci : cp5.getAll()) {
    if (ci instanceof Controller) {
      Controller c = (Controller) ci;
      if (c instanceof Slider || c.getName().equals("SEED")) {
        c.onChange(new CallbackListener() {
          public void controlEvent(CallbackEvent event) {
            if (autoRebuild) triggerRebuild();
          }
        });
      }
    }
  }
}
// UI callbacks
void RandomizeSeed() {
  SEED = (int)random(1, 100000);
  noiseSeed(SEED);
  randomSeed(SEED);
  cp5.get(Numberbox.class, "SEED").setValue(SEED);
  triggerRebuild();
}
void Rebuild() {
  triggerRebuild();
}
void Export_OBJ() {
  doExport();
}
void triggerRebuild() {
  built = false;
  needsRebuild = true;
}
// Keep constraints coherent (optional)
public void controlEvent(ControlEvent e) {
  String n = e.getController().getName();
  if (n.equals("MIN_R") || n.equals("MAX_R")) {
    if (MAX_R <= MIN_R + 2) {
      MAX_R = MIN_R + 2;
      cp5.get(Slider.class, "MAX_R").setValue(MAX_R);
    }
  }
  if (n.equals("STEP_A")) {
    STEP_A = max(0.001, STEP_A);
  }
  if (n.equals("RIBBON_W_MIN") || n.equals("RIBBON_W_MAX")) {
    RIBBON_W_MIN = max(0.2, RIBBON_W_MIN);
    RIBBON_W_MAX = max(0.2, RIBBON_W_MAX);
  }
}
// ------------------ Helpers ------------------
int addVertex(PVector v) {
  V.add(v);
  return V.size() - 1;
}
void addTri(int a, int b, int c) {
  F.add(new int[]{a, b, c});
}
PVector faceNormal(PVector a, PVector b, PVector c) {
  PVector u = PVector.sub(b, a);
  PVector v = PVector.sub(c, a);
  PVector n = u.cross(v, null);
  n.normalize();
  return n;
}

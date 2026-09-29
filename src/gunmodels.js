// Detailed procedural weapons: pistol, SMG, pump shotgun, scoped hunting rifle and the baseball bat.
// Side profiles are extruded with bevelled edges (they catch the light like machined or moulded parts), barrels and
// scope tubes are turned, grips carry a stippled bump and stocks a walnut grain. The same builder serves the gun in
// the character's hands, the first-person view model and the pick-ups.
// Gun frame: +Z towards the muzzle, +Y up, +X the gun's left side; origin at the grip point (centre of the shooting
// hand). userData: muzzle, eject (ejection port), wristR / wristL (where the wrists go), butt (stock plate of long
// guns), sight (a point on the sight line) and the moving parts: slide (pistol), pump (shotgun), bolt (rifle).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

let TEX = null, MAT = null;

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// wood: long wavy grain lines (seamless along x), a few light flecks and pores
function grain(x, w, h, base, lines, alpha) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < lines; i++) {
    const y0 = Math.random() * h, amp = 1.5 + Math.random() * 7, k = 1 + Math.floor(Math.random() * 3), ph = Math.random() * 6.28;
    const dark = Math.random() < 0.75;
    x.strokeStyle = dark ? `rgba(38,18,6,${alpha * (0.3 + Math.random() * 0.7)})` : `rgba(255,214,160,${alpha * 0.3 * Math.random()})`;
    x.lineWidth = 0.5 + Math.random() * 2.2;
    for (const oy of [-h, 0, h]) {
      x.beginPath();
      for (let px = 0; px <= w; px += 4) {
        const yy = y0 + oy + Math.sin((px / w) * Math.PI * 2 * k + ph) * amp + Math.sin((px / w) * Math.PI * 6 * k + ph * 2) * amp * 0.25;
        if (px === 0) x.moveTo(px, yy); else x.lineTo(px, yy);
      }
      x.stroke();
    }
  }
  for (let i = 0; i < (w * h) / 40; i++) { x.fillStyle = `rgba(25,12,4,${Math.random() * 0.22})`; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1); }
}
function textures() {
  if (TEX) return TEX;
  TEX = {
    walnut: canvasTex(512, 128, (x, w, h) => grain(x, w, h, '#6e3f1f', 70, 0.55)),
    ash: canvasTex(512, 128, (x, w, h) => grain(x, w, h, '#d8b47a', 45, 0.32)),
    stipple: canvasTex(128, 128, (x, w, h) => {
      x.fillStyle = '#808080'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { const v = Math.random() < 0.5 ? 40 : 215; x.fillStyle = `rgb(${v},${v},${v})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 0.6 + Math.random() * 1.1, 0, 6.3); x.fill(); }
    }, false),
    brushed: canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#808080'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { const v = 90 + Math.random() * 80; x.fillStyle = `rgba(${v},${v},${v},0.35)`; x.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 80, 1); }
    }, false),
  };
  TEX.walnut.repeat.set(3.2, 12);
  TEX.stipple.repeat.set(40, 40);
  TEX.brushed.repeat.set(5, 5);
  return TEX;
}
export function gunMaterials() {
  if (MAT) return MAT;
  const T = textures();
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const bat = T.ash.clone(); bat.center.set(0.5, 0.5); bat.rotation = Math.PI / 2; bat.repeat.set(1, 3); bat.needsUpdate = true;
  MAT = {
    // (bump maps are left out: at these sizes the derivative bump overwhelms the normals)
    steel: S({ color: 0x5d626a, metalness: 0.78, roughness: 0.36 }),
    dark: S({ color: 0x303338, metalness: 0.55, roughness: 0.48 }),
    bright: S({ color: 0xb4bac2, metalness: 1, roughness: 0.24 }),
    polymer: S({ color: 0x323438, metalness: 0.04, roughness: 0.55 }),
    grip: S({ color: 0x2c2d30, metalness: 0.02, roughness: 0.88, roughnessMap: T.stipple }),
    walnut: new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: T.walnut, roughness: 0.45, clearcoat: 0.55, clearcoatRoughness: 0.28 }),
    rosewood: new THREE.MeshPhysicalMaterial({ color: 0x3a1d12, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    rubber: S({ color: 0x1d1d1f, roughness: 0.95 }),
    brass: S({ color: 0xd2aa55, metalness: 1, roughness: 0.28 }),
    lens: S({ color: 0x0a1a26, metalness: 0.8, roughness: 0.04, emissive: 0x123650, emissiveIntensity: 0.6 }),
    black: S({ color: 0x08080a, roughness: 0.7 }),
    white: S({ color: 0xf2f2f2, roughness: 0.5, emissive: 0x888888, emissiveIntensity: 0.35 }),
    ash: S({ color: 0xffffff, map: bat, roughness: 0.48 }),
    tape: S({ color: 0x232325, roughness: 0.95, roughnessMap: T.stipple }),
    shell: S({ color: 0xa3201c, roughness: 0.45 }),
  };
  return MAT;
}

// ------------------------------------------------------------------ geometry helpers
class Parts {
  constructor() { this.m = new Map(); }
  add(mat, geo) {
    let l = this.m.get(mat);
    if (!l) this.m.set(mat, (l = []));
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') g.deleteAttribute(a);
    l.push(g);
    return g;
  }
  build(shift) {
    const M = gunMaterials(), grp = new THREE.Group();
    for (const [k, list] of this.m) {
      const geo = mergeGeometries(list, false);
      if (shift) geo.translate(shift.x, shift.y, shift.z);
      const mesh = new THREE.Mesh(geo, M[k]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      grp.add(mesh);
    }
    return grp;
  }
}
const _e = new THREE.Euler(), _m = new THREE.Matrix4();
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  if (rx || ry || rz) geo.applyMatrix4(_m.makeRotationFromEuler(_e.set(rx, ry, rz)));
  geo.translate(x, y, z);
  return geo;
}
const rbox = (w, h, d, r, x, y, z, rx, ry, rz) => place(new RoundedBoxGeometry(w, h, d, 1, r), x, y, z, rx, ry, rz);
const box = (w, h, d, x, y, z, rx, ry, rz) => place(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
// cylinder along +Z from z0 to z0 + len: radius r0 at z0, r1 at the far end
function cylZ(r0, r1, len, seg, x, y, z0) {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z0 + len / 2);
  return g;
}
// cylinder along X (drums, turrets), centred
function cylX(r, len, seg, x, y, z) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); g.translate(x, y, z); return g; }
function cylY(r, len, seg, x, y, z) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.translate(x, y, z); return g; }
// a disc facing +Z (or -Z)
function disc(r, seg, x, y, z, back = false) { const g = new THREE.CircleGeometry(r, seg); if (back) g.rotateY(Math.PI); g.translate(x, y, z); return g; }
function ring(r, tube, x, y, z) { const g = new THREE.TorusGeometry(r, tube, 6, 20); g.translate(x, y, z); return g; }
// path from [[z, y], ['q', cz, cy, z, y], …]
function trace(p, pts) {
  pts.forEach((q, i) => {
    if (q[0] === 'q') p.quadraticCurveTo(q[1], q[2], q[3], q[4]);
    else if (i === 0) p.moveTo(q[0], q[1]);
    else p.lineTo(q[0], q[1]);
  });
  p.closePath();
}
// side profile in (z, y) extruded across the gun: total width along X centred on xc, rounded by `bevel`
function profile(pts, width, bevel = 0.002, xc = 0, holes = null, seg = 6) {
  const s = new THREE.Shape();
  trace(s, pts);
  if (holes) for (const h of holes) { const p = new THREE.Path(); trace(p, h); s.holes.push(p); }
  const depth = Math.max(0.0004, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: seg });
  g.rotateY(-Math.PI / 2);
  g.translate(depth / 2 + xc, 0, 0);
  return g;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ models
function pistol() {
  const F = new Parts(), S = new Parts();
  // polymer frame with the trigger guard, 18° grip, beavertail and dust cover
  F.add('polymer', profile([
    [0.131, 0.030], [-0.050, 0.030], [-0.057, 0.028], ['q', -0.061, 0.020, -0.050, 0.019], ['q', -0.030, 0.019, -0.019, 0.015],
    [-0.042, -0.056], ['q', -0.044, -0.061, -0.038, -0.061], [0.000, -0.061], ['q', 0.005, -0.061, 0.004, -0.056],
    [0.025, 0.009], ['q', 0.026, -0.006, 0.036, -0.006], [0.067, -0.006], ['q', 0.083, -0.005, 0.083, 0.010], [0.084, 0.022],
    [0.127, 0.022], [0.131, 0.026],
  ], 0.026, 0.0024, 0, [[[0.034, 0.021], [0.035, 0.008], ['q', 0.036, 0.003, 0.043, 0.003], [0.065, 0.003], ['q', 0.074, 0.004, 0.074, 0.012], [0.074, 0.021]]]));
  // stippled grip panels, finger rest, magazine base plate
  for (const sx of [1, -1]) F.add('grip', profile([[-0.018, 0.009], [-0.040, -0.054], [0.0, -0.054], [0.022, 0.005], ['q', 0.004, 0.012, -0.018, 0.009]], 0.0022, 0.0006, sx * 0.0141));
  F.add('polymer', rbox(0.028, 0.008, 0.05, 0.003, 0, -0.064, -0.019));
  F.add('dark', rbox(0.02, 0.003, 0.034, 0.001, 0, -0.0685, -0.019));
  // trigger
  F.add('polymer', profile([[0.040, 0.020], [0.046, 0.020], ['q', 0.051, 0.011, 0.047, 0.004], [0.044, 0.004], ['q', 0.046, 0.012, 0.040, 0.016]], 0.006, 0.001));
  F.add('dark', box(0.0014, 0.009, 0.0016, 0, 0.012, 0.0455));
  // levers and buttons on the left side, accessory rail under the dust cover
  F.add('dark', rbox(0.0022, 0.0042, 0.021, 0.001, 0.0134, 0.027, 0.03));
  F.add('dark', rbox(0.0022, 0.005, 0.007, 0.001, 0.0134, 0.024, 0.076));
  F.add('dark', rbox(0.003, 0.006, 0.006, 0.001, 0.0132, 0.004, 0.021));
  for (let i = 0; i < 3; i++) F.add('polymer', box(0.018, 0.003, 0.004, 0, 0.0205, 0.095 + i * 0.011));
  // slide: machined steel with cocking serrations, ejection port, sights and the barrel crown
  S.add('steel', profile([[-0.055, 0.030], [-0.055, 0.057], ['q', -0.055, 0.063, -0.049, 0.063], [0.124, 0.063], ['q', 0.134, 0.062, 0.135, 0.055], [0.135, 0.030]], 0.0235, 0.0025));
  for (const sx of [1, -1]) {
    for (let i = 0; i < 8; i++) S.add('dark', box(0.0007, 0.021, 0.0013, sx * 0.0119, 0.046, -0.050 + i * 0.0036));
    for (let i = 0; i < 5; i++) S.add('dark', box(0.0007, 0.018, 0.0013, sx * 0.0119, 0.047, 0.099 + i * 0.0036));
  }
  S.add('black', box(0.0009, 0.016, 0.044, -0.0118, 0.050, 0.043));
  S.add('bright', box(0.0006, 0.009, 0.034, -0.0123, 0.051, 0.045));
  S.add('black', box(0.012, 0.0008, 0.044, 0, 0.0635, 0.043));
  S.add('dark', box(0.004, 0.005, 0.007, 0, 0.0655, 0.126));
  S.add('white', box(0.0017, 0.0017, 0.0005, 0, 0.0665, 0.1224));
  S.add('dark', box(0.019, 0.004, 0.008, 0, 0.065, -0.046));
  for (const sx of [1, -1]) { S.add('dark', box(0.0055, 0.004, 0.008, sx * 0.0065, 0.0685, -0.046)); S.add('white', box(0.0015, 0.0015, 0.0005, sx * 0.0048, 0.0685, -0.0502)); }
  S.add('bright', cylZ(0.0068, 0.0068, 0.004, 18, 0, 0.047, 0.1352));
  S.add('black', disc(0.0048, 16, 0, 0.047, 0.1394));
  S.add('black', disc(0.0033, 12, 0, 0.0355, 0.1382));
  const g = new THREE.Group();
  g.add(F.build());
  const slide = S.build();
  g.add(slide);
  Object.assign(g.userData, {
    id: 'pistola', slide, muzzle: V(0, 0.047, 0.14), eject: V(-0.013, 0.053, 0.045), sight: V(0, 0.069, 0),
    wristR: V(-0.02, -0.004, -0.07), wristL: V(0.028, -0.03, -0.035), long: false,
  });
  return g;
}

function smg() {
  const P = new Parts();
  // stamped receiver with the cocking tube on top, three-lug barrel, hooded front sight, drum rear sight
  P.add('steel', profile([[-0.110, 0.030], [-0.110, 0.068], ['q', -0.110, 0.084, -0.094, 0.084], [0.105, 0.084], ['q', 0.118, 0.084, 0.120, 0.072], [0.120, 0.030]], 0.042, 0.004));
  P.add('steel', cylZ(0.014, 0.014, 0.125, 18, 0, 0.071, 0.118));
  P.add('dark', cylZ(0.0146, 0.0146, 0.012, 18, 0, 0.071, 0.232));
  P.add('steel', cylZ(0.0095, 0.0095, 0.05, 16, 0, 0.049, 0.235));
  P.add('dark', cylZ(0.0115, 0.0115, 0.024, 16, 0, 0.049, 0.262));
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; P.add('dark', box(0.004, 0.004, 0.012, Math.cos(a) * 0.012, 0.049 + Math.sin(a) * 0.012, 0.276)); }
  P.add('black', disc(0.0045, 12, 0, 0.049, 0.2862));
  P.add('dark', box(0.006, 0.02, 0.012, 0, 0.094, 0.236));
  P.add('dark', ring(0.0105, 0.0022, 0, 0.1035, 0.236));
  P.add('dark', cylX(0.0095, 0.022, 16, 0, 0.094, -0.078));
  P.add('dark', box(0.014, 0.012, 0.024, 0, 0.087, -0.078));
  // cocking handle folded forward on the left of the tube
  P.add('dark', rbox(0.026, 0.006, 0.007, 0.002, 0.024, 0.076, 0.205, 0, -0.35, 0));
  P.add('dark', rbox(0.012, 0.009, 0.01, 0.003, 0.036, 0.076, 0.214));
  // polymer handguard with grip ridges
  P.add('polymer', profile([[0.118, 0.030], [0.118, 0.064], [0.226, 0.062], ['q', 0.236, 0.060, 0.236, 0.048], [0.230, 0.030], ['q', 0.175, 0.026, 0.118, 0.030]], 0.04, 0.005));
  for (const sx of [1, -1]) for (let i = 0; i < 6; i++) P.add('black', box(0.001, 0.02, 0.003, sx * 0.0203, 0.046, 0.132 + i * 0.016));
  // lower receiver / trigger group, pistol grip, trigger guard
  P.add('polymer', profile([[-0.08, 0.031], [-0.08, 0.014], [0.095, 0.014], [0.095, 0.031]], 0.036, 0.003));
  P.add('grip', profile([[-0.030, 0.016], ['q', -0.036, 0.004, -0.043, -0.060], ['q', -0.044, -0.072, -0.032, -0.072], [0.004, -0.072], ['q', 0.010, -0.070, 0.007, -0.062], [0.024, 0.016]], 0.033, 0.005));
  P.add('polymer', profile([[0.022, 0.016], [0.026, -0.008], ['q', 0.028, -0.014, 0.036, -0.014], [0.07, -0.014], ['q', 0.08, -0.013, 0.08, -0.002], [0.08, 0.016]], 0.03, 0.003, 0, [[[0.031, 0.014], [0.033, -0.003], ['q', 0.034, -0.007, 0.04, -0.007], [0.068, -0.007], ['q', 0.073, -0.006, 0.073, 0.0], [0.073, 0.014]]]));
  P.add('dark', profile([[0.043, 0.014], [0.048, 0.014], ['q', 0.052, 0.006, 0.049, -0.001], [0.046, -0.001], ['q', 0.048, 0.006, 0.043, 0.011]], 0.006, 0.001));
  // curved magazine ahead of the guard
  P.add('dark', profile([[0.084, 0.018], [0.116, 0.018], ['q', 0.121, -0.070, 0.150, -0.150], [0.121, -0.160], ['q', 0.092, -0.080, 0.084, 0.018]], 0.021, 0.003));
  P.add('steel', rbox(0.03, 0.028, 0.042, 0.003, 0, 0.012, 0.100));
  // collapsible stock, extended: two rods and a curved butt plate with a rubber pad
  for (const sx of [1, -1]) P.add('steel', cylZ(0.0045, 0.0045, 0.2, 10, sx * 0.0215, 0.058, -0.30));
  P.add('steel', profile([[-0.305, 0.075], [-0.292, 0.075], [-0.292, 0.000], ['q', -0.296, -0.028, -0.305, -0.035], ['q', -0.310, 0.02, -0.305, 0.075]], 0.05, 0.004));
  P.add('rubber', profile([[-0.316, 0.078], [-0.305, 0.078], ['q', -0.310, 0.02, -0.305, -0.037], [-0.316, -0.040], ['q', -0.322, 0.02, -0.316, 0.078]], 0.052, 0.004));
  const g = new THREE.Group();
  g.add(P.build());
  Object.assign(g.userData, {
    id: 'subfusil', muzzle: V(0, 0.049, 0.29), eject: V(-0.022, 0.066, 0.05), sight: V(0, 0.1, 0), butt: V(0, 0.02, -0.32),
    wristR: V(-0.022, -0.006, -0.072), wristL: V(0.034, -0.004, 0.135), long: true,
  });
  return g;
}

function shotgun() {
  // designed with the bore at y = 0.052 over the receiver; shifted so that the grip point is the origin
  const P = new Parts(), U = new Parts();
  P.add('steel', profile([[-0.020, 0.008], [-0.020, 0.056], ['q', -0.012, 0.071, 0.020, 0.071], [0.190, 0.071], [0.190, 0.010], ['q', 0.190, 0.004, 0.182, 0.004], [-0.012, 0.004]], 0.038, 0.004));
  P.add('black', box(0.0012, 0.022, 0.06, -0.0192, 0.045, 0.105));
  P.add('bright', box(0.0008, 0.012, 0.05, -0.0198, 0.046, 0.108));
  P.add('dark', rbox(0.026, 0.004, 0.09, 0.0015, 0, 0.003, 0.09));
  // trigger guard, trigger, safety
  P.add('dark', profile([[0.0, 0.006], [-0.004, -0.012], ['q', -0.002, -0.030, 0.02, -0.030], [0.068, -0.030], ['q', 0.084, -0.028, 0.086, 0.006]], 0.018, 0.002, 0, [[[0.008, 0.004], [0.006, -0.010], ['q', 0.007, -0.022, 0.022, -0.022], [0.064, -0.022], ['q', 0.076, -0.020, 0.077, 0.004]]]));
  P.add('bright', profile([[0.038, 0.004], [0.044, 0.004], ['q', 0.049, -0.006, 0.045, -0.014], [0.042, -0.014], ['q', 0.044, -0.005, 0.038, 0.0]], 0.006, 0.001));
  P.add('dark', cylX(0.004, 0.024, 10, 0, 0.0, 0.076));
  // barrel with ventilated rib and brass bead, magazine tube with its cap
  P.add('steel', cylZ(0.0108, 0.0102, 0.61, 22, 0, 0.052, 0.19));
  P.add('bright', cylZ(0.0104, 0.0104, 0.003, 22, 0, 0.052, 0.799));
  P.add('black', disc(0.0092, 18, 0, 0.052, 0.8022));
  P.add('dark', box(0.008, 0.0022, 0.6, 0, 0.0685, 0.495));
  for (let i = 0; i < 12; i++) P.add('dark', box(0.004, 0.005, 0.006, 0, 0.0645, 0.21 + i * 0.05));
  P.add('brass', new THREE.SphereGeometry(0.0022, 8, 6).translate(0, 0.0718, 0.79));
  P.add('steel', cylZ(0.0115, 0.0115, 0.51, 18, 0, 0.022, 0.19));
  P.add('bright', cylZ(0.0122, 0.0118, 0.024, 18, 0, 0.022, 0.70));
  P.add('dark', box(0.01, 0.018, 0.016, 0, 0.037, 0.705));
  // walnut stock: comb, heel, toe, pistol-grip wrist; rubber recoil pad
  P.add('walnut', profile([
    [-0.018, 0.058], [-0.070, 0.060], [-0.320, 0.050], [-0.326, 0.048], [-0.332, -0.088], [-0.321, -0.090],
    ['q', -0.216, -0.070, -0.142, -0.046], ['q', -0.095, -0.036, -0.082, -0.078], ['q', -0.078, -0.092, -0.062, -0.090],
    [-0.046, -0.088], ['q', -0.030, -0.050, -0.012, 0.004], [-0.018, 0.006],
  ], 0.042, 0.009));
  P.add('rosewood', rbox(0.036, 0.012, 0.03, 0.004, 0, -0.091, -0.058, 0.35, 0, 0));
  P.add('rubber', profile([[-0.326, 0.052], [-0.342, 0.050], [-0.349, -0.089], [-0.332, -0.092]], 0.046, 0.005));
  P.add('black', box(0.046, 0.003, 0.004, 0, -0.018, -0.336, 0.07, 0, 0));
  // pump: walnut fore-end with grooves, action bars
  U.add('walnut', rbox(0.048, 0.044, 0.19, 0.016, 0, 0.024, 0.335));
  for (let i = 0; i < 8; i++) for (const sx of [1, -1]) U.add('black', box(0.001, 0.028, 0.004, sx * 0.0243, 0.024, 0.265 + i * 0.019));
  for (const sx of [1, -1]) U.add('bright', box(0.003, 0.004, 0.06, sx * 0.0118, 0.032, 0.22));
  const grip = V(0, -0.045, -0.057);
  const shift = grip.clone().negate();
  const g = new THREE.Group();
  g.add(P.build(shift));
  const pump = U.build(shift);
  g.add(pump);
  const at = (x, y, z) => V(x, y, z).add(shift);
  Object.assign(g.userData, {
    id: 'escopeta', pump, muzzle: at(0, 0.052, 0.805), eject: at(-0.02, 0.046, 0.105), sight: at(0, 0.072, 0), butt: at(0, -0.02, -0.346),
    wristR: V(-0.022, -0.004, -0.072), wristL: at(0.036, -0.004, 0.25), long: true,
  });
  return g;
}

function rifle() {
  // designed with the bore at y = 0; shifted so that the pistol grip is the origin
  const P = new Parts(), B = new Parts();
  // receiver, tapered barrel, crown
  P.add('steel', cylZ(0.0165, 0.0165, 0.22, 24, 0, 0, -0.10));
  P.add('dark', box(0.012, 0.004, 0.09, 0, 0.0162, 0.02));
  P.add('steel', cylZ(0.0122, 0.0084, 0.54, 24, 0, 0, 0.12));
  P.add('bright', cylZ(0.0086, 0.0086, 0.003, 20, 0, 0, 0.66));
  P.add('black', disc(0.0036, 12, 0, 0, 0.6632));
  // scope: ocular bell, power ring, main tube, turrets, objective bell, lenses; rings and bases
  const sy = 0.052;
  P.add('dark', cylZ(0.019, 0.019, 0.045, 28, 0, sy, -0.155));
  P.add('dark', cylZ(0.019, 0.0135, 0.04, 28, 0, sy, -0.11));
  for (let i = 0; i < 6; i++) P.add('black', cylZ(0.0196, 0.0196, 0.002, 28, 0, sy, -0.15 + i * 0.006));
  P.add('dark', cylZ(0.0128, 0.0128, 0.23, 28, 0, sy, -0.07));
  P.add('dark', cylY(0.0092, 0.02, 20, 0, sy + 0.0215, 0.05));
  P.add('bright', cylY(0.0094, 0.003, 20, 0, sy + 0.030, 0.05));
  P.add('dark', cylX(0.0092, 0.02, 20, -0.0215, sy, 0.05));
  P.add('dark', rbox(0.03, 0.024, 0.036, 0.008, 0, sy, 0.05));
  P.add('dark', cylZ(0.0128, 0.025, 0.05, 28, 0, sy, 0.16));
  P.add('dark', cylZ(0.025, 0.025, 0.06, 28, 0, sy, 0.21));
  P.add('bright', cylZ(0.0254, 0.0254, 0.004, 28, 0, sy, 0.266));
  P.add('lens', disc(0.0222, 28, 0, sy, 0.2705));
  P.add('lens', disc(0.0165, 24, 0, sy, -0.1555, true));
  for (const z of [-0.035, 0.125]) {
    P.add('steel', ring(0.0142, 0.0032, 0, sy, z));
    P.add('steel', box(0.02, sy - 0.03, 0.014, 0, 0.0155 + (sy - 0.03) / 2, z));
    P.add('dark', box(0.006, 0.006, 0.012, -0.018, sy - 0.012, z));
  }
  // walnut Monte Carlo stock with pistol grip, cheek piece, fore-end with a rosewood tip, recoil pad
  P.add('walnut', profile([
    [0.40, 0.004], [0.12, 0.004], [0.12, 0.008], [-0.10, 0.008], [-0.14, 0.011], ['q', -0.195, 0.016, -0.245, 0.036],
    [-0.36, 0.036], [-0.487, 0.030], [-0.495, -0.106], [-0.484, -0.108], ['q', -0.36, -0.080, -0.28, -0.060],
    ['q', -0.225, -0.050, -0.212, -0.100], ['q', -0.208, -0.118, -0.190, -0.119], [-0.176, -0.118],
    ['q', -0.150, -0.075, -0.115, -0.050], [0.12, -0.050], ['q', 0.29, -0.042, 0.40, -0.030],
  ], 0.044, 0.009));
  P.add('rosewood', profile([[0.40, 0.004], [0.442, 0.002], ['q', 0.45, -0.012, 0.442, -0.028], [0.40, -0.030]], 0.042, 0.008));
  P.add('rosewood', rbox(0.036, 0.01, 0.03, 0.004, 0, -0.118, -0.19, 0.25, 0, 0));
  P.add('rubber', profile([[-0.487, 0.034], [-0.504, 0.033], [-0.512, -0.108], [-0.495, -0.110]], 0.047, 0.005));
  for (const sx of [1, -1]) for (let i = 0; i < 5; i++) P.add('rosewood', box(0.0008, 0.03, 0.002, sx * 0.022, -0.078, -0.20 + i * 0.008, 0.45, 0, 0));
  // trigger guard and floor plate, trigger, sling swivels
  P.add('dark', profile([[-0.105, -0.049], [-0.105, -0.058], ['q', -0.10, -0.078, -0.08, -0.078], [-0.035, -0.078], ['q', -0.02, -0.074, -0.018, -0.052], [0.07, -0.052], [0.07, -0.049]], 0.018, 0.002, 0, [[[-0.097, -0.052], [-0.096, -0.060], ['q', -0.092, -0.071, -0.08, -0.071], [-0.040, -0.071], ['q', -0.030, -0.068, -0.028, -0.052]]]));
  P.add('bright', profile([[-0.068, -0.050], [-0.063, -0.050], ['q', -0.058, -0.060, -0.062, -0.068], [-0.065, -0.068], ['q', -0.063, -0.060, -0.068, -0.054]], 0.005, 0.001));
  P.add('bright', ring(0.008, 0.0016, 0, 0, 0).rotateY(Math.PI / 2).translate(0, -0.045, 0.34));
  P.add('bright', ring(0.008, 0.0016, 0, 0, 0).rotateY(Math.PI / 2).translate(0, -0.083, -0.40));
  // bolt: shroud, body and the bent handle with its knob (right side)
  B.add('steel', cylZ(0.0135, 0.0128, 0.045, 20, 0, 0.001, -0.145));
  B.add('bright', cylZ(0.0035, 0.0035, 0.01, 10, 0, 0.001, -0.155));
  B.add('bright', cylZ(0.0095, 0.0095, 0.06, 16, 0, 0.0, -0.10));
  const handle = new THREE.CylinderGeometry(0.0035, 0.0045, 0.05, 10);
  handle.rotateZ(Math.PI / 2 - 0.55);
  handle.translate(-0.028, -0.011, -0.088);
  B.add('bright', handle);
  B.add('black', new THREE.SphereGeometry(0.0085, 14, 10).translate(-0.05, -0.024, -0.09));
  const grip = V(0, -0.078, -0.182);
  const shift = grip.clone().negate();
  const g = new THREE.Group();
  g.add(P.build(shift));
  const bolt = new THREE.Group();
  const bm = B.build(shift);
  // the bolt turns about the bore axis: pivot the group there
  bolt.position.copy(shift); bm.position.sub(shift);
  bolt.add(bm);
  g.add(bolt);
  const at = (x, y, z) => V(x, y, z).add(shift);
  Object.assign(g.userData, {
    id: 'rifle', bolt, muzzle: at(0, 0, 0.665), eject: at(-0.018, 0.012, -0.02), sight: at(0, sy, 0), scopeY: sy + shift.y, butt: at(0, -0.036, -0.51),
    wristR: V(-0.022, -0.004, -0.072), wristL: at(0.036, -0.048, 0.1), long: true,
  });
  return g;
}

function bat() {
  const P = new Parts();
  const pts = [[0, 0], [0.024, 0.0], [0.0265, 0.006], [0.022, 0.014], [0.0138, 0.024], [0.0138, 0.25], [0.0165, 0.36], [0.0235, 0.5], [0.0305, 0.62], [0.0335, 0.7], [0.0345, 0.8], [0.0325, 0.83], [0.024, 0.841], [0.0, 0.844]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  P.add('ash', new THREE.LatheGeometry(pts, 22));
  const tape = [[0.0146, 0.026], [0.0146, 0.24], [0.0141, 0.246]].map(([r, y]) => new THREE.Vector2(r, y));
  P.add('tape', new THREE.LatheGeometry([new THREE.Vector2(0.0141, 0.02), ...tape], 22));
  P.add('rubber', new THREE.LatheGeometry([[0.0, -0.0005], [0.0245, -0.0005], [0.0272, 0.006], [0.0225, 0.0145], [0.0, 0.0145]].map(([r, y]) => new THREE.Vector2(r, y)), 22));
  const g = new THREE.Group();
  // along +Z (like the guns): lathe axis y -> z; the fist holds it 9 cm above the knob
  const m = P.build(new THREE.Vector3(0, -0.09, 0));
  m.rotation.x = Math.PI / 2;
  g.add(m);
  Object.assign(g.userData, { id: 'bate', long: false, melee: true });
  return g;
}

const BUILDERS = { pistola: pistol, subfusil: smg, escopeta: shotgun, rifle, bate: bat };
export function buildGun(id) {
  const f = BUILDERS[id];
  return f ? f() : null;
}

// spent brass / shotgun shells for the ejection effect
let _casingGeo = null;
export function casingMesh(kind) {
  const M = gunMaterials();
  if (!_casingGeo) {
    _casingGeo = {
      small: new THREE.CylinderGeometry(0.0048, 0.0048, 0.019, 8).rotateX(Math.PI / 2),
      rifle: new THREE.CylinderGeometry(0.006, 0.0055, 0.06, 8).rotateX(Math.PI / 2),
      shell: new THREE.CylinderGeometry(0.0105, 0.0105, 0.065, 10).rotateX(Math.PI / 2),
    };
  }
  const k = kind === 'escopeta' ? 'shell' : kind === 'rifle' ? 'rifle' : 'small';
  return new THREE.Mesh(_casingGeo[k], k === 'shell' ? M.shell : M.brass);
}

// Low-poly vertex-coloured prop geometry (trees of Extremadura, street furniture) + instanced placement helpers.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './util.js';

const _c = new THREE.Color();

export function paint(geo, color, vary = 0, rnd = Math.random, shadeY = null) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  _c.set(color);
  const bb = shadeY ? (geo.computeBoundingBox(), geo.boundingBox) : null;
  for (let i = 0; i < pos.count; i += 3) {
    const v = 1 + (rnd() - 0.5) * vary;
    for (let k = 0; k < 3; k++) {
      let s = v;
      if (bb) {
        const y = pos.getY(i + k);
        const t = (y - bb.min.y) / Math.max(1e-3, bb.max.y - bb.min.y);
        s *= shadeY[0] + (shadeY[1] - shadeY[0]) * t;
      }
      col[(i + k) * 3] = _c.r * s; col[(i + k) * 3 + 1] = _c.g * s; col[(i + k) * 3 + 2] = _c.b * s;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  return geo;
}
function blob(r, detail, rnd, squash = 1, bump = 0.25) {
  let g = new THREE.IcosahedronGeometry(r, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + (Math.sin(x * 3.1 / r) * Math.cos(z * 2.7 / r) * 0.5 + (rnd() - 0.5)) * bump;
    p.setXYZ(i, x * n, y * n * squash, z * n);
  }
  g.computeVertexNormals();
  return g;
}
const at = (g, x, y, z) => { g.translate(x, y, z); return g; };
function merged(list) {
  const g = mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)), false);
  g.computeVertexNormals();
  return g;
}
// Keep flat-ish normals on foliage by recomputing per blob before merge (already done), merge without recompute
function mergedKeep(list) {
  return mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)), false);
}

// ---------------------------------------------------------------- trees
export function makeTreeGeometries(lod = 0) {
  const rnd = mulberry32(99);
  const T = {};
  const D = lod ? 0 : 1; // icosahedron detail for foliage blobs
  const blobL = (r, d, rr, sq, bm) => blob(r, Math.min(d, D + (d > 1 ? 1 : 0)), rr, sq, bm);
  // Olive (olivo): gnarled short trunk(s), silvery grey-green irregular crown
  {
    const trunk = [];
    for (let k = 0; k < 2; k++) {
      const t = new THREE.CylinderGeometry(0.12, 0.26, 1.7, 6, 2);
      const p = t.attributes.position;
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getY(i) * 2.5 + k) * 0.12);
      t.rotateZ((k ? -0.25 : 0.2));
      trunk.push(paint(at(t, k ? 0.25 : -0.2, 0.8, 0), '#5a4a3a', 0.2, rnd));
    }
    const leaves = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const b = blobL(1.1 + rnd() * 0.4, 1, rnd, 0.72, 0.3);
      leaves.push(paint(at(b, Math.cos(a) * 1.0, 2.2 + rnd() * 0.6, Math.sin(a) * 1.0), '#76845a', 0.25, rnd, [0.72, 1.12]));
    }
    leaves.push(paint(at(blobL(1.2, 1, rnd, 0.7), 0, 2.9, 0), '#809063', 0.2, rnd, [0.8, 1.15]));
    T.olivo = mergedKeep([...trunk, ...leaves]);
  }
  // Holm oak (encina): dark dense wide crown
  {
    const parts = [paint(at(new THREE.CylinderGeometry(0.22, 0.38, 2.6, 7), 0, 1.3, 0), '#4b3d31', 0.15, rnd)];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      parts.push(paint(at(blobL(1.6 + rnd() * 0.5, 1, rnd, 0.7), Math.cos(a) * 1.8, 3.6 + rnd() * 0.8, Math.sin(a) * 1.8), '#3f5433', 0.22, rnd, [0.65, 1.1]));
    }
    parts.push(paint(at(blobL(2.0, 1, rnd, 0.65), 0, 4.6, 0), '#46603a', 0.2, rnd, [0.75, 1.15]));
    T.encina = mergedKeep(parts);
  }
  // Plane tree (plátano de sombra): tall mottled trunk, big light-green crown
  {
    const parts = [paint(at(new THREE.CylinderGeometry(0.2, 0.32, 5.5, 8), 0, 2.75, 0), '#a39a86', 0.25, rnd)];
    for (let k = 0; k < 3; k++) {
      const br = new THREE.CylinderGeometry(0.07, 0.12, 2.4, 5);
      br.rotateZ(0.7); br.rotateY((k / 3) * Math.PI * 2);
      parts.push(paint(at(br, 0, 5.8, 0), '#9d9480', 0.2, rnd));
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      parts.push(paint(at(blobL(1.8 + rnd() * 0.5, 1, rnd, 0.8), Math.cos(a) * 2.1, 7.2 + rnd() * 1.4, Math.sin(a) * 2.1), '#5f8a3a', 0.25, rnd, [0.7, 1.15]));
    }
    parts.push(paint(at(blobL(2.4, 1, rnd, 0.8), 0, 8.8, 0), '#6a9544', 0.2, rnd, [0.75, 1.2]));
    T.platano = mergedKeep(parts);
  }
  // Orange tree (naranjo): round dense crown with fruit
  {
    const parts = [paint(at(new THREE.CylinderGeometry(0.08, 0.12, 1.3, 6), 0, 0.65, 0), '#5b4a39', 0.15, rnd)];
    parts.push(paint(at(blobL(1.3, 2, rnd, 0.95, 0.12), 0, 2.1, 0), '#2f5b27', 0.2, rnd, [0.7, 1.15]));
    for (let k = 0; k < 16; k++) {
      const th = rnd() * Math.PI * 2, ph = rnd() * Math.PI * 0.8 + 0.2;
      const r = 1.28;
      parts.push(paint(at(new THREE.IcosahedronGeometry(0.075, 0), Math.cos(th) * Math.sin(ph) * r, 2.1 + Math.cos(ph) * r * 0.95, Math.sin(th) * Math.sin(ph) * r), '#f08a17', 0.1, rnd));
    }
    T.naranjo = mergedKeep(parts);
  }
  // Stone pine (pino piñonero): umbrella crown on a tall trunk
  {
    const tr = new THREE.CylinderGeometry(0.16, 0.3, 7.5, 7);
    tr.rotateZ(0.06);
    const parts = [paint(at(tr, 0.2, 3.75, 0), '#6d4a33', 0.2, rnd)];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      parts.push(paint(at(blobL(1.9, 1, rnd, 0.42, 0.2), Math.cos(a) * 2.2, 8.2 + rnd() * 0.5, Math.sin(a) * 2.2), '#3d5c2c', 0.2, rnd, [0.6, 1.1]));
    }
    parts.push(paint(at(blobL(2.3, 1, rnd, 0.45, 0.2), 0, 8.8, 0), '#44652f', 0.2, rnd, [0.7, 1.1]));
    T.pino = mergedKeep(parts);
  }
  // Canary palm (palmera)
  {
    const parts = [];
    const tr = new THREE.CylinderGeometry(0.42, 0.5, 6.5, 10, 8);
    parts.push(paint(at(tr, 0, 3.25, 0), '#7d6a4d', 0.3, rnd));
    parts.push(paint(at(new THREE.SphereGeometry(0.62, 10, 6), 0, 6.6, 0), '#6e6a3a', 0.2, rnd));
    for (let k = 0; k < 18; k++) {
      const fr = new THREE.PlaneGeometry(0.7, 4.2, 1, 4);
      const p = fr.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) + 2.1; // 0..4.2
        const t = y / 4.2;
        p.setX(i, p.getX(i) * (1 - t * 0.85));
        p.setZ(i, -t * t * 1.6); // droop
        p.setY(i, y);
      }
      fr.rotateX(-Math.PI / 2 + 0.55 + (k % 3) * 0.18);
      fr.rotateY((k / 18) * Math.PI * 2);
      parts.push(paint(at(fr, 0, 6.8, 0), '#4f7a2e', 0.25, rnd));
    }
    T.palmera = merged(parts);
  }
  // Cypress (ciprés)
  {
    const parts = [paint(at(new THREE.CylinderGeometry(0.1, 0.15, 0.8, 5), 0, 0.4, 0), '#4a3b2e', 0.1, rnd)];
    const c = new THREE.ConeGeometry(0.9, 8.5, 8, 4);
    const p = c.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + (rnd() - 0.5) * 0.18; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    c.computeVertexNormals();
    parts.push(paint(at(c, 0, 4.9, 0), '#2e4b2a', 0.2, rnd, [0.7, 1.1]));
    T.cipres = mergedKeep(parts);
  }
  // Eucalyptus
  {
    const tr = new THREE.CylinderGeometry(0.18, 0.32, 10, 7);
    const parts = [paint(at(tr, 0, 5, 0), '#c8bfa9', 0.25, rnd)];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      parts.push(paint(at(blobL(1.5, 1, rnd, 1.3, 0.35), Math.cos(a) * 1.4, 9 + rnd() * 3, Math.sin(a) * 1.4), '#6f8660', 0.25, rnd, [0.75, 1.1]));
    }
    T.eucalipto = mergedKeep(parts);
  }
  // Vine row segment (viñedo), 4 m long low hedge on wires
  {
    const parts = [];
    for (let k = 0; k < 4; k++) {
      const b = blob(0.62, 0, rnd, 0.8, 0.3);
      b.scale(1.5, 1, 1);
      parts.push(paint(at(b, -2.25 + k * 1.5, 0.75, 0), '#5e7f33', 0.3, rnd, [0.7, 1.1]));
    }
    parts.push(paint(at(new THREE.BoxGeometry(0.06, 1.1, 0.06), -3, 0.55, 0), '#6b5a45', 0, rnd));
    T.vina = mergedKeep(parts);
  }
  // Reeds (cañas) clump
  {
    const parts = [];
    for (let k = 0; k < 9; k++) {
      const c = new THREE.CylinderGeometry(0.01, 0.03, 2.6 + rnd(), 3);
      c.rotateZ((rnd() - 0.5) * 0.4); c.rotateX((rnd() - 0.5) * 0.4);
      parts.push(paint(at(c, (rnd() - 0.5) * 0.8, 1.4, (rnd() - 0.5) * 0.8), '#9c9a5a', 0.3, rnd));
    }
    T.canas = merged(parts);
  }
  // Bush (adelfa / seto)
  {
    const parts = [];
    for (let k = 0; k < 3; k++) parts.push(paint(at(blobL(0.7, 1, rnd, 0.8), (k - 1) * 0.6, 0.6, 0), '#3f6a2e', 0.25, rnd, [0.7, 1.1]));
    for (let k = 0; k < 8; k++) parts.push(paint(at(new THREE.IcosahedronGeometry(0.08, 0), (rnd() - 0.5) * 1.6, 0.6 + rnd() * 0.5, (rnd() - 0.5) * 0.9), rnd() < 0.5 ? '#e05a8a' : '#ffffff', 0.1, rnd));
    T.arbusto = mergedKeep(parts);
  }
  for (const k in T) T[k].computeBoundingSphere();
  return T;
}

// ---------------------------------------------------------------- street furniture
export function makeFurnitureGeometries() {
  const rnd = mulberry32(7);
  const F = {};
  // wall-mounted lantern (farol fernandino) — origin at the wall anchor, arm out along +z. A plate screwed to the wall,
  // the iron arm with its diagonal brace (tornapunta) and scroll, and the four-sided lantern hanging from the end.
  {
    const iron = '#1a1a1a';
    const plate = paint(at(new THREE.BoxGeometry(0.13, 0.36, 0.022), 0, -0.1, 0.011), iron);
    const bolts = [0.05, -0.25].map((y) => paint(at(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6).rotateX(Math.PI / 2), 0, y, 0.026), '#3a3a3a'));
    const arm = paint(at(new THREE.BoxGeometry(0.034, 0.034, 0.64), 0, 0, 0.32), iron);
    const brace = paint(new THREE.BoxGeometry(0.024, 0.024, 0.4), iron);
    brace.rotateX(-0.66); brace.translate(0, -0.13, 0.17);
    const curlG = new THREE.TorusGeometry(0.075, 0.011, 4, 12, Math.PI * 1.3);
    curlG.rotateY(Math.PI / 2); curlG.translate(0, -0.075, 0.4);
    const curl = paint(curlG, iron);
    const tip = paint(at(new THREE.SphereGeometry(0.022, 6, 4), 0, 0, 0.645), iron);
    const stem = paint(at(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 5), 0, -0.04, 0.6), iron);
    const cap = paint(at(new THREE.ConeGeometry(0.15, 0.13, 4), 0, -0.14, 0.6), iron); // pyramid roof
    const frame = [];
    for (const [x, z] of [[0.085, 0.085], [-0.085, 0.085], [0.085, -0.085], [-0.085, -0.085]]) frame.push(paint(at(new THREE.BoxGeometry(0.014, 0.3, 0.014), x * 0.9, -0.36, 0.6 + z * 0.9), iron));
    const base = paint(at(new THREE.CylinderGeometry(0.1, 0.07, 0.05, 4), 0, -0.53, 0.6), iron);
    const finG = new THREE.ConeGeometry(0.03, 0.08, 4);
    finG.rotateX(Math.PI); finG.translate(0, -0.59, 0.6);
    const fin = paint(finG, iron);
    F.farolPared = merged([plate, ...bolts, arm, brace, curl, tip, stem, cap, ...frame, base, fin]);
    F.farolParedLuz = paint(at(new THREE.CylinderGeometry(0.105, 0.082, 0.3, 4), 0, -0.36, 0.6), '#ffe2a8');
  }
  // post lamp (modern avenue lamp): pole 5.5 m with head
  {
    const pole = paint(at(new THREE.CylinderGeometry(0.06, 0.1, 5.6, 6), 0, 2.8, 0), '#3b3f44');
    const base = paint(at(new THREE.CylinderGeometry(0.14, 0.16, 0.5, 6), 0, 0.25, 0), '#33363a');
    const arm = paint(at(new THREE.BoxGeometry(0.06, 0.06, 1.2), 0, 5.55, 0.55), '#3b3f44');
    const head = paint(at(new THREE.BoxGeometry(0.34, 0.1, 0.6), 0, 5.5, 1.15), '#2f3236');
    F.farola = merged([pole, base, arm, head]);
    F.farolaLuz = paint(at(new THREE.BoxGeometry(0.28, 0.03, 0.5), 0, 5.44, 1.15), '#fff0cf');
  }
  // bench (banco) with backrest
  {
    const parts = [];
    for (let i = 0; i < 4; i++) parts.push(paint(at(new THREE.BoxGeometry(1.8, 0.04, 0.09), 0, 0.45, -0.18 + i * 0.1), '#8a5a33', 0.2, rnd));
    for (let i = 0; i < 3; i++) {
      const s = paint(at(new THREE.BoxGeometry(1.8, 0.09, 0.03), 0, 0.62 + i * 0.12, -0.26), '#8a5a33', 0.2, rnd);
      s.rotateX(-0.1);
      parts.push(s);
    }
    for (const x of [-0.75, 0.75]) {
      parts.push(paint(at(new THREE.BoxGeometry(0.06, 0.45, 0.45), x, 0.22, -0.05), '#2a2a2a'));
      parts.push(paint(at(new THREE.BoxGeometry(0.05, 0.5, 0.05), x, 0.75, -0.28), '#2a2a2a'));
    }
    F.banco = merged(parts);
  }
  // waste containers (contenedores): green (resto), yellow (envases), blue (papel), brown (orgánico)
  const cont = (col) => {
    const body = paint(at(new THREE.BoxGeometry(1.25, 1.15, 1.0), 0, 0.72, 0), col, 0.05, rnd, [0.8, 1.05]);
    const lid = paint(at(new THREE.BoxGeometry(1.3, 0.1, 1.05), 0, 1.35, -0.02), col, 0.05, rnd);
    lid.rotateX(-0.05);
    const wheels = [];
    for (const x of [-0.5, 0.5]) for (const z of [-0.35, 0.35]) wheels.push(paint(at(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8).rotateZ(Math.PI / 2), x, 0.08, z), '#111'));
    return merged([body, lid, ...wheels]);
  };
  F.contVerde = cont('#2f6b3a'); F.contAmarillo = cont('#e5c21e'); F.contAzul = cont('#2659a6'); F.contMarron = cont('#6b4a2e');
  // bollard (bolardo)
  F.bolardo = merged([paint(at(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 8), 0, 0.45, 0), '#2d2f31'), paint(at(new THREE.SphereGeometry(0.075, 8, 4), 0, 0.9, 0), '#2d2f31')]);
  // sign pole (signs are separate textured quads)
  F.poste = paint(at(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), 0, 1.3, 0), '#9ea3a8');
  // concrete power pole + crossarm
  F.posteLuz = merged([
    paint(at(new THREE.BoxGeometry(0.22, 9, 0.22), 0, 4.5, 0), '#b9b4a8', 0.1, rnd),
    paint(at(new THREE.BoxGeometry(1.6, 0.1, 0.1), 0, 8.6, 0), '#6f6f6f'),
    paint(at(new THREE.CylinderGeometry(0.04, 0.05, 0.18, 6), -0.7, 8.75, 0), '#6d7f8a'),
    paint(at(new THREE.CylinderGeometry(0.04, 0.05, 0.18, 6), 0, 8.75, 0), '#6d7f8a'),
    paint(at(new THREE.CylinderGeometry(0.04, 0.05, 0.18, 6), 0.7, 8.75, 0), '#6d7f8a'),
  ]);
  // chimney
  F.chimenea = merged([
    paint(at(new THREE.BoxGeometry(0.5, 1.0, 0.5), 0, 0.5, 0), '#ece8de', 0.05, rnd),
    paint(at(new THREE.BoxGeometry(0.7, 0.08, 0.7), 0, 1.05, 0), '#a0522d'),
    paint(at(new THREE.BoxGeometry(0.6, 0.18, 0.6), 0, 1.18, 0), '#b35d33'),
  ]);
  // TV antenna
  F.antena = merged([
    paint(at(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 4), 0, 1.1, 0), '#9a9a9a'),
    paint(at(new THREE.BoxGeometry(0.9, 0.02, 0.02), 0, 1.9, 0), '#9a9a9a'),
    paint(at(new THREE.BoxGeometry(0.6, 0.02, 0.02), 0, 1.6, 0), '#9a9a9a'),
  ]);
  // solar panel row (placa solar) 2 x 1 m tilted
  {
    const p = paint(new THREE.BoxGeometry(2.0, 0.05, 1.1), '#1f2b45');
    p.rotateX(-0.5); p.translate(0, 0.45, 0);
    const frame = paint(at(new THREE.BoxGeometry(2.0, 0.5, 0.05), 0, 0.25, -0.45), '#8d9296');
    F.solar = merged([p, frame]);
  }
  // water tank (depósito) on flat roofs
  F.deposito = merged([paint(at(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 10), 0, 0.75, 0), '#d8d8d2'), paint(at(new THREE.BoxGeometry(1.1, 0.2, 1.1), 0, 0.1, 0), '#8a8a85')]);
  // AC unit on roof
  F.aire = paint(at(new THREE.BoxGeometry(0.8, 0.55, 0.3), 0, 0.28, 0), '#e8e8e4');
  // stork nest (nido de cigüeña)
  {
    const rr = mulberry32(3);
    const nest = new THREE.CylinderGeometry(0.75, 0.55, 0.5, 10, 1);
    const p = nest.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + (rr() - 0.5) * 0.25; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    nest.computeVertexNormals();
    F.nido = paint(at(nest, 0, 0.25, 0), '#7a6446', 0.35, rr);
  }
  // Town entry sign post pair
  F.postesDobles = merged([paint(at(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), -0.55, 1.2, 0), '#a0a4a8'), paint(at(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), 0.55, 1.2, 0), '#a0a4a8')]);
  // Fountain (fuente) basin
  F.fuente = merged([
    paint(at(new THREE.CylinderGeometry(2.2, 2.3, 0.6, 20, 1, true), 0, 0.3, 0), '#c9c0ae'),
    paint(at(new THREE.TorusGeometry(2.25, 0.12, 6, 24).rotateX(Math.PI / 2), 0, 0.6, 0), '#d6cdbb'),
    paint(at(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 10), 0, 0.8, 0), '#c9c0ae'),
    paint(at(new THREE.CylinderGeometry(0.8, 0.3, 0.3, 12), 0, 1.65, 0), '#d6cdbb'),
  ]);
  for (const k in F) F[k].computeBoundingSphere();
  return F;
}

// ---------------------------------------------------------------- instancing helper
export class InstanceGroup {
  constructor(geometry, material, { castShadow = true, receiveShadow = true, chunk = 250, low = null, lodDist = 170, maxDist = 1400 } = {}) {
    this.geometry = geometry; this.material = material; this.chunk = chunk;
    this.items = new Map(); // chunkKey -> array of matrices (Float32 16) + colors
    this.castShadow = castShadow; this.receiveShadow = receiveShadow;
    this.low = low; this.lodDist = lodDist; this.maxDist = maxDist;
  }
  // distance-based LOD / culling per chunk
  update(cx, cz) {
    if (!this.meshes) return;
    for (const m of this.meshes) {
      const c = m.userData.c;
      if (!c) continue;
      const d = Math.hypot(c[0] - cx, c[1] - cz) - c[2];
      m.visible = d < this.maxDist;
      if (this.low) {
        const g = d < this.lodDist ? this.geometry : this.low;
        if (m.geometry !== g) m.geometry = g;
      }
      m.castShadow = this.castShadow && d < 90;
    }
  }
  add(x, y, z, rotY = 0, s = 1, sy = s, color = null) {
    const key = Math.floor(x / this.chunk) + ':' + Math.floor(z / this.chunk);
    let a = this.items.get(key);
    if (!a) this.items.set(key, (a = []));
    a.push(x, y, z, rotY, s, sy, color ? color.r : -1, color ? color.g : 0, color ? color.b : 0);
    return { key, idx: a.length / 9 - 1 };
  }
  // hide one instance after build (handle from add)
  hide(h) {
    const m = this.byKey && this.byKey.get(h.key);
    if (!m) return;
    m.setMatrixAt(h.idx, new THREE.Matrix4().makeScale(0, 0, 0));
    m.instanceMatrix.needsUpdate = true;
  }
  addMatrix(m, key = '0:0') {
    let a = this.items.get('M' + key);
    if (!a) this.items.set('M' + key, (a = []));
    a.push(m);
  }
  build(parent) {
    const meshes = [];
    this.byKey = new Map();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const [key, a] of this.items) {
      if (key[0] === 'M') {
        const im = new THREE.InstancedMesh(this.geometry, this.material, a.length);
        a.forEach((mm, i) => im.setMatrixAt(i, mm));
        im.castShadow = this.castShadow; im.receiveShadow = this.receiveShadow;
        im.computeBoundingSphere();
        parent.add(im); meshes.push(im);
        continue;
      }
      const n = a.length / 9;
      const im = new THREE.InstancedMesh(this.geometry, this.material, n);
      let hasColor = false;
      for (let i = 0; i < n; i++) {
        const o = i * 9;
        p.set(a[o], a[o + 1], a[o + 2]);
        q.setFromAxisAngle(up, a[o + 3]);
        sc.set(a[o + 4], a[o + 5], a[o + 4]);
        m.compose(p, q, sc);
        im.setMatrixAt(i, m);
        if (a[o + 6] >= 0) { hasColor = true; im.setColorAt(i, _c.setRGB(a[o + 6], a[o + 7], a[o + 8])); }
        else if (hasColor) im.setColorAt(i, _c.setRGB(1, 1, 1));
      }
      if (hasColor && im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = this.castShadow; im.receiveShadow = this.receiveShadow;
      im.computeBoundingSphere();
      const bs = im.boundingSphere;
      im.userData.c = [bs.center.x, bs.center.z, bs.radius];
      parent.add(im);
      meshes.push(im);
      this.byKey.set(key, im);
    }
    this.meshes = meshes;
    return meshes;
  }
}

// The retablo mayor of Santa María (gilded wood, 1945–49), after the photographs of it: across the back of the apse in
// three planes (the middle one flat, the outer streets turned in with the curve of the wall), five streets on a
// predella and three tiers, an attic over the middle street.
//   · the predella: pedestals under the columns with cherubs' heads; between them the four Latin Doctors in painted
//     panels; in the middle the tabernacle.
//   · the side streets: twelve canvases of the apostles under round heads, a carved cartouche under each.
//   · the middle street: the exhibitor (a little silver temple) in its niche; above it the Virgin in a niche with a
//     shell at its head, crowned, a gilded sunburst behind her; above her the Crucifixion with Mary and John; on top the
//     dove of the Holy Spirit in a glory of rays, between scrolls, under a broken pediment and the cross.
//   · the supports: columns with a carved lower third and a fluted shaft, Corinthian capitals; the entablatures break
//     forward over them, the main cornice on dentils.
import * as THREE from 'three';
import { paintingTexture, APOSTLE_ORDER } from './paintings.js';
import { mulberry32 } from './util.js';

const TIERS = [{ v0: 2.15, h: 2.85, r: 0.15 }, { v0: 5.62, h: 2.68, r: 0.14 }, { v0: 8.9, h: 2.4, r: 0.13 }];
const ENT = 0.62;             // an entablature's height (the last one, the main cornice, a little more)
const UC = 1.4, UH = 3.45;    // the middle street's columns, the hinge (where the outer streets turn in)
const WING = 1.95;            // the outer streets' width
// turned inside out: faces and normals look the other way (a soffit seen from below)
function inward(g) {
  const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}
export const RETABLO = { TIERS, UC, UH, WING, top: TIERS[2].v0 + TIERS[2].h + 0.66 };

// k: the church's material keys; opts: { P (floor), xb (the back plane), OX, OZ, add (church's add), B, statue, alpha }
export function buildRetablo(k, { P, xb, OX, OZ, add, B, statue, alpha = 0.55 }) {
  const r = mulberry32(1949);
  const extras = [];
  // the three planes: local u across (to the right as you look at it), v up from the presbytery floor, w out towards you
  const mk = (theta, ox, oz) => ({ theta, ox, oz, c: Math.cos(theta), s: Math.sin(theta) });
  const C = mk(-Math.PI / 2, xb, 0);
  const R = mk(-Math.PI / 2 - alpha, xb, UH);
  const L = mk(-Math.PI / 2 + alpha, xb, -UH);
  const toChurch = (pl, u, v, w) => [pl.ox + u * pl.c + w * pl.s, P + v, pl.oz - u * pl.s + w * pl.c];
  const put = (pl, key, g, u, v, w, ry = 0) => { if (!g) return; if (ry) g.rotateY(ry); g.translate(u, v, w); g.rotateY(pl.theta); g.translate(pl.ox, P, pl.oz); add(key, g); };
  const box = (pl, key, w, h, d, u, v, wz) => put(pl, key, new THREE.BoxGeometry(w, h, d), u, v + h / 2, wz);
  const mesh = (pl, geo, mat, u, v, w) => { geo.translate(u, v, w); geo.rotateY(pl.theta); geo.translate(pl.ox + OX, P, pl.oz + OZ); const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; B.extra.push(m); extras.push(m); return m; };

  // ---------------------------------------------------------------- pieces
  // a column: base, the carved lower third, the fluted shaft, the Corinthian capital and its abacus
  const column = (pl, u, v0, h, rr, w = 0.32) => {
    const third = h * 0.3, capH = 0.32, shaftH = h - 0.18 - capH;
    put(pl, k.goldPlain, new THREE.CylinderGeometry(rr * 1.4, rr * 1.5, 0.08, 16), u, v0 + 0.04, w);
    { const t = new THREE.TorusGeometry(rr * 1.22, rr * 0.22, 8, 20); t.rotateX(Math.PI / 2); put(pl, k.goldPlain, t, u, v0 + 0.12, w); }
    // the lower third: wrapped in carved leaves (a bulge with lobes round it)
    const lo = new THREE.CylinderGeometry(rr * 1.08, rr * 1.1, third, 20, 6);
    { const p = lo.attributes.position; for (let i = 0; i < p.count; i++) { const px = p.getX(i), pz = p.getZ(i), py = p.getY(i); const d = Math.hypot(px, pz); if (d < 1e-6) continue; const a = Math.atan2(pz, px), t = py / third + 0.5; const f = 1 + 0.12 * Math.max(0, Math.sin(a * 5 + t * 2.4)) * Math.sin(t * Math.PI); p.setXYZ(i, px * f, py, pz * f); } lo.computeVertexNormals(); }
    put(pl, k.gold, lo, u, v0 + 0.16 + third / 2, w);
    { const t = new THREE.TorusGeometry(rr * 1.08, rr * 0.12, 6, 20); t.rotateX(Math.PI / 2); put(pl, k.goldPlain, t, u, v0 + 0.16 + third, w); }
    // the fluted shaft
    const fl = shaftH - third;
    const sh = new THREE.CylinderGeometry(rr * 0.9, rr, fl, 32, 4);
    { const p = sh.attributes.position; for (let i = 0; i < p.count; i++) { const px = p.getX(i), pz = p.getZ(i); if (px * px + pz * pz < 1e-10) continue; const a = Math.atan2(pz, px), f = 1 - 0.1 * Math.max(0, Math.cos(a * 16)) ** 2; p.setXYZ(i, px * f, p.getY(i), pz * f); } sh.computeVertexNormals(); }
    put(pl, k.goldPlain, sh, u, v0 + 0.16 + third + fl / 2, w);
    // the capital: a bell dressed in two rows of leaves, volutes at the corners, the abacus with its hollow sides
    const vc = v0 + h - capH - 0.02;
    const bell = new THREE.CylinderGeometry(rr * 1.35, rr * 0.92, capH * 0.78, 24, 5);
    { const p = bell.attributes.position; for (let i = 0; i < p.count; i++) { const px = p.getX(i), pz = p.getZ(i), py = p.getY(i); if (px * px + pz * pz < 1e-10) continue; const a = Math.atan2(pz, px), t = py / (capH * 0.78) + 0.5; const row = t < 0.5 ? Math.cos(a * 8) : Math.cos(a * 8 + Math.PI); const f = 1 + 0.16 * Math.max(0, row) * Math.sin(((t * 2) % 1) * Math.PI); p.setXYZ(i, px * f, py, pz * f); } bell.computeVertexNormals(); }
    put(pl, k.gold, bell, u, vc + capH * 0.39, w);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const vol = new THREE.TorusGeometry(rr * 0.28, rr * 0.09, 6, 10); vol.rotateY(Math.PI / 4 * sx * sz); put(pl, k.goldPlain, vol, u + sx * rr * 1.15, vc + capH * 0.75, w + sz * rr * 1.15); }
    put(pl, k.goldPlain, new THREE.BoxGeometry(rr * 3.1, 0.07, rr * 3.1), u, vc + capH + 0.0, w);
  };
  // an entablature across a plane from u0 to u1, broken forward over the columns at us
  const entab = (pl, u0, u1, v, us, big = false) => {
    const W = u1 - u0, um = (u0 + u1) / 2, H = big ? ENT + 0.05 : ENT;
    box(pl, k.goldPlain, W, 0.06, 0.34, um, v, 0.17);              // architrave: two fasciae
    box(pl, k.goldPlain, W, 0.08, 0.31, um, v + 0.06, 0.155);
    box(pl, k.gold, W, 0.27, 0.28, um, v + 0.14, 0.14);              // the carved frieze
    box(pl, k.goldPlain, W + 0.06, 0.05, 0.36, um, v + 0.41, 0.18);  // the cornice: a bed moulding, the corona, the cymatium
    box(pl, k.goldPlain, W + 0.16, 0.1, 0.48, um, v + 0.46, 0.24);
    box(pl, k.goldPlain, W + 0.22, 0.06, 0.54, um, v + 0.56, 0.27);
    if (big) { for (let i = 0, n = Math.floor(W / 0.14); i < n; i++) box(pl, k.goldPlain, 0.06, 0.07, 0.07, u0 + 0.07 + i * (W - 0.14) / (n - 1), v + 0.36, 0.38); box(pl, k.goldPlain, W + 0.3, 0.06, 0.6, um, v + 0.62, 0.3); }
    for (const u of us) { // the breaks over the columns
      box(pl, k.goldPlain, 0.5, 0.14, 0.26, u, v, 0.45);
      box(pl, k.gold, 0.5, 0.27, 0.22, u, v + 0.14, 0.44);
      box(pl, k.goldPlain, 0.62, 0.1, 0.34, u, v + 0.46, 0.5);
      box(pl, k.goldPlain, 0.68, 0.06 + (big ? 0.06 : 0), 0.4, u, v + 0.56, 0.52);
    }
    return v + H;
  };
  // a round-headed opening in plan (centre u, bottom v, width w, height h): its outline as points
  const archPts = (u, v, w, h, n = 20) => { const R2 = w / 2, pts = [[u - R2, v], [u + R2, v]]; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; pts.push([u + Math.cos(a) * R2, v + h - R2 + Math.sin(a) * R2]); } return pts; };
  const shapeOf = (pts) => { const s = new THREE.Shape(); pts.forEach(([a, b], i) => (i ? s.lineTo(a, b) : s.moveTo(a, b))); s.closePath(); return s; };
  // a painting under a round head, in a moulded frame, with a carved cartouche under it
  const painting = (pl, kind, u, v, w, h, tw = 288, th = 432) => {
    const pts = archPts(0, 0, w, h);
    const g = new THREE.ShapeGeometry(shapeOf(pts), 16);
    { const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, p.getY(i) / h); }
    mesh(pl, g, new THREE.MeshStandardMaterial({ map: paintingTexture(kind, { w: tw, h: th, seed: Math.floor(r() * 1e5) }), roughness: 0.55 }), u, v, 0.05);
    // the frame: a moulded band round it, beads on both its edges
    const outer = archPts(0, -0.1, w + 0.2, h + 0.2), frame = shapeOf(outer); frame.holes.push(shapeOf(pts.slice().reverse()));
    put(pl, k.goldPlain, new THREE.ExtrudeGeometry(frame, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 12 }), u, v, 0.03);
    // the cartouche under it: a carved shell between two scrolls
    const ct = new THREE.Shape(); ct.moveTo(-0.26, 0); ct.quadraticCurveTo(-0.3, -0.14, -0.14, -0.22); ct.quadraticCurveTo(0, -0.34, 0.14, -0.22); ct.quadraticCurveTo(0.3, -0.14, 0.26, 0); ct.closePath();
    put(pl, k.gold, new THREE.ExtrudeGeometry(ct, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 8 }), u, v - 0.1, 0.04);
    // a cherub's head in each spandrel
    for (const sx of [-1, 1]) cherub(pl, u + sx * (w / 2 + 0.06), v + h - 0.02, 0.06);
  };
  const cherub = (pl, u, v, w, s = 1) => {
    put(pl, k.goldPlain, new THREE.SphereGeometry(0.075 * s, 10, 8), u, v, w + 0.06);
    for (const sx of [-1, 1]) { const wing = new THREE.SphereGeometry(0.09 * s, 8, 6); wing.scale(1, 0.45, 0.35); wing.rotateZ(sx * 0.5); put(pl, k.gold, wing, u + sx * 0.1 * s, v + 0.02 * s, w + 0.04); }
  };
  // a niche: a round-headed hollow (its back lined), gilded reveals, a shell at its head
  const nicheAt = (pl, u, v, w, h, back, shell = true) => {
    const R2 = w / 2, d = 0.42;
    mesh(pl, new THREE.ShapeGeometry(shapeOf(archPts(0, 0, w, h)), 16), back, u, v, -0.38);
    for (const sx of [-1, 1]) box(pl, k.goldPlain, 0.04, h - R2, d, u + sx * (R2 + 0.02), v, -0.38 + d / 2);
    put(pl, k.goldPlain, inward(new THREE.CylinderGeometry(R2, R2, d, 20, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2)), u, v + h - R2, -0.38 + d / 2);
    if (shell) for (let i = 0; i < 13; i++) { const a = (i / 12) * Math.PI, rib = new THREE.CylinderGeometry(0.035, 0.012, R2 * 0.95, 6); rib.translate(0, R2 * 0.475, 0); rib.rotateZ(a - Math.PI / 2); put(pl, k.gold, rib, u, v + h - R2, -0.34 + 0.05 * Math.sin(a)); }
    const fr = shapeOf(archPts(0, -0.08, w + 0.24, h + 0.2)); fr.holes.push(shapeOf(archPts(0, 0, w, h).reverse()));
    put(pl, k.goldPlain, new THREE.ExtrudeGeometry(fr, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 12 }), u, v, 0.02);
  };
  // a carved panel between the columns (a sunk field in a moulded border)
  const panel = (pl, u, v, w, h, wz = 0.02) => { box(pl, k.gold, w, h, 0.06, u, v, wz); box(pl, k.goldPlain, w + 0.08, 0.05, 0.1, u, v + h, wz + 0.02); box(pl, k.goldPlain, w + 0.08, 0.05, 0.1, u, v - 0.05, wz + 0.02); };
  const finial = (pl, u, v, w, s = 1, flame = true) => {
    put(pl, k.goldPlain, new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.12 * s, 12), u, v + 0.06 * s, w);
    const urn = new THREE.LatheGeometry([[0.001, 0], [0.12, 0.02], [0.16, 0.12], [0.1, 0.24], [0.06, 0.28], [0.11, 0.34], [0.001, 0.36]].map(([a, b]) => new THREE.Vector2(a * s, b * s)), 14);
    put(pl, k.gold, urn, u, v + 0.12 * s, w);
    if (flame) { const f = new THREE.ConeGeometry(0.09 * s, 0.36 * s, 8); const p = f.attributes.position; for (let i = 0; i < p.count; i++) { const py = p.getY(i); p.setX(i, p.getX(i) + Math.sin(py * 14) * 0.02 * s); } f.computeVertexNormals(); put(pl, k.goldPlain, f, u, v + 0.66 * s, w); }
  };
  const pedestal = (pl, u, v0, v1, w = 0.3) => { // the predella's projecting block under a column, a cherub on its face
    box(pl, k.goldPlain, 0.5, v1 - v0, 0.5, u, v0, w);
    box(pl, k.gold, 0.38, (v1 - v0) * 0.66, 0.04, u, v0 + (v1 - v0) * 0.17, w + 0.27);
    cherub(pl, u, v0 + (v1 - v0) * 0.55, w + 0.24, 0.9);
    box(pl, k.goldPlain, 0.6, 0.08, 0.6, u, v1 - 0.08, w);
  };

  // ---------------------------------------------------------------- the three planes
  const velvet = new THREE.MeshStandardMaterial({ color: 0x5a1420, roughness: 0.95 });
  const blue = new THREE.MeshStandardMaterial({ map: starsTexture(), roughness: 0.9 });
  const cols = { C: [-UH, -UC, UC, UH], R: [WING], L: [-WING] };
  const planes = [['C', C, -UH, UH], ['R', R, 0, WING], ['L', L, -WING, 0]];
  for (const [name, pl, u0, u1] of planes) {
    const W = u1 - u0, um = (u0 + u1) / 2;
    // the sotabanco and the predella
    box(pl, k.goldPlain, W + 0.1, 0.12, 0.62, um, 0, 0.31);
    box(pl, k.gold, W, 0.6, 0.5, um, 0.12, 0.25);
    box(pl, k.goldPlain, W + 0.08, 0.08, 0.58, um, 0.72, 0.29);
    box(pl, k.gold, W, 1.27, 0.12, um, 0.8, -0.06); // the back of the predella
    box(pl, k.goldPlain, W + 0.12, 0.08, 0.5, um, 2.07, 0.22);
    for (const u of cols[name]) pedestal(pl, u, 0.8, 2.07);
    // the back boards of the tiers, their frames
    for (let ti = 0; ti < 3; ti++) {
      const t = TIERS[ti];
      if (name !== 'C' || ti === 2) { box(pl, k.gold, W, t.h, 0.1, um, t.v0, -0.05); continue; }
      for (const sx of [-1, 1]) box(pl, k.gold, UH - UC, t.h, 0.1, sx * (UC + UH) / 2, t.v0, -0.05);
      const nv = ti === 0 ? t.v0 + 0.25 : t.v0 + 0.12, nw = ti === 0 ? 1.62 : 1.55, nh = ti === 0 ? t.h - 0.42 : t.h - 0.3;
      const wall = shapeOf([[-UC, t.v0], [UC, t.v0], [UC, t.v0 + t.h], [-UC, t.v0 + t.h]]); wall.holes.push(shapeOf(archPts(0, nv, nw, nh).reverse()));
      put(pl, k.gold, new THREE.ExtrudeGeometry(wall, { depth: 0.1, bevelEnabled: false, curveSegments: 12 }), 0, 0, -0.1);
    }
    // the columns, the entablatures
    const cu = name === 'C' ? cols.C : name === 'R' ? [WING] : [-WING];
    for (let ti = 0; ti < 3; ti++) {
      const t = TIERS[ti];
      for (const u of cu) column(pl, u, t.v0, t.h, t.r);
      entab(pl, u0 - 0.04, u1 + 0.04, t.v0 + t.h, cu, ti === 2);
    }
  }
  // ---------------------------------------------------------------- what is in the streets
  // the apostles: the inner streets and the outer ones, three tiers (Peter and Paul at the bottom, nearest the tabernacle)
  const slots = [[L, -WING / 2, 1.18], [C, -(UC + UH) / 2, 1.3], [C, (UC + UH) / 2, 1.3], [R, WING / 2, 1.18]];
  const order = [[1, 2, 0, 3], [1, 2, 0, 3], [1, 2, 0, 3]];
  let ai = 0;
  for (let ti = 0; ti < 3; ti++) {
    const t = TIERS[ti], ph = t.h - 0.6;
    for (const si of order[ti]) { const [pl, u, w] = slots[si]; painting(pl, APOSTLE_ORDER[ai++], u, t.v0 + 0.38, w, ph); }
  }
  // the predella's panels: the four Doctors, in eared frames
  const docs = [['agustin', L, -WING / 2], ['ambrosio', C, -(UC + UH) / 2], ['jeronimo', C, (UC + UH) / 2], ['gregorio', R, WING / 2]];
  for (const [kind, pl, u] of docs) {
    const w = 0.78, h = 0.78;
    mesh(pl, new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: paintingTexture(kind, { w: 256, h: 256, seed: 3 }), roughness: 0.55 }), u, 1.43, 0.02);
    const fr = new THREE.Shape(); fr.moveTo(-w / 2 - 0.12, -h / 2 - 0.1); fr.lineTo(w / 2 + 0.12, -h / 2 - 0.1); fr.lineTo(w / 2 + 0.12, h / 2 + 0.02); fr.lineTo(w / 2 + 0.18, h / 2 + 0.02); fr.lineTo(w / 2 + 0.18, h / 2 + 0.12); fr.lineTo(-w / 2 - 0.18, h / 2 + 0.12); fr.lineTo(-w / 2 - 0.18, h / 2 + 0.02); fr.lineTo(-w / 2 - 0.12, h / 2 + 0.02); fr.closePath();
    const hole = new THREE.Path(); hole.moveTo(-w / 2, -h / 2); hole.lineTo(-w / 2, h / 2); hole.lineTo(w / 2, h / 2); hole.lineTo(w / 2, -h / 2); hole.closePath(); fr.holes.push(hole);
    put(pl, k.goldPlain, new THREE.ExtrudeGeometry(fr, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }), u, 1.43, 0.0);
  }
  // the middle street. Bottom: the tabernacle in the predella, the exhibitor in its niche
  {
    const v = 0.8;
    box(C, k.goldPlain, 1.1, 1.2, 0.62, 0, v, 0.31);
    box(C, k.gold, 0.8, 0.86, 0.04, 0, v + 0.17, 0.64);
    { const cp = new THREE.LatheGeometry([[0.001, 0], [0.09, 0.01], [0.04, 0.05], [0.025, 0.18], [0.06, 0.2], [0.12, 0.36], [0.001, 0.36]].map(([a, b]) => new THREE.Vector2(a, b)), 12); put(C, k.silver, cp, 0, v + 0.35, 0.68); } // a chalice on its door
    box(C, k.goldPlain, 1.24, 0.1, 0.7, 0, v + 1.2, 0.33);
    const t = TIERS[0], nw = 1.62, nh = t.h - 0.42;
    nicheAt(C, 0, t.v0 + 0.25, nw, nh, velvet, false);
    // the exhibitor: a round little temple of six columns under a dome, in silver
    const ev = t.v0 + 0.25, ew = -0.04;
    put(C, k.silver, new THREE.CylinderGeometry(0.32, 0.34, 0.16, 20), 0, ev + 0.08, ew);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; put(C, k.silver, new THREE.CylinderGeometry(0.026, 0.03, 0.95, 8), Math.cos(a) * 0.25, ev + 0.63, ew + Math.sin(a) * 0.25); }
    put(C, k.silver, new THREE.CylinderGeometry(0.32, 0.3, 0.09, 20), 0, ev + 1.15, ew);
    put(C, k.silver, new THREE.SphereGeometry(0.29, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, ev + 1.2, ew);
    put(C, k.goldPlain, new THREE.CylinderGeometry(0.045, 0.06, 0.16, 8), 0, ev + 1.56, ew);
    put(C, k.goldPlain, new THREE.BoxGeometry(0.025, 0.2, 0.025), 0, ev + 1.72, ew); put(C, k.goldPlain, new THREE.BoxGeometry(0.12, 0.025, 0.025), 0, ev + 1.76, ew);
    // the monstrance-sun inside it, gold rays round a white disc
    for (let i = 0; i < 16; i++) { const ray = new THREE.BoxGeometry(0.014, 0.14 + (i % 2) * 0.06, 0.012); ray.translate(0, 0.1, 0); ray.rotateZ((i / 16) * Math.PI * 2); put(C, k.goldPlain, ray, 0, ev + 0.68, ew); }
    put(C, k.white, new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16).rotateX(Math.PI / 2), 0, ev + 0.68, ew + 0.01);
  }
  // middle: the Virgin in her niche, with a shell at its head, the sunburst behind her
  {
    const t = TIERS[1], nw = 1.55, nh = t.h - 0.3, v = t.v0 + 0.12;
    nicheAt(C, 0, v, nw, nh, blue, true);
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, L2 = 0.42 + (i % 2) * 0.16, ray = new THREE.BoxGeometry(0.035, L2, 0.012); ray.translate(0, 0.36 + L2 / 2, 0); ray.rotateZ(a); put(C, k.goldPlain, ray, 0, v + 1.6, -0.3); }
    const [sx, sy, sz] = toChurch(C, 0, v + 0.08, -0.02);
    statue(B, 'virgen', sx, sy, sz, C.theta, 1.85, k);
  }
  // top: the Crucifixion, in an eared frame
  {
    const t = TIERS[2], w = 2.0, h = t.h - 0.5, v = t.v0 + 0.25;
    mesh(C, new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), new THREE.MeshStandardMaterial({ map: paintingTexture('crucifixion', { w: 384, h: 352, seed: 2 }), roughness: 0.55 }), 0, v, 0.04);
    const fr = new THREE.Shape(), ow = w / 2 + 0.14;
    fr.moveTo(-ow, -0.12); fr.lineTo(ow, -0.12); fr.lineTo(ow, h - 0.2); fr.lineTo(ow + 0.1, h - 0.2); fr.lineTo(ow + 0.1, h + 0.14); fr.lineTo(-ow - 0.1, h + 0.14); fr.lineTo(-ow - 0.1, h - 0.2); fr.lineTo(-ow, h - 0.2); fr.closePath();
    const hole = new THREE.Path(); hole.moveTo(-w / 2, 0); hole.lineTo(-w / 2, h); hole.lineTo(w / 2, h); hole.lineTo(w / 2, 0); hole.closePath(); fr.holes.push(hole);
    put(C, k.goldPlain, new THREE.ExtrudeGeometry(fr, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }), 0, v, 0.0);
    cherub(C, 0, v + h + 0.2, 0.08, 1.4);
  }
  // the attic over the middle street: the dove in a glory of rays, scrolls either side, the broken pediment, the cross
  {
    const v = RETABLO.top - 0.02, aw = 2.3, ah = 1.7;
    box(C, k.gold, aw, ah, 0.12, 0, v, -0.02);
    for (const sx of [-1, 1]) { box(C, k.goldPlain, 0.2, ah, 0.3, sx * (aw / 2 - 0.1), v, 0.14); }
    { const disc = new THREE.CircleGeometry(0.55, 28); mesh(C, disc, new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd88a, emissiveIntensity: 0.5, roughness: 0.4 }), 0, v + ah * 0.52, 0.06); }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, L2 = 0.3 + (i % 2) * 0.18, ray = new THREE.BoxGeometry(0.03, L2, 0.02); ray.translate(0, 0.55 + L2 / 2, 0); ray.rotateZ(a); put(C, k.goldPlain, ray, 0, v + ah * 0.52, 0.07); }
    { const dove = new THREE.SphereGeometry(0.12, 12, 8); dove.scale(1.4, 0.7, 0.6); put(C, k.white, dove, 0, v + ah * 0.52, 0.14); for (const sx of [-1, 1]) { const wg = new THREE.SphereGeometry(0.2, 10, 6); wg.scale(1, 0.32, 0.18); wg.rotateZ(sx * 0.35); put(C, k.white, wg, sx * 0.2, v + ah * 0.52 + 0.06, 0.12); } }
    // the scrolls down to the inner streets' cornice
    for (const sx of [-1, 1]) { const sc = new THREE.TorusGeometry(0.38, 0.09, 8, 16, Math.PI * 1.3); sc.rotateZ(sx > 0 ? -0.15 : Math.PI + 0.15); put(C, k.goldPlain, sc, sx * (aw / 2 + 0.38), v + 0.42, 0.1); finial(C, sx * (UC + 0.1), v, 0.35, 0.9); }
    // the broken pediment: two curved halves that stop short of the middle, the cross on a globe between them
    for (const sx of [-1, 1]) { const ar = new THREE.TorusGeometry(aw * 0.5, 0.09, 6, 16, Math.PI * 0.32); ar.rotateZ(sx > 0 ? Math.PI * 0.1 : Math.PI * 0.58); put(C, k.goldPlain, ar, 0, v + ah - 0.55, 0.12); }
    box(C, k.goldPlain, aw + 0.3, 0.12, 0.42, 0, v + ah, 0.12);
    put(C, k.goldPlain, new THREE.SphereGeometry(0.16, 14, 10), 0, v + ah + 0.3, 0.12);
    box(C, k.goldPlain, 0.06, 0.62, 0.06, 0, v + ah + 0.42, 0.12); box(C, k.goldPlain, 0.34, 0.06, 0.06, 0, v + ah + 0.86, 0.12);
  }
  // crests over the other streets: a small curved pediment and a flaming urn; pinnacles on the outer columns
  for (const [pl, u] of [[C, -(UC + UH) / 2], [C, (UC + UH) / 2], [L, -WING / 2], [R, WING / 2]]) {
    const ar = new THREE.TorusGeometry(0.55, 0.07, 6, 14, Math.PI); put(pl, k.goldPlain, ar, u, RETABLO.top, 0.12);
    finial(pl, u, RETABLO.top, 0.12, 0.85);
  }
  for (const [pl, u] of [[C, -UH], [C, UH], [L, -WING], [R, WING]]) { put(pl, k.goldPlain, new THREE.BoxGeometry(0.32, 0.22, 0.32), u, RETABLO.top + 0.11, 0.4); const py = new THREE.ConeGeometry(0.15, 0.6, 4); py.rotateY(Math.PI / 4); put(pl, k.gold, py, u, RETABLO.top + 0.52, 0.4); put(pl, k.goldPlain, new THREE.SphereGeometry(0.07, 8, 6), u, RETABLO.top + 0.86, 0.4); }
  return { extras, planes: { C, L, R }, toChurch };
}

// the blue of the Virgin's niche, sown with gilded stars
let _stars = null;
function starsTexture() {
  if (_stars) return _stars;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), r = mulberry32(12);
  const g = x.createRadialGradient(S / 2, S * 0.4, 10, S / 2, S / 2, S * 0.7); g.addColorStop(0, '#2c4c9a'); g.addColorStop(1, '#121e48');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 46; i++) { const cx = r() * S, cy = r() * S, rr = 2 + r() * 3; x.fillStyle = `rgba(240,200,110,${0.6 + r() * 0.4})`; x.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2, q = k % 2 ? rr * 0.42 : rr; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (_stars = t);
}

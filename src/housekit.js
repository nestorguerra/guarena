// Shared kit for the enterable houses: geometry helpers (UVs in metres), canvas pictures and rugs, the materials and
// the HouseBuilder (merged meshes per material, wall segments for the collider, lights, interactables, door leaves).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { StaticCollider } from './collision.js';
import { loadTexture } from './assets.js';
import { mulberry32 } from './util.js';

export const INTERIOR_ORIGIN = { x: -5200, z: -5200 };
export const WALL_H = 2.95; // storey height
export const T = 0.14; // wall thickness

// ---------------------------------------------------------------- geometry helpers (UVs in metres / texture size)
export function boxGeo(w, h, d, tex = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tex, uv.getY(i) * dims[f][1] / tex); }
  return g;
}
export function planeGeo(w, h, tex = 1) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tex, uv.getY(i) * h / tex);
  return g;
}
export function cylGeo(rt, rb, h, seg = 14) { return new THREE.CylinderGeometry(rt, rb, h, seg); }

// canvas pictures for the walls: a Virgin, a landscape of the Vegas, family photos, a calendar
export function pictureTexture(kind, seed) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 160;
  const x = c.getContext('2d');
  const r = mulberry32(seed);
  if (kind === 'virgen') {
    x.fillStyle = '#2a1d4a'; x.fillRect(0, 0, 128, 160);
    const g = x.createRadialGradient(64, 60, 5, 64, 60, 70); g.addColorStop(0, '#ffe7a0'); g.addColorStop(1, 'rgba(255,220,120,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 160);
    x.fillStyle = '#e9eef8'; x.beginPath(); x.moveTo(64, 40); x.quadraticCurveTo(100, 150, 64, 150); x.quadraticCurveTo(28, 150, 64, 40); x.fill();
    x.fillStyle = '#3b5aa8'; x.beginPath(); x.moveTo(64, 52); x.quadraticCurveTo(98, 150, 64, 152); x.quadraticCurveTo(30, 150, 64, 52); x.fill();
    x.fillStyle = '#f0d0b0'; x.beginPath(); x.arc(64, 46, 10, 0, Math.PI * 2); x.fill();
  } else if (kind === 'paisaje') {
    const sky = x.createLinearGradient(0, 0, 0, 90); sky.addColorStop(0, '#6fa3d8'); sky.addColorStop(1, '#f2d9a8');
    x.fillStyle = sky; x.fillRect(0, 0, 128, 90);
    x.fillStyle = '#c9a94e'; x.fillRect(0, 90, 128, 70);
    x.fillStyle = '#6d7f3a'; for (let i = 0; i < 18; i++) { x.beginPath(); x.arc(r() * 128, 95 + r() * 60, 4 + r() * 5, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#f7f3e8'; x.fillRect(80, 70, 30, 22); x.fillStyle = '#b5552e'; x.fillRect(78, 64, 34, 8);
  } else if (kind === 'foto') {
    x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, 128, 160);
    x.fillStyle = '#6d6154'; x.fillRect(10, 10, 108, 140);
    for (let i = 0; i < 3; i++) {
      const px = 28 + i * 36;
      x.fillStyle = '#d8c8b0'; x.beginPath(); x.arc(px, 62, 11, 0, Math.PI * 2); x.fill();
      x.fillStyle = ['#2d2d2d', '#54483c', '#3c3530'][i]; x.fillRect(px - 14, 74, 28, 60);
    }
  } else if (kind === 'calendario') {
    x.fillStyle = '#fbfaf6'; x.fillRect(0, 0, 128, 160);
    x.fillStyle = '#b8302a'; x.fillRect(0, 0, 128, 26);
    x.fillStyle = '#fff'; x.font = 'bold 16px sans-serif'; x.fillText('AGOSTO', 30, 19);
    x.fillStyle = '#333'; x.font = '11px sans-serif';
    for (let i = 0; i < 31; i++) x.fillText(String(i + 1), 8 + (i % 7) * 17, 44 + Math.floor(i / 7) * 22);
  } else { // espejo / oscuro
    x.fillStyle = '#1b1b20'; x.fillRect(0, 0, 128, 160);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function rugTexture(seed) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const r = mulberry32(seed);
  const cols = [['#7a1f24', '#d8b36a', '#1f3552'], ['#1f4a3a', '#e0c890', '#6a2a1a'], ['#3b2a50', '#c8a060', '#8a2a2a']][Math.floor(r() * 3)];
  x.fillStyle = cols[0]; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = cols[1]; x.lineWidth = 6; x.strokeRect(8, 8, 112, 112);
  x.strokeStyle = cols[2]; x.lineWidth = 3; x.strokeRect(18, 18, 92, 92);
  x.fillStyle = cols[1]; x.beginPath(); x.moveTo(64, 30); x.lineTo(98, 64); x.lineTo(64, 98); x.lineTo(30, 64); x.closePath(); x.fill();
  x.fillStyle = cols[2]; x.beginPath(); x.arc(64, 64, 12, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- the house builder
export class HouseBuilder {
  constructor(ox, oz, horror) {
    this.ox = ox; this.oz = oz; this.horror = horror;
    this.parts = new Map(); // material key -> [geometries]
    this.mats = new Map();
    this.extra = [];        // meshes that keep their own material (pictures, TV screen, lamps)
    this.segs = [];         // collider segments [ax, az, bx, bz, h]
    this.inter = [];        // interactables
    this.lights = [];
    this.spots = {};
    this.doorLeaves = [];   // hinged interior doors (horror slams them)
    this.views = [];        // openings onto the outside (windows, balcony, the patio's sky): the street shows there
  }
  // an opening onto the outside, as a box in house coordinates; side 'f' looks out at the street, 'b' out of the back
  view(side, x0, y0, z0, x1, y1, z1) {
    this.views.push({ side, box: new THREE.Box3(new THREE.Vector3(this.ox + Math.min(x0, x1), Math.min(y0, y1), this.oz + Math.min(z0, z1)), new THREE.Vector3(this.ox + Math.max(x0, x1), Math.max(y0, y1), this.oz + Math.max(z0, z1))) });
  }
  // an interior door leaf hinged at (x, z), running along (dx, dz) when shut, opened by `open` rad (sign picks the side)
  doorLeaf(matKey, knobKey, x, z, dx, dz, openSign, open, w = 0.86) {
    const pivot = new THREE.Group();
    pivot.position.set(this.ox + x, 0, this.oz + z);
    const base = Math.atan2(dx, dz);
    const leaf = new THREE.Mesh(boxGeo(0.04, 2.06, w, 1.2), this.mats.get(matKey));
    leaf.position.set(0, 1.03, w / 2);
    leaf.castShadow = true; leaf.receiveShadow = true;
    pivot.add(leaf);
    // raised panels on both faces and the knob
    for (const sx of [-1, 1]) for (const [py, ph] of [[0.55, 0.75], [1.45, 0.75]]) {
      const pan = new THREE.Mesh(boxGeo(0.012, ph, w * 0.66, 1), this.mats.get(matKey));
      pan.position.set(sx * 0.026, py, w / 2);
      pivot.add(pan);
    }
    for (const sx of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), this.mats.get(knobKey)); k.position.set(sx * 0.05, 1.0, w - 0.08); pivot.add(k); }
    const d = { pivot, base, sign: openSign, cur: open, target: open, rest: open, speed: 3 };
    pivot.rotation.y = base + openSign * open;
    this.extra.push(pivot);
    this.doorLeaves.push(d);
    return d;
  }
  mat(key, make) {
    if (!this.mats.has(key)) this.mats.set(key, make());
    return key;
  }
  add(key, geo, x, y, z, ry = 0) {
    geo.rotateY(ry);
    geo.translate(this.ox + x, y, this.oz + z);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(geo);
  }
  // wall along x or z with optional openings [from, to, bottom, top] measured along the wall
  wall(key, ax, az, bx, bz, h = WALL_H, holes = [], y0 = 0, collide = true) {
    const L = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / L, uz = (bz - az) / L;
    const ry = Math.atan2(-uz, ux);
    const cuts = holes.map((o) => ({ a: o[0], b: o[1], y0: o[2] ?? 0, y1: o[3] ?? 2.1 })).sort((p, q) => p.a - q.a);
    let s = 0;
    const piece = (s0, s1, yb, yt) => {
      if (s1 - s0 < 0.01 || yt - yb < 0.01) return;
      const g = boxGeo(s1 - s0, yt - yb, T, 1.6);
      const m = (s0 + s1) / 2;
      this.add(key, g, ax + ux * m, y0 + (yb + yt) / 2, az + uz * m, ry);
    };
    for (const c of cuts) {
      piece(s, c.a, 0, h);
      piece(c.a, c.b, 0, c.y0);   // below a window
      piece(c.a, c.b, c.y1, h);   // lintel
      if (collide && c.y0 < 0.9) { /* passable opening */ } else if (collide) this.segs.push([this.ox + ax + ux * c.a, this.oz + az + uz * c.a, this.ox + ax + ux * c.b, this.oz + az + uz * c.b, h]);
      if (collide) this.segs.push([this.ox + ax + ux * s, this.oz + az + uz * s, this.ox + ax + ux * c.a, this.oz + az + uz * c.a, h]);
      s = c.b;
    }
    piece(s, L, 0, h);
    if (collide) this.segs.push([this.ox + ax + ux * s, this.oz + az + uz * s, this.ox + bx, this.oz + bz, h]);
  }
  // solid furniture block with a collider footprint
  block(key, w, h, d, x, y, z, ry = 0, tex = 1, collide = true) {
    this.add(key, boxGeo(w, h, d, tex), x, y + h / 2, z, ry);
    if (collide && y < 0.6) this.footprint(w, d, x, z, ry, Math.max(h, 0.5));
  }
  footprint(w, d, x, z, ry, h = 1) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const P = (a, b) => [this.ox + x + a * c + b * s, this.oz + z - a * s + b * c];
    const q = [P(-w / 2, -d / 2), P(w / 2, -d / 2), P(w / 2, d / 2), P(-w / 2, d / 2)];
    for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; this.segs.push([a[0], a[1], b[0], b[1], h]); }
  }
  extraMesh(mesh, x, y, z, ry = 0) {
    mesh.position.set(this.ox + x, y, this.oz + z);
    mesh.rotation.y = ry;
    this.extra.push(mesh);
    return mesh;
  }
  light(x, y, z, color = 0xffd9a0, intensity = 7, dist = 8) {
    const l = new THREE.PointLight(color, intensity, dist, 1.6);
    l.position.set(this.ox + x, y, this.oz + z);
    l.userData.base = intensity;
    this.lights.push(l);
    // lamp shade
    const shade = new THREE.Mesh(cylGeo(0.12, 0.26, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0xf2eadc, emissive: 0xffe0a0, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
    shade.position.set(this.ox + x, y + 0.1, this.oz + z);
    shade.userData.lamp = true;
    this.extra.push(shade);
    return l;
  }
  interact(o) { o.x += this.ox; o.z += this.oz; if (o.hx !== undefined) { o.hx += this.ox; o.hz += this.oz; } this.inter.push(o); return o; }

  finish() {
    const group = new THREE.Group();
    for (const [key, geos] of this.parts) {
      const g = mergeGeometries(geos, false);
      const m = new THREE.Mesh(g, this.mats.get(key));
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
    }
    for (const e of this.extra) group.add(e);
    for (const l of this.lights) group.add(l);
    const xs = this.segs.flatMap((s) => [s[0], s[2]]), zs = this.segs.flatMap((s) => [s[1], s[3]]);
    const col = new StaticCollider(Math.min(...xs) - 10, Math.min(...zs) - 10, Math.max(...xs) + 10, Math.max(...zs) + 10, 2);
    for (const s of this.segs) col.addSegment(s[0], s[1], s[2], s[3], s[4]);
    col.build();
    return { group, collider: col, lights: this.lights, inter: this.inter, spots: this.spots, doors: this.doorLeaves, views: this.views };
  }
}

// window glass: nearly clear (the street is drawn behind it). Dark, so the lamps of the room do not light it up
// like a sheet of paper; it only gives back reflections
export function glassMat() {
  return new THREE.MeshStandardMaterial({ color: 0x141c22, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false });
}

// materials (textures are CC0 Poly Haven scans; everything falls back to flat colours)
export function std(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts }); }
export function texMat(name, color = 0xffffff, rough = 0.85, extra = {}) {
  return new THREE.MeshStandardMaterial({ map: loadTexture(name, '_d'), color, roughness: rough, metalness: 0, ...extra });
}


export function ringSegs(cx, cz, r, h, n = 10) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    out.push([cx + Math.cos(a0) * r, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, cz + Math.sin(a1) * r, h]);
  }
  return out;
}


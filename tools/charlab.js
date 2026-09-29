// Dev-only character lab: rebuild a character with the charbuild.js on disk (fresh import, no cache) and render
// face / body / profile close-ups in an open spot.
//   const L = await import('/tools/charlab.js?' + Date.now()); await L.lab([presetIndex…], { tag: 'a' });
import * as THREE from 'three';

const G = () => window.game;
export const SPOT = { x: -346.5, z: 49.4 };
// shared across re-imports of this module, so a new lab run always clears the previous characters
const placed = window.__labPlaced || (window.__labPlaced = []);

export async function build(desc, extra = {}) {
  const g = G();
  const CB = await import('/src/charbuild.js?x=' + Date.now() + Math.random());
  const B = CB.charBuilderMain();
  const spec = g.chars.spec(desc);
  Object.assign(spec, extra);
  spec.key = spec.key + '|lab' + Date.now() + Math.random();
  const t0 = performance.now();
  const r = B.build(spec);
  const ms = performance.now() - t0;
  const shape = g.chars.makeShape(r);
  g.chars.shapes.set(spec.key, shape);
  // a character whose spec resolves to this freshly built shape
  const origSpec = g.chars.spec.bind(g.chars);
  g.chars.spec = () => spec;
  const ch = g.chars.create(desc);
  g.chars.spec = origSpec;
  return { ch, ms: Math.round(ms), tris: r.lods.map((l) => l.index.length / 3), times: r.times };
}

export async function lab(indices, opts = {}) {
  const g = G();
  const C = await import('/src/characters.js');
  for (const c of placed) { g.scene.remove(c.object); c.dispose(); }
  placed.length = 0;
  const out = [];
  const list = indices.map((i) => (typeof i === 'number' ? C.PLAYER_PRESETS[i] : i));
  for (let k = 0; k < list.length; k++) {
    const r = await build({ ...list[k], hq: opts.hq ?? true }, opts.extra || {});
    const ch = r.ch;
    const x = SPOT.x - (list.length - 1) + k * 2;
    ch.object.position.set(x, 0, SPOT.z);
    g.scene.add(ch.object);
    placed.push(ch);
    out.push({ name: list[k].name || k, ms: r.ms, tris: r.tris });
  }
  g.player.spawnAt(SPOT.x, SPOT.z + 3, Math.PI);
  if (opts.hour != null) { g.sky.hour = opts.hour; g.sky.update(0, new THREE.Vector3(SPOT.x, 0, SPOT.z), true); }
  for (let f = 0; f < 40; f++) for (const c of placed) c.update(1 / 30, 0, {});
  const force = () => { for (const c of placed) c.setDistance(1, true); };
  const tag = opts.tag || '';
  for (let k = 0; k < placed.length; k++) {
    const x = SPOT.x - (list.length - 1) + k * 2;
    const hy = 1.58 * placed[k].scale;
    force(); await window.snapCam(`lab_face${k}${tag}`, [x + 0.04, hy + 0.02, SPOT.z + 0.55], [x, hy, SPOT.z], 30, 512, 512);
    if (opts.profile) { force(); await window.snapCam(`lab_prof${k}${tag}`, [x + 0.55, hy + 0.02, SPOT.z + 0.05], [x, hy, SPOT.z + 0.02], 30, 512, 512); }
    if (opts.body) { force(); await window.snapCam(`lab_body${k}${tag}`, [x + 0.25, 1.0, SPOT.z + 2.7], [x, 0.9, SPOT.z], 42, 512, 768); }
  }
  return out;
}
export function characters() { return placed; }

// pose sheet: [[presetIndex, fidgetName | {speed, t}], ...] → one full-body snapshot each (uses cached shapes, no rebuild)
export async function poses(list, opts = {}) {
  const g = G();
  const C = await import('/src/characters.js');
  for (const c of placed) { g.scene.remove(c.object); c.dispose(); }
  placed.length = 0;
  if (opts.hour != null) { g.sky.hour = opts.hour; g.sky.update(0, new THREE.Vector3(SPOT.x, 0, SPOT.z), true); }
  g.player.spawnAt(SPOT.x, SPOT.z + 6, Math.PI);
  const made = [];
  for (let k = 0; k < list.length; k++) {
    const [pi, what] = list[k];
    const desc = typeof pi === 'number' ? C.PLAYER_PRESETS[pi] : pi;
    const ch = g.chars.create(desc);
    await g.chars.whenReady(desc);
    const x = SPOT.x - (list.length - 1) * 0.9 + k * 1.8;
    ch.object.position.set(x, 0, SPOT.z);
    ch.object.rotation.y = opts.yaw ?? 0;
    g.scene.add(ch.object);
    placed.push(ch);
    made.push({ ch, x, what });
  }
  // run each through its pose for a while (fixed steps)
  for (let f = 0; f < (opts.frames || 60); f++) for (const m of made) {
    const w = m.what;
    if (typeof w === 'string') m.ch.update(1 / 30, 0, { forceFidget: w });
    else m.ch.update(1 / 30, w.speed || 0, { grounded: w.grounded !== false, vy: w.vy || 0, turn: w.turn || 0 });
  }
  const tag = opts.tag || '';
  for (let k = 0; k < made.length; k++) {
    const m = made[k];
    m.ch.setDistance(1, true);
    const yaw = opts.camYaw ?? 0.35;
    await window.snapCam(`pose${k}${tag}`, [m.x + Math.sin(yaw) * 2.6, 1.05, SPOT.z + Math.cos(yaw) * 2.6], [m.x, 0.92, SPOT.z], 40, 420, 640);
  }
  return made.length;
}

// Dev-only: the same views of Guareña in every look of the last pass (toon.js LOOKS) → .snaps/lk_<look>_<view>.jpg
//   const K = await import('/tools/lookshots.js?' + Date.now()); await K.shoot(K.views(), { looks: ['manga', 'tierra'] })
import * as THREE from 'three';
import { LOOKS } from '/src/toon.js';
const G = () => window.game;
async function post(name) { const c = G().renderer.domElement; const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; o.getContext('2d').drawImage(c, 0, 0, c.width, c.height, 0, 0, c.width, c.height); await fetch('/__snap?name=' + name, { method: 'POST', body: o.toDataURL('image/jpeg', 0.86) }); }
// a few places that say Guareña: the plaza and its fountain, a whitewashed street, Santa María's tower, the fields
export function views() {
  const g = G(), L = g.world.landmarks, P = L.poi, map = g.map;
  const out = [];
  out.push(['plaza', [-50, 2.0, 52], [-25, 6, 22], 60, 17.5]);           // the Ayuntamiento, the fountain
  const e = map.edges.filter((q) => q.name === 'Calle Derecha').sort((a, b) => b.len - a.len)[0];
  if (e) { const p = map.sample(e, 70, {}); out.push(['calle', [p.x - p.dx * 8, 1.7, p.z - p.dz * 8], [p.x + p.dx * 20, 2.6, p.z + p.dz * 20], 64, 10.5]); }
  const t = P.churchTower || { x: -180.5, z: -38.1 };
  out.push(['iglesia', [t.x + 52, 2.2, t.z + 5], [t.x, 13, t.z], 60, 18.6]);  // Santa María from the east, at dusk
  out.push(['campo', [-1250, 2.0, -1560], [-1600, 3, -2150], 62, 12]);
  return out;
}
export async function shoot(vs = views(), { looks = LOOKS.map((l) => l.id), W = 1200, H = 750 } = {}) {
  const g = G();
  if (g.interior) g.interiors.leave();
  const keepR = g.render; g.render = () => {};
  g.renderer.setSize(W, H, false); if (g.toon) g.toon.setSize(W, H);
  const cam = new THREE.PerspectiveCamera(60, W / H, 0.1, 2500);
  const keepLook = g.toon.look, out = [];
  try {
    for (const [name, e, t, fov, hour] of vs) {
      g.sky.hour = hour;
      g.player.pos.set(e[0] + 2, 0, e[2] + 2);
      for (let i = 0; i < 4; i++) { g.state = 'play'; g.frame(1 / 30); }
      g.player.pos.set(e[0] + 60, 0, e[2] + 60); g.state = 'play'; g.frame(1 / 30);
      cam.fov = fov; cam.position.set(e[0], e[1], e[2]); cam.lookAt(t[0], t[1], t[2]); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      g.sky.hour = hour; g.sky.update(0, cam.position, true);
      for (const look of looks) {
        g.toon.setLook(look);
        const keep = g.camera; g.camera = cam;
        try { g.renderView(cam); } finally { g.camera = keep; }
        await post(`lk_${look}_${name}`);
        out.push(`lk_${look}_${name}`);
      }
    }
  } finally { g.toon.setLook(keepLook); g.render = keepR; g.resize(); }
  return out;
}

// Dev-only: renders of the gun models and of the player holding them.
//   const GT = await import('/tools/guntest.js'); await GT.studio(['pistola']); await GT.held('rifle', true);
import * as THREE from 'three';
import { buildGun } from '/src/gunmodels.js';

const G = () => window.game;
export async function studio(ids = ['pistola', 'subfusil', 'escopeta', 'rifle', 'bate'], tag = '') {
  const g = G(), p = g.player.pos, base = new THREE.Vector3(p.x, 60, p.z), out = [];
  const dists = { pistola: 0.42, subfusil: 0.95, escopeta: 1.6, rifle: 1.75, bate: 1.3 };
  for (const id of ids) {
    const m = buildGun(id); m.position.copy(base); g.scene.add(m); m.updateMatrixWorld(true);
    const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()), d = dists[id] || 1;
    out.push(await window.snapCam(`gm_${id}${tag}_r`, [c.x - d, c.y + d * 0.12, c.z - d * 0.08], [c.x, c.y, c.z], 40));
    out.push(await window.snapCam(`gm_${id}${tag}_l`, [c.x + d * 0.7, c.y + d * 0.35, c.z + d * 0.45], [c.x, c.y, c.z], 40));
    g.scene.remove(m);
  }
  return out;
}
// the player with a gun: raised (aiming) or lowered; three views
export async function held(id, raised = true, tag = '') {
  const g = G(), T = window.__T, W = g.weapons, pl = g.player;
  W.give(id, 30); W.select(id);
  window.bot.aim = raised;
  await T.sim(0.8);
  const f = pl.heading, fx = Math.sin(f), fz = Math.cos(f), rx = -fz, rz = fx;
  const P = pl.pos, h = 1.35;
  const n = `hold_${id}_${raised ? 'up' : 'low'}${tag}`;
  await window.snapCam(n + '_side', [P.x + rx * 1.6 + fx * 0.3, h + 0.1, P.z + rz * 1.6 + fz * 0.3], [P.x + fx * 0.3, h - 0.1, P.z + fz * 0.3], 45);
  await window.snapCam(n + '_front', [P.x + fx * 2.2 - rx * 0.5, h + 0.2, P.z + fz * 2.2 - rz * 0.5], [P.x, h - 0.1, P.z], 45);
  await window.snapCam(n + '_back', [P.x - fx * 1.4 + rx * 0.7, 1.75, P.z - fz * 1.4 + rz * 0.7], [P.x + fx * 1.5, 1.3, P.z + fz * 1.5], 50);
  window.bot.aim = false;
  return n;
}

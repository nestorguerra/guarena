// Dev-only: the hero (src/hero.js) next to the player: built through the factory, walked and run by its motion
// capture, photographed in strips. Nothing of the game's own player is touched.
//   const T = await import('/tools/herotest.js?' + Date.now()); await T.make(); await T.strip(1.4, 'w')
import * as THREE from 'three';
import { PLAYER_PRESETS } from '/src/characters.js';
import { shot, renderInto, SPOT } from '/tools/herolab.js';
const G = () => window.game;
let H = null;
const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
export async function make(desc = {}) {
  const g = G();
  if (H) { g.scene.remove(H.object); H.dispose(); H = null; }
  const d = { ...PLAYER_PRESETS[0], hero: true, ...desc };
  H = g.chars.create(d);
  let t = 0;
  while (!H.ready && t++ < 600) await tick();
  H.object.position.set(SPOT.x, 0, SPOT.z);
  g.scene.add(H.object);
  window.__hero = H;
  return { ready: H.ready, cls: H.constructor.name, bones: H.boneList.length, nv: H.heroGeos && H.heroGeos.map((g) => g.attributes.position.count), expr: H.exprNames && H.exprNames.length, found: H.exprFound };
}
// stand, then walk/run straight at speed v for a few seconds; a strip of n frames over the last stretch
export async function strip(v, tag, { n = 8, secs = 3, view = 'side', W = 300, Hh = 520, turn = 0 } = {}) {
  const g = G(), dt = 1 / 30;
  g.sky.update(0, new THREE.Vector3(SPOT.x, 0, SPOT.z), true);
  let x = SPOT.x, z = SPOT.z, yaw = 0;
  H.object.rotation.set(0, 0, 0);
  for (let i = 0; i < 30; i++) { H.update(dt, 0, { grounded: true }); }
  const steps = Math.round(secs / dt), every = Math.max(1, Math.floor(steps / n));
  const cv = document.createElement('canvas'); cv.width = W * n; cv.height = Hh;
  const ctx = cv.getContext('2d');
  let k = 0;
  for (let i = 0; i < steps; i++) {
    yaw += turn * dt;
    x += Math.sin(yaw) * v * dt; z += Math.cos(yaw) * v * dt;
    H.object.position.set(x, 0, z); H.object.rotation.set(0, yaw, 0);
    H.update(dt, v, { grounded: true, turn: turn * 0.3 });
    if (i >= steps - n * every && (steps - 1 - i) % every === 0 && k < n) {
      H.object.updateMatrixWorld(true);
      const cam = view === 'side' ? [x + 3.4, 0.95, z] : view === 'front' ? [x, 0.95, z + 3.4] : [x, 0.95, z - 3.4];
      await shot('ht_tmp', cam, [x, 0.9, z], 36, W, Hh);
      ctx.drawImage(g.renderer.domElement, 0, 0, g.renderer.domElement.width, g.renderer.domElement.height, k * W, 0, W, Hh);
      k++;
    }
  }
  g.resize();
  await fetch('/__snap?name=ht_' + tag, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.85) });
  return { frame: H.mp && H.mp.frame, clip: H.mp && HDclip(H) };
}
function HDclip(h) { const db = h.mp.db; return db.raw.clips[db.clipOf[h.mp.frame]].name; }
export async function portrait(tag = 'p') {
  const g = G();
  H.object.position.set(SPOT.x, 0, SPOT.z); H.object.rotation.set(0, 0, 0);
  for (let i = 0; i < 40; i++) H.update(1 / 30, 0, { grounded: true });
  H.object.updateMatrixWorld(true);
  const hp = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  H.bones.eyeL.getWorldPosition(e1); H.bones.eyeR.getWorldPosition(e2); hp.copy(e1).add(e2).multiplyScalar(0.5);
  await shot(`ht_${tag}_body`, [SPOT.x + 0.5, 1.0, SPOT.z + 2.7], [SPOT.x, 0.9, SPOT.z], 40, 480, 760);
  await shot(`ht_${tag}_face`, [hp.x + 0.16, hp.y + 0.01, hp.z + 0.5], [hp.x, hp.y - 0.03, hp.z], 26, 600, 600);
  await shot(`ht_${tag}_prof`, [hp.x + 0.52, hp.y + 0.01, hp.z - 0.04], [hp.x, hp.y - 0.03, hp.z - 0.04], 26, 600, 600);
  await shot(`ht_${tag}_back`, [SPOT.x - 0.6, 1.0, SPOT.z - 2.7], [SPOT.x, 0.9, SPOT.z], 40, 480, 760);
  g.resize();
  return 'ok';
}

// every expression unit at full strength on the face (front), one sheet
export async function faces(tag = 'a', names = null, k = 1) {
  const g = G();
  H.object.position.set(SPOT.x, 0, SPOT.z); H.object.rotation.set(0, 0, 0);
  for (let i = 0; i < 40; i++) H.update(1 / 30, 0, { grounded: true });
  const list = names || H.exprNames, W = 260, Hh = 300, cols = 6;
  const cv = document.createElement('canvas'); cv.width = cols * W; cv.height = Math.ceil((list.length + 1) / cols) * (Hh + 20);
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  const inf = H.headMesh.morphTargetInfluences;
  const all = ['(neutro)', ...list];
  for (let j = 0; j < all.length; j++) {
    inf.fill(0);
    const i = H.exprNames.indexOf(all[j]); if (i >= 0) inf[i] = k;
    H.object.updateMatrixWorld(true);
    const hp = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    H.bones.eyeL.getWorldPosition(e1); H.bones.eyeR.getWorldPosition(e2); hp.copy(e1).add(e2).multiplyScalar(0.5);
    const x = (j % cols) * W, y = Math.floor(j / cols) * (Hh + 20);
    renderInto(ctx, x, y + 20, [hp.x, hp.y - 0.01, hp.z + 0.42], [hp.x, hp.y - 0.035, hp.z], 24, W, Hh);
    ctx.fillStyle = '#000'; ctx.font = '13px sans-serif'; ctx.fillText(all[j], x + 6, y + 14);
  }
  inf.fill(0);
  g.resize();
  await fetch('/__snap?name=hf_' + tag, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.85) });
  return all.length;
}

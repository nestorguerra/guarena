// Dev-only: the hero's feet and shoulders, close — the player walked by a scripted stick, pictures of the trainers at
// ground level through a stride (side and front), the shoulders from the front and the back, and measures: how wide
// the shoulders are (skinned, with the clothes), how the planted foot sits on the ground (sole pitch, toe bend).
//   const F = await import('/tools/herofeet.js?' + Date.now()); await F.look('a')
import * as THREE from 'three';
import { renderInto } from '/tools/herolab.js';
const G = () => window.game;
const OPEN = { x: -346.5, z: 49.4 };
const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
const _v = new THREE.Vector3();

// skinned width of the body (with its clothes) across a height band, in the character's own frame
export function width(ch, y0, y1) {
  const m = ch.meshes[0], pos = m.geometry.attributes.position, inv = new THREE.Matrix4().copy(ch.object.matrixWorld).invert();
  let lo = 1e9, hi = -1e9;
  m.updateMatrixWorld(true); m.skeleton.update();
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i); m.applyBoneTransform(i, _v); _v.applyMatrix4(m.matrixWorld).applyMatrix4(inv);
    if (_v.y < y0 || _v.y > y1) continue;
    lo = Math.min(lo, _v.x); hi = Math.max(hi, _v.x);
  }
  return +(hi - lo).toFixed(3);
}

export async function look(tag = 'a', { speed = 1, frames = 8, every = 3 } = {}) {
  const g = G(), p = g.player, ch = p.char, dt = 1 / 30;
  p.spawnAt(OPEN.x, OPEN.z, 0); p.mode = 'foot';
  g.sky.update(0, new THREE.Vector3(OPEN.x, 0, OPEN.z), true);
  const W = 260, H = 200, cv = document.createElement('canvas');
  cv.width = W * frames; cv.height = H * 2 + 330 * 1 + 40;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  const out = {};
  // stand a moment: the shoulders' width at rest
  for (let i = 0; i < 30; i++) { p.update(dt, { moveX: 0, moveY: 0 }, 0); if (i % 15 === 0) await tick(); }
  ch.object.updateMatrixWorld(true);
  out.shoulderWidthIdle = width(ch, 1.32, 1.46);
  out.chestWidthIdle = width(ch, 1.18, 1.28);
  // walk until it is under way
  for (let i = 0; i < 45; i++) { p.update(dt, { moveX: 0, moveY: speed }, 0); if (i % 15 === 0) await tick(); }
  // a stride, the feet from the side (row 1) and from the front-left (row 2)
  const pitches = [];
  for (let k = 0; k < frames; k++) {
    for (let i = 0; i < every; i++) p.update(dt, { moveX: 0, moveY: speed }, 0);
    ch.object.updateMatrixWorld(true);
    const x = p.pos.x, z = p.pos.z;
    renderInto(ctx, k * W, 0, [x + 1.15, 0.22, z + 0.05], [x, 0.12, z + 0.05], 34, W, H);
    renderInto(ctx, k * W, H, [x + 0.55, 0.35, z + 1.1], [x, 0.1, z + 0.1], 34, W, H);
    // the sole's pitch of each foot (the foot bone's forward axis against the ground), and the toe bend
    const f = {};
    for (const s of ['L', 'R']) {
      const q = ch.bones['foot' + s].getWorldQuaternion(new THREE.Quaternion());
      const fw = _v.set(0, 0, 1).applyQuaternion(q);
      f[s] = { pitch: +(Math.asin(Math.max(-1, Math.min(1, fw.y))) * 57.3).toFixed(0), toe: +(2 * Math.acos(Math.min(1, Math.abs(ch.bones['toe' + s].quaternion.w))) * 57.3).toFixed(0), on: s === 'L' ? ch.mp.contactL : ch.mp.contactR };
    }
    pitches.push(f);
  }
  // the shoulders while walking, front and back (row 3)
  ch.object.updateMatrixWorld(true);
  const x = p.pos.x, z = p.pos.z;
  renderInto(ctx, 0, H * 2 + 20, [x, 1.45, z + 2.2], [x, 1.2, z], 34, 330, 330);
  renderInto(ctx, 340, H * 2 + 20, [x, 1.5, z - 2.2], [x, 1.2, z], 34, 330, 330);
  renderInto(ctx, 680, H * 2 + 20, [x + 2.2, 1.45, z + 0.2], [x, 1.2, z], 34, 330, 330);
  out.shoulderWidthWalk = width(ch, 1.32, 1.46);
  g.resize();
  await fetch('/__snap?name=hf2_' + tag, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.85) });
  out.feet = pitches;
  return out;
}

// the trainers close, standing: outer side, front, three-quarter from above, back, from above, inner side
// → .snaps/hf2_close_<tag>.jpg
export async function close(tag = 'a') {
  const g = G(), p = g.player, ch = p.char, dt = 1 / 30;
  p.spawnAt(OPEN.x, OPEN.z, 0); p.mode = 'foot';
  for (let i = 0; i < 40; i++) p.update(dt, { moveX: 0, moveY: 0 }, 0);
  ch.object.updateMatrixWorld(true);
  const fw = new THREE.Vector3(0, 0, 1).applyQuaternion(ch.object.getWorldQuaternion(new THREE.Quaternion()));
  const fx = fw.x, fz = fw.z, sx = fz, sz = -fx;
  const foot = ch.bones.footL.getWorldPosition(new THREE.Vector3());
  const c = [foot.x + fx * 0.07, 0.05, foot.z + fz * 0.07];
  const W = 420, H = 320, cv = document.createElement('canvas'); cv.width = W * 3; cv.height = H * 2;
  const ctx = cv.getContext('2d');
  const views = [
    [c[0] + sx * 0.55, 0.12, c[2] + sz * 0.55],
    [c[0] + fx * 0.6, 0.2, c[2] + fz * 0.6],
    [c[0] + fx * 0.35 + sx * 0.35, 0.3, c[2] + fz * 0.35 + sz * 0.35],
    [c[0] - fx * 0.55, 0.15, c[2] - fz * 0.55],
    [c[0] + sx * 0.45 - fx * 0.1, 0.45, c[2] + sz * 0.45 - fz * 0.1],
    [c[0] - sx * 0.55, 0.12, c[2] - sz * 0.55],
  ];
  views.forEach((v, i) => renderInto(ctx, (i % 3) * W, Math.floor(i / 3) * H, v, c, 30, W, H));
  g.resize();
  await fetch('/__snap?name=hf2_close_' + tag, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.9) });
}

// the shoulders standing: front, back, side and the play camera's view from behind → .snaps/hs_<tag>.jpg
export async function torso(tag = 'a') {
  const g = G(), p = g.player, ch = p.char, dt = 1 / 30;
  p.spawnAt(OPEN.x, OPEN.z, 0); p.mode = 'foot';
  for (let i = 0; i < 60; i++) p.update(dt, { moveX: 0, moveY: 0 }, 0);
  ch.object.updateMatrixWorld(true);
  const x = p.pos.x, z = p.pos.z, W = 360, H = 420, cv = document.createElement('canvas');
  cv.width = W * 4; cv.height = H;
  const ctx = cv.getContext('2d'), c = [x, 1.25, z];
  renderInto(ctx, 0, 0, [x, 1.35, z + 1.6], c, 30, W, H);
  renderInto(ctx, W, 0, [x, 1.4, z - 1.6], c, 30, W, H);
  renderInto(ctx, W * 2, 0, [x + 1.6, 1.35, z + 0.05], c, 30, W, H);
  renderInto(ctx, W * 3, 0, [x + 0.6, 2.1, z - 2.6], [x, 1.2, z], 45, W, H);
  g.resize();
  await fetch('/__snap?name=hs_' + tag, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.9) });
  return { shoulders: width(ch, 1.32, 1.46), chest: width(ch, 1.18, 1.28) };
}

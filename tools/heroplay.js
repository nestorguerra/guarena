// Dev-only: the player (the hero) driven by a scripted stick — walk, turn, reverse, run, stop — through the game's own
// controller (player.update), with the camera behind like in play. Records what the motion matching chose, the feet
// on the ground (how far a planted foot slides) and film strips.
//   const P = await import('/tools/heroplay.js?' + Date.now()); await P.run('basic')
import * as THREE from 'three';
import { shot } from '/tools/herolab.js';
const G = () => window.game;
export const OPEN = { x: -346.5, z: 49.4 };
const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
// script: [[seconds, {moveX, moveY, sprint}, camYaw]]
export const SCRIPTS = {
  basic: [[1, {}], [2.5, { moveY: 1 }], [1.6, { moveX: 1 }], [1.6, { moveY: -1 }], [1.2, {}], [3, { moveY: 1, sprint: 1 }], [1.5, {}]],
  turns: [[0.8, {}], [1.5, { moveY: 1 }], [0.8, { moveX: -1 }], [0.8, { moveY: 1 }], [0.8, { moveX: 1 }], [1.2, { moveY: -1 }], [1, {}]],
};
export async function run(name = 'basic', { strips = true, dt = 1 / 30, every = 4 } = {}) {
  const g = G(), p = g.player;
  const script = SCRIPTS[name] || name;
  p.spawnAt(OPEN.x, OPEN.z, 0);
  p.mode = 'foot';
  g.sky.update(0, new THREE.Vector3(OPEN.x, 0, OPEN.z), true);
  const ch = p.char, log = [];
  const W = 240, H = 340, cv = document.createElement('canvas');
  const frames = [];
  let t = 0, k = 0;
  const toes = { L: new THREE.Vector3(), R: new THREE.Vector3() }, prev = { L: null, R: null };
  let slide = { L: 0, R: 0, n: 0 };
  for (const [secs, inp, cam] of script) {
    const n = Math.round(secs / dt);
    for (let i = 0; i < n; i++, k++) {
      const input = { moveX: inp.moveX || 0, moveY: inp.moveY || 0, sprint: !!inp.sprint };
      p.update(dt, input, cam ?? 0);
      t += dt;
      ch.object.updateMatrixWorld(true);
      // planted feet: how far the ball of the foot moves while the capture says it is down
      const mp = ch.mp;
      for (const s of ['L', 'R']) {
        ch.bones['toe' + s].getWorldPosition(toes[s]);
        const on = mp && (s === 'L' ? mp.contactL : mp.contactR);
        if (on && prev[s]) { slide[s] += Math.hypot(toes[s].x - prev[s].x, toes[s].z - prev[s].z); }
        prev[s] = on ? toes[s].clone() : null;
      }
      slide.n++;
      if (mp && k % 3 === 0) log.push(`${t.toFixed(1)} v=${Math.hypot(p.vel.x, p.vel.z).toFixed(2)} h=${(p.heading * 57.3).toFixed(0)} ${mp.db.raw.clips[mp.db.clipOf[mp.frame]].name}@${mp.frame - mp.db.raw.clips[mp.db.clipOf[mp.frame]].start}`);
      if (strips && k % every === 0) frames.push({ x: p.pos.x, z: p.pos.z, h: p.heading, k });
      if (strips && k % every === 0) {
        // the game's camera: behind and above
        const bx = p.pos.x - Math.sin(p.heading) * 0.0, bz = p.pos.z;
        await shot('hp_tmp', [bx + 3.2, 1.5, bz + 1.2], [p.pos.x, 0.95, p.pos.z], 40, W, H);
        frames[frames.length - 1].img = await createImageBitmap(g.renderer.domElement);
      }
      if (k % 30 === 0) await tick();
    }
  }
  g.resize();
  if (strips) {
    const cols = 12, rows = Math.ceil(frames.length / cols);
    cv.width = cols * W; cv.height = rows * H;
    const ctx = cv.getContext('2d');
    frames.forEach((f, i) => { ctx.drawImage(f.img, (i % cols) * W, Math.floor(i / cols) * H, W, H); ctx.fillStyle = '#000'; ctx.font = '14px sans-serif'; ctx.fillText((f.k * dt).toFixed(1), (i % cols) * W + 6, Math.floor(i / cols) * H + 16); });
    await fetch('/__snap?name=hp_' + name, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.8) });
  }
  return { slidePerFrame: { L: +(slide.L / slide.n).toFixed(4), R: +(slide.R / slide.n).toFixed(4) }, log: log.join('\n') };
}

// Dev-only: does the foot on the ground stay put? Walks a character in a straight line at each speed and measures how
// fast the heel / ball of the foot in contact moves over the ground (0 = planted; + skates forward, − slips back).
//   const K = await import('/tools/gaitcheck.js?' + Date.now()); K.skate(0, [1, 1.4, 2.6, 5, 7])
import * as THREE from 'three';
import { PLAYER_PRESETS } from '/src/characters.js';

export function skate(desc, speeds, opts = {}) {
  const G = window.game;
  const ch = G.chars.create(typeof desc === 'number' ? PLAYER_PRESETS[desc] : desc);
  const out = [];
  const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
  const dt = opts.dt || 1 / 120, md = opts.moveDir || 0;
  for (const v of speeds) {
    ch.object.position.set(0, 0, 0); ch.object.rotation.set(0, 0, 0);
    let z = 0, x = 0, h = 0;
    // (turnRate: walking round a circle, the heading turning as it goes)
    const step = () => {
      ch.update(dt, v, { moveDir: md, crouch: opts.crouch });
      h += (opts.turnRate || 0) * dt;
      z += v * Math.cos(h + md) * dt; x += v * Math.sin(h + md) * dt; ch.object.position.set(x, 0, z); ch.object.rotation.set(0, h, 0); ch.object.updateMatrixWorld(true);
    };
    for (let i = 0; i < 240; i++) step();
    const rec = { L: [], R: [] };
    for (let i = 0; i < 600; i++) {
      step();
      for (const s of ['L', 'R']) {
        // the same heel and ball points on the sole that the foot locking holds
        const foot = ch.bones['foot' + s];
        foot.getWorldPosition(wp); foot.getWorldQuaternion(wq);
        const heel = new THREE.Vector3(...ch.heelOff).applyQuaternion(wq).add(wp);
        const ball = new THREE.Vector3(...ch.ballOff).applyQuaternion(wq).add(wp);
        rec[s].push({ heel, ball });
      }
    }
    const res = { v };
    for (const s of ['L', 'R']) {
      const r = rec[s];
      const minY = Math.min(...r.map((f) => Math.min(f.heel.y, f.ball.y)));
      let slide = 0, n = 0, worst = 0;
      for (let i = 1; i < r.length; i++) {
        const a = r[i - 1], b = r[i], pa = a.heel.y < a.ball.y ? 'heel' : 'ball';
        if (b[pa].y < 0.01 && a[pa].y < 0.01) {
          // along the direction of travel
          const d = (opts.turnRate ? Math.hypot(b[pa].z - a[pa].z, b[pa].x - a[pa].x) : (b[pa].z - a[pa].z) * Math.cos(md) + (b[pa].x - a[pa].x) * Math.sin(md)) / dt;
          slide += d; n++; worst = Math.max(worst, Math.abs(d));
        }
      }
      res[s] = { contact: +(n / r.length).toFixed(2), slide: +(slide / Math.max(1, n)).toFixed(2), worst: +worst.toFixed(2), minY: +minY.toFixed(3) };
    }
    res.S = +(ch.tr ?? 0).toFixed(2); res.drop = +(ch.strideDrop || 0).toFixed(3);
    out.push(res);
  }
  ch.dispose();
  return out;
}

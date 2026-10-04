// Critically damped springs and inertialization — the small maths under natural-feeling motion (after Daniel Holden,
// «Spring-It-On: The Game Developer's Spring-Roll-Call», theorangeduck.com, and David Bollo, «Inertialization:
// High-Performance Animation Transitions in Gears of War», GDC 2018).
//
// A critically damped spring reaches its goal as fast as it can without overshooting; its stiffness is given as a
// half-life (seconds for the gap to halve). The same maths predicts where a character steered by one will be in a
// moment (the future trajectory motion matching searches with), and fades out the jump between two animations
// (inertialization: the new pose plays at once, the difference to the old one decays like a spring).
import * as THREE from 'three';

const LN2 = Math.log(2);
export const halfLifeToDamping = (h) => (4 * LN2) / (h + 1e-5);
function fastNegExp(x) { return 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x); }

// a scalar spring towards goal g with velocity v (state {x, v}), critically damped; returns the state
export function springDamper(s, g, halfLife, dt) {
  const y = halfLifeToDamping(halfLife) / 2, j0 = s.x - g, j1 = s.v + j0 * y, e = fastNegExp(y * dt);
  s.x = e * (j0 + j1 * dt) + g;
  s.v = e * (s.v - j1 * y * dt);
  return s;
}

// the character's own movement: velocity v chases the wanted velocity vg (2D, x/z) with half-life h; the position x
// follows. Writes x and v in place (arrays [x, z]) and returns the acceleration-ish term for leaning
export function springCharacter(x, v, a, vg, h, dt) {
  const y = halfLifeToDamping(h) / 2, e = fastNegExp(y * dt);
  for (let k = 0; k < 2; k++) {
    const j0 = v[k] - vg[k], j1 = a[k] + j0 * y;
    x[k] = e * (((-j1) / (y * y)) + ((-j0 - j1 * dt) / y)) + (j1 / (y * y)) + j0 / y + vg[k] * dt + x[k];
    v[k] = e * (j0 + j1 * dt) + vg[k];
    a[k] = e * (a[k] - j1 * y * dt);
  }
}

// where it will be after t seconds if it keeps asking for vg (closed form of the spring above, from x, v, a now)
export function predictPos(out, x, v, a, vg, h, t) {
  const y = halfLifeToDamping(h) / 2, e = fastNegExp(y * t);
  for (let k = 0; k < 2; k++) {
    const j0 = v[k] - vg[k], j1 = a[k] + j0 * y;
    out[k] = e * (((-j1) / (y * y)) + ((-j0 - j1 * t) / y)) + (j1 / (y * y)) + j0 / y + vg[k] * t + x[k];
  }
  return out;
}

// an angle (facing) chasing a goal angle the same way; state {x, v}
export function springAngle(s, g, halfLife, dt) {
  let d = s.x - g; d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
  const y = halfLifeToDamping(halfLife) / 2, j1 = s.v + d * y, e = fastNegExp(y * dt);
  s.x = g + e * (d + j1 * dt);
  s.v = e * (s.v - j1 * y * dt);
  return s;
}
export function predictAngle(x, v, g, halfLife, t) {
  let d = x - g; d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
  const y = halfLifeToDamping(halfLife) / 2, j1 = v + d * y, e = fastNegExp(y * t);
  return g + e * (d + j1 * t);
}

// ---------------------------------------------------------------- inertialization of a pose
// Per bone: when the source animation changes, the offset between the pose shown so far and the new one is kept and
// decays to nothing (a critically damped spring on a rotation vector, and on the hips' position), so the switch is
// never seen as a jump and keeps the motion's speed through it.
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _v3 = new THREE.Vector3();
export function quatToVec(q, out) {
  // rotation vector (axis × angle) of a unit quaternion, shortest way round
  let w = q.w, x = q.x, y = q.y, z = q.z;
  if (w < 0) { w = -w; x = -x; y = -y; z = -z; }
  const n = Math.hypot(x, y, z);
  if (n < 1e-9) return out.set(2 * x, 2 * y, 2 * z);
  const ang = 2 * Math.atan2(n, w);
  return out.set((x / n) * ang, (y / n) * ang, (z / n) * ang);
}
export function vecToQuat(v, out) {
  const ang = v.length();
  if (ang < 1e-9) return out.set(v.x * 0.5, v.y * 0.5, v.z * 0.5, 1).normalize();
  const s = Math.sin(ang / 2) / ang;
  return out.set(v.x * s, v.y * s, v.z * s, Math.cos(ang / 2));
}

export class Inertializer {
  constructor(n) {
    this.n = n;
    this.offR = Array.from({ length: n }, () => new THREE.Vector3()); // rotation offset (rotation vector)
    this.velR = Array.from({ length: n }, () => new THREE.Vector3()); // its rate
    this.offP = new THREE.Vector3(); this.velP = new THREE.Vector3(); // the hips' position offset
    this.prevQ = Array.from({ length: n }, () => new THREE.Quaternion()); // what was shown last frame
    this.prevP = new THREE.Vector3();
    this.prevQ2 = Array.from({ length: n }, () => new THREE.Quaternion()); // and the frame before (for its speed)
    this.prevP2 = new THREE.Vector3();
    this.halfLife = 0.12;
    this.primed = false;
  }
  // the source jumps from pose (srcQ, srcP) that was playing to (dstQ, dstP): keep what was shown, and its speed
  transition(dstQ, dstP, dt) {
    if (!this.primed) return;
    for (let i = 0; i < this.n; i++) {
      // offset = shown ⊖ new; velocity of the shown pose from the last two frames
      _qa.copy(dstQ[i]).invert().premultiply(this.prevQ[i]);
      quatToVec(_qa, this.offR[i]);
      _qb.copy(this.prevQ2[i]).invert().premultiply(this.prevQ[i]);
      quatToVec(_qb, this.velR[i]).multiplyScalar(1 / Math.max(dt, 1e-3));
      // (the new animation's own speed is not subtracted: cheap and good enough at these frame rates)
    }
    this.offP.copy(this.prevP).sub(dstP);
    this.velP.copy(this.prevP).sub(this.prevP2).multiplyScalar(1 / Math.max(dt, 1e-3));
  }
  // decay the offsets and apply them to the pose about to be shown (in place)
  apply(Q, P, dt) {
    const y = halfLifeToDamping(this.halfLife) / 2, e = fastNegExp(y * dt);
    for (let i = 0; i < this.n; i++) {
      const o = this.offR[i], v = this.velR[i];
      // j1 = v + o*y; o' = e*(o + j1*dt); v' = e*(v - j1*y*dt)
      _v3.copy(o).multiplyScalar(y).add(v);
      o.multiplyScalar(e).addScaledVector(_v3, e * dt);
      v.multiplyScalar(e).addScaledVector(_v3, -e * y * dt);
      if (o.lengthSq() > 1e-10) Q[i].premultiply(vecToQuat(o, _qa));
      this.prevQ2[i].copy(this.prevQ[i]); this.prevQ[i].copy(Q[i]);
    }
    _v3.copy(this.offP).multiplyScalar(y).add(this.velP);
    this.offP.multiplyScalar(e).addScaledVector(_v3, e * dt);
    this.velP.multiplyScalar(e).addScaledVector(_v3, -e * y * dt);
    P.add(this.offP);
    this.prevP2.copy(this.prevP); this.prevP.copy(P);
    this.primed = true;
  }
}

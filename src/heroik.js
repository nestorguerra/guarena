// Feet on the ground: foot locking and leg IK for an animated body (the hero's motion capture). While the capture says
// a foot is on the ground, that foot stays where it landed in the world (no skating, whatever small mismatch there is
// between the animation's speed and the body's), sits on the ground under it (kerbs, steps, slopes), and the leg is
// re-solved to reach it, the knee kept in the plane it was animated in. When the foot lifts it eases back into the
// animation. The hips come down if a leg cannot reach.
import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();

// Two-bone IK in world space: hip joint H, knee K, ankle A (current, animated), goal T. Returns the rotations to apply
// (world-space deltas) to the upper and lower bones so the ankle reaches T, the knee staying on the side it was on.
export function solveTwoBone(H, K, A, T, outUpper, outLower) {
  const l1 = _a.subVectors(K, H).length(), l2 = _b.subVectors(A, K).length();
  const dHT = _c.subVectors(T, H);
  const d = Math.min(Math.max(dHT.length(), Math.abs(l1 - l2) + 1e-4), (l1 + l2) * 0.9995);
  // current angles
  const cur = _d.subVectors(A, H).length();
  const kneeNow = Math.acos(THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - cur * cur) / (2 * l1 * l2), -1, 1));
  const kneeWant = Math.acos(THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  // bend the knee about the axis normal to the leg's plane
  const ax = _e.crossVectors(_a.subVectors(K, H), _b.subVectors(A, K));
  if (ax.lengthSq() < 1e-10) ax.crossVectors(_a.subVectors(K, H), _b.set(1, 0, 0)); // (a straight leg: any sideways axis)
  ax.normalize();
  outLower.setFromAxisAngle(ax, kneeNow - kneeWant);
  // the ankle after bending, then turn the whole leg from it to the goal
  const A2 = _b.subVectors(A, K).applyQuaternion(outLower).add(K);
  outUpper.setFromUnitVectors(_c.subVectors(A2, H).normalize(), _d.subVectors(T, H).normalize());
  return d;
}

// per-foot lock state
export class FootLock {
  constructor() { this.on = false; this.w = 0; this.pos = new THREE.Vector3(); this.blendOut = 0; this.from = new THREE.Vector3(); }
}

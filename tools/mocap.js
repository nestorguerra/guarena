// Dev-only: motion capture in the Acclaim format of the CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu:
// a skeleton .asf per subject, a motion .amc per take) — parse, forward kinematics, and retargeting onto a skeleton
// in the game's convention (each bone's rest frame lined up with the body, +x its left, +y up, +z ahead; with every
// rotation at identity it stands straight with the arms hanging down).
//
// Acclaim: a bone's world rotation is W = W_parent · C · M · C⁻¹ (C from its 'axis', M from the frame's dof angles,
// both as Rz·Ry·Rx), and its end lies 'length' along W · 'direction' from where its parent ends. CMU units: 1 = 1/0.45
// inch. Rest pose (all angles zero): a T-pose facing +z, its left at +x.
//
// Retargeting by world rotations: S0 is the source's rest with each mapped bone turned the least it takes to point
// the way the target's bone points at the target's rest; then a target bone's world rotation is S(t)·S0⁻¹ (the
// target's rest being identity) and its local rotation its parent's inverse times that.
import * as THREE from 'three';

export const CMU_UNIT = (1 / 0.45) * 0.0254; // metres

export function parseASF(text) {
  const bones = { root: { name: 'root', dir: [0, 0, 0], len: 0, axis: [0, 0, 0], dof: ['tx', 'ty', 'tz', 'rx', 'ry', 'rz'], children: [], parent: null } };
  const lines = text.split(/\r?\n/);
  let sec = '', cur = null;
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    if (l.startsWith(':')) { sec = l.split(/\s+/)[0]; continue; }
    const p = l.split(/\s+/);
    if (sec === ':root') {
      if (p[0] === 'axis') bones.root.axisOrder = p[1];
    } else if (sec === ':bonedata') {
      if (p[0] === 'begin') cur = { dir: [0, 0, 0], len: 0, axis: [0, 0, 0], dof: [], children: [], parent: null };
      else if (p[0] === 'end') { bones[cur.name] = cur; cur = null; }
      else if (p[0] === 'name') cur.name = p[1];
      else if (p[0] === 'direction') cur.dir = p.slice(1, 4).map(Number);
      else if (p[0] === 'length') cur.len = +p[1];
      else if (p[0] === 'axis') cur.axis = p.slice(1, 4).map(Number);
      else if (p[0] === 'dof') cur.dof = p.slice(1);
    } else if (sec === ':hierarchy') {
      if (p[0] === 'begin' || p[0] === 'end') continue;
      for (const c of p.slice(1)) { bones[p[0]].children.push(c); bones[c].parent = p[0]; }
    }
  }
  // depth-first order, parents first
  const order = [];
  const visit = (n) => { order.push(n); for (const c of bones[n].children) visit(c); };
  visit('root');
  // C and C⁻¹ per bone
  const e = new THREE.Euler();
  for (const n of order) {
    const b = bones[n];
    b.C = rzyx(b.axis[0], b.axis[1], b.axis[2], new THREE.Quaternion());
    b.Ci = b.C.clone().invert();
    b.dirV = new THREE.Vector3(...b.dir);
  }
  return { bones, order };
}
const _qx = new THREE.Quaternion(), _qy = new THREE.Quaternion(), _qz = new THREE.Quaternion();
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
// Rz·Ry·Rx from degrees
function rzyx(x, y, z, out) {
  const d = Math.PI / 180;
  _qx.setFromAxisAngle(AX, x * d); _qy.setFromAxisAngle(AY, y * d); _qz.setFromAxisAngle(AZ, z * d);
  return out.copy(_qz).multiply(_qy).multiply(_qx);
}

export function parseAMC(text, asf) {
  const frames = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith(':') || l.startsWith('#')) continue;
    const p = l.split(/\s+/);
    if (/^\d+$/.test(p[0]) && p.length === 1) { cur = {}; frames.push(cur); continue; }
    if (cur) cur[p[0]] = p.slice(1).map(Number);
  }
  return frames;
}

// world rotations (Quaternion per bone) and end positions (Vector3, metres) for one frame
export function fkAMC(asf, fr, out = null) {
  const { bones, order } = asf;
  const W = out || { q: {}, p: {} };
  const M = new THREE.Quaternion(), t = new THREE.Quaternion(), v = new THREE.Vector3();
  for (const n of order) {
    const b = bones[n], val = fr[n] || [];
    let rx = 0, ry = 0, rz = 0, tx = 0, ty = 0, tz = 0;
    b.dof.forEach((d, i) => { const x = val[i] || 0; if (d === 'rx') rx = x; else if (d === 'ry') ry = x; else if (d === 'rz') rz = x; else if (d === 'tx') tx = x; else if (d === 'ty') ty = x; else if (d === 'tz') tz = x; });
    rzyx(rx, ry, rz, M);
    const q = W.q[n] || (W.q[n] = new THREE.Quaternion()), p = W.p[n] || (W.p[n] = new THREE.Vector3());
    // W = W_parent · C · M · C⁻¹
    t.copy(b.C).multiply(M).multiply(b.Ci);
    if (n === 'root') { q.copy(t); p.set(tx, ty, tz).multiplyScalar(CMU_UNIT); }
    else {
      q.copy(W.q[b.parent]).multiply(t);
      // the bone's end: from where the parent ends, along its direction turned by its own world rotation
      v.copy(b.dirV).multiplyScalar(b.len * CMU_UNIT);
      // (direction is given in the world frame at rest: turn it by the bone's world rotation from rest)
      v.applyQuaternion(q);
      p.copy(W.p[b.parent]).add(v);
    }
  }
  return W;
}

// where each source bone starts and ends at rest (all angles zero), metres
export function restAMC(asf) {
  const W = fkAMC(asf, {});
  return W;
}

// map: [{ t: target bone, s: source bone (its rotation), from: source joint where the target bone starts ('root' or a
// bone name: its end), to: source joint where it points, tdir: Vector3 target rest direction }] parents first.
// Returns per entry S0 (world rotations of the matched rest)
export function matchRest(asf, map) {
  const R = restAMC(asf);
  return map.map((e) => {
    if (!e.to) return new THREE.Quaternion(); // (the hips: the rest is already upright and facing ahead)
    const d = R.p[e.to].clone().sub(R.p[e.from]).normalize();
    return new THREE.Quaternion().setFromUnitVectors(d, e.tdir);
  });
}

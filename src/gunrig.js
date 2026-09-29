// How the player's character holds a gun: the weapon is placed in the character's frame — at the shoulder (long
// guns) or at arm's length in front of the eyes (pistol) while aiming, at low ready otherwise — following the camera
// pitch, with recoil kick; then both arms are solved with a two-bone IK so the hands sit on the grip and on the
// fore-end, the wrists turn the palms onto the gun and the fingers close around it.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0), AX = new THREE.Vector3(1, 0, 0);
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const V = () => new THREE.Vector3();
const _mb = new THREE.Matrix4();
function basisQ(x, y, z, out) { _mb.makeBasis(x, y, z); return out.setFromRotationMatrix(_mb); }

// scratch for update()
const mRootInv = new THREE.Matrix4(), G = new THREE.Matrix4();
const gX = V(), gY = V(), gZ = V(), gP = V(), aHi = V(), aLo = V(), sh = V(), dLo = V(), grip = V(), wR = V(), wL = V(), tipL = V(), palmL = V(), rest = V();
// scratch for solveArm()
const sW = V(), sT = V(), sU = V(), sN = V(), sE = V(), sWc = V(), sD1 = V(), sD2 = V(), sX1 = V(), sY1 = V(), sZ1 = V(), sH = V(), sXh = V(), sYh = V(), sZh = V();
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qF = new THREE.Quaternion(), qH = new THREE.Quaternion(), qHl = new THREE.Quaternion();

export class GunRig {
  constructor() {
    this.ready = 0;   // 0 low ready … 1 aiming
    this.kick = 0;    // recoil
    this.mChest = new THREE.Matrix4();
    this.mChestInv = new THREE.Matrix4();
    this.mPar = { L: new THREE.Matrix4(), R: new THREE.Matrix4() }; // the frame each arm hangs from (its collarbone)
  }
  shot(k) { this.kick = Math.min(1.6, this.kick + k); }

  // ch: character; model: the gun (child of ch.object, matrixAutoUpdate off); raised: aiming or just fired;
  // pitch: camera pitch (up positive); opts.reload: 0..1 progress of a reload (dips the gun)
  update(dt, ch, model, raised, pitch, opts = {}) {
    const B = ch.bones;
    if (!B.chest || !B.armR || !B.armL) return;
    const ud = model.userData, long = !!ud.long;
    this.ready += ((raised ? 1 : 0) - this.ready) * (1 - Math.exp(-(raised ? 11 : 5) * dt));
    this.kick *= Math.exp(-dt * 13);
    const e = smooth(this.ready);
    // lean the torso with the aim; long guns: bladed stance (left shoulder forward) so the support hand reaches
    const pt = Math.max(-0.9, Math.min(0.75, pitch)) * e;
    B.spine.rotation.x -= pt * 0.22;
    B.chest.rotation.x -= pt * 0.3;
    if (long) { B.spine.rotation.y -= 0.2 * e + 0.1; B.chest.rotation.y -= 0.3 * e + 0.12; }
    else B.chest.rotation.y += 0.1 * e;
    ch.object.updateMatrixWorld(true);
    mRootInv.copy(ch.object.matrixWorld).invert();
    const mC = this.mChest.multiplyMatrices(mRootInv, B.chest.matrixWorld);
    this.mChestInv.copy(mC).invert();

    // --- where the gun goes (root frame: +z forward, +x the character's left)
    const cp = Math.cos(pitch), spn = Math.sin(pitch), inward = long ? 0.05 : 0.02;
    gZ.set(Math.sin(inward) * cp, spn, Math.cos(inward) * cp);
    if (long) {
      // butt plate in the shoulder pocket; at low ready tucked lower with the muzzle down across the body
      aHi.set(-0.125, 0.165, 0.09).applyMatrix4(mC);
      aLo.set(-0.105, 0.05, 0.14).applyMatrix4(mC);
      dLo.set(0.42, -0.6, 0.68).normalize();
    } else {
      // pistol: at arm's length in front of the right eye; lowered: in the hand by the thigh, muzzle down
      sh.setFromMatrixPosition(B.armR.matrixWorld).applyMatrix4(mRootInv);
      aHi.copy(sh).addScaledVector(gZ, 0.46); aHi.x += 0.12; aHi.y -= 0.035;
      aLo.set(-0.2, 0.93, 0.13);
      dLo.set(0.06, -0.8, 0.6).normalize();
    }
    gP.lerpVectors(aLo, aHi, e);
    gZ.lerp(dLo, 1 - e).normalize();
    gX.crossVectors(UP, gZ).normalize();
    gY.crossVectors(gZ, gX);
    // recoil: muzzle climbs, gun comes back
    if (this.kick > 0.001) {
      gZ.addScaledVector(gY, this.kick * (long ? 0.12 : 0.28)).normalize();
      gY.crossVectors(gZ, gX).normalize();
      gP.addScaledVector(gZ, -this.kick * (long ? 0.035 : 0.03));
    }
    if (opts.reload > 0) { // dip and tilt the gun while reloading
      const r = Math.sin(Math.min(1, opts.reload) * Math.PI);
      gP.y -= 0.08 * r;
      gZ.addScaledVector(gY, -0.35 * r).normalize(); gY.crossVectors(gZ, gX).normalize();
    }
    // long guns: the butt sits on the anchor
    if (long && ud.butt) gP.addScaledVector(gX, -ud.butt.x).addScaledVector(gY, -ud.butt.y).addScaledVector(gZ, -ud.butt.z);
    const sc = long ? 0.94 : 1; // a hair smaller in the hands so the short arms reach the fore-end
    if (long && ud.butt) gP.addScaledVector(gX, ud.butt.x * (1 - sc)).addScaledVector(gY, ud.butt.y * (1 - sc)).addScaledVector(gZ, ud.butt.z * (1 - sc));
    G.makeBasis(gX.clone().multiplyScalar(sc), gY.clone().multiplyScalar(sc), gZ.clone().multiplyScalar(sc)).setPosition(gP);
    model.matrix.copy(G);
    model.matrixWorldNeedsUpdate = true;

    // --- arms: shooting hand on the grip (palm on the gun's right side, facing its left)
    grip.set(0, 0, 0).applyMatrix4(G);
    wR.copy(ud.wristR).applyMatrix4(G);
    this.solveArm(B, 'R', wR, grip, gX, long ? [-1, -0.25, -0.15] : [-0.45, -1, -0.1], 1);
    // support hand: always on long guns; the pistol's comes up as it is raised
    const k = long ? 1 : smooth((e - 0.25) / 0.6);
    if (k > 0.01 && ud.wristL) {
      wL.copy(ud.wristL).applyMatrix4(G);
      if (k < 1) { rest.set(0.06, 0.02, 0.22).applyMatrix4(mC); wL.lerpVectors(rest, wL, k); }
      tipL.copy(wL).addScaledVector(gZ, 0.08).addScaledVector(gX, long ? -0.02 : -0.035);
      if (long) palmL.copy(gY).multiplyScalar(0.8).addScaledVector(gX, -0.6).normalize();
      else palmL.copy(gX).negate();
      this.solveArm(B, 'L', wL, tipL, palmL, long ? [0.35, -1, 0] : [0.5, -1, -0.1], k);
    }
    // fingers round the grip, the thumb over them
    if (B.fingR) B.fingR.rotation.set(0, 0, 1.3);
    if (B.fing2R) B.fing2R.rotation.set(0, 0, 1.45);
    if (B.thumbR) B.thumbR.rotation.set(0.1, 0.65, -0.05);
    if (B.thumb2R) B.thumb2R.rotation.set(0.35, 0, 0);
    if (B.fingL && k > 0.3) {
      const c = (long ? 1.0 : 1.25) * k;
      B.fingL.rotation.set(0, 0, -(0.3 + c * 0.8)); if (B.fing2L) B.fing2L.rotation.set(0, 0, -(0.35 + c * 0.9));
      if (B.thumbL) B.thumbL.rotation.set(0.1 * k, -0.6 * k, 0.05 * k);
    }
  }

  // two-bone IK in the chest frame. wrist, tip (where the fingers point) in the root frame; palm: root-frame
  // direction the palm should face; pole: chest-frame hint for the elbow
  solveArm(B, side, wrist, tip, palm, pole, weight) {
    const arm = B['arm' + side], fore = B['fore' + side], hand = B['hand' + side];
    if (!arm || !fore || !hand) return;
    // work in the frame of the bone the arm hangs from (the collarbone; the chest on older rigs)
    const inv = arm.parent && arm.parent !== B.chest ? this.mPar[side].multiplyMatrices(mRootInv, arm.parent.matrixWorld).invert() : this.mChestInv;
    sW.copy(wrist).applyMatrix4(inv);
    sT.copy(tip).applyMatrix4(inv);
    const S = arm.position;
    const a = fore.position.length(), b = hand.position.length();
    sU.subVectors(sW, S);
    const d = Math.max(Math.abs(a - b) + 1e-3, Math.min(a + b - 1e-3, sU.length()));
    sU.normalize();
    sN.set(pole[0], pole[1], pole[2]);
    sN.addScaledVector(sU, -sN.dot(sU)).normalize();
    const cosA = (a * a + d * d - b * b) / (2 * a * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    sE.copy(S).addScaledVector(sU, a * cosA).addScaledVector(sN, a * sinA);
    sWc.copy(S).addScaledVector(sU, d);
    sD1.subVectors(sE, S).normalize();
    sD2.subVectors(sWc, sE).normalize();
    // upper arm: local -y along the arm, local +z the side the forearm bends towards
    sY1.copy(sD1).negate();
    sZ1.copy(sD2).addScaledVector(sD1, -sD2.dot(sD1));
    if (sZ1.lengthSq() < 1e-8) sZ1.copy(sN).negate();
    sZ1.normalize();
    sX1.crossVectors(sY1, sZ1);
    basisQ(sX1, sY1, sZ1, q1);
    const phi = Math.acos(Math.max(-1, Math.min(1, sD1.dot(sD2))));
    q2.setFromAxisAngle(AX, -phi);
    qF.multiplyQuaternions(q1, q2);
    // hand: fingers towards the tip, palm facing `palm` (the right palm is bone +x, the left one bone -x)
    sH.subVectors(sT, sWc).normalize();
    sYh.copy(sH).negate();
    sXh.copy(palm).transformDirection(inv);
    if (side === 'L') sXh.negate();
    sXh.addScaledVector(sYh, -sXh.dot(sYh));
    if (sXh.lengthSq() < 1e-8) sXh.copy(sX1);
    sXh.normalize();
    sZh.crossVectors(sXh, sYh);
    basisQ(sXh, sYh, sZh, qH);
    qHl.copy(qF).invert().multiply(qH);
    if (weight >= 0.999) { arm.quaternion.copy(q1); fore.quaternion.copy(q2); hand.quaternion.copy(qHl); }
    else { arm.quaternion.slerp(q1, weight); fore.quaternion.slerp(q2, weight); hand.quaternion.slerp(qHl, weight); }
  }
}

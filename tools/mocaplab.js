// Dev-only: motion capture (CMU, .cache/cmu) retargeted onto the hero's skeleton (assets/hero/rig.json), checked on
// film strips, and packed into the hero's motion database (assets/hero/moves.bin.gz, read by src/heromotion.js).
//   const L = await import('/tools/mocaplab.js?' + Date.now()); const c = await L.clip('16_15'); await L.strip(c, 'w')
import * as THREE from 'three';
import { parseASF, parseAMC, fkAMC, matchRest, CMU_UNIT } from '/tools/mocap.js';
import { loadBody, buildBody, shot, SPOT } from '/tools/herolab.js';
const G = () => window.game;

// the hero's skeleton: zero-pose positions (all rotations identity), bind rotations, rest directions
export async function heroRig() {
  const r = await (await fetch('/assets/hero/rig.json?' + Date.now())).json();
  const B = {}, order = [];
  for (const b of r.bones) { B[b.name] = { ...b, kids: [] }; order.push(b.name); }
  for (const n of order) if (B[n].parent) B[B[n].parent].kids.push(n);
  for (const n of order) {
    const b = B[n], p = b.parent ? B[b.parent] : null;
    b.zpos = new THREE.Vector3(...b.off); if (p) b.zpos.add(p.zpos);
    b.bindW = new THREE.Quaternion(...b.rot); if (p) b.bindW.premultiply(p.bindW);
  }
  // the way each bone points at rest: to its main child, or (a tip) along its own length as modelled
  const main = { hips: 'spine', spine: 'spine2', spine2: 'chest', chest: 'neck', neck: 'head', clavL: 'armL', clavR: 'armR', armL: 'foreL', armR: 'foreR', foreL: 'handL', foreR: 'handR', handL: 'mid1L', handR: 'mid1R', thighL: 'shinL', thighR: 'shinR', shinL: 'footL', shinR: 'footR', footL: 'toeL', footR: 'toeR' };
  for (const n of order) {
    const b = B[n];
    if (main[n]) b.tdir = B[main[n]].zpos.clone().sub(b.zpos).normalize();
    else b.tdir = new THREE.Vector3(...b.tail).sub(new THREE.Vector3(...b.pos)).applyQuaternion(b.bindW.clone().invert()).normalize();
  }
  return { B, order };
}

// hero bone ← CMU bone (its world rotation drives the hero bone; from/to: the CMU joints spanning the same segment)
const MAP = [
  ['hips', 'root', null, null],
  ['spine', 'lowerback', 'root', 'lowerback'],
  ['spine2', 'upperback', 'lowerback', 'upperback'],
  ['chest', 'thorax', 'upperback', 'thorax'],
  ['neck', 'upperneck', 'thorax', 'upperneck'],
  ['head', 'head', 'upperneck', 'head'],
  ['clavL', 'lclavicle', 'thorax', 'lclavicle'], ['clavR', 'rclavicle', 'thorax', 'rclavicle'],
  ['armL', 'lhumerus', 'lclavicle', 'lhumerus'], ['armR', 'rhumerus', 'rclavicle', 'rhumerus'],
  ['foreL', 'lradius', 'lhumerus', 'lradius'], ['foreR', 'rradius', 'rhumerus', 'rradius'],
  ['handL', 'lhand', 'lradius', 'lhand'], ['handR', 'rhand', 'rradius', 'rhand'],
  ['thighL', 'lfemur', 'lhipjoint', 'lfemur'], ['thighR', 'rfemur', 'rhipjoint', 'rfemur'],
  ['shinL', 'ltibia', 'lfemur', 'ltibia'], ['shinR', 'rtibia', 'rfemur', 'rtibia'],
  ['footL', 'lfoot', 'ltibia', 'lfoot'], ['footR', 'rfoot', 'rtibia', 'rfoot'],
  ['toeL', 'ltoes', 'lfoot', 'ltoes'], ['toeR', 'rtoes', 'rfoot', 'rtoes'],
];
export const MOVE_BONES = MAP.map((m) => m[0]);

const asfCache = {};
async function text(path) { const r = await fetch(path + '?' + Date.now()); if (!r.ok) throw new Error(path); return r.text(); }

// a take, retargeted: per frame (at fps) the hero's local rotations for MOVE_BONES and the hips' position (model
// space, metres, the ground at y 0)
export async function clip(name, { fps = 30, from = 0, to = Infinity, srcFps = null } = {}) {
  const SF = srcFps || (/^(77|143)_/.test(name) ? 60 : 120); // (subjects 77 and 143 were captured at 60 frames a second — 143's
  // own page says 120, but its strides only make sense at 60 — the rest at 120)
  const subj = name.split('_')[0];
  const asf = asfCache[subj] || (asfCache[subj] = parseASF(await text(`/.cache/cmu/${subj}.asf`)));
  const amc = parseAMC(await text(`/.cache/cmu/${name}.amc`), asf);
  const rig = await heroRig();
  const map = MAP.map(([t, s, f, to2]) => ({ t, s, from: f, to: to2, tdir: rig.B[t].tdir }));
  const S0 = matchRest(asf, map), S0i = S0.map((q) => q.clone().invert());
  // scale: the hero's leg against the source's
  const sb = asf.bones;
  const srcLeg = (sb.lfemur.len + sb.ltibia.len) * CMU_UNIT, heroLeg = rig.B.shinL.zpos.distanceTo(rig.B.thighL.zpos) + rig.B.footL.zpos.distanceTo(rig.B.shinL.zpos);
  const k = heroLeg / srcLeg;
  const rest = fkAMC(asf, {});
  // the source's ground: its rest soles (the lowest of the foot and toe ends), a little under the ankles
  const floor0 = Math.min(rest.p.ltoes.y, rest.p.lfoot.y, rest.p.rtoes.y, rest.p.rfoot.y) - 0.025;
  const heroHipC = rig.B.thighL.zpos.clone().add(rig.B.thighR.zpos).multiplyScalar(0.5), heroHipsOff = rig.B.hips.zpos.clone().sub(heroHipC);
  const n0 = Math.max(0, Math.floor(from * SF)), n1 = Math.min(amc.length - 1, Math.floor(to * SF));
  const step = SF / fps;
  const frames = [];
  const W = { q: {}, p: {} }, Tw = {};
  for (let f = n0; f <= n1; f += step) {
    const i = Math.floor(f), u = f - i;
    fkAMC(asf, amc[i], W);
    const out = { q: {}, hips: new THREE.Vector3() };
    // (frames between captures: the next one blended in)
    let W2 = null;
    if (u > 1e-6 && i + 1 < amc.length) { W2 = fkAMC(asf, amc[i + 1], { q: {}, p: {} }); }
    map.forEach((m, j) => {
      const qs = W.q[m.s].clone();
      if (W2) qs.slerp(W2.q[m.s], u);
      Tw[m.t] = qs.multiply(S0i[j]);
    });
    for (const m of map) {
      const par = rig.B[m.t].parent;
      const pw = par && Tw[par] ? Tw[par] : null;
      out.q[m.t] = pw ? pw.clone().invert().multiply(Tw[m.t]) : Tw[m.t].clone();
    }
    // hips: the source's hip joints' centre, scaled, then back to where the hero's hips bone sits from them
    const hc = W.p.lhipjoint.clone().add(W.p.rhipjoint).multiplyScalar(0.5);
    if (W2) hc.lerp(W2.p.lhipjoint.clone().add(W2.p.rhipjoint).multiplyScalar(0.5), u);
    hc.y -= floor0; hc.multiplyScalar(k);
    out.hips.copy(heroHipsOff).applyQuaternion(Tw.hips).add(hc);
    frames.push(out);
  }
  // the ground: the capture's floor is not the hero's (other feet, other markers) — set the hips so that the balls of
  // the feet, when they are down, sit as high as the hero's do standing at rest
  const toeY0 = rig.B.toeL.zpos.y, lows = [];
  for (const fr of frames) { const P = fkHero(rig, fr); lows.push(Math.min(P.toeL.y, P.toeR.y)); }
  lows.sort((a, b) => a - b);
  const dy = toeY0 - lows[Math.floor(lows.length * 0.1)];
  for (const fr of frames) fr.hips.y += dy;
  return { name, fps, frames, k, rig, dy };
}

// world (model-space) positions of the hero's bones for a frame
export function fkHero(rig, fr) {
  const P = {}, Q = {};
  for (const n of rig.order) {
    const b = rig.B[n], q = fr.q[n] || new THREE.Quaternion();
    if (!b.parent) { P[n] = new THREE.Vector3(); Q[n] = q.clone(); continue; }
    const pq = Q[b.parent];
    if (n === 'hips') P[n] = fr.hips.clone();
    else P[n] = new THREE.Vector3(...b.off).applyQuaternion(pq).add(P[b.parent]);
    Q[n] = pq.clone().multiply(q);
  }
  return P;
}

// pose the lab body from a frame (its root at x, z)
export function pose(B, fr, x = 0, z = 0) {
  for (const n of MOVE_BONES) if (B.bones[n] && fr.q[n]) B.bones[n].quaternion.copy(fr.q[n]);
  // (bones the capture has nothing for: identity — the rest)
  B.bones.hips.position.copy(fr.hips);
  B.root.position.set(x, 0, z);
  B.root.updateMatrixWorld(true);
}

// a film strip of a take from the side (or the front), n frames spread over [t0, t1] s; the body walks on in the
// picture (no camera following), so foot sliding shows
export async function strip(c, tag, { n = 8, t0 = 0, t1 = null, view = 'side', W = 300, H = 520, follow = true } = {}) {
  const g = G();
  const body = await loadBody();
  const B = buildBody(body);
  for (const b of B.list) b.quaternion.identity();
  g.scene.add(B.root);
  g.sky.update(0, new THREE.Vector3(SPOT.x, 0, SPOT.z), true);
  const T1 = t1 ?? (c.frames.length - 1) / c.fps;
  const cv = document.createElement('canvas'); cv.width = W * n; cv.height = H;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < n; i++) {
    const t = t0 + ((T1 - t0) * i) / Math.max(1, n - 1), fr = c.frames[Math.min(c.frames.length - 1, Math.round(t * c.fps))];
    pose(B, fr, SPOT.x, SPOT.z);
    const hx = SPOT.x + fr.hips.x, hz = SPOT.z + fr.hips.z;
    const cx = follow ? hx : SPOT.x, cz = follow ? hz : SPOT.z;
    const camPos = view === 'side' ? [cx + 3.4, 0.95, cz] : view === 'front' ? [cx, 0.95, cz + 3.4] : [cx, 0.95, cz - 3.4];
    await shot('ml_tmp', camPos, [cx, 0.9, cz], 36, W, H);
    ctx.drawImage(g.renderer.domElement, 0, 0, g.renderer.domElement.width, g.renderer.domElement.height, i * W, 0, W, H);
  }
  g.scene.remove(B.root);
  g.resize();
  await fetch('/__snap?name=ml_' + tag, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.85) });
  return 'ml_' + tag;
}

// ---------------------------------------------------------------- the database
// the character's root under a take: on the ground under the hips, facing the way the hips face (both smoothed),
// its speed in its own frame (side, forward), its turn rate; the hips in that frame; which feet are planted
const smooth = (a, s) => { const n = a.length, out = new Float64Array(n), r = Math.ceil(s * 3); for (let i = 0; i < n; i++) { let w = 0, v = 0; for (let k = -r; k <= r; k++) { const j = Math.min(n - 1, Math.max(0, i + k)), g = Math.exp(-(k * k) / (2 * s * s)); w += g; v += a[j] * g; } out[i] = v / w; } return out; };
export function rootOf(c) {
  const n = c.frames.length, dt = 1 / c.fps;
  const X = new Float64Array(n), Z = new Float64Array(n), Y = new Float64Array(n);
  const fw = new THREE.Vector3();
  let prev = null;
  for (let i = 0; i < n; i++) {
    const fr = c.frames[i];
    X[i] = fr.hips.x; Z[i] = fr.hips.z;
    fw.set(0, 0, 1).applyQuaternion(fr.q.hips); fw.y = 0;
    let a = Math.atan2(fw.x, fw.z);
    if (prev !== null) a = prev + (((a - prev + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI; // (unwrapped)
    Y[i] = prev = a;
  }
  const xs = smooth(X, 4), zs = smooth(Z, 4), ys = smooth(Y, 5);
  const out = [];
  const qy = new THREE.Quaternion(), qyi = new THREE.Quaternion(), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const j = Math.min(n - 1, i + 1), k = i === n - 1 ? i - 1 : i;
    const vx = (xs[j] - xs[k]) / dt, vz = (zs[j] - zs[k]) / dt, yr = (ys[j] - ys[k]) / dt;
    const c0 = Math.cos(ys[i]), s0 = Math.sin(ys[i]);
    // world → root frame: forward (sin, cos), left (cos, −sin)
    const fwd = vx * s0 + vz * c0, side = vx * c0 - vz * s0;
    const hx = c.frames[i].hips.x - xs[i], hz = c.frames[i].hips.z - zs[i];
    qy.setFromAxisAngle(AY, ys[i]); qyi.copy(qy).invert();
    out.push({ fwd, side, yawRate: yr, hips: new THREE.Vector3(hx * c0 - hz * s0, c.frames[i].hips.y, hx * s0 + hz * c0), hipsQ: qyi.clone().multiply(c.frames[i].q.hips), yaw: ys[i], x: xs[i], z: zs[i] });
  }
  // feet on the ground: the ball of the foot low and still
  const P = c.frames.map((fr) => fkHero(c.rig, fr));
  for (let i = 0; i < n; i++) {
    let f = 0;
    for (const [bit, b] of [[1, 'toeL'], [2, 'toeR']]) {
      const j = Math.min(n - 1, i + 1), k = i === n - 1 ? i - 1 : i;
      const sp = Math.hypot(P[j][b].x - P[k][b].x, P[j][b].z - P[k][b].z) / dt;
      if (P[i][b].y < c.rig.B.toeL.zpos.y + 0.035 && sp < 0.6) f |= bit;
    }
    out[i].contact = f;
  }
  return out;
}
const AY = new THREE.Vector3(0, 1, 0);

// a quick look at takes: length, speeds, how much they turn
export async function survey(names) {
  const rows = [];
  for (const nm of names) {
    const c = await clip(nm);
    const r = rootOf(c), n = r.length;
    const sp = r.map((x) => Math.hypot(x.fwd, x.side));
    const turn = (r[n - 1].yaw - r[0].yaw) * 180 / Math.PI;
    rows.push(`${nm}: ${(n / c.fps).toFixed(1)}s  speed avg ${(sp.reduce((a, b) => a + b, 0) / n).toFixed(2)} max ${Math.max(...sp).toFixed(2)}  turn ${turn.toFixed(0)}°  contacts ${r.filter((x) => x.contact).length}/${n}`);
  }
  return rows;
}

// pack takes into the hero's motion database: 'HMV2' — per frame each MOVE_BONES rotation as a rotation vector (the
// hips' relative to the root's heading), the root's forward/side speed and turn rate, the hips' place in the root's
// frame, and the feet down; int16, delta-coded along each take (smooth motion: small steps that deflate well), gzipped.
// list: [[take, fromSec, toSec, tag]]
const RS = Math.PI / 8191, PS = 1 / 4000, VS = 1 / 1000; // (0.02°, 0.25 mm, 1 mm/s: well under the capture's own noise)
const toVec = (q, out) => { let { x, y, z, w } = q; if (w < 0) { x = -x; y = -y; z = -z; w = -w; } const n = Math.hypot(x, y, z); if (n < 1e-9) return out.set(2 * x, 2 * y, 2 * z); const a = 2 * Math.atan2(n, w); return out.set((x / n) * a, (y / n) * a, (z / n) * a); };
export async function buildDB(list, { save = 'hero_moves' } = {}) {
  const takes = [];
  for (const [name, from, to, tag, opt] of list) {
    const subj = name.split('_')[0];
    const c = await clip(name, opt === 'loop' ? {} : { from: from || 0, to: to ?? Infinity });
    const r = rootOf(c);
    if (opt === 'loop') {
      // (the whole take is read, so the heel strikes are found where they are; one cycle of it becomes the loop)
      const L = loopCycle(c, r, from, to);
      if (L) takes.push({ name: name + 'L', tag: tag || 0, c: L.c, r: L.r, loop: true });
      continue;
    }
    takes.push({ name, tag: tag || 0, c, r });
  }
  // posture: the capture's rest pose is no natural stance for the spine and the head (a CMU actor walking reads as
  // head bowed some 25°, the back in an S), so the axial bones are calibrated on the walks and the standing takes —
  // their mean turn is taken off every frame, and the hero's own upright posture is what remains on average
  const AXIAL = ['spine', 'spine2', 'chest', 'neck', 'head'];
  const bias = {};
  for (const b of AXIAL) {
    const acc = new THREE.Vector4(), ref = new THREE.Quaternion(), first = { set: false };
    for (const t of takes) {
      if (![1, 2, 3].includes(t.tag)) continue;
      for (const fr of t.c.frames) {
        const q = fr.q[b];
        if (!first.set) { ref.copy(q); first.set = true; }
        const sgn = q.x * ref.x + q.y * ref.y + q.z * ref.z + q.w * ref.w < 0 ? -1 : 1;
        acc.x += q.x * sgn; acc.y += q.y * sgn; acc.z += q.z * sgn; acc.w += q.w * sgn;
      }
    }
    bias[b] = new THREE.Quaternion(acc.x, acc.y, acc.z, acc.w).normalize();
  }
  for (const t of takes) for (const fr of t.c.frames) for (const b of AXIAL) fr.q[b] = bias[b].clone().invert().multiply(fr.q[b]);
  const nB = MOVE_BONES.length, nF = takes.reduce((a, t) => a + t.c.frames.length, 0);
  const rot = new Int16Array(nF * nB * 3), root = new Int16Array(nF * 6), contact = new Uint8Array(nF);
  const v = new THREE.Vector3();
  let f = 0;
  const clips = [];
  for (const t of takes) {
    clips.push({ name: t.name, start: f, count: t.c.frames.length, tag: t.tag, loop: !!t.loop });
    const prevR = new Int32Array(nB * 3), prevS = new Int32Array(6);
    t.c.frames.forEach((fr, i) => {
      const rr = t.r[i];
      MOVE_BONES.forEach((b, j) => {
        toVec(b === 'hips' ? rr.hipsQ : fr.q[b] || new THREE.Quaternion(), v);
        const q = [Math.round(v.x / RS), Math.round(v.y / RS), Math.round(v.z / RS)];
        for (let k = 0; k < 3; k++) { rot[(f * nB + j) * 3 + k] = i ? q[k] - prevR[j * 3 + k] : q[k]; prevR[j * 3 + k] = q[k]; }
      });
      const s = [Math.round(rr.fwd / VS), Math.round(rr.side / VS), Math.round(rr.yawRate / VS), Math.round(rr.hips.x / PS), Math.round(rr.hips.y / PS), Math.round(rr.hips.z / PS)];
      for (let k = 0; k < 6; k++) { root[f * 6 + k] = i ? s[k] - prevS[k] : s[k]; prevS[k] = s[k]; }
      contact[f] = rr.contact;
      f++;
    });
  }
  // write
  const parts = [];
  const enc = (s) => [s.length, ...[...s].map((ch) => ch.charCodeAt(0))];
  const head = [];
  const u8 = (x) => head.push(['u8', x]), u16 = (x) => head.push(['u16', x]), u32 = (x) => head.push(['u32', x]), f32 = (x) => head.push(['f32', x]);
  'HMV3'.split('').forEach((ch) => u8(ch.charCodeAt(0)));
  u16(30); u16(nB); u32(nF);
  for (const b of MOVE_BONES) enc(b).forEach(u8);
  u16(clips.length);
  for (const c of clips) { enc(c.name).forEach(u8); u32(c.start); u32(c.count); u8(c.loop ? 1 : 0); u8(c.tag); }
  f32(RS); f32(PS); f32(VS);
  let size = 0; for (const [t] of head) size += t === 'u8' ? 1 : t === 'u16' ? 2 : 4;
  size += rot.byteLength + root.byteLength + contact.byteLength;
  const buf = new ArrayBuffer(size), dv = new DataView(buf);
  let o = 0;
  for (const [t, x] of head) { if (t === 'u8') dv.setUint8(o++, x); else if (t === 'u16') { dv.setUint16(o, x, true); o += 2; } else if (t === 'u32') { dv.setUint32(o, x, true); o += 4; } else { dv.setFloat32(o, x, true); o += 4; } }
  // (int16 in two byte planes, low bytes then high: the high ones are nearly all 0 or 255 and deflate to nothing)
  const planes = (a) => { const n = a.length, u = new Uint8Array(buf, o, n * 2); for (let i = 0; i < n; i++) { u[i] = a[i] & 255; u[n + i] = (a[i] >> 8) & 255; } o += n * 2; };
  planes(rot); planes(root);
  new Uint8Array(buf, o).set(contact);
  const gz = await new Response(new Blob([buf]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  if (save) {
    // (through the snapshot endpoint: a data URL, saved under .snaps; the shell moves it into assets/hero)
    const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(new Blob([gz])); });
    await fetch('/__snap?name=' + save, { method: 'POST', body: b64 });
  }
  const deg = (q) => +(2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI).toFixed(1);
  return { frames: nF, seconds: nF / 30, raw: size, gz: gz.byteLength, clips: clips.length, bias: Object.fromEntries(Object.entries(bias).map(([k, q]) => [k, deg(q)])) };
}

// one stride cycle of a take made into a seamless loop (for gaits the database has too little of: a sprint): from a
// left heel strike in [fromSec, toSec] to the next one, the last frames eased into the first
export function loopCycle(c, r, fromSec, toSec, blend = 5) {
  const n = c.frames.length, a0 = Math.round(fromSec * c.fps), a1 = Math.min(n - 1, Math.round(toSec * c.fps));
  const strikes = [];
  for (let i = Math.max(1, a0); i <= a1; i++) if ((r[i].contact & 1) && !(r[i - 1].contact & 1)) strikes.push(i);
  if (strikes.length < 2) return null;
  const f0 = strikes[0], f1 = strikes[1]; // (one cycle: left foot down to left foot down)
  const frames = c.frames.slice(f0, f1).map((fr) => ({ q: Object.fromEntries(Object.entries(fr.q).map(([k, q]) => [k, q.clone()])), hips: fr.hips.clone() }));
  const root = r.slice(f0, f1).map((x) => ({ ...x, hips: x.hips.clone(), hipsQ: x.hipsQ.clone() }));
  const m = frames.length;
  for (let i = 0; i < blend; i++) {
    const j = m - blend + i, w = (i + 1) / (blend + 1), src = frames[i % m], dst = frames[j];
    for (const k in dst.q) if (src.q[k]) dst.q[k].slerp(src.q[k], w);
    dst.hips.lerp(src.hips, w);
    const rs = root[i % m], rd = root[j];
    rd.fwd += (rs.fwd - rd.fwd) * w; rd.side += (rs.side - rd.side) * w; rd.yawRate += (rs.yawRate - rd.yawRate) * w;
    rd.hips.lerp(rs.hips, w); rd.hipsQ.slerp(rs.hipsQ, w);
  }
  return { c: { ...c, frames }, r: root, loop: true, cycle: [f0, f1] };
}

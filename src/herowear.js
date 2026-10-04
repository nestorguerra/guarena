// The hero's clothes, made from the body itself: each garment is the part of the body it covers, lifted off the skin
// by the cloth's own ease (looser over the belly and the small of the back, snug at the ribbed hem and cuffs), its
// anatomy smoothed away (cloth bridges hollows, it does not follow every muscle), with the body's own skin weights —
// so it moves exactly with what is under it and never shows the skin through. Garments overlap where real ones do
// (the hoodie hangs over the waistband). The skin they hide is dropped.
// Garments: a hoodie (the hood lying on the back), cargo bermudas, socks and trainers.
//
// in: the body (positions, normals, weights, triangles), its bones' bind positions, bone names, the outfit
// out: { parts: [{ pos, nrm, si, sw, reg, mat, index }], keepTri: Uint8Array over the body's triangles }

// regions and shading classes (charbuild.js REG / MAT)
const R = { skin: 0, top: 1, topTrim: 2, bottom: 3, bottomTrim: 4, tread: 6, shoe: 7, sole: 8, lace: 9, shoeAccent: 10, sock: 28 }; // (tread: the grey 'metal' colour)
const M = { cotton: 3, knit: 4, twill: 6, rubber: 8, canvas: 9 };

function neighbours(nv, index) {
  const nb = Array.from({ length: nv }, () => new Set());
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
  }
  return nb.map((s) => Int32Array.from(s));
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// where a point lies along a limb: 0 at its root joint, 1 at its end
function along(px, py, pz, A, Bp) {
  const dx = Bp[0] - A[0], dy = Bp[1] - A[1], dz = Bp[2] - A[2], l2 = dx * dx + dy * dy + dz * dz;
  return ((px - A[0]) * dx + (py - A[1]) * dy + (pz - A[2]) * dz) / l2;
}

export function dressHero(H, J, names, outfit = {}, allNames = names) {
  const nv = H.nv, P = H.pos, N = H.nrm, nb = neighbours(nv, H.index);
  const bone = new Int16Array(nv); // the bone each vertex mostly follows
  for (let v = 0; v < nv; v++) { let bw = -1, bi = 0; for (let k = 0; k < 4; k++) if (H.sw[v * 4 + k] > bw) { bw = H.sw[v * 4 + k]; bi = H.si[v * 4 + k]; } bone[v] = bi; }
  const bn = (v) => names[bone[v]];
  const isLimbArm = (n) => /^(arm|fore)[LR]$/.test(n), isLeg = (n) => /^(thigh|shin)[LR]$/.test(n), isFoot = (n) => /^(foot|toe)[LR]$/.test(n);
  const isTorso = (n) => n === 'hips' || n === 'spine' || n === 'spine2' || n === 'chest' || /^clav[LR]$/.test(n);
  const sideOf = (v) => (P[v * 3] >= 0 ? 'L' : 'R');
  // landmarks (bind pose, metres)
  const hipsY = J.hips[1], hemY = hipsY - 0.035 + (outfit.hem || 0), waistY = hipsY + 0.035, neckY = J.neck[1] + 0.01;
  const armT = (v) => { const s = sideOf(v); return along(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], J['arm' + s], J['hand' + s]); };
  const legT = (v) => { const s = sideOf(v); return along(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], J['thigh' + s], J['foot' + s]); };
  const sleeve = outfit.sleeve ?? 0.985, shortsT = outfit.shortsT ?? 0.6, sockT = outfit.sockT ?? 0.8;
  const neckZ = J.neck[2];
  // ---- the garments' masks (a vertex may be under two: the hoodie over the waistband) and how near their edge it is
  const top = new Float32Array(nv).fill(-1), bot = new Float32Array(nv).fill(-1), sock = new Float32Array(nv).fill(-1), shoe = new Float32Array(nv).fill(-1);
  // the trainers' lasts first: the skin well inside a trainer goes, the foot above its collar is in the sock
  const lasts = outfit.shoes !== false ? { L: shoeLast(H, J, names, bone, 'L'), R: shoeLast(H, J, names, bone, 'R') } : null;
  for (let v = 0; v < nv; v++) {
    const n = bn(v), y = P[v * 3 + 1];
    if (lasts && (isFoot(n) || isLeg(n)) && y < 0.2) {
      const d = insideShoe(lasts[sideOf(v)], P[v * 3], y, P[v * 3 + 2]);
      if (d > 0.012 || (isFoot(n) && y < 0.045)) { shoe[v] = 0; continue; }
      if (isFoot(n)) { sock[v] = 0; continue; }
    }
    if (isLeg(n)) {
      const t = legT(v);
      if (t > sockT) { sock[v] = sstep(sockT + 0.05, sockT, t); continue; }
      if (t < shortsT) bot[v] = sstep(shortsT - 0.06, shortsT, t);
      continue;
    }
    if (n === 'hips' && y < waistY) bot[v] = sstep(waistY - 0.03, waistY, y);
    if (isLimbArm(n)) { const t = armT(v); if (t < sleeve) top[v] = sstep(sleeve - 0.07, sleeve, t); continue; }
    // the collar: higher at the back and the sides, where the hood rises round the neck
    const back = sstep(neckZ + 0.02, neckZ - 0.04, P[v * 3 + 2]);
    const ny = neckY + 0.035 * back;
    if ((isTorso(n) || n === 'neck') && y > hemY && y < ny) top[v] = Math.max(sstep(hemY + 0.06, hemY, y), sstep(ny - 0.025, ny, y));
  }
  const parts = [];
  const hidden = new Uint8Array(nv); // body vertices whose skin is surely covered
  const make = (name, mask, ease, regFn, matFn, smoothIt = 6, minT = 0.004) => {
    const map = new Int32Array(nv).fill(-1), list = [];
    for (let v = 0; v < nv; v++) if (mask[v] >= 0) { map[v] = list.length; list.push(v); }
    const n = list.length;
    if (!n) return null;
    const X = new Float32Array(n * 3), T = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = list[i], t = ease(v);
      T[i] = t;
      for (let a = 0; a < 3; a++) X[i * 3 + a] = P[v * 3 + a] + N[v * 3 + a] * t;
    }
    // cloth spans the hollows: each vertex eased towards its garment neighbours' mean, never nearer the skin than its
    // own minimum (edges stay where they are)
    const Y = new Float32Array(n * 3), edge = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const ns = nb[list[i]]; for (let j = 0; j < ns.length; j++) if (map[ns[j]] < 0) { edge[i] = 1; break; } }
    for (let it = 0; it < smoothIt; it++) {
      for (let i = 0; i < n; i++) {
        const v = list[i], ns = nb[v];
        let sx = 0, sy = 0, sz = 0, k = 0;
        for (let j = 0; j < ns.length; j++) { const m = map[ns[j]]; if (m < 0) continue; sx += X[m * 3]; sy += X[m * 3 + 1]; sz += X[m * 3 + 2]; k++; }
        if (k < ns.length || k < 3) { Y[i * 3] = X[i * 3]; Y[i * 3 + 1] = X[i * 3 + 1]; Y[i * 3 + 2] = X[i * 3 + 2]; continue; }
        const lam = 0.55;
        Y[i * 3] = X[i * 3] + (sx / k - X[i * 3]) * lam; Y[i * 3 + 1] = X[i * 3 + 1] + (sy / k - X[i * 3 + 1]) * lam; Y[i * 3 + 2] = X[i * 3 + 2] + (sz / k - X[i * 3 + 2]) * lam;
      }
      for (let i = 0; i < n; i++) {
        const v = list[i];
        const d = (Y[i * 3] - P[v * 3]) * N[v * 3] + (Y[i * 3 + 1] - P[v * 3 + 1]) * N[v * 3 + 1] + (Y[i * 3 + 2] - P[v * 3 + 2]) * N[v * 3 + 2];
        const need = Math.max(minT, T[i] * 0.55);
        if (d < need) for (let a = 0; a < 3; a++) Y[i * 3 + a] += N[v * 3 + a] * (need - d);
      }
      X.set(Y);
    }
    const idx = [];
    for (let t = 0; t < H.index.length; t += 3) {
      const a = map[H.index[t]], b = map[H.index[t + 1]], c = map[H.index[t + 2]];
      if (a >= 0 && b >= 0 && c >= 0) idx.push(a, b, c);
    }
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), reg = new Uint8Array(n), mat = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const v = list[i];
      for (let k = 0; k < 4; k++) { si[i * 4 + k] = H.si[v * 4 + k]; sw[i * 4 + k] = H.sw[v * 4 + k]; }
      reg[i] = regFn(v, X, i, mask[v]); mat[i] = matFn(v, X, i, mask[v]);
      if (mask[v] < 0.35) hidden[v] = 1;
    }
    const p = { name, pos: X, nrm: new Float32Array(n * 3), si, sw, reg, mat, index: Uint32Array.from(idx), base: Int32Array.from(list), edge, bones: names };
    parts.push(p);
    return p;
  };
  const normals = (p) => {
    const X = p.pos, nr = p.nrm, idx = p.index, n = X.length / 3;
    nr.fill(0);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const ux = X[b * 3] - X[a * 3], uy = X[b * 3 + 1] - X[a * 3 + 1], uz = X[b * 3 + 2] - X[a * 3 + 2];
      const wx = X[c * 3] - X[a * 3], wy = X[c * 3 + 1] - X[a * 3 + 1], wz = X[c * 3 + 2] - X[a * 3 + 2];
      const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
      for (const q of [a, b, c]) { nr[q * 3] += cx; nr[q * 3 + 1] += cy; nr[q * 3 + 2] += cz; }
    }
    for (let i = 0; i < n; i++) { const l = Math.hypot(nr[i * 3], nr[i * 3 + 1], nr[i * 3 + 2]) || 1; nr[i * 3] /= l; nr[i * 3 + 1] /= l; nr[i * 3 + 2] /= l; }
  };
  // the bermudas first (under): cotton twill, wide in the leg, the waistband
  const B = make('bermuda', bot, (v) => {
    const n = bn(v);
    if (isLeg(n)) { const t = legT(v); return 0.013 + 0.017 * sstep(0.15, shortsT, t); }
    return 0.011;
  }, (v, X, i, c) => (c > 0.6 ? R.bottomTrim : R.bottom), () => M.twill, 5);
  // the hoodie (over): fleece standing off the body, more over the belly and the small of the back; the ribbed hem
  // and cuffs snug; the hood folded down on the back and round the neck
  const T = make('hoodie', top, (v) => {
    const y = P[v * 3 + 1], z = P[v * 3 + 2], n = bn(v);
    if (isLimbArm(n)) { const t = armT(v); return t > sleeve - 0.06 ? 0.007 : 0.009 + 0.006 * sstep(0.3, 0.8, t); }
    if (/^clav/.test(n)) return 0.009; // (over the top of the shoulder the fleece lies close)
    const belly = sstep(J.chest[1] + 0.05, hemY + 0.1, y) * (z > neckZ ? 1 : 0.65);
    const band = sstep(hemY + 0.05, hemY, y);
    // the hood: a thick roll of fabric round the back of the neck, spreading over the shoulder blades
    const hb = Math.exp(-Math.pow((y - (neckY - 0.03)) / 0.07, 2)) * sstep(neckZ + 0.03, neckZ - 0.06, z);
    return 0.013 + 0.013 * belly * (1 - band) - 0.005 * band + 0.02 * hb;
  }, (v, X, i, c) => (c > 0.55 ? R.topTrim : R.top), () => M.knit, 5);
  // white socks, close on the skin
  make('sock', sock, (v) => {
    if (!lasts) return 0.0035;
    const d = insideShoe(lasts[sideOf(v)], P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    return 0.0035 - 0.008 * sstep(0, 0.012, d); // (down inside the trainer it draws in, out of the way of its collar)
  }, () => R.sock, () => M.cotton, 2, -0.01);
  // the feet: hidden under the trainers made round them (makeTrainers)
  for (let v = 0; v < nv; v++) if (shoe[v] >= 0) hidden[v] = 1;
  // clean hems: the hoodie's bottom edge level all round, the bermudas' legs cut square across the leg
  if (T) for (let i = 0; i < T.edge.length; i++) if (T.edge[i] && T.pos[i * 3 + 1] < hemY + 0.04 && !isLimbArm(bn(T.base[i]))) T.pos[i * 3 + 1] = hemY - 0.01;
  if (B) for (let i = 0; i < B.edge.length; i++) {
    const v = B.base[i];
    if (!B.edge[i] || !isLeg(bn(v))) continue;
    const s = sideOf(v), A0 = J['thigh' + s], A1 = J['foot' + s], t = legT(v) + 0.012;
    if (t < shortsT - 0.1) continue;
    for (let a = 0; a < 3; a++) B.pos[i * 3 + a] += (shortsT - t) * (A1[a] - A0[a]);
  }
  for (const p of parts) normals(p);
  if (lasts) parts.push(...makeTrainers(lasts, names));
  if (outfit.hood !== false) parts.push(makeHood(J, names));
  if (outfit.pack && allNames.includes('pack')) parts.push(makePack(J, allNames, T));
  // the skin under the clothes goes: a triangle is dropped when all its corners are well inside some garment
  const keepTri = new Uint8Array(H.index.length / 3);
  for (let t = 0, k = 0; t < H.index.length; t += 3, k++) keepTri[k] = hidden[H.index[t]] && hidden[H.index[t + 1]] && hidden[H.index[t + 2]] ? 0 : 1;
  return { parts, keepTri };
}

// ---------------------------------------------------------------- made pieces (not lifted off the skin)
// A part made here names its bones itself (bones: [name…]; si indexes that list).
function mesh() { return { P: [], N: [], I: [], S: [], W: [], reg: [], mat: [] }; }
function finish(m, bones, name) {
  const n = m.P.length / 3;
  return { name, pos: Float32Array.from(m.P), nrm: Float32Array.from(m.N), index: Uint32Array.from(m.I), si: Uint16Array.from(m.S), sw: Float32Array.from(m.W), reg: Uint8Array.from(m.reg), mat: Uint8Array.from(m.mat), bones, made: true, nv: n };
}
// smooth normals of a made mesh
function madeNormals(m) {
  const n = m.P.length / 3, N = new Float32Array(n * 3), P = m.P, I = m.I;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const wx = P[c * 3] - P[a * 3], wy = P[c * 3 + 1] - P[a * 3 + 1], wz = P[c * 3 + 2] - P[a * 3 + 2];
    const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
    for (const q of [a, b, c]) { N[q * 3] += cx; N[q * 3 + 1] += cy; N[q * 3 + 2] += cz; }
  }
  for (let i = 0; i < n; i++) { const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; m.N[i * 3] = N[i * 3] / l; m.N[i * 3 + 1] = N[i * 3 + 1] / l; m.N[i * 3 + 2] = N[i * 3 + 2] / l; }
}
// a loft: rings of points (each ring the same count, closed round), joined into a tube; caps optional. Its faces look
// outwards when the rings, seen from where they run to, go round clockwise
function loft(m, rings, attr, closeStart = false, closeEnd = false) {
  const base = m.P.length / 3, k = rings[0].length;
  rings.forEach((r, i) => r.forEach((p, j) => { m.P.push(p[0], p[1], p[2]); m.N.push(0, 1, 0); const a = attr(i, j, p); m.S.push(...a.s); m.W.push(...a.w); m.reg.push(a.reg); m.mat.push(a.mat); }));
  for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < k; j++) {
    const a = base + i * k + j, b = base + i * k + ((j + 1) % k), c = base + (i + 1) * k + j, d = base + (i + 1) * k + ((j + 1) % k);
    m.I.push(a, c, b, c, d, b); // (both triangles end on b: a band takes the region of its corner (ring i, point j+1))
  }
  const cap = (ri, flip) => {
    const r = rings[ri], cx = r.reduce((s, p) => s + p[0], 0) / k, cy = r.reduce((s, p) => s + p[1], 0) / k, cz = r.reduce((s, p) => s + p[2], 0) / k;
    const c = m.P.length / 3; m.P.push(cx, cy, cz); m.N.push(0, 1, 0); const a = attr(ri, 0, [cx, cy, cz]); m.S.push(...a.s); m.W.push(...a.w); m.reg.push(a.reg); m.mat.push(a.mat);
    for (let j = 0; j < k; j++) { const a0 = base + ri * k + j, a1 = base + ri * k + ((j + 1) % k); if (flip) m.I.push(c, a1, a0); else m.I.push(c, a0, a1); }
  };
  if (closeStart) cap(0, false);
  if (closeEnd) cap(rings.length - 1, true);
}

// Trainers, made on a last taken from the foot itself. Along the foot (heel to toe, in its own frame), at each section:
// how wide the foot is there with room, and how high the upper comes — a heel counter and a padded collar under the
// ankle bones, the tongue rising in front of the ankle, then the laced vamp over the instep and a round toe box with
// room over the toes; the heel and the toe rounded off in plan. Under it a sole a little wider than the upper, thicker
// at the heel, bevelled behind and sprung up at the toe (the toe spring a shoe rolls over), white on its sides with a
// grey rubber tread under. The upper in the shoe's colour, the heel counter and the toe cap a shade apart.
const SHOE_K = 2.4; // the upper's cross-section: a super-ellipse (round over the top, its sides nearly upright)
function shoeLast(H, J, names, bone, s) {
  const ank = J['foot' + s], toe = J['toe' + s];
  const fwd = [toe[0] - ank[0], 0, toe[2] - ank[2]], fl = Math.hypot(fwd[0], fwd[2]) || 1; fwd[0] /= fl; fwd[2] /= fl;
  const lat = [fwd[2], 0, -fwd[0]]; // (the foot's own left)
  const toeT = (toe[0] - ank[0]) * fwd[0] + (toe[2] - ank[2]) * fwd[2];
  // the foot below the ankle (and the leg round the ankle bones, which the collar must clear)
  const pts = [];
  let f0 = 1e9, f1 = -1e9;
  for (let v = 0; v < H.nv; v++) {
    const n = names[bone[v]], y = H.pos[v * 3 + 1];
    if (y > 0.09 || (n !== 'foot' + s && n !== 'toe' + s && n !== 'shin' + s)) continue;
    const x = H.pos[v * 3] - ank[0], z = H.pos[v * 3 + 2] - ank[2], t = x * fwd[0] + z * fwd[2];
    pts.push([t, x * lat[0] + z * lat[2], y, n === 'shin' + s]);
    f0 = Math.min(f0, t); f1 = Math.max(f1, t);
  }
  const tH = f0 - 0.006, tT = f1 + 0.013, NS = 26, sec = [];
  for (let i = 0; i <= NS; i++) {
    const e = (1 - Math.cos((Math.PI * i) / NS)) / 2, t = tH + (tT - tH) * e; // (closer sections at the rounded ends)
    const tc = Math.min(f1 - 0.006, Math.max(f0 + 0.008, t));
    let uMin = 1e9, uMax = -1e9, yTop = 0;
    for (const p of pts) if (Math.abs(p[0] - tc) < 0.012) { uMin = Math.min(uMin, p[1]); uMax = Math.max(uMax, p[1]); if (!p[3]) yTop = Math.max(yTop, p[2]); }
    if (uMin > uMax) { uMin = -0.035; uMax = 0.035; yTop = 0.04; }
    sec.push({ t, e, mid: (uMin + uMax) / 2, hw: (uMax - uMin) / 2 + 0.0055 + 0.003 * sstep(0.07, 0.03, t), yTop }); // (more round the ankle)
  }
  for (let it = 0; it < 2; it++) { // (the foot's vertices are uneven: smooth along)
    const c = sec.map((q) => [q.mid, q.hw, q.yTop]);
    for (let i = 1; i < NS; i++) { const q = sec[i]; q.mid = (c[i - 1][0] + 2 * c[i][0] + c[i + 1][0]) / 4; q.hw = (c[i - 1][1] + 2 * c[i][1] + c[i + 1][1]) / 4; q.yTop = (c[i - 1][2] + 2 * c[i][2] + c[i + 1][2]) / 4; }
  }
  for (const q of sec) {
    const t = q.t, dh = (tH + 0.03 - t) / 0.03, dt = (t - (tT - 0.035)) / 0.035;
    if (dh > 0) q.hw *= Math.sqrt(Math.max(0, 1 - dh * dh));
    if (dt > 0) q.hw *= Math.pow(Math.max(0, 1 - Math.pow(dt, 2.5)), 1 / 2.5);
    q.hs = q.hw + 0.003;
    const bh = (tH + 0.035 - t) / 0.035, ts = (t - (toeT + 0.005)) / (tT - toeT - 0.005);
    q.yb = (bh > 0 ? 0.008 * bh * bh : 0) + (ts > 0 ? 0.018 * Math.pow(ts, 1.8) : 0);
    q.ys = q.yb + 0.0215 - 0.0075 * sstep(-0.01, toeT, t) - 0.003 * sstep(toeT, tT, t);
    const vamp = Math.min(0.096, Math.max(0.045, q.yTop + 0.011 + 0.005 * sstep(toeT - 0.02, toeT + 0.03, t)));
    const high = 0.079 + 0.006 * sstep(tH + 0.025, tH + 0.004, t) + 0.018 * sstep(-0.012, 0.028, t);
    let yt = high + (vamp - high) * sstep(0.04, 0.08, t);
    if (dt > 0) yt = q.ys + (yt - q.ys) * Math.pow(Math.max(0, 1 - Math.pow(dt, 2.2)), 1 / 2.2);
    q.yt = yt;
  }
  return { s, ank, fwd, lat, toeT, tH, tT, sec };
}
function lastAt(L, t) {
  const S = L.sec;
  if (t <= S[0].t) return S[0];
  if (t >= S[S.length - 1].t) return S[S.length - 1];
  let i = 1;
  while (S[i].t < t) i++;
  const a = S[i - 1], b = S[i], k = (t - a.t) / (b.t - a.t || 1), o = { t };
  for (const key of ['e', 'mid', 'hw', 'hs', 'yb', 'ys', 'yt']) o[key] = a[key] + (b[key] - a[key]) * k;
  return o;
}
// how far under the trainer's upper a point of the body is (bind pose; < 0 outside it)
function insideShoe(L, px, py, pz) {
  const x = px - L.ank[0], z = pz - L.ank[2], t = x * L.fwd[0] + z * L.fwd[2], u = x * L.lat[0] + z * L.lat[2];
  if (t < L.tH - 0.01 || t > L.tT + 0.01) return -1;
  const q = lastAt(L, t), r = Math.abs(u - q.mid) / Math.max(q.hw, 1e-4);
  return (r < 1 ? q.ys + (q.yt - q.ys) * Math.pow(1 - Math.pow(r, SHOE_K), 1 / SHOE_K) : q.ys) - py;
}

export function makeTrainers(lasts, names) {
  const parts = [], PH = [0.14, 0.42, 0.72, 1.0, 1.25, 1.45]; // (the upper's points, from the welt up towards the top)
  for (const s of ['L', 'R']) {
    const L = lasts[s], m = mesh(), fb = names.indexOf('foot' + s), tb = names.indexOf('toe' + s);
    const at = (q, u, y) => [L.ank[0] + L.fwd[0] * q.t + L.lat[0] * u, y, L.ank[2] + L.fwd[2] * q.t + L.lat[2] * u];
    const upper = (q, sd, ph) => at(q, q.mid + sd * q.hw * Math.pow(Math.cos(ph), 2 / SHOE_K), q.ys + 0.0015 + (q.yt - q.ys - 0.0015) * Math.pow(Math.sin(ph), 2 / SHOE_K));
    // a section's points, going round: the tread's middle, up the outer side, over the top, down the inner side. Each
    // carries the kind of the band between it and the point before it (see loft: a band's region is its end corner's)
    const rings = [], kinds = [], secs = L.sec.slice().reverse(); // (from the toe back: so the faces look outwards)
    for (const q of secs) {
      const th = q.ys - q.yb;
      const side = (sd) => [
        [at(q, q.mid + sd * q.hs * 0.8, q.yb), 'tread'],
        [at(q, q.mid + sd * q.hs, q.yb + Math.min(0.004, th * 0.3)), 'tread'],
        [at(q, q.mid + sd * q.hs, q.yb + th * 0.55), 'sole'],
        [at(q, q.mid + sd * (q.hs - 0.0004), q.ys), 'sole'],
        [at(q, q.mid + sd * q.hw, q.ys + 0.0015), 'sole'],
        ...PH.map((ph, k) => [upper(q, sd, ph), 'up' + k]),
      ];
      const out = side(1), inn = side(-1), ring = [at(q, q.mid, q.yb)], kind = ['tread'];
      for (const [p, k] of out) { ring.push(p); kind.push(k); }
      ring.push(at(q, q.mid, q.yt)); kind.push('up6');
      for (let k = inn.length - 1; k >= 0; k--) { ring.push(inn[k][0]); kind.push(k + 1 < inn.length ? inn[k + 1][1] : 'up6'); }
      rings.push(ring); kinds.push(kind);
    }
    loft(m, rings, (i, j) => {
      const q = secs[i], kd = kinds[i][j], wt = sstep(L.toeT - 0.012, L.toeT + 0.02, q.t); // (it bends across the ball of the foot)
      const up = kd[0] === 'u', lvl = up ? +kd[2] : 0;
      const accent = up && ((q.e < 0.16 && lvl < 5) || (q.e > 0.86 && lvl < 4)); // (the heel counter and the toe cap)
      return { s: [fb, tb, 0, 0], w: [1 - wt, wt, 0, 0], reg: kd === 'tread' ? R.tread : kd === 'sole' ? R.sole : accent ? R.shoeAccent : R.shoe, mat: up ? M.canvas : M.rubber };
    }, true, true);
    // laces: six bars across the tongue and the vamp, lying on them
    for (let k = 0; k < 6; k++) {
      const t = 0.028 + k * 0.0175, q = lastAt(L, t), bar = [];
      for (let c = -2; c <= 2; c++) {
        const u = q.mid + c * 0.0062, r = Math.abs(u - q.mid) / q.hw, y = q.ys + (q.yt - q.ys) * Math.pow(1 - Math.pow(r, SHOE_K), 1 / SHOE_K) + 0.0008;
        const p0 = at({ t: t - 0.0024 }, u, y), p1 = at({ t: t + 0.0024 }, u, y);
        bar.push([p0, p1, [p1[0], y + 0.0026, p1[2]], [p0[0], y + 0.0026, p0[2]]]);
      }
      loft(m, bar, () => ({ s: [fb, 0, 0, 0], w: [1, 0, 0, 0], reg: R.lace, mat: M.cotton }), true, true);
    }
    madeNormals(m);
    parts.push(finish(m, names, 'trainer' + s));
  }
  return parts;
}

// The hood: the fabric of a hood lying folded down on the back, a thick roll round the back of the neck from one
// side of the collar to the other, its rim a shade apart
export function makeHood(J, names) {
  const nk = J.neck, ch = J.chest, m = mesh();
  const cb = names.indexOf('chest'), nb = names.indexOf('neck');
  const R0 = 0.066, NA = 18, NS = 10;
  const rings = [];
  for (let i = 0; i <= NA; i++) {
    const th = 1.45 - (2.9 * i) / NA; // (round the back: from the right side of the collar to the left — its faces outwards)
    const ring = [];
    for (let j = 0; j < NS; j++) {
      const a = (j / NS) * Math.PI * 2;
      // the cross-section: a flattened roll that lies back and down on the shoulders, fuller at the back
      const back = Math.cos(th), full = 0.55 + 0.45 * Math.max(0, back);
      const rr = R0 + 0.012 * full, cx = Math.sin(th) * rr, cz = -Math.cos(th) * rr;
      const ox = Math.sin(th), oz = -Math.cos(th);
      const w = (0.018 + 0.022 * full) * Math.cos(a), h = (0.012 + 0.008 * full) * Math.sin(a);
      const drop = 0.05 * full * (0.5 + 0.5 * Math.cos(a));
      ring.push([nk[0] + cx + ox * (w + 0.01), nk[1] - 0.035 + h - drop * 0.6 - 0.02 * back, nk[2] + cz + oz * (w + 0.01) - 0.012 * back]);
    }
    rings.push(ring);
  }
  loft(m, rings, (i, j) => {
    const th = 1.45 - (2.9 * i) / NA, edge = Math.abs(th) > 1.2;
    return { s: [cb, nb, 0, 0], w: [0.75, 0.25, 0, 0], reg: edge ? R.topTrim : R.top, mat: M.knit };
  }, true, true);
  // the drawstrings, hanging from the collar on the chest
  for (const sd of [-1, 1]) {
    const x0 = nk[0] + sd * 0.028, y0 = nk[1] - 0.06, z0 = nk[2] + 0.075;
    const strand = [];
    for (let i = 0; i <= 6; i++) { const y = y0 - i * 0.022; strand.push([[x0 - 0.0025, y, z0 + 0.012 + i * 0.002], [x0 - 0.0025, y, z0 + 0.016 + i * 0.002], [x0 + 0.0025, y, z0 + 0.016 + i * 0.002], [x0 + 0.0025, y, z0 + 0.012 + i * 0.002]]); }
    loft(m, strand, () => ({ s: [cb, 0, 0, 0], w: [1, 0, 0, 0], reg: R.lace, mat: M.cotton }), true, true);
  }
  madeNormals(m);
  return finish(m, names, 'hood');
}

// The courier's backpack: a soft box on the back, its top rounded, on its own bone so it can swing a little behind
// the movement; two padded straps over the shoulders and down the chest, lying on the hoodie (when there is one)
export function makePack(J, names, top = null) {
  const ch = J.chest, m = mesh(), pb = names.indexOf('pack'), cb = names.indexOf('chest');
  const W = 0.15, Hh = 0.21, D = 0.145, cx = 0, cy = ch[1] + 0.14, cz = ch[2] - 0.1445; // (deep enough for a day's parcels)
  const NR = 12, rings = [];
  for (let i = 0; i <= NR; i++) {
    const v = i / NR, y = cy - Hh + 2 * Hh * v, round = Math.pow(Math.max(0, (v - 0.75) / 0.25), 2);
    const ring = [];
    for (let j = 0; j < 16; j++) {
      const a = (j / 16) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const px = Math.sign(ca) * Math.pow(Math.abs(ca), 0.4) * W * (1 - 0.18 * round), pz = Math.sign(sa) * Math.pow(Math.abs(sa), 0.5) * D * 0.5 * (1 - 0.3 * round);
      ring.push([cx + px, y - 0.04 * round, cz + pz + 0.022 * (1 - v)]); // (its bottom in against the small of the back)
    }
    rings.push(ring);
  }
  loft(m, rings, (i, j) => ({ s: [pb, 0, 0, 0], w: [1, 0, 0, 0], reg: i > NR - 2 ? 22 : 21, mat: M.canvas }), true, true);
  // the hoodie's surface: the highest point over (x, z), the furthest forward at (x, y)
  const P = top && top.pos;
  const collar = J.neck[1] - 0.01; // (not the collar rising round the neck)
  const overY = (x, z, def) => { let b = -1; if (P) for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i] - x) < 0.015 && Math.abs(P[i + 2] - z) < 0.015 && P[i + 1] < collar) b = Math.max(b, P[i + 1]); return b > 0 ? b + 0.004 : def; };
  const frontZ = (x, y, def) => { let b = -9; if (P) for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i] - x) < 0.018 && Math.abs(P[i + 1] - y) < 0.018) b = Math.max(b, P[i + 2]); return b > -9 ? b + 0.004 : def; };
  for (const sd of [-1, 1]) {
    const clb = names.indexOf(sd > 0 ? 'clavL' : 'clavR');
    const x1 = sd * 0.105, z1 = ch[2] - 0.042, x2 = sd * 0.112, z2 = ch[2] + 0.005, x3 = sd * 0.115, z3 = ch[2] + 0.055;
    const x4 = sd * 0.115, y4 = ch[1] + 0.2, x5 = sd * 0.122, y5 = ch[1] + 0.1, x6 = sd * 0.135, y6 = ch[1] + 0.02;
    const pts = [
      [sd * 0.075, cy + Hh - 0.075, cz + D * 0.5 + 0.006], // (out of the pack's face just under its top, down from the shoulder)
      [x1, overY(x1, z1, ch[1] + 0.33), z1], [x2, overY(x2, z2, ch[1] + 0.33), z2], [x3, overY(x3, z3, ch[1] + 0.31), z3],
      [x4, y4, frontZ(x4, y4, ch[2] + 0.115)], [x5, y5, frontZ(x5, y5, ch[2] + 0.11)], [x6, y6, frontZ(x6, y6, ch[2] + 0.08)],
      [sd * 0.12, cy - Hh + 0.04, cz + D * 0.4 + 0.021],
    ];
    // (over the shoulder it follows the collarbone; down the chest the chest; at its ends the pack)
    const wts = [[pb, cb, 0.7], [clb, cb, 0.6], [clb, cb, 0.6], [clb, cb, 0.5], [cb, clb, 0.85], [cb, 0, 1], [cb, 0, 1], [pb, cb, 0.7]];
    // each edge of the strap lies on the cloth (over the shoulder and down the chest the body curves away under it)
    const w = 0.024, t = 0.007;
    const edge = (i, k) => {
      const p = pts[i], x = p[0] + k * w;
      if (i >= 1 && i <= 3) return [x, overY(x, p[2], p[1]), p[2]];
      if (i >= 4 && i <= 6) return [x, p[1], frontZ(x, p[1], p[2])];
      return [x, p[1], p[2]];
    };
    const strand = pts.map((p, i) => {
      const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      const d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]], e0 = edge(i, -1), e1 = edge(i, 1);
      const b = [e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2]];
      const up = [d[1] * b[2] - d[2] * b[1], d[2] * b[0] - d[0] * b[2], d[0] * b[1] - d[1] * b[0]], ul = Math.hypot(...up) || 1; // (d × across: off the body)
      const nx = (up[0] / ul) * t, ny = (up[1] / ul) * t, nz = (up[2] / ul) * t;
      return [e0, [e0[0] + nx, e0[1] + ny, e0[2] + nz], [e1[0] + nx, e1[1] + ny, e1[2] + nz], e1];
    });
    loft(m, strand, (i) => ({ s: [wts[i][0], wts[i][1], 0, 0], w: [wts[i][2], 1 - wts[i][2], 0, 0], reg: 22, mat: M.canvas }), true, true);
  }
  madeNormals(m);
  return finish(m, names, 'pack');
}

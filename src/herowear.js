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
const R = { skin: 0, top: 1, topTrim: 2, bottom: 3, bottomTrim: 4, shoe: 7, sole: 8, lace: 9, shoeAccent: 10, sock: 28 };
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
  for (let v = 0; v < nv; v++) {
    const n = bn(v), y = P[v * 3 + 1];
    const ankle = J['foot' + sideOf(v)][1];
    if (isFoot(n) || ((isLeg(n) || n === 'hips') && y < ankle + 0.03)) { shoe[v] = 0; continue; }
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
    if (isLimbArm(n)) { const t = armT(v); return t > sleeve - 0.06 ? 0.008 : 0.014 + 0.007 * sstep(0.25, 0.75, t); }
    const belly = sstep(J.chest[1] + 0.05, hemY + 0.1, y) * (z > neckZ ? 1 : 0.65);
    const band = sstep(hemY + 0.05, hemY, y);
    // the hood: a thick roll of fabric round the back of the neck, spreading over the shoulder blades
    const hb = Math.exp(-Math.pow((y - (neckY - 0.03)) / 0.07, 2)) * sstep(neckZ + 0.03, neckZ - 0.06, z);
    const hs = Math.exp(-Math.pow((y - (neckY - 0.005)) / 0.03, 2)) * sstep(0.03, 0.08, Math.abs(P[v * 3])) * sstep(0.12, 0.08, Math.abs(P[v * 3]));
    return 0.018 + 0.02 * belly * (1 - band) - 0.007 * band + 0.045 * hb + 0.012 * hs;
  }, (v, X, i, c) => (c > 0.55 ? R.topTrim : R.top), () => M.knit, 8);
  // white socks, close on the skin
  make('sock', sock, () => 0.0035, () => R.sock, () => M.cotton, 2, 0.002);
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
  if (outfit.shoes !== false) parts.push(...makeTrainers(H, J, names, sideOf, bone));
  if (outfit.hood !== false) parts.push(makeHood(J, names));
  if (outfit.pack && allNames.includes('pack')) parts.push(makePack(J, allNames));
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
// a loft: rings of points (each ring the same count, closed round), joined into a tube; caps optional
function loft(m, rings, attr, closeStart = false, closeEnd = false) {
  const base = m.P.length / 3, k = rings[0].length;
  rings.forEach((r, i) => r.forEach((p, j) => { m.P.push(p[0], p[1], p[2]); m.N.push(0, 1, 0); const a = attr(i, j, p); m.S.push(...a.s); m.W.push(...a.w); m.reg.push(a.reg); m.mat.push(a.mat); }));
  for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < k; j++) {
    const a = base + i * k + j, b = base + i * k + ((j + 1) % k), c = base + (i + 1) * k + j, d = base + (i + 1) * k + ((j + 1) % k);
    m.I.push(a, c, b, b, c, d);
  }
  const cap = (ri, flip) => {
    const r = rings[ri], cx = r.reduce((s, p) => s + p[0], 0) / k, cy = r.reduce((s, p) => s + p[1], 0) / k, cz = r.reduce((s, p) => s + p[2], 0) / k;
    const c = m.P.length / 3; m.P.push(cx, cy, cz); m.N.push(0, 1, 0); const a = attr(ri, 0, [cx, cy, cz]); m.S.push(...a.s); m.W.push(...a.w); m.reg.push(a.reg); m.mat.push(a.mat);
    for (let j = 0; j < k; j++) { const a0 = base + ri * k + j, a1 = base + ri * k + ((j + 1) % k); if (flip) m.I.push(c, a1, a0); else m.I.push(c, a0, a1); }
  };
  if (closeStart) cap(0, false);
  if (closeEnd) cap(rings.length - 1, true);
}

// Trainers: a last made round each foot — from the heel to the toe, sections as wide and high as the foot is there
// (with room), a flat sole all along, flaring a little, white; the upper in the shoe's colour, the toe cap and the
// heel counter a shade apart; laces on the tongue.
export function makeTrainers(H, J, names, sideOf, bone) {
  const parts = [];
  for (const s of ['L', 'R']) {
    const ank = J['foot' + s], toe = J['toe' + s];
    const fwd = [toe[0] - ank[0], 0, toe[2] - ank[2]]; const fl = Math.hypot(fwd[0], fwd[2]) || 1; fwd[0] /= fl; fwd[2] /= fl;
    const lat = [fwd[2], 0, -fwd[0]]; // (the foot's own left)
    // the foot's extent along its length: heel and toe tips, its width and height at each step
    let t0 = 1e9, t1 = -1e9;
    const pts = [];
    for (let v = 0; v < H.nv; v++) {
      const n = names[bone[v]];
      if (n !== 'foot' + s && n !== 'toe' + s) continue;
      const x = H.pos[v * 3] - ank[0], y = H.pos[v * 3 + 1], z = H.pos[v * 3 + 2] - ank[2];
      if (y > ank[1] + 0.02) continue;
      const t = x * fwd[0] + z * fwd[2], u = x * lat[0] + z * lat[2];
      pts.push([t, u, y]); t0 = Math.min(t0, t); t1 = Math.max(t1, t);
    }
    if (!pts.length) continue;
    const NS = 14, K = 16, m = mesh(), rings = [], lo = [];
    t0 -= 0.012; t1 += 0.014; // (room at the heel and the toe)
    for (let i = 0; i <= NS; i++) {
      const tt = t0 + ((t1 - t0) * i) / NS;
      let uMin = 1e9, uMax = -1e9, yMax = 0;
      for (const p of pts) if (Math.abs(p[0] - tt) < 0.02) { uMin = Math.min(uMin, p[1]); uMax = Math.max(uMax, p[1]); yMax = Math.max(yMax, p[2]); }
      if (uMin > uMax) { uMin = -0.03; uMax = 0.03; yMax = 0.04; }
      const e = i / NS, toeCap = sstep(0.75, 1.0, e), heel = sstep(0.18, 0.0, e);
      const half = (uMax - uMin) / 2 + 0.008 - 0.006 * toeCap * toeCap, mid = (uMax + uMin) / 2;
      const top = Math.max(0.045, yMax + 0.012) * (1 - 0.45 * toeCap * toeCap) + 0.015 * heel; // (lower at the toe, a collar at the heel)
      const ring = [];
      for (let j = 0; j < K; j++) {
        const a = (j / K) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        // a section: flat under, round over (a squashed super-ellipse)
        const yy = sa < 0 ? 0.0 + 0.004 * (1 + sa) : 0.022 + (top - 0.022) * Math.pow(sa, 0.8);
        const uu = mid + half * Math.sign(ca) * Math.pow(Math.abs(ca), 0.75) * (sa < 0 ? 1.06 : 1);
        ring.push([ank[0] + fwd[0] * tt + lat[0] * uu, yy, ank[2] + fwd[2] * tt + lat[2] * uu]);
      }
      rings.push(ring); lo.push(e);
    }
    const fb = names.indexOf('foot' + s), tb = names.indexOf('toe' + s), toeAt = (Math.hypot(toe[0] - ank[0], toe[2] - ank[2]) - t0) / (t1 - t0);
    loft(m, rings, (i, j, p) => {
      const e = lo[i], wt = sstep(toeAt - 0.12, toeAt + 0.12, e); // (bending at the ball of the foot)
      // the sole: the underside and a band up its edge (lower at the toe, where the upper comes down to it)
      const sa = Math.sin((j / K) * Math.PI * 2), y = p[1], sole = sa < -0.05 || y < 0.012 + 0.006 * (1 - sstep(0.7, 1.0, e));
      const cap = e > 0.84 && !sole && sa > 0.1, counter = e < 0.14 && !sole;
      return { s: [fb, tb, 0, 0], w: [1 - wt, wt, 0, 0], reg: sole ? R.sole : cap || counter ? R.shoeAccent : R.shoe, mat: sole ? M.rubber : M.canvas };
    }, true, true);
    // laces: short bars across the tongue
    for (let k = 0; k < 5; k++) {
      const e = 0.42 + k * 0.075, i = Math.round(e * NS), r = rings[i], topJ = Math.round(K / 4);
      const c = r[topJ];
      const w = 0.012, hgt = 0.003, x0 = c[0], y0 = c[1] + 0.0025, z0 = c[2];
      const b0 = m.P.length / 3;
      for (const [du, dy] of [[-w, 0], [w, 0], [w, hgt], [-w, hgt]]) {
        m.P.push(x0 + lat[0] * du, y0 + dy, z0 + lat[2] * du); m.N.push(0, 1, 0); m.S.push(fb, tb, 0, 0); m.W.push(1, 0, 0, 0); m.reg.push(R.lace); m.mat.push(M.cotton);
      }
      m.I.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3, b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2);
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
  const R0 = 0.072, NA = 18, NS = 10;
  const rings = [];
  for (let i = 0; i <= NA; i++) {
    const th = -1.75 + (3.5 * i) / NA; // (round the back: from the left front of the collar to the right)
    const ring = [];
    for (let j = 0; j < NS; j++) {
      const a = (j / NS) * Math.PI * 2;
      // the cross-section: a flattened roll that lies back and down on the shoulders, fuller at the back
      const back = Math.cos(th), full = 0.55 + 0.45 * Math.max(0, back);
      const rr = R0 + 0.012 * full, cx = Math.sin(th) * rr, cz = -Math.cos(th) * rr;
      const ox = Math.sin(th), oz = -Math.cos(th);
      const w = (0.026 + 0.03 * full) * Math.cos(a), h = (0.018 + 0.012 * full) * Math.sin(a);
      const drop = 0.045 * full * (0.5 + 0.5 * Math.cos(a));
      ring.push([nk[0] + cx + ox * (w + 0.01), nk[1] - 0.035 + h - drop * 0.6 - 0.02 * back, nk[2] + cz + oz * (w + 0.01) - 0.012 * back]);
    }
    rings.push(ring);
  }
  loft(m, rings, (i, j) => {
    const th = -1.75 + (3.5 * i) / NA, edge = Math.abs(th) > 1.45;
    return { s: [cb, nb, 0, 0], w: [0.75, 0.25, 0, 0], reg: edge ? R.topTrim : R.top, mat: M.knit };
  }, true, true);
  // the drawstrings, hanging from the collar on the chest
  for (const sd of [-1, 1]) {
    const x0 = nk[0] + sd * 0.028, y0 = nk[1] - 0.06, z0 = nk[2] + 0.075;
    const strand = [];
    for (let i = 0; i <= 6; i++) { const y = y0 - i * 0.022; strand.push([[x0 - 0.0025, y, z0 + 0.012 + i * 0.002], [x0 + 0.0025, y, z0 + 0.012 + i * 0.002], [x0 + 0.0025, y, z0 + 0.016 + i * 0.002], [x0 - 0.0025, y, z0 + 0.016 + i * 0.002]]); }
    loft(m, strand, () => ({ s: [cb, 0, 0, 0], w: [1, 0, 0, 0], reg: R.lace, mat: M.cotton }), true, true);
  }
  madeNormals(m);
  return finish(m, names, 'hood');
}

// The courier's backpack: a soft box on the back, its top rounded, a flap, two straps over the shoulders; on its own
// bone so it can swing a little behind the movement
export function makePack(J, names) {
  const ch = J.chest, m = mesh(), pb = names.indexOf('pack'), cb = names.indexOf('chest');
  const W = 0.15, Hh = 0.21, D = 0.12, cx = 0, cy = ch[1] + 0.14, cz = ch[2] - 0.15;
  const NR = 12, rings = [];
  for (let i = 0; i <= NR; i++) {
    const v = i / NR, y = cy - Hh + 2 * Hh * v, round = Math.pow(Math.max(0, (v - 0.75) / 0.25), 2);
    const ring = [];
    for (let j = 0; j < 16; j++) {
      const a = (j / 16) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const px = Math.sign(ca) * Math.pow(Math.abs(ca), 0.4) * W * (1 - 0.18 * round), pz = Math.sign(sa) * Math.pow(Math.abs(sa), 0.5) * D * 0.5 * (1 - 0.3 * round);
      ring.push([cx + px, y - 0.04 * round, cz + pz]);
    }
    rings.push(ring);
  }
  loft(m, rings, (i, j) => ({ s: [pb, 0, 0, 0], w: [1, 0, 0, 0], reg: i > NR - 2 ? 22 : 21, mat: M.canvas }), true, true);
  // straps: from the pack's top over each shoulder to its bottom corner, lying on the hoodie
  for (const sd of [-1, 1]) {
    const pts = [[sd * 0.07, cy + Hh - 0.03, cz + D * 0.45], [sd * 0.1, ch[1] + 0.33, ch[2] - 0.06], [sd * 0.115, ch[1] + 0.32, ch[2] + 0.06], [sd * 0.12, ch[1] + 0.2, ch[2] + 0.115], [sd * 0.13, ch[1] + 0.05, ch[2] + 0.1], [sd * 0.12, cy - Hh + 0.04, cz + D * 0.4]];
    const strand = pts.map((p, i) => {
      const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      const d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]], dl = Math.hypot(...d) || 1;
      const side = [sd, 0, 0], up = [d[1] * side[2] - d[2] * side[1], d[2] * side[0] - d[0] * side[2], d[0] * side[1] - d[1] * side[0]], ul = Math.hypot(...up) || 1;
      const nx = up[0] / ul, ny = up[1] / ul, nz = up[2] / ul, w = 0.022, t = 0.006;
      return [[p[0] - w, p[1], p[2]], [p[0] + w, p[1], p[2]], [p[0] + w + nx * t, p[1] + ny * t, p[2] + nz * t], [p[0] - w + nx * t, p[1] + ny * t, p[2] + nz * t]];
    });
    loft(m, strand, (i) => ({ s: [i < 2 || i > 4 ? pb : cb, cb, 0, 0], w: [i < 2 || i > 4 ? 0.7 : 1, i < 2 || i > 4 ? 0.3 : 0, 0, 0], reg: 22, mat: M.canvas }), true, true);
  }
  madeNormals(m);
  return finish(m, names, 'pack');
}

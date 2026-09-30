// The MakeHuman head (CC0, www.makehumancommunity.org; see tools/mh_import.py): its mesh, morph targets, joints and
// proxies, parsed from assets/mh/head.bin.gz — and a head built from them for a given set of target weights.
// Pure data work (no three.js) inside one function, so the character workers can be handed its source and run it too.

export function mhLib() {
  // parse the (gunzipped) binary into typed arrays
  function parseMH(buf) {
    const dv = new DataView(buf.buffer || buf, buf.byteOffset || 0, buf.byteLength);
    let o = 0;
    const u8 = () => dv.getUint8(o++);
    const u16 = () => { const v = dv.getUint16(o, true); o += 2; return v; };
    const u32 = () => { const v = dv.getUint32(o, true); o += 4; return v; };
    const f32 = () => { const v = dv.getFloat32(o, true); o += 4; return v; };
    const i16 = () => { const v = dv.getInt16(o, true); o += 2; return v; };
    const str = () => { const n = u16(); let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(u8()); return decodeURIComponent(escape(s)); };
    const magic = String.fromCharCode(u8(), u8(), u8(), u8());
    if (magic !== 'MHH1' && magic !== 'MHH3') throw new Error('not a MakeHuman head: ' + magic);
    const q16 = magic === 'MHH3'; // (the proxies' binds in int16, weights and offsets each × a scale per proxy)
    const nR = u32(), base = new Float32Array(nR * 3);
    for (let i = 0; i < nR * 3; i++) base[i] = f32();
    const nV = u32(), nI = u32(), nBody = u32();
    const map = new Uint16Array(nV), uv = new Float32Array(nV * 2), index = new Uint16Array(nI);
    for (let i = 0; i < nV; i++) map[i] = u16();
    for (let i = 0; i < nV * 2; i++) uv[i] = u16() / 65535;
    for (let i = 0; i < nI; i++) index[i] = u16();
    const joints = {};
    for (let j = 0, n = u16(); j < n; j++) { const name = str(), k = u16(), ids = new Uint16Array(k); for (let i = 0; i < k; i++) ids[i] = u16(); joints[name] = ids; }
    const targets = {};
    for (let t = 0, n = u16(); t < n; t++) {
      const name = str(), scale = f32(), k = u32(), ids = new Uint16Array(k), d = new Int8Array(k * 3);
      for (let i = 0; i < k; i++) ids[i] = u16();
      for (let i = 0; i < k * 3; i++) d[i] = dv.getInt8(o++);
      targets[name] = { scale, ids, d };
    }
    const proxies = [];
    for (let p = 0, n = u16(); p < n; p++) {
      const kind = str(), name = str(), ref = [];
      for (let a = 0; a < 3; a++) ref.push([u16(), u16(), f32()]);
      const nb = u32(), bi = new Uint16Array(nb * 3), bw = new Float32Array(nb * 3), bo = new Float32Array(nb * 3);
      const wsc = q16 ? f32() : 1, osc = q16 ? f32() : 1;
      for (let i = 0; i < nb; i++) {
        bi[i * 3] = u16(); bi[i * 3 + 1] = u16(); bi[i * 3 + 2] = u16();
        for (let k = 0; k < 3; k++) bw[i * 3 + k] = q16 ? i16() * wsc : f32();
        for (let k = 0; k < 3; k++) bo[i * 3 + k] = q16 ? i16() * osc : f32();
      }
      const npv = u32(), npi = u32(), pmap = new Uint16Array(npv), puv = new Float32Array(npv * 2), pidx = new Uint16Array(npi);
      for (let i = 0; i < npv; i++) pmap[i] = u16();
      for (let i = 0; i < npv * 2; i++) puv[i] = u16() / 65535;
      for (let i = 0; i < npi; i++) pidx[i] = u16();
      proxies.push({ kind, name, ref, bi, bw, bo, map: pmap, uv: puv, index: pidx });
    }
    return { nR, base, map, uv, index, nBody, joints, targets, proxies };
  }

  // the region's vertices with the targets applied: weights { 'nose/nose-trans-up': 0.4, ... }
  function morphMH(M, weights) {
    const p = M.base.slice();
    for (const name in weights) {
      const w = weights[name], t = M.targets[name];
      if (!t || !w) continue;
      const s = t.scale * w, ids = t.ids, d = t.d;
      for (let i = 0; i < ids.length; i++) { const k = ids[i] * 3; p[k] += d[i * 3] * s; p[k + 1] += d[i * 3 + 1] * s; p[k + 2] += d[i * 3 + 2] * s; }
    }
    return p;
  }

  // a joint's position (the centre of its little cube)
  function jointMH(M, p, name, out = [0, 0, 0]) {
    const ids = M.joints[name];
    out[0] = out[1] = out[2] = 0;
    for (const i of ids) { out[0] += p[i * 3]; out[1] += p[i * 3 + 1]; out[2] += p[i * 3 + 2]; }
    out[0] /= ids.length; out[1] /= ids.length; out[2] /= ids.length;
    return out;
  }

  // a proxy (eyes, eyebrows, eyelashes) fitted onto the morphed head: per vertex three head vertices weighted, plus an
  // offset scaled like the head's size along each axis
  function fitProxy(M, p, px) {
    const sc = px.ref.map(([a, b, dist], ax) => Math.abs(p[a * 3 + ax] - p[b * 3 + ax]) / dist);
    const n = px.bi.length / 3, out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      for (let ax = 0; ax < 3; ax++) {
        let v = 0;
        for (let k = 0; k < 3; k++) v += px.bw[i * 3 + k] * p[px.bi[i * 3 + k] * 3 + ax];
        out[i * 3 + ax] = v + px.bo[i * 3 + ax] * sc[ax];
      }
    }
    return out;
  }

  // the macro targets for a person: gender 0 (woman) … 1 (man), age in years, ethnic mix { african, asian, caucasian }
  // (summing to 1), weight and muscle 0 … 1 (0.5 average) — as MakeHuman mixes them
  function macroWeights(gender, age, eth, weight = 0.5, muscle = 0.5, out = {}) {
    const t = Math.max(0, Math.min(1, (age - 25) / 65)), ages = { young: 1 - t, old: t };
    const gs = { male: gender, female: 1 - gender };
    for (const e of ['african', 'asian', 'caucasian']) for (const g in gs) for (const a in ages) {
      const w = (eth[e] || 0) * gs[g] * ages[a];
      if (w > 1e-4) out[`macrodetails/${e}-${g}-${a}`] = w;
    }
    const lo = (x) => Math.max(0, (0.5 - x) * 2), hi = (x) => Math.max(0, (x - 0.5) * 2);
    const avgW = 1 - lo(weight) - hi(weight), avgM = 1 - lo(muscle) - hi(muscle);
    for (const g in gs) for (const a in ages) {
      const k = gs[g] * ages[a];
      if (k < 1e-4) continue;
      const pre = `macrodetails/universal-${g}-${a}-`;
      if (lo(weight)) out[pre + 'averagemuscle-minweight'] = k * avgM * lo(weight);
      if (hi(weight)) out[pre + 'averagemuscle-maxweight'] = k * avgM * hi(weight);
      if (lo(muscle)) out[pre + 'minmuscle-averageweight'] = k * avgW * lo(muscle);
      if (hi(muscle)) out[pre + 'maxmuscle-averageweight'] = k * avgW * hi(muscle);
    }
    return out;
  }

  // the face's own features: the paired targets (…-incr / …-decr, up / down, in / out…) as signed sliders, both sides
  // of the face together (with a touch of asymmetry). Returns [{ name, pos, neg, side }] once per data set
  function faceSliders(M) {
    if (M._sliders) return M._sliders;
    const pairs = [['incr', 'decr'], ['up', 'down'], ['in', 'out'], ['forward', 'backward'], ['convex', 'concave'], ['open', 'close'], ['compress', 'uncompress'], ['moreconvex', 'moreconcave'], ['more', 'less'], ['min', 'max']];
    const names = Object.keys(M.targets).filter((n) => !n.startsWith('macrodetails/'));
    const seen = new Set(), out = [];
    for (const n of names) {
      if (seen.has(n)) continue;
      for (const [a, b] of pairs) {
        if (!n.endsWith('-' + a)) continue;
        const m = n.slice(0, -a.length) + b;
        if (!M.targets[m]) continue;
        seen.add(n); seen.add(m);
        // left and right halves go together
        const lr = n.match(/^(\w+)\/(l|r)-(.*)$/);
        if (lr) {
          if (lr[2] === 'r') break;
          const rn = `${lr[1]}/r-${lr[3]}`, rm = rn.slice(0, -a.length) + b;
          seen.add(rn); seen.add(rm);
          out.push({ name: `${lr[1]}/${lr[3].slice(0, -a.length - 1)}`, pos: [n, M.targets[rn] ? rn : null], neg: [m, M.targets[rm] ? rm : null] });
        } else out.push({ name: n.slice(0, -a.length - 1), pos: [n], neg: [m] });
        break;
      }
    }
    M._sliders = out;
    return out;
  }
  return { parseMH, morphMH, jointMH, fitProxy, macroWeights, faceSliders };
}
const L = mhLib();
export const parseMH = L.parseMH;
export const morphMH = L.morphMH;
export const jointMH = L.jointMH;
export const fitProxy = L.fitProxy;
export const macroWeights = L.macroWeights;
export const faceSliders = L.faceSliders;

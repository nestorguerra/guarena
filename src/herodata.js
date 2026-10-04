// The hero's body data (assets/hero/body.bin.gz, made by tools/hero_import.py from MakeHuman, CC0): the skeleton in
// the game's convention, the body below the head with MakeHuman's skin weights folded onto it, the seam ring at the
// neck, and the face's expression units (morph targets by base-mesh vertex). Pure data work, no three.js.
export function parseHero(buf) {
  const dv = new DataView(buf.buffer || buf, buf.byteOffset || 0, buf.byteLength);
  let o = 0;
  const u8 = () => dv.getUint8(o++), i8 = () => dv.getInt8(o++);
  const u16 = () => { const v = dv.getUint16(o, true); o += 2; return v; }, i16 = () => { const v = dv.getInt16(o, true); o += 2; return v; };
  const u32 = () => { const v = dv.getUint32(o, true); o += 4; return v; }, f32 = () => { const v = dv.getFloat32(o, true); o += 4; return v; };
  const str = () => { const n = u8(); let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(u8()); return s; };
  const magic = String.fromCharCode(u8(), u8(), u8(), u8());
  if (magic !== 'HRB1') throw new Error('not a hero body: ' + magic);
  const g = f32(), wt = f32(), mu = f32(), floor = f32();
  const bones = [];
  for (let i = 0, n = u16(); i < n; i++) bones.push({ name: str(), parent: i16(), off: [f32(), f32(), f32()], q: [f32(), f32(), f32(), f32()] });
  for (const b of bones) b.parentName = b.parent >= 0 ? bones[b.parent].name : null;
  const nv = u32();
  const pos = new Float32Array(nv * 3); for (let i = 0; i < nv * 3; i++) pos[i] = f32();
  const nrm = new Float32Array(nv * 3); for (let i = 0; i < nv * 3; i++) nrm[i] = i8() / 127;
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  for (let i = 0; i < nv; i++) { for (let k = 0; k < 4; k++) si[i * 4 + k] = u8(); for (let k = 0; k < 4; k++) sw[i * 4 + k] = u8() / 255; }
  const base = new Uint16Array(nv); for (let i = 0; i < nv; i++) base[i] = u16();
  const ni = u32(), index = new Uint16Array(ni); for (let i = 0; i < ni; i++) index[i] = u16();
  const nr = u32(), ring = new Uint16Array(nr); for (let i = 0; i < nr; i++) ring[i] = u16();
  const exprBase = new Map(); // base vertex → its unmorphed position (metres, y from 0.7 m, as the head build's aFace)
  for (let i = 0, n = u32(); i < n; i++) { const v = u16(); exprBase.set(v, [f32(), f32(), f32()]); }
  const expr = {};
  for (let e = 0, n = u16(); e < n; e++) {
    const name = str(), sc = f32(), k = u32(), ids = new Uint16Array(k), d = new Float32Array(k * 3);
    for (let i = 0; i < k; i++) ids[i] = u16();
    for (let i = 0; i < k * 3; i++) d[i] = i16() * sc;
    expr[name] = { ids, d };
  }
  return { g, wt, mu, floor, bones, nv, pos, nrm, si, sw, base, index, ring, expr, exprBase };
}

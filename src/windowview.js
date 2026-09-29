// The real street through the windows of a house. Interiors are built far from town (INTERIOR_ORIGIN), so every
// frame the town is also drawn from the spot you would be standing on inside the real building — placed by its
// street door, facing the same way — into a texture that the interior shows behind its windows, its balcony and
// the sky over its patio. The near plane of that second view is the facade itself (an oblique projection), so the
// walls of the real building never get in the way, and nothing has to be recompiled.
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _f = new THREE.Frustum(), _v = new THREE.Vector3(), _p = new THREE.Plane(), _c = new THREE.Vector4(), _q = new THREE.Vector4();
const _s = new THREE.Vector2();

// the first wall (taller than a kerb or a bench) crossed going from a to b: where, and along which direction it runs
function wallHit(col, ax, az, bx, bz) {
  if (!col || !col.segs) return null;
  const S = col.segs, dx = bx - ax, dz = bz - az;
  let best = 1, sx = 0, sz = 0;
  col.forSegs(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), (i, o) => {
    if (S[o + 4] < 2) return false;
    const x1 = S[o], z1 = S[o + 1], ux = S[o + 2] - x1, uz = S[o + 3] - z1;
    const den = dx * uz - dz * ux;
    if (Math.abs(den) < 1e-9) return false;
    const t = ((x1 - ax) * uz - (z1 - az) * ux) / den, u = ((x1 - ax) * dz - (z1 - az) * dx) / den;
    if (u >= 0 && u <= 1 && t >= 0 && t < best) { best = t; sx = ux; sz = uz; }
    return false;
  });
  return best < 1 ? { t: best, sx, sz } : null;
}

export class WindowView {
  constructor(game) {
    this.g = game;
    this.cam = new THREE.PerspectiveCamera();
    this.cam.matrixAutoUpdate = false;
    this.cam.matrixWorldAutoUpdate = false;
    this.M = new THREE.Matrix4(); // house coordinates → town
    this.eye = new THREE.Vector3();
    this.planes = { f: new THREE.Plane(), b: new THREE.Plane() };
    this.rt = null;
    this.house = null;
    this.rects = { f: new THREE.Vector4(), b: new THREE.Vector4() };
    this.hidden = [];
  }
  get active() { return !!this.house && this.g.interior === this.house; }

  // entering: where this house stands in the real town. door = { x, z } on the pavement, { fx, fz } inside
  attach(house, door, townCol) {
    this.detach();
    if (!house || !house.views || !house.views.length || !door || door.x === undefined || door.fx === undefined) return false;
    const map = this.g.map;
    let ix = door.fx - door.x, iz = door.fz - door.z;
    const l = Math.hypot(ix, iz);
    if (l < 0.05) return false;
    ix /= l; iz /= l;
    // the facade: first wall from the pavement spot inwards; the house looks out square to it
    const hit = wallHit(townCol, door.x, door.z, door.x + ix * 9, door.z + iz * 9);
    let wx = door.x + ix * 0.6, wz = door.z + iz * 0.6;
    if (hit) {
      wx = door.x + ix * 9 * hit.t; wz = door.z + iz * 9 * hit.t;
      const sl = Math.hypot(hit.sx, hit.sz) || 1;
      let nx = -hit.sz / sl, nz = hit.sx / sl;          // wall normal…
      if (nx * ix + nz * iz > 0) { nx = -nx; nz = -nz; } // …pointing out at the street
      if (-(nx * ix + nz * iz) > 0.6) { ix = -nx; iz = -nz; }
    }
    // how deep the real building is behind that door (its own walls must not show from the back windows)
    let deep = 0;
    for (let s = 0.5; s < 60; s += 0.5) { if (!map.buildingAt(wx + ix * s, wz + iz * s)) { deep = s; break; } }
    // house → town: the street door of the house (x of its entrance, front wall z) onto the facade point
    const dx = house.spots.entrada.x, dz = house.origin.z;
    this.M.set(
      iz, 0, ix, wx - (iz * dx + ix * dz),
      0, 1, 0, 0,
      -ix, 0, iz, wz - (-ix * dx + iz * dz),
      0, 0, 0, 1,
    );
    const zBack = Math.max(house.bounds ? house.bounds.z1 - dz : 12, deep) + 0.15;
    // what is kept of the town: in front of the facade (the street) or beyond the back of the house and the patio
    this.planes.f.setFromNormalAndCoplanarPoint(_v.set(-ix, 0, -iz), new THREE.Vector3(wx - ix * 0.08, 0, wz - iz * 0.08));
    this.planes.b.setFromNormalAndCoplanarPoint(_v.set(ix, 0, iz), new THREE.Vector3(wx + ix * zBack, 0, wz + iz * zBack));
    this.pose = { wx, wz, ix, iz, deep, zBack };
    this.house = house;
    // the vecinos' panes were painted with daylight: now they are clear glass
    if (house.winMat) {
      const m = house.winMat;
      m.transparent = true; m.opacity = 0.12; m.depthWrite = false; m.emissive.setHex(0); m.emissiveIntensity = 0; m.color.setHex(0x141c22); m.roughness = 0.05; m.metalness = 0.1;
      m.needsUpdate = true; house.clearGlass = true;
    }
    this.sync();
    return true;
  }
  detach() {
    this.house = null;
  }

  // the second camera follows yours, moved from the house into the real building
  sync() {
    if (!this.house) return;
    const main = this.g.camera, c = this.cam;
    main.updateMatrixWorld();
    c.matrixWorld.multiplyMatrices(this.M, main.matrixWorld);
    c.matrixWorldInverse.copy(c.matrixWorld).invert();
    c.position.setFromMatrixPosition(c.matrixWorld);
    c.near = main.near; c.far = main.far;
    this.eye.copy(c.position);
  }

  // the part of the screen where the openings of one side show (in render-target pixels); false if none is in view
  rect(side, W, H, out) {
    const main = this.g.camera;
    _f.setFromProjectionMatrix(_m.multiplyMatrices(main.projectionMatrix, main.matrixWorldInverse));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, any = false, full = false;
    for (const v of this.house.views) {
      if (v.side !== side || !_f.intersectsBox(v.box)) continue;
      any = true;
      const b = v.box;
      for (let k = 0; k < 8 && !full; k++) {
        _v.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(main.matrixWorldInverse);
        if (_v.z > -main.near) { full = true; break; } // a corner behind you: the whole screen
        _v.applyMatrix4(main.projectionMatrix);
        const px = (_v.x * 0.5 + 0.5) * W, py = (_v.y * 0.5 + 0.5) * H;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      if (full) break;
    }
    if (!any) return false;
    if (full) { out.set(0, 0, W, H); return true; }
    x0 = Math.max(0, Math.floor(x0) - 3); y0 = Math.max(0, Math.floor(y0) - 3);
    x1 = Math.min(W, Math.ceil(x1) + 3); y1 = Math.min(H, Math.ceil(y1) + 3);
    if (x1 <= x0 || y1 <= y0) return false;
    out.set(x0, y0, x1 - x0, y1 - y0);
    return true;
  }

  // near plane on the facade (Lengyel's oblique projection): everything between you and the window is cut away
  oblique(plane) {
    const c = this.cam, e = c.projectionMatrix.elements;
    _p.copy(plane).applyMatrix4(c.matrixWorldInverse);
    _c.set(_p.normal.x, _p.normal.y, _p.normal.z, _p.constant);
    if (_c.w > -0.02) return; // standing outside it (a third-person camera through the wall): plain view
    _q.set((Math.sign(_c.x) + e[8]) / e[0], (Math.sign(_c.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    _c.multiplyScalar(2 / _c.dot(_q));
    e[2] = _c.x; e[6] = _c.y; e[10] = _c.z + 1; e[14] = _c.w;
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  }

  // before the frame is drawn: the town into the texture, then the interior with that texture as its background
  render() {
    if (!this.active) return false;
    const g = this.g, r = g.renderer, sky = g.sky, main = g.camera;
    this.sync();
    r.getDrawingBufferSize(_s);
    const k = g.q && g.q.shadows > 1 ? 0.6 : 0.5;
    const W = Math.max(64, Math.round(_s.x * k)), H = Math.max(64, Math.round(_s.y * k));
    if (!this.rt) this.rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    else if (this.rt.width !== W || this.rt.height !== H) this.rt.setSize(W, H);
    const sides = ['f', 'b'].filter((sd) => this.rect(sd, W, H, this.rects[sd]));
    if (sides.length) {
      // outdoors as it is: full daylight, the sky and the sun's shadows around the real building
      const sI = sky.sun.intensity, hI = sky.hemi.intensity;
      if (this.outdoor) { sky.sun.intensity = this.outdoor.sun; sky.hemi.intensity = this.outdoor.hemi; }
      sky.placeAt(this.eye);
      const ir = g.interiors.root;
      ir.visible = false;
      // people who were walking when you came in would stand frozen mid-step: out of the picture
      const hid = this.hidden; hid.length = 0;
      if (g.peds) for (const ped of g.peds.list) { const o = ped.char && ped.char.object; if (o && o.visible && ped.speed > 0.2) { o.visible = false; hid.push(o); } }
      const bg = g.scene.background;
      g.scene.background = null;
      const prev = r.getRenderTarget();
      for (const sd of sides) {
        this.cam.projectionMatrix.copy(main.projectionMatrix);
        this.oblique(this.planes[sd]);
        this.rt.scissor.copy(this.rects[sd]);
        this.rt.scissorTest = true;
        r.setRenderTarget(this.rt);
        r.render(g.scene, this.cam);
      }
      r.setRenderTarget(prev);
      for (const o of hid) o.visible = true;
      hid.length = 0;
      ir.visible = true;
      g.scene.background = bg;
      sky.sun.intensity = sI; sky.hemi.intensity = hI;
      sky.placeAt(main.position);
    }
    // the interior: the town texture behind everything, no sky dome or fields of our own out there
    const back = this.backdrop();
    this.saved = { bg: g.scene.background, back, vis: back.map((o) => o.visible) };
    g.scene.background = this.rt.texture;
    for (const o of back) o.visible = false;
    return true;
  }
  after() {
    const g = this.g, s = this.saved;
    if (!s) return;
    g.scene.background = s.bg;
    s.back.forEach((o, i) => { o.visible = s.vis[i]; });
    this.saved = null;
  }
  backdrop() {
    const g = this.g, s = g.sky;
    return [s.dome, s.phys, s.stars, s.moon, g.world && g.world.base].filter(Boolean);
  }
}

// The view from inside a car (V in the car: first person at the wheel or as the passenger): a cabin fitted to each
// model's own body — dashboard with a lit speedometer, the steering wheel that turns, seats, door panels, headlining,
// the rear-view mirror — and the windows you look out through.
import * as THREE from 'three';

const mat = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });

export class CarInterior {
  constructor(game) {
    this.game = game;
    this.group = null; this.model = null; this.v = null;
    this.M = {
      dash: mat(0x34373d, 0.72), fabric: mat(0x3a3d44, 0.95), seat: mat(0x2a2c31, 0.9), lining: mat(0xb8b2a6, 0.95),
      carpet: mat(0x1a1b1e, 1), wheel: mat(0x141517, 0.5), chrome: mat(0xc8ccd0, 0.25, { metalness: 0.8 }),
      dial: new THREE.MeshBasicMaterial({ color: 0x0b0d10 }), glow: new THREE.MeshBasicMaterial({ color: 0xf2f6ff }), needle: new THREE.MeshBasicMaterial({ color: 0xff5a2a }),
      mirror: mat(0xa8b4c0, 0.05, { metalness: 1 }),
    };
  }
  build(v) {
    const info = this.game.fleet.renderer.info(v.model), c = info.cabin, s = v.spec;
    if (!c) return null;
    const g = new THREE.Group(), M = this.M;
    const bl = c.bl, H = c.H, zw0 = c.zw0, zr = c.zroof ?? -s.L / 2 + 0.4;
    const seatZ = info.seat.z, seatY = info.seat.y;
    const box = (m, w, h, d, x, y, z, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; g.add(b); return b; };
    const hw = (y) => c.halfW(y) - 0.04;
    // dashboard under the windscreen, the instrument binnacle in front of the driver
    box(M.dash, hw(bl) * 2, 0.26, 0.42, 0, bl - 0.1, zw0 - 0.2);
    box(M.dash, hw(bl) * 2 - 0.1, 0.05, 0.3, 0, bl + 0.02, zw0 - 0.08, -0.35);
    const bin = box(M.dash, 0.42, 0.14, 0.12, 0.38, bl + 0.04, zw0 - 0.36);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.055, 24), M.dial); dial.position.set(0.3, bl + 0.03, zw0 - 0.425); dial.rotation.y = Math.PI; g.add(dial);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.056, 24), M.glow); ring.position.copy(dial.position); ring.position.z -= 0.001; ring.rotation.y = Math.PI; g.add(ring);
    const needle = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.045).translate(0, 0.02, 0), M.needle); needle.position.copy(dial.position); needle.position.z -= 0.002; needle.rotation.y = Math.PI; g.add(needle);
    const rpmD = dial.clone(); rpmD.position.x = 0.46; g.add(rpmD);
    const rpmR = ring.clone(); rpmR.position.x = 0.46; g.add(rpmR);
    const rpmN = needle.clone(); rpmN.position.x = 0.46; g.add(rpmN);
    // the radio in the middle of the dashboard, its display lit with the frequency
    box(M.dash, 0.2, 0.07, 0.04, 0, bl - 0.08, zw0 - 0.43);
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.038), this.lcdMat()); lcd.position.set(0, bl - 0.075, zw0 - 0.452); lcd.rotation.y = Math.PI; g.add(lcd);
    // the steering wheel on its column
    const sw = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 8, 28), M.wheel); sw.add(rim);
    for (const a of [0, 2.1, 4.2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.012), M.wheel); sp.position.set(Math.sin(a) * 0.08, Math.cos(a) * 0.08, 0); sp.rotation.z = -a; sw.add(sp); }
    sw.position.set(0.38, bl - 0.06, zw0 - 0.58); sw.rotation.x = -0.35;
    g.add(sw);
    box(M.dash, 0.06, 0.06, 0.3, 0.38, bl - 0.1, zw0 - 0.45, -0.35);
    // seats, the centre console, the back bench
    for (const sx of [1, -1]) {
      box(M.seat, 0.48, 0.14, 0.5, sx * 0.38, seatY + 0.05, seatZ);
      box(M.seat, 0.48, 0.62, 0.1, sx * 0.38, seatY + 0.38, seatZ - 0.3, -0.18);
      box(M.seat, 0.26, 0.16, 0.08, sx * 0.38, seatY + 0.76, seatZ - 0.36, -0.18);
    }
    box(M.dash, 0.18, 0.2, 0.6, 0, seatY + 0.02, seatZ + 0.1);
    if (s.L > 3.6) box(M.seat, hw(bl - 0.3) * 2 - 0.1, 0.16, 0.5, 0, seatY + 0.05, seatZ - 0.95);
    // door panels, floor, headlining
    for (const sx of [1, -1]) box(M.fabric, 0.03, bl - 0.28, (zw0 - 0.1) - (zr + 0.2), sx * (hw(bl - 0.25) - 0.01), (bl + 0.28) / 2, ((zw0 - 0.1) + (zr + 0.2)) / 2);
    box(M.carpet, hw(0.4) * 2, 0.02, (zw0 - 0.1) - (zr + 0.1), 0, 0.3, ((zw0 - 0.1) + (zr + 0.1)) / 2);
    box(M.lining, hw(H - 0.1) * 2 - 0.04, 0.02, (c.zw1 - 0.08) - (zr + 0.08), 0, H - 0.06, ((c.zw1 - 0.08) + (zr + 0.08)) / 2);
    // rear-view mirror
    box(M.dash, 0.02, 0.06, 0.02, 0, H - 0.12, c.zw1 - 0.1);
    box(M.mirror, 0.22, 0.06, 0.012, 0, H - 0.17, c.zw1 - 0.12);
    g.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.frustumCulled = false; } });
    g.userData = { needle, rpmN, sw };
    return g;
  }
  lcdMat() {
    if (!this.lcd) {
      const cv = document.createElement('canvas'); cv.width = 160; cv.height = 40;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      this.lcd = { cv, tex, mat: new THREE.MeshBasicMaterial({ map: tex }) };
      this.setRadio(null);
    }
    return this.lcd.mat;
  }
  // what the radio's display reads: the frequency, or dark when it is off
  setRadio(f) {
    if (!this.lcd) return;
    const key = f == null ? 'off' : f.toFixed(1);
    if (key === this.lcdKey) return;
    this.lcdKey = key;
    const x = this.lcd.cv.getContext('2d');
    x.fillStyle = f == null ? '#07090b' : '#0b1a14'; x.fillRect(0, 0, 160, 40);
    if (f != null) { x.fillStyle = '#7dffc4'; x.font = 'bold 28px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`${key} FM`, 80, 21); }
    this.lcd.tex.needsUpdate = true;
  }
  // show it round car v (and let you see out of its windows); null takes it away
  set(v) {
    const g = this.game;
    if (v === this.v) return;
    if (this.v) this.v.hideGlass = false;
    if (this.group) { g.scene.remove(this.group); this.group = null; }
    this.v = v;
    if (!v) return;
    this.group = this.build(v);
    if (!this.group) { this.v = null; return; }
    v.hideGlass = true;
    g.scene.add(this.group);
    this.setRadio(g.fm && g.fm.where ? g.fm.freq : null);
  }
  update() {
    const v = this.v;
    if (!v || !this.group) return;
    const o = this.group;
    o.position.set(v.x, (v.y || 0) + 0.02 + Math.abs(v.bump || 0) * 0.1, v.z);
    o.rotation.order = 'YXZ';
    o.rotation.set((v.pitch || 0) + (v.bump || 0) * 0.3, v.heading, v.roll || 0);
    const u = o.userData;
    u.needle.rotation.z = Math.PI * 0.75 - Math.min(1, Math.abs(v.vel) / 50) * Math.PI * 1.5;
    u.rpmN.rotation.z = Math.PI * 0.75 - Math.min(1, v.rpm || 0) * Math.PI * 1.5;
    u.sw.rotation.z = -(v.steer || 0) * 2.4;
  }
}

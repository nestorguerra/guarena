// First-person view model: with the camera in first person (inside houses, or V outdoors) the gun in your hands is
// drawn in its own pass over the scene, with a short near plane: hands on the grip and the fore-end, sway with the
// mouse, walking bob, recoil kick, aim down the sights (right button), reload dip, draw from below, moving parts
// (slide, pump, bolt) and a muzzle flash. The rifle's scope takes over the whole screen when aiming.
import * as THREE from 'three';
import { buildGun } from './gunmodels.js';
import { SKIN } from './characters.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const LONG_SLEEVES = new Set(['hoodie', 'shirt', 'jacket', 'sweater', 'uniform', 'tracktop', 'cardigan', 'vest']);
const _v = new THREE.Vector3(), _q = new THREE.Quaternion();

export class ViewModel {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(54, 1, 0.01, 20);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.fill = new THREE.PointLight(0xfff0dc, 0, 3, 2);
    this.fill.position.set(0.3, 0.25, 0.1);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.fill);
    this.models = {};
    this.cur = null;
    this.active = false;
    this.ads = 0; this.draw = 0; this.bobT = 0;
    this.sway = new THREE.Vector2(); this.lastYaw = 0; this.lastPitch = 0;
    this.flashT = 0;
    // muzzle flash (a small star, added to the current model)
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.3, 'rgba(255,200,90,0.9)'); gr.addColorStop(1, 'rgba(255,90,0,0)');
    x.fillStyle = gr; x.beginPath();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, r = i % 2 ? 12 : 31; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    x.fill();
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.flash.visible = false;
  }

  // simple hands and forearms in the gun's frame, coloured like the player
  arms(m) {
    const p = this.game.player, desc = (p.char && p.char.desc) || {};
    const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color(desc.skinColor || SKIN[desc.skin ?? 1]), roughness: 0.62 });
    const sleeve = new THREE.MeshStandardMaterial({ color: new THREE.Color(desc.top || '#f4f4f0'), roughness: 0.9 });
    const long = LONG_SLEEVES.has(desc.topStyle);
    const ud = m.userData;
    const g = new THREE.Group();
    const fore = (wrist, dir, len = 0.42) => {
      const d = dir.clone().normalize();
      const geo = new THREE.CylinderGeometry(0.03, 0.038, len, 12, 1);
      geo.translate(0, -len / 2, 0);
      const mesh = new THREE.Mesh(geo, long ? sleeve : skin);
      mesh.position.copy(wrist);
      mesh.quaternion.setFromUnitVectors(_v.set(0, -1, 0), d);
      g.add(mesh);
      if (!long) { // short sleeve cuff near the elbow
        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.05, 0.1, 12).translate(0, -len + 0.03, 0), sleeve);
        cuff.position.copy(wrist); cuff.quaternion.copy(mesh.quaternion); g.add(cuff);
      }
    };
    // shooting hand: a fist round the grip, thumb along the left side
    const fist = new THREE.Mesh(new RoundedBoxGeometry(0.042, 0.08, 0.074, 2, 0.017), skin);
    fist.position.set(-0.006, -0.018, -0.006); fist.rotation.x = 0.3;
    g.add(fist);
    const thumb = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.022, 0.06, 2, 0.009), skin);
    thumb.position.set(0.02, 0.012, 0.012); thumb.rotation.x = -0.15;
    g.add(thumb);
    fore(ud.wristR, new THREE.Vector3(-0.35, -0.45, -1), 0.46);
    // support hand
    if (ud.long) {
      const cup = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.04, 0.1, 2, 0.016), skin);
      cup.position.copy(ud.wristL).add(_v.set(-0.03, 0.0, 0.07)); cup.rotation.z = -0.5;
      g.add(cup);
      fore(ud.wristL, new THREE.Vector3(0.5, -0.55, -0.9), 0.46);
    } else {
      const wrap = new THREE.Mesh(new RoundedBoxGeometry(0.042, 0.064, 0.066, 2, 0.016), skin);
      wrap.position.set(0.022, -0.028, 0.004); wrap.rotation.x = 0.3;
      g.add(wrap);
      fore(new THREE.Vector3(0.03, -0.045, -0.045), new THREE.Vector3(0.45, -0.45, -1), 0.44);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    return g;
  }
  model(id) {
    let m = this.models[id];
    if (m) return m;
    m = this.models[id] = buildGun(id);
    const u = m.userData;
    if (u.slide) u.slide0 = u.slide.position.z;
    if (u.pump) u.pump0 = u.pump.position.z;
    if (u.bolt) u.bolt0 = u.bolt.position.z;
    m.add(this.arms(m));
    m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
    return m;
  }
  shot() {
    const m = this.cur && this.models[this.cur];
    if (!m || !this.active) return;
    this.flash.position.copy(m.userData.muzzle).add(_v.set(0, 0, 0.03));
    this.flash.rotation.z = Math.random() * Math.PI;
    const s = { pistola: 0.7, subfusil: 0.8, escopeta: 1.5, rifle: 1.3 }[this.cur] || 1;
    this.flash.scale.setScalar(s * (0.8 + Math.random() * 0.4));
    this.flash.visible = true;
    if (this.flash.parent !== m) m.add(this.flash);
    this.flashT = 0.05;
  }

  update(dt) {
    const g = this.game, p = g.player, W = g.weapons;
    const d = W && W.def;
    const want = g.cam.fp && !g.cam.cinematic && !p.vehicle && p.mode === 'foot' && !p.hidden && !p.knock && d && !d.melee && d.id !== 'punos' && !W.scoped && g.state === 'play' ? W.cur : null;
    if (want !== this.cur) {
      if (this.cur && this.models[this.cur]) this.scene.remove(this.models[this.cur]);
      this.cur = want;
      if (want) { this.scene.add(this.model(want)); this.draw = 1; }
    }
    this.active = !!want;
    if (!want) return;
    const m = this.models[want], ud = m.userData, cam = g.camera;
    if (this.camera.aspect !== cam.aspect) { this.camera.aspect = cam.aspect; this.camera.updateProjectionMatrix(); }
    // light it like the world around the camera
    const sky = g.sky, inv = _q.copy(cam.quaternion).invert();
    this.hemi.color.copy(sky.hemi.color); this.hemi.groundColor.copy(sky.hemi.groundColor); this.hemi.intensity = sky.hemi.intensity;
    this.sun.color.copy(sky.sun.color); this.sun.intensity = sky.sun.intensity;
    this.sun.position.copy(sky.sun.position).sub(sky.sun.target.position).normalize().applyQuaternion(inv);
    this.scene.environment = g.scene.environment;
    this.scene.environmentIntensity = (g.scene.environmentIntensity ?? 1) * (g.interior ? 0.5 : 1);
    this.fill.intensity = g.interior && g.interior.powered !== false ? 0.35 : 0;
    // motion
    this.ads += ((W.aiming ? 1 : 0) - this.ads) * (1 - Math.exp(-14 * dt));
    this.draw = Math.max(0, this.draw - dt * 3.2);
    const dy = Math.atan2(Math.sin(g.cam.yaw - this.lastYaw), Math.cos(g.cam.yaw - this.lastYaw)), dp = g.cam.pitch - this.lastPitch;
    this.lastYaw = g.cam.yaw; this.lastPitch = g.cam.pitch;
    const k = 1 - this.ads * 0.75;
    this.sway.x += (Math.max(-0.06, Math.min(0.06, dy * 1.4)) * k - this.sway.x) * (1 - Math.exp(-9 * dt));
    this.sway.y += (Math.max(-0.05, Math.min(0.05, dp * 1.4)) * k - this.sway.y) * (1 - Math.exp(-9 * dt));
    const sp = Math.hypot(p.vel.x, p.vel.z);
    this.bobT += dt * (1.5 + sp * 1.7);
    const bw = Math.min(1, sp / 3) * (1 - this.ads * 0.85);
    const bobX = Math.cos(this.bobT) * 0.011 * bw, bobY = -Math.abs(Math.sin(this.bobT)) * 0.012 * bw;
    const idle = Math.sin(this.bobT * 0.7) * 0.0025 * (1 - this.ads);
    const kick = W.rig.kick;
    const rl = W.reloadT > 0 ? Math.sin(Math.min(1, 1 - W.reloadT / d.reload) * Math.PI) : 0;
    // hip and aim-down-sights poses (camera space: -z forward)
    const sy = ud.sight ? ud.sight.y : 0.07;
    const hip = ud.long ? [0.125, -0.165, -0.41] : [0.118, -0.128, -0.35];
    const adsP = ud.long ? [0, -sy - 0.04, -0.24] : [0, -sy - 0.004, -0.37]; // long guns: cheek on the comb, butt behind the eye
    const a = this.ads;
    m.position.set(
      hip[0] + (adsP[0] - hip[0]) * a + this.sway.x * 0.35 + bobX,
      hip[1] + (adsP[1] - hip[1]) * a - this.sway.y * 0.3 + bobY + idle - this.draw * 0.3 - rl * 0.07,
      hip[2] + (adsP[2] - hip[2]) * a + kick * (ud.long ? 0.05 : 0.035),
    );
    m.rotation.set(
      kick * (ud.long ? 0.1 : 0.22) - rl * 0.55 + this.draw * 0.6 + this.sway.y * 0.6,
      Math.PI + (1 - a) * 0.045 + this.sway.x * 0.9,
      (1 - a) * -0.04 + rl * 0.35 - this.sway.x * 0.4,
    );
    W.animateParts(m, d);
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
  }
  render(renderer) {
    if (!this.active) return;
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = ac;
  }
}

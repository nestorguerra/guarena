// Fishing at the Pantano de San Roque: stand on the bank or the jetty with a rod (the gun shop sells them), cast,
// watch the float, strike when it goes under and bring the fish in without breaking the line (hold to reel, let go
// when it pulls). Carp, barbel, black bass, pike, tench… each with its weight; the biggest of each kind is kept,
// and the fish stall at the Mercado de Abastos buys what you catch.
import * as THREE from 'three';
import { FISH } from './items.js';
import { PERK } from './perks.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fmtKg = (k) => k.toFixed(k < 1 ? 2 : 1).replace('.', ',') + ' kg';

export class Fishing {
  constructor(game) {
    this.g = game;
    this.state = null; // null | 'cast' | 'wait' | 'bite' | 'reel'
    this.t = 0;
    this.root = new THREE.Group();
    game.scene.add(this.root);
    // the float, the line and the rod
    const fl = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xe8302a, roughness: 0.4 }), wht = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.4 });
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), red); fl.add(top);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), wht); fl.add(bot);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5), red); ant.position.y = 0.08; fl.add(ant);
    fl.visible = false;
    this.float = fl; this.root.add(fl);
    this.lineGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 12), 3));
    this.line = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({ color: 0xe8e8e0, transparent: true, opacity: 0.7 }));
    this.line.frustumCulled = false; this.line.visible = false;
    this.root.add(this.line);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    this.root.add(this.ring);
    this.rod = this.makeRod();
    this.ui = null;
    this.tip = new THREE.Vector3();
  }
  makeRod() {
    const g = new THREE.Group();
    const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.011, 2.3, 6), new THREE.MeshStandardMaterial({ color: 0x1e2228, roughness: 0.35, metalness: 0.3 }));
    blank.position.y = 1.0; g.add(blank);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 }));
    grip.position.y = -0.05; g.add(grip);
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.035, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xa8acb0, roughness: 0.3, metalness: 0.7 }));
    reel.position.set(0.035, 0.05, 0); g.add(reel);
    const tip = new THREE.Object3D(); tip.position.y = 2.15; g.add(tip);
    g.userData.tip = tip;
    return g;
  }
  get active() { return !!this.state; }
  get res() { return this.g.world && this.g.world.reservoir; }

  // on the bank (or the jetty) with open water in front: where the float would go
  spot() {
    const g = this.g, p = g.player, R = this.res;
    if (!R || g.interior || p.mode !== 'foot' || p.vehicle) return null;
    const x = p.pos.x, z = p.pos.z;
    const d0 = R.sdf(x, z);
    const J = R.jetty;
    let onJetty = false;
    if (J) { const ax = x - J.x, az = z - J.z, a = ax * J.nx + az * J.nz, s = ax * J.tx + az * J.tz; onJetty = a > 0 && a < J.len + 0.5 && Math.abs(s) < J.w / 2 + 0.3; }
    if (!onJetty && (d0 < -0.6 || d0 > 4.5)) return null;
    // the way to the open water: down the distance field
    const e = 1.5;
    let gx = R.sdf(x + e, z) - R.sdf(x - e, z), gz = R.sdf(x, z + e) - R.sdf(x, z - e);
    const gl = Math.hypot(gx, gz) || 1; gx /= -gl; gz /= -gl;
    if (onJetty) { gx = J.nx; gz = J.nz; }
    // prefer where you are looking, if that is water too
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    if (R.sdf(x + fx * 10, z + fz * 10) < -2) { gx = fx; gz = fz; }
    const dist = 9 + Math.random() * 5;
    const tx = x + gx * dist, tz = z + gz * dist;
    if (R.sdf(tx, tz) > -1.5) return null;
    return { x: tx, z: tz, dx: gx, dz: gz, jetty: onJetty };
  }
  option() {
    const g = this.g;
    if (this.state) return null;
    const s = this.spot();
    if (!s) return null;
    if (!g.inv.has('cana')) return s.jetty ? { label: 'Aquí se pesca bien… <small>(necesitas una caña: la venden en la armería)</small>', info: true } : null;
    const bl = g.inv.baitLeft;
    return { label: `Echar la caña <small>(${bl ? `cebo para ${bl} lances` : 'sin cebo: tardarán en picar'})</small>`, run: () => this.cast(s) };
  }

  // ---------------------------------------------------------------- the cast
  cast(s) {
    const g = this.g, p = g.player;
    if (g.weapons) g.weapons.select('punos');
    p.heading = Math.atan2(s.dx, s.dz);
    this.bait = g.inv.useBait();
    this.target = new THREE.Vector3(s.x, 0.02, s.z);
    this.state = 'cast'; this.t = 0;
    this.fish = null;
    this.tension = 0; this.progress = 0; this.slack = 0;
    const ch = p.char;
    if (ch.bones.handR && this.rod.parent !== ch.bones.handR) ch.bones.handR.add(this.rod);
    this.rod.position.set(0.02, -0.07, 0.01); this.rod.rotation.set(1.25, 0, 0.2);
    ch.setBase('fish');
    ch.play('wave', 0.5);
    g.audio.sfx('bat_swing', { vol: 0.35 });
    this.showUI(true);
    this.say(this.bait ? `Echas la caña con ${this.bait === 'maiz' ? 'maíz' : 'lombriz'}…` : 'Echas la caña sin cebo… a ver si hay suerte.');
  }
  // how long until something bites (bait, the hour, and a little luck)
  waitTime() {
    const h = this.g.sky.hour;
    const golden = (h > 6 && h < 9.5) || (h > 18.5 && h < 22) ? 0.65 : h > 13 && h < 17 ? 1.35 : 1;
    return (5 + Math.random() * 14) * (this.bait ? 1 : 1.9) * golden;
  }
  chooseFish() {
    const w = FISH.map((f) => f.w * (this.bait && f.bait === this.bait ? 2.2 : 1) * (f.junk && this.bait ? 0.6 : 1));
    let r = Math.random() * w.reduce((a, b) => a + b, 0), f = FISH[0];
    for (let i = 0; i < FISH.length; i++) { r -= w[i]; if (r <= 0) { f = FISH[i]; break; } }
    if (f.junk) return { f, kg: 0, fight: 0.3 };
    const kg = f.kg[0] + (f.kg[1] - f.kg[0]) * Math.pow(Math.random(), 2.4) * (PERK.luck > 1 ? 1.1 : 1);
    return { f, kg: Math.min(f.kg[1], kg), fight: (f.fight || 1) * (0.6 + kg / f.kg[1] * 0.8) };
  }

  update(dt) {
    const g = this.g, p = g.player, input = g.input;
    if (!this.state) return;
    // walking away, getting in a car, the police, a mode change: the line comes in
    if (p.mode !== 'foot' || p.vehicle || g.interior || g.state !== 'play' || Math.hypot(input.moveX, input.moveY) > 0.5 || g.police.wanted > 1) { this.stop(); return; }
    this.t += dt;
    const reelIn = input.down('KeyE') || input.mouse.left || input.gpBtn(0) || input.gpBtn(15) || input.touch.buttons.has('attack') || input.touch.buttons.has('talk');
    const R = this.res;
    const fl = this.float;
    // where the rod tip is now
    this.rod.updateWorldMatrix(true, true);
    this.rod.userData.tip.getWorldPosition(this.tip);
    const bob = Math.sin(this.t * 2.2) * 0.012;
    if (this.state === 'cast') {
      const k = Math.min(1, this.t / 0.9);
      fl.visible = true;
      fl.position.lerpVectors(this.tip, this.target, k);
      fl.position.y = this.tip.y * (1 - k) + 0.02 + Math.sin(k * Math.PI) * 3.5;
      if (k >= 1) { this.state = 'wait'; this.t = 0; this.bite = this.waitTime(); this.nib = 1.5 + Math.random() * 3; this.splash(this.target, 0.9); g.audio.sfx('splash', { x: this.target.x, z: this.target.z, vol: 0.4 }); }
    } else if (this.state === 'wait') {
      fl.position.set(this.target.x, 0.02 + bob, this.target.z);
      // nibbles: the float twitches
      this.nib -= dt;
      if (this.nib <= 0) { this.nib = 1.2 + Math.random() * 3; this.dip = 0.25; }
      if (this.dip > 0) { this.dip -= dt; fl.position.y -= Math.sin(this.dip * 25) * 0.025; }
      if (reelIn && input.hit('KeyE') || input.gpPressed(0) || input.touch.pressed.has('talk')) { if (this.t > 0.6) { this.say('Recoges el sedal: todavía no había picado nada.'); this.stop(); return; } }
      if (this.t >= this.bite) { this.state = 'bite'; this.t = 0; this.fish = this.chooseFish(); g.audio.sfx('splash', { x: this.target.x, z: this.target.z, vol: 0.7 }); this.splash(this.target, 0.6); this.say('¡Pica! ¡Tira ya!', 1.2); }
    } else if (this.state === 'bite') {
      fl.position.set(this.target.x, -0.08 + Math.sin(this.t * 30) * 0.03, this.target.z);
      if (input.hit('KeyE') || input.mouse.leftPressed || input.gpPressed(0) || input.gpPressed(15) || input.touch.pressed.has('attack') || input.touch.pressed.has('talk')) {
        this.state = 'reel'; this.t = 0; this.tension = 0.35; this.progress = 0; this.pull = 0;
        g.cam.shake && g.cam.shake(0.02);
      } else if (this.t > 1.35) { this.say(pick(['Se ha llevado el cebo… demasiado lento.', 'Nada: ha soltado el anzuelo.', '¡Se escapó! Hay que tirar en cuanto se hunda la boya.'])); this.stop(); return; }
    } else if (this.state === 'reel') {
      const F = this.fish;
      // the fish pulls in runs; reeling raises the tension, letting go lowers it
      this.pull -= dt;
      if (this.pull <= 0) { this.pull = 0.6 + Math.random() * 1.6; this.run = Math.random() < 0.55 ? (0.5 + Math.random() * 0.6) * F.fight : 0; }
      const runK = this.pull > 0.4 ? this.run : this.run * 0.3;
      if (reelIn) { this.tension += (0.3 + runK * 0.75) * dt; this.progress += (0.36 / (0.55 + F.fight * 0.45)) * dt * (runK > 0.5 ? 0.45 : 1); }
      else { this.tension -= 0.6 * dt; this.tension += runK * 0.22 * dt; this.progress -= runK * 0.04 * dt; }
      this.tension = Math.max(0, this.tension);
      this.progress = Math.max(0, this.progress);
      this.rod.rotation.x = 1.25 - Math.min(0.5, this.tension * 0.45);
      p.char.reeling = reelIn;
      if (this.tension < 0.06 && !reelIn) this.slack += dt; else this.slack = Math.max(0, this.slack - dt * 2);
      // the float comes in towards the bank
      const k = Math.min(1, this.progress);
      const bx = this.target.x + (this.tip.x - this.target.x) * k * 0.85, bz = this.target.z + (this.tip.z - this.target.z) * k * 0.85;
      fl.position.set(bx + Math.sin(this.t * 7) * 0.08 * F.fight, -0.03 + Math.sin(this.t * 11) * 0.02, bz + Math.cos(this.t * 6) * 0.08 * F.fight);
      if (Math.random() < dt * 3) this.splash(fl.position, 0.4);
      if (this.tension >= 1) { g.audio.sfx('ui_back'); this.say(pick(['¡Crac! Se ha partido el sedal.', '¡Demasiada fuerza! El sedal no ha aguantado.']), 2.6); this.stop(); return; }
      if (this.slack > 3) { this.say('Con el sedal flojo, el pez se ha soltado.', 2.6); this.stop(); return; }
      if (this.progress >= 1) { this.land(); return; }
    }
    this.drawLine();
    this.renderUI(reelIn);
    // the ring of a splash spreading
    if (this.ring.material.opacity > 0) { this.ring.material.opacity -= dt * 0.9; this.ring.scale.multiplyScalar(1 + dt * 2.2); }
  }
  splash(at, o) { this.ring.position.set(at.x, 0.03, at.z); this.ring.scale.setScalar(1); this.ring.material.opacity = o; }
  drawLine() {
    const a = this.tip, b = this.float.position, pos = this.lineGeo.attributes.position;
    const sag = this.state === 'reel' ? 0.2 * (1 - Math.min(1, this.tension)) : 0.9;
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      pos.setXYZ(i, a.x + (b.x - a.x) * t, a.y + (b.y + 0.05 - a.y) * t - Math.sin(t * Math.PI) * sag, a.z + (b.z - a.z) * t);
    }
    pos.needsUpdate = true;
    this.line.visible = this.state !== 'cast' || this.t > 0.1;
  }

  // ---------------------------------------------------------------- out of the water
  land() {
    const g = this.g, F = this.fish;
    this.stop(true);
    if (F.f.junk) { g.audio.sfx('pickup', { vol: 0.4 }); this.say(`${F.f.name}… Al contenedor con ella.`, 3); return; }
    const value = Math.max(1, Math.round(F.kg * F.f.eur * (PERK.price < 1 ? 1.1 : 1)));
    g.inv.add('pez', 1, { sp: F.f.id, name: F.f.name, kg: +F.kg.toFixed(2), value });
    const rec = g.save.fishRec || (g.save.fishRec = {});
    const record = !rec[F.f.id] || F.kg > rec[F.f.id];
    if (record) rec[F.f.id] = +F.kg.toFixed(2);
    g.save.fishN = (g.save.fishN || 0) + 1;
    g.persist();
    g.audio.sfx('money', { vol: 0.5 });
    g.hud.notify(`🐟 ¡${F.f.name} de ${fmtKg(F.kg)}! (≈ ${value} € en el mercado)${record && g.save.fishN > 1 ? ' · ¡tu récord!' : ''}`, 'gold', 4.5);
    if (g.save.fishN === 1) g.hint('fish2', 'El pescado va al <b>inventario</b>. En el puesto del <b>Mercado de Abastos</b> te lo compran al peso.', 9);
  }
  stop(caught = false) {
    const g = this.g, p = g.player;
    this.state = null;
    this.float.visible = false; this.line.visible = false;
    if (this.rod.parent) this.rod.parent.remove(this.rod);
    if (p.char) { if (p.char.base === 'fish') p.char.setBase(null); p.char.reeling = false; }
    this.showUI(false);
  }
  say(t, s = 2.2) { this.g.hud.notify(t, 'info', s); }

  // ---------------------------------------------------------------- the tension bar
  showUI(on) {
    if (!this.ui) {
      const el = document.createElement('div');
      el.id = 'fishUI';
      el.innerHTML = '<div class="fTitle"></div><div class="fBar"><b class="fT"></b><i class="fZone"></i></div><div class="fProg"><b></b></div><small class="fHelp"></small>';
      document.getElementById('hud').appendChild(el);
      this.ui = el;
    }
    this.ui.hidden = !on;
  }
  renderUI(reelIn) {
    const u = this.ui, g = this.g;
    if (!u) return;
    const dev = g.input.device;
    const key = dev === 'touch' ? 'el botón de golpear' : dev === 'pad' ? g.input.padName(0) : 'E (o el clic)';
    const st = this.state;
    u.querySelector('.fTitle').textContent = st === 'reel' ? (this.fish && this.fish.f.junk ? 'Algo pesa…' : '¡Un pez!') : st === 'bite' ? '¡PICA!' : 'Esperando a que pique…';
    u.classList.toggle('bite', st === 'bite');
    u.querySelector('.fBar').style.visibility = st === 'reel' ? 'visible' : 'hidden';
    u.querySelector('.fProg').style.visibility = st === 'reel' ? 'visible' : 'hidden';
    u.querySelector('.fT').style.width = Math.min(100, this.tension * 100) + '%';
    u.querySelector('.fT').className = 'fT' + (this.tension > 0.8 ? ' hot' : '');
    u.querySelector('.fProg b').style.width = Math.min(100, this.progress * 100) + '%';
    u.querySelector('.fHelp').textContent = st === 'reel' ? `Mantén ${key} para recoger · suéltalo cuando tire fuerte` : st === 'bite' ? `¡Pulsa ${key}!` : `Pulsa ${key} para recoger el sedal · muévete para dejarlo`;
  }

  // ---------------------------------------------------------------- the fish stall at the Mercado de Abastos
  setupMarket(activities) {
    const lm = this.g.world.landmarks.poi;
    const m = lm.mercado && activities.doorOf(lm.mercado);
    if (m) this.market = m;
  }
  marketOption() {
    const g = this.g, p = g.player, m = this.market;
    if (!m || Math.hypot(m.x - p.pos.x, m.z - p.pos.z) > 3) return null;
    const fish = g.inv.fish();
    if (!fish.length) return { label: 'El puesto de pescado del mercado: te compran lo que pesques en el pantano', info: true };
    const total = fish.reduce((a, f) => a + f.value, 0);
    return { label: `Vender el pescado en el mercado <small>(${fish.length} ${fish.length === 1 ? 'pieza' : 'piezas'}, ${total} €)</small>`, run: () => this.sellAll() };
  }
  sellAll() {
    const g = this.g, fish = g.inv.fish();
    const total = fish.reduce((a, f) => a + f.value, 0);
    for (const f of fish) g.inv.removeEntry(f);
    g.player.money += total;
    g.audio.sfx('money');
    g.hud.subtitle('La pescadera', pick(['¡Qué buen género! Esto me lo quitan de las manos.', 'Del pantano, ¿eh? Se nota, está fresquísimo.', 'Venga, te lo pago bien, que vienes mucho.']));
    setTimeout(() => g.hud.subtitle(null), 3000);
    g.hud.notify(`Vendes ${fish.length} ${fish.length === 1 ? 'pieza' : 'piezas'} de pescado: +${total} €`, 'ok', 3.5);
    g.persist();
  }
}

// Sitting down: the terrace chairs of the bars, the benches of plazas and parks, the chairs the neighbours put out at
// their doors in the evening (sit with them and listen). At a bar terrace a waiter comes out to take the order; the
// drink arrives on your table. In multiplayer your friends see you sitting and hear what you order.
import * as THREE from 'three';
import { PERK } from './perks.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const MENU = [
  { id: 'cana', name: 'Una caña', price: 1.5, hp: 8, say: '¡Una caña bien fría!', cup: 'beer' },
  { id: 'cafe', name: 'Un café con leche', price: 1.3, hp: 4, stamina: true, say: 'Un café con leche, por favor.', cup: 'cup' },
  { id: 'tinto', name: 'Un tinto de verano', price: 2, hp: 8, say: 'Un tinto de verano.', cup: 'wine' },
  { id: 'refresco', name: 'Un refresco', price: 1.8, hp: 6, say: 'Un refresco con hielo.', cup: 'soda' },
  { id: 'pitarra', name: 'Un vasino de pitarra', price: 1, hp: 6, say: '¡Un vasino de pitarra!', cup: 'wine' },
  { id: 'migas', name: 'Una tapa de migas', price: 3, hp: 22, say: 'Ponme una tapa de migas.', cup: 'plate' },
  { id: 'torta', name: 'Torta del Casar con pan', price: 4.5, hp: 28, say: 'Una de torta del Casar.', cup: 'plate' },
  { id: 'churros', name: 'Churros con chocolate', price: 3, hp: 20, say: 'Churros con chocolate, que me muero.', cup: 'cup' },
];
const WAITER = { gender: 'm', skin: 1, hair: 1, hairStyle: 'corto', top: '#f4f4f0', topStyle: 'shirt', bottom: '#1d1f24', bottomStyle: 'pants', shoes: '#111111', build: 1.0 };
const GREET = ['¡Buenas! ¿Qué te pongo?', '¿Qué va a ser?', '¡Hola, hola! ¿Qué os pongo?', 'Dime, ¿qué tomas?'];
const SERVE = ['Aquí tienes. ¡Que aproveche!', 'Marchando… ¡aquí está!', 'Esto es gloria bendita, ya verás.'];

export class Seats {
  constructor(game) {
    this.game = game;
    this.seats = [];
    this.waiter = null;
    this.menuOpen = false;
    this.sel = 0;
    this.cups = [];
    this.ui = null;
    this.mats = {
      glass: new THREE.MeshStandardMaterial({ color: 0xdde8ee, roughness: 0.08, transparent: true, opacity: 0.55 }),
      beer: new THREE.MeshStandardMaterial({ color: 0xe8a62a, roughness: 0.3, emissive: 0x3a2206, emissiveIntensity: 0.2 }),
      foam: new THREE.MeshStandardMaterial({ color: 0xfbf6ea, roughness: 0.9 }),
      wine: new THREE.MeshStandardMaterial({ color: 0x6e1420, roughness: 0.25 }),
      soda: new THREE.MeshStandardMaterial({ color: 0x3a1a0e, roughness: 0.25 }),
      cup: new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.35 }),
      plate: new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.4 }),
      food: new THREE.MeshStandardMaterial({ color: 0xc88a3a, roughness: 0.8 }),
    };
  }

  setup() {
    const g = this.game, w = g.world, A = g.activities;
    const bars = A.bars || [];
    for (const c of (w.streetLifeDebug && w.streetLifeDebug.chairs) || []) {
      let bar = null, bd = 16;
      for (const b of bars) { const d = Math.hypot(b.x - c.x, b.z - c.z); if (d < bd) { bd = d; bar = b; } }
      this.seats.push({ kind: 'terraza', x: c.x, z: c.z, h: c.a, tx: c.tx, tz: c.tz, bar });
    }
    for (const s of w.spawnSpots || []) if (s.kind === 'bench') this.seats.push({ kind: 'banco', x: s.x + Math.sin(s.ang) * 0.12, z: s.z + Math.cos(s.ang) * 0.12, h: s.ang, bench: s });
    this.buildUI();
  }

  // a free seat right here: terrace chairs, benches, the neighbours' chairs when they are out, a sofa at home
  near(x, z) {
    const g = this.game;
    let best = null, bd = 1.25;
    const test = (s) => { const d = Math.hypot(s.x - x, s.z - z); if (d < bd && !s.taken) { bd = d; best = s; } };
    if (g.interior) {
      for (const s of (g.interior.pieces && g.interior.pieces.seat) || []) if (Math.abs((s.y || 0) - g.player.pos.y) < 0.8) test({ kind: 'casa', x: s.x, z: s.z, h: s.h, y: s.y, ref: s });
      return best;
    }
    for (const s of this.seats) {
      if (Math.abs(s.x - x) > 2 || Math.abs(s.z - z) > 2) continue;
      if (s.bench && s.bench.used) continue; // somebody is sitting there
      test(s);
    }
    // the neighbours' chairs out at their doors
    for (const grp of g.peds.frescoGroups || []) {
      (grp.seats || grp.spot.seats).forEach((st, i) => {
        if (grp.members.some((m) => m.seatIndex === i)) return;
        test({ kind: 'fresco', x: st.x, z: st.z, h: st.ang, grp });
      });
    }
    return best;
  }

  sit(s) {
    const g = this.game, p = g.player;
    p.sitOn(s);
    this.cur = s;
    s.taken = true;
    if (s.kind === 'terraza' && s.bar && s.bar.cd <= 0) this.callWaiter(s);
    if (s.kind === 'fresco' && s.grp) { g.peds.say(s.grp.members[0] || { x: s.x, z: s.z }, pick(['¡Siéntate, {hijo|hija}, siéntate!', 'Anda, siéntate un ratino con nosotros.', '¡Mira quién viene a tomar el fresco!']), true); }
    if (g.net && g.net.active) g.net.send({ t: 'ev', k: 'chat', text: s.kind === 'terraza' ? '(se sienta en la terraza)' : '(se sienta)' });
  }
  standUp() {
    const g = this.game, s = this.cur;
    if (s) s.taken = false;
    this.cur = null;
    this.closeMenu();
    if (this.waiter && this.waiter.state !== 'leave') this.waiterLeave();
    g.player.standUp();
  }

  // ------------------------------------------------------------ the waiter
  callWaiter(s) {
    const g = this.game, b = s.bar;
    if (this.waiter) return;
    const char = g.chars.create({ ...WAITER, skin: Math.floor(Math.random() * 4), hair: Math.floor(Math.random() * 4) });
    g.scene.add(char.object);
    this.waiter = { char, x: b.x, z: b.z, heading: 0, state: 'wait', t: 2.5 + Math.random() * 2.5, bar: b, seat: s, order: null };
    char.object.visible = false;
  }
  waiterLeave() {
    const w = this.waiter;
    if (!w) return;
    w.state = 'leave'; w.goal = { x: w.bar.x, z: w.bar.z };
  }
  openMenu() {
    const g = this.game;
    this.menuOpen = true; this.sel = 0;
    this.renderMenu();
    this.ui.hidden = false;
    g.hud.prompt('');
  }
  closeMenu() { this.menuOpen = false; if (this.ui) this.ui.hidden = true; }
  choose(i) {
    const g = this.game, p = g.player, it = MENU[i], w = this.waiter;
    if (!it || !w) return;
    const price = Math.max(1, Math.round(it.price * PERK.price * 10) / 10);
    if (p.money < price) { g.hud.notify('No te llega. El camarero pone mala cara.', 'info', 3); return; }
    this.closeMenu();
    w.order = { ...it, price };
    g.peds.say({ x: p.pos.x, z: p.pos.z, y: 0 }, it.say, true);
    g.peds.say(w, '¡Marchando!', true);
    if (g.net && g.net.active) g.net.send({ t: 'ev', k: 'chat', text: `(pide ${it.name.toLowerCase()})` });
    w.state = 'fetch'; w.goal = { x: w.bar.x, z: w.bar.z };
  }
  serve() {
    const g = this.game, p = g.player, w = this.waiter, it = w.order, s = w.seat;
    p.money -= it.price;
    p.health = Math.min(100, p.health + it.hp);
    if (it.stamina) p.stamina = 1;
    g.police.heat = Math.max(0, g.police.heat - 0.3);
    g.audio.sfx('money', { vol: 0.5 });
    g.hud.notify(`${it.name}: −${it.price.toFixed(it.price % 1 ? 2 : 0).replace('.', ',')} € · +${it.hp} de salud`, 'ok', 3.5);
    g.peds.say(w, pick(SERVE), true);
    // on the table
    const cx = (s.tx ?? s.x) + (s.x - (s.tx ?? s.x)) * 0.35, cz = (s.tz ?? s.z) + (s.z - (s.tz ?? s.z)) * 0.35;
    this.addCup(it.cup, cx, cz);
    w.bar.cd = 30;
    g.persist();
  }
  addCup(kind, x, z) {
    const g = this.game, M = this.mats, grp = new THREE.Group();
    if (kind === 'beer' || kind === 'wine' || kind === 'soda') {
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.13, 12), M.glass); glass.position.y = 0.065; grp.add(glass);
      const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.027, 0.1, 12), M[kind]); liq.position.y = 0.055; grp.add(liq);
      if (kind === 'beer') { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.02, 12), M.foam); f.position.y = 0.115; grp.add(f); }
    } else if (kind === 'cup') {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.07, 14), M.cup); c.position.y = 0.035; grp.add(c);
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.008, 16), M.plate); grp.add(pl);
    } else {
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.014, 18), M.plate); grp.add(pl);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.food); f.position.y = 0.01; f.scale.y = 0.5; grp.add(f);
    }
    grp.position.set(x, 0.74, z);
    g.scene.add(grp);
    this.cups.push({ grp, t: 90 });
  }

  update(dt) {
    const g = this.game, p = g.player, input = g.input;
    for (let i = this.cups.length - 1; i >= 0; i--) { const c = this.cups[i]; c.t -= dt; if (c.t <= 0 && Math.hypot(c.grp.position.x - p.pos.x, c.grp.position.z - p.pos.z) > 25) { g.scene.remove(c.grp); this.cups.splice(i, 1); } }
    // the order menu (keys 1-8, arrows / pad and E to pick, Esc to close)
    if (this.menuOpen) {
      for (let i = 0; i < MENU.length; i++) if (input.hit('Digit' + (i + 1))) { this.choose(i); return; }
      if (input.hit('ArrowDown') || input.gpPressed(13)) { this.sel = (this.sel + 1) % MENU.length; this.renderMenu(); }
      if (input.hit('ArrowUp') || input.gpPressed(12)) { this.sel = (this.sel + MENU.length - 1) % MENU.length; this.renderMenu(); }
      if (input.hit('KeyE') || input.hit('Enter') || input.gpPressed(0)) { this.choose(this.sel); return; }
      if (input.hit('Escape') || input.gpPressed(1)) { this.closeMenu(); g.peds.say(this.waiter || { x: p.pos.x, z: p.pos.z }, 'Nada, nada, gracias.', true); if (this.waiter) this.waiterLeave(); }
    }
    const w = this.waiter;
    if (!w) return;
    const o = w.char.object;
    let speed = 0;
    const walk = (goal, sp = 1.5) => {
      const dx = goal.x - w.x, dz = goal.z - w.z, d = Math.hypot(dx, dz);
      if (d < 0.35) return true;
      w.heading = Math.atan2(dx, dz);
      w.x += (dx / d) * Math.min(d, sp * dt); w.z += (dz / d) * Math.min(d, sp * dt);
      speed = sp;
      return false;
    };
    const s = w.seat;
    const table = { x: s.tx ?? s.x, z: s.tz ?? s.z };
    const beside = { x: table.x + (table.x - s.x) * 0.9 + (s.z - table.z) * 0.6, z: table.z + (table.z - s.z) * 0.9 - (s.x - table.x) * 0.6 };
    switch (w.state) {
      case 'wait': w.t -= dt; if (w.t <= 0) { w.state = 'come'; o.visible = true; } break;
      case 'come':
        if (walk(beside)) { w.state = 'ask'; w.heading = Math.atan2(p.pos.x - w.x, p.pos.z - w.z); g.peds.say(w, pick(GREET), true); this.openMenu(); }
        break;
      case 'ask': w.heading = Math.atan2(p.pos.x - w.x, p.pos.z - w.z); break;
      case 'fetch': if (walk(w.goal)) { w.state = 'pour'; w.t = 5 + Math.random() * 4; o.visible = false; } break;
      case 'pour': w.t -= dt; if (w.t <= 0) { w.state = 'bring'; o.visible = true; } break;
      case 'bring': if (walk(beside)) { this.serve(); w.state = 'leave'; w.goal = { x: w.bar.x, z: w.bar.z }; } break;
      case 'leave': if (walk(w.goal)) { g.scene.remove(o); w.char.dispose(); this.waiter = null; return; } break;
    }
    if (!this.cur && (w.state === 'come' || w.state === 'ask')) this.waiterLeave();
    w.char.update(dt, speed, {});
    o.position.set(w.x, 0, w.z);
    o.rotation.set(0, w.heading, 0);
  }

  // ------------------------------------------------------------ the order card
  buildUI() {
    if (this.ui || typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.id = 'orderMenu';
    el.hidden = true;
    document.getElementById('hud').appendChild(el);
    el.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) this.choose(+b.dataset.i); });
    this.ui = el;
  }
  renderMenu() {
    const g = this.game;
    const k = PERK.price;
    this.ui.innerHTML = `<h3>¿Qué te pongo?</h3>` + MENU.map((it, i) => `<button data-i="${i}" class="${i === this.sel ? 'on' : ''}"><kbd>${i + 1}</kbd><span>${it.name}</span><b>${(Math.max(1, Math.round(it.price * k * 10) / 10)).toFixed(it.price % 1 ? 2 : 0).replace('.', ',')} €</b></button>`).join('') + `<small>${g.input.gp ? 'Cruceta y A para pedir · B para nada' : '1–8 o clic para pedir · Esc: nada, gracias'}</small>`;
  }
}

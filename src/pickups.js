// Pick-ups: dropped cash, weapons (world spawns and ones dropped by the police), first-aid kits and vests.
// World pick-ups respawn a few minutes after being taken.
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';
import { buildGun } from './gunmodels.js';
import { PERK } from './perks.js';

const COLORS = { cash: 0x5fcf73, weapon: 0xf2b632, health: 0xff5a5a, armor: 0x6aa8ff };

function glowDisc(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  const col = new THREE.Color(color);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  g.addColorStop(0, `rgba(${rgb},0.9)`); g.addColorStop(0.5, `rgba(${rgb},0.35)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
}

function itemMesh(kind, id) {
  const g = new THREE.Group();
  const std = (c, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: c, emissiveIntensity: e });
  if (kind === 'cash') {
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.13), std(0x3f9a52, 0.25)); b.position.set((i - 1) * 0.03, 0.03 * i, (i % 2) * 0.03); b.rotation.y = i * 0.35; g.add(b); }
  } else if (kind === 'health') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.14), std(0xf4f4f0, 0.15)));
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.15), std(0xd52b2b, 0.4)); g.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.15), std(0xd52b2b, 0.4)); g.add(b);
  } else if (kind === 'armor') {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.14), std(0x2d4f8a, 0.2)); g.add(v);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.15), std(0xd8d8d8, 0.3)); s.position.y = 0.1; g.add(s);
  } else {
    // weapons: the same detailed model as in the hands, a little bigger so it reads from afar, shown side on
    const m = buildGun(id);
    if (m) {
      const big = id === 'pistola' ? 2.2 : 1.35;
      m.scale.setScalar(big);
      m.rotation.y = Math.PI / 2;
      // centre the model on the spot
      const bb = new THREE.Box3().setFromObject(m), c = bb.getCenter(new THREE.Vector3());
      m.position.sub(c);
      g.add(m);
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class Pickups {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    game.scene.add(this.root);
    this.list = [];
    this.discMats = {};
    this.discGeo = new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2);
    this.t = 0;
  }
  add(kind, x, z, opts = {}) {
    const obj = new THREE.Group();
    const m = itemMesh(kind, opts.id);
    m.position.y = 0.75;
    obj.add(m);
    const disc = new THREE.Mesh(this.discGeo, this.discMats[kind] || (this.discMats[kind] = glowDisc(COLORS[kind])));
    disc.position.y = 0.03;
    obj.add(disc);
    obj.position.set(x, 0, z);
    this.root.add(obj);
    const p = { kind, x, z, obj, item: m, id: opts.id, amount: opts.amount || 0, ttl: opts.ttl ?? Infinity, respawn: opts.respawn || 0, taken: false, phase: Math.random() * 6, blip: opts.blip };
    if (p.blip) this.game.hud.setBlip(p.blip, { x, z, label: opts.label || '•', color: '#' + new THREE.Color(COLORS[kind]).getHexString(), name: opts.name || '', edge: false, small: true });
    this.list.push(p);
    return p;
  }
  cash(x, z, amount) { return this.add('cash', x, z, { amount, ttl: 90 }); }
  weapon(x, z, id, ammo, opts = {}) { return this.add('weapon', x, z, { id, amount: ammo, ttl: opts.ttl ?? 60, ...opts }); }

  // fixed spots around Guareña (called once the mission places are known)
  setupWorld(P) {
    const map = this.game.map;
    const near = (pt, dx = 0, dz = 0) => {
      if (!pt) return null;
      const q = map.nearestEdge(pt.x + dx, pt.z + dz, 120, (e) => e.walk && !e.blocked);
      if (!q) return null;
      // just off the road centre, on the pavement side
      const d = map.sample(q.edge, q.s, {});
      const off = Math.min(q.edge.w / 2 + 0.8, 5);
      for (const side of [1, -1]) {
        const x = d.x - d.dz * off * side, z = d.z + d.dx * off * side;
        if (!map.buildingAt(x, z)) return { x, z };
      }
      return { x: d.x, z: d.z };
    };
    const spots = [
      ['weapon', 'bate', near(P.estadio, 12, 0), 'Bate'],
      ['weapon', 'pistola', near(P.pilar || P.sanGines), 'Pistola'],
      ['weapon', 'subfusil', near(P.poligono, -40, 20), 'Subfusil'],
      ['weapon', 'escopeta', near(P.pantano, 0, -30), 'Escopeta de corredera'],
      ['weapon', 'rifle', near(P.ermita || P.coop, -10, 14), 'Rifle de caza'],
      ['weapon', 'pistola', near(P.instituto || P.coop, 0, 18), 'Pistola'],
      ['armor', null, near(P.guardia, 25, -10), 'Chaleco'],
      ['armor', null, near(P.poligono, 30, -25), 'Chaleco'],
      ['health', null, near(P.salud, 6, 6), 'Botiquín'],
      ['health', null, near(P.plaza, 14, -8), 'Botiquín'],
      ['health', null, near(P.mercado || P.sanGregorio, 8, 0), 'Botiquín'],
    ];
    let i = 0;
    for (const [kind, id, pt, name] of spots) {
      if (!pt) continue;
      const ammo = id ? { pistola: 36, subfusil: 90, escopeta: 18, rifle: 15, bate: 0 }[id] : 0;
      this.add(kind, pt.x, pt.z, { id, amount: ammo, respawn: 240, blip: 'pk' + i++, name, label: kind === 'weapon' ? '' : kind === 'armor' ? 'C' : '+' });
    }
  }

  update(dt) {
    const g = this.game;
    this.t += dt;
    const p = g.player;
    const onFoot = !p.vehicle && p.mode === 'foot';
    for (let i = this.list.length - 1; i >= 0; i--) {
      const k = this.list[i];
      if (k.taken) {
        k.back -= dt;
        if (k.back <= 0) { k.taken = false; k.obj.visible = true; if (k.blip) g.hud.setBlip(k.blip, { ...(g.hud.blips.get(k.blip) || {}), hidden: false }); }
        continue;
      }
      k.ttl -= dt;
      if (k.ttl <= 0) { this.root.remove(k.obj); this.list.splice(i, 1); continue; }
      k.item.rotation.y = this.t * 1.8 + k.phase;
      k.item.position.y = 0.7 + Math.sin(this.t * 2.4 + k.phase) * 0.08;
      if (!onFoot) continue;
      const d = Math.hypot(k.x - p.pos.x, k.z - p.pos.z);
      if (d < 1.3) this.collect(k, i);
    }
  }
  collect(k, i) {
    const g = this.game;
    const p = g.player;
    if (k.kind === 'health' && p.health >= 100) return;
    if (k.kind === 'armor' && p.armor >= 100) return;
    if (k.kind === 'cash') { const n = Math.round(k.amount * PERK.luck); p.money += n; g.audio.sfx('money'); g.hud.notify(`+${n} €${PERK.luck > 1 ? ' · ¡qué suerte!' : ''}`, 'ok', 2); }
    else if (k.kind === 'health') { p.health = Math.min(100, p.health + 50); g.audio.sfx('pickup'); g.hud.notify('Botiquín: +50 de salud', 'ok', 2.5); }
    else if (k.kind === 'armor') { p.armor = 100; g.audio.sfx('pickup'); g.hud.notify('Chaleco antibalas', 'ok', 2.5); }
    else if (k.kind === 'weapon') {
      const had = g.weapons.has(k.id);
      g.weapons.give(k.id, k.amount);
      if (!had) g.weapons.select(k.id);
      g.audio.sfx('pickup');
      g.hud.notify(had ? `Munición: ${WEAPONS[k.id].name}` : `Nueva arma: ${WEAPONS[k.id].name}`, 'gold', 3);
      g.hud.weapon(true);
      if (!had) g.hint('weapons', g.input.device === 'touch' ? '<b>Armas</b>: toca <b>Arma</b> para cambiar y <b>Golpe</b> para disparar (apunta solo).' : g.input.device === 'pad' ? `<b>Armas</b>: ${g.input.key('', 5)} / ${g.input.key('', 4)} para cambiar. Mantén ${g.input.key('', 6)} para apuntar (con el rifle, por la mira telescópica) y ${g.input.key('', 7)} para disparar; apuntando, ${g.input.key('', 2)} recarga.` : '<b>Armas</b>: rueda del ratón, <kbd>Q</kbd> o <kbd>1</kbd>–<kbd>6</kbd> para cambiar. Mantén el <b>botón derecho</b> para apuntar (con el rifle, por la mira telescópica) y <b>clic</b> para disparar. <kbd>R</kbd> recarga.', 10);
    }
    if (k.respawn) { k.taken = true; k.back = k.respawn; k.obj.visible = false; if (k.blip) g.hud.setBlip(k.blip, { ...(g.hud.blips.get(k.blip) || {}), hidden: true }); }
    else { this.root.remove(k.obj); this.list.splice(i, 1); }
    g.persist();
  }
}

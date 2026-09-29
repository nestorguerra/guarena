// "El apagón de Guareña": a first-person horror night locked inside an old house (inspired by the night-shift,
// restore-the-power and read-the-notes structure of indie retro horror). Two levels:
//   terror  — the woman in white appears, stares and vanishes; the scares drain your nerve (cordura).
//   extremo — she stalks you: she only moves while you are not lighting her, faster in the dark; hide in wardrobes.
// Find the 3 fuses, restore the power at the fuse box, read the notes, find the street-door key and get out.
import * as THREE from 'three';

const NOTES = [
  { id: 'abuela', title: 'Nota en la nevera', text: 'Si se va la luz, NO abras la puerta aunque llamen.\n\nLos fusibles de repuesto los guardé por la casa: uno en la cocina, otro en el baño y otro en el cuarto pequeño.\n\nNo tardes. Ella no soporta la luz.\n\n— La abuela' },
  { id: 'diario', title: 'Recorte de prensa', text: 'EL DIARIO DE LAS VEGAS · 14 de mayo de 1996\n\nMUERE UNA JOVEN EN LA CURVA DEL PANTANO\n\nLa chica, de 19 años, volvía a pie de la romería de San Isidro con un vestido blanco. Testigos vieron un coche que no se detuvo. El conductor nunca fue identificado.' },
  { id: 'pagina', title: 'Página de un diario', text: 'Desde la romería no duermo.\n\nLa recogí en la curva, llevaba el vestido blanco. Me dijo «cuidado con la curva» y cuando giré la cabeza el asiento estaba vacío.\n\nPero aquella curva… aquella curva la tomé yo.' },
  { id: 'carta', title: 'Carta sin terminar', text: 'Cada vez que hay apagón en Guareña, vuelve.\n\nSe para al final del pasillo y me mira. Si la alumbras, se queda quieta. Si se hace oscuro… camina.\n\nHe aprendido a esconderme en el armario. Ella no mira dentro.' },
  { id: 'final', title: 'Nota arrugada', text: 'La llave de la puerta de la calle la tiré al pozo del patio la última noche, para no salir a buscarla.\n\nSi alguien lee esto: da la luz antes de bajar al pozo.\n\nY no la mires a los ojos.' },
];

// the woman in white (pale skin, long black hair, white dress)
const GHOST_DESC = { gender: 'f', skin: 0, skinColor: '#e6e2dc', hair: 0, hairColor: '#050505', hairStyle: 'largo', top: '#f2f0ea', topStyle: 'blouse', bottom: '#f2f0ea', bottomStyle: 'skirt', shoes: '#e8e4dc', eyes: '#040404', build: 0.9, height: 1.0 };

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Horror {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.ui = {
      hud: document.getElementById('hhud'), bat: document.getElementById('hBat'), inv: document.getElementById('hInv'), fear: document.getElementById('hFear'),
      note: document.getElementById('note'), noteT: document.getElementById('noteTitle'), noteB: document.getElementById('noteBody'),
      end: document.getElementById('hEnd'), endT: document.getElementById('hEndTitle'), endS: document.getElementById('hEndSub'),
      flash: document.getElementById('hFlash'), grain: document.getElementById('grain'),
    };
    if (this.ui.note) this.ui.note.addEventListener('click', () => this.closeNote());
    // film grain texture for the retro look
    if (this.ui.grain) {
      const c = document.createElement('canvas'); c.width = c.height = 160;
      const x = c.getContext('2d'), d = x.createImageData(160, 160);
      for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      x.putImageData(d, 0, 0);
      this.ui.grain.style.backgroundImage = `url(${c.toDataURL()})`;
    }
    const b = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    b('hRetry', () => { this.hideEnd(); this.game.retryMode(); });
    b('hMenu', () => { this.hideEnd(); this.game.setMode('normal'); this.game.ui.onMenu && this.game.ui.onMenu(); });
    b('hTown', () => { this.hideEnd(); this.game.setMode('normal', { dawn: true }); });
  }

  // ---------------------------------------------------------------- start / stop
  async start(level = 'terror') {
    const g = this.game;
    this.stop(true);
    this.level = level;
    this.extreme = level === 'extremo';
    this.active = true;
    g.horror = this;
    this.t = 0;
    this.fuses = 0; this.notes = new Set(); this.hasKey = false; this.power = false; this.bat = 100; this.fear = 100; this.lampOn = true;
    this.stage = 'wake';
    this.nextScare = this.extreme ? 14 : 22;
    this.scares = 0;
    this.hiding = null;
    this.dead = false;
    this.ended = false;
    this.readingNote = false;
    this.amb = { creak: 5 + Math.random() * 5, wind: 9 + Math.random() * 8, clock: 0 };
    // extreme: she only starts walking once you have had time to get up (the first minute is not a death trap)
    this.grace = this.extreme ? 22 : 0;
    // the house (locked), night, blackout, first person, retro filter
    g.sky.hour = 2.1;
    g.police.clear();
    const fade = g.interiors.fadeEl;
    if (fade) { fade.style.transitionDuration = '0ms'; fade.classList.add('on'); }
    const h = await g.interiors.enter(null, { kind: 'apagon', seed: 1996 + (this.extreme ? 7 : 0), silent: true, spot: 'wake' });
    this.house = h;
    g.interiors.lightsOn(false);
    const p = g.player;
    p.health = 100; p.armor = 0;
    if (g.weapons) { g.weapons.select('punos'); }
    g.cam.setFirstPerson(g.cam.fpPref ?? true);
    g.cam.yaw = Math.PI / 2 + Math.PI; g.cam.pitch = -0.1; // facing the bedroom door
    p.heading = g.cam.forwardYaw;
    this.buildItems();
    this.buildGhost();
    this.buildLamp();
    g.setRetro(true, this.extreme ? 1 : 0.8);
    document.body.classList.add('horror');
    this.ui.hud && (this.ui.hud.hidden = false);
    g.audio.loadSamples(['horror_amb', 'breath', 'scream', 'sting1', 'sting2', 'ghost', 'static', 'chant', 'breaker_on', 'breaker_off', 'moan1', 'moan2']).then(() => g.audio.loop('horror', 'horror_amb', this.extreme ? 0.55 : 0.4));
    this.wakeUp();
    g.hud.banner(this.extreme ? 'TERROR EXTREMO' : 'EL APAGÓN', this.extreme ? 'No dejes que se acerque en la oscuridad' : 'Guareña se ha quedado a oscuras', 'dead', 3.5);
    g.hud.objectiveText('Se ha ido la luz en todo el pueblo. <b>Busca el cuadro eléctrico</b> junto a la puerta de la calle.');
    setTimeout(() => this.active && g.hud.help((g.input.device === 'touch' ? 'Toca <b>Linterna</b>' : g.input.key('L', 14)) + ' enciende o apaga la linterna del móvil (gasta batería). ' + (g.input.device === 'touch' ? '' : g.input.key('V', 13) + ' cambia entre primera y tercera persona. ') + (this.extreme ? 'Si se acerca, <b>escóndete en un armario</b>.' : 'No pierdas los nervios.'), 9), 3800);
    setTimeout(() => this.active && g.hud.subtitle('Móvil', '(mensaje de mamá) «¿Estás bien? Hay apagón en toda Guareña. No salgas, que dicen que hay alguien por las calles.»'), 7000);
    setTimeout(() => this.active && g.hud.subtitle(null), 13000);
  }

  // eyes opening in the dark bedroom: two slow blinks, a breath, a creak somewhere in the house
  wakeUp() {
    const g = this.game, f = g.interiors.fadeEl;
    const at = (ms, fn) => setTimeout(() => { if (this.active && !this.ended) fn(); }, ms);
    at(900, () => g.audio.sample('breath', { vol: 0.55, ui: true }));
    if (!f) return;
    const blink = (on, ms) => { f.style.transitionDuration = ms + 'ms'; f.classList.toggle('on', on); };
    at(400, () => blink(false, 1400));
    at(1900, () => blink(true, 180));
    at(2250, () => blink(false, 900));
    at(2600, () => g.audio.sfx('creak', { x: g.player.pos.x + 3, z: g.player.pos.z + 2, vol: 0.8 }));
    at(3400, () => { f.style.transitionDuration = ''; });
    g.hud.subtitle('', '(Te despiertas. Está todo oscuro y no hay luz en la casa…)');
    at(4200, () => g.hud.subtitle(null));
  }

  stop(quiet = false) {
    const g = this.game;
    if (!this.active && quiet) return;
    this.active = false;
    if (this.ghost) { g.scene.remove(this.ghost.char.object); this.ghost.char.dispose(); this.ghost = null; }
    if (this.lamp) { g.scene.remove(this.lamp); g.scene.remove(this.lamp.target); this.lamp = null; }
    for (const it of this.items || []) if (it.mesh && it.mesh.parent) it.mesh.parent.remove(it.mesh);
    this.items = [];
    g.audio.loopStop('horror'); g.audio.loopStop('chant');
    const f = g.interiors.fadeEl;
    if (f) { f.style.transitionDuration = ''; f.classList.remove('on'); }
    g.setRetro(false);
    document.body.classList.remove('horror');
    if (this.ui.hud) this.ui.hud.hidden = true;
    this.closeNote(true);
    g.player.hidden = false;
    if (g.interior) g.interiors.leave();
    g.horror = null;
    g.hud.objectiveText(null); g.hud.subtitle(null);
  }

  // ---------------------------------------------------------------- props
  buildItems() {
    const g = this.game, h = this.house, S = h.spots;
    this.items = [];
    const glint = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4 });
    const add = (type, at, extra = {}) => {
      let mesh;
      if (type === 'fuse') { mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10), glint(0xd8d0b0)); mesh.rotation.z = Math.PI / 2; }
      else if (type === 'note') { mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.26), new THREE.MeshStandardMaterial({ color: 0xf2ecd8, emissive: 0x6a6450, emissiveIntensity: 0.25, side: THREE.DoubleSide })); mesh.rotation.x = -Math.PI / 2 + 0.1; }
      else if (type === 'battery') { mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.04), glint(0x3a8a4a)); }
      mesh.position.set(at.x, at.y ?? 0.8, at.z);
      g.interiors.root.add(mesh);
      const it = { type: 'item', item: type, x: at.x, z: at.z, r: 0.95, mesh, ...extra };
      h.inter.push(it);
      this.items.push(it);
      return it;
    };
    const room = (name, dx = 0, dz = 0, y = 0.8) => ({ x: (S[name].x ?? 0) + dx, z: (S[name].z ?? 0) + dz, y });
    // fuses: kitchen, bathroom, small bedroom (as the grandmother's note says)
    add('fuse', room('cocina', -0.4, 0.2, 0.8), { label: 'Coger el fusible' });
    add('fuse', room('bano', 0.4, 0.6, 0.62), { label: 'Coger el fusible' });
    add('fuse', { x: S.dorm3.x - 0.1, z: S.dorm3.z + 0.35, y: 0.62 }, { label: 'Coger el fusible' });
    // notes
    const noteSpots = [room('cocina', 1.4, 0.9, 1.25), room('salon', -0.4, -0.4, 0.46), { x: S.dorm1.x + 0.9, z: S.dorm1.z - 1.1, y: 0.58 }, { x: S.dorm3.x - 1.3, z: S.dorm3.z - 0.95, y: 0.8 }, room('despensa', 0.6, 0.2, 0.9)];
    NOTES.forEach((n, i) => add('note', noteSpots[i], { note: n, label: 'Leer: ' + n.title }));
    // batteries
    add('battery', room('salon', -1.2, 1.2, 0.2), { label: 'Coger pilas' });
    add('battery', room('pasillo', -0.4, -1.8, 0.85), { label: 'Coger pilas' });
    if (!this.extreme) add('battery', room('dorm2', -0.6, 0.8, 0.6), { label: 'Coger pilas' });
  }

  buildGhost() {
    const g = this.game;
    const ch = g.chars.create(GHOST_DESC);
    g.scene.add(ch.object);
    ch.setBase('ghost');
    ch.object.visible = false;
    this.ghost = { char: ch, x: 0, z: 0, visible: false, timer: 0, mode: 'away', seen: 0, speed: 0 };
  }

  buildLamp() {
    const g = this.game;
    const l = new THREE.SpotLight(0xfff2dc, 38, 16, 0.52, 0.55, 1.4);
    l.castShadow = g.q.shadows > 1;
    if (l.castShadow) { l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.0005; }
    g.scene.add(l); g.scene.add(l.target);
    this.lamp = l;
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    if (!this.active || this.ended || !this.lamp) return; // still setting the house up
    const g = this.game, p = g.player, input = g.input;
    this.t += dt;
    // flashlight: follows the camera
    if (input.flashlight) { this.lampOn = !this.lampOn; g.audio.sfx('flashlight'); }
    const cam = g.camera;
    const fwd = this._f || (this._f = new THREE.Vector3());
    cam.getWorldDirection(fwd);
    this.lamp.position.copy(cam.position).addScaledVector(fwd, 0.1);
    this.lamp.position.y -= 0.12;
    this.lamp.target.position.copy(cam.position).addScaledVector(fwd, 6);
    const drain = (this.extreme ? 0.55 : 0.28) * dt;
    if (this.lampOn && this.bat > 0) this.bat = Math.max(0, this.bat - drain);
    let li = this.lampOn && this.bat > 0 ? 38 : 0;
    if (li && this.bat < 20 && Math.random() < 0.08) li *= Math.random() * 0.3; // dying battery flicker
    if (li && this.ghost.visible && this.ghost.near && Math.random() < 0.25) li *= Math.random(); // she makes it flicker
    this.lamp.intensity = li;
    // fear / nerve
    const lit = this.power || li > 0;
    this.fear = Math.min(100, this.fear + dt * (this.power ? 3 : lit ? 0.8 : -0.6));
    if (this.grace > 0) {
      this.grace -= dt;
      if (this.grace <= 0 && this.ghost.mode === 'away') {
        this.placeGhostFar();
        g.audio.sample('moan2', { x: this.ghost.x, z: this.ghost.z, vol: 1 });
        g.hud.subtitle('', '(algo se ha levantado al otro lado de la casa…)');
        setTimeout(() => g.hud.subtitle(null), 3000);
      }
    }
    this.updateAmbience(dt);
    this.updateGhost(dt, li > 0);
    this.updateScares(dt);
    if (this.hiding) { p.pos.set(this.hiding.hx, 0, this.hiding.hz); p.vel.set(0, 0, 0); }
    // HUD
    if (this.ui.bat) { this.ui.bat.style.width = this.bat + '%'; this.ui.bat.classList.toggle('low', this.bat < 20); }
    if (this.ui.fear) this.ui.fear.style.width = this.fear + '%';
    if (this.ui.inv) {
      const txt = `Fusibles ${this.fuses}/3 · Notas ${this.notes.size}/${NOTES.length} · Llave ${this.hasKey ? '✓' : '✗'}`;
      if (txt !== this._invTxt) { this._invTxt = txt; this.ui.inv.textContent = txt; }
    }
    if (this.ui.grain) this.ui.grain.style.backgroundPosition = `${(Math.random() * 200) | 0}px ${(Math.random() * 200) | 0}px`;
    if (this.fear <= 0 && !this.dead) this.caught('Has perdido los nervios');
  }

  // is a world point on screen and lit / seen?
  viewDot(x, y, z) {
    const cam = this.game.camera;
    const f = this._f;
    const dx = x - cam.position.x, dy = y - cam.position.y, dz = z - cam.position.z, d = Math.hypot(dx, dy, dz) || 1;
    return (dx * f.x + dy * f.y + dz * f.z) / d;
  }
  lineOfSight(x, z) {
    const p = this.game.player;
    return this.game.map.collider.raycast(p.pos.x, p.pos.z, x, z, 1.4, 1.4) > 0.98;
  }

  placeGhost(x, z) {
    const gh = this.ghost;
    gh.x = x; gh.z = z;
    gh.char.object.position.set(x, 0, z);
    const p = this.game.player;
    gh.char.object.rotation.set(0, Math.atan2(p.pos.x - x, p.pos.z - z), 0);
  }
  placeGhostFar() {
    const F = this.house.spots.floor, p = this.game.player;
    const spots = ['patio', 'cocina', 'dorm2', 'salon', 'despensa', 'bano', 'dorm3'].map((k) => F[k]).filter(Boolean);
    spots.sort((a, b) => Math.hypot(b.x - p.pos.x, b.z - p.pos.z) - Math.hypot(a.x - p.pos.x, a.z - p.pos.z));
    const s = spots[Math.floor(Math.random() * 2)];
    this.placeGhost(s.x, s.z);
    this.ghost.char.object.visible = true;
    this.ghost.visible = true;
    this.ghost.mode = 'stalk';
  }

  // corridor-aware steering: from a room go to its door, then along the corridor, then into the target room
  waypoint(fromX, fromZ, toX, toZ) {
    const o = this.house.origin;
    let lx = fromX - o.x, tx = toX - o.x, lz = fromZ - o.z, tz = toZ - o.z;
    const inCorr = (x) => Math.abs(x) < 0.7;
    // the patio only connects through its door at the end of the corridor (x -0.5..0.5, z 11)
    const inPatio = (z) => z > 11.05;
    if (inPatio(lz) !== inPatio(tz)) {
      if (inPatio(lz)) {
        if (Math.abs(lx) > 0.25 || lz > 11.7) return { x: o.x, z: o.z + 11.5 };
        return { x: o.x, z: o.z + 10.4 };
      }
      if (inCorr(lx) && lz > 9.6) return { x: o.x, z: o.z + 11.8 };
      tx = 0; tz = 10.6; toX = o.x; toZ = o.z + 10.6; // first the end of the corridor
    }
    if (Math.sign(lx) !== Math.sign(tx) || (!inCorr(lx) && Math.abs(lz - tz) > 1.2) || (inCorr(lx) !== inCorr(tx))) {
      // each room has one door on the corridor wall (rooms by their z range)
      const roomDoor = (x, z) => (x < 0 ? (z < 4.6 ? 2.6 : z < 8.2 ? 6.8 : 9.4) : (z < 4 ? 2.2 : z < 6.4 ? 5.2 : z < 9.2 ? 7.6 : 10.1));
      if (!inCorr(lx)) {
        // head to this room's door on the corridor wall
        const dz = roomDoor(lx, lz);
        if (Math.abs(lx) > 0.95) return { x: o.x + Math.sign(lx) * 0.9, z: o.z + dz };
        return { x: o.x, z: o.z + dz };
      }
      if (!inCorr(tx)) {
        const dz = roomDoor(tx, tz);
        if (Math.abs(lz - dz) > 0.35) return { x: o.x, z: o.z + dz };
        return { x: o.x + Math.sign(tx) * 1.1, z: o.z + dz };
      }
    }
    return { x: toX, z: toZ };
  }

  updateGhost(dt, lampLit) {
    const g = this.game, p = g.player, gh = this.ghost;
    if (!gh) return;
    const ch = gh.char;
    if (!gh.visible) { ch.object.visible = false; return; }
    const d = Math.hypot(gh.x - p.pos.x, gh.z - p.pos.z);
    gh.near = d < 5;
    const vd = this.viewDot(gh.x, 1.2, gh.z);
    const los = this.lineOfSight(gh.x, gh.z);
    const seen = vd > 0.82 && los && !this.hiding;
    const litByLamp = seen && lampLit && vd > 0.88 && d < 12;
    ch.object.visible = true;
    ch.update(dt, gh.speed, {});
    ch.object.rotation.set(0, Math.atan2(p.pos.x - gh.x, p.pos.z - gh.z), 0);
    ch.lookAt && ch.lookAt(g.camera.position);
    // heartbeat when she is close
    gh.beat = (gh.beat || 0) - dt;
    if (d < 7 && gh.beat <= 0) { g.audio.sfx('heartbeat', { vol: 0.5 + (7 - d) / 10 }); gh.beat = 0.35 + d * 0.12; }
    if (gh.mode === 'appear') {
      gh.timer -= dt;
      if (seen) gh.seen += dt;
      if (gh.seen > 0.9 || d < 3.2 || gh.timer <= 0 || litByLamp && gh.seen > 0.3) {
        if (gh.seen > 0.2) { g.audio.sample('sting2', { vol: 0.6 }) || g.audio.sfx('door_slam'); this.fear -= this.extreme ? 12 : 9; }
        this.vanish();
      }
      return;
    }
    if (gh.mode === 'cross') {
      // she walks across a doorway / the end of the corridor and is gone
      gh.speed = 2.3;
      const dx = gh.tx - gh.x, dz = gh.tz - gh.z, l = Math.hypot(dx, dz);
      if (seen) gh.seen += dt;
      if (l < 0.15 || (gh.timer -= dt) <= 0) {
        if (gh.seen > 0.15) { this.fear -= this.extreme ? 9 : 7; g.audio.sample('sting1', { vol: 0.55 }); }
        this.vanish();
        return;
      }
      gh.x += (dx / l) * gh.speed * dt; gh.z += (dz / l) * gh.speed * dt;
      ch.object.position.set(gh.x, 0, gh.z);
      ch.object.rotation.set(0, Math.atan2(dx, dz), 0); // she does not look at you… this time
      return;
    }
    if (gh.mode === 'behind') {
      // right at your back: if you turn around in time you get a glimpse, then she's gone
      gh.timer -= dt;
      gh.speed = 0;
      if (vd > 0.55 && d < 2.5) {
        gh.seen += dt;
        if (gh.seen > 0.22) { g.audio.sample('sting2', { vol: 0.8 }) || g.audio.sfx('door_slam'); g.cam.shake(0.5); this.fear -= this.extreme ? 14 : 10; this.vanish(); }
      } else if (gh.timer <= 0) this.vanish();
      return;
    }
    if (gh.mode === 'jump') {
      gh.timer -= dt;
      this.placeGhost(p.pos.x + Math.sin(g.cam.forwardYaw) * 0.55, p.pos.z + Math.cos(g.cam.forwardYaw) * 0.55);
      if (gh.timer <= 0) this.vanish();
      return;
    }
    if (gh.mode === 'stalk') {
      // weeping-angel rule: frozen while lit by the flashlight; moves in the dark, faster when you're blind
      let sp = 0;
      if (this.hiding) {
        gh.lost = (gh.lost || 0) + dt;
        if (gh.lost > 5.5) { gh.lost = 0; this.placeGhostFar(); g.audio.sample('breath', { vol: 0.5 }); }
      } else if (!litByLamp) {
        sp = (lampLit ? 0.9 : 2.0) * (this.power ? 0.7 : 1);
      }
      gh.speed = sp;
      if (sp > 0) {
        const w = this.waypoint(gh.x, gh.z, p.pos.x, p.pos.z);
        const dx = w.x - gh.x, dz = w.z - gh.z, l = Math.hypot(dx, dz) || 1;
        const pos = this._gp || (this._gp = { x: 0, z: 0 });
        pos.x = gh.x + (dx / l) * sp * dt; pos.z = gh.z + (dz / l) * sp * dt;
        g.map.collider.resolveCircle(pos, 0.25);
        // wedged against furniture for too long: she simply is somewhere else (never frozen in place)
        const moved = Math.hypot(pos.x - gh.x, pos.z - gh.z);
        gh.stuck = moved < sp * dt * 0.2 ? (gh.stuck || 0) + dt : 0;
        gh.x = pos.x; gh.z = pos.z;
        ch.object.position.set(gh.x, 0, gh.z);
        if (gh.stuck > 1.5) { gh.stuck = 0; this.placeGhostFar(); }
      }
      if (d < 0.9 && !this.hiding) this.caught('Te ha alcanzado');
    }
  }

  vanish() {
    const gh = this.ghost;
    gh.char.object.visible = false;
    gh.visible = false;
    gh.mode = 'away';
    gh.seen = 0;
    gh.speed = 0;
    if (this.extreme) setTimeout(() => { if (this.active && !this.ended) this.placeGhostFar(); }, 5000 + Math.random() * 4000);
  }

  // an apparition in view, far away (end of the corridor, a doorway, the patio)
  appear() {
    const g = this.game, p = g.player, F = this.house.spots.floor, gh = this.ghost;
    const cands = [F.patio, F.pozo, F.salon, F.cocina, F.dorm2, F.bano, F.despensa, F.pasillo, F.entrada, F.dorm1, F.dorm3].filter(Boolean)
      .map((s) => ({ s, d: Math.hypot(s.x - p.pos.x, s.z - p.pos.z) }))
      .filter((c) => c.d > 4 && c.d < 14 && this.lineOfSight(c.s.x, c.s.z));
    const inView = cands.filter((c) => this.viewDot(c.s.x, 1.2, c.s.z) > 0.6);
    const c = (inView.length ? pick(inView) : pick(cands));
    if (!c) return false;
    this.placeGhost(c.s.x, c.s.z);
    gh.visible = true; gh.mode = 'appear'; gh.timer = 5 + Math.random() * 3; gh.seen = 0;
    g.audio.sample(Math.random() < 0.5 ? 'moan1' : 'moan2', { x: c.s.x, z: c.s.z, vol: 0.9 });
    return true;
  }

  // a figure crossing a doorway or the end of the corridor, 4–12 m away, in view
  cross() {
    const g = this.game, p = g.player, gh = this.ghost, o = this.house.origin;
    const lanes = [];
    // across the corridor, from a left room door to the right one opposite (or the reverse)
    for (const [zl, zr] of [[2.6, 2.2], [6.8, 7.6], [9.4, 10.1]]) {
      const a = { x: o.x - 1.4, z: o.z + zl }, b = { x: o.x + 1.4, z: o.z + zr };
      lanes.push(Math.random() < 0.5 ? [a, b] : [b, a]);
    }
    // across the patio behind the kitchen window / the patio door
    lanes.push([{ x: o.x - 3.8, z: o.z + 12.4 }, { x: o.x + 3.8, z: o.z + 12.4 }]);
    const ok = lanes.filter(([a, b]) => {
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, d = Math.hypot(mx - p.pos.x, mz - p.pos.z);
      return d > 3.5 && d < 13 && this.viewDot(mx, 1.2, mz) > 0.75 && this.lineOfSight(mx, mz);
    });
    if (!ok.length) return false;
    const [a, b] = pick(ok);
    this.placeGhost(a.x, a.z);
    gh.tx = b.x; gh.tz = b.z;
    gh.visible = true; gh.mode = 'cross'; gh.timer = 4; gh.seen = 0;
    g.audio.sfx('footstep', { x: a.x, z: a.z, vol: 0.5 });
    return true;
  }
  // a whisper at your back; turn around quickly and she is there
  behind() {
    const g = this.game, p = g.player, gh = this.ghost;
    const f = g.cam.forwardYaw;
    const bx = p.pos.x - Math.sin(f) * 1.05, bz = p.pos.z - Math.cos(f) * 1.05;
    const pos = { x: bx, z: bz };
    g.map.collider.resolveCircle(pos, 0.25);
    if (Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) < 0.7) return false; // back against a wall
    this.placeGhost(pos.x, pos.z);
    gh.visible = true; gh.mode = 'behind'; gh.timer = 2.2; gh.seen = 0;
    g.audio.sfx('whisper', { x: pos.x, z: pos.z, vol: 1.2 });
    setTimeout(() => this.active && g.audio.sample('breath', { x: pos.x, z: pos.z, vol: 0.7 }), 500);
    this.fear -= 3;
    return true;
  }

  // the house is never silent: creaking beams, gusts against the shutters, the grandfather clock in the salon
  updateAmbience(dt) {
    const g = this.game, p = g.player, S = this.house.spots, a = this.amb;
    a.creak -= dt; a.wind -= dt; a.clock -= dt;
    if (a.creak <= 0) {
      const ang = Math.random() * Math.PI * 2, r = 3 + Math.random() * 5;
      g.audio.sfx('creak', { x: p.pos.x + Math.sin(ang) * r, z: p.pos.z + Math.cos(ang) * r, vol: 0.5 + Math.random() * 0.4 });
      a.creak = (this.extreme ? 5 : 7) + Math.random() * 9;
    }
    if (a.wind <= 0) { g.audio.sfx('wind', { vol: 0.5 + Math.random() * 0.4 }); a.wind = 14 + Math.random() * 16; }
    if (a.clock <= 0 && S.clock) { a.clock = 1; g.audio.sfx('clock', { x: S.clock.x, z: S.clock.z, vol: 0.9 }); }
  }

  jumpscare() {
    const g = this.game, gh = this.ghost;
    gh.visible = true; gh.mode = 'jump'; gh.timer = 0.7;
    g.audio.sample('scream', { vol: 1.3, ui: true }) || g.audio.sfx('yelp_f', { vol: 2 });
    g.cam.shake(1.2);
    if (this.ui.flash) { this.ui.flash.classList.remove('on'); void this.ui.flash.offsetWidth; this.ui.flash.classList.add('on'); }
    this.fear -= this.extreme ? 30 : 24;
  }

  updateScares(dt) {
    const g = this.game, p = g.player;
    this.nextScare -= dt;
    if (this.nextScare > 0 || this.readingNote) return;
    this.scares++;
    const S = this.house.spots;
    const r = Math.random();
    const gh = this.ghost;
    const ghostBusy = gh.visible && gh.mode !== 'away' && gh.mode !== 'stalk';
    const free = !ghostBusy && gh.mode !== 'stalk';
    if (!ghostBusy && (this.scares % 4 === 0) && this.stage !== 'wake') this.jumpscare();
    else if (free && r < 0.2 && this.appear()) { /* apparition */ }
    else if (free && r < 0.34 && this.cross()) { /* crossing figure */ }
    else if (free && r < 0.44 && this.stage !== 'wake' && this.behind()) { /* at your back */ }
    else if (r < 0.54) { g.audio.sfx('knock', { x: S.entrada.x, z: S.entrada.z - 0.5, vol: 1.2 }); g.hud.subtitle('', '(alguien llama a la puerta de la calle)'); setTimeout(() => g.hud.subtitle(null), 2500); }
    else if (r < 0.66) {
      // a door you can see slams shut on its own (falls back to one somewhere else in the house)
      if (!g.interiors.slamNear(p.pos.x, p.pos.z, 9)) { const k = pick(['dorm2', 'bano', 'cocina', 'salon']); g.audio.sfx('door_slam', { x: S[k].x, z: S[k].z, vol: 1.1 }); }
      g.cam.shake(0.25); this.fear -= 5;
    }
    else if (r < 0.74) { this.phoneRing(); }
    else if (r < 0.81) { this.tvOn(); }
    else if (r < 0.87) { g.audio.sample('chant', { x: S.patio.x, z: S.patio.z, vol: 0.7 }); g.hud.subtitle('', '(susurros en el patio…)'); setTimeout(() => g.hud.subtitle(null), 3000); }
    else if (r < 0.93) { const k = pick(['despensa', 'dorm3', 'cocina', 'salon']); g.audio.sfx('thud', { x: S[k].x, z: S[k].z, vol: 1.2 }); g.cam.shake(0.15); this.fear -= 3; }
    else { for (let i = 0; i < 5; i++) setTimeout(() => this.active && g.audio.sfx('footstep', { x: p.pos.x + 4 - i * 0.6, z: p.pos.z - 3 + i * 0.5, vol: 0.8 }), i * 480); }
    this.nextScare = (this.extreme ? 9 : 16) + Math.random() * (this.extreme ? 10 : 16);
  }

  phoneRing() {
    const g = this.game;
    const ph = this.house.inter.find((i) => i.type === 'phone');
    if (!ph) return;
    ph.ringing = 6;
    let n = 0;
    const ring = () => { if (!this.active || !ph.ringing || n++ > 5) { ph.ringing = 0; return; } g.audio.sfx('phone_ring', { x: ph.x, z: ph.z, vol: 1 }); setTimeout(ring, 1300); };
    ring();
  }
  tvOn() {
    const g = this.game;
    const tv = this.house.inter.find((i) => i.type === 'tv');
    if (!tv) return;
    tv.mesh.material.emissiveIntensity = 1.2;
    g.audio.sample('static', { x: tv.x, z: tv.z, vol: 0.9 }) || g.audio.sfx('glass');
    setTimeout(() => { if (tv.mesh) tv.mesh.material.emissiveIntensity = 0; }, 5500);
  }

  // ---------------------------------------------------------------- interactions (called by the prompt system)
  option(it) {
    const g = this.game;
    if (this.hiding) return { label: 'Salir del armario', run: () => this.unhide() };
    switch (it.type) {
      case 'item':
        if (it.taken) return null;
        return { label: it.label, run: () => this.takeItem(it) };
      case 'fusebox':
        if (this.power) return { label: 'Cuadro eléctrico (hay luz)', info: true };
        if (this.stage === 'wake') this.setStage('fuses');
        return this.fuses >= 3
          ? { label: 'Poner los fusibles y subir el diferencial', run: () => this.powerOn() }
          : { label: `Faltan fusibles (${this.fuses}/3)`, info: true };
      case 'exit':
        return this.hasKey ? { label: 'Abrir la puerta con la llave', run: () => this.escape() } : { label: 'Está cerrada con llave', run: () => { g.audio.sfx('knock', { vol: 0.5 }); g.hud.notify('La puerta de la calle está cerrada con llave. No puedes salir.', 'info', 3); } };
      case 'hide': return { label: 'Esconderse en el armario', run: () => this.hide(it) };
      case 'well':
        if (this.hasKey) return { label: 'El pozo', info: true };
        if (!this.power) return { label: 'Está demasiado oscuro para bajar el cubo', info: true };
        return { label: 'Subir el cubo del pozo', run: () => this.takeKey() };
      case 'phone':
        return it.ringing ? { label: 'Coger el teléfono', run: () => this.answerPhone(it) } : { label: 'El teléfono no tiene línea', info: true };
      case 'tv': return { label: 'La tele no tiene corriente', info: true };
      case 'mirror': return { label: 'Mirarse al espejo', run: () => { if (Math.random() < 0.5 && !this.ghost.visible) this.jumpscare(); else g.hud.notify('Solo ves tu cara, pálida.', 'info', 2.5); } };
      case 'drawer': return it.used ? null : { label: 'Registrar los cajones', run: () => { it.used = true; g.hud.notify('Cubiertos oxidados… y una foto de una chica con vestido blanco.', 'info', 4); this.fear -= 5; } };
      default: return null;
    }
  }

  takeItem(it) {
    const g = this.game;
    it.taken = true;
    if (it.mesh && it.mesh.parent) it.mesh.parent.remove(it.mesh);
    const i = this.house.inter.indexOf(it); if (i >= 0) this.house.inter.splice(i, 1);
    if (it.item === 'fuse') {
      this.fuses++;
      g.audio.sfx('pickup');
      g.hud.notify(`Fusible ${this.fuses}/3`, 'gold', 2.5);
      if (this.stage === 'wake' || this.stage === 'fuses') this.setStage(this.fuses >= 3 ? 'power' : 'fuses');
    } else if (it.item === 'battery') {
      this.bat = Math.min(100, this.bat + 45);
      g.audio.sfx('pickup');
      g.hud.notify('Pilas para la linterna: +45 %', 'ok', 2.5);
    } else if (it.item === 'note') {
      this.notes.add(it.note.id);
      this.openNote(it.note);
    }
  }

  setStage(s) {
    const g = this.game;
    this.stage = s;
    const txt = {
      fuses: `El cuadro no tiene fusibles. <b>Encuentra los 3 fusibles</b> (${this.fuses}/3).`,
      power: 'Tienes los 3 fusibles. <b>Vuelve al cuadro eléctrico</b> para dar la luz.',
      key: 'Hay luz. <b>Busca la llave de la puerta</b>… quizá alguna nota diga dónde está.',
      out: '<b>¡Tienes la llave!</b> Sal por la puerta de la calle.',
    }[s];
    if (txt) g.hud.objectiveText(txt);
  }

  powerOn() {
    const g = this.game;
    this.power = true;
    g.audio.sample('breaker_on', { vol: 1 }) || g.audio.sfx('ui_select');
    g.interiors.lightsOn(true);
    g.hud.notify('Vuelve la luz.', 'ok', 3);
    this.setStage(this.hasKey ? 'out' : 'key');
    this.fear = Math.min(100, this.fear + 25);
    // …but not for long
    const off = () => {
      if (!this.active || this.ended || !this.power) return;
      g.audio.sample('breaker_off', { vol: 1 }) || g.audio.sfx('ui_back');
      g.interiors.lightsOn(false);
      this.power = false;
      g.hud.notify('Se ha vuelto a ir la luz…', 'police', 3);
      if (!this.ghost.visible) this.appear();
      this.fear -= 10;
      setTimeout(() => { if (this.active && !this.ended) { this.power = true; g.interiors.lightsOn(true); g.audio.sample('breaker_on', { vol: 0.8 }); } }, this.extreme ? 16000 : 9000);
    };
    setTimeout(off, (this.extreme ? 20 : 30) * 1000);
  }

  takeKey() {
    const g = this.game;
    this.hasKey = true;
    g.audio.sfx('pickup');
    g.hud.notify('En el fondo del cubo, entre el agua negra… ¡la llave de la calle!', 'gold', 4);
    this.setStage('out');
    // she doesn't want you to leave
    setTimeout(() => { if (this.active && !this.ended) { if (this.extreme) this.placeGhostFar(); else this.jumpscare(); } }, 2500);
  }

  answerPhone(it) {
    const g = this.game;
    it.ringing = 0;
    g.audio.sample('static', { vol: 0.7 });
    g.hud.subtitle('Teléfono', '… cuidado… con la curva…');
    this.fear -= 6;
    setTimeout(() => g.hud.subtitle(null), 3500);
  }

  hide(it) {
    const g = this.game, p = g.player;
    this.hiding = it;
    p.hidden = true;
    p.pos.set(it.hx, 0, it.hz);
    g.audio.sfx('door_close', { vol: 0.5 });
    g.cam.fovOverride = 55;
    document.body.classList.add('hiding');
  }
  unhide() {
    const g = this.game, p = g.player, it = this.hiding;
    this.hiding = null;
    p.hidden = false;
    p.pos.set(it.x, 0, it.z);
    g.audio.sfx('door_open', { vol: 0.5 });
    g.cam.fovOverride = 0;
    document.body.classList.remove('hiding');
  }

  openNote(n) {
    const g = this.game;
    g.audio.sfx('text_msg', { vol: 0.4 });
    if (!this.ui.note) return;
    this.ui.noteT.textContent = n.title;
    this.ui.noteB.textContent = n.text;
    const close = this.ui.note.querySelector('small');
    if (close) close.innerHTML = g.input.device === 'touch' ? 'Toca para cerrar' : `Pulsa ${g.input.key('E', 15)} para cerrar`;
    this.ui.note.hidden = false;
    this.readingNote = true;
    if (!this.extreme) g.timeScale = 0.0001; // time freezes while reading (not in extreme)
    g.input.exitLock && g.input.exitLock();
    if (n.id === 'final' && this.power) this.setStage('key');
  }
  closeNote(silent = false) {
    if (!this.ui.note || this.ui.note.hidden) return;
    this.ui.note.hidden = true;
    this.readingNote = false;
    this.game.timeScale = 1;
    if (!silent) this.game.input.requestLock && this.game.input.requestLock();
  }

  // ---------------------------------------------------------------- endings
  caught(why) {
    const g = this.game;
    if (this.dead || this.ended) return;
    this.dead = true;
    this.jumpscare();
    setTimeout(() => this.end(false, why), 900);
  }
  escape() {
    const g = this.game;
    g.audio.sfx('door_open', { vol: 1 });
    this.end(true, 'Has sobrevivido al apagón de Guareña');
  }
  end(win, why) {
    const g = this.game;
    this.ended = true;
    g.audio.loopStop('horror');
    g.state = 'ended';
    g.showEnd(win ? 'HAS ESCAPADO' : 'TE HA ENCONTRADO', why + (win ? `. Notas leídas: ${this.notes.size}/${NOTES.length}.` : '.'), win, this.level);
  }
  hideEnd() {
    if (this.ui.end) this.ui.end.hidden = true;
    this.game.state = 'play';
  }
}

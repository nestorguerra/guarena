// Pedestrians of Guareña: walk the sidewalks of the real streets, chat in the plazas, sit on benches,
// flee from trouble, get knocked down (and get back up), and speak castúo.
import * as THREE from 'three';
import { randomDesc } from './characters.js';
import { polySample, clamp, lerp, dampAngle, wrapAngle, mulberry32, hash1 } from './util.js';
import { endNode } from './traffic.js';
import { Dogs } from './dogs.js';

export const FRASES = {
  bump: ['¡Chacho, ten cuidao!', '¡Mira por dónde vas!', '¡Coile, qué susto!', '¡Ay, madre!', '¡Que me escachas!', '¡Acho, que no estás {solo|sola}!'],
  punched: ['¡Pero qué haces, {zagal|zagala}!', '¡Como te pille, estás aviao!', '¡Socorro!', '¡Llamad a la Guardia Civil!', '¡Tú no eres de aquí!'],
  car: ['¡Que me atropellas!', '¡Frena, animal!', '¡Por la acera no!', '¡Qué {cansino|cansina} eres!'],
  greet: ['¡Buenas!', '¿Qué pasa, piporro?', '¡Acho, qué caló jace!', '¿Un vasino de pitarra?', 'Espérate una mijina…', '¡Menuda sapalipanda hay en la plaza!', 'Ponme unos chochos, anda.', '¡A ver!', '¿Has visto la torre de Santa María?', 'Esto está más tranquilo que la siesta.'],
  flee: ['¡Corred!', '¡Que viene!', '¡Ay, Dios mío!', '¡Aligera, que no llegamos!'],
  carjack: ['¡Mi coche! ¡Al ladrón!', '¡Que me lo roban!', '¡Ladrón, sinvergüenza!'],
  handsup: ['¡No dispares, por tu madre!', '¡{Tranquilo, tranquilo|Tranquila, tranquila}!', '¡Llévate lo que quieras!', '¡Ay, Virgen de la Piedad!', '¡Que tengo familia!'],
  robbed: ['¡Toma, toma, y vete!', 'Es todo lo que llevo, te lo juro.', '¡Ladrón! ¡Esto no se hace!', 'Pa ti, pa ti… pero déjame.'],
  fight: ['¿Tú qué miras, {zagal|zagala}?', '¡Ahora te vas a enterar!', '¡A mí no me toca nadie!', '¡Vente pa cá si tienes lo que hay que tener!'],
  talk: ['¡Buenas! ¿Qué se cuenta?', '¿Has probao el pitarra de la cooperativa?', 'Esta noche hay verbena en la plaza, ¡no faltes!', 'Mi cuñao tiene un tractor más grande que tu coche.', 'Qué caló jace, chacho. Me voy a la piscina.', 'Dicen que en el pantano hay un tesoro de Tarteso…', 'Cuidao con los de verde, que andan por el polígono.', 'En Guareña se vive de lujo, acho.', '¿Vas pa la feria? Hay churros en la plaza.', 'Luis Chamizo era de aquí, que lo sepas.', '¿Tú no eres {el nieto|la nieta} de la Remedios?', 'Ya empezó la vendimia en las Vegas.'],
  annoyed: ['Que sí, que sí… déjame [tranquilo|tranquila].', '¿Otra vez tú? Qué pesaíto.', 'Tengo prisa, {zagal|zagala}.', 'Anda, ve a molestar a otro.'],
  insulted: ['¡Pero qué me dices, desgraciao!', '¡Más {feo|fea} eres tú!', '¡Tu padre sí que era un cansino!', '¡Vete a la porra!'],
  // neighbours sitting out at their doors "tomando el fresco"
  fresco: ['¿Te has enterao de lo de la hija de la Juani?', 'Ay, qué caló ha hecho hoy, hija.', 'Con el fresquito ya es otra cosa.', 'Mañana es día de mercao, ¿vas a ir?',
    'El butanero ha pasao a las diez y yo sin sacar la bombona.', 'Dicen que este año las fiestas van a ser sonás.', 'En mis tiempos esto era tó campo.', 'Chacha, que no se entere nadie, pero…',
    'Pues yo el gazpacho lo hago sin pepino.', '¿Has visto el coche que lleva ese? Ni que fuera de Madrid.', 'Anda que no ha llovío desde entonces…', 'A ver si refresca, que no se pue dormir.',
    'La vendimia viene buena, dice mi Paco.', 'Esa sí que sabía hacer perrunillas.', 'Mi nieto se ha ido a Badajoz a estudiar.', 'Y la otra, venga a hablar por el teléfono ese.',
    'Mira, mira quién viene por ahí…', '¿Y tu marío qué tal de lo suyo?', 'Esta noche ponen la verbena en la plaza.', '¡Qué bien se está aquí, coile!'],
  frescoGreet: ['¡Adiós!', '¡Buenas noches, hijo!', 'Adiós, guapo.', '¿De quién eres tú, zagal?', '¡Hola, hermoso!', 'Anda, siéntate un ratino.'],
  frescoGreetF: ['¡Adiós, guapa!', '¡Buenas noches, hija!', '¿De quién eres tú, zagala?', '¡Qué zagala más guapa!', 'Anda, siéntate un ratino, hija.'],
  frescoMorning: ['¡Buenos días!', 'Hoy va a apretar el sol, ya verás.', '¿Ya has ido a por el pan?', 'Voy a regar los geranios antes de que caliente.', 'Qué mañanita más buena.'],
};
// on the phone to the police (they describe what they saw)
const CALL = {
  agresion: ['¿Policía? ¡Vengan, que están pegando a alguien en la calle!', '¿Oiga? ¡Una pelea! ¡Le ha dado una paliza!'],
  homicidio: ['¡Policía! ¡Han matado a alguien! ¡Vengan ya!', '¡Un muerto! ¡Hay un muerto en la calle!'],
  atropello: ['¡Han atropellado a una persona y se ha ido!', '¿Emergencias? ¡Un atropello!'],
  atraco: ['¡Me han atracado! ¡Con una pistola!', '¿Policía? ¡Un atraco a mano armada!'],
  carjack: ['¡Me han robado el coche! ¡Me han sacao a la fuerza!', '¡Al ladrón! ¡Se lleva un coche!'],
  disparo: ['¡Disparos! ¡Están disparando en la calle!', '¿Policía? ¡He oído tiros!'],
  explosion: ['¡Una explosión! ¡Ha volado un coche!', '¡Manden a los bomberos y a la Guardia Civil!'],
  breakin: ['¡Están robando un coche! ¡Salta la alarma!', '¡Un ladrón forzando un coche!'],
  cadaver: ['¡Hay una persona en el suelo! ¡No se mueve!', '¿Emergencias? ¡Hay alguien tirado en la calle!'],
  allanamiento: ['¡Guardia Civil! ¡Se está colando alguien en casa de los vecinos!', '¡Hay uno forzando una puerta!'],
  any: ['¿Policía? ¡Vengan rápido!', '¿Oiga? ¡Aquí está pasando algo gordo!'],
};
const CALL_END = ['Ya vienen, ya vienen…', 'Ahora viene la Guardia Civil, ya verás.', 'Ya les he avisado.'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Peds {
  constructor(game) {
    this.game = game;
    this.map = game.map;
    this.list = [];
    this.pool = [];
    this.spawnT = 0;
    this.rnd = mulberry32(99);
    this.tmp = {};
    this.walkEdges = this.map.edges.filter((e) => (e.walk && !e.blocked && !e.dirt && e.cls !== 'track' && e.len > 8 && this.map.inTown(e.pts[0], e.pts[1])));
    this.benches = (game.world.spawnSpots || []).filter((s) => s.kind === 'bench');
    this.fresco = game.world.frescoSpots || [];
    this.frescoGroups = [];
    this.speech = [];
    this.marks = [];
    this.speechRoot = game.ui.speech;
    this.dogs = new Dogs(game);
  }

  targetCount() {
    const h = this.game.sky.hour;
    const base = this.game.q.peds || 26;
    const f = h < 7 ? 0.2 : h < 10 ? 0.6 : h < 14.5 ? 1 : h < 17 ? 0.55 /* siesta */ : h < 22.5 ? 1.15 /* paseo */ : h < 24 ? 0.5 : 0.25;
    return Math.round(base * f);
  }

  makeChar(desc) {
    const c = this.game.chars.create(desc || randomDesc(this.rnd));
    this.game.scene.add(c.object);
    return c;
  }

  update(dt) {
    const p = this.game.player.pos;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.25;
      if (this.list.filter((x) => !x.fixed).length < this.targetCount()) this.trySpawn(p);
      this.ensureBenchSitters(p);
      this.ensurePlazaGroups(p);
      this.ensureFresco(p);
    }
    this.updateFresco(dt);
    const cam = this.game.camera.position;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const ped = this.list[i];
      const d = Math.hypot(ped.x - p.x, ped.z - p.z);
      if (ped.state === 'dead') {
        if (d > 90 || (ped.deadT > 45 && !this.game.traffic.inView(ped.x, ped.z, d))) { this.despawn(ped, i); continue; }
      } else if (d > (ped.fixed ? 110 : 150) && ped.state !== 'lie' || (ped.state === 'lie' && d > 200)) { this.despawn(ped, i); continue; }
      this.updatePed(ped, dt, d);
      this.glance(ped, dt, d);
      // animation LOD: far peds update less often
      const cd = Math.hypot(ped.x - cam.x, ped.z - cam.z);
      ped.char.object.visible = cd < 130;
      ped.animAcc += dt;
      if (cd < 45 || ped.animAcc > 0.1) { ped.char.update(ped.animAcc, ped.speed, { turn: ped.turn || 0 }); ped.animAcc = 0; }
      const o = ped.char.object;
      if (!ped.char.rag) { o.position.set(ped.x, ped.y, ped.z); o.rotation.set(0, ped.heading, 0); } // (a ragdoll places itself)
      if (ped.group && ped.state === 'idle') ped.speed = 0;
    }
    this.dogs.update(dt);
    this.updateSpeech(dt);
  }

  trySpawn(p) {
    const fwd = this.game.cam.forwardYaw;
    for (let a = 0; a < 6; a++) {
      const e = this.walkEdges[Math.floor(Math.random() * this.walkEdges.length)];
      const s = 2 + Math.random() * (e.len - 4);
      const side = Math.random() < 0.5 ? 1 : -1;
      const pt = this.sidePoint(e, s, side, this.tmp);
      const dx = pt.x - p.x, dz = pt.z - p.z, d = Math.hypot(dx, dz);
      if (d < 35 || d > 120) continue;
      const dot = (dx * Math.sin(fwd) + dz * Math.cos(fwd)) / d;
      if (d < 70 && dot > 0.3 && this.map.collider.raycast(p.x, p.z, pt.x, pt.z, 1.7, 1.7) > 0.98) continue;
      if (this.map.buildingAt(pt.x, pt.z)) continue;
      const ped = this.spawnAt(pt.x, pt.z);
      ped.edge = e; ped.side = side; ped.dir = Math.random() < 0.5 ? 1 : -1; ped.s = s;
      ped.state = Math.random() < 0.12 ? 'idle' : 'walk';
      ped.idleT = 3 + Math.random() * 10;
      // a few are out walking the dog (more in the evening)
      const h = this.game.sky.hour;
      if (Math.random() < (h > 19 || h < 10 ? 0.22 : 0.1) && this.dogs.list.length < 7) this.dogs.attach(ped);
      return;
    }
  }

  spawnAt(x, z, desc) {
    const char = this.makeChar(desc);
    const ped = {
      char, x, z, y: 0, heading: Math.random() * Math.PI * 2, speed: 0, state: 'walk', t: 0,
      walkSpeed: (char.desc.elderly ? 0.85 : 1.25) + Math.random() * 0.3, hp: 100, animAcc: 0,
      edge: null, side: 1, dir: 1, s: 0, fear: 0, talkT: 0, fixed: false,
      tough: !char.desc.elderly && (char.desc.gender === 'm' ? Math.random() < 0.3 : Math.random() < 0.08),
      cash: Math.random() < 0.8 ? 5 + Math.floor(Math.random() * 55) : 0, talks: 0,
    };
    char.object.position.set(x, 0, z);
    this.list.push(ped);
    return ped;
  }
  despawn(ped, i) {
    if (ped.call) this.endCall(ped, ped.call.started || ped.call.delay <= 0);
    if (ped.dog) this.dogs.detach(ped);
    this.game.scene.remove(ped.char.object);
    ped.char.dispose();
    if (ped.bench) ped.bench.used = false;
    if (ped.group) ped.group.used = false;
    if (ped.fresco) this.leaveFresco(ped);
    this.list.splice(i ?? this.list.indexOf(ped), 1);
  }

  // ------------------------------------------------------------ "tomar el fresco": neighbours on chairs at their doors
  ensureFresco(p) {
    const h = this.game.sky.hour;
    const part = h >= 19.3 || h < 0.8 ? 'tarde' : h >= 10 && h < 13 ? 'mañana' : null;
    if (!part) return;
    for (const s of this.fresco) {
      if (s.part !== part) { s.part = part; s.skip = false; }
      if (s.used || s.skip) continue;
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d > 80 || d < 16) continue;
      // not every door is out every evening, fewer in the morning
      if (hash1(Math.floor(s.seed * 1e7) + (part === 'tarde' ? 11 : 23)) > (part === 'tarde' ? 0.78 : 0.3)) { s.skip = true; continue; }
      this.spawnFresco(s, part);
    }
  }
  spawnFresco(s, part) {
    const g = this.game, G = g.world.streetGeoms, mat = g.world.furnMat;
    const grp = { spot: s, members: [], chairs: [], part, talkT: 1 + Math.random() * 3, speaker: null, greetT: 0 };
    const rnd = mulberry32(Math.floor(s.seed * 1e9) >>> 0);
    const seats = part === 'mañana' ? s.seats.slice(0, 2) : s.seats;
    grp.seats = seats.slice();
    seats.forEach((seat, si) => {
      const ch = new THREE.Mesh(G[s.kind], mat);
      ch.position.set(seat.x, 0, seat.z);
      ch.rotation.y = seat.ang;
      ch.castShadow = true; ch.receiveShadow = true;
      g.scene.add(ch);
      grp.chairs.push(ch);
      const desc = randomDesc(rnd);
      desc.elderly = rnd() < 0.72;
      if (desc.elderly) {
        desc.hair = rnd() < 0.7 ? 6 : 5;
        if (desc.gender === 'f' && rnd() < 0.45) { desc.top = '#1d1f24'; desc.bottom = '#1d1f24'; } // de luto
        if (desc.gender === 'm' && rnd() < 0.6) { desc.accessory = rnd() < 0.6 ? 'boina' : desc.accessory; desc.accessoryColor = '#2a2a2a'; }
      }
      desc.cane = false;
      const fx = Math.sin(seat.ang), fz = Math.cos(seat.ang);
      const ped = this.spawnAt(seat.x + fx * 0.05, seat.z + fz * 0.05, desc);
      ped.fixed = true; ped.fresco = grp; ped.seatIndex = si;
      ped.state = 'sit'; ped.heading = seat.ang;
      ped.char.setBase(desc.elderly && desc.gender === 'f' && rnd() < 0.25 ? 'sitFan' : 'sitTalk');
      grp.members.push(ped);
    });
    // in the evening there is often a chair left for whoever wants to sit a while
    if (part === 'tarde' && rnd() < 0.45 && seats.length >= 2) {
      const a = seats[seats.length - 1], b = seats[seats.length - 2];
      const x = a.x + (a.x - b.x) * 0.95, z = a.z + (a.z - b.z) * 0.95;
      if (!this.map.buildingAt(x, z)) {
        const ch = new THREE.Mesh(G[s.kind], mat);
        ch.position.set(x, 0, z); ch.rotation.y = a.ang; ch.castShadow = true; ch.receiveShadow = true;
        g.scene.add(ch); grp.chairs.push(ch);
        grp.seats.push({ x, z, ang: a.ang, free: true });
      }
    }
    s.used = true; s.group = grp;
    this.frescoGroups.push(grp);
  }
  leaveFresco(ped) {
    const grp = ped.fresco;
    ped.fresco = null;
    if (!grp) return;
    const i = grp.members.indexOf(ped);
    if (i >= 0) grp.members.splice(i, 1);
    if (grp.speaker === ped) grp.speaker = null;
    if (grp.members.length) return;
    for (const c of grp.chairs) this.game.scene.remove(c);
    grp.chairs.length = 0;
    grp.spot.used = false; grp.spot.group = null;
    this.frescoGroups.splice(this.frescoGroups.indexOf(grp), 1);
  }
  updateFresco(dt) {
    const g = this.game, pl = g.player.pos;
    for (const grp of this.frescoGroups) {
      const sitting = grp.members.filter((m) => m.state === 'sit');
      if (!sitting.length) continue;
      const dP = Math.hypot(grp.spot.x - pl.x, grp.spot.z - pl.z);
      grp.talkT -= dt;
      if (grp.talkT <= 0) {
        // take turns: one speaks, the others turn their heads to her
        const prev = grp.speaker;
        grp.speaker = sitting[Math.floor(Math.random() * sitting.length)];
        if (prev && prev.char) prev.char.speaking = false;
        grp.speaker.char.speaking = true;
        grp.talkT = 2.5 + Math.random() * 4;
        if (dP < 11 && !g.player.vehicle && Math.random() < 0.8) this.say(grp.speaker, pick(grp.part === 'mañana' ? FRASES.frescoMorning.concat(FRASES.fresco.slice(0, 6)) : FRASES.fresco));
      }
      grp.greetT -= dt;
      const near = dP < 5.5 && !g.player.vehicle;
      if (near && grp.greetT <= 0) {
        const m = sitting[Math.floor(Math.random() * sitting.length)];
        const female = g.player.char && g.player.char.desc && g.player.char.desc.gender === 'f';
        this.say(m, pick(female ? FRASES.frescoGreetF : FRASES.frescoGreet));
        grp.greetT = 14 + Math.random() * 10;
      }
      for (const m of sitting) {
        if (near && m !== grp.speaker) m.char.lookAt(this._pv || (this._pv = new THREE.Vector3()).set(pl.x, 1.6, pl.z));
        else if (grp.speaker && m !== grp.speaker) m.char.lookAt((m._lk || (m._lk = new THREE.Vector3())).set(grp.speaker.x, 1.2, grp.speaker.z));
        else if (m === grp.speaker && sitting.length > 1) { const o = sitting[(sitting.indexOf(m) + 1) % sitting.length]; m.char.lookAt((m._lk || (m._lk = new THREE.Vector3())).set(o.x, 1.2, o.z)); }
        else m.char.lookAt(null);
      }
    }
  }

  // groups of neighbours chatting in the plazas (standing in a circle)
  ensurePlazaGroups(p) {
    if (!this.groupSpots) {
      this.groupSpots = [];
      for (const a of this.map.areas) {
        if (!['highway:pedestrian', 'place:square', 'leisure:park', 'amenity:marketplace'].includes(a.kind)) continue;
        let cx = 0, cz = 0; const r = a.ring;
        for (let i = 0; i < r.length; i += 2) { cx += r[i]; cz += r[i + 1]; }
        cx /= r.length / 2; cz /= r.length / 2;
        for (let k = 0; k < 3; k++) {
          const x = cx + Math.cos(k * 2.1 + a.ring.length) * (4 + k * 5), z = cz + Math.sin(k * 2.1 + a.ring.length) * (4 + k * 5);
          if (this.map.buildingAt(x, z)) continue;
          this.groupSpots.push({ x, z, used: false });
        }
      }
    }
    const h = this.game.sky.hour;
    if (h < 9 || h > 23.8) return;
    for (const gs of this.groupSpots) {
      if (gs.used) continue;
      const d = Math.hypot(gs.x - p.x, gs.z - p.z);
      if (d > 75 || d < 22) continue;
      gs.used = true;
      const n = 2 + Math.floor(Math.random() * 2);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + Math.random() * 0.4;
        const ped = this.spawnAt(gs.x + Math.cos(a) * 0.75, gs.z + Math.sin(a) * 0.75);
        ped.fixed = true; ped.group = gs;
        ped.state = 'idle'; ped.idleT = 1e9;
        ped.heading = Math.atan2(gs.x - ped.x, gs.z - ped.z);
        ped.char.setBase('talk');
      }
    }
  }

  // benches in the Plaza de España & parks: elderly folks sitting (very Guareña)
  ensureBenchSitters(p) {
    const h = this.game.sky.hour;
    if (h < 8 || h > 23.5) return;
    for (const b of this.benches) {
      if (b.used) continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d > 70 || d < 25) continue;
      if (hash1(Math.floor(b.x * 13 + b.z)) > 0.55) { b.used = true; continue; }
      b.used = true;
      const rnd = mulberry32(Math.floor(b.x * 7 + b.z * 3) >>> 0);
      const desc = randomDesc(rnd);
      desc.elderly = rnd() < 0.7;
      if (desc.elderly) { desc.hair = 6; if (desc.gender === 'm') { desc.accessory = 'boina'; desc.accessoryColor = '#2a2a2a'; } }
      desc.cane = false;
      const fx = Math.sin(b.ang), fz = Math.cos(b.ang);
      const ped = this.spawnAt(b.x + fx * 0.12, b.z + fz * 0.12, desc);
      ped.fixed = true; ped.bench = b;
      ped.state = 'sit'; ped.heading = b.ang;
      ped.char.setBase('sit');
    }
  }

  sidePoint(e, s, side, out) {
    polySample(e.pts, e.cum, clamp(s, 0, e.len), out);
    const off = e.walkOnly ? (e.w / 2) * 0.6 : e.w / 2 + (e.sw > 0.5 ? e.sw * 0.5 : 0.6);
    out.x += -out.dz * off * side; out.z += out.dx * off * side;
    return out;
  }

  updatePed(ped, dt, dPlayer) {
    const g = this.game;
    ped.t += dt;
    if (ped.talkCd > 0) ped.talkCd -= dt;
    switch (ped.state) {
      case 'walk': {
        const e = ped.edge;
        if (!e) { ped.state = 'idle'; break; }
        ped.s += ped.dir * ped.walkSpeed * dt;
        if (ped.s < 0 || ped.s > e.len) this.nextEdge(ped);
        const tgt = this.sidePoint(ped.edge, ped.s + ped.dir * 1.5, ped.side, this.tmp);
        this.steerTo(ped, tgt.x, tgt.z, ped.walkSpeed, dt);
        if (Math.random() < dt * 0.02) { ped.state = 'idle'; ped.idleT = 2 + Math.random() * 6; }
        break;
      }
      case 'idle': {
        ped.speed = lerp(ped.speed, 0, 1 - Math.exp(-8 * dt));
        ped.idleT -= dt;
        if (!ped.group && !ped.char.base && Math.random() < dt * 0.3) ped.char.setBase(Math.random() < 0.5 ? 'talk' : 'phone');
        if (ped.idleT <= 0) { ped.char.setBase(null); ped.state = ped.edge ? 'walk' : 'idle'; ped.idleT = 5; }
        break;
      }
      case 'call': {
        // a witness on the phone to the police: first they get away from you, then they call (you can stop them)
        const c = ped.call, pl = g.player;
        if (!c) { ped.state = 'idle'; ped.idleT = 2; break; }
        if (c.crime === 'cadaver') {
          const bx = c.x - ped.x, bz = c.z - ped.z, bl = Math.hypot(bx, bz);
          if (!c.started && bl > 2.2) { this.steerTo(ped, c.x, c.z, 3.2 * (ped.char.desc.elderly ? 0.5 : 1), dt); break; }
          if (!c.started) { c.started = true; ped.char.setBase('phone'); this.say(ped, pick(CALL.cadaver), true); this.mark(ped, '📱'); }
          ped.speed = lerp(ped.speed, 0, 1 - Math.exp(-8 * dt));
          ped.heading = dampAngle(ped.heading, Math.atan2(bx, bz), 4, dt);
          c.t += dt;
          if (c.t > c.dur) this.endCall(ped, true);
          break;
        }
        const tx = pl.vehicle ? pl.vehicle.x : pl.pos.x, tz = pl.vehicle ? pl.vehicle.z : pl.pos.z;
        let dx = ped.x - tx, dz = ped.z - tz;
        const l = Math.hypot(dx, dz) || 1;
        c.delay -= dt;
        if (c.delay > 0 || (l < 7 && !c.started)) {
          dx /= l; dz /= l;
          this.steerTo(ped, ped.x + dx * 5, ped.z + dz * 5, 4.6 * (ped.char.desc.elderly ? 0.45 : 1), dt);
          break;
        }
        if (!c.started) {
          c.started = true;
          ped.char.setBase('phone');
          this.say(ped, pick(CALL[c.crime] || CALL.any), true);
          this.mark(ped, '📱');
        }
        ped.speed = lerp(ped.speed, 0, 1 - Math.exp(-8 * dt));
        ped.heading = dampAngle(ped.heading, Math.atan2(-dx, -dz), 4, dt); // watching you while they describe you
        c.t += dt;
        if (c.t > c.dur) this.endCall(ped, true);
        break;
      }
      case 'sit':
        ped.speed = 0;
        if (ped.fear > 0.6) { ped.char.setBase(null); ped.char.speaking = false; ped.char.lookAt(null); ped.state = 'flee'; ped.fixed = false; if (ped.bench) ped.bench.used = false; }
        break;
      case 'flee': {
        if (ped.call) { ped.state = 'call'; break; }
        const pl = g.player.pos;
        let dx = ped.x - (ped.threat ? ped.threat.x : pl.x), dz = ped.z - (ped.threat ? ped.threat.z : pl.z);
        const l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
        this.steerTo(ped, ped.x + dx * 5, ped.z + dz * 5, 5.2 * (ped.char.desc.elderly ? 0.45 : 1), dt);
        ped.fear -= dt * 0.12;
        if (ped.fear <= 0 && l > 25) { this.rejoin(ped); ped.state = ped.edge ? 'walk' : 'idle'; ped.char.setBase(null); }
        break;
      }
      case 'fly': {
        // the ragdoll has the body (thrown, falling, against the walls): follow its hips; down once it lies still
        this.followBody(ped);
        const rag = ped.char.rag;
        if (rag && rag.landed && !ped.thud) { ped.thud = true; g.audio.sfx('land', { x: ped.x, z: ped.z, vol: ped.koLong ? 0.4 : 1 }); }
        if (!rag || rag.sleeping || ped.t > 3.5) {
          ped.state = ped.hp <= 0 ? 'dead' : 'lie'; ped.lieT = ped.koLong ? 25 + Math.random() * 15 : 3 + Math.random() * 4;
          if (ped.state === 'dead') this.onDied(ped);
        }
        break;
      }
      case 'dead':
        ped.speed = 0; ped.deadT = (ped.deadT || 0) + dt;
        this.followBody(ped);
        break;
      case 'getup':
        // back on their feet (see Character.getUp), then off, shaken
        ped.speed = 0;
        if (!ped.char.gettingUp) {
          ped.state = 'flee'; ped.fear = 1;
          if (ped.koLong) { ped.koLong = false; ped.fear = 0.4; this.say(ped, pick(['¿Qué… qué ha pasao?', 'Ay, mi cabeza…', '¿Quién ha sido?'])); }
          else this.say(ped, pick(FRASES.punched));
        }
        break;
      case 'handsup': {
        // surrendering: faces the threat with the hands up until it goes away
        const pl = g.player.pos;
        ped.speed = 0;
        ped.heading = Math.atan2(pl.x - ped.x, pl.z - ped.z);
        ped.handsT -= dt;
        if (ped.handsT <= 0 || dPlayer > 22) {
          ped.char.setBase(null); ped.state = 'flee'; ped.fear = 1; ped.threat = { x: pl.x, z: pl.z };
          if (ped.pendingCall) { const q = ped.pendingCall; ped.pendingCall = null; if (Math.random() < 0.5) this.startCall(ped, q.crime, q.x, q.z, 1.5); } // scared stiff: maybe not
        }
        break;
      }
      case 'fight': {
        // a tough guy squares up to the player
        const pl = g.player;
        const dx = pl.pos.x - ped.x, dz = pl.pos.z - ped.z, d = Math.hypot(dx, dz) || 1;
        ped.fightT -= dt;
        if (pl.vehicle || d > 25 || ped.fightT <= 0 || g.player.mode !== 'foot') { ped.char.setBase(null); this.rejoin(ped); ped.state = ped.edge ? 'walk' : 'idle'; break; }
        if (d > 1.05) this.steerTo(ped, pl.pos.x, pl.pos.z, 4.4, dt);
        else {
          ped.speed = 0; ped.heading = Math.atan2(dx, dz);
          ped.punchT = (ped.punchT ?? 0.4) - dt;
          if (ped.punchT <= 0) {
            ped.punchT = 0.8 + Math.random() * 0.6;
            ped.char.play(Math.random() < 0.5 ? 'punch' : 'punch2', 0.45);
            if (!pl.knock) setTimeout(() => {
              if (ped.state !== 'fight' || Math.hypot(pl.pos.x - ped.x, pl.pos.z - ped.z) > 1.5) return;
              g.audio.sfx('punch_hit', { x: pl.pos.x, z: pl.pos.z });
              pl.damage(6 + Math.random() * 4);
              if (Math.random() < 0.12) pl.knockDown((dx / d) * 3, (dz / d) * 3, 4);
            }, 180);
          }
        }
        break;
      }
      case 'lie': {
        ped.speed = 0;
        this.followBody(ped);
        if (ped.hp <= 0) { ped.state = 'dead'; this.onDied(ped); break; }
        ped.lieT -= dt;
        if (ped.lieT <= 0 && ped.hp > 0) {
          // up again: from the back or the front, however they fell
          const up = ped.char.getUp();
          if (up) { ped.x = up.x; ped.z = up.z; ped.heading = up.heading; }
          ped.y = 0; ped.state = 'getup';
        }
        break;
      }
    }
    // collisions with walls & player; reactions
    // guns pointed at you: hands up
    const W = g.weapons;
    if (W && W.aiming && dPlayer < 16 && (ped.state === 'walk' || ped.state === 'idle' || ped.state === 'sit' || ped.state === 'flee')) {
      const pl = g.player.pos, yaw = g.cam.forwardYaw;
      const dx = ped.x - pl.x, dz = ped.z - pl.z;
      if ((dx * Math.sin(yaw) + dz * Math.cos(yaw)) / (dPlayer || 1) > 0.975 && g.map.collider.raycast(pl.x, pl.z, ped.x, ped.z, 1.4, 1.4) > 0.97) this.surrender(ped);
    }
    // walls stop everyone on their feet — witnesses running off to phone the police too (they used to go through them)
    if (ped.state === 'walk' || ped.state === 'flee' || ped.state === 'idle' || ped.state === 'fight' || ped.state === 'call') {
      const pos = { x: ped.x, z: ped.z };
      g.map.collider.resolveCircle(pos, 0.3);
      ped.x = pos.x; ped.z = pos.z;
      const pl = g.player;
      if (!pl.vehicle && dPlayer < 0.75 && !pl.knock) {
        const dx = ped.x - pl.pos.x, dz = ped.z - pl.pos.z, l = Math.hypot(dx, dz) || 1;
        ped.x = pl.pos.x + (dx / l) * 0.75; ped.z = pl.pos.z + (dz / l) * 0.75;
        if (!ped.talkCd) { this.say(ped, pick(FRASES.bump)); ped.talkCd = 4; }
      }
      if (dPlayer < 3.2 && !pl.vehicle && ped.state !== 'flee' && Math.random() < dt * 0.25 && !ped.talkCd) { this.say(ped, pick(FRASES.greet)); ped.talkCd = 12; }
    }
    // vehicles hitting pedestrians
    if (ped.state !== 'fly' && ped.state !== 'lie' && ped.state !== 'dead') this.checkVehicles(ped);
    // once a second: rescue anyone who ended up inside a building, unstick walkers, notice someone lying in the street
    ped.chk = (ped.chk ?? Math.random()) - dt;
    if (ped.chk <= 0) {
      ped.chk = 1;
      if ((ped.state === 'walk' || ped.state === 'idle') && !ped.call && g.mode === 'normal') this.lookForBodies(ped);
      if (ped.state !== 'fly' && this.map.buildingAt(ped.x, ped.z)) this.rescue(ped);
      if (ped.state === 'walk') {
        const moved = Math.hypot(ped.x - (ped.px ?? 1e9), ped.z - (ped.pz ?? 1e9));
        ped.px = ped.x; ped.pz = ped.z;
        if (moved < 0.35) {
          ped.stuckN = (ped.stuckN || 0) + 1;
          if (ped.stuckN === 2) ped.side = -ped.side;
          else if (ped.stuckN === 3) ped.dir = -ped.dir;
          else if (ped.stuckN >= 4) { this.rescue(ped); ped.stuckN = 0; }
        } else ped.stuckN = 0;
      }
    }
  }

  // put a pedestrian back on the nearest sidewalk (outside buildings)
  rescue(ped) {
    const q = this.map.nearestEdge(ped.x, ped.z, 60, (e) => e.walk && !e.blocked && !e.dirt);
    if (!q) return;
    ped.edge = q.edge; ped.s = q.s;
    if (!ped.dir) ped.dir = 1;
    for (const side of [ped.side || 1, -(ped.side || 1)]) {
      const pt = this.sidePoint(q.edge, q.s, side, {});
      if (!this.map.buildingAt(pt.x, pt.z)) { ped.x = pt.x; ped.z = pt.z; ped.side = side; return; }
    }
    const c = this.map.sample(q.edge, q.s, {});
    ped.x = c.x; ped.z = c.z;
  }
  // after fleeing, walk on along whatever street is closest
  rejoin(ped) {
    const q = this.map.nearestEdge(ped.x, ped.z, 40, (e) => e.walk && !e.blocked && !e.dirt && e.cls !== 'track');
    if (!q) return;
    ped.edge = q.edge; ped.s = q.s;
    const d = this.map.sample(q.edge, q.s, {});
    const lat = (ped.x - d.x) * -d.dz + (ped.z - d.z) * d.dx;
    ped.side = lat >= 0 ? 1 : -1;
    if (!ped.dir) ped.dir = Math.random() < 0.5 ? 1 : -1;
  }

  steerTo(ped, tx, tz, speed, dt) {
    const dx = tx - ped.x, dz = tz - ped.z;
    const want = Math.atan2(dx, dz);
    const prev = ped.heading;
    ped.heading = dampAngle(ped.heading, want, 7, dt);
    ped.turn = wrapAngle(ped.heading - prev) / Math.max(dt, 1e-3) * 0.3;
    ped.speed = lerp(ped.speed, speed, 1 - Math.exp(-5 * dt));
    ped.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.z += Math.cos(ped.heading) * ped.speed * dt;
  }

  nextEdge(ped) {
    const e = ped.edge;
    const nodeId = ped.dir > 0 ? e.b : e.a;
    const node = this.map.nodes[nodeId];
    const opts = node.edges.map((id) => this.map.edges[id]).filter((x) => x.id !== e.id && x.walk && !x.blocked && !x.dirt && x.cls !== 'track' && x.len > 3);
    if (!opts.length) { ped.dir = -ped.dir; ped.s = clamp(ped.s, 0, e.len); return; }
    const ne = opts[Math.floor(Math.random() * opts.length)];
    ped.edge = ne;
    ped.dir = ne.a === nodeId ? 1 : -1;
    ped.s = ped.dir > 0 ? 0.5 : ne.len - 0.5;
    if (Math.random() < 0.35) ped.side = -ped.side; // cross the street at the junction
  }

  checkVehicles(ped) {
    const g = this.game;
    for (const v of g.fleet.vehicles) {
      if (v.vel < 1.2) continue;
      const dx = ped.x - v.x, dz = ped.z - v.z;
      if (Math.abs(dx) > 5 || Math.abs(dz) > 5) continue;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      const lf = dx * fx + dz * fz, ll = dx * -fz + dz * fx;
      if (Math.abs(lf) < v.hl + 0.3 && Math.abs(ll) < v.hw + 0.3) {
        if (v.vel > 3.2) this.knock(ped, v.vx * 0.85, v.vz * 0.85, v);
        else if (ped.state === 'sit') {
          // someone sitting at the door gets up and moves away instead of being shoved into the wall
          ped.fear = 1; ped.threat = { x: v.x, z: v.z };
          if (!ped.talkCd) { this.say(ped, pick(FRASES.car)); ped.talkCd = 3; }
        } else {
          const s = Math.sign(ll) || 1;
          const pos = { x: ped.x - fz * s * 0.3, z: ped.z + fx * s * 0.3 };
          g.map.collider.resolveCircle(pos, 0.3);
          ped.x = pos.x; ped.z = pos.z;
          if (!ped.talkCd) { this.say(ped, pick(FRASES.car)); ped.talkCd = 3; }
        }
        return;
      }
      // dodge cars driving on the sidewalk towards them
      if (v.driver === 'player' && lf > 0 && lf < 12 && Math.abs(ll) < 2.2 && v.speed > 4 && ped.state !== 'flee' && !ped.call) {
        ped.state = 'flee'; ped.fear = 0.6; ped.threat = { x: v.x, z: v.z };
        if (!ped.talkCd) { this.say(ped, pick(FRASES.car)); ped.talkCd = 3; }
      }
    }
  }

  knock(ped, vx, vz, byVehicle = null) {
    if (ped.state === 'fly' || ped.state === 'lie') return;
    if (ped.call) this.endCall(ped, false);
    ped.pendingCall = null;
    ped.state = 'fly'; ped.t = 0; ped.thud = false;
    const sp = Math.hypot(vx, vz);
    ped.hp -= sp * 6;
    // a car sweeps the legs out and throws the body up over it; a blow sends the top half back (killed: the knees go
    // and there is no fight left in it)
    const dead = ped.hp <= 0;
    if (byVehicle) this.fall(ped, { vel: [vx * 0.9, 1.6 + sp * 0.13, vz * 0.9], legs: 0.5, up: -0.2, tone: dead ? 0.15 : 0.55 });
    else this.fall(ped, { vel: [vx * 0.8, dead ? 0.2 : 0.7, vz * 0.8], up: 0.8, legs: -0.3, tone: dead ? 0.1 : 0.75, buckle: dead ? 0.9 : 0 });
    if (ped.bench) { ped.bench.used = false; ped.bench = null; ped.fixed = false; }
    this.game.audio.sfx(ped.char.desc.gender === 'f' ? 'yelp_f' : 'yelp_m', { x: ped.x, z: ped.z });
    this.game.audio.sfx('punch_hit', { x: ped.x, z: ped.z, vol: 1.2 });
    this.scare(ped.x, ped.z, 18, byVehicle);
    if (byVehicle && byVehicle.driver === 'player') this.game.police.crime('atropello', ped.x, ped.z, { victim: ped });
  }

  // people notice you: walking past or standing about, someone you come close to (in front of them) looks at you for
  // a moment — the eyes first, then the head, the chest on a big turn (Character.lookAt) — longer if you run at them
  glance(ped, dt, d) {
    const free = (ped.state === 'walk' || ped.state === 'idle') && !ped.group && !ped.bench && !ped.call;
    if (!free) { if (ped.lookT > 0) { ped.lookT = 0; ped.char.lookAt(null); } return; }
    const pl = this.game.player;
    if (ped.lookT > 0) {
      ped.lookT -= dt;
      if (ped.lookT <= 0 || d > 10 || pl.vehicle) { ped.lookT = 0; ped.char.lookAt(null); ped.lookCd = 5 + Math.random() * 10; }
      else ped.char.lookAt((this._lp || (this._lp = new THREE.Vector3())).set(pl.pos.x, pl.pos.y + 1.55 * (pl.char.scale || 1), pl.pos.z));
      return;
    }
    ped.lookCd = (ped.lookCd ?? Math.random() * 4) - dt;
    if (ped.lookCd > 0 || d > 6.5 || pl.vehicle || pl.mode !== 'foot') return;
    const dx = pl.pos.x - ped.x, dz = pl.pos.z - ped.z;
    const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - ped.heading));
    if (ang > 1.9) return; // (behind them: they don't see you)
    const fast = Math.hypot(pl.vel.x, pl.vel.z) > 4;
    if (Math.random() < (fast ? 0.95 : 0.7)) ped.lookT = (fast ? 2 : 1.1) + Math.random() * 2.2;
    else ped.lookCd = 2 + Math.random() * 4;
  }
  // the body goes limp and falls (a ragdoll: see Character.ragdoll); o: vel, legs, up, buckle, tone, dead
  fall(ped, o) {
    const col = this.map.collider;
    this.ragEnv = this.ragEnv || { floor: () => 0, collide: (p, r) => col.resolveCircle(p, r), crosses: (ax, az, bx, bz) => col.crosses && col.crosses(ax, az, bx, bz) };
    ped.char.ragdoll({ env: this.ragEnv, dead: ped.hp <= 0, ...o });
  }
  followBody(ped) {
    ped.speed = 0;
    if (!ped.char.rag) return;
    const p = ped.char.ragPos(this._rp || (this._rp = new THREE.Vector3()));
    ped.x = p.x; ped.z = p.z; ped.y = 0;
  }
  hitTest(x, z, r, exclude) {
    let best = null, bd = r;
    for (const ped of this.list) {
      if (ped.state === 'lie' || ped.state === 'fly' || ped.state === 'dead') continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bd) { bd = d; best = ped; }
    }
    return best;
  }
  punched(ped, fx, fz, attacker) { this.damage(ped, 34, fx * 4, fz * 4, 'player', 'fist'); }

  // any kind of harm: fists, bat, bullets. kind: 'fist' | 'bat' | 'bullet'
  damage(ped, dmg, kx, kz, source = 'player', kind = 'fist') {
    if (ped.char.rag) ped.char.rag.push(9, kx * 0.35, 0.3, kz * 0.35); // a body on the ground jerks with the blow
    if (ped.state === 'dead') return false;
    const g = this.game;
    if (ped.call) this.endCall(ped, false);
    ped.hp -= dmg;
    ped.char.play('hit', 0.35);
    if (ped.bench) { ped.bench.used = false; ped.bench = null; ped.fixed = false; ped.char.setBase(null); }
    if (ped.group) { ped.group.used = false; ped.group = null; ped.fixed = false; }
    if (ped.hp <= 0) {
      // down for good
      ped.dead = true;
      if (ped.state !== 'fly' && ped.state !== 'lie') this.knock(ped, kx * 1.2, kz * 1.2);
      else if (ped.state === 'lie') { ped.state = 'dead'; this.onDied(ped); }
      if (source === 'player') g.police.crime('homicidio', ped.x, ped.z, { victim: ped });
      this.scare(ped.x, ped.z, 30, null, kind === 'bullet');
      return true;
    }
    if (kind === 'bullet') {
      if (Math.random() < 0.55 || ped.hp < 50) this.knock(ped, kx, kz);
      else { ped.state = 'flee'; ped.fear = 1; ped.threat = null; this.say(ped, pick(FRASES.flee)); }
    } else if (ped.hp < 40 || Math.random() < (kind === 'bat' ? 0.6 : 0.3)) this.knock(ped, kx, kz);
    else if (ped.tough && source === 'player' && !(g.weapons && g.weapons.def.clip)) this.startFight(ped);
    else { ped.state = 'flee'; ped.fear = 1; ped.threat = null; this.say(ped, pick(FRASES.punched)); }
    if (source === 'player' && kind !== 'bullet') g.police.crime('agresion', ped.x, ped.z, { victim: ped });
    this.scare(ped.x, ped.z, 14);
    return false;
  }
  onDied(ped) {
    const g = this.game;
    if (!ped.char.rag) this.fall(ped, { buckle: 1, tone: 0.1, dead: true }); // (it came where they stood)
    ped.char.ragDead = true;
    ped.char.blinkP = 1;
    g.effects.pool(ped.x, ped.z, 0.75);
    if (ped.cash > 0 && g.pickups) { g.pickups.cash(ped.x + (Math.random() - 0.5), ped.z + (Math.random() - 0.5), ped.cash); ped.cash = 0; }
  }
  startFight(ped) {
    ped.char.setBase(null);
    ped.state = 'fight'; ped.fightT = 18; ped.punchT = 0.5;
    this.say(ped, pick(FRASES.fight));
  }
  surrender(ped) {
    if (ped.state === 'handsup' || ped.state === 'dead') return;
    if (ped.tough && Math.random() < 0.3 && ped.state !== 'flee') { ped.state = 'flee'; ped.fear = 1; this.say(ped, pick(FRASES.flee)); return; }
    if (ped.bench) { ped.bench.used = false; ped.bench = null; ped.fixed = false; }
    if (ped.group) { ped.group.used = false; ped.group = null; ped.fixed = false; }
    if (ped.call) { ped.pendingCall = { crime: ped.call.crime, x: ped.call.x, z: ped.call.z }; this.endCall(ped, false); } // phone down, hands up
    ped.state = 'handsup'; ped.handsT = 7 + Math.random() * 4;
    ped.char.setBase('handsup');
    if (!ped.talkCd || ped.talkCd < 0) { this.say(ped, pick(FRASES.handsup)); ped.talkCd = 4; }
  }
  // hand over the wallet (interaction with a gun drawn)
  rob(ped) {
    const g = this.game;
    const amount = ped.cash || 0;
    ped.cash = 0;
    this.say(ped, amount ? pick(FRASES.robbed) : '¡Que no llevo nada, de verdad!');
    ped.handsT = Math.min(ped.handsT, 1.5);
    if (amount) { g.player.money += amount; g.audio.sfx('money'); g.hud.notify(`Le quitas la cartera: +${amount} €`, 'ok', 3); }
    g.police.crime('atraco', ped.x, ped.z, { victim: ped });
    return amount;
  }
  // chat: castúo small talk; press again quickly to wind them up
  talk(ped) {
    const g = this.game;
    const pl = g.player.pos;
    ped.talks = (ped.talks || 0) + 1;
    ped.heading = Math.atan2(pl.x - ped.x, pl.z - ped.z);
    if (ped.state === 'walk' || ped.state === 'idle') { ped.state = 'idle'; ped.idleT = 4; ped.speed = 0; ped.char.setBase('talk'); }
    this.say(ped, pick(ped.talks > 2 ? FRASES.annoyed : FRASES.talk));
    ped.talkCd = 3;
    g.audio.sfx('text_msg', { vol: 0.3 });
  }
  insult(ped) {
    this.say(ped, pick(FRASES.insulted));
    ped.talkCd = 3;
    const young = !ped.char.desc.elderly;
    if (ped.tough || (young && ped.char.desc.gender === 'm' && Math.random() < 0.25)) { setTimeout(() => { if (ped.state !== 'dead' && ped.state !== 'lie' && ped.state !== 'fly') this.startFight(ped); }, 700); }
    else if (Math.random() < 0.5) { ped.state = 'flee'; ped.fear = 0.6; ped.char.setBase(null); ped.threat = null; }
    else if (ped.state === 'idle' && !ped.fixed) { ped.idleT = 0.6; ped.char.setBase(null); } // walks off, offended
  }

  scare(x, z, r, threat = null, gun = false) {
    for (const p of this.list) {
      if (p.state === 'lie' || p.state === 'fly' || p.state === 'dead' || p.state === 'handsup') continue;
      if (p.call) { p.fear = 1; continue; } // already on the phone to the police
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < r) {
        p.fear = 1;
        if (p.state === 'fight' && !gun) continue;
        // gunfire close by: some freeze with their hands up instead of running
        if (gun && d < r * 0.4 && !p.tough && Math.random() < 0.35) { this.surrender(p); continue; }
        if (p.state !== 'sit' || d < r * 0.5) { p.state = 'flee'; p.char.setBase(null); if (p.bench) { p.bench.used = false; p.bench = null; p.fixed = false; } if (p.group) { p.group = null; p.fixed = false; } }
        p.threat = threat ? { x: threat.x, z: threat.z } : { x, z };
        if (Math.random() < 0.3 && !p.talkCd) { this.say(p, pick(FRASES.flee)); p.talkCd = 5; }
      }
    }
  }

  // someone on the ground (dead or out cold): the first to see it goes over and phones 112
  lookForBodies(ped) {
    for (const b of this.list) {
      if (b.found || b === ped || !(b.state === 'dead' || (b.state === 'lie' && b.koLong))) continue;
      const dx = b.x - ped.x, dz = b.z - ped.z, d = Math.hypot(dx, dz);
      if (d > 16 || Math.abs(wrapAngle(Math.atan2(dx, dz) - ped.heading)) > 1.6) continue;
      if (this.map.collider.raycast(ped.x, ped.z, b.x, b.z, 1.6, 0.3) < 0.98) continue;
      b.found = true;
      const fb = b.char && b.char.desc && b.char.desc.gender === 'f';
      this.say(ped, pick(['¡Ay, Dios mío!', fb ? '¡Una mujer en el suelo!' : '¡Un hombre en el suelo!', '¡Madre mía! ¿Está usted bien?', '¡Socorro, que alguien ayude!']), true);
      this.game.audio.sfx(ped.char.desc.gender === 'f' ? 'yelp_f' : 'yelp_m', { x: ped.x, z: ped.z, vol: 0.7 });
      this.startCall(ped, 'cadaver', b.x, b.z, 0);
      return;
    }
  }
  // crouched behind someone who has not noticed you: a quiet knockout (no scream, they don't see who it was)
  canTakedown(ped) {
    const pl = this.game.player;
    if (!pl.crouch || pl.vehicle || !['walk', 'idle', 'sit', 'call'].includes(ped.state) || ped.fear > 0.3) return false;
    const dx = pl.pos.x - ped.x, dz = pl.pos.z - ped.z;
    if (Math.hypot(dx, dz) > 1.6) return false;
    return Math.abs(wrapAngle(Math.atan2(dx, dz) - ped.heading)) > 2.0; // behind them
  }
  takedown(ped) {
    const g = this.game, pl = g.player;
    if (ped.call) this.endCall(ped, false);
    if (ped.bench) { ped.bench.used = false; ped.bench = null; }
    if (ped.group) { ped.group.used = false; ped.group = null; }
    ped.fixed = false;
    pl.heading = Math.atan2(ped.x - pl.pos.x, ped.z - pl.pos.z);
    pl.char.play('punch', 0.45);
    const fx = Math.sin(pl.heading), fz = Math.cos(pl.heading);
    ped.state = 'fly'; ped.t = 0; ped.thud = false; ped.koLong = true;
    ped.hp = Math.min(ped.hp, 70);
    this.fall(ped, { vel: [fx * 1.1, 0, fz * 1.1], up: 0.6, buckle: 1.4, tone: 0.1 }); // out cold: the knees go
    g.audio.sfx('punch_hit', { x: ped.x, z: ped.z, vol: 0.35 });
    g.police.crime('agresion', ped.x, ped.z, { victim: ped, silent: true });
  }

  // ------------------------------------------------------------ witnesses
  // who saw the player just now: in front of them (anything close, or loud, gets noticed anyway), in line of sight,
  // closer at night and when you keep low. Nearest first.
  witnesses(opts = {}) {
    const g = this.game, pl = g.player;
    const px = pl.vehicle ? pl.vehicle.x : pl.pos.x, pz = pl.vehicle ? pl.vehicle.z : pl.pos.z;
    const k = lerp(1, 0.55, g.sky.night || 0) * (!pl.vehicle && pl.crouch ? 0.7 : 1);
    const R = (opts.loud ? 55 : 32) * k;
    const out = [];
    for (const p of this.list) {
      if (p === opts.victim || p.dead || p.state === 'dead' || p.state === 'lie' || p.state === 'fly' || p.inCar || p.call) continue;
      const dx = px - p.x, dz = pz - p.z, d = Math.hypot(dx, dz);
      if (d > R) continue;
      if (!opts.loud && d > 4 && Math.abs(wrapAngle(Math.atan2(dx, dz) - p.heading)) > 1.9) continue;
      if (this.map.collider.raycast(p.x, p.z, px, pz, 1.6, 1.2) < 0.98) continue;
      out.push({ p, d });
    }
    out.sort((a, b) => a.d - b.d);
    return out.map((o) => o.p);
  }
  // delay: how long they run before stopping to phone
  startCall(ped, crime, x, z, delay = null) {
    if (ped.call || ped.dead || ped.state === 'dead' || ped.state === 'lie' || ped.state === 'fly') return false;
    if (ped.state === 'handsup') { ped.pendingCall = { crime, x, z }; return true; }
    if (ped.bench) { ped.bench.used = false; ped.bench = null; }
    if (ped.group) { ped.group.used = false; ped.group = null; }
    ped.fixed = false; ped.char.setBase(null); ped.char.speaking = false;
    ped.call = { crime, x, z, t: 0, dur: 4.5 + Math.random() * 2.5, delay: delay ?? 1 + Math.random() * 1.5, started: false };
    ped.state = 'call';
    this.game.police.calls.add(ped);
    return true;
  }
  endCall(ped, done) {
    const c = ped.call;
    if (!c) return;
    ped.call = null;
    this.unmark(ped);
    this.game.police.calls.delete(ped);
    if (ped.state === 'call') { ped.char.setBase(null); ped.state = 'flee'; ped.fear = 0.5; ped.threat = { x: this.game.player.pos.x, z: this.game.player.pos.z }; }
    if (done) {
      if (this.list.includes(ped)) this.say(ped, pick(CALL_END), true);
      this.game.police.report(c.crime, c.x, c.z, ped);
    }
  }
  // a persistent icon over someone's head (📱 while they phone the police)
  mark(ped, text) {
    if (!this.speechRoot) return;
    this.unmark(ped);
    const el = document.createElement('div');
    el.className = 'speech mark';
    el.textContent = text;
    this.speechRoot.appendChild(el);
    this.marks.push({ ped, el });
  }
  unmark(ped) {
    for (let i = this.marks.length - 1; i >= 0; i--) if (this.marks[i].ped === ped) { this.marks[i].el.remove(); this.marks.splice(i, 1); }
  }

  // spawn the ejected driver of a carjacked car
  ejectDriver(v) {
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let lx = fz, lz = -fx;
    // thrown out on the driver's side unless there is a wall there
    const ok = (sx, sz) => !this.map.buildingAt(v.x + sx * (v.hw + 0.7), v.z + sz * (v.hw + 0.7)) && this.map.collider.raycast(v.x, v.z, v.x + sx * (v.hw + 0.9), v.z + sz * (v.hw + 0.9), 1, 1) > 0.98;
    if (!ok(lx, lz)) { if (ok(-lx, -lz)) { lx = -lx; lz = -lz; } else { lx = -fx; lz = -fz; } }
    const ped = this.spawnAt(v.x + lx * (v.hw + 0.7), v.z + lz * (v.hw + 0.7));
    ped.state = 'fly'; ped.t = 0; ped.thud = false;
    ped.hp = 100;
    this.fall(ped, { vel: [lx * 3, 1.6, lz * 3], up: 0.4, tone: 0.7 }); // dragged out and thrown down
    setTimeout(() => this.say(ped, pick(FRASES.carjack)), 900);
    return ped;
  }

  // ------------------------------------------------------------ speech bubbles (DOM, projected)
  // free: the speaker is not a street pedestrian (an officer, someone at home) and keeps the bubble wherever they are
  // {m|f} agrees with the player (who is spoken to), [m|f] with the speaker
  say(ped, text, free = false) {
    if (!this.speechRoot) return;
    const pf = this.game.player.char && this.game.player.char.desc.gender === 'f', sf = ped && ped.char && ped.char.desc.gender === 'f';
    text = String(text).replace(/\{([^|{}]*)\|([^|{}]*)\}/g, (_, m, f) => (pf ? f : m)).replace(/\[([^|\[\]]*)\|([^|\[\]]*)\]/g, (_, m, f) => (sf ? f : m));
    for (let i = this.speech.length - 1; i >= 0; i--) if (this.speech[i].ped === ped) { this.speech[i].el.remove(); this.speech.splice(i, 1); } // one line at a time
    const el = document.createElement('div');
    el.className = 'speech';
    el.textContent = text;
    this.speechRoot.appendChild(el);
    this.speech.push({ ped, el, t: 3.2, free });
  }
  updateSpeech(dt) {
    const cam = this.game.camera;
    const v = this._v || (this._v = new THREE.Vector3());
    const W = innerWidth, H = innerHeight;
    for (let i = this.speech.length - 1; i >= 0; i--) {
      const s = this.speech[i];
      s.t -= dt;
      if (s.t <= 0 || (!s.free && !this.list.includes(s.ped))) { s.el.remove(); this.speech.splice(i, 1); continue; }
      const y = s.ped.y || 0;
      const dist = cam.position.distanceTo(v.set(s.ped.x, y + 1.8, s.ped.z));
      v.set(s.ped.x, y + 2.05, s.ped.z).project(cam);
      if (v.z > 1 || dist > 35) { s.el.style.opacity = 0; continue; }
      s.el.style.opacity = Math.min(1, s.t * 2);
      s.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`;
    }
    for (const m of this.marks) {
      const y = m.ped.y || 0;
      const dist = cam.position.distanceTo(v.set(m.ped.x, y + 1.8, m.ped.z));
      v.set(m.ped.x, y + 2.35, m.ped.z).project(cam);
      if (v.z > 1 || dist > 60) { m.el.style.opacity = 0; continue; }
      m.el.style.opacity = 1;
      m.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`;
    }
  }
  clear() {
    for (const p of this.list) if (p.call) this.endCall(p, false);
    for (let i = this.list.length - 1; i >= 0; i--) this.despawn(this.list[i], i);
    for (const b of this.benches) b.used = false;
    for (const grp of this.frescoGroups.slice()) { for (const c of grp.chairs) this.game.scene.remove(c); grp.spot.used = false; }
    this.frescoGroups = [];
    for (const s of this.fresco) { s.used = false; s.skip = false; s.group = null; }
    for (const s of this.speech) s.el.remove();
    this.speech = [];
    for (const m of this.marks) m.el.remove();
    this.marks = [];
  }
}

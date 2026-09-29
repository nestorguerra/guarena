// Jobs: ask for work at the shops and services of Guareña and earn an honest living. Deliveries for the bakery,
// the pharmacy, the florist or the kebab; the postman's round; unloading the van at the supermarket or the fruit shop;
// waiting on the terrace of a bar; sweeping the streets for the town hall; the breakdown truck of the workshop; a day
// on the tractor for the Cooperativa; and the Policía Local (patrol car, suspects to catch). Places keep generic names:
// the real businesses only give where they are.
import * as THREE from 'three';
import { PERK } from './perks.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rint = (a, b) => Math.round(a + Math.random() * (b - a));
// «a el taller» → «al taller»
const al = (n) => (n.startsWith('el ') ? 'al ' + n.slice(3) : 'a ' + n);

// what each kind of place offers
const PLACES = {
  'shop:bakery': { name: 'la panadería', job: 'reparto', what: 'el pan', boss: 'La panadera' },
  'shop:confectionery': { name: 'la confitería', job: 'reparto', what: 'los dulces', boss: 'El confitero' },
  'amenity:fast_food': { name: 'el kebab', job: 'reparto', what: 'los pedidos', boss: 'El dueño', fast: true },
  'amenity:pharmacy': { name: 'la farmacia', job: 'reparto', what: 'las medicinas', boss: 'La farmacéutica' },
  'shop:florist': { name: 'la floristería', job: 'reparto', what: 'los ramos', boss: 'La florista' },
  'shop:hardware': { name: 'la ferretería', job: 'reparto', what: 'los encargos', boss: 'El ferretero' },
  'shop:supermarket': { name: 'el supermercado', job: 'reponedor', boss: 'La encargada' },
  'shop:greengrocer': { name: 'la frutería', job: 'reponedor', boss: 'El frutero' },
  'amenity:marketplace': { name: 'el Mercado de Abastos', job: 'reponedor', boss: 'El del puesto' },
  'amenity:post_office': { name: 'Correos', job: 'cartero', boss: 'El jefe de Correos' },
  'shop:car_repair': { name: 'el taller', job: 'grua', boss: 'El mecánico' },
  'amenity:bar': { name: 'el bar', job: 'camarero', boss: 'El dueño del bar' },
  'amenity:cafe': { name: 'la cafetería', job: 'camarero', boss: 'La dueña' },
  'amenity:pub': { name: 'el pub', job: 'camarero', boss: 'El dueño' },
  'tourism:hotel': { name: 'el hotel', job: 'camarero', boss: 'La recepcionista' },
};
const JOB_LABEL = { reparto: 'repartos', reponedor: 'descargar la furgoneta', cartero: 'repartir el correo', grua: 'la grúa', camarero: 'camarero en la terraza', barrendero: 'barrendero', tractor: 'un día de tractor', policia: 'Policía Local' };
const HIRE = {
  reparto: (P) => [`${P.boss}: ¿Buscas faena? Llévame ${P.what} a estas casas. Te pago cada entrega, y propina si vas ligero.`],
  reponedor: (P) => [`${P.boss}: Justo ha llegado la furgoneta. Mete las cajas en la tienda y te doy lo tuyo.`],
  cartero: (P) => [`${P.boss}: Hoy falta el cartero. Seis cartas por el barrio; no te las dejes en el bolsillo.`],
  grua: (P) => [`${P.boss}: Hay un coche tirado en el pueblo. Tráemelo al taller y te llevas una buena comisión.`],
  camarero: (P) => [`${P.boss}: ¡Me viene de perlas, la terraza está a reventar! Coge la bandeja de la barra y a servir.`],
  barrendero: () => ['El concejal: Las calles de alrededor están hechas un asco. Barre los puntos marcados antes de que llegue el alcalde.'],
  tractor: () => ['El de la Cooperativa: El tractor está en la puerta. Pasa por las parcelas marcadas y vuelve.'],
  policia: () => ['El jefe de la Policía Local: Nos falta un agente. Coge el coche patrulla de la puerta y a vigilar el pueblo.'],
};
const THANKS = ['¡Gracias, {majo|maja}!', '¡Qué rapidez!', 'Toma, para ti.', '¡Por fin!', 'Muy amable.', '¡Ya era hora!'];

export class Jobs {
  constructor(game) {
    this.game = game;
    this.places = [];
    this.job = null;
    this.doing = null;
    this.cd = new Map();
    // the marker for the current step
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0x5fd06a, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
    m.visible = false; m.renderOrder = 4;
    game.scene.add(m);
    this.marker = m;
  }

  setup(P) {
    const g = this.game, map = g.map, A = g.activities;
    const seen = [];
    const add = (kind, pt, def) => {
      const door = A.doorOf(pt);
      if (!door || seen.some((s) => Math.hypot(s.x - door.x, s.z - door.z) < 6)) return;
      seen.push(door);
      this.places.push({ kind, ...def, ...door });
    };
    for (const p of map.pois) {
      const def = PLACES[p.kind];
      if (!def || !map.inTown(p.x, p.z)) continue;
      add(p.kind, p, def);
    }
    if (P.ayto) add('ayto', P.ayto, { name: 'el Ayuntamiento', job: 'barrendero', boss: 'El concejal' });
    if (P.coop) add('coop', P.coop, { name: 'la Cooperativa', job: 'tractor', boss: 'El de la Cooperativa' });
    // the Policía Local job starts at their patrol car by the town hall
    this.P = P;
  }

  // on foot next to a parked Policía Local car: the job offer
  policeCarNear(x, z) {
    return this.game.fleet.vehicles.find((q) => q.spec.livery === 'local' && !q.driver && !q.ai && Math.abs(q.x - x) < 4 && Math.abs(q.z - z) < 4 && Math.hypot(q.x - x, q.z - z) < 3.2);
  }
  near(x, z, r = 2.4) {
    let best = null, bd = r;
    for (const pl of this.places) { const d = Math.hypot(pl.x - x, pl.z - z); if (d < bd) { bd = d; best = pl; } }
    return best;
  }

  // ------------------------------------------------------------ hiring
  hire(pl, type = pl.job) {
    const g = this.game;
    if (this.job) { g.hud.notify('Ya tienes un trabajo entre manos. Termínalo o déjalo antes.', 'info', 3); return; }
    if (g.police.wanted > 0) { g.hud.subtitle(pl.boss || 'El encargado', '¿Con la Guardia Civil detrás de ti? Ni hablar.'); setTimeout(() => g.hud.subtitle(null), 3000); return; }
    if (g.missions.active) { g.hud.notify('Termina antes la misión.', 'info', 3); return; }
    const cd = this.cd.get(pl) || 0;
    if (g.time < cd) { g.hud.subtitle(pl.boss || 'El encargado', 'Por hoy ya está, vuelve dentro de un rato.'); setTimeout(() => g.hud.subtitle(null), 2500); return; }
    const steps = this.plan(pl, type);
    if (!steps || !steps.length) { g.hud.notify('Ahora mismo no hay faena aquí.', 'info', 3); return; }
    this.job = { type, place: pl, steps, i: 0, earned: 0, t: 0, limit: steps.limit || 0 };
    const [line] = HIRE[type](pl);
    g.hud.subtitle(null, line);
    setTimeout(() => g.hud.subtitle(null), 4200);
    g.hud.banner('TRABAJO', cap(JOB_LABEL[type] || type), 'pass', 2.5);
    g.audio.sfx('mission_start', { vol: 0.6 });
    this.beginStep();
  }
  quit(reason = 'Dejas el trabajo.') {
    const g = this.game, j = this.job;
    if (!j) return;
    this.end();
    g.hud.notify(reason + (j.earned ? ` Has ganado ${j.earned} €.` : ''), 'info', 4);
  }
  end() {
    const g = this.game;
    if (this.job && this.job.van && !this.job.van.driver) this.job.van.keep = false;
    this.job = null; this.doing = null;
    this.marker.visible = false;
    g.hud.removeBlip('job');
    g.hud.objective = null; g.hud.objectiveText(null); g.hud.timer(null);
    g.player.carry = false;
  }

  // ------------------------------------------------------------ what each job consists of
  plan(pl, type) {
    const g = this.game, map = g.map, w = g.world;
    const doors = (w.facadeDoors || []).filter((d) => { const dd = Math.hypot(d.x - pl.x, d.z - pl.z); return dd > 90 && dd < 420; });
    const pickDoors = (n) => { const out = []; for (let k = 0; k < 80 && out.length < n; k++) { const d = pick(doors); if (d && !out.some((o) => Math.hypot(o.x - d.x, o.z - d.z) < 40)) out.push(d); } return out; };
    const S = [];
    const back = { at: { x: pl.x, z: pl.z }, r: 1.6, text: `Vuelve ${al(pl.name)} a cobrar.`, act: 'Cobrar', pay: 5, final: true };
    if (type === 'reparto') {
      S.push({ at: { x: pl.x, z: pl.z }, r: 1.6, text: `Recoge ${pl.what} en ${pl.name}.`, act: `Coger ${pl.what}`, hold: 0.8 });
      const ds = pickDoors(pl.fast ? 4 : 3);
      let budget = 0, last = pl;
      ds.forEach((d, i) => { budget += Math.hypot(d.x - last.x, d.z - last.z) / (pl.fast ? 6 : 3.6) + 14; last = d; S.push({ at: { x: d.x, z: d.z }, r: 1.4, text: `Entrega ${i + 1} de ${ds.length}: lleva el pedido a la puerta marcada.`, act: 'Entregar', pay: pl.fast ? 7 : 6, tip: true }); });
      S.push(back);
      S.limit = Math.round(budget + 40);
    } else if (type === 'cartero') {
      const ds = pickDoors(6);
      ds.forEach((d, i) => S.push({ at: { x: d.x, z: d.z }, r: 1.3, text: `Carta ${i + 1} de ${ds.length}: al buzón de la puerta marcada.`, act: 'Echar la carta', pay: 4, hold: 0.5 }));
      S.push({ ...back, pay: 12 });
    } else if (type === 'reponedor') {
      // the van parks at the kerb in front
      const q = map.nearestEdge(pl.x, pl.z, 40, (e) => e.drive && !e.blocked && !e.dirt);
      if (!q) return null;
      const d = map.sample(q.edge, q.s, {});
      const off = q.edge.w / 2 - 1.1;
      const side = ((pl.x - d.x) * -d.dz + (pl.z - d.z) * d.dx) >= 0 ? 1 : -1;
      const vx = d.x - d.dz * off * side, vz = d.z + d.dx * off * side;
      const van = g.fleet.spawn('emerita', vx, vz, Math.atan2(d.dx, d.dz), '#f2f2ee', { sleeping: true, keep: true, locked: true });
      const rear = van ? { x: vx - d.dx * 2.6, z: vz - d.dz * 2.6 } : { x: vx, z: vz };
      const n = 5;
      for (let k = 0; k < n; k++) {
        S.push({ at: rear, r: 1.5, text: `Caja ${k + 1} de ${n}: cógela de la furgoneta.`, act: 'Coger una caja', hold: 0.6, carry: true });
        S.push({ at: { x: pl.x, z: pl.z }, r: 1.5, text: `Caja ${k + 1} de ${n}: déjala en ${pl.name}.`, act: 'Dejar la caja', hold: 0.4, pay: 4, drop: true });
      }
      S.push({ ...back, pay: 8 });
      S.van = van;
    } else if (type === 'camarero') {
      const tabs = ((w.streetLifeDebug && w.streetLifeDebug.terraces) || []).filter((t) => Math.hypot(t.x - pl.x, t.z - pl.z) < 14);
      const spots = tabs.length ? tabs : [{ x: pl.x + (pl.x - pl.fx) * 0.8, z: pl.z + (pl.z - pl.fz) * 0.8 }];
      for (let k = 0; k < 5; k++) {
        const t = pick(spots);
        S.push({ at: { x: pl.x, z: pl.z }, r: 1.5, text: `Pedido ${k + 1} de 5: coge la bandeja de la barra.`, act: 'Coger la bandeja', hold: 0.6, carry: true });
        S.push({ at: { x: t.x, z: t.z }, r: 1.6, text: `Pedido ${k + 1} de 5: sirve la mesa marcada.`, act: 'Servir', pay: 2, tip: true, drop: true });
      }
      S.push({ ...back, pay: 10 });
      S.limit = 170;
    } else if (type === 'barrendero') {
      const ids = [...map.edgesNear(pl.x, pl.z, 220)].map((id) => map.edges[id]).filter((e) => e.walk && !e.blocked && e.len > 10);
      for (let k = 0; k < 8 && ids.length; k++) {
        const e = pick(ids), c = map.sample(e, Math.random() * e.len, {});
        const off = e.w / 2 + 0.8;
        const x = c.x - c.dz * off * (Math.random() < 0.5 ? 1 : -1), z = c.z + c.dx * off * (Math.random() < 0.5 ? 1 : -1);
        if (map.buildingAt(x, z)) { k--; ids.splice(ids.indexOf(e), 1); continue; }
        S.push({ at: { x, z }, r: 1.4, text: `Barre la basura marcada (${k + 1} de 8).`, act: 'Barrer', hold: 1.4, pay: 3 });
      }
      S.push({ ...back, pay: 16 });
      S.limit = 240;
    } else if (type === 'grua') {
      // a car broken down somewhere in town: drive it to the workshop
      const ok = (e) => e.drive && !e.blocked && !e.dirt && e.w >= 6 && e.cls !== 'track';
      const cand = [...map.edgesNear(pl.x, pl.z, 650)].map((id) => map.edges[id]).filter(ok);
      let car = null;
      for (let k = 0; k < 20 && !car; k++) {
        const e = pick(cand), s = 5 + Math.random() * (e.len - 10);
        const c = map.sample(e, s, {});
        if (Math.hypot(c.x - pl.x, c.z - pl.z) < 250) continue;
        const off = e.w / 2 - 1.1;
        const x = c.x - c.dz * off, z = c.z + c.dx * off;
        if (!g.fleet.boxFree(x, z, Math.atan2(c.dx, c.dz), { L: 4.2, W: 1.8 })) continue;
        car = g.fleet.spawn(pick(['cierzo', 'veton', 'morisco', 'taifa']), x, z, Math.atan2(c.dx, c.dz), null, { sleeping: true, keep: true, locked: false });
      }
      if (!car) return null;
      car.health = 300; // steaming and coughing, but it still runs
      S.push({ getIn: car, at: { x: car.x, z: car.z }, r: 3, text: 'Encuentra el coche averiado y súbete.' });
      S.push({ at: { x: pl.x, z: pl.z }, r: 5, vehicle: car, text: `Llévalo ${al(pl.name)}.`, act: 'Dejar el coche', pay: rint(40, 65), stop: true });
      S.push({ ...back, pay: 0 });
      S.van = car;
    } else if (type === 'tractor') {
      const gd = w.groundData || {};
      const plots = (gd.vinePlots || []).concat(gd.olivePlots || []);
      const pts = [];
      for (let k = 0; k < 40 && pts.length < 5; k++) {
        const pp = pick(plots);
        if (!pp) break;
        const r0 = pp.ring;
        const x = r0[0], z = r0[1];
        const dd = Math.hypot(x - pl.x, z - pl.z);
        if (dd < 120 || dd > 900 || pts.some((q) => Math.hypot(q.x - x, q.z - z) < 80)) continue;
        const q = map.nearestEdge(x, z, 80, (e) => e.drive && !e.blocked);
        if (q) pts.push({ x: q.x, z: q.z });
      }
      const sp = g.fleet.freeSpotNear(pl.x, pl.z, 'tractor');
      const tr = g.fleet.spawn('tractor', sp.x, sp.z, sp.heading, null, { sleeping: true, keep: true, locked: false });
      if (!tr || !pts.length) return null;
      S.push({ getIn: tr, at: { x: tr.x, z: tr.z }, r: 3.5, text: 'Súbete al tractor de la Cooperativa.' });
      pts.forEach((q, i) => S.push({ at: q, r: 6, vehicle: tr, text: `Parcela ${i + 1} de ${pts.length}: pasa por la marca.`, pay: 6 }));
      S.push({ at: { x: pl.x, z: pl.z }, r: 7, vehicle: tr, text: 'Devuelve el tractor a la Cooperativa.', act: 'Dejar el tractor', pay: 20, stop: true });
      S.van = tr;
    } else if (type === 'policia') {
      const v = g.fleet.vehicles.find((q) => q.spec.livery === 'local' && !q.driver && Math.hypot(q.x - pl.x, q.z - pl.z) < 60);
      if (!v) return null;
      S.push({ getIn: v, at: { x: v.x, z: v.z }, r: 3, text: 'Súbete al coche patrulla de la Policía Local.', patrol: true });
    }
    return S;
  }

  // ------------------------------------------------------------ steps
  beginStep() {
    const g = this.game, j = this.job, st = j.steps[j.i];
    if (!st) { this.finish(); return; }
    g.hud.objectiveText(st.text);
    g.hud.objective = st.at;
    g.hud.setBlip('job', { x: st.at.x, z: st.at.z, label: '', color: '#5fd06a', edge: true });
    this.marker.visible = !st.getIn;
    this.marker.position.set(st.at.x, 0.05, st.at.z);
    this.marker.scale.set(st.r, 2.4, st.r);
    g.hud.routeT = 0;
  }
  completeStep() {
    const g = this.game, j = this.job, st = j.steps[j.i], p = g.player;
    let pay = st.pay || 0;
    if (st.tip) {
      const onTime = !j.limit || j.t < j.limit;
      const tip = onTime ? rint(1, 5) : 0;
      pay += tip;
      g.peds.say({ x: st.at.x, z: st.at.z, y: 0 }, pick(THANKS) + (tip ? ` (+${tip} € de propina)` : ''), true);
    }
    pay = Math.round(pay * PERK.pay);
    if (pay) { p.money += pay; j.earned += pay; g.audio.sfx('money', { vol: 0.6 }); g.hud.notify(`+${pay} €`, 'ok', 1.6); }
    if (st.carry) p.carry = true;
    if (st.drop) p.carry = false;
    if (st.patrol) { const v = st.getIn; this.end(); g.activities.startPatrol(v); g.hud.notify('Estás de servicio. Te pagan por cada sospechoso detenido.', 'ok', 4); return; }
    j.i++;
    if (j.i >= j.steps.length) { this.finish(); return; }
    this.beginStep();
  }
  finish() {
    const g = this.game, j = this.job;
    if (!j) return;
    const pl = j.place;
    this.cd.set(pl, g.time + 90);
    g.hud.banner('TRABAJO TERMINADO', `${j.earned} € ganados`, 'pass', 3.5);
    g.audio.sfx('mission_pass', { vol: 0.6 });
    if (j.steps.van && !j.steps.van.driver) j.steps.van.keep = false;
    this.end();
    g.persist();
  }

  // the prompt for the current step (called by the activities prompt system)
  option() {
    const g = this.game, j = this.job, p = g.player;
    if (!j) return null;
    const st = j.steps[j.i];
    if (!st) return null;
    if (this.doing) return { label: `${st.act}… <b>${Math.round((this.doing.t / this.doing.dur) * 100)} %</b>`, info: true };
    if (st.getIn) return null; // done by getting in
    if (st.vehicle && p.vehicle !== st.vehicle) return null;
    const d = Math.hypot(p.pos.x - st.at.x, p.pos.z - st.at.z);
    if (d > st.r) return null;
    if (!st.act) return null; // a plain checkpoint (passing is enough)
    if (st.stop && p.vehicle && p.vehicle.vel > 2.5) return { label: 'Para en la marca', info: true };
    return { label: st.act, run: () => { if (st.hold) this.doing = { t: 0, dur: st.hold }; else this.completeStep(); } };
  }

  update(dt) {
    const g = this.game, j = this.job, p = g.player;
    if (!j) return;
    j.t += dt;
    if (j.limit) g.hud.timer(Math.max(0, j.limit - j.t));
    const st = j.steps[j.i];
    if (!st) return;
    this.marker.material.opacity = 0.24 + Math.sin(g.time * 3) * 0.08;
    if (g.police.wanted > 0) { this.quit('Con la policía detrás pierdes el trabajo.'); return; }
    if (p.mode === 'dead' || p.mode === 'busted') { this.quit('Se acabó la jornada.'); return; }
    // a held action (sweeping, picking up): stay put until it is done
    if (this.doing) {
      const d = Math.hypot(p.pos.x - st.at.x, p.pos.z - st.at.z);
      if (d > st.r + 0.6) { this.doing = null; return; }
      this.doing.t += dt;
      if (this.doing.t >= this.doing.dur) { this.doing = null; this.completeStep(); }
      return;
    }
    if (st.getIn) {
      const v = st.getIn;
      if (v.removed || v.dead) { this.quit('El vehículo ya no está.'); return; }
      g.hud.setBlip('job', { x: v.x, z: v.z, label: '', color: '#6fc0ff', edge: true });
      if (p.vehicle === v) this.completeStep();
      return;
    }
    // plain checkpoints (the tractor round) are done by passing through
    if (!st.act) {
      if (st.vehicle && p.vehicle !== st.vehicle) { g.hud.help('Vuelve al vehículo para seguir.', 1); return; }
      if (Math.hypot(p.pos.x - st.at.x, p.pos.z - st.at.z) < st.r) this.completeStep();
    }
    if (st.vehicle && st.vehicle.dead) this.quit('Has destrozado el vehículo. Te echan.');
  }
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

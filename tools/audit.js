// Dev-only street audit: walks every street of the map (teleporting along each edge every few metres and trying to
// walk on), drives every drivable street, and photographs each named street, collecting anomalies.
// Load in the dev page:  const A = await import('/tools/audit.js'); await A.foot(); A.report
import { setup, sim } from '/tools/playtest.js';

const g = () => window.game;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// a yield that background tabs do not throttle (timers are clamped to a second there)
const yieldNow = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
// run n game frames right away (no awaiting), returning the worst frame time
function frames(n, dt = 1 / 60) {
  const G = g(); let worst = 0;
  for (let i = 0; i < n; i++) {
    if (G.state === 'paused') { G.state = 'play'; const pz = document.getElementById('pause'); if (pz) pz.hidden = true; }
    const t0 = performance.now();
    try { G.frame(dt); } catch (e) { report.errors = report.errors || []; if (report.errors.length < 20) report.errors.push(String(e.stack || e).slice(0, 300)); }
    worst = Math.max(worst, performance.now() - t0);
  }
  return worst;
}
export const stop = { flag: false };
export const report = { foot: {}, car: {}, notes: [], frames: [] };
const add = (bucket, kind, detail) => { const r = bucket[kind] || (bucket[kind] = { n: 0, ex: [] }); r.n++; if (r.ex.length < 12) r.ex.push(detail); };
const f1 = (v) => Math.round(v * 10) / 10;

function edgesInTown() {
  const M = g().map;
  return M.edges.filter((e) => !e.blocked && M.inTown(e.pts[0], e.pts[1]));
}
function sampleEdge(e, step) {
  const M = g().map, out = [], tmp = {};
  for (let s = 2; s < e.len - 1; s += step) { M.sample(e, s, tmp); out.push({ x: tmp.x, z: tmp.z, dx: tmp.dx, dz: tmp.dz, s }); }
  return out;
}

// every street on foot: stand on the road and on each pavement, check what is there, try to walk on a little
export async function foot(opts = {}) {
  const G = g(), M = G.map, p = G.player;
  const bot = await setup();
  if (p.vehicle) { bot.enter = true; await sim(1.5); }
  const R = report.foot;
  const step = opts.step || 8, edges = opts.edges || edgesInTown();
  let n = 0, t0 = performance.now();
  for (const e of edges) {
    for (const q of sampleEdge(e, step)) {
      for (const side of [0, 1, -1]) {
        const off = side ? e.w / 2 + (e.sw || 1.8) * 0.5 : 0;
        const x = q.x - q.dz * off * side, z = q.z + q.dx * off * side;
        p.pos.set(x, 0, z); p.vel.set(0, 0, 0); p.grounded = true; p.mode = 'foot';
        const wf = frames(2);
        if (wf > 60) add(R, 'slow_frame', `${e.name || e.id} ${f1(x)},${f1(z)} ${Math.round(wf)} ms`);
        const push = Math.hypot(p.pos.x - x, p.pos.z - z);
        if (M.buildingAt(x, z)) add(R, side ? 'pavement_in_building' : 'road_in_building', `${e.name || e.id} ${f1(x)},${f1(z)}`);
        else if (push > 0.6) add(R, side ? 'pavement_blocked' : 'road_blocked', `${e.name || e.id} ${f1(x)},${f1(z)} pushed ${f1(push)}`);
        n++;
      }
      // walk along the road for a second
      if (q.s % (step * 3) < step) {
        p.pos.set(q.x, 0, q.z); p.vel.set(0, 0, 0);
        const h = Math.atan2(q.dx, q.dz);
        G.cam.yaw = h + Math.PI; p.heading = h;
        bot.moveY = 1; bot.moveX = 0; bot.sprint = false;
        const sx = p.pos.x, sz = p.pos.z;
        frames(60);
        bot.moveY = 0;
        const d = Math.hypot(p.pos.x - sx, p.pos.z - sz);
        if (d < 0.8) add(R, 'walk_blocked', `${e.name || e.id} ${f1(q.x)},${f1(q.z)} moved ${f1(d)}`);
      }
    }
    report.progress = { edge: edges.indexOf(e), of: edges.length, n };
    await yieldNow();
    if (stop.flag) break;
  }
  report.notes.push(`foot: ${n} points in ${Math.round((performance.now() - t0) / 1000)} s`);
  return { n, R };
}

// every drivable street by car, at a moderate speed, following the street's own line
export async function car(opts = {}) {
  const G = g(), M = G.map, p = G.player;
  const bot = await setup();
  const R = report.car;
  const edges = (opts.edges || edgesInTown()).filter((e) => e.drive && e.len > 12);
  // a car of our own, kept alive while we move it round
  if (!p.vehicle) {
    G.fleet.streamParked(p.pos.x, p.pos.z);
    const vs = G.fleet.vehicles.filter((v) => !v.driver && !v.ai && !v.dead && !v.spec.twoWheel && v.spec.shape !== 'tractor');
    vs.sort((a, b) => Math.hypot(a.x - p.pos.x, a.z - p.pos.z) - Math.hypot(b.x - p.pos.x, b.z - p.pos.z));
    p.getIn(vs[0]);
    await sim(0.5);
  }
  const v = p.vehicle;
  if (!v) return 'no car';
  v.keep = true;
  const F = G.fleet, oi = F.onImpact;
  let curEdge = null;
  F.onImpact = function (vv, imp, px, pz, other) { if (vv === v && imp > 3.5) add(R, other ? 'hit_vehicle' : 'hit_static', `${curEdge && (curEdge.name || curEdge.id)} ${f1(px)},${f1(pz)} imp ${f1(imp)}${other ? ' ' + other.model : ''}`); return oi.call(this, vv, imp, px, pz, other); };
  let done = 0;
  try {
    for (const e of edges) {
      curEdge = e;
      const pts = sampleEdge(e, 4);
      if (pts.length < 3) continue;
      const a = pts[0];
      v.x = a.x; v.z = a.z; v.heading = Math.atan2(a.dx, a.dz); v.vx = v.vz = v.w = 0; v.health = 1000; v.sleeping = false;
      // clear parked cars that sit on the line (we test the street, not the parking)
      let idx = 1, stuck = 0, t = 0;
      const lim = Math.min(40, e.len / 4 + 6);
      while (idx < pts.length && t < lim) {
        const q = pts[idx];
        const dx = q.x - v.x, dz = q.z - v.z;
        if (Math.hypot(dx, dz) < 3.5) { idx++; continue; }
        const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
        const lf = dx * fx + dz * fz, lr = dx * -fz + dz * fx;
        bot.steer = Math.max(-1, Math.min(1, Math.atan2(lr, Math.max(0.1, lf)) * 1.8));
        const want = Math.min(9, e.w < 6 ? 5 : 9);
        bot.throttle = v.speed < want ? 1 : 0; bot.brakeIn = v.speed > want + 1.5 ? 1 : 0;
        frames(2);
        t += 1 / 30;
        if (v.vel < 0.5) stuck += 1 / 30; else stuck = 0;
        if (stuck > 2.5) { add(R, 'car_stuck', `${e.name || e.id} ${f1(v.x)},${f1(v.z)} cls=${e.cls} w=${e.w}`); break; }
        const sf = F.surfaceAt(v.x, v.z);
        if (!sf.onRoad && e.w > 4) { add(R, 'off_road', `${e.name || e.id} ${f1(v.x)},${f1(v.z)}`); }
        if (M.buildingAt(v.x, v.z)) { add(R, 'car_in_building', `${e.name || e.id} ${f1(v.x)},${f1(v.z)}`); break; }
      }
      done++;
      report.progress = { edge: done, of: edges.length };
      await yieldNow();
      if (stop.flag) break;
    }
  } finally { F.onImpact = oi; bot.throttle = 0; bot.brakeIn = 1; bot.steer = 0; }
  report.notes.push(`car: ${done} streets`);
  return { done, R };
}

// one photograph per named street (street level, looking along it) → grids of 6 saved to .snaps
export async function photos(opts = {}) {
  const G = g(), M = G.map, THREE = G.camera.constructor;
  const byName = new Map();
  for (const e of edgesInTown()) { const k = e.name || null; if (!k) continue; const cur = byName.get(k); if (!cur || e.len > cur.len) byName.set(k, e); }
  const list = [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const W = 380, H = 260, cols = 3, per = 6;
  const r = G.renderer, dpr = r.getPixelRatio(), size = { x: r.domElement.width / dpr, y: r.domElement.height / dpr };
  const cam = G.camera.clone(); cam.fov = 62; cam.aspect = W / H; cam.updateProjectionMatrix();
  const tmp = {}, out = [];
  if (opts.hour != null) { G.sky.hour = opts.hour; }
  for (let gi = 0; gi < list.length; gi += per) {
    const cv = document.createElement('canvas'); cv.width = W * cols; cv.height = H * Math.ceil(per / cols);
    const x2 = cv.getContext('2d');
    const chunk = list.slice(gi, gi + per);
    for (let i = 0; i < chunk.length; i++) {
      const [name, e] = chunk[i];
      M.sample(e, e.len * 0.3, tmp);
      const h = Math.atan2(tmp.dx, tmp.dz);
      G.player.pos.set(tmp.x, 0, tmp.z);
      frames(Math.round((opts.settle || 1.2) * 60));
      await yieldNow();
      cam.position.set(tmp.x - tmp.dz * (e.w * 0.25), 1.7, tmp.z + tmp.dx * (e.w * 0.25));
      cam.lookAt(tmp.x + tmp.dx * 20, 1.4, tmp.z + tmp.dz * 20);
      cam.updateMatrixWorld();
      G.sky.update(0, cam.position);
      G.world.update(0, G.sky.night, cam.position);
      G.chars.updateLods(cam.position, true);
      r.setSize(W, H, false);
      r.render(G.scene, cam);
      x2.drawImage(r.domElement, 0, 0, r.domElement.width, r.domElement.height, (i % cols) * W, Math.floor(i / cols) * H, W, H);
      x2.fillStyle = 'rgba(0,0,0,0.55)'; x2.fillRect((i % cols) * W, Math.floor(i / cols) * H, W, 18);
      x2.fillStyle = '#fff'; x2.font = '13px monospace'; x2.fillText(`${gi + i + 1}. ${name}`, (i % cols) * W + 5, Math.floor(i / cols) * H + 13);
    }
    r.setSize(size.x, size.y, false);
    const nm = (opts.prefix || 'street') + String(gi / per + 1).padStart(2, '0');
    await fetch('/__snap?name=' + nm, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.85) });
    out.push(nm);
  }
  return { streets: list.length, files: out };
}

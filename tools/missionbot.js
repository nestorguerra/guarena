// Dev-only: plays every story mission by "teleporting" to each objective (a smoke test of the scripts: every step
// reachable, no errors, the right outcome). Load in the dev page:
//   const MB = await import('/tools/missionbot.js'); await MB.all()
import { setup } from '/tools/playtest.js';

const g = () => window.game;
const yieldNow = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });

export async function run(id, opts = {}) {
  const G = g(), M = G.missions, p = G.player;
  await setup();
  const def = M.defs.find((d) => d.id === id);
  if (!def) return { id, error: 'no such mission' };
  if (M.active) M.cancel();
  if (p.vehicle) p.exitVehicle(true);
  G.police.clear && G.police.clear(); G.police.wanted = 0; G.police.heat = 0;
  const log = [], errors = [];
  let skipT = 0;
  Object.defineProperty(G.input, 'skip', { configurable: true, get: () => { skipT++; return skipT % 20 === 0; } });
  // walk up to the giver first (as a player would)
  p.pos.set(def.giver.at.x + 3, 0, def.giver.at.z + 3);
  M.start(def);
  let t = 0, lastText = '', taskT = 0, lastTask = null, outcome = null;
  const origFail = M.fail.bind(M), origComplete = M.complete.bind(M);
  M.fail = (msg) => { outcome = 'FAIL: ' + msg; origFail(msg); };
  M.complete = () => { outcome = 'PASS'; origComplete(); };
  try {
    while (M.active && t < (opts.max || 400)) {
      const a = M.active, task = a.task;
      if (task !== lastTask) { lastTask = task; taskT = 0; }
      taskT += 1 / 60;
      const txt = (document.getElementById('objective') || {}).textContent || '';
      if (txt && txt !== lastText) { lastText = txt; log.push(`${t.toFixed(0)}s ${txt.slice(0, 90)}`); }
      const o = G.hud.objective;
      if (o && taskT > 0.5) {
        // a vehicle to get into (the arrow above it) or a place to reach
        const v = G.fleet.vehicles.find((x) => Math.hypot(x.x - o.x, x.z - o.z) < 1.5 && !x.dead);
        if (v && !p.vehicle && M.arrow && M.arrow.visible) { p.pos.set(v.x + 2, 0, v.z); p.getIn(v); }
        else if (p.vehicle) { const w = p.vehicle; w.x = o.x; w.z = o.z; w.vx = w.vz = 0; w.w = 0; }
        else p.pos.set(o.x, 0, o.z);
      }
      // escape the police: let the stars go after a while
      if (/esquinazo/i.test(txt) && taskT > 5) { G.police.wanted = 0; G.police.heat = 0; }
      try { G.frame(1 / 60); } catch (e) { errors.push(String(e.stack || e).slice(0, 300)); if (errors.length > 5) break; }
      t += 1 / 60;
      if (Math.round(t * 60) % 30 === 0) await yieldNow();
    }
  } finally {
    M.fail = origFail; M.complete = origComplete;
    delete G.input.skip;
  }
  if (M.active) { outcome = outcome || `STUCK at "${lastText.slice(0, 80)}"`; M.cancel(); }
  if (p.vehicle) p.exitVehicle(true);
  return { id, outcome, secs: Math.round(t), log: log.slice(0, 14), errors };
}

export async function all() {
  const G = g(), out = [];
  for (const d of G.missions.defs) out.push(await run(d.id));
  return out;
}

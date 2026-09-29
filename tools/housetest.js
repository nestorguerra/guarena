// Dev-only: walks every enterable house in every direction (both storeys, at 60 and at 20 fps) and reports where the
// player gets through a wall of the collider or out of the house. Load in the dev page:
//   const H = await import('/tools/housetest.js'); await H.all()
import { setup } from '/tools/playtest.js';

const g = () => window.game;
const yieldNow = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });

// does the move a→b cross a wall segment of this collider (taller than a kerb)?
function crosses(col, ax, az, bx, bz) {
  let hit = null;
  col.forSegs(Math.min(ax, bx) - 0.5, Math.min(az, bz) - 0.5, Math.max(ax, bx) + 0.5, Math.max(az, bz) + 0.5, (i, o) => {
    const S = col.segs;
    if (S[o + 4] < 0.3) return false;
    const x1 = S[o], z1 = S[o + 1], x2 = S[o + 2], z2 = S[o + 3];
    const d = (bx - ax) * (z2 - z1) - (bz - az) * (x2 - x1);
    if (Math.abs(d) < 1e-9) return false;
    const t = ((x1 - ax) * (z2 - z1) - (z1 - az) * (x2 - x1)) / d;
    const u = ((x1 - ax) * (bz - az) - (z1 - az) * (bx - ax)) / d;
    if (t > 0 && t < 1 && u > 0 && u < 1) { hit = [x1, z1, x2, z2]; return true; }
    return false;
  });
  return hit;
}

export async function house(door, opts = {}) {
  const G = g(), I = G.interiors, p = G.player;
  const bot = await setup();
  if (p.vehicle) p.exitVehicle(true);
  if (I.house) I.leave(true);
  p.pos.set(door.x, 0, door.z);
  await I.enter(door, { mode: door.owner ? 'owner' : 'visit', silent: true });
  const H = G.interior;
  if (!H) return { name: door.name, error: 'no entra' };
  if (I.life) { I.life.dispose(); I.life = null; } // nobody home: only walls matter here
  const b = H.bounds || { x0: H.origin.x - 6, x1: H.origin.x + 6, z0: H.origin.z, z1: H.origin.z + 18 };
  const levels = H.levels || [H.collider];
  const out = { name: door.name, kind: H.kind, levels: levels.length, runs: 0, tunnels: [], escapes: [] };
  const dirs = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => (k * Math.PI) / 4);
  for (let lv = 0; lv < levels.length; lv++) {
    const Y = lv ? (H.floorY ? H.floorY(b.x0 + 0.1, b.z0 + 0.1, 99) : 3.1) : 0;
    // upstairs: only where there is an upper floor (inside the walls of that storey)
    let bx0 = b.x0, bx1 = b.x1, bz0 = b.z0, bz1 = b.z1;
    if (lv) { const S = levels[lv].segs; bx0 = bz0 = Infinity; bx1 = bz1 = -Infinity; for (let i = 0; i < S.length; i += 6) { bx0 = Math.min(bx0, S[i], S[i + 2]); bx1 = Math.max(bx1, S[i], S[i + 2]); bz0 = Math.min(bz0, S[i + 1], S[i + 3]); bz1 = Math.max(bz1, S[i + 1], S[i + 3]); } }
    for (let x = bx0 + 0.4; x < bx1 - 0.3; x += opts.step || 0.8) {
      for (let z = bz0 + 0.4; z < bz1 - 0.3; z += opts.step || 0.8) {
        for (const dt of [1 / 60, 1 / 20]) {
          for (const h of dirs) {
            p.pos.set(x, Y, z); p.vel.set(0, 0, 0); p.grounded = true; p.mode = 'foot'; p.crouch = false;
            H.level = lv; G.map.collider = levels[lv];
            // is the start a free spot? (pushed out of furniture → skip)
            const sx = x, sz = z;
            G.map.collider.resolveCircle(p.pos, 0.34);
            if (Math.hypot(p.pos.x - sx, p.pos.z - sz) > 0.05) continue;
            G.cam.yaw = h + Math.PI; p.heading = h;
            bot.moveY = 1; bot.moveX = 0; bot.sprint = true;
            let px = p.pos.x, pz = p.pos.z;
            for (let f = 0; f < Math.round(1.1 / dt); f++) {
              try { G.frame(dt); } catch (e) { out.error = String(e).slice(0, 200); break; }
              const col = H.levels ? H.levels[H.level] : G.map.collider;
              const c = crosses(col, px, pz, p.pos.x, p.pos.z);
              if (c && out.tunnels.length < 40) out.tunnels.push({ lv, dt: Math.round(1 / dt), from: [+(px - H.origin.x).toFixed(2), +(pz - H.origin.z).toFixed(2)], to: [+(p.pos.x - H.origin.x).toFixed(2), +(p.pos.z - H.origin.z).toFixed(2)], y: +p.pos.y.toFixed(2), seg: c.map((v, i) => +(v - (i % 2 ? H.origin.z : H.origin.x)).toFixed(2)) });
              if ((p.pos.x < bx0 - 0.3 || p.pos.x > bx1 + 0.3 || p.pos.z < bz0 - 0.3 || p.pos.z > bz1 + 0.3) && out.escapes.length < 20) { out.escapes.push({ lv, dt: Math.round(1 / dt), at: [+(p.pos.x - H.origin.x).toFixed(2), +(p.pos.z - H.origin.z).toFixed(2)], y: +p.pos.y.toFixed(2) }); break; }
              px = p.pos.x; pz = p.pos.z;
              if (!G.interior) break;
            }
            out.runs++;
            bot.moveY = 0; bot.sprint = false;
            if (!G.interior) { out.left = true; await I.enter(door, { mode: door.owner ? 'owner' : 'visit', silent: true }); if (I.life) { I.life.dispose(); I.life = null; } }
          }
        }
        await yieldNow();
      }
    }
  }
  I.leave(true);
  return out;
}

export async function all(opts = {}) {
  const G = g(), res = [];
  const doors = opts.doors || G.interiors.doors;
  for (const d of doors) res.push(await house(d, opts));
  return res;
}

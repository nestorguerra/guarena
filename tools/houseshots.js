// Dev-only: photographs every room of a house, looking four ways from the middle of it, into contact sheets
// (.snaps/<name>_<room>.jpg, through the dev server). Load in the dev page:
//   const HS = await import('/tools/houseshots.js'); await HS.house(game.interiors.doors[0], { name: 'annie' })
import { setup } from '/tools/playtest.js';

const yieldNow = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
const step = (n) => { const G = window.game; for (let i = 0; i < n; i++) { if (G.state === 'paused') { G.state = 'play'; document.getElementById('pause').hidden = true; } G.frame(1 / 60); } };

// Annie's house keeps no room list: its rooms by hand (house coordinates)
const ANNIE = [
  ['saloncito', -1.2, 2.2, 0], ['recibidor', 1.6, 5.2, 0], ['cocina', -1.4, 6.0, 0], ['bano', -1.2, 9.4, 0], ['patio', 0.6, 12.4, 0],
  ['dormitorio', -0.4, 2.6, 1], ['banoAlto', -1.4, 6.2, 1], ['estudio', -1.4, 8.9, 1], ['rellano', 1.5, 9.8, 1],
];

async function post(name, canvas) {
  await fetch('/__snap?name=' + name, { method: 'POST', body: canvas.toDataURL('image/jpeg', 0.84) });
}

export async function house(door, { w = 480, h = 300, name = 'casa', hour = 12, only = null } = {}) {
  const G = window.game, I = G.interiors, p = G.player, r = G.renderer;
  await setup();
  if (p.vehicle) p.exitVehicle(true);
  if (I.house) I.leave(true);
  p.pos.set(door.x, 0, door.z);
  await I.enter(door, { mode: door.owner ? 'owner' : 'visit', silent: true });
  const H = G.interior;
  if (I.life) { I.life.dispose(); I.life = null; }
  G.sky.hour = hour; step(200);
  const O = H.origin;
  const F2 = H.floorY ? H.floorY(O.x - 99, O.z - 99, 99) : 3.1;
  let rooms;
  if (H.kind === 'annie') rooms = ANNIE.map(([id, x, z, lv]) => ({ id, x: O.x + x, z: O.z + z, y: lv ? F2 : 0 }));
  else if (H.rooms) rooms = H.rooms.map((q) => ({ id: q.id, x: (q.x0 + q.x1) / 2, z: (q.z0 + q.z1) / 2, y: q.lv ? F2 : 0 }));
  else rooms = Object.entries(H.spots.floor || {}).map(([id, q]) => ({ id, x: q.x, z: q.z, y: 0 }));
  if (only) rooms = rooms.filter((q) => only.includes(q.id));
  const sheet = document.createElement('canvas'); sheet.width = w * 2; sheet.height = h * 2;
  const ctx = sheet.getContext('2d');
  r.setSize(w, h, false);
  if (G.composer) { G.composer.setSize(w, h); if (G.bloom) G.bloom.setSize(w, h); }
  G.camera.aspect = w / h; G.camera.updateProjectionMatrix();
  const done = [];
  for (const q of rooms) {
    for (let k = 0; k < 4; k++) {
      p.pos.set(q.x, q.y, q.z); p.vel.set(0, 0, 0);
      G.cam.yaw = (k * Math.PI) / 2; G.cam.pitch = -0.12;
      step(3);
      G.render();
      const c = r.domElement;
      ctx.drawImage(c, 0, 0, c.width, c.height, (k % 2) * w, Math.floor(k / 2) * h, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect((k % 2) * w, Math.floor(k / 2) * h, 150, 20);
      ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
      ctx.fillText(`${q.id} · ${['calle', 'yaw90', 'fondo', 'yaw270'][k]}`, (k % 2) * w + 6, Math.floor(k / 2) * h + 14);
    }
    await post(`${name}_${q.id}`, sheet);
    done.push(q.id);
    await yieldNow();
  }
  I.leave(true);
  G.resize();
  return done;
}

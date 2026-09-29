// paste-in harness for dist/test.html
(async () => {
const G = window.game; const wait = (ms) => new Promise(r => setTimeout(r, ms));
if (G.state !== 'play') { document.getElementById('bPlay').click(); await wait(800); if (!document.getElementById('select').hidden) document.getElementById('bStart').click(); await wait(1500); }
const inp = G.input; const bot = (window.bot = window.bot || {});
const defaults = { moveX: 0, moveY: 0, throttle: 0, brakeIn: 0, steer: 0, handbrake: false, sprint: false, jump: false, enter: false, attack: false, horn: false, aim: false, fire: false, firePressed: false, interact: false, weaponNext: false, weaponPrev: false, weaponDigit: 0, reload: false, siren: false, crouch: false, camToggle: false, phone: false };
for (const k in defaults) if (!(k in bot)) bot[k] = defaults[k];
const ONESHOT = new Set(['enter', 'jump', 'attack', 'firePressed', 'interact', 'weaponNext', 'weaponPrev', 'weaponDigit', 'reload', 'siren', 'crouch', 'camToggle', 'phone']);
for (const k of Object.keys(bot)) Object.defineProperty(inp, k, { configurable: true, get: () => { const v = bot[k]; if (ONESHOT.has(k)) bot[k] = k === 'weaponDigit' ? 0 : false; return v; } });
window.errs = [];
window.sim = async (sec) => { for (let i = 0; i < Math.round(sec*60); i++) { if (G.state === 'paused') { G.state = 'play'; document.getElementById('pause').hidden = true; } try { G.frame(1/60); } catch (e) { window.errs.push(String(e.stack||e).slice(0,300)); return; } if (i % 30 === 0) await wait(0); } };
window.tp = async (x, z, s = 2) => { G.player.pos.x = x; G.player.pos.z = z; await sim(s); };
window.nearestV = (f) => { const P = G.player; return G.fleet.vehicles.filter(v => !v.driver && !v.ai && !v.dead && f(v)).sort((a,b) => Math.hypot(a.x-P.pos.x,a.z-P.pos.z) - Math.hypot(b.x-P.pos.x,b.z-P.pos.z))[0]; };
window.getIn = async (v) => { const P = G.player; v.locked = false; const fx = Math.sin(v.heading), fz = Math.cos(v.heading); const off = v.spec.twoWheel ? 1.1 : v.spec.W / 2 + 0.6; P.pos.x = v.x + fz * off; P.pos.z = v.z - fx * off; P.heading = v.heading - Math.PI/2; await sim(0.3); bot.enter = true; await sim(3.5); return P.vehicle === v; };
window.shot = async () => { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); };
return 'ready';
})()

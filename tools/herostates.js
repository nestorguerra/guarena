// Dev-only: the hero in each of the old character's states — punching while walking, at the wheel, seated, knocked
// down and getting up, in the air, crouched, hands up, aiming — one picture each (.snaps/hs_<tag>.jpg, a sheet).
//   const S = await import('/tools/herostates.js?' + Date.now()); await S.all('a')
import * as THREE from 'three';
import { renderInto } from '/tools/herolab.js';
const G = () => window.game;
const OPEN = { x: -346.5, z: 49.4 };
export async function all(tag = 'a') {
  const g = G(), p = g.player, ch = p.char, dt = 1 / 30;
  p.spawnAt(OPEN.x, OPEN.z, 0); p.mode = 'foot';
  g.sky.update(0, new THREE.Vector3(OPEN.x, 0, OPEN.z), true);
  const W = 300, H = 400, imgs = [], errs = [];
  const cv = document.createElement('canvas'); cv.width = 11 * W; cv.height = H + 22;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  const step = (n, speed, opts = {}, each) => { for (let i = 0; i < n; i++) { if (each) each(i); ch.update(dt, speed, { grounded: true, ...opts }); ch.object.position.set(OPEN.x, opts.y || 0, OPEN.z); ch.object.rotation.set(0, 0, 0); if (ch.afterMove) ch.afterMove(); } };
  const snap = async (label, cam = [OPEN.x + 2.4, 1.3, OPEN.z + 1.6], look = [OPEN.x, 0.85, OPEN.z]) => {
    ch.object.updateMatrixWorld(true);
    const i = imgs.length;
    renderInto(ctx, i * W, 22, cam, look, 42, W, H);
    ctx.fillStyle = '#000'; ctx.font = '15px sans-serif'; ctx.fillText(label, i * W + 8, 16);
    imgs.push(label);
  };
  const tryIt = async (label, fn) => { try { await fn(); } catch (e) { errs.push(label + ': ' + String(e && e.message || e)); } };
  await tryIt('idle', async () => { step(30, 0); await snap('quieto'); });
  await tryIt('punch walking', async () => { step(20, 1.4); ch.play('punch', 0.45); step(6, 1.4); await snap('puñetazo andando'); step(20, 1.4); });
  await tryIt('kick', async () => { step(10, 0); ch.play('kick', 0.6); step(9, 0); await snap('patada'); step(20, 0); });
  await tryIt('drive', async () => { ch.setBase('drive'); step(40, 0); await snap('conduciendo'); ch.setBase(null); step(20, 0); });
  await tryIt('sit', async () => { ch.setBase('sitTalk'); step(40, 0); await snap('sentado charlando'); ch.setBase(null); step(20, 0); });
  await tryIt('handsup', async () => { ch.setBase('handsup'); step(30, 0); await snap('manos arriba'); ch.setBase(null); step(20, 0); });
  await tryIt('aim', async () => { ch.setBase('aim'); step(30, 1.2); await snap('apuntando andando'); ch.setBase(null); step(20, 0); });
  await tryIt('air', async () => { step(10, 0); step(8, 1.4, { grounded: false, vy: 2 }); await snap('en el aire'); step(4, 1.4, { grounded: false, vy: -3 }); step(20, 0); });
  await tryIt('crouch', async () => { step(30, 1.0, { crouch: true }); await snap('agachado'); step(30, 0); });
  await tryIt('ragdoll', async () => {
    ch.ragdoll({ vel: [0, 1, 2], up: 0.7, legs: -0.3, tone: 0.8 });
    for (let i = 0; i < 60; i++) { ch.update(dt, 0, {}); }
    const pp = new THREE.Vector3(); ch.ragPos(pp);
    await snap('derribado', [pp.x + 2.4, 1.3, pp.z + 1.6], [pp.x, 0.3, pp.z]);
    const up = ch.getUp();
    for (let i = 0; i < 30; i++) ch.update(dt, 0, {});
    await snap('levantándose', [up.x + 2.4, 1.3, up.z + 1.6], [up.x, 0.6, up.z]);
    for (let i = 0; i < 60; i++) ch.update(dt, 0, {});
    ch.standUp();
  });
  g.resize();
  await fetch('/__snap?name=hs_' + tag, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.82) });
  return { shots: imgs.length, errs };
}

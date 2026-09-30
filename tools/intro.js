// Dev-only: paints the drone's picture of Guareña the page shows while the game loads (src/intro.js), from exactly the
// camera the live flight starts at, and saves it to .snaps/intro.jpg (copy it to assets/intro.jpg).
//   const I = await import('/tools/intro.js?' + Date.now()); await I.paint()
import * as THREE from 'three';
const G = () => window.game;
export async function paint({ W = 1920, H = 1080, q = 0.84 } = {}) {
  const g = G(), I = await import('/src/intro.js?' + Date.now()), M = await import('/src/materials.js');
  const plan = I.introPlan(g);
  g.sky.hour = I.INTRO.hour; g.sky.uniforms.uTime.value = 0;
  const cam = new THREE.PerspectiveCamera(I.INTRO.fov, W / H, 0.5, 4200);
  cam.position.copy(plan.D0); cam.lookAt(plan.T); cam.updateMatrixWorld();
  M.shared.uNight.value = g.sky.update(0, cam.position, true);
  // the player where the flight will find him, so he is in the picture too
  if (g.player && g.player.char) { g.player.spawnAt(plan.P.x, plan.P.z, plan.heading); g.player.char.object.visible = true; }
  for (let i = 0; i < 6; i++) { g.world._lodT = 0; g.world.update(0, 0, cam.position); }
  g.renderer.setSize(W, H, false); if (g.toon) g.toon.setSize(W, H);
  const pr = g.renderer.getPixelRatio(); g.renderer.setPixelRatio(1); if (g.toon) g.toon.setSize(W, H);
  g.renderView(cam); g.renderView(cam);
  const c = g.renderer.domElement, o = document.createElement('canvas'); o.width = W; o.height = H;
  o.getContext('2d').drawImage(c, 0, 0, c.width, c.height, 0, 0, W, H);
  await fetch('/__snap?name=intro', { method: 'POST', body: o.toDataURL('image/jpeg', q) });
  g.renderer.setPixelRatio(pr); g.resize();
  return { P: plan.P.toArray().map((v) => +v.toFixed(1)), heading: +plan.heading.toFixed(3), D0: plan.D0.toArray().map((v) => +v.toFixed(1)) };
}

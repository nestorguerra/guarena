// Dev-only snapshot helpers (the preview pane is hidden, so the canvas is sized explicitly before each render).
//   const S = await import('/tools/snap.js'); S.install();
//   await snapUp('name')                       — the game camera through the normal render path
//   await snapCam('name', [x,y,z], [lx,ly,lz]) — any viewpoint, plain render
import * as THREE from 'three';

async function post(name) {
  const url = window.game.renderer.domElement.toDataURL('image/jpeg', 0.86);
  await fetch('/__snap?name=' + name, { method: 'POST', body: url });
  return url.length;
}
function size(w, h) {
  const G = window.game;
  G.renderer.setSize(w, h, false);
  if (G.composer) { G.composer.setSize(w, h); if (G.bloom) G.bloom.setSize(w, h); }
  if (G.retroComposer) G.retroComposer.setSize(w, h);
  if (G.retroPass) G.retroPass.uniforms.uRes.value.set(488, Math.round(488 * h / w));
}
export function install() {
  window.T3 = THREE;
  window.snapUp = async (name, fn, w = 960, h = 540) => {
    const G = window.game;
    size(w, h);
    G.camera.aspect = w / h; G.camera.updateProjectionMatrix();
    if (fn) await fn();
    G.render();
    return post(name);
  };
  window.snapCam = async (name, pos, look, fov = 60, w = 960, h = 540) => {
    const G = window.game;
    size(w, h);
    const cam = G.camera.clone();
    cam.fov = fov; cam.aspect = w / h; cam.near = 0.01;
    cam.position.set(...pos); cam.lookAt(...look); cam.updateProjectionMatrix();
    G.renderer.render(G.scene, cam);
    return post(name);
  };
  return true;
}

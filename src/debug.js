import * as THREE from 'three';
import { MapData } from './mapdata.js';
import { World } from './world.js';
import { SkySystem } from './sky.js';
import { shared } from './materials.js';

const info = document.getElementById('info');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 6000);
const params = new URLSearchParams(location.search);
const quality = { texSize: 512, aniso: 8, shadows: 1, trees: 6000 };
const raw = await (await fetch('data/map.json')).json();
const map = new MapData(raw);
const t0 = performance.now();
const world = new World(scene, map, quality);
await world.build((l, f) => { info.textContent = l + ' ' + Math.round(f * 100) + '%'; });
const sky = new SkySystem(renderer, scene, quality);
sky.hour = parseFloat(params.get('h') || '18.3');
window.dbg = { THREE, scene, camera, renderer, map, world, sky };
const cam = { x: parseFloat(params.get('x') || '-60'), y: parseFloat(params.get('y') || '12'), z: parseFloat(params.get('z') || '80'), yaw: parseFloat(params.get('yaw') || '3.4'), pitch: parseFloat(params.get('p') || '-0.25') };
window.cam = cam;
const keys = {};
addEventListener('keydown', (e) => keys[e.code] = true);
addEventListener('keyup', (e) => keys[e.code] = false);
let drag = null;
addEventListener('mousedown', (e) => drag = [e.clientX, e.clientY]);
addEventListener('mouseup', () => drag = null);
addEventListener('mousemove', (e) => { if (drag) { cam.yaw -= (e.clientX - drag[0]) * 0.004; cam.pitch -= (e.clientY - drag[1]) * 0.004; drag = [e.clientX, e.clientY]; } });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
let last = performance.now(), fps = 0, acc = 0, frames = 0;
const focus = new THREE.Vector3();
function loop() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  acc += dt; frames++; if (acc > 0.5) { fps = frames / acc; acc = 0; frames = 0; }
  const sp = keys.ShiftLeft ? 60 : 15;
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  if (keys.KeyW) { cam.x += fx * sp * dt; cam.z += fz * sp * dt; }
  if (keys.KeyS) { cam.x -= fx * sp * dt; cam.z -= fz * sp * dt; }
  if (keys.KeyA) { cam.x += fz * sp * dt; cam.z -= fx * sp * dt; }
  if (keys.KeyD) { cam.x -= fz * sp * dt; cam.z += fx * sp * dt; }
  if (keys.KeyE) cam.y += sp * dt; if (keys.KeyQ) cam.y -= sp * dt;
  camera.position.set(cam.x, cam.y, cam.z);
  camera.lookAt(cam.x + Math.sin(cam.yaw) * Math.cos(cam.pitch), cam.y + Math.sin(cam.pitch), cam.z + Math.cos(cam.yaw) * Math.cos(cam.pitch));
  shared.uTime.value += dt;
  focus.set(cam.x, 0, cam.z);
  const night = sky.update(dt, focus);
  shared.uNight.value = night;
  world.update(dt, night, camera.position);
  renderer.render(scene, camera);
  info.textContent = `fps ${fps.toFixed(0)} calls ${renderer.info.render.calls} tris ${(renderer.info.render.triangles/1e3).toFixed(0)}k\npos ${cam.x.toFixed(0)},${cam.y.toFixed(0)},${cam.z.toFixed(0)} yaw ${cam.yaw.toFixed(2)} h ${sky.timeString}\nbuild ${(t0 ? ((performance.now()-t0)/1000).toFixed(1) : '')}`;
  requestAnimationFrame(loop);
}
info.textContent = 'build ' + ((performance.now() - t0) / 1000).toFixed(1) + 's';
loop();

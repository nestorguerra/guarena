// The way into the game (the anime look): while the town is still being built, a drone's view of Guareña painted from
// exactly this camera (assets/intro.jpg, inlined in the page) drifts slowly closer; when the town is ready the live
// view takes over from the same point and flies on down to Álex, standing in a street that looks up at Santa María,
// and ends in the camera behind him: you are playing. No menus on the way.
import * as THREE from 'three';
import { polySample } from './util.js';

export const INTRO = { fov: 48, aspect: 16 / 9, zoomMax: 1.34, zoomTime: 26, flight: 7.2, hour: 10.6 };

// where Álex starts, and the drone's first camera: the same every time, from the map (tools/intro.js paints the
// picture from it)
export function introPlan(g) {
  const lm = g.world.landmarks.poi, map = g.map;
  const C = lm.churchTower || lm.plaza || { x: 0, z: 0 };
  const tmp = {};
  let best = null;
  for (const e of map.edges) {
    if (!e.walk || e.blocked || e.dirt || e.len < 20) continue;
    for (let s = 4; s < e.len - 4; s += 2.5) {
      polySample(e.pts, e.cum, s, tmp);
      const dx = C.x - tmp.x, dz = C.z - tmp.z, d = Math.hypot(dx, dz);
      if (d < 50 || d > 110) continue;
      const ux = dx / d, uz = dz / d, al = Math.abs(ux * tmp.dx + uz * tmp.dz); // (the street runs towards the church)
      if (al < 0.92) continue;
      if (map.buildingAt(tmp.x, tmp.z) || map.buildingAt(tmp.x - ux * 4, tmp.z - uz * 4)) continue;
      let clear = 0; // (nothing in the way until the church itself)
      for (let t = 0.1; t < 0.8; t += 0.05) if (!map.buildingAt(tmp.x + dx * t, tmp.z + dz * t)) clear++;
      const score = al * 2 + clear * 0.2 - Math.abs(d - 75) * 0.01;
      if (!best || score > best.score) best = { score, x: tmp.x, z: tmp.z, ux, uz };
    }
  }
  if (!best) best = { x: C.x + 30, z: C.z + 60, ux: -0.45, uz: -0.9 };
  const P = new THREE.Vector3(best.x, 0, best.z), dir = new THREE.Vector3(best.ux, 0, best.uz).normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const heading = Math.atan2(dir.x, dir.z);
  // the drone: high behind him and a little to one side, looking over his street towards the church
  const T = P.clone().addScaledVector(dir, 34);
  const D0 = P.clone().addScaledVector(dir, -165).addScaledVector(side, 55).add(new THREE.Vector3(0, 150, 0));
  return { P, dir, side, heading, T, D0, church: C };
}

// the camera that matches the picture zoomed in s times (the same view ray, s times closer to its target)
export function droneAt(plan, s, out = new THREE.Vector3()) {
  return out.copy(plan.D0).sub(plan.T).multiplyScalar(1 / s).add(plan.T);
}
// the picture's vertical field of view as the screen shows it (object-fit: cover crops one way or the other)
export function coverFov(aspect) {
  const t = Math.tan(THREE.MathUtils.degToRad(INTRO.fov / 2));
  return aspect > INTRO.aspect ? THREE.MathUtils.radToDeg(2 * Math.atan(t * INTRO.aspect / aspect)) : INTRO.fov;
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// the flight: from the drone (where the picture was when the town was ready) down to the game's own camera
export class IntroFlight {
  constructor(plan, from, fromFov, to, toLook, toFov) {
    this.plan = plan; this.t = 0;
    this.p0 = from.clone(); this.p3 = to.clone();
    this.p1 = from.clone().lerp(plan.T, 0.42);
    this.p2 = to.clone().addScaledVector(plan.dir, -14).add(new THREE.Vector3(0, 16, 0));
    this.l0 = plan.T.clone(); this.l1 = toLook.clone();
    this.f0 = fromFov; this.f1 = toFov;
    this._p = new THREE.Vector3(); this._l = new THREE.Vector3();
  }
  get done() { return this.t >= 1; }
  update(dt, cam) {
    this.t = Math.min(1, this.t + dt / INTRO.flight);
    const k = ease(this.t), u = 1 - k;
    const p = this._p.set(0, 0, 0)
      .addScaledVector(this.p0, u * u * u).addScaledVector(this.p1, 3 * u * u * k)
      .addScaledVector(this.p2, 3 * u * k * k).addScaledVector(this.p3, k * k * k);
    const lk = ease(Math.min(1, this.t * 1.15));
    const l = this._l.copy(this.l0).lerp(this.l1, lk);
    cam.position.copy(p);
    cam.lookAt(l);
    cam.fov = this.f0 + (this.f1 - this.f0) * k;
    cam.updateProjectionMatrix();
  }
}

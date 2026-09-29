// Sky, sun & moon, time of day (real solar geometry for Guareña in late September), clouds, fog, lights, IBL.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { clamp, lerp, smoothstep } from './util.js';

const LAT = 38.86 * Math.PI / 180;
const DECL = -0.8 * Math.PI / 180; // ~24 September
const SOLAR_NOON = 14.42;          // local time (CEST) of solar noon at 6.1°W

export function sunDirection(hour, out = new THREE.Vector3()) {
  const H = (hour - SOLAR_NOON) * 15 * Math.PI / 180;
  const sinAlt = Math.sin(LAT) * Math.sin(DECL) + Math.cos(LAT) * Math.cos(DECL) * Math.cos(H);
  const alt = Math.asin(sinAlt);
  const cosAz = (Math.sin(DECL) - Math.sin(alt) * Math.sin(LAT)) / (Math.cos(alt) * Math.cos(LAT));
  let az = Math.acos(clamp(cosAz, -1, 1));
  if (H > 0) az = Math.PI * 2 - az;
  // world: x east, z south (north = -z)
  out.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
  return out;
}

// palette keyed by sun altitude (sin): night, twilight, golden, day
const KEYS = [
  { a: -0.3, zen: 0x05081a, hor: 0x0d1428, warm: 0x121a30, gnd: 0x07090e, sun: 0x000000 },
  { a: -0.08, zen: 0x121c44, hor: 0x3a3456, warm: 0x7a4a52, gnd: 0x151419, sun: 0x552a18 },
  { a: 0.0, zen: 0x27438a, hor: 0xd7865a, warm: 0xff8a3c, gnd: 0x4a3e38, sun: 0xff7a2a },
  { a: 0.12, zen: 0x2d5cb8, hor: 0xe8b98c, warm: 0xffb060, gnd: 0x8a7c68, sun: 0xffc27a },
  { a: 0.35, zen: 0x2f6bd0, hor: 0xa9cbee, warm: 0xd4e2f2, gnd: 0xb3ab98, sun: 0xfff2d8 },
  { a: 1.0, zen: 0x2a62cc, hor: 0x9cc4ec, warm: 0xc9dcf2, gnd: 0xb8b0a0, sun: 0xffffff },
];
const _ca = new THREE.Color(), _cb = new THREE.Color();
const NIGHT_FILL = new THREE.Color(0.27, 0.33, 0.47), NIGHT_GND = new THREE.Color(0.11, 0.1, 0.09);
function paletteAt(alt, key, out) {
  let i = 0;
  while (i < KEYS.length - 2 && alt > KEYS[i + 1].a) i++;
  const A = KEYS[i], B = KEYS[i + 1];
  const t = clamp((alt - A.a) / (B.a - A.a), 0, 1);
  _ca.setHex(A[key]); _cb.setHex(B[key]);
  return out.copy(_ca).lerp(_cb, t);
}

// The daytime sky is the physical one (Preetham scattering, behind); this dome draws on top of it the clouds, and from
// dusk on the whole night sky (palette, Milky Way, the glow of the town) — so it is transparent by day.
function makeSkyMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, transparent: true,
    uniforms,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      uniform vec3 uSun, uZen, uHor, uWarm, uGnd, uSunCol; uniform float uTime, uNight, uCloud;
      varying vec3 vDir;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*n2(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        // horizon colour warms towards the sun azimuth at dawn/dusk
        vec2 hs = normalize(uSun.xz + 1e-5), hd = normalize(d.xz + 1e-5);
        float toward = pow(max(dot(hs, hd), 0.0), 3.0);
        vec3 hor = mix(uHor, uWarm, toward);
        vec3 col = mix(hor, uZen, pow(clamp(h, 0.0, 1.0), 0.42));
        col = mix(col, uGnd, smoothstep(0.0, -0.12, h));
        // sun glow + disc
        float sd = max(dot(d, uSun), 0.0);
        col += uSunCol * (pow(sd, 6.0) * 0.22 + pow(sd, 48.0) * 0.5);
        col += uSunCol * smoothstep(0.99955, 0.99985, sd) * 12.0 * step(-0.02, uSun.y);
        // at night: the Milky Way across the sky and the glow of the town low on the horizon
        if (uNight > 0.01) {
          vec3 bandN = normalize(vec3(0.42, 0.28, 0.86));
          float band = exp(-pow(dot(d, bandN) / 0.2, 2.0)) * smoothstep(0.0, 0.25, h);
          float mw = band * (0.55 + 0.9 * fbm(d.xz / (h + 0.3) * 3.0 + d.y * 4.0)) * (0.6 + 0.4 * fbm(d.xy * 9.0));
          col += vec3(0.16, 0.17, 0.22) * mw * uNight * 0.55;
          col += vec3(0.2, 0.13, 0.08) * exp(-max(h, 0.0) * 14.0) * uNight * 0.22;
        }
        // clouds on a flat layer (a second, finer octave gives them some body and a darker belly)
        float cov = 0.0; vec3 cc = col;
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.12) * 1.6 + vec2(uTime * 0.004, uTime * 0.0016);
          float c = fbm(uv), c2 = fbm(uv * 3.1 + 5.3);
          cov = smoothstep(1.0 - uCloud * 0.62, 1.05 - uCloud * 0.35, c * 0.85 + c2 * 0.15) * smoothstep(0.0, 0.12, h);
          vec3 lit = mix(vec3(1.0, 0.98, 0.95), uSunCol * 1.2 + vec3(0.2), 0.35 * (1.0 - smoothstep(0.0, 0.4, uSun.y)));
          cc = mix(hor * 0.9, lit, 0.45 + 0.55 * pow(sd, 3.0));
          cc *= 0.78 + 0.22 * smoothstep(0.35, 0.8, c2); // thicker parts in shade
          cc = mix(cc, uZen * 0.35, uNight * 0.85);
        }
        float nightK = smoothstep(-0.03, -0.15, uSun.y); // 0: the physical sky shows, 1: our night sky
        vec3 full = mix(col, cc, cov * 0.85);
        gl_FragColor = vec4(mix(cc, full, nightK), mix(cov * 0.85, 1.0, nightK));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export class SkySystem {
  constructor(renderer, scene, quality) {
    this.renderer = renderer;
    this.scene = scene;
    this.hour = 18.6;
    this.q = quality;
    this.uniforms = {
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
      uWarm: { value: new THREE.Color() }, uGnd: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
      uTime: { value: 0 }, uNight: { value: 0 }, uCloud: { value: 0.42 },
    };
    this.mat = makeSkyMaterial(this.uniforms);
    // physical daytime sky (Rayleigh + Mie scattering): real blues, a white haze at the horizon, orange sunsets
    this.phys = new Sky();
    this.phys.scale.setScalar(3800);
    this.phys.frustumCulled = false;
    this.phys.renderOrder = -101;
    const pu = this.phys.material.uniforms;
    pu.turbidity.value = 3.2; pu.rayleigh.value = 1.35; pu.mieCoefficient.value = 0.0038; pu.mieDirectionalG.value = 0.82;
    scene.add(this.phys);
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), this.mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -100;
    scene.add(this.dome);
    // stars
    const n = 5200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), siz = new Float32Array(n);
    const bandN = new THREE.Vector3(0.42, 0.28, 0.86).normalize();
    for (let i = 0; i < n; i++) {
      let th, ph, v = new THREE.Vector3();
      // a third of them crowd along the Milky Way
      for (let k = 0; k < 6; k++) { th = Math.random() * Math.PI * 2; ph = Math.acos(Math.random() * 0.97); v.set(Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph)); if (i % 3 || Math.abs(v.dot(bandN)) < 0.22) break; }
      const r = 3800;
      pos[i * 3] = v.x * r; pos[i * 3 + 1] = v.y * r; pos[i * 3 + 2] = v.z * r;
      const m = Math.pow(Math.random(), 3.2); // magnitude: most are faint
      const b = 0.14 + m * 0.8; // the town's lights wash out the faintest
      const tint = Math.random();
      col[i * 3] = b * (tint < 0.15 ? 1.0 : tint > 0.85 ? 0.82 : 0.95); col[i * 3 + 1] = b * 0.95; col[i * 3 + 2] = b * (tint < 0.15 ? 0.8 : tint > 0.85 ? 1.05 : 1.0);
      siz[i] = 0.9 + m * 2.4;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sg.setAttribute('size', new THREE.BufferAttribute(siz, 1));
    const starMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 }, uTime: this.uniforms.uTime, uPR: { value: Math.min(devicePixelRatio || 1, 2) } },
      vertexShader: `attribute float size; varying vec3 vCol; varying float vTw; uniform float uTime, uPR;
        void main(){ vCol = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_Position.z = gl_Position.w * 0.99999;
          float ph = dot(position, vec3(0.013, 0.017, 0.011)); vTw = 0.78 + 0.22 * sin(uTime * (1.3 + fract(ph) * 2.0) + ph * 50.0);
          gl_PointSize = size * uPR; }`,
      fragmentShader: `uniform float uOpacity; varying vec3 vCol; varying float vTw;
        void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard;
          float a = exp(-r2 * 3.2); gl_FragColor = vec4(vCol * a * vTw * uOpacity, 1.0); }`,
      vertexColors: true,
    });
    this.stars = new THREE.Points(sg, starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -99;
    scene.add(this.stars);
    // moon
    const mc = document.createElement('canvas'); mc.width = mc.height = 128;
    const x = mc.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.35, 'rgba(250,245,225,1)'); g.addColorStop(0.42, 'rgba(200,210,255,0.25)'); g.addColorStop(1, 'rgba(160,180,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(mc), fog: false, depthWrite: false, transparent: true }));
    this.moon.scale.setScalar(260);
    this.moon.renderOrder = -98;
    scene.add(this.moon);
    // lights
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = quality.shadows > 0;
    const sm = quality.shadows >= 2 ? 4096 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    this.shadowSize = quality.shadows >= 2 ? 70 : 55;
    const sc = this.sun.shadow.camera;
    sc.left = -this.shadowSize; sc.right = this.shadowSize; sc.top = this.shadowSize; sc.bottom = -this.shadowSize;
    sc.near = 1; sc.far = 600;
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2.5;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a60, 0.6);
    scene.add(this.hemi);
    this.fog = new THREE.Fog(0xcad6e0, 150, 1600);
    scene.fog = this.fog;
    this.sunDir = new THREE.Vector3();
    // IBL: the same sky rendered into a PMREM environment map
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), makeSkyMaterial(this.uniforms)));
    this.envGround = new THREE.Mesh(new THREE.CircleGeometry(90, 24), new THREE.MeshBasicMaterial({ color: 0x8a7e6c }));
    this.envGround.rotation.x = -Math.PI / 2; this.envGround.position.y = -2;
    this.envScene.add(this.envGround);
    // sunlit whitewashed facades all around: the warm bounce that fills the shade of a village street
    this.envBand = new THREE.Mesh(new THREE.CylinderGeometry(95, 95, 40, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xd8cdb8, side: THREE.BackSide }));
    this.envBand.position.y = 17;
    this.envScene.add(this.envBand);
    // dust & haze of the Vegas: the ambient light is less saturated than the deep blue we see overhead
    this.envHaze = new THREE.Mesh(new THREE.SphereGeometry(98, 16, 8), new THREE.MeshBasicMaterial({ color: 0xc9c4ba, transparent: true, opacity: 0.38, side: THREE.BackSide, depthWrite: false }));
    this.envHaze.renderOrder = 1;
    this.envScene.add(this.envHaze);
    this.envTimer = 0;
    this.envRT = null;
    this.night = 0;
    this.cloud = 0.42;
    this.update(0, new THREE.Vector3(), true);
  }

  get timeString() {
    const h = Math.floor(this.hour) % 24, m = Math.floor((this.hour % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // the dome, the stars, the moon and the sun's shadow box around another point (the street seen from a window)
  placeAt(focus) {
    if (!this.lightDir) return;
    this.dome.position.copy(focus); this.phys.position.copy(focus); this.stars.position.copy(focus);
    this.moon.position.copy(focus).addScaledVector(this.moonDir, 3500);
    const texel = (this.shadowSize * 2) / this.sun.shadow.mapSize.x;
    this.sun.target.position.set(Math.round(focus.x / texel) * texel, 0, Math.round(focus.z / texel) * texel);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.lightDir, 250);
    this.sun.target.updateMatrixWorld();
  }

  update(dt, focus, forceEnv = false) {
    const d = sunDirection(this.hour, this.sunDir);
    const alt = d.y;
    const U = this.uniforms;
    U.uSun.value.copy(d);
    paletteAt(alt, 'zen', U.uZen.value);
    paletteAt(alt, 'hor', U.uHor.value);
    paletteAt(alt, 'warm', U.uWarm.value);
    paletteAt(alt, 'gnd', U.uGnd.value);
    paletteAt(alt, 'sun', U.uSunCol.value);
    U.uTime.value += dt;
    U.uCloud.value = this.cloud;
    const day = smoothstep(-0.08, 0.12, alt);
    const golden = 1 - smoothstep(0.05, 0.35, alt);
    this.night = 1 - smoothstep(-0.12, 0.03, alt);
    U.uNight.value = this.night;
    this.dome.position.copy(focus);
    this.phys.position.copy(focus);
    this.phys.material.uniforms.sunPosition.value.copy(d);
    this.phys.material.uniforms.turbidity.value = 2.8 + this.cloud * 2.4; // hazier with more cloud
    this.phys.visible = alt > -0.2;
    this.stars.position.copy(focus);
    this.stars.material.uniforms.uOpacity.value = this.night * (1 - (this.cloud || 0) * 0.5);
    // moon opposite-ish to the sun, high at night
    const md = new THREE.Vector3(-d.x * 0.6 + 0.2, Math.max(0.15, -d.y * 0.9 + 0.25), -d.z * 0.6 - 0.3).normalize();
    this.moonDir = md;
    this.moon.position.copy(focus).addScaledVector(md, 3500);
    this.moon.material.opacity = this.night;
    // sun light
    const sunCol = paletteAt(Math.max(alt, 0.0), 'sun', new THREE.Color());
    if (alt > -0.02) {
      this.sun.color.copy(sunCol).lerp(new THREE.Color(1, 1, 1), 0.25);
      this.sun.intensity = 4.4 * smoothstep(-0.02, 0.16, alt);
      this.sun.position.copy(focus).addScaledVector(d, 250);
      this.lightDir = (this.lightDir || new THREE.Vector3()).copy(d);
    } else {
      this.sun.color.setRGB(0.6, 0.7, 0.95);
      this.sun.intensity = 0.9 * this.night; // moonlight: soft blue light and long shadows
      this.sun.position.copy(focus).addScaledVector(md, 250);
      this.lightDir = (this.lightDir || new THREE.Vector3()).copy(md);
    }
    const texel = (this.shadowSize * 2) / this.sun.shadow.mapSize.x;
    this.sun.target.position.set(Math.round(focus.x / texel) * texel, 0, Math.round(focus.z / texel) * texel);
    this.sun.position.sub(focus).add(this.sun.target.position);
    this.sun.target.updateMatrixWorld();
    // hemisphere: sky & ground bounce
    // at night the moon and the glow of the town on the haze keep every street readable (never pitch black)
    this.hemi.color.copy(U.uZen.value).lerp(U.uHor.value, 0.55).lerp(new THREE.Color(0.86, 0.84, 0.8), 0.62 * day).lerp(NIGHT_FILL, this.night * 0.85);
    this.hemi.groundColor.copy(U.uGnd.value).multiplyScalar(0.85).lerp(NIGHT_GND, this.night * 0.8);
    this.hemi.intensity = lerp(0.45, 0.5, day) + this.night * 0.8;
    // fog matches the horizon
    this.fog.color.copy(U.uHor.value).lerp(U.uZen.value, 0.15);
    this.fog.near = lerp(60, 280, day);
    this.fog.far = lerp(800, 2600, day);
    this.renderer.toneMappingExposure = lerp(1.08, 0.68, day) + golden * day * 0.06;
    // environment map (IBL), refreshed occasionally
    this.envTimer -= dt;
    if (forceEnv || this.envTimer <= 0) {
      this.envTimer = 3;
      this.envGround.material.color.copy(U.uGnd.value);
      const sunK = smoothstep(-0.02, 0.2, alt);
      this.envBand.material.color.copy(U.uHor.value).multiplyScalar(0.35).lerp(new THREE.Color(0.9, 0.84, 0.72).multiply(U.uSunCol.value), sunK * 0.85);
      this.envHaze.material.color.copy(U.uHor.value).lerp(new THREE.Color(0.8, 0.77, 0.72), 0.6).multiplyScalar(0.25 + 0.75 * day);
      this.envHaze.material.opacity = 0.38 * day;
      const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 400);
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt;
      this.scene.environment = rt.texture;
    }
    this.scene.environmentIntensity = lerp(0.4, 0.55, day);
    return this.night;
  }
}

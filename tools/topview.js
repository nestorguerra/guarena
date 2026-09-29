// Dev-only: top-down and street-level snapshots with a debug overlay (street centrelines and widths, collider
// circles by kind), saved to .snaps/<name>.jpg through the dev server.
//   const V = await import('/tools/topview.js'); await V.top('name', [{ p: [x, z], s: 60 }]);
const KIND = { '-7': '#f0f', '-6': '#f80', '-5': '#ff0', '-4': '#0f0', '-2': '#080', '-11': '#f00', '-10': '#f00' };

function grab(G, cam, W, H) {
  const r = G.renderer;
  G.sky.update(0, cam.position); G.world.update(0, G.sky.night, cam.position); G.chars.updateLods(cam.position, true);
  r.setSize(W, H, false); r.render(G.scene, cam);
  return r.domElement;
}
function settle(G, x, z, n = 30) { G.player.pos.set(x, 0, z); for (let k = 0; k < n; k++) G.frame(1 / 60); }

export async function top(name, list, S = 60, PX = 400) {
  const G = window.game, r = G.renderer, dpr = r.getPixelRatio();
  const size = { x: r.domElement.width / dpr, y: r.domElement.height / dpr };
  const cols = Math.min(3, list.length), cv = document.createElement('canvas');
  cv.width = PX * cols; cv.height = PX * Math.ceil(list.length / cols);
  const x2 = cv.getContext('2d'), M = G.map, col = M.collider;
  for (let i = 0; i < list.length; i++) {
    const it = list[i], [x, z] = it.p, s = it.s || S;
    settle(G, x, z);
    const cam = G.camera.clone(); cam.fov = 2 * Math.atan(s / 2 / 400) * 180 / Math.PI; cam.aspect = 1; cam.near = 300; cam.far = 500;
    cam.position.set(x, 400, z); cam.up.set(0, 0, -1); cam.lookAt(x, 0, z); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const src = grab(G, cam, PX, PX);
    const ox = (i % cols) * PX, oy = Math.floor(i / cols) * PX;
    x2.drawImage(src, 0, 0, src.width, src.height, ox, oy, PX, PX);
    const k = PX / s, P = (wx, wz) => [ox + PX / 2 + (wx - x) * k, oy + PX / 2 + (wz - z) * k];
    x2.save(); x2.beginPath(); x2.rect(ox, oy, PX, PX); x2.clip();
    if (it.overlay !== false) {
      for (const id of M.edgesNear(x, z, s)) {
        const e = M.edges[id], p = e.pts;
        x2.strokeStyle = e.blocked ? 'rgba(255,0,0,.9)' : e.drive ? 'rgba(0,255,255,.9)' : 'rgba(255,255,0,.8)'; x2.lineWidth = 1.5;
        x2.beginPath(); for (let j = 0; j < p.length; j += 2) { const [a, b] = P(p[j], p[j + 1]); j ? x2.lineTo(a, b) : x2.moveTo(a, b); } x2.stroke();
        if (e.drive) { x2.strokeStyle = 'rgba(0,255,255,.16)'; x2.lineWidth = e.w * k; x2.stroke(); }
        const [la, lb] = P(p[0] * 0.5 + p[2] * 0.5, p[1] * 0.5 + p[3] * 0.5);
        x2.fillStyle = '#0ff'; x2.font = '11px monospace'; x2.fillText(id + (e.name ? ' ' + e.name.slice(0, 18) : '') + ' w' + e.w + (e.oneway ? ' ow' + e.oneway : ''), la, lb);
      }
      col.forCircles(x - s / 2, z - s / 2, x + s / 2, z + s / 2, (ci, o) => {
        const c = col.circles, [a, b] = P(c[o], c[o + 1]);
        x2.strokeStyle = KIND[c[o + 4]] || '#fff'; x2.lineWidth = 2; x2.beginPath(); x2.arc(a, b, Math.max(2, c[o + 2] * k), 0, 7); x2.stroke();
      });
      for (const v of G.fleet.vehicles) { if (Math.abs(v.x - x) > s || Math.abs(v.z - z) > s) continue; const [a, b] = P(v.x, v.z); x2.fillStyle = v.ai ? '#f44' : v.parked ? '#48f' : '#fff'; x2.fillRect(a - 3, b - 3, 6, 6); }
    }
    x2.restore();
    x2.fillStyle = 'rgba(0,0,0,.6)'; x2.fillRect(ox, oy, PX, 16); x2.fillStyle = '#fff'; x2.font = '12px monospace';
    x2.fillText(`${i + 1}. ${x},${z} (${s} m) ${it.t || ''}`, ox + 4, oy + 12);
  }
  r.setSize(size.x, size.y, false);
  await fetch('/__snap?name=' + name, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.88) });
  return name;
}

// street-level views: {p:[x,z], a: yaw offset from the street, back, h (camera height), lh (look-at height)}
export async function street(name, list, W = 400, H = 280, cols = 3) {
  const G = window.game, r = G.renderer, dpr = r.getPixelRatio();
  const size = { x: r.domElement.width / dpr, y: r.domElement.height / dpr };
  const cam = G.camera.clone(); cam.fov = 60; cam.aspect = W / H; cam.updateProjectionMatrix();
  const cv = document.createElement('canvas'); cv.width = W * cols; cv.height = H * Math.ceil(list.length / cols);
  const x2 = cv.getContext('2d');
  for (let i = 0; i < list.length; i++) {
    const it = list[i], [x, z] = it.p;
    const q = G.map.nearestEdge(x, z, 30);
    const dx = q ? q.edge.pts[2] - q.edge.pts[0] : 1, dz = q ? q.edge.pts[3] - q.edge.pts[1] : 0, l = Math.hypot(dx, dz) || 1;
    settle(G, x + (it.px || 0), z + (it.pz || 0), 40);
    const back = it.back || 7, a = it.a ?? 0.6, ux = dx / l, uz = dz / l, ca = Math.cos(a), sa = Math.sin(a);
    const vx = ux * ca - uz * sa, vz = ux * sa + uz * ca;
    if (it.cam) cam.position.set(...it.cam); else cam.position.set(x - vx * back, it.h || 2.2, z - vz * back);
    if (it.look) cam.lookAt(...it.look); else cam.lookAt(x, it.lh || 0.8, z);
    cam.updateMatrixWorld();
    const src = grab(G, cam, W, H);
    x2.drawImage(src, 0, 0, src.width, src.height, (i % cols) * W, Math.floor(i / cols) * H, W, H);
    x2.fillStyle = 'rgba(0,0,0,.6)'; x2.fillRect((i % cols) * W, Math.floor(i / cols) * H, W, 18);
    x2.fillStyle = '#fff'; x2.font = '13px monospace'; x2.fillText(`${i + 1}. ${it.t || x + ',' + z}`, (i % cols) * W + 5, Math.floor(i / cols) * H + 13);
  }
  r.setSize(size.x, size.y, false);
  await fetch('/__snap?name=' + name, { method: 'POST', body: cv.toDataURL('image/jpeg', 0.85) });
  return name;
}

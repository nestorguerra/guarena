// Dev-only: the anime look's repainted textures, as images (facade and ground layers of the texture arrays), and the
// time it takes to repaint them.
//   const T = await import('/tools/toonlab.js?' + Date.now()); await T.layers('a', 'facade', [0, 1, 2, 8, 9, 32, 64, 65])
//   → .snaps/toon_facade_a.jpg
const G = () => window.game;
export async function layers(tag = '', which = 'facade', list = null, cell = 256, { alpha = false } = {}) {
  const g = G(), t = which === 'facade' ? g.world.facadeTex : g.world.groundTex;
  const { data, width: S, depth: L } = t.image;
  const ids = list || Array.from({ length: Math.min(L, 16) }, (_, i) => i);
  const cols = Math.min(4, ids.length), rows = Math.ceil(ids.length / cols);
  const c = document.createElement('canvas'); c.width = cols * cell; c.height = rows * cell;
  const x = c.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = S;
  const tx = tmp.getContext('2d'), id = tx.createImageData(S, S);
  ids.forEach((l, k) => {
    const off = l * S * S * 4;
    for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) {
      const s = off + ((S - 1 - yy) * S + xx) * 4, d = (yy * S + xx) * 4, a = alpha ? data[s + 3] / 255 : 1;
      const bg = ((xx >> 4) + (yy >> 4)) % 2 ? 90 : 60; // (panes show on a dark checker)
      id.data[d] = data[s] * a + bg * (1 - a); id.data[d + 1] = data[s + 1] * a + bg * (1 - a); id.data[d + 2] = data[s + 2] * a + bg * (1 - a); id.data[d + 3] = 255;
    }
    tx.putImageData(id, 0, 0);
    x.drawImage(tmp, (k % cols) * cell, Math.floor(k / cols) * cell, cell, cell);
  });
  await fetch('/__snap?name=toon_' + which + '_' + tag, { method: 'POST', body: c.toDataURL('image/jpeg', 0.9) });
  return { S, L, ids };
}

// Looks: the colour palettes and a random-but-believable descriptor (hair, face, body, clothes, accessories), shared
// by the character editor and by the pedestrians of the town.
export const SKIN = ['#f2d0b5', '#e3b48f', '#c98f65', '#a86f48', '#7a4f33'];
export const HAIR = ['#1e1612', '#3b2618', '#6a4428', '#a8733d', '#d6b173', '#8a8580', '#d9d6d0', '#7a2e1c'];
export const CLOTH = ['#f4f4f0', '#1d1f24', '#b8302a', '#2f5fa8', '#e6b422', '#3c7a3f', '#7d4fa0', '#e87aa4', '#f08a24', '#6d7a86', '#5b3a26', '#1f4a3a', '#c9b89a', '#88a9c9'];
export const SKINS = ['#f6dcc6', '#f2d0b5', '#e8bf9c', '#e3b48f', '#d5a07a', '#c98f65', '#b87c55', '#a86f48', '#8d5a3a', '#7a4f33', '#5e3b26', '#48301f'];
export const HAIRS = [...HAIR, '#b04a2a', '#c9a24a', '#2f3a8a', '#a0305a', '#6c3fa0', '#f2f2ee'];
export const EYES = ['#4a2e1c', '#3a2416', '#5b3d22', '#6a5a30', '#4d6b3a', '#4a6a8a', '#6e8fb0', '#7a8590', '#2b1d14'];
export const COLORS = [...CLOTH, '#e0dccf', '#2a2a2e', '#8a1f2a', '#1c3f6e', '#c05a2a', '#d9c65a', '#6b8f3a', '#4f2f4a'];
export const LIPS = ['#b65a5e', '#c2464e', '#a0404a', '#d17a7e', '#9a5a55', '#8a3a4a', '#c86a50'];

const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];

// a random but believable look: first the shape (body, face, hair, clothes, accessories), then its colours
export function randomLook(rnd = Math.random, g = null) { return normalize(colorize(randomShape(rnd, g), rnd)); }
export function randomShape(rnd = Math.random, g = null) {
  const f = g ? g === 'f' : rnd() < 0.5;
  const age = rnd() < 0.2 ? 'mayor' : rnd() < 0.5 ? 'joven' : 'adulto';
  const d = { gender: f ? 'f' : 'm', ageGroup: age, elderly: age === 'mayor' };
  d.height = +(f ? 0.93 + rnd() * 0.1 : 0.95 + rnd() * 0.1).toFixed(2);
  d.build = +(0.9 + rnd() * rnd() * 0.4 + (age === 'mayor' ? 0.05 : 0)).toFixed(2);
  d.muscle = f ? 0 : +(rnd() * rnd()).toFixed(2);
  if (f) { d.slim = d.build < 0.96 ? 1 : 0; d.bust = +(0.9 + rnd() * 0.3).toFixed(1); }
  d.face = [0, 0, 0, 0, 0].map(() => Math.round((rnd() * 2 - 1) * 2) / 2);
  const styles = f ? ['melena', 'media', 'largo', 'coleta', 'trenza', 'mono', 'rizos', 'corto', 'afro', 'largo', 'coleta'] : ['corto', 'tupe', 'peinado', 'rizos', 'rapado', 'calvo', 'cresta', 'afro', 'corto', 'peinado'];
  d.hairStyle = age === 'mayor' ? pick(f ? ['mono', 'media', 'corto', 'melena'] : ['calvo', 'corto', 'peinado', 'rapado'], rnd) : pick(styles, rnd);
  if (!f && rnd() < 0.38) d.beardStyle = pick(['barba3', 'barba3', 'bigote', 'perilla', 'short', 'full'], rnd);
  const tops = f ? ['tshirt', 'blouse', 'tank', 'shirt', 'sweater', 'dress', 'cardigan', 'jacket', 'hoodie', 'tshirt'] : ['tshirt', 'polo', 'shirt', 'hoodie', 'sweater', 'jacket', 'vest', 'tracktop', 'tshirt', 'polo'];
  d.topStyle = age === 'mayor' ? pick(f ? ['blouse', 'cardigan', 'dress', 'sweater'] : ['shirt', 'polo', 'cardigan', 'vest', 'sweater'], rnd) : pick(tops, rnd);
  if (d.topStyle === 'jacket') d.topMat = rnd() < 0.5 ? 'cuero' : 'vaquera';
  const bots = f ? ['jeans', 'skirt', 'pants', 'shorts', 'jeans', 'skirtS'] : ['jeans', 'pants', 'cargo', 'shorts', 'chandal', 'jeans'];
  d.bottomStyle = age === 'mayor' ? (f ? pick(['skirt', 'pants'], rnd) : 'pants') : pick(bots, rnd);
  if (d.topStyle === 'tracktop' && rnd() < 0.7) d.bottomStyle = 'chandal';
  d.shoeStyle = age === 'mayor' ? 'shoe' : d.bottomStyle === 'chandal' ? 'sneaker' : pick(['sneaker', 'sneaker', 'shoe', 'boot'], rnd);
  if (rnd() < 0.2) d.hat = age === 'mayor' ? pick(f ? ['sombrero'] : ['boina', 'sombrero', 'boina'], rnd) : pick(['gorra', 'gorra', 'gorro', 'sombrero'], rnd);
  if (rnd() < 0.15) d.glasses = rnd() < 0.5 ? 'gafas' : 'sol';
  if (rnd() < 0.1 && age !== 'mayor') d.bag = true;
  if (f && rnd() < 0.35) d.earrings = true;
  if (rnd() < 0.3) d.watch = true;
  if (d.bottomStyle === 'skirtS') { d.bottomStyle = 'skirt'; d.skirtLen = 'short'; }
  return d;
}
// colours that suit the person and what they wear
export function colorize(d, rnd = Math.random) {
  const f = d.gender === 'f', old = d.ageGroup === 'mayor' || d.elderly;
  d.skinColor = SKINS[Math.min(SKINS.length - 1, Math.floor(Math.pow(rnd(), 1.4) * SKINS.length))];
  d.eyes = pick(EYES, rnd);
  d.hairColor = old ? pick(['#8a8580', '#d9d6d0', '#b8b4ae', '#6e6a66'], rnd) : rnd() < 0.08 ? pick(HAIRS.slice(8), rnd) : pick(HAIR.slice(0, 5), rnd);
  if (f) d.lips = pick(LIPS, rnd);
  const sober = ['#1d1f24', '#3a3440', '#5b3a26', '#6d7a86', '#88a9c9', '#c9b89a', '#f4f4f0', '#3b3228', '#1f4a3a'];
  d.top = pick(old ? sober : COLORS, rnd);
  d.topPattern = rnd() < 0.72 ? 'lisa' : pick(['rayas', 'cuadros', 'lunares'], rnd);
  if (d.topStyle === 'shirt' && rnd() < 0.4) d.topPattern = 'cuadros';
  if (d.topStyle === 'jacket' || d.topStyle === 'tracktop' || d.topStyle === 'vest') d.topPattern = 'lisa';
  d.top2 = pick(COLORS, rnd);
  if (d.topStyle === 'tracktop') d.top2 = rnd() < 0.7 ? '#f4f4f0' : pick(COLORS, rnd);
  if (d.topStyle === 'jacket') d.top = d.topMat === 'cuero' ? pick(['#1d1f24', '#3a2a20', '#5b3a26', '#1d1f24'], rnd) : pick(['#3d5f8f', '#2f4f7a', '#6d8fb4'], rnd);
  d.under = pick(['#f4f4f0', '#1d1f24', '#88a9c9', '#b8302a', '#e6b422', '#6d7a86'], rnd);
  d.bottom = d.bottomStyle === 'jeans' ? pick(['#2f4f7a', '#3d5f8f', '#1f2d44', '#4a6284', '#6d8fb4'], rnd) : pick(old ? ['#1d1f24', '#3b3228', '#5b3a26', '#4a4a3a', '#6d7a86'] : ['#1d1f24', '#5b3a26', '#c9b89a', '#4a4a3a', '#2f5fa8', '#6d7a86', '#3b3228', '#4a6a3a'], rnd);
  if (d.bottomStyle === 'chandal') { d.bottom = pick(['#1d1f24', '#1f2d44', '#b8302a', '#3a3440'], rnd); d.bottom2 = '#f4f4f0'; }
  d.shoes = d.shoeStyle === 'sneaker' ? pick(['#f2f2f2', '#f2f2f2', '#1d1f24', '#b8302a'], rnd) : pick(['#1d1f24', '#3a2a1c', '#5b3a26'], rnd);
  if (d.hat) d.hatColor = d.hat === 'sombrero' ? '#d8c28a' : pick(old ? ['#2a2a2a', '#3b3228', '#1e2430'] : COLORS, rnd);
  if (d.bag) d.bagColor = pick(COLORS, rnd);
  return d;
}
// derived fields the rest of the game reads (legacy names: elderly, skirtLen, accessory)
export function normalize(d) {
  d.elderly = d.ageGroup === 'mayor';
  if (d.bottomStyle === 'skirtS') { d.bottomStyle = 'skirt'; d.skirtLen = 'short'; }
  else if (d.bottomStyle === 'skirt' && d.skirtLen === 'short') { /* keep */ }
  if (d.gender !== 'f') { delete d.slim; delete d.bust; delete d.lips; delete d.earrings; }
  if (d.gender === 'f') delete d.beardStyle;
  if (!d.hat) delete d.hat;
  if (!d.beardStyle) delete d.beardStyle;
  if (!d.glasses) delete d.glasses;
  delete d.accessory; delete d.accessoryColor; delete d.beard;
  if (d.topStyle !== 'jacket') delete d.topMat;
  return d;
}

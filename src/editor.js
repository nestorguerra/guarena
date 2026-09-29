// Character editor: body (sex, age, height, weight, muscle, bust, skin), face (jaw, chin, cheekbones, nose, brow,
// eyes, beard, lips), hair (fourteen cuts, natural and dyed colours), clothes (tops with patterns and a second colour,
// what is worn underneath, trousers and skirts, shoes) and accessories (hats, glasses, backpack, earrings, a watch).
// A live 3D preview you turn with the mouse, a finger or the pad and zoom from the face to the whole body; random looks;
// up to eight saved characters. The look is a plain descriptor, the same the game, the pedestrians and multiplayer use.
import { SKIN, HAIR, SKINS, HAIRS, EYES, COLORS, LIPS, randomLook, normalize } from './looks.js';
import { PERKS } from './perks.js';
const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const O = {
  hairStyle: [['corto', 'Corto'], ['tupe', 'Tupé'], ['peinado', 'Raya al lado'], ['rizos', 'Rizos'], ['afro', 'Afro'], ['cresta', 'Cresta'], ['calvo', 'Calvo'], ['rapado', 'Rapado'],
    ['melena', 'Melena'], ['media', 'Media melena'], ['largo', 'Largo'], ['coleta', 'Coleta'], ['trenza', 'Trenza'], ['mono', 'Moño']],
  beardStyle: [['', 'Sin barba'], ['barba3', 'Sombra'], ['bigote', 'Bigote'], ['perilla', 'Perilla'], ['short', 'Barba corta'], ['full', 'Barba larga']],
  topStyle: [['tshirt', 'Camiseta'], ['polo', 'Polo'], ['shirt', 'Camisa'], ['hoodie', 'Sudadera'], ['sweater', 'Jersey'], ['tank', 'Tirantes'], ['blouse', 'Blusa'],
    ['cardigan', 'Rebeca'], ['jacket', 'Chaqueta'], ['vest', 'Chaleco'], ['tracktop', 'Chándal'], ['dress', 'Vestido']],
  topPattern: [['lisa', 'Lisa'], ['rayas', 'Rayas'], ['cuadros', 'Cuadros'], ['lunares', 'Lunares']],
  topMat: [['cuero', 'Cuero'], ['vaquera', 'Vaquera']],
  bottomStyle: [['jeans', 'Vaqueros'], ['pants', 'Pantalón'], ['cargo', 'Cargo'], ['chandal', 'Chándal'], ['shorts', 'Corto'], ['skirt', 'Falda'], ['skirtS', 'Falda corta']],
  shoeStyle: [['sneaker', 'Zapatillas'], ['shoe', 'Zapatos'], ['boot', 'Botas']],
  hat: [['', 'Nada'], ['gorra', 'Gorra'], ['boina', 'Boina'], ['gorro', 'Gorro de lana'], ['sombrero', 'Sombrero de paja']],
  glasses: [['', 'Nada'], ['gafas', 'Gafas'], ['sol', 'Gafas de sol']],
  ageGroup: [['joven', 'Joven'], ['adulto', 'Adulto'], ['mayor', 'Mayor']],
  gender: [['m', 'Chico'], ['f', 'Chica']],
};
const TABS = [['cuerpo', 'Cuerpo'], ['cara', 'Cara'], ['pelo', 'Pelo'], ['ropa', 'Ropa'], ['extras', 'Complementos'], ['ficha', 'Personaje']];
const FACE = [['Mandíbula', 'Estrecha', 'Ancha'], ['Barbilla', 'Pequeña', 'Marcada'], ['Pómulos', 'Finos', 'Llenos'], ['Nariz', 'Pequeña', 'Grande'], ['Cejas', 'Suaves', 'Marcadas']];
const NAMES = { m: ['Javi', 'Toni', 'Rafa', 'Pedro', 'Jesús', 'Pablo', 'Sergio', 'Luis', 'Nacho', 'Kike'], f: ['Marta', 'Sara', 'Elena', 'Paula', 'Nuria', 'Irene', 'Rocío', 'Bea', 'Alba', 'Lorena'] };
// a preset or an older save as an editable descriptor
function fromDesc(p) {
  const d = { ...p };
  d.ageGroup = p.ageGroup || (p.elderly ? 'mayor' : typeof p.age === 'number' && p.age < 26 ? 'joven' : 'adulto');
  if (p.accessory === 'gorra' || p.accessory === 'boina') { d.hat = p.accessory; d.hatColor = p.accessoryColor; }
  if (p.accessory === 'mochila') d.bag = true;
  if (p.accessory === 'gafas') d.glasses = 'gafas';
  if (p.beard && !p.beardStyle) d.beardStyle = p.elderly ? 'full' : 'short';
  if (p.skin != null && !p.skinColor) d.skinColor = SKIN[p.skin] || SKIN[1];
  if (p.hair != null && !p.hairColor) d.hairColor = HAIR[p.hair] || HAIR[0];
  if (p.bottomStyle === 'skirt' && p.skirtLen === 'short') d.bottomStyle = 'skirtS';
  d.face = p.face ? p.face.slice() : [0, 0, 0, 0, 0];
  d.height = p.height || 1; d.build = p.build || 1; d.muscle = p.muscle || 0; if (p.gender === 'f') d.bust = p.bust || 1;
  d.perk = p.perk || (PERKS[p.id] ? p.id : 'alex');
  d.topPattern = p.topPattern || 'lisa';
  return d;
}

export class Editor {
  constructor(game, audio, hooks) {
    this.game = game; this.audio = audio; this.hooks = hooks; // hooks: { preview(desc), done(desc), back() }
    this.el = $('editor');
    this.tab = 'cuerpo';
    this.yaw = 0; this.zoom = 0.35; // 0 face … 1 whole body
    this.d = null;
  }
  get saved() { return this.game.save.chars || (this.game.save.chars = []); }
  open(desc) {
    this.d = fromDesc(desc);
    if (this.d.bottomStyle === 'skirt' && this.d.skirtLen === 'short') this.d.bottomStyle = 'skirtS';
    this.el.hidden = false;
    this.yaw = 0; this.zoom = 0.35;
    this.render();
    this.push(true);
    this.bindDrag();
  }
  close() { this.el.hidden = true; }
  // the descriptor the game gets
  desc() {
    const d = normalize(JSON.parse(JSON.stringify(this.d)));
    d.hq = true;
    d.id = d.id && String(d.id).startsWith('c') ? d.id : 'c' + Date.now().toString(36);
    d.bio = d.bio || 'Tu personaje.';
    d.gait = d.perk;
    return d;
  }
  push(now = false) {
    clearTimeout(this.pT);
    const go = () => this.hooks.preview(this.desc());
    if (now) go(); else this.pT = setTimeout(go, 180);
  }
  set(key, val, rerender = true) {
    this.d[key] = val;
    if (key === 'gender') {
      if (val === 'f') { this.d.beardStyle = ''; if (['tupe', 'peinado', 'cresta', 'calvo', 'rapado'].includes(this.d.hairStyle)) this.d.hairStyle = 'melena'; }
      else if (['melena', 'media', 'largo', 'trenza', 'mono'].includes(this.d.hairStyle)) this.d.hairStyle = 'corto';
      if (val === 'm' && (this.d.topStyle === 'dress' || this.d.topStyle === 'blouse')) this.d.topStyle = 'tshirt';
    }
    this.audio.sfx('ui_click', { vol: 0.5 });
    if (rerender) this.render();
    this.push();
  }
  randomize() {
    const keep = { name: this.d.name, perk: this.d.perk, id: this.d.id };
    this.d = fromDesc(randomLook(Math.random, this.d.gender));
    Object.assign(this.d, keep);
    this.audio.sfx('ui_select');
    this.render(); this.push(true);
  }
  // ------------------------------------------------------------ UI
  render() {
    const d = this.d, el = this.el, f = d.gender === 'f';
    const chips = (key, list, cls = '') => `<div class="edChips ${cls}">${list.map(([v, l]) => `<button data-k="${key}" data-v="${esc(v)}" class="${String(d[key] ?? '') === String(v) ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
    const sw = (key, list) => `<div class="swatches edSw">${list.map((c) => `<button data-k="${key}" data-v="${c}" style="background:${c}" aria-label="${key} ${c}" class="${(d[key] || '').toLowerCase() === c.toLowerCase() ? 'on' : ''}"></button>`).join('')}<label class="edPick" title="Otro color"><input type="color" data-k="${key}" value="${/^#[0-9a-f]{6}$/i.test(d[key] || '') ? d[key] : '#888888'}"></label></div>`;
    const slider = (key, label, min, max, step, fmt, idx) => {
      const v = idx != null ? d[key][idx] : d[key];
      return `<div class="edRow"><label>${esc(label)} <b data-out="${key}${idx ?? ''}">${fmt(v)}</b></label><input type="range" data-k="${key}" ${idx != null ? `data-i="${idx}"` : ''} min="${min}" max="${max}" step="${step}" value="${v}"></div>`;
    };
    const sec = (title, html) => `<section><h4>${esc(title)}</h4>${html}</section>`;
    const cm = (v) => `${Math.round((f ? 172 * 0.935 : 178) * v * (d.ageGroup === 'mayor' ? 0.97 : 1))} cm`;
    const kg = (v) => (v < 0.94 ? 'Delgado' : v < 1.02 ? 'Normal' : v < 1.12 ? 'Fuerte' : v < 1.22 ? 'Corpulento' : 'Grande');
    const pc = (v) => (v <= 0.05 ? 'Normal' : v < 0.4 ? 'Algo' : v < 0.75 ? 'Bastante' : 'Mucho');
    const fv = (v) => (v <= -0.75 ? '−−' : v < 0 ? '−' : v === 0 ? '·' : v < 0.75 ? '+' : '++');
    let body = '';
    if (this.tab === 'cuerpo') {
      body = sec('Sexo', chips('gender', O.gender)) + sec('Edad', chips('ageGroup', O.ageGroup))
        + sec('Complexión', slider('height', 'Altura', 0.86, 1.12, 0.01, cm) + slider('build', 'Peso', 0.85, 1.35, 0.05, kg) + (f ? slider('bust', 'Pecho', 0.8, 1.3, 0.1, (v) => (v < 0.95 ? 'Poco' : v < 1.1 ? 'Normal' : 'Mucho')) : slider('muscle', 'Músculo', 0, 1, 0.25, pc)))
        + sec('Piel', sw('skinColor', SKINS));
    } else if (this.tab === 'cara') {
      body = sec('Rasgos', FACE.map(([l, a, b], i) => slider('face', `${l} (${a} ↔ ${b})`, -1, 1, 0.5, fv, i)).join(''))
        + sec('Ojos', sw('eyes', EYES)) + (f ? sec('Labios', sw('lips', LIPS)) : sec('Barba', chips('beardStyle', O.beardStyle)));
    } else if (this.tab === 'pelo') {
      body = sec('Peinado', chips('hairStyle', O.hairStyle, 'wrap')) + sec('Color del pelo', sw('hairColor', HAIRS));
    } else if (this.tab === 'ropa') {
      const layered = d.topStyle === 'jacket' || d.topStyle === 'vest' || d.topStyle === 'cardigan';
      body = sec('Arriba', chips('topStyle', O.topStyle, 'wrap') + (d.topStyle === 'jacket' ? chips('topMat', O.topMat) : '') + chips('topPattern', O.topPattern))
        + sec('Color', sw('top', COLORS)) + (d.topPattern !== 'lisa' || d.topStyle === 'tracktop' ? sec(d.topStyle === 'tracktop' ? 'Color de las rayas' : 'Segundo color', sw('top2', COLORS)) : '')
        + (layered ? sec(d.topStyle === 'vest' ? 'Camisa de debajo' : 'Camiseta de debajo', sw('under', COLORS)) : '')
        + (d.topStyle !== 'dress' ? sec('Abajo', chips('bottomStyle', O.bottomStyle, 'wrap')) + sec('Color', sw('bottom', COLORS)) + (d.bottomStyle === 'chandal' ? sec('Rayas del pantalón', sw('bottom2', COLORS)) : '') : '')
        + sec('Calzado', chips('shoeStyle', O.shoeStyle) + sw('shoes', ['#f2f2f2', '#1d1f24', '#3a2a1c', '#5b3a26', '#b8302a', '#2f5fa8', '#c9b89a']));
    } else if (this.tab === 'extras') {
      body = sec('En la cabeza', chips('hat', O.hat, 'wrap') + (d.hat ? sw('hatColor', COLORS.concat(['#d8c28a'])) : ''))
        + sec('Gafas', chips('glasses', O.glasses))
        + sec('Otros', `<div class="edChips"><button data-t="bag" class="${d.bag ? 'on' : ''}">Mochila</button><button data-t="watch" class="${d.watch ? 'on' : ''}">Reloj</button>${f ? `<button data-t="earrings" class="${d.earrings ? 'on' : ''}">Pendientes</button>` : ''}</div>` + (d.bag ? sw('bagColor', COLORS) : ''));
    } else {
      body = sec('Nombre', `<input id="edName" maxlength="16" value="${esc(d.name || '')}" placeholder="Tu nombre">`)
        + sec('Ventaja', `<div class="edPerks">${Object.entries(PERKS).map(([id, p]) => `<button data-k="perk" data-v="${id}" class="${d.perk === id ? 'on' : ''}"><b>★ ${esc(p.title)}</b><small>${esc(p.lines[0])}</small></button>`).join('')}</div>`)
        + sec('Guardados', this.saved.length ? `<div class="edSaved">${this.saved.map((s, i) => `<span><button data-load="${i}"><i style="background:${esc(s.top)}">${esc((s.name || '?')[0])}</i>${esc(s.name || 'Sin nombre')}</button><button data-del="${i}" aria-label="Borrar ${esc(s.name || '')}">✕</button></span>`).join('')}</div>` : '<p class="edHint">Aún no has guardado ninguno.</p>');
    }
    el.innerHTML = `<div class="edPanel"><h2>Crea tu <span>personaje</span></h2>
      <div class="edTabs" role="tablist">${TABS.map(([id, l]) => `<button role="tab" data-tab="${id}" class="${this.tab === id ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="edBody">${body}</div>
      <div class="edActions"><button class="btn" id="edPlay">¡A Guareña!</button><button class="btn ghost" id="edRand">🎲 Aleatorio</button><button class="btn ghost" id="edSave">Guardar</button><button class="btn ghost" id="edBack">Volver</button></div></div>
      <div class="edView"><div class="edZoom"><button id="edFace">Cara</button><button id="edBodyV">Cuerpo</button><button id="edTurnL" aria-label="Girar">⟲</button><button id="edTurnR" aria-label="Girar">⟳</button></div><div class="edName">${esc(d.name || '')}</div><p class="edHint2">${this.game.input && this.game.input.device === 'pad' ? 'Stick derecho: girar (←→) y acercar (↑↓)' : this.game.input && this.game.input.device === 'touch' ? 'Arrastra para girar · pellizca para acercar' : 'Arrastra para girar · rueda para acercar'}</p></div>`;
    this.wire();
  }
  wire() {
    const el = this.el;
    el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.tab; this.audio.sfx('ui_select'); this.render(); if (this.tab === 'cara' || this.tab === 'pelo') this.zoom = 0; else if (this.tab === 'ropa') this.zoom = 1; else this.zoom = 0.5; }));
    el.querySelectorAll('button[data-k]').forEach((b) => (b.onclick = () => this.set(b.dataset.k, b.dataset.v === '' ? null : b.dataset.v)));
    el.querySelectorAll('input[type=color][data-k]').forEach((i) => (i.oninput = () => this.set(i.dataset.k, i.value, false)));
    el.querySelectorAll('input[type=range]').forEach((i) => (i.oninput = () => {
      const v = parseFloat(i.value);
      if (i.dataset.i != null) { this.d[i.dataset.k][+i.dataset.i] = v; }
      else this.d[i.dataset.k] = v;
      const out = el.querySelector(`[data-out="${i.dataset.k}${i.dataset.i ?? ''}"]`);
      if (out) out.textContent = this.fmtOf(i.dataset.k, v);
      this.push();
    }));
    el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { const k = b.dataset.t; this.d[k] = !this.d[k]; if (k === 'bag' && this.d.bag && !this.d.bagColor) this.d.bagColor = '#18b35c'; this.audio.sfx('ui_click'); this.render(); this.push(); }));
    const nm = $('edName');
    if (nm) { nm.oninput = () => { this.d.name = nm.value.trim().slice(0, 16); const n = el.querySelector('.edName'); if (n) n.textContent = this.d.name; }; nm.onkeydown = (e) => e.stopPropagation(); }
    el.querySelectorAll('[data-load]').forEach((b) => (b.onclick = () => { this.d = fromDesc(this.saved[+b.dataset.load]); this.audio.sfx('ui_select'); this.render(); this.push(true); }));
    el.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { this.saved.splice(+b.dataset.del, 1); this.game.persist(); this.audio.sfx('ui_back'); this.render(); }));
    $('edPlay').onclick = () => { this.audio.sfx('ui_select'); this.store(); this.hooks.done(this.desc()); };
    $('edRand').onclick = () => this.randomize();
    $('edSave').onclick = () => { this.store(); this.audio.sfx('ui_select'); const b = $('edSave'); if (b) { b.textContent = 'Guardado ✓'; setTimeout(() => { if ($('edSave')) $('edSave').textContent = 'Guardar'; }, 1400); } };
    $('edBack').onclick = () => { this.audio.sfx('ui_back'); this.hooks.back(); };
    $('edFace').onclick = () => { this.zoom = 0; };
    $('edBodyV').onclick = () => { this.zoom = 1; };
    $('edTurnL').onclick = () => { this.yaw -= 0.6; };
    $('edTurnR').onclick = () => { this.yaw += 0.6; };
  }
  fmtOf(k, v) {
    const f = this.d.gender === 'f';
    if (k === 'height') return `${Math.round((f ? 172 * 0.935 : 178) * v * (this.d.ageGroup === 'mayor' ? 0.97 : 1))} cm`;
    if (k === 'build') return v < 0.94 ? 'Delgado' : v < 1.02 ? 'Normal' : v < 1.12 ? 'Fuerte' : v < 1.22 ? 'Corpulento' : 'Grande';
    if (k === 'muscle') return v <= 0.05 ? 'Normal' : v < 0.4 ? 'Algo' : v < 0.75 ? 'Bastante' : 'Mucho';
    if (k === 'bust') return v < 0.95 ? 'Poco' : v < 1.1 ? 'Normal' : 'Mucho';
    if (k === 'face') return v <= -0.75 ? '−−' : v < 0 ? '−' : v === 0 ? '·' : v < 0.75 ? '+' : '++';
    return String(v);
  }
  // keep this look among the saved ones (same id replaces), newest first, at most eight
  store() {
    const d = this.desc();
    this.d.id = d.id;
    if (!d.name) d.name = this.d.name = pick(NAMES[d.gender] || NAMES.m);
    const list = this.saved.filter((s) => s.id !== d.id);
    list.unshift(d);
    this.game.save.chars = list.slice(0, 8);
    this.game.persist();
  }
  // turning the preview: drag with the mouse or a finger, the wheel or a pinch to zoom
  bindDrag() {
    if (this.dragBound) return;
    this.dragBound = true;
    const canvas = this.game.canvas;
    let down = null;
    canvas.addEventListener('pointerdown', (e) => { if (this.el.hidden) return; down = { x: e.clientX, y: e.clientY, yaw: this.yaw, zoom: this.zoom }; });
    addEventListener('pointermove', (e) => { if (!down || this.el.hidden) return; this.yaw = down.yaw + (e.clientX - down.x) * 0.012; this.zoom = Math.max(0, Math.min(1, down.zoom + (e.clientY - down.y) * 0.004)); });
    addEventListener('pointerup', () => { down = null; });
    canvas.addEventListener('wheel', (e) => { if (this.el.hidden) return; this.zoom = Math.max(0, Math.min(1, this.zoom + Math.sign(e.deltaY) * 0.12)); }, { passive: true });
  }
  // the pad's right stick turns and zooms (called from the menu loop)
  pad(gp, dt) {
    if (this.el.hidden || !gp) return;
    const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
    if (Math.abs(rx) > 0.2) this.yaw += rx * dt * 2.5;
    if (Math.abs(ry) > 0.2) this.zoom = Math.max(0, Math.min(1, this.zoom + ry * dt * 1.2));
  }
}

// The inventory screen (I, or Inventario on the phone): what you carry by kind — food, things for the house,
// objects, fishing gear and the fish you caught, and the loot to sell — with what each one does: eat it, place it
// in your house, cast the rod, put on the sunglasses, throw it away. Also your money, and what is safe at home.
import { CATS, ITEMS, lc } from './items.js';
import { fmtMoney } from './util.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kg = (k) => k.toFixed(k < 1 ? 2 : 1).replace('.', ',') + ' kg';
const keyOf = (r) => (r.bag !== undefined ? 'bag' + r.bag : r.entry);
const READS = [
  '«Y en la Vega, que es tan ancha, / se pierde la vista…» Te quedas un rato leyendo.',
  'Un capítulo más y lo dejas. Bueno, otro.',
  'Lees un par de páginas sentado en un poyete. Qué bien se está.',
];

export class InventoryUI {
  constructor(game) {
    this.g = game;
    this.cat = 'comida';
    this.sel = 0;
    this.confirm = null;
    const el = document.createElement('div');
    el.id = 'inv'; el.className = 'screen overlay'; el.hidden = true;
    el.innerHTML = `<div class="invBox"><header><h2>Inventario</h2><p id="invMoney"></p><button id="invClose" class="btn ghost">Cerrar</button></header>
      <nav id="invTabs"></nav><div class="invMain"><div id="invGrid"></div><aside id="invInfo"></aside></div></div>`;
    document.body.appendChild(el);
    this.el = el;
    el.querySelector('#invClose').addEventListener('click', () => this.close());
    el.querySelector('#invTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) { this.cat = b.dataset.c; this.sel = 0; this.confirm = null; this.render(); } });
    el.querySelector('#invGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { this.sel = +b.dataset.i; this.confirm = null; this.render(); this.focusSel(); } });
    el.querySelector('#invInfo').addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b) this.act(b.dataset.a); });
  }
  get open() { return !this.el.hidden; }
  show() {
    const g = this.g;
    if (g.state !== 'play') return;
    if (g.decor && g.decor.placing) g.decor.cancel();
    this.el.hidden = false;
    g.state = 'inv';
    g.input.exitLock();
    g.hud.prompt('');
    // open on the first kind that has something in it
    if (!this.entries(this.cat).length) { const c = CATS.find((k) => this.entries(k.id).length); if (c) this.cat = c.id; }
    this.sel = 0; this.confirm = null;
    this.render();
    g.audio.sfx('ui_select', { vol: 0.5 });
  }
  close() {
    const g = this.g;
    if (this.el.hidden) return;
    this.el.hidden = true;
    if (g.state === 'inv') g.state = 'play';
    g.input.requestLock();
    g.audio.sfx('ui_back', { vol: 0.5 });
  }

  // what is shown in one tab: rows { ico, name, n, sub, entry | bag }
  entries(cat) {
    const g = this.g, inv = g.inv, out = [];
    if (cat === 'botin') {
      (g.player.bag || []).forEach((b, i) => out.push({ ico: '💰', name: b.name, sub: `≈ ${b.value} €`, bag: i, value: b.value }));
      return out;
    }
    for (const e of inv.list) {
      if (e.id === 'pez') { if (cat === 'pesca') out.push({ ico: e.sp === 'lucio' || e.sp === 'bass' ? '🐠' : '🐟', name: e.name, sub: `${kg(e.kg)} · ≈ ${e.value} €`, entry: e, fish: true }); continue; }
      const d = ITEMS[e.id];
      if (!d || d.cat !== cat) continue;
      out.push({ ico: d.ico, name: d.name, n: e.n || 1, sub: d.txt, entry: e, d });
    }
    if (cat === 'pesca' && inv.bait > 0) out.push({ ico: inv.baitKind === 'maiz' ? '🌽' : '🪱', name: 'Cebo abierto', n: inv.bait, sub: 'Lo que queda del último bote.', info: true });
    return out;
  }
  render() {
    const g = this.g, p = g.player, el = this.el;
    const home = g.save.bank || 0;
    el.querySelector('#invMoney').innerHTML = `Llevas <b>${fmtMoney(p.money)}</b>${home ? ` · en casa, a salvo: <b>${fmtMoney(home)}</b>` : ''}`;
    el.querySelector('#invTabs').innerHTML = CATS.map((c) => { const n = this.entries(c.id).length; return `<button data-c="${c.id}" class="${c.id === this.cat ? 'on' : ''}${n ? '' : ' empty'}">${c.ico} ${c.name}${n ? ` <i>${n}</i>` : ''}</button>`; }).join('');
    const rows = this.entries(this.cat);
    if (this.sel >= rows.length) this.sel = Math.max(0, rows.length - 1);
    el.querySelector('#invGrid').innerHTML = rows.length ? rows.map((r, i) => `<button data-i="${i}" class="${i === this.sel ? 'on' : ''}"><span class="ico">${r.ico}</span><b>${esc(r.name)}</b>${r.n > 1 ? `<i>×${r.n}</i>` : ''}${r.fish ? `<small>${esc(r.sub.split(' · ')[0])}</small>` : ''}</button>`).join('')
      : `<p class="invEmpty">${{ comida: 'No llevas comida. En el supermercado, la panadería o la frutería tienes de todo.', casa: 'Nada para la casa. Mira en la tienda de muebles, la floristería, el bazar o la de electrodomésticos.', objetos: 'Sin objetos. El bazar, la librería, la juguetería o la ferretería tienen cosas.', pesca: 'Ni caña ni peces. La caña y el cebo, en la armería; y luego, al pantano.', botin: 'Nada que vender. Lo que te llevas de las casas y las tiendas acaba aquí.' }[this.cat]}</p>`;
    const r = rows[this.sel];
    el.querySelector('#invInfo').innerHTML = r ? this.info(r) : '';
  }
  info(r) {
    const acts = this.actions(r);
    return `<div class="ii"><span class="big">${r.ico}</span><h3>${esc(r.name)}${r.n > 1 ? ` <i>×${r.n}</i>` : ''}</h3><p>${esc(r.sub || '')}</p>${r.d && r.d.price ? `<small>Precio en tienda: ${r.d.price} €</small>` : ''}</div>`
      + `<div class="acts">${acts.map((a) => `<button data-a="${a.id}" class="${a.off ? 'off' : ''}${a.id === 'drop' && this.confirm === keyOf(r) ? ' warn' : ''}">${a.label}</button>`).join('')}</div>`;
  }
  actions(r) {
    const g = this.g, out = [];
    if (r.info) return out;
    const d = r.d;
    if (d && d.cat === 'comida') out.push({ id: 'eat', label: d.stamina ? 'Beber' : 'Comer' });
    if (d && d.cat === 'casa') {
      const home = g.decor && g.decor.house && g.interior === g.decor.house;
      out.push(home ? { id: 'place', label: 'Colocar en casa' } : { id: 'noplace', label: 'Colócalo en tu casa', off: true });
    }
    if (d && d.use === 'read') out.push({ id: 'read', label: 'Leer' });
    if (r.entry && r.entry.id === 'gafas') out.push({ id: 'wear', label: 'Ponértelas' });
    if (r.entry && r.entry.id === 'cana') out.push(g.fishing && g.fishing.spot() ? { id: 'fish', label: 'Pescar aquí' } : { id: 'nofish', label: 'Ve a la orilla del pantano', off: true });
    if (r.fish && g.fishing && g.fishing.spot()) out.push({ id: 'release', label: 'Devolverlo al agua' });
    if (r.fish) out.push({ id: 'sellinfo', label: 'Se vende en el Mercado de Abastos', off: true });
    if (r.bag !== undefined) out.push({ id: 'sellinfo', label: 'Véndelo en la compraventa o el mercadillo', off: true });
    if (!(r.entry && r.entry.id === 'cana')) out.push({ id: 'drop', label: this.confirm === keyOf(r) ? '¿Seguro? Pulsa otra vez' : 'Tirar' });
    return out;
  }
  act(id) {
    const g = this.g, p = g.player, rows = this.entries(this.cat), r = rows[this.sel];
    if (!r) return;
    const inv = g.inv;
    switch (id) {
      case 'eat': {
        const d = r.d, before = p.health;
        p.health = Math.min(100, p.health + d.heal);
        if (d.stamina) p.stamina = 1;
        inv.take(r.entry.id);
        g.audio.sfx('pickup', { vol: 0.5 });
        g.hud.notify(`${d.ico} ${d.name}${p.health > before ? `: +${Math.round(p.health - before)} de salud` : ''}${d.stamina ? ' · se te quita el cansancio' : ''}`, 'ok', 2.5);
        break;
      }
      case 'place': this.close(); g.decor.begin(r.entry); g.hud.notify(`${this.placeHelp()}`, 'info', 5); return;
      case 'read': this.close(); g.hud.subtitle(r.d.name, READS[Math.floor(Math.random() * READS.length)]); setTimeout(() => g.hud.subtitle(null), 5000); return;
      case 'wear': if (g.mercadillo) g.mercadillo.restyle({ glasses: true }); g.hud.notify('Te pones las gafas de sol.', 'ok', 2); break;
      case 'fish': { this.close(); const s = g.fishing.spot(); if (s) g.fishing.cast(s); return; }
      case 'release': inv.removeEntry(r.entry); g.audio.sfx('splash', { vol: 0.5 }); g.hud.notify(`Devuelves ${r.name.startsWith('Black') ? 'el ' + r.name : 'la ' + lc(r.name)} al agua.`, 'info', 2.5); break;
      case 'drop': {
        const key = keyOf(r);
        if (this.confirm !== key) { this.confirm = key; this.render(); return; }
        this.confirm = null;
        if (r.bag !== undefined) { p.bag.splice(r.bag, 1); g.save.bag = p.bag; g.persist(); }
        else if (r.fish) inv.removeEntry(r.entry);
        else inv.take(r.entry.id);
        g.audio.sfx('ui_back', { vol: 0.5 });
        break;
      }
      default: return;
    }
    this.render();
    this.focusSel();
  }
  placeHelp() {
    const g = this.g, d = g.input.device;
    if (d === 'pad') return `Apunta donde quieras ponerlo · ${g.input.padName(4)}/${g.input.padName(5)} lo giran · ${g.input.padName(0)} lo deja · ${g.input.padName(1)} cancela`;
    if (d === 'touch') return 'Apunta donde quieras ponerlo · el botón de arma lo gira · toca el aviso para dejarlo · «Subir» cancela';
    return 'Apunta donde quieras ponerlo · rueda del ratón, Q o X lo giran · E o clic lo deja · Esc o clic derecho cancela';
  }
  focusSel() { const b = this.el.querySelector(`#invGrid [data-i="${this.sel}"]`); if (b && this.g.input.device !== 'touch') b.focus({ preventScroll: false }); }

  // keyboard (the pad goes through the menus' own navigation)
  input(input) {
    if (input.hit('Escape') || input.hit('KeyI') || input.hit('Tab')) { this.close(); return; }
    const rows = this.entries(this.cat);
    const cols = Math.max(1, Math.floor((this.el.querySelector('#invGrid').clientWidth || 400) / 118));
    const move = (d) => { if (!rows.length) return; this.sel = Math.max(0, Math.min(rows.length - 1, this.sel + d)); this.confirm = null; this.render(); this.focusSel(); };
    if (input.hit('ArrowRight') || input.hit('KeyD')) move(1);
    if (input.hit('ArrowLeft') || input.hit('KeyA')) move(-1);
    if (input.hit('ArrowDown') || input.hit('KeyS')) move(cols);
    if (input.hit('ArrowUp') || input.hit('KeyW')) move(-cols);
    for (let i = 0; i < CATS.length; i++) if (input.hit('Digit' + (i + 1))) { this.cat = CATS[i].id; this.sel = 0; this.confirm = null; this.render(); }
    // Q / E (LB / RB): the tab before, the next one
    const tab = input.hit('KeyQ') || input.gpPressed(4) ? -1 : input.hit('KeyE') || input.gpPressed(5) ? 1 : 0;
    if (tab) { const i = CATS.findIndex((c) => c.id === this.cat); this.cat = CATS[(i + tab + CATS.length) % CATS.length].id; this.sel = 0; this.confirm = null; this.render(); this.focusSel(); }
    if (input.hit('Enter') || input.hit('Space')) { const r = rows[this.sel]; const a = r && this.actions(r).find((x) => !x.off); if (a) this.act(a.id); }
    if (input.hit('Delete') || input.hit('Backspace')) this.act('drop');
  }
}

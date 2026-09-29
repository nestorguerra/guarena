// Your house: the safe in the bedroom where you keep money you don't want to lose (a hospital bill or a fine only
// ever takes what you carry), and a small list menu for it (1–9, arrows or D-pad, Intro / A, Esc / B, or a click).
import { fmtMoney } from './util.js';

export class ListMenu {
  constructor(game, id) {
    this.g = game;
    const el = document.createElement('div');
    el.id = id; el.className = 'listMenu'; el.hidden = true;
    document.getElementById('hud').appendChild(el);
    el.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) this.pick(+b.dataset.i); });
    this.el = el;
    this.rows = null;
  }
  get open() { return !!this.rows; }
  show(title, rows, onClose) { this.title = title; this.rows = rows; this.sel = Math.max(0, rows.findIndex((r) => !r.off)); this.onClose = onClose; this.el.hidden = false; this.render(); }
  update(title, rows) { this.title = title; this.rows = rows; if (this.sel >= rows.length) this.sel = 0; this.render(); }
  close() { if (!this.rows) return; this.rows = null; this.el.hidden = true; if (this.onClose) this.onClose(); }
  render() {
    if (!this.rows) return;
    const g = this.g, d = g.input.device;
    const help = d === 'pad' ? `▲ ▼ y ${g.input.padName(0)} · ${g.input.padName(1)} para salir` : d === 'touch' ? 'Toca una opción · fuera para salir' : '1–9, flechas e Intro o clic · Esc para salir';
    this.el.innerHTML = `<h3>${this.title}</h3>` + this.rows.map((r, i) => `<button data-i="${i}" class="${i === this.sel ? 'on' : ''}${r.off ? ' off' : ''}"><kbd>${i + 1}</kbd><span>${r.label}</span><b>${r.right || ''}</b></button>`).join('') + `<small>${help}</small>`;
  }
  pick(i) { const r = this.rows && this.rows[i]; if (!r || r.off) { this.g.audio.sfx('ui_back', { vol: 0.4 }); return; } this.sel = i; r.run(); }
  input() {
    const input = this.g.input, L = this.rows;
    if (!L) return;
    for (let i = 0; i < Math.min(9, L.length); i++) if (input.hit('Digit' + (i + 1))) { this.pick(i); return; }
    if (input.hit('ArrowDown') || input.gpPressed(13)) { this.sel = (this.sel + 1) % L.length; this.render(); }
    if (input.hit('ArrowUp') || input.gpPressed(12)) { this.sel = (this.sel + L.length - 1) % L.length; this.render(); }
    if (input.hit('Enter') || input.gpPressed(0)) this.pick(this.sel);
    if (input.hit('Escape') || input.gpPressed(1)) this.close();
  }
}

export class HomeSafe {
  constructor(game) {
    this.g = game;
    this.menu = new ListMenu(game, 'safeMenu');
    this.at = null;
  }
  get bank() { return this.g.save.bank || 0; }
  set bank(v) { this.g.save.bank = Math.max(0, Math.round(v)); }
  option(it) {
    const b = this.bank;
    return { label: `Caja fuerte <small>(${b ? `dentro: ${fmtMoney(b)}` : 'vacía'})</small>`, run: () => this.openMenu(it) };
  }
  rows() {
    const g = this.g, p = g.player, b = this.bank, m = p.money;
    const put = (n) => ({ label: n === 'all' ? 'Guardarlo todo' : `Guardar ${n} €`, right: n === 'all' ? fmtMoney(m) : '', off: n === 'all' ? m <= 0 : m < n, run: () => this.move(n === 'all' ? m : n) });
    const take = (n) => ({ label: n === 'all' ? 'Sacarlo todo' : `Sacar ${n} €`, right: n === 'all' ? fmtMoney(b) : '', off: n === 'all' ? b <= 0 : b < n, run: () => this.move(-(n === 'all' ? b : n)) });
    return [put(50), put(100), put(500), put('all'), take(50), take(100), take(500), take('all')];
  }
  title() { return `Caja fuerte · dentro: ${fmtMoney(this.bank)} · llevas ${fmtMoney(this.g.player.money)}`; }
  openMenu(it) {
    this.at = it;
    this.menu.show(this.title(), this.rows());
    this.g.audio.sfx('ui_click', { vol: 0.6 });
  }
  move(n) {
    const g = this.g, p = g.player;
    if (!n) return;
    if (n > 0) { const k = Math.min(n, p.money); p.money -= k; this.bank = this.bank + k; }
    else { const k = Math.min(-n, this.bank); this.bank = this.bank - k; p.money += k; }
    g.audio.sfx('money', { vol: 0.6 });
    g.persist();
    this.menu.update(this.title(), this.rows());
  }
  update() {
    const g = this.g, p = g.player;
    if (!this.menu.open) return;
    if (!g.interior || !this.at || Math.hypot(p.pos.x - this.at.x, p.pos.z - this.at.z) > this.at.r + 0.8) { this.menu.close(); return; }
    this.menu.input();
  }
}

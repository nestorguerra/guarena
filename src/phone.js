// The phone in your pocket (Tab · D-pad up · 📱): the map, messages and calls with your friends (multiplayer, with
// push-to-talk voice notes), send them where you are, the radio (the real FM stations of the Vegas Altas: turn the dial
// with ←/→), the jobs in town, what you carry, a camera that hides the HUD, and the settings / pause menu. Arrows (or the D-pad) move, Intro / A opens, Esc / B goes back. You can walk with it.
const APPS = [
  { id: 'mapa', name: 'Mapa', ico: '🗺️' },
  { id: 'mensajes', name: 'Mensajes', ico: '💬', mp: true },
  { id: 'ubicacion', name: 'Ubicación', ico: '📍', mp: true },
  { id: 'llamar', name: 'Llamar', ico: '📞', mp: true },
  { id: 'radio', name: 'Radio', ico: '📻' },
  { id: 'trabajos', name: 'Trabajos', ico: '💼' },
  { id: 'mochila', name: 'Mochila', ico: '🎒' },
  { id: 'camara', name: 'Cámara', ico: '📷' },
  { id: 'menu', name: 'Menú', ico: '⚙️' },
];
const PHRASES = ['¿Dónde estás?', '¡Ven aquí!', 'Te mando mi ubicación', '¡Me persigue la policía!', '¿Vamos a por un trabajo?', 'Nos vemos en la plaza', '¡Échame una mano!', '¡Voy para allá!'];
import { DIAL, FM_LO, FM_HI } from './fm.js';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Phone {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.screen = 'home';
    this.sel = 0;
    this.call = null;      // { id, name, state: 'out'|'in'|'on', t }
    this.rec = null;
    this.el = document.createElement('div');
    this.el.id = 'phone';
    this.el.hidden = true;
    document.getElementById('hud').appendChild(this.el);
    this.el.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { this.sel = +b.dataset.i; this.activate(); } });
    // push to talk with the mouse / finger on the button
    this.el.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-ptt]')) { e.preventDefault(); this.startTalk(); } });
    addEventListener('pointerup', () => this.stopTalk());
  }

  get mp() { const n = this.game.net; return !!(n && n.active); }
  toggle(on = !this.open) {
    const g = this.game;
    if (on && g.state !== 'play') return;
    this.open = on;
    this.el.hidden = !on;
    if (on) { this.screen = this.call ? 'call' : 'home'; this.sel = 0; this.justOpened = true; this.render(); g.audio.sfx('ui_select', { vol: 0.5 }); }
    else { g.audio.sfx('ui_back', { vol: 0.5 }); this.stopTalk(); }
  }
  back() {
    if (this.screen === 'home' || this.screen === 'call' && this.call && this.call.state === 'on') { this.toggle(false); return; }
    this.screen = this.call ? 'call' : 'home'; this.sel = 0; this.render();
  }

  // the list shown now: [{label, sub, run}]
  items() {
    const g = this.game, net = g.net, p = g.player;
    if (this.screen === 'home') return APPS.map((a) => ({ ico: a.ico, label: a.name, off: a.mp && !this.mp, run: () => this.openApp(a.id) }));
    if (this.screen === 'llamar') {
      const out = [];
      if (net) for (const r of net.remotes.values()) out.push({ ico: '👤', label: r.name, sub: 'Llamar', run: () => this.dial(r.id, r.name) });
      if (!out.length) out.push({ ico: '…', label: 'No hay nadie conectado', off: true });
      return out;
    }
    if (this.screen === 'trabajos') {
      const J = g.jobs;
      if (!J) return [];
      const out = [];
      if (J.job) out.push({ ico: '⏱️', label: 'Dejar el trabajo actual', run: () => { J.quit(); this.back(); } });
      const list = J.places.map((q) => ({ q, d: Math.hypot(q.x - p.pos.x, q.z - p.pos.z) })).sort((a, b) => a.d - b.d).slice(0, 8);
      for (const { q, d } of list) out.push(d < 10 && !J.job ? { ico: '🤝', label: cap(q.name), sub: `Aquí mismo · pedir trabajo de ${{ reparto: 'repartos', reponedor: 'reponedor', cartero: 'cartero', grua: 'grúa', camarero: 'camarero', barrendero: 'barrendero', tractor: 'tractor' }[q.job] || q.job}`, run: () => { this.toggle(false); J.hire(q); } } : { ico: '💼', label: cap(q.name), sub: `${{ reparto: 'repartos', reponedor: 'reponedor', cartero: 'cartero', grua: 'grúa', camarero: 'camarero', barrendero: 'barrendero', tractor: 'tractor' }[q.job] || ''} · ${Math.round(d)} m`, run: () => { g.hud.waypoint = { x: q.x, z: q.z }; g.hud.route = null; g.hud.routeT = 0; g.hud.notify(`📍 Marcado en el GPS: ${q.name}`, 'info', 3); this.toggle(false); } });
      return out;
    }
    if (this.screen === 'radio') {
      const fm = g.fm;
      if (!fm) return [];
      const inCar = !!p.vehicle;
      const on = !!fm.where;
      const out = [{ ico: '⏻', label: on ? 'Apagar la radio' : 'Encender la radio', sub: inCar ? 'La radio del coche' : 'Por el altavoz del móvil', run: () => this.radioPower() },
        { ico: '⏭', label: 'Buscar la siguiente', sub: g.input.device === 'touch' ? 'O toca una emisora de la lista' : g.input.device === 'pad' ? '◀ ▶ mueven el dial a mano' : '← → mueven el dial a mano', run: () => { this.radioOnIfOff(); fm.seek(1); this.render(); } },
        { ico: '⏮', label: 'Buscar la anterior', run: () => { this.radioOnIfOff(); fm.seek(-1); this.render(); } }];
      for (const d of DIAL) {
        const here = on && Math.abs(fm.freq - d.f) < 0.05;
        out.push({ ico: here ? '🔊' : d.game !== undefined ? '🎵' : '📻', label: `${d.f.toFixed(1)}  ${d.name}`, sub: d.url && fm.closed ? 'Real · solo en la versión del ordenador' : d.sub, dim: d.url && fm.closed, run: () => { this.radioOnIfOff(); fm.tune(d.f); this.render(); } });
      }
      return out;
    }
    if (this.screen === 'mochila') {
      const bag = p.bag || [];
      if (!bag.length) return [{ ico: '🎒', label: 'La mochila está vacía', off: true }];
      return bag.map((b) => ({ ico: '•', label: b.name, sub: `≈ ${b.value} €`, off: true }));
    }
    if (this.screen === 'call') {
      const c = this.call;
      if (!c) return [];
      if (c.state === 'in') return [{ ico: '✅', label: 'Contestar', run: () => this.answer() }, { ico: '❌', label: 'Colgar', run: () => this.hangup() }];
      const out = [{ ico: '🎙️', label: g.input.device === 'pad' ? `Mantén ${g.input.padName(4)} para hablar` : g.input.device === 'touch' ? 'Mantén pulsado aquí para hablar' : 'Mantén B (o este botón) para hablar', ptt: true, off: !this.canRecord() }];
      for (const ph of PHRASES) out.push({ ico: '💬', label: ph, run: () => this.say(ph) });
      out.push({ ico: '📍', label: 'Enviarle mi ubicación', run: () => this.sendLocation(c.id) });
      out.push({ ico: '❌', label: 'Colgar', run: () => this.hangup() });
      return out;
    }
    return [];
  }
  openApp(id) {
    const g = this.game;
    if (id === 'mapa') { this.toggle(false); g.hud.toggleMap(true); g.state = 'map'; g.input.exitLock(); return; }
    if (id === 'mensajes') { if (!this.mp) return; this.toggle(false); g.net.openChat(); return; }
    if (id === 'ubicacion') { if (!this.mp) return; this.sendLocation(null); return; }
    if (id === 'camara') { this.toggle(false); document.body.classList.add('photo'); g.hud.notify('📷 Modo foto: 8 segundos sin interfaz', 'info', 1.5); setTimeout(() => document.body.classList.remove('photo'), 8000); return; }
    if (id === 'menu') { this.toggle(false); g.ui.onPause && g.ui.onPause(); return; }
    if (id === 'llamar' && !this.mp) return;
    this.screen = id; this.sel = 0; this.render();
  }
  // the radio app: on/off (the car's radio when driving, the phone's speaker on foot)
  radioPower() {
    const g = this.game, fm = g.fm;
    if (g.player.vehicle) fm.toggleCar();
    else if (fm.where) fm.stop();
    else { fm.play('phone'); fm.show(); }
    this.render();
  }
  radioOnIfOff() { const fm = this.game.fm; if (!fm.where) this.radioPower(); }
  activate() {
    const it = this.items()[this.sel];
    if (it && it.off && this.screen === 'home') { this.game.audio.sfx('ui_back', { vol: 0.4 }); this.game.hud.notify('Esto funciona en una partida multijugador, con tus amigos conectados.', 'info', 3); return; }
    if (!it || it.off || it.ptt) return;
    this.game.audio.sfx('ui_click', { vol: 0.6 });
    it.run();
  }

  // ------------------------------------------------------------ calls (multiplayer)
  dial(id, name) {
    const net = this.game.net;
    this.call = { id, name, state: 'out', t: 0 };
    net.send({ t: 'ev', k: 'call', to: id, a: 'ring' });
    this.screen = 'call'; this.sel = 0; this.render();
  }
  answer() {
    const c = this.call;
    if (!c) return;
    c.state = 'on'; c.t = 0;
    this.game.net.send({ t: 'ev', k: 'call', to: c.id, a: 'ok' });
    this.game.hud.notify(`📞 Hablando con ${c.name}. Mantén B (o LB) para hablar.`, 'ok', 4);
    this.render();
  }
  hangup(remote = false) {
    const c = this.call;
    if (!c) return;
    if (!remote) this.game.net.send({ t: 'ev', k: 'call', to: c.id, a: 'end' });
    this.stopTalk();
    this.call = null;
    this.game.hud.notify(`📞 Llamada terminada${remote ? ` (${c.name} ha colgado)` : ''}`, 'info', 2.5);
    if (this.open) { this.screen = 'home'; this.sel = 0; this.render(); }
  }
  say(text) {
    const net = this.game.net;
    net.send({ t: 'ev', k: 'chat', text });
    net.chatLine(net.name, text, '#fff');
  }
  sendLocation(to) {
    const g = this.game, p = g.player, net = g.net;
    const x = p.vehicle ? p.vehicle.x : p.pos.x, z = p.vehicle ? p.vehicle.z : p.pos.z;
    net.send({ t: 'ev', k: 'loc', to, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
    g.hud.notify(to ? '📍 Ubicación enviada' : '📍 Ubicación enviada a todos', 'ok', 2.5);
  }
  // incoming from the network layer
  onEvent(m, who) {
    const g = this.game, net = g.net;
    if (m.to && m.to !== net.id) return;
    if (m.k === 'loc') {
      g.hud.waypoint = { x: +m.x, z: +m.z }; g.hud.route = null; g.hud.routeT = 0;
      g.hud.notify(`📍 ${who} te ha mandado su ubicación (marcada en el GPS)`, 'info', 5);
      g.audio.sfx('text_msg');
    } else if (m.k === 'call') {
      if (m.a === 'ring') {
        if (this.call) { net.send({ t: 'ev', k: 'call', to: m.id, a: 'busy' }); return; }
        this.call = { id: m.id, name: who, state: 'in', t: 0 };
        g.audio.sfx('phone_ring');
        g.hud.notify(`📞 ${who} te está llamando · Tab para contestar`, 'info', 6);
        if (!this.open) this.toggle(true);
        this.screen = 'call'; this.sel = 0; this.render();
      } else if (m.a === 'ok' && this.call && this.call.id === m.id) { this.call.state = 'on'; this.call.t = 0; g.hud.notify(`📞 ${who} ha contestado. Mantén B (o LB) para hablar.`, 'ok', 4); this.render(); }
      else if ((m.a === 'end' || m.a === 'busy') && this.call && this.call.id === m.id) { if (m.a === 'busy') g.hud.notify(`📞 ${who} está comunicando`, 'info', 3); this.hangup(true); }
    } else if (m.k === 'voice') {
      this.playVoice(m, who);
    }
  }

  // ------------------------------------------------------------ push-to-talk voice notes (needs a secure page: the
  // host's own computer or the internet link; on the LAN http link the browser does not allow the microphone)
  canRecord() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && window.isSecureContext); }
  async startTalk() {
    const c = this.call, g = this.game;
    if (!c || c.state !== 'on' || this.rec) return;
    if (!this.canRecord()) { g.hud.notify('🎙️ La voz solo funciona con el enlace por internet (https) o en el ordenador que invita.', 'info', 4); return; }
    try {
      this.stream = this.stream || await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const rec = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
        if (blob.size < 800 || blob.size > 46000) return;
        const b64 = await blobToB64(blob);
        if (this.call) g.net.send({ t: 'ev', k: 'voice', to: this.call.id, mime: blob.type, data: b64 });
      };
      rec.start();
      this.rec = rec; this.recT = performance.now();
      this.el.classList.add('talking');
      clearTimeout(this.recCap); this.recCap = setTimeout(() => this.stopTalk(), 7000); // one breath at a time
    } catch (e) { g.hud.notify('🎙️ No hay permiso para el micrófono.', 'info', 3); }
  }
  stopTalk() {
    if (!this.rec) return;
    try { this.rec.stop(); } catch (e) { /* already stopped */ }
    this.rec = null;
    this.el.classList.remove('talking');
  }
  playVoice(m, who) {
    try {
      const bin = atob(m.data), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([buf], { type: m.mime || 'audio/webm' }));
      const a = new Audio(url);
      a.onended = () => URL.revokeObjectURL(url);
      a.play().catch(() => {});
      this.game.hud.subtitle(who, '🔊 …');
      setTimeout(() => this.game.hud.subtitle(null), 2500);
    } catch (e) { /* bad data */ }
  }

  // ------------------------------------------------------------ per frame: keys and pad while it is open
  update(dt) {
    const g = this.game, input = g.input;
    if (this.call) this.call.t += dt;
    // talk: B on the keyboard, LB on the pad (while on a call)
    if (this.call && this.call.state === 'on') {
      const hold = input.down('KeyB') || input.gpBtn(4);
      if (hold && !this.rec) this.startTalk();
      else if (!hold && this.rec && !this.pointerTalk) this.stopTalk();
    }
    if (!this.open) return;
    // the D-pad ▲ that opened the phone must not also move the selection (afterwards ▲ moves up, home screen too)
    const opened = this.justOpened; this.justOpened = false;
    // the clock on the home screen keeps time while the phone is open
    if (this.screen === 'home' && this._clock !== g.sky.timeString) { this._clock = g.sky.timeString; const t = this.el.querySelector('.ph-top span'); if (t) t.textContent = this._clock; }
    const L = this.items();
    const cols = this.screen === 'home' ? 3 : 1;
    const mv = (d) => { this.sel = (this.sel + d + L.length) % L.length; this.render(); g.audio.sfx('ui_click', { vol: 0.3 }); };
    if (input.hit('ArrowDown') || input.gpPressed(13)) mv(cols);
    if (input.hit('ArrowUp') || (input.gpPressed(12) && !opened)) mv(-cols);
    if (cols > 1 && (input.hit('ArrowRight') || input.gpPressed(15))) mv(1);
    if (cols > 1 && (input.hit('ArrowLeft') || input.gpPressed(14))) mv(-1);
    if (this.screen === 'radio' && g.fm) {
      // ←/→ (D-pad ◀ ▶) turn the dial 0.1 MHz; held down it keeps turning
      const l = input.down('ArrowLeft') || input.gpBtn(14), r = input.down('ArrowRight') || input.gpBtn(15);
      const dir = r ? 1 : l ? -1 : 0;
      if (dir) {
        if (!this.tuneHeld) { this.tuneHeld = 0; this.radioOnIfOff(); g.fm.tune(g.fm.freq + dir * 0.1); this.render(); }
        this.tuneHeld += dt;
        this.tuneRep = (this.tuneRep || 0) - dt;
        if (this.tuneHeld > 0.35 && this.tuneRep <= 0) { this.tuneRep = 0.07; g.fm.tune(g.fm.freq + dir * 0.1); this.render(); }
      } else this.tuneHeld = 0;
    }
    if (input.hit('Enter') || input.gpPressed(0)) this.activate();
    if (input.hit('Escape') || input.gpPressed(1) || input.hit('Backspace')) this.back();
    if (this.screen === 'call' && this.call && this.call.state !== 'in') {
      const t = Math.floor(this.call.t);
      const lab = this.el.querySelector('.callT');
      if (lab) lab.textContent = this.call.state === 'out' ? 'Llamando…' : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      if (this.call.state === 'out' && this.call.t > 25) { g.hud.notify(`📞 ${this.call.name} no contesta`, 'info', 3); this.hangup(); }
    }
  }
  // the key help under the screen, for the device in use
  foot() {
    const I = this.game.input, pad = I.device === 'pad', A = I.padName(0), B = I.padName(1);
    if (I.device === 'touch') return this.screen === 'radio' ? 'Toca una emisora para sintonizarla' : 'Toca para abrir';
    if (this.screen === 'radio') return pad ? `◀ ▶ dial · ▲▼ elegir · ${A} sintonizar · ${B} atrás` : '←→ dial · ↑↓ elegir · Intro sintonizar · Esc atrás';
    return pad ? `Cruceta · ${A} abrir · ${B} atrás` : '↑↓←→ · Intro abrir · Esc atrás';
  }
  render() {
    if (!this.open) return;
    const g = this.game, L = this.items();
    this.sel = Math.min(this.sel, Math.max(0, L.length - 1));
    const title = { home: g.sky.timeString, llamar: 'Llamar', trabajos: 'Trabajos cerca', mochila: 'Mochila', radio: 'Radio FM', call: this.call ? this.call.name : '' }[this.screen] || '';
    let head = this.screen === 'call' && this.call ? `<div class="callBox"><b>${esc(this.call.name)}</b><span class="callT">${this.call.state === 'in' ? 'Te está llamando' : 'Llamando…'}</span></div>` : '';
    if (this.screen === 'radio' && g.fm) {
      const fm = g.fm, e = fm.entry, pos = (f) => ((f - FM_LO) / (FM_HI - FM_LO) * 100).toFixed(2);
      const ticks = Array.from({ length: 21 }, (_, i) => `<i style="left:${pos(88 + i)}%"></i>`).join('') + DIAL.map((d) => `<i class="${d.game !== undefined ? 'gm' : 'st'}" style="left:${pos(d.f)}%"></i>`).join('');
      head = `<div class="fmBox"><b>${fm.freq.toFixed(1)} FM</b><div class="fmName">${fm.where ? esc(e && !fm.weak ? e.name : e ? '…' : 'Estática') : 'Apagada'}</div><div class="fmSt">${fm.where ? esc(fm.statusText()) : ''}</div><div class="fmDial">${ticks}<em style="left:${pos(fm.freq)}%"></em></div></div>`;
    }
    this.el.dataset.screen = this.screen;
    const grid = this.screen === 'home' ? 'grid' : 'list';
    this.el.innerHTML = `<div class="ph-top"><span>${esc(title)}</span><span>${this.mp ? '📶' : '✈️'}</span></div>${head}<div class="ph-${grid}">` +
      L.map((it, i) => `<button data-i="${i}" ${it.ptt ? 'data-ptt="1"' : ''} class="${i === this.sel ? 'on' : ''}${it.off || it.dim ? ' off' : ''}"><i>${it.ico}</i><span>${esc(it.label)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`).join('') +
      `</div><div class="ph-foot">${this.foot()}</div>`;
    const cur = this.el.querySelector('button.on');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
function blobToB64(blob) {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(blob); });
}

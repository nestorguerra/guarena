// The radio as it sounds around Guareña: the real stations on the FM dial of the Vegas Altas (Mérida, Don Benito,
// Villanueva), live over the internet, the three stations of the game on free spots of the dial, and static in
// between. In the car R seeks the next station (Mayús+R the one before); the phone's Radio app turns the dial by hand
// (←/→ 0.1 MHz) and plays it on foot through the phone's speaker. A friend driving you (multiplayer) shares the station.
import { clamp } from './util.js';

const STW = (m) => `https://playerservices.streamtheworld.com/api/livestream-redirect/${m}`;
const RNE = (m) => `https://dispatcher.rndfnk.com/crtve/${m}/mp3/high`;
// frequencies as heard in Guareña (Mérida II, Don Benito, Villanueva de la Serena transmitters)
export const DIAL = [
  { f: 87.6, name: 'Rock FM', sub: 'Rock', url: 'https://rockfm-cope-rrcast.flumotion.com/cope/rockfm-low.mp3' },
  { f: 87.9, name: 'Canal Extremadura Radio', sub: 'La radio de Extremadura', url: 'https://dpdcrurkn82q1.cloudfront.net/wct-24e14bfa-c6bf-4b58-9b12-dda97484f818/continuous/4d975a39-0232-43e0-9277-9503453777a9/radio-live/radio_128k-aac.m3u8', hls: true },
  { f: 89.1, name: 'Cadena 100', sub: 'Éxitos', url: 'https://cadena100-streamers-mp3.flumotion.com/cope/cadena100.mp3' },
  { f: 89.3, name: 'Radiolé', sub: 'Flamenco, rumba y copla', url: STW('RADIOLE.mp3') },
  { f: 90.1, name: 'Radio Clásica', sub: 'RNE · Música clásica', url: RNE('rnerc/main') },
  { f: 90.4, name: 'Onda Cero Mérida', sub: 'Noticias y deportes', url: STW('OC_MERIDAAAC.aac') },
  { f: 91.1, name: 'Vegas Altas FM', sub: 'Rumba · emisora del juego', game: 0 },
  { f: 92.2, name: 'Radio 3', sub: 'RNE · Música', url: RNE('rner3/main') },
  { f: 93.5, name: 'Cadena Dial', sub: 'Música en español', url: STW('CADENADIAL.mp3') },
  { f: 94.9, name: 'Radio Nacional', sub: 'RNE Extremadura', url: RNE('rne1/ext') },
  { f: 95.6, name: 'Cadena SER Mérida', sub: 'Noticias y deportes', url: STW('SER_MERIDA.mp3') },
  { f: 96.4, name: 'Guadiana Urbana', sub: 'Urbano · emisora del juego', game: 1 },
  { f: 98.4, name: 'LOS40', sub: 'Éxitos · Extremadura', url: STW('LOS40_EXTREMADURA.mp3') },
  { f: 100.0, name: 'SER Vegas Altas', sub: 'Don Benito', url: STW('SER_VEGAS_ALTAS.mp3') },
  { f: 101.3, name: 'Radio 5', sub: 'RNE · Todo noticias', url: RNE('rne5/main') },
  { f: 103.6, name: 'COPE Mérida', sub: 'Noticias y deportes', url: 'https://wecast-bl01.flumotion.com/copesedes/merida.mp3' },
  { f: 105.2, name: 'Castúo Rock', sub: 'Rock · emisora del juego', game: 2 },
  { f: 107.8, name: 'Radio Guareña', sub: 'La radio municipal · no emite por internet', none: true },
];
export const FM_LO = 87.5, FM_HI = 108.0;
const OFF_STATION = 3; // the game's silent station ('Radio Apagada'): the chain stays open for the live streams
const STATUS = { juego: 'Emisora del juego', conectando: 'Sintonizando…', directo: 'En directo', sinred: 'Sin señal: no se puede conectar', nodisp: 'Este navegador no puede reproducirla', estatica: '', local: 'Solo se oye en FM, no emite por internet', cerrada: 'Solo en la versión del ordenador' };
// the page published on claude.ai may not connect to other sites (its security policy): there only the game's stations play
const HOSTED = typeof location !== 'undefined' && /claudeusercontent\.com$|claude\.ai$/.test(location.hostname);
const r1 = (f) => Math.round(f * 10) / 10;

export class FM {
  constructor(game) {
    this.game = game;
    const s = game.save;
    this.freq = r1(clamp(+s.fm || 91.1, FM_LO, FM_HI));
    this.carOn = s.fmOn !== false; // the car radio: on or off when you get in
    this.where = null;              // 'car' | 'phone' | null (not playing)
    this.entry = null; this.weak = false;
    this.state = 'estatica';
    this.el = null; this.node = null; this.direct = false;
    this.failed = new Map();        // url → when it failed (seek skips it for a minute)
    this.tunedT = 0; this.idleT = 0; this.connT = 0; this.shareT = 0;
    this.warned = false;
    this.closed = HOSTED;           // no live streams here (the published page)
    if (typeof document !== 'undefined') document.addEventListener('securitypolicyviolation', (e) => { if (/media|default/.test(e.effectiveDirective || e.violatedDirective || '') && /^https?:/.test(e.blockedURI || '')) this.onClosed(); });
  }
  // the browser refuses the streams: say so once, keep to the game's stations
  onClosed() {
    if (this.closedSaid) return;
    this.closed = true; this.closedSaid = true;
    if (this.entry && this.entry.url) { this.stopLive(); this.state = 'cerrada'; this.mix(); this.show(); }
    this.game.hud.help('📻 En la versión publicada el navegador no deja conectar con emisoras de fuera, así que aquí suenan las del juego (<b>91.1</b>, <b>96.4</b> y <b>105.2</b>). Las reales (SER Vegas Altas, Onda Cero Mérida, COPE, RNE, Canal Extremadura…) se oyen en directo en la versión del ordenador: la carpeta <b>Guareña multijugador</b>.', 10);
  }

  // ------------------------------------------------------------ the dial
  entryAt(f) { return DIAL.find((d) => Math.abs(d.f - f) < 0.051) || null; }
  near(f) { let best = null, bd = 1e9; for (const d of DIAL) { const k = Math.abs(d.f - f); if (k < bd) { bd = k; best = d; } } return { d: best, k: bd }; }
  label() { const e = this.entry; return `${this.freq.toFixed(1)} FM${e && !this.weak ? ' · ' + e.name : ''}`; }
  statusText() { return this.weak ? 'Señal débil · afina el dial' : STATUS[this.state] ?? ''; }
  playable(d) { return !d.none && !(d.url && this.closed) && !(d.hls && !this.canHls()) && !(d.url && this.failed.has(d.url) && performance.now() - this.failed.get(d.url) < 60000); }
  canHls() { if (this._hls === undefined) { try { this._hls = !!document.createElement('audio').canPlayType('application/vnd.apple.mpegurl'); } catch (e) { this._hls = false; } } return this._hls; }

  // seek to the next/previous station that plays (the car's R); past the last one comes "off"
  seek(dir = 1, withOff = false) {
    const list = DIAL.filter((d) => this.playable(d));
    if (!list.length) return;
    if (withOff && !this.where) { // R with the radio off: on again, from the start of the dial
      this.freq = (dir > 0 ? list[0] : list[list.length - 1]).f;
      this.carOn = false; this.toggleCar(); return;
    }
    const cur = this.where ? this.freq : null;
    let next;
    if (dir > 0) next = cur === null ? list[0] : list.find((d) => d.f > cur + 0.05);
    else next = cur === null ? list[list.length - 1] : [...list].reverse().find((d) => d.f < cur - 0.05);
    if (!next && withOff && this.where === 'car') { this.toggleCar(); return; }
    if (!next) next = dir > 0 ? list[0] : list[list.length - 1];
    this.tune(next.f);
  }
  // turn the dial (any frequency, 0.1 MHz steps)
  tune(f, quiet = false) {
    f = r1(clamp(f, FM_LO, FM_HI));
    const prevEntry = this.entry, prevWeak = this.weak;
    this.freq = f;
    this.game.save.fm = f;
    const exact = this.entryAt(f), n = this.near(f);
    this.entry = exact || (n.k < 0.151 ? n.d : null);
    this.weak = !exact && !!this.entry;
    this.tunedT = 0;
    if (this.where) this.apply(prevEntry !== this.entry, prevWeak !== this.weak);
    if (!quiet) this.show();
    this.game.carInterior && this.game.carInterior.setRadio && this.game.carInterior.setRadio(this.where ? f : null);
  }
  show() {
    const g = this.game, ph = g.phone;
    if (ph && ph.open && ph.screen === 'radio') { ph.render(); return; } // the phone shows the dial
    if (!this.where) return;
    const st = this.statusText();
    g.hud.radio(this.label(), this.entry && !this.weak ? [this.entry.sub, st].filter(Boolean).join(' · ') : st);
  }

  // ------------------------------------------------------------ on / off
  // play in the car (radio switched on) or on the phone; null stops it
  play(where) {
    if (where === this.where) return;
    const A = this.game.audio;
    this.where = where;
    if (!where) { this.stopLive(); this.setNoise(0); A.radioOn(false); this.game.carInterior && this.game.carInterior.setRadio && this.game.carInterior.setRadio(null); return; }
    A.radioOn(true, where === 'phone' ? 0.5 : 1);
    this.tune(this.freq, true);
    this.apply(true, true);
  }
  stop() { this.play(null); }
  // the car you get into: on if it was on; off when you get out (the phone radio can play on foot)
  enterCar() { if (this.carOn) { this.play('car'); this.show(); } else { this.play(null); this.game.hud.radio('Radio apagada', `${this.game.input.keyText('R', 14, 'Radio')} para encenderla`); } }
  exitCar() { if (this.where === 'car') this.play(null); }
  toggleCar() {
    this.carOn = !this.carOn; this.game.save.fmOn = this.carOn;
    if (this.carOn) { this.play('car'); this.show(); } else { this.stop(); this.game.hud.radio('Radio apagada'); }
    const net = this.game.net;
    if (net && net.active && this.game.player.vehicle) net.send({ t: 'ev', k: 'radio', f: this.freq, on: this.carOn ? 1 : 0 });
  }

  // what the speakers play for the tuned frequency
  apply(stationChanged, weakChanged) {
    const A = this.game.audio, e = this.entry;
    if (!stationChanged && !weakChanged && this.where) { this.mix(); return; }
    const target = e && e.game !== undefined ? e.game : OFF_STATION;
    if (stationChanged && A.stationIndex === target && A.tuneNoise) A.tuneNoise(); // (changing the game's station hisses by itself)
    if (!e || e.none) {
      this.stopLive(); A.stationIndex = OFF_STATION;
      this.state = e && e.none ? 'local' : 'estatica';
    } else if (e.game !== undefined) {
      this.stopLive(); A.stationIndex = e.game;
      this.state = 'juego';
    } else {
      A.stationIndex = OFF_STATION;
      if (this.closed) { this.stopLive(); this.state = 'cerrada'; if (!this.closedSaid) this.onClosed(); }
      else if (e.hls && !this.canHls()) { this.stopLive(); this.state = 'nodisp'; }
      else if (!this.el || this.elUrl !== e.url) this.startLive(e);
    }
    this.mix();
  }
  // live stream level and static: clean on the exact frequency, hissing one step off, only static elsewhere
  mix() {
    const dead = !this.entry || this.entry.none || this.state === 'sinred' || this.state === 'nodisp' || this.state === 'cerrada';
    const live = dead ? 0 : this.weak ? 0.5 : 1;
    const hiss = dead ? 0.26 : this.weak ? 0.2 : this.state === 'conectando' ? 0.1 : 0;
    this.setNoise(hiss);
    this.setLive(live);
  }

  // ------------------------------------------------------------ audio graph (built once the sound is unlocked)
  graph() {
    if (this.liveGain) return true;
    const A = this.game.audio, c = A.ctx, rin = A.radioIn;
    if (!c || typeof c.createGain !== 'function' || !rin || typeof rin.connect !== 'function') return false; // no sound (yet)
    try {
      this.liveGain = c.createGain(); this.liveGain.gain.value = 0; this.liveGain.connect(A.radioIn);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.45; bp.connect(A.radioIn);
      this.noiseGain = c.createGain(); this.noiseGain.gain.value = 0; this.noiseGain.connect(bp);
      const src = c.createBufferSource(); src.buffer = A.bank.get('white'); src.loop = true; src.connect(this.noiseGain); src.start();
      this.noiseSrc = src;
    } catch (e) { this.liveGain = null; return false; }
    return true;
  }
  setNoise(v) { if (!this.graph()) return; const t = this.game.audio.ctx.currentTime; this.noiseGain.gain.setTargetAtTime(v, t, 0.05); }
  setLive(v) {
    this.liveLevel = v;
    if (this.graph() && !this.direct) { const t = this.game.audio.ctx.currentTime; this.liveGain.gain.setTargetAtTime(v, t, 0.06); }
  }

  // ------------------------------------------------------------ the live stream
  startLive(e, direct = false) {
    this.stopLive();
    const el = new Audio();
    el.preload = 'auto';
    this.direct = direct || !this.graph();
    if (!this.direct) el.crossOrigin = 'anonymous'; // through the car speakers (the servers allow it); else straight out
    el.src = e.url;
    this.el = el; this.elUrl = e.url; this.connT = 0;
    this.state = 'conectando';
    if (!this.direct) { try { this.node = this.game.audio.ctx.createMediaElementSource(el); this.node.connect(this.liveGain); } catch (err) { this.node = null; this.direct = true; el.crossOrigin = null; } }
    if (this.direct) el.volume = 0;
    const mine = () => this.el === el;
    el.addEventListener('playing', () => { if (!mine()) return; this.state = 'directo'; this.failed.delete(e.url); this.mix(); if (this.tunedT < 12) this.show(); });
    el.addEventListener('waiting', () => { if (mine() && this.state === 'directo') { this.state = 'conectando'; this.connT = 0; this.mix(); } });
    el.addEventListener('error', () => { if (mine()) this.fail(e); });
    const p = el.play();
    if (p && p.catch) p.catch((err) => { if (mine() && err && err.name === 'NotAllowedError') { this.state = 'conectando'; this.needPlay = true; } });
    this.mix();
  }
  fail(e) {
    // through the speakers failed (no CORS): try playing it straight; after that, no signal
    if (!this.direct) { this.startLive(e, true); return; }
    this.stopLive();
    this.failed.set(e.url, performance.now());
    this.state = 'sinred';
    this.mix();
    if (this.tunedT < 15) this.show();
    if (!this.warned && !this.closed) {
      this.warned = true;
      this.game.hud.help('📻 No se puede conectar con las emisoras reales (hace falta internet y que el navegador lo permita). Las emisoras del juego, <b>91.1</b>, <b>96.4</b> y <b>105.2</b>, siempre se oyen.', 8);
    }
  }
  stopLive() {
    const el = this.el;
    if (!el) return;
    this.el = null; this.elUrl = null;
    try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) { /* gone */ }
    if (this.node) { try { this.node.disconnect(); } catch (e) { /* gone */ } this.node = null; }
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    const g = this.game, A = g.audio, p = g.player;
    this.tunedT += dt;
    // a stream that never starts (or stalls for good): give up / reconnect
    if (this.el && this.state === 'conectando') {
      this.connT += dt;
      if (this.needPlay && A.ready) { this.needPlay = false; const q = this.el.play(); if (q && q.catch) q.catch(() => {}); }
      if (this.connT > 14) { const e = this.entry; if (e && e.url === this.elUrl) this.fail(e); }
    }
    // straight playback (no speaker chain): follow the music volume, the pause and the level by hand
    if (this.el && this.direct) {
      const v = A._vol && typeof A._vol === 'object' ? A._vol : { master: 1, music: 0.6 };
      const want = this.where ? (this.liveLevel || 0) * v.master * v.music * (A._paused ? 0.25 : 1) * (this.where === 'phone' ? 0.5 : 0.8) : 0;
      this.el.volume = clamp(this.el.volume + (want - this.el.volume) * Math.min(1, dt * 8), 0, 1);
    }
    // radio off for a while: hang up the stream (no data wasted)
    if (!this.where && this.el) { this.idleT += dt; if (this.idleT > 3) this.stopLive(); } else this.idleT = 0;
    // riding with a friend: their radio; driving with friends aboard: tell them yours now and then
    const net = g.net;
    if (net && net.active && p.vehicle && this.where === 'car') {
      this.shareT -= dt;
      if (this.shareT <= 0) { this.shareT = 6; net.send({ t: 'ev', k: 'radio', f: this.freq, on: 1 }); }
    }
  }
  // a friend's radio (the car you ride in)
  onShared(m, fromId) {
    const p = this.game.player;
    if (p.mode !== 'passenger' || !p.ride || p.ride.id !== fromId) return;
    const f = r1(+m.f);
    if (!m.on) { this.stop(); return; }
    if (!this.where) this.play('car');
    if (Math.abs(f - this.freq) > 0.05) this.tune(f);
  }
}

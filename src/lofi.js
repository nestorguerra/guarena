// A lo-fi bed for the anime look (the reference plays soft lo-fi while you deliver letters): a lazy swung beat, a warm
// electric piano on jazzy chords, a round bass, a few notes of a tune now and then, vinyl crackle and tape wobble —
// all made here, no files. It plays quietly on foot; it steps aside for the radio, in a car and inside the church.
const BPM = 74, STEP = 60 / BPM / 4, SWING = 0.3;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// two four-bar halves: | Fmaj9 Em7 Dm9 Cmaj9 | Bbmaj7 Am7 Gm9 C7sus4 |  (voicings in the middle, bass below)
const CHORDS = [
  { b: 41, n: [57, 60, 64, 67] }, { b: 40, n: [55, 59, 62, 64] }, { b: 38, n: [57, 60, 64, 65] }, { b: 36, n: [55, 59, 62, 64] },
  { b: 46, n: [57, 62, 65, 69] }, { b: 45, n: [55, 60, 64, 67] }, { b: 43, n: [57, 58, 62, 65] }, { b: 36, n: [58, 60, 65, 67] },
];
const TUNE = [69, 72, 74, 76, 79, 81, 84]; // A minor pentatonic, up high
// 16 steps a bar: kick, snare, hat (velocities); a lazy hip-hop groove
const KICK = [1, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0.9, 0, 0, 0, 0, 0];
const SNARE = [0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0.25];
const HAT = [0.5, 0.25, 0.4, 0.25, 0.5, 0.25, 0.4, 0.3, 0.5, 0.25, 0.4, 0.25, 0.5, 0.3, 0.45, 0.35];

export class LoFi {
  constructor(audio) { this.a = audio; this.want = 0; this.level = 0; this.step = 0; this.next = 0; this.out = null; this.enabled = true; }
  // the chain: piano and drums → a low-pass (lo-fi), a soft saturation → the music bus; the vinyl underneath
  ensure() {
    const a = this.a, c = a.ctx;
    if (!c || !a.musicDuck) return false;
    if (this.out) return true;
    this.c = c;
    this.out = c.createGain(); this.out.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.4;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 45;
    const sat = c.createWaveShaper(); const cv = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = (i / 511) * 2 - 1; cv[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); } sat.curve = cv;
    this.out.connect(sat); sat.connect(lp); lp.connect(hp); hp.connect(a.musicDuck);
    this.bus = c.createGain(); this.bus.gain.value = 0.55; this.bus.connect(this.out);
    // tape wobble: a slow LFO on every piano note's pitch
    this.lfo = c.createOscillator(); this.lfo.frequency.value = 0.33; this.lfoAmt = c.createGain(); this.lfoAmt.gain.value = 7; this.lfo.connect(this.lfoAmt); this.lfo.start();
    // vinyl: hiss and crackle, looped
    const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let b0 = 0;
    for (let i = 0; i < len; i++) { b0 = 0.985 * b0 + 0.015 * (Math.random() * 2 - 1); d[i] = b0 * 0.6 + (Math.random() < 0.00045 ? (Math.random() * 2 - 1) * 0.9 : 0); }
    const vin = c.createBufferSource(); vin.buffer = buf; vin.loop = true;
    const vg = c.createGain(); vg.gain.value = 0.11; vin.connect(vg); vg.connect(this.out); vin.start();
    this.next = c.currentTime + 0.1;
    return true;
  }
  // on: whether it should be heard now (on foot, no radio, outdoors…)
  update(dt, on) {
    if (!this.enabled) on = false;
    if (!this.ensure()) return;
    const c = this.c, t = c.currentTime;
    this.want = on ? 1 : 0;
    this.level += (this.want - this.level) * Math.min(1, dt * (on ? 0.35 : 1.2));
    this.out.gain.setTargetAtTime(this.level * 0.42, t, 0.1);
    if (this.level < 0.01) { this.next = t + 0.1; return; }
    if (this.next < t - 0.5) this.next = t + 0.05; // (after a pause: pick up the beat again)
    while (this.next < t + 0.25) { this.play(this.step, this.next + (this.step % 2 ? STEP * SWING : 0)); this.next += STEP; this.step++; }
  }
  play(step, when) {
    const s16 = step % 16, bar = Math.floor(step / 16), ch = CHORDS[bar % CHORDS.length];
    // drums (the game's own kit, a little slower and duller)
    if (KICK[s16]) this.hit('kick', when, KICK[s16] * 0.9, 0.95);
    if (SNARE[s16]) this.hit(s16 === 15 ? 'rim' : 'snare', when, SNARE[s16] * 0.42, 0.9);
    if (HAT[s16] && !(bar % 8 === 7 && s16 > 11)) this.hit('hat', when, HAT[s16] * 0.22 * (0.8 + Math.random() * 0.4), 1.0);
    // the piano: the chord on the one, a softer stab on the "and" of two, sometimes a push into the next bar
    if (s16 === 0) this.chord(ch.n, when, 0.16, 2.6);
    if (s16 === 6) this.chord(ch.n.slice(1), when, 0.09, 1.0);
    if (s16 === 14 && Math.random() < 0.4) this.chord(CHORDS[(bar + 1) % CHORDS.length].n.slice(2), when, 0.07, 0.6);
    // the bass: root on the one, the fifth or the octave later
    if (s16 === 0) this.bass(ch.b, when, 1.4);
    if (s16 === 10) this.bass(ch.b + (Math.random() < 0.5 ? 7 : 12), when, 0.5);
    // a little tune now and then, on the off-beats
    if (s16 % 4 === 2 && Math.random() < 0.16) this.bell(TUNE[Math.floor(Math.random() * TUNE.length)], when);
  }
  hit(name, when, vol, rate) {
    const a = this.a, buf = a.bank && a.bank.get(name);
    if (!buf) return;
    const src = this.c.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = this.c.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.bus); src.start(when);
  }
  // an electric piano voice: the tone, its octave fading fast, a short bright tine at the start
  note(m, when, vol, dur) {
    const c = this.c, f = mtof(m);
    const g = c.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + 0.012); g.gain.exponentialRampToValueAtTime(vol * 0.45, when + 0.35); g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    g.connect(this.bus);
    for (const [mul, amp, type] of [[1, 1, 'sine'], [2, 0.28, 'sine'], [4.01, 0.06, 'triangle']]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f * mul; this.lfoAmt.connect(o.detune);
      const og = c.createGain(); og.gain.value = amp;
      if (mul > 1) { og.gain.setValueAtTime(amp, when); og.gain.exponentialRampToValueAtTime(amp * 0.05, when + (mul > 2 ? 0.08 : 0.5)); }
      o.connect(og); og.connect(g); o.start(when); o.stop(when + dur + 0.05);
    }
  }
  chord(ns, when, vol, dur) { ns.forEach((m, i) => this.note(m, when + i * 0.012, vol, dur)); } // (a slight strum)
  bass(m, when, dur) {
    const c = this.c, o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = c.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.32, when + 0.02); g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(lp); lp.connect(g); g.connect(this.bus); o.start(when); o.stop(when + dur + 0.05);
  }
  bell(m, when) {
    const c = this.c, o = c.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m); this.lfoAmt.connect(o.detune);
    const g = c.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.06, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, when + 1.4);
    o.connect(g); g.connect(this.bus); o.start(when); o.stop(when + 1.5);
  }
}

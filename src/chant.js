// Gregorian chant for inside Santa María, sung here (no recordings): a schola of men's voices in unison, low and slow,
// a long way off in the stone. Each voice a reed of harmonics shaped by the vowel being sung (its formants), a little
// out of tune with the others, each with its own vibrato; the text sung syllable by syllable, Latin, to melodies in the
// first and eighth modes — the intonation, the reciting tone, the half-verse's cadence, a breath, the final — and the
// church gives it back for five seconds. It plays quietly under everything (the music volume), fades in as you come
// in and out as you leave, and steps back while mass is said.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// the formants of sung Latin vowels, men's voices: [F1, F2, F3] (Hz) and their weights
const VOWEL = {
  a: [[700, 1.0], [1150, 0.55], [2600, 0.2]],
  e: [[450, 1.0], [1850, 0.4], [2550, 0.2]],
  i: [[300, 1.0], [2200, 0.32], [2950, 0.18]],
  o: [[460, 1.0], [820, 0.55], [2700, 0.15]],
  u: [[330, 1.0], [700, 0.45], [2500, 0.12]],
};
// the texts, cut into syllables (the vowel sung is the syllable's first; ae and oe sing as e)
const TEXTS = [
  'Sal-ve Re-gi-na | ma-ter mi-se-ri-cor-di-ae || vi-ta dul-ce-do | et spes no-stra sal-ve',
  'Di-xit Do-mi-nus Do-mi-no me-o || se-de a dex-tris me-is',
  'Lau-da-te Do-mi-num om-nes gen-tes || lau-da-te e-um om-nes po-pu-li',
  'A-ve Ma-ri-a gra-ti-a ple-na || Do-mi-nus te-cum',
  'Ky-ri-e e-le-i-son || Chri-ste e-le-i-son',
  'Glo-ri-a Pa-tri et Fi-li-o || et Spi-ri-tu-i San-cto',
  'Ma-gni-fi-cat || a-ni-ma me-a Do-mi-num',
  'Be-ne-di-ctus qui ve-nit || in no-mi-ne Do-mi-ni',
];
// the modes: the final, the reciting tone, the notes to move on (MIDI numbers; men sing them low)
const MODES = [
  { name: 'I', fin: 48, ten: 55, scale: [46, 48, 50, 51, 53, 55, 56, 58, 60] },   // re (dorian) sung a tone low, for men's voices: reciting a fifth up
  { name: 'VIII', fin: 53, ten: 58, scale: [48, 50, 51, 53, 55, 57, 58, 60, 62] }, // sol (hypomixolydian) a tone low, reciting a fourth up
];
const rnd = (a, b) => a + Math.random() * (b - a);
const vowelOf = (syl) => { const s = syl.toLowerCase().replace(/ae|oe/g, 'e'); const m = s.match(/[aeiouy]/); return m ? (m[0] === 'y' ? 'i' : m[0]) : 'a'; };
const consOf = (syl) => { const c = syl.toLowerCase()[0]; return 'sxz'.includes(c) ? 's' : 'tdpbckgq'.includes(c) ? 't' : ''; };

export class Chant {
  constructor(audio) { this.a = audio; this.level = 0; this.want = 0; this.next = 0; this.piece = Math.floor(Math.random() * TEXTS.length); this.quiet = 1; }
  // the schola, made once: five voices into the vowel's formants, the church's long echo after them
  ensure() {
    const a = this.a, c = a.ctx;
    if (!c || !a.musicDuck) return false;
    if (this.out) return true;
    this.c = c;
    this.out = c.createGain(); this.out.gain.value = 0; this.out.connect(a.musicDuck);
    // the church: a long, dark tail (5 s), a few early reflections off the walls close by
    const conv = c.createConvolver(); conv.buffer = this.impulse(c, 5.2); conv.connect(this.out);
    this.wet = c.createGain(); this.wet.gain.value = 0.85; this.wet.connect(conv);
    this.dry = c.createGain(); this.dry.gain.value = 0.18; this.dry.connect(this.out);
    // the vowel: three band-passes in parallel, their sum softened
    this.mix = c.createGain(); this.mix.gain.value = 1;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 0.5;
    this.mix.connect(lp); lp.connect(this.wet); lp.connect(this.dry);
    this.form = [0, 1, 2].map((i) => { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = VOWEL.a[i][0]; f.Q.value = [6, 9, 11][i]; const gn = c.createGain(); gn.gain.value = VOWEL.a[i][1]; f.connect(gn); gn.connect(this.mix); return { f, g: gn }; });
    // the voices' common breath (their loudness follows the syllables)
    this.env = c.createGain(); this.env.gain.value = 0;
    for (const F of this.form) this.env.connect(F.f);
    // five men: a reed tone each, detuned a little, each with his vibrato
    this.voices = [];
    for (let i = 0; i < 5; i++) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(50); o.detune.value = rnd(-9, 9);
      const lfo = c.createOscillator(); lfo.frequency.value = rnd(4.6, 5.8); const ld = c.createGain(); ld.gain.value = rnd(6, 13); lfo.connect(ld); ld.connect(o.detune);
      const vg = c.createGain(); vg.gain.value = 0.16;
      o.connect(vg); vg.connect(this.env); o.start(); lfo.start();
      this.voices.push({ o, vg });
    }
    // a little breath in the tone, and the hiss of the consonants
    const len = c.sampleRate * 2, nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const ns = c.createBufferSource(); ns.buffer = nb; ns.loop = true; ns.start();
    const breath = c.createGain(); breath.gain.value = 0.012; ns.connect(breath); breath.connect(this.env);
    this.hiss = c.createGain(); this.hiss.gain.value = 0;
    this.hissF = c.createBiquadFilter(); this.hissF.type = 'bandpass'; this.hissF.frequency.value = 5200; this.hissF.Q.value = 1.4;
    ns.connect(this.hissF); this.hissF.connect(this.hiss); this.hiss.connect(this.wet); this.hiss.connect(this.dry);
    this.next = c.currentTime + 1.2;
    return true;
  }
  impulse(c, secs) {
    const n = Math.floor(c.sampleRate * secs), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / c.sampleRate, decay = Math.exp(-t / 0.78), k = 0.25 + 0.7 * Math.exp(-t / 0.9); // (the highs die first)
        lp += (Math.random() * 2 - 1 - lp) * k;
        d[i] = lp * decay * (t < 0.012 ? t / 0.012 : 1);
      }
      for (const [t, g] of [[0.019, 0.5], [0.031, 0.35], [0.047, 0.3], [0.066, 0.22], [0.083, 0.18]]) { const i = Math.floor((t + ch * 0.003) * c.sampleRate); if (i < n) d[i] += g * (Math.random() < 0.5 ? -1 : 1); }
    }
    return b;
  }
  // on: inside the church; quiet: 0..1 (lower while mass is said)
  update(dt, on, quiet = 1) {
    if (!this.ensure()) return;
    const c = this.c, t = c.currentTime;
    this.want = on ? 1 : 0;
    this.level += (this.want - this.level) * Math.min(1, dt * (on ? 0.45 : 1.5));
    this.quiet += (quiet - this.quiet) * Math.min(1, dt * 0.8);
    this.out.gain.setTargetAtTime(this.level * this.quiet * 0.8, t, 0.15);
    if (this.level < 0.01) { this.next = Math.max(this.next, t + 0.8); if (this.next > t + 30) this.next = t + 0.8; return; }
    if (this.next < t + 0.4) this.next = this.phrase(Math.max(this.next, t + 0.05));
  }
  // one piece of text, both halves, sung from `when`; returns when the next may start
  phrase(when) {
    const text = TEXTS[this.piece % TEXTS.length]; this.piece++;
    const M = MODES[Math.random() < 0.6 ? 0 : 1];
    const halves = text.split('||').map((h) => h.split('|').map((p) => p.trim().split(/\s+/).map((w) => w.split('-'))));
    let t = when;
    halves.forEach((half, hi) => {
      half.forEach((part, pi) => {
        const syls = part.flat(), words = part.map((w) => w.length);
        const last = hi === halves.length - 1 && pi === half.length - 1;
        // the melody of this stretch: intonation up to the reciting tone, the recitation, a cadence (to the final at the end)
        const notes = [];
        const sc = M.scale, iT = sc.indexOf(M.ten), iF = sc.indexOf(M.fin);
        for (let i = 0; i < syls.length; i++) {
          const fromEnd = syls.length - 1 - i;
          if (hi === 0 && pi === 0 && i < 2) notes.push([sc[Math.max(0, iT - 2 + i)]]);           // the intonation
          else if (fromEnd === 0) notes.push(last ? [sc[iF + 1], sc[iF]] : [sc[iT - 1], sc[iT]]);   // the cadence's last syllable (a two-note neume)
          else if (fromEnd === 1) notes.push(last ? [sc[iF + 2], sc[iF + 1]] : [sc[iT + 1]]);
          else if (fromEnd === 2 && syls.length > 4) notes.push([sc[iT + (Math.random() < 0.5 ? 1 : 0)]]);
          else notes.push([M.ten]);                                                               // the reciting tone
          if (Math.random() < 0.12 && fromEnd > 2) notes[i] = [M.ten, sc[iT + 1], M.ten];          // a little ornament now and then
        }
        let wi = 0, wc = 0;
        syls.forEach((syl, i) => {
          const ns = notes[i], fromEnd = syls.length - 1 - i;
          const dur = fromEnd === 0 ? (last ? 1.9 : 1.1) : fromEnd === 1 ? 0.7 : 0.46 + Math.random() * 0.06;
          this.syllable(t, syl, ns, dur, wc === 0, fromEnd === 0 && last);
          t += dur;
          if (++wc >= words[wi]) { wc = 0; wi++; t += 0.04; }
        });
        t += last ? 0 : pi < half.length - 1 ? 0.5 : 0.9; // a breath
      });
    });
    // the voices die away; a silence before the next piece
    const e = this.env.gain; e.setTargetAtTime(0, t, 0.25);
    return t + rnd(4.5, 8);
  }
  syllable(t, syl, notes, dur, wordStart, final) {
    const v = VOWEL[vowelOf(syl)], e = this.env.gain;
    // the vowel's formants glide into place
    this.form.forEach((F, i) => { F.f.frequency.setTargetAtTime(v[i][0], t, 0.035); F.g.gain.setTargetAtTime(v[i][1], t, 0.04); });
    // the notes (a neume of one, two or three): each voice reaches it in its own time
    const nd = dur / notes.length;
    notes.forEach((m, k) => { const f = mtof(m), tt = t + k * nd; for (const vc of this.voices) vc.o.frequency.setTargetAtTime(f, tt + Math.random() * 0.03, 0.045); });
    // the loudness: a soft swell into the syllable, a slight lift on a word's first, the final let go
    const peak = (wordStart ? 0.95 : 0.82) * (final ? 0.9 : 1);
    e.cancelScheduledValues(t); e.setTargetAtTime(peak, t, 0.06);
    if (final) e.setTargetAtTime(0.0, t + dur * 0.55, dur * 0.3);
    else e.setTargetAtTime(peak * 0.8, t + dur * 0.7, 0.08);
    // its consonant: a breath of hiss
    const cs = consOf(syl);
    if (cs) { const h = this.hiss.gain; this.hissF.frequency.setValueAtTime(cs === 's' ? 5600 : 2400, t - 0.05); h.setValueAtTime(0, t - 0.06); h.linearRampToValueAtTime(cs === 's' ? 0.02 : 0.012, t - 0.03); h.linearRampToValueAtTime(0, t + 0.01); }
  }
}

// All sound is synthesized with the Web Audio API — no audio files.
import { BPM } from '../config.js';

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function distCurve(k) {
  const n = 2048;
  const c = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / norm;
  }
  return c;
}

export default class Synth {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ok = !!AC;
    if (!this.ok) return;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 8;
    comp.ratio.value = 5;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.musicBus = this.gain(0.5, this.master);
    this.sfxBus = this.gain(0.85, this.master);

    this.gtrMusic = this.amp(this.musicBus, { drive: 6, k: 4, cab: 3600, out: 0.22 });
    this.gtrSfx = this.amp(this.sfxBus, { drive: 7, k: 4, cab: 4200, out: 0.2 });

    // Lead guitar: hotter amp + dotted-eighth delay.
    this.leadAmp = this.amp(this.musicBus, { drive: 10, k: 5, cab: 5000, out: 0.12 });
    const dly = ctx.createDelay(1.5);
    dly.delayTime.value = (60 / BPM) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    const wet = this.gain(0.35, this.musicBus);
    this.leadAmp.output.connect(dly);
    dly.connect(fb);
    fb.connect(dly);
    dly.connect(wet);

    // White noise buffer shared by drums / fx.
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Crowd: looping filtered noise whose level follows the action.
    this.crowdBase = 0.05;
    this.crowdGain = this.gain(0, this.sfxBus);
    const crowdSrc = ctx.createBufferSource();
    crowdSrc.buffer = this.noiseBuf;
    crowdSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    crowdSrc.connect(bp);
    bp.connect(lp);
    lp.connect(this.crowdGain);
    crowdSrc.start();
    // Slow "roar" wobble on the crowd.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.35;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);
    lfo.start();

    this.muted = false;
  }

  // ---------- plumbing ----------
  gain(v, dest) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    if (dest) g.connect(dest);
    return g;
  }

  filter(type, freq, q = 0.7, gainDb = 0) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.gain.value = gainDb;
    return f;
  }

  amp(dest, { drive = 6, k = 4, cab = 3600, out = 0.22 } = {}) {
    const ctx = this.ctx;
    const input = this.gain(drive);
    const hp = this.filter('highpass', 100);
    const sh = ctx.createWaveShaper();
    sh.curve = distCurve(k);
    sh.oversample = '4x';
    const scoop = this.filter('peaking', 700, 0.9, -7);
    const pres = this.filter('peaking', 2200, 1, 4);
    const cab1 = this.filter('lowpass', cab, 0.8);
    const cab2 = this.filter('lowpass', cab * 1.4, 0.5);
    const output = this.gain(out, dest);
    input.connect(hp);
    hp.connect(sh);
    sh.connect(scoop);
    scoop.connect(pres);
    pres.connect(cab1);
    cab1.connect(cab2);
    cab2.connect(output);
    return { input, output };
  }

  now() {
    return this.ctx.currentTime;
  }

  resume() {
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.now(), 0.05);
  }

  noiseSrc(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.start(t, Math.random() * 1.5, dur + 0.05);
    return s;
  }

  // Generic pitched blip with an exponential pitch + volume envelope.
  tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.1, vol = 0.1, t = this.now(), dest = this.sfxBus, attack = 0.003 }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Filtered noise hit with optional filter sweep.
  noise({ dur = 0.1, type = 'bandpass', freq = 1000, freq1 = freq, q = 1, vol = 0.2, t = this.now(), dest = this.sfxBus }) {
    const src = this.noiseSrc(t, dur);
    const f = this.filter(type, freq, q);
    if (freq1 !== freq) f.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
  }

  // ---------- instruments ----------
  guitar(t, midi, dur, { mute = false, chord = false, vel = 1, out } = {}) {
    const ctx = this.ctx;
    const dest = out || this.gtrMusic.input;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    if (mute) {
      f.frequency.setValueAtTime(1900, t);
      f.frequency.exponentialRampToValueAtTime(450, t + 0.09);
      f.Q.value = 2;
    } else {
      f.frequency.value = 4200;
    }
    g.connect(f);
    f.connect(dest);
    const notes = chord ? [midi, midi + 7, midi + 12] : [midi];
    const end = t + (mute ? 0.18 : dur + 0.1);
    for (const n of notes) {
      for (const det of [-8, 8]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiHz(n);
        o.detune.value = det;
        o.connect(g);
        o.start(t);
        o.stop(end);
      }
    }
    const peak = (0.2 * vel) / Math.sqrt(notes.length);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    if (mute) {
      g.gain.exponentialRampToValueAtTime(0.0008, t + Math.min(dur, 0.15));
    } else {
      g.gain.setTargetAtTime(peak * 0.6, t + 0.01, 0.2);
      g.gain.setTargetAtTime(0.0001, t + dur, 0.04);
    }
  }

  lead(t, midi, dur) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(this.leadAmp.input);
    const vib = ctx.createOscillator();
    vib.frequency.value = 6;
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(18, t + Math.max(0.05, dur * 0.8));
    vib.connect(vibG);
    for (const [type, det] of [['square', 0], ['sawtooth', 6]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midiHz(midi);
      o.detune.value = det;
      vibG.connect(o.detune);
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
    vib.start(t);
    vib.stop(t + dur + 0.1);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.006);
    g.gain.setTargetAtTime(0.08, t + 0.02, 0.1);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.03);
  }

  bass(t, midi, dur, vel = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const f = this.filter('lowpass', 650, 1.2);
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.15);
    g.connect(f);
    f.connect(this.musicBus);
    for (const [type, mult] of [['sawtooth', 1], ['sine', 0.5]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midiHz(midi) * mult;
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.08);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32 * vel, t + 0.005);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.9, 0.04);
  }

  kick(t, vel = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(155, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.3);
    this.noise({ t, dur: 0.012, type: 'highpass', freq: 3000, vol: 0.25 * vel, dest: this.musicBus });
  }

  snare(t, vel = 1) {
    this.noise({ t, dur: 0.17, type: 'highpass', freq: 1100, vol: 0.5 * vel, dest: this.musicBus });
    this.tone({ t, type: 'triangle', f0: 190, f1: 150, dur: 0.09, vol: 0.45 * vel, dest: this.musicBus, attack: 0.001 });
  }

  hat(t, vel = 1, open = false) {
    this.noise({ t, dur: open ? 0.22 : 0.035, type: 'highpass', freq: 7500, vol: 0.16 * vel, dest: this.musicBus });
  }

  crash(t, vel = 1) {
    this.noise({ t, dur: 1.4, type: 'highpass', freq: 3800, vol: 0.28 * vel, dest: this.musicBus });
  }

  clap(t, vel = 1) {
    for (let i = 0; i < 3; i++) {
      this.noise({ t: t + i * 0.011, dur: 0.09, type: 'bandpass', freq: 1300, q: 0.8, vol: 0.45 * vel, dest: this.musicBus });
    }
  }

  // ---------- crowd ----------
  setCrowd(level) {
    this.crowdBase = level;
    this.crowdGain.gain.setTargetAtTime(level, this.now(), 0.6);
  }

  cheer(level = 0.6, dur = 2) {
    const t = this.now();
    this.crowdGain.gain.cancelScheduledValues(t);
    this.crowdGain.gain.setTargetAtTime(level, t, 0.12);
    this.crowdGain.gain.setTargetAtTime(this.crowdBase, t + dur, 0.7);
  }

  // ---------- sfx ----------
  // Player sounds are built on `root`, the band's current chord root (Music.harmonyAt),
  // so every attack is in key: power chords only contain root, fifth and octave.

  // Riff shot: a short power-chord stab one octave above the band, doubling its chord.
  riffStab(t, root, onBeat, vel = 0.9) {
    this.guitar(t, root + 12, 0.14, { chord: true, vel, out: this.gtrSfx.input });
    if (onBeat) this.ding(t, root);
  }

  // Power chord: the band's chord across two octaves plus a sub thump on the root.
  powerChord(t, root, onBeat) {
    this.guitar(t, root, 0.9, { chord: true, vel: 1.4, out: this.gtrSfx.input });
    this.guitar(t, root + 12, 0.9, { chord: true, vel: 0.8, out: this.gtrSfx.input });
    this.noise({ t, dur: 0.6, type: 'highpass', freq: 3000, vol: 0.18 });
    this.tone({ t, type: 'sine', f0: midiHz(root + 12), f1: midiHz(root - 12), dur: 0.3, vol: 0.5 });
    if (onBeat) this.ding(t, root);
  }

  // On-beat chime: the chord's root and fifth, high up, so it always rings in harmony.
  ding(t = this.now(), root = 40) {
    this.tone({ t, type: 'sine', f0: midiHz(root + 36), dur: 0.25, vol: 0.14 });
    this.tone({ t: t + 0.03, type: 'sine', f0: midiHz(root + 43), dur: 0.22, vol: 0.09 });
  }

  jump() {
    this.tone({ type: 'square', f0: 220, f1: 440, dur: 0.09, vol: 0.05 });
  }

  doubleJump() {
    this.tone({ type: 'square', f0: 330, f1: 990, dur: 0.13, vol: 0.05 });
    this.noise({ dur: 0.12, type: 'highpass', freq: 4000, vol: 0.06 });
  }

  land() {
    this.noise({ dur: 0.05, type: 'lowpass', freq: 500, vol: 0.12 });
  }

  stomp() {
    const t = this.now();
    this.tone({ t, type: 'sine', f0: 160, f1: 45, dur: 0.18, vol: 0.6 });
    this.noise({ t, dur: 0.1, type: 'lowpass', freq: 900, vol: 0.3 });
  }

  hurt() {
    this.tone({ type: 'sawtooth', f0: 420, f1: 80, dur: 0.32, vol: 0.18 });
    this.noise({ dur: 0.18, type: 'bandpass', freq: 600, vol: 0.25 });
  }

  enemyHit() {
    this.noise({ dur: 0.06, type: 'bandpass', freq: 2500, vol: 0.2 });
    this.tone({ type: 'square', f0: 620, f1: 300, dur: 0.06, vol: 0.06 });
  }

  enemyDie() {
    this.noise({ dur: 0.28, type: 'lowpass', freq: 1500, freq1: 150, vol: 0.32 });
    this.tone({ type: 'square', f0: 520, f1: 60, dur: 0.26, vol: 0.08 });
  }

  boom() {
    const t = this.now();
    this.tone({ t, type: 'sine', f0: 90, f1: 28, dur: 0.7, vol: 0.7 });
    this.noise({ t, dur: 0.6, type: 'lowpass', freq: 1200, freq1: 80, vol: 0.5 });
  }

  pickup() {
    const t = this.now();
    this.tone({ t, type: 'square', f0: 988, dur: 0.06, vol: 0.06 });
    this.tone({ t: t + 0.06, type: 'square', f0: 1319, dur: 0.1, vol: 0.06 });
  }

  heal() {
    const t = this.now();
    this.noise({ t, dur: 0.22, type: 'highpass', freq: 3200, vol: 0.2 });
    this.tone({ t: t + 0.16, type: 'triangle', f0: 330, f1: 660, dur: 0.18, vol: 0.12 });
  }

  pyro() {
    const t = this.now();
    this.noise({ t, dur: 0.7, type: 'lowpass', freq: 300, freq1: 2600, q: 0.5, vol: 0.32 });
    this.tone({ t, type: 'sine', f0: 70, f1: 35, dur: 0.6, vol: 0.4 });
  }

  pyroHiss() {
    this.noise({ dur: 0.25, type: 'highpass', freq: 5000, vol: 0.05 });
  }

  bounce() {
    const t = this.now();
    this.tone({ t, type: 'sine', f0: 180, f1: 560, dur: 0.18, vol: 0.25 });
    this.tone({ t, type: 'triangle', f0: 90, f1: 220, dur: 0.2, vol: 0.18 });
  }

  bump() {
    this.noise({ dur: 0.07, type: 'lowpass', freq: 700, vol: 0.18 });
  }

  shockwave() {
    const t = this.now();
    this.tone({ t, type: 'sine', f0: 95, f1: 30, dur: 0.6, vol: 0.6 });
    this.noise({ t, dur: 0.5, type: 'lowpass', freq: 700, freq1: 100, vol: 0.4 });
    this.guitar(t, 28, 0.6, { chord: true, vel: 1.2, out: this.gtrSfx.input });
  }

  feedback() {
    this.tone({ type: 'sine', f0: 1700, f1: 2300, dur: 0.18, vol: 0.05 });
  }

  laserCharge() {
    this.tone({ type: 'sawtooth', f0: 200, f1: 1100, dur: 0.4, vol: 0.04 });
  }

  laser() {
    const t = this.now();
    this.tone({ t, type: 'sawtooth', f0: 1300, f1: 140, dur: 0.38, vol: 0.12 });
    this.tone({ t, type: 'square', f0: 650, f1: 70, dur: 0.38, vol: 0.06 });
  }

  zap() {
    this.noise({ dur: 0.35, type: 'bandpass', freq: 3000, q: 4, vol: 0.18 });
    this.tone({ type: 'square', f0: 60, f1: 55, dur: 0.35, vol: 0.08 });
  }

  deflect() {
    this.tone({ type: 'triangle', f0: 2200, f1: 1600, dur: 0.08, vol: 0.09 });
  }

  checkpoint() {
    const t = this.now();
    [64, 67, 71, 76].forEach((n, i) => this.tone({ t: t + i * 0.07, type: 'square', f0: midiHz(n + 12), dur: 0.1, vol: 0.06 }));
  }

  charged() {
    this.tone({ type: 'square', f0: 880, f1: 1760, dur: 0.1, vol: 0.05 });
  }

  solo(root = 40) {
    const t = this.now();
    this.guitar(t, root, 1.2, { chord: true, vel: 1.4, out: this.gtrSfx.input });
    this.tone({ t: t + 0.1, type: 'sawtooth', f0: 1200, f1: 2600, dur: 0.6, vol: 0.06 });
    this.noise({ t, dur: 1.2, type: 'highpass', freq: 3500, vol: 0.2 });
  }

  countdown(go = false) {
    this.tone({ type: 'square', f0: go ? 880 : 440, dur: go ? 0.35 : 0.15, vol: 0.08 });
  }

  menu() {
    this.tone({ type: 'square', f0: 660, f1: 990, dur: 0.07, vol: 0.06 });
  }
}

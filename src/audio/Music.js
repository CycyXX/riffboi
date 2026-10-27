// Lookahead step sequencer + the beat clock that drives all gameplay timing.
import { BPM, BEAT_WINDOW } from '../config.js';

// Riff notation: one token per 16th note.
//   lowercase  = palm-muted single note   (e, f#, bb ...)
//   Uppercase5 = ringing power chord      (E5, G5, Bb5 ...)
//   -          = let the previous note ring
//   .          = rest
const NOTE = {
  c: 36, 'c#': 37, db: 37, d: 38, 'd#': 39, eb: 39, e: 40, f: 41, 'f#': 42, gb: 42,
  g: 43, 'g#': 44, ab: 44, a: 45, 'a#': 46, bb: 46, b: 47,
};

function parseRiff(str) {
  const toks = str.trim().split(/\s+/);
  const out = new Array(toks.length).fill(null);
  for (let i = 0; i < toks.length; i++) {
    const m = /^([A-Ga-g])([#b]?)(5?)$/.exec(toks[i]);
    if (!m) continue;
    let len = 1;
    while (toks[i + len] === '-') len++;
    out[i] = {
      n: NOTE[(m[1] + m[2]).toLowerCase()],
      mute: m[1] === m[1].toLowerCase(),
      chord: m[3] === '5',
      len,
    };
  }
  return out;
}

const SONGS = {
  main: parseRiff(`
    e e . e  e . G5 -  e e . e  Bb5 - A5 -
    e e . e  e . G5 -  A5 - G5 -  F5 - - -`),
  pit: parseRiff(`
    e . e .  E5 - - -  e e e e  G5 - F#5 -
    e . e .  E5 - - -  e e e e  Bb5 - A5 -`),
  pyro: parseRiff(`
    E5 - - -  e e e .  G5 - - -  e e e .
    A5 - - -  e e e .  Bb5 - A5 -  G5 - F#5 -`),
  wod: parseRiff(`
    e . e e  e . e e  G5 . g g  A5 . a a
    e . e e  e . e e  Bb5 - - -  B5 - - -`),
  boss: parseRiff(`
    e e F5 e  e F#5 e e  G5 - e F#5  - F5 - e
    e e F5 e  e F#5 e e  Bb5 - A5 -  G5 - F#5 -`),
  silent: parseRiff('. . . . . . . . . . . . . . . .'),
};

const DRUMS = {
  1: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', kv: 0.8, sv: 0.3, hv: 0.45 },
  2: { k: 'x.....x.x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', kv: 0.9, sv: 0.85, hv: 0.6 },
  3: { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', h: 'x...x...x...x...', kv: 0.85, sv: 0.95, hv: 0.7 },
  4: { k: 'xxxxxxxxxxxxxxxx', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', kv: 0.65, sv: 1, hv: 0.6 },
  // "stomp stomp clap" encore chant
  5: { k: 'x.x.....x.x.....', s: '................', h: '................', c: '....x.......x...', kv: 1, sv: 0, hv: 0 },
};

const LEAD_SCALE = [64, 67, 69, 71, 74, 76, 79, 81, 83, 86, 88];

export default class Music {
  constructor(synth) {
    this.s = synth;
    this.ctx = synth.ok ? synth.ctx : null;
    this.beatDur = 60 / BPM;
    this.stepDur = this.beatDur / 4;
    this.playing = false;
    this.startTime = 0;
    this.cfg = { song: 'main', drums: 0, bass: false, rhythm: false, lead: false };
    this.pending = null;
    this.riffPos = 0;
    this.riffBase = 0; // step at which the current riff started (riffPos = step - riffBase)
    this.soloStabs = false;
    this.leadIdx = 4;
    this.leadHold = 0;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  // The time the listener is hearing right now (compensates output latency).
  heard() {
    if (!this.ctx) return this.now();
    const lat = this.ctx.outputLatency || this.ctx.baseLatency || 0;
    return this.ctx.currentTime - lat;
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.startTime = this.now() + 0.1;
    this.nextStepTime = this.startTime;
    this.step = 0;
    if (this.ctx) this.timer = setInterval(() => this.schedule(), 25);
  }

  setConfig(cfg) {
    const next = { ...this.cfg, ...(this.pending || {}), ...cfg };
    if (!this.playing) {
      this.cfg = next;
      return;
    }
    this.pending = next;
  }

  setLead(on) {
    this.cfg.lead = on;
    if (this.pending) this.pending.lead = on;
  }

  // ---------- beat clock ----------
  beatPos() {
    return (this.heard() - this.startTime) / this.beatDur;
  }

  beat() {
    return Math.floor(this.beatPos());
  }

  phase() {
    const p = this.beatPos();
    return p - Math.floor(p);
  }

  // Seconds from the nearest beat (negative = early).
  beatOffset() {
    const p = this.beatPos();
    return (p - Math.round(p)) * this.beatDur;
  }

  isOnBeat(win = BEAT_WINDOW) {
    return this.playing && Math.abs(this.beatOffset()) <= win;
  }

  // ---------- harmony for player sounds ----------
  // Root note of the chord the band is playing at audio-context time `t`.
  harmonyAt(t = this.now()) {
    const riff = SONGS[this.cfg.song] || SONGS.main;
    const step = Math.floor((t - this.startTime) / this.stepDur + 1e-4);
    const len = riff.length;
    let i = ((step - this.riffBase) % len + len) % len;
    for (let k = 0; k < len; k++, i = (i - 1 + len) % len) {
      if (riff[i]) return riff[i].n;
    }
    return 40; // silent song: stay on E
  }

  // When a player sound should play: on-beat hits pressed slightly early wait for the beat,
  // so they land exactly on it. Everything else plays immediately.
  soundTime(onBeat) {
    const now = this.now();
    if (!onBeat || !this.ctx) return now;
    const beatT = this.startTime + Math.round(this.beatPos()) * this.beatDur;
    return Math.max(now, beatT);
  }

  setSoloStabs(on) {
    this.soloStabs = on;
  }

  // ---------- sequencer ----------
  schedule() {
    const now = this.ctx.currentTime;
    // If we fell far behind (tab was hidden), skip ahead instead of bursting.
    if (this.nextStepTime < now - 0.1) {
      const skip = Math.ceil((now - this.nextStepTime) / this.stepDur);
      this.nextStepTime += skip * this.stepDur;
      this.step += skip;
      this.riffPos += skip;
    }
    while (this.nextStepTime < now + 0.12) {
      this.playStep(this.step, this.nextStepTime);
      this.nextStepTime += this.stepDur;
      this.step++;
      this.riffPos++;
    }
  }

  playStep(step, t) {
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    let crashNow = false;

    if (s16 === 0 && this.pending) {
      const songChanged = this.pending.song !== this.cfg.song;
      const intensityUp = this.pending.drums > this.cfg.drums;
      this.cfg = this.pending;
      this.pending = null;
      if (songChanged) {
        this.riffPos = 0;
        this.riffBase = step;
      }
      if (songChanged || intensityUp) crashNow = true;
    }
    const c = this.cfg;
    const s = this.s;

    // Drums
    const d = DRUMS[c.drums];
    if (d) {
      const fill = this.pending && c.drums >= 2 && s16 >= 12;
      if (d.k[s16] === 'x') s.kick(t, d.kv);
      if (fill) s.snare(t, 0.6 + (s16 - 12) * 0.12);
      else if (d.s[s16] === 'x') s.snare(t, d.sv);
      if (d.h[s16] === 'x') s.hat(t, d.hv, c.drums >= 3 && s16 % 8 === 0);
      if (d.c && d.c[s16] === 'x') s.clap(t, 1);
      if (s16 === 0 && (crashNow || (c.drums >= 3 && bar % 4 === 0))) s.crash(t, 0.9);
    }

    // Rhythm guitar + bass
    const riff = SONGS[c.song] || SONGS.main;
    const ev = riff[this.riffPos % riff.length];
    if (ev) {
      const dur = ev.len * this.stepDur;
      if (c.rhythm) s.guitar(t, ev.n, dur, { mute: ev.mute, chord: ev.chord });
      if (c.bass) s.bass(t, ev.n - 12, dur);
    }

    // Solo mode: the player's auto-fire stabs are sequenced here, so they sit exactly on the 8ths.
    if (this.soloStabs && s16 % 2 === 0) s.riffStab(t, this.harmonyAt(t), s16 % 4 === 0, 0.7);

    // Procedural shred lead (solo mode / boss)
    if (c.lead) {
      if (this.leadHold > 0) {
        this.leadHold--;
      } else {
        let len = Math.random() < 0.7 ? 1 : 2;
        if (s16 === 0) {
          // land on a root/fifth at the start of each bar
          this.leadIdx = [0, 2, 5, 7][(Math.random() * 4) | 0];
          len = 4;
        } else {
          const r = Math.random();
          const stepBy = r < 0.45 ? 1 : r < 0.85 ? -1 : r < 0.92 ? 2 : -2;
          this.leadIdx = Math.max(0, Math.min(LEAD_SCALE.length - 1, this.leadIdx + stepBy));
        }
        s.lead(t, LEAD_SCALE[this.leadIdx], len * this.stepDur);
        this.leadHold = len - 1;
      }
    }
  }
}

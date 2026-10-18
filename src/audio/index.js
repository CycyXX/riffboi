// Shared audio singleton. Created on the first user gesture (browser autoplay rules).
import Synth from './Synth.js';
import Music from './Music.js';

// Stands in for Synth when Web Audio is unavailable: every method is a no-op.
const silentSynth = new Proxy(
  { ok: false, ctx: null },
  { get: (o, k) => (k in o ? o[k] : () => {}) },
);

export const audio = {
  synth: silentSynth,
  music: new Music(silentSynth),
  started: false,

  init() {
    if (this.started) return;
    this.started = true;
    let synth;
    try {
      synth = new Synth();
    } catch (e) {
      console.warn('Web Audio unavailable, running silent', e);
    }
    if (synth && synth.ok) {
      synth.resume();
      const prevCfg = this.music.cfg;
      this.synth = synth;
      this.music = new Music(synth);
      this.music.cfg = prevCfg;
    }
    this.music.start();

    document.addEventListener('visibilitychange', () => {
      if (!this.synth.ctx) return;
      if (document.hidden) this.synth.ctx.suspend();
      else this.synth.ctx.resume();
    });
  },

  toggleMute() {
    this.synth.toggleMute();
  },
};

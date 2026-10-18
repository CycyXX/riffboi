import Phaser from 'phaser';
import { GAME_W, GAME_H, DEPTH } from '../config.js';
import { audio } from '../audio/index.js';
import Backdrop from '../gfx/Backdrop.js';
import { text } from '../ui.js';
import { isTouch } from '../touch.js';

const RANKS = [
  [40000, 'ROCK GOD', 0xffd040],
  [26000, 'HEADLINER', 0xff60ff],
  [16000, 'OPENING ACT', 0x55fff0],
  [8000, 'BAR BAND', 0x40ff80],
  [0, 'GARAGE BAND', 0xbbbbbb],
];

export default class VictoryScene extends Phaser.Scene {
  constructor() {
    super('Victory');
  }

  init(data) {
    this.stats = (data && data.stats) || { score: 0 };
  }

  create() {
    this.backdrop = new Backdrop(this);
    audio.music.setConfig({ song: 'silent', drums: 5, bass: false, rhythm: false, lead: false });
    audio.synth.setCrowd(0.5);
    audio.synth.cheer(1, 4);

    const s = this.stats;
    const secs = Math.round((s.time || 0) / 1000);
    const timeBonus = Math.max(0, 6000 - secs * 15);
    const accuracy = s.actions ? Math.round((s.onBeat / s.actions) * 100) : 0;
    const total = s.score + timeBonus + accuracy * 50;
    const rank = RANKS.find((r) => total >= r[0]);

    this.add.rectangle(GAME_W / 2, 64, 280, 140, 0x07040c, 0.82).setOrigin(0.5, 0).setStrokeStyle(1, 0xffd040).setDepth(DEPTH.ui - 1);
    text(this, GAME_W / 2, 36, 'ENCORE!!!', 32, 0xffd040).setOrigin(0.5).setDepth(DEPTH.ui);
    const lines = [
      ['SCORE', s.score],
      ['TIME', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}  (+${timeBonus})`],
      ['ON-BEAT ACCURACY', `${accuracy}%  (+${accuracy * 50})`],
      ['MAX COMBO', s.maxCombo || 0],
      ['ENEMIES ROCKED', s.kills || 0],
      ['TIMES BOOED OFF', s.deaths || 0],
    ];
    lines.forEach(([k, v], i) => {
      const y = 70 + i * 13;
      this.time.delayedCall(300 + i * 250, () => {
        text(this, 120, y, k, 8, 0x9ff6ff).setDepth(DEPTH.ui);
        text(this, GAME_W - 120, y, String(v), 8, 0xffffff).setOrigin(1, 0).setDepth(DEPTH.ui);
        audio.synth.menu();
      });
    });
    this.time.delayedCall(300 + lines.length * 250 + 300, () => {
      text(this, GAME_W / 2, 160, `TOTAL ${total}`, 16, 0xffffff).setOrigin(0.5).setDepth(DEPTH.ui);
      const r = text(this, GAME_W / 2, 186, `RANK: ${rank[1]}`, 16, rank[2]).setOrigin(0.5).setDepth(DEPTH.ui).setScale(0.1);
      this.tweens.add({ targets: r, scale: 1, duration: 400, ease: 'Back.easeOut' });
      audio.synth.cheer(1, 3);
      audio.synth.solo();
      this.ready = true;
    });
    this.hint = text(this, GAME_W / 2, 216, isTouch ? 'TAP TO PLAY AGAIN' : 'ENTER: PLAY AGAIN', 8, 0xffd040).setOrigin(0.5).setDepth(DEPTH.ui).setAlpha(0);

    this.hero = this.add.sprite(GAME_W / 2, GAME_H - 6, 'riffboi', 'stand_s').setOrigin(0.5, 1).setScale(2).setDepth(DEPTH.player);
    this.confetti = this.add.particles(0, 0, 'pixel', {
      x: { min: 0, max: GAME_W },
      y: -5,
      speedY: { min: 40, max: 110 },
      speedX: { min: -30, max: 30 },
      lifespan: 4000,
      scale: 0.6,
      tint: [0xff3355, 0x33aaff, 0xffd040, 0x40ff80, 0xff60ff],
      frequency: 40,
    }).setDepth(DEPTH.fx);
    this.lastBeat = audio.music.beat();
    this.keys = this.input.keyboard.addKeys('ENTER,SPACE');
    this.tapped = false;
    this.input.on('pointerup', () => {
      if (this.ready) this.tapped = true;
    });
    this.cameras.main.fadeIn(600);
  }

  update(time) {
    this.backdrop.update(time);
    const b = audio.music.beat();
    if (b !== this.lastBeat) {
      this.lastBeat = b;
      this.backdrop.onBeat(b);
      this.hero.setFrame(b % 2 ? 'jump_s' : 'stand_s');
    }
    if (this.ready) {
      this.hint.setAlpha(Math.floor(time / 400) % 2 ? 1 : 0.4);
      const JD = Phaser.Input.Keyboard.JustDown;
      if (JD(this.keys.ENTER) || JD(this.keys.SPACE) || this.tapped) this.scene.start('Title');
    }
  }
}

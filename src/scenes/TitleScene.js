import Phaser from 'phaser';
import { GAME_W, GAME_H, DEPTH } from '../config.js';
import { audio } from '../audio/index.js';
import Backdrop from '../gfx/Backdrop.js';
import { text } from '../ui.js';
import { isTouch } from '../touch.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.backdrop = new Backdrop(this);
    audio.music.setConfig({ song: 'main', drums: 2, bass: true, rhythm: true, lead: false });
    audio.music.setSoloStabs(false);
    audio.synth.setCrowd(0.12);

    // stage floor strip
    this.add.tileSprite(0, GAME_H - 30, GAME_W, 16, 'tiles', 0).setOrigin(0);
    this.add.tileSprite(0, GAME_H - 14, GAME_W, 14, 'tiles', 1).setOrigin(0);

    this.flames = this.add.particles(0, 0, 'flame', {
      x: { min: 120, max: 360 },
      y: 108,
      speedY: { min: -90, max: -40 },
      speedX: { min: -10, max: 10 },
      lifespan: 700,
      scale: { start: 1.6, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xffd040, 0xff7020, 0xff3010],
      blendMode: 'ADD',
      frequency: 25,
    }).setDepth(DEPTH.fx - 1);

    this.logo = text(this, GAME_W / 2, 72, 'RIFFBOI', 48).setOrigin(0.5).setDepth(DEPTH.fx);
    this.logo.setTint(0xfff080, 0xfff080, 0xff3020, 0xff3020);
    text(this, GAME_W / 2, 112, "A ROCK 'N' METAL JUMP'N'RUN", 8, 0xff9cff).setOrigin(0.5).setDepth(DEPTH.fx);

    this.hero = this.add.sprite(GAME_W / 2, GAME_H - 54, 'riffboi', 'stand').setScale(2).setDepth(DEPTH.player);
    this.crowd = [];
    for (let i = 0; i < 12; i++) {
      const v = i % 6;
      const c = this.add.image(20 + i * 40 + (i % 2) * 8, GAME_H, 'crowd', `c${v}_0`).setOrigin(0.5, 1).setDepth(DEPTH.fx + 1).setTint(0x8a7a9a);
      c.v = v;
      this.crowd.push(c);
    }

    const lines = isTouch
      ? ['TAP TO START THE SHOW', 'HOLD RIFF + RELEASE = POWER CHORD', '- HIT ON THE BEAT! -']
      : [
          'PRESS ENTER OR SPACE TO START THE SHOW',
          'MOVE: ARROWS/WASD   JUMP: SPACE   RIFF: X/J (HOLD = POWER CHORD)',
          'SOLO: C/K   PAUSE: ESC   MUTE: M   - HIT ON THE BEAT! -',
        ];
    this.startT = text(this, GAME_W / 2, 150, lines[0], 8, 0xffffff).setOrigin(0.5).setDepth(DEPTH.fx);
    text(this, GAME_W / 2, 168, lines[1], 8, 0x9ff6ff).setOrigin(0.5).setDepth(DEPTH.fx);
    text(this, GAME_W / 2, 180, lines[2], 8, 0x9ff6ff).setOrigin(0.5).setDepth(DEPTH.fx);

    this.lastBeat = audio.music.beat();
    this.keys = this.input.keyboard.addKeys('ENTER,SPACE');
    this.leaving = false;
    this.tapped = false;
    const openedAt = this.game.loop.time;
    this.input.on('pointerup', () => {
      if (this.game.loop.time - openedAt > 600) this.tapped = true;
    });
    this.cameras.main.fadeIn(500);
  }

  update(time) {
    this.backdrop.update(time);
    const b = audio.music.beat();
    if (b !== this.lastBeat) {
      this.lastBeat = b;
      this.backdrop.onBeat(b);
      this.logo.setScale(1.06);
      this.tweens.add({ targets: this.logo, scale: 1, duration: 200 });
      this.startT.setVisible(b % 2 === 0);
      this.crowd.forEach((c) => c.setFrame(`c${c.v}_${Math.random() < 0.5 ? 1 : 0}`));
    }
    const ph = audio.music.phase();
    this.hero.setFrame(ph < 0.3 ? 'standb' : 'stand');

    const pad = this.input.gamepad && this.input.gamepad.total ? this.input.gamepad.pad1 : null;
    const JD = Phaser.Input.Keyboard.JustDown;
    if (!this.leaving && (JD(this.keys.ENTER) || JD(this.keys.SPACE) || (pad && pad.A) || this.tapped)) {
      this.leaving = true;
      audio.synth.menu();
      audio.synth.cheer(1, 2);
      this.hero.setFrame('jump_s');
      this.cameras.main.fadeOut(500);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
    }
  }
}

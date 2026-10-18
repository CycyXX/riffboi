import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';
import { audio } from '../audio/index.js';
import { text } from '../ui.js';
import { isTouch } from '../touch.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.data_ = data || {};
  }

  create() {
    audio.music.setConfig({ song: 'silent', drums: 1, bass: false, rhythm: false, lead: false });
    audio.synth.setCrowd(0.02);
    this.cameras.main.setBackgroundColor('#0a0006');
    text(this, GAME_W / 2, 70, 'BOOED OFF STAGE', 24, 0xff3030).setOrigin(0.5);
    const s = this.data_.stats || { score: 0 };
    text(this, GAME_W / 2, 105, `SCORE ${s.score}`, 8, 0xffffff).setOrigin(0.5);
    text(this, GAME_W / 2, 150, isTouch ? '[ ENCORE FROM LAST CHECKPOINT ]' : 'ENTER: ENCORE FROM LAST CHECKPOINT (SCORE HALVED)', 8, 0xffd040).setOrigin(0.5);
    text(this, GAME_W / 2, 168, isTouch ? '[ BACK TO TITLE ]' : 'ESC: BACK TO TITLE', 8, 0x9ff6ff).setOrigin(0.5);
    // Touch: top part of the screen = encore, lower part = title. Ignore taps from the death moment.
    this.tap = null;
    const openedAt = this.game.loop.time;
    this.input.on('pointerup', (p) => {
      if (this.game.loop.time - openedAt > 800) this.tap = p.y < 160 ? 'encore' : 'title';
    });
    const tomato = this.add.image(GAME_W / 2, GAME_H - 40, 'riffboi', 'fall').setScale(2).setAngle(90).setTint(0xaa6666);
    this.tweens.add({ targets: tomato, y: tomato.y + 2, duration: 600, yoyo: true, repeat: -1 });
    this.keys = this.input.keyboard.addKeys('ENTER,SPACE,ESC');
    this.cameras.main.fadeIn(400);
  }

  update() {
    const JD = Phaser.Input.Keyboard.JustDown;
    const s = this.data_.stats || {};
    if (JD(this.keys.ENTER) || JD(this.keys.SPACE) || this.tap === 'encore') {
      audio.synth.menu();
      this.scene.start('Game', {
        checkpoint: this.data_.checkpoint,
        stats: { ...s, score: Math.floor((s.score || 0) / 2) },
      });
    } else if (JD(this.keys.ESC) || this.tap === 'title') {
      this.scene.start('Title');
    }
  }
}

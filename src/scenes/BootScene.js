import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';
import { generateTextures } from '../gfx/TextureFactory.js';
import { audio } from '../audio/index.js';
import { text } from '../ui.js';
import { isTouch } from '../touch.js';

// Generates all textures, then waits for a click/key (needed to unlock browser audio).
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    generateTextures(this);
    const t = text(this, GAME_W / 2, GAME_H / 2, isTouch ? 'TAP TO ROCK ^' : 'CLICK OR PRESS ANY KEY TO ROCK ^', 8, 0xffd040).setOrigin(0.5);
    this.tweens.add({ targets: t, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    text(this, GAME_W / 2, GAME_H / 2 + 20, '(TURN YOUR SOUND UP)', 8, 0x886688).setOrigin(0.5);

    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      audio.init();
      this.scene.start('Title');
    };
    this.input.once('pointerdown', go);
    this.input.keyboard.once('keydown', go);
    if (new URLSearchParams(location.search).has('autostart')) go();
  }
}

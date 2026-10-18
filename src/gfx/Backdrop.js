// Parallax club background: brick wall, lighting truss, sweeping spotlights, crowd silhouettes.
import Phaser from 'phaser';
import { GAME_W, GAME_H, DEPTH } from '../config.js';

const LIGHT_COLORS = [0xff3355, 0x33aaff, 0xffaa22, 0xaa44ff, 0x44ff99, 0xffffff];

export default class Backdrop {
  constructor(scene, { crowd = true } = {}) {
    this.scene = scene;
    this.wall = scene.add.tileSprite(0, 0, GAME_W, GAME_H, 'bgWall').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg);
    this.beams = [];
    for (let i = 0; i < 6; i++) {
      const b = scene.add.image(0, 30, 'beam').setOrigin(0.5, 0).setScrollFactor(0)
        .setDepth(DEPTH.lights).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.13);
      this.beams.push(b);
    }
    this.truss = scene.add.tileSprite(0, 0, GAME_W, 36, 'truss').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.lights + 1);
    if (crowd) {
      this.crowdY = GAME_H - 78;
      this.crowd = scene.add.tileSprite(0, this.crowdY, GAME_W, 48, 'crowdSil').setOrigin(0).setScrollFactor(0)
        .setDepth(DEPTH.crowdBg).setAlpha(0.9);
    }
    this.colorIdx = 0;
    this.applyColors();
  }

  applyColors() {
    this.beams.forEach((b, i) => b.setTint(LIGHT_COLORS[(this.colorIdx + i) % LIGHT_COLORS.length]));
  }

  update(time) {
    const sx = this.scene.cameras.main.scrollX;
    this.wall.tilePositionX = sx * 0.2;
    const tx = sx * 0.45;
    this.truss.tilePositionX = tx;
    if (this.crowd) this.crowd.tilePositionX = sx * 0.6;
    const off = ((tx % 96) + 96) % 96;
    this.beams.forEach((b, i) => {
      b.x = 48 + i * 96 - off;
      b.rotation = Math.sin(time * 0.0007 + i * 1.7) * 0.55;
    });
  }

  onBeat(beat) {
    if (beat % 4 === 0) {
      this.colorIdx++;
      this.applyColors();
    }
    const strong = beat % 2 === 0;
    this.beams.forEach((b) => {
      b.setAlpha(strong ? 0.26 : 0.19);
      this.scene.tweens.add({ targets: b, alpha: 0.12, duration: 380, ease: 'Quad.easeOut' });
    });
    if (this.crowd) {
      this.crowd.y = this.crowdY - 3;
      this.scene.tweens.add({ targets: this.crowd, y: this.crowdY, duration: 240, ease: 'Quad.easeOut' });
    }
  }
}

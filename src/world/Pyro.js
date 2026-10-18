import Phaser from 'phaser';
import { DEPTH, BEAT_SEC } from '../config.js';
import { audio } from '../audio/index.js';

// Pyro jet: telegraphs one beat early, erupts on every 4th beat (shifted by `offset`).
// Hurts anyone standing in it — but launches you sky-high if you're airborne.
export default class Pyro {
  constructor(scene, x, groundY, offset = 0) {
    this.scene = scene;
    this.x = x;
    this.groundY = groundY;
    this.offset = offset;
    this.height = 88;
    this.activeT = 0;
    this.base = scene.add.image(x, groundY, 'pyroBase').setOrigin(0.5, 1).setDepth(DEPTH.props);
    this.rect = new Phaser.Geom.Rectangle(x - 7, groundY - this.height, 14, this.height);
    this.flame = scene.add.particles(x, groundY - 4, 'flame', {
      speedY: { min: -420, max: -280 },
      speedX: { min: -22, max: 22 },
      lifespan: { min: 230, max: 380 },
      scale: { start: 1.8, end: 0.3 },
      alpha: { start: 0.7, end: 0 },
      tint: [0xffe080, 0xffa030, 0xff6a10, 0xff3a08],
      blendMode: 'ADD',
      frequency: 12,
      quantity: 2,
      emitting: false,
    }).setDepth(DEPTH.fx);
    this.glow = scene.add.image(x, groundY - 40, 'glow').setScale(2.4, 3).setTint(0xff8a30)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(DEPTH.fx - 1);
  }

  onScreen() {
    const v = this.scene.cameras.main.worldView;
    return this.x > v.x - 20 && this.x < v.right + 20;
  }

  onBeat(beat) {
    const b = (((beat + this.offset) % 4) + 4) % 4;
    if (b === 3) {
      this.scene.burst('spark', this.x, this.groundY - 4, 6);
      this.base.setTint(0xffaa55);
      this.scene.time.delayedCall(120, () => this.base.clearTint());
      if (this.onScreen()) audio.synth.pyroHiss();
    } else if (b === 0) {
      this.erupt();
    }
  }

  erupt() {
    this.activeT = BEAT_SEC * 1000 * 0.8;
    this.flame.start();
    this.glow.setAlpha(0.55);
    this.scene.tweens.add({ targets: this.glow, alpha: 0, duration: this.activeT + 150 });
    if (this.onScreen()) {
      audio.synth.pyro();
      this.scene.cameras.main.shake(90, 0.003);
    }
  }

  update(dt) {
    if (this.activeT <= 0) return;
    this.activeT -= dt;
    if (this.activeT <= 0) {
      this.flame.stop();
      return;
    }
    const s = this.scene;
    const p = s.player;
    if (!p.dead) {
      const pb = p.body;
      const pr = new Phaser.Geom.Rectangle(pb.x, pb.y, pb.width, pb.height);
      if (Phaser.Geom.Intersects.RectangleToRectangle(pr, this.rect)) {
        if (!p.onGround) p.pyroBoost();
        else p.hurt(1, this.x);
      }
    }
    for (const e of s.enemies.getChildren()) {
      if (!e.active || e.dead || !e.awake || e.pyroCd > s.time.now) continue;
      if (Phaser.Geom.Rectangle.Contains(this.rect, e.x, e.y)) {
        e.pyroCd = s.time.now + 500;
        e.hurt(2, this.x, { knock: 120 });
      }
    }
  }
}

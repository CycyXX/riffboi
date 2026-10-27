import Phaser from 'phaser';
import { DEPTH } from '../config.js';

// Generic projectile (player riffs, enemy notes, thrown cables).
export default class Shot extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, group, x, y, key, o = {}) {
    super(scene, x, y, key);
    scene.add.existing(this);
    group.add(this); // creates the body with group defaults — configure it afterwards
    this.body.setAllowGravity(!!o.gravity);
    if (o.w) this.body.setSize(o.w, o.h || o.w);
    this.setVelocity(o.vx || 0, o.vy || 0);
    this.damage = o.damage ?? 1;
    this.pierce = !!o.pierce;
    this.power = !!o.power;
    this.onBeat = !!o.onBeat;
    this.life = this.maxLife = o.life ?? 800;
    this.spin = o.spin || 0;
    this.grow = o.grow || 0;
    this.hitSet = new Set();
    this.owner = o.owner || null; // enemy that fired it (stomp fairness)
    this.born = scene.time.now;
    this.setDepth(DEPTH.shots);
    if (o.tint) this.setTint(o.tint);
    if (o.flipX) this.setFlipX(true);
    if (o.blend) this.setBlendMode(o.blend);
  }

  update(time, delta) {
    this.life -= delta;
    if (this.spin) this.angle += (this.spin * delta) / 1000;
    if (this.grow) this.setScale(1 + (1 - this.life / this.maxLife) * this.grow);
    if (this.life < 120) this.setAlpha(Math.max(0, this.life / 120));
    if (this.life <= 0) this.destroy();
  }
}

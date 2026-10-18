import Phaser from 'phaser';
import Enemy from './Enemy.js';

// Flying speaker-bat: hovers in a figure-8 and dive-bombs on the downbeat.
export default class FeedbackBat extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y - 8, 'bat', 'bat0', { hp: 1, score: 150 });
    this.body.setAllowGravity(false);
    this.body.setSize(14, 10);
    this.noTileCollide = true;
    this.home = { x: this.x, y: this.y };
    this.t = Math.random() * 6;
    this.state = 'hover';
    this.diveT = 0;
  }

  update(time, dt) {
    if (!super.update(time, dt)) {
      if (this.body) this.body.setVelocity(0, 0);
      return;
    }
    this.t += dt / 1000;
    this.setFrame(Math.floor(time / 90) % 2 ? 'bat1' : 'bat0');
    const b = this.body;
    if (this.state === 'hover') {
      const tx = this.home.x + Math.sin(this.t * 1.6) * 36;
      const ty = this.home.y + Math.sin(this.t * 3.2) * 10;
      b.setVelocity((tx - this.x) * 4, (ty - this.y) * 4);
    } else if (this.state === 'dive') {
      this.diveT -= dt;
      if (this.diveT <= 0) this.state = 'return';
    } else {
      const v = new Phaser.Math.Vector2(this.home.x - this.x, this.home.y - this.y);
      if (v.length() < 6) this.state = 'hover';
      else {
        v.normalize().scale(95);
        b.setVelocity(v.x, v.y);
      }
    }
    this.setFlipX(this.player.x < this.x);
  }

  onBeat(beat) {
    if (!this.canAct() || this.state !== 'hover' || beat % 4 !== 0) return;
    const p = this.player;
    const v = new Phaser.Math.Vector2(p.x - this.x, p.y - this.y);
    if (p.dead || v.length() > 170) return;
    this.state = 'dive';
    this.diveT = 650;
    v.normalize().scale(215);
    this.body.setVelocity(v.x, v.y);
  }
}

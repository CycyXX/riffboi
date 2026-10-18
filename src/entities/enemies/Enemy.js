import Phaser from 'phaser';
import { DEPTH } from '../../config.js';
import { audio } from '../../audio/index.js';

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, key, frame, cfg = {}) {
    super(scene, x, y, key, frame);
    scene.add.existing(this);
    scene.enemies.add(this); // creates the body; configure it afterwards
    this.hp = this.maxHp = cfg.hp ?? 2;
    this.score = cfg.score ?? 100;
    this.stompable = cfg.stompable ?? true;
    this.contactDamage = 1;
    this.flashT = 0;
    this.stunT = 0;
    this.knockT = 0;
    this.dead = false;
    this.awake = false;
    this.noTileCollide = false;
    this.setDepth(DEPTH.enemies);
  }

  get player() {
    return this.scene.player;
  }

  // Returns true when the subclass should run its AI this frame.
  update(time, dt) {
    if (this.dead) return false;
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.clearTint();
    }
    const view = this.scene.cameras.main.worldView;
    this.awake = this.x > view.x - 48 && this.x < view.right + 48;
    if (!this.awake) {
      if (this.body.allowGravity) this.body.setVelocityX(0);
      return false;
    }
    if (this.stunT > 0) {
      this.stunT -= dt;
      this.body.setVelocityX(0);
      if (Math.random() < 0.15) this.scene.burst('star', this.x, this.y - this.height / 2, 1);
      return false;
    }
    if (this.knockT > 0) {
      this.knockT -= dt;
      return false;
    }
    return true;
  }

  canAct() {
    return this.active && !this.dead && this.awake && this.stunT <= 0;
  }

  onBeat() {}

  hurt(dmg, srcX, o = {}) {
    if (this.dead) return 'dead';
    this.hp -= dmg;
    this.setTintFill(0xffffff);
    this.flashT = 80;
    if (o.knock && this.body.allowGravity) {
      this.body.setVelocity((Math.sign(this.x - srcX) || 1) * o.knock, -90);
      this.knockT = 180;
    }
    if (this.hp <= 0) {
      this.die();
      return 'kill';
    }
    audio.synth.enemyHit();
    return 'hit';
  }

  stun(ms) {
    if (this.dead) return;
    this.stunT = ms;
  }

  die() {
    this.dead = true;
    this.scene.onEnemyKilled(this);
    this.disableBody(true, true);
    this.scene.time.delayedCall(0, () => this.destroy());
  }

  // Is there floor ahead of us (so walkers don't fall off ledges)?
  floorAhead(dir) {
    return this.scene.solidAt(this.x + dir * (this.body.width / 2 + 3), this.body.bottom + 4);
  }
}

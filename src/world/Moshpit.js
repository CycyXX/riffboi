import Phaser from 'phaser';
import { DEPTH } from '../config.js';
import { audio } from '../audio/index.js';

// A moshpit body: jumps around on the beat and shoves the player (no damage).
export class Mosher extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, zone) {
    const v = Phaser.Math.Between(0, 5);
    super(scene, x, y - 11, 'crowd', `c${v}_0`);
    scene.add.existing(this);
    scene.moshers.add(this);
    this.v = v;
    this.zone = zone;
    this.body.setSize(10, 18).setOffset(1, 4);
    this.setDepth(DEPTH.enemies - 1);
    this.shoveCd = 0;
    this.hypeT = 0;
    this.setFlipX(Math.random() < 0.5);
  }

  update(time, dt) {
    this.shoveCd -= dt;
    this.hypeT -= dt;
    const b = this.body;
    if (this.x < this.zone[0] + 6) b.setVelocityX(Math.abs(b.velocity.x) + 30);
    else if (this.x > this.zone[1] - 6) b.setVelocityX(-Math.abs(b.velocity.x) - 30);
    if (b.blocked.down) {
      b.setVelocityX(b.velocity.x * 0.9);
      if (Math.random() < 0.015) b.setVelocityX(Phaser.Math.Between(-70, 70));
    }
    if (b.velocity.x) this.setFlipX(b.velocity.x < 0);
    const up = this.hypeT > 0 || !b.blocked.down;
    this.setFrame(`c${this.v}_${up ? 1 : 0}`);
  }

  onBeat(beat) {
    const v = this.scene.cameras.main.worldView;
    if (this.x < v.x - 40 || this.x > v.right + 40) return;
    const b = this.body;
    if (!b.blocked.down) return;
    const wild = beat % 4 === 0;
    if (wild || Math.random() < 0.35) {
      b.setVelocity(Phaser.Math.Between(-120, 120), -Phaser.Math.Between(wild ? 180 : 110, wild ? 280 : 200));
    }
  }

  shove(player) {
    if (this.shoveCd > 0 || player.soloActive || player.dead) return;
    this.shoveCd = 450;
    const dir = Math.sign(player.x - this.x) || 1;
    player.knock(dir * Phaser.Math.Between(150, 240), player.onGround ? -150 : -60, 220);
    this.body.setVelocityX(-dir * 70);
    audio.synth.bump();
    if (Math.random() < 0.3) this.scene.popup(player.x, player.y - 22, 'MOSH!', 0xff8040);
  }

  hype() {
    if (this.hypeT > 0) return;
    this.hypeT = 900;
    this.body.setVelocityY(-260);
    this.scene.addScore(25);
    this.scene.addShred(1);
    this.scene.burst('sweat', this.x, this.y - 8, 5);
    this.scene.popup(this.x, this.y - 20, '^', 0xffe040);
  }
}

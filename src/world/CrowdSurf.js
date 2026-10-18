import Phaser from 'phaser';
import { DEPTH, GRAVITY, PLAYER } from '../config.js';
import { audio } from '../audio/index.js';

const TOSS_VY = 330;

// A raised-hands platform. "toss" hands throw you to the next target,
// "hold" hands just let you stand (and jump off yourself).
export class SurfHands extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, o) {
    const key = o.w >= 6 ? 'hands8' : 'hands3';
    super(scene, x, y, key, 0);
    scene.add.existing(this);
    scene.surfs.add(this);
    this.setOrigin(0.5, 0.2);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.setSize(this.width - 6, 12).setOffset(3, 4);
    this.setDepth(DEPTH.props);
    this.to = o.to || null;
    this.hold = !!o.hold;
    this.f = 0;
  }

  onLand(player) {
    if (this.hold || !this.to || player.tossT > 0 || player.dead) return;
    const [tx, ty] = this.to;
    const g1 = GRAVITY;
    const g2 = GRAVITY + PLAYER.fallExtraGravity;
    const tUp = TOSS_VY / g1;
    const hUp = (TOSS_VY * TOSS_VY) / (2 * g1);
    const drop = Math.max(1, hUp + (ty - player.body.bottom));
    const T = tUp + Math.sqrt((2 * drop) / g2);
    player.toss((tx - player.x) / T, TOSS_VY);
    const s = this.scene;
    const onBeat = audio.music.isOnBeat(0.12);
    if (onBeat) s.onBeatMove(player.x, player.y - 22, 'SURF ON BEAT!');
    s.addScore(30);
    audio.synth.cheer(0.6, 1.2);
    this.setFrame(1);
    this.y += 2;
    s.tweens.add({ targets: this, y: this.y - 2, duration: 200 });
  }

  onBeat() {
    this.f ^= 1;
    this.setFrame(this.f);
  }
}

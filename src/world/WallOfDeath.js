import Phaser from 'phaser';
import { DEPTH } from '../config.js';
import { audio } from '../audio/index.js';

const ROUNDS = [
  { speed: 160, h: 22, surfer: false },
  { speed: 210, h: 22, surfer: false },
  { speed: 250, h: 40, surfer: true },
];

// Scripted event: the crowd splits and charges from both sides. Survive 3 rounds.
export default class WallOfDeath {
  constructor(scene, o) {
    this.scene = scene;
    this.trigger = o.x;
    this.left = o.left;
    this.right = o.right;
    this.groundY = o.y;
    this.state = scene.player.x > this.right ? 'done' : 'idle';
    this.round = 0;
    this.packs = [];
    this.beats = 0;
  }

  update(dt) {
    const s = this.scene;
    const p = s.player;
    if (this.state === 'idle') {
      if (p.x > this.trigger && !p.dead) this.start();
      return;
    }
    if (this.state !== 'charge') return;
    const sec = dt / 1000;
    for (const pk of this.packs) {
      pk.x += pk.dir * pk.speed * sec;
      pk.c.x = pk.x;
      if (!pk.hit && !p.dead) {
        const pb = p.body;
        const pr = new Phaser.Geom.Rectangle(pb.x, pb.y, pb.width, pb.height);
        const r = new Phaser.Geom.Rectangle(pk.x - 22, this.groundY - pk.h, 44, pk.h);
        if (Phaser.Geom.Intersects.RectangleToRectangle(pr, r)) {
          pk.hit = true;
          p.hurt(1, pk.x - pk.dir * 40);
          p.knock(pk.dir * 260, -240, 300);
        }
      }
      // shots get absorbed by the wall of bodies
      for (const shot of s.playerShots.getChildren().slice()) {
        if (shot.active && Math.abs(shot.x - pk.x) < 22 && shot.y > this.groundY - pk.h) {
          s.burst('sweat', shot.x, shot.y, 3);
          s.addScore(5);
          shot.destroy();
        }
      }
    }
    if (!this.crashed && this.packs.length === 2 && Math.abs(this.packs[0].x - this.packs[1].x) < 30) {
      this.crashed = true;
      s.cameras.main.shake(250, 0.012);
      audio.synth.stomp();
      audio.synth.cheer(1, 1.5);
      s.burst('sweat', this.packs[0].x, this.groundY - 20, 30);
      s.popup((this.packs[0].x + this.packs[1].x) / 2, this.groundY - 56, 'CRASH!!!', 0xff4040, 16);
    }
    const done = this.packs.every((pk) => (pk.dir > 0 ? pk.x > this.right + 40 : pk.x < this.left - 40));
    if (done) this.endRound();
  }

  start() {
    const s = this.scene;
    this.state = 'intro';
    this.beats = 0;
    s.lockArena(this.left, this.right);
    s.musicLocked = true;
    audio.music.setConfig({ song: 'wod', drums: 3, bass: true, rhythm: true });
    s.events.emit('banner', 'WALL OF DEATH!', 0xff3030);
    audio.synth.setCrowd(0.55);
    audio.synth.cheer(1, 2);
    s.popup((this.left + this.right) / 2, this.groundY - 90, 'SPLIT THE PIT!!!', 0xffffff, 8, 1500);
  }

  makePack(dir) {
    const s = this.scene;
    const R = ROUNDS[this.round];
    const x = dir > 0 ? this.left - 40 : this.right + 40;
    const c = s.add.container(x, this.groundY).setDepth(DEPTH.enemies + 1);
    for (let i = 0; i < 7; i++) {
      const v = Phaser.Math.Between(0, 5);
      const m = s.add.image(-20 + i * 6 + Phaser.Math.Between(-1, 1), Phaser.Math.Between(-1, 2), 'crowd', `c${v}_1`)
        .setOrigin(0.5, 1).setFlipX(dir < 0);
      c.add(m);
    }
    if (R.surfer) {
      const surfer = s.add.image(0, -20, 'crowd', `c${Phaser.Math.Between(0, 5)}_1`).setOrigin(0.5, 1).setAngle(dir * 90);
      c.add(surfer);
    }
    return { c, x, dir, speed: R.speed, h: R.h, hit: false };
  }

  onBeat(beat) {
    const s = this.scene;
    const mid = (this.left + this.right) / 2;
    if (this.state === 'intro') {
      this.beats++;
      if (this.beats >= 4) {
        this.state = 'countdown';
        this.count = 3;
      }
    } else if (this.state === 'countdown') {
      if (this.count > 0) {
        s.popup(mid, this.groundY - 110, String(this.count), 0xffe040, 32, 400);
        s.popup(this.left + 24, this.groundY - 40, '>>>', 0xff4040, 16, 400);
        s.popup(this.right - 24, this.groundY - 40, '<<<', 0xff4040, 16, 400);
        audio.synth.countdown(false);
        this.count--;
      } else {
        s.popup(mid, this.groundY - 110, 'GO!!!', 0xff4040, 32, 600);
        audio.synth.countdown(true);
        audio.synth.cheer(1, 2.5);
        if (this.round === 2) s.popup(mid, this.groundY - 80, 'CROWD SURFERS! JUMP!', 0xffffff, 8, 1200);
        this.packs = [this.makePack(1), this.makePack(-1)];
        this.crashed = false;
        this.state = 'charge';
      }
    } else if (this.state === 'rest') {
      this.beats--;
      if (this.beats <= 0) {
        this.state = 'countdown';
        this.count = 3;
      }
    }
    for (const pk of this.packs) {
      pk.c.y = this.groundY - 3;
      s.tweens.add({ targets: pk.c, y: this.groundY, duration: 150 });
    }
  }

  endRound() {
    this.packs.forEach((pk) => pk.c.destroy());
    this.packs = [];
    this.round++;
    if (this.round >= ROUNDS.length) {
      this.finish();
      return;
    }
    this.state = 'rest';
    this.beats = 2;
    this.scene.popup((this.left + this.right) / 2, this.groundY - 100, `ROUND ${this.round + 1}`, 0xffffff, 16, 700);
  }

  finish() {
    const s = this.scene;
    this.state = 'done';
    s.unlockArena();
    s.musicLocked = false;
    s.reapplySectionMusic();
    s.stats.score += 2000;
    s.events.emit('banner', 'SURVIVED! +2000', 0x40ff80);
    audio.synth.cheer(1, 3);
    s.addShred(30);
  }
}

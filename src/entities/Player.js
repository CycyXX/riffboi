import Phaser from 'phaser';
import { PLAYER as P, DEPTH, SHRED } from '../config.js';
import { audio } from '../audio/index.js';
import Shot from './Shot.js';

const approach = (v, target, a) => (v < target ? Math.min(v + a, target) : Math.max(v - a, target));

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'riffboi', 'stand');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.player);
    this.body.setSize(10, 20).setOffset(7, 4);
    this.setCollideWorldBounds(true);

    this.picks = P.maxPicks;
    this.facing = 1;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpsLeft = 1;
    this.wallCoyote = 0;
    this.lastWall = 0;
    this.knockT = 0;
    this.invulnT = 0;
    this.shotCd = 0;
    this.shootT = 0;
    this.boostCd = 0;
    this.stompGraceT = 0;
    this.dropT = 0;
    this.tossT = 0;
    this.tossed = false;
    this.tossVx = 0;
    this.charging = false;
    this.chargeT = 0;
    this.chargeReady = false;
    this.soloActive = false;
    this.soloBeats = 0;
    this.lastHalfBeat = -1;
    this.dead = false;
    this.jumpCut = false;
    this.runDist = 0;
    this.onGround = false;
    this.wasOnGround = true;
    this.airPeakY = y;

    this.chargeFx = scene.add.particles(0, 0, 'spark', {
      speed: { min: 20, max: 60 },
      lifespan: 260,
      scale: { start: 1, end: 0 },
      tint: [0xff60ff, 0x9ff6ff, 0xffffff],
      blendMode: 'ADD',
      frequency: 30,
      emitting: false,
    }).setDepth(DEPTH.fx);
    this.chargeFx.startFollow(this);
  }

  get music() {
    return audio.music;
  }

  update(time, dt) {
    const s = this.scene;
    const c = s.controls;
    const b = this.body;
    if (this.dead) return;
    const sec = dt / 1000;

    this.onGround = b.blocked.down || b.touching.down;
    this.invulnT -= dt;
    this.knockT -= dt;
    this.shotCd -= dt;
    this.shootT -= dt;
    this.boostCd -= dt;
    this.stompGraceT -= dt;
    this.dropT -= dt;
    this.tossT -= dt;

    if (this.invulnT > 0 && !this.soloActive) this.setAlpha(Math.floor(time / 60) % 2 ? 0.35 : 1);
    else this.setAlpha(1);

    if (this.onGround) {
      if (!this.wasOnGround) this.land();
      this.coyote = P.coyoteMs;
      this.jumpsLeft = 1;
      if (this.tossT <= 0) this.tossed = false;
    } else {
      this.coyote -= dt;
      this.airPeakY = Math.min(this.airPeakY, this.y);
    }

    // ---- horizontal movement
    const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    if (dir && this.knockT <= 0) this.facing = dir;
    let vx = b.velocity.x;
    if (this.tossed) {
      vx = this.tossVx + dir * 30;
    } else if (this.knockT <= 0) {
      const target = dir * P.runSpeed * (this.soloActive ? 1.15 : 1);
      let a;
      if (this.onGround) a = dir ? (vx !== 0 && Math.sign(vx) !== dir ? P.turnAccel : P.accelGround) : P.dragGround;
      else a = dir ? P.accelAir : P.dragAir;
      vx = approach(vx, target, a * sec);
    }
    b.setVelocityX(vx);

    // ---- walls
    const wall = !this.onGround ? (b.blocked.left ? -1 : b.blocked.right ? 1 : 0) : 0;
    if (wall) {
      this.wallCoyote = 110;
      this.lastWall = wall;
      this.tossed = false;
    } else {
      this.wallCoyote -= dt;
    }
    this.wallSliding = wall !== 0 && dir === wall && b.velocity.y > 0;

    // ---- jumping
    if (c.jumpPressed) this.jumpBuffer = P.bufferMs;
    else this.jumpBuffer -= dt;

    if (c.jumpPressed && c.down && this.onGround && s.oneWayBelow(this)) {
      this.dropT = 260;
      this.jumpBuffer = 0;
    }
    if (this.jumpBuffer > 0) {
      if (this.coyote > 0) this.jump('ground');
      else if (this.wallCoyote > 0) this.jump('wall');
      else if (this.jumpsLeft > 0) this.jump('double');
    }
    if (!c.jump && this.jumpCut && b.velocity.y < -120) {
      b.setVelocityY(b.velocity.y * 0.6);
      this.jumpCut = false;
    }
    if (b.velocity.y >= 0) this.jumpCut = false;

    b.setGravityY(b.velocity.y > 0 ? P.fallExtraGravity : 0);
    if (this.wallSliding) b.setVelocityY(Math.min(b.velocity.y, P.wallSlideSpeed));
    if (b.velocity.y > P.maxFall) b.setVelocityY(P.maxFall);
    b.checkCollision.down = this.dropT <= 0;

    this.handleAttack(dt);
    this.handleSolo(time);
    this.animate(dt);
    this.wasOnGround = this.onGround;
  }

  land() {
    const fall = this.y - this.airPeakY;
    if (fall > 40) {
      this.scene.dust(this.x, this.body.bottom);
      audio.synth.land();
    }
    this.airPeakY = this.y;
  }

  jump(kind) {
    const b = this.body;
    const onBeat = this.music.isOnBeat();
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.tossed = false;
    this.airPeakY = this.y;
    if (kind === 'ground') {
      b.setVelocityY(-(onBeat ? P.beatJumpVel : P.jumpVel));
      audio.synth.jump();
      this.scene.dust(this.x, b.bottom);
    } else if (kind === 'wall') {
      b.setVelocityY(-P.wallJumpVY);
      b.setVelocityX(-this.lastWall * P.wallJumpVX);
      this.knockT = 130;
      this.facing = -this.lastWall;
      this.wallCoyote = 0;
      this.jumpsLeft = 1;
      audio.synth.jump();
      this.scene.burst('spark', this.x + this.lastWall * 5, this.y, 5);
    } else {
      b.setVelocityY(-(onBeat ? P.beatDoubleJumpVel : P.doubleJumpVel));
      this.jumpsLeft--;
      audio.synth.doubleJump();
      this.kickflip();
      this.scene.burst('spark', this.x, b.bottom, 6);
    }
    this.jumpCut = true;
    if (onBeat) this.scene.onBeatMove(this.x, this.y - 20);
  }

  kickflip() {
    if (this.spinTween) this.spinTween.stop();
    this.angle = 0;
    this.spinTween = this.scene.tweens.add({
      targets: this,
      angle: this.facing * 360,
      duration: 330,
      ease: 'Cubic.easeOut',
      onComplete: () => (this.angle = 0),
      onStop: () => (this.angle = 0),
    });
  }

  // ---------------------------------------------------------------- attacks
  handleAttack(dt) {
    const c = this.scene.controls;
    if (this.soloActive) return;
    if (c.attackPressed) {
      if (this.shotCd <= 0) this.fireRiff(this.music.isOnBeat());
      this.charging = true;
      this.chargeT = 0;
      this.chargeReady = false;
    }
    if (!this.charging) return;
    if (c.attack) {
      this.chargeT += dt;
      if (this.chargeT > 160 && !this.chargeFx.emitting) this.chargeFx.start();
      if (!this.chargeReady && this.chargeT >= P.chargeMs) {
        this.chargeReady = true;
        audio.synth.charged();
        this.scene.burst('spark', this.x, this.y, 10);
      }
      if (this.chargeReady) this.setTint(Math.floor(this.chargeT / 70) % 2 ? 0xff9cff : 0xffffff);
    } else {
      if (this.chargeReady) this.firePowerChord(this.music.isOnBeat());
      this.cancelCharge();
    }
  }

  cancelCharge() {
    this.charging = false;
    this.chargeReady = false;
    this.chargeFx.stop();
    if (!this.soloActive) this.clearTint();
  }

  fireRiff(onBeat, auto = false) {
    const s = this.scene;
    this.shotCd = P.shotCooldown;
    this.shootT = 180;
    const x = this.x + this.facing * 13;
    const y = this.y + 1;
    new Shot(s, s.playerShots, x, y, 'riff', {
      vx: this.facing * 330,
      damage: onBeat ? 2 : 1,
      onBeat,
      life: 520,
      grow: 0.5,
      flipX: this.facing < 0,
      tint: onBeat ? 0xffe060 : 0x9ff6ff,
      blend: 'ADD',
      w: 10,
      h: 14,
    });
    // Solo auto-fire is voiced by the sequencer (Music.soloStabs) so it stays perfectly on the grid.
    if (!auto) {
      const t = this.music.soundTime(onBeat);
      audio.synth.riffStab(t, this.music.harmonyAt(t), onBeat);
    }
    if (!auto) s.registerAttack(onBeat);
    s.burst('note', x, y - 4, 1);
  }

  firePowerChord(onBeat) {
    const s = this.scene;
    this.shootT = 300;
    this.shotCd = 250;
    new Shot(s, s.playerShots, this.x + this.facing * 18, this.y, 'power', {
      vx: this.facing * 270,
      damage: onBeat ? 8 : 4,
      power: true,
      pierce: true,
      onBeat,
      life: 800,
      grow: 0.3,
      flipX: this.facing < 0,
      tint: onBeat ? 0xffd040 : 0xff60ff,
      blend: 'ADD',
      w: 20,
      h: 30,
    });
    this.body.setVelocityX(this.body.velocity.x - this.facing * 110);
    this.knockT = 110;
    const t = this.music.soundTime(onBeat);
    audio.synth.powerChord(t, this.music.harmonyAt(t), onBeat);
    s.cameras.main.shake(120, 0.006);
    s.burst('note', this.x, this.y - 6, 4);
    s.registerAttack(onBeat);
  }

  // ---------------------------------------------------------------- solo mode
  handleSolo(time) {
    const s = this.scene;
    if (!this.soloActive && s.controls.soloPressed && s.shred >= SHRED.max) this.startSolo();
    if (!this.soloActive) return;
    const hb = Math.floor(this.music.beatPos() * 2);
    if (hb !== this.lastHalfBeat) {
      this.lastHalfBeat = hb;
      this.fireRiff(true, true);
    }
    this.setTint(Phaser.Display.Color.HSVToRGB((time / 500) % 1, 0.55, 1).color);
  }

  startSolo() {
    const s = this.scene;
    this.cancelCharge();
    this.soloActive = true;
    this.soloBeats = SHRED.soloBeats;
    this.lastHalfBeat = Math.floor(this.music.beatPos() * 2);
    this.music.setLead(true);
    this.music.setSoloStabs(true);
    audio.synth.solo(this.music.harmonyAt());
    audio.synth.cheer(0.8, 3);
    s.events.emit('banner', 'GUITAR SOLO!!!', 0xffd040);
    s.cameras.main.flash(250, 255, 220, 120);
    s.burst('note', this.x, this.y, 12);
  }

  onBeat() {
    if (!this.soloActive) return;
    this.soloBeats--;
    this.scene.shred = (SHRED.max * Math.max(0, this.soloBeats)) / SHRED.soloBeats;
    if (this.soloBeats <= 0) this.endSolo();
  }

  endSolo() {
    this.soloActive = false;
    this.scene.shred = 0;
    this.clearTint();
    this.music.setLead(!!this.scene.bossLead);
    this.music.setSoloStabs(false);
  }

  // ---------------------------------------------------------------- damage & movement helpers
  hurt(dmg, srcX) {
    // stompGraceT: a short window after a stomp, so a simultaneous enemy attack can't punish it.
    if (this.dead || this.invulnT > 0 || this.soloActive || this.stompGraceT > 0) return false;
    const s = this.scene;
    this.picks = Math.max(0, this.picks - dmg);
    this.invulnT = P.invulnMs;
    const dir = Math.sign(this.x - srcX) || -this.facing;
    this.knock(dir * 170, -220, 260);
    this.cancelCharge();
    audio.synth.hurt();
    s.cameras.main.shake(160, 0.01);
    s.hitStop(70);
    s.onPlayerHurt();
    if (this.picks <= 0) this.die();
    return true;
  }

  knock(vx, vy, ms) {
    this.body.setVelocity(vx, vy);
    this.knockT = ms;
    this.tossed = false;
  }

  bounce(v) {
    this.body.setVelocityY(-v);
    this.jumpsLeft = 1;
    this.jumpCut = false;
    this.tossed = false;
    this.airPeakY = this.y;
  }

  toss(vx, vy) {
    this.body.setVelocity(vx, -vy);
    this.tossVx = vx;
    this.tossed = true;
    this.tossT = 120;
    this.jumpsLeft = 1;
    this.jumpCut = false;
    this.airPeakY = this.y;
  }

  pyroBoost() {
    if (this.boostCd > 0) return;
    this.boostCd = 500;
    this.body.setVelocityY(-P.pyroBoostVel);
    this.jumpsLeft = 1;
    this.jumpCut = false;
    this.tossed = false;
    this.scene.popup(this.x, this.y - 24, 'PYRO BOOST!', 0xffa030);
    this.scene.addScore(50);
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.cancelCharge();
    if (this.soloActive) this.endSolo();
    this.body.setVelocity(-this.facing * 60, -320);
    this.body.checkCollision.none = true;
    this.setCollideWorldBounds(false);
    this.setTint(0xff6060);
    this.scene.tweens.add({ targets: this, angle: -this.facing * 540, duration: 1200 });
    this.scene.onPlayerDeath();
  }

  respawn(x, y) {
    this.body.reset(x, y);
    this.body.checkCollision.none = false;
    this.setCollideWorldBounds(true);
    this.dead = false;
    this.invulnT = 1500;
    this.knockT = 0;
    this.tossed = false;
    this.angle = 0;
    this.airPeakY = y;
    this.clearTint();
  }

  animate(dt) {
    const b = this.body;
    const shoot = this.shootT > 0 || (this.charging && this.chargeT > 160) || this.soloActive;
    let legs;
    if (!this.onGround) {
      legs = b.velocity.y < 0 ? 'jump' : 'fall';
    } else if (Math.abs(b.velocity.x) > 15) {
      this.runDist += (Math.abs(b.velocity.x) * dt) / 1000;
      legs = 'run' + (Math.floor(this.runDist / 9) % 4);
    } else {
      legs = this.music.phase() < 0.3 ? 'standb' : 'stand';
    }
    this.setFrame(legs + (shoot ? '_s' : ''));
    this.setFlipX(this.facing < 0);
  }
}

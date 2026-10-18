import Phaser from 'phaser';
import Enemy from './Enemy.js';
import Poser from './Poser.js';
import Shot from '../Shot.js';
import { DEPTH, BEAT_SEC } from '../../config.js';
import { audio } from '../../audio/index.js';

// BOSS: The Producer — autotune overlord on a hovering mixing desk.
//  Phase 1: aimed autotune lasers + note spreads
//  Phase 2: summons posers, electrifies the floor ("SOLD OUT" cables)
//  Phase 3: beat-synced bullet rings — only ON-BEAT hits damage him
export default class Producer extends Enemy {
  constructor(scene, x, y, arena) {
    super(scene, x, -80, 'boss', 'boss0', { hp: 80, score: 5000 });
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.setSize(56, 46).setOffset(8, 12);
    this.noTileCollide = true;
    this.arena = arena;
    this.baseY = y;
    this.phase = 0;
    this.t = 0;
    this.minions = [];
    this.laserG = scene.add.graphics().setDepth(DEPTH.fx);
    this.laser = null;
    this.zapG = scene.add.graphics().setDepth(DEPTH.props + 1);
    this.zap = null;
    this.contactDamage = 1;

    scene.tweens.add({
      targets: this,
      y,
      duration: 1600,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.phase = 1;
        scene.popup(this.x, this.y - 40, 'YOUR RIFFS NEED MORE AUTOTUNE!', 0x55fff0, 8, 1800);
      },
    });
  }

  update(time, dt) {
    if (this.dead) return;
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.clearTint();
    }
    this.awake = true;
    this.t += dt / 1000;
    if (this.phase > 0) {
      const mid = (this.arena.left + this.arena.right) / 2;
      const range = (this.arena.right - this.arena.left) / 2 - 70;
      const dip = this.phase === 3 ? 26 : 0;
      this.x = mid + Math.sin(this.t * 0.45) * range;
      this.y = this.baseY + dip + Math.sin(this.t * 1.4) * 22;
    }
    this.setFrame(this.laser && this.laser.state === 'fire' ? 'boss1' : 'boss0');
    this.updateLaser(dt);
    this.updateZap(dt);
  }

  visor() {
    return { x: this.x, y: this.y - 18 };
  }

  setPhase(n) {
    this.phase = n;
    const s = this.scene;
    audio.synth.boom();
    s.cameras.main.shake(300, 0.012);
    if (n === 2) s.events.emit('banner', 'PHASE 2: SOLD OUT!', 0xff60ff);
    if (n === 3) {
      s.events.emit('banner', 'ONLY ON-BEAT HITS HURT HIM!', 0xffe040);
      s.bossLead = true;
      audio.music.setLead(true);
    }
  }

  onBeat(beat) {
    if (this.dead || this.phase === 0) return;
    if (this.phase === 1) {
      if (beat % 4 === 0) this.aimLaser();
      if (beat % 4 === 1) this.fireLaser();
      if (beat % 4 === 2) this.spread(3, 120);
    } else if (this.phase === 2) {
      if (beat % 8 === 0) this.summon();
      if (beat % 8 === 2) this.aimLaser();
      if (beat % 8 === 3) this.fireLaser();
      if (beat % 8 === 4) this.warnZap();
      if (beat % 8 === 5) this.fireZap();
      if (beat % 2 === 1) this.spread(2, 130);
    } else {
      this.ring(6, beat * 0.26, 85);
      if (beat % 4 === 0) this.aimLaser();
      if (beat % 4 === 1) this.fireLaser();
    }
  }

  // ---------------------------------------------------------------- attacks
  aimLaser() {
    const p = this.player;
    const v = this.visor();
    this.laser = { state: 'aim', angle: Math.atan2(p.y - v.y, p.x - v.x), t: 0 };
    audio.synth.laserCharge();
  }

  fireLaser() {
    if (!this.laser) return;
    this.laser.state = 'fire';
    this.laser.t = BEAT_SEC * 1000 * 0.7;
    audio.synth.laser();
    this.scene.cameras.main.shake(150, 0.006);
  }

  updateLaser(dt) {
    const g = this.laserG;
    g.clear();
    const L = this.laser;
    if (!L) return;
    const v = this.visor();
    const len = 700;
    const ex = v.x + Math.cos(L.angle) * len;
    const ey = v.y + Math.sin(L.angle) * len;
    if (L.state === 'aim') {
      L.t += dt;
      g.lineStyle(1, 0xff3060, Math.floor(L.t / 60) % 2 ? 0.9 : 0.4);
      g.lineBetween(v.x, v.y, ex, ey);
      return;
    }
    L.t -= dt;
    const w = 6 + Math.sin(L.t * 0.08) * 2;
    g.lineStyle(w + 6, 0x33ffee, 0.3);
    g.lineBetween(v.x, v.y, ex, ey);
    g.lineStyle(w, 0xffffff, 1);
    g.lineBetween(v.x, v.y, ex, ey);
    const p = this.player;
    const pb = p.body;
    const line = new Phaser.Geom.Line(v.x, v.y, ex, ey);
    const rect = new Phaser.Geom.Rectangle(pb.x + 2, pb.y + 2, pb.width - 4, pb.height - 4);
    if (Phaser.Geom.Intersects.LineToRectangle(line, rect)) p.hurt(1, v.x);
    if (L.t <= 0) this.laser = null;
  }

  spread(n, speed) {
    const p = this.player;
    const v = this.visor();
    const base = Math.atan2(p.y - v.y, p.x - v.x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.28;
      this.bullet(v.x, v.y, a, speed);
    }
  }

  ring(n, offset, speed) {
    const v = this.visor();
    for (let i = 0; i < n; i++) this.bullet(v.x, v.y, offset + (i / n) * Math.PI * 2, speed);
    audio.synth.feedback();
  }

  bullet(x, y, a, speed) {
    new Shot(this.scene, this.scene.enemyShots, x, y, 'bossNote', {
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 4500,
      spin: 200,
      w: 8,
      blend: 'ADD',
    });
  }

  summon() {
    this.minions = this.minions.filter((m) => m.active && !m.dead);
    if (this.minions.length >= 2) return;
    const s = this.scene;
    const x = Phaser.Math.Between(this.arena.left + 40, this.arena.right - 40);
    const m = new Poser(s, x, 20);
    this.minions.push(m);
    s.popup(x, 40, 'FEAT. POSER', 0xff4fa0);
  }

  warnZap() {
    const p = this.player;
    const mid = (this.arena.left + this.arena.right) / 2;
    const left = p.x < mid;
    this.zap = {
      state: 'warn',
      x0: left ? this.arena.left : mid,
      x1: left ? mid : this.arena.right,
      t: 0,
    };
    this.scene.popup((this.zap.x0 + this.zap.x1) / 2, this.scene.groundY - 30, 'SOLD OUT!', 0xffcc00, 16);
  }

  fireZap() {
    if (!this.zap) return;
    this.zap.state = 'fire';
    this.zap.t = BEAT_SEC * 1000;
    audio.synth.zap();
  }

  updateZap(dt) {
    const g = this.zapG;
    g.clear();
    const Z = this.zap;
    if (!Z) return;
    const gy = this.scene.groundY;
    if (Z.state === 'warn') {
      Z.t += dt;
      g.fillStyle(0xffcc00, Math.floor(Z.t / 80) % 2 ? 0.7 : 0.25);
      for (let x = Z.x0; x < Z.x1; x += 16) g.fillRect(x + 2, gy - 3, 10, 3);
      return;
    }
    Z.t -= dt;
    g.lineStyle(2, 0x9ff6ff, 1);
    g.beginPath();
    g.moveTo(Z.x0, gy - 2);
    for (let x = Z.x0; x <= Z.x1; x += 6) g.lineTo(x, gy - 2 - Math.random() * 8);
    g.strokePath();
    if (Math.random() < 0.5) this.scene.burst('spark', Phaser.Math.Between(Z.x0, Z.x1), gy - 3, 1);
    const p = this.player;
    if (p.onGround && p.x > Z.x0 && p.x < Z.x1) p.hurt(1, p.x - 1);
    if (Z.t <= 0) this.zap = null;
  }

  // ---------------------------------------------------------------- damage
  hurt(dmg, srcX, o = {}) {
    if (this.dead || this.phase === 0) return 'deflect';
    if (this.phase === 3 && !o.onBeat) {
      this.scene.popup(this.x, this.y - 34, 'OFF BEAT! AUTOTUNED!', 0x55fff0);
      audio.synth.deflect();
      return 'deflect';
    }
    const res = super.hurt(dmg, srcX, { ...o, knock: 0 });
    if (res === 'kill') return res;
    if (this.phase === 1 && this.hp <= this.maxHp * 0.66) this.setPhase(2);
    else if (this.phase === 2 && this.hp <= this.maxHp * 0.33) this.setPhase(3);
    return res;
  }

  stun() {}

  die() {
    if (this.dead) return;
    this.dead = true;
    this.laser = null;
    this.zap = null;
    this.laserG.clear();
    this.zapG.clear();
    this.body.enable = false;
    const s = this.scene;
    s.onBossDying(this);
    let n = 0;
    s.time.addEvent({
      delay: 150,
      repeat: 14,
      callback: () => {
        n++;
        this.setTintFill(n % 2 ? 0xffffff : 0xff4040);
        s.burst('fire', this.x + Phaser.Math.Between(-30, 30), this.y + Phaser.Math.Between(-25, 25), 12);
        audio.synth.enemyDie();
        if (n === 15) {
          audio.synth.boom();
          s.burst('fire', this.x, this.y, 40);
          s.burst('note', this.x, this.y, 20);
          this.laserG.destroy();
          this.zapG.destroy();
          s.onBossDefeated(this);
          this.destroy();
        }
      },
    });
  }
}

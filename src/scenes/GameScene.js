import Phaser from 'phaser';
import { TILE, DEPTH, SHRED, PLAYER } from '../config.js';
import { audio } from '../audio/index.js';
import { buildLevel, SOLID_TILES, ONEWAY_TILES, AMP_TILES } from '../world/levelData.js';
import Controls from '../Controls.js';
import Backdrop from '../gfx/Backdrop.js';
import Player from '../entities/Player.js';
import Guard from '../entities/enemies/Guard.js';
import Poser from '../entities/enemies/Poser.js';
import FeedbackBat from '../entities/enemies/FeedbackBat.js';
import Roadie from '../entities/enemies/Roadie.js';
import Producer from '../entities/enemies/Producer.js';
import Pyro from '../world/Pyro.js';
import { Mosher } from '../world/Moshpit.js';
import { SurfHands } from '../world/CrowdSurf.js';
import WallOfDeath from '../world/WallOfDeath.js';
import { text } from '../ui.js';
import { isTouch } from '../touch.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.startData = data || {};
  }

  create() {
    this.level = buildLevel();
    this.worldW = this.level.width * TILE;
    this.worldH = this.level.height * TILE;
    this.groundY = 15 * TILE;
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH + 600);
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.physics.world.timeScale = 1;
    this.tweens.timeScale = 1;
    this.anims.globalTimeScale = 1;

    const carry = this.startData.stats;
    this.stats = carry
      ? { ...carry }
      : { score: 0, kills: 0, onBeat: 0, actions: 0, maxCombo: 0, deaths: 0, time: 0 };
    this.combo = 0;
    this.shred = 0;
    this.musicLocked = false;
    this.bossLead = false;
    this.bossStarted = false;
    this.boss = null;
    this.sectionIdx = -1;
    this.hitStopping = false;
    this.ending = false;
    this.lastShockAt = 0;
    this.arenaWalls = [];
    this.wod = null;
    this.diveX = null;
    this.bossCfg = null;

    this.controls = new Controls(this);
    this.backdrop = new Backdrop(this);
    this.createMap();
    this.createFx();
    this.createGroups();
    this.spawnObjects();
    this.createColliders();
    this.setupCamera();

    audio.music.setLead(false);
    this.lastBeat = audio.music.beat();
    this.scene.launch('HUD');
    window.__riff = this; // handy for debugging / smoke tests
  }

  // ---------------------------------------------------------------- setup
  createMap() {
    const map = this.make.tilemap({ data: this.level.data, tileWidth: TILE, tileHeight: TILE });
    const tiles = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    this.layer = map.createLayer(0, tiles, 0, 0).setDepth(DEPTH.tiles);
    this.layer.setCollision(SOLID_TILES);
    this.layer.forEachTile((t) => {
      if (ONEWAY_TILES.includes(t.index)) t.setCollision(false, false, true, false);
    });
    this.map = map;
  }

  createFx() {
    const P = (key, cfg) => this.add.particles(0, 0, key, { emitting: false, ...cfg }).setDepth(DEPTH.fx);
    this.fx = {
      spark: P('spark', { speed: { min: 60, max: 200 }, lifespan: 320, scale: { start: 1, end: 0 }, tint: [0xffffff, 0xffee88, 0x9ff6ff], blendMode: 'ADD' }),
      star: P('star', { speedX: { min: -20, max: 20 }, speedY: { min: -40, max: -20 }, lifespan: 500, alpha: { start: 1, end: 0 } }),
      dust: P('smoke', { speedX: { min: -40, max: 40 }, speedY: { min: -20, max: -5 }, lifespan: 380, scale: { start: 0.25, end: 0.6 }, alpha: { start: 0.5, end: 0 } }),
      sweat: P('pixel', { speed: { min: 40, max: 150 }, angle: { min: 200, max: 340 }, gravityY: 500, lifespan: 600, scale: 0.5, tint: [0x9fd8ff, 0xffffff] }),
      fire: P('flame', { speed: { min: 40, max: 180 }, lifespan: { min: 300, max: 600 }, scale: { start: 2, end: 0.2 }, alpha: { start: 1, end: 0 }, tint: [0xffffff, 0xffd040, 0xff7020, 0xff3010], blendMode: 'ADD' }),
      note: P('noteP', { speed: { min: 30, max: 90 }, angle: { min: 200, max: 340 }, lifespan: 750, alpha: { start: 1, end: 0 }, tint: [0xff60ff, 0x9ff6ff, 0xffe060, 0x60ff90], gravityY: -30 }),
      confetti: P('pixel', { speed: { min: 80, max: 260 }, angle: { min: 230, max: 310 }, gravityY: 300, lifespan: 2000, scale: 0.6, rotate: { min: 0, max: 360 }, tint: [0xff3355, 0x33aaff, 0xffd040, 0x40ff80, 0xff60ff] }),
    };
  }

  createGroups() {
    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.playerShots = this.physics.add.group({ allowGravity: false, runChildUpdate: true });
    this.enemyShots = this.physics.add.group({ allowGravity: false, runChildUpdate: true });
    this.pickups = this.physics.add.group({ allowGravity: false });
    this.moshers = this.physics.add.group({ runChildUpdate: true });
    this.surfs = this.physics.add.group({ allowGravity: false, immovable: true });
    this.speakers = this.physics.add.staticGroup();
    this.barriers = this.physics.add.staticGroup();
    this.pyros = [];
    this.checkpoints = [];
    this.signs = [];
    this.decor = [];
  }

  spawnObjects() {
    const objs = this.level.objects;
    const start = objs.find((o) => o.type === 'player');
    const cp = this.startData.checkpoint;
    const sx = cp ? cp.x : start.x;
    const sy = cp ? cp.y : start.y - 12;
    this.checkpoint = { x: sx, y: sy };
    this.player = new Player(this, sx, sy);

    for (const o of objs) {
      switch (o.type) {
        case 'guard': new Guard(this, o.x, o.y); break;
        case 'poser': new Poser(this, o.x, o.y); break;
        case 'bat': new FeedbackBat(this, o.x, o.y); break;
        case 'roadie': new Roadie(this, o.x, o.y); break;
        case 'pick':
        case 'can': this.spawnPickup(o.type, o.x, o.y - 8); break;
        case 'sign': this.makeSign(o); break;
        case 'speaker': this.speakers.create(o.x + 8, o.y - 8, 'speaker').setDepth(DEPTH.props); break;
        case 'pyro': this.pyros.push(new Pyro(this, o.x, o.y, o.offset)); break;
        case 'mosher': new Mosher(this, o.x, o.y, o.zone); break;
        case 'checkpoint': this.makeCheckpoint(o); break;
        case 'wod': this.wod = new WallOfDeath(this, o); break;
        case 'hands': new SurfHands(this, o.x, o.y, o); break;
        case 'crowdDecor': this.makeCrowdDecor(o); break;
        case 'dive': this.diveX = o.x; this.dived = sx > o.x; break;
        case 'boss': this.bossCfg = o; break;
        default: break;
      }
    }
  }

  createColliders() {
    const p = this.player;
    const add = this.physics.add;
    add.collider(p, this.layer);
    add.collider(this.enemies, this.layer, null, (e) => !e.noTileCollide);
    add.collider(this.moshers, this.layer);
    add.collider(this.moshers, this.moshers);
    add.collider(this.enemyShots, this.layer, (shot) => {
      this.burst('spark', shot.x, shot.y, 3);
      shot.destroy();
    });
    add.collider(this.playerShots, this.layer, (shot, tile) => this.onShotHitTile(shot, tile));
    add.overlap(this.playerShots, this.enemies, (shot, e) => this.onShotHitEnemy(shot, e));
    add.overlap(this.playerShots, this.moshers, (shot, m) => {
      m.hype();
      if (!shot.pierce) shot.destroy();
    });
    add.overlap(p, this.enemies, (pl, e) => this.onPlayerTouchEnemy(e));
    add.overlap(p, this.enemyShots, (pl, shot) => {
      if (p.soloActive || p.hurt(1, shot.x)) {
        this.burst('spark', shot.x, shot.y, 4);
        shot.destroy();
      }
    });
    add.overlap(p, this.pickups, (pl, item) => this.collect(item));
    add.overlap(p, this.moshers, (pl, m) => m.shove(p));
    add.collider(p, this.speakers, (pl, sp) => this.onSpeaker(sp));
    add.collider(p, this.surfs, (pl, h) => {
      if (p.body.touching.down) h.onLand(p);
    });
    add.collider(p, this.barriers);
    add.collider(this.enemies, this.barriers, null, (e) => !e.noTileCollide);
  }

  setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.worldW, this.worldH);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setDeadzone(30, 70);
    cam.fadeIn(400, 0, 0, 0);
  }

  // ---------------------------------------------------------------- object factories
  spawnPickup(kind, x, y) {
    const it = this.pickups.create(x, y, kind === 'can' ? 'can' : 'pick');
    it.kind = kind;
    it.setDepth(DEPTH.props);
    this.tweens.add({ targets: it, y: y - 3, duration: 600 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (kind === 'pick') this.tweens.add({ targets: it, scaleX: 0.25, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return it;
  }

  makeSign(o) {
    this.add.image(o.x, o.y, 'sign').setOrigin(0.5, 1).setDepth(DEPTH.props);
    const t = text(this, o.x, o.y - 34, (isTouch && o.touchText) || o.text, 8, 0xffffff).setOrigin(0.5, 1).setCenterAlign().setDepth(DEPTH.ui);
    const bg = this.add.rectangle(o.x, o.y - 30, t.width + 10, t.height + 8, 0x0a0610, 0.88)
      .setOrigin(0.5, 1).setStrokeStyle(1, 0xffcc33).setDepth(DEPTH.ui - 1);
    t.setAlpha(0);
    bg.setAlpha(0);
    this.signs.push({ x: o.x, t, bg, shown: false });
  }

  makeCheckpoint(o) {
    const img = this.add.image(o.x, o.y, 'mic', 'mic0').setOrigin(0.5, 1).setDepth(DEPTH.props);
    const cp = { x: o.x, y: o.y - 14, img, on: false };
    if (this.player.x >= o.x - 4) {
      cp.on = true;
      img.setFrame('mic1');
    }
    this.checkpoints.push(cp);
  }

  makeCrowdDecor(o) {
    for (const [dx, dy, tint] of [[0, -6, 0x6a5a7a], [8, 4, 0x9a8aaa]]) {
      const v = Phaser.Math.Between(0, 5);
      const img = this.add.image(o.x + dx + Phaser.Math.Between(-2, 2), o.y + dy, 'crowd', `c${v}_0`)
        .setOrigin(0.5, 1).setDepth(DEPTH.decor).setTint(tint).setFlipX(Math.random() < 0.5);
      img.v = v;
      this.decor.push(img);
    }
  }

  // ---------------------------------------------------------------- main loop
  update(time, delta) {
    const dt = Math.min(delta, 50);
    this.controls.update();
    if (this.controls.pausePressed && !this.ending && !this.player.dead) {
      this.pauseGame();
      return;
    }
    this.tickBeat();
    this.player.update(time, dt);
    for (const pyro of this.pyros) pyro.update(dt);
    if (this.wod) this.wod.update(dt);
    this.updateCheckpoints();
    this.updateSigns();
    this.updateSection();
    this.updateTriggers();
    this.backdrop.update(time);

    const cam = this.cameras.main;
    cam.followOffset.x = Phaser.Math.Linear(cam.followOffset.x, -this.player.facing * 40, 0.03);

    if (!this.player.dead && this.player.y > this.worldH + 40) this.onPitFall();
    if (!this.ending) this.stats.time += dt;
  }

  tickBeat() {
    const b = audio.music.beat();
    if (b > this.lastBeat) {
      for (let k = Math.max(this.lastBeat + 1, b - 1); k <= b; k++) this.onBeat(k);
    }
    this.lastBeat = b;
  }

  onBeat(k) {
    if (k < 0) return;
    this.backdrop.onBeat(k);
    this.player.onBeat(k);
    for (const p of this.pyros) p.onBeat(k);
    for (const e of this.enemies.getChildren().slice()) if (e.active && e.onBeat) e.onBeat(k);
    for (const m of this.moshers.getChildren()) m.onBeat(k);
    for (const h of this.surfs.getChildren()) h.onBeat(k);
    for (const d of this.decor) if (Math.random() < 0.5) d.setFrame(`c${d.v}_${Math.random() < 0.6 ? 1 : 0}`);
    for (const sp of this.speakers.getChildren()) {
      sp.setScale(1, 1.1);
      this.tweens.add({ targets: sp, scaleY: 1, duration: 160 });
    }
    if (this.wod) this.wod.onBeat(k);
    this.events.emit('beat', k);
  }

  updateCheckpoints() {
    const p = this.player;
    if (p.dead) return;
    for (const cp of this.checkpoints) {
      if (cp.on || Math.abs(p.x - cp.x) > 12 || Math.abs(p.y - cp.y) > 30) continue;
      cp.on = true;
      cp.img.setFrame('mic1');
      this.checkpoint = { x: cp.x, y: cp.y };
      this.popup(cp.x, cp.y - 24, 'CHECKPOINT!', 0x40ff80);
      this.burst('note', cp.x, cp.y - 20, 6);
      audio.synth.checkpoint();
    }
  }

  updateSigns() {
    const p = this.player;
    const view = this.cameras.main.worldView;
    for (const s of this.signs) {
      const near = Math.abs(p.x - s.x) < 56;
      if (near !== s.shown) {
        s.shown = near;
        this.tweens.add({ targets: [s.t, s.bg], alpha: near ? 1 : 0, duration: 200 });
      }
      if (s.shown) {
        const half = s.bg.width / 2 + 4;
        const x = Phaser.Math.Clamp(s.x, view.x + half, view.right - half);
        s.t.x = x;
        s.bg.x = x;
      }
    }
  }

  updateSection() {
    const secs = this.level.sections;
    const x = this.player.x;
    let idx = Math.max(0, this.sectionIdx);
    while (idx + 1 < secs.length && x >= secs[idx + 1].x) idx++;
    while (idx > 0 && x < secs[idx].x) idx--;
    if (idx === this.sectionIdx) return;
    this.sectionIdx = idx;
    const s = secs[idx];
    this.events.emit('banner', s.name, 0xffffff);
    if (!this.musicLocked && s.music) audio.music.setConfig(s.music);
    if (s.crowd !== undefined) audio.synth.setCrowd(s.crowd);
  }

  reapplySectionMusic() {
    const s = this.level.sections[this.sectionIdx];
    if (s && s.music) audio.music.setConfig(s.music);
  }

  updateTriggers() {
    const p = this.player;
    if (p.dead) return;
    if (this.diveX !== null && !this.dived && p.x > this.diveX && !p.onGround) {
      this.dived = true;
      this.stageDive();
    }
    if (this.bossCfg && !this.bossStarted && p.x > this.bossCfg.trigger) this.startBoss();
  }

  // ---------------------------------------------------------------- combat
  get mult() {
    return Math.min(8, 1 + Math.floor(this.combo / 4));
  }

  addScore(base) {
    this.stats.score += Math.round(base * this.mult);
  }

  addShred(n) {
    if (this.player.soloActive) return;
    const before = this.shred;
    this.shred = Math.min(SHRED.max, this.shred + n);
    if (before < SHRED.max && this.shred >= SHRED.max) {
      this.popup(this.player.x, this.player.y - 34, isTouch ? 'SHRED READY! TAP SOLO' : 'SHRED READY! PRESS C', 0xffd040, 8, 1200);
      audio.synth.charged();
    }
  }

  registerAttack(onBeat) {
    this.stats.actions++;
    const p = this.player;
    if (onBeat) {
      this.stats.onBeat++;
      const prev = this.mult;
      this.combo++;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      this.addShred(SHRED.onBeat);
      this.addScore(20);
      this.popup(p.x, p.y - 22, 'ON BEAT!', 0xffe040, 8, 500);
      if (this.mult > prev) {
        this.popup(p.x, p.y - 34, `X${this.mult} MULTIPLIER!`, 0xff60ff, 8, 900);
        audio.synth.cheer(0.5, 1);
      }
    } else if (this.combo > 0) {
      if (this.combo >= 4) this.popup(p.x, p.y - 22, 'COMBO BROKEN', 0x8888aa);
      this.combo = 0;
    }
  }

  onBeatMove(x, y, label = 'ON BEAT!') {
    this.popup(x, y, label, 0xffe040, 8, 500);
    this.addShred(SHRED.onBeatMove);
    this.addScore(10);
    const ring = this.add.image(x, y + 20, 'ring').setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe040).setScale(0.2);
    this.tweens.add({ targets: ring, scale: 1.2, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
  }

  onShotHitTile(shot, tile) {
    if (!shot.active) return;
    if (shot.power && AMP_TILES.includes(tile.index)) this.shockwave(tile.pixelX + 8, tile.pixelY + 8);
    this.burst('spark', shot.x, shot.y, 4);
    shot.destroy();
  }

  shockwave(x, y) {
    if (this.time.now - this.lastShockAt < 300) return;
    this.lastShockAt = this.time.now;
    const ring = this.add.image(x, y, 'ring').setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff60ff).setScale(0.2);
    this.tweens.add({ targets: ring, scale: 4.2, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    audio.synth.shockwave();
    this.cameras.main.shake(220, 0.012);
    this.burst('spark', x, y, 20);
    this.popup(x, y - 22, 'SHOCKWAVE!', 0xff60ff);
    for (const e of this.enemies.getChildren().slice()) {
      if (!e.active || e.dead) continue;
      if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < 100) {
        e.stun(2200);
        e.hurt(1, x, {});
      }
    }
    for (const m of this.moshers.getChildren()) {
      if (Phaser.Math.Distance.Between(x, y, m.x, m.y) < 100) m.hype();
    }
  }

  onShotHitEnemy(shot, e) {
    if (!shot.active || e.dead || shot.hitSet.has(e)) return;
    shot.hitSet.add(e);
    const res = e.hurt(shot.damage, shot.x, { knock: shot.power ? 170 : 50, onBeat: shot.onBeat });
    if (res === 'deflect') {
      this.burst('spark', shot.x, shot.y, 4);
      shot.destroy();
      return;
    }
    this.addShred(SHRED.hit);
    this.addScore(10);
    this.burst('spark', e.x, e.y, shot.power ? 10 : 5);
    if (shot.power) this.hitStop(45);
    if (!shot.pierce) shot.destroy();
  }

  onPlayerTouchEnemy(e) {
    const p = this.player;
    if (!e.active || e.dead || p.dead) return;
    const pb = p.body;
    const eb = e.body;
    if (e.stompable && pb.velocity.y > 40 && pb.bottom - eb.top < 12) {
      const onBeat = audio.music.isOnBeat();
      const res = e.hurt(onBeat ? 4 : 2, p.x, { onBeat });
      p.bounce(onBeat ? 390 : 310);
      if (res !== 'deflect') {
        if (onBeat) this.registerAttack(true);
        this.addShred(SHRED.stomp);
        this.addScore(50);
        this.popup(e.x, e.y - 18, onBeat ? 'BEAT STOMP!' : 'STOMP!', onBeat ? 0xffe040 : 0xffffff);
      }
      audio.synth.stomp();
      this.hitStop(40);
      this.burst('spark', p.x, pb.bottom, 8);
      return;
    }
    if (p.soloActive) {
      if ((e.soloCd || 0) > this.time.now) return;
      e.soloCd = this.time.now + 250;
      e.hurt(3, p.x, { knock: 200, onBeat: true });
      return;
    }
    p.hurt(e.contactDamage, e.x);
  }

  onEnemyKilled(e) {
    this.stats.kills++;
    const pts = Math.round(e.score * this.mult);
    this.stats.score += pts;
    this.addShred(SHRED.kill);
    this.popup(e.x, e.y - 14, '+' + pts, 0xffffff);
    this.burst('fire', e.x, e.y, 10);
    this.burst('note', e.x, e.y, 3);
    audio.synth.enemyDie();
    this.cameras.main.shake(80, 0.004);
    if (Math.random() < 0.25) this.spawnPickup('pick', e.x, e.y - 4);
  }

  onSpeaker(sp) {
    const p = this.player;
    if (!p.body.touching.down || p.dead) return;
    const onBeat = audio.music.isOnBeat(0.11);
    p.bounce(onBeat ? 560 : 430);
    audio.synth.bounce();
    if (onBeat) this.onBeatMove(p.x, p.y - 24, 'MEGA BOUNCE!');
    this.tweens.add({ targets: sp, scaleY: 0.8, duration: 70, yoyo: true });
    this.burst('note', sp.x, sp.y - 6, 3);
  }

  collect(item) {
    if (!item.active) return;
    const p = this.player;
    if (item.kind === 'can') {
      if (p.picks < PLAYER.maxPicks) {
        p.picks++;
        this.popup(item.x, item.y - 10, '+1 PICK', 0x40ff80);
      } else {
        this.addScore(500);
        this.popup(item.x, item.y - 10, '+' + 500 * this.mult, 0x40ff80);
      }
      audio.synth.heal();
    } else {
      this.addScore(100);
      this.popup(item.x, item.y - 8, '+' + 100 * this.mult, 0xffcf3a, 8, 500);
      audio.synth.pickup();
    }
    this.burst('spark', item.x, item.y, 6);
    this.tweens.killTweensOf(item);
    item.destroy();
  }

  // ---------------------------------------------------------------- player fate
  onPlayerHurt() {
    if (this.combo >= 4) this.popup(this.player.x, this.player.y - 22, 'COMBO BROKEN', 0x8888aa);
    this.combo = 0;
    this.events.emit('hurt');
  }

  onPitFall() {
    const p = this.player;
    if (p.picks > 1) {
      p.picks--;
      this.combo = 0;
      p.respawn(this.checkpoint.x, this.checkpoint.y);
      this.events.emit('banner', 'THE CROWD DROPPED YOU!', 0xff8080);
      this.events.emit('hurt');
      audio.synth.hurt();
    } else {
      p.picks = 0;
      p.die();
    }
  }

  onPlayerDeath() {
    this.stats.deaths++;
    this.combo = 0;
    audio.synth.setCrowd(0.03);
    this.events.emit('banner', 'BOOED OFF STAGE...', 0xff4040);
    this.time.delayedCall(1600, () => {
      this.scene.stop('HUD');
      this.scene.start('GameOver', { checkpoint: this.checkpoint, stats: this.stats });
    });
  }

  pauseGame() {
    this.scene.pause();
    this.scene.get('HUD').setPaused(true);
  }

  // ---------------------------------------------------------------- set pieces & events
  lockArena(left, right) {
    this.arena = { left, right };
    this.cameras.main.setBounds(left, 0, right - left, this.worldH);
    const wall = (x) => {
      const w = this.barriers.create(x, this.worldH / 2, 'pixel');
      w.setDisplaySize(8, this.worldH * 3).setVisible(false).refreshBody();
      return w;
    };
    this.arenaWalls = [wall(left - 4), wall(right + 4)];
  }

  unlockArena() {
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.arenaWalls.forEach((w) => w.destroy());
    this.arenaWalls = [];
  }

  stageDive() {
    const p = this.player;
    this.events.emit('banner', 'STAGE DIVE!!!', 0xffd040);
    this.stats.score += 500;
    this.popup(p.x, p.y - 30, '+500', 0xffd040);
    audio.synth.cheer(1, 3);
    this.burst('note', p.x, p.y, 10);
    this.burst('confetti', p.x, p.y - 40, 30);
    this.slowMo(900, 0.35);
    const cam = this.cameras.main;
    cam.zoomTo(1.25, 250);
    this.time.delayedCall(900, () => cam.zoomTo(1, 500));
  }

  startBoss() {
    this.bossStarted = true;
    const c = this.bossCfg;
    this.lockArena(c.left, c.right);
    this.musicLocked = true;
    audio.music.setConfig({ song: 'boss', drums: 4, bass: true, rhythm: true });
    audio.synth.setCrowd(0.3);
    this.events.emit('banner', 'BOSS: THE PRODUCER', 0x55fff0);
    this.boss = new Producer(this, c.x, c.y, { left: c.left, right: c.right });
  }

  onBossDying() {
    this.ending = true;
    this.player.invulnT = 1e9;
    for (const s of this.enemyShots.getChildren().slice()) s.destroy();
    for (const e of this.enemies.getChildren().slice()) if (e !== this.boss && e.active && !e.dead) e.die();
    this.slowMo(1500, 0.4);
    audio.synth.cheer(1, 4);
  }

  onBossDefeated() {
    this.stats.kills++;
    this.addScore(5000);
    this.events.emit('banner', 'THE PRODUCER GOT UNPLUGGED!', 0x40ff80);
    audio.synth.setCrowd(0.6);
    audio.synth.cheer(1, 6);
    audio.music.setConfig({ song: 'pyro', drums: 3, bass: true, rhythm: true, lead: true });
    const { left, right } = this.arena;
    for (let i = 0; i < 6; i++) {
      const x = left + 40 + (i * (right - left - 80)) / 5;
      this.pyros.push(new Pyro(this, x, this.groundY, (i % 2) * 2));
    }
    this.time.addEvent({ delay: 400, repeat: 10, callback: () => this.burst('confetti', Phaser.Math.Between(left, right), 30, 25) });
    this.time.delayedCall(5500, () => this.finishLevel());
  }

  finishLevel() {
    const cam = this.cameras.main;
    cam.fadeOut(800, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.stop('HUD');
      this.scene.start('Victory', { stats: this.stats, picks: this.player.picks });
    });
  }

  // ---------------------------------------------------------------- juice helpers
  burst(name, x, y, n) {
    this.fx[name].explode(n, x, y);
  }

  dust(x, y) {
    this.fx.dust.explode(4, x, y);
  }

  popup(x, y, str, tint = 0xffffff, size = 8, dur = 700) {
    const t = text(this, x, y, str, size, tint).setOrigin(0.5).setDepth(DEPTH.ui);
    this.tweens.add({ targets: t, y: y - 16, duration: dur, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: dur * 0.5, duration: dur * 0.5, onComplete: () => t.destroy() });
    return t;
  }

  hitStop(ms) {
    if (this.hitStopping) return;
    this.hitStopping = true;
    this.physics.world.pause();
    this.time.delayedCall(ms, () => {
      this.physics.world.resume();
      this.hitStopping = false;
    });
  }

  slowMo(ms, factor) {
    this.physics.world.timeScale = 1 / factor;
    this.tweens.timeScale = factor;
    this.anims.globalTimeScale = factor;
    this.time.delayedCall(ms, () => {
      this.physics.world.timeScale = 1;
      this.tweens.timeScale = 1;
      this.anims.globalTimeScale = 1;
    });
  }

  solidAt(x, y) {
    const t = this.layer.getTileAtWorldXY(x, y);
    return !!(t && t.collides);
  }

  oneWayBelow(p) {
    const t = this.layer.getTileAtWorldXY(p.x, p.body.bottom + 2);
    return !!(t && ONEWAY_TILES.includes(t.index));
  }
}

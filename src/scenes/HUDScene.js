import Phaser from 'phaser';
import { GAME_W, GAME_H, SHRED, PLAYER } from '../config.js';
import { audio } from '../audio/index.js';
import { text } from '../ui.js';
import { isTouch, touchState, TOUCH_BUTTONS, pollTouch } from '../touch.js';

export default class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create() {
    const g = (this.gameScene = this.scene.get('Game'));
    this.picks = [];
    for (let i = 0; i < PLAYER.maxPicks; i++) this.picks.push(this.add.image(10 + i * 12, 10, 'pickIcon'));
    text(this, 6, 19, 'SHRED', 8, 0xffd040);
    this.scoreT = text(this, GAME_W - 6, 5, 'SCORE 0', 8).setOrigin(1, 0);
    this.multT = text(this, GAME_W - 6, 15, '', 8, 0xff60ff).setOrigin(1, 0);
    this.soloHint = text(this, 104, 19, isTouch ? 'TAP SOLO!' : 'PRESS C!', 8, 0xffffff).setVisible(false);
    this.gfx = this.add.graphics();
    this.bossName = text(this, GAME_W / 2, 6, 'THE PRODUCER', 8, 0x55fff0).setOrigin(0.5, 0).setVisible(false);

    this.bannerT = text(this, GAME_W / 2, 64, '', 16).setOrigin(0.5).setAlpha(0);
    this.beatFlash = 0;
    this.hurtFlash = 0;

    // pause overlay
    this.pauseLayer = this.add.container(0, 0).setVisible(false);
    this.pauseLayer.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.65).setOrigin(0));
    this.pauseLayer.add(text(this, GAME_W / 2, 100, 'PAUSED', 24, 0xffd040).setOrigin(0.5));
    this.pauseLayer.add(
      text(this, GAME_W / 2, 140, isTouch ? 'TAP ANYWHERE TO RESUME' : 'ESC: RESUME     Q: QUIT TO TITLE     M: MUTE', 8).setOrigin(0.5),
    );
    if (isTouch) {
      this.quitBtn = text(this, GAME_W / 2, 180, '[ QUIT TO TITLE ]', 8, 0xff8080).setOrigin(0.5);
      this.pauseLayer.add(this.quitBtn);
    }
    this.paused = false;
    this.keys = this.input.keyboard.addKeys('ESC,P,Q');

    // touch buttons (drawn on top of everything else in the HUD)
    this.touchGfx = this.add.graphics().setDepth(10);
    this.touchLabels = isTouch
      ? TOUCH_BUTTONS.map((b) => text(this, b.x, b.y, b.label, b.r > 20 ? 8 : 8, 0xffffff).setOrigin(0.5).setDepth(11).setAlpha(0.8))
      : [];
    this.input.on('pointerdown', (p) => {
      if (!this.paused || !p.wasTouch) return;
      if (this.quitBtn && Math.abs(p.y - 180) < 14 && Math.abs(p.x - GAME_W / 2) < 70) {
        this.setPaused(false);
        this.scene.stop('Game');
        this.scene.start('Title');
      } else {
        this.setPaused(false);
        this.scene.resume('Game');
      }
    });

    g.events.on('banner', this.banner, this);
    g.events.on('beat', this.onBeat, this);
    g.events.on('hurt', this.onHurt, this);
    this.events.once('shutdown', () => {
      g.events.off('banner', this.banner, this);
      g.events.off('beat', this.onBeat, this);
      g.events.off('hurt', this.onHurt, this);
    });
  }

  banner(str, tint = 0xffffff) {
    const t = this.bannerT;
    this.tweens.killTweensOf(t);
    t.setText(String(str).toUpperCase()).setTint(tint).setAlpha(1).setScale(0.2);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1600, duration: 400 });
  }

  onBeat() {
    this.beatFlash = 1;
  }

  onHurt() {
    this.hurtFlash = 1;
  }

  setPaused(on) {
    this.paused = on;
    this.pauseLayer.setVisible(on);
  }

  drawTouch(g) {
    if (!isTouch) return;
    pollTouch(this.input.manager.pointers);
    const gfx = this.touchGfx;
    gfx.clear();
    if (this.paused) {
      this.touchLabels.forEach((l) => l.setVisible(false));
      return;
    }
    const soloReady = g && g.shred >= SHRED.max && !g.player.soloActive;
    TOUCH_BUTTONS.forEach((b, i) => {
      const on = touchState[b.id];
      const dim = b.id === 'solo' && !soloReady;
      const col = b.id === 'solo' ? 0xffd040 : b.id === 'jump' ? 0x40ff80 : b.id === 'attack' ? 0xff60ff : 0xffffff;
      gfx.fillStyle(col, on ? 0.4 : dim ? 0.04 : 0.1).fillCircle(b.x, b.y, b.r);
      gfx.lineStyle(1, col, dim ? 0.2 : 0.5).strokeCircle(b.x, b.y, b.r);
      this.touchLabels[i].setVisible(true).setAlpha(dim ? 0.25 : 0.7);
    });
  }

  update(time, delta) {
    const g = this.gameScene;
    this.drawTouch(g);
    if (this.paused) {
      const JD = Phaser.Input.Keyboard.JustDown;
      if (JD(this.keys.ESC) || JD(this.keys.P)) {
        this.setPaused(false);
        this.scene.resume('Game');
      } else if (JD(this.keys.Q)) {
        this.setPaused(false);
        this.scene.stop('Game');
        this.scene.start('Title');
      }
      return;
    }
    if (!g || !g.player) return;
    const p = g.player;
    this.picks.forEach((img, i) => img.setTexture(i < p.picks ? 'pickIcon' : 'pickEmpty'));
    this.scoreT.setText('SCORE ' + String(g.stats.score).padStart(7, '0'));
    this.multT.setText(g.combo > 0 ? `X${g.mult}  COMBO ${g.combo}` : '');

    const gfx = this.gfx;
    gfx.clear();

    // shred meter
    const full = g.shred >= SHRED.max && !p.soloActive;
    const w = 60;
    gfx.fillStyle(0x000000, 0.6).fillRect(38, 19, w + 2, 8);
    gfx.lineStyle(1, full ? 0xffffff : 0x8a6a2a).strokeRect(38, 19, w + 2, 8);
    const fillW = Math.round((g.shred / SHRED.max) * w);
    const col = p.soloActive ? Phaser.Display.Color.HSVToRGB((time / 400) % 1, 0.7, 1).color : full ? (Math.floor(time / 120) % 2 ? 0xffffff : 0xffd040) : 0xff8a20;
    gfx.fillStyle(col, 1).fillRect(39, 20, fillW, 6);
    this.soloHint.setVisible(full && Math.floor(time / 300) % 2 === 0);

    // beat bar (bottom centre): markers slide in from both sides and meet on the beat
    const m = audio.music;
    const pos = m.beatPos();
    const ph = pos - Math.floor(pos);
    const cx = GAME_W / 2;
    const cy = GAME_H - 11;
    this.beatFlash = Math.max(0, this.beatFlash - delta / 250);
    gfx.fillStyle(0x000000, 0.45).fillRoundedRect(cx - 92, cy - 8, 184, 16, 4);
    gfx.lineStyle(1, 0x553366, 1).lineBetween(cx - 84, cy, cx + 84, cy);
    for (let k = 0; k < 3; k++) {
      const d = (k + 1 - ph) * 28;
      const a = 1 - k * 0.3;
      gfx.fillStyle(0xff60ff, a).fillRect(cx - d - 1, cy - 4, 2, 8).fillRect(cx + d - 1, cy - 4, 2, 8);
    }
    const onWin = m.isOnBeat();
    gfx.lineStyle(1, onWin ? 0xffe040 : 0x885588, 1).strokeCircle(cx, cy, 6);
    gfx.fillStyle(onWin ? 0xffe040 : 0x442244, 1).fillCircle(cx, cy, 3 + this.beatFlash * 3);
    // bar position: 4 dots, the 4th (pyro beat) is orange
    const beatInBar = ((Math.floor(pos) % 4) + 4) % 4;
    for (let i = 0; i < 4; i++) {
      const lit = i === beatInBar;
      const c = i === 3 ? 0xff8a20 : 0xffe040;
      gfx.fillStyle(lit ? c : 0x332233, 1).fillRect(cx + 100 + i * 7, cy - 2, 5, 5);
    }

    // boss bar
    const boss = g.boss;
    if (boss && boss.active && !boss.dead) {
      this.bossName.setVisible(true);
      const bw = 160;
      gfx.fillStyle(0x000000, 0.6).fillRect(cx - bw / 2 - 1, 16, bw + 2, 6);
      gfx.fillStyle(boss.phase === 3 ? 0xffe040 : 0x55fff0, 1).fillRect(cx - bw / 2, 17, Math.round((boss.hp / boss.maxHp) * bw), 4);
    } else {
      this.bossName.setVisible(false);
    }

    // hurt vignette
    if (this.hurtFlash > 0) {
      this.hurtFlash = Math.max(0, this.hurtFlash - delta / 400);
      gfx.fillStyle(0xff0000, this.hurtFlash * 0.25).fillRect(0, 0, GAME_W, GAME_H);
    }
  }
}

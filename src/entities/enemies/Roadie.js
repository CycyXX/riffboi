import Enemy from './Enemy.js';
import Shot from '../Shot.js';
import { GRAVITY } from '../../config.js';

// Roadie: tanky, lobs coiled cables at you every bar.
export default class Roadie extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y - 12, 'roadie', 'r0', { hp: 4, score: 250 });
    this.body.setSize(12, 20).setOffset(3, 4);
    this.walk = 0;
    this.throwT = 0;
  }

  update(time, dt) {
    if (!super.update(time, dt)) return;
    this.throwT -= dt;
    const p = this.player;
    const dx = p.x - this.x;
    const dir = Math.sign(dx) || 1;
    const b = this.body;
    let vx = 0;
    if (Math.abs(dx) < 220 && Math.abs(dx) > 90 && this.throwT <= 0) vx = dir * 26;
    if (vx && b.blocked.down && !this.floorAhead(dir)) vx = 0;
    b.setVelocityX(vx);
    this.setFlipX(dx < 0);
    this.walk += (Math.abs(vx) * dt) / 1000;
    this.setFrame(this.throwT > 0 ? 'r2' : Math.floor(this.walk / 5) % 2 ? 'r1' : 'r0');
  }

  onBeat(beat) {
    if (!this.canAct() || beat % 4 !== 2) return;
    const p = this.player;
    const dx = p.x - this.x;
    const dy = p.y - (this.y - 6);
    if (p.dead || Math.abs(dx) > 250 || Math.abs(dy) > 120) return;
    const T = 0.85;
    const vx = Math.max(-230, Math.min(230, dx / T));
    const vy = Math.max(-430, Math.min(0, (dy - 0.5 * GRAVITY * T * T) / T));
    new Shot(this.scene, this.scene.enemyShots, this.x, this.y - 8, 'cable', {
      gravity: true,
      vx,
      vy,
      spin: 720,
      life: 3000,
      w: 8,
    });
    this.throwT = 280;
  }
}

import Enemy from './Enemy.js';
import Shot from '../Shot.js';
import { audio } from '../../audio/index.js';

// Pop-punk poser: screams mic-feedback notes at you on the beat.
export default class Poser extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y - 12, 'poser', 'p0', { hp: 2, score: 150 });
    this.body.setSize(10, 20).setOffset(3, 4);
    this.singT = 0;
  }

  update(time, dt) {
    if (!super.update(time, dt)) return;
    this.singT -= dt;
    this.setFlipX(this.player.x < this.x);
    this.body.setVelocityX(0);
    this.setFrame(this.singT > 0 ? 'p1' : 'p0');
  }

  onBeat(beat) {
    if (!this.canAct()) return;
    const p = this.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    if (beat % 2 === 0 && Math.abs(dx) < 230 && Math.abs(dy) < 90 && !p.dead) {
      const dir = Math.sign(dx) || 1;
      new Shot(this.scene, this.scene.enemyShots, this.x + dir * 8, this.y - 4, 'note', {
        vx: dir * 125,
        vy: Math.max(-50, Math.min(50, dy * 0.5)),
        life: 2400,
        w: 7,
        h: 8,
      });
      this.singT = 220;
      audio.synth.feedback();
    }
    if (beat % 4 === 1 && this.body.blocked.down) this.body.setVelocityY(-170);
  }
}

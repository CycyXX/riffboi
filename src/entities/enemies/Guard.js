import Enemy from './Enemy.js';

// Security guard: patrols, charges when he spots you.
export default class Guard extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y - 12, 'guard', 'g0', { hp: 3, score: 200 });
    this.body.setSize(12, 20).setOffset(4, 4);
    this.dir = -1;
    this.walk = 0;
    this.alert = false;
  }

  update(time, dt) {
    if (!super.update(time, dt)) return;
    const p = this.player;
    const dx = p.x - this.x;
    const sees = !p.dead && Math.abs(dx) < 110 && Math.abs(p.y - this.y) < 28;
    if (sees) {
      if (!this.alert) this.scene.popup(this.x, this.y - 22, 'HEY!', 0xff5050);
      this.alert = true;
      this.dir = Math.sign(dx) || this.dir;
    } else {
      this.alert = false;
    }
    const b = this.body;
    let speed = this.alert ? 85 : 38;
    if ((this.dir < 0 && b.blocked.left) || (this.dir > 0 && b.blocked.right)) {
      this.dir *= -1;
    } else if (b.blocked.down && !this.floorAhead(this.dir)) {
      if (this.alert) speed = 0;
      else this.dir *= -1;
    }
    b.setVelocityX(this.dir * speed);
    this.setFlipX(this.dir < 0);
    this.walk += (Math.abs(b.velocity.x) * dt) / 1000;
    this.setFrame(this.alert ? 'g2' : Math.floor(this.walk / 6) % 2 ? 'g1' : 'g0');
  }
}

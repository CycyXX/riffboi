// Unified keyboard + gamepad + touch input with per-frame "pressed" / "released" edges.
import { touchState } from './touch.js';

const BINDINGS = {
  left: ['LEFT', 'A'],
  right: ['RIGHT', 'D'],
  down: ['DOWN', 'S'],
  jump: ['SPACE', 'UP', 'W', 'Z'],
  attack: ['X', 'J'],
  solo: ['C', 'K'],
  pause: ['ESC', 'P'],
};

export default class Controls {
  constructor(scene) {
    this.scene = scene;
    const names = [...new Set(Object.values(BINDINGS).flat())].join(',');
    this.keys = scene.input.keyboard.addKeys(names);
    this.prev = {};
    for (const a in BINDINGS) {
      this[a] = false;
      this[a + 'Pressed'] = false;
      this[a + 'Released'] = false;
    }
  }

  pad() {
    const gp = this.scene.input.gamepad;
    return gp && gp.total > 0 ? gp.pad1 : null;
  }

  update() {
    const p = this.pad();
    const ax = p ? p.leftStick.x : 0;
    const ay = p ? p.leftStick.y : 0;
    const padState = p
      ? {
          left: p.left || ax < -0.4,
          right: p.right || ax > 0.4,
          down: p.down || ay > 0.5,
          jump: p.A,
          attack: p.X || p.B,
          solo: p.Y || p.R1 > 0.5,
          pause: p.buttons[9] && p.buttons[9].pressed,
        }
      : {};
    for (const a in BINDINGS) {
      const held = BINDINGS[a].some((k) => this.keys[k].isDown) || !!padState[a] || touchState[a];
      this[a + 'Pressed'] = held && !this.prev[a];
      this[a + 'Released'] = !held && !!this.prev[a];
      this[a] = held;
      this.prev[a] = held;
    }
  }
}

// Virtual gamepad for phones. The HUD scene draws the buttons and polls the active
// pointers each frame; Controls reads `touchState` alongside keyboard and gamepad.
import { GAME_W, GAME_H } from './config.js';

export const isTouch = typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

export const touchState = { left: false, right: false, down: false, jump: false, attack: false, solo: false, pause: false };

// Drawn radius `r`; touches count within r * 1.5 so thumbs don't have to be precise.
export const TOUCH_BUTTONS = [
  { id: 'left', x: 28, y: GAME_H - 30, r: 21, label: '<' },
  { id: 'right', x: 80, y: GAME_H - 30, r: 21, label: '>' },
  { id: 'attack', x: GAME_W - 82, y: GAME_H - 24, r: 19, label: 'RIFF' },
  { id: 'jump', x: GAME_W - 30, y: GAME_H - 40, r: 23, label: 'JUMP' },
  { id: 'solo', x: GAME_W - 30, y: GAME_H - 92, r: 15, label: 'SOLO' },
  { id: 'pause', x: 16, y: 46, r: 11, label: 'II' },
];

export function pollTouch(pointers) {
  for (const k in touchState) touchState[k] = false;
  for (const p of pointers) {
    if (!p.isDown || p.wasTouch === false) continue;
    let best = null;
    let bestD = Infinity;
    for (const b of TOUCH_BUTTONS) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < b.r * 1.5 && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    // Sliding the thumb across the bottom-left area still steers (no dead zone between arrows).
    if (!best && p.x < 130 && p.y > GAME_H - 100) best = TOUCH_BUTTONS[p.x < 54 ? 0 : 1];
    if (best) touchState[best.id] = true;
  }
}

import Phaser from 'phaser';
import { GAME_W, GAME_H, GRAVITY } from './config.js';
import { audio } from './audio/index.js';
import { isTouch } from './touch.js';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import GameScene from './scenes/GameScene.js';
import HUDScene from './scenes/HUDScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import VictoryScene from './scenes/VictoryScene.js';

const debug = new URLSearchParams(location.search).has('debug');

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0b0710',
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: GRAVITY }, debug, tileBias: 24 },
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: true, activePointers: 4 },
  scene: [BootScene, TitleScene, GameScene, HUDScene, GameOverScene, VictoryScene],
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') audio.toggleMute();
});

// Offline support for the deployed build (not in dev, where it would cache stale modules).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      // The first visit loads the game before the worker is active, so cache those files now.
      const urls = performance
        .getEntriesByType('resource')
        .map((r) => r.name)
        .filter((u) => u.startsWith(location.origin));
      return caches.open('riffboi-v1').then((c) => c.addAll(urls));
    })
    .catch(() => {});
}

// Phones: go fullscreen + landscape on the first tap (must run inside a real DOM gesture).
if (isTouch) {
  const goFullscreen = () => {
    if (audio.started) audio.synth.resume();
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
      .catch(() => {});
  };
  window.addEventListener('touchend', goFullscreen, { passive: true });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}

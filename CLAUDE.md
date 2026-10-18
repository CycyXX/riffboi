# RiffBoi

Rock/metal jump'n'run built with **Phaser 3 + Vite**. All graphics and audio are generated in code. There are no asset files.

## Run
- `npm install` once, then `npm run dev` and open the printed URL.
- `npm run build` writes a static build to `dist/`.
- `npm run smoke -- <dir>` runs headless Edge/Chrome through the whole level with scripted input and teleports. It prints PASS/FAIL checks plus any console errors, and saves screenshots to `<dir>`.
- URL flags: `?debug` shows arcade physics bodies. `?autostart` skips the "click to rock" screen; this only works with audio autoplay allowed.

## Architecture
- `src/config.js`: every tunable (BPM, beat window, player physics, shred, depths).
- `src/audio/`: `Synth` (Web Audio instruments + SFX), `Music` (lookahead step sequencer **and the beat clock**), and `index.js` (singleton `audio`, created on first user gesture).
  - Gameplay timing comes only from `audio.music`, via `beatPos()`, `beat()`, `phase()` and `isOnBeat()`. `GameScene.tickBeat()` turns it into `onBeat(k)` calls on every entity.
  - Riffs use a 16th-note token notation (see the comment in `Music.js`).
- `src/gfx/TextureFactory.js`: draws every sprite onto canvas textures with named frames. `font.js` is the 5x7 pixel font, registered as the RetroFont `pixfont`; use the `text()` helper in `src/ui.js`.
- `src/world/levelData.js`: a level builder DSL, one block per section (`section/ground/fill/obj`). Section configs carry music layers and crowd volume.
- `src/scenes/GameScene.js`: map, groups, colliders, combat, scoring, set-piece triggers and juice (popups, hit-stop, slow-mo).
- `src/entities/`: `Player`, `Shot`, and `enemies/*` (all extend `Enemy`; `Producer` is the boss).
- `src/world/`: set pieces `Pyro`, `Moshpit` (Mosher), `CrowdSurf` (SurfHands toss physics) and `WallOfDeath`.

## Gotchas
- Phaser physics groups overwrite body settings when an object is added. Always `group.add(obj)` **before** configuring the body; the `Shot`/`Enemy` constructors follow this order.
- Pass the single sprite first in `physics.add.overlap(sprite, group, cb)`. With the group first, Phaser swaps the callback argument order.
- Crowd-surf tosses compute their velocity from gravity, so changing `GRAVITY` or `PLAYER.fallExtraGravity` stays consistent automatically.

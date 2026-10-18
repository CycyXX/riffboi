// Global tunables. Tweak here to change game feel.

export const GAME_W = 480;
export const GAME_H = 270;
export const TILE = 16;

export const BPM = 140;
export const BEAT_SEC = 60 / BPM;
// Seconds either side of a beat that still count as "ON BEAT".
export const BEAT_WINDOW = 0.085;

export const GRAVITY = 900;

export const PLAYER = {
  runSpeed: 140,
  accelGround: 1500,
  turnAccel: 2600,
  dragGround: 1800,
  accelAir: 1000,
  dragAir: 500,
  fallExtraGravity: 300,
  jumpVel: 330,
  beatJumpVel: 390,
  doubleJumpVel: 300,
  beatDoubleJumpVel: 340,
  maxFall: 430,
  wallSlideSpeed: 60,
  wallJumpVX: 170,
  wallJumpVY: 310,
  coyoteMs: 90,
  bufferMs: 120,
  shotCooldown: 170,
  chargeMs: 550,
  invulnMs: 1300,
  pyroBoostVel: 470,
  maxPicks: 3,
};

export const SHRED = {
  max: 100,
  onBeat: 6,
  onBeatMove: 2,
  hit: 2,
  kill: 10,
  stomp: 8,
  soloBeats: 16,
};

export const DEPTH = {
  bg: -100,
  lights: -60,
  crowdBg: -40,
  decor: -10,
  tiles: 0,
  props: 5,
  enemies: 10,
  player: 20,
  shots: 25,
  fx: 30,
  ui: 50,
};

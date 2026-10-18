// Level "Club Gig — Night at The Rusty Amp", built section by section.
// Coordinates inside a section are in tiles, relative to that section's left edge.
// Rows: 0 (top) .. 16 (bottom). The stage floor surface is row 15.
//
// Grid chars:  # stage/floor   B brick   = scaffold (one-way)   A amp stack
//              C flight case   H barricade   . empty
import { TILE } from '../config.js';

export const T = { STAGE: 0, FILL: 1, BRICK: 2, SCAFF: 3, AMPHEAD: 4, AMPCAB: 5, CASE: 6, BARRIER: 7 };
export const SOLID_TILES = [T.STAGE, T.FILL, T.BRICK, T.AMPHEAD, T.AMPCAB, T.CASE, T.BARRIER];
export const ONEWAY_TILES = [T.SCAFF];
export const AMP_TILES = [T.AMPHEAD, T.AMPCAB];

const H = 17;

class Builder {
  constructor() {
    this.grid = [];
    this.objects = [];
    this.sections = [];
    this.x0 = 0;
  }

  get width() {
    return this.grid.length;
  }

  section(name, width, opts = {}) {
    this.x0 = this.width;
    for (let i = 0; i < width; i++) this.grid.push(new Array(H).fill('.'));
    this.sections.push({ name, x: this.x0 * TILE, ...opts });
    return this;
  }

  // world px of a section-relative tile column (left edge)
  px(tx) {
    return (this.x0 + tx) * TILE;
  }

  fill(x, y, w, h, ch) {
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        const cx = this.x0 + x + i;
        const cy = y + j;
        if (this.grid[cx] && cy >= 0 && cy < H) this.grid[cx][cy] = ch;
      }
    }
    return this;
  }

  ground(x, w, top = 15) {
    return this.fill(x, top, w, H - top, '#');
  }

  // Object standing on top of row y+1 (x = tile centre, y = bottom of tile row y).
  obj(type, x, y, props = {}) {
    this.objects.push({ type, x: (this.x0 + x) * TILE + TILE / 2, y: (y + 1) * TILE, ...props });
    return this;
  }

  tileAt(x, y) {
    const ch = this.grid[x][y];
    const above = y > 0 ? this.grid[x][y - 1] : '.';
    switch (ch) {
      case '#': return above === '#' ? T.FILL : T.STAGE;
      case 'B': return T.BRICK;
      case '=': return T.SCAFF;
      case 'A': return above === 'A' ? T.AMPCAB : T.AMPHEAD;
      case 'C': return T.CASE;
      case 'H': return T.BARRIER;
      default: return -1;
    }
  }

  build() {
    const data = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) row.push(this.tileAt(x, y));
      data.push(row);
    }
    const ascii = [];
    for (let y = 0; y < H; y++) ascii.push(this.grid.map((col) => col[y]).join(''));
    return { width: this.width, height: H, data, objects: this.objects, sections: this.sections, ascii };
  }
}

export function buildLevel() {
  const b = new Builder();

  // ------------------------------------------------------------ 1. BACKSTAGE (tutorial)
  b.section('BACKSTAGE', 64, { music: { song: 'main', drums: 1, bass: true, rhythm: false }, crowd: 0.04 });
  b.fill(0, 0, 1, H, 'B');
  b.ground(0, 11).ground(14, 22).ground(40, 24);
  b.obj('player', 3, 14);
  b.obj('sign', 6, 14, {
    text: 'ARROWS / WASD: MOVE\nSPACE: JUMP  (HOLD = HIGHER)',
    touchText: '< > BUTTONS: MOVE\nJUMP BUTTON: JUMP  (HOLD = HIGHER)',
  });
  b.obj('sign', 16, 14, { text: 'PRESS JUMP AGAIN IN MID-AIR\nTO KICKFLIP (DOUBLE JUMP)' });
  b.fill(21, 11, 5, 4, 'C');
  b.obj('pick', 22, 9).obj('pick', 23, 9).obj('pick', 24, 9);
  b.obj('sign', 29, 14, {
    text: 'X / J: FIRE A RIFF\nHOLD + RELEASE: POWER CHORD',
    touchText: 'RIFF BUTTON: FIRE A RIFF\nHOLD + RELEASE: POWER CHORD',
  });
  b.obj('guard', 33, 14);
  b.obj('pick', 37, 11).obj('pick', 38, 11);
  b.obj('sign', 42, 14, { text: 'ATTACK ON THE BEAT (WATCH THE BEAT BAR)\nFOR 2X DAMAGE + COMBO MULTIPLIER.\nOFF-BEAT ATTACKS BREAK YOUR COMBO!' });
  b.fill(45, 11, 4, 1, '=').obj('can', 46, 10);
  b.obj('guard', 50, 14);
  b.obj('sign', 53, 14, { text: 'STOMP ENEMIES FROM ABOVE!\nPUSH INTO WALLS TO SLIDE + WALL-JUMP' });
  b.fill(57, 9, 7, 6, 'B');
  b.obj('pick', 59, 8).obj('pick', 61, 8);

  // ------------------------------------------------------------ 2. MERCH ALLEY
  b.section('MERCH ALLEY', 56, { music: { song: 'main', drums: 2, bass: true, rhythm: true }, crowd: 0.1 });
  b.ground(0, 18).ground(22, 16).ground(42, 14);
  b.fill(4, 13, 4, 2, 'C');
  b.obj('poser', 5, 12);
  b.obj('pick', 9, 12).obj('pick', 10, 12);
  b.fill(12, 11, 3, 4, 'C');
  b.obj('poser', 13, 10);
  b.fill(19, 12, 2, 1, '=');
  b.obj('pick', 19, 10).obj('pick', 20, 10);
  b.obj('sign', 24, 14, { text: 'BOUNCE ON SPEAKERS!\nLAND ON THE BEAT TO FLY HIGHER' });
  b.obj('speaker', 27, 14);
  b.fill(26, 5, 8, 1, '=');
  b.obj('pick', 27, 4).obj('pick', 29, 4).obj('pick', 31, 4).obj('can', 33, 4);
  b.obj('bat', 35, 9);
  b.obj('poser', 45, 14);
  b.obj('guard', 49, 14);
  b.obj('checkpoint', 53, 14);

  // ------------------------------------------------------------ 3. THE PIT (moshpit)
  b.section('THE PIT', 60, { music: { song: 'pit', drums: 3, bass: true, rhythm: true }, crowd: 0.35 });
  b.ground(0, 60);
  b.obj('sign', 2, 14, { text: 'MOSHPIT! THE CROWD WILL SHOVE YOU AROUND.\nRIFF THEM TO HYPE THEM UP (+POINTS)' });
  b.fill(6, 13, 1, 2, 'H').fill(44, 13, 1, 2, 'H');
  const zone = [b.px(7), b.px(44)];
  for (let i = 0; i < 11; i++) b.obj('mosher', 9 + Math.round(i * 3.3), 14, { zone });
  b.fill(13, 10, 4, 1, '=').fill(24, 9, 5, 1, '=').fill(35, 10, 4, 1, '=');
  b.obj('pick', 14, 9).obj('pick', 15, 9).obj('pick', 37, 9);
  b.obj('poser', 26, 8);
  b.obj('bat', 19, 6).obj('bat', 31, 6);
  b.obj('roadie', 50, 14);
  b.obj('can', 54, 14);
  b.obj('checkpoint', 57, 14);

  // ------------------------------------------------------------ 4. PYRO GAUNTLET
  b.section('PYRO GAUNTLET', 72, { music: { song: 'pyro', drums: 3, bass: true, rhythm: true }, crowd: 0.3 });
  b.ground(0, 72);
  b.obj('sign', 2, 14, { text: 'PYRO FIRES ON EVERY 4TH BEAT - WATCH FOR SPARKS!\nJUMP INTO A BLAST MID-AIR FOR A PYRO BOOST' });
  b.obj('pyro', 7, 14, { offset: 0 }).obj('pyro', 13, 14, { offset: 2 });
  b.obj('pyro', 19, 14, { offset: 0 }).obj('pyro', 25, 14, { offset: 2 });
  b.fill(10, 13, 2, 2, 'A').fill(22, 13, 2, 2, 'A');
  b.fill(5, 7, 5, 1, '=');
  b.obj('pick', 6, 6).obj('pick', 7, 6).obj('pick', 8, 6);
  b.fill(15, 6, 7, 1, '=');
  b.obj('poser', 17, 5).obj('can', 20, 5);
  b.obj('guard', 16, 14);
  b.obj('sign', 29, 14, { text: 'BLAST AN AMP WITH A POWER CHORD:\nTHE SHOCKWAVE STUNS NEARBY ENEMIES' });
  b.fill(33, 13, 2, 2, 'A');
  b.obj('guard', 38, 14).obj('guard', 42, 14);
  b.obj('pyro', 44, 14, { offset: 0 });
  b.fill(46, 10, 2, 5, 'A');
  b.obj('pick', 46, 8).obj('pick', 47, 8);
  b.obj('pyro', 51, 14, { offset: 2 }).obj('pyro', 57, 14, { offset: 0 });
  b.fill(53, 11, 3, 1, '=');
  b.obj('bat', 54, 7).obj('bat', 61, 8);
  b.obj('roadie', 64, 14);
  b.obj('checkpoint', 69, 14);

  // ------------------------------------------------------------ 5. WALL OF DEATH
  b.section('WALL OF DEATH', 38, { music: { song: 'pit', drums: 3, bass: true, rhythm: true }, crowd: 0.45 });
  b.ground(0, 38);
  b.fill(11, 13, 2, 2, 'A').fill(25, 13, 2, 2, 'A');
  b.obj('wod', 10, 14, { left: b.px(4), right: b.px(34) });
  b.obj('pick', 11, 11).obj('pick', 26, 11);

  // ------------------------------------------------------------ 6. CROWD SURF
  b.section('CROWD SURF', 52, { music: { song: 'main', drums: 3, bass: true, rhythm: true }, crowd: 0.5 });
  b.ground(0, 5).ground(46, 6);
  b.obj('checkpoint', 1, 14);
  b.obj('sign', 3, 14, { text: 'CROWD SURF! JUMP ONTO THE HANDS -\nTHE CROWD PASSES YOU ALONG' });
  for (let x = 5; x < 46; x++) b.obj('crowdDecor', x, 16);
  const handsY = 12;
  b.obj('hands', 8, handsY, { w: 3, to: [b.px(14) + 8, 13 * TILE] });
  b.obj('hands', 14, handsY, { w: 3, to: [b.px(20) + 8, 13 * TILE] });
  b.obj('hands', 20, handsY, { w: 3, to: [b.px(27), 13 * TILE] });
  b.obj('hands', 27, handsY, { w: 8, hold: true });
  b.obj('hands', 35, handsY, { w: 3, to: [b.px(41) + 8, 13 * TILE] });
  b.obj('hands', 41, handsY, { w: 3, to: [b.px(48) + 8, 15 * TILE] });
  b.obj('pick', 11, 9).obj('pick', 17, 9).obj('pick', 23, 9).obj('pick', 38, 9);
  b.obj('bat', 17, 6).obj('bat', 31, 7).obj('bat', 38, 6);
  b.obj('can', 49, 14);

  // ------------------------------------------------------------ 7. STAGE DIVE
  b.section('STAGE DIVE', 44, { music: { song: 'pyro', drums: 3, bass: true, rhythm: true }, crowd: 0.55 });
  b.ground(0, 27);
  b.fill(6, 13, 3, 2, 'C').fill(10, 11, 3, 4, 'C');
  b.fill(14, 9, 13, 8, '#');
  b.fill(16, 7, 2, 2, 'A').fill(23, 7, 2, 2, 'A');
  b.obj('pyro', 20, 8, { offset: 0 });
  b.obj('guard', 21, 8);
  b.obj('sign', 15, 8, { text: 'RUN TO THE EDGE OF THE STAGE AND...\nSTAGE DIVE!!!' });
  b.obj('dive', 27, 8);
  for (let x = 27; x < 44; x++) b.obj('crowdDecor', x, 16);
  b.obj('hands', 32, handsY, { w: 8, to: [b.px(39) + 8, 13 * TILE] });
  b.obj('hands', 39, handsY, { w: 3, to: [b.px(48) + 8, 15 * TILE] });

  // ------------------------------------------------------------ 8. BOSS
  b.section('THE PRODUCER', 34, { crowd: 0.3 });
  b.ground(0, 34);
  b.fill(33, 0, 1, H, 'B');
  b.obj('checkpoint', 2, 14);
  b.fill(7, 11, 4, 1, '=').fill(23, 11, 4, 1, '=').fill(14, 8, 5, 1, '=');
  b.obj('boss', 18, 6, { left: b.px(3), right: b.px(33), trigger: b.px(7) });
  b.obj('can', 16, 7);

  return b.build();
}

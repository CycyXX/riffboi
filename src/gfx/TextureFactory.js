// Every sprite in the game is drawn here, in code, onto canvas textures.
import Phaser from 'phaser';
import { FONT_CHARS, drawGlyphText } from './font.js';

const P = {
  skin: '#f1c09a',
  skinShade: '#c98e6b',
  hair: '#17111c',
  hairHi: '#3b2c46',
  jacket: '#22222c',
  jacketHi: '#44445a',
  stud: '#d8d8e0',
  shirt: '#b3202a',
  jeans: '#2f4c8c',
  jeansShade: '#22376a',
  boot: '#120e16',
  gtr: '#d8222e',
  gtrHi: '#ff6a5a',
  gtrDark: '#7a0e16',
  neck: '#7a4a22',
  metal: '#c0c4cc',
  shades: '#08080c',
};

function canvas(scene, key, w, h) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  const R = (x, y, ww, hh, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), ww, hh);
  };
  return { tex, ctx, R };
}

// Draw a pixel-mask (array of strings) with a palette map.
function mask(R, ox, oy, rows, pal) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (c) R(ox + x, oy + y, 1, 1, c);
    }
  });
}

function arcPx(R, cx, cy, r, a0, a1, col, thick = 1) {
  for (let a = a0; a <= a1; a += 0.04) {
    for (let t = 0; t < thick; t++) {
      R(cx + Math.cos(a) * (r - t), cy + Math.sin(a) * (r - t), 1, 1, col);
    }
  }
}

export function generateTextures(scene) {
  makeFont(scene);
  makePlayer(scene);
  makeEnemies(scene);
  makeBoss(scene);
  makeCrowd(scene);
  makeTiles(scene);
  makeProps(scene);
  makeFx(scene);
  makeBackground(scene);
}

// ---------------------------------------------------------------- font
function makeFont(scene) {
  const chars = FONT_CHARS;
  const { tex, ctx } = canvas(scene, 'pixfont', chars.length * 6, 8);
  [...chars].forEach((ch, i) => drawGlyphText(ctx, ch, i * 6, 0, '#ffffff'));
  tex.refresh();
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: 'pixfont',
    width: 6,
    height: 8,
    chars,
    charsPerRow: chars.length,
    spacing: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    lineSpacing: 2,
  });
  scene.cache.bitmapFont.add('pixfont', data);
}

// ---------------------------------------------------------------- RiffBoi
const PLAYER_LEGS = ['stand', 'standb', 'run0', 'run1', 'run2', 'run3', 'jump', 'fall'];

function drawLegs(R, ox, L) {
  const J = P.jeans, JS = P.jeansShade, BT = P.boot;
  switch (L) {
    case 'run0':
      R(ox + 7, 16, 3, 5, JS); R(ox + 5, 20, 4, 3, BT);
      R(ox + 13, 16, 3, 4, J); R(ox + 15, 18, 3, 2, J); R(ox + 16, 20, 4, 3, BT);
      break;
    case 'run1':
      R(ox + 8, 16, 3, 3, JS); R(ox + 6, 18, 3, 2, JS); R(ox + 5, 19, 3, 2, BT);
      R(ox + 11, 16, 3, 6, J); R(ox + 11, 21, 4, 3, BT);
      break;
    case 'run2':
      R(ox + 7, 16, 3, 5, J); R(ox + 5, 20, 4, 3, BT);
      R(ox + 13, 16, 3, 4, JS); R(ox + 15, 18, 3, 2, JS); R(ox + 16, 20, 4, 3, BT);
      break;
    case 'run3':
      R(ox + 11, 16, 3, 6, JS); R(ox + 11, 21, 4, 3, BT);
      R(ox + 13, 16, 3, 3, J); R(ox + 14, 18, 3, 2, J); R(ox + 15, 19, 3, 2, BT);
      break;
    case 'jump':
      R(ox + 8, 16, 3, 3, JS); R(ox + 7, 18, 4, 3, BT);
      R(ox + 13, 16, 3, 3, J); R(ox + 14, 18, 3, 2, J); R(ox + 15, 19, 4, 2, BT);
      break;
    case 'fall':
      R(ox + 8, 16, 3, 5, JS); R(ox + 7, 21, 4, 3, BT);
      R(ox + 14, 16, 3, 5, J); R(ox + 15, 20, 4, 3, BT);
      break;
    default:
      R(ox + 9, 16, 3, 6, JS); R(ox + 13, 16, 3, 6, J);
      R(ox + 8, 21, 4, 3, BT); R(ox + 13, 21, 4, 3, BT);
  }
}

function flyingV(R, cx, cy) {
  // Wings point backwards (left); (cx, cy) is the joint near the neck.
  for (let i = 0; i < 6; i++) {
    const s = Math.floor(i * 0.6);
    R(cx - i, cy - 1 - s, 1, 2, P.gtr);
    R(cx - i, cy + s, 1, 2, P.gtr);
  }
  R(cx - 1, cy - 1, 3, 3, P.gtr);
  R(cx - 5, cy - 4, 2, 1, P.gtrHi);
  R(cx - 5, cy + 4, 2, 1, P.gtrDark);
  R(cx - 1, cy, 2, 1, '#2a2a2a');
}

function drawRiffBoi(R, ox, legs, shoot) {
  const y0 = legs === 'standb' ? 1 : legs === 'run1' || legs === 'run3' ? -1 : 0;
  const L = legs.startsWith('stand') ? 'stand' : legs;
  drawLegs(R, ox, L);
  // back hair
  R(ox + 6, 3 + y0, 3, 9, P.hair);
  R(ox + 5, 5 + y0, 1, 6, P.hair);
  R(ox + 6, 11 + y0, 2, 1, P.hairHi);
  // torso
  R(ox + 8, 9 + y0, 8, 7 - y0, P.jacket);
  R(ox + 11, 9 + y0, 3, 6 - y0, P.shirt);
  R(ox + 9, 10 + y0, 1, 4, P.jacketHi);
  R(ox + 8, 9 + y0, 1, 1, P.stud);
  R(ox + 15, 9 + y0, 1, 1, P.stud);
  R(ox + 8, 15, 8, 1, '#5a4630');
  R(ox + 11, 15, 2, 1, P.metal);
  // head
  R(ox + 9, 2 + y0, 6, 7, P.skin);
  R(ox + 8, 1 + y0, 8, 2, P.hair);
  R(ox + 8, 3 + y0, 2, 6, P.hair);
  R(ox + 14, 2 + y0, 2, 2, P.hair);
  R(ox + 9, 1 + y0, 3, 1, P.hairHi);
  R(ox + 11, 4 + y0, 4, 2, P.shades);
  R(ox + 14, 4 + y0, 1, 1, '#7a7a9a');
  R(ox + 12, 7 + y0, 2, 1, P.skinShade);
  // guitar + arms
  if (!shoot) {
    flyingV(R, ox + 10, 15 + y0);
    for (let i = 0; i < 11; i++) R(ox + 11 + i, 14 + y0 - Math.floor(i / 2), 1, 1, P.neck);
    R(ox + 20, 8 + y0, 2, 2, P.gtrDark);
    R(ox + 9, 11 + y0, 2, 3, P.jacket);
    R(ox + 10, 13 + y0, 2, 2, P.skin);
    R(ox + 14, 10 + y0, 3, 2, P.jacket);
    R(ox + 17, 10 + y0, 2, 2, P.skin);
  } else {
    flyingV(R, ox + 9, 13 + y0);
    R(ox + 11, 13 + y0, 11, 1, P.neck);
    R(ox + 21, 12 + y0, 2, 3, P.gtrDark);
    R(ox + 9, 11 + y0, 2, 2, P.jacket);
    R(ox + 10, 12 + y0, 2, 2, P.skin);
    R(ox + 14, 11 + y0, 4, 2, P.jacket);
    R(ox + 18, 12 + y0, 2, 2, P.skin);
  }
}

function makePlayer(scene) {
  const names = [];
  PLAYER_LEGS.forEach((l) => { names.push(l); names.push(l + '_s'); });
  const { tex, R } = canvas(scene, 'riffboi', names.length * 24, 24);
  names.forEach((n, i) => {
    const shoot = n.endsWith('_s');
    drawRiffBoi(R, i * 24, shoot ? n.slice(0, -2) : n, shoot);
    tex.add(n, 0, i * 24, 0, 24, 24);
  });
  tex.refresh();
}

// ---------------------------------------------------------------- enemies
function makeEnemies(scene) {
  // Security guard 20x24: g0/g1 walk, g2 alert
  {
    const { tex, R } = canvas(scene, 'guard', 60, 24);
    for (let f = 0; f < 3; f++) {
      const o = f * 20;
      const sk = '#b07850';
      // legs
      const lo = f === 1 ? 1 : 0;
      R(o + 6, 16, 4, 5 - lo, '#2a2a2e'); R(o + 11, 16, 4, 5 + lo - 1, '#2a2a2e');
      R(o + 5, 21 - lo, 5, 3, '#0c0c0c'); R(o + 11, 20 + lo, 5, 3, '#0c0c0c');
      // body
      R(o + 4, 8, 13, 9, '#141416');
      R(o + 5, 10, 11, 3, '#e8c020');
      R(o + 6, 11, 9, 1, '#141416');
      // arms (crossed when idle, reaching when alert)
      if (f === 2) {
        R(o + 15, 9, 5, 3, sk);
        R(o + 2, 9, 2, 6, sk);
      } else {
        R(o + 2, 9, 2, 7, sk); R(o + 17, 9, 2, 7, sk);
        R(o + 5, 14, 11, 2, sk);
      }
      // head
      R(o + 7, 1, 7, 7, sk);
      R(o + 7, 1, 7, 1, '#9a6440');
      R(o + 8, 3, 6, 2, '#000');
      R(o + 13, 3, 1, 1, '#555');
      R(o + 9, 6, 4, 1, f === 2 ? '#600' : '#7a4a30');
      R(o + 6, 4, 1, 2, '#333');
      tex.add('g' + f, 0, o, 0, 20, 24);
    }
    tex.refresh();
  }
  // Poser 16x24: p0 idle, p1 singing
  {
    const { tex, R } = canvas(scene, 'poser', 32, 24);
    for (let f = 0; f < 2; f++) {
      const o = f * 16;
      R(o + 5, 16, 2, 6, '#111'); R(o + 9, 16, 2, 6, '#111');
      mask(R, o + 4, 21, ['######..', '#.#.##.#', '..##.###'], { '#': '#eee' });
      for (let y = 8; y < 16; y++) R(o + 4, y, 8, 1, y % 2 ? '#ff4fa0' : '#141414');
      R(o + 5, 2, 6, 6, '#f6cfb0');
      mask(R, o + 3, -1, ['.#.#.#.', '#######', '##...##'], { '#': '#3dff6a' });
      R(o + 7, 4, 1, 1, '#000'); R(o + 9, 4, 1, 1, '#000');
      R(o + 8, 6, 2, 1, f ? '#300' : '#c88');
      if (f) {
        R(o + 11, 6, 3, 2, '#f6cfb0');
        R(o + 12, 4, 2, 2, '#bbb');
        R(o + 12, 3, 2, 1, '#666');
      } else {
        R(o + 11, 9, 2, 5, '#f6cfb0');
        R(o + 11, 13, 2, 2, '#bbb');
      }
      R(o + 3, 9, 1, 5, '#f6cfb0');
      tex.add('p' + f, 0, o, 0, 16, 24);
    }
    tex.refresh();
  }
  // Feedback bat 20x14: speaker-cone body
  {
    const { tex, R } = canvas(scene, 'bat', 40, 14);
    for (let f = 0; f < 2; f++) {
      const o = f * 20;
      const wing = '#7a2ad0';
      if (f === 0) {
        mask(R, o, 1, ['##.......', '###......', '.####....', '..####...', '...###...'], { '#': wing });
        mask(R, o + 11, 1, ['.......##', '......###', '....####.', '...####..', '...###...'], { '#': wing });
      } else {
        mask(R, o, 6, ['...###...', '.#####...', '####.....', '##.......'], { '#': wing });
        mask(R, o + 11, 6, ['...###...', '...#####.', '.....####', '.......##'], { '#': wing });
      }
      R(o + 6, 3, 8, 8, '#222');
      R(o + 7, 4, 6, 6, '#555');
      R(o + 8, 5, 4, 4, '#888');
      R(o + 9, 6, 2, 2, '#222');
      R(o + 7, 2, 2, 2, '#ff2020'); R(o + 11, 2, 2, 2, '#ff2020');
      R(o + 8, 11, 1, 2, '#fff'); R(o + 11, 11, 1, 2, '#fff');
      tex.add('bat' + f, 0, o, 0, 20, 14);
    }
    tex.refresh();
  }
  // Roadie 18x24: r0/r1 walk, r2 throw
  {
    const { tex, R } = canvas(scene, 'roadie', 54, 24);
    for (let f = 0; f < 3; f++) {
      const o = f * 18;
      const lo = f === 1 ? 1 : 0;
      R(o + 5, 16, 4, 5, '#3a3a2a'); R(o + 10, 16, 4, 5, '#3a3a2a');
      R(o + 4, 21 - lo, 5, 3, '#2a1a0a'); R(o + 10, 20 + lo, 5, 3, '#2a1a0a');
      R(o + 3, 8, 12, 9, '#1c1c22');
      R(o + 5, 11, 8, 2, '#ffcc33');
      R(o + 6, 2, 6, 6, '#e0a880');
      R(o + 5, 0, 8, 3, '#c8202a');
      R(o + 11, 2, 4, 1, '#c8202a');
      R(o + 6, 6, 6, 3, '#5a3a20');
      R(o + 9, 4, 1, 1, '#000'); R(o + 11, 4, 1, 1, '#000');
      if (f === 2) {
        R(o + 13, 2, 3, 7, '#1c1c22'); R(o + 14, 0, 3, 3, '#e0a880');
      } else {
        R(o + 1, 9, 3, 6, '#1c1c22');
        R(o + 0, 13, 5, 5, '#e07818');
        R(o + 1, 14, 3, 3, '#1c1c22');
      }
      tex.add('r' + f, 0, o, 0, 18, 24);
    }
    tex.refresh();
  }
}

// ---------------------------------------------------------------- boss
function makeBoss(scene) {
  const W = 72, H = 60;
  const { tex, ctx, R } = canvas(scene, 'boss', W * 2, H);
  for (let f = 0; f < 2; f++) {
    const o = f * W;
    // headphones band
    R(o + 22, 2, 28, 3, '#111');
    // head
    R(o + 26, 4, 20, 18, '#e8b48c');
    R(o + 25, 3, 22, 4, '#1a1a1a');
    R(o + 25, 3, 22, 1, '#3a3a3a');
    // headphone cups
    R(o + 19, 8, 7, 12, '#111'); R(o + 46, 8, 7, 12, '#111');
    R(o + 20, 9, 5, 10, f ? '#7ff' : '#2bd');
    R(o + 47, 9, 5, 10, f ? '#7ff' : '#2bd');
    // autotune visor
    R(o + 26, 10, 20, 4, f ? '#ffffff' : '#33ffee');
    R(o + 26, 14, 20, 1, '#118877');
    // grin with gold teeth
    R(o + 31, 17, 10, 3, '#300');
    for (let i = 0; i < 5; i++) R(o + 32 + i * 2, 17, 1, 1, '#ffd84a');
    if (f) R(o + 31, 18, 10, 2, '#600');
    // suit
    R(o + 16, 22, 40, 16, '#5a2a8a');
    R(o + 33, 22, 6, 16, '#eee');
    R(o + 35, 22, 2, 10, '#c8202a');
    R(o + 24, 26, 24, 1, '#ffd84a');
    R(o + 26, 27, 20, 1, '#ffd84a');
    R(o + 34, 28, 4, 3, '#ffd84a');
    // desk
    R(o + 2, 36, 68, 6, '#4c4c62');
    R(o + 2, 36, 68, 1, '#7c7c96');
    R(o + 6, 42, 60, 18, '#2c2c3a');
    R(o + 6, 42, 60, 1, '#111');
    for (let i = 0; i < 10; i++) {
      const x = o + 8 + i * 6;
      R(x + 1, 44, 1, 9, '#0a0a0a');
      R(x, 45 + ((i * 7) % 7), 3, 2, '#ddd');
      const led = i < 6 ? '#3f3' : i < 8 ? '#ff3' : '#f33';
      R(x, 38, 3, 2, f || i % 3 ? led : '#333');
    }
    drawGlyphText(ctx, 'AUTO-TUNE', o + 10, 53 - 2, '#ffd84a');
    // hands on the desk
    R(o + 12, 33, 6, 4, '#e8b48c'); R(o + 54, 33, 6, 4, '#e8b48c');
    tex.add('boss' + f, 0, o, 0, W, H);
  }
  tex.refresh();
}

// ---------------------------------------------------------------- crowd
const CROWD_VARIANTS = [
  { skin: '#f1c09a', hair: '#17111c', shirt: '#141414', print: '#d02020', style: 'long' },
  { skin: '#c48a60', hair: '#ff3a3a', shirt: '#1a1a2a', print: '#f0f0f0', style: 'mohawk' },
  { skin: '#8a5a3a', hair: '#0a0a0a', shirt: '#2a0a0a', print: '#ffcc33', style: 'short' },
  { skin: '#f6d2b5', hair: '#e8d070', shirt: '#101820', print: '#33aaff', style: 'long' },
  { skin: '#e0a880', hair: '#3a2a1a', shirt: '#202020', print: '#3dff6a', style: 'cap' },
  { skin: '#6a4028', hair: '#2a1a2a', shirt: '#301040', print: '#ff4fa0', style: 'short' },
];

function drawCrowdMember(R, o, v, up) {
  const c = CROWD_VARIANTS[v];
  R(o + 3, 15, 3, 5, '#2a3a5a'); R(o + 6, 15, 3, 5, '#22304a');
  R(o + 2, 20, 4, 2, '#0a0a0a'); R(o + 6, 20, 4, 2, '#0a0a0a');
  R(o + 2, 8, 8, 8, c.shirt);
  R(o + 4, 10, 4, 3, c.print);
  R(o + 3, 2, 6, 6, c.skin);
  R(o + 5, 4, 1, 1, '#000'); R(o + 7, 4, 1, 1, '#000');
  R(o + 5, 6, 2, 1, up ? '#400' : c.skin);
  if (c.style === 'long') { R(o + 2, 1, 8, 2, c.hair); R(o + 2, 2, 2, 8, c.hair); R(o + 8, 2, 2, 8, c.hair); }
  else if (c.style === 'mohawk') R(o + 5, -1, 2, 4, c.hair);
  else if (c.style === 'cap') { R(o + 2, 1, 8, 2, '#c8202a'); R(o + 8, 2, 3, 1, '#c8202a'); }
  else R(o + 3, 1, 6, 2, c.hair);
  if (up) {
    R(o + 0, 1, 2, 8, c.skin); R(o + 10, 1, 2, 8, c.skin);
    R(o + 0, 0, 1, 1, c.skin); R(o + 11, 0, 1, 1, c.skin);
  } else {
    R(o + 1, 8, 1, 7, c.skin); R(o + 10, 8, 1, 7, c.skin);
  }
}

function makeCrowd(scene) {
  const n = CROWD_VARIANTS.length;
  const { tex, R } = canvas(scene, 'crowd', n * 2 * 12, 22);
  for (let v = 0; v < n; v++) {
    for (let f = 0; f < 2; f++) {
      const o = (v * 2 + f) * 12;
      drawCrowdMember(R, o, v, f === 1);
      tex.add(`c${v}_${f}`, 0, o, 0, 12, 22);
    }
  }
  tex.refresh();

  // Crowd-surf hands platforms: 3 tiles and 8 tiles wide, two frames each.
  for (const [key, w] of [['hands3', 48], ['hands8', 128]]) {
    const { tex: t2, R: R2 } = canvas(scene, key, w, 36);
    for (let f = 0; f < 2; f++) {
      const oy = f * 18;
      for (let x = 1, i = 0; x < w - 2; x += 4, i++) {
        const lift = (i + f) % 2;
        const sk = CROWD_VARIANTS[i % n].skin;
        R2(x, oy + 5 + lift, 3, 13 - lift, sk);
        R2(x, oy + 2 + lift, 3, 3, sk);
        if (i % 3 === 0) { R2(x - 1, oy + lift, 1, 2, sk); R2(x + 3, oy + lift, 1, 2, sk); }
        R2(x + 2, oy + 7 + lift, 1, 11 - lift, 'rgba(0,0,0,0.25)');
      }
      t2.add(f, 0, 0, oy, w, 18);
    }
    t2.refresh();
  }
}

// ---------------------------------------------------------------- tiles
function makeTiles(scene) {
  const { tex, R } = canvas(scene, 'tiles', 16 * 8, 16);
  const rnd = new Phaser.Math.RandomDataGenerator(['riffboi']);
  // 0: stage top (wood planks)
  R(0, 0, 16, 16, '#33241e');
  R(0, 0, 16, 2, '#7a5640');
  R(0, 2, 16, 1, '#1a120e');
  R(0, 7, 16, 1, '#241812');
  R(0, 12, 16, 1, '#241812');
  R(5, 3, 1, 4, '#241812'); R(11, 8, 1, 4, '#241812'); R(3, 13, 1, 3, '#241812');
  R(2, 4, 1, 1, '#9a7a60'); R(13, 9, 1, 1, '#9a7a60');
  // 1: fill (under-stage darkness)
  const o1 = 16;
  R(o1, 0, 16, 16, '#17101a');
  for (let i = 0; i < 10; i++) R(o1 + rnd.between(0, 15), rnd.between(0, 15), 1, 1, '#221a26');
  // 2: brick
  const o2 = 32;
  R(o2, 0, 16, 16, '#24101a');
  for (let y = 0; y < 16; y += 4) {
    const sh = (y / 4) % 2 ? 4 : 0;
    for (let x = -sh; x < 16; x += 8) {
      const x0 = Math.max(0, x), x1 = Math.min(16, x + 7);
      if (x1 > x0) { R(o2 + x0, y, x1 - x0, 3, '#4a1c26'); R(o2 + x0, y, x1 - x0, 1, '#5c2832'); }
    }
  }
  // 3: scaffold (one-way)
  const o3 = 48;
  R(o3, 0, 16, 3, '#9aa0aa');
  R(o3, 0, 16, 1, '#d8dce4');
  R(o3, 3, 16, 1, '#4a4e58');
  for (let i = 0; i < 6; i++) { R(o3 + i, 4 + i, 1, 1, '#5a5f6a'); R(o3 + 15 - i, 4 + i, 1, 1, '#5a5f6a'); }
  R(o3, 4, 1, 6, '#5a5f6a'); R(o3 + 15, 4, 1, 6, '#5a5f6a');
  // 4: amp head
  const o4 = 64;
  R(o4, 0, 16, 16, '#141414');
  R(o4, 0, 16, 1, '#2e2e2e');
  R(o4 + 1, 1, 14, 1, '#c9a24a'); R(o4 + 1, 14, 14, 1, '#c9a24a');
  R(o4 + 3, 4, 10, 3, '#e8e0c8');
  R(o4 + 4, 5, 8, 1, '#141414');
  for (let i = 0; i < 5; i++) R(o4 + 2 + i * 3, 10, 2, 2, '#dddddd');
  R(o4 + 14, 10, 1, 1, '#ff3030');
  // 5: amp cab (grille)
  const o5 = 80;
  R(o5, 0, 16, 16, '#0d0d0d');
  for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) R(o5 + x, y, 1, 1, (x + y) % 2 ? '#2a2420' : '#1d1916');
  R(o5 + 1, 1, 14, 1, '#c9a24a'); R(o5 + 1, 14, 14, 1, '#c9a24a');
  // 6: flight case
  const o6 = 96;
  R(o6, 0, 16, 16, '#1b1b22');
  R(o6, 0, 16, 2, '#9aa0aa'); R(o6, 14, 16, 2, '#7a808a');
  R(o6, 0, 2, 16, '#9aa0aa'); R(o6 + 14, 0, 2, 16, '#7a808a');
  R(o6, 0, 3, 3, '#e0e4ea'); R(o6 + 13, 0, 3, 3, '#e0e4ea');
  R(o6, 13, 3, 3, '#c0c4ca'); R(o6 + 13, 13, 3, 3, '#c0c4ca');
  R(o6 + 5, 7, 6, 2, '#5a5f6a');
  R(o6 + 4, 4, 2, 1, '#ffcc33'); R(o6 + 7, 4, 4, 1, '#ffcc33');
  // 7: barricade
  const o7 = 112;
  R(o7, 1, 16, 2, '#8a8f98'); R(o7, 13, 16, 2, '#6a6f78');
  for (let x = 1; x < 16; x += 3) R(o7 + x, 3, 1, 10, '#7a7f88');
  R(o7, 1, 16, 1, '#c8ccd4');
  for (let i = 0; i < 8; i++) tex.add(i, 0, i * 16, 0, 16, 16);
  tex.refresh();
}

// ---------------------------------------------------------------- props
function makeProps(scene) {
  {
    const { tex, R } = canvas(scene, 'speaker', 32, 16);
    mask(R, 0, 0, [
      '......########################..',
      '....############################',
      '..##############################',
      '################################',
    ], { '#': '#2a2a32' });
    R(0, 4, 32, 12, '#1d1d24');
    R(2, 5, 28, 9, '#2e2e38');
    for (let x = 3; x < 29; x += 2) R(x, 6, 1, 7, '#24242c');
    R(10, 6, 12, 7, '#555560'); R(12, 7, 8, 5, '#8a8a96'); R(14, 8, 4, 3, '#2a2a32');
    R(6, 1, 22, 1, '#55556a');
    R(27, 13, 2, 1, '#3f3');
    tex.refresh();
  }
  {
    const { tex, R } = canvas(scene, 'pyroBase', 16, 6);
    R(0, 1, 16, 5, '#2a2a30'); R(0, 1, 16, 1, '#6a6a78');
    for (let x = 1; x < 15; x += 4) R(x, 3, 2, 2, '#ff8a20');
    R(6, 0, 4, 1, '#111');
    tex.refresh();
  }
  {
    const { tex, R } = canvas(scene, 'mic', 24, 26);
    for (let f = 0; f < 2; f++) {
      const o = f * 12;
      R(o + 5, 6, 2, 17, '#9aa0aa');
      R(o + 1, 23, 10, 2, '#5a5f6a'); R(o + 0, 25, 3, 1, '#5a5f6a'); R(o + 9, 25, 3, 1, '#5a5f6a');
      R(o + 4, 1, 4, 5, '#2a2a2a'); R(o + 4, 1, 4, 1, '#bbb'); R(o + 4, 3, 4, 1, '#bbb');
      R(o + 7, 12, 3, 4, f ? '#3f3' : '#a22');
      if (f) R(o + 2, 9, 8, 1, '#ffcc33');
      tex.add('mic' + f, 0, o, 0, 12, 26);
    }
    tex.refresh();
  }
  {
    const { tex, ctx, R } = canvas(scene, 'sign', 18, 18);
    R(2, 13, 2, 5, '#5a3a20'); R(14, 13, 2, 5, '#5a3a20');
    R(0, 0, 18, 14, '#7a5a3a'); R(1, 1, 16, 12, '#1a1a1a');
    drawGlyphText(ctx, '?', 6, 3, '#ffcc33');
    tex.refresh();
  }
  {
    const { tex, R } = canvas(scene, 'pick', 9, 9);
    mask(R, 0, 0, [
      '.#######.', '#########', '#########', '.#######.', '.#######.', '..#####..', '..#####..', '...###...', '....#....',
    ], { '#': '#ffcf3a' });
    R(2, 1, 3, 1, '#fff6c0'); R(1, 2, 1, 1, '#fff6c0');
    R(4, 6, 3, 1, '#c8901a'); R(5, 7, 2, 1, '#c8901a');
    tex.refresh();
  }
  for (const [key, col, hi] of [['pickIcon', '#ff3a4a', '#ffb0b0'], ['pickEmpty', '#3a2030', '#5a3a4a']]) {
    const { tex, R } = canvas(scene, key, 9, 9);
    mask(R, 0, 0, [
      '.#######.', '#########', '#########', '.#######.', '.#######.', '..#####..', '..#####..', '...###...', '....#....',
    ], { '#': col });
    R(2, 1, 3, 1, hi);
    tex.refresh();
  }
  {
    const { tex, R } = canvas(scene, 'can', 7, 11);
    R(0, 1, 7, 10, '#22c060'); R(0, 0, 7, 1, '#c0c4cc'); R(0, 10, 7, 1, '#a0a4ac');
    R(1, 3, 5, 4, '#111'); R(2, 4, 3, 2, '#ffee33'); R(1, 1, 1, 9, '#7ff0a8');
    tex.refresh();
  }
}

// ---------------------------------------------------------------- fx + projectiles
function radial(scene, key, size, stops) {
  const { tex, ctx } = canvas(scene, key, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}

function makeFx(scene) {
  {
    const { tex, R } = canvas(scene, 'spark', 3, 3);
    R(1, 0, 1, 3, '#fff'); R(0, 1, 3, 1, '#fff');
    tex.refresh();
  }
  {
    const { tex, R } = canvas(scene, 'pixel', 4, 4);
    R(0, 0, 4, 4, '#fff');
    tex.refresh();
  }
  radial(scene, 'flame', 10, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]);
  radial(scene, 'smoke', 24, [[0, 'rgba(200,190,210,0.7)'], [1, 'rgba(200,190,210,0)']]);
  radial(scene, 'glow', 64, [[0, 'rgba(255,255,255,0.9)'], [0.3, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
  {
    const { tex, R } = canvas(scene, 'ring', 48, 48);
    arcPx(R, 24, 24, 22, 0, Math.PI * 2, '#fff', 2);
    tex.refresh();
  }
  {
    const { tex, R } = canvas(scene, 'star', 5, 5);
    mask(R, 0, 0, ['..#..', '.###.', '#####', '.###.', '.#.#.'], { '#': '#ffe040' });
    tex.refresh();
  }
  {
    const { tex, R } = canvas(scene, 'noteP', 6, 8);
    mask(R, 0, 0, ['..##..', '..#.#.', '..#..#', '..#...', '..#...', '###...', '###...', '.#....'], { '#': '#fff' });
    tex.refresh();
  }
  {
    // Player riff: sound-wave crescents
    const { tex, R } = canvas(scene, 'riff', 12, 16);
    arcPx(R, 0, 8, 10, -1.0, 1.0, '#ffffff', 2);
    arcPx(R, 0, 8, 6, -0.9, 0.9, '#ffffff', 1);
    tex.refresh();
  }
  {
    const { tex, R } = canvas(scene, 'power', 26, 34);
    arcPx(R, 0, 17, 24, -1.05, 1.05, '#ffffff', 3);
    arcPx(R, 0, 17, 18, -1.0, 1.0, '#ffffff', 2);
    arcPx(R, 0, 17, 12, -0.9, 0.9, '#ffffff', 2);
    tex.refresh();
  }
  {
    const { tex, R } = canvas(scene, 'note', 8, 10);
    mask(R, 0, 0, ['...##...', '...#.#..', '...#..#.', '...#....', '...#....', '.###....', '####....', '.##.....'], { '#': '#ff4fd0' });
    R(4, 8, 2, 2, 'rgba(255,79,208,0.4)');
    tex.refresh();
  }
  {
    const { tex, R } = canvas(scene, 'bossNote', 10, 10);
    mask(R, 0, 0, ['....##....', '...####...', '..######..', '.###..###.', '###....###', '###....###', '.###..###.', '..######..', '...####...', '....##....'], { '#': '#55fff0' });
    R(4, 4, 2, 2, '#fff');
    tex.refresh();
  }
  {
    const { tex, R } = canvas(scene, 'cable', 10, 10);
    arcPx(R, 5, 5, 4, 0, Math.PI * 2, '#ff8a20', 2);
    R(8, 7, 2, 3, '#222');
    tex.refresh();
  }
  {
    const { tex, R } = canvas(scene, 'stripe', 16, 4);
    for (let x = -4; x < 16; x += 4) for (let y = 0; y < 4; y++) R(x + y, y, 2, 1, '#ffcc00');
    tex.refresh();
  }
  {
    // spotlight cone
    const { tex, ctx } = canvas(scene, 'beam', 90, 260);
    const g = ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(41, 0);
    ctx.lineTo(49, 0);
    ctx.lineTo(90, 260);
    ctx.lineTo(0, 260);
    ctx.closePath();
    ctx.fill();
    tex.refresh();
  }
}

// ---------------------------------------------------------------- background
function makeBackground(scene) {
  {
    const W = 512, H = 270;
    const { tex, ctx, R } = canvas(scene, 'bgWall', W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0712');
    g.addColorStop(1, '#1d0f22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let y = 36; y < H; y += 8) {
      const sh = (y / 8) % 2 ? 8 : 0;
      for (let x = -sh; x < W; x += 16) R(x, y, 15, 7, 'rgba(70,30,50,0.28)');
    }
    const posters = [
      { x: 24, y: 70, w: 46, h: 62, c: '#a01c34', t: ['RIFF', 'BOI', 'LIVE'] },
      { x: 150, y: 84, w: 40, h: 50, c: '#c88a18', t: ['MOSH', 'PIT'] },
      { x: 262, y: 66, w: 50, h: 64, c: '#2a44a8', t: ['NO', 'AUTO', 'TUNE'] },
      { x: 400, y: 80, w: 52, h: 52, c: '#1c8a54', t: ['METAL', 'FEST'] },
    ];
    for (const p of posters) {
      R(p.x, p.y, p.w, p.h, p.c);
      R(p.x + 2, p.y + 2, p.w - 4, 1, 'rgba(255,255,255,0.3)');
      p.t.forEach((line, i) => drawGlyphText(ctx, line, p.x + 4, p.y + 6 + i * 10, 'rgba(255,255,255,0.85)'));
      R(p.x, p.y + p.h - 6, p.w, 6, 'rgba(0,0,0,0.35)');
    }
    // neon sign
    ctx.save();
    ctx.shadowColor = '#ff4fa0';
    ctx.shadowBlur = 8;
    drawGlyphText(ctx, 'ROCK', 330, 30 + 120, '#ff7cc0', 2);
    ctx.restore();
    ctx.fillStyle = 'rgba(10,5,14,0.45)';
    ctx.fillRect(0, 0, W, H);
    tex.refresh();
  }
  {
    // lighting truss strip, one PAR can per 96px
    const { tex, R } = canvas(scene, 'truss', 96, 36);
    R(0, 3, 96, 2, '#6a6f7a'); R(0, 13, 96, 2, '#4a4f5a');
    for (let x = 0; x < 96; x += 8) {
      for (let i = 0; i < 8; i++) R(x + i, 5 + Math.floor(i), 1, 1, '#555a66');
    }
    R(43, 15, 10, 3, '#222'); R(44, 18, 8, 12, '#1a1a1a'); R(45, 29, 6, 3, '#fffbe0'); R(46, 30, 4, 2, '#ffffff');
    tex.refresh();
  }
  {
    // silhouette crowd strip
    const W = 128, H = 48;
    const { tex, R } = canvas(scene, 'crowdSil', W, H);
    const rnd = new Phaser.Math.RandomDataGenerator(['crowd']);
    const col = '#1c0f26';
    for (let x = -4; x < W; x += 9) {
      const h = rnd.between(14, 22);
      const top = H - h - 12;
      R(x + 2, top, 7, 7, col);
      R(x, top + 7, 11, H - top - 7, col);
      if (rnd.frac() < 0.4) {
        R(x + 9, top - 10, 2, 12, col);
        R(x + 9, top - 12, 1, 2, col);
        R(x + 11, top - 12, 1, 2, col);
      }
    }
    tex.refresh();
  }
}

// Automated smoke test: boots the game in headless Edge/Chrome, plays through every
// set piece via scripted input + teleports, and reports errors / screenshots.
//   npm run smoke -- <screenshotDir>
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || 'smoke-out');
fs.mkdirSync(OUT, { recursive: true });
const BROWSER = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => fs.existsSync(p));
if (!BROWSER) throw new Error('No Edge/Chrome found');

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await puppeteer.launch({
  executablePath: BROWSER,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 960, height: 540 },
});
const page = await browser.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warn') problems.push(`${m.type()}: ${m.text()}`);
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: path.join(OUT, name + '.png') });
const ev = (fn, arg) => page.evaluate(fn, arg);
const results = [];
const check = (name, ok, info = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  â€” ' + info : ''}`);
};
const hold = async (key, ms) => {
  await page.keyboard.down(key);
  await wait(ms);
  await page.keyboard.up(key);
};
const tap = (key) => hold(key, 70);
const sectionX =(name) => ev((n) => window.__riff.level.sections.find((s) => s.name === n).x, name);
// teleport (respawn resets invulnerability, so re-apply god mode when it's on)
let godMode = false;
const tp = (x, y = 200) => ev(([x, y, g]) => {
  const p = window.__riff.player;
  p.respawn(x, y);
  if (g) { p.invulnT = 1e9; p.picks = 3; }
}, [x, y, godMode]);
const god = () => { godMode = true; return ev(() => { const p = window.__riff.player; p.invulnT = 1e9; p.picks = 3; }); };
const state = () => ev(() => {
  const g = window.__riff;
  const p = g.player;
  return {
    x: Math.round(p.x), y: Math.round(p.y), picks: p.picks, dead: p.dead, beat: g.lastBeat,
    score: g.stats.score, shots: g.playerShots.getLength(), section: g.level.sections[g.sectionIdx]?.name,
    wod: g.wod?.state, round: g.wod?.round, dived: g.dived, boss: g.boss ? { hp: g.boss.hp, phase: g.boss.phase, active: g.boss.active } : null,
    shred: g.shred, combo: g.combo,
  };
});

try {
  await page.goto('http://localhost:5199/?autostart', { waitUntil: 'load' });
  await wait(1800);
  await shot('01-title');
  const titleActive = await ev(() => window.game.scene.isActive('Title'));
  check('title scene active', titleActive);

  await tap('Enter');
  await wait(1500);
  check('game scene active', await ev(() => window.game.scene.isActive('Game') && window.game.scene.isActive('HUD')));
  await shot('02-start');

  // --- movement / beat clock
  let s0 = await state();
  await hold('ArrowRight', 700);
  let s1 = await state();
  check('player runs right', s1.x > s0.x + 80, `${s0.x} -> ${s1.x}`);
  check('beat clock advancing', s1.beat > s0.beat, `${s0.beat} -> ${s1.beat}`);
  await tap('Space');
  await wait(150);
  const sj = await state();
  check('player jumps', sj.y < s1.y - 10, `${s1.y} -> ${sj.y}`);
  await wait(800);
  await tap('KeyX');
  await wait(60);
  check('riff shot fired', (await state()).shots > 0);
  await page.keyboard.down('KeyX');
  await wait(700);
  await page.keyboard.up('KeyX');
  await wait(100);
  await shot('03-power-chord');

  // --- harmony: harmonyAt() must name the chord the band is actually playing
  const harm = await ev(async () => {
    const s = window.__audio.synth;
    const m = window.__audio.music;
    const played = [];
    const bass = s.bass;
    s.bass = (t, n, ...rest) => {
      played.push([t, n + 12]);
      return bass.call(s, t, n, ...rest);
    };
    await new Promise((r) => setTimeout(r, 3500));
    s.bass = bass;
    let bad = 0;
    for (let i = 1; i < played.length; i++) {
      const mid = (played[i - 1][0] + played[i][0]) / 2;
      if (m.harmonyAt(mid) !== played[i - 1][1]) bad++;
    }
    return { notes: played.length, bad, roots: [...new Set(played.map((p) => p[1]))] };
  });
  check('player sounds follow the band chord', harm.notes > 10 && harm.bad === 0, JSON.stringify(harm));

  // --- stomp fairness: landing on a poser the instant it fires must not hurt
  const stompRes = await ev(async () => {
    const g = window.__riff;
    const p = g.player;
    const PoserClass = g.enemies.getChildren().find((e) => e.texture.key === 'poser').constructor;
    const e = new PoserClass(g, 100, 240);
    p.respawn(100, 170);
    p.invulnT = 0;
    p.picks = 3;
    p.body.setVelocityY(260);
    e.awake = true;
    e.onBeat(0); // fires a note straight into the falling player
    const shots = g.enemyShots.getLength();
    await new Promise((r) => setTimeout(r, 700));
    return { shotFired: shots > 0, picks: p.picks, enemyHp: e.hp, enemyDead: e.dead };
  });
  check('stomp during enemy attack does not hurt', stompRes.shotFired && stompRes.picks === 3 && (stompRes.enemyDead || stompRes.enemyHp < 2), JSON.stringify(stompRes));

  // --- walk the tutorial for real: jump over the first gap
  await tp(40, 200);
  await wait(300);
  await page.keyboard.down('ArrowRight');
  await wait(850);
  await hold('Space', 400);
  await wait(550);
  await page.keyboard.up('ArrowRight');
  const sg = await state();
  check('cleared first gap', sg.x > 14 * 16 && !sg.dead && sg.y < 250, JSON.stringify(sg));

  // --- every section: teleport, look around
  await god();
  for (const [i, name] of ['MERCH ALLEY', 'THE PIT', 'PYRO GAUNTLET'].entries()) {
    const x = await sectionX(name);
    await tp(x + 40, 200);
    await wait(1200);
    await hold('ArrowRight', 1500);
    await shot(`1${i}-${name.replace(/\s/g, '_').toLowerCase()}`);
    const st = await state();
    check(`section ${name} reached`, st.section === name || st.x > x, JSON.stringify(st));
  }

  // --- pyro boost: stand next to a pyro jet airborne when it fires
  const pyroInfo = await ev(() => window.__riff.pyros.map((p) => ({ x: p.x, offset: p.offset })));
  check('pyros spawned', pyroInfo.length === 8, String(pyroInfo.length));

  // --- wall of death
  const wodX = await sectionX('WALL OF DEATH');
  await tp(wodX + 12 * 16, 200);
  await wait(500);
  check('wall of death started', ['intro', 'countdown', 'charge'].includes((await state()).wod));
  await wait(4500);
  await shot('20-wod');
  let wodDone = false;
  for (let i = 0; i < 40 && !wodDone; i++) {
    await wait(1000);
    const st = await state();
    if (st.wod === 'charge' && i % 3 === 0) await shot(`21-wod-charge-${st.round}`);
    wodDone = st.wod === 'done';
  }
  check('wall of death completes 3 rounds', wodDone, JSON.stringify(await state()));

  // --- crowd surf: drop onto the first hands, the crowd should carry us across
  const surfX = await sectionX('CROWD SURF');
  await tp(surfX + 8 * 16 + 8, 150);
  await wait(400);
  await shot('30-surf-start');
  let surfed = false;
  for (let i = 0; i < 12 && !surfed; i++) {
    await wait(500);
    const st = await state();
    if (st.x > surfX + 26 * 16 && st.x < surfX + 31 * 16 && st.y < 220) surfed = true;
  }
  check('crowd tossed player to hold platform', surfed, JSON.stringify(await state()));
  await shot('31-surf-hold');
  // jump to the next hands from the hold platform
  await page.keyboard.down('ArrowRight');
  await wait(450);
  await tap('Space');
  await wait(500);
  await page.keyboard.up('ArrowRight');
  let landed = false;
  for (let i = 0; i < 10 && !landed; i++) {
    await wait(400);
    const st = await state();
    landed = st.x > surfX + 46 * 16 && st.y < 245;
  }
  check('crowd surf reaches far ground', landed, JSON.stringify(await state()));

  // --- stage dive
  const diveX = await sectionX('STAGE DIVE');
  await tp(diveX + 22 * 16, 100);
  await wait(500);
  await page.keyboard.down('ArrowRight');
  await wait(900);
  await page.keyboard.up('ArrowRight');
  await wait(200);
  await shot('40-stage-dive');
  check('stage dive triggered', (await state()).dived === true);
  let atBoss = false;
  for (let i = 0; i < 12 && !atBoss; i++) {
    await wait(500);
    const st = await state();
    atBoss = st.section === 'THE PRODUCER' && st.y < 245;
  }
  check('stage dive crowd carries to boss arena', atBoss, JSON.stringify(await state()));

  // --- boss
  const bossX = await sectionX('THE PRODUCER');
  await tp(bossX + 10 * 16, 200);
  await wait(2500);
  let st = await state();
  check('boss spawned', !!st.boss && st.boss.phase >= 1, JSON.stringify(st.boss));
  await shot('50-boss-p1');
  await ev(() => { const b = window.__riff.boss; b.hurt(b.maxHp * 0.4, b.x, { onBeat: true }); });
  await wait(4000);
  await shot('51-boss-p2');
  st = await state();
  check('boss phase 2', st.boss && st.boss.phase === 2, JSON.stringify(st.boss));
  await ev(() => { const b = window.__riff.boss; b.hurt(b.maxHp * 0.3, b.x, { onBeat: true }); });
  await wait(3000);
  await shot('52-boss-p3');
  st = await state();
  check('boss phase 3', st.boss && st.boss.phase === 3, JSON.stringify(st.boss));
  const deflect = await ev(() => window.__riff.boss.hurt(5, 0, { onBeat: false }));
  check('phase 3 deflects off-beat hits', deflect === 'deflect', deflect);
  await ev(() => { const b = window.__riff.boss; b.hurt(999, b.x, { onBeat: true }); });
  await wait(4000);
  await shot('53-boss-dead');
  await wait(5000);
  check('victory scene', await ev(() => window.game.scene.isActive('Victory')));
  await wait(3500);
  await shot('60-victory');

  // --- game over path
  await tap('Enter');
  await wait(800);
  await tap('Enter');
  await wait(1500);
  await ev(() => { const p = window.__riff.player; p.invulnT = 0; p.picks = 1; p.hurt(1, p.x - 10); });
  await wait(2600);
  check('game over scene', await ev(() => window.game.scene.isActive('GameOver')));
  await shot('70-gameover');
  await tap('Enter');
  await wait(1200);
  check('continue restarts game', await ev(() => window.game.scene.isActive('Game') && !window.__riff.player.dead));
} catch (e) {
  problems.push('SCRIPT: ' + (e.stack || e.message));
} finally {
  console.log('\n=== RESULTS ===');
  results.forEach((r) => console.log(r));
  console.log('\n=== CONSOLE PROBLEMS (' + problems.length + ') ===');
  [...new Set(problems)].slice(0, 40).forEach((p) => console.log(p));
  console.log('\nScreenshots in', OUT);
  await browser.close();
  await server.close();
}

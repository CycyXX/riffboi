// Touch smoke test: emulates a landscape Android phone and plays with the on-screen buttons.
//   node scripts/touch-smoke.mjs <screenshotDir>
import { createServer } from 'vite';
import puppeteer, { KnownDevices } from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || 'smoke-out');
fs.mkdirSync(OUT, { recursive: true });
const BROWSER = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => fs.existsSync(p));

const server = await createServer({ server: { port: 5197, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.emulate(KnownDevices['Pixel 5 landscape']);
const problems = [];
const results = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warn') && problems.push(`${m.type()}: ${m.text()}`));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  â€” ' + info : ''}`);

// Convert game coords (480x270) to page coords using the canvas rect.
const toPage = async (gx, gy) => {
  const r = await page.evaluate(() => {
    const b = document.querySelector('canvas').getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });
  return { x: r.x + (gx / 480) * r.w, y: r.y + (gy / 270) * r.h };
};
const cdp = await page.createCDPSession();
const touch = async (type, points) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
const tapAt = async (gx, gy) => {
  const p = await toPage(gx, gy);
  await touch('touchStart', [p]);
  await wait(80);
  await touch('touchEnd', []);
};
const px = () => page.evaluate(() => ({ x: Math.round(window.__riff.player.x), y: Math.round(window.__riff.player.y), shots: window.__riff.playerShots.getLength() }));

try {
  await page.goto('http://localhost:5197/', { waitUntil: 'networkidle0' });
  await wait(1200);
  check('touch detected', await page.evaluate(() => navigator.maxTouchPoints > 0));
  await tapAt(240, 135);
  await wait(1500);
  await page.screenshot({ path: path.join(OUT, 't1-title.png') });
  check('title after tap', await page.evaluate(() => window.game.scene.isActive('Title')));
  await tapAt(240, 150);
  await wait(1500);
  check('game after tap', await page.evaluate(() => window.game.scene.isActive('Game')));

  const s0 = await px();
  const right = await toPage(80, 240);
  await touch('touchStart', [right]);
  await wait(500);
  // second finger on JUMP while still holding right
  const jump = await toPage(450, 230);
  await touch('touchMove', [right, jump]);
  await wait(120);
  const sAir = await px();
  await touch('touchMove', [right]);
  await wait(300);
  await touch('touchEnd', []);
  const s1 = await px();
  check('right button moves player', s1.x > s0.x + 40, `${s0.x} -> ${s1.x}`);
  check('jump with second finger (multi-touch)', sAir.y < s0.y - 10, `${s0.y} -> ${sAir.y}`);
  await wait(500);
  await tapAt(398, 246);
  await wait(50);
  check('riff button fires', (await px()).shots > 0);
  await wait(200);
  await page.screenshot({ path: path.join(OUT, 't2-game.png') });

  await tapAt(16, 46);
  await wait(400);
  check('pause button pauses', await page.evaluate(() => window.game.scene.isPaused('Game')));
  await page.screenshot({ path: path.join(OUT, 't3-paused.png') });
  await tapAt(240, 120);
  await wait(400);
  check('tap resumes', await page.evaluate(() => window.game.scene.isActive('Game') && !window.game.scene.isPaused('Game')));
} catch (e) {
  problems.push('SCRIPT: ' + (e.stack || e.message));
} finally {
  console.log(results.join('\n'));
  console.log('PROBLEMS (' + problems.length + ')\n' + [...new Set(problems)].join('\n'));
  await browser.close();
  await server.close();
}

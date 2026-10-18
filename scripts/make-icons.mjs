// Renders the home-screen app icons (public/icon-192.png, icon-512.png) from the in-game
// RiffBoi sprite, so the icon always matches the character. Run: node scripts/make-icons.mjs
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const BROWSER = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => fs.existsSync(p));

const server = await createServer({ server: { port: 5196, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:5196/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.game && window.game.textures.exists('riffboi'), { timeout: 60000 });
  for (const size of [192, 512]) {
    const dataUrl = await page.evaluate((size) => {
      const f = window.game.textures.getFrame('riffboi', 'stand_s');
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      // Full-bleed background so Android's "maskable" crop (any shape) still looks right.
      const g = ctx.createRadialGradient(size / 2, size * 0.45, 0, size / 2, size / 2, size * 0.7);
      g.addColorStop(0, '#5a1a4a');
      g.addColorStop(1, '#0b0712');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      // Sprite inside the central safe zone (~60% of the icon).
      const scale = Math.floor((size * 0.6) / 24);
      const w = 24 * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(f.source.image, f.cutX, f.cutY, 24, 24, (size - w) / 2, (size - w) / 2, w, w);
      return c.toDataURL('image/png');
    }, size);
    fs.writeFileSync(`public/icon-${size}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`wrote public/icon-${size}.png`);
  }
} finally {
  await browser.close();
  await server.close();
}

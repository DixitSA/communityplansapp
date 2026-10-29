// Renders reel.html to design/social/out/reel.mp4 (1080x1920, 30 fps) plus a cover image.
// Usage (from the repo root): node design/social/render-reel.cjs      Needs ffmpeg on PATH.
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const FPS = 30;
(async () => {
  const out = path.join(__dirname, 'out');
  fs.mkdirSync(out, { recursive: true });
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy; // set only in cloud sandboxes
  const browser = await pw.chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, ignoreHTTPSErrors: Boolean(proxy) });
  await page.goto('file://' + path.join(__dirname, 'reel.html'));
  await page.waitForFunction(() => window.READY === true);
  const duration = await page.evaluate(() => window.REEL_DURATION);
  const frames = Math.ceil(duration * FPS);
  const mp4 = path.join(out, 'reel.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', mp4],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.renderAt(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg exited ${c}`)))));
  // Cover: the intro once its title has landed.
  await page.evaluate(() => window.renderAt(2.2));
  await page.screenshot({ path: path.join(out, 'reel-cover.png') });
  await browser.close();
  console.log(`${mp4} (${frames} frames, ${duration.toFixed(1)} s)`);
  console.log(path.join(out, 'reel-cover.png'));
})().catch((e) => { console.error(e); process.exit(1); });

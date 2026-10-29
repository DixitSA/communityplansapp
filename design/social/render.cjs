// Renders each .board in kit.html to design/social/out/<id>.png at full size.
// Usage (from the repo root): node design/social/render.cjs
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
(async () => {
  const out = path.join(__dirname, 'out');
  fs.mkdirSync(out, { recursive: true });
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 2100 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'kit.html'));
  await page.evaluate(() => document.fonts.ready);
  for (const el of await page.$$('.board')) {
    const id = await el.getAttribute('id');
    const over = await el.evaluate((n) => n.scrollHeight - n.clientHeight);
    if (over > 0) console.warn(`WARNING: #${id} overflows by ${over}px; trim its content`);
    await el.screenshot({ path: path.join(out, `${id}.png`) });
    console.log(path.join(out, `${id}.png`));
  }
  await browser.close();
})();

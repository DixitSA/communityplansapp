// Renders each .board in kit.html to design/social/out/<id>.png at full size.
// Usage (from the repo root): node design/social/render.cjs [file.html ...]   (default: kit.html)
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
(async () => {
  const out = path.join(__dirname, 'out');
  fs.mkdirSync(out, { recursive: true });
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy; // set only in cloud sandboxes
  const browser = await pw.chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const page = await browser.newPage({ viewport: { width: 1200, height: 2100 }, deviceScaleFactor: 1, ignoreHTTPSErrors: Boolean(proxy) });
  const files = process.argv.slice(2).length ? process.argv.slice(2) : ['kit.html'];
  for (const file of files) {
  await page.goto('file://' + path.join(__dirname, file));
  await page.evaluate(() => document.fonts.ready);
  for (const el of await page.$$('.board')) {
    const id = await el.getAttribute('id');
    const over = await el.evaluate((n) => n.scrollHeight - n.clientHeight);
    if (over > 0) console.warn(`WARNING: #${id} overflows by ${over}px; trim its content`);
    await el.screenshot({ path: path.join(out, `${id}.png`) });
    console.log(path.join(out, `${id}.png`));
  }
  }
  await browser.close();
})();

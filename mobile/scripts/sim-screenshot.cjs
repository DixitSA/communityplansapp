// Screenshots of the real iOS app: the EAS `simulator` build running on an Appetize cloud iPhone.
// Unlike scripts/screenshot.cjs (the web build), this shows Liquid Glass, SF Symbols and native menus.
//
//   node scripts/sim-screenshot.cjs upload <build-url>   upload a build (the .tar.gz from `eas build --profile simulator`)
//   node scripts/sim-screenshot.cjs [route ...]          screenshot routes in light and dark (default route: /)
//
// Needs APPETIZE_API_TOKEN, plus YARD_TEST_EMAIL / YARD_TEST_PASSWORD (the throwaway test account) to sign in.
// The Appetize app key is kept in .screenshots/appetize.json. The free plan has only a few dozen minutes a
// month, so a run signs in once and visits every route in a single session. See docs/DEV_SETUP.md.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', '.screenshots');
const KEY_FILE = path.join(OUT_DIR, 'appetize.json');
const SCHEMES = ['light', 'dark'];
const DEVICE = process.env.APPETIZE_DEVICE || 'iphone16pro';
const SETTLE_MS = 4000;

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(path.join(globalRoot, 'playwright'));
  }
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const readKey = () => (fs.existsSync(KEY_FILE) ? JSON.parse(fs.readFileSync(KEY_FILE, 'utf8')).publicKey : undefined);

/** Creates the Appetize app on first upload, then updates the same one so its key (and links) stay put. */
async function upload(buildUrl) {
  const key = readKey();
  const res = await fetch(`https://api.appetize.io/v1/apps${key ? `/${key}` : ''}`, {
    method: 'POST',
    headers: { 'X-API-KEY': requireEnv('APPETIZE_API_TOKEN'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: buildUrl, platform: 'ios' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.publicKey) throw new Error(`Appetize upload failed (HTTP ${res.status}): ${body.message ?? ''}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify({ publicKey: body.publicKey }, null, 2));
  console.log(`uploaded: ${body.publicKey}`);
}

/** A fresh refresh token for the test account, for the app's yard://dev-session link. */
async function testRefreshToken() {
  const text = fs.readFileSync(path.join(__dirname, '..', '.env.development'), 'utf8');
  const get = (k) => (text.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
  const { createClient } = require('@supabase/supabase-js');
  const db = createClient(get('EXPO_PUBLIC_SUPABASE_URL'), get('EXPO_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
  });
  const { data, error } = await db.auth.signInWithPassword({
    email: requireEnv('YARD_TEST_EMAIL'),
    password: requireEnv('YARD_TEST_PASSWORD'),
  });
  if (error) throw new Error(`test sign-in failed: ${error.message}`);
  return data.session.refresh_token;
}

function slugFor(route) {
  return route.replace(/^\/+|\/+$/g, '').replace(/\//g, '_') || 'home';
}

async function shoot(routes) {
  const key = readKey();
  if (!key) throw new Error('No Appetize app yet: run `node scripts/sim-screenshot.cjs upload <build-url>` first');
  const refreshToken = await testRefreshToken();
  const { chromium } = loadPlaywright();
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 700, height: 1100 }, ignoreHTTPSErrors: Boolean(proxy) });
    // The Appetize embed plus its JS SDK, which drives the cloud simulator (open links, appearance, screenshots).
    await page.setContent(`<!doctype html><html><body style="margin:0">
      <iframe id="appetize" src="https://appetize.io/embed/${key}?device=${DEVICE}&scale=auto&autoplay=true"
        width="100%" height="1080" frameborder="0" allow="clipboard-read; clipboard-write"></iframe>
      <script src="https://js.appetize.io/embed.js"></script></body></html>`);
    await page.waitForFunction(() => Boolean(window.appetize), null, { timeout: 60000 });
    await page.evaluate(async () => {
      const client = await window.appetize.getClient('#appetize');
      window.__session = await client.startSession();
    });
    const open = (url) => page.evaluate((u) => window.__session.openUrl(u), url);
    const wait = (ms) => page.waitForTimeout(ms);

    await open(`yard://dev-session?rt=${encodeURIComponent(refreshToken)}`);
    await wait(SETTLE_MS * 2);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const route of routes) {
      for (const scheme of SCHEMES) {
        await page.evaluate((s) => window.__session.setAppearance(s), scheme);
        await open(`yard://${route.replace(/^\/+/, '')}`);
        await wait(SETTLE_MS);
        const shot = await page.evaluate(async () => {
          const r = await window.__session.screenshot('base64');
          return typeof r === 'string' ? r : r.data;
        });
        const file = path.join(OUT_DIR, `sim-${slugFor(route)}-${scheme}.png`);
        fs.writeFileSync(file, Buffer.from(shot, 'base64'));
        console.log(file);
      }
    }
    await page.evaluate(() => window.__session.end()).catch(() => {});
  } finally {
    await browser.close();
  }
}

const args = process.argv.slice(2);
const run = args[0] === 'upload' ? upload(args[1] ?? '') : shoot(args.length > 0 ? args : ['/']);
run.catch((err) => {
  console.error(err.message);
  process.exit(1);
});

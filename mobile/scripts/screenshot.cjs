// Usage: node scripts/screenshot.cjs [--full] [--live] [route ...]   (default route: /)
// --full captures the whole scrollable page instead of just the viewport.
// --live signs in to the real backend as the test account in YARD_TEST_EMAIL / YARD_TEST_PASSWORD
//   (a throwaway user made in the Supabase dashboard) and hands the session to the page. The
//   session only lives in memory and the browser context; nothing is written to disk.
// Starts the Expo web dev server, screenshots each route in light and dark mode
// at iPhone size, and writes PNGs to mobile/.screenshots/.
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(path.join(globalRoot, 'playwright'));
  }
}

const PORT = Number(process.env.PORT) || 8091;
const BASE = `http://localhost:${PORT}`;
const OUT_DIR = path.join(__dirname, '..', '.screenshots');
const SCHEMES = ['light', 'dark'];
const isWindows = process.platform === 'win32';

function slugFor(route) {
  const slug = route.replace(/^\/+|\/+$/g, '').replace(/\//g, '_');
  return slug === '' ? 'home' : slug;
}

function startServer() {
  return spawn('npx', ['expo', 'start', '--web', '--port', String(PORT)], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, CI: '1', BROWSER: 'none' },
    stdio: 'ignore',
    shell: isWindows,
    detached: !isWindows,
  });
}

function killServer(child) {
  if (!child || child.killed || child.pid === undefined) return;
  try {
    if (isWindows) {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGKILL'); // whole process group
    }
  } catch {
    // already gone
  }
}

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Dev server did not respond at ${BASE} within ${timeoutMs / 1000}s`);
}

/** Reads EXPO_PUBLIC_* values from .env.development (public by design). */
function publicEnv() {
  const text = fs.readFileSync(path.join(__dirname, '..', '.env.development'), 'utf8');
  const get = (k) => (text.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
  return { url: get('EXPO_PUBLIC_SUPABASE_URL'), key: get('EXPO_PUBLIC_SUPABASE_ANON_KEY') };
}

/** Signs in as the test account, onboarding it on first use. Returns [storageKey, sessionJson]. */
async function liveSession() {
  const email = process.env.YARD_TEST_EMAIL;
  const password = process.env.YARD_TEST_PASSWORD;
  if (!email || !password) throw new Error('--live needs YARD_TEST_EMAIL and YARD_TEST_PASSWORD');
  const { createClient } = require('@supabase/supabase-js');
  const { url, key } = publicEnv();
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`test sign-in failed: ${error.message}`);
  const { data: profile } = await db.from('profiles').select('id').eq('id', data.user.id).maybeSingle();
  if (!profile) {
    const { data: interests } = await db.from('interests').select('id').order('id').limit(3);
    const { data: city } = await db.from('cities').select('id').eq('slug', 'charlotte').single();
    const { error: onbErr } = await db.rpc('complete_onboarding', {
      p_username: `yardtest${Math.floor(Math.random() * 1e6)}`,
      p_display_name: 'Yard Test',
      p_birthdate: '1995-01-01',
      p_interest_ids: (interests ?? []).map((i) => i.id),
      p_home_city_id: city.id,
    });
    if (onbErr) throw new Error(`test onboarding failed: ${onbErr.message}`);
  }
  const ref = new URL(url).hostname.split('.')[0];
  return [`sb-${ref}-auth-token`, JSON.stringify(data.session)];
}

async function main() {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const live = args.includes('--live');
  const routes = args.filter((a) => a !== '--full' && a !== '--live');
  if (routes.length === 0) routes.push('/');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { chromium } = loadPlaywright();
  const server = startServer();
  const cleanup = () => killServer(server);
  process.on('exit', cleanup);
  process.on('SIGINT', () => process.exit(130));
  process.on('SIGTERM', () => process.exit(143));

  let browser;
  let failed = false;
  try {
    const session = live ? await liveSession() : null;
    await waitForServer(180000);
    browser = await chromium.launch();
    for (const route of routes) {
      for (const scheme of SCHEMES) {
        const context = await browser.newContext({
          viewport: { width: 393, height: 852 },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
          colorScheme: scheme,
        });
        if (session) {
          await context.addInitScript(([k, v]) => window.localStorage.setItem(k, v), session);
        }
        try {
          const page = await context.newPage();
          const url = BASE + (route.startsWith('/') ? route : `/${route}`);
          const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 180000 });
          if (!response || response.status() >= 400) {
            throw new Error(`HTTP ${response ? response.status() : 'no response'}`);
          }
          await page.waitForTimeout(1500);
          if (full) {
            // RN web scrolls inside a ScrollView, not the document, so grow the viewport to fit.
            const height = await page.evaluate(() =>
              Math.max(
                document.documentElement.scrollHeight,
                ...Array.from(document.querySelectorAll('div')).map((el) => el.scrollHeight),
              ),
            );
            await page.setViewportSize({ width: 393, height: Math.min(height, 8000) });
            await page.waitForTimeout(800);
          }
          const file = path.join(OUT_DIR, `${live ? 'live-' : ''}${slugFor(route)}-${scheme}.png`);
          await page.screenshot({ path: file, fullPage: full });
          console.log(file);
        } catch (err) {
          failed = true;
          console.error(`FAILED ${route} (${scheme}): ${err.message}`);
        } finally {
          await context.close();
        }
      }
    }
  } catch (err) {
    failed = true;
    console.error(err.message);
  } finally {
    if (browser) await browser.close();
    cleanup();
  }
  process.exit(failed ? 1 : 0);
}

main();

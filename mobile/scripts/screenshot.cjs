// Usage: node scripts/screenshot.cjs [--full] [route ...]   (default route: /)
// --full captures the whole scrollable page instead of just the viewport.
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

const PORT = 8091;
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

async function main() {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const routes = args.filter((a) => a !== '--full');
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
          const file = path.join(OUT_DIR, `${slugFor(route)}-${scheme}.png`);
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

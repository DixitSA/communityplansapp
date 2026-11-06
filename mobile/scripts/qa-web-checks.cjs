// Isolated WEB-only demo checks. Usage: node scripts/qa-web-checks.cjs
// No live auth; server inherits an explicitly blank backend configuration and ignores dotenv.
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const PORT = 8097;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_ROOT = path.resolve(__dirname, '..', '..', 'docs', 'qa-evidence');
const cwd = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const labelArg = process.argv.indexOf('--run-label');
const generatedLabel = new Date().toISOString().replace(/[-:.TZ]/g, '');
const runLabel = labelArg >= 0 ? process.argv[labelArg + 1] : generatedLabel;
if (!runLabel || !/^[a-zA-Z0-9_-]{1,40}$/.test(runLabel)) {
  throw new Error('Use --run-label with 1-40 letters, numbers, underscores, or hyphens');
}
const OUT = path.join(OUT_ROOT, `web-checks-${runLabel}`);
function playwright() {
  try { return require('playwright'); }
  catch { return require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
}
function stop(child) {
  // The ChildProcess handle is our ownership proof. Do not kill a PID once its process exited.
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null || child.killed) return;
  try {
    if (isWin) execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGTERM');
  } catch {}
}
async function assertPortAvailable() {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', (err) => {
      if (err.code === 'EADDRINUSE') reject(new Error(`Refusing to use occupied port ${PORT}`));
      else reject(err);
    });
    probe.listen(PORT, '127.0.0.1', () => probe.close((err) => err ? reject(err) : resolve()));
  });
}
async function ready(child, startup, ms = 180000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (startup.error) throw new Error(`Owned Expo server failed to start: ${startup.error.message}`);
    if (startup.exit) throw new Error(`Owned Expo server exited before ready (code ${startup.exit.code}, signal ${startup.exit.signal})`);
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Owned Expo server exited before ready (code ${child.exitCode}, signal ${child.signalCode})`);
    }
    try { const r = await fetch(BASE); if (r.status < 500) return; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Owned Expo web server did not become ready');
}
function check(out, name, ok, details = '') {
  out.checks.push({ name, pass: Boolean(ok), details });
  if (!ok) throw new Error(`${name}: ${details || 'assertion failed'}`);
}

async function main() {
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  await assertPortAvailable();
  if (fs.existsSync(OUT)) throw new Error(`Evidence directory already exists; choose another run label: ${OUT}`);
  fs.mkdirSync(OUT, { recursive: false });
  const env = {
    ...process.env, CI: '1', BROWSER: 'none', EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
  };
  for (const key of Object.keys(env)) if (key.startsWith('EXPO_PUBLIC_')) env[key] = '';
  const server = spawn(process.execPath, ['node_modules/expo/bin/cli', 'start', '--web', '--port', String(PORT)], {
    cwd, env, stdio: 'ignore', shell: false, detached: !isWin,
  });
  const startup = { error: null, exit: null };
  server.once('error', (error) => { startup.error = error; });
  server.once('exit', (code, signal) => { startup.exit = { code, signal }; });
  const out = { label: 'WEB / isolated DEMO (blank Supabase config)', runLabel, checks: [], startedAt: new Date().toISOString() };
  let browser;
  try {
    await ready(server, startup);
    const { chromium } = playwright();
    browser = await chromium.launch();

    // Profile draft cancellation must not persist an invalid/partial value.
    {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
      await page.getByText('Profile', { exact: true }).last().click();
      await page.getByText('Edit profile', { exact: true }).last().click();
      const name = page.getByTestId('edit-profile-name-input');
      await name.waitFor({ state: 'visible' });
      const originalName = await name.inputValue();
      await name.fill('');
      check(out, 'profile: empty draft disables Save', await page.getByRole('button', { name: 'Save' }).isDisabled());
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.getByText('Profile', { exact: true }).last().click();
      await page.getByText('Edit profile', { exact: true }).last().click();
      const reopened = page.getByTestId('edit-profile-name-input');
      await reopened.waitFor({ state: 'visible' });
      check(out, 'profile: cancel/reopen retains saved name', (await reopened.inputValue()) === originalName, 'value compared only in memory; not included in report');
      await page.screenshot({ path: path.join(OUT, 'profile-cancel-reopened.png') });
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.close();
    }

    // Filter choices are immediate global state; Show returns to feed, and Clear all restores defaults.
    {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
      await page.getByText('Interests', { exact: true }).click();
      const initialShow = page.getByRole('button', { name: /^Show \d+ events?$/ });
      await initialShow.waitFor({ state: 'visible' });
      const initialCountLabel = await initialShow.getAttribute('aria-label');
      const initialCount = Number(initialCountLabel?.match(/^Show (\d+) events?$/)?.[1]);
      check(out, 'filters: captures initial default count', Number.isInteger(initialCount), initialCountLabel || 'no count label');
      out.observedCounts = { initialDefault: initialCount };
      await initialShow.click();
      const timeChip = page.getByText('Any time', { exact: true });
      await timeChip.click();
      await page.getByText('Afternoon', { exact: true }).last().click();
      await page.getByText('10 mi', { exact: true }).click();
      await page.getByText('5 mi', { exact: true }).last().click();
      await page.getByText('Interests', { exact: true }).click();
      const show = page.getByRole('button', { name: /^Show \d+ events?$/ });
      await show.waitFor({ state: 'visible' });
      const shownLabel = await show.getAttribute('aria-label');
      check(out, 'filters: selected time/distance produces Show count', Boolean(shownLabel), shownLabel || 'no count label');
      await page.screenshot({ path: path.join(OUT, 'filters-selected.png') });
      await show.click();
      await page.getByText('Afternoon', { exact: true }).waitFor({ state: 'visible' });
      check(out, 'filters: applied time persists on Feed', await page.getByText('Afternoon', { exact: true }).isVisible());
      await page.getByText('Interests', { exact: true }).click();
      const fiveMiles = page.getByRole('tab', { name: '5 mi', exact: true });
      await fiveMiles.waitFor({ state: 'visible' });
      // React Native Web exposes this control's selected paint reliably; compare the selected
      // chip's accent background with a default chip because aria-selected is not emitted here.
      const selectedBg = await fiveMiles.evaluate((el) => getComputedStyle(el).backgroundColor);
      const defaultBg = await page.getByRole('tab', { name: '1 mi', exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor);
      check(out, 'filters: distance persists after reopening', selectedBg !== defaultBg, `${selectedBg} vs ${defaultBg}`);
      await page.getByRole('button', { name: 'Clear all filters' }).click();
      const tenMiles = page.getByRole('tab', { name: '10 mi', exact: true });
      const tenMiBg = await tenMiles.evaluate((el) => getComputedStyle(el).backgroundColor);
      const oneMiBg = await page.getByRole('tab', { name: '1 mi', exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor);
      const clearButton = page.getByRole('button', { name: 'Clear all filters' });
      const defaultShow = page.getByRole('button', { name: /^Show \d+ events?$/ });
      const restoredCountLabel = await defaultShow.getAttribute('aria-label');
      const restoredCount = Number(restoredCountLabel?.match(/^Show (\d+) events?$/)?.[1]);
      out.observedCounts.selected = Number(shownLabel?.match(/^Show (\d+) events?$/)?.[1]);
      out.observedCounts.afterClear = restoredCount;
      check(out, 'filters: Clear all restores distance and disables Clear', tenMiBg !== oneMiBg && await clearButton.isDisabled(), `${tenMiBg} vs ${oneMiBg}`);
      check(out, 'filters: Clear restores the initial default count', restoredCount === initialCount, `${initialCountLabel} -> ${restoredCountLabel}`);
      await defaultShow.click();
      await page.getByText('Any time', { exact: true }).waitFor({ state: 'visible' });
      check(out, 'filters: Clear all restores time on Feed', await page.getByText('Any time', { exact: true }).isVisible());
      await page.screenshot({ path: path.join(OUT, 'filters-defaults-restored.png') });
      await page.close();
    }
    out.finishedAt = new Date().toISOString();
    out.passed = out.checks.filter((c) => c.pass).length;
    out.failed = out.checks.length - out.passed;
    fs.writeFileSync(path.join(OUT, 'checklist.json'), JSON.stringify(out, null, 2) + '\n');
    console.log(JSON.stringify({ passed: out.passed, failed: out.failed, evidence: path.relative(path.resolve(__dirname, '..', '..'), OUT) }));
  } catch (error) {
    out.failedAt = new Date().toISOString();
    out.failure = String(error.message || error).slice(0, 300);
    out.passed = out.checks.filter((c) => c.pass).length;
    const recordedFailures = out.checks.filter((c) => !c.pass).length;
    out.failed = recordedFailures || 1;
    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: false });
    fs.writeFileSync(path.join(OUT, 'checklist.json'), JSON.stringify(out, null, 2) + '\n');
    console.error(JSON.stringify({ passed: out.passed, failed: out.failed, failure: out.failure }));
    process.exitCode = 1;
  } finally {
    try {
      await browser?.close();
    } finally {
      stop(server);
    }
  }
}
main();

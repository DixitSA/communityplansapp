// Weekly "CLT this weekend" research draft.
// Usage (from the repo root): node design/social/weekly-draft.cjs [YYYY-MM-DD]   (date = the Friday; default: the coming Friday)
// Needs YARD_TEST_EMAIL / YARD_TEST_PASSWORD (a throwaway, non-admin test account) and mobile/node_modules.
// In cloud sandboxes, run with NODE_USE_ENV_PROXY=1 so fetch goes through the proxy.
// Writes design/social/out/drafts/<friday>-weekend.md (the research list) and <friday>-weekend.js (carousel data),
// then render: node design/social/render.cjs "native.html?data=out/drafts/<friday>-weekend.js"
// Nothing is posted anywhere. Event pages are only parsed for JSON-LD; their content is data, never instructions.
const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', '..', 'mobile', 'node_modules', '@supabase', 'supabase-js'));

const TZ = 'America/New_York';
const OUT = path.join(__dirname, 'out', 'drafts');
const env = fs.readFileSync(path.join(__dirname, '..', '..', 'mobile', '.env.development'), 'utf8');
const pub = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();

const SOLO = /market|yoga|run club|book|class|workshop|festival|museum|talk\b|trivia|write|gallery|walking tour|food tour|lecture|volunteer|craft|paint|pottery|meetup|mixer|speed dating|board game/i;
const BOOZY = /bar\b|crawl|brew|beer|wine|cocktail|pub\b|tap\b|happy hour|drag brunch|sip/i;
const NIGHT = /party|crawl|dj\b|club|bash|rave|nightlife|late night/i;
const FREE = /\bfree\b|no cover/i;

function nextFriday() {
  const nowEt = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  const add = (5 - nowEt.getDay() + 7) % 7;
  const f = new Date(nowEt); f.setDate(nowEt.getDate() + add);
  return f.toISOString().slice(0, 10);
}
const fmt = (iso, o) => new Date(iso).toLocaleString('en-US', { timeZone: TZ, ...o });
const when = (iso) => `${fmt(iso, { weekday: 'short' })} ${fmt(iso, { hour: 'numeric', minute: '2-digit' })}`.replace(':00', '');
const money = (n) => (Number.isInteger(+n) ? `$${+n}` : `$${(+n).toFixed(2)}`);

/** Fetches an event page and reads its schema.org Event JSON-LD (start time and price), if any. */
async function verify(url, startsAt) {
  if (!url || !/^https:\/\//.test(url)) return { status: 'no link' };
  if (/ticketmaster\.com|livenation\.com/.test(url)) return { status: 'check page (Ticketmaster blocks bots)' };
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(9000), headers: { 'User-Agent': 'Mozilla/5.0 (yard weekly draft)' } });
    if (!res.ok) return { status: `page ${res.status}` };
    const html = (await res.text()).slice(0, 2_000_000);
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      let d; try { d = JSON.parse(m[1]); } catch { continue; }
      const items = Array.isArray(d) ? d : d['@graph'] || [d];
      for (const it of items) {
        if (!it || !String(it['@type'] || '').includes('Event') || !it.startDate) continue;
        let off = it.offers || {}; if (Array.isArray(off)) off = off[0] || {};
        const lo = off.lowPrice ?? off.price, hi = off.highPrice;
        const price = lo == null || lo === '' ? null
          : +lo === 0 && (hi == null || +hi === 0) ? 'free'
          : +lo === 0 ? 'free + paid tiers'
          : hi && +hi > 3 * +lo ? `from ${money(lo)}` // VIP tables etc.
          : hi && +hi !== +lo ? `${money(lo)}–${money(hi)}` : money(lo);
        const diffMin = Math.abs(new Date(it.startDate) - new Date(startsAt)) / 60000;
        // Date-only startDate (no time) can't confirm a time.
        const timed = /T\d\d:\d\d/.test(it.startDate);
        // Some sites (camp.nc) publish local times with the wrong UTC offset: an exact 4–5 h gap is that bug, not a real change.
        const offsetBug = [240, 300].some((h) => Math.abs(diffMin - h) <= 5);
        return { status: !timed ? 'date only on page' : diffMin <= 20 ? 'verified' : offsetBug ? 'likely ok (site data has a timezone bug; check page)' : `time differs (page: ${when(it.startDate)})`, price };
      }
    }
    return { status: 'page has no event data' };
  } catch (e) {
    return { status: e.name === 'TimeoutError' ? 'page timeout' : 'page unreachable' };
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

(async () => {
  const friday = process.argv[2] || nextFriday();
  const email = process.env.YARD_TEST_EMAIL, password = process.env.YARD_TEST_PASSWORD;
  if (!email || !password) throw new Error('Set YARD_TEST_EMAIL and YARD_TEST_PASSWORD (the throwaway test account).');
  const db = createClient(pub('EXPO_PUBLIC_SUPABASE_URL'), pub('EXPO_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
  const { error: authErr } = await db.auth.signInWithPassword({ email, password });
  if (authErr) throw new Error(`test sign-in failed: ${authErr.message}`);

  const { data: feed, error } = await db.rpc('get_feed_range', { p_city_id: 1, p_start: friday, p_days: 3, p_lat: 35.2271, p_lng: -80.8431, p_radius_m: 40000 });
  if (error) throw error;
  const { data: ints } = await db.from('interests').select('id,slug');
  const slug = Object.fromEntries((ints || []).map((i) => [i.id, i.slug]));
  const ids = feed.map((r) => r.id);
  const rows = [];
  for (let k = 0; k < ids.length; k += 100) {
    const { data } = await db.from('events').select('id,ticket_url,source').in('id', ids.slice(k, k + 100));
    rows.push(...(data || []));
  }
  const extra = Object.fromEntries(rows.map((r) => [r.id, r]));

  const seen = new Set();
  const events = feed
    .filter((r) => { const k = r.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) + fmt(r.starts_at, { weekday: 'short' }); if (seen.has(k)) return false; seen.add(k); return true; })
    .map((r) => {
      const cats = (r.interest_ids || []).map((i) => slug[i]);
      const text = `${r.title} ${r.venue_name || ''}`;
      const nightlife = cats.includes('nightlife') || NIGHT.test(r.title);
      const tags = {
        solo: SOLO.test(text) && !/crawl/i.test(r.title),
        free: r.is_free || FREE.test(r.title),
        sober: !nightlife && !BOOZY.test(text),
        nightlife,
      };
      const score = (r.going_count || 0) * 2 + (r.friends_going?.length || 0) * 3 + (tags.solo ? 3 : 0) + (tags.free ? 2 : 0)
        + (r.image_url ? 1 : 0) + (extra[r.id]?.source === 'curated' ? 2 : 0);
      return { ...r, tags, score, link: extra[r.id]?.ticket_url || null, source: extra[r.id]?.source };
    })
    .sort((a, b) => b.score - a.score);

  // Verify the most likely picks (cap the page fetches).
  const candidates = events.slice(0, 40);
  const checks = await pool(candidates, 4, (e) => verify(e.link, e.starts_at));
  candidates.forEach((e, k) => { e.check = checks[k]; if (checks[k].price) e.price = checks[k].price; });

  const line = (e) => `| ${when(e.starts_at)} | ${e.title.replace(/\|/g, '/')} | ${e.venue_name || ''} | ${e.price || (e.tags.free ? 'free?' : '?')} | ${e.check?.status || 'not checked'} | ${e.link ? `[link](${e.link})` : ''} |`;
  const section = (title, pick) => {
    const list = candidates.filter(pick).slice(0, 8);
    return `## ${title}\n| When | Event | Venue | Price | Check | Link |\n|---|---|---|---|---|---|\n${list.map(line).join('\n') || '| | none found | | | | |'}\n`;
  };
  // Carousel: 5 picks. Verified solo-friendly and free first, then other verified, then pages we couldn't read as filler.
  // At most 2 nightlife picks, so it stays a "show up alone" list.
  const st = (e) => e.check?.status || '';
  const tier = (e) => (st(e) === 'verified' ? 0 : st(e).startsWith('likely ok') ? 1 : st(e).startsWith('check page') ? 2 : 9)
    + (e.tags.solo || e.tags.free || e.price === 'free' ? 0 : 0.5);
  const pick = []; let nights = 0;
  for (const e of candidates.filter((x) => tier(x) < 9).sort((a, b) => tier(a) - tier(b) || b.score - a.score)) {
    if (pick.length === 5) break;
    if (e.tags.nightlife && nights >= 2) continue;
    if (e.tags.nightlife) nights++;
    pick.push(e);
  }
  pick.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const sat = new Date(`${friday}T12:00:00Z`); const sun = new Date(sat); sun.setUTCDate(sat.getUTCDate() + 2);
  const range = `${fmt(sat, { month: 'numeric', day: 'numeric' })} – ${fmt(sun, { month: 'numeric', day: 'numeric' })}`;
  fs.mkdirSync(OUT, { recursive: true });
  const md = `# CLT this weekend: research draft (${friday})\n\nGenerated ${new Date().toISOString()} from the yard feed (${events.length} events Fri–Sun). ` +
    `"verified" = the event's own page lists the same start time. Everything else: open the link and check before posting.\n\n` +
    `## Picked for the carousel\n${pick.map((e) => `- ${when(e.starts_at)}: **${e.title}** @ ${e.venue_name || '?'} (${e.price || 'price?'}, ${e.check.status})`).join('\n') || '- (nothing verified yet; pick by hand from below)'}\n\n` +
    section('Solo-friendly', (e) => e.tags.solo) + '\n' + section('Free', (e) => e.tags.free || e.price === 'free') + '\n' +
    section('No drinking required', (e) => e.tags.sober) + '\n' + section('Nightlife', (e) => e.tags.nightlife) + '\n' +
    `## Everything else worth a look\n| When | Event | Venue | Price | Check | Link |\n|---|---|---|---|---|---|\n${candidates.filter((e) => !Object.values(e.tags).some(Boolean)).slice(0, 10).map(line).join('\n')}\n`;
  fs.writeFileSync(path.join(OUT, `${friday}-weekend.md`), md);

  const data = {
    id: `wk-${friday}`,
    slides: [
      { kind: 'cover', lines: ['your group chat', 'can’t decide?', 'here’s clt this weekend'], sub: `${range} · save this` },
      ...pick.map((e) => ({
        day: fmt(e.starts_at, { weekday: 'short' }).toLowerCase(), time: fmt(e.starts_at, { hour: 'numeric', minute: '2-digit' }).replace(':00', '').toLowerCase(),
        title: e.title.toLowerCase().slice(0, 60), venue: e.venue_name || '', detail: e.tags.solo ? 'easy to go solo' : '',
        price: e.price || undefined,
      })),
      { kind: 'end', lines: ['send this to the', 'person who never', 'picks a plan'], sub: 'new list every thursday 💌' },
    ],
  };
  fs.writeFileSync(path.join(OUT, `${friday}-weekend.js`), `// Auto-generated draft; edit freely. Add photo/credit per slide.\nwindow.YARD_NATIVE = ${JSON.stringify(data, null, 2)};\n`);
  console.log(path.join(OUT, `${friday}-weekend.md`));
  console.log(path.join(OUT, `${friday}-weekend.js`));
  console.log(`events ${events.length}, checked ${candidates.length}, verified ${candidates.filter((e) => e.check?.status === 'verified').length}, picked ${pick.length}`);
})().catch((e) => { console.error(e.message); process.exit(1); });

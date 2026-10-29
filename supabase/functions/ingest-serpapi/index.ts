import { createClient } from "npm:@supabase/supabase-js@2";
import { addressKey, FALLBACK_CENTER, parseCensus, parseEwkbPoint, withinCity } from "./geo.ts";
import { mapSerpapiEvent, type SerpEvent, type SerpRow } from "./mapper.ts";

const SERP_URL = "https://serpapi.com/search.json";
const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const PAGE_SIZE = 10;
const GEOCODE_TIMEOUT_MS = 5_000;
const MAX_FRESH_GEOCODES = 30; // per run; the rest are retried tomorrow
const GEOCODE_BUDGET_MS = 90_000; // free plan wall clock is 150 s; stop geocoding early
const ACCOUNT_URL = "https://serpapi.com/account.json";
const MIN_SEARCHES_LEFT = 8;

// Free plan = 250 searches/month and every page is one search. 2+1+1+1+1+1+1 = 8 per run, daily = ~240/month.
const QUERY_PLAN: { q: string; chip: string; pages: number }[] = [
  { q: "events in Charlotte NC", chip: "date:week", pages: 2 },
  { q: "concerts in Charlotte", chip: "date:week", pages: 1 },
  { q: "things to do this weekend Charlotte", chip: "date:weekend", pages: 1 },
  { q: "comedy Charlotte", chip: "date:week", pages: 1 },
  { q: "art events Charlotte", chip: "date:week", pages: 1 },
  { q: "free events Charlotte", chip: "date:week", pages: 1 },
  { q: "nightlife Charlotte", chip: "date:week", pages: 1 },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const chunk = <T>(a: T[], n = 100): T[][] =>
  Array.from({ length: Math.ceil(a.length / n) }, (_, k) => a.slice(k * n, (k + 1) * n));
const scrub = (m: string) => m.replace(/api_key=[^&\s]+/g, "api_key=***");

async function digest(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}
/** Constant-time compare of SHA-256 digests. */
async function authorized(provided: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret || !provided) return false;
  const [a, b] = await Promise.all([digest(provided), digest(`Bearer ${secret}`)]);
  let diff = 0;
  for (let k = 0; k < a.length; k++) diff |= a[k] ^ b[k];
  return diff === 0;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function fetchPage(params: URLSearchParams): Promise<SerpEvent[]> {
  const res = await fetch(`${SERP_URL}?${params}`, { signal: AbortSignal.timeout(20_000) }); // a hung page must not eat the run
  if (res.status === 429) {
    await res.body?.cancel();
    throw new Error("SerpApi 429"); // fatal: retrying would burn more of the quota
  }
  if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}`); // no URL: it contains the api_key
  const body = await res.json();
  if (body?.error) {
    // "Google hasn't returned any results for this query." is an empty page, not a failure.
    if (/hasn't returned any results/i.test(String(body.error))) return [];
    throw new Error(`SerpApi error: ${scrub(String(body.error)).slice(0, 200)}`);
  }
  return Array.isArray(body?.events_results) ? body.events_results : [];
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  const secret = Deno.env.get("INGEST_SECRET");
  if (req.method !== "POST" || !(await authorized(req.headers.get("Authorization"), secret))) {
    return json({ error: "unauthorized" }, 401);
  }
  const apiKey = Deno.env.get("SERPAPI_KEY");
  if (!apiKey) {
    return json({ error: "SERPAPI_KEY is not set. Run: npx supabase secrets set SERPAPI_KEY=<key>" }, 500);
  }

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: city, error: cityErr } = await db.from("cities").select("id, timezone, center").eq("slug", "charlotte").single();
    if (cityErr) throw cityErr;
    const center = parseEwkbPoint(city.center) ?? FALLBACK_CENTER;
    const { data: interests, error: intErr } = await db.from("interests").select("id, slug");
    if (intErr) throw intErr;
    const interestIds = Object.fromEntries((interests ?? []).map((i) => [i.slug, i.id]));

    // 0. Budget preflight (account.json is free and not counted). If it fails, search anyway.
    try {
      const res = await fetch(`${ACCOUNT_URL}?${new URLSearchParams({ api_key: apiKey })}`, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) {
        const left = (await res.json())?.total_searches_left;
        if (typeof left === "number" && left < MIN_SEARCHES_LEFT) return json({ skipped_run: "low_quota", searches_left: left });
      } else {
        await res.body?.cancel();
      }
    } catch {
      // preflight is best-effort
    }

    // 1. Search. Stop paging a query when a page is short or empty.
    let searches = 0, fetched = 0, skipped = 0, duplicates = 0, geocoded = 0, geocode_misses = 0, upserted = 0, errors = 0;
    const rows = new Map<string, SerpRow>();
    const now = new Date();
    search: for (const plan of QUERY_PLAN) {
      for (let page = 0; page < plan.pages; page++) {
        const params = new URLSearchParams({
          engine: "google_events", q: plan.q, hl: "en", gl: "us",
          location: "Charlotte, North Carolina, United States",
          htichips: plan.chip, start: String(page * PAGE_SIZE), api_key: apiKey,
        });
        let events: SerpEvent[];
        try {
          events = await fetchPage(params);
        } catch (e) {
          // Stop searching but keep (and process) what we already paid for.
          errors++;
          console.error("search failed:", scrub(e instanceof Error ? e.message : String(e)));
          break search;
        }
        searches++;
        fetched += events.length;
        for (const raw of events) {
          const row = await mapSerpapiEvent(raw, { cityId: city.id, interestIds, now, timezone: city.timezone });
          if (row) rows.set(row.external_id, row); // the same event shows up in several queries
          else skipped++;
        }
        if (events.length < PAGE_SIZE) break;
        await sleep(250);
      }
    }

    // 2. Never resurrect events an admin hid.
    for (const ids of chunk([...rows.keys()])) {
      const { data: hidden, error: hErr } = await db
        .from("events").select("external_id")
        .eq("source", "serpapi").eq("status", "hidden").in("external_id", ids);
      if (hErr) throw hErr;
      for (const h of hidden ?? []) {
        rows.delete(h.external_id!);
        skipped++;
      }
    }

    // 3. Geocode (cache first, including cached misses).
    const keys = [...new Set([...rows.values()].map((r) => addressKey(r.geocode_query)))];
    const coords = new Map<string, { lat: number; lng: number } | null>();
    for (const part of chunk(keys, 50)) {
      const { data, error } = await db.from("geocode_cache").select("address_key, lat, lng").in("address_key", part);
      if (error) throw error;
      for (const c of data ?? []) coords.set(c.address_key, c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null);
    }
    let fresh = 0;
    for (const key of keys) {
      if (coords.has(key) || fresh >= MAX_FRESH_GEOCODES || Date.now() - t0 > GEOCODE_BUDGET_MS) continue;
      fresh++;
      let hit: { lat: number; lng: number } | null;
      try {
        const url = `${CENSUS_URL}?${new URLSearchParams({ address: key, benchmark: "Public_AR_Current", format: "json" })}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS) });
        if (!res.ok) {
          await res.body?.cancel();
          continue; // transient: don't cache
        }
        hit = parseCensus(await res.json());
      } catch {
        continue; // timeout or network error: leave uncached, retry next run
      }
      coords.set(key, hit);
      const { error } = await db.from("geocode_cache")
        .upsert({ address_key: key, lat: hit?.lat ?? null, lng: hit?.lng ?? null }, { onConflict: "address_key" });
      if (error) throw error;
      if (hit) geocoded++;
    }

    // 4. Locate, drop cross-source duplicates.
    const dupIds: string[] = [];
    const ready: (Omit<SerpRow, "geocode_query" | "interest_ids"> & { location: string; interest_ids: number[] })[] = [];
    for (const r of rows.values()) {
      const c = coords.get(addressKey(r.geocode_query));
      if (!c || !withinCity(c, center)) {
        geocode_misses++;
        skipped++;
        continue;
      }
      const { data: dup, error } = await db.rpc("find_duplicate_event", {
        p_city_id: r.city_id, p_title: r.title, p_starts_at: r.starts_at,
        p_lat: c.lat, p_lng: c.lng, p_exclude_source: "serpapi",
      });
      if (error) throw error;
      if (dup) {
        duplicates++;
        dupIds.push(r.external_id);
        continue;
      }
      const { geocode_query: _g, ...rest } = r;
      ready.push({ ...rest, location: `SRID=4326;POINT(${c.lng} ${c.lat})` });
    }

    // Hide copies we saved on an earlier run, before the canonical source had the event.
    for (const ids of chunk(dupIds)) {
      const { error } = await db.from("events").update({ status: "hidden" })
        .eq("source", "serpapi").eq("status", "active").in("external_id", ids);
      if (error) throw error;
    }

    // 5. Upsert, then replace interests.
    if (ready.length > 0) {
      const idByExternal = new Map<string | null, string>();
      for (const part of chunk(ready, 100)) {
        const { data, error } = await db
          .from("events")
          .upsert(part.map(({ interest_ids: _i, ...r }) => r), { onConflict: "source,external_id" })
          .select("id, external_id");
        if (error) throw error;
        for (const e of data ?? []) idByExternal.set(e.external_id, e.id);
      }
      const links = ready.flatMap((r) =>
        r.interest_ids.map((interest_id) => ({ event_id: idByExternal.get(r.external_id)!, interest_id }))
      );
      for (const ids of chunk([...idByExternal.values()])) {
        const { error: delErr } = await db.from("event_interests").delete().in("event_id", ids);
        if (delErr) throw delErr;
      }
      for (const part of chunk(links)) {
        const { error: insErr } = await db.from("event_interests").insert(part);
        if (insErr) throw insErr;
      }
      upserted = ready.length;
    }

    return json({ searches, fetched, upserted, skipped, duplicates, geocoded, geocode_misses, errors });
  } catch (e) {
    // Log message only: fetch errors can embed the URL (and api_key).
    console.error("ingest-serpapi failed:", scrub(e instanceof Error ? e.message : String(e)));
    return json({ error: "ingest failed" }, 500);
  }
});

import { createClient } from "npm:@supabase/supabase-js@2";
import { addressKey, FALLBACK_CENTER, parseCensus, parseGeoapify, parseNominatim, parseEwkbPoint, withinCity } from "./geo.ts";
import { mapSerpapiEvent, type SerpEvent, type SerpRow } from "./mapper.ts";

const SERP_URL = "https://serpapi.com/search.json";
const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const PAGE_SIZE = 10;
const GEOCODE_TIMEOUT_MS = 4_000;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_UA = "yard-ingest/1.0 (+https://github.com/DixitSA/communityplansapp)";
const NOMINATIM_GAP_MS = 1_100; // usage policy: max 1 request/second
const GEOAPIFY_URL = "https://api.geoapify.com/v1/geocode/search";
const NOMINATIM_MAX_ERRORS = 3; // circuit breaker
const MISS_TTL_MS = 7 * 86_400_000;
const MAX_FRESH_GEOCODES = 60; // per run; the rest are retried tomorrow
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
const scrub = (m: string) => m.replace(/api_?key=[^&\s]+/gi, "api_key=***");

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

    // 3. Geocode: cache, then our own venues, Census (needs a street number), Geoapify (if keyed), Nominatim.
    // Fresh misses are cached for 7 days; transient errors are not cached.
    const geoapifyKey = Deno.env.get("GEOAPIFY_KEY");
    const hasStreet = new Map<string, boolean>();
    const venueOf = new Map<string, string>();
    for (const r of rows.values()) {
      const k = addressKey(r.geocode_query);
      hasStreet.set(k, r.geocode_has_street);
      if (r.venue_name && !venueOf.has(k)) venueOf.set(k, r.venue_name);
    }
    const keys = [...hasStreet.keys()];
    const coords = new Map<string, { lat: number; lng: number } | null>();
    for (const part of chunk(keys, 50)) {
      const { data, error } = await db.from("geocode_cache").select("address_key, lat, lng, created_at").in("address_key", part);
      if (error) throw error;
      for (const c of data ?? []) {
        if (c.lat != null && c.lng != null) coords.set(c.address_key, { lat: c.lat, lng: c.lng });
        else if (Date.now() - Date.parse(c.created_at) < MISS_TTL_MS) coords.set(c.address_key, null); // else: stale miss, retry
      }
    }
    let geocode_attempted = 0, geocode_errors = 0, geocode_nomatch = 0;
    let venue_hits = 0, census_hits = 0, geoapify_hits = 0, nominatim_hits = 0;
    const sample_misses: string[] = [];
    const geocode_error_samples: string[] = [];
    const noteError = (s: string) => {
      if (geocode_error_samples.length < 5 && !geocode_error_samples.includes(s)) geocode_error_samples.push(s);
    };
    let lastNominatim = 0, nominatimErrors = 0;
    type Hit = { lat: number; lng: number } | null;
    /** One external lookup. Never throws; error text is a short label (no URL, headers or keys). */
    const lookup = async (name: string, url: string, headers: HeadersInit, parse: (b: unknown) => Hit) => {
      try {
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS) });
        if (!res.ok) {
          await res.body?.cancel();
          noteError(`${name} ${res.status}`);
          return { hit: null as Hit, state: "error" as const };
        }
        const hit = parse(await res.json());
        return { hit, state: hit ? ("hit" as const) : ("nomatch" as const) };
      } catch (e) {
        noteError(`${name} ${e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network"}`);
        return { hit: null as Hit, state: "error" as const };
      }
    };
    const save = async (key: string, hit: Hit) => {
      coords.set(key, hit);
      const { error } = await db.from("geocode_cache").upsert(
        { address_key: key, lat: hit?.lat ?? null, lng: hit?.lng ?? null, created_at: new Date().toISOString() },
        { onConflict: "address_key" },
      );
      if (error) throw error;
    };

    // 3a. Free: venues we already know from other sources.
    for (const key of keys) {
      if (coords.has(key) && coords.get(key)) continue;
      const venue = venueOf.get(key);
      if (!venue || Date.now() - t0 > GEOCODE_BUDGET_MS) continue;
      const { data, error } = await db.rpc("find_venue_location", { p_city_id: city.id, p_venue: venue });
      if (error) throw error;
      if (data?.[0]) {
        venue_hits++;
        coords.set(key, { lat: data[0].lat, lng: data[0].lng }); // memory only: cheap to recompute, SQL fixes apply next run
      }
    }

    // 3b. External geocoders.
    let fresh = 0;
    for (const key of keys) {
      if (coords.has(key)) continue;
      if (fresh >= MAX_FRESH_GEOCODES || Date.now() - t0 > GEOCODE_BUDGET_MS) break;
      fresh++;
      geocode_attempted++;
      let hit: Hit = null, answered = false, failed = false;
      if (hasStreet.get(key)) {
        const r = await lookup("census", `${CENSUS_URL}?${new URLSearchParams({ address: key, benchmark: "Public_AR_Current", format: "json" })}`, {}, parseCensus);
        if (r.hit) { hit = r.hit; census_hits++; }
        else if (r.state === "nomatch") answered = true;
        else failed = true;
      }
      if (!hit && geoapifyKey) {
        const q = new URLSearchParams({
          text: key, filter: `circle:${center.lng},${center.lat},60000`, bias: `proximity:${center.lng},${center.lat}`,
          limit: "1", format: "json", apiKey: geoapifyKey,
        });
        const r = await lookup("geoapify", `${GEOAPIFY_URL}?${q}`, {}, parseGeoapify);
        if (r.hit) { hit = r.hit; geoapify_hits++; }
        else if (r.state === "nomatch") answered = true;
        else failed = true;
      }
      if (!hit) {
        if (nominatimErrors >= NOMINATIM_MAX_ERRORS) {
          failed = true; // breaker tripped: skip Nominatim for the rest of the run
        } else {
          const wait = lastNominatim + NOMINATIM_GAP_MS - Date.now();
          if (wait > 0) await sleep(wait);
          const q = new URLSearchParams({
            format: "jsonv2", limit: "1", countrycodes: "us", viewbox: "-81.25,35.55,-80.45,34.95", bounded: "1", q: key,
          });
          const r = await lookup("nominatim", `${NOMINATIM_URL}?${q}`, { "User-Agent": NOMINATIM_UA }, parseNominatim);
          lastNominatim = Date.now();
          if (r.hit) { hit = r.hit; nominatim_hits++; nominatimErrors = 0; }
          else if (r.state === "nomatch") { answered = true; nominatimErrors = 0; }
          else { failed = true; nominatimErrors++; }
        }
      }
      if (hit && !withinCity(hit, center)) { hit = null; answered = true; } // far from the city: treat as no match
      if (!hit && (failed || !answered)) {
        geocode_errors++; // not cached, retried next run
        if (sample_misses.length < 5) sample_misses.push(key);
        continue;
      }
      if (!hit) {
        geocode_nomatch++;
        if (sample_misses.length < 5) sample_misses.push(key);
      } else {
        geocoded++;
      }
      await save(key, hit);
    }

    // 4. Locate, drop cross-source duplicates.
    const dupIds: string[] = [];
    const ready: (Omit<SerpRow, "geocode_query" | "geocode_has_street" | "interest_ids"> & { location: string; interest_ids: number[] })[] = [];
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
      const { geocode_query: _g, geocode_has_street: _h, ...rest } = r;
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

    return json({ searches, fetched, upserted, skipped, duplicates, geocoded, geocode_misses, errors,
      geocode_attempted, geocode_errors, geocode_nomatch, venue_hits, census_hits, geoapify_hits, nominatim_hits, sample_misses,
      geocode_error_samples });
  } catch (e) {
    // Log message only: fetch errors can embed the URL (and api_key).
    console.error("ingest-serpapi failed:", scrub(e instanceof Error ? e.message : String(e)));
    return json({ error: "ingest failed" }, 500);
  }
});

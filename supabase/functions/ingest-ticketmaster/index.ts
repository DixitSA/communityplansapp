import { createClient } from "npm:@supabase/supabase-js@2";
import { mapTicketmasterEvent, type EventRow, type TmEvent } from "./mapper.ts";

const TM_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
const PAGE_SIZE = 200;
const MAX_PAGES = 5; // Ticketmaster deep paging limit: size * page < 1000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
const chunk = <T>(a: T[], n = 100): T[][] =>
  Array.from({ length: Math.ceil(a.length / n) }, (_, k) => a.slice(k * n, (k + 1) * n));

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

async function fetchPage(params: URLSearchParams): Promise<{ events: TmEvent[]; totalPages: number }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${TM_URL}?${params}`);
    if (res.status === 429) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (!res.ok) throw new Error(`Ticketmaster HTTP ${res.status}`); // no URL: it contains the apikey
    const body = await res.json();
    return { events: body?._embedded?.events ?? [], totalPages: body?.page?.totalPages ?? 0 };
  }
  throw new Error("Ticketmaster rate limit: gave up after retries");
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("INGEST_SECRET");
  if (req.method !== "POST" || !(await authorized(req.headers.get("Authorization"), secret))) {
    return json({ error: "unauthorized" }, 401);
  }
  // Fail fast with a setup hint instead of a confusing Ticketmaster 401 later. Only authorized callers see this.
  const apiKey = Deno.env.get("TICKETMASTER_API_KEY");
  if (!apiKey) {
    return json({ error: "TICKETMASTER_API_KEY is not set. Run: npx supabase secrets set TICKETMASTER_API_KEY=<key>" }, 500);
  }

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: city, error: cityErr } = await db.from("cities").select("id, timezone").eq("slug", "charlotte").single();
    if (cityErr) throw cityErr;
    const { data: interests, error: intErr } = await db.from("interests").select("id, slug");
    if (intErr) throw intErr;
    const interestIds = Object.fromEntries((interests ?? []).map((i) => [i.slug, i.id]));

    const now = new Date();
    const params = new URLSearchParams({
      apikey: apiKey,
      latlong: "35.2271,-80.8431",
      radius: "50",
      unit: "miles",
      size: String(PAGE_SIZE),
      sort: "date,asc",
      startDateTime: iso(now),
      endDateTime: iso(new Date(now.getTime() + 30 * 86_400_000)),
    });

    let fetched = 0, upserted = 0, skipped = 0, pages = 0, truncated = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      params.set("page", String(page));
      const { events, totalPages } = await fetchPage(params);
      pages++;
      fetched += events.length;

      // Ticketmaster can return the same event twice in one page set; keep the last.
      const rows = new Map<string, EventRow>();
      for (const raw of events) {
        const row = mapTicketmasterEvent(raw, { cityId: city.id, interestIds, timezone: city.timezone });
        if (row) rows.set(row.external_id, row);
        else skipped++;
      }

      // Never resurrect events an admin hid.
      if (rows.size > 0) {
        for (const ids of chunk([...rows.keys()])) {
          const { data: hidden, error: hErr } = await db
            .from("events").select("external_id")
            .eq("source", "ticketmaster").eq("status", "hidden").in("external_id", ids);
          if (hErr) throw hErr;
          for (const h of hidden ?? []) {
            rows.delete(h.external_id!);
            skipped++;
          }
        }
      }

      if (rows.size > 0) {
        const list = [...rows.values()];
        const { data, error } = await db
          .from("events")
          .upsert(list.map(({ interest_ids: _i, ...r }) => r), { onConflict: "source,external_id" })
          .select("id, external_id");
        if (error) throw error;

        const idByExternal = new Map((data ?? []).map((e) => [e.external_id, e.id]));
        const eventIds = [...idByExternal.values()];
        const links = list.flatMap((r) =>
          r.interest_ids.map((interest_id) => ({ event_id: idByExternal.get(r.external_id)!, interest_id }))
        );
        for (const ids of chunk(eventIds)) {
          const { error: delErr } = await db.from("event_interests").delete().in("event_id", ids);
          if (delErr) throw delErr;
        }
        if (links.length) {
          const { error: insErr } = await db.from("event_interests").insert(links);
          if (insErr) throw insErr;
        }
        upserted += list.length;
      }

      if (page + 1 >= totalPages) break;
      if (page + 1 >= MAX_PAGES) {
        truncated = totalPages > MAX_PAGES;
        break;
      }
      await sleep(250);
    }

    return json({ fetched, upserted, skipped, pages, truncated });
  } catch (e) {
    // Log message only: fetch errors can embed the URL (and apikey).
    console.error("ingest failed:", (e instanceof Error ? e.message : String(e)).replace(/apikey=[^&\s]+/g, "apikey=***"));
    return json({ error: "ingest failed" }, 500);
  }
});

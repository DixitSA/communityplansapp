import { createClient } from "npm:@supabase/supabase-js@2";
import { mapTicketmasterEvent, type EventRow, type TmEvent } from "./mapper.ts";

const TM_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
const PAGE_SIZE = 200;
const MAX_PAGES = 4; // Ticketmaster deep paging limit: size * page < 1000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function fetchPage(params: URLSearchParams): Promise<{ events: TmEvent[]; totalPages: number }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${TM_URL}?${params}`);
    if (res.status === 429) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (!res.ok) throw new Error(`Ticketmaster ${res.status}`);
    const body = await res.json();
    return { events: body?._embedded?.events ?? [], totalPages: body?.page?.totalPages ?? 0 };
  }
  throw new Error("Ticketmaster rate limit: gave up after retries");
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("INGEST_SECRET");
  if (req.method !== "POST" || !secret || req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, 401);
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
      apikey: Deno.env.get("TICKETMASTER_API_KEY") ?? "",
      latlong: "35.2271,-80.8431",
      radius: "50",
      unit: "miles",
      size: String(PAGE_SIZE),
      sort: "date,asc",
      startDateTime: iso(now),
      endDateTime: iso(new Date(now.getTime() + 30 * 86_400_000)),
    });

    let fetched = 0, upserted = 0, skipped = 0, pages = 0;
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
        const { error: delErr } = await db.from("event_interests").delete().in("event_id", eventIds);
        if (delErr) throw delErr;
        if (links.length) {
          const { error: insErr } = await db.from("event_interests").insert(links);
          if (insErr) throw insErr;
        }
        upserted += list.length;
      }

      if (page + 1 >= totalPages) break;
      await sleep(250);
    }

    return json({ fetched, upserted, skipped, pages });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "ingest failed" }, 500);
  }
});

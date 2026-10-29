import { createClient } from "npm:@supabase/supabase-js@2";
import { parseIcs } from "./ics.ts";
import { mapIcalEvent, type EventRow, type IcalSource } from "./mapper.ts";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_ROWS_PER_SOURCE = 1000;
const BATCH = 200;
const MAX_BYTES = 2 * 1024 * 1024;
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

/** Fetch with a 10 s timeout and a 2 MB cap (streamed, so a lying Content-Length can't help). */
async function fetchFeed(url: string): Promise<string> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS); // one budget for all hops
  let current = new URL(url);
  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "https:") throw new Error("feed redirected to a non-https URL");
    res = await fetch(current, { signal, redirect: "manual", headers: { Accept: "text/calendar" } });
    if (res.status < 300 || res.status >= 400) break;
    const loc = res.headers.get("location");
    await res.body?.cancel();
    if (!loc) throw new Error("redirect without location");
    if (hop === MAX_REDIRECTS) throw new Error("too many redirects");
    current = new URL(loc, current);
  }
  if (!res) throw new Error("feed fetch failed");
  if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("feed too large");
  const reader = res.body?.getReader();
  if (!reader) throw new Error("feed has no body");
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("feed too large");
    }
    parts.push(value);
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { all.set(p, off); off += p.length; }
  return new TextDecoder().decode(all);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("INGEST_SECRET");
  if (req.method !== "POST" || !(await authorized(req.headers.get("Authorization"), secret))) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: interests, error: intErr } = await db.from("interests").select("id, slug");
    if (intErr) throw intErr;
    const interestIds = Object.fromEntries((interests ?? []).map((i) => [i.slug, i.id]));
    const { data: cities, error: cityErr } = await db.from("cities").select("id, timezone");
    if (cityErr) throw cityErr;
    const tzByCity = new Map((cities ?? []).map((c) => [c.id, c.timezone as string]));
    const { data: sources, error: srcErr } = await db.from("event_sources").select("*").eq("active", true);
    if (srcErr) throw srcErr;

    let fetched = 0, upserted = 0, skipped = 0;
    for (const source of (sources ?? []) as (IcalSource & { url: string })[]) {
      try {
        const events = parseIcs(await fetchFeed(source.url));
        fetched += events.length;
        const rows = new Map<string, EventRow>();
        for (const ev of events) {
          const row = mapIcalEvent(ev, source, { interestIds, now: new Date(), timezone: tzByCity.get(source.city_id) });
          if (row) rows.set(row.external_id, row);
          else skipped++;
        }

        // Never resurrect events an admin hid.
        // One query per source: feed-controlled UIDs never go into a filter.
        const { data: hidden, error: hErr } = await db
          .from("events").select("external_id")
          .eq("source", "ical").eq("status", "hidden").like("external_id", `${source.id}:%`);
        if (hErr) throw hErr;
        for (const h of hidden ?? []) {
          if (rows.delete(h.external_id!)) skipped++;
        }
        for (const key of [...rows.keys()].slice(MAX_ROWS_PER_SOURCE)) {
          rows.delete(key);
          skipped++;
        }

        if (rows.size > 0) {
          const list = [...rows.values()];
          const idByExternal = new Map<string | null, string>();
          for (const part of chunk(list, BATCH)) {
            const { data, error } = await db
              .from("events")
              .upsert(part.map(({ interest_ids: _i, ...r }) => r), { onConflict: "source,external_id" })
              .select("id, external_id");
            if (error) throw error;
            for (const e of data ?? []) idByExternal.set(e.external_id, e.id);
          }
          const links = list.flatMap((r) =>
            r.interest_ids.map((interest_id) => ({ event_id: idByExternal.get(r.external_id)!, interest_id }))
          );
          for (const ids of chunk([...idByExternal.values()], BATCH)) {
            const { error: delErr } = await db.from("event_interests").delete().in("event_id", ids);
            if (delErr) throw delErr;
          }
          for (const part of chunk(links, BATCH)) {
            const { error: insErr } = await db.from("event_interests").insert(part);
            if (insErr) throw insErr;
          }
          upserted += list.length;
        }
        await db.from("event_sources").update({ last_run_at: new Date().toISOString(), last_error: null }).eq("id", source.id);
      } catch (e) {
        // One bad feed must not stop the others. Message only, truncated.
        const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
        console.error(`source ${source.id} failed:`, msg);
        await db.from("event_sources").update({ last_run_at: new Date().toISOString(), last_error: msg }).eq("id", source.id);
      }
    }
    return json({ sources: sources?.length ?? 0, fetched, upserted, skipped });
  } catch (e) {
    console.error("ingest-ical failed:", e instanceof Error ? e.message : String(e));
    return json({ error: "ingest failed" }, 500);
  }
});

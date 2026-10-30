import { createClient } from "npm:@supabase/supabase-js@2";
import { addressKey, FALLBACK_CENTER, parseCensus, parseEwkbPoint, parseGeoapify, withinCity } from "../ingest-serpapi/geo.ts";
import { geocodeQuery, interestSlugs } from "../ingest-serpapi/mapper.ts";
import { attributionFor, dateWindow, isFree, titleOk, truncateDescription } from "./rules.ts";

const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const GEOAPIFY_URL = "https://api.geoapify.com/v1/geocode/search";
const CENSUS_TIMEOUT_MS = 4_000;
const GEOAPIFY_TIMEOUT_MS = 8_000;
const MISS_TTL_MS = 7 * 86_400_000;
const MAX_FRESH_GEOCODES = 60;
const GEOCODE_BUDGET_MS = 90_000;
const LOAD_LIMIT = 300;
// Only images we copied into our own bucket get published: external (e.g. Instagram CDN) links expire
// and would make every viewer's phone load from a third party.
const bucketPrefix = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/event-images/`;
const MAX_TEXT = 200;

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

type Hit = { lat: number; lng: number } | null;

Deno.serve(async (req) => {
  const t0 = Date.now();
  if (req.method !== "POST" || !(await authorized(req.headers.get("Authorization"), Deno.env.get("INGEST_SECRET")))) {
    return json({ error: "unauthorized" }, 401);
  }
  const live = Deno.env.get("AUTO_APPROVE") === "on";
  const maxApprovals = Number.parseInt(Deno.env.get("AUTO_APPROVE_MAX") ?? "40", 10);
  const max = Number.isFinite(maxApprovals) && maxApprovals >= 0 ? maxApprovals : 40;
  const geoapifyKey = Deno.env.get("GEOAPIFY_KEY");

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: city, error: cityErr } = await db.from("cities").select("id, center").eq("slug", "charlotte").single();
    if (cityErr) throw cityErr;
    const center = parseEwkbPoint(city.center) ?? FALLBACK_CENTER;
    const { data: interests, error: intErr } = await db.from("interests").select("id, slug");
    if (intErr) throw intErr;
    const interestIds = Object.fromEntries((interests ?? []).map((i) => [i.slug, i.id]));

    const { data: subs, error: subErr } = await db
      .from("event_submissions")
      .select("id, title, starts_at, ends_at, venue, address, link, image_url, details, source_handle, admin_note")
      .eq("status", "pending").eq("origin", "agent").eq("city_id", city.id)
      .order("starts_at", { ascending: true }).limit(LOAD_LIMIT); // past rows first (rejected), far-off rows last, so they can't stall the queue
    if (subErr) throw subErr;

    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count: recent, error: recErr } = await db
      .from("event_submissions").select("id", { count: "exact", head: true })
      .eq("admin_note", "auto-approved").gt("reviewed_at", since);
    if (recErr) throw recErr;
    let budget = Math.max(0, max - (recent ?? 0));

    const leftPending: Record<string, number> = {};
    let approved = 0, rejected = 0, capped = false, fresh = 0;
    const now = new Date();

    const stay = async (id: string, current: string | null, reason: string, note: string | null = reason) => {
      leftPending[reason] = (leftPending[reason] ?? 0) + 1;
      if (live && note !== null && note !== current) {
        const { error } = await db.from("event_submissions").update({ admin_note: note }).eq("id", id);
        if (error) throw error;
      }
    };

    /** Cache, our own venues, Census (street number), Geoapify (keyed, precise types only). Null = not placed. */
    const locate = async (venue: string, address: string | null): Promise<Hit> => {
      const { data: v, error: vErr } = await db.rpc("find_venue_location", { p_city_id: city.id, p_venue: venue });
      if (vErr) throw vErr;
      if (v?.[0]) return withinCity(v[0], center) ? { lat: v[0].lat, lng: v[0].lng } : null;

      const q = address ? geocodeQuery([address]) : { query: `${venue}, Charlotte, NC`, hasStreet: false };
      const key = addressKey(q.query);
      const { data: cached, error: cErr } = await db.from("geocode_cache").select("lat, lng, created_at").eq("address_key", key).maybeSingle();
      if (cErr) throw cErr;
      if (cached?.lat != null && cached.lng != null) {
        const c = { lat: cached.lat, lng: cached.lng };
        return withinCity(c, center) ? c : null;
      }
      if (cached && Date.now() - Date.parse(cached.created_at) < MISS_TTL_MS) return null; // recent miss
      if (fresh >= MAX_FRESH_GEOCODES || Date.now() - t0 > GEOCODE_BUDGET_MS) return null;
      fresh++;

      const lookup = async (url: string, parse: (b: unknown) => Hit, timeoutMs: number) => {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
          if (!res.ok) {
            await res.body?.cancel();
            return { hit: null as Hit, failed: true };
          }
          return { hit: parse(await res.json()), failed: false };
        } catch {
          return { hit: null as Hit, failed: true };
        }
      };
      let hit: Hit = null, failed = false;
      if (q.hasStreet) {
        const r = await lookup(`${CENSUS_URL}?${new URLSearchParams({ address: key, benchmark: "Public_AR_Current", format: "json" })}`, parseCensus, CENSUS_TIMEOUT_MS);
        hit = r.hit;
        failed ||= r.failed;
      }
      if (!hit && geoapifyKey) {
        const p = new URLSearchParams({
          text: key, filter: `circle:${center.lng},${center.lat},60000`, bias: `proximity:${center.lng},${center.lat}`,
          limit: "1", format: "json", apiKey: geoapifyKey,
        });
        if (!q.hasStreet) p.set("type", "amenity");
        const r = await lookup(`${GEOAPIFY_URL}?${p}`, parseGeoapify, GEOAPIFY_TIMEOUT_MS);
        hit = r.hit;
        failed ||= r.failed;
      }
      if (hit && !withinCity(hit, center)) hit = null;
      if (!hit && failed) return null; // transient: not cached, retried next run
      if (live) {
        const { error } = await db.from("geocode_cache").upsert(
          { address_key: key, lat: hit?.lat ?? null, lng: hit?.lng ?? null, created_at: new Date().toISOString() },
          { onConflict: "address_key" },
        );
        if (error) throw error;
      }
      return hit;
    };

    for (const s of subs ?? []) {
      let counted = false;
      try {
        const when = dateWindow(s.starts_at, now);
        if (when === "past") {
          rejected++;
          if (live) {
            const { error } = await db.from("event_submissions")
              .update({ status: "rejected", admin_note: "auto: in the past", reviewed_at: new Date().toISOString() })
              .eq("id", s.id).eq("status", "pending");
            if (error) throw error;
          }
          continue;
        }
        if (when === "too_far") { await stay(s.id, s.admin_note, "auto: more than 60 days out"); continue; }
        if (!titleOk(s.title)) { await stay(s.id, s.admin_note, "auto: title looks like junk"); continue; }
        if (!s.venue) { await stay(s.id, s.admin_note, "auto: no venue"); continue; }
        if (budget <= 0) {
          capped = true;
          await stay(s.id, s.admin_note, "auto: capped", null); // no note: it is waiting, not wrong
          continue;
        }

        const c = await locate(s.venue, s.address);
        if (!c) { await stay(s.id, s.admin_note, "auto: could not place venue"); continue; }

        const { data: dup, error: dupErr } = await db.rpc("find_duplicate_event", {
          p_city_id: city.id, p_title: s.title, p_starts_at: s.starts_at, p_lat: c.lat, p_lng: c.lng, p_exclude_source: "agent",
        });
        if (dupErr) throw dupErr;
        if (dup) {
          const note = `auto: duplicate of ${dup}`;
          leftPending["auto: duplicate"] = (leftPending["auto: duplicate"] ?? 0) + 1;
          if (live && note !== s.admin_note) {
            const { error } = await db.from("event_submissions").update({ admin_note: note }).eq("id", s.id);
            if (error) throw error;
          }
          continue;
        }

        budget--;
        approved++;
        counted = true;
        if (!live) continue;

        const { data: ev, error: evErr } = await db.from("events").upsert({
          source: "agent", external_id: s.id, status: "active", city_id: city.id,
          title: s.title.slice(0, MAX_TEXT), starts_at: s.starts_at, ends_at: s.ends_at,
          venue_name: s.venue.slice(0, MAX_TEXT), venue_address: s.address?.slice(0, MAX_TEXT * 2) ?? null,
          location: `SRID=4326;POINT(${c.lng} ${c.lat})`,
          ticket_url: s.link, image_url: s.image_url?.startsWith(bucketPrefix) ? s.image_url : null, description: truncateDescription(s.details),
          attribution: attributionFor(s.source_handle), is_free: isFree(s.title, s.details), price_min: null,
        }, { onConflict: "source,external_id" }).select("id").single();
        if (evErr) throw evErr;

        const links = interestSlugs(s.title, s.details ?? "")
          .map((slug) => interestIds[slug]).filter((id): id is number => typeof id === "number")
          .map((interest_id) => ({ event_id: ev.id, interest_id }));
        if (links.length > 0) {
          const { error } = await db.from("event_interests").upsert(links, { onConflict: "event_id,interest_id", ignoreDuplicates: true });
          if (error) throw error;
        }
        const { error: updErr } = await db.from("event_submissions")
          .update({ status: "approved", event_id: ev.id, reviewed_at: new Date().toISOString(), admin_note: "auto-approved" })
          .eq("id", s.id).eq("status", "pending");
        if (updErr) throw updErr;
      } catch {
        // Per-row isolation: leave it pending, note it, carry on. Never log row content.
        if (counted) { approved--; budget++; }
        leftPending["auto: error"] = (leftPending["auto: error"] ?? 0) + 1;
        if (live && s.admin_note !== "auto: error") {
          await db.from("event_submissions").update({ admin_note: "auto: error" }).eq("id", s.id).eq("status", "pending");
        }
      }
    }

    const considered = subs?.length ?? 0;
    console.log(`review-inbox dry_run=${!live} considered=${considered} approved=${approved} rejected=${rejected} capped=${capped} left_pending=${JSON.stringify(leftPending)}`);
    return json({ dry_run: !live, considered, approved, rejected, left_pending: leftPending, capped });
  } catch (e) {
    console.error("review-inbox failed:", e instanceof Error ? e.message.slice(0, 200) : "unknown");
    return json({ error: "review failed" }, 500);
  }
});

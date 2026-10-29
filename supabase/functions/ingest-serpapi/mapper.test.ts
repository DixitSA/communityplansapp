import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { externalId, interestSlugs, mapSerpapiEvent, type MapContext, parseWhen, pickImage, type SerpEvent } from "./mapper.ts";
import { addressKey, haversineKm, parseCensus, parseEwkbPoint, withinCity } from "./geo.ts";

// Thu 2026-10-29 12:00 EDT. Clocks fall back on Sun 2026-11-01, so Nov events are EST.
const now = new Date("2026-10-29T16:00:00Z");
const ctx: MapContext = {
  cityId: 1, now,
  interestIds: { music: 2, comedy: 12, community: 9, arts_culture: 5, nightlife: 1, wellness: 7, food_drinks: 3 },
};
const load = async (n: string): Promise<SerpEvent[]> =>
  JSON.parse(await Deno.readTextFile(new URL(`./fixtures/${n}.json`, import.meta.url))).events_results;
const iso = (p: ReturnType<typeof parseWhen>) => p && [new Date(p.startMs).toISOString(), p.endMs ? new Date(p.endMs).toISOString() : null];

Deno.test("'Fri, Oct 30, 8 – 11 PM EDT': start borrows PM from the end", () => {
  assertEquals(iso(parseWhen("Fri, Oct 30, 8 – 11 PM EDT", now)), ["2026-10-31T00:00:00.000Z", "2026-10-31T03:00:00.000Z"]);
});

Deno.test("multi-day with AM/PM on both sides, DST ends in between", () => {
  assertEquals(iso(parseWhen("Sat, Oct 31, 10 AM – Sun, Nov 1, 2 PM", now)), ["2026-10-31T14:00:00.000Z", "2026-11-01T19:00:00.000Z"]);
});

Deno.test("Tomorrow and Today are relative to city time, not UTC", () => {
  assertEquals(iso(parseWhen("Tomorrow, 7 – 10 PM", now)), ["2026-10-30T23:00:00.000Z", "2026-10-31T02:00:00.000Z"]);
  assertEquals(iso(parseWhen("Today, 9 PM", now)), ["2026-10-30T01:00:00.000Z", null]);
  // 01:00Z on Oct 30 is still Oct 29 in Charlotte.
  assertEquals(iso(parseWhen("Today, 9 PM", new Date("2026-10-30T01:00:00Z"))), ["2026-10-30T01:00:00.000Z", null]);
});

Deno.test("overnight end rolls to the next day", () => {
  assertEquals(iso(parseWhen("Thu, Nov 5, 7:30 PM – 12 AM EDT", now)), ["2026-11-06T00:30:00.000Z", "2026-11-06T05:00:00.000Z"]);
  assertEquals(iso(parseWhen("Fri, Oct 30, 10 PM – 2 AM", now)), ["2026-10-31T02:00:00.000Z", "2026-10-31T06:00:00.000Z"]);
});

Deno.test("ambiguous start meridiem picks the reading that ends after it starts", () => {
  assertEquals(iso(parseWhen("Fri, Oct 30, 10 – 2 PM", now)), ["2026-10-30T14:00:00.000Z", "2026-10-30T18:00:00.000Z"]);
});

Deno.test("'9 – 1 AM' is 9 PM to 1 AM", () => {
  assertEquals(iso(parseWhen("Fri, Oct 30, 9 – 1 AM", now)), ["2026-10-31T01:00:00.000Z", "2026-10-31T05:00:00.000Z"]);
});

Deno.test("unclear times are skipped: date only, range without times, missing, bare hour", () => {
  for (const w of ["Wed, Nov 4", "Nov 1 – 3", "Fri, Nov 6 – Sun, Nov 8", "", undefined, "Fri, Oct 30, 8", "Sometime soon"]) {
    assertEquals(parseWhen(w, now), null, String(w));
  }
});

Deno.test("year inference wraps across New Year", () => {
  const dec30 = new Date("2026-12-30T17:00:00Z");
  assertEquals(iso(parseWhen("Fri, Jan 1, 8 PM", dec30)), ["2027-01-02T01:00:00.000Z", null]);
  // Yesterday still resolves to this year (nearest on/after now - 1 day).
  const jan1 = new Date("2027-01-01T17:00:00Z");
  assertEquals(iso(parseWhen("Thu, Dec 31, 8 PM", jan1)), ["2027-01-01T01:00:00.000Z", null]);
  // Range that crosses the year end.
  assertEquals(iso(parseWhen("Thu, Dec 31, 10 PM – Fri, Jan 1, 1 AM", dec30)), ["2027-01-01T03:00:00.000Z", "2027-01-01T06:00:00.000Z"]);
});

Deno.test("jazz fixture: ticket link preferred, Google thumbnail dropped, free from description", async () => {
  const r = (await mapSerpapiEvent((await load("timed"))[0], ctx))!;
  assertEquals(r.ticket_url, "https://www.eventbrite.com/e/jazz-123");
  assertEquals(r.image_url, null);
  assertEquals(r.attribution, "via Eventbrite");
  assertEquals(r.venue_name, "The Evening Muse");
  assertEquals(r.venue_address, "The Evening Muse, 3227 N Davidson St, Charlotte, NC");
  assertEquals(r.geocode_query, "3227 N Davidson St, Charlotte, NC");
  assertEquals([r.is_free, r.price_min], [true, null]);
  assertEquals(r.interest_ids, [2]);
  assertEquals(r.source, "serpapi");
});

Deno.test("market fixture: own-host image kept, falls back to link, multi-day end", async () => {
  const r = (await mapSerpapiEvent((await load("timed"))[1], ctx))!;
  assertEquals(r.image_url, "https://campnorthend.com/img/market.jpg");
  assertEquals(r.ticket_url, "https://campnorthend.com/market");
  assertEquals(r.ends_at, "2026-11-01T19:00:00.000Z");
  assertEquals(r.attribution, "via Google Events");
  assertEquals(r.is_free, false);
});

Deno.test("comedy: 'no cover' means free, comedy interest", async () => {
  const r = (await mapSerpapiEvent((await load("timed"))[2], ctx))!;
  assertEquals([r.is_free, r.interest_ids], [true, [12]]);
});

Deno.test("today with no end maps; default interest and venue from address when venue missing", async () => {
  const ev = (await load("timed"))[3];
  const r = (await mapSerpapiEvent({ ...ev, venue: undefined }, ctx))!;
  assertEquals(r.ends_at, null);
  assertEquals(r.venue_name, "Merchant & Trade");
  assertEquals(r.interest_ids, [2]); // "DJ" / "sounds" -> music
  const plain = (await mapSerpapiEvent({ ...ev, title: "Rooftop Sunset", description: "Views." }, ctx))!;
  assertEquals(plain.interest_ids, [9]); // default: community
});

Deno.test("overnight fixture", async () => {
  const r = (await mapSerpapiEvent((await load("timed"))[4], ctx))!;
  assertEquals([r.starts_at, r.ends_at], ["2026-11-06T00:30:00.000Z", "2026-11-06T05:00:00.000Z"]);
  assertEquals(r.interest_ids, [12]);
});

Deno.test("untimed, out-of-window, already-ended and address-less events are skipped", async () => {
  const all = await load("untimed");
  assertEquals(all.length, 7);
  for (const ev of all) assertEquals(await mapSerpapiEvent(ev, ctx), null, ev.title ?? "(no title)");
});

Deno.test("30 day window edge", async () => {
  const ev = { ...(await load("timed"))[0] };
  ev.date = { when: "Sat, Nov 28, 10 AM" };
  assert(await mapSerpapiEvent(ev, ctx));
  ev.date = { when: "Sun, Nov 29, 10 AM" };
  assertEquals(await mapSerpapiEvent(ev, ctx), null);
});

Deno.test("external_id is stable, ignores case and punctuation, and differs by day or venue", async () => {
  const day = { y: 2026, m: 11, d: 1 };
  const a = await externalId("Jazz Night!", day, "The Muse");
  assertEquals(a, await externalId("jazz night", day, "the muse"));
  assertEquals(a.length, 32);
  assertNotEquals(a, await externalId("Jazz Night", { ...day, d: 2 }, "The Muse"));
  assertNotEquals(a, await externalId("Jazz Night", day, "Other Venue"));
  const ev = (await load("timed"))[0];
  assertEquals((await mapSerpapiEvent(ev, ctx))!.external_id, (await mapSerpapiEvent(ev, ctx))!.external_id);
});

Deno.test("Google-hosted images are never used", () => {
  assertEquals(pickImage("https://encrypted-tbn0.gstatic.com/images?q=tbn:x"), null);
  assertEquals(pickImage("https://lh3.googleusercontent.com/abc"), null);
  assertEquals(pickImage("https://www.google.com/img.png"), null);
  assertEquals(pickImage("https://serpapi.com/searches/abc/image.png"), null);
  assertEquals(pickImage("http://example.com/a.jpg"), null);
  assertEquals(pickImage(undefined), null);
  assertEquals(pickImage("https://cdn.example.com/a.jpg"), "https://cdn.example.com/a.jpg");
});

Deno.test("interest keywords and default", () => {
  assertEquals(interestSlugs("Yoga in the Park", ""), ["wellness", "outdoor"]);
  assertEquals(interestSlugs("Craft Beer Tasting", ""), ["food_drinks"]);
  assertEquals(interestSlugs("Gluten-free bake sale", ""), ["community"].filter(() => false).length ? [] : ["community"]);
  assertEquals(interestSlugs("Thing", "nothing relevant"), ["community"]);
});

Deno.test("'free' heuristics don't fire on free parking or gluten-free", async () => {
  const base = (await load("timed"))[2];
  const r = await mapSerpapiEvent({ ...base, title: "Gluten-free bake-off", description: "Free parking on site." }, ctx);
  assertEquals(r!.is_free, false);
});

Deno.test("description is truncated to 500 characters", async () => {
  const r = await mapSerpapiEvent({ ...(await load("timed"))[1], description: "x".repeat(900) }, ctx);
  assertEquals(r!.description!.length, 500);
});

Deno.test("geo: key normalization, distance rule, census and EWKB parsing", () => {
  assertEquals(addressKey('1 "A" B\\C St'), "1 a bc st");
  assertEquals(addressKey("  123  Main St,\nCharlotte, NC "), "123 main st, charlotte, nc");
  assert(withinCity({ lat: 35.2251, lng: -80.8397 }));
  assert(!withinCity({ lat: 35.7796, lng: -78.6382 })); // Raleigh
  assert(Math.abs(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.2) < 0.5);
  assertEquals(parseCensus({ result: { addressMatches: [{ coordinates: { x: -80.8, y: 35.2 } }] } }), { lat: 35.2, lng: -80.8 });
  assertEquals(parseCensus({ result: { addressMatches: [] } }), null);
  // POINT(-80.8431 35.2271) as EWKB little-endian.
  const buf = new DataView(new ArrayBuffer(16));
  buf.setFloat64(0, -80.8431, true);
  buf.setFloat64(8, 35.2271, true);
  const hex = [...new Uint8Array(buf.buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
  assertEquals(parseEwkbPoint("0101000020E6100000" + hex), { lat: 35.2271, lng: -80.8431 });
});

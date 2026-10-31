import { assert, assertEquals } from "jsr:@std/assert@1";
import { localToUtcIso, mapTicketmasterEvent, type MapContext, type TmEvent } from "./mapper.ts";

const ctx: MapContext = {
  cityId: 1,
  interestIds: { music: 2, sports: 6, arts_culture: 5, comedy: 12, community: 9, nightlife: 1 },
};
const load = async (n: string): Promise<TmEvent> =>
  JSON.parse(await Deno.readTextFile(new URL(`./fixtures/${n}.json`, import.meta.url)));

Deno.test("concert maps fields, widest 16:9 image and prices", async () => {
  const r = mapTicketmasterEvent(await load("concert"), ctx)!;
  assertEquals(r.starts_at, "2026-11-15T01:00:00.000Z");
  assertEquals(r.location, "SRID=4326;POINT(-80.8397 35.2251)");
  assert(r.image_url!.endsWith("_large.jpg"));
  assertEquals([r.price_min, r.price_max, r.is_free], [35, 95.5, false]);
  assertEquals(r.interest_ids, [2]);
  assertEquals(r.attribution, "Tickets on Ticketmaster");
  assertEquals(r.description, "Doors at 7pm.");
  assertEquals(r.venue_address, "100 Main St, Charlotte, NC");
});

Deno.test("game maps to sports", async () => {
  assertEquals(mapTicketmasterEvent(await load("game"), ctx)!.interest_ids, [6]);
});

Deno.test("comedy converts local time (EST) and maps to comedy", async () => {
  const r = mapTicketmasterEvent(await load("comedy"), ctx)!;
  assertEquals(r.starts_at, "2026-12-06T02:00:00.000Z");
  assertEquals(r.interest_ids, [12]);
  assertEquals(r.description, "21+ with ID.");
});

Deno.test("club night adds nightlife and is free", async () => {
  const r = mapTicketmasterEvent(await load("club_night"), ctx)!;
  assertEquals(r.interest_ids, [2, 1]);
  assert(r.is_free);
});

Deno.test("TBA date and missing venue are skipped", async () => {
  assertEquals(mapTicketmasterEvent(await load("tba"), ctx), null);
  assertEquals(mapTicketmasterEvent(await load("no_venue"), ctx), null);
});

Deno.test("cancelled status and EDT conversion", async () => {
  const raw = await load("game");
  raw.dates!.status!.code = "cancelled";
  assertEquals(mapTicketmasterEvent(raw, ctx)!.status, "cancelled");
  assertEquals(localToUtcIso("2026-07-04", "20:00:00", "America/New_York"), "2026-07-05T00:00:00.000Z");
});

Deno.test("long description is truncated to 500", async () => {
  const raw = await load("concert");
  raw.info = "x".repeat(900);
  assertEquals(mapTicketmasterEvent(raw, ctx)!.description!.length, 500);
});

Deno.test("no-time event is skipped", async () => {
  assertEquals(mapTicketmasterEvent(await load("no_time"), ctx), null);
});

Deno.test("bad venue coordinates are skipped", async () => {
  assertEquals(mapTicketmasterEvent(await load("bad_venue"), ctx), null);
  const raw = await load("concert");
  raw._embedded!.venues![0].location = { latitude: "95", longitude: "-80" };
  assertEquals(mapTicketmasterEvent(raw, ctx), null);
  raw._embedded!.venues![0].location = { latitude: "35", longitude: "-200" };
  assertEquals(mapTicketmasterEvent(raw, ctx), null);
});

Deno.test("non-https urls are dropped; truncation adds ellipsis", async () => {
  const raw = await load("concert");
  raw.url = "http://example.com/t";
  raw.images = [{ ratio: "16_9", url: "http://example.com/i.jpg", width: 1 }];
  raw.info = "y".repeat(600);
  const r = mapTicketmasterEvent(raw, ctx)!;
  assertEquals([r.ticket_url, r.image_url], [null, null]);
  assert(r.description!.endsWith("…"));
});

Deno.test("picks the smallest 16:9 image that is still sharp on a phone", async () => {
  const raw = await load("concert");
  const img = (width: number, ratio = "16_9") => ({ ratio, url: `https://s1.ticketm.net/${width}.jpg`, width });
  raw.images = [img(2048), img(1024), img(640), img(305), img(3000, "3_2")];
  assertEquals(mapTicketmasterEvent(raw, ctx)!.image_url, "https://s1.ticketm.net/1024.jpg");
  raw.images = [img(640), img(305)];
  assertEquals(mapTicketmasterEvent(raw, ctx)!.image_url, "https://s1.ticketm.net/640.jpg");
});

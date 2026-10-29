import { assertEquals } from "jsr:@std/assert@1";
import { parseIcs } from "./ics.ts";
import { type IcalSource, mapIcalEvent, type MapContext } from "./mapper.ts";

const load = (n: string) => Deno.readTextFile(new URL(`./fixtures/${n}.ics`, import.meta.url));
const ctx: MapContext = { interestIds: { community: 9, music: 2 }, now: new Date("2026-11-01T00:00:00Z") };
const source: IcalSource = {
  id: "src1", name: "Birdsong Brewing", city_id: 1, default_interest_slugs: ["community", "nope"],
  default_lat: 35.25, default_lng: -80.81, default_venue_name: "Birdsong",
};
const noDefaults: IcalSource = { ...source, default_lat: null, default_lng: null };

Deno.test("Luma event uses GEO, first LOCATION segment, https url and source attribution", async () => {
  const r = mapIcalEvent(parseIcs(await load("luma"))[0], noDefaults, ctx)!;
  assertEquals(r.external_id, "src1:evt-abc@lu.ma");
  assertEquals(r.location, "SRID=4326;POINT(-80.83 35.24)");
  assertEquals(r.venue_name, "Optimist Hall");
  assertEquals(r.ticket_url, "https://lu.ma/abc");
  assertEquals(r.attribution, "Birdsong Brewing");
  assertEquals(r.ends_at, "2026-11-16T01:00:00.000Z");
  assertEquals(r.image_url, null);
  assertEquals(r.interest_ids, [9]);
});

Deno.test("venue event falls back to default location; http url dropped", async () => {
  const r = mapIcalEvent(parseIcs(await load("venue"))[0], source, ctx)!;
  assertEquals(r.location, "SRID=4326;POINT(-80.81 35.25)");
  assertEquals(r.venue_name, "Birdsong Brewing");
  assertEquals(r.ticket_url, null);
  assertEquals(r.starts_at, "2026-11-21T00:00:00.000Z");
});

Deno.test("no GEO and no default location is skipped", async () => {
  assertEquals(mapIcalEvent(parseIcs(await load("venue"))[0], noDefaults, ctx), null);
});

Deno.test("cancelled maps to status cancelled; recurring and all-day are skipped", async () => {
  const evs = parseIcs(await load("venue"));
  assertEquals(mapIcalEvent(evs[2], source, ctx)!.status, "cancelled");
  assertEquals(mapIcalEvent(evs[3], source, ctx), null);
  assertEquals(mapIcalEvent(evs[4], source, ctx), null);
});

Deno.test("only the next 30 days", async () => {
  const e = parseIcs(await load("luma"))[0];
  assertEquals(mapIcalEvent(e, source, { ...ctx, now: new Date("2026-12-01T00:00:00Z") }), null);
  assertEquals(mapIcalEvent(e, source, { ...ctx, now: new Date("2026-10-01T00:00:00Z") }), null);
});

Deno.test("caps: long UID skipped; title and venue sliced to 200", async () => {
  const e = parseIcs(await load("luma"))[0];
  assertEquals(mapIcalEvent({ ...e, uid: "x".repeat(256) }, source, ctx), null);
  assertEquals(mapIcalEvent({ ...e, uid: "x".repeat(255) }, source, ctx)!.external_id.length, "src1:".length + 255);
  const r = mapIcalEvent({ ...e, summary: "t".repeat(500), location: "v".repeat(500) }, source, ctx)!;
  assertEquals([r.title.length, r.venue_name!.length], [200, 200]);
});

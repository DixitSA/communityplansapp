import { assert, assertEquals } from "jsr:@std/assert@1";
import { parseIcs, toUtcIso, unfold } from "./ics.ts";

const load = (n: string) => Deno.readTextFile(new URL(`./fixtures/${n}.ics`, import.meta.url));

Deno.test("Luma-style event: fields, unescaping, GEO, UTC time", async () => {
  const [e] = parseIcs(await load("luma"));
  assertEquals(e.uid, "evt-abc@lu.ma");
  assertEquals(e.description, "Meet builders.\nBring a friend, please.");
  assertEquals(e.location, "Optimist Hall, 1115 N Brevard St, Charlotte");
  assertEquals(e.geo, { lat: 35.24, lng: -80.83 });
  assertEquals(e.dtstart, { kind: "utc", iso: "2026-11-15T23:00:00.000Z" });
  assertEquals(e.url, "https://lu.ma/abc");
});

Deno.test("venue feed: TZID converts using DST rules (EST in November)", async () => {
  const evs = parseIcs(await load("venue"));
  assertEquals(evs.length, 5);
  assertEquals(toUtcIso(evs[0].dtstart, "UTC"), "2026-11-21T00:00:00.000Z");
  assertEquals(toUtcIso({ kind: "local", date: "2026-07-01", time: "19:00:00", tzid: "America/New_York" }, "UTC"), "2026-07-01T23:00:00.000Z");
});

Deno.test("folded lines unfold; VALARM contents are ignored", async () => {
  const folded = parseIcs(await load("venue"))[1];
  assertEquals(folded.summary, "A very long title that is folded across several physical lines in the feed");
  assertEquals(folded.description, "Line one\nLine two with a semi;colon and a long tail that wraps");
  assertEquals(unfold("A:1\r\n 2\r\n\t3"), ["A:12" + "3"]);
});

Deno.test("cancelled, recurring and all-day flags", async () => {
  const evs = parseIcs(await load("venue"));
  assertEquals(evs[2].status, "CANCELLED");
  assert(evs[3].recurring);
  assertEquals(evs[4].dtstart, { kind: "date", date: "2026-11-28" });
  assertEquals(toUtcIso(evs[4].dtstart, "UTC"), null);
});

Deno.test("unknown time zone gives null instead of throwing", () => {
  assertEquals(toUtcIso({ kind: "local", date: "2026-11-01", time: "10:00:00", tzid: "Mars/Olympus" }, "UTC"), null);
});

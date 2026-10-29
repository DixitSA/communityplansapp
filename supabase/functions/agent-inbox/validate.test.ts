import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { fingerprint, validateEvent } from "./validate.ts";

const now = new Date("2026-10-29T16:00:00Z");
const ok = { title: "  Trivia Night ", starts_at: "2026-11-05T19:00:00-05:00" };
const reason = (o: unknown) => {
  const r = validateEvent(o, now);
  return r.ok ? "ok" : r.reason;
};

Deno.test("minimal event is valid; title trimmed; time normalized to UTC", () => {
  const r = validateEvent(ok, now);
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.value.title, "Trivia Night");
    assertEquals(r.value.starts_at, "2026-11-06T00:00:00.000Z");
    assertEquals(r.value.venue, null);
  }
});

Deno.test("title rules", () => {
  assertEquals(reason({ ...ok, title: "   " }), "title_invalid");
  assertEquals(reason({ ...ok, title: 5 }), "title_invalid");
  assertEquals(reason({ ...ok, title: "x".repeat(121) }), "title_invalid");
  assertEquals(reason({ ...ok, title: "x".repeat(120) }), "ok");
});

Deno.test("starts_at needs an offset and the 1 h / 365 d window", () => {
  assertEquals(reason({ ...ok, starts_at: "2026-11-05T19:00:00" }), "starts_at_invalid");
  assertEquals(reason({ ...ok, starts_at: "Nov 5 7pm" }), "starts_at_invalid");
  assertEquals(reason({ ...ok, starts_at: undefined }), "starts_at_invalid");
  assertEquals(reason({ ...ok, starts_at: "2026-10-29T14:00:00Z" }), "starts_at_invalid"); // 2 h ago
  assertEquals(reason({ ...ok, starts_at: "2026-10-29T15:30:00Z" }), "ok"); // 30 min ago
  assertEquals(reason({ ...ok, starts_at: "2027-11-05T19:00:00-05:00" }), "starts_at_invalid");
  assertEquals(reason({ ...ok, starts_at: "2026-13-45T19:00:00Z" }), "starts_at_invalid");
});

Deno.test("ends_at must be valid and after starts_at", () => {
  assertEquals(reason({ ...ok, ends_at: "2026-11-05T22:00:00-05:00" }), "ok");
  assertEquals(reason({ ...ok, ends_at: "2026-11-05T19:00:00-05:00" }), "ends_at_invalid");
  assertEquals(reason({ ...ok, ends_at: "2026-11-05T18:00:00-05:00" }), "ends_at_invalid");
  assertEquals(reason({ ...ok, ends_at: "late" }), "ends_at_invalid");
  assertEquals(reason({ ...ok, ends_at: null }), "ok");
});

Deno.test("link must be https, no whitespace, at most 500", () => {
  assertEquals(reason({ ...ok, link: "https://venue.com/e/1" }), "ok");
  assertEquals(reason({ ...ok, link: "http://venue.com" }), "link_invalid");
  assertEquals(reason({ ...ok, link: "javascript:alert(1)" }), "link_invalid");
  assertEquals(reason({ ...ok, link: "https://a.com/x y" }), "link_invalid");
  assertEquals(reason({ ...ok, link: "https://" }), "link_invalid");
  assertEquals(reason({ ...ok, link: "https://a.com/" + "x".repeat(490) }), "link_invalid");
  assertEquals(reason({ ...ok, link: 7 }), "link_invalid");
  assertEquals(reason({ ...ok, link: " " }), "ok"); // blank means absent
});

Deno.test("length limits on venue, address, details, source_handle", () => {
  assertEquals(reason({ ...ok, venue: "v".repeat(121) }), "venue_invalid");
  assertEquals(reason({ ...ok, venue: "v".repeat(120) }), "ok");
  assertEquals(reason({ ...ok, address: "a".repeat(201) }), "address_invalid");
  assertEquals(reason({ ...ok, details: "d".repeat(1001) }), "details_invalid");
  assertEquals(reason({ ...ok, details: "d".repeat(1000) }), "ok");
  assertEquals(reason({ ...ok, source_handle: "h".repeat(101) }), "source_handle_invalid");
  assertEquals(reason({ ...ok, venue: 3 }), "venue_invalid");
});

Deno.test("unknown keys reject that event; non-objects too", () => {
  assert(reason({ ...ok, city: "Austin" }).startsWith("unknown_keys: city"));
  assertEquals(reason(null), "not_an_object");
  assertEquals(reason([ok]), "not_an_object");
  assertEquals(reason("x"), "not_an_object");
});

Deno.test("fingerprint ignores case, punctuation, spacing and seconds; differs otherwise", async () => {
  const a = await fingerprint({ title: "Trivia Night!", starts_at: "2026-11-06T00:00:00.000Z", venue: "The Fillmore" });
  const b = await fingerprint({ title: " trivia   night", starts_at: "2026-11-06T00:00:45.000Z", venue: "the  FILLMORE." });
  assertEquals(a, b);
  assertEquals(a.length, 64);
  assertNotEquals(a, await fingerprint({ title: "Trivia Night", starts_at: "2026-11-06T00:01:00.000Z", venue: "The Fillmore" }));
  assertNotEquals(a, await fingerprint({ title: "Trivia Night", starts_at: "2026-11-06T00:00:00.000Z", venue: null }));
});

Deno.test("NUL bytes are rejected in any string, title included", () => {
  assertEquals(reason({ ...ok, title: "a\u0000b" }), "title_invalid");
  assertEquals(reason({ ...ok, venue: "a\u0000b" }), "venue_invalid");
  assertEquals(reason({ ...ok, details: "\u0000" }), "details_invalid");
});

Deno.test("titles that normalize to empty still get distinct fingerprints", async () => {
  const at = "2026-11-06T00:00:00.000Z";
  assertNotEquals(await fingerprint({ title: "音楽の夜", starts_at: at, venue: null }), await fingerprint({ title: "映画祭", starts_at: at, venue: null }));
});

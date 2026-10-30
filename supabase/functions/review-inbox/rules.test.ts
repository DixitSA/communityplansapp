import { assertEquals } from "jsr:@std/assert@1";
import { attributionFor, dateWindow, isFree, titleOk, truncateDescription } from "./rules.ts";

const now = new Date("2026-10-30T12:00:00Z");

Deno.test("dateWindow", () => {
  assertEquals(dateWindow("2026-10-30T09:00:00Z", now), "past");
  assertEquals(dateWindow("2026-10-30T10:30:00Z", now), "ok"); // inside the 2h grace
  assertEquals(dateWindow("2026-11-05T00:00:00Z", now), "ok");
  assertEquals(dateWindow("2026-12-29T12:00:00Z", now), "ok"); // exactly 60 days
  assertEquals(dateWindow("2026-12-30T12:00:00Z", now), "too_far");
  assertEquals(dateWindow("garbage", now), "past");
});

Deno.test("titleOk accepts normal titles", () => {
  for (const t of ["Trivia Night", "Jazz at the Park", "SOUTH END BREW FEST", "Fête de la Musique", "Taco Tuesday 🌮"]) {
    assertEquals(titleOk(t), true, t);
  }
});

Deno.test("titleOk rejects junk", () => {
  for (const t of [
    "A!", "12345", "!!! ???", "THIS IS A VERY LOUD EVENT TITLE", "Win now at https://spam.example",
    "Visit www.spam.com", "best deals bit.ly/abc", "Party 🎉🎉🎉", "🎉🔥💥 Night",
  ]) assertEquals(titleOk(t), false, t);
});

Deno.test("isFree matches serpapi behaviour", () => {
  assertEquals(isFree("Free comedy night", null), true);
  assertEquals(isFree("Trivia", "No cover, all welcome"), true);
  assertEquals(isFree("Trivia", "Free parking behind the venue"), false);
  assertEquals(isFree("Duty-free shop", null), false);
  assertEquals(isFree("Trivia", null), false);
});

Deno.test("helpers", () => {
  assertEquals(attributionFor("@plazamidwood"), "via @plazamidwood");
  assertEquals(attributionFor(null), "via yard inbox");
  assertEquals(truncateDescription(null), null);
  assertEquals(truncateDescription("x".repeat(600))!.length, 500);
  assertEquals(truncateDescription("short"), "short");
});

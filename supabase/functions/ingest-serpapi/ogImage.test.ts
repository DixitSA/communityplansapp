import { assertEquals } from "jsr:@std/assert@1";
import { ogImageUrl, skipsPreview } from "./ogImage.ts";

const page = "https://www.eventbrite.com/e/trivia-night-123";

Deno.test("ogImageUrl: finds og:image in any attribute order and quoting", () => {
  assertEquals(ogImageUrl(`<meta property="og:image" content="https://img.evbuc.com/a.jpg?w=1000&amp;h=500">`, page),
    "https://img.evbuc.com/a.jpg?w=1000&h=500");
  assertEquals(ogImageUrl(`<meta content='https://cdn.x.com/b.png' property='og:image' />`, page), "https://cdn.x.com/b.png");
  assertEquals(ogImageUrl(`<META PROPERTY=og:image CONTENT=https://cdn.x.com/c.png>`, page), "https://cdn.x.com/c.png");
});

Deno.test("ogImageUrl: prefers og over twitter, resolves relative, rejects http", () => {
  const html = `<meta name="twitter:image" content="https://cdn.x.com/tw.jpg"><meta property="og:image" content="/img/og.jpg">`;
  assertEquals(ogImageUrl(html, page), "https://www.eventbrite.com/img/og.jpg");
  assertEquals(ogImageUrl(`<meta name="twitter:image" content="https://cdn.x.com/tw.jpg">`, page), "https://cdn.x.com/tw.jpg");
  assertEquals(ogImageUrl(`<meta property="og:image" content="http://cdn.x.com/insecure.jpg">`, page), null);
  assertEquals(ogImageUrl(`<meta property="og:title" content="Trivia">`, page), null);
  assertEquals(ogImageUrl("", page), null);
});

Deno.test("skipsPreview: login-walled hosts are skipped", () => {
  assertEquals(skipsPreview("https://www.facebook.com/events/1"), true);
  assertEquals(skipsPreview("https://www.instagram.com/p/x/"), true);
  assertEquals(skipsPreview("https://www.eventbrite.com/e/1"), false);
  assertEquals(skipsPreview("not a url"), true);
});

import { assertEquals } from "jsr:@std/assert@1";
import { isSafeImageUrl, sniffImage } from "./image.ts";

Deno.test("isSafeImageUrl accepts ordinary https hosts", () => {
  assertEquals(isSafeImageUrl("https://scontent.cdninstagram.com/v/t51/a.jpg?x=1"), true);
  assertEquals(isSafeImageUrl("https://cdn.example.com:8443/a.png"), false); // non-default port
  assertEquals(isSafeImageUrl("https://cdn.example.com:443/a.png"), true); // explicit 443 is the default
});

Deno.test("isSafeImageUrl rejects non-https, IPs, local and dotless hosts", () => {
  for (const u of [
    "http://cdn.example.com/a.jpg", "ftp://cdn.example.com/a.jpg", "not a url", "",
    "https://127.0.0.1/a.jpg", "https://10.0.0.5/a.jpg", "https://169.254.169.254/latest", "https://2130706433/a.jpg",
    "https://0x7f000001/a.jpg", "https://[::1]/a.jpg", "https://[2001:db8::1]/a.jpg",
    "https://localhost/a.jpg", "https://foo.localhost/a.jpg", "https://printer.local/a.jpg",
    "https://db.internal/a.jpg", "https://intranet/a.jpg", "https://user:pw@cdn.example.com/a.jpg",
  ]) assertEquals(isSafeImageUrl(u), false, u);
});

const bytes = (...n: number[]) => new Uint8Array(n);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

Deno.test("sniffImage detects the four types from bytes", () => {
  assertEquals(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0))?.ext, "jpg");
  assertEquals(sniffImage(bytes(0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a, 0))?.contentType, "image/png");
  assertEquals(sniffImage(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP")))?.ext, "webp");
  assertEquals(sniffImage(bytes(...ascii("GIF89a"), 0))?.contentType, "image/gif");
  assertEquals(sniffImage(bytes(...ascii("GIF87a")))?.ext, "gif");
});

Deno.test("sniffImage rejects everything else", () => {
  assertEquals(sniffImage(bytes()), null);
  assertEquals(sniffImage(new TextEncoder().encode("<html><body>nope</body></html>")), null);
  assertEquals(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")), null);
  assertEquals(sniffImage(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE"))), null);
  assertEquals(sniffImage(bytes(0xff, 0xd8)), null);
});

import { assertEquals } from "jsr:@std/assert@1";
import { resendImageRows } from "./resend.ts";

const OWN = "/storage/v1/object/public/event-images/";
const sent = new Map([
  ["fp-pending", { image_url: "https://cdn.example.com/a.jpg", image_sensitive: true }],
  ["fp-live", { image_url: "https://cdn.example.com/b.jpg" }],
  ["fp-live-has-img", { image_url: "https://cdn.example.com/c.jpg" }],
  ["fp-copied", { image_url: "https://cdn.example.com/d.jpg" }],
  ["fp-rejected", { image_url: "https://cdn.example.com/e.jpg" }],
]);
const row = (fp: string, status: string, extra: Partial<{ image_url: string; event_id: string }> = {}) => ({
  id: `id-${fp}`, agent_fingerprint: fp, image_url: extra.image_url ?? null, status, event_id: extra.event_id ?? null,
});

Deno.test("resendImageRows: re-sends fill missing images and carry the sensitive flag", () => {
  const out = resendImageRows([
    row("fp-pending", "pending"),
    row("fp-live", "approved", { event_id: "ev-bare" }),
    row("fp-live-has-img", "approved", { event_id: "ev-with-image" }),
    row("fp-copied", "pending", { image_url: `https://x.supabase.co${OWN}inbox/fp-copied.jpg` }),
    row("fp-rejected", "rejected"),
  ], sent, new Set(["ev-bare"]), OWN);
  assertEquals(out, [
    { id: "id-fp-pending", agent_fingerprint: "fp-pending", image_url: "https://cdn.example.com/a.jpg", image_sensitive: true },
    { id: "id-fp-live", agent_fingerprint: "fp-live", image_url: "https://cdn.example.com/b.jpg", image_sensitive: false, event_id: "ev-bare" },
  ]);
});

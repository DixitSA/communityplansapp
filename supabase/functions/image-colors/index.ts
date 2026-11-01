// image-colors: saves each upcoming event's tint color (events.image_color), the flyer's most
// prominent vivid color, for the event page background. Runs on a short cron and does a few images
// per run: decoding is pure JavaScript and Edge Functions get about 2 s of CPU per call.
import { createClient } from "npm:@supabase/supabase-js@2";
import { downloadLimited, MAX_IMAGE_BYTES } from "../agent-inbox/image.ts";
import { dominantColor } from "./color.ts";
import { decodeImage } from "./decode.ts";

const BATCH = 12;
/** Stop decoding once this much CPU-heavy work is done, leaving headroom under the 2 s limit. */
const DECODE_BUDGET_MS = 900;
const DOWNLOAD_TIMEOUT_MS = 8_000;
const WALL_BUDGET_MS = 60_000;

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

Deno.serve(async (req) => {
  const t0 = Date.now();
  if (req.method !== "POST" || !(await authorized(req.headers.get("Authorization"), Deno.env.get("INGEST_SECRET")))) {
    return json({ error: "unauthorized" }, 401);
  }
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Soonest first: those are the pages people open. Past events are never worth a decode.
    const { data: rows, error } = await db
      .from("events")
      .select("id, image_url")
      .eq("status", "active")
      .not("image_url", "is", null)
      .is("image_color_checked_at", null)
      .gt("starts_at", new Date(Date.now() - 12 * 3_600_000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(BATCH);
    if (error) throw error;

    let decodeMs = 0;
    let colored = 0, plain = 0, failed = 0;
    for (const row of rows ?? []) {
      if (decodeMs > DECODE_BUDGET_MS || Date.now() - t0 > WALL_BUDGET_MS) break;
      // Marked checked before the decode: if one image is too heavy and the worker is killed mid-decode,
      // it isn't picked first again on every run, stalling the queue.
      const { error: markErr } = await db
        .from("events")
        .update({ image_color_checked_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("image_url", row.image_url);
      if (markErr) throw markErr;
      const bytes = await downloadLimited(row.image_url as string, {
        maxBytes: MAX_IMAGE_BYTES,
        accept: "image/*",
        timeoutMs: DOWNLOAD_TIMEOUT_MS,
      });
      let color: string | null = null;
      if (bytes) {
        const t = performance.now();
        const px = decodeImage(bytes);
        if (px) color = dominantColor(px.data, px.width, px.height);
        decodeMs += performance.now() - t;
      }
      if (color) {
        const { error: upErr } = await db
          .from("events")
          .update({ image_color: color })
          .eq("id", row.id)
          .eq("image_url", row.image_url); // skip if the image changed meanwhile
        if (upErr) throw upErr;
      }
      if (color) colored++;
      else if (bytes) plain++;
      else failed++;
    }
    return json({ checked: colored + plain + failed, colored, plain, failed, decode_ms: Math.round(decodeMs), ms: Date.now() - t0 });
  } catch (e) {
    console.error("image-colors failed", e instanceof Error ? e.message : String(e));
    return json({ error: "failed" }, 500);
  }
});

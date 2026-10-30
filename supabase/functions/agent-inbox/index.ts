import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { isSafeImageUrl, MAX_IMAGE_BYTES, sniffImage } from "./image.ts";
import { fingerprint, MAX_BODY_BYTES, MAX_EVENTS, validateEvent } from "./validate.ts";

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

const IMAGE_BUCKET = "event-images";
const IMAGE_TIMEOUT_MS = 8_000;
const IMAGE_BUDGET_MS = 60_000;
const IMAGE_CONCURRENCY = 4;
const MAX_REDIRECTS = 3;

/** Download with manual redirects (each hop re-checked), a timeout and a streamed byte cap. Null on any failure. */
async function downloadImage(start: string): Promise<Uint8Array | null> {
  const signal = AbortSignal.timeout(IMAGE_TIMEOUT_MS);
  let url = start;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isSafeImageUrl(url)) return null;
      const res = await fetch(url, { redirect: "manual", signal, headers: { Accept: "image/*" } });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("Location");
        await res.body?.cancel();
        if (!loc) return null;
        url = new URL(loc, url).toString();
        continue;
      }
      if (!res.ok || !res.body) {
        await res.body?.cancel();
        return null;
      }
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_IMAGE_BYTES) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
      const out = new Uint8Array(total);
      let o = 0;
      for (const c of chunks) {
        out.set(c, o);
        o += c.length;
      }
      return out;
    }
  } catch {
    return null; // never log: the URL may carry tokens
  }
  return null; // too many redirects
}

/** Copy images for freshly inserted rows into Storage. Failures keep the original URL. */
async function copyImages(
  db: SupabaseClient,
  rows: { id: string; agent_fingerprint: string; image_url: string }[],
): Promise<{ copied: number; failed: number }> {
  const t0 = Date.now();
  let copied = 0, failed = 0, next = 0;
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next++];
      if (Date.now() - t0 > IMAGE_BUDGET_MS) {
        failed++;
        continue;
      }
      try {
        const bytes = await downloadImage(row.image_url);
        const type = bytes ? sniffImage(bytes) : null;
        if (!bytes || !type) {
          failed++;
          continue;
        }
        const path = `inbox/${row.agent_fingerprint}.${type.ext}`;
        const up = await db.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: type.contentType, upsert: true });
        if (up.error) {
          failed++;
          continue;
        }
        const publicUrl = db.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
        const { error } = await db.from("event_submissions").update({ image_url: publicUrl }).eq("id", row.id);
        if (error) failed++;
        else copied++;
      } catch {
        failed++;
      }
    }
  };
  await Promise.all(Array.from({ length: IMAGE_CONCURRENCY }, worker));
  return { copied, failed };
}

Deno.serve(async (req) => {
  if (req.method !== "POST" || !(await authorized(req.headers.get("Authorization"), Deno.env.get("AGENT_INBOX_SECRET")))) {
    return json({ error: "unauthorized" }, 401);
  }

  const declared = Number(req.headers.get("Content-Length") ?? "0");
  if (declared > MAX_BODY_BYTES) return json({ error: "body too large" }, 413);
  // Read as a stream so chunked bodies without Content-Length are capped too.
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (req.body) {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return json({ error: "body too large" }, 413);
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.length;
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const events = (body as { events?: unknown } | null)?.events;
  if (!Array.isArray(events)) return json({ error: "expected { events: [...] }" }, 400);
  if (events.length > MAX_EVENTS) return json({ error: `at most ${MAX_EVENTS} events per request` }, 413);

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: city, error: cityErr } = await db.from("cities").select("id").eq("slug", "charlotte").single();
    if (cityErr) throw cityErr;

    const now = new Date();
    const rejected: { index: number; reason: string }[] = [];
    const rows = new Map<string, Record<string, unknown>>(); // by fingerprint: repeats inside one request collapse
    let repeats = 0;
    for (let index = 0; index < events.length; index++) {
      const v = validateEvent(events[index], now);
      if (!v.ok) {
        rejected.push({ index, reason: v.reason });
        continue;
      }
      const fp = await fingerprint(v.value);
      if (rows.has(fp)) {
        repeats++;
        continue;
      }
      rows.set(fp, {
        ...v.value, origin: "agent", status: "pending", submitted_by: null, city_id: city.id, agent_fingerprint: fp,
      });
    }

    let inserted = 0, images_copied = 0, images_failed = 0;
    if (rows.size > 0) {
      const { data, error } = await db
        .from("event_submissions")
        .upsert([...rows.values()], { onConflict: "agent_fingerprint", ignoreDuplicates: true })
        .select("id, agent_fingerprint, image_url");
      if (error) throw error;
      inserted = data?.length ?? 0;
      const withImages = (data ?? []).flatMap((r) =>
        r.image_url && r.agent_fingerprint ? [{ id: r.id, agent_fingerprint: r.agent_fingerprint, image_url: r.image_url }] : []
      );
      // A re-sent event can fill in a missing image on its still-pending row (e.g. the agent couldn't get one first time).
      const insertedFps = new Set((data ?? []).map((r) => r.agent_fingerprint));
      const resent = [...rows.entries()].filter(([fp, r]) => !insertedFps.has(fp) && typeof r.image_url === "string");
      if (resent.length > 0) {
        const { data: existing, error: exErr } = await db
          .from("event_submissions").select("id, agent_fingerprint, image_url")
          .in("agent_fingerprint", resent.map(([fp]) => fp)).eq("status", "pending");
        if (exErr) throw exErr;
        const ownBucket = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
        for (const r of existing ?? []) {
          if (r.agent_fingerprint && !r.image_url?.includes(ownBucket)) {
            withImages.push({ id: r.id, agent_fingerprint: r.agent_fingerprint, image_url: rows.get(r.agent_fingerprint)!.image_url as string });
          }
        }
      }
      if (withImages.length > 0) ({ copied: images_copied, failed: images_failed } = await copyImages(db, withImages));
    }
    const duplicates = rows.size - inserted + repeats;
    console.log(`agent-inbox received=${events.length} inserted=${inserted} duplicates=${duplicates} rejected=${rejected.length} images_copied=${images_copied} images_failed=${images_failed}`);
    return json({ received: events.length, inserted, duplicates, rejected, images_copied, images_failed });
  } catch (e) {
    console.error("agent-inbox failed:", e instanceof Error ? e.message.slice(0, 200) : "unknown");
    return json({ error: "inbox failed" }, 500);
  }
});

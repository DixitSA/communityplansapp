import { createClient } from "npm:@supabase/supabase-js@2";
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

    let inserted = 0;
    if (rows.size > 0) {
      const { data, error } = await db
        .from("event_submissions")
        .upsert([...rows.values()], { onConflict: "agent_fingerprint", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      inserted = data?.length ?? 0;
    }
    const duplicates = rows.size - inserted + repeats;
    console.log(`agent-inbox received=${events.length} inserted=${inserted} duplicates=${duplicates} rejected=${rejected.length}`);
    return json({ received: events.length, inserted, duplicates, rejected });
  } catch (e) {
    console.error("agent-inbox failed:", e instanceof Error ? e.message.slice(0, 200) : "unknown");
    return json({ error: "inbox failed" }, 500);
  }
});

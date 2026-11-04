import { createClient } from "npm:@supabase/supabase-js@2";

// Deletes the CALLER's account. The user id comes only from the verified JWT, never from the body.
// Rows in profiles, rsvps, friendships, blocks, notifications, messages... go with auth.users via
// `on delete cascade` (profiles -> auth.users; everything else -> profiles). Reports they filed are kept for moderation (reporter_id is set null). Events they created keep
// existing (created_by is set null). Avatar files are removed here because storage isn't covered by FKs.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);
  const uid = userData.user.id;

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    // Avatar files first: if this fails we stop before deleting, so the person can retry.
    const { data: files, error: listErr } = await admin.storage.from("avatars").list(uid, { limit: 100 });
    if (listErr) throw listErr;
    if (files && files.length > 0) {
      const { error: rmErr } = await admin.storage.from("avatars").remove(files.map((f) => `${uid}/${f.name}`));
      if (rmErr) throw rmErr;
    }
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) throw delErr;
    return json({ ok: true });
  } catch (err) {
    console.error("delete-account failed", err instanceof Error ? err.message : String(err));
    return json({ error: "delete_failed" }, 500);
  }
});

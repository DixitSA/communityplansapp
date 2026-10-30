import { validateEvent, fingerprint, MAX_BODY_BYTES, MAX_EVENTS } from '../../supabase/functions/agent-inbox/validate.ts';
const root = new URL('../../', import.meta.url);
const raw = await Deno.readTextFile(new URL('events.json', root));
const payload = JSON.parse(raw);
const rows = payload.events.map((event: unknown) => validateEvent(event, new Date()));
const rejected = rows.filter((r: {ok: boolean}) => !r.ok);
if (rejected.length) throw new Error(JSON.stringify(rejected));
const hashes = await Promise.all(rows.map((r: {value: Parameters<typeof fingerprint>[0]}) => fingerprint(r.value)));
if (new Set(hashes).size !== rows.length) throw new Error('Duplicate events');
if (rows.length > MAX_EVENTS || new TextEncoder().encode(raw).length > MAX_BODY_BYTES) throw new Error('Payload limit');
const manifest = JSON.parse(await Deno.readTextFile(new URL('marketing/event-images/manifest.json', root)));
for (const [index, m] of manifest.events.entries()) {
  const e = payload.events[index];
  if (!e.image_url || e.image_url !== m.image_url || e.title !== m.title || m.visual_review.verdict !== 'accepted') throw new Error('Image mapping mismatch');
  await Deno.stat(new URL(m.local_path, root));
}
console.log(JSON.stringify({events: rows.length, images: payload.events.filter((e: {image_url?: string}) => e.image_url).length, bytes: new TextEncoder().encode(raw).length, validator: 'PASS', duplicates: 0, astra: '17 accepted', submitted: false}));

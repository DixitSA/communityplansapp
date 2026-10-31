# Event ingestion: Ticketmaster

The `ingest-ticketmaster` Edge Function pulls the next 30 days of events within 50 mi of Charlotte and upserts them into `events` (key: `source, external_id`). Interests are replaced on every run, and cancelled events get `status = 'cancelled'`.

## Owner steps (PowerShell, from the repo root)
1. Get a free API key at https://developer.ticketmaster.com (create an account, then copy the "Consumer Key").
2. Set the secrets (generate any long random string for `INGEST_SECRET`):
   `npx supabase secrets set TICKETMASTER_API_KEY=<key> INGEST_SECRET=<random>`
3. Deploy (no JWT check, because we use our own bearer secret):
   `npx supabase functions deploy ingest-ticketmaster --no-verify-jwt`
4. One-off test run:
   ```powershell
   Invoke-RestMethod -Method Post `
     -Uri "https://<project-ref>.supabase.co/functions/v1/ingest-ticketmaster" `
     -Headers @{ Authorization = "Bearer <INGEST_SECRET>" }
   ```
   Expect `{ fetched, upserted, skipped, pages }`. Check Studio > `events`.
5. Schedule daily at 06:15 ET: dashboard > Integrations > Cron > new job, type "Supabase Edge Function" (or HTTP request), POST to the function URL with header `Authorization: Bearer <INGEST_SECRET>`. Cron runs in UTC: use `15 11 * * *` (06:15 EST) and move it to `15 10 * * *` during daylight time.

## Provider-terms checklist (record the result in `docs/DATA_MODEL.md`)
- [ ] Attribution: show "Tickets on Ticketmaster" (stored in `events.attribution`) wherever the event appears.
- [ ] Tickets: sell nothing in-app; link out to `ticket_url` on Ticketmaster.
- [ ] Images: use only the provided image URLs, unaltered and not re-hosted, per their terms.
- [ ] Freshness: data refreshes daily; don't show stale events (hide past `starts_at`) and respect the API limit (5000 calls/day, 5 req/s).
- [ ] Re-read the current Discovery API terms before launch.

## Calendar feeds (iCal): Luma, venues, breweries

The `ingest-ical` function reads every active row in `public.event_sources` and upserts the feed's events (`source = 'ical'`, `external_id = <source id>:<VEVENT UID>`).

**Add a source:** in Supabase Studio, insert a row into `event_sources`: `name` (shown as the event attribution), `url` (https only), `city_id`, `default_interest_slugs` (for example `{community,nightlife}`), and `default_lat` / `default_lng` / `default_venue_name` for feeds whose events have no GEO. On Luma, any calendar or city page has an "Add iCal Subscription" link; copy that URL. Set `active = false` to pause a source. `last_run_at` and `last_error` show how the last run went.

**What is imported:** events starting in the next 30 days with a timed start (UTC, or `TZID`, or floating time read as Charlotte time). `STATUS:CANCELLED` events are stored as cancelled. All-day events and recurring events (`RRULE`, `RDATE`, `RECURRENCE-ID`) are skipped in v1 and counted in `skipped`. Location is the event's `GEO`, else the source default; with neither, the event is skipped. Events an admin hid stay hidden.

**Limits:** 10 s timeout and 2 MB per feed. One failing feed records `last_error` and does not stop the others.

**Deploy and schedule** (same secrets as Ticketmaster; schedule it the same way, daily, with the `Authorization: Bearer <INGEST_SECRET>` header):

```powershell
npx supabase functions deploy ingest-ical --no-verify-jwt
```

Response: `{ sources, fetched, upserted, skipped }`.

## Google Events via SerpApi: the wide net

The `ingest-serpapi` function runs a fixed set of Google Events searches for Charlotte through [SerpApi](https://serpapi.com) (`engine=google_events`). Google's events box aggregates Eventbrite, Meetup, venue sites and more. Rows are stored with `source = 'serpapi'`; the attribution reads "via <ticket site>" (or "via Google Events").

**Owner steps (PowerShell, from the repo root):**
1. Create a free account at https://serpapi.com and copy your API key from the dashboard.
2. Set the secret (never put it in git or chat; `INGEST_SECRET` is already set from the Ticketmaster step):
   `npx supabase secrets set SERPAPI_KEY="<your key>"`
3. Apply the migrations (`npx supabase db push`), then deploy:
   `npx supabase functions deploy ingest-serpapi --no-verify-jwt`
4. Test run:
   ```powershell
   Invoke-RestMethod -Method Post `
     -Uri "https://<project-ref>.supabase.co/functions/v1/ingest-serpapi" `
     -Headers @{ Authorization = "Bearer <INGEST_SECRET>" }
   ```
   Expect `{ searches, fetched, upserted, skipped, duplicates, geocoded, geocode_misses }`. A manual test run spends real searches (see the budget).
5. Schedule it once a day, like the others (dashboard > Integrations > Cron, POST with the `Authorization: Bearer <INGEST_SECRET>` header), for example `30 11 * * *` UTC.

**Budget:** the free plan allows 250 searches a month and every page counts as one. The query plan in `index.ts` (`QUERY_PLAN`) is 2 pages of "events in Charlotte NC" plus 6 single-page queries (concerts, weekend, comedy, art, free events, nightlife) = 8 searches per run, so a daily run costs about 240 a month. That leaves almost no room for manual test runs: run it manually only a couple of times, or trim the plan first. Paging stops early when a page has fewer than 10 results.

**What is imported:** Google gives free-text times, so the function only keeps events with a clear start time (for example "Fri, Oct 30, 8 – 11 PM EDT", "Tomorrow, 7 – 10 PM", "Today, 9 PM"). Date-only events, date ranges without times, events with no address, events starting more than 30 days out and events already over are skipped and counted in `skipped`. Times are read as Charlotte time. Google-hosted thumbnails are never used (the app shows category art instead). Price is unknown unless the title or description says "free" or "no cover". Events an admin hid stay hidden.

**Locations:** Google gives addresses, not coordinates, so the function geocodes them with the free US Census Geocoder (no key, 4 s timeout) for addresses with a street number, then falls back to OpenStreetMap's Nominatim (restricted to the Charlotte area) when Census fails or finds nothing; venue-only addresses go straight to Nominatim. Nominatim's [usage policy](https://operations.osmfoundation.org/policies/nominatim/) requires an identifying `User-Agent` (set in `index.ts`) and at most 1 request per second, so those calls are spaced 1.1 s apart. At most 60 new lookups per run, and geocoding stops after 90 s. Hits are cached in `geocode_cache` (service role only) forever; misses are cached for 7 days. Network failures are not cached. The response reports `geocode_attempted`, `geocode_errors`, `geocode_nomatch`, `census_hits`, `nominatim_hits` and up to 5 `sample_misses`. One-time cleanup of misses cached by the first version: `delete from public.geocode_cache where lat is null;` (Studio SQL editor). Anything that does not geocode, or lands more than 60 km from the city centre, is skipped and counted in `geocode_misses`.

**Duplicates:** before saving, `find_duplicate_event` looks for an active event from another source in the same city starting within 60 minutes, with the same or a similar title (trigram similarity of at least 0.5), and within 400 m. If one exists the SerpApi copy is dropped and counted in `duplicates`, so Ticketmaster and curated events stay the canonical record. Copies SerpApi saved on an earlier run are set to `status = 'hidden'` when the canonical event appears later (hidden events are never resurrected).

**Safety:** a preflight on SerpApi's free `account.json` skips the run (`skipped_run: low_quota`) when fewer than 8 searches are left. A failed search (including HTTP 429, which is not retried) stops searching but still processes what was fetched, and is counted in `errors`. Geocoding stops after 90 s so the run finishes inside the 150 s limit.

**Pictures:** Google only supplies its own cached thumbnails, which we don't use. After saving, the run gives upcoming events without a picture one try at their ticket or listing page's share image (`og:image`, else `twitter:image`). It fetches with the same guarded downloader as the agent inbox (https only, no private hosts, redirects re-checked, 512 KB of page, 5 MB of image), skips Facebook and Instagram (login walls) and images under 10 KB (logos), and copies the picture to `event-images/serpapi/<external_id>.<ext>`. Events that fail are retried on later runs in random order; new previews stop starting at 140 s. Rows without a Google image leave `image_url` out of the upsert, so a picture added this way is never overwritten. The response adds `images_added` and `images_failed`. About half of the events that have a page get a picture; events with no page keep the placeholder art.

**Geocoding order (updated):** (1) venues we already know from Ticketmaster/iCal/curated events (`find_venue_location`: same normalized venue name, or trigram similarity of at least 0.6; free, no external call), (2) Census for addresses with a street number, (3) Geoapify if `GEOAPIFY_KEY` is set (8 s timeout), (4) Nominatim, which is **off** (`NOMINATIM_ENABLED = false` in `index.ts`): live runs got `403` from Supabase Edge every time. Venue matches use Ticketmaster and curated events only. Supabase's cloud IPs are sometimes blocked by Nominatim, so after 3 consecutive Nominatim errors it is skipped for the rest of the run. Misses where a geocoder failed (rather than answering "no result") are never cached.

**Optional Geoapify key (recommended):** sign up at https://www.geoapify.com (free plan: 3,000 requests/day, no card), create a project and copy its API key, then in PowerShell from the repo root:
`npx supabase secrets set GEOAPIFY_KEY="<your key>"`
No redeploy is needed for the secret to take effect on the next run.

**More response fields:** `venue_hits`, `census_hits`, `geoapify_hits`, `nominatim_hits` (hits by geocoder), and `geocode_error_samples` (up to 5 short labels such as `nominatim 403` or `census timeout`, never keys or URLs).

## Agent inbox: events found by your own Codex or Claude

You run Codex or Claude on your own computer, under your own subscription. The agent browses public venue sites and search results, then posts structured events to the `agent-inbox` function. They land as **pending** rows in `event_submissions` (`origin = 'agent'`, no submitter) and are visible only to admins. Nothing is published until you approve it in Studio (see `docs/MODERATION.md`). The function validates with the same rules as `submit_event`, always uses Charlotte, and de-duplicates with a fingerprint (title + start minute + venue), so posting the same file twice is safe. An optional `image_url` may point to an event-specific HTTPS image; it is carried into the curated event when published. An optional `image_sensitive: true` marks a racy or explicit image (anything else must be a boolean or it is rejected): the app shows it blurred behind "Sensitive image · Tap to view". A re-send that adds a missing image also carries its `image_sensitive`.

**One-time setup (PowerShell, from the repo root).** This generates a new secret, stores it in Supabase, and saves it as a user environment variable named `YARD_AGENT_SECRET` (it is separate from `INGEST_SECRET`):

```powershell
$a = [guid]::NewGuid().ToString(); npx supabase secrets set AGENT_INBOX_SECRET=$a; [Environment]::SetEnvironmentVariable('YARD_AGENT_SECRET', $a, 'User')
```

Then apply the migration and deploy:

```powershell
npx supabase db push
npx supabase functions deploy agent-inbox --no-verify-jwt
```

Open a new PowerShell window afterwards so `$env:YARD_AGENT_SECRET` is available. Never paste the secret into an agent chat or a file.

**Running the playbook.** The instructions are in `agent-playbooks/event-scout.md`, and the sites to visit are in `agent-playbooks/sources.md`. In a PowerShell window at the repo root, start Codex (`codex`) or Claude (`claude`) and say: "Follow agent-playbooks/event-scout.md and write events.json." The agent only writes the file; it must not post it or touch the secret (web pages are treated as untrusted). You review `events.json`, then post it yourself with the command at the end of the playbook. The response is `{ received, inserted, duplicates, rejected: [{ index, reason }] }`; fix rejected items and post again (duplicates are skipped). Limits: 50 events and 256 KB per request. A rejected event with `unknown_keys` means the agent added a field the schema does not have.

### Image copies

External image URLs (Instagram CDN links especially) expire. When `agent-inbox` accepts a new event with an `image_url`, it downloads the image and stores a permanent copy in the public `event-images` bucket at `inbox/<fingerprint>.<ext>`, then replaces the submission's `image_url` with the public URL. Rules: https only, no IP-literal, `localhost`, `.local`, `.internal` or dotless hosts (checked again on every redirect, at most 3), 8 s per image, 5 MB cap (streamed, `Content-Length` is not trusted), and the type must be JPEG, PNG, WebP or GIF by its first bytes (headers are ignored). Four downloads run at once and no new one starts after 60 s. If anything fails the event is kept with its original URL. The response adds `images_copied` and `images_failed`; logs carry counts only, never URLs. Only the service role can write to the bucket (there are no storage policies for it).

## Auto-approver: `review-inbox`

A rules-based reviewer for pending agent submissions (`origin = 'agent'`, earliest start first, up to 300 per run; images are published only if they were copied into our `event-images` bucket, otherwise the event goes live without an image). It never uses an AI model. For each row, in order:

1. Starts more than 2 hours ago: rejected (`auto: in the past`).
2. Starts more than 60 days out: stays pending (`auto: more than 60 days out`).
3. Junk title (fewer than 3 letters, ALL CAPS over 20 characters, a URL, more than 2 emojis): stays pending.
4. No venue: stays pending.
5. Location: `find_venue_location`, then Census (needs a street number), then Geoapify if `GEOAPIFY_KEY` is set (precise result types only), cached in `geocode_cache`. It must land within 60 km of the city centre, otherwise it stays pending (`auto: could not place venue`).
6. `find_duplicate_event` finds a match: stays pending (`auto: duplicate of <event id>`), so you can merge details by hand.
7. Otherwise it creates an active event (`source = 'agent'`, `external_id` = submission id, attribution `via <source_handle>` or `via yard inbox`), links interests like SerpApi does, and marks the submission `approved` with `admin_note = 'auto-approved'`. A failure on one row leaves it pending (`auto: error`) and the run continues.

Pending rows only get their `admin_note` rewritten when it changed.

| Variable | Meaning |
|---|---|
| `AUTO_APPROVE` | `on` makes changes. Anything else (or unset) is a dry run that changes nothing and returns what it would do. |
| `AUTO_APPROVE_MAX` | Most approvals per run, default 40. Rows auto-approved in the last 24 hours count toward it. |
| `INGEST_SECRET` | Same bearer secret as the ingest functions. |
| `GEOAPIFY_KEY` | Optional, as for SerpApi. |

The response is `{ dry_run, considered, approved, rejected, left_pending: { reason: count }, capped }`.

Deploy (PowerShell, from the repo root):

```powershell
npx supabase db push
npx supabase functions deploy agent-inbox --no-verify-jwt
npx supabase functions deploy review-inbox --no-verify-jwt
```

Try a dry run first (nothing changes), then turn it on:

```powershell
$h = @{ Authorization = "Bearer <INGEST_SECRET>" }
Invoke-RestMethod -Method Post -Headers $h "https://<project-ref>.supabase.co/functions/v1/review-inbox"
npx supabase secrets set AUTO_APPROVE=on
```

Schedule it daily in dashboard > Integrations > Cron, after the agents have posted, for example `20 15 * * *` UTC, POST with the `Authorization: Bearer <INGEST_SECRET>` header. To stop it, see the kill switch in `docs/MODERATION.md`.


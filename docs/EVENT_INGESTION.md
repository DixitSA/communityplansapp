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

**Geocoding order (updated):** (1) venues we already know from Ticketmaster/iCal/curated events (`find_venue_location`: same normalized venue name, or trigram similarity of at least 0.6; free, no external call), (2) Census for addresses with a street number, (3) Geoapify if `GEOAPIFY_KEY` is set (8 s timeout), (4) Nominatim, which is **off** (`NOMINATIM_ENABLED = false` in `index.ts`): live runs got `403` from Supabase Edge every time. Venue matches use Ticketmaster and curated events only. Supabase's cloud IPs are sometimes blocked by Nominatim, so after 3 consecutive Nominatim errors it is skipped for the rest of the run. Misses where a geocoder failed (rather than answering "no result") are never cached.

**Optional Geoapify key (recommended):** sign up at https://www.geoapify.com (free plan: 3,000 requests/day, no card), create a project and copy its API key, then in PowerShell from the repo root:
`npx supabase secrets set GEOAPIFY_KEY="<your key>"`
No redeploy is needed for the secret to take effect on the next run.

**More response fields:** `venue_hits`, `census_hits`, `geoapify_hits`, `nominatim_hits` (hits by geocoder), and `geocode_error_samples` (up to 5 short labels such as `nominatim 403` or `census timeout`, never keys or URLs).

## Agent inbox: events found by your own Codex or Claude

You run Codex or Claude on your own computer, under your own subscription. The agent browses public venue sites and search results, then posts structured events to the `agent-inbox` function. They land as **pending** rows in `event_submissions` (`origin = 'agent'`, no submitter) and are visible only to admins. Nothing is published until you approve it in Studio (see `docs/MODERATION.md`). The function validates with the same rules as `submit_event`, always uses Charlotte, and de-duplicates with a fingerprint (title + start minute + venue), so posting the same file twice is safe. An optional `image_url` may point to an event-specific HTTPS image; it is carried into the curated event when published.

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

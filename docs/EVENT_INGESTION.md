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

**Locations:** Google gives addresses, not coordinates, so the function geocodes them with the free US Census Geocoder (no key, 5 s timeout, at most 60 new lookups per run). Results, including misses, are cached in `geocode_cache` (service role only) so each address is looked up once. Anything that does not geocode, or lands more than 60 km from the city centre, is skipped and counted in `geocode_misses`.

**Duplicates:** before saving, `find_duplicate_event` looks for an active event from another source in the same city starting within 60 minutes, with the same or a similar title (trigram similarity of at least 0.5), and within 400 m. If one exists the SerpApi copy is dropped and counted in `duplicates`, so Ticketmaster and curated events stay the canonical record. Copies SerpApi saved on an earlier run are set to `status = 'hidden'` when the canonical event appears later (hidden events are never resurrected).

**Safety:** a preflight on SerpApi's free `account.json` skips the run (`skipped_run: low_quota`) when fewer than 8 searches are left. A failed search (including HTTP 429, which is not retried) stops searching but still processes what was fetched, and is counted in `errors`. Geocoding stops after 90 s so the run finishes inside the 150 s limit.

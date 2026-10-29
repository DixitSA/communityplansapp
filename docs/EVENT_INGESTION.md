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

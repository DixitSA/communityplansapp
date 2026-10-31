# Moderation: reports

- Reporting a chat message calls `public.report_message(message_id, reason)`. It works only for someone who is Going to the event, is not blocked either way with the author, and is not the author. Limit: 20 reports per person per day (`rate_limited`).
- The report stores a private snapshot of the message (body, author, event), so it survives the author's soft delete. No client can read `reports`; review them in Supabase Studio.
- Snapshots are kept for 90 days. The owner schedules the purge daily in the Supabase dashboard (Integrations > Cron, SQL snippet):

```sql
select public.purge_old_reports();
```

`purge_old_reports()` is granted to the service role only and deletes every report older than 90 days.

# Moderation: suggested events

Users can suggest an event (for example one they saw on Instagram) from the app, and the owner's own agent can post events through the `agent-inbox` function (see `docs/EVENT_INGESTION.md`). Nothing is published automatically. Each row has an `origin` (`user`, `agent` or `instagram`); agent and instagram rows have no submitter and are visible to admins only. Submissions land in `public.event_submissions` with `status = 'pending'`; clients can only read their own rows, and each person is limited to 5 submissions per 24 hours.

## Review in Supabase Studio

1. Open Table Editor > `event_submissions` and filter `status = 'pending'`, oldest first. Read the title, link, date, venue and details. Open the link yourself. To list the queue with where each row came from:

```sql
select id, origin, source_handle, title, starts_at, ends_at, venue, address, link, image_url, image_sensitive, details, created_at
from public.event_submissions
where status = 'pending'
order by created_at;
```
2. To reject, run (replace the id):

```sql
update public.event_submissions
set status = 'rejected', admin_note = 'duplicate', reviewed_at = now()
where id = '<submission id>';
```

3. To publish, look up the venue's latitude and longitude (for example in Apple Maps or Google Maps), then run the following in the SQL editor. It creates a curated event and links the submission to it in one statement:

```sql
with s as (
  select * from public.event_submissions where id = '<submission id>' and status = 'pending'
), new_event as (
  insert into public.events (source, city_id, title, starts_at, ends_at, venue_name, venue_address, ticket_url, image_url, image_sensitive, description, location)
  select 'curated', s.city_id, s.title, s.starts_at, s.ends_at, s.venue, s.address, s.link, s.image_url, s.image_sensitive, s.details,
         extensions.st_setsrid(extensions.st_makepoint(<lng>, <lat>), 4326)::extensions.geography
  from s
  returning id
)
update public.event_submissions
set status = 'approved', event_id = (select id from new_event), reviewed_at = now()
where id = '<submission id>' and status = 'pending';
```

This works the same for `user` and `agent` rows (`ends_at`, `address` and `image_url` are null for most user rows). Agent rows are unverified: open the link and check the date, venue and any image before publishing. Note the order is longitude first, then latitude. Add interests (`event_interests`) or an end time on the new event afterwards if needed. Studio runs as a privileged role, so these statements bypass RLS; that is expected.

**Spotlight ("Popping this week").** Picks lead the feed's spotlight row until the time you set, then events with at least three Going fill it (friends going first, then Going in the last 48 hours, then total Going). Pick an event with `update public.events set spotlight_until = now() + interval '3 days' where id = '<event id>';` and drop it with `spotlight_until = null`. The 10:47 daily review picks 5-8 standouts each morning.

**Sensitive images.** A racy or explicit flyer can stay, blurred behind "Sensitive image · Tap to view". Flag a published event with `update public.events set image_sensitive = true where id = '<event id>';` (set it back to `false` to unblur).

Submitters are not notified in this version. If a link looks abusive, reject it and consider a report against the user.

## Auto-approved events

The `review-inbox` function (see `docs/EVENT_INGESTION.md`) approves clear-cut agent submissions by rules. To review what it did:

```sql
select id, title, starts_at, venue, source_handle, event_id, reviewed_at
from public.event_submissions
where admin_note = 'auto-approved'
order by reviewed_at desc;
```

To hide one (the event disappears from the app; the submission stays as a record):

```sql
update public.events set status = 'hidden' where id = '<event id>';
```

Rows it left pending carry an `auto: ...` note saying why (duplicates name the existing event id).

**Kill switch.** Turn auto-approval off with `npx supabase secrets set AUTO_APPROVE=off` (or `npx supabase secrets unset AUTO_APPROVE`); the next run is a dry run. To stop it entirely, delete its Cron job. To undo a bad batch, hide the events with `update public.events set status = 'hidden' where source = 'agent' and created_at > now() - interval '1 day';`.


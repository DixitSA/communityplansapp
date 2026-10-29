# Moderation: reports

- Reporting a chat message calls `public.report_message(message_id, reason)`. It works only for someone who is Going to the event, is not blocked either way with the author, and is not the author. Limit: 20 reports per person per day (`rate_limited`).
- The report stores a private snapshot of the message (body, author, event), so it survives the author's soft delete. No client can read `reports`; review them in Supabase Studio.
- Snapshots are kept for 90 days. The owner schedules the purge daily in the Supabase dashboard (Integrations > Cron, SQL snippet):

```sql
select public.purge_old_reports();
```

`purge_old_reports()` is granted to the service role only and deletes every report older than 90 days.

# Moderation: suggested events

Users can suggest an event (for example one they saw on Instagram) from the app. Nothing is published automatically. Submissions land in `public.event_submissions` with `status = 'pending'`; clients can only read their own rows, and each person is limited to 5 submissions per 24 hours.

## Review in Supabase Studio

1. Open Table Editor > `event_submissions` and filter `status = 'pending'`, oldest first. Read the title, link, date, venue and details. Open the link yourself.
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
  insert into public.events (source, city_id, title, starts_at, venue_name, ticket_url, description, location)
  select 'curated', s.city_id, s.title, s.starts_at, s.venue, s.link, s.details,
         extensions.st_setsrid(extensions.st_makepoint(<lng>, <lat>), 4326)::extensions.geography
  from s
  returning id
)
update public.event_submissions
set status = 'approved', event_id = (select id from new_event), reviewed_at = now()
where id = '<submission id>' and status = 'pending';
```

Note the order is longitude first, then latitude. Edit the title, add an image, interests (`event_interests`) or an end time on the new event afterwards if needed. Studio runs as a privileged role, so these statements bypass RLS; that is expected.

Submitters are not notified in this version. If a link looks abusive, reject it and consider a report against the user.

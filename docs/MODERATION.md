# Moderation: reports

- Reporting a chat message calls `public.report_message(message_id, reason)`. It works only for someone who is Going to the event, is not blocked either way with the author, and is not the author. Limit: 20 reports per person per day (`rate_limited`).
- The report stores a private snapshot of the message (body, author, event), so it survives the author's soft delete. No client can read `reports`; review them in Supabase Studio.
- Snapshots are kept for 90 days. The owner schedules the purge daily in the Supabase dashboard (Integrations > Cron, SQL snippet):

```sql
select public.purge_old_reports();
```

`purge_old_reports()` is granted to the service role only and deletes every report older than 90 days.

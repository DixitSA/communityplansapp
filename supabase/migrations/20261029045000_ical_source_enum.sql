-- Own file: a new enum value can't be used in the same transaction that adds it.
alter type public.event_source add value if not exists 'ical';

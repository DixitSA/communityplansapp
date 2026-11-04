-- Reports outlive the reporter's account: deleting the reporter sets reporter_id to null
-- instead of deleting the report, so moderation keeps it. Insert RLS still requires
-- reporter_id = auth.uid(), so null only appears after an account deletion.
alter table public.reports alter column reporter_id drop not null;
alter table public.reports drop constraint reports_reporter_id_fkey;
alter table public.reports
  add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles (id) on delete set null;

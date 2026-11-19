-- Run once in the Supabase SQL editor before enabling Unlimited in the dashboard.
-- Existing settings are preserved; NULL means unlimited application requests.
begin;
alter table public.app_settings drop constraint if exists app_settings_daily_limit_check;
alter table public.app_settings alter column daily_limit drop not null;
alter table public.app_settings add constraint app_settings_daily_limit_check
  check (daily_limit is null or daily_limit between 1 and 1000);
commit;

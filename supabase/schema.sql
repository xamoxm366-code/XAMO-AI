-- Run once in the Supabase SQL editor. These tables are server-only.
create table if not exists public.app_settings (
  id integer primary key check (id = 1),
  ai_enabled boolean not null default true,
  daily_limit integer default 30 check (daily_limit is null or daily_limit between 1 and 1000)
);
insert into public.app_settings (id) values (1) on conflict do nothing;
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
create table if not exists public.chat_usage (
  subject text not null,
  day date not null default (now() at time zone 'utc')::date,
  count integer not null default 0,
  primary key (subject, day)
);
alter table public.chat_usage enable row level security;
revoke all on public.chat_usage from anon, authenticated;
create or replace function public.consume_chat_quota(subject text, daily_max integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare new_count integer;
begin
  insert into public.chat_usage as usage (subject, day, count)
  values (subject, (now() at time zone 'utc')::date, 1)
  on conflict on constraint chat_usage_pkey do update set count = usage.count + 1
  where usage.count < daily_max
  returning count into new_count;
  return new_count is not null;
end;
$$;
revoke all on function public.consume_chat_quota(text, integer) from public, anon, authenticated;
grant execute on function public.consume_chat_quota(text, integer) to service_role;

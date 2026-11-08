create schema if not exists rumo_private;
revoke all on schema rumo_private from public, anon, authenticated;
create table if not exists rumo_private.mentor_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 usage_day date not null,
 requests integer not null check (requests between 1 and 20),
 primary key (user_id, usage_day)
);
alter table rumo_private.mentor_usage enable row level security;
revoke all on rumo_private.mentor_usage from public, anon, authenticated;
create or replace function public.consume_mentor_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
 if auth.uid() is null then return false; end if;
 insert into rumo_private.mentor_usage(user_id,usage_day,requests)
 values(auth.uid(),(now() at time zone 'UTC')::date,1)
 on conflict(user_id,usage_day) do update set requests=rumo_private.mentor_usage.requests+1
 where rumo_private.mentor_usage.requests<20;
 get diagnostics affected = row_count;
 return affected=1;
end;
$$;
revoke all on function public.consume_mentor_request() from public, anon;
grant execute on function public.consume_mentor_request() to authenticated;

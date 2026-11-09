-- Painel do Rumo. Nenhuma chave privilegiada no app; RPC usa a sessão do usuário.
-- Tabelas e funções privilegiadas ficam em schema não exposto pela Data API.
begin;
create schema if not exists rumo_private;
revoke all on schema rumo_private from public, anon;
grant usage on schema rumo_private to authenticated;

create table rumo_private.portal_config (
 singleton boolean primary key default true check(singleton),
 owner_id uuid not null references auth.users(id),
 owner_email text not null,
 collection_started timestamptz not null default now()
);
insert into rumo_private.portal_config(singleton,owner_id,owner_email)
select true,id,'felipebmoreno@icloud.com' from auth.users
where lower(email)='felipebmoreno@icloud.com' and email_confirmed_at is not null;
do $$ begin if not exists(select 1 from rumo_private.portal_config) then raise exception 'Conta administrativa confirmada não encontrada'; end if; end $$;

create table rumo_private.activity (
 user_id uuid not null references auth.users(id) on delete cascade,
 event_date date not null default (now() at time zone 'America/Sao_Paulo')::date,
 kind text not null check(kind in ('visit','quiz_start','quiz_complete','route_view','task_record','feedback','whatsapp')),
 route text not null default '' check(route in ('','team','enterprise','creative','freelance','research','social','build','care','nature')),
 day smallint not null default 0 check(day between 0 and 14),
 value text not null default '' check(length(value)<=30),
 happened_at timestamptz not null default now(),
 primary key(user_id,event_date,kind,route,day)
);
create index activity_date_kind on rumo_private.activity(event_date,kind);
create table rumo_private.reviews (
 user_id uuid primary key references auth.users(id) on delete cascade,
 rating smallint not null check(rating between 1 and 5),
 comment text not null default '' check(length(comment)<=500),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index reviews_created on rumo_private.reviews(created_at desc);
create table rumo_private.support_tickets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 email text not null,
 category text not null check(category in ('access','map','tasks','other')),
 message text not null check(length(message) between 10 and 1500),
 status text not null default 'open' check(status in ('open','progress','resolved')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index tickets_user_created on rumo_private.support_tickets(user_id,created_at desc);
create index tickets_created on rumo_private.support_tickets(created_at desc);
alter table rumo_private.portal_config enable row level security;
alter table rumo_private.activity enable row level security;
alter table rumo_private.reviews enable row level security;
alter table rumo_private.support_tickets enable row level security;
revoke all on rumo_private.portal_config,rumo_private.activity,rumo_private.reviews,rumo_private.support_tickets from public,anon,authenticated;

create function rumo_private.portal(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid(); admin boolean; uemail text; k text; r text; v text; d integer;
 period integer; since_date date; today date := (now() at time zone 'America/Sao_Paulo')::date;
 ticket_id uuid; page_no integer; filter_status text; answer jsonb;
begin
 if uid is null then raise insufficient_privilege using message='Entre na sua conta.'; end if;
 select lower(email) into uemail from auth.users where id=uid and email_confirmed_at is not null and coalesce(is_anonymous,false)=false;
 if uemail is null then raise insufficient_privilege using message='Confirme sua conta.'; end if;
 select exists(select 1 from rumo_private.portal_config c
  where c.owner_id=uid and c.owner_email=uemail
  and exists(select 1 from auth.sessions s where s.user_id=uid and s.id::text=auth.jwt()->>'session_id')) into admin;
 if p_action='access' then return jsonb_build_object('admin',admin); end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise invalid_parameter_value; end if;

 if p_action='event' then
  k:=p_data->>'kind';r:=coalesce(p_data->>'route','');v:=coalesce(p_data->>'value','');d:=coalesce((p_data->>'day')::integer,0);
  if k not in ('visit','quiz_start','quiz_complete','route_view','task_record','feedback','whatsapp') or k is null then raise invalid_parameter_value; end if;
  if k in ('route_view','task_record','feedback') then
   if r not in ('team','enterprise','creative','freelance','research','social','build','care','nature') then raise invalid_parameter_value; end if;
  else r:=''; end if;
  if k='task_record' then
   if d not between 1 and 14 or v not in ('liked','mixed','notdone','other','different') then raise invalid_parameter_value; end if;
  elsif k='feedback' then
   d:=0;if v not in ('deepen','adjust','change') then raise invalid_parameter_value; end if;
  else d:=0;v:=''; end if;
  insert into rumo_private.activity(user_id,kind,route,day,value) values(uid,k,r,d,v)
   on conflict(user_id,event_date,kind,route,day) do update set value=excluded.value
   where activity.value is distinct from excluded.value;
  return jsonb_build_object('ok',true);
 end if;
 if p_action='review' then
  d:=(p_data->>'rating')::integer;v:=trim(coalesce(p_data->>'comment',''));
  if d is null or d not between 1 and 5 or length(v)>500 then raise invalid_parameter_value; end if;
  insert into rumo_private.reviews(user_id,rating,comment) values(uid,d,v)
  on conflict(user_id) do update set rating=excluded.rating,comment=excluded.comment,updated_at=now();
  return jsonb_build_object('ok',true);
 end if;
 if p_action='ticket' then
  k:=p_data->>'category';v:=trim(coalesce(p_data->>'message',''));
  if k is null or k not in ('access','map','tasks','other') or length(v) not between 10 and 1500 then raise invalid_parameter_value; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if (select count(*) from rumo_private.support_tickets where user_id=uid and created_at>now()-interval '1 hour')>=3 then
   raise exception 'Limite de pedidos. Aguarde uma hora ou fale pelo WhatsApp.' using errcode='P0001'; end if;
  insert into rumo_private.support_tickets(user_id,email,category,message) values(uid,uemail,k,v) returning id into ticket_id;
  return jsonb_build_object('ok',true,'id',ticket_id);
 end if;
 if not admin then raise insufficient_privilege using message='Acesso exclusivo à administração.'; end if;
 if p_action='ticket_status' then
  v:=p_data->>'status';if v is null or v not in ('open','progress','resolved') then raise invalid_parameter_value; end if;
  update rumo_private.support_tickets set status=v,updated_at=now() where id=(p_data->>'id')::uuid;
  if not found then raise no_data_found; end if;
  return jsonb_build_object('ok',true);
 end if;
 if p_action<>'dashboard' then raise invalid_parameter_value; end if;
 period:=coalesce((p_data->>'days')::integer,30);if period not in (7,30,90) then raise invalid_parameter_value; end if;
 page_no:=greatest(0,least(10000,coalesce((p_data->>'page')::integer,0)));
 filter_status:=coalesce(p_data->>'status','all');if filter_status not in ('all','open','progress','resolved') then raise invalid_parameter_value; end if;
 since_date:=today-(period-1);
 select jsonb_build_object(
  'generatedAt',now(),'collectionStarted',(select collection_started from rumo_private.portal_config),'days',period,
  'accounts',(select count(*) from auth.users where coalesce(is_anonymous,false)=false),
  'confirmed',(select count(*) from auth.users where email_confirmed_at is not null and coalesce(is_anonymous,false)=false),
  'newAccounts',(select count(*) from auth.users where (created_at at time zone 'America/Sao_Paulo')::date>=since_date and coalesce(is_anonymous,false)=false),
  'active',(select count(distinct user_id) from rumo_private.activity where event_date>=since_date and kind='visit'),
  'quizStarted',(select count(distinct user_id) from rumo_private.activity where event_date>=since_date and kind='quiz_start'),
  'quizCompleted',(select count(distinct user_id) from rumo_private.activity where event_date>=since_date and kind='quiz_complete'),
  'tasksRegistered',(select count(*) from (select distinct user_id,route,day from rumo_private.activity where event_date>=since_date and kind='task_record') x),
  'tasksDone',(select count(*) from (select distinct on(user_id,route,day) value from rumo_private.activity where event_date>=since_date and kind='task_record' order by user_id,route,day,happened_at desc,event_date desc) x where value<>'notdone'),
  'weeks',(select count(*) from (select user_id,route from rumo_private.activity where kind='task_record' and day<=7 group by user_id,route having count(distinct day)=7 and max(event_date)>=since_date) x),
  'feedback',coalesce((select jsonb_object_agg(value,total) from (select value,count(*) total from (select distinct on(user_id,route) user_id,route,value from rumo_private.activity where kind='feedback' and event_date>=since_date order by user_id,route,event_date desc) x group by value) y),'{}'::jsonb),
  'routes',coalesce((select jsonb_agg(x order by users desc) from (select route,count(distinct user_id) users from rumo_private.activity where kind='route_view' and event_date>=since_date group by route) x),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(jsonb_build_object('date',dt::date,'signups',(select count(*) from auth.users where (created_at at time zone 'America/Sao_Paulo')::date=dt::date and coalesce(is_anonymous,false)=false),'active',(select count(distinct user_id) from rumo_private.activity where event_date=dt::date and kind='visit')) order by dt) from generate_series(since_date,today,interval '1 day') dt),'[]'::jsonb),
  'reviewCount',(select count(*) from rumo_private.reviews where (created_at at time zone 'America/Sao_Paulo')::date>=since_date),
  'rating',(select round(avg(rating),1) from rumo_private.reviews where (created_at at time zone 'America/Sao_Paulo')::date>=since_date),
  'reviews',coalesce((select jsonb_agg(x) from (select rating,comment,created_at from rumo_private.reviews where (created_at at time zone 'America/Sao_Paulo')::date>=since_date order by created_at desc limit 30) x),'[]'::jsonb),
  'whatsapp',(select count(distinct user_id) from rumo_private.activity where kind='whatsapp' and event_date>=since_date),
  'ticketOpen',(select count(*) from rumo_private.support_tickets where status<>'resolved'),
  'ticketTotal',(select count(*) from rumo_private.support_tickets where filter_status='all' or status=filter_status),
  'tickets',coalesce((select jsonb_agg(x) from (select id,email,category,message,status,created_at from rumo_private.support_tickets where filter_status='all' or status=filter_status order by created_at desc limit 20 offset page_no*20) x),'[]'::jsonb)
 ) into answer;
 return answer;
end $$;
revoke all on function rumo_private.portal(text,jsonb) from public,anon;
grant execute on function rumo_private.portal(text,jsonb) to authenticated;
create function public.rumo_portal(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select rumo_private.portal(p_action,p_data) $$;
revoke all on function public.rumo_portal(text,jsonb) from public,anon;
grant execute on function public.rumo_portal(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;

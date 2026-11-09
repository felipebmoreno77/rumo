-- Licença do aplicativo, independente dos créditos antigos do Mentor.
begin;
create table rumo_private.app_offer (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 amount_cents integer not null check(amount_cents=1990),
 pix_key text not null, recipient text not null,
 created_at timestamptz not null default now()
);
-- Só é ativada quando o código correspondente estiver pronto para publicação.
insert into rumo_private.app_offer(singleton,amount_cents,pix_key,recipient)
values(true,1990,'0fa5908f-a977-4422-8ef4-f832ed3394ba','Felipe Barbanera Moreno');
create table rumo_private.app_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 trial_started_at timestamptz not null default now(),
 trial_expires_at timestamptz not null default now()+interval '24 hours',
 lifetime_at timestamptz,
 check(trial_expires_at=trial_started_at+interval '24 hours')
);
create table rumo_private.app_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 amount_cents integer not null check(amount_cents=1990),
 status text not null default 'pending' check(status in ('pending','reported','approved','rejected','expired')),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '24 hours',
 reported_at timestamptz,reviewed_at timestamptz,reviewed_by uuid references auth.users(id),
 bank_reference text unique check(bank_reference is null or length(bank_reference) between 10 and 100),
 unique(user_id,request_id)
);
create unique index app_orders_one_open on rumo_private.app_orders(user_id) where status in ('pending','reported');
create index app_orders_status_created on rumo_private.app_orders(status,created_at desc);
create index app_orders_user_created on rumo_private.app_orders(user_id,created_at desc);
alter table rumo_private.app_offer enable row level security;
alter table rumo_private.app_access enable row level security;
alter table rumo_private.app_orders enable row level security;
revoke all on rumo_private.app_offer,rumo_private.app_access,rumo_private.app_orders from public,anon,authenticated;

create function rumo_private.license(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); admin boolean; email text; cfg rumo_private.app_offer; a rumo_private.app_access;
 o rumo_private.app_orders; oid uuid; rid uuid; reference text; result jsonb; page_no integer; filter_status text;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null and coalesce(is_anonymous,false)=false)
 or not exists(select 1 from auth.sessions where user_id=uid and id::text=auth.jwt()->>'session_id' and (not_after is null or not_after>now())) then
  raise insufficient_privilege using message='Entre novamente para continuar.';
 end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise invalid_parameter_value;end if;
 select lower(u.email) into email from auth.users u where u.id=uid;
 select exists(select 1 from rumo_private.portal_config where owner_id=uid and owner_email=email) into admin;
 select * into cfg from rumo_private.app_offer where singleton;
 if p_action='start' and not admin and cfg.enabled then
  insert into rumo_private.app_access(user_id) values(uid) on conflict(user_id) do nothing;
 end if;
 if p_action in ('status','start') then
  select * into a from rumo_private.app_access where user_id=uid;
  select * into o from rumo_private.app_orders where user_id=uid order by created_at desc limit 1;
  return jsonb_build_object('enabled',cfg.enabled,'admin',admin,'allowed',admin or not cfg.enabled or a.lifetime_at is not null or a.trial_expires_at>now(),
   'state',case when admin then 'admin' when not cfg.enabled then 'disabled' when a.lifetime_at is not null then 'lifetime' when a.user_id is null then 'ready' when a.trial_expires_at>now() then 'trial' else 'expired' end,
   'serverNow',now(),'trialStartedAt',a.trial_started_at,'trialExpiresAt',a.trial_expires_at,'lifetimeAt',a.lifetime_at,
   'amountCents',cfg.amount_cents,'recipient',cfg.recipient,
   'order',case when o.id is null then null else jsonb_build_object('id',o.id,'amountCents',o.amount_cents,'status',case when o.status='pending' and o.expires_at<=now() then 'expired' else o.status end,'createdAt',o.created_at,'expiresAt',o.expires_at,'reportedAt',o.reported_at) end,
   'pix',case when o.status in ('pending','reported') and (o.expires_at>now() or o.status='reported') then jsonb_build_object('key',cfg.pix_key,'recipient',cfg.recipient,'reference','RUMO'||upper(substr(replace(o.id::text,'-',''),1,20))) else null end);
 end if;
 if p_action='create' then
  if not cfg.enabled then raise exception 'Compra indisponível no momento.';end if;
  if admin or exists(select 1 from rumo_private.app_access where user_id=uid and lifetime_at is not null) then raise exception 'Seu acesso já está liberado.';end if;
  rid:=(p_data->>'requestId')::uuid;if rid is null then raise invalid_parameter_value;end if;
  perform pg_advisory_xact_lock(hashtextextended('license:'||uid::text,0));
  select * into o from rumo_private.app_orders where user_id=uid and app_orders.request_id=rid;
  if found then return rumo_private.license('status','{}');end if;
  update rumo_private.app_orders set status='expired' where user_id=uid and status='pending' and expires_at<=now();
  if exists(select 1 from rumo_private.app_orders where user_id=uid and status in ('pending','reported')) then return rumo_private.license('status','{}');end if;
  if (select count(*) from rumo_private.app_orders where user_id=uid and created_at>now()-interval '1 day')>=5 then raise exception 'Limite de pedidos. Fale com o suporte.';end if;
  insert into rumo_private.app_orders(user_id,request_id,amount_cents) values(uid,rid,cfg.amount_cents);
  return rumo_private.license('status','{}');
 end if;
 if p_action in ('report','approve','reject') then
  if p_action<>'report' and not admin then raise insufficient_privilege;end if;
  oid:=(p_data->>'orderId')::uuid;
  select * into o from rumo_private.app_orders where id=oid and (admin or user_id=uid) for update;
  if not found then raise insufficient_privilege;end if;
  if p_action='report' then
   if o.user_id<>uid then raise insufficient_privilege;end if;
   if o.status not in ('pending','reported') then raise exception 'Pedido já encerrado. Consulte seu acesso ou fale com o suporte.';end if;
   update rumo_private.app_orders set status='reported',reported_at=coalesce(reported_at,now()) where id=oid;
   return rumo_private.license('status','{}');
  end if;
  if p_action='reject' then
   if o.status='approved' then raise exception 'Um pedido aprovado não pode ser rejeitado.';end if;
   update rumo_private.app_orders set status='rejected',reviewed_at=now(),reviewed_by=uid where id=oid;
   return jsonb_build_object('ok',true);
  end if;
  reference:=upper(trim(coalesce(p_data->>'bankReference','')));
  if (p_data->>'confirmed')::boolean is distinct from true or length(reference) not between 10 and 100 then raise invalid_parameter_value;end if;
  if o.status='approved' then
   if o.bank_reference<>reference then raise exception 'Pedido já aprovado com outra transação.';end if;
   return jsonb_build_object('ok',true);
  end if;
  if exists(select 1 from rumo_private.app_access where user_id=o.user_id and lifetime_at is not null) then raise exception 'Esta conta já possui acesso vitalício. Não confirme um segundo pagamento.';end if;
  if o.status='rejected' then raise exception 'Pedido rejeitado. Confira o pedido correto antes de liberar.';end if;
  if exists(select 1 from rumo_private.app_orders where bank_reference=reference and id<>oid) then raise exception 'Esta transação bancária já foi utilizada.';end if;
  update rumo_private.app_orders set status='approved',reviewed_at=now(),reviewed_by=uid,bank_reference=reference where id=oid;
  insert into rumo_private.app_access(user_id,lifetime_at) values(o.user_id,now())
   on conflict(user_id) do update set lifetime_at=coalesce(app_access.lifetime_at,excluded.lifetime_at);
  return jsonb_build_object('ok',true);
 end if;
 if p_action='orders' then
  if not admin then raise insufficient_privilege;end if;
  page_no:=greatest(0,least(10000,coalesce((p_data->>'page')::integer,0)));
  filter_status:=coalesce(p_data->>'status','review');
  if filter_status not in ('all','review','pending','reported','approved','rejected','expired') then raise invalid_parameter_value;end if;
  select jsonb_build_object('total',(select count(*) from rumo_private.app_orders where filter_status='all' or (filter_status='review' and status='reported') or status=filter_status),
   'orders',coalesce((select jsonb_agg(x) from (select o.id,u.email,o.amount_cents,o.status,o.created_at,o.expires_at,o.reported_at,o.reviewed_at,o.bank_reference,'RUMO'||upper(substr(replace(o.id::text,'-',''),1,20)) as reference
    from rumo_private.app_orders o join auth.users u on u.id=o.user_id
    where filter_status='all' or (filter_status='review' and o.status='reported') or o.status=filter_status order by o.created_at desc limit 20 offset page_no*20) x),'[]'::jsonb)) into result;
  return result;
 end if;
 raise invalid_parameter_value;
end $$;
revoke all on function rumo_private.license(text,jsonb) from public,anon;
grant execute on function rumo_private.license(text,jsonb) to authenticated;
create function public.rumo_license(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select rumo_private.license(p_action,p_data) $$;
revoke all on function public.rumo_license(text,jsonb) from public,anon;
grant execute on function public.rumo_license(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;

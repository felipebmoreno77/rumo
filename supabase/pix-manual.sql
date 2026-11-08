-- Extensão do livro de créditos privado existente. Não contém dados bancários nem chaves.
create table if not exists rumo_private.pix_settings (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 pix_key text, recipient text, server_token_hash text check(server_token_hash is null or server_token_hash ~ '^[a-f0-9]{64}$')
);
insert into rumo_private.pix_settings(singleton) values(true) on conflict do nothing;
create table if not exists rumo_private.pix_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table rumo_private.pix_settings enable row level security;
alter table rumo_private.pix_admins enable row level security;
revoke all on rumo_private.pix_settings,rumo_private.pix_admins from public,anon,authenticated;
alter table rumo_private.credit_orders add column if not exists client_request_id uuid;
alter table rumo_private.credit_orders add column if not exists reported_at timestamptz;
alter table rumo_private.credit_orders add column if not exists reviewed_at timestamptz;
alter table rumo_private.credit_orders add column if not exists reviewed_by uuid references auth.users(id);
alter table rumo_private.credit_orders add column if not exists rejected boolean not null default false;
create unique index if not exists credit_orders_client_request on rumo_private.credit_orders(user_id,mode,client_request_id);
create or replace function public.rumo_pix_credit_api(p_action text,p_data jsonb default '{}'::jsonb,p_server_token text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); admin boolean; cfg rumo_private.pix_settings; bal integer; oid uuid; rid uuid; cr integer; cents integer;
 o rumo_private.credit_orders; result jsonb; orders jsonb; pending jsonb; bank_ref text;
begin
 -- Não aceita sessão anônima, revogada ou expirada, nem privilégios em user_metadata.
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null)
 or not exists(select 1 from auth.sessions where id::text=(auth.jwt()->>'session_id') and user_id=uid and (not_after is null or not_after>now())) then
  return jsonb_build_object('error','forbidden');
 end if;
 select * into cfg from rumo_private.pix_settings where singleton;
 select exists(select 1 from rumo_private.pix_admins where user_id=uid) into admin;
 if p_action in ('reserve','finish') then
  if cfg.server_token_hash is null or p_server_token is null or length(p_server_token)<40
   or encode(extensions.digest(p_server_token,'sha256'),'hex')<>cfg.server_token_hash then return jsonb_build_object('error','forbidden');end if;
  rid:=(p_data->>'request_id')::uuid;
  if p_action='reserve' then
   if not cfg.enabled then return jsonb_build_object('error','disabled');end if;
   return public.rumo_reserve_credit(uid,'live',rid);
  end if;
  return public.rumo_finish_credit(uid,'live',rid,(p_data->>'success')::boolean);
 end if;
 if p_action='status' then
  bal:=public.rumo_credit_balance(uid,'live');
  select coalesce(jsonb_agg(x),'[]'::jsonb) into orders from (
   select id,credits,amount_cents,status,rejected,reported_at,created_at,created_at+interval '48 hours' as expires_at
   from rumo_private.credit_orders where user_id=uid and mode='live' and provider='pix_manual' order by created_at desc limit 20
  ) x;
  pending:='[]'::jsonb;
  if admin then
   select coalesce(jsonb_agg(x),'[]'::jsonb) into pending from (
    select o.id,o.credits,o.amount_cents,o.status,o.rejected,o.reported_at,o.created_at,u.email,
      o.created_at+interval '48 hours' as expires_at
    from rumo_private.credit_orders o join auth.users u on u.id=o.user_id
    where o.provider='pix_manual' and o.mode='live' and o.status='pending' and not o.rejected order by o.created_at desc limit 100
   ) x;
  end if;
  return jsonb_build_object('enabled',coalesce(cfg.enabled,false),'balance',bal,'admin',admin,'orders',orders,'pending',pending,
   'pix',case when cfg.enabled then jsonb_build_object('key',cfg.pix_key,'recipient',cfg.recipient) else null end,
   'packs',jsonb_build_array(jsonb_build_object('id','start','credits',20,'amount_cents',490),jsonb_build_object('id','move','credits',60,'amount_cents',990),jsonb_build_object('id','more','credits',150,'amount_cents',1990)));
 end if;
 if p_action='create' then
  if not coalesce(cfg.enabled,false) or cfg.pix_key is null or cfg.recipient is null then return jsonb_build_object('error','disabled');end if;
  rid:=(p_data->>'request_id')::uuid;
  case p_data->>'pack' when 'start' then cr:=20;cents:=490; when 'move' then cr:=60;cents:=990; when 'more' then cr:=150;cents:=1990; else return jsonb_build_object('error','invalid');end case;
  bal:=public.rumo_credit_balance(uid,'live'); -- bloqueio de carteira também serializa cliques/reenvios
  select * into o from rumo_private.credit_orders where user_id=uid and mode='live' and client_request_id=rid;
  if found then
   if o.provider<>'pix_manual' or o.credits<>cr then return jsonb_build_object('error','invalid');end if;
   return jsonb_build_object('order',jsonb_build_object('id',o.id,'credits',o.credits,'amount_cents',o.amount_cents,'status',o.status,'created_at',o.created_at,'expires_at',o.created_at+interval '48 hours'));
  end if;
  if (select count(*) from rumo_private.credit_orders where user_id=uid and mode='live' and status='pending' and not rejected and created_at>now()-interval '48 hours')>=3 then return jsonb_build_object('error','pending_limit');end if;
  oid:=public.rumo_create_credit_order(uid,'live','pix_manual',cr,cents);
  update rumo_private.credit_orders set client_request_id=rid where id=oid returning * into o;
  return jsonb_build_object('order',jsonb_build_object('id',oid,'credits',cr,'amount_cents',cents,'status','pending','created_at',o.created_at,'expires_at',o.created_at+interval '48 hours'));
 end if;
 if p_action in ('report','admin_approve','admin_reject') then
  if p_action<>'report' and not admin then return jsonb_build_object('error','forbidden');end if;
  oid:=(p_data->>'order_id')::uuid;
  select * into o from rumo_private.credit_orders where id=oid and provider='pix_manual' and mode='live' for update;
  if not found or (p_action='report' and o.user_id<>uid) then return jsonb_build_object('error','not_found');end if;
  if p_action='report' then
   if o.status<>'pending' or o.rejected then return jsonb_build_object('error','already_reviewed');end if;
   if o.created_at<now()-interval '48 hours' then return jsonb_build_object('error','expired');end if;
   update rumo_private.credit_orders set reported_at=coalesce(reported_at,now()) where id=oid;
   return jsonb_build_object('ok',true);
  end if;
  if not admin then return jsonb_build_object('error','forbidden');end if;
  if o.rejected then return jsonb_build_object('error','already_reviewed');end if;
  if p_action='admin_reject' then
   if o.status<>'pending' then return jsonb_build_object('error','already_reviewed');end if;
   update rumo_private.credit_orders set rejected=true,reviewed_at=now(),reviewed_by=uid where id=oid;
   return jsonb_build_object('ok',true);
  end if;
  bank_ref:=trim(p_data->>'bank_reference');
  if (p_data->>'confirmed')::boolean is distinct from true or bank_ref is null or length(bank_ref) not between 10 and 100 then return jsonb_build_object('error','invalid');end if;
  if exists(select 1 from rumo_private.credit_orders where provider='pix_manual' and mode='live' and payment_id=bank_ref and id<>oid) then return jsonb_build_object('error','duplicate_payment');end if;
  result:=public.rumo_confirm_credit_payment(oid,'live','pix_manual',bank_ref,o.amount_cents,'BRL');
  update rumo_private.credit_orders set reviewed_at=coalesce(reviewed_at,now()),reviewed_by=coalesce(reviewed_by,uid) where id=oid;
  return result;
 end if;
 return jsonb_build_object('error','invalid');
exception when invalid_text_representation then return jsonb_build_object('error','invalid');
 when unique_violation then return jsonb_build_object('error','duplicate_payment');
end;
$$;
revoke all on function public.rumo_pix_credit_api(text,jsonb,text) from public,anon;
grant execute on function public.rumo_pix_credit_api(text,jsonb,text) to authenticated;

-- Base privada de créditos. Aplicar antes de pix-manual.sql em um projeto novo.
create schema if not exists rumo_private;
create extension if not exists pgcrypto with schema extensions;
create table if not exists rumo_private.credit_wallets (
 user_id uuid not null,
 mode text not null,
 balance integer not null default 0,
 updated_at timestamp with time zone not null default now(),
 CHECK ((mode = ANY (ARRAY['test'::text, 'live'::text]))),
 PRIMARY KEY (user_id, mode),
 FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table rumo_private.credit_wallets enable row level security;
revoke all on rumo_private.credit_wallets from public,anon,authenticated;
grant all on rumo_private.credit_wallets to service_role;
create table if not exists rumo_private.credit_orders (
 id uuid not null default gen_random_uuid(),
 user_id uuid not null,
 mode text not null,
 provider text not null,
 credits integer not null,
 amount_cents integer not null,
 currency text not null,
 status text not null default 'pending'::text,
 payment_id text,
 created_at timestamp with time zone not null default now(),
 CHECK ((amount_cents > 0)),
 CHECK (((credits >= 1) AND (credits <= 100000))),
 CHECK ((currency = 'BRL'::text)),
 CHECK ((mode = ANY (ARRAY['test'::text, 'live'::text]))),
 CHECK (((length(payment_id) >= 1) AND (length(payment_id) <= 200))),
 PRIMARY KEY (id),
 CHECK (((length(provider) >= 1) AND (length(provider) <= 40))),
 UNIQUE (provider, mode, payment_id),
 CHECK ((status = ANY (ARRAY['pending'::text, 'credited'::text, 'reversed'::text]))),
 FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table rumo_private.credit_orders enable row level security;
revoke all on rumo_private.credit_orders from public,anon,authenticated;
grant all on rumo_private.credit_orders to service_role;
create table if not exists rumo_private.credit_requests (
 id uuid not null,
 user_id uuid not null,
 mode text not null,
 status text not null,
 created_at timestamp with time zone not null default now(),
 updated_at timestamp with time zone not null default now(),
 CHECK ((mode = ANY (ARRAY['test'::text, 'live'::text]))),
 PRIMARY KEY (id),
 CHECK ((status = ANY (ARRAY['reserved'::text, 'consumed'::text, 'refunded'::text]))),
 FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table rumo_private.credit_requests enable row level security;
revoke all on rumo_private.credit_requests from public,anon,authenticated;
grant all on rumo_private.credit_requests to service_role;
create table if not exists rumo_private.credit_events (
 id uuid not null default gen_random_uuid(),
 user_id uuid not null,
 mode text not null,
 kind text not null,
 reference text not null,
 delta integer not null,
 created_at timestamp with time zone not null default now(),
 CHECK ((kind = ANY (ARRAY['purchase'::text, 'reversal'::text, 'reserve'::text, 'refund'::text]))),
 UNIQUE (kind, reference),
 CHECK ((mode = ANY (ARRAY['test'::text, 'live'::text]))),
 PRIMARY KEY (id),
 FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table rumo_private.credit_events enable row level security;
revoke all on rumo_private.credit_events from public,anon,authenticated;
grant all on rumo_private.credit_events to service_role;
grant usage on schema rumo_private to service_role;
CREATE OR REPLACE FUNCTION public.rumo_confirm_credit_payment(p_order uuid, p_mode text, p_provider text, p_payment text, p_amount_cents integer, p_currency text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare o rumo_private.credit_orders; b integer;
begin
 select * into o from rumo_private.credit_orders where id=p_order for update;
 if not found then raise exception 'order_not_found'; end if;
 if p_payment is null or length(p_payment) not between 1 and 200
    or p_mode is distinct from o.mode or p_provider is distinct from o.provider
    or p_amount_cents is distinct from o.amount_cents or p_currency is distinct from o.currency
 then raise exception 'payment_mismatch'; end if;
 if o.status <> 'pending' then
  if o.payment_id is distinct from p_payment then raise exception 'payment_mismatch'; end if;
  return jsonb_build_object('status',o.status,'duplicate',true,'balance',public.rumo_credit_balance(o.user_id,o.mode));
 end if;
 update rumo_private.credit_orders set status='credited',payment_id=p_payment where id=o.id;
 insert into rumo_private.credit_wallets(user_id,mode,balance) values(o.user_id,o.mode,o.credits)
 on conflict(user_id,mode) do update set balance=rumo_private.credit_wallets.balance+excluded.balance,updated_at=now()
 returning balance into b;
 insert into rumo_private.credit_events(user_id,mode,kind,reference,delta) values(o.user_id,o.mode,'purchase',o.id::text,o.credits);
 return jsonb_build_object('status','credited','duplicate',false,'balance',b);
end;
$function$
;
revoke all on function public.rumo_confirm_credit_payment(uuid,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.rumo_confirm_credit_payment(uuid,text,text,text,integer,text) to service_role;
CREATE OR REPLACE FUNCTION public.rumo_create_credit_order(p_user uuid, p_mode text, p_provider text, p_credits integer, p_amount_cents integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare oid uuid;
begin
 insert into rumo_private.credit_orders(user_id,mode,provider,credits,amount_cents,currency)
 values(p_user,p_mode,p_provider,p_credits,p_amount_cents,'BRL') returning id into oid;
 return oid;
end;
$function$
;
revoke all on function public.rumo_create_credit_order(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.rumo_create_credit_order(uuid,text,text,integer,integer) to service_role;
CREATE OR REPLACE FUNCTION public.rumo_credit_balance(p_user uuid, p_mode text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare b integer; recovered integer;
begin
 insert into rumo_private.credit_wallets(user_id,mode) values(p_user,p_mode) on conflict do nothing;
 select balance into b from rumo_private.credit_wallets where user_id=p_user and mode=p_mode for update;
 -- Recupera reservas abandonadas após 10 minutos (timeout da IA: 25 segundos).
 -- Não guarda a mensagem nem a resposta, somente o registro contábil.
 with expired as (
  update rumo_private.credit_requests set status='refunded',updated_at=now()
  where user_id=p_user and mode=p_mode and status='reserved' and created_at < now()-interval '10 minutes'
  returning id
 ), events as (
  insert into rumo_private.credit_events(user_id,mode,kind,reference,delta)
  select p_user,p_mode,'refund',id::text,1 from expired returning id
 ) select count(*) into recovered from events;
 if recovered>0 then
  update rumo_private.credit_wallets set balance=balance+recovered,updated_at=now() where user_id=p_user and mode=p_mode returning balance into b;
 end if;
 return b;
end;
$function$
;
revoke all on function public.rumo_credit_balance(uuid,text) from public,anon,authenticated;
grant execute on function public.rumo_credit_balance(uuid,text) to service_role;
CREATE OR REPLACE FUNCTION public.rumo_finish_credit(p_user uuid, p_mode text, p_request uuid, p_success boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r rumo_private.credit_requests; b integer;
begin
 select balance into b from rumo_private.credit_wallets where user_id=p_user and mode=p_mode for update;
 select * into r from rumo_private.credit_requests where id=p_request and user_id=p_user and mode=p_mode for update;
 if not found or p_success is null then raise exception 'request_not_found'; end if;
 if r.status<>'reserved' then return jsonb_build_object('duplicate',true,'status',r.status,'balance',b); end if;
 update rumo_private.credit_requests set status=case when p_success then 'consumed' else 'refunded' end,updated_at=now() where id=p_request;
 if not p_success then
  update rumo_private.credit_wallets set balance=balance+1,updated_at=now() where user_id=p_user and mode=p_mode returning balance into b;
  insert into rumo_private.credit_events(user_id,mode,kind,reference,delta) values(p_user,p_mode,'refund',p_request::text,1);
 end if;
 return jsonb_build_object('duplicate',false,'status',case when p_success then 'consumed' else 'refunded' end,'balance',b);
end;
$function$
;
revoke all on function public.rumo_finish_credit(uuid,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.rumo_finish_credit(uuid,text,uuid,boolean) to service_role;
CREATE OR REPLACE FUNCTION public.rumo_reserve_credit(p_user uuid, p_mode text, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r rumo_private.credit_requests; b integer;
begin
 -- A linha da carteira serializa reservas, inclusive em abas simultâneas.
 b:=public.rumo_credit_balance(p_user,p_mode);
 select * into r from rumo_private.credit_requests where id=p_request;
 if found then return jsonb_build_object('ok',false,'reason','duplicate','balance',b); end if;
 if b<1 then return jsonb_build_object('ok',false,'reason','insufficient','balance',b); end if;
 insert into rumo_private.credit_requests(id,user_id,mode,status) values(p_request,p_user,p_mode,'reserved');
 update rumo_private.credit_wallets set balance=balance-1,updated_at=now() where user_id=p_user and mode=p_mode returning balance into b;
 insert into rumo_private.credit_events(user_id,mode,kind,reference,delta) values(p_user,p_mode,'reserve',p_request::text,-1);
 return jsonb_build_object('ok',true,'balance',b);
end;
$function$
;
revoke all on function public.rumo_reserve_credit(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.rumo_reserve_credit(uuid,text,uuid) to service_role;
CREATE OR REPLACE FUNCTION public.rumo_reverse_credit_payment(p_order uuid, p_payment text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare o rumo_private.credit_orders; b integer;
begin
 select * into o from rumo_private.credit_orders where id=p_order for update;
 if not found or p_payment is null or o.payment_id is distinct from p_payment then raise exception 'payment_mismatch'; end if;
 if o.status='reversed' then return jsonb_build_object('duplicate',true); end if;
 if o.status <> 'credited' then raise exception 'payment_not_credited'; end if;
 update rumo_private.credit_orders set status='reversed' where id=o.id;
 update rumo_private.credit_wallets set balance=balance-o.credits,updated_at=now() where user_id=o.user_id and mode=o.mode returning balance into b;
 insert into rumo_private.credit_events(user_id,mode,kind,reference,delta) values(o.user_id,o.mode,'reversal',o.id::text,-o.credits);
 return jsonb_build_object('duplicate',false,'balance',b);
end;
$function$
;
revoke all on function public.rumo_reverse_credit_payment(uuid,text) from public,anon,authenticated;
grant execute on function public.rumo_reverse_credit_payment(uuid,text) to service_role;
create index if not exists credit_orders_user_idx on rumo_private.credit_orders(user_id,mode,created_at desc);
create index if not exists credit_events_user_idx on rumo_private.credit_events(user_id,mode,created_at desc);

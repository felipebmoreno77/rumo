-- Teste de integração com dados temporários. Não envia e-mail, não chama IA e não movimenta dinheiro.
-- Execute o arquivo inteiro: o rollback final desfaz inclusive usuários e sessões de teste.
begin;
do $$
declare
 customer uuid:=gen_random_uuid(); reviewer uuid:=gen_random_uuid(); cs uuid:=gen_random_uuid(); rs uuid:=gen_random_uuid();
 req uuid:=gen_random_uuid(); request_ai uuid:=gen_random_uuid(); first_order uuid; second_order uuid; r jsonb;
 test_secret text:=repeat('test-only-never-production-',3); bank_id text:='TEST-ROLLBACK-'||gen_random_uuid()::text;
begin
 insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
  (customer,'authenticated','authenticated',customer||'@example.invalid',now(),now(),now()),
  (reviewer,'authenticated','authenticated',reviewer||'@example.invalid',now(),now(),now());
 insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(cs,customer,now(),now(),'aal1'),(rs,reviewer,now(),now(),'aal1');
 insert into rumo_private.pix_admins(user_id) values(reviewer);
 update rumo_private.pix_settings set enabled=true,pix_key='test-key',recipient='test-recipient',server_token_hash=encode(extensions.digest(test_secret,'sha256'),'hex') where singleton;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',customer,'role','authenticated','session_id',cs)::text,true);
 r:=public.rumo_pix_credit_api('status');
 if r->>'admin'<>'false' or (r->>'balance')::int<>0 then raise exception 'customer_access';end if;
 r:=public.rumo_pix_credit_api('create',jsonb_build_object('pack','start','request_id',req,'credits',9999,'amount_cents',1));first_order:=(r->'order'->>'id')::uuid;
 if first_order is null or r->'order'->>'credits'<>'20' or r->'order'->>'amount_cents'<>'490' then raise exception 'catalog';end if;
 r:=public.rumo_pix_credit_api('create',jsonb_build_object('pack','start','request_id',req));
 if (r->'order'->>'id')::uuid<>first_order then raise exception 'creation_idempotency';end if;
 r:=public.rumo_pix_credit_api('report',jsonb_build_object('order_id',first_order));
 if public.rumo_credit_balance(customer,'live')<>0 then raise exception 'report_granted_credits';end if;
 r:=public.rumo_pix_credit_api('admin_approve',jsonb_build_object('order_id',first_order,'confirmed',true,'bank_reference',bank_id));
 if r->>'error'<>'forbidden' then raise exception 'customer_approved';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer,'role','authenticated','session_id',rs)::text,true);
 r:=public.rumo_pix_credit_api('report',jsonb_build_object('order_id',first_order));if r->>'error'<>'not_found' then raise exception 'cross_account_report';end if;
 r:=public.rumo_pix_credit_api('admin_approve',jsonb_build_object('order_id',first_order,'confirmed',true,'bank_reference',bank_id));
 if public.rumo_credit_balance(customer,'live')<>20 then raise exception 'approval';end if;
 r:=public.rumo_pix_credit_api('admin_approve',jsonb_build_object('order_id',first_order,'confirmed',true,'bank_reference',bank_id));
 if public.rumo_credit_balance(customer,'live')<>20 then raise exception 'double_approval';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',customer,'role','authenticated','session_id',cs)::text,true);
 r:=public.rumo_pix_credit_api('create',jsonb_build_object('pack','start','request_id',gen_random_uuid()));second_order:=(r->'order'->>'id')::uuid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer,'role','authenticated','session_id',rs)::text,true);
 r:=public.rumo_pix_credit_api('admin_approve',jsonb_build_object('order_id',second_order,'confirmed',true,'bank_reference',bank_id));
 if r->>'error'<>'duplicate_payment' then raise exception 'duplicate_bank_id';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',customer,'role','authenticated','session_id',cs)::text,true);
 r:=public.rumo_pix_credit_api('reserve',jsonb_build_object('request_id',request_ai));if r->>'error'<>'forbidden' then raise exception 'client_reserved';end if;
 r:=public.rumo_pix_credit_api('reserve',jsonb_build_object('request_id',request_ai),test_secret);
 if r->>'ok'<>'true' or public.rumo_credit_balance(customer,'live')<>19 then raise exception 'reserve';end if;
 r:=public.rumo_pix_credit_api('reserve',jsonb_build_object('request_id',request_ai),test_secret);
 if public.rumo_credit_balance(customer,'live')<>19 then raise exception 'double_reserve';end if;
 r:=public.rumo_pix_credit_api('finish',jsonb_build_object('request_id',request_ai,'success',false),test_secret);
 r:=public.rumo_pix_credit_api('finish',jsonb_build_object('request_id',request_ai,'success',false),test_secret);
 if public.rumo_credit_balance(customer,'live')<>20 then raise exception 'refund';end if;
 request_ai:=gen_random_uuid();r:=public.rumo_pix_credit_api('reserve',jsonb_build_object('request_id',request_ai),test_secret);
 r:=public.rumo_pix_credit_api('finish',jsonb_build_object('request_id',request_ai,'success',true),test_secret);
 if public.rumo_credit_balance(customer,'live')<>19 then raise exception 'consume';end if;
 request_ai:=gen_random_uuid();r:=public.rumo_pix_credit_api('reserve',jsonb_build_object('request_id',request_ai),test_secret);
 update rumo_private.credit_requests set created_at=now()-interval '11 minutes' where id=request_ai;
 if public.rumo_credit_balance(customer,'live')<>19 then raise exception 'abandoned_reserve';end if;
 delete from auth.sessions where id=cs;
 r:=public.rumo_pix_credit_api('status');if r->>'error'<>'forbidden' then raise exception 'revoked_session';end if;
 if has_function_privilege('anon','public.rumo_pix_credit_api(text,jsonb,text)','EXECUTE') then raise exception 'anonymous_grant';end if;
 if has_function_privilege('authenticated','public.rumo_confirm_credit_payment(uuid,text,text,text,integer,text)','EXECUTE') then raise exception 'direct_ledger_grant';end if;
end $$;
rollback;
select true as pix_regression_passed;

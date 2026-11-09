-- Testes transacionais: nenhum evento, avaliação ou pedido de teste permanece salvo.
begin;
do $$
declare owner uuid; sid uuid; other_user uuid; result jsonb; ticket uuid;
begin
 select c.owner_id into owner from rumo_private.portal_config c;
 select id into sid from auth.sessions where user_id=owner order by created_at desc limit 1;
 if sid is null then raise exception 'A conta administradora precisa ter uma sessão existente para o teste.'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated','session_id',sid)::text,true);
 execute 'set local role authenticated';
 result:=public.rumo_portal('access','{}');
 if result->>'admin'<>'true' then raise exception 'Admin autorizado não reconhecido'; end if;
 result:=public.rumo_portal('dashboard','{"days":7}');
 if not result ? 'accounts' or jsonb_array_length(result->'daily')<>7 then raise exception 'Dashboard inválido'; end if;
 perform public.rumo_portal('event','{"kind":"quiz_start","user_id":"00000000-0000-0000-0000-000000000000"}');
 perform public.rumo_portal('event','{"kind":"quiz_start"}');
 perform public.rumo_portal('event','{"kind":"route_view","route":"enterprise"}');
 perform public.rumo_portal('event','{"kind":"task_record","route":"enterprise","day":1,"value":"different"}');
 perform public.rumo_portal('review','{"rating":5,"comment":"Teste temporário"}');
 result:=public.rumo_portal('ticket','{"category":"other","message":"Pedido de teste temporário."}');ticket:=(result->>'id')::uuid;
 perform public.rumo_portal('ticket_status',jsonb_build_object('id',ticket,'status','resolved'));
 begin perform public.rumo_portal('event','{"kind":"task_record","route":"enterprise","day":99,"value":"liked"}');raise exception 'Evento inválido aceito';exception when invalid_parameter_value then null;end;
 begin perform public.rumo_portal('review','{"rating":8}');raise exception 'Nota inválida aceita';exception when invalid_parameter_value then null;end;
 begin perform count(*) from rumo_private.support_tickets;raise exception 'Tabela privada exposta';exception when insufficient_privilege then null;end;
 execute 'reset role';
 if (select count(*) from rumo_private.activity where user_id=owner and kind='quiz_start' and event_date=(now() at time zone 'America/Sao_Paulo')::date)<>1 then raise exception 'Evento duplicado';end if;
 -- Mesmo administrador com sessão revogada/inexistente não lê o painel.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated','session_id',gen_random_uuid())::text,true);
 execute 'set local role authenticated';
 begin perform public.rumo_portal('dashboard','{}');raise exception 'Sessão revogada aceita';exception when insufficient_privilege then null;end;
 execute 'reset role';
 select id into other_user from auth.users where id<>owner and email_confirmed_at is not null and coalesce(is_anonymous,false)=false limit 1;
 if other_user is not null then
  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_user,'role','authenticated','email','felipebmoreno@icloud.com','user_metadata',jsonb_build_object('admin',true))::text,true);
  execute 'set local role authenticated';
  if public.rumo_portal('access','{}')->>'admin'<>'false' then raise exception 'Outra conta ganhou acesso';end if;
  begin perform public.rumo_portal('dashboard','{}');raise exception 'Outra conta leu o painel';exception when insufficient_privilege then null;end;
  begin perform public.rumo_portal('ticket_status',jsonb_build_object('id',ticket,'status','open'));raise exception 'Outra conta alterou suporte';exception when insufficient_privilege then null;end;
  execute 'reset role';
 end if;
 perform set_config('request.jwt.claims','{}',true);execute 'set local role anon';
 begin perform public.rumo_portal('dashboard','{}');raise exception 'Anônimo leu painel';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $$;
rollback;

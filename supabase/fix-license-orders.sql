-- Corrige somente a consulta de compras; preserva permissões e demais operações.
-- O alias o conflitava com a variável de linha o em PL/pgSQL.
do $repair$
declare definition text; old_query text := $old$ if p_action='orders' then
  if not admin then raise insufficient_privilege;end if;
  page_no:=greatest(0,least(10000,coalesce((p_data->>'page')::integer,0)));
  filter_status:=coalesce(p_data->>'status','review');
  if filter_status not in ('all','review','pending','reported','approved','rejected','expired') then raise invalid_parameter_value;end if;
  select jsonb_build_object('total',(select count(*) from rumo_private.app_orders where filter_status='all' or (filter_status='review' and status='reported') or status=filter_status),
   'orders',coalesce((select jsonb_agg(x) from (select o.id,u.email,o.amount_cents,o.status,o.created_at,o.expires_at,o.reported_at,o.reviewed_at,o.bank_reference,'RUMO'||upper(substr(replace(o.id::text,'-',''),1,20)) as reference
    from rumo_private.app_orders o join auth.users u on u.id=o.user_id
    where filter_status='all' or (filter_status='review' and o.status='reported') or o.status=filter_status order by o.created_at desc limit 20 offset page_no*20) x),'[]'::jsonb)) into result;
  return result;
 end if;$old$; new_query text := $new$ if p_action='orders' then
  if not admin then raise insufficient_privilege;end if;
  page_no:=greatest(0,least(10000,coalesce((p_data->>'page')::integer,0)));
  filter_status:=coalesce(p_data->>'status','review');
  if filter_status not in ('all','review','pending','reported','approved','rejected','expired') then raise invalid_parameter_value;end if;
  select jsonb_build_object('total',(select count(*) from rumo_private.app_orders where filter_status='all' or (filter_status='review' and status='reported') or status=filter_status),
   'orders',coalesce((select jsonb_agg(x) from (select purchase.id,u.email,purchase.amount_cents,purchase.status,purchase.created_at,purchase.expires_at,purchase.reported_at,purchase.reviewed_at,purchase.bank_reference,'RUMO'||upper(substr(replace(purchase.id::text,'-',''),1,20)) as reference
    from rumo_private.app_orders purchase join auth.users u on u.id=purchase.user_id
    where filter_status='all' or (filter_status='review' and purchase.status='reported') or purchase.status=filter_status order by purchase.created_at desc limit 20 offset page_no*20) x),'[]'::jsonb)) into result;
  return result;
 end if;$new$;
begin
 definition:=pg_get_functiondef('rumo_private.license(text,jsonb)'::regprocedure);
 if position(new_query in definition)>0 then return; end if;
 if position(old_query in definition)=0 then raise exception 'A função mudou: revisar correção antes de aplicar';end if;
 execute replace(definition,old_query,new_query);
end $repair$;
notify pgrst,'reload schema';

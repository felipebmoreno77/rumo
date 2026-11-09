'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createAuthHandler}=require('../netlify/functions/auth.cjs');
const env={APP_ORIGIN:'https://rumo.example',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const owner={id:'4793e6e8-40b6-4bb1-be3d-eb0366433ac2',email:'felipebmoreno@icloud.com',email_confirmed_at:'today'};
const handler=createAuthHandler(env);
const call=(operation,data={},headers={})=>handler({httpMethod:'POST',headers:{origin:env.APP_ORIGIN,'content-type':'application/json',cookie:'__Host-rumo-access=test-access',...headers},body:JSON.stringify({action:'portal',operation,data})});
test('painel não aceita e-mail ou permissão forjados pelo cliente',async()=>{
 let rpc=0;global.fetch=async url=>{if(url.includes('/rest/')){rpc++;throw Error('não deveria chamar RPC');}return Response.json({...owner,id:'outro-usuario'})};
 assert.equal((await call('dashboard',{admin:true,email:owner.email})).statusCode,403);assert.equal(rpc,0);
});
test('sem sessão e origem de outro domínio são bloqueados antes da leitura',async()=>{
 global.fetch=()=>{throw Error('não deveria chamar');};
 assert.equal((await call('dashboard',{}, {cookie:''})).statusCode,401);
 assert.equal((await call('dashboard',{}, {origin:'https://evil.example'})).statusCode,403);
});
test('admin com sessão validada ainda precisa da autorização do banco',async()=>{
 global.fetch=async url=>url.includes('/rest/')?Response.json({code:'42501',message:'private details'},{status:403}):Response.json(owner);
 const r=await call('dashboard');assert.equal(r.statusCode,403);assert(!r.body.includes('private details'));
});
test('RPC recebe JWT somente no servidor e devolve dados sem tokens',async()=>{
 const calls=[];global.fetch=async(url,opts)=>{calls.push({url,opts});return Response.json(url.includes('/rest/')?{accounts:4,tickets:[]}:owner)};
 const r=await call('dashboard',{days:7});assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).accounts,4);assert(!r.body.includes('test-access'));
 assert.equal(calls[1].opts.headers.Authorization,'Bearer test-access');assert.deepEqual(JSON.parse(calls[1].opts.body),{p_action:'dashboard',p_data:{days:7}});assert.equal(r.headers['Cache-Control'],'no-store');
});
test('usuário comum pode enviar avaliação ou suporte, mas não alterar pedidos',async()=>{
 global.fetch=async url=>Response.json(url.includes('/rest/')?{ok:true}: {...owner,id:'comum',email:'comum@example.com'});
 assert.equal((await call('review',{rating:5,comment:'Bom'})).statusCode,200);
 assert.equal((await call('ticket',{category:'map',message:'Preciso de ajuda com meu mapa'})).statusCode,200);
 assert.equal((await call('ticket_status',{id:'fake',status:'resolved'})).statusCode,403);
});
test('operações desconhecidas e dados malformados não alcançam o provedor',async()=>{
 global.fetch=()=>{throw Error('não deveria chamar');};
 assert.equal((await call('drop_database')).statusCode,400);assert.equal((await call('event',[])).statusCode,400);
});

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const loaded=import('../cloudflare/worker.mjs');
const env={APP_ORIGIN:'https://rumo.example',SUPABASE_URL:'https://db.example',SUPABASE_PUBLISHABLE_KEY:'public'};
const result=(status,data,cookies=[])=>({statusCode:status,body:JSON.stringify(data),multiValueHeaders:{'Set-Cookie':cookies}});
test('app completo só é entregue com licença validada no servidor',async()=>{
 const {createRumoWorker}=await loaded;let seen;
 const worker=createRumoWorker(config=>async event=>{seen={config,event};return result(200,{allowed:true,state:'trial'},['example-cookie=value; HttpOnly; Secure'])},'CONTEUDO-PROTEGIDO');
 const r=await worker.fetch(new Request(env.APP_ORIGIN+'/app',{headers:{cookie:'__Host-rumo-access=test'}}),env);
 assert.equal(r.status,200);assert.equal(await r.text(),'CONTEUDO-PROTEGIDO');assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal(r.headers.getSetCookie().length,1);
 assert.deepEqual(JSON.parse(seen.event.body),{action:'license',operation:'status',data:{}});assert.equal(seen.event.headers.cookie,'__Host-rumo-access=test');
});
test('expiração, ausência de login e falhas não entregam o conteúdo',async()=>{
 const {createRumoWorker}=await loaded;
 for(const [code,data,expected] of [[200,{allowed:false,state:'expired'},302],[200,{allowed:null,state:'ready'},302],[401,{error:'login'},302],[503,{error:'offline'},503]]){
  const worker=createRumoWorker(()=>async()=>result(code,data),'CONTEUDO-PROTEGIDO');const r=await worker.fetch(new Request(env.APP_ORIGIN+'/app'),env);assert.equal(r.status,expected);assert(!(await r.text()).includes('CONTEUDO-PROTEGIDO'));
 }
});
test('vitrine publicada não contém questionário nem algoritmos do app',()=>{
 const s=fs.readFileSync(__dirname+'/../cloudflare-dist/index.html','utf8');assert(!s.includes('const questions=['));assert(!s.includes('function getProfile('));assert(s.includes('function checkoutView('));
});

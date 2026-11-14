'use strict';
// Publicação direta pela API oficial. Node 22+, sem dependências ou tokens no código.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const ACCOUNT='dffd0be6e07ea3e808180bee01b4f2a3',WORKER='rumo';
function prepare(){
 const dir=path.join(root,'cloudflare-dist');
 // Lista explícita: nunca publicar código de servidor, SQL, configurações ou backups.
 const bytes=fs.readFileSync(path.join(dir,'index.html'));
 const hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,32);
 const assets={[hash]:{bytes,type:'text/html; charset=utf-8'}},manifest={'/index.html':{hash,size:bytes.length}};
 for(const [name,type] of [['favicon.svg','image/svg+xml'],['favicon.ico','image/x-icon'],['favicon-32x32.png','image/png'],['apple-touch-icon.png','image/png'],['assets/rumo-workspace.jpg','image/jpeg']]){
  const file=fs.readFileSync(path.join(dir,name)),digest=crypto.createHash('sha256').update(file).digest('hex').slice(0,32);
  manifest['/'+name]={hash:digest,size:file.length};assets[digest]={bytes:file,type};
 }
 return {manifest,assets,bytes,hash,
  worker:fs.readFileSync(path.join(dir,'_worker.js'),'utf8'),
  headers:fs.readFileSync(path.join(dir,'_headers'),'utf8')};
}
async function deploy({token,fetcher=fetch,prepared=prepare()}={}){
 if(!token)throw Error('CLOUDFLARE_API_TOKEN ausente no ambiente de publicação.');
 const prefix=`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}`;
 async function api(endpoint,{method='POST',body,bearer=token,query=''}={}){
  const multipart=body instanceof FormData;
  const res=await fetcher(prefix+endpoint+query,{method,headers:{Authorization:'Bearer '+bearer,...(multipart?{}:{'Content-Type':'application/json'})},body:multipart?body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  const data=await res.json().catch(()=>({}));
  // Não ecoar resposta arbitrária: pode conter credenciais ou JWT temporário.
  if(!res.ok||data.success===false)throw Error(`Cloudflare recusou ${method} ${endpoint} (HTTP ${res.status}).`);
  return data.result;
 }
 const session=await api(`/workers/scripts/${WORKER}/assets-upload-session`,{body:{manifest:prepared.manifest}});
 if(!session?.jwt||!Array.isArray(session.buckets))throw Error('Sessão de arquivos inválida.');
 let completion=session.buckets.length?null:session.jwt;
 for(const bucket of session.buckets){
  const form=new FormData();
  for(const hash of bucket){
   const asset=prepared.assets[hash];
   if(!asset)throw Error('Arquivo inesperado solicitado pela Cloudflare.');
   form.append(hash,new Blob([asset.bytes.toString('base64')],{type:asset.type}));
  }
  const result=await api('/workers/assets/upload',{body:form,bearer:session.jwt,query:'?base64=true'});
  if(result?.jwt)completion=result.jwt;
 }
 if(!completion)throw Error('Os arquivos não foram confirmados; versão atual preservada.');
 const metadata={main_module:'worker.mjs',compatibility_date:'2026-11-04',compatibility_flags:[],
  // Mantém apenas as configurações já autorizadas de autenticação.
  bindings:[{name:'ASSETS',type:'assets'},...['APP_ORIGIN','APP_ADDITIONAL_ORIGIN','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'].map(name=>({name,type:'inherit'}))],
  assets:{jwt:completion,config:{_headers:prepared.headers,run_worker_first:['/api/*','/.netlify/functions/*'],not_found_handling:'none'}},
  observability:{enabled:true,head_sampling_rate:0.1,redact_query_string:true,logs:{enabled:true,invocation_logs:true,persist:true},traces:{enabled:true,head_sampling_rate:0.1,persist:true}}};
 const form=new FormData();
 form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
 form.append('worker.mjs',new Blob([prepared.worker],{type:'application/javascript+module'}),'worker.mjs');
 const result=await api(`/workers/scripts/${WORKER}`,{method:'PUT',body:form,query:'?bindings_inherit=strict'});
 return {worker:WORKER,deployment:result?.deployment_id};
}
module.exports={prepare,deploy};
if(require.main===module)deploy({token:process.env.CLOUDFLARE_API_TOKEN}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1});

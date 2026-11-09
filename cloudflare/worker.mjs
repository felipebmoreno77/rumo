// Adaptador Web Fetch para o mesmo núcleo de autenticação usado na Netlify.
const securityHeaders={
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'X-Frame-Options':'DENY',
 'Permissions-Policy':'camera=(), geolocation=()',
 'Strict-Transport-Security':'max-age=31536000'
};
function json(status,error){return new Response(JSON.stringify({error}),{status,headers:{...securityHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}})}
async function readSmallBody(request){
 const length=Number(request.headers.get('content-length'));
 if(Number.isFinite(length)&&length>4096)throw new RangeError();
 if(!request.body)return '';
 const reader=request.body.getReader(),parts=[];let size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new RangeError()}parts.push(value)}
 }finally{reader.releaseLock()}
 const body=new Uint8Array(size);let offset=0;for(const p of parts){body.set(p,offset);offset+=p.byteLength}
 return new TextDecoder('utf-8',{fatal:true}).decode(body);
}
export function createRumoWorker(makeAuthHandler){return {
 async fetch(request,env){
  const path=new URL(request.url).pathname.replace(/\/$/,'')||'/';
  const api=path.startsWith('/api/')||path.startsWith('/.netlify/functions/');
  if(['/api/mentor','/.netlify/functions/mentor','/api/credits','/.netlify/functions/credits'].includes(path))return json(410,'O Mentor é gratuito e responde no aplicativo. Não há compra de créditos.');
  if(!['/api/auth','/.netlify/functions/auth'].includes(path)){
   if(api)return json(404,'Recurso não encontrado.');
   if(!env.ASSETS?.fetch)return json(503,'O aplicativo está aguardando a publicação dos arquivos.');
   return env.ASSETS.fetch(request);
  }
  if(request.method!=='POST')return json(405,'Método não permitido.');
  if(!env.APP_ORIGIN)return json(503,'O login ainda não foi conectado. Tente novamente depois.');
  if(request.headers.get('origin')!==env.APP_ORIGIN||!request.headers.get('content-type')?.startsWith('application/json'))return json(403,'Solicitação não autorizada.');
  let body;try{body=await readSmallBody(request)}catch(e){return json(e instanceof RangeError?413:400,e instanceof RangeError?'Solicitação muito grande.':'Solicitação inválida.')}
  try{
   const result=await makeAuthHandler({APP_ORIGIN:env.APP_ORIGIN,SUPABASE_URL:env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY})({httpMethod:request.method,headers:Object.fromEntries(request.headers),body,isBase64Encoded:false});
   const headers=new Headers({...securityHeaders,...result.headers});
   for(const cookie of result.multiValueHeaders?.['Set-Cookie']||[])headers.append('Set-Cookie',cookie);
   return new Response(result.body,{status:result.statusCode,headers});
  }catch{return json(503,'Não foi possível validar sua conta. Tente novamente.')}
 }
}}

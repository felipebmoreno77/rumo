'use strict';
const cookie=(name,value,age)=>name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+age;
const clear=()=>[cookie('__Host-rumo-access','',0),cookie('__Host-rumo-refresh','',0)];
async function handleAuth(event,env){
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const reply=(statusCode,data,cookies=[])=>({statusCode,headers,multiValueHeaders:{'Set-Cookie':cookies},body:JSON.stringify(data)});
 const origin=env.APP_ORIGIN, base=env.SUPABASE_URL, key=env.SUPABASE_PUBLISHABLE_KEY;
 if(!origin||!base||!key||!/^https:\/\//.test(origin)||!/^https:\/\//.test(base))return reply(503,{error:'O login ainda não foi conectado. Tente novamente depois.'});
 const h=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 if(event.httpMethod!=='POST')return reply(405,{error:'Método não permitido.'});
 if(h.origin!==origin||!h['content-type']?.startsWith('application/json'))return reply(403,{error:'Solicitação não autorizada.'});
 if((event.body||'').length>4096)return reply(413,{error:'Solicitação muito grande.'});
 let b;try{b=JSON.parse(event.body||'{}')}catch{return reply(400,{error:'Solicitação inválida.'})}
 if(!b||typeof b!=='object'||Array.isArray(b))return reply(400,{error:'Solicitação inválida.'});
 const api=async(path,body,token,method='POST')=>{
  const r=await fetch(base.replace(/\/$/,'')+'/auth/v1/'+path,{method,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
  const d=await r.json().catch(()=>({}));return {ok:r.ok,status:r.status,data:d};
 };
 const parseCookies=()=>Object.fromEntries((h.cookie||'').split(';').map(x=>x.trim().split(/=(.*)/s).slice(0,2)).filter(x=>x.length===2).map(([k,v])=>[k,decodeURIComponent(v)]));
 const userInfo=u=>({id:u.id,email:u.email});
 const verified=u=>u&&typeof u.id==='string'&&!!u.email_confirmed_at;
 const sessionCookies=d=>[cookie('__Host-rumo-access',d.access_token,Math.min(d.expires_in||3600,3600)),cookie('__Host-rumo-refresh',d.refresh_token,604800)];
 const failure=r=>reply(r.status===429?429:400,{error:r.status===429?'Muitas tentativas. Aguarde e tente novamente.':'Não foi possível concluir. Confira os dados ou solicite um novo código.'});
 try{
  const c=parseCookies();
  async function session(){
   let token=c['__Host-rumo-access'],cookies=[];
   let r=token?await api('user',null,token,'GET'):null;
   if((!r||r.status===401||r.status===403)&&c['__Host-rumo-refresh']){
    const refreshed=await api('token?grant_type=refresh_token',{refresh_token:c['__Host-rumo-refresh']});
    if(!refreshed.ok)return null;
    token=refreshed.data.access_token;cookies=sessionCookies(refreshed.data);
    r=await api('user',null,token,'GET');
   }
   return r?.ok&&verified(r.data)?{user:r.data,token,cookies}:null;
  }
  if(b.action==='session'){
   const s=await session();return s?reply(200,{user:userInfo(s.user)},s.cookies):reply(401,{error:'Entre na sua conta para continuar.'},clear());
  }
  if(b.action==='logout'){
   const s=await session();if(s)await api('logout?scope=local',{},s.token);
   return reply(200,{ok:true},clear());
  }
  if(b.action==='password'){
   if(typeof b.password!=='string'||b.password.length<10||b.password.length>128)return reply(400,{error:'Use uma senha entre 10 e 128 caracteres.'});
   const s=await session();if(!s)return reply(401,{error:'Confirme o código novamente.'},clear());
   const r=await api('user',{password:b.password},s.token,'PUT');if(!r.ok)return failure(r);
   await api('logout?scope=global',{},s.token);
   return reply(200,{ok:true},clear());
  }
  const email=typeof b.email==='string'?b.email.trim():'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply(400,{error:'Digite um e-mail válido.'});
  if(['signup','login'].includes(b.action)){
   if(typeof b.password!=='string'||b.password.length>128||b.password.length<(b.action==='signup'?10:1))return reply(400,{error:'Confira sua senha. No cadastro, use pelo menos 10 caracteres.'});
   const r=await api(b.action==='signup'?'signup':'token?grant_type=password',{email,password:b.password});
   if(!r.ok)return failure(r);
   if(b.action==='signup')return reply(200,{message:'Se o cadastro puder ser concluído, você receberá um código. Confira também o spam.'});
   if(!verified(r.data.user))return reply(403,{error:'Confirme seu e-mail antes de entrar.'});
   return reply(200,{user:userInfo(r.data.user)},sessionCookies(r.data));
  }
  if(b.action==='recover'||b.action==='resend'){
   const r=await api(b.action==='recover'?'recover':'resend',b.action==='recover'?{email}:{email,type:'signup'});
   if(r.status===429)return failure(r);
   if(r.status>=500)return reply(503,{error:'Envio indisponível no momento. Tente mais tarde.'});
   return reply(200,{message:'Se houver uma conta elegível, enviaremos um código. Confira também o spam.'});
  }
  if(b.action==='verify'){
   if(!['signup','recovery'].includes(b.type)||!/^\d{6}$/.test(b.code||''))return reply(400,{error:'Digite o código de seis números.'});
   const r=await api('verify',{email,token:b.code,type:b.type});
   if(!r.ok||!verified(r.data.user)||!r.data.access_token)return failure(r);
   return reply(200,{user:userInfo(r.data.user)},sessionCookies(r.data));
  }
  return reply(400,{error:'Solicitação inválida.'});
 }catch{return reply(503,{error:'Não foi possível conectar. Tente novamente em instantes.'})}

}
// A configuração é local à requisição. Nenhuma variável global é trocada entre contas/ambientes.
exports.createAuthHandler=env=>event=>handleAuth(event,env||{});
exports.handler=event=>handleAuth(event,process.env);

'use strict';
const cookie=(name,value,age)=>name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+age;
const clear=()=>[cookie('__Host-rumo-access','',0),cookie('__Host-rumo-refresh','',0)];
function pixPayload(pix,amountCents){
 const tlv=(id,value)=>id+String(value.length).padStart(2,'0')+value;
 const name=String(pix.recipient).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9 ]/g,'').toUpperCase().slice(0,25);
 let body='000201'+tlv('26',tlv('00','br.gov.bcb.pix')+tlv('01',pix.key))+'520400005303986'+tlv('54',(amountCents/100).toFixed(2))+'5802BR'+tlv('59',name)+tlv('60','BRASIL')+tlv('62',tlv('05',pix.reference))+'6304';
 let crc=0xffff;for(let i=0;i<body.length;i++){crc^=body.charCodeAt(i)<<8;for(let j=0;j<8;j++)crc=((crc<<1)^((crc&0x8000)?0x1021:0))&0xffff;}
 return body+crc.toString(16).toUpperCase().padStart(4,'0');
}
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
  if(b.action==='license'){
   if(!['status','start','create','report','orders','approve','reject'].includes(b.operation)||!b.data||typeof b.data!=='object'||Array.isArray(b.data))return reply(400,{error:'Solicitação inválida.'});
   const s=await session();if(!s)return reply(401,{error:'Entre na sua conta para continuar.'},clear());
   const owner=s.user.id==='4793e6e8-40b6-4bb1-be3d-eb0366433ac2'&&s.user.email?.toLowerCase()==='felipebmoreno@icloud.com';
   if(['orders','approve','reject'].includes(b.operation)&&!owner)return reply(403,{error:'Acesso exclusivo à administração.'},s.cookies);
   const res=await fetch(base.replace(/\/$/,'')+'/rest/v1/rpc/rumo_license',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+s.token,'Content-Type':'application/json'},body:JSON.stringify({p_action:b.operation,p_data:b.data}),signal:AbortSignal.timeout(10000)});
   const data=await res.json().catch(()=>null);
   if(!res.ok){const denied=res.status===403||data?.code==='42501';return reply(denied?403:res.status>=500?503:400,{error:denied?'Acesso não autorizado. Entre novamente.':data?.code==='P0001'&&typeof data.message==='string'?data.message:'Não foi possível concluir. Confira os dados e tente novamente.'},s.cookies);}
   if(data?.pix&&data.order?.amountCents){data.pix.payload=pixPayload(data.pix,data.order.amountCents);}
   return reply(200,data,s.cookies);
  }
  if(b.action==='portal'){
   const operations=['access','event','review','ticket','dashboard','ticket_status'];
   if(!operations.includes(b.operation)||!b.data||typeof b.data!=='object'||Array.isArray(b.data))return reply(400,{error:'Solicitação inválida.'});
   const s=await session();if(!s)return reply(401,{error:'Entre na sua conta para continuar.'},clear());
   const owner=s.user.id==='4793e6e8-40b6-4bb1-be3d-eb0366433ac2'&&s.user.email?.toLowerCase()==='felipebmoreno@icloud.com';
   if(['dashboard','ticket_status'].includes(b.operation)&&!owner)return reply(403,{error:'Acesso exclusivo à administração.'},s.cookies);
   const res=await fetch(base.replace(/\/$/,'')+'/rest/v1/rpc/rumo_portal',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+s.token,'Content-Type':'application/json'},body:JSON.stringify({p_action:b.operation,p_data:b.data}),signal:AbortSignal.timeout(10000)});
   const data=await res.json().catch(()=>null);
   if(!res.ok){const forbidden=res.status===403||data?.code==='42501';const limited=data?.code==='P0001';return reply(forbidden?403:limited?429:res.status>=500?503:400,{error:forbidden?'Acesso exclusivo à administração.':limited?'Limite de pedidos atingido. Aguarde uma hora ou fale pelo WhatsApp.':'Não foi possível concluir. Tente novamente.'},s.cookies)}
   return reply(200,data,s.cookies);
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
exports.pixPayload=pixPayload;

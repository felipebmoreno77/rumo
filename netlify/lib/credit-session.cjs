'use strict';
const {handler:auth}=require('../functions/auth.cjs');
exports.session=async event=>{
 const r=await auth({...event,body:'{"action":"session"}'});
 const cookies=r.multiValueHeaders?.['Set-Cookie']||[];
 if(r.statusCode!==200)return {cookies,status:r.statusCode};
 const user=JSON.parse(r.body).user;
 const fresh=cookies.find(c=>c.startsWith('__Host-rumo-access=')&&!c.includes('Max-Age=0'));
 const raw=fresh?fresh.split(';')[0].slice('__Host-rumo-access='.length):(event.headers?.cookie||event.headers?.Cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('__Host-rumo-access='))?.slice('__Host-rumo-access='.length);
 return {cookies,status:200,user,token:decodeURIComponent(raw||'')};
};
exports.rpc=async(token,action,data={},server=false)=>{
 if(server&&!process.env.RUMO_CREDIT_SERVER_TOKEN)throw Error('credit_config');
 const r=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/rumo_pix_credit_api',{method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_data:data,...(server?{p_server_token:process.env.RUMO_CREDIT_SERVER_TOKEN}:{})}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('credit_unavailable');
 const result=await r.json();if(!result||typeof result!=='object')throw Error('credit_unavailable');return result;
};

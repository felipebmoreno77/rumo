const {test}=require('node:test'),assert=require('node:assert/strict');
const {createAuthHandler,pixPayload}=require('../netlify/functions/auth.cjs');
const env={APP_ORIGIN:'https://rumo.example',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-public'};
const handler=createAuthHandler(env),user={id:'buyer',email:'buyer@example.com',email_confirmed_at:'today'};
const call=(operation,data={})=>handler({httpMethod:'POST',headers:{origin:env.APP_ORIGIN,'content-type':'application/json',cookie:'__Host-rumo-access=test-access'},body:JSON.stringify({action:'license',operation,data})});
// Payload lido do QR Code gerado no app do banco, independente do gerador do Rumo.
const bankPayload='00020101021126580014br.gov.bcb.pix01360fa5908f-a977-4422-8ef4-f832ed3394ba520400005303986540519.905802BR5915FELIPE B MORENO6007ATIBAIA62070503***6304009A';
test('reproduz integralmente o QR Code de R$ 19,90 gerado pelo Inter, inclusive CRC com zeros à esquerda',()=>{
 assert.equal(pixPayload({key:'0fa5908f-a977-4422-8ef4-f832ed3394ba',recipient:'FELIPE B MORENO',city:'ATIBAIA',reference:'***'},1990),bankPayload);
});
test('recusa campos que poderiam produzir um código Pix truncado ou ambíguo',()=>{
 const pix={key:'0fa5908f-a977-4422-8ef4-f832ed3394ba',recipient:'FELIPE B MORENO'};
 assert.throws(()=>pixPayload({...pix,key:pix.key+'\n'},1990));
 assert.throws(()=>pixPayload({...pix,reference:'RUMO-INVALIDO'},1990));
 assert.throws(()=>pixPayload(pix,19.9));
});
test('Pix tem valor, destinatário, referência e CRC válidos',()=>{
 const pix={key:'0fa5908f-a977-4422-8ef4-f832ed3394ba',recipient:'Felipe Barbanera Moreno',reference:'RUMO12345678901234567890'};
 const s=pixPayload(pix,1990);assert(s.startsWith('000201'));assert(s.includes('540519.90'));assert(s.includes(pix.key));assert(s.includes(pix.reference));assert(s.endsWith('6304'+s.slice(-4)));
 let crc=65535;for(const b of Buffer.from(s.slice(0,-4))){crc^=b<<8;for(let i=0;i<8;i++)crc=crc&32768?((crc<<1)^4129)&65535:(crc<<1)&65535;}assert.equal(s.slice(-4),crc.toString(16).toUpperCase().padStart(4,'0'));
});
test('cliente não pode aprovar pagamento mesmo forjando email e preço',async()=>{let rpc=0;global.fetch=async url=>{if(url.includes('/rest/'))rpc++;return Response.json(user)};const r=await call('approve',{confirmed:true,email:'felipebmoreno@icloud.com',amountCents:1});assert.equal(r.statusCode,403);assert.equal(rpc,0);});
test('a consulta usa a sessão no servidor, preserva o protocolo local e entrega o modelo do Inter sem tokens',async()=>{global.fetch=async(url,opts)=>{if(url.includes('/rest/')){assert.equal(opts.headers.Authorization,'Bearer test-access');return Response.json({state:'trial',allowed:true,order:{amountCents:1990},pix:{key:'0fa5908f-a977-4422-8ef4-f832ed3394ba',recipient:'Felipe Barbanera Moreno',reference:'RUMO12345678901234567890'}})}return Response.json(user)};const r=await call('status');assert.equal(r.statusCode,200);const d=JSON.parse(r.body);assert.equal(d.pix.payload,bankPayload);assert.equal(d.pix.reference,'RUMO12345678901234567890');assert.equal(d.pix.payloadReference,'***');assert(!r.body.includes('test-access'));});

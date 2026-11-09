'use strict';
const {session,rpc}=require('../lib/credit-session.cjs');
exports.handler=async event=>{
 let cookies=[];const reply=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},multiValueHeaders:{'Set-Cookie':cookies},body:JSON.stringify(body)});
 const h=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 if(event.httpMethod!=='POST')return reply(405,{error:'Método não permitido.'});
 if(!process.env.APP_ORIGIN||h.origin!==process.env.APP_ORIGIN||!h['content-type']?.startsWith('application/json'))return reply(403,{error:'Solicitação não autorizada.'});
 if(event.isBase64Encoded||Buffer.byteLength(event.body||'')>4096)return reply(413,{error:'Solicitação muito grande.'});
 let b;try{b=JSON.parse(event.body||'{}')}catch{return reply(400,{error:'Solicitação inválida.'})}
 if(!b||typeof b!=='object'||Array.isArray(b))return reply(400,{error:'Solicitação inválida.'});
 if(!['status','create','report','admin_approve','admin_reject'].includes(b.action))return reply(400,{error:'Ação inválida.'});
 try{
  const s=await session(event);cookies=s.cookies;
  if(s.status!==200)return reply(s.status===401?401:503,{error:s.status===401?'Entre na sua conta para continuar.':'Não foi possível validar sua conta.'});
  if(b.action==='create')return reply(410,{error:'O Mentor agora é gratuito. A compra de novos créditos foi encerrada.'});
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(['report','admin_approve','admin_reject'].includes(b.action)&&!uuid.test(b.orderId||''))return reply(400,{error:'Pedido inválido.'});
  if(b.action==='admin_approve'&&(b.confirmed!==true||typeof b.bankReference!=='string'||b.bankReference.trim().length<10||b.bankReference.length>100))return reply(400,{error:'Confirme o recebimento no banco e informe o identificador da transação Pix.'});
  const result=await rpc(s.token,b.action,{pack:b.pack,request_id:b.requestId,order_id:b.orderId,bank_reference:typeof b.bankReference==='string'?b.bankReference.trim():undefined,confirmed:b.confirmed});
  if(result.error)return reply(result.error==='forbidden'?403:result.error==='disabled'?503:409,{error:({forbidden:'Apenas o responsável autorizado pode aprovar pagamentos.',disabled:'A compra por Pix está sendo configurada. Não faça pagamentos ainda.',pending_limit:'Você já tem três pedidos pendentes. Consulte seus pedidos antes de criar outro.',expired:'Este pedido venceu. Crie um novo antes de pagar.',not_found:'Pedido não encontrado.',already_reviewed:'Este pedido já foi analisado.',duplicate_payment:'Esse identificador Pix já foi usado. Confira o extrato antes de continuar.',invalid:'Dados do pedido inválidos.'})[result.error]||'Não foi possível concluir esta ação.'});
  return reply(200,result);
 }catch{return reply(503,{error:'Não foi possível consultar os créditos. Tente novamente em instantes.'})}
};

'use strict';
// O assistente gratuito responde no navegador. Este endpoint encerra o fluxo
// antigo: nunca chama OpenAI, reserva créditos ou processa anexos.
exports.handler=async()=>({statusCode:410,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify({error:'O Mentor agora é gratuito e funciona no próprio aplicativo. Atualize a página para usar os atalhos e as respostas guiadas.'})});

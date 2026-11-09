const {test}=require('node:test'),assert=require('node:assert/strict');
const {handler}=require('../netlify/functions/mentor.cjs');
test('retired paid endpoint never calls a provider or debits credits',async()=>{
 process.env.OPENAI_API_KEY='test-key-must-not-be-used';process.env.RUMO_CREDIT_SERVER_TOKEN='test-credit-token-must-not-be-used';
 global.fetch=()=>{throw Error('A paid network request must never run')};
 for(const event of [{},{httpMethod:'POST',headers:{cookie:'__Host-rumo-access=test'},body:JSON.stringify({message:'Meu projeto',attachments:[]})},{httpMethod:'POST',body:'malformed'},{httpMethod:'GET'}]){
 const r=await handler(event);assert.equal(r.statusCode,410);assert.match(r.body,/gratuito/);assert.equal(JSON.parse(r.body).answer,undefined);assert.equal(r.body.includes(process.env.OPENAI_API_KEY),false);assert.equal(r.headers['Cache-Control'],'no-store');
 }
});

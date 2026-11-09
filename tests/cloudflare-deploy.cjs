'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {deploy,prepare}=require('../scripts/deploy-cloudflare.cjs');
test('publicação inclui apenas HTML e ícones permitidos, preservando a autenticação',async()=>{
 const prepared=prepare(),calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url.includes('assets-upload-session'))return Response.json({success:true,result:{jwt:'upload-example',buckets:[Object.keys(prepared.assets)]}});
  if(url.includes('/assets/upload'))return Response.json({success:true,result:{jwt:'completion-example'}},{status:201});
  return Response.json({success:true,result:{deployment_id:'test-deployment'}});
 };
 const result=await deploy({token:'test-only-not-a-credential',fetcher,prepared});
 assert.equal(result.deployment,'test-deployment');assert.equal(calls.length,3);
 assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body).manifest),['/index.html','/favicon.svg','/favicon.ico','/favicon-32x32.png','/apple-touch-icon.png']);
 assert.equal(calls[1].options.headers.Authorization,'Bearer upload-example');
 for(const [hash,asset] of Object.entries(prepared.assets)){const blob=calls[1].options.body.get(hash);assert.deepEqual(Buffer.from(await blob.text(),'base64'),asset.bytes);assert.equal(blob.type,asset.type);}
 const meta=JSON.parse(await calls[2].options.body.get('metadata').text());
 assert.equal(meta.assets.jwt,'completion-example');assert.equal(meta.assets.config.not_found_handling,'none');
 assert.deepEqual(meta.bindings.filter(x=>x.type==='inherit').map(x=>x.name),['APP_ORIGIN','APP_ADDITIONAL_ORIGIN','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY']);
 assert(!JSON.stringify(meta).includes('test-only-not-a-credential'));
 assert(calls[2].url.endsWith('?bindings_inherit=strict'));
});
test('arquivos já enviados reutilizam a confirmação e falha de upload não altera a versão ativa',async()=>{
 const prepared=prepare();let uploaded=0;
 await deploy({token:'test',prepared,fetcher:async(url)=>{
  if(url.includes('assets-upload-session'))return Response.json({result:{jwt:'done-example',buckets:[]},success:true});
  uploaded++;return Response.json({result:{deployment_id:'example'},success:true});
 }});assert.equal(uploaded,1);
 let mutations=0;
 await assert.rejects(deploy({token:'test',prepared,fetcher:async(url,options)=>{
  if(options.method==='PUT')mutations++;
  if(url.includes('assets-upload-session'))return Response.json({result:{jwt:'example',buckets:[Object.keys(prepared.assets)]},success:true});
  return Response.json({success:false,errors:[]},{status:403});
 }}),/HTTP 403/);assert.equal(mutations,0);
 await assert.rejects(deploy({prepared}),/TOKEN ausente/);
});

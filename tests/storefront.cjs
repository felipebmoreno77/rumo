const {JSDOM}=require('../../auth-test-deps/node_modules/jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../public/storefront.html','utf8');
const pause=()=>new Promise(r=>setTimeout(r,120));
async function boot(signed,state='ready',clipboardMode='missing'){
 let current=state,order=null;const calls=[],copied=[];
 const source=html.replace("location.assign(nextUrl)","window.nextApp=nextUrl");
 const dom=new JSDOM(source,{url:'https://rumo.example/?comprar=1',runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{};if(clipboardMode!=='missing')Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>{if(clipboardMode==='denied')throw new Error('Permissão negada');copied.push(value);}}});w.crypto.randomUUID=()=> '12345678-aaaa-1234-1234-123456789000';w.fetch=async(url,opts)=>{
  const b=JSON.parse(opts.body);calls.push(b);if(b.action==='session')return {ok:signed,status:signed?200:401,json:async()=>signed?{user:{id:'buyer',email:'buyer@example.com'}}:{error:'Entre'}};
  if(b.operation==='start')current='trial';
  if(b.operation==='create')order={id:'12345678-aaaa-1234-1234-123456789000',amountCents:1990,status:'pending'};
  if(b.operation==='report')order.status='reported';
  return {ok:true,json:async()=>({allowed:['trial','lifetime','admin'].includes(current),admin:current==='admin',state:current,serverNow:new Date().toISOString(),trialExpiresAt:new Date(Date.now()+86400000).toISOString(),amountCents:1990,recipient:'Felipe Barbanera Moreno',order,pix:order?{payload:'PIX-EXEMPLO',key:'0fa5908f-a977-4422-8ef4-f832ed3394ba',recipient:'Felipe Barbanera Moreno',reference:'RUMO12345678'}:null})};
 };}});await pause();return {dom,d:dom.window.document,calls,copied};
}
(async()=>{
 let {dom,d,calls}=await boot(false);assert(d.querySelector('#ra-form'));d.querySelector('[data-auth-mode=signup]').click();assert(d.querySelector('[name=passwordConfirm]'));assert.equal(d.querySelector('[name=password]').minLength,10);dom.window.close();
 ({dom,d,calls}=await boot(true));assert(!calls.some(x=>x.operation==='start'));assert.match(d.querySelector('.lp-page').textContent,/19,90/);
 d.querySelector('[data-license-action=enter]').click();await pause();assert(calls.some(x=>x.operation==='start'));assert.equal(dom.window.nextApp,'/app');dom.window.close();
 ({dom,d,calls}=await boot(true,'expired'));assert(!d.querySelector('[data-license-action=enter]'));d.querySelector('[data-license-action=create]').click();await pause();assert(d.querySelector('#lp-copy'));d.querySelector('[data-license-action=report]').click();await pause();assert.match(d.querySelector('.lp-page').textContent,/Seu Pix está em conferência/);assert(!d.querySelector('[data-license-action=enter]'));assert(!calls.some(x=>x.operation==='approve'));dom.window.close();
 ({dom,d,calls}=await boot(true,'lifetime'));assert(d.querySelector('[data-license-action=enter]'));assert(!d.querySelector('[data-license-action=create]'));dom.window.close();
 ({dom,d,calls}=await boot(true,'admin'));assert.match(d.querySelector('.lp-page').textContent,/isenta de pagamento/);assert.match(d.querySelector('.lp-page').textContent,/não precisa fazer o Pix/);assert(d.querySelector('[data-license-action=enter]'));assert(!d.querySelector('[data-license-action=create]'));assert(!d.querySelector('[data-license-action=report]'));assert(!calls.some(x=>['start','create','report'].includes(x.operation)));d.querySelector('[data-act=menu]').click();assert(d.querySelector('[data-act=checkout]'));dom.window.close();
 for(const mode of ['ok','denied','missing']){
  const preview=await boot(true,'expired',mode),doc=preview.d;doc.querySelector('[data-license-action=create]').click();await pause();
  assert.match(doc.querySelector('.lp-pix').textContent,/O Pix não leva o número do pedido/);
  doc.querySelector('[data-license-action=copy]').click();await pause();
  if(mode==='ok')assert.equal(preview.copied.at(-1),'PIX-EXEMPLO');else{assert.equal(doc.activeElement.id,'lp-copy');assert.equal(doc.activeElement.selectionEnd,doc.activeElement.value.length);}
  doc.querySelector('[data-license-action=copy-key]').click();await pause();
  if(mode==='ok')assert.equal(preview.copied.at(-1),'0fa5908f-a977-4422-8ef4-f832ed3394ba');else{assert.equal(doc.activeElement.id,'lp-key');assert.equal(doc.activeElement.selectionEnd,36);}
  assert.match(doc.querySelector('#lp-status').textContent,/19,90/);
  assert(!preview.calls.some(x=>['report','approve'].includes(x.operation)));preview.dom.window.close();
 }
 console.log('Compra: login, teste explícito, preço, bloqueio após expiração, Pix informado sem liberação e acesso vitalício OK.');
})();

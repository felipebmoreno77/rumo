const {JSDOM}=require('../../auth-test-deps/node_modules/jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../public/index.html','utf8');
const pause=()=>new Promise(r=>setTimeout(r,200));
async function boot(admin){const calls=[];const dom=new JSDOM(html,{url:'https://rumo.example',runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{};w.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);calls.push(b);if(b.action==='license')return {ok:true,json:async()=>({allowed:true,state:'lifetime'})};if(b.action==='session')return {ok:true,json:async()=>({user:{id:admin?'admin':'normal',email:'test@example.com'}})};let d={ok:true};if(b.operation==='access')d={admin};if(b.operation==='dashboard')d={accounts:12,newAccounts:2,confirmed:10,active:3,quizStarted:2,quizCompleted:1,tasksRegistered:5,tasksDone:4,weeks:0,ticketOpen:1,ticketTotal:1,whatsapp:1,feedback:{deepen:1},routes:[{route:'enterprise',users:2}],daily:[{date:'2026-11-09',signups:2,active:3}],reviewCount:1,rating:5,reviews:[{rating:5,comment:'<img src=x onerror=bad()>',created_at:'2026-11-09T12:00Z'}],tickets:[{id:'12345678-abcd-1234-1234-123456789000',email:'test@example.com',category:'map',message:'<script>bad()</script>',status:'open',created_at:'2026-11-09T12:00Z'}],collectionStarted:'2026-11-09T12:00Z',generatedAt:'2026-11-09T12:00Z'};if(b.operation==='ticket')d={ok:true,id:'12345678-test'};return {ok:true,json:async()=>d};};}});await pause();return {dom,calls,d:dom.window.document};}
(async()=>{
 let {dom,calls,d}=await boot(false);assert(!d.querySelector('[data-admin-nav]'));
 d.querySelector('[data-act=menu]').click();d.querySelector('[data-act=support]').click();
 assert(d.querySelector('[data-support-form]'));assert(d.querySelector('[data-review-form]'));
 const f=d.querySelector('[data-support-form]');f.querySelector('[name=message]').value='Preciso de ajuda com a tarefa';f.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await pause();assert.match(f.textContent,/12345678/);
 assert(calls.some(x=>x.operation==='ticket'&&x.data.message==='Preciso de ajuda com a tarefa'));dom.window.close();
 ({dom,calls,d}=await boot(true));d.querySelector('[data-admin-nav]').click();await pause();assert.equal(d.querySelectorAll('.ad-kpi').length,8);assert.match(d.querySelector('.ad-page').textContent,/12/);
 d.querySelector('[data-admin-tab=reviews]').click();assert(!d.querySelector('.ad-review img'));assert.match(d.querySelector('.ad-review').textContent,/<img/);
 d.querySelector('[data-admin-tab=support]').click();assert(!d.querySelector('.ad-ticket script'));
 const select=d.querySelector('[data-admin-ticket]');select.value='resolved';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await pause();assert(calls.some(x=>x.operation==='ticket_status'&&x.data.status==='resolved'));
 const days=d.querySelector('[data-admin-days]');days.value='7';days.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await pause();assert(calls.some(x=>x.operation==='dashboard'&&x.data.days===7));
 d.querySelector('[data-act=home]').click();d.querySelector('[data-act=menu]').click();d.querySelector('[data-auth-logout]').click();await pause();assert(!d.querySelector('[data-admin-nav]'));assert(!d.querySelector('.ad-page'));dom.window.close();
 console.log('Painel e formulários: autorização, navegação, filtros, XSS, atualização de status e limpeza no logout OK.');
})();

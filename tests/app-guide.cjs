const {JSDOM}=require('../../auth-test-deps/node_modules/jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const pause=()=>new Promise(r=>setTimeout(r,150)),account='guide-test';
async function boot(file='index.html',saved){
 const html=fs.readFileSync(__dirname+'/../public/'+file,'utf8').replace('location.assign(nextUrl)','window.nextApp=nextUrl');
 const dom=new JSDOM(html,{url:'https://rumo.example',runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{};if(saved)w.localStorage.setItem('rumo.account.v1.'+account,JSON.stringify(saved));w.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);return {ok:true,json:async()=>b.action==='license'?{state:'lifetime',allowed:true,amountCents:1990}:{user:{id:account,email:'guia@example.com'}}};};}});
 await pause();return dom;
}
function guide(d){d.querySelector('[data-act=menu]').click();assert(!d.querySelector('#rp-navigation').hidden);d.querySelector('#rp-navigation [data-act=guide]').click();assert(d.querySelector('.rg-guide'));assert(d.querySelector('#rp-navigation').hidden);}
(async()=>{
 let dom=await boot(),d=dom.window.document;guide(d);
 assert.equal(d.querySelectorAll('.rg-steps > li').length,6);assert.match(d.querySelector('.rg-resume').textContent,/Comece pelas 10 perguntas/);assert.equal(d.querySelector('#rp-navigation [data-act=guide]').getAttribute('aria-current'),'page');
 d.querySelector('.rg-resume [data-guide-step=question]').click();assert.match(d.querySelector('.rp-count').textContent,/1 de 10/);
 d.querySelector('[data-option="1"]').click();guide(d);assert.match(d.querySelector('.rg-resume').textContent,/1 de 10 perguntas/);d.querySelector('.rg-resume [data-guide-step=question]').click();assert.match(d.querySelector('.rp-count').textContent,/2 de 10/);
 for(let i=1;i<10;i++){d.querySelector('[data-option="1"]').click();d.querySelector('[data-act=next]').click();}
 guide(d);assert.match(d.querySelector('.rg-resume').textContent,/Seu mapa já está disponível/);d.querySelector('.rg-resume [data-guide-step=map]').click();assert.equal(d.querySelector('#rumo-app-preview').dataset.screen,'results');
 guide(d);d.querySelector('[data-guide-step=projects]').click();assert.equal(d.querySelector('#rumo-app-preview').dataset.screen,'projects');
 guide(d);d.querySelector('[data-guide-step=plan]').click();assert.equal(d.querySelector('#rumo-app-preview').dataset.screen,'routines');d.querySelector('[data-route=research]').click();guide(d);assert.match(d.querySelector('.rg-resume').textContent,/0 de 7 dias/);d.querySelector('.rg-resume [data-guide-step=plan]').click();assert.equal(d.querySelector('#rumo-app-preview').dataset.screen,'routine');
 guide(d);d.querySelector('[data-guide-step=creations]').click();assert.equal(d.querySelector('#rumo-app-preview').dataset.screen,'creations');
 guide(d);d.querySelector('[data-guide-step=passport]').click();assert.equal(d.querySelector('#rumo-app-preview').dataset.screen,'passport');
 guide(d);d.querySelector('.rg-extra [data-mentor-open]').click();assert(d.querySelector('.ma-context'));
 guide(d);d.querySelector('.rg-extra [data-act=duo]').click();assert.equal(d.querySelector('#rumo-app-preview').dataset.screen,'duo');
 await pause();const saved=JSON.parse(dom.window.localStorage.getItem('rumo.account.v1.'+account));assert.equal(saved.answers.filter(a=>a!==null).length,10);dom.window.close();
 saved.routineState.research.days.slice(0,7).forEach((day,i)=>Object.assign(day,{registered:true,mood:'liked',taskResponse:'Meu registro '+i}));
 dom=await boot('index.html',saved);d=dom.window.document;guide(d);assert.match(d.querySelector('.rg-resume').textContent,/7 de 7 dias/);assert.match(d.querySelector('.rg-resume h2').textContent,/primeira semana está registrada/);d.querySelector('.rg-resume [data-guide-step=passport]').click();assert.match(d.querySelector('.rp-pass-history').textContent,/Meu registro 0/);dom.window.close();
 dom=await boot('storefront.html');d=dom.window.document;guide(d);assert.equal(d.querySelectorAll('.rg-steps > li').length,6);assert.equal(d.querySelectorAll('[data-guide-step]').length,0);d.querySelector('.rg-resume [data-act=start]').click();await pause();assert.equal(dom.window.nextApp,'/app#question');dom.window.close();
 console.log('Guia: menu, seis etapas, retomada real, atalhos, proteção do progresso e vitrine OK.');
})().catch(e=>{console.error(e);process.exitCode=1});

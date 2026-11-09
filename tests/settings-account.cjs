const {JSDOM}=require('../../auth-test-deps/node_modules/jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{for(const fail of [false,true]){let logoutRequests=0;
const dom=new JSDOM(fs.readFileSync(__dirname+'/../public/index.html','utf8'),{url:'https://rumo.example',runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{};w.fetch=async(_,opts)=>{const b=JSON.parse(opts.body);if(b.action==='license')return {ok:true,json:async()=>({allowed:true,state:'lifetime'})};if(b.action==='logout'){logoutRequests++;return {ok:!fail,json:async()=>fail?{error:'Não foi possível sair agora.'}:{}}}return {ok:true,json:async()=>({user:{id:'settings-test',email:'pessoa@example.com'}})}}}});
await new Promise(r=>setTimeout(r,100));const d=dom.window.document;
d.querySelector('[data-rumo-settings]').click();assert.equal(d.querySelector('.ts-account dd').textContent,'pessoa@example.com');assert.equal(d.querySelector('input[type=password]'),null);
const logout=d.querySelector('.ts-account [data-auth-logout]');logout.click();assert.equal(logout.disabled,true);logout.click();await new Promise(r=>setTimeout(r,30));assert.equal(logoutRequests,1);
if(fail){assert.match(d.querySelector('#ts-account-status').textContent,/Não foi possível/);assert.equal(logout.disabled,false);assert.equal(d.querySelector('.ts-account dd').textContent,'pessoa@example.com');}
else{assert.ok(d.querySelector('.home-hero'));assert.equal(d.body.textContent.includes('pessoa@example.com'),false);d.querySelector('[data-act=menu]').click();assert.ok(d.querySelector('#ra-form'));assert.equal(d.querySelector('#rp-navigation').hidden,true);}
dom.window.close();}
console.log('Configurações: e-mail conectado, logout único, bloqueio após sair e recuperação de falha OK.');})();

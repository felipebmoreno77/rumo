const {JSDOM}=require('../../auth-test-deps/node_modules/jsdom');const {readFileSync}=require('node:fs');const assert=require('node:assert/strict');
const html=readFileSync(__dirname+'/../public/index.html','utf8');
(async()=>{
const dom=new JSDOM(html,{url:'https://rumo.example',runScripts:'dangerously',beforeParse(w){w.fetch=async()=>({ok:false,json:async()=>({error:'Not connected'})});w.scrollTo=()=>{}}});
await new Promise(r=>setTimeout(r,100));const d=dom.window.document;
assert.ok(d.querySelector('.home-hero'));assert.equal(d.querySelector('video'),null);
const controls=[...d.querySelectorAll('button:not([data-act="home"]):not([disabled])')].map(el=>[...el.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value]));
let checked=0;
for(const attrs of controls){
 const b=[...d.querySelectorAll('button')].find(b=>attrs.length&&attrs.every(([n,v])=>b.getAttribute(n)===v));if(!b)continue;
 b.click();assert.ok(d.querySelector('#ra-form'),'protected button should show login');assert.equal(d.querySelector('#rp-navigation').hidden,true);checked++;
 d.querySelector('[data-auth-mode="home"]').click();
}
assert.ok(checked>=3);
d.querySelector('[data-act="menu"]').click();d.querySelector('[data-auth-mode="signup"]').click();assert.equal(d.querySelector('[name=password]').minLength,10);assert.ok(d.querySelector('[name=passwordConfirm]'));assert.ok(d.querySelector('[data-password-toggle]'));
const pw=d.querySelector('[name=password]'),confirm=d.querySelector('[name=passwordConfirm]');pw.value='abcdefghij';confirm.value='different1';
const toggle=d.querySelector('[data-password-toggle]');toggle.click();assert.equal(pw.type,'text');toggle.click();assert.equal(pw.type,'password');
const form=d.querySelector('#ra-form');form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
assert.match(d.querySelector('#ra-status').textContent,/não coincidem/);assert.equal(form.querySelector('[type=submit]').disabled,false);assert.equal(pw.value,'abcdefghij');
console.log('Gate checks passed:',checked,'entry points; signup password policy; no video.');dom.window.close();
})();

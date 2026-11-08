const {JSDOM}=require('../../auth-test-deps/node_modules/jsdom');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{let failed=false,sent;
const dom = new JSDOM(fs.readFileSync(__dirname+'/../public/index.html','utf8'), {
  url:'https://rumo.example', runScripts:'dangerously',
  beforeParse(w) {
    w.scrollTo=()=>{};
    w.fetch=async(url,opts)=>{
      if(url.includes('/mentor')) {
        sent=JSON.parse(opts.body);
        return {ok:!failed,json:async()=>failed?{error:'Serviço indisponível'}:{answer:'Ajuste a abertura do projeto.'}};
      }
      return {ok:true,json:async()=>({user:{id:'test-user',email:'test@example.com'}})};
    };
  }
});
await new Promise(r=>setTimeout(r,100));const w=dom.window,d=w.document;
d.querySelector('[data-mentor-open]').click();assert.ok(d.querySelector('#ma-draft'));
function draft(text){const input=d.querySelector('#ma-draft');input.value=text;input.dispatchEvent(new w.Event('input',{bubbles:true}))}
draft('Meu projeto é um vídeo de música');d.querySelector('[data-mentor-action=send]').click();assert.equal(d.querySelector('[data-mentor-action=send]').disabled,true);
await new Promise(r=>setTimeout(r,30));assert.equal(sent.message,'Meu projeto é um vídeo de música');assert.match(d.querySelector('.ma-assistant').textContent,/Ajuste a abertura/);assert.doesNotMatch(d.querySelector('.ma-assistant').textContent,/exemplo demonstrativo/);
const ctx=d.querySelector('[data-mentor-context]');ctx.checked=false;ctx.dispatchEvent(new w.Event('change',{bubbles:true}));failed=true;draft('Uma nova pergunta');d.querySelector('[data-mentor-action=send]').click();await new Promise(r=>setTimeout(r,30));assert.equal(sent.context,null);assert.equal(d.querySelector('#ma-draft').value,'Uma nova pergunta');assert.match(d.querySelector('.ma-status').textContent,/indisponível/);assert.equal(d.querySelectorAll('.ma-assistant').length,1);
console.log('Mentor UI: envio, resposta, contexto opcional, carregamento e recuperação de erro OK.');dom.window.close();})();

const {JSDOM}=require('../../auth-test-deps/node_modules/jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../public/index.html','utf8');
const key='rumo.account.v1.task-record-test';
const pause=()=>new Promise(r=>setTimeout(r,250));
async function boot(saved){const dom=new JSDOM(html,{url:'https://rumo.example',runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{};if(saved)w.localStorage.setItem(key,JSON.stringify(saved));w.fetch=async(url,options)=>JSON.parse(options.body).action==='license'?({ok:true,json:async()=>({allowed:true,state:'lifetime'})}):({ok:true,json:async()=>({user:{id:'task-record-test',email:'teste@example.com'}})});}});await pause();return dom;}
function input(dom,selector,text){const el=dom.window.document.querySelector(selector);assert.ok(el,selector);el.value=text;el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));}
function plan(d,k){d.querySelector('[data-act=routines]').click();d.querySelector('[data-route='+k+']').click();}
(async()=>{
 const legacy={version:2,mapVersion:'balanced-2026-11-v1',answers:Array(10).fill(1),activeRoute:'creative',routeChosen:true,routineState:{creative:{days:Array.from({length:14},(_,i)=>({registered:i<7,mood:i<7?'liked':'',note:'Reflexão antiga '+i})),openDay:0}},youth:{}};
 let dom=await boot(legacy),d=dom.window.document;
 plan(d,'creative');assert.equal(d.querySelector('[data-day-task-response="0"]').value,'');assert.equal(d.querySelector('[data-day-note="0"]').value,'Reflexão antiga 0');
 const text='Título do projeto\n<img src=x onerror="alert(1)"> & ideias para testar';
 input(dom,'[data-day-task-response="0"]',text);await pause();
 d.querySelector('[data-mood-choice="0"][data-mood-value=mixed]').click();assert.equal(d.querySelector('[data-day-task-response="0"]').value,text);
 input(dom,'[data-day-note="0"]','Gostei de revisar.');d.querySelector('[data-register-day="0"]').click();
 // Conteúdo do trabalho e reflexão permanecem independentes e escapados no histórico.
 d.querySelector('[data-act=passport]').click();assert.match(d.querySelector('.rp-pass-history').textContent,/Título do projeto/);assert.equal(d.querySelector('.rp-pass-history img'),null);
 d.querySelector('[data-up-panel=save]').click();d.querySelector('[data-up-copy]').click();assert.match(d.querySelector('#up-copy').value,/Registro da tarefa: Título do projeto/);assert.match(d.querySelector('#up-copy').value,/O que percebi: Gostei de revisar/);
 await pause();let saved=JSON.parse(dom.window.localStorage.getItem(key));assert.equal(saved.routineState.creative.days[0].taskResponse,text);
 dom.window.close();dom=await boot(saved);d=dom.window.document;plan(d,'creative');assert.equal(d.querySelector('[data-day-task-response="0"]').value,text);assert.equal(d.querySelector('[data-day-note="0"]').value,'Gostei de revisar.');
 // Todos os nove caminhos têm os sete campos e não compartilham respostas.
 d.querySelector('[data-act=routines]').click();const routes=[...d.querySelectorAll('.up-path-grid [data-route]')].map(x=>x.dataset.route);assert.equal(routes.length,9);
 for(const route of routes){plan(d,route);assert.equal(d.querySelectorAll('[data-day-task-response]').length,7);if(route!=='creative')assert.equal(d.querySelector('[data-day-task-response="0"]').value,'');}
 // Tela diária usa o mesmo registro que o plano completo.
 plan(d,'research');d.querySelector('[data-act=home]').click();d.querySelector('[data-daily=start]').click();assert.ok(d.querySelector('.rd-record [data-day-task-response="0"]'));
 input(dom,'[data-day-task-response="0"]','Comparei duas maneiras de organizar minhas notas.');
 d.querySelector('[data-mood-choice="0"][data-mood-value=notdone]').click();assert.equal(d.querySelector('[data-day-task-response="0"]').value,'Comparei duas maneiras de organizar minhas notas.');
 d.querySelector('[data-register-day="0"]').click();assert.ok(d.querySelector('[data-daily=edit-record]'));d.querySelector('[data-daily=edit-record]').click();assert.equal(d.querySelector('[data-day-task-response="0"]').value,'Comparei duas maneiras de organizar minhas notas.');
 dom.window.close();
 // A revisão do mapa não apaga experiências nem interpreta índices antigos como respostas novas.
 const old=JSON.parse(JSON.stringify(saved));delete old.mapVersion;
 dom=await boot(old);d=dom.window.document;assert.match(d.body.textContent,/Quatro perguntas novas/);
 let migrated=JSON.parse(dom.window.localStorage.getItem(key));for(const i of [0,2,3,7])assert.equal(migrated.answers[i],null);
 for(const i of [1,4,5,6,8,9])assert.equal(migrated.answers[i],old.answers[i]);
 assert.equal(migrated.routineState.creative.days[0].taskResponse,text);assert.equal(migrated.routineState.creative.days[0].registered,true);
 d.querySelector('[data-act=question]').click();d.querySelector('[data-option=0]').click();await pause();migrated=JSON.parse(dom.window.localStorage.getItem(key));assert.equal(migrated.answers[0],0);
 dom.window.close();dom=await boot(migrated);await pause();assert.equal(JSON.parse(dom.window.localStorage.getItem(key)).answers[0],0);dom.window.close();
 console.log('Registros de tarefas: nove caminhos, tela diária/plano, rascunhos, recarga, histórico, exportação e compatibilidade antiga OK.');
})().catch(e=>{console.error(e);process.exitCode=1});

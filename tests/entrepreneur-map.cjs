const {JSDOM}=require('../../auth-test-deps/node_modules/jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const s=fs.readFileSync(__dirname+'/../public/index.html','utf8').replace('void initAuth();','window.testModel={questions,getProfile,routes};');
const dom=new JSDOM(s,{url:'https://rumo.example',runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{}}});
const {questions,getProfile}=dom.window.testModel;
try{
 assert.equal(questions.length,10);questions.forEach(q=>assert.equal(q.options.length,5));
 const values=(a,b,c)=>{const v=Array(10).fill(-1);v[0]=a;v[3]=b;v[7]=c;return v};
 // As três respostas de negócio antes empatavam em 6 a 6 com gestão.
 const business=values(2,1,4),p=getProfile(business);assert.equal(p.top,'enterprise');assert(p.clear);assert(p.scores.enterprise>p.scores.team);
 const rich=business.slice();rich[2]=1;rich[5]=0;rich[6]=2;const r=getProfile(rich);assert.equal(r.top,'enterprise');assert.equal(r.scores.enterprise-p.scores.enterprise,2);
 assert(r.evidence.enterprise.some(x=>/clientes|público/.test(x.text)));
 // Dinheiro, apoio e liberdade, sozinhos, não são evidências de negócio.
 const onlyStyle=Array(10).fill(-1);onlyStyle[1]=0;onlyStyle[4]=1;onlyStyle[5]=1;onlyStyle[8]=2;onlyStyle[9]=1;
 const style=getProfile(onlyStyle);assert.equal(style.scores.enterprise,0);assert.equal(style.clear,false);
 for(let i=0;i<5;i++){const v=rich.slice();v[8]=i;v[9]=i;assert.deepEqual(JSON.stringify(getProfile(v).scores),JSON.stringify(r.scores));}
 const cases=[['creative',values(0,0,1)],['research',values(1,3,0)],['build',values(-1,2,2)],['freelance',values(4,0,1)],['nature',values(1,3,3)]];
 for(const [route,v] of cases){assert.equal(getProfile(v).top,route,route);const withOneBusiness=v.slice();withOneBusiness[6]=2;assert.equal(getProfile(withOneBusiness).top,route,route+' após um sinal isolado de negócio');}
 const empty=getProfile(Array(10).fill(null));assert.equal(empty.clear,false);assert.equal(empty.enough,false);assert(Object.values(empty.scores).every(x=>x===0));
 for(let n=0;n<5000;n++){const v=Array.from({length:10},()=>Math.floor(Math.random()*6)-1);const p=getProfile(v);assert(Object.values(p.scores).every(Number.isFinite));for(const k of Object.keys(p.scores)){assert.equal(p.evidence[k].reduce((sum,e)=>sum+e.weight,0),p.scores[k]);}}
 console.log('Mapa: negócio próprio reconhecido, complementos limitados, contexto sem penalização, perfis distintos e 5.000 combinações consistentes.');
}finally{dom.window.close()}

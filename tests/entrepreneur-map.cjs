const {JSDOM}=require('../../auth-test-deps/node_modules/jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const s=fs.readFileSync(__dirname+'/../public/index.html','utf8').replace('void initAuth();','window.testModel={questions,getProfile,routes,MAP_VERSION,MAP_INTEREST_INDICES};');
const dom=new JSDOM(s,{url:'https://rumo.example',runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{}}});
const {questions,getProfile,routes,MAP_INTEREST_INDICES}=dom.window.testModel;
try{
 const keys=Object.keys(routes);assert.equal(questions.length,10);questions.forEach(q=>assert.equal(q.options.length,5));assert.equal(keys.length,9);
 for(const i of MAP_INTEREST_INDICES)for(const k of keys){const options=questions[i].options.filter(o=>o.signals[k]);assert.equal(options.length,1,k+' na pergunta '+i);assert.equal(options[0].signals[k],2);}
 const histogram=Object.fromEntries(keys.map(k=>[k,Array(9).fill(0)])),unique=Object.fromEntries(keys.map(k=>[k,0])),highlight=Object.fromEntries(keys.map(k=>[k,0]));let cases=0;
 function audit(n,v){if(n<4){for(let a=-1;a<5;a++){v[MAP_INTEREST_INDICES[n]]=a;audit(n+1,v)}return;}
  cases++;const p=getProfile(v),max=Math.max(...Object.values(p.scores)),leaders=keys.filter(k=>p.scores[k]===max);
  for(const k of keys){histogram[k][p.scores[k]]++;assert.equal(p.scores[k],p.evidence[k].reduce((a,e)=>a+e.weight,0));}
  if(leaders.length===1)unique[leaders[0]]++;if(p.clear){assert.equal(leaders.length,1);highlight[p.top]++;}
 }
 audit(0,Array(10).fill(-1));assert.equal(cases,1296);
 for(const k of keys){assert.deepEqual(histogram[k],histogram[keys[0]],'Distribuição de pontos diferente: '+k);assert(unique[k]>0,k+' não consegue liderar');assert(highlight[k]>0,k+' não consegue ser destacado');
  const v=Array(10).fill(-1);for(const i of MAP_INTEREST_INDICES)v[i]=questions[i].options.findIndex(o=>o.signals[k]);const p=getProfile(v);assert.equal(p.scores[k],8);assert.equal(p.top,k);assert.equal(p.clear,true);assert.equal(p.evidence[k].length,4);
  // Todas as respostas de contexto podem mudar, sem aumentar/reduzir a indicação.
  for(let a=-1;a<5;a++){const changed=v.map((x,i)=>MAP_INTEREST_INDICES.includes(i)?x:a);assert.equal(JSON.stringify(getProfile(changed).scores),JSON.stringify(p.scores));}
 }
 const none=getProfile(Array(10).fill(null));assert.equal(none.clear,false);assert.equal(none.enough,false);assert(Object.values(none.scores).every(v=>v===0));
 const single=Array(10).fill(-1);single[0]=0;assert.equal(getProfile(single).clear,false);
 console.log(JSON.stringify({combinations:cases,maxForEveryPath:8,equalScoreHistograms:true,allNineCanLead:true,allNineCanBeHighlighted:true,unique,highlight}));
}finally{dom.window.close()}

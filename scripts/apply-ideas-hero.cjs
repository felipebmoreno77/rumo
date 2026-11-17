const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const art=fs.readFileSync(path.join(root,'design/hero-ideas.html'),'utf8').trim();
for(const name of ['public/index.html','public/storefront.html']){
 const file=path.join(root,name);let html=fs.readFileSync(file,'utf8');
 const start=html.indexOf('<div class="r3-phones"');
 const end=html.indexOf('<section id="how"',start);
 if(start<0||end<0)throw new Error('Hero esperado não encontrado em '+name);
 html=html.slice(0,start)+art+'</div>'+html.slice(end);
 fs.writeFileSync(file,html);
}

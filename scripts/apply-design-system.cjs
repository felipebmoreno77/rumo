const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const css=fs.readFileSync(path.join(root,'design/rumo-design-system.css'),'utf8');
for(const file of ['public/index.html','public/storefront.html']){
 const location=path.join(root,file);let html=fs.readFileSync(location,'utf8');
 html=html.replace(/<style id="rumo-full-design">[\s\S]*?<\/style>\n?/,'');
 const at=html.lastIndexOf('</style>')+'</style>'.length;
 html=html.slice(0,at)+'\n<style id="rumo-full-design">\n'+css+'\n</style>'+html.slice(at);
 html=html.replace('<button class="rp-logo-button" data-act="home" aria-label="Rumo, página inicial"><span class="rp-logo">','<button class="rp-logo-button" data-act="home" aria-label="Rumo, página inicial"><span class="r4-brand-symbol" aria-hidden="true"><i data-lucide="move-up-right"></i></span><span class="rp-logo">');
 fs.writeFileSync(location,html);
}

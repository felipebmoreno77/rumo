'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),out=path.join(root,'cloudflare-dist');
const auth=fs.readFileSync(path.join(root,'netlify/functions/auth.cjs'),'utf8');
// Núcleo sem dependências Node. O empacotamento copia o código estático; não usa eval em runtime.
if(/\brequire\s*\(/.test(auth))throw Error('O núcleo Auth ganhou uma dependência que precisa ser adaptada para Cloudflare.');
new vm.Script(auth);
const adapter=fs.readFileSync(path.join(root,'cloudflare/worker.mjs'),'utf8');
const worker=adapter+'\nconst authModule=(()=>{const exports={};\n'+auth+'\nreturn exports;})();\nexport default createRumoWorker(authModule.createAuthHandler);\n';
fs.mkdirSync(out,{recursive:true});
// Limpa apenas a pasta gerada fixa do projeto, antes de copiar os arquivos públicos.
for(const name of fs.readdirSync(out))fs.rmSync(path.join(out,name),{recursive:true,force:true});
fs.cpSync(path.join(root,'public'),out,{recursive:true});
const html=fs.readFileSync(path.join(out,'index.html'),'utf8');
fs.writeFileSync(path.join(out,'index.html'),html.replaceAll('/.netlify/functions/auth','/api/auth'));
fs.writeFileSync(path.join(out,'_worker.js'),worker);
fs.writeFileSync(path.join(out,'_routes.json'),JSON.stringify({version:1,include:['/api/*','/.netlify/functions/*'],exclude:[]},null,2)+'\n');
fs.copyFileSync(path.join(root,'cloudflare/_headers'),path.join(out,'_headers'));
console.log('Cloudflare: arquivos públicos e autenticação preparados em cloudflare-dist.');

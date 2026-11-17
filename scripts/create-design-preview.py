from pathlib import Path
import re

project=Path(__file__).resolve().parents[1]
source=(project/'public/index.html').read_text()
scripts=list(re.finditer(r'<script[^>]*>([\s\S]*?)</script>',source))
main=scripts[-1].group(1)
a=main.index('async function authCall(')
b=main.index('\nfunction authView()',a)
main=main[:a]+'''async function authCall(action,data={}){
 if(action==='session')return {user:{id:'rumo-design-demo',email:'previa@exemplo.com'}};
 if(action==='license')return {allowed:true,state:'lifetime',admin:false,amountCents:1990};
 if(action==='portal'&&data.operation==='access')return {admin:false};
 if(action==='portal'&&['ticket','review'].includes(data.operation))throw new Error('Prévia: nenhum pedido ou avaliação foi enviado.');
 if(action==='portal'||action==='logout')return {ok:true};
 throw new Error('Esta prévia usa uma conta de exemplo. Nenhum dado é enviado.');
}'''+main[b:]
a=main.index('async function bootHostedApp()')
b=main.index('\nfunction saveRumoTheme()',a)
main=main[:a]+"async function bootHostedApp(){hostingReady=false;catalogue=false;view='home';render();}\n"+main[b:]
main=re.sub(r'function saveRumoTheme\(\)\{[^\n]*\}','function saveRumoTheme(){}',main)
main=main.replace("try{applyRumoTheme(localStorage.getItem('rumo.appearance'))}catch{applyRumoTheme('dark')}","applyRumoTheme('dark');")
main=main.replace("window.scrollTo({top:0,behavior:'instant'});","root.scrollIntoView({block:'start',behavior:'auto'});")
a=main.index('function mentorVoice(')
b=main.index('\nroot.addEventListener',a)
main=main[:a]+"function mentorVoice(){live.textContent='Prévia: use o campo de texto para conversar com o Mentor.';}\n"+main[b:]
# Demonstrate access without copying a bank code, initiating a payment, or leaving the preview.
hook='''root.addEventListener('click',e=>{
 const a=e.target.closest('a[href]');if(!a)return;
 const href=a.getAttribute('href')||'';
 if(href.includes('comprar=1')){
  e.preventDefault();closeMenu();view='previewAccess';root.dataset.screen=view;
  stage.innerHTML='<section class="lp-page"><button class="rp-home-back" data-act="home">← Voltar ao início</button><div class="lp-head"><span class="rp-overline">SEU ACESSO</span><h1>Seu próximo capítulo.<br><em>Sem mensalidade.</em></h1><p>Experimente por 24 horas. Depois, continue se fizer sentido para você.</p></div><article class="lp-offer"><span class="lp-label">RUMO · ACESSO VITALÍCIO</span><div class="lp-price"><small>R$</small>19,90</div><span class="lp-once">Pagamento único por Pix</span><ul class="lp-benefits"><li>Questionário solo e em dupla</li><li>Mapa com nove caminhos</li><li>Planos de sete dias e continuação</li><li>Projetos, registros e Passaporte</li><li>Mentor guiado incluído</li></ul><div class="lp-state"><strong>Prévia do novo design</strong>Nenhum pagamento é realizado aqui.</div><button class="rp-button" data-act="home">Continuar explorando ↗</button></article></section>';
  root.scrollIntoView({block:'start',behavior:'auto'});
 }else if(/^(https?:|mailto:|tel:)/.test(href)){
  e.preventDefault();live.textContent='Prévia: nenhum contato ou envio foi realizado.';
 }
},true);
'''
main=main.replace('void initAuth();',hook+'\nvoid initAuth();')
fragment=re.sub(r'<script[^>]*>[\s\S]*?</script>','',source)
fragment=re.sub(r'<!doctype[^>]*>|</?(?:html|head|body)\b[^>]*>|<meta\b[^>]*>|<link\b[^>]*>|<title>[\s\S]*?</title>','',fragment,flags=re.I)
fragment=re.sub(r'(?:html|body)(?::has\([^{}]*\))?\s*(?:,\s*(?:html|body)(?::has\([^{}]*\))?\s*)*\{[^{}]*\}','',fragment)
fragment=fragment.replace('rumo-app-preview','rumo-design-preview')
main=main.replace('rumo-app-preview','rumo-design-preview')
fragment=re.sub(r'@media\s*(\(\s*max-width\s*:)',r'@container \1',fragment)
fragment=re.sub(r'@media\s*(\(\s*min-width\s*:)',r'@container \1',fragment)
extra='''
#rumo-design-preview-wrap{width:100%;container-type:inline-size;background:transparent}
#rumo-design-preview{position:relative;width:100%;max-width:100%;min-height:0;border:0;border-radius:0}
#rumo-design-preview .rp-main,#rumo-design-preview .rp-stage{min-width:0;max-width:100%;min-height:0;overflow-wrap:break-word}
#rumo-design-preview .rp-header{padding-right:100px}
#rumo-design-preview .rp-menu-shade{position:absolute;inset:0;min-height:100%}
#rumo-design-preview .rp-menu.rp-side-drawer{position:absolute;inset:0 auto auto 0;height:auto;max-height:none;min-height:100%;overflow:visible}
#rumo-design-preview:has(>.rp-menu:not([hidden])){min-height:1550px}
#rumo-design-preview .ma-chat{height:auto;max-height:none;overflow:visible}
#rumo-design-preview .mf-page .ma-log{height:auto;max-height:none;overflow:visible;flex:none}
#rumo-design-preview :is(button,a,summary){cursor:var(--cursor-interaction,auto)}
@container(max-width:760px){#rumo-design-preview .rp-home-status{display:none}}
@container(max-width:500px){#rumo-design-preview .rp-main,#rumo-design-preview[data-theme] .rp-main{padding-inline:24px}#rumo-design-preview .rp-header,#rumo-design-preview[data-theme] .rp-header{padding-left:24px;padding-right:100px}}
'''
output='<div id="rumo-design-preview-wrap">\n'+fragment+'\n<style>\n'+extra+'\n</style>\n<script>\n'+main+'\n</script>\n</div>\n'
assert 'fetch(' not in output and 'XMLHttpRequest' not in output and 'WebSocket' not in output
assert len(output.encode())<1000000
assert '\\"' not in output[:500]
Path('/workspace/rumo-ideias-preview.html').write_text(output)
qa=Path('/workspace/scratch/dac6757147c8/mobile-preview/dist')
qa.mkdir(parents=True,exist_ok=True)
(qa/'rumo-full-fragment.html').write_text(output)
# Same fragment and production icon bundle for visual QA outside the conversation.
standalone='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rumo · novo design</title><style>body{margin:0;background:#0c1010}</style></head><body><script>'+scripts[0].group(1)+'</script>'+output+'</body></html>'
(qa/'rumo-full.html').write_text(standalone)
(qa/'rumo-full-mobile.html').write_text('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rumo · celular</title><style>body{margin:0;background:#252c28}iframe{display:block;width:393px;max-width:100vw;height:900px;margin:auto;border:0}</style></head><body><iframe src="rumo-full.html" title="Rumo no celular"></iframe></body></html>')
print({'bytes':len(output.encode()),'path':'/workspace/rumo-ideias-preview.html'})

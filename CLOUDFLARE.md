# Publicação ativa: Cloudflare Workers

O projeto `rumo` usa Workers com Static Assets, ligado a `felipebmoreno77/rumo`, branch `main`.
Endereço: https://rumo.felipebmoreno.workers.dev/

Configuração de produção no Workers Builds:

- Build: `node scripts/build-cloudflare.cjs`
- Deploy: `node scripts/deploy-cloudflare.cjs`
- Diretório: `/`
- Token: o token de build já gerenciado pela Cloudflare, em `CLOUDFLARE_API_TOKEN`.

O deploy usa a API oficial com Node 22 ou mais recente, sem instalação de pacotes. Envia `index.html` e os quatro ícones explicitamente permitidos como arquivos públicos e o módulo de servidor como código do Worker. Reutiliza as quatro configurações existentes de autenticação com `inherit` e falha se alguma estiver ausente; não grava credenciais no GitHub. Não usa OpenAI, pagamentos ou chaves administrativas do Supabase.

As variáveis de runtime `APP_ORIGIN`, `APP_ADDITIONAL_ORIGIN`, `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` ficam no Worker. Não confundir com variáveis de build. `APP_ORIGIN` deve corresponder exatamente à origem HTTPS do app. Os links antigos e o DNS continuam independentes desta publicação.

As instruções abaixo são uma alternativa para **Cloudflare Pages**, não a configuração do Worker ativo. O ZIP preparado anteriormente é específico para Pages; não deve ser usado como substituto da publicação automática do Worker.

## Domínio próprio preparado

O domínio `rumolearn.com.br` foi associado ao Worker e a zona Cloudflare criada no plano Free. A ativação depende da delegação DNS no registrador; o cadastro do domínio na Cloudflare não conclui essa delegação. Servidores atribuídos: `eugene.ns.cloudflare.com` e `lila.ns.cloudflare.com`.

Foram copiados os registros TXT de DKIM/DMARC e CNAME de `send`/`rsend` do Resend, sem proxy. Nenhum segredo de envio foi copiado.

`APP_ORIGIN` mantém a origem workers.dev atual; `APP_ADDITIONAL_ORIGIN` autoriza somente `https://rumolearn.com.br`. O Worker exige que Origin e URL da requisição sejam iguais e estejam nessa lista explícita. Assim o login do endereço antigo continua disponível durante a propagação. Não há curingas nem compartilhamento de cookies entre domínios.


---

# Publicar o Rumo na Cloudflare Pages

Esta versão inclui o Mentor gratuito e o mesmo núcleo de autenticação usado na Netlify. O código está preparado para Cloudflare Pages, mas a publicação e os testes reais de login/e-mail ainda precisam ser concluídos na conta Cloudflare escolhida. O endereço anterior não foi trocado.

## Configurações do projeto

| Campo | Valor |
| --- | --- |
| Produto | Pages, com integração Git |
| Repositório | felipebmoreno77/rumo |
| Branch de produção | main |
| Framework preset | None |
| Build command | node scripts/build-cloudflare.cjs |
| Build output directory | cloudflare-dist |
| Root directory | Raiz do repositório |
| NODE_VERSION | 22 |

O build não instala dependências de terceiros. Ele prepara o HTML, o Worker de autenticação, as rotas e os cabeçalhos de segurança. A conversa do Mentor continua no navegador, sem OpenAI ou créditos.

## Variáveis de produção

Cadastre no painel da Cloudflare em Production:

- `APP_ORIGIN`: o endereço HTTPS principal escolhido para o app, sem barra final. Copie o endereço real fornecido pela publicação; não invente um subdomínio.
- `SUPABASE_URL`: a URL do projeto Supabase atual.
- `SUPABASE_PUBLISHABLE_KEY`: a chave publicável do mesmo projeto; nunca usar `service_role`.

Não é preciso copiar chaves OpenAI, Resend ou o segredo antigo de créditos para esta hospedagem. O envio de e-mails continua pelo SMTP configurado no Supabase. A chave Resend permanece nessa configuração.

Mantenha os valores reais fora do repositório e do ZIP. O exemplo `cloudflare.env.example` contém apenas espaços para configuração. Não configure os valores de produção em previews de branches externas. Configure a origem específica de cada ambiente aprovado quando precisar testar login em previews.

Sem as variáveis corretas, o app bloqueia o login. Depois de alterar variáveis no painel, publique novamente e valide o endereço principal. A origem exata é necessária para manter a proteção contra solicitações de outros sites.

## Publicação pela interface

1. Entre na sua conta Cloudflare e abra Workers & Pages → Create application → Pages → Connect to Git.
2. Conecte o GitHub e permita acesso apenas ao repositório rumo. A autorização da conta precisa ser concluída por você quando solicitada.
3. Preencha os campos da tabela e inicie a publicação. O nome escolhido será usado para o endereço inicial do projeto.
4. Copie o endereço HTTPS gerado, configure as três variáveis de produção e publique novamente.
5. Teste cadastro, recebimento do código, confirmação de seis dígitos, entrada, recuperação, troca de senha e saída. Confirme o Mentor gratuito e os bloqueios de acesso sem sessão.

O projeto usa Functions em modo avançado (`_worker.js`). Não arraste apenas o HTML ou o ZIP no upload de arquivos estáticos da interface: isso pode deixar o backend de login de fora. Use a integração Git ou a CLI oficial com suporte a Functions.

## Conexões preservadas

- GitHub: fonte e atualizações automáticas.
- Supabase: mesmos usuários, senhas e políticas; não criar outro projeto para migrar.
- Resend: SMTP do Supabase permanece configurado.
- Mentor: gratuito, local; endpoints de geração paga e compra retornam HTTP 410.

As requisições de autenticação usam `/api/auth`. O Worker também aceita o caminho antigo `/.netlify/functions/auth`, para compatibilidade. Tokens ficam em dois cookies HttpOnly, Secure, SameSite=Lax e sem Domain. Não ficam no JSON da resposta.

As rotas do Worker estão limitadas às APIs; as páginas estáticas seguem o serviço de arquivos da Cloudflare. O build não envia scripts SQL, documentação, variáveis ou fontes privadas como arquivos públicos.

## Endereço e progresso

Teste primeiro o endereço gerado pela Cloudflare. Não desligue a Netlify nem altere DNS antes de validar a nova hospedagem.

Os usuários do Supabase continuam existindo, mas os cookies do endereço antigo não são transferidos: a pessoa precisará entrar novamente no endereço novo. O progresso de questionários e criações é local ao navegador e à origem do site. Um subdomínio novo não recebe esse progresso automaticamente. A exportação de texto existente serve para leitura e não restaura dados no app.

Se for manter o mesmo domínio personalizado e HTTPS, planeje a mudança só depois dos testes. Preserve os registros DNS de e-mail do Resend. Não troque servidores DNS nem exclua registros para testar esta versão. Depois de definir o domínio principal, ajuste também Site URL e os endereços autorizados no Supabase conforme o fluxo utilizado.

## Verificações técnicas

```sh
node scripts/build-cloudflare.cjs
node --test tests/cloudflare.cjs tests/security.cjs tests/mentor.cjs tests/credits.cjs
```

Os testes locais usam provedores simulados. Eles cobrem cookies separados, sessão, renovação, código, senha mínima, origem, requisições grandes, isolamento das variáveis e encerramento do fluxo pago. Não comprovam entrega real de e-mail ou execução na conta Cloudflare.

`cloudflare/wrangler.example.toml` é opcional para uso da CLI. Copie-o para a raiz como `wrangler.toml` e ajuste o nome para o projeto real antes de usar a CLI. A publicação Git descrita acima usa as configurações do painel e não exige esse arquivo.

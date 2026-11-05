# Rumo — login com servidor

Código implementado. Projeto escolhido: Felipe Business. Hospedagem: https://timely-brioche-70b62e.netlify.app/. Publicação, configuração de e-mails e testes reais ainda pendentes.
Não há login fictício, senha universal nem modo de pular a confirmação.

## Publicar
Este pacote agora contém uma Netlify Function. Não basta arrastar a pasta para Netlify Drop.
Importe os arquivos em um repositório Git e conecte-o à Netlify, com netlify.toml na raiz.
A pasta publicada é public; netlify/functions contém o servidor.
Alternativamente, use o fluxo de deploy com functions da CLI oficial da Netlify.
Não coloque arquivos de configuração secreta dentro de public.

## Configuração necessária
Copie as três linhas de netlify.env.example para as variáveis de ambiente da Netlify (escopo Functions). A chave incluída é publishable, não é uma chave administrativa. O arquivo deve permanecer fora de public.

Valores:
- APP_ORIGIN: endereço HTTPS exato do app, sem barra final, por exemplo https://seu-app.netlify.app.
- SUPABASE_URL: URL HTTPS do projeto Supabase escolhido.
- SUPABASE_PUBLISHABLE_KEY: chave pública publishable do mesmo projeto. Não use service_role.
Faça um novo deploy depois de alterar as variáveis.

No Supabase:
1. Projeto ativo. Authentication > Providers: e-mail/senha habilitado, Confirm email LIGADO.
2. Configure senha mínima de 10 caracteres também no provedor e proteção contra senhas vazadas se disponível.
3. Ajuste Site URL para APP_ORIGIN.
4. Configure SMTP próprio, com remetente e domínio verificados, para entregar e-mails fora da equipe.
5. Nas duas mensagens “Confirm signup” e “Reset password”, use os modelos de email-templates.
   Eles mostram {{ .Token }}. O app espera um código de seis dígitos digitado na própria tela.
   Não use só o link padrão de confirmação, porque este fluxo não recebe tokens na URL.
6. Configure expiração curta de OTP e limites de tentativas/envio no Supabase Auth.
7. Ative as notificações de troca de senha.
8. Antes da abertura ao público, configure proteção contra bots/abuso no provedor e teste com o SMTP real.

## Comportamento
Página inicial pública. Menu, dupla, questionário e demais ações exigem login.
Depois do login, retoma a ação escolhida quando ela ainda estiver disponível.
Cadastro → código por e-mail → confirmação → sessão.
Esqueci a senha → código de recuperação → nova senha → login novamente.
Sair da conta revoga a sessão corrente no provedor e elimina os cookies locais.
A sessão é revalidada no servidor ao carregar a página e ao voltar à aba.

## Segurança e limites reais
- Senhas são encaminhadas por HTTPS ao Supabase Auth; não são gravadas no HTML,
  localStorage, IndexedDB ou logs pelo código.
- Tokens ficam em cookies HttpOnly, Secure, SameSite=Lax, prefixo __Host-.
- POST exige Origin igual ao domínio configurado e Content-Type JSON (proteção CSRF).
- A função consulta /auth/v1/user para validar a sessão; não confia em um “logado=true”.
- Respostas não incluem tokens e usam Cache-Control: no-store.
- Mensagens de recuperação evitam divulgar se um e-mail existe.
- A validação no browser é UX; validações de autenticação e senha também existem no servidor.
- Os conteúdos do questionário continuam públicos no código estático. A barreira visual
  não deve ser usada para proteger conteúdo pago ou segredos.
- Progresso continua local neste navegador, separado por ID de conta. Isso NÃO é criptografia
  nem armazenamento em nuvem; quem controla o computador pode inspecionar o armazenamento.
  O progresso anônimo anterior não é atribuído automaticamente a uma conta.
- Não há tabelas públicas, listagem de e-mails ou service_role. Não foi criado banco de
  perfis. Se adicionar dados remotos, exigir autorização por usuário e RLS em cada tabela.
- O dispositivo pode reter acesso visual até recarregar/retomar a aba; requisições de
  autenticação continuam validadas no servidor. Tokens revogados podem ter limites
  de invalidação próprios do provedor até a expiração.
- Não há garantia de entrega para todos os endereços: validação, spam e limites do
  provedor continuam aplicáveis. Nenhum domínio de e-mail é bloqueado pelo app.

## Verificação
Testes de backend: node --test tests/security.cjs (Node 22).
Teste DOM: instalar jsdom@26.1.0 num diretório auth-test-deps ao lado da pasta do projeto;
rodar node tests/gate.cjs.
Foram testados bloqueio de origem externa, ausência/adulteração de sessão, conta
não confirmada, cookies protegidos, senha curta e configuração ausente.
Teste de interface local confirmou que o menu leva ao login.
Ainda faltam testes reais de envio, recebimento, confirmação, recuperação, login/logout
e troca de contas em HTTPS após configurar Supabase e SMTP.

# Ativar o Mentor Rumo

A integração com OpenAI está implementada. Sem a chave, o app mostra um aviso e não fabrica respostas. A validação local usa respostas simuladas; uma resposta real ainda precisa ser testada depois da ativação.

## Estado da instalação atual

A chave já foi cadastrada como segredo na Netlify, no contexto de produção. O código a lê no servidor. A última conferência mostrou saldo zerado na OpenAI; uma resposta real ainda não foi validada. Não exponha o valor da chave em código, ZIP, logs ou documentação.

A tela de pacotes anterior ao Mentor é demonstrativa. Ela não recebe pagamentos nem controla saldo comprado. Consulte CREDITOS.md.

## Ativação na Netlify (instalação nova ou substituição da chave)

1. Crie uma chave de API em https://platform.openai.com/api-keys, em um projeto com acesso ao modelo e faturamento/saldo configurados.
2. Abra o projeto timely-brioche-70b62e na Netlify: Project configuration → Environment variables → Add a variable.
3. Nome: OPENAI_API_KEY. Valor: a chave criada. Marque como segredo e inclua Functions e Production. Não publique a chave, não a envie em conversas e não a grave em arquivos do site.
4. Opcional: OPENAI_MODEL com valor gpt-4.1-mini. Esse é o padrão quando a variável não existe.
5. Faça um novo deploy em Deploys → Trigger deploy → Deploy site.
6. Entre no app, abra Mentor Rumo e envie um projeto curto. Confirme que recebe um feedback real. Teste também foto e PDF com conteúdo sem informações pessoais.

As variáveis de autenticação existentes continuam necessárias. Não as substitua.

## Supabase

A migração supabase/mentor-quota.sql já foi aplicada no projeto usado pelo app. Em outro projeto, execute-a uma vez no SQL Editor. Ela cria uma tabela privada com RLS e uma função que usa o usuário autenticado, sem receber IDs fornecidos pelo cliente. A chave administrativa não é necessária.

## Comportamento e limites

- Login obrigatório, com sessão verificada no servidor a cada envio.
- Até 20 tentativas de geração por conta por dia, com virada à meia-noite UTC. Falhas após reservar a tentativa também a consomem. O limite não impede abuso por múltiplas contas; acompanhe uso e custos no provedor.
- Até três anexos: PNG, JPEG, WebP, PDF ou TXT; até 1 MB por arquivo. TXT limitado a 12.000 caracteres.
- O modelo recebe a mensagem, até oito mensagens anteriores de texto e os anexos do envio atual. Anexos antigos não são reenviados automaticamente.
- O contexto da jornada é opcional e pode ser desligado na tela do Mentor.
- Ditado e leitura de voz usam os recursos do navegador; disponibilidade depende do dispositivo.
- O feedback é exploratório, sem determinar profissão ou aptidão psicológica.

## Dados e segurança

A chave é usada apenas pela Netlify Function. Os cookies de login são HttpOnly; o backend valida origem, sessão, tamanho e formato dos anexos. Arquivos não são publicados nem salvos em Storage por esta integração. Mensagens, anexos e contexto selecionado são enviados à OpenAI para processamento. A solicitação usa store:false, o que não equivale a uma garantia de retenção zero; aplicam-se as políticas do provedor. Evite informações pessoais ou sensíveis.

A conversa fica na memória da página e é apagada ao recarregar ou sair. O progresso da jornada mantém o armazenamento local anterior. Nenhuma ferramenta externa ou acesso à internet é concedido ao modelo.

## Verificação local

node --test tests/security.cjs tests/mentor.cjs

Com jsdom instalado em auth-test-deps ao lado da pasta do projeto:

node tests/gate.cjs
node tests/mentor-ui.cjs
node tests/settings-account.cjs

Os testes de IA usam fetch simulado e não geram cobrança. Configure limites/alertas de uso no projeto da OpenAI e monitore os custos depois de ativar.



## Créditos Pix

O Mentor exige saldo no livro privado e o segredo RUMO_CREDIT_SERVER_TOKEN. A reserva acontece antes de chamar a IA, e falhas devolvem o crédito. O limite diário de 20 mensagens continua separado do saldo comprado. Veja CREDITOS.md para configuração e estado de ativação.

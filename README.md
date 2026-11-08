# Rumo

Aplicativo web de exploração de caminhos para jovens, com questionários solo e em dupla.

## Publicação na Netlify

Conecte este repositório ao projeto existente. A configuração `netlify.toml` publica `public` e instala as funções em `netlify/functions/`.

O login usa Supabase Auth e cookies HttpOnly. Configure as três variáveis de `netlify.env.example` na Netlify e siga `CONFIGURAR.md` para confirmação e recuperação por e-mail.

Não coloque senhas, chaves administrativas ou a chave Resend no repositório. O arquivo de exemplo contém somente espaços para configuração.

## Estrutura

- `public/index.html`: aplicativo completo com login.
- `netlify/functions/auth.cjs`: autenticação no servidor.
- `netlify/functions/mentor.cjs`: integração do Mentor com OpenAI, validada pelo login.
- `MENTOR.md`: ativação, limites e tratamento dos dados do Mentor.
- `supabase/mentor-quota.sql`: limite de uso por conta.
- `email-templates/`: códigos de confirmação e recuperação para Supabase.
- `CREDITOS.md`: estado da tela de pacotes e o que falta para vender créditos.
- `tests/`: verificações de autenticação e interface, incluindo a conta conectada e o logout.
- `downloads/Rumo_App_Web_Netlify.zip`: pacote para baixar; deploy com funções exige Git ou CLI.

## Estado

O código da branch main está conectado à publicação automática na Netlify. A página inicial é pública; menu, questionários e funções exigem login validado pelo servidor. Configurações mostra o e-mail da conta conectada e permite desconectar. O progresso continua local, separado por conta.

O Mentor tem integração com OpenAI pelo servidor. A chave já foi cadastrada na hospedagem; nunca inclua seu valor no repositório. Na última conferência de ativação, o saldo estava zerado e uma resposta real da IA ainda não havia sido validada.

A tela de créditos é uma proposta visual, com saldo e preços ilustrativos. Não há checkout, venda, saldo pago, liberação nem desconto de créditos reais. O botão de prévia permite abrir a conversa e não é uma autorização de pagamento. Veja CREDITOS.md antes de ativar vendas.

A versão navegável sem senha, usada para demonstração, é separada do código de produção deste repositório. As verificações publicadas confirmaram bloqueio de sessão anônima e do Mentor (HTTP 401). Ainda é necessário concluir os testes reais de cadastro, confirmação por e-mail, recuperação e troca de contas com o SMTP configurado.

## Verificação local

Use Node 22. Os testes de interface precisam de jsdom@26.1.0 instalado na pasta auth-test-deps ao lado da pasta do projeto.

```sh
node --test tests/security.cjs tests/mentor.cjs
node tests/gate.cjs
node tests/mentor-ui.cjs
node tests/settings-account.cjs
```

As chamadas de IA nos testes são simuladas e não geram cobrança.

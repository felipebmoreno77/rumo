# Rumo

Aplicativo web de exploração de caminhos para jovens, com questionários solo e em dupla, nove grupos de áreas e experiências para testar interesses.

## Mentor gratuito

O Mentor é um assistente guiado do app, com respostas curtas, atalhos, tarefa do caminho escolhido e recursos de voz do navegador. As respostas são preparadas no navegador e não usam OpenAI, créditos ou assinatura do Mentor. O assistente não faz análise automática de fotos ou projetos. Veja MENTOR.md.

O caminho permanece indefinido quando ainda não existe um mapa. Os atalhos respeitam o questionário e os bloqueios das telas. Arquivos adicionados são referências pessoais temporárias, sem envio ao servidor.

## Conta e progresso

O login usa Supabase Auth e cookies HttpOnly. Menu e funcionalidades exigem sessão. Configurações mostra o e-mail conectado e permite desconectar. O progresso da jornada é local, separado por conta; não é sincronizado entre dispositivos.

## Publicação

O repositório está conectado ao projeto Netlify existente. `netlify.toml` publica `public` e as funções em `netlify/functions`. Preserve as três variáveis de autenticação de `netlify.env.example`. A integração do Mentor gratuito não precisa de chaves de IA.

Na última conferência, as publicações de produção da Netlify estavam pausadas por limite de créditos. O código e os pacotes atualizados não significam que essa hospedagem já recebeu a nova versão. Para trocar de plataforma, adaptar e testar as funções de autenticação antes de alterar o endereço principal. Não basta arrastar o ZIP em um serviço estático.

## Estrutura

- `public/index.html`: app completo com login e Mentor gratuito.
- `netlify/functions/auth.cjs`: autenticação no servidor.
- `netlify/functions/mentor.cjs`: encerra o endpoint antigo de geração com HTTP 410.
- `netlify/functions/credits.cjs`: bloqueia novas compras; mantém operações legadas restritas.
- `netlify/lib/credit-session.cjs` e `supabase/`: suporte legado; não necessários à conversa gratuita.
- `email-templates/` e `CONFIGURAR.md`: configuração de confirmação e recuperação de e-mail.
- `MENTOR.md` e `CREDITOS.md`: capacidades, limites e encerramento da compra de créditos.
- `tests/`: verificação de login, Mentor, encerramento de cobrança e conta conectada.
- `downloads/Rumo_App_Web_Netlify.zip`: pacote do app; não contém segredos.

## Verificação local

Use Node 22. Os testes DOM precisam de jsdom@26.1.0 em auth-test-deps ao lado da pasta do projeto.

```sh
node --test tests/security.cjs tests/mentor.cjs tests/credits.cjs
node tests/gate.cjs
node tests/mentor-ui.cjs
node tests/settings-account.cjs
```

A prévia navegável usa uma conta fictícia e é separada do código de produção. Ainda é necessário validar cadastro e recuperação por e-mail em HTTPS com o SMTP real, além de voz nos dispositivos usados.

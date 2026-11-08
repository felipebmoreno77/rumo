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
- `tests/`: verificações de autenticação e interface.
- `downloads/Rumo_App_Web_Netlify.zip`: pacote para baixar; deploy com funções exige Git ou CLI.

## Estado

A configuração de envio de e-mails e os testes reais de cadastro dependem do SMTP no Supabase. O progresso é local por conta; O Mentor tem integração real implementada; para responder precisa de OPENAI_API_KEY na hospedagem e de um teste real após ativação. O pagamento continua demonstrativo.

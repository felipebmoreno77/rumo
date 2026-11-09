# Mentor Rumo gratuito

O Mentor é um assistente guiado do próprio aplicativo. Respostas e sugestões são escolhidas no navegador por comandos conhecidos e pelo contexto local da jornada. Ele não faz chamadas à OpenAI nem exige créditos ou assinatura do Mentor.

## O que faz

- Explica como usar o questionário, mapa, caminhos, Passaporte e configurações.
- Mostra a tarefa do caminho escolhido quando o próximo passo estiver liberado.
- Com o questionário incompleto, mantém o caminho indefinido e oferece o questionário.
- Oferece sugestões curtas de começo, revisão pessoal e divisão do tempo.
- Abre telas por botões de ação, respeitando os bloqueios existentes.
- Permite desligar o uso do contexto da jornada na conversa.
- Oferece ditado e leitura de respostas pelos recursos do navegador.

## Limites claros

Não é um modelo generativo e não conversa sobre qualquer assunto. Quando não reconhece o pedido, apresenta os comandos disponíveis. Não consulta notícias, clima ou outros serviços e não determina aptidão ou profissão.

O botão + adiciona até três referências pessoais de 1 MB cada. Os arquivos não são enviados a um servidor; ficam apenas na memória da conversa. O Mentor não analisa fotos, PDFs, TXT ou a qualidade dos projetos. O texto da resposta deixa isso explícito e propõe um roteiro de autoavaliação.

A conversa guarda até vinte mensagens na memória da página. Recarregar, desconectar ou recomeçar a jornada limpa a conversa. O progresso do app continua salvo localmente e separado por conta.

## Voz

A voz é opcional e exige ação da pessoa. O reconhecimento não está disponível em todos os navegadores, pode usar o serviço de voz do navegador e depender de internet. A transcrição permanece no campo para revisão antes de Enviar. A leitura usa SpeechSynthesis, preferindo uma voz pt-BR disponível no dispositivo. Se não houver suporte, o texto continua funcionando.

## Servidor e custos

O login continua no backend existente, com Supabase Auth e cookies protegidos. Não é necessário cadastrar OPENAI_API_KEY, OPENAI_MODEL ou RUMO_CREDIT_SERVER_TOKEN para o Mentor gratuito. Variáveis antigas não são usadas por ele. Esta mudança não revoga chaves nem altera contratos de hospedagem.

O endpoint antigo `/.netlify/functions/mentor` responde HTTP 410 e nunca chama a OpenAI ou o livro de créditos. Novos pedidos em `/.netlify/functions/credits` também recebem 410. Os dados privados do livro antigo não são apagados. Não há tela de compra de créditos no app.

A gratuidade se refere às respostas do Mentor e à ausência de API paga de IA. Hospedagem e os serviços de login/e-mail seguem seus próprios planos e limites.

## Verificação

- `node --test tests/security.cjs tests/mentor.cjs tests/credits.cjs`
- `node tests/gate.cjs`
- `node tests/mentor-ui.cjs`
- `node tests/settings-account.cjs`

Os testes verificam que nenhuma conversa solicita uma API de Mentor ou de créditos, além de contexto opcional, mapa indefinido, navegação, voz simulada, referências pessoais, limite de memória e logout. Voz real em cada dispositivo depende do navegador e da permissão da pessoa.

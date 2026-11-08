# Créditos do Mentor — estado atual

A tela de créditos é uma proposta visual. Os pacotes de 20, 60 e 150 créditos e os preços mostrados são ilustrativos e não representam uma venda ativa. O saldo de exemplo não é consultado em um banco de créditos.

O botão Comprar créditos mostra uma explicação de prévia. Não há provedor de pagamento conectado, checkout, cobrança, liberação ou desconto de créditos pagos. A opção Ver a conversa do Mentor · prévia permite abrir a interface existente. Não use esse botão como comprovação de pagamento.

O limite de 20 mensagens por conta ao dia é um controle de uso do backend. Não é saldo comprado. A conta da OpenAI e um futuro saldo de cliente do Rumo são controles separados; receber um pagamento no Rumo não compra créditos da OpenAI automaticamente.

## Antes de ativar vendas

- Definir e aprovar pacotes, preços, consumo, validade e regras de reembolso.
- Escolher e configurar um provedor de pagamento.
- Criar checkout no servidor usando o pacote do catálogo; não aceitar preços enviados pelo navegador.
- Validar a confirmação assinada do pagamento no servidor e conferir pedido, valor, moeda e estado aprovado.
- Registrar cada pagamento uma única vez, inclusive quando a confirmação for reenviada.
- Manter saldo e histórico de créditos por usuário, com acesso restrito.
- Reservar e consumir créditos de forma atômica no backend do Mentor; desfazer a reserva quando a geração falhar conforme a regra definida.
- Testar pagamentos aprovados, recusados, duplicados e reembolsados antes de divulgar a venda.

Nenhuma dessas etapas financeiras está implementada nesta versão. A prévia navegável separada pode simular compra, saldo e respostas fixas somente para demonstração.

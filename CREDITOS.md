# Mentor gratuito — compras encerradas

O Mentor passou a ser um assistente guiado no navegador. Não há saldo obrigatório, pacotes, cobrança por pergunta ou assinatura do Mentor. Perguntas e referências não são enviadas à OpenAI.

A entrada no Mentor abre a conversa diretamente, após o login normal do aplicativo. A tela de compra e o acesso ao painel de pagamentos foram retirados da interface. O servidor recusa novos pedidos de créditos com HTTP 410, mesmo que um cliente antigo tente criar um pedido. O endpoint antigo de geração também responde 410, sem chamar IA ou reservar saldo.

As tabelas privadas e o histórico anterior permanecem no Supabase, com suas permissões. Nenhum pagamento, devolução bancária ou exclusão de registros foi executado por esta mudança. Eventuais pendências antigas devem ser tratadas pelo responsável; o Mentor gratuito não usa nem consome esse saldo.

Não habilitar o Pix antigo para financiar este assistente. A configuração privada continuava com compras desativadas na última conferência. Os scripts SQL antigos ficam no repositório como referência para os dados legados e não são requisito para instalar o Mentor gratuito.

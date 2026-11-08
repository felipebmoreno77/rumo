# Pix manual e créditos do Mentor

## Implementado

- Pacotes: 20 créditos por R$ 4,90; 60 por R$ 9,90; 150 por R$ 19,90. O catálogo é validado no servidor SQL; valores enviados pelo navegador são ignorados.
- Pedidos reais vinculados à sessão confirmada; limite de três pendentes recentes e instruções válidas por 48 horas.
- “Já fiz o Pix” registra um aviso. Não comprova recebimento nem libera crédito.
- Em Configurações, somente a conta cadastrada em `rumo_private.pix_admins` vê Conferir pagamentos Pix. A permissão é conferida de novo pelo banco a cada ação.
- Para aprovar, conferir valor e recebimento no banco e preencher o identificador Pix do extrato. Não aprovar por captura de tela ou comprovante isolado. O mesmo identificador exato não credita dois pedidos, e a repetição da mesma aprovação não credita novamente.
- Saldo privado, eventos e transações atômicas. Um crédito é reservado antes da IA e consumido quando há resposta. Erros da IA e do limite diário devolvem a reserva. Reservas interrompidas são devolvidas na próxima consulta após dez minutos.
- O saldo da OpenAI é independente do saldo comprado no Rumo. Receber Pix não recarrega a conta OpenAI.

## Estado de ativação

Os dados Pix e a conta responsável foram cadastrados no banco privado. As compras estão desativadas (`enabled=false`). Falta configurar `RUMO_CREDIT_SERVER_TOKEN` na Netlify e seu hash SHA-256 no banco. Na conferência de 08/11/2026, `OPENAI_API_KEY` existia na Netlify, mas estava vazia; a conta OpenAI mostrava US$ 0,00. Também é necessário cadastrar uma chave válida, adicionar saldo e testar uma resposta real antes de ativar vendas. Testes locais usam respostas simuladas e não comprovam acesso real ao modelo.

## Configuração em outro ambiente

1. Aplicar, nesta ordem, `supabase/credit-ledger.sql`, `supabase/pix-manual.sql` e `supabase/mentor-quota.sql`. Os scripts não contêm dados bancários nem segredos.
2. Cadastrar chave Pix e nome do recebedor em `rumo_private.pix_settings`, mantendo `enabled=false`.
3. Cadastrar em `rumo_private.pix_admins` o UUID de uma conta Auth confirmada. Não usar `user_metadata` como permissão de administrador.
4. Gerar 32 bytes aleatórios em hexadecimal (64 caracteres). Salvar o valor como segredo `RUMO_CREDIT_SERVER_TOKEN` na Netlify, no contexto Production, escopo Functions. Salvar somente o hash SHA-256 hexadecimal correspondente em `server_token_hash`. Nunca colocar o segredo no HTML, GitHub, ZIP ou logs. O hash não substitui o segredo na Netlify.
5. Manter as variáveis de autenticação existentes e `OPENAI_API_KEY`. Publicar pelo Git conectado ou CLI com suporte a funções; Netlify Drop sozinho não publica o backend.
6. Confirmar saldo/acesso OpenAI, definir canal de atendimento e prazo de conferência, validar recebimento com o banco e a identificação do pedido. Testar IA e permissões em ambiente de teste antes de habilitar `enabled=true` na produção. Não inventar pagamentos nem saldos reais para testar.

## Operação

O cliente cria um pedido, paga o valor exato para a chave exibida e informa que pagou. O responsável entra com sua própria conta e acessa Configurações → Conferir pagamentos Pix. Após localizar a transferência real no extrato, confere valor/recebedor, registra seu identificador e aprova. O cliente usa Atualizar saldo e pedidos para consultar a liberação.

Não há conciliação bancária automática, prazo automático de aprovação nem envio de comprovantes pelo app. Ao atender pedidos iguais, confirme com o pagador a qual conta/pedido pertence cada transação, sem registrar o mesmo Pix duas vezes. Não existe QR Code de cobrança individual; o fluxo usa transferência pela chave e conferência manual.

Pedidos rejeitados não liberam crédito. Uma aprovação não faz transferência bancária. Estornos financeiros exigem operação separada no banco; o app não executa devoluções Pix. As funções antigas de reversão do livro são restritas ao servidor e não representam devolução de dinheiro.

## Verificação

Testes de backend cobrem sessão, origem, ações internas bloqueadas, catálogo, ausência de saldo, falhas da IA e conclusão da reserva. A interface testa pedido, aviso sem crédito, administrador e recuperação de erro. Os testes SQL com dados temporários e rollback cobrem aprovação repetida, identificador duplicado, autorização por sessão, reserva e devolução.

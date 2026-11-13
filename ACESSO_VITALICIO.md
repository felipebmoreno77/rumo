# Teste de 24 horas e compra do Rumo

## Fluxo do cliente

1. O visitante entra ou cria uma conta confirmada.
2. Em **Meu acesso**, escolhe começar suas 24 horas ou comprar o acesso vitalício.
3. O teste começa no primeiro comando de entrar no app. O Supabase registra o início e o fim; são 24 horas corridas. Login, logout, reinstalação, troca de domínio/aparelho e “Recomeçar jornada” não renovam o prazo.
4. Depois do teste, a área do app exige a licença vitalícia. A página pública, login, compra, privacidade e suporte continuam disponíveis.
5. A compra custa **R$ 19,90**, pagamento único por Pix. O valor é definido no servidor, não pelo navegador. Um pedido aberto é reutilizado para evitar duplicidade; cada conta pode criar no máximo cinco pedidos por dia.
6. O cliente copia o código Pix ou usa **Copiar só a chave Pix**, informa R$ 19,90 quando necessário, paga no próprio banco e toca em **Já fiz o Pix**. Esse comando apenas informa o pagamento; não concede licença.
7. A equipe confere o recebimento no banco e libera o acesso no painel. A tela do cliente verifica novamente a cada 30 segundos enquanto aguarda conferência, ou pelo botão **Verificar liberação**.

Não há cartão, assinatura nem cobrança automática. O Pix é manual; não há webhook bancário ou conciliação automática. O Copia e Cola reproduz o QR estático de R$ 19,90 gerado pelo Inter e fornecido pelo recebedor em 12/11/2026: indicação estática `01=11`, nome `FELIPE B MORENO`, cidade `ATIBAIA` e `txid=***`. O CRC deve coincidir com a referência independente `009A`. O código não inclui a referência RUMO no pagamento bancário; ela e o protocolo continuam identificando a compra dentro do app. Para vincular o recebimento, peça o comprovante com o protocolo pelo WhatsApp e compare os dados no banco. O mesmo vale para transferências feitas diretamente pela chave. A compatibilidade estrutural foi verificada; a conclusão de um pagamento real do novo Copia e Cola ainda depende de validação no banco. Nunca libere apenas porque ele informou o pagamento.

## Como administrar

Entre com `felipebmoreno@icloud.com`, abra o app e vá a **Menu → Painel administrativo → Compras**. O administrador não precisa iniciar teste nem comprar o próprio app. A opção **Menu → Meu acesso** fica visível também para essa conta e explica a isenção, além de mostrar a oferta destinada aos clientes.

- Filtre por **Para conferir** para ver pedidos informados como pagos.
- Compare no seu banco o valor, o pedido e o recebimento.
- Cole o identificador da transação que aparece no banco.
- Marque que conferiu o recebimento e toque em **Confirmar recebimento e liberar**.
- O identificador bancário é único: a mesma transação não pode liberar duas compras. Repetir a confirmação do mesmo pedido com o mesmo identificador é idempotente.
- **Pagamento não localizado** encerra o pedido sem conceder acesso. Não use essa opção apenas por demora de atualização no banco. Não há transferência ou estorno automático pelo painel.

A compra fica vinculada à conta. Os registros das tarefas, projetos e criações continuam locais, como antes; esta entrega não adiciona sincronização de jornada entre aparelhos. Os dias 8 a 14 e o Mentor guiado estão incluídos no acesso, sem uma segunda cobrança.

## Arquitetura e proteção

`public/storefront.html` contém somente a vitrine, login, suporte e compra. O arquivo publicado como `/index.html` é essa vitrine. O questionário e o app completo não são arquivos públicos da implantação: são incorporados ao módulo do Worker e entregues em `/app` apenas após sessão e licença verificadas no servidor.

`cloudflare/worker.mjs` faz a validação pelo mesmo núcleo de autenticação em `netlify/functions/auth.cjs`, usando a chave publicável e JWT em cookies HttpOnly. A resposta do app é `private, no-store`. A lista de assets publicados continua limitada ao índice público e aos ícones; SQL, código do servidor e backups não entram nos assets.

Durante o uso, o app confere a licença no foco, ao retornar à aba e no máximo a cada dois minutos. O relógio do navegador não concede acesso; a expiração vem do banco. Se a verificação falhar, o app pede reconexão e bloqueia a interação enquanto não obtiver confirmação. Uma página já entregue, como qualquer frontend, não é DRM e não impede cópia do código já recebido.

`supabase/lifetime-access.sql` cria tabelas privadas com RLS e sem leitura/escrita direta de usuários. A RPC pública é `SECURITY INVOKER`, com lógica privilegiada somente no schema privado, `search_path` vazio e autorização de sessão em cada operação. A conta administradora é derivada de configuração protegida, UUID, e-mail confirmado e sessão válida; nenhuma permissão usa metadados editáveis do usuário. A aprovação, auditoria do pedido e concessão de licença são uma transação.

O script inicial cria a oferta desativada. Após publicar a versão correspondente, a ativação é feita pela administração do banco (`app_offer.enabled=true`). Não reaplique o script inicial a tabelas existentes. Para futuras mudanças de preço, revise configuração, interface e validações juntas.

Esta versão paga é publicada no **Cloudflare Workers** com `node scripts/build-cloudflare.cjs` e `node scripts/deploy-cloudflare.cjs`. Um ZIP antigo para Netlify ou uma simples hospedagem estática não inclui essa barreira de servidor e não deve substituir esta implantação.

## Verificação

- `tests/lifetime-access.sql`: teste transacional, expiração, impossibilidade de reinício, preço, pedidos idempotentes, informação de Pix sem licença, aprovação e permissões. Todas as escritas de teste são revertidas.
- `tests/lifetime-access.cjs`: payload Pix/CRC, sessão e proibição de aprovação por clientes.
- `tests/protected-app.cjs`: entrega do HTML somente com licença e bloqueio em expiração, ausência de sessão e falhas.
- `tests/storefront.cjs`: login, início explícito, compra, informação do Pix e estado vitalício.
- Testes existentes de Worker, login, configurações, Mentor, painel e registros de tarefas.

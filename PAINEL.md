# Administração do Rumo

Entre com `felipebmoreno@icloud.com`, abra o menu lateral e selecione **Painel administrativo**. A conta já existente é vinculada pelo UUID, pelo e-mail confirmado atual e por uma sessão ainda existente no Supabase. Nenhuma permissão vem de `user_metadata`, parâmetros do cliente ou armazenamento do navegador.

## Funcionalidades

- Cadastros totais e confirmados vêm de `auth.users`; novos cadastros podem ser filtrados por 7, 30 ou 90 dias.
- Pessoas ativas, inícios/conclusões do questionário e aberturas de caminhos são contados por conta, sem duplicar a mesma ação na mesma data.
- Tarefas registradas são deduplicadas por conta, caminho e dia do plano. Experiências realizadas excluem o estado “Ainda não consegui fazer”. Uma semana registrada exige os sete dias, inclusive registros de dificuldade.
- Feedback da semana envia somente a escolha estruturada aprofundar/ajustar/mudar. O painel não recebe respostas do questionário, textos de tarefas, projetos, anexos, notas pessoais nem conversas do Mentor.
- A aba Suporte permite enviar avaliações (uma por conta, atualizável) e pedidos de atendimento. Pedidos incluem o e-mail confirmado da conta e o texto que a pessoa decidiu enviar. O administrador pode marcar aberto/em atendimento/resolvido e abrir o cliente de e-mail para responder; nenhuma mensagem é enviada automaticamente.
- Cliques no WhatsApp são contados separadamente, sem importar conversas.

## Limites e interpretação

Indicadores de uso começam com esta publicação. Nenhuma jornada local anterior é importada como atividade recente. Dados dos últimos 7/30/90 dias seguem o horário de São Paulo. Contas totais incluem o administrador; números de uso são sinais do aplicativo, não uma auditoria independente. As ações no modo de demonstração não são contadas. Falhas temporárias de coleta não bloqueiam a jornada nem geram registros retroativos inventados.

Os totais de cada etapa têm bases diferentes; a interface não apresenta uma taxa de conversão artificial. Avaliações mostram as 30 mais recentes do período; suporte tem filtro de status e paginação de 20 pedidos. O período geral não limita os chamados, que precisam continuar visíveis até o atendimento.

## Proteção e configuração

`supabase/admin-panel.sql` é o script inicial da estrutura, aplicado uma vez ao projeto existente. Tabelas privadas têm RLS e nenhum acesso direto concedido a `anon`/`authenticated`. A única RPC pública é `SECURITY INVOKER`; delega à função privada que valida identidade e operação, deriva a identidade da sessão e limita os campos gravados. A função privada usa `search_path` vazio e nomes qualificados. Cadastros são devolvidos somente como totais; não existe listagem geral de e-mails de usuários.

O endpoint existente de autenticação faz a ponte usando somente a chave publicável e o JWT guardado em cookie HttpOnly. Leituras administrativas verificam o UUID e o e-mail também no servidor. O banco confirma que o `session_id` ainda existe, impedindo acesso administrativo por sessão revogada. Nenhuma chave `service_role` é necessária. Os limites existentes de origem, corpo da requisição, tempo e cookies continuam ativos. Pedidos de suporte são limitados a três por conta por hora, com trava transacional.

As tabelas legadas de créditos não fazem parte do painel. Os avisos do advisor sobre ausência de políticas nas tabelas privadas representam bloqueio intencional por padrão; não é necessário conceder leitura direta para removê-los.

## Verificação

`tests/admin-panel.sql` simula os papéis do banco e desfaz todas as escritas de teste. `tests/admin-panel.cjs` verifica a ponte HTTP, bloqueios, JWT e erros. `tests/admin-ui.cjs` verifica menu restrito, filtros, formulários, escapes de conteúdo e limpeza ao sair. Também são executados os testes existentes de login, Worker e registros de tarefas.

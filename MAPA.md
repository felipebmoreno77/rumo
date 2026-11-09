# Pontuação do questionário individual

Versão editorial: `balanced-2026-11-v1`.

- Dez perguntas, cinco alternativas por pergunta e opção separada de não saber.
- As perguntas 1, 3, 4 e 8 exploram interesses. Cada caminho aparece exatamente uma vez por pergunta e recebe dois pontos quando essa alternativa é escolhida.
- Cada um dos nove caminhos pode receber quatro evidências e até oito pontos. Não há bônus exclusivo de empreendedorismo nem multiplicadores por área.
- As outras seis respostas ajustam contexto, rotina e primeiro teste. Renda, apoio, liberdade e disponibilidade não determinam o caminho.
- O destaque exige três evidências e uma diferença mínima de três pontos. Empates e resultados próximos não produzem indicação única. A posição visual num empate não significa superioridade.
- As alternativas agrupam atividades e instruem que basta gostar de uma delas; os pares mudam entre perguntas para permitir distinguir os caminhos.

## Validação

`node tests/entrepreneur-map.cjs` enumera as 1.296 combinações, incluindo não saber, das quatro perguntas pontuadas. Verifica distribuição marginal de pontos idêntica para os nove caminhos, máximo igual a oito, consistência das evidências e possibilidade de cada caminho liderar sozinho e receber destaque. Verifica também que respostas de contexto não alteram a pontuação.

Isso comprova a simetria dos pesos e as propriedades técnicas descritas; não implica frequências idênticas de primeiro lugar nem validação psicológica. A frequência real depende dos interesses das pessoas. As alternativas precisam ser acompanhadas com feedback de compreensão dos usuários.

## Compatibilidade

A versão do mapa é persistida separadamente da versão do estado. Respostas anteriores às quatro perguntas alteradas ficam pendentes de revisão para que índices antigos não sejam interpretados como escolhas novas. As outras seis respostas, tarefas, reflexões e criações são preservadas. A demonstração usa respostas coerentes com as novas alternativas. O questionário especializado em dupla mantém seu próprio modelo; os critérios acima se referem ao mapa individual.

# Modo Expedição (roguelike): arquitetura da base

Modo roguelike da Liga de Desafios, em que o jogador monta o time ao longo da run, em vez de um baralho. Pedido do usuário em 2026-10-21.

O usuário tem várias ideias de variação do modo. A mecânica comum a todas é montar o time ao longo da run num mapa gerado aleatoriamente, com eventos e encontros. Entre as variações, mudam os eventos e encontros, a quantidade de níveis e o ritmo. Este documento descreve essa base e a primeira variação, mínima, feita só para testá-la.

## Referências

| Jogo | O que serve de referência |
|---|---|
| Slay the Spire (1 e 2) | **Formato do mapa** (decisão do usuário): andares em grade, vários caminhos que se cruzam, o ato inteiro visível e o próximo nó escolhido entre os ligados ao atual. Tipos de nó: combate, elite, evento, loja, descanso, tesouro e chefe no fim do ato. Recompensa depois de cada combate, HP que continua entre as lutas e relíquias passivas. |
| Wildfrost | Companheiros que entram no grupo durante a run e "charms" que melhoram uma unidade (equivalentes a Pokémon novos e itens). Atos curtos. |
| Dungeon Clawler | Ritmo curto: andares em sequência, com loja e eventos entre as lutas. |
| PokéRogue | Ondas de batalha (selvagem, treinador, chefe), captura, loja entre ondas, iniciais com custo e desbloqueios entre as runs. |
| pokelike.xyz | Nós de batalha selvagem com captura, item, item passivo que dura a run inteira, troca e "time cheio"; ginásios e Elite 4 por região; escolha da ordem do time antes da luta. O site estava em manutenção na pesquisa, e só os menus puderam ser vistos. |

## Decisões do usuário (2026-10-21)

- **Nome:** "Expedição" em pt e "Expedition" em en. As variações podem ter nomes próprios.
- **Batalhas, progressão, desgaste e desmaio:** cada variação escolhe. A base precisa permitir:
  - batalhas jogadas pelo jogador ou automáticas (IA contra IA);
  - Pokémon com níveis que sobem ou com nível fixo;
  - HP e PP que continuam entre as batalhas ou cura total;
  - Pokémon desmaiado que volta ou que sai do time (Nuzlocke).
- **Times iniciais:** cada variação define de onde vêm as opções.
- **Mapa:** no estilo Slay the Spire.
- **Variações:** a lógica de cada variação e de cada tipo de nó é programada. O painel do admin ajusta os números: atos, andares, chances de cada tipo de nó e dificuldade, além de ligar e desligar variações.
- **Runs:** cada jogador tem no máximo uma run em andamento por variação. Ela fica salva no servidor e continua de onde parou.
- **Desbloqueios entre runs:** iniciais, itens e variações. Exemplos: vencer ou avançar libera iniciais ou itens novos, e vencer uma variação libera outra. O que libera cada coisa fica para quando as variações de verdade forem descritas.
- **Visibilidade:** como no Desafio de Ginásios. As batalhas são públicas, e o histórico de runs fica visível no perfil para os usuários logados.
- **Variação de teste** (mínima, só para provar a base):
  - um ato curto com batalha selvagem, treinador, descanso, item e chefe;
  - batalhas jogadas pelo jogador, contra a IA;
  - Pokémon com níveis que sobem;
  - HP e PP continuam entre as batalhas, e o desmaiado fica no time até um descanso curar;
  - o jogador escolhe um entre três times de três Pokémon, sorteados a cada run;
  - os Pokémon dos times iniciais são os iniciais oficiais dos jogos (Bulbasaur, Charmander e os das outras gerações), no nível 5, com os últimos golpes aprendidos até esse nível.

## Arquitetura proposta

O código fica num plugin próprio, `server/server/chat-plugins/expedition/`, como o Desafio de Ginásios. Os nomes no código ficam em inglês: `expedition` e `run`.

O plugin reaproveita do Desafio:
- a batalha contra o NPC (`NpcBattle`), com o save state;
- as IAs (Aleatório a Mestre);
- os padrões de página do painel (`gymGo`, rascunhos de formulário);
- as traduções `TL`;
- a exclusão de dados junto com a conta (`pending_purges`).

O que for comum aos dois modos sai de `gym-challenge/` para um lugar compartilhado na hora em que a Expedição precisar.

### Camadas

1. **Variação (`ExpeditionVariant`, no código):**
   - id, nome e descrição;
   - regras: tipo de batalha (jogada ou automática), progressão, desgaste e desmaio;
   - gerador dos times iniciais;
   - parâmetros do mapa: atos, andares, largura, chances de cada tipo de nó e nós fixos, como o chefe no fim do ato;
   - os tipos de nó que usa;
   - tamanho máximo do time;
   - formato das batalhas.

   Os números que o admin pode ajustar ficam marcados na definição, com limites mínimos e máximos. O painel grava só os ajustes, e o código continua dono da variação.
2. **Tipo de nó (`NodeType`, no código):**
   - o que o jogador vê ao entrar;
   - as escolhas oferecidas;
   - como cada escolha muda a run: batalha, recompensa, cura ou troca.

   Os tipos de nó são registrados numa lista, e cada variação escolhe quais usa. A base traz os genéricos: batalha selvagem, treinador, chefe, descanso e item. As variações acrescentam os seus.
3. **Gerador do mapa:** mapa no estilo Slay the Spire, gerado a partir de uma semente.
   - O ato tem N andares e até L colunas.
   - Alguns caminhos partem do primeiro andar. A cada andar, cada um segue para uma coluna vizinha, sem cruzar outro caminho, e eles se juntam no chefe.
   - O tipo de cada nó é sorteado pelas chances da variação, com regras como "o andar X é sempre descanso" e "não repetir descanso em seguida".
   - A mesma semente gera sempre o mesmo mapa: a run guarda só a semente e o caminho percorrido, o que facilita retomar e testar.
4. **Run (banco do plugin, SQLite, como o Desafio):**
   - o jogador, a variação e a semente;
   - o estado do time: Pokémon, nível, golpes, item, HP e PP atuais e se está desmaiado;
   - os itens da run, o ato e o nó atuais, e o caminho percorrido;
   - a escolha pendente (por exemplo, a recompensa ainda não pega);
   - placar e resultado.

   O histórico guarda as runs terminadas, com o resultado e o time final.
5. **Desbloqueios:** tabela genérica do que cada jogador já liberou (tipo, id e data), consultada pelas variações. Ela é apagada junto com a conta.
6. **Batalhas:**
   - **Jogadas:** batalha real contra o NPC, como no Desafio, com o time no estado atual.
   - **Automáticas:** a mesma batalha, com IA dos dois lados, e o jogador assiste ou vê o resultado.
   - O formato de cada variação é próprio e escondido do menu (como os formatos de desafio). Ele ganha uma regra da Expedição que aplica o estado do time no começo da batalha: HP, PP e Pokémon desmaiados.
   - No fim da batalha, o estado volta para a run.
7. **Páginas** (do servidor, como as do Desafio, com a mesma identidade visual do PS):
   - lista de variações;
   - escolha do time inicial;
   - mapa do ato, com os nós clicáveis ligados ao atual;
   - página do nó atual, com as escolhas, a recompensa e a troca de Pokémon quando o time está cheio;
   - o time, com HP, nível e itens, e a ordem para a próxima batalha;
   - histórico no perfil;
   - painel do admin: variações (ligar, desligar e ajustar), runs em andamento (encerrar) e histórico.

   A Home ganha o botão "Expedition", e a página `/regras` ganha a seção do modo.

### Ponto técnico a resolver primeiro

O PS monta as batalhas a partir do time no formato compactado, que não tem HP nem PP atuais, e o simulador roda num processo separado. Para o desgaste entre batalhas, a ideia é uma regra de formato (ou um mod) da Expedição que, no começo da batalha, aplica o estado guardado na run. O caminho de dados até o processo do simulador ainda precisa ser escolhido e testado: um campo extra no time, opções da batalha ou um comando depois do início. Esse é o primeiro passo da etapa de batalhas, e o resultado entra aqui.

## Etapas propostas

Cada etapa é validada antes da próxima, como no Desafio:

1. **Núcleo** (feita, ver abaixo):
   - definição de variação e de tipo de nó;
   - gerador do mapa com semente, com testes;
   - banco das runs;
   - páginas da lista de variações, do time inicial, do mapa e do nó, com os nós ainda sem batalha.
2. **Batalhas:**
   - HP e PP que continuam entre as batalhas (o ponto técnico acima);
   - batalha jogada contra o NPC, com save state;
   - resultado de volta para a run;
   - batalhas automáticas;
   - níveis, ganho de nível e evolução.
3. **Variação de teste completa:**
   - nós de batalha selvagem com captura, treinador, descanso, item e chefe;
   - itens da run;
   - time cheio com troca;
   - fim da run, com vitória ou derrota.
4. **Painel, perfil e desbloqueios:**
   - ajustes das variações no painel;
   - runs em andamento e histórico;
   - perfil;
   - estrutura de desbloqueios;
   - exclusão de dados com a conta.
5. **Fechamento:**
   - `/regras` e aviso de privacidade;
   - revisão de segurança (OWASP) e LGPD;
   - passos no teste de ponta a ponta;
   - documentação.

## Perguntas em aberto da variação de teste

Para a etapa 2 e a etapa 3 (o nível inicial e a origem dos iniciais já foram respondidos):

- **Formato das batalhas:** individual, Pokédex completa da gen 9, com Megaevolução e sem Tera, Z-moves e Dynamax (o padrão do Desafio)?
- **Níveis:**
  - como se ganha nível (por vitória ou por experiência);
  - em que nível termina o ato.
- **Golpes:** aprendidos pelo learnset ao subir de nível? Quando há um golpe novo com quatro já conhecidos, o jogador escolhe qual esquecer?
- **Captura:** depois de vencer a batalha selvagem, o jogador escolhe se fica com o Pokémon? Com o time cheio, troca um ou recusa?
- **Itens:** itens de segurar, escolhidos entre três num nó de item? Também itens passivos da run, como as relíquias do Slay the Spire?
- **Adversários:**
  - nível e força crescentes com o andar;
  - nível de IA de cada tipo de nó (selvagem, treinador e chefe);
  - de onde vêm os times dos treinadores e do chefe (sorteados ou do banco de treinadores do Desafio).
- **Derrota:** perder uma batalha encerra a run?

## Etapa 1: núcleo (feita em 2026-10-21)

- **Código** (`server/server/chat-plugins/expedition/`):

  | Arquivo | O que faz |
  |---|---|
  | `random.ts` | Sorteios com semente, pelo gerador do simulador do PS. A semente da run e um rótulo (`act1`, `starters`) dão sempre os mesmos sorteios. |
  | `variant.ts` | Definição de variação: regras, mapa, números ajustáveis com limites (`tunables`) e times iniciais. `resolveSettings` aplica só os ajustes declarados, arredondados e limitados. |
  | `variants.ts` | A variação de teste (`teste`), só para administradores. |
  | `nodes.ts` | Tipos de nó (o que o jogador vê, as escolhas e o efeito) e os genéricos da base. |
  | `map.ts` | Gerador do mapa no estilo Slay the Spire e os nós alcançáveis. |
  | `team.ts` | Estado de cada Pokémon da run, golpes aprendidos até o nível (learnset da geração mais recente com dados de nível), criação de Pokémon como nos jogos e cura. |
  | `store.ts` | Banco próprio (`databases/expedition.db`) com runs, desbloqueios e ajustes das variações. |
  | `runs.ts` | Regras da run: começar, escolher o time inicial, ir a um nó, escolher no nó, chefe e próximo ato, vitória e desistência. |
  | `pages.ts` | Páginas e comandos do jogador. |
  | `index.ts` | Exclusão e troca de nome da conta. |

- **Gerador do mapa:**
  - os caminhos partem do primeiro andar, e os dois primeiros começam em colunas diferentes;
  - a cada andar, cada caminho sobe para a mesma coluna ou uma vizinha, sem cruzar outro caminho;
  - todos os nós do último andar levam ao chefe;
  - os tipos são decididos de baixo para cima, respeitando:
    - os andares de tipo fixo (negativos contam do topo);
    - o primeiro andar de cada tipo;
    - os tipos que não se repetem em seguida, inclusive antes de um andar fixo;
  - o mapa não é guardado: ele é gerado de novo pela semente e pelas configurações da run.
- **Run:**
  - uma em andamento por jogador em cada variação (índice único no banco);
  - guarda as configurações em vigor quando começou, para que um ajuste no painel não mude uma run em andamento;
  - o caminho é guardado como "ato:nó";
  - ao terminar o nó do chefe, passa para o próximo ato ou vence a run.
- **Variação de teste:**
  - 1 ato com 6 andares, 5 colunas e 4 caminhos;
  - chances: selvagem 45, treinador 30, item 15 e descanso 10;
  - o primeiro andar é sempre selvagem, e o último antes do chefe, sempre descanso;
  - descanso só a partir do 3º andar e item a partir do 2º, e os dois não se repetem em seguida;
  - números ajustáveis (painel da etapa 4): andares (3 a 15), colunas (3 a 7), caminhos (2 a 6) e as chances (0 a 100);
  - os três times iniciais têm 9 iniciais diferentes;
  - habilidade comum sorteada (sem a oculta), natureza, gênero e IVs sorteados, sem item.
- **Nós nesta etapa:**
  - o descanso já cura o time inteiro (HP, PP e desmaiados);
  - batalha selvagem, treinador, chefe e item ainda só mostram o tipo e seguem em frente. As batalhas chegam na etapa 2, e os itens na 3.
- **Páginas:**
  - `view-expedicao`: as variações disponíveis, com a run de cada uma;
  - `view-expedicao-run-<variação>`: a run, com estes blocos:
    - a escolha do time inicial;
    - o nó atual, com as escolhas;
    - o mapa do ato, do chefe (no alto) ao primeiro andar. Os nós alcançáveis são botões, o atual fica destacado e o caminho percorrido aparece em verde. As ligações usam "│", "╱" e "╲" numa linha entre os andares;
    - a legenda e o time;
    - "Desistir".
- **Comandos:** `/expedicao` (ou `/expedition`), com as ações `iniciar`, `inicial`, `avancar`, `escolha` e `desistir`. Todas exigem conta registrada e conferem a fase da run e se o nó está ligado ao atual.
- **Cliente:**
  - botão "Expedition" na tela inicial, abaixo de "Gym Challenge", em português "Expedição";
  - os botões `gymGo` também abrem as páginas `view-expedicao`.
- **Variação de teste só para administradores:** o modo ainda não tem batalhas. Para os jogadores, a lista diz que não há expedições disponíveis. A página `/regras` e o aviso de privacidade ganham a seção do modo quando uma variação abrir para os jogadores (etapa 5).
- **Validado:**
  - **testes de unidade:**
    - mapa determinístico, que muda com a semente e o ato;
    - em 40 mapas: caminhos ligados que terminam no chefe, colunas vizinhas, sem cruzamentos, andares fixos, primeiro andar de cada tipo e tipos sem repetição;
    - nós alcançáveis;
    - golpes do nível e criação de Pokémon;
    - ajustes do painel só nas chaves declaradas e dentro dos limites;
    - três times de iniciais diferentes;
    - uma run inteira de dois atos, com descanso curando e uma run por variação;
    - variação de teste escondida dos jogadores e desistência;
    - exclusão e troca de nome;
  - os 2611 testes do servidor;
  - o teste de ponta a ponta, com o passo novo da expedição de teste (15 passos).
- **Bug do PS corrigido no fork** (`server/server/chat.ts`, `loadPluginDirectory`):
  - o carregador de plugins somava 1 à profundidade a cada subpasta irmã, e não a cada nível de aninhamento;
  - com o limite de 3, só as três primeiras pastas de `chat-plugins/` em ordem alfabética eram carregadas;
  - a pasta `expedition/` empurrou a `trivia/` para fora, e os testes do Trivia falharam;
  - agora a profundidade conta o aninhamento. É a única mudança fora dos nossos arquivos nesta etapa.
- **Teste de ponta a ponta mais estável:**
  - o passo dos convites reabria a página e lia o texto antes de a versão nova chegar, porque "Convites pendentes" já estava na antiga;
  - agora ele espera até o código sumir. A falha aparecia em parte das rodadas.

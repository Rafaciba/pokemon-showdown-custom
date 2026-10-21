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
2. **Batalhas** (feita, ver abaixo):
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

## Decisões para a etapa 2 (2026-10-21)

- **Formato:**
  - por enquanto, o padrão do Desafio: individual, Pokédex completa da gen 9, com Megaevolução e sem Tera, Z-moves e Dynamax;
  - a base fica pronta para formatos por variação. Exemplos: expedições temáticas de cada geração, expedições que liberam Tera ou Dynamax e, raramente, treinadores em dupla.
- **Níveis:**
  - experiência dos jogos para o time todo. ~~Pokémon desmaiados não ganham~~ (substituído em 2026-10-21): no modo padrão, os desmaiados ganham metade; no Nuzlocke, eles saem do time, e um time menor ganha um pouco mais;
  - ~~recalibrada para o time chegar entre os níveis 80 e 100 no último andar~~ (substituído na revisão da etapa 2, abaixo): **30 níveis por ato**, em média. Uma expedição de um ato termina por volta do nível 35, e só as mais longas chegam aos níveis altos;
  - **sem nível fixo:** o ganho de experiência varia com o caminho e com os encontros sorteados. O jogador médio chega perto do nível do chefe; quem otimiza o caminho passa um pouco dele, e quem pega só selvagens ou nós sem batalha fica abaixo (variação baixa).
- **Golpe novo com quatro já conhecidos:** o jogador escolhe qual esquecer, ou não aprende.
- **Evolução por nível:** o jogador escolhe evoluir ou adiar.
- **Derrota:** encerra a run.
- **Adversários:** há três fontes, que coexistem, e cada variação escolhe as suas. A de teste usa as três:
  - sorteados da Pokédex;
  - treinadores do banco do Desafio, ajustados ao nível do andar;
  - listas próprias da variação.
- **Lendários:**
  - um nó bem raro de encontro com um Pokémon lendário, só a partir do segundo ato ou, nas expedições de um ato, na metade final dele (2026-10-21);
  - treinadores nunca têm lendários nem míticos;
  - o chefe pode ter, mas não é comum.
- **Estágio dos Pokémon sorteados:** de acordo com o nível, como nos jogos.
  - Para os NPCs, as evoluções que nos jogos dependem de troca, amizade, item ou outra mecânica que não teremos acontecem num nível próprio: o nível em que a espécie anterior apareceu mais 16, no mínimo 30 e no máximo 50. Exemplos: Kadabra → Alakazam no 32, Eevee → evoluções no 30.
  - Para o jogador, essas evoluções especiais vêm de nós "?" de evento (etapa 3), que depois terão outros eventos.
- **IA por tipo de nó e andar (variação de teste):**
  - selvagem: Aleatório na primeira metade, Fácil na segunda;
  - treinador: sobe do Fácil até o Difícil;
  - chefe: Difícil, e Mestre nos três quartos finais da run (pelo progresso). Com um ato só, o chefe da variação de teste usa a Mestre.
- **Tamanho dos times adversários:** selvagem 1; treinador começa com 1 ou 2 e chega a 4 ou 5; chefe sempre 6.

## Desenho da etapa 2

- **Formato de cada variação** (`[Gen 9] Expedition: <variação>`):
  - formato escondido, gerado a partir das variações em `config/custom-formats.ts`, como os formatos de desafio;
  - tem uma variante em dupla, para encontros em dupla;
  - a regra da Expedição, no `onBegin` do formato:
    - aplica o estado do time (HP e PP) que vem nas opções do lado do NPC, gravadas no registro de entrada da batalha. Assim, a batalha retomada pelo save state aplica o mesmo estado;
    - envolve o `win` da batalha para mandar o estado final do time do jogador numa mensagem privada, que o servidor intercepta.
- **Pokémon desmaiados não entram na batalha.** O estado guardado é HP e PP; o status, como queimadura e veneno, não continua entre as batalhas.
- **Experiência:**
  - fórmula da geração 5 em diante (nível de quem derrota contra o derrotado, bônus de treinador);
  - os dados do PS não trazem a experiência base nem a curva de crescimento: a experiência base é estimada pela soma dos atributos base. A curva e a calibração foram revistas depois (ver "Revisão da etapa 2").
- **Nível dos adversários:** segue a curva de níveis por ato, com pequena variação, e o chefe fica um pouco acima.
- **Decisões pendentes da run:** golpes novos e evoluções ficam numa fila. A página mostra a primeira, e o mapa só segue depois de resolvidas.
- **Batalhas jogadas:**
  - `NpcBattle` do Desafio, com save state;
  - batalha retomada ao entrar com a conta;
  - registro das batalhas no banco da Expedição.
- **Batalhas automáticas:** a mesma batalha, com o lado do jogador também respondido por uma IA (definida pela variação), e o jogador como espectador.
- **Encontro determinístico:** gerado pela semente da run e pelo nó, para ser o mesmo depois de uma interrupção.

## Decisões para a etapa 3 (2026-10-21)

- **Captura:**
  - o padrão é "escolhe ao vencer": depois de vencer um selvagem (ou o lendário), o jogador decide se fica com ele. Com o time cheio, troca por alguém do time ou recusa;
  - guardadas para variações futuras: captura com Poké Bola da mochila e captura com chance, como nos jogos.
- **Nó de item:** 1 entre 3 itens de segurar. O item que um Pokémon já segurava não se perde, vai para a mochila, e o jogador alterna os itens entre os Pokémon como quiser.
- **Loja** (o dinheiro vem das batalhas contra treinadores, como nos jogos): vende cura (poções, Revive), itens de segurar, Poké Bolas, Rare Candy, TMs, berries e itens de curar status.
- **Eventos "?":**
  - na primeira leva: evoluções especiais, risco e recompensa, tutor de golpes, Pokémon de presente, árvores de berries, eventos que dão dinheiro e eventos com Pokémon selvagem;
  - formato: eventos com escolhas de resultados diferentes, como no Slay the Spire. Exemplo: numa árvore, chacoalhar para ganhar uma berry, mas enfrentar Pokémon inseto, ou aproveitar a sombra para descansar e curar parte do HP do time.
- **Status:** continua entre as batalhas, como nos jogos, até ser curado por item, berry, descanso ou evento.
- **Itens de uso** (poções, Revive, Rare Candy, TMs, cura de status): só fora da batalha, na página da expedição. O simulador do PS não tem mochila durante a batalha.
- **Dinheiro e preços:** pagamento como nos jogos (base da classe × nível do último Pokémon do treinador) e preços dos jogos, com um multiplicador para um ato típico render umas 3 ou 4 compras médias. Rare Candy e os itens fortes ficam caros.
- **Mapa da variação de teste:** selvagem 35, treinador 25, evento 15, item 10, descanso 8 e loja 7. A loja não se repete em seguida e só aparece a partir do andar 2.
- **Divisão da etapa 3** (para validar aos poucos): parte 1, captura, time cheio, nó de item, mochila e status; parte 2, dinheiro e loja; parte 3, eventos "?".

## Etapa 3, parte 1: captura, itens e status (2026-10-21)

- **Captura** (`rules.capture = 'choose'`):
  - a vitória sobre um selvagem ou o lendário põe a captura na fila de decisões, depois dos golpes e das evoluções do time;
  - o Pokémon entra no nível em que estava, com HP cheio, sem status e sem item;
  - com o time cheio, a página lista quem pode sair, e o item de quem sai vai para a mochila;
  - escolha nossa: o lendário também pode ser capturado (é o prêmio do nó raro).
- **Nó de item:** 3 itens de segurar sorteados pela semente da run e pelo nó, os mesmos se o jogador sair e voltar. O escolhido vai para a mochila.
  - A lista (`items.ts`) é escolha nossa: itens úteis em batalhas individuais, berries e reforços de tipo, sem Z-Crystals e itens de uma espécie só. As Mega Stones entram como item raro (abaixo).
- **Mochila** (`run.items`): a coluna Item do time troca o item de cada Pokémon pela mochila, ou guarda o item atual. Isso só funciona fora de batalha.
- **Itens na batalha:**
  - item gasto (berry comida, Focus Sash usada) se perde, como nos jogos;
  - item tirado por Knock Off ou Trick volta depois da batalha.
- **Status:**
  - vai para a batalha e volta no fim, pela regra do formato, sem mensagem: o cliente vê o status na condição do Pokémon;
  - o sono recomeça a contagem a cada batalha;
  - o descanso cura;
  - na página, um selo colorido ao lado do HP.
- **Nós novos no mapa:** loja (🛒) e evento (❓), por enquanto sem efeito, até as partes 2 e 3.
- **Validado:**
  - testes de unidade: status na batalha real e de volta, item gasto e item mantido, captura com vaga e com troca, mochila e nó de item;
  - no navegador, com runs completas: captura, nó de item (forçado por um ajuste temporário das chances), mochila, troca de item e status depois da batalha (sono).

### Ajustes depois da revisão do usuário (2026-10-21)

- **Mapa:**
  - ícones maiores (26 px, células de 56 × 44) e legenda maior;
  - todos os caminhos terminam visivelmente no chefe: do último andar, cada nó sobe até uma barra horizontal que converge na coluna do chefe. A barra é desenhada com bordas, porque o filtro de HTML do cliente (Caja) não aceita SVG. O trecho percorrido fica em destaque;
  - entre os andares continuam os caracteres `│╱╲`, maiores.
- **Força dos encontros:** num teste do usuário, um Gyarados selvagem nível 20 no andar 4 do ato 1 venceu um time nível 18.
  - **Como ficou:** o sorteio olha também a força da espécie no estágio sorteado, pela soma dos atributos base. Acima do teto do nível, sorteia de novo (`maxBstForLevel`, escolha nossa: 330 até o nível 12, depois 9 por nível; nível 20 = 400, nível 37 = 553, pseudo-lendários a partir do 42);
  - os treinadores do banco do Desafio também só entram com os Pokémon dentro do teto;
  - o nó de lendário fica fora do teto;
  - a calibração da experiência usa as mesmas espécies, então o multiplicador se ajusta sozinho.
- **Tooltips** (pedido do usuário):
  - **Pokémon do time** (e da captura e da troca): tipos, habilidade com a descrição, natureza (o atributo que sobe e o que desce), item, atributos no nível (base, IVs e natureza, sem EVs, com a barra do atributo base) e golpes (tipo, categoria, poder, precisão, PP restantes e descrição);
  - **golpe novo:** descrição completa do golpe novo, atributos do Pokémon ao lado, e tooltip com a descrição completa em cada golpe conhecido;
  - **evolução:** o botão de cada evolução mostra o Pokémon já evoluído, com os atributos novos;
  - **descrições:** no idioma do jogador, pelo catálogo de textos do PS (`data/text/pt`);
  - **como funciona:** só CSS. O servidor manda o conteúdo escondido dentro do elemento (`span.exp-tip > span.exp-tip-body`, `tooltips.ts`), e a regra injetada por `client-custom.js` mostra o conteúdo no hover. O filtro de HTML das páginas não deixa passar scripts;
  - **cuidados:** o conteúdo usa só elementos de linha (`span`), porque um `<table>` ou `<div>` dentro de `<p>` ou `<button>` faz o navegador fechar o parágrafo e desmontar o tooltip. As caixas da página têm `overflow: visible`, porque a `.infobox` do PS cortaria o tooltip. Dentro das tabelas `.ladder`, a cor volta ao normal, porque o PS pinta todo `span` delas de cinza.
- **Uma aba só** (pedido do usuário; também evita mexer na run pela página durante a batalha):
  - ao abrir a batalha (ou voltar a ela), o servidor fecha a aba da página da run;
  - no fim, o botão "Voltar para a expedição" da sala (`expeditionReturn`, em `client-custom.js`, que só aceita páginas de run) fecha a aba da batalha e abre a da run, ou foca e atualiza a aba se ela estiver aberta.
- **Mega Stones** (decisão do usuário): item raro. No nó de item, 10% de chance (escolha nossa) de uma das três opções ser uma Mega Stone, de preferência uma que algum Pokémon do time (ou a evolução dele) usa. A loja e os eventos ficam para depois.

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

## Etapa 2: batalhas (feita em 2026-10-21)

- **Código novo:**

  | Arquivo | O que faz |
  |---|---|
  | `formats.ts` | Formato escondido de cada variação e a variante em dupla, com a regra que aplica e devolve o estado do time. |
  | `species.ts` | Espécies sorteáveis, lendários e evolução pelo nível (dos NPCs e por nível do jogador). |
  | `progression.ts` | Progresso da run, nível e tamanho dos adversários, multiplicador de experiência, ganho de experiência e evolução. |
  | `encounters.ts` | Encontro de cada nó de batalha, pelas três fontes. |
  | `battles.ts` | Começa, retoma e termina a batalha de um nó e aplica o resultado à run. |

- **Mudança no `NpcBattle`** (compartilhado com o Desafio):
  - `npc.playerData` leva campos extras nas opções do lado do NPC;
  - `hooks.onPrivateLine` recebe linhas privadas do formato, que não vão ao cliente;
  - `autoPlayer` faz uma IA jogar pelo desafiante (batalha automática), e as jogadas do usuário são recusadas.
- **Estado do time na batalha:**
  - **ida:** vai nas opções do lado do NPC (`expedition.p1`, HP em fração e PP gastos), que ficam no registro de entrada. O `onBegin` do formato aplica o estado, e a retomada pelo save state aplica de novo;
  - **volta:** o formato envolve o `win` da batalha e manda o estado final do lado do jogador na linha privada `|expeditionstate|`. Isso vale para vitória, derrota, desistência e empate;
  - Pokémon desmaiados ficam fora da batalha.
- **Batalha:**
  - **começo:** no nó, "Batalhar!" abre a sala;
  - **interrupção:** a batalha fica aberta e volta ao entrar com a conta, ou pelo botão "Continuar a batalha". Com save state, volta do ponto em que parou; sem ele, começa de novo, com o mesmo encontro e o mesmo estado do time;
  - **desistência:** desistir da run com batalha aberta dá forfeit.
- **Resultado:**
  - **vitória:** o estado final volta para o time, e cada Pokémon que não desmaiou ganha a experiência de todos os derrotados. Golpes novos com espaço entram na hora. Com quatro golpes, e nas evoluções por nível, a decisão vai para a fila. Depois vem a regra de desmaio (Nuzlocke tira os desmaiados) e a de desgaste (cura total, se for o caso), e o nó termina;
  - **derrota ou empate:** a run acaba. O empate só acontece quando o último Pokémon dos dois lados cai.
- **Decisões:**
  - a página mostra a primeira da fila, e o mapa espera;
  - **golpe novo:** escolher qual esquecer, ou não aprender;
  - **evolução:** as opções do Pokémon juntas, ou "Agora não". Ela é oferecida de novo a cada subida de nível;
  - **na evolução:** a habilidade fica no mesmo espaço (comum 1, comum 2 ou oculta), e o HP proporcional se mantém;
  - **run vencida:** as decisões pendentes são descartadas.
- **Encontros** (gerados pela semente da run e pelo nó):
  - **selvagem:** 1 Pokémon, da Pokédex ou da lista da variação;
  - **lendário:** 1 lendário (nó raro);
  - **treinador:**
    - Pokédex: espécies diferentes, com classes de treinador e sprites oficiais;
    - banco do Desafio: o time do treinador, ou parte dele, no nível do andar, sem treinadores com lendários;
    - lista da variação;
  - **chefe:** 6 Pokémon, com a chance de um lendário (`bossLegendaryChance`);
  - golpes do nível e IVs sorteados, sem EVs. Os treinadores do banco ficam com os golpes e os EVs deles.
- **Variação de teste:**
  - **chances:** selvagem 45, treinador 30, item 15, descanso 10 e lendário 3;
  - **fontes:**
    - selvagem: Pokédex 70 e lista 30;
    - treinador: Pokédex 50, banco 25 e lista 25;
    - chefe: Pokédex 40, banco 40 e lista 20;
  - **lista própria:** 16 espécies clássicas e 3 treinadores temáticos (inseto, pedra e água);
  - **lendários:** chance de lendário no chefe de 20%;
  - **IA:**
    - selvagem: Aleatório na primeira metade e Fácil na segunda;
    - treinador: Fácil, Médio e Difícil, em terços;
    - chefe: Difícil, e Mestre a partir de três quartos da run (o único chefe da variação de teste usa a Mestre);
    - lendário: Difícil (escolha minha, ajustável);
  - **níveis:** 30 por ato (`extra.levelsPerAct`, ajustável no painel entre 10 e 50). Ver "Revisão da etapa 2".
- **Experiência:** a primeira versão mirava o nível 90 no último andar. Ela foi substituída na revisão abaixo.
- **Validado:**
  - **testes de unidade:**
    - estágio pelo nível e níveis das evoluções especiais;
    - lendários fora da lista comum;
    - experiência (desmaiados não ganham, golpes com espaço, fila de decisões, evolução);
    - calibração;
    - encontros determinísticos e coerentes com as regras (treinadores sem lendários, IA do chefe, tamanhos);
    - derrota que encerra a run, com o resultado contado uma vez só;
    - decisões de golpe e evolução, com o mapa esperando;
    - batalha real com o estado do time: HP de 50% aplicado e devolvido, PP gastos devolvidos e forfeit encerrando a run;
    - batalha automática até o fim, sem jogadas do usuário;
  - os 2620 testes do servidor;
  - **teste de ponta a ponta:** 15 passos. O admin entra no nó selvagem do primeiro andar (nível 4 a 6), abre a batalha, desiste com `/forfeit` e vê a derrota na página.

## Revisão da etapa 2: ritmo e telas (2026-10-21)

Pedido do usuário depois da etapa 2: o time subia níveis demais no começo, e o ritmo precisa escalar por ato. Telas validadas no navegador com vitórias de verdade.

- **Medição da versão anterior** (20 runs simuladas da variação de teste):
  - o time subia de 11 a 16 níveis por batalha (adversários nos níveis 5, 16, 30, 43 e 50);
  - chegava ao chefe no nível 61, com o chefe no 92;
  - as decisões de golpe passavam de 10 por batalha no time de três.
- **Decisões do usuário:**
  - níveis por ato, com **30 por ato** como padrão: os chefes dos atos 1, 2 e 3 ficam por volta dos níveis 37, 67 e 97;
  - **sem nível fixo:** a experiência dos jogos, com cálculo pela média. Azar nos encontros, ou escolha de nós sem batalha, dá menos níveis. Um caminho otimizado pode passar um pouco do nível do chefe. A variação deve ser baixa;
  - "pular todos" nas decisões de golpe: ver depois do ajuste.
- **Como ficou** (`progression.ts`):
  - **curva:** o nível de um andar é o nível inicial mais `levelsPerAct` × (ato − 1 + andar / andares), até o 100. Os adversários seguem a curva (±1), e o chefe fica 2 acima;
  - **calibração do multiplicador:** 24 caminhos ao acaso em mapas gerados com a configuração da variação, o "jogador médio" vencendo todas as batalhas. O multiplicador faz a chegada média a cada chefe bater com a curva. O cálculo leva até 1 s por configuração, feito na carga do servidor e guardado;
  - **peso do chefe** (segundo número calibrado, só com mais de um ato): o chefe fica dois andares acima da última batalha, porque o andar antes dele é descanso, e tem 6 Pokémon evoluídos. Sem esse peso, ele dava cerca de 20 níveis e jogava o time muito acima do começo do ato seguinte. O peso faz o time sair do chefe 1 nível acima do nível dele;
  - **batalhas com vários adversários:** a vitória vale a média dos derrotados vezes a raiz da quantidade. Um treinador com 4 Pokémon vale o dobro de um selvagem, e não 4 vezes;
  - **curva de experiência:** nível elevado a 2,5, na escala da "média rápida" (1.000.000 no nível 100). Com a cúbica dos jogos, a primeira vitória (nível 5) dava 8 níveis; com a quadrática, os últimos atos estouravam.
- **Simulação final** (40 runs por cenário, três estratégias: caminho ao acaso, prioridade às batalhas, evitar batalhas):

  | Cenário | Chegada ao chefe: ao acaso | prioridade às batalhas | evitar batalhas | Curva |
  |---|---|---|---|---|
  | 1 ato de 6 andares (teste) | 36,6 | 37,6 | 35,0 | 35 |
  | 3 atos, ato 1 | 33,4 | 34,2 | 32,4 | 35 |
  | 3 atos, ato 2 | 68,0 | 70,4 | 65,5 | 65 |
  | 3 atos, ato 3 | 97,6 | 98,8 | 95,5 | 95 |

  - **ganho por batalha:** cerca de 5 níveis na primeira vitória e 6 a 7 por andar depois;
  - **decisões de golpe:** de 1 a 2 por Pokémon a cada batalha no começo, caindo ao longo da run. O "pular todos" ficou para o usuário avaliar;
  - **casos extremos:** em mapas com poucos nós de batalha no caminho, a chegada ao chefe do ato 1 pode cair para perto do nível 17.
- **Telas** (validadas no navegador com runs completas, vitórias de verdade, evolução e derrota no chefe):
  - **time:** barra de experiência (com o que falta para o próximo nível no título) e barra de HP colorida;
  - **resumo da vitória:** experiência ganha, níveis (5 → 9), golpes aprendidos na hora e desmaiados sem experiência. Fica na página até o próximo nó;
  - **golpe novo:** tipo, categoria, poder, precisão e PP do golpe novo e dos quatro conhecidos, mais as decisões restantes;
  - **evolução:** aviso de que a evolução é oferecida de novo na próxima subida de nível;
  - **nó de treinador e de chefe:** sprite do treinador;
  - **fim da batalha:** a sala mostra o resultado ("Vitória! A expedição continua.", "Derrota. A expedição acabou." ou "Expedição concluída. Parabéns!") e o botão "Voltar para a expedição". Sem ele, fechar a sala da batalha leva para a Home;
  - **run encerrada:** quem venceu o time, até onde chegou (andar e ato) e o time no fim.
  - Migração 3 do banco: `runs.last_battle` (resumo da última batalha).
- **Achados levados ao usuário, e as decisões (2026-10-21):**
  - **desmaiados ficavam para trás:** numa run validada, um Pokémon que desmaiou cedo ficou sem experiência até o descanso. Dois dos três iniciais chegaram ao chefe no nível 9, e o terceiro no 35.
    - **Decisão:** há o modo padrão e o modo Nuzlocke. No padrão, quem desmaiou ganha metade da experiência (`FAINTED_EXP_SHARE`). No Nuzlocke, os desmaiados saem do time, e um time com menos Pokémon que o máximo da variação ganha um pouco mais (`nuzlockeBonus`: até 50% a mais com um Pokémon só; o tamanho da escala foi escolha nossa).
    - **Etapa 3:** haverá outros meios de curar os desmaiados, como itens de reviver comprados em lojas. A loja é um tipo de nó, e o dinheiro vem das batalhas contra treinadores, como nos jogos.
  - **nó de lendário cedo demais:** numa run validada, Articuno no andar 2 venceu o time.
    - **Decisão:** o nó fica bem raro e só aparece a partir do segundo ato ou, nas expedições de um ato, na metade final dele.
    - **Como ficou:** regra da base no mapa (`lateTypes`).
    - **Ajuste (2026-10-21):** o lendário não deve aparecer em toda run. Ele saiu dos pesos e virou nó raro (`rareNodes`): o ato tem uma chance de ganhar um único nó de lendário, num andar permitido e sem outro logo antes ou depois. Na variação de teste, a chance é de 10% (`rare:legendary`, ajustável no painel). Medido em 1000 mapas: 10,8% têm o nó, e o jogador ainda precisa escolher passar por ele.
  - **selvagens com sprite de treinador:** na batalha, o lado do selvagem mostrava um sprite de treinador qualquer, porque o PS sempre mostra um avatar.
    - **Decisão:** um sprite novo de mato alto.
    - **Como ficou:**
      - arte nossa, em pixel art, gerada por `scripts/sprites/mato.py` em `assets/sprites/trainers-custom/expeditiongrass.png` (no git);
      - o Caddy serve o arquivo em `/sprites/trainers-custom/expedition*.png`, e um nome inexistente dá 404, sem ir ao site oficial;
      - os selvagens e os lendários usam o avatar `#expeditiongrass`, que o cliente busca em `trainers-custom`.

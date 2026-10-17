# Arquitetura: Desafio de Ginásios

> **Status:** revisada pelo usuário em 2026-10-17, com as respostas incorporadas. Todas as questões estão respondidas ([seção 12](#12-questões-em-aberto)). Nada foi implementado ainda.
>
> Este documento separa três coisas:
> - **Requisitos**: o que o usuário definiu. Fonte: seção "Modo: Desafio de Ginásios" do [CLAUDE.md](../CLAUDE.md).
> - **Propostas técnicas**: como implementar. Podem ser mudadas.
> - **Questões em aberto**: regras que ainda precisam de decisão. Ficam na [seção 12](#12-questões-em-aberto).

## 1. Resumo

O Desafio de Ginásios é um modo em que o jogador enfrenta treinadores controlados pelo computador, criados pelo admin. São os **líderes de ginásio**, a **Elite 4** (opcional) e o **Campeão**. O admin pode manter vários desafios ao mesmo tempo, cada um com suas regras.

Cada tentativa de um jogador é uma **jornada**. Ela começa do zero, junta insígnias e termina quando o jogador vence o Campeão, desiste ou é eliminado. Quem vence leva as conquistas para o perfil.

A proposta é construir tudo como um **plugin do servidor de jogo** (no fork `server/`), em arquivos próprios, sem alterar o código da Smogon. A única exceção é um ajuste pequeno, discutido na [seção 6](#6-como-o-jogador-inicia-uma-batalha-decisão-principal).

## 2. Requisitos (resumo)

| Tema | Regra |
|---|---|
| Desafios | Vários ao mesmo tempo, cada um com seus líderes e regras |
| Montagem (admin) | Quantidade de ginásios, tipos (fixos ou sorteados), Elite 4 sim ou não, times de líderes, Elite 4 e Campeão |
| Quantidade de ginásios | **Configurável** por desafio |
| Tipos sorteados | Tantos tipos quantos forem os ginásios, sorteados **a cada jornada** entre os líderes que o admin selecionou para o desafio. A Elite 4 e o Campeão são **sempre fixos** |
| Elite 4 e Campeão | A Elite 4 (ou o Campeão, se não houver Elite 4) exige **todas as insígnias** do desafio. Elite 4 e Campeão formam **uma sequência direta**, como nos jogos: perder em qualquer ponto volta ao primeiro membro da Elite 4 |
| Treinadores | **Podem ser reaproveitados** entre desafios |
| Ordem dos ginásios | **Livre por padrão**, e o admin pode fixar uma ordem (configurável por desafio) |
| Controle dos NPCs | Computador. Começa com bots aleatórios e deve ficar pronto para IAs com níveis de dificuldade |
| Dificuldade | É a capacidade da IA de escolher bem, e é definida **para cada treinador dentro de cada desafio** (o mesmo treinador pode ser Fácil num desafio e Difícil em outro). O nível mais fácil é o bot aleatório padrão. O desafio tem uma **dificuldade base, que é o mínimo** para todos os seus treinadores |
| Formato | Um único por desafio. O admin escolhe formato, limite de geração e mecânicas. Padrão: Pokédex até a gen 9, Mega liberada, sem Z-Moves, Dynamax e Tera. Existe opção de formato livre |
| Trava de time | Opcional por desafio. Com ela, a jornada inteira usa **os mesmos sets**. Trocar **apelido ou ordem** é permitido; qualquer outra mudança exige uma nova jornada |
| Restrição de tipo | Líderes: tipo do ginásio. **Elite 4: com restrição de tipo. Campeão: sem restrição**. A validação é automática |
| Timer | O admin escolhe por desafio: **limite por turno** ou **tempo livre** (sem limite). O **tempo total** da batalha nunca é limitado |
| Insígnias (imagem) | Ícones de tipo do PS como placeholder; depois, imagens das insígnias dos jogos oficiais |
| Visibilidade | Batalhas contra NPC são **públicas** |
| Visual | Todas as telas, inclusive o painel admin e as páginas de conta, seguem a **identidade visual oficial do PS** |
| Fork | Mudanças no fork (servidor e cliente) são permitidas, **desde que não quebrem os modos oficiais** |
| Jornada | Insígnias pertencem à jornada. Vencer o Campeão leva as conquistas ao perfil |
| Fim da jornada | Vitória, desistência, eliminação ou encerramento pelo admin. O histórico fica salvo, e uma nova jornada recomeça do zero |
| Tentativas | Ilimitadas por padrão, inclusive Elite 4 e Campeão |
| Opções de eliminação | Limite de derrotas (total da jornada), eliminação ao perder para a Elite 4, eliminação ao perder para o Campeão |
| Elite 4 | Enfrentada em sequência, como nos jogos |
| Campeão | Exige todas as insígnias da jornada |
| Admin encerra | O desafio inteiro ou a jornada de um jogador. O histórico é mantido, e o desafio fica marcado como encerrado |
| Placar | Vitórias e derrotas por jornada e total do desafio, mais histórico de jornadas |
| Conquistas repetidas | Acumulam. Num futuro ranking de pontos, vitórias repetidas não pontuam |
| Painel admin | Páginas dentro do cliente do PS, só para quem tem rank `~` |
| Futuro | Modo "Hardcore" (uma tentativa só), ranking de pontos, modo roguelite |

## 3. Glossário

- **Desafio**: uma "liga" configurada pelo admin, com nome, formato, regras e etapas. Estados: *rascunho*, *aberto*, *encerrado*.
- **Etapa**: cada batalha prevista no desafio. Pode ser um **ginásio** (que dá insígnia), um **membro da Elite 4** ou o **Campeão**.
- **Treinador (NPC)**: personagem controlado pelo computador, com nome, time e nível de IA. Um treinador pode ser reaproveitado em mais de um desafio (a confirmar, questão 12.2).
- **Jornada**: uma tentativa de um jogador num desafio. Estados: *ativa*, *vencida*, *desistida*, *eliminada*, *encerrada pelo admin*.
- **Insígnia**: marca de ginásio vencido **dentro de uma jornada**.
- **Conquista**: registro no perfil do jogador de que ele **venceu um desafio** (uma por jornada vencida).

## 4. Visão geral

```
                         servidor de jogo (fork server/)
┌──────────────────────────────────────────────────────────────────────────┐
│  server/chat-plugins/gym-challenge/                                      │
│                                                                          │
│  pages.ts ───────┐    (páginas do jogador e do admin, comandos /ginasio) │
│  commands.ts ────┤                                                       │
│                  ▼                                                       │
│              rules.ts   ← regras puras: jornada, insígnias, eliminação,  │
│                  │        Elite 4 em sequência (sem PS, fácil de testar) │
│                  ▼                                                       │
│              store.ts   ← persistência (SQLite: databases/gym-challenge.db)
│                  ▲                                                       │
│  handlers.ts ────┘  ← onBattleEnd: registra o resultado na jornada       │
│                                                                          │
│  npc-battle.ts  ← cria a batalha e coloca o NPC num dos lados            │
│       │                                                                  │
│       ▼                                                                  │
│  ai/  ← interface NpcAI + implementações (random agora; níveis depois)   │
│                                                                          │
│  formats.ts ← gera os formatos dos desafios (config/custom-formats.ts)   │
└──────────────────────────────────────────────────────────────────────────┘
         ▲ protocolo normal do PS (WebSocket)
         │
   cliente do PS (sem alterações): tela principal, teambuilder, batalha, páginas
```

Por que dividir assim:

- **`rules.ts` não depende do PS.** Todas as regras ficam em funções puras, como "esta jornada pode enfrentar o Campeão?" e "esta derrota elimina?". São as partes com mais detalhes, e assim ganham testes unitários simples.
- **`npc-battle.ts` isola o acoplamento com o código interno do PS** (`RoomBattle`). Se a Smogon mudar algo ali, o conserto fica num só arquivo.
- **`ai/` é uma interface.** Trocar o bot aleatório por uma IA melhor não mexe no resto.

## 5. Batalha contra NPC (proposta técnica)

**O que existe no PS** (verificado no código): o servidor **não** tem bots próprios. O `RandomPlayerAI` (`sim/tools/random-player-ai.ts`) só é usado em ferramentas e testes. Mesmo assim, a estrutura permite um NPC "dentro do processo":

1. `Rooms.createBattle({format, players: [{user: jogador, team}], delayedStart: true})`. O segundo lugar fica vazio (`RoomBattlePlayer` aceita jogador sem usuário).
2. O time do NPC é enviado direto para o simulador: `battle.stream.write('>player p2 {"name": "Líder Brock", "team": "<time empacotado>"}')`.
3. Os pedidos de jogada do lado do NPC (`sideupdate` → `|request|`, em `server/room-battle.ts`) são entregues à IA, que responde com `>p2 <escolha>`.
4. O resultado chega pelo handler de plugin `onBattleEnd(battle, winner, players)`, que atualiza a jornada.

**Cuidados identificados:**

- **Timer de inatividade:** o timer trata um lado sem usuário como desconectado. O NPC precisa ser marcado como ativo, senão o timer daria a vitória por W.O.
- **Início da batalha:** com `delayedStart`, o PS não dispara sozinho os eventos de início, então eles precisam ser chamados manualmente.
- **Jogadas inválidas da IA** voltam como erro. A IA tenta de novo e, se continuar falhando, usa a jogada padrão.

**Interface da IA** (base para os níveis de dificuldade):

```ts
interface NpcAI {
	/** Recebe o pedido do simulador e o que o NPC já viu da batalha; devolve a escolha ("move 1", "switch 3"...). */
	choose(request: ChoiceRequest, view: BattleView): string;
}
```

- `BattleView` acompanha o log público da batalha: Pokémon ativos, HP, status e clima. Uma IA "esperta" precisa disso, e o bot aleatório simplesmente ignora.
- Primeira implementação: `RandomAI`, com a mesma lógica do `RandomPlayerAI` do PS.
- **Nível de IA:** é definido **por treinador em cada desafio** (`ai_level` em `challenge_stages` e `challenge_pool`). A dificuldade base do desafio (`base_ai_level`) é o **mínimo**, então o nível efetivo é `max(base_ai_level, ai_level)`. O nível mais fácil é o bot aleatório padrão (`random`), que não avalia a batalha. O que diferencia os demais níveis será definido depois.
- **Timer:** o admin escolhe por desafio (`timer_mode`). Com `turn`, existe um limite de tempo por turno (o valor também é configurável). Com `free`, não há limite nenhum. Nos dois casos, o banco de tempo total da batalha fica desligado. O NPC responde na hora.
- **Visibilidade:** as batalhas são **públicas**. Aparecem na lista de batalhas, e qualquer um pode assistir, inclusive guests.

**Alternativa descartada por enquanto:** NPCs como contas de bot conectadas por WebSocket, como os bots externos da comunidade. Seria mais isolado do código interno, mas exige um serviço a mais, contas de bot e uma conexão por NPC, e o nome do líder não apareceria na batalha.

## 6. Como o jogador inicia uma batalha (decisão principal)

**O problema:** os times do jogador ficam **no navegador**. O cliente do PS só deixa escolher time em dois lugares: na tela principal ("Battle!", que faz `/utm` + `/search`) e ao desafiar ou aceitar outro **usuário**. As páginas do servidor não têm seletor de time. Além disso, o handler `onLadderSearch` **não consegue cancelar** uma busca: o `searchBattle` roda de qualquer forma (`server/chat-commands/core.ts`, comando `search`).

**Opções:**

| | Como funciona | Prós | Contras |
|---|---|---|---|
| **A (aprovada)** | Cada desafio vira um **formato** ("[Desafio] Liga Kanto"). O jogador escolhe esse formato e o time na tela principal e clica em **Battle!**. Um ajuste de ~3 linhas no comando `search` permite que o handler `onLadderSearch` assuma a busca. O plugin então valida o time e inicia a batalha contra o NPC da próxima etapa | Usa a interface que o jogador já conhece. O teambuilder já valida o time no formato do desafio. Funciona nos dois clientes | Altera um arquivo da Smogon (mudança mínima, mas pode conflitar em merges). Os formatos precisam ser recarregados quando o admin cria ou edita um desafio |
| B | Igual à A, mas sem alterar o PS: depois do `/search`, o plugin cancela a busca e inicia a batalha contra o NPC | Nenhuma mudança na Smogon | Frágil: existe uma janela em que dois jogadores buscando o mesmo desafio podem ser pareados entre si |
| C | O jogador cola o time (texto exportado) num formulário da página do desafio | Simples, sem mudanças no PS | Experiência ruim, e o time não vem do teambuilder |
| D | O servidor envia um **desafio** "do NPC" para o jogador, e o cliente mostra a janela de aceite com seletor de time | Interface natural, como um desafio comum | O `/accept` espera um usuário real; exigiria mudanças maiores no PS |

**Decisão (2026-10-17):** opção A. O usuário autorizou mudanças no nosso fork do servidor e do cliente, desde que não quebrem os modos oficiais. O ajuste no `search` só muda o comportamento quando o formato é de um desafio de ginásio. Para todos os outros formatos, a busca segue exatamente como na Smogon.

**Fluxo (opção A):**

1. Na página do desafio, o jogador vê as etapas, as insígnias e qual é a próxima batalha. Também pode **escolher qual ginásio enfrentar**, se a ordem for livre (questão 12.5).
2. Ele escolhe o formato "[Desafio] …" e o time na tela principal e clica em **Battle!**.
3. O plugin valida:
   - o time no formato do desafio;
   - a trava de time;
   - se a jornada está ativa;
   - se é possível enfrentar o Campeão (todas as insígnias) ou a Elite 4.
4. Se tudo estiver certo, inicia a batalha contra o NPC. Senão, mostra o motivo.

**Formatos dinâmicos:** o `config/custom-formats.ts` passa a ler os desafios abertos (gerados pelo plugin) e cria um formato para cada um, numa seção "Desafio de Ginásios". Quando o admin salva um desafio, o plugin recarrega os formatos (o mesmo mecanismo do `/hotpatch formats`).

**A prova de conceito (seção 11, fase 1) precisa confirmar duas coisas:**
- o ajuste no `search`;
- se os clientes recebem a nova lista de formatos sem precisar recarregar a página.

## 7. Formato e validação

**Formato do desafio = formato base + regras personalizadas**, na sintaxe nativa do PS (`formato@@@regra1,regra2`, ver `server/config/CUSTOM-RULES.md`). Regras que já existem no PS e cobrem os requisitos:

| Requisito | Regra do PS |
|---|---|
| Pokédex até a gen 9 (todas as gerações) | base `[Gen 9] National Dex` (ou `NatDex Mod`) |
| Sem Tera | `Terastal Clause` |
| Sem Dynamax | `Dynamax Clause` |
| Sem Z-Moves | `Z-Move Clause` |
| Sem Mega (quando o admin quiser) | `- Mega` |
| Limite de geração | `Min Source Gen = N`, `- Future` e similares, ou Pokédex regionais (`Kalos Pokedex`…) |
| Tamanho do time e nível | `Max Team Size`, `Picked Team Size`, `Adjust Level`, `Max Level` |
| Formato livre | base `[Gen 9] Custom Game` |

- **Time de líder e de membro da Elite 4:** é validado no formato do desafio **mais** a regra `Force Monotype = <Tipo>`, que já existe no PS e exige que todos os Pokémon tenham o tipo. O Campeão é validado só no formato. A validação roda quando o admin salva o treinador e de novo quando o desafio é aberto, porque o mesmo treinador pode servir em desafios com formatos diferentes.
- **Trava de time (sets idênticos):** o PS não tem nada que identifique "o mesmo time". Na primeira batalha da jornada, guardamos o hash SHA-256 do time **empacotado exatamente como foi validado** pelo PS. Nas batalhas seguintes, o hash precisa ser igual. Antes do hash, o time é **normalizado**: os apelidos são removidos e os Pokémon são ordenados, porque trocar apelido ou ordem é permitido. Qualquer outra diferença (espécie, item, golpe, EV, IV, natureza, habilidade, nível, gênero, shiny e afins) bloqueia a batalha e explica que é preciso começar uma nova jornada.

## 8. Modelo de dados

SQLite próprio do plugin, em `server/databases/gym-challenge.db`, usando o `node:sqlite` do Node 24 (o mesmo do login). O `better-sqlite3` que o PS usa não está instalado. Só guardamos **IDs de usuário** (sem IP e sem nada além do necessário).

```
trainers           id, name, title, type (líder/Elite 4; vazio no Campeão),
                   team (empacotado),
                   badge_image (vazio = ícone de tipo do PS como placeholder),
                   created_at, updated_at
                   → banco de treinadores, reaproveitável entre desafios

challenges         id, name, status (draft|open|closed), base_format, custom_rules,
                   type_mode (fixed|random), gym_count, order_mode (free|fixed),
                   has_elite4, team_lock, base_ai_level, timer_mode (turn|free),
                   turn_seconds,
                   loss_limit (vazio = sem limite), eliminate_on_elite4_loss,
                   eliminate_on_champion_loss, created_at, opened_at, closed_at

challenge_stages   challenge_id, position, kind (gym|elite4|champion), type,
                   trainer_id, ai_level (vazio = base do desafio)
                   → tipos fixos: as etapas exatas definidas pelo admin

challenge_pool     challenge_id, trainer_id, ai_level (vazio = base do desafio)
                   → tipos sorteados: os líderes do banco que o admin selecionou
                     para este desafio (o tipo vem do próprio treinador)

runs               id, challenge_id, userid, status (active|won|abandoned|
                   eliminated|closed_by_admin), team_hash, started_at, ended_at,
                   end_reason

run_stages         run_id, position, kind, type, trainer_id, ai_level (efetivo)
                   → "foto" das etapas desta jornada, gravada quando ela começa
                     (cópia das etapas fixas ou resultado do sorteio). Assim,
                     editar o desafio depois não altera jornadas em andamento

run_battles        id, run_id, stage_position, roomid, result (win|loss|tie),
                   started_at, ended_at

run_badges         run_id, stage_position, earned_at

achievements       userid, challenge_id, run_id, earned_at
```

- **Sorteio por jornada:** quando a jornada começa, são sorteados **`gym_count` tipos distintos** entre os tipos dos líderes selecionados no `challenge_pool`. Para cada tipo, um dos líderes daquele tipo é escolhido. O desafio só pode ser aberto se os líderes selecionados cobrirem pelo menos `gym_count` tipos diferentes. A **Elite 4 e o Campeão são sempre fixos** (`challenge_stages`), também no modo sorteado.
- **Placar da jornada:** contado a partir de `run_battles` da jornada. O total do desafio soma todas as jornadas daquele jogador naquele desafio.
- **Ordem fixa:** com `order_mode = fixed`, só a próxima etapa da sequência pode ser enfrentada. Com `free`, qualquer ginásio ainda não vencido.
- **Elite 4 + Campeão em sequência:** liberada com todas as insígnias da jornada. O jogador enfrenta os membros da Elite 4 e o Campeão em seguida. A posição atual é derivada das últimas batalhas da jornada, e uma derrota em qualquer ponto volta ao primeiro membro da Elite 4. Sem Elite 4, o Campeão é liberado com todas as insígnias.
- **Encerramento:** encerrar o desafio muda o status para `closed` e as jornadas ativas para `closed_by_admin`. Nada é apagado.

## 9. Páginas e comandos

**Jogador** (qualquer usuário logado; guests só veem):

- `view-ginasios`: lista de desafios abertos e encerrados, com a jornada atual de cada um.
- `view-ginasios-desafio-<id>`: etapas, insígnias da jornada, placar, próxima batalha, botões "Iniciar jornada" e "Desistir".
- `view-ginasios-historico-<id>`: histórico de jornadas do jogador naquele desafio.
- `view-ginasios-perfil-<usuario>`: conquistas e desafios vencidos.
- Comandos de apoio: `/ginasio` (abre a lista) e `/ginasio desistir <id>`.

**Admin** (rank `~`; para os demais, a página não existe):

- `view-ginasiosadmin`: painel com os desafios (rascunho, aberto, encerrado) e os treinadores.
- `view-ginasiosadmin-treinador-<id>`: nome, título, tipo, nível de IA e o time, colado em formato de exportação do teambuilder. A validação aparece na hora: o tipo sempre, e o formato de cada desafio em que o treinador é usado.
- `view-ginasiosadmin-desafio-<id>`: nome, formato base, regras, modo de tipos (fixos ou sorteados), quantidade de ginásios, ordem (livre ou fixa), Elite 4, trava de time, dificuldade base, limite de derrotas e eliminações. Inclui a atribuição de treinadores às etapas (tipos fixos) ou ao banco por tipo (tipos sorteados) e os botões "Abrir" e "Encerrar".
- `view-ginasiosadmin-jornadas-<id>`: jornadas do desafio, com a ação "Encerrar jornada" de um jogador.

Os formulários usam os recursos nativos das páginas do PS (`<form data-submitsend>`, `<textarea>`, `<select>`). O plugin de times do PS (`server/chat-plugins/teams.ts`) tem um exemplo de formulário com área de texto para time.

**Identidade visual:** todas as telas seguem o visual oficial do PS.

- **Páginas dentro do cliente** (jogador e admin): usam apenas as classes que o cliente já estiliza (`infobox`, `button`, `textbox`, `ladder` para tabelas, `pad` e os ícones de tipo e de Pokémon do próprio PS), do mesmo jeito que as páginas oficiais (ladder, help tickets, times). Sem CSS próprio inventado.
- **Ícones** (insígnias, tipos, sprites de treinador): usam os recursos que o cliente já tem (`sprites/types`, `sprites/trainers`, ícones de Pokémon). As insígnias usam os ícones de tipo do PS como placeholder. O campo `badge_image` já fica previsto para as imagens das insígnias dos jogos oficiais.
- **Páginas fora do cliente** (`/cadastro`, `/conta`, `/redefinir`): usam o mesmo CSS das janelas do cliente clássico (`battle.css` + `oldclient.css`: `.ps-popup`, `.textbox`, `.button`) sobre o fundo padrão. Ficam iguais às janelas de login e de cadastro do jogo.
- Se alguma tela precisar de um componente que o cliente não tenha, ele entra no **nosso fork do cliente** no mesmo estilo e sem mudar o comportamento dos modos oficiais.

## 10. LGPD e exclusão de conta

- **Dados guardados:** só o `userid` e os resultados (jornadas, batalhas, insígnias, conquistas). Sem IP.
- **Exclusão de conta:** quando o jogador exclui a conta em `/conta`, as jornadas, batalhas, insígnias e conquistas dele precisam ser apagadas no servidor de jogo. O mesmo vale para o ranking da ladder e o `usergroups.csv`, pendência já registrada.

  Proposta:
  1. O login guarda temporariamente (por exemplo, 30 dias) apenas o `userid` excluído, numa lista de exclusões pendentes.
  2. O plugin consulta essa lista pela API interna a cada minuto e apaga tudo do usuário.
  3. Confirmada a limpeza, o registro sai da lista.

  Assim um nome excluído e recadastrado depois por outra pessoa não herda dados antigos.

- **Histórico do desafio:** depois da exclusão, as jornadas daquele jogador deixam de aparecer. O desafio continua com o histórico dos demais.

## 11. Plano de entrega (fases)

### Resultado da fase 1 (2026-10-17)

A prova de conceito foi validada com um teste de ponta a ponta pelo fluxo real: conta criada por convite, `/utm` + `/search` no formato de desafio, batalha inteira contra o NPC e resultado entregue ao plugin.

- **Batalha contra NPC dentro do processo: funciona.** Ficou na classe `NpcBattle` (subclasse de `RoomBattle`), em `server/chat-plugins/gym-challenge/npc-battle.ts`. O NPC é o jogador p2, sem usuário. Ele é marcado como ativo, então o timer nunca o considera desconectado: validado com `/timer on` durante a batalha. Responde aos pedidos de jogada pela `NpcAI`.
- **IA:** `RandomAI` reaproveita o `RandomPlayerAI` do PS (`ai.ts`). A interface `NpcAI` e o `BattleView` (log público da batalha) já estão prontos para os outros níveis.
- **Ajuste no fork:** 6 linhas no total. Um handler `onSearchOverride` foi declarado em `server/chat.ts`, e o comando `search` em `server/chat-commands/core.ts` passou a consultá-lo. Testado: a busca em `gen9randombattle` continua indo para a fila normal.
- **Formato do desafio:** `config/custom-formats.ts` (agora versionado no fork) cria a seção "Desafio de Ginásios", com o campo `gymChallenge` que identifica o formato para o plugin. As regras do padrão foram validadas: Mega liberada, Z-Crystal bloqueado, Pokémon da gen 9 aceitos, e `Force Monotype = Fire` aceita o time de Fogo e recusa como Água.
- **Recarga de formatos:** o `/hotpatch formats` do PS recarrega o Dex, reinicia os processos e envia a lista nova aos clientes. A recarga automática a partir do banco fica para a fase 2. Ponto de atenção: o `require` do `custom-formats.ts` fica em cache, então a geração dinâmica precisa ler os dados de um jeito que a recarga enxergue.

**Achado para a fase 2 (decisão do usuário, 2026-10-17: resolver com ajuste no fork do cliente):** o teambuilder do cliente decide a Pokédex pelo **id do formato**. Ele só usa a National Dex se o id contiver `natdex` ou `nationaldex` (`client/play.pokemonshowdown.com/src/battle-dex-search.ts`). Os formatos gerados para desafios com Pokédex completa precisam desse marcador no id, por exemplo com um nome terminando em "(NatDex)". A alternativa é um ajuste no fork do cliente que reconheça os formatos de desafio. Sem isso, o teambuilder mostra só a Pokédex de Scarlet/Violet, embora o servidor aceite todas as gerações.

1. **Prova de conceito**, para reduzir os riscos técnicos:
   - batalha contra NPC com bot aleatório, dentro do processo;
   - ajuste no `search` e um formato gerado dinamicamente;
   - recarga de formatos.

   Entrega: um comando de teste que inicia uma batalha contra um NPC fixo.
2. **Treinadores e desafios (admin):** banco, páginas de admin, validação de times (formato + tipo) e abertura e encerramento de desafio.
3. **Jornadas (jogador):**
   - início, batalhas e insígnias;
   - trava de time;
   - Elite 4 em sequência;
   - Campeão;
   - limite de derrotas e eliminações;
   - desistência e encerramento pelo admin.
4. **Placar, histórico, perfil e conquistas.** Exclusão de dados ligada à exclusão de conta.
5. **IA com níveis de dificuldade**, sobre a interface `NpcAI`.

Cada fase tem testes: unitários para `rules.ts` e e2e com batalhas reais (como os já feitos para o login).

## 12. Questões em aberto

### Respondidas em 2026-10-17

| # | Questão | Resposta |
|---|---|---|
| 1 | A regra antiga de insígnias foi substituída? | Sim. As insígnias são sempre da jornada |
| 2 | Quando acontece o sorteio de tipos? | A cada jornada. Treinadores podem ser reaproveitados |
| 3 | Elite 4 e Campeão têm restrição de tipo? | Elite 4 sim. Campeão não |
| 4 | O que conta como "mesmo time" na trava? | Sets idênticos. Nada pode mudar durante a jornada |
| 5 | Ordem dos ginásios | Livre, ou fixa se o admin escolher |
| 6 | Timer | Ligado, sem tempo limite contra NPC |
| 7 | Espectadores | Batalhas públicas |
| 8 | Dificuldade da IA | Por treinador, com dificuldade base no desafio |
| 9 | Ajuste no fork | Permitido no servidor e no cliente, sem quebrar os modos oficiais |

### Respondidas em 2026-10-17 (segunda rodada)

| # | Questão | Resposta |
|---|---|---|
| 10 | Elite 4 no modo sorteado | A Elite 4 e o Campeão são sempre fixos. São sorteados 8 tipos de ginásio por jornada, e a Elite 4 exige as 8 insígnias |
| 11 | Banco de treinadores | Independente, mantido pelo admin. Cada desafio seleciona os treinadores válidos |
| 12 | Dificuldade base x treinador | A base é o padrão, e o treinador pode estar acima. A base não substitui o nível do treinador |
| 13 | Timer | O admin escolhe: limite por turno ou tempo livre. O tempo total nunca é limitado |
| 14 | Apelido e ordem na trava | Podem mudar |
| 15 | Imagem das insígnias | Ícones de tipo do PS como placeholder; depois, imagens das insígnias dos jogos oficiais |

### Respondidas em 2026-10-17 (terceira rodada)

| # | Questão | Resposta |
|---|---|---|
| 16 | Quantidade de ginásios | Configurável. A Elite 4 (ou o Campeão) exige todas as insígnias |
| 17 | Campeão | Em sequência direta com a Elite 4, como nos jogos |
| 18 | Nível da IA | Por treinador em cada desafio. A base do desafio é o mínimo. O nível mais fácil é o bot aleatório |
| 19 | Aviso de projeto de fã | Colocado no rodapé dos dois clientes e das páginas de conta |

### Ainda em aberto

Nenhuma questão bloqueia a fase 1. Os detalhes dos níveis de IA (o que cada nível faz) serão definidos na fase 5.

> **Imagens de insígnia:** as imagens oficiais são propriedade da Nintendo, Creatures, Game Freak e The Pokémon Company. O aviso de projeto de fã sem fins lucrativos está no rodapé do cliente e das páginas de conta.

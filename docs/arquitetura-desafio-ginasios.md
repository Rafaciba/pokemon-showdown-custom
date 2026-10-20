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
- `view-ginasiosadmin-convites`: convites (gerar, listar os pendentes, revogar) e códigos de redefinição de senha, pela API interna do login (`custom-accounts.ts`). Não é do Desafio de Ginásios, mas fica no mesmo painel, que é o painel admin do servidor.
- `view-ginasiosadmin-seguranca[-<tipo>-<conta>-<antes de>]`: trilha de segurança do login (30 dias), com resumo das últimas 24 horas e filtros.

Os formulários usam os recursos nativos das páginas do PS (`<form data-submitsend>`, `<textarea>`, `<select>`). O plugin de times do PS (`server/chat-plugins/teams.ts`) tem um exemplo de formulário com área de texto para time.

**Identidade visual:** todas as telas seguem o visual oficial do PS.

- **Páginas dentro do cliente** (jogador e admin): usam apenas as classes que o cliente já estiliza (`infobox`, `button`, `textbox`, `ladder` para tabelas, `pad` e os ícones de tipo e de Pokémon do próprio PS), do mesmo jeito que as páginas oficiais (ladder, help tickets, times). Sem CSS próprio inventado.
- **Ícones** (insígnias, tipos, sprites de treinador): usam os recursos que o cliente já tem (`sprites/types`, `sprites/trainers`, ícones de Pokémon). As insígnias usam os ícones de tipo do PS como placeholder. O campo `badge_image` já fica previsto para as imagens das insígnias dos jogos oficiais.
- **Páginas fora do cliente** (`/cadastro`, `/conta`, `/redefinir`): usam o mesmo CSS das janelas do cliente clássico (`battle.css` + `oldclient.css`: `.ps-popup`, `.textbox`, `.button`) sobre o fundo padrão. Ficam iguais às janelas de login e de cadastro do jogo.
- Se alguma tela precisar de um componente que o cliente não tenha, ele entra no **nosso fork do cliente** no mesmo estilo e sem mudar o comportamento dos modos oficiais.

## 10. LGPD e exclusão de conta

- **Dados guardados:** só o `userid` e os resultados (jornadas, batalhas, insígnias, conquistas). Sem IP. Enquanto uma batalha está em andamento, também o estado dela (save state: nomes, times e jogadas, sem o chat), apagado quando a batalha termina.
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

**Resultado da fase 2, etapa 3 (desafios no painel, 2026-10-17):**

- **Página `view-ginasiosadmin-desafio-<id>`** (e `-novo`), com dois formulários: a configuração do desafio e a atribuição de treinadores (etapas fixas ou banco de sorteio, mais Elite 4 e Campeão). Abaixo, a lista "Pronto para abrir?", com todas as pendências, e os botões de abrir, encerrar e apagar rascunho (os dois últimos pedem confirmação dentro de um `<details>`).
- **Validação para abrir** (`challenges.ts`): as regras de `rules.ts` mais o time de cada treinador validado no formato do desafio, com `Force Monotype` para líderes, Elite 4 e banco de sorteio. O Campeão é validado só no formato.
- **Formato padrão de um desafio novo:** `[Gen 9] National Dex AG` + `Standard NatDex, Terastal Clause, Z-Move Clause, Dynamax Clause`. A tabela de regras resultante é idêntica à do formato da prova de conceito.
- **Seletor de formato:** a página usa o `<formatselect>` oficial do cliente, sem alteração no fork. O servidor escreve o nome do formato como o cliente escreve (sem o prefixo da geração atual).
- **Formulário recusado volta preenchido.** O cliente clássico troca o formulário enviado por "Submitted!"; se a validação falha, o servidor guarda em memória o que foi enviado (por usuário e página, usado uma vez) e redesenha a página com esses valores. Vale também para o editor de treinador.
- **Campos de formulário só com letras** (`fieldKey`): o cliente só limpa marcadores `{a-z}` não preenchidos no `data-submitsend`.
- **Decisões de interface (confirmadas pelo usuário em 2026-10-17):**
  - desafio **encerrado** fica só para leitura, mas **pode ser reaberto** (com a mesma validação de abrir);
  - desafio **aberto** pode ser editado, mas a alteração só é salva se ele continuar pronto para abrir;
  - um treinador usado em desafio aberto só pode ser salvo se o time novo continuar válido nesse desafio;
  - nos tipos fixos, dois ginásios podem ter o mesmo tipo;
  - padrões de um desafio novo: 8 ginásios, **sem Elite 4**, sem trava de time, tempo livre, derrotas ilimitadas.
- **Menu de formatos (pedido do usuário, 2026-10-17):** os formatos nossos aparecem primeiro, com as seções abertas, e os oficiais ficam agrupados em "Official Formats", fechado por padrão (o estado aberto/fechado fica salvo nas preferências, como nas outras seções). Como funciona:
  - no servidor, `config/custom-formats.ts` marca seus formatos com `customFormat: true`, e `server/rooms.ts` (`formatListText`, 2 linhas no fork) envia isso como o bit 512 do código de exibição. Clientes que não conhecem o bit o ignoram;
  - no cliente, `client-custom.js` lê o bit (envolvendo `App#parseFormats`) e redesenha o `FormatPopup`. Vale para todo menu de formatos que tenha formatos nossos (tela inicial, teambuilder, desafio a outro jogador). Sem formatos nossos no menu, ele fica exatamente como o original;
  - o `renderFormats` do menu foi reescrito no nosso arquivo. Se a Smogon mudar o original, conferir se o nosso precisa acompanhar.

**Resultado da fase 2, etapa 4 (formatos gerados e recarga, 2026-10-17):**

- **Um formato por desafio aberto**, chamado `[Desafio] <nome do desafio>`. O `config/custom-formats.ts` chama `buildChallengeFormats` (`gym-challenge/formats.ts`) toda vez que o Dex carrega a lista, tanto no processo principal quanto nos processos de batalha e validação. O formato usa o formato base como regra (`ruleset: [base, ...regras extras]`), herda `mod` e `gameType` e fica só na busca (`searchShow`), sem ranking (`rated: false`).
- **O gerador nunca derruba o servidor:** ele não depende dos globais do servidor, abre o banco só para leitura e pula, registrando no log, desafios com ID repetido ou com formato base indisponível (removido numa atualização da Smogon, por exemplo). Um ID repetido derrubaria a carga de todos os formatos.
- **Recarga automática** (`gym-challenge/reload.ts`) quando o admin abre, encerra ou reabre um desafio, ou salva um desafio aberto. Repete os passos de formatos do `/hotpatch formats` oficial, sem `/rebuild` (exige IP de console e recompila) e relendo o simulador, os dados e as listas de formatos. O Dex novo só entra no lugar se todos os formatos montarem a tabela de regras; se algo falhar, os formatos anteriores continuam valendo e o admin recebe um aviso.
  - **Achado:** os mods de `data/` precisam ser relidos junto. O mod oficial `linked` altera os próprios dados ao inicializar e falha se o módulo for reaproveitado.
  - **Custo:** cada recarga trava o processo principal por cerca de 3 s, como o hotpatch oficial. Para um servidor pequeno e ações raras do admin, é aceitável.
  - Batalhas em andamento continuam nos processos antigos até terminarem (comportamento do `PM.respawn` do PS).
- **Nome do desafio** não pode coincidir com um formato existente.
- **"Battle!" num formato de desafio:** por enquanto valida o time (a mesma validação de uma busca normal) e avisa que as jornadas chegam em breve. O formato fixo da prova de conceito ("[Desafio] Teste POC") e o treinador fixo dela foram removidos.
- **Validado por e2e com dois navegadores:** o jogador conectado recebe o formato quando o admin abre o desafio, vê a troca quando o desafio aberto é renomeado e o formato some ao encerrar e volta ao reabrir, tudo sem recarregar a página. Time válido e inválido recebem as respostas certas. Depois de subir com um desafio aberto e passar por duas recargas, uma Random Battle oficial continua funcionando.

**Resultado da fase 2, etapa 5 (teambuilder reconhece os formatos de desafio, 2026-10-17):**

- **Achado:** ao carregar os times salvos no navegador, o cliente põe `gen6` na frente de qualquer formato cujo id não comece com `gen` (`storage.js`, cinco lugares). Um time salvo em `desafioliga` virava `gen6desafioliga` depois de recarregar a página e deixava de pertencer ao formato; era essa a origem do "[Gen 6] [Desafio] Teste POC". Por isso o **nome do formato passou a começar pela geração do formato base**: `[Gen 9] [Desafio] Liga Kanto`, com id `gen9desafioligakanto`. Na tela, o cliente omite o prefixo da geração atual e mostra "[Desafio] Liga Kanto"; um desafio com base de geração antiga mostra o prefixo ("[Gen 7] [Desafio] ...").
- **Pokédex completa e demais variações pelo fork do cliente** (decisão do usuário): o servidor envia `|customformats|{"gen9desafioligakanto":"gen9nationaldexag"}` ao conectar e a cada recarga de formatos (`server/rooms.ts` → `customFormatsText`, a partir do campo `teambuilderBase` dos formatos gerados). No `client-custom.js`, quando o teambuilder abre um time desses formatos, `curTeam` vira um Proxy do time: ao ler `format`, ele devolve o formato base, e tudo o mais, inclusive gravações, vai para o time real. Assim, as dezenas de pontos do teambuilder que decidem geração, Pokédex, busca e legalidade pelo id do formato passam a usar o formato base, sem alterar `client-teambuilder.js`.
  - Usam o formato real: o botão de formato do time, a validação (`/vtm`), a exportação (PokePaste e `/teams`) e o que é salvo no navegador.
  - Times de formatos oficiais não passam pelo Proxy.
- **Validado por e2e:** o formato salvo sobrevive à recarga da página; o teambuilder usa geração 9 e Pokédex completa (`formatType: natdex`) num desafio com base National Dex AG; o botão mostra "[Desafio] Liga TB"; a validação vai em `/vtm gen9desafioligatb` e o servidor responde que o time é válido; salvar mantém o formato do desafio; trocar para OU e voltar funciona; um time OU não é afetado; a tela principal encontra o time no formato do desafio.

**Decisões do usuário para a fase 3 (2026-10-17):**

- **Empate não conta:** nem vitória nem derrota. O jogador enfrenta o mesmo treinador de novo; não conta para o limite de derrotas nem reinicia a Elite 4.
- **Uma jornada ativa por desafio:** o jogador pode jogar vários desafios em paralelo.
- **Ordem livre:** o jogador escolhe na página do desafio o ginásio do próximo "Battle!"; sem escolha, enfrenta o primeiro ginásio ainda não vencido.
- **Desistir durante uma batalha** dá forfeit nela (conta como derrota) e encerra a jornada na hora.

**Resultado da fase 3 (jornadas, 2026-10-17):**

- **Dados** (migração 2 do banco): `runs` (uma ativa por jogador e desafio, por índice único), `run_stages` (cópia das etapas com nome, tipo, time e nível efetivo do treinador, feita quando a jornada começa) e `run_battles` (resultado `win`, `loss`, `tie`, `void`, ou vazio enquanto a batalha está em andamento). Insígnias, derrotas e a posição na Elite 4 são calculadas a partir das batalhas (`journey.ts`, funções puras), sem tabela própria.
- **Batalha:** o "Battle!" no formato do desafio confere a jornada ativa, a batalha em andamento, a trava de time (hash do time validado, sem apelidos e em qualquer ordem) e a etapa atual, e inicia a batalha contra o treinador da cópia da jornada. O resultado chega pelo `NpcBattle` (vitória, derrota ou empate) e atualiza a jornada: insígnia, vitória no desafio ou eliminação. Os avisos na sala ficam em inglês, como os do PS, porque a sala é pública.
- **Batalha interrompida** (sala fechada sem fim, ou servidor reiniciado): ~~vira `void` e não conta~~ **substituído em 2026-10-18 pelo save state** (ver "Save state das batalhas"). Ela fica suspensa e continua do ponto em que parou. Só vira `void` a batalha que some antes de ter qualquer jogada salva. A verificação é feita sob demanda, e batalhas que continuam vivas depois de um hotpatch não são afetadas.
- **Limite de derrotas** (confirmado pelo usuário): ao **atingir** o limite, o jogador é eliminado (limite 3 = eliminado na 3ª derrota). A página mostra "Derrotas: 1 de 3".
- **Timer por turno:** a própria batalha ajusta o timer (saldo de N segundos, reabastecido a N a cada turno), em vez das regras de timer do formato, que limitam o acréscimo por turno a 30 s e acabariam limitando o tempo total. Ligado pelo servidor, o jogador não consegue desligá-lo.
- **Batalhas sempre públicas** (confirmado pelo usuário): as preferências de privacidade do jogador não se aplicam às batalhas contra NPC (requisito). O aviso de batalha no Lobby mostra o nome do NPC.
- **Segurança do lado do NPC:** o jogador NPC é criado só com nome, então fica com `id` vazio e fora da tabela de jogadores. Um usuário real com o mesmo nome não controla o NPC nem recebe o time dele.
- **Páginas do jogador:** `view-ginasios` (desafios abertos e encerrados, com a jornada de cada um) e `view-ginasios-desafio-<id>` (regras, como batalhar, insígnias, ginásios, Elite 4/Campeão, derrotas, batalha em andamento, escolher ginásio, desistir e jornadas anteriores). A página se atualiza sozinha quando a batalha começa e termina. Visitantes veem as páginas só para leitura (confirmado pelo usuário).
- **Admin:** `view-ginasiosadmin-jornadas-<id>`, com as jornadas do desafio e a ação "Encerrar jornada". Encerrar o desafio encerra as jornadas ativas na mesma transação.
- **Batalha em andamento quando o admin encerra a jornada ou o desafio** (decisão do usuário): a batalha continua e **o resultado conta**. A insígnia entra no histórico da jornada; vitória sobre o Campeão muda a jornada para "vencida", e uma derrota que elimina muda para "eliminada". Fora isso, ela continua "encerrada". A desistência do próprio jogador não segue essa regra: o forfeit conta como derrota, e a jornada fica "desistiu". Validado por e2e (encerramento durante o ginásio e durante o Campeão).
- **Robustez:** um formato nosso inválido fica fora da lista de formatos (em `server/rooms.ts`) em vez de derrubá-la. Isso foi achado no teste: um timer de 60 s nas regras do formato quebrava a lista na inicialização. A recarga só recusa a troca se um formato oficial falhar. As transações do banco são reentrantes.
- **Validado por e2e com batalhas reais:**
  - jornada: ginásio e Campeão vencidos; desistência no meio da batalha; trava de time (apelido e ordem aceitos, item diferente recusado); eliminação por limite de derrotas; timer por turno ligado e sem poder desligar;
  - páginas: começar, escolher ginásio, atualização automática, insígnia, visitante só para leitura, admin encerrando a jornada, histórico e encerramento do desafio com jornada ativa.
- **Ideia para depois (usuário, 2026-10-17):** um **save state automático** das batalhas, para que uma batalha interrompida (servidor reiniciado) possa continuar e para evitar o "reload scam" (o jogador recarregar a página ou derrubar a conexão para escapar de uma derrota). **Feito em 2026-10-18** (ver "Save state das batalhas").
- **Fica para a fase 4:** conquistas no perfil (a jornada vencida já fica registrada como `won`), placar total, página de histórico e perfil, e a exclusão dos dados de jogo junto com a exclusão da conta.

**Decisões do usuário para a fase 4 (2026-10-18):**

- **Perfil e histórico** de qualquer jogador: visíveis **só para usuários logados**.
- **O perfil mostra:** desafios vencidos (conquistas), insígnias das vitórias, placar por desafio e jornadas em andamento.
- **Acesso ao perfil:** botão "Gym profile" no popup de usuário (fork do cliente), links nas páginas do desafio e o comando `/ginasio perfil [nome]`.

**Resultado da fase 4 (placar, histórico, perfil, conquistas e exclusão de dados, 2026-10-18):**

- **Conquistas sem tabela nova:** são as jornadas com status "vencida". Vencer de novo acumula uma conquista por vitória. Placar e insígnias também vêm das jornadas e batalhas já gravadas.
- **Páginas:**
  - `view-ginasios-perfil-<usuário>`: conquistas (desafio, data e insígnias, com o bloco "Times vencedores", acrescentado em 2026-10-19), jornadas em andamento e placar por desafio (jornadas, vencidas, batalhas vencidas e perdidas), com link para o histórico;
  - `view-ginasios-historico-<desafio>-<usuário>`: cada jornada com resultado, insígnias, batalhas vencidas e perdidas, e o total do desafio. As jornadas anteriores da página do desafio usam a mesma tabela.
  - Visitantes veem "entre para ver"; a página carrega sozinha depois do login.
- **Nome exibido:** o atual, se o jogador estiver conectado; senão, o userid. O banco do jogo não guarda nomes de exibição (minimização de dados).
- **Acesso:**
  - botão "Gym profile" no popup de usuário (`client-custom.js`, só para quem está logado);
  - "My profile" na lista de desafios;
  - nome do jogador como botão de perfil na página de jornadas do admin;
  - `/ginasio perfil [nome]`.
- **Exclusão dos dados de jogo junto com a conta:**
  - **Login:** ao excluir a conta, grava só o userid na tabela `pending_purges`, na mesma transação. Enquanto ele estiver lá, o nome não pode ser recadastrado ("sendo liberado"), para os dados antigos não se misturarem aos de uma conta nova. API interna nova: `/internal/purges` (lista) e `/internal/purges/done` (confirma e tira da fila).
  - **Servidor de jogo** (`custom-accounts.ts`): consulta a fila 10 s depois de iniciar e a cada minuto. Para cada conta excluída:
    - a sessão aberta volta a visitante;
    - o rank global (`usergroups.csv`) e os ranks de sala saem;
    - as linhas das ladders locais saem; uma ladder que fica vazia tem o arquivo apagado, porque o `save()` do PS não grava ladder vazia e o arquivo antigo ficaria;
    - o handler novo `onAccountPurge` (1 linha no `chat.ts`) avisa os plugins, e o Desafio de Ginásios apaga as jornadas, com etapas e batalhas em cascata;
    - no fim, confirma ao login.
  - O log registra só a quantidade de contas, sem os nomes. O timer fica num global para um hotpatch não criar outro.
  - Logs e modlog do PS (nomes e IPs) continuam na pendência de revisão LGPD antes da produção.
- **Validado:**
  - teste de integração do login: fila, bloqueio do nome e liberação;
  - testes de unidade do banco;
  - e2e com dois jogadores: perfil pelo popup, conquista, jornada em andamento, placar 2/1/3/0, histórico com total, visitante bloqueado, comando;
  - e2e de exclusão pela página `/conta`: jornadas, ladders (inclusive o arquivo que ficaria vazio), rank global e fila apagados; sessão voltou a visitante; ladder dos outros jogadores intacta.

**Níveis de IA definidos pelo usuário (2026-10-18):**

- **Aleatório:** o bot padrão do PS, mantido como o nível mais fácil.
- **Fácil:** foca só em dar dano; pode trocar de Pokémon durante a batalha se achar adequado.
- **Médio:** usa golpes super-efetivos, troca para tipos favoráveis e usa golpes defensivos.
- **Difícil:** o Médio, mais golpes que causam status e hazards, e trocas melhores (avalia se valem a pena e os tipos).
- **Mestre (para depois):** as melhores habilidades e aprende com as batalhas que joga e assiste na plataforma; depende de um modelo (LLM ou similar), por isso fica para outro momento.

**Resultado da fase 5 (IA com níveis, 2026-10-18):**

- **Como a IA vê a batalha** (`battle-view.ts`): como um espectador. O próprio time vem completo no pedido do simulador; do adversário, só o que já apareceu no log (espécie, HP em %, status, golpes usados, boosts, Substitute, hazards e telas, prévia de times). **Correção:** o log que o `NpcBattle` entregava à IA incluía as linhas privadas do jogador, que vêm depois de cada `|split|` (por exemplo, o HP exato). Agora só a versão pública entra.
- **IA heurística** (`heuristic-ai.ts`), um conjunto de regras por nível (`LevelRules`):
  - **Fácil:** escolhe o golpe com mais dano bruto (poder × bônus de mesmo tipo), sem olhar a efetividade de tipo. Troca quando não tem golpe de dano útil, ou, às vezes, com 25% de HP ou menos e alguém com metade do HP ou mais no banco. Na troca forçada, entra o mais saudável. Mantém a ordem do time.
  - **Médio:** estima o dano (fórmula do jogo, com atributos estimados do adversário, efetividade, imunidades por tipo e por habilidade possível, precisão) e prefere nocautear. Troca quando o adversário tem vantagem de tipo, não dá para nocauteá-lo agora e há no banco alguém neutro ou resistente com HP razoável e confronto claramente melhor. Golpes defensivos: cura com HP baixo, Protect e similares (sem repetir) quando o adversário está envenenado/queimado ou com HP crítico, e telas no começo. Escolhe o Pokémon inicial pelo confronto com a prévia do time adversário.
  - **Difícil:** o Médio, mais:
    - hazards enquanto o adversário tem vários Pokémon;
    - status, respeitando imunidades de tipo, pó contra tipo Planta, Thunder Wave contra tipo Terra, a Sleep Clause e o Substitute;
    - trocas que contam o dano dos hazards do próprio lado, o golpe que quem entra vai receber e os golpes já revelados pelo adversário;
    - troca diante de um adversário com boosts;
    - noção de velocidade: quem é mais rápido e nocauteia; status e hazards valem pouco se vai ser nocauteado neste turno;
    - **buffs e debuffs** (pedido do usuário em 2026-10-18):
      - buff próprio (Swords Dance, Nasty Plot, Dragon Dance, Calm Mind, Shell Smash…) só com HP alto e o adversário causando pouco dano por turno, e só no atributo que ajuda: o do golpe principal, velocidade se for mais lento, defesa contra o tipo de golpe do adversário. Vale menos com o atributo em +2 e nada a partir de +4;
      - debuff (Screech, Charm, Scary Face, Fake Tears…) quando corta a ameaça do adversário ou aumenta o próprio dano;
      - contra um adversário com buffs acumulados: Haze, Clear Smog e golpes que forçam a troca (Roar, Whirlwind, Dragon Tail, Circle Throw);
      - se der para nocautear agora, ataca em vez de buffar;
      - com buffs acumulados, só troca se for ser nocauteado antes de agir.
  - **Todos os níveis heurísticos** usam a Megaevolução quando disponível. Escolha recusada pelo simulador: a IA escolhe de novo sem trocar (depois de três recusas, o `NpcBattle` usa a jogada padrão). Batalhas em dupla usam a jogada padrão por enquanto.
- **Painel admin:** os níveis aparecem nas opções de dificuldade (base do desafio e de cada treinador). A dificuldade base continua sendo o mínimo.
- **Banco de testes** (`server/tools/gym-challenge/ai-benchmark.js`): batalhas completas no simulador, IA contra IA, com times aleatórios iguais para os dois lados (Random Battle), alternando os lados. Aceita variantes para calibrar (`hard-hazards`, `medium+statusMoves`...).
- **Resultados** (taxa de vitória do primeiro; 300 batalhas por confronto, e 2000 no Difícil x Médio):

  | Confronto | Vitórias |
  |---|---|
  | Fácil x Aleatório | 59–63% |
  | Médio x Aleatório | 92% |
  | Difícil x Aleatório | 92,6% |
  | Médio x Fácil | 92% |
  | Difícil x Fácil | 90,6% |
  | Difícil x Médio | 55,6% (2000 batalhas; margem de ±2,2) |
  | Difícil x Difícil sem buffs/debuffs | 54,3% (2000 batalhas) |

  O que mais pesa é trocar bem: o Médio sem trocas ganha só 25% do Médio normal. No Difícil, cada regra a mais acrescenta 1 a 3 pontos contra o Médio. Contra outra IA, que quase não troca, hazards e status valem pouco; contra pessoas, que trocam bastante, eles devem pesar mais. Dois ajustes testados e descartados por piorarem o resultado: trocar diante de um adversário mais rápido que nocauteia, e trocar quando o ativo quase não causa dano.
- **Validado:** testes de unidade das decisões (11 cenários, incluindo buffs, debuffs e Haze) e batalhas reais no servidor (Brock no Difícil usou Stealth Rock e golpes de dano; Misty no Médio).

### Save state das batalhas (2026-10-18)

Objetivo (usuário): uma batalha interrompida continua de onde parou, e fechar a página ou derrubar a conexão não serve para escapar de uma derrota ("reload scam").

**Decisões do usuário:**
- **Só no Desafio de Ginásios.** Nas batalhas entre jogadores, o timer do PS já pune quem abandona.
- **Retomada automática ao entrar com a conta**, e também pelo botão "Continuar sua batalha" na página do desafio (`/ginasio continuar <desafio>`) e pelo "Battle!" do formato.
- **Sem prazo:** a batalha suspensa espera o jogador. A jornada não avança até ela terminar, e desistir conta como derrota.
- **Desafio encerrado com a batalha suspensa:** o formato sai da lista e não há como remontar a batalha, então ela é anulada e o jogador recebe um aviso (decisão proposta e aceita).
- **A exclusão de conta encerra as batalhas em andamento** com forfeit, inclusive as batalhas entre jogadores. Isso foi achado durante os testes: uma conta nova com o mesmo nome assumia as batalhas da conta excluída.

**Como funciona:**
- **Salvamento:** a cada pedido de jogada do desafiante, `NpcBattle` pede o input log ao simulador e grava em `run_battles.input_log` (migração 3). O simulador só registra as escolhas quando o turno fecha, já resolvidas, então o estado tem apenas jogadas confirmadas. A semente aleatória está no log, e reproduzi-lo remonta a batalha no mesmo ponto, com a mesma sorte.
- **Minimização (LGPD):** as linhas `>chat` (mensagens da sala) saem antes de gravar, e o resultado da batalha apaga o estado.
- **Suspensão:** quando a sala some sem resultado, a batalha continua "em andamento" no banco (`runState` devolve `suspended`).
- **Retomada** (`resumeBattle` em `runs.ts`): cria uma sala nova com `inputLog`, os mesmos ganchos e o mesmo treinador, e atualiza `roomid`. Durante a reprodução, o NPC não responde aos pedidos antigos. Ele só volta a jogar quando chega a resposta de um `>requestlog` enviado depois do log, porque o simulador responde em ordem.
- **Gatilho automático:** handler `onRename` do plugin, depois de o PS juntar a conexão nova ao usuário. Salas vivas ficam de fora, porque o PS já recoloca o jogador nelas.

**Validado:**
- testes: banco (salvar, apagar no resultado, listar), chat fora do estado, batalha real salva a cada decisão, retomada no mesmo turno com o NPC jogando em seguida, forfeit das batalhas da conta excluída;
- e2e com o servidor de verdade (simulador em subprocessos): batalha no turno 3, `docker compose restart server`, batalha reaberta sozinha no turno 3 com o histórico e o aviso, turno seguinte jogado, reload da página sem perder a batalha, desistência como derrota e estado apagado no banco.

### Insígnias (2026-10-18)

Substitui o placeholder (ícone de tipo) pelas insígnias dos jogos. Catálogo, imagens e importação em `docs/insignias.md`.

**Decisões do usuário:**
- **Fonte:** Bulbapedia (nome, região, líderes, tipo e imagem); as imagens ficam fora do git.
- **Associação:** a insígnia é escolhida para o **treinador em cada desafio**, ao montar o desafio (ginásios fixos e treinadores do sorteio). O mesmo treinador pode dar insígnias diferentes em desafios diferentes.
- **Escolha no painel:** as insígnias do tipo do treinador aparecem primeiro, mas qualquer uma pode ser escolhida. A Trio Badge não tem tipo fixo (vale para Grass, Fire e Water).
- **Sem escolha:** o ícone do tipo é a reserva, com o nome "insígnia do tipo X"; o desafio abre normalmente.
- **Onde aparece:** painel admin, página da jornada, histórico de jornadas, aviso na sala da batalha e perfil.
- **Perfil:** as insígnias **permanentes** são as das jornadas vencidas (as insígnias são da jornada e passam ao perfil quando o desafio é vencido), com nome da insígnia, líder, desafio e **data da vitória no ginásio**. Vencer de novo acumula.

**Como funciona:**
- **Dados** (migração 4): `badge_id` em `challenge_stages` e `challenge_pool`; `badge_id`, `badge_name` e `badge_image` em `run_stages`, uma cópia feita quando a jornada começa (como o time e o nome do treinador), para que mudanças no desafio ou no catálogo não alterem jornadas em andamento. A coluna `trainers.badge_image`, que nunca foi usada, saiu.
- **Código:** `badge-catalog.ts` (gerado), `badges.ts` (busca, ordem do seletor, imagem com reserva), painel em `admin.ts`, exibição em `player.ts` e aviso em `runs.ts`.
- **Aviso na sala:** com insígnia, "X earned the Boulder Badge! (1/2)" com a imagem; sem insígnia, o aviso antigo com o tipo. Os dois têm padrões distintos no dicionário do cliente.

**Validado (insígnias):** testes (catálogo, ordem do seletor, reserva, cópia na jornada, banco) e e2e no navegador: painel com imagens, insígnia forjada recusada, sorteio; aviso com nome e imagem, reserva com o tipo, página da jornada, histórico e perfil (nome, líder, desafio e data), em inglês e em português.

### Sprites dos treinadores (2026-10-19)

**Decisões do usuário:** o admin escolhe o sprite de cada treinador NPC numa **galeria com busca**, entre os sprites oficiais de treinador do PS (os mesmos de `/avatar`, cerca de 1.500, servidos do nosso disco). O sprite aparece **na tela de batalha**, no **banco de treinadores** (lista e edição) e na **página do desafio** (jornada).

**Como funciona:**
- **Lista oficial:** `OFFICIAL_AVATARS` de `server/chat-commands/avatars.tsx`, exportada no fork (uma palavra, sem mudar o comportamento do PS). Avatares personalizados (`#...`) ficam de fora.
- **Código:** `trainer-sprites.ts` (validação, busca, imagem); galeria `view-ginasiosadmin-sprites-<id>-<página>[-<busca>]` e comandos `/ginasioadmin buscarsprite` e `definirsprite` em `admin.ts`. A busca usa só letras e números (o PS separa os parâmetros da página por hífen) e compara com o id sem hífens.
- **Dados:** o banco de treinadores já tinha a coluna `avatar`. A jornada guarda uma cópia (`run_stages.trainer_avatar`, migração 5), como o nome e o time: trocar o sprite não altera jornadas em andamento.
- **Batalha:** o `RoomBattle` só conhece o avatar de jogadores com usuário. A `NpcBattle` sobrescreve o `addPlayer` para o lado do NPC já entrar com o sprite na primeira linha `|player|` (antes, uma edição posterior fazia o cliente mostrar um avatar qualquer por 1 a 2 segundos). O sprite fica no input log, então a retomada do save state também o tem.
- **Painel do desafio:** o sprite aparece ao lado de cada treinador na tabela de atribuição (fixos, sorteio, Elite 4 e Campeão) e no resumo de desafio encerrado.

**Validado:** testes (lista oficial, busca, imagem, cópia na jornada, avatar do NPC no log da batalha e na retomada) e e2e no navegador: galeria paginada, busca, escolha, lista do banco, ids inválidos recusados (inexistente, `#custom`, `../../etc/passwd`), remoção; página da jornada e tela de batalha com o sprite (servidor real).

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

## Times vencedores nas conquistas (2026-10-19)

Pedido do usuário: mostrar nas conquistas o time que venceu cada insígnia e o Campeão.

- **Decisões do usuário:** só os ícones dos Pokémon (não o time completo, que mostraria a estratégia a qualquer jogador logado); insígnias e Campeão, sem a Elite 4; num bloco que se abre ("Times vencedores") em cada conquista; recuperar as vitórias antigas dos logs de batalha.
- **Vitórias antigas:** não há como recuperar. As batalhas contra NPC não são gravadas em log (o PS só grava as da ladder; `logchallenges` está desligado), e o estado salvo é apagado quando a batalha termina. Elas aparecem como "Não registrado".
- **Banco (migração 6):** `run_battles.player_species`, com a lista das espécies do time do jogador em JSON. É gravada quando a batalha começa (`runs.ts`), o que cobre também as batalhas retomadas depois de um reinício, e apagada pelo `finishBattle` quando o resultado não é vitória. Só as espécies, porque é só isso que a página mostra (minimização).
- **Página:** a insígnia mostra o time da primeira vitória naquele ginásio, que é a que deu a insígnia. O Campeão mostra o time da vitória que encerrou a jornada.
- **LGPD:** o aviso de privacidade passou a citar as espécies (pt e en), que ficam visíveis no perfil para os usuários logados e são apagadas com a conta, junto com as jornadas.
- **Validado:** teste de unidade (espécies só nas vitórias; derrota, interrompida e batalha sem espécies ficam sem registro); batalha real contra NPC gravando as espécies ao começar; perfil no navegador em inglês e português, com uma vitória registrada, uma sem registro e o Campeão.

## Treinadores em dupla (2026-10-19)

Pedido do usuário: o admin marca no cadastro do treinador se as batalhas contra ele são em dupla. O padrão é não.

- **Decisões do usuário:** as batalhas em dupla seguem as regras do próprio desafio (o mesmo formato, em dupla), e as IAs Fácil, Médio e Difícil serão adaptadas para dupla. Feito em duas etapas: a primeira (esta) traz o treinador, o formato e a batalha; a segunda adapta as IAs.
- **Banco (migração 7):** `trainers.doubles` e a cópia `run_stages.doubles` na jornada, como o sprite e a insígnia.
- **Formato:** cada desafio aberto com formato base individual ganha uma variante oculta, "[Desafio] Nome (Dupla)" (`doublesFormatId`), com as mesmas regras e `gameType: 'doubles'`, fora do menu (`searchShow: false`, `gymDoubles: true`). O jogador continua clicando "Battle!" no formato do desafio; se a etapa é de um treinador em dupla, o plugin cria a batalha na variante. Em desafio com formato base em dupla, todas as batalhas já são em dupla e não há variante. O nome de um desafio novo não pode colidir com a variante de outro.
- **Times:** o treinador em dupla precisa de pelo menos 2 Pokémon (conferido ao salvar), e o jogador também (conferido antes da batalha, com aviso).
- **IA (etapa 2):** Fácil, Médio e Difícil jogam em dupla com as mesmas regras de cada nível, para cada um dos dois Pokémon ativos (`heuristic-ai.ts`, `chooseDoubles`; o caminho das batalhas individuais não mudou):
  - o retrato da batalha (`battle-view.ts`) acompanha as duas posições de cada lado (`activeSlots`), inclusive trocas de posição (`|swap|`, Ally Switch), e o tipo da batalha (`|gametype|`);
  - golpes de um alvo vão no adversário com a melhor pontuação (de preferência o que dá para nocautear);
  - golpes em área somam o dano nos dois adversários, com a redução de 25% das batalhas em dupla, e descontam o dano no próprio aliado (Earthquake, Surf): com o aliado vulnerável, a IA prefere outro golpe;
  - o adversário que mais ameaça cada Pokémon guia o perigo (Difícil) e as trocas; as trocas, voluntárias ou obrigatórias, nunca escolhem o mesmo Pokémon do banco para as duas posições;
  - a Megaevolução é de um Pokémon por turno, e a prévia de times põe os dois melhores confrontos na frente;
  - casos do simulador tratados: golpe preso (segundo turno de Electro Shot, Outrage) não leva alvo, Helping Hand sempre leva o alvo do aliado e Revival Blessing escolhe um Pokémon desmaiado. Uma escolha recusada não se repete (o simulador escolhe).
- **Resultados em dupla** (`ai-benchmark.js`, formato `gen9randomdoublesbattle`, 500 batalhas por confronto, nenhuma escolha recusada em 3000 batalhas): Fácil x Aleatório 70,8%, Médio x Aleatório 93,8%, Difícil x Aleatório 94,2%, Médio x Fácil 78,2%, Difícil x Fácil 77,6% e Difícil x Médio 51,6%. Em dupla, as regras extras do Difícil quase não fazem diferença sobre o Médio; calibrar isso fica para depois. As batalhas individuais continuaram com os mesmos resultados (300 batalhas por confronto). O banco de testes passou a contar as escolhas recusadas e, com `BENCH_DEBUG=1`, mostra cada uma.
- **Páginas:** campo "Batalha em dupla" no formulário do treinador; "Dupla" no banco de treinadores e na página do treinador; "(batalha em dupla)" ao lado do treinador na página do desafio. A página `/regras` explica a regra.
- **Validado:** testes de unidade (opção gravada e copiada para a jornada, variante gerada com as mesmas regras, sem variante em formato base em dupla; na IA, as duas posições e a troca de posição no retrato, o alvo, o golpe em área com o aliado vulnerável ou imune, uma Megaevolução por turno e trocas obrigatórias diferentes) e o teste de ponta a ponta com o Campeão em dupla e a IA Difícil.

## Pacotes de treinadores e desafios (2026-10-19)

Pedido do usuário: gerar treinadores e desafios de um jeito fácil de importar em produção.

- **Decisões do usuário:**
  - a importação é por uma página do painel, com prévia;
  - um nome que já existe é pulado, com aviso;
  - o painel também exporta;
  - quatro pacotes prontos (Kanto, Johto, Hoenn e Sinnoh) com times competitivos completos e desafios na configuração padrão.
- **Como funciona:** `transfer.ts` (exportar, ler, validar e gravar) e as páginas `pacotes`, `exportar` e `importar` do painel (`admin.ts`). O formato do arquivo, as regras e os pacotes das ligas estão em `docs/pacotes-ginasios.md`.
- **Validação compartilhada:** as checagens do treinador (`checkTrainer`) e do desafio (`checkChallengeInput`, em `challenges.ts`) saíram dos comandos do painel para funções usadas pelos formulários e pela importação.
- **Validado:** testes de unidade:
  - importação com os desafios como rascunho;
  - exportação e importação de volta, iguais;
  - nomes já existentes pulados, sem alterar o banco;
  - erros que impedem tudo;
  - exportação recusada com nomes repetidos.

  O teste de ponta a ponta ganhou um passo: exportar o desafio E2E e importar uma cópia com um líder novo e o Campeão reaproveitado. A prévia do pacote de Kanto foi conferida no navegador.

## IA Mestre (2026-10-20, em andamento)

Pedido do usuário: um nível acima do Difícil que começa com a inteligência dele, treina em batalhas simuladas contra Médio e Difícil e depois aprende com as batalhas reais do servidor. O trabalho foi dividido em etapas, feitas uma por vez:

1. **Nível Mestre no sistema**, com os pesos da Difícil extraídos. Feita.
2. **Treino dos pesos por simulação** (feita): um otimizador joga contra Médio e Difícil, em individual e em dupla, com times aleatórios e com os times dos pacotes.
3. **Avaliação de posição aprendida:** um modelo pequeno em TypeScript, sem dependências. A Mestre passa a olhar à frente, com até 1 segundo por jogada.
4. **Aprendizado no servidor**, com uma página no painel: versão do modelo, batalhas usadas, taxa de vitória, retreinar e reverter.
5. **Dupla, calibração e documentação final.**

Decisões do usuário:

- **Retreino:** automático no servidor, por exemplo uma vez por semana, de madrugada. O modelo novo só entra se vencer o atual num teste de verificação, e o painel mostra o histórico e permite voltar à versão anterior.
- **Dados das batalhas reais:** anônimos (a situação de cada turno, a jogada do NPC e o resultado, sem nome nem id do jogador nem ligação com a conta) e guardados sem prazo. O aviso de privacidade precisa explicar isso na etapa 4.
- **Tempo de reflexão:** até 1 segundo por jogada, pensando na VPS de 2 vCPU.
- **Fonte dos dados:** todas as batalhas do Desafio, com NPC de qualquer nível, e não só as da Mestre.

**Etapa 1 (feita):**

- **Pesos:** os pontos e limites que a Difícil usava fixos no código viraram `HeuristicWeights` (`heuristic-ai.ts`), com 46 pesos. Alguns exemplos: o bônus por nocautear, o valor de cada hazard e status, os buffs e debuffs, a margem de troca e a penalidade por entrar para ser nocauteado. `DEFAULT_WEIGHTS` tem os valores escolhidos à mão, que continuam valendo para Fácil, Médio e Difícil.
- **Nível:** `master` (`levels.ts`, acima do `hard`) usa as regras da Difícil com os pesos de `masterWeights()` (`master-weights.ts`). Por enquanto, são os pesos padrão.
- **Painel:** a opção "Mestre" aparece na dificuldade base do desafio e na de cada treinador. Ela também vale nos pacotes (`baseAILevel`/`aiLevel: "master"`).
- **Validado:**
  - teste de unidade: com os pesos padrão, a Mestre faz as mesmas escolhas da Difícil, e com Stealth Rock valendo 0 ela troca a jogada;
  - banco de testes, 1000 batalhas em individual: a Difícil fez 57,7% contra a Médio (antes da refatoração, 55,6% em 2000 batalhas, dentro da margem), e a Mestre fez 49,8% contra a Difícil;
  - banco de testes, 500 batalhas em dupla: Mestre 49,6% contra a Difícil;
  - o desafio do teste de ponta a ponta passou a usar a Mestre.

**Etapa 2 (feita):**

- **Ferramentas** (em `server/tools/gym-challenge/`):
  - `battle-runner.js` joga uma batalha IA contra IA, com semente e times fixos e pesos próprios. O banco de testes (`ai-benchmark.js`) passou a usá-lo.
  - `train-master.js` (com `train-master-worker.js`) treina os pesos com uma estratégia evolutiva: variações espelhadas em escala logarítmica em torno dos pesos padrão. Todos os candidatos de uma geração jogam as mesmas batalhas, com as mesmas sementes e times e cada semente dos dois lados. A nova média vem das melhores variações.
  - **Mistura de batalhas:** Random Battle 40%, Random Doubles 20% e confrontos entre os times dos pacotes 40% (formato padrão dos desafios). Um terço das batalhas é contra a Médio e o resto contra a Difícil. O trabalho é dividido entre processos paralelos.
  - **Fora do servidor:** `GYM_CHALLENGE_FORMATS=off` desliga a geração dos formatos de desafio (`config/custom-formats.ts`). As simulações não precisam do banco do plugin.
- **Treino de 2026-10-20:**
  - **Tamanho:** 50 gerações, com 12 variações e 480 batalhas por candidato em cada uma (cerca de 40 minutos com 10 processos).
  - **Resultado:** os pesos ficaram em `master-weights.ts` (`TRAINED_WEIGHTS`), e o histórico e a validação em `tools/gym-challenge/master-training.json`.
  - **O que mais mudou:**
    - a Mestre troca menos: a margem para trocar subiu de 15 para 41, e a penalidade por entrar para ser nocauteado de 100 para 188;
    - valoriza menos os hazards: Stealth Rock caiu de 70 para 29, e Spikes de 55 para 23;
    - valoriza mais o sono e as telas: sono de 65 para 141, telas de 40 para 79;
    - dá menos peso ao bônus por nocautear: caiu de 25 para 10.

    Contra outra IA, que quase não troca, hazards rendem pouco (como já se viu na fase 5). Contra pessoas, devem render mais: é o que o aprendizado com as batalhas do servidor (etapa 4) vai corrigir.
- **Resultados:**

  | Validação | Batalhas | Pesos treinados | Pesos padrão |
  |---|---|---|---|
  | Do treino, batalhas novas, mesmas batalhas para os dois conjuntos de pesos | 4000 | 53,8% | 50,8% |
  | Mestre x Difícil, individual (banco de testes, sementes aleatórias) | 2000 | 53,9% | 49,8% |
  | Mestre x Médio, individual | 2000 | 62,5% | 57,7% (Difícil x Médio) |
  | Mestre x Difícil, em dupla | 1000 | 49,8% | 49,6% |

  - **Em dupla não houve ganho**, porque só 20% das batalhas do treino eram em dupla. Pesos próprios para dupla ficam para a etapa 5.
  - **Times dos pacotes:** nos confrontos com eles, os pesos padrão dão exatamente 50%. O time decide quase sempre, então essas batalhas trazem pouco sinal ao treino.
  - **Limite:** a melhora é modesta porque a Mestre continua decidindo uma jogada de cada vez, com as mesmas regras. O ganho maior deve vir da etapa 3 (avaliação de posição e olhar à frente).
- **Validado:** um teste confere que os pesos treinados estão completos e dentro dos limites do treino. O teste da etapa 1 passou a comparar a Mestre com os pesos padrão e a Difícil. O servidor tem 2590 testes passando.


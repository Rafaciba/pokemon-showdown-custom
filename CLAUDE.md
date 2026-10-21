# Contexto do projeto: Liga de Desafios

Servidor **casual** de batalhas Pokémon, para uso próprio e com amigos. Ele é construído sobre o Pokémon Showdown (PS) da Smogon e tem modos de jogo próprios.

- **Nome:** Liga de Desafios.
- **Domínio:** `ligadesafios.com.br` (definidos em 2026-10-18).
- **Nome no jogo:** aparece nos textos (aba do navegador, páginas de conta, privacidade, regras). O logo do topo continua o do PS, e os créditos ao PS e à Smogon ficam.
- **Nomes técnicos que continuam como estão:** os repositórios, o projeto do Docker Compose (`pokemon-showdown-custom`, do qual dependem os nomes dos volumes) e o id do servidor (`custom`).

Política da organização: **sempre observar a LGPD e boas práticas de segurança** em tudo que for gerado.

Regra de trabalho combinada com o usuário: **não inventar nem inferir requisitos**. Quando algo estiver ambíguo, perguntar.

**Regras (pedido do usuário, 2026-10-18):** a página `/regras` (`login/src/rules.ts`, pt e en) traz as regras do servidor e dos nossos modos. **Todo modo de jogo novo, e toda mudança de regra de um modo existente, precisa atualizar essa página** (e a data). O `/rules` do PS e o link "Rules" do rodapé apontam para ela.

**Segurança:** toda mudança relevante deve ser revista contra o **OWASP Top 10** e a LGPD. A revisão completa de 2026-10-18 (achados, correções e pendências) está em `docs/revisao-seguranca-lgpd.md`, que serve de checklist.

## Idiomas

- Código (identificadores): inglês.
- Comentários, documentação e mensagens de commit: **português**.
- Interface do jogo: pt-BR e inglês, escolhidos pelo botão com o globo no topo do cliente. Na primeira visita vale o idioma do navegador. **Feito em 2026-10-18**; como funciona, as decisões e o passo a passo para traduzir textos novos estão em `docs/traducao-pt-br.md`.
  - Decisões: nomes de Pokémon, golpes, habilidades, itens e naturezas em inglês; tipos como o **selo do tipo** (nos textos, "tipo Fire"); atributos por extenso em português e abreviações em inglês; descrições traduzidas.
  - **Regra:** todo texto novo visível ao jogador precisa da versão pt-BR:
    - no servidor, `TL` e os catálogos;
    - no login, `i18n.ts`;
    - na interface clássica, o dicionário `client-i18n-pt.js`.

## Arquitetura

O PS original tem três partes. Usamos duas e substituímos a terceira:

| Parte | Origem | Situação |
|---|---|---|
| Servidor de jogo (`server/`) | fork de `smogon/pokemon-showdown` (MIT) | batalhas, formatos, salas, chat, torneios |
| Cliente web (`client/`) | fork de `smogon/pokemon-showdown-client` (AGPL-3.0) | teambuilder, tela de batalha, interface |
| Login server (`login/`) | **código nosso** (MIT) | substitui o `smogon/pokemon-showdown-loginserver` |

### Por que o login server é nosso

O oficial foi feito para a escala da Smogon. Ele exige MySQL e Postgres, depende do PHP CLI e precisa de Node 24+. Também guarda e-mail e vários registros de IP. Nosso login server é mínimo:

- **SQLite** via `node:sqlite`. O serviço não tem nenhuma dependência de runtime.
- Guarda **apenas o nome de usuário e o hash da senha** (scrypt). Sem e-mail; o rate limit fica só em memória.
- **Trilha de segurança (2026-10-19):** eventos de senha, conta, convites e pedidos recusados, com conta e IP, por 30 dias, mantidos depois da exclusão da conta (`login/src/security-events.ts`). O admin consulta pela página **Segurança** do painel (`view-ginasiosadmin-seguranca`). Ver a seção "Trilha de segurança do login" de `docs/revisao-seguranca-lgpd.md`.
- Os arquivos estáticos do cliente são servidos pelo Caddy, não pelo login.

Regras definidas pelo usuário em 2026-10-17:

- **Convites:**
  - só o admin gera;
  - código de uso único, válido por **3 dias**;
  - gerado por comando no chat (`/convite`), pelo CLI ou pela página **Convites** do painel admin (`view-ginasiosadmin-convites`, feita em 2026-10-19), que também lista os pendentes (sem o código, que só existe como hash), revoga convites e gera códigos de redefinição de senha. O código aparece uma única vez, logo depois de gerado.
- **Senha:** mínimo de **8** caracteres.
- **Sessão:** **30 dias**, renovada a cada uso, com cookie `ps_session` HttpOnly, Secure e SameSite=Lax.
- **Esqueci a senha:** o admin gera um código de redefinição (`/redefinirsenha`, válido por 24h), e o jogador usa em `/redefinir`.
- **Quem não tem conta é bloqueado:** o `getassertion` de um nome sem conta devolve erro com o link de cadastro.
- **Troca de nome:** permitida. Pelo admin, feita em 2026-10-19: `/renomearconta nome atual, nome novo` (senha mantida, sessões encerradas; jornadas, conquistas, ladder e cargos passam para o nome novo; recusa se houver batalha em andamento ou salva). A troca pelo próprio jogador fica para depois.
  - **Acentos:** o filtro de nomes do PS recusa letras acentuadas prontas ("é"), e o identificador só tem a-z e 0-9: no PS oficial, "José" vira "Jos" (`jos`). Desde 2026-10-19, o login guarda as letras latinas acentuadas como letra base + acento combinante (NFD, `normalizeUsername` em `login/src/accounts.ts`), que o PS aceita: "ZéPe" fica "ZéPe" no jogo, com identificador `zepe`. Em alguns nomes o filtro do PS ainda tira o acento ("João" vira "Joao"), mas a letra fica. Nomes que passariam de 18 caracteres com os acentos separados perdem só os acentos. Contas antigas não mudam: use `/renomearconta`.
- **Exclusão de conta pelo jogador** em `/conta`, com aviso de que tudo é apagado (times, conquistas e insígnias).
- **Admin:** a conta é Rafaciba. `PS_ADMINS` no `.env` garante o rank `~` no `usergroups.csv`. A conta é criada com `cli.ts convite --nome Rafaciba`, e a senha é escolhida na página, nunca no terminal.

O cadastro **não** usa a janela do cliente, que tem um captcha fixo e nenhum campo de convite; mudá-la exigiria alterar os dois clientes. Ele acontece em páginas próprias do login (`/cadastro`, `/redefinir`, `/conta`), sem JavaScript e com CSP restrita. O `register` do cliente responde com o link para `/cadastro`.

Código: `login/src/`. `app.ts` faz o roteamento, `accounts.ts`, `sessions.ts` e `codes.ts` cuidam do domínio, `pages.ts` gera o HTML e `i18n.ts` tem os textos em pt/en. Testes em `login/test/` (`npm test`).

Segurança:

- POST com `Origin` diferente de `https://{PS_HOST}` é recusado (CSRF);
- limite de 10 falhas de senha por conta e de 30 por IP a cada 15 minutos.

API interna (`/internal/invite`, `/internal/reset`, `/internal/purges`, `/internal/purges/done`): só a rede do Docker a alcança, com autenticação por token gravado no volume `login-shared`. Ela é usada pelo plugin `server/server/chat-plugins/custom-accounts.ts` (no fork), que oferece `/convite`, `/redefinirsenha` e `/conta`. As traduções desse plugin ficam em `server/translations/pt/custom-accounts.ts`.

**Traduções no servidor (fluxo validado em 2026-10-17):**

- Em comandos e páginas de chat, a tradução é `this.TL\`...\`` (não `this.tr`).
- **As chaves usam o nome da variável interpolada**: `${expiry}` vira `{expiry}`. Interpolar **só variáveis simples**, nunca expressões como `${formatExpiry(x)}`. Na carga, o PS converte os nomes em posições (`TLadd` em `sim/dex-text.ts`).
- **Nossos catálogos ficam em arquivos próprios**, para não conflitar com o `main.ts` da Smogon:
  - `server/translations/en-template/pokemon-showdown-custom.ts` (modelo, valores `null`);
  - `server/translations/pt/pokemon-showdown-custom.ts` (traduções).
- **Fluxo ao criar ou alterar textos `TL`:**
  1. `node build` (a ferramenta lê o código compilado). Os passos 1, 2 e 5 rodam no `server-setup` (`docker compose run --rm --no-deps server-setup <comando>`), porque o `server` é somente leitura;
  2. `node build translations`, que lista as chaves novas;
  3. desfazer a alteração que a ferramenta fez no `main.ts` da Smogon (`git checkout translations/en-template/main.ts`) e colocar as chaves novas, com as traduções, num JSON;
  4. rodar `node scripts/catalogo-traducoes.cjs <json>` (na raiz), que atualiza os dois catálogos;
  5. rodar `node build translations` de novo, que não deve listar nada.
- **Não reutilizar chaves que já existem no catálogo da Smogon** com contexto (por exemplo, `Type` tem o contexto "kind"). Um `TL\`Type\`` nosso obrigaria a alterar o `main.ts` deles. Usar chaves próprias, como `Trainer type`.

  O teste da Smogon `test/tools/translations.js` falha se o modelo estiver dessincronizado.
- **Testes do servidor:** `MSYS_NO_PATHCONV=1 docker compose run --rm --no-deps server-setup sh /opt/ps/test.sh test/main.js test/server/chat-plugins/gym-challenge.js` (no Git Bash). Isso roda a suíte inteira do PS, mais de 2500 testes. Eles não rodam no container `server`, que tem o código somente leitura (os testes recompilam o `dist/`).

### Contrato que o login server precisa respeitar

Assim não precisamos alterar o servidor nem o cliente:

- O cliente faz POST para `/~~{serverid}/action.php` (ou `/api/{act}`) no próprio domínio, com o parâmetro `act`. O código está em `client/play.pokemonshowdown.com/src/client-connection.ts` (`PSLoginServer`).
- As respostas JSON começam com `]`.
- As ações que o cliente usa são: `register`, `login`, `logout`, `upkeep`, `getassertion`, `changepassword`, `changeusername`, `getteams`, `getteam`, `ladderget` e `uploadreplay`. O mínimo para começar são as 5 primeiras.
- A assertion tem o formato `{challenge},{userid},{userType},{timestamp},{serverHost};{assinatura RSA em hex}`. Usamos **RSA-SHA256** (`Config.loginserverkeyalgo`), e não o SHA1 legado do oficial. O `challenge` vem de `|challstr|{keyid}|{challenge}`.
  - `userType`: `1` = não registrado, `2` = registrado.
  - Referência: `smogon/pokemon-showdown-loginserver`, arquivo `src/user.ts`, função `getAssertion`.
- O servidor de jogo verifica a assertion com `Config.loginserverpublickey` e `Config.loginserverkeyalgo` (`server/server/verifier.ts`, `server/server/users.ts` → `validateToken`). Precisamos gerar **nosso próprio par de chaves RSA**. A chave privada nunca vai para o git.

## Organização do workspace e git

```
D:\Workspace\pokemon-showdown\   ← repo "plataforma" → github: Rafaciba/pokemon-showdown-custom
├── CLAUDE.md, README.md, LICENSE (MIT), .gitignore, .gitattributes
├── docker/ + docker-compose.yml     (a criar)
├── login/                           (a criar)
├── docs/                            (a criar)
├── scripts/                         (a criar; incluirá o setup que clona server/ e client/)
├── server/   ← repo git próprio, ignorado pelo repo raiz
└── client/   ← repo git próprio, ignorado pelo repo raiz
```

- Em `server/` e `client/`:
  - remote `upstream` = Smogon. O push está desativado (`pushurl = DISABLED`) para nada ir à Smogon por engano;
  - remote `origin` = `Rafaciba/pokemon-showdown` e `Rafaciba/pokemon-showdown-client`. No GitHub, a branch padrão é `main`.
- Branches:
  - `master` = espelho do upstream, **nunca** recebe commits nossos;
  - `main` = nossas mudanças (já criada).
  - Para atualizar: `git fetch upstream`, depois `git checkout master`, `git merge upstream/master`, `git checkout main`, `git merge master`.
- Todos os repos são **públicos**: atende à AGPL do cliente e é boa prática de comunidade. Desde 2026-10-18, o rodapé do cliente e as páginas de conta têm o link "Código-fonte" para o repo raiz, cujo README lista os três repositórios (a `main` é o que roda em produção).
- Para minimizar conflitos com o upstream, as personalizações ficam em arquivos próprios:
  - `server/config/custom-formats.ts`: formatos próprios, carregados por `sim/dex-formats.ts`;
  - `server/data/mods/<nosso-mod>/`: mudanças de mecânica;
  - `server/data/rulesets.ts`: só se necessário. Preferir regras definidas em mod ou no próprio formato;
  - `server/server/chat-plugins/<nosso-plugin>.ts`: comandos e páginas, carregados automaticamente;
  - `RoomGame` (`server/server/room-game.ts`): jogos de sala.
- **Commits com vários repositórios:** um repositório por comando, nunca em paralelo, e sempre conferindo antes `test "$(git rev-parse --show-toplevel)" = "<caminho esperado>"`. Em 2026-10-17 um commit do repo raiz foi parar no fork por causa de um diretório errado, e a mensagem precisou ser corrigida com `push --force-with-lease`, com autorização do usuário.
- **Teste de ponta a ponta versionado (2026-10-19):** `sh scripts/e2e.sh` roda `tests/e2e` (Playwright Test) contra o ambiente local: páginas, contas, convites, jornada completa e exclusão, com admin temporário e limpeza automática. Só em `*.localhost`. Ver `docs/testes-e2e.md`. Funcionalidade nova visível ao jogador ou ao admin ganha um passo nele.
- **Testes de interface:** Playwright em container (`mcr.microsoft.com/playwright:v1.49.1-noble`), com `--host-resolver-rules=MAP ps.localhost host.docker.internal` e `ignoreHTTPSErrors`. O Chrome resolve `*.localhost` para o próprio container. Para testar páginas de admin: conta temporária por convite, mais uma linha temporária no `usergroups.csv`; apagar as duas no fim.
- Configuração local do git nos forks: `core.longpaths=true` (o checkout do cliente falha sem isso no Windows) e `core.autocrlf=false`. O Git do sistema tem `autocrlf=true`, e os forks já foram normalizados para LF.

## Decisões de produto

- **Somente o cliente CLÁSSICO** (decisão do usuário, 2026-10-17). O cliente novo (Preact, `src/panel-*.tsx`) está em alpha e não é mantido nem servido. Mudanças de cliente são feitas só no clássico (`src/oldclient/`, `index-old.html`, CSS em `style/oldclient.css`). As páginas do Desafio de Ginásios são geradas pelo servidor e funcionam no clássico. Se um dia a Smogon trocar o padrão para o novo, portamos as nossas pequenas mudanças de cliente.

- Os formatos oficiais da Smogon continuam disponíveis junto com os nossos. O admin pode desabilitar modos e formatos.
- Os times ficam no navegador (localStorage, como no PS original). A **base deve ficar pronta** para sincronizar entre dispositivos no futuro.
- Ambiente local em **Docker** (Docker Desktop no Windows). Deploy final em **VPS na Hostgator**. Antes do deploy, confirmar acesso root, suporte a Docker e RAM (2 GB servem para poucos usuários).
  - Pesquisa de 2026-10-18: a VPS NVMe da HostGator atende (root, Ubuntu 22.04, datacenter no Brasil, sem backup incluso). Recomendado o plano de 2 vCPU e 4 GB, com "SO simples" e Docker instalado por nós.
  - Tutorial em `docs/deploy-vps.md`; backup criptografado com age em `scripts/vps-backup.sh`.
  - Nome e domínio definidos em 2026-10-18: **Liga de Desafios**, `ligadesafios.com.br` (`PS_HOST` na VPS). O usuário já tem a VPS e o domínio, e está seguindo o tutorial.
- Dar créditos visíveis ao Pokémon Showdown e à Smogon (README e interface).

## Modo: Desafio de Ginásios (requisitos do usuário)

"Guarda-chuva" que comporta **vários desafios simultâneos**, cada um com seus líderes e regras.

- **Admin** (por enquanto só o usuário): monta os times dos líderes, da Elite 4 e do campeão. Em cada desafio, escolhe:
  - quantos ginásios;
  - os tipos (fixos ou **sorteados**);
  - se haverá Elite 4.
- **Líderes e NPCs são controlados pelo computador.** Começamos com os bots aleatórios do PS, mas a arquitetura deve ficar **pronta para IAs com níveis de dificuldade**.
- **Formato único por desafio.** O admin escolhe formato, limite de geração e mecânicas. Padrão: **Pokédex completa (até a gen 9)** com **Megaevolução habilitada** e **sem Z-moves, Dynamax e Tera**. Existe também uma opção de formato livre.
- **Regra configurável por desafio:** o desafiante pode alterar o time entre as batalhas, ou deve usar o mesmo time em todo o desafio. Ele pode montar um ou mais times.
- **Validação automática:** o time de cada líder precisa ser do tipo do ginásio.
- **Insígnias** são específicas de cada desafio. A regra original abaixo (2026-10-16) foi **SUBSTITUÍDA** em 2026-10-17: as insígnias são sempre da jornada.
  - nos desafios de **tipos fixos**, são **permanentes**;
  - nos desafios de **tipos sorteados**, valem **só enquanto o desafiante estiver ativo** naquele desafio.
- Para enfrentar o **campeão**, é preciso ter **todas as insígnias** do desafio.
- **Tentativas ilimitadas**, com placar de vitórias e derrotas (por tentativa e total) e **histórico de tentativas**.
- **Painel admin** feito com páginas do próprio cliente PS (páginas de chat-plugin, `view-...`), **restrito ao perfil admin**.

Regras de participação, definidas pelo usuário em 2026-10-17 e válidas para **todos** os desafios:

- Em desafios com **trava de time**, o desafiante pode **desistir**, por exemplo para trocar de time. O admin também pode **encerrar** o desafio.
- **Tentativas ilimitadas** de qualquer batalha, inclusive Elite 4 e Campeão, a não ser que o admin ative, ao criar ou editar o desafio, uma destas opções:
  - **limite de derrotas**;
  - **eliminação por derrota para a Elite 4**;
  - **eliminação por derrota para o Campeão**.

**Jornadas (runs)**, definidas pelo usuário em 2026-10-17:

- Cada tentativa de um desafio é uma **jornada** (run).
- **As insígnias pertencem à jornada.** Quando o jogador **vence o desafio**, as conquistas vão para a conta (perfil) dele.
- **Desistir encerra a jornada.** O que foi ganho fica salvo no histórico, mas não conta para novas tentativas, que recomeçam do zero.
- **Eliminação equivale a desistência:** a jornada é encerrada, e o jogador pode tentar de novo.
- Vencer o mesmo desafio várias vezes **acumula conquistas**. Num eventual ranking de pontos por desafio, porém, vitórias repetidas **não geram mais pontos**.
- O **limite de derrotas** conta o **total de derrotas na jornada inteira**.
- A **Elite 4** é enfrentada **em sequência**, como nos jogos.
- O admin pode **encerrar o desafio inteiro** ou **a jornada de um jogador**. O histórico é sempre mantido, e o desafio encerrado fica marcado como "encerrado".
- **Placar:** por jornada e total do desafio, além do histórico de jornadas.

Respostas às questões do documento de arquitetura (2026-10-17):

1. As insígnias são **de cada jornada**. A regra antiga (permanentes nos tipos fixos) foi **substituída**.
2. Os tipos são **sorteados a cada jornada**. Líderes **podem ser reaproveitados** entre desafios, o que implica um banco de treinadores.
3. A **Elite 4 tem restrição de tipo**. O **Campeão não**.
4. Trava de time = **sets idênticos**. Qualquer mudança (item, EVs etc.) exige uma nova jornada. Depois que a jornada começa, nada muda no time.
5. A ordem dos ginásios é **livre por padrão**, e o admin pode **fixar uma ordem** (configurável por desafio).
6. O timer fica **ligado**, mas **sem tempo limite** para as batalhas contra NPC.
7. As batalhas contra NPC são **públicas**.
8. A dificuldade da IA é **por treinador**, e o desafio pode ter uma **dificuldade base**.
9. Alterar o fork (servidor e cliente) é permitido, **desde que não quebre os modos oficiais**. Nada é enviado à Smogon.

Respostas às questões restantes (2026-10-17):

1. A **Elite 4 e o Campeão são sempre fixos**, sem sorteio. Para enfrentar a Elite 4 são precisos **8 insígnias**. Por isso, no modo sorteado, são **sorteados 8 tipos** para a jornada, e todos precisam ser vencidos.
2. O **banco de treinadores NPC é independente**, mantido pelo admin. Ao criar o desafio, o admin **seleciona os treinadores válidos** para ele.
3. O nível de IA do desafio é o **padrão**, e os treinadores **podem estar acima**. A base não substitui o nível específico do treinador.
4. **Timer:** o admin escolhe, por desafio, entre **limite de tempo por turno** e **tempo livre** (sem limite nenhum). Nos dois casos, o **tempo total da batalha não é limitado**.
5. Na trava de time, **trocar apelido ou ordem dos Pokémon é permitido**. O resto precisa ser idêntico.
6. Insígnias: os **ícones de tipo do PS servem de placeholder**. Depois serão trocados por **imagens das insígnias dos jogos oficiais**. **Feito em 2026-10-18**: catálogo da Bulbapedia, escolha por treinador em cada desafio, insígnias permanentes no perfil (ver `docs/insignias.md` e a seção "Insígnias" da arquitetura). O ícone de tipo continua como reserva quando o admin não escolhe a insígnia.

Terceira rodada (2026-10-17):

- **Quantidade de ginásios configurável.** A Elite 4 (ou o Campeão, se não houver Elite 4) exige **todas** as insígnias. No modo sorteado, são sorteados tantos tipos quantos forem os ginásios. (A menção anterior a "8 insígnias" era o caso típico, não uma regra.)
- **Elite 4 e Campeão em sequência direta**, como nos jogos: perder em qualquer ponto volta ao primeiro membro da Elite 4.
- **Nível de IA por treinador em cada desafio**, não no treinador: o mesmo treinador pode ser Fácil num desafio e Difícil em outro. A dificuldade é a qualidade das escolhas da IA. O nível mais fácil é o bot aleatório padrão. A **dificuldade base do desafio é o mínimo** para todos os seus treinadores. O que cada nível faz será definido depois.
- **Aviso de projeto de fã** no rodapé do cliente: sem fins lucrativos, direitos das imagens da Nintendo, Creatures, Game Freak e The Pokémon Company. Feito no fork do cliente (`index-old.html`, `index-new.html`, `src/panel-mainmenu.tsx`) e nas páginas de conta.
- **Achado:** o cliente do PS **não tem tradução pt-BR** (só de, es, fr, it, ja, ko, zh). As traduções pt existentes são só do servidor. O requisito de interface em pt-BR exige criar essa tradução. Decisão do usuário (2026-10-17): fica para depois. **Feita em 2026-10-18** (ver `docs/traducao-pt-br.md`).

**Identidade visual (2026-10-17):** todas as telas, inclusive as nossas (painel admin, páginas de conta), seguem a **identidade visual oficial do PS**. O cliente deles é a base, e as alterações necessárias ficam no nosso fork, com a mesma premissa do servidor.

Ideias para o futuro, sem implementar agora:

- desafio **"Hardcore"**: só uma tentativa permitida;
- **ranking de pontos** por desafio.

**Modo Expedição (roguelike), em andamento desde 2026-10-21:** o jogador monta o time ao longo da run (team builder, em vez de deck builder) num mapa no estilo Slay the Spire gerado por semente, com eventos e encontros. A base serve a várias variações (programadas, com números ajustáveis no painel), e cada uma escolhe batalhas jogadas ou automáticas, progressão, desgaste e desmaio. Uma run em andamento por variação. Plano, decisões e etapas em `docs/arquitetura-expedicao.md`. Etapa 1 (núcleo) feita: plugin `server/server/chat-plugins/expedition/`, variação de teste só para administradores, botão "Expedition" na tela inicial. Etapa 2 (batalhas) feita: formato escondido por variação, estado do time (HP e PP) levado e trazido do simulador pela regra do formato (`formats.ts`), batalhas jogadas e automáticas pelo `NpcBattle`, encontros das três fontes (Pokédex, banco do Desafio, listas da variação), experiência calibrada, golpes novos e evoluções decididos pelo jogador, derrota que encerra a run. Revisão do ritmo (2026-10-21): 30 níveis por ato em média, sem nível fixo (calibração por caminhos simulados, peso próprio do chefe, curva nível^2,5); telas validadas no navegador com vitórias de verdade. Desmaiados ganham metade da experiência no modo padrão; no Nuzlocke saem do time, e um time menor ganha mais. Lendário é nó raro (chance por ato, 10% na variação de teste), só a partir do 2º ato (ou na metade final de uma expedição de um ato). Selvagens com o sprite próprio do mato alto (`assets/sprites`, servido pelo Caddy).

## Achados técnicos importantes

- Node: o servidor exige **≥ 22.18** e o build do cliente também. A máquina tem a v20.10, mas rodaremos tudo em Docker com Node 22 LTS ou mais recente.
- `server/config/config-example.js`:
  - `exports.backdoor = true` dá acesso de admin aos sysops da Smogon. **Desligar.**
  - `noguestsecurity` só serve para desenvolvimento.
- O `.gitignore` do servidor ignora toda a pasta `config/` exceto `formats.ts`. No nosso fork, abrir exceção para `config/custom-formats.ts` e **continuar ignorando `config/config.js`**, que terá segredos.
- O cliente **não** traz sprites e áudio no repositório. Por padrão ele os carrega de play.pokemonshowdown.com. Para a VPS, avaliar hospedar esses arquivos nós mesmos.
- O teambuilder conhece a legalidade dos times porque o build do cliente lê os dados de `client/caches/pokemon-showdown` (`build-tools/build-indexes`). Esse cache precisa apontar para o **nosso** servidor, senão formatos e mods próprios não aparecem.
- **Bug do PS no carregador de plugins (corrigido no fork em 2026-10-21):** `loadPluginDirectory` (`server/chat.ts`) contava cada subpasta irmã como um nível de profundidade, e só as 3 primeiras pastas de `chat-plugins/` eram carregadas. A pasta da Expedição deixou o Trivia de fora. Agora a profundidade conta o aninhamento. Uma pasta nova de plugin que "desliga" outra é sinal desse problema.
- Persistência padrão do servidor: arquivos em `config/` (`usergroups.csv`, `chatrooms.json`, `ladders/*.tsv`) e `logs/`. SQLite é opcional (`Config.usesqlite`). A ladder local (`ladders-local.ts`) funciona sem login server.
- Times no servidor do PS: `server/server/chat-plugins/teams.ts`, que exige Postgres. Quando implementarmos a sincronização, avaliar se reaproveitamos isso ou guardamos os times no nosso login server.

## Ambiente Docker (detalhes em docs/ambiente-local.md)

- Serviços:
  - `web`: Caddy, com HTTPS, cliente estático e proxy. Substitui o Apache e o `.htaccess`;
  - `login`: Node 24, roda o TS direto, **sem dependências de runtime**;
  - `server`: PS, com código, build e dependências **somente leitura** (grava só em `config/`, `databases/` e `logs/`);
  - `volume-init`: ajusta o dono dos volumes e encerra (único com root, sem rede, só `CHOWN` e `DAC_READ_SEARCH`);
  - `server-setup`: instala as dependências do servidor (`docker/server/derive-package.cjs`, sem as que não usamos), compila, garante os admins e encerra;
  - `client-build`: compila o cliente e encerra.
- **Containers endurecidos (2026-10-19):** sem root (`PS_UID:PS_GID`, padrão 1000), `read_only`, `cap_drop: ALL` (o `web` mantém só `NET_BIND_SERVICE`), `no-new-privileges`, limites de memória e processos, imagens fixadas por digest. **Depois de mudar o código do servidor, use `docker compose up -d --force-recreate server`**: o `restart` não compila. Ver "Containers e dependências" em `docs/revisao-seguranca-lgpd.md`.
- Tudo responde em **https://ps.localhost** (`PS_HOST`). O cliente **exige HTTPS** porque compara a origem com `https://{routes.client}`; o Caddy usa uma CA local para `*.localhost`. **O host não pode ser `localhost` puro**: com esse host, o cliente clássico força `ws://localhost:{port}` sem TLS (`client/play.pokemonshowdown.com/src/oldclient/client.js`, `connect`) e não conecta.
- Rotas:
  - `/showdown/*` → server:8000 (WebSocket);
  - `/~~custom/action.php` e `/api/*` → login:9000;
  - `/` e `/{sala}` → cliente clássico;
  - só o **cliente clássico** é servido. As rotas do cliente novo (`/preactalpha` etc.) também abrem o clássico.
- O id do servidor no cliente é `custom` (`docker/client/config.js`).
- Os forks **não são alterados** para configurar o ambiente:
  - `docker/server/config.js` é montado somente leitura em `server/config/config.js` (e copiado para lá pelo `server-setup`), que é ignorado pelo git;
  - `config.js` e `routes.json` do cliente são templates (`__PS_HOST__`), renderizados pelo `docker/client/build.sh` no volume `client-config`;
  - `client/caches/pokemon-showdown` é um bind mount do `server/`, e o build roda com `--no-update`.
- No Windows, `client/play.pokemonshowdown.com/config/*` são symlinks que viram arquivos de texto (`core.symlinks=false`). Por isso o Caddy serve `/config/*` direto do volume `client-config`.
- Chaves RSA:
  - a **privada** fica no volume `login-data`, visível só para o `login`;
  - a **pública** e o token interno ficam no volume `login-shared`, montado somente leitura no `server`.
- Teste e2e validado em 2026-10-17: login via assertion, `/trn`, Random Battle gen 9 até o turno 5 e assertion forjada rejeitada. Desde 2026-10-19 há o teste versionado em `tests/e2e` (ver `docs/testes-e2e.md`).
- O PS não pareia na ladder jogadores do mesmo IP (`server/server/ladders.ts`). Em dev, `PS_NO_IP_CHECKS=1` liga o `noipchecks`. **Decisão do usuário (2026-10-17): na VPS a proteção fica LIGADA** (`PS_NO_IP_CHECKS=0`); jogadores do mesmo IP só jogam por desafio direto.
- Pendências do ambiente:
  - ~~sprites, áudio e `pokedex-mini` via proxy~~ **Feito em 2026-10-18:** sprites e sons vêm dos pacotes oficiais do PS (`scripts/recursos-ps.sh`, fora do git), servidos do disco, com o site oficial como reserva para o que faltar; o build gera o `pokedex-mini` a partir deles. Ver `docs/recursos-ps.md`;
  - ~~os containers rodam como root~~ **Feito em 2026-10-19** (ver "Containers endurecidos" acima);
  - ~~o PS grava IPs em logs e modlog~~ **Feito em 2026-10-19:** modlog do PS ligado (SQLite, `better-sqlite3@12.11.1` fixado pelo `derive-package.cjs`), 6 meses por registro e IP apagado aos 30 dias (limpeza diária em `custom-accounts.ts`); `alts_log` desligado (`Config.altslog = false`, opção do fork); mensagens offline e amigos desligados. Ver a seção "Modlog" de `docs/revisao-seguranca-lgpd.md`.

## Status (atualizado em 2026-10-17)

Feito:
- Código original estudado: servidor, cliente e login server oficial.
- `server/` e `client/` clonados com histórico completo.
- Forks públicos criados no GitHub (conta `Rafaciba`), com `master` e `main` enviadas.
- Repo raiz `Rafaciba/pokemon-showdown-custom` (público) criado, com README (créditos), LICENSE, `.gitignore`, `.gitattributes` e este arquivo.

Ambiente:
- O gh CLI está autenticado (conta Rafaciba). Ele fica em `C:\Program Files\GitHub CLI`; no Bash, adicionar ao PATH.
- Docker Desktop: Engine 29.8.x, Compose v5.x.

- Ambiente Docker funcionando e validado pelo usuário no navegador (batalha completa).
- Login server completo: contas por convite, sessões, troca, redefinição e exclusão de senha/conta, admin e `/convite`.
  - 13 testes de integração passando;
  - teste e2e validado com contas reais: login via sessão, intruso bloqueado, batalha pela ladder, `/convite` para admin e não-admin, exclusão de conta.

Pendências:
- ~~Exclusão de conta → apagar também os dados do nome no servidor de jogo~~ **Feito na fase 4 (2026-10-18):** jornadas e conquistas, ladders locais, rank global e de salas. Times ficam no navegador. Logs e modlog continuam na revisão LGPD pendente.
- Guests (sem conta) podem assistir batalhas públicas e ver salas, mas não escolhem nome, não jogam e não falam. **Decisão do usuário (2026-10-17): manter assim.**

Próximos passos:
1. **Fase 1 (prova de conceito) concluída e validada pelo usuário no navegador em 2026-10-17.** Próximo: **fase 2** (banco de treinadores, desafios, páginas de admin, formatos gerados por desafio, recarga de formatos). Decisão: o teambuilder vai reconhecer os formatos de desafio por um **ajuste no fork do cliente**, não pelo nome do formato.
2. **Fase 2 em andamento.** Etapas 1 (banco + regras + validação de times), 2 (painel admin do banco de treinadores, `/ginasioadmin`), 3 (desafios no painel: criar, editar, atribuir treinadores, abrir, encerrar, reabrir) 4 (um formato por desafio aberto, recarga automática dos formatos para quem está conectado) e 5 (teambuilder reconhece os formatos de desafio) concluídas em 2026-10-17. **Fase 2 concluída.**
3. **Fase 3 (jornadas) concluída em 2026-10-17:** jornadas com batalhas reais, insígnias, Elite 4 em sequência, Campeão, trava de time, limite de derrotas e eliminações, desistência, encerramento pelo admin, timer por turno e as páginas do jogador (`/ginasio`, também pelo botão "Gym Challenge" da tela principal, em `client-custom.js`) e do admin (jornadas). Decisões e resultado em `docs/arquitetura-desafio-ginasios.md`. Commit aprovado pelo usuário em 2026-10-18.
4. **Fase 4 concluída em 2026-10-18:** perfil (`/ginasio perfil`, botão "Gym profile" no popup de usuário), histórico com placar, conquistas (jornadas vencidas) e exclusão dos dados de jogo junto com a conta (fila `pending_purges` no login, consultada pelo servidor de jogo a cada minuto). Commit aprovado pelo usuário em 2026-10-18.
5. **Fase 5 concluída em 2026-10-18** (commit aprovado pelo usuário): IAs heurísticas Fácil, Médio e Difícil (`heuristic-ai.ts`, `battle-view.ts`; o Difícil também usa buffs e debuffs), além do Aleatório; banco de testes em `server/tools/gym-challenge/ai-benchmark.js`. O nível que aprende com as batalhas (modelo/LLM) fica para depois. Detalhes e decisões em `docs/arquitetura-desafio-ginasios.md`.
   - Formatos de desafio: id começa com a geração (`gen9desafio...`), senão o cliente põe `gen6` na frente ao carregar os times. O teambuilder usa o formato base via `|customformats|` + Proxy em `client-custom.js`.
   - Recarga de formatos (`gym-challenge/reload.ts`): reler `sim/`, `data/` e as listas de formatos; o Dex novo só entra se todos os formatos montarem a tabela de regras.
   - Menu de formatos: os nossos (`customFormat: true` em `config/custom-formats.ts`, bit 512 no `|formats|`) aparecem primeiro; os oficiais ficam no grupo "Official Formats", fechado por padrão (`client-custom.js`).
   - Formulários de página: o cliente clássico troca o formulário enviado por "Submitted!" e só limpa marcadores `{a-z}`. Ver "Rascunhos de formulário" e `fieldKey` no plugin.
   - Navegação entre páginas: um `/join` numa aba já aberta só atualiza o conteúdo, sem pôr a aba em foco. Os botões de navegação das nossas páginas usam `<button name="gymGo" value="view-ginasios...">` (`client-custom.js`), que leva até a aba e a atualiza se ela já estava aberta. Para fechar uma aba pelo servidor: `connection.send('>view-...\n|deinit')`.
   - **Divisão da tela (decisão de 2026-10-19):** com uma aba de chat aberta à direita, as páginas do servidor, o teambuilder, a ladder e as batalhas ocupam o resto da tela, e o chat fica com 400 px (`client-custom.js`, `updateLayout`). A Home continua como no PS; em janelas estreitas vale a divisão original.
   - **O `Utils.escapeHTML` do PS troca `\n` por `<br />`.** Em `<textarea>` ou qualquer campo de várias linhas, escape linha por linha e junte com `&#13;`. Senão, o campo mostra `<br />` como texto, e salvar de novo quebra o conteúdo. Isso aconteceu com o time dos treinadores e foi corrigido em 2026-10-19. O `importTeam` também aceita `<br />` colado.
   - **Tradução pt-BR do cliente concluída em 2026-10-18.** Inclui o botão de idioma, os textos de batalha, os catálogos e a camada da interface clássica (`client-i18n.js`). As ferramentas ficam em `scripts/traducao/`.
   - **Save state das batalhas do Desafio de Ginásios concluído em 2026-10-18.** A batalha é salva a cada jogada, fica suspensa se a sala some e reabre sozinha quando o jogador entra com a conta. A exclusão de conta encerra com forfeit as batalhas em andamento. Decisões e funcionamento em `docs/arquitetura-desafio-ginasios.md`, seção "Save state das batalhas".
   - **Treinadores em dupla (2026-10-19):** opção no cadastro do treinador (padrão não); a batalha usa a variante oculta "(Dupla)" do formato do desafio, com as mesmas regras. As IAs Fácil, Médio e Difícil jogam em dupla (alvo, golpes em área sem atingir o aliado, uma Megaevolução por turno). Ver a seção "Treinadores em dupla" da arquitetura.
   - **IA Mestre (concluída em 2026-10-20):** nível `master`, acima do Difícil. Ela parte das regras do Difícil com pesos próprios (`HeuristicWeights`, `master-weights.ts`), treina em batalhas simuladas e depois aprende com as batalhas do servidor (retreino automático com verificação, dados anônimos, até 1 s por jogada). Plano em 5 etapas, decisões e andamento na seção "IA Mestre" da arquitetura. Etapas 1 a 3 feitas: pesos treinados (`tools/gym-challenge/train-master.js`), modelo de avaliação de posição (`position.ts`, `value-model.ts`, `train-value.js`) e busca no simulador do PS com palpites do time do jogador (`sim-search.ts`), num processo separado (`master-search-process.ts`, `Config.subprocesses.gymmaster`). A `NpcAI` pode responder com Promise. Resultado: 63,7% contra o Difícil em batalhas individuais. Etapa 4 feita: coleta de posições anônimas de todas as batalhas individuais do Desafio (`ai_positions`, sem jogador, desafio, horário nem rowid), retreino toda segunda às 4h (Brasília) com mínimo de 30 batalhas novas e verificação por previsão + batalhas simuladas (`master-learning.ts`, `master-training-process.ts`), e a página IA Mestre do painel (`view-ginasiosadmin-mestre`, com reversão de modelo). O aviso de privacidade explica os dados. Etapa 5 feita (IA Mestre concluída): em dupla, busca simplificada no simulador (cada Pokémon com o aliado fixo, 4 respostas dos adversários), modelo de avaliação próprio e pesos próprios (sem ganho mensurável); dados, modelos e retreinos separados por tipo de batalha (migração 9); calibração do tempo em 2 vCPU (`search-timing.js`) e dos parâmetros da busca; tabela de força dos níveis no painel (`level-strength.ts`). A Mestre faz 65% contra o Difícil em individual e 56,5% em dupla.
   - **Pacotes de treinadores e desafios (2026-10-19):** página **Importar e exportar** do painel (`view-ginasiosadmin-pacotes`, `transfer.ts`). Exporta desafios e treinadores em JSON. A importação mostra uma prévia, pula nomes que já existem (usando o treinador do banco) e cria os desafios como rascunho. É o caminho para levar conteúdo do ambiente local para a VPS: basta colar o JSON no painel de produção. A pasta `pacotes/` tem as ligas de Kanto, Johto, Hoenn e Sinnoh (geradas por `scripts/pacotes/ligas.cjs`) e a Liga Favoritos, com os times do usuário (`scripts/pacotes/favoritos.cjs`). Ver `docs/pacotes-ginasios.md`.
   - **Sprites dos treinadores NPC concluídos em 2026-10-19:** galeria com busca no painel (sprites oficiais do PS), sprite na batalha, no banco de treinadores e na página do desafio; cópia na jornada (migração 5). Única mudança fora dos nossos arquivos: `export` em `OFFICIAL_AVATARS` (`server/chat-commands/avatars.tsx`). Ver a seção "Sprites dos treinadores" da arquitetura.
   - **Insígnias concluídas em 2026-10-18.** O catálogo (`badge-catalog.ts`) é gerado por `scripts/insignias/importar.cjs` a partir da página da Bulbapedia salva à mão. As imagens ficam em `assets/badges/`, **fora do git** (são da Nintendo), servidas pelo Caddy em `/badges/`, copiadas para a VPS por `scp` e incluídas no backup.
   - Os catálogos `data/text/pt/{moves,abilities,items}.ts` usam `Partial<...>`: o `name` fica de fora e cai no inglês. O gerador (`scripts/traducao/comum.cjs`) escreve esse tipo, e o `tsc` do servidor passa sem erros.
   - Os `CRASH: EPIPE` no log (e o aviso "The main process crashed" no Lobby e na Staff) **eram falha real**, não ruído de reinício. Rodar os testes dentro do container `server` chamava `Repl.cleanup`, que conectava nos sockets REPL vivos do servidor e derrubava o servidor. Corrigido em 2026-10-18 com `repl = false` em `docker/server/config.js`.

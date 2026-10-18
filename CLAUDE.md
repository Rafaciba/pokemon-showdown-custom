# Contexto do projeto: pokemon-showdown-custom

Servidor **casual** de batalhas Pokémon, para uso próprio e com amigos. Ele é construído sobre o Pokémon Showdown (PS) da Smogon e tem modos de jogo próprios. O nome definitivo e o domínio ainda serão escolhidos; por enquanto o projeto se chama `pokemon-showdown-custom`.

Política da organização: **sempre observar a LGPD e boas práticas de segurança** em tudo que for gerado.

Regra de trabalho combinada com o usuário: **não inventar nem inferir requisitos**. Quando algo estiver ambíguo, perguntar.

**Regras (pedido do usuário, 2026-10-18):** a página `/regras` (`login/src/rules.ts`, pt e en) traz as regras do servidor e dos nossos modos. **Todo modo de jogo novo, e toda mudança de regra de um modo existente, precisa atualizar essa página** (e a data). O `/rules` do PS e o link "Rules" do rodapé apontam para ela.

**Segurança:** toda mudança relevante deve ser revista contra o **OWASP Top 10** e a LGPD. A revisão completa de 2026-10-18 (achados, correções e pendências) está em `docs/revisao-seguranca-lgpd.md`, que serve de checklist.

## Idiomas

- Código (identificadores): inglês.
- Comentários, documentação e mensagens de commit: **português**.
- Interface do jogo: pt-BR e inglês. O PS já tem traduções pt-BR em `server/translations/` e `client/translations/`.

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
- Guarda **apenas o nome de usuário e o hash da senha** (scrypt). Sem e-mail e sem IP persistido; o rate limit fica só em memória.
- Os arquivos estáticos do cliente são servidos pelo Caddy, não pelo login.

Regras definidas pelo usuário em 2026-10-17:

- **Convites:**
  - só o admin gera;
  - código de uso único, válido por **3 dias**;
  - gerado por comando no chat (`/convite`) ou pelo CLI. Uma página no painel admin fica para depois.
- **Senha:** mínimo de **8** caracteres.
- **Sessão:** **30 dias**, renovada a cada uso, com cookie `ps_session` HttpOnly, Secure e SameSite=Lax.
- **Esqueci a senha:** o admin gera um código de redefinição (`/redefinirsenha`, válido por 24h), e o jogador usa em `/redefinir`.
- **Quem não tem conta é bloqueado:** o `getassertion` de um nome sem conta devolve erro com o link de cadastro.
- **Troca de nome:** permitida, mas fica para depois.
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
  1. `node build` (a ferramenta lê o código compilado);
  2. `node build translations`, que lista as chaves novas;
  3. desfazer a alteração que a ferramenta fez no `main.ts` da Smogon (`git checkout translations/en-template/main.ts`) e colocar as chaves novas, com as traduções, num JSON;
  4. rodar `node scripts/catalogo-traducoes.cjs <json>` (na raiz), que atualiza os dois catálogos;
  5. rodar `node build translations` de novo, que não deve listar nada.
- **Não reutilizar chaves que já existem no catálogo da Smogon** com contexto (por exemplo, `Type` tem o contexto "kind"). Um `TL\`Type\`` nosso obrigaria a alterar o `main.ts` deles. Usar chaves próprias, como `Trainer type`.

  O teste da Smogon `test/tools/translations.js` falha se o modelo estiver dessincronizado.
- **Testes do servidor:** `docker compose exec server npx mocha test/main.js test/server/chat-plugins/gym-challenge.js`. Isso roda a suíte inteira do PS, mais de 2500 testes.

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
- Todos os repos são **públicos**: atende à AGPL do cliente e é boa prática de comunidade.
- Para minimizar conflitos com o upstream, as personalizações ficam em arquivos próprios:
  - `server/config/custom-formats.ts`: formatos próprios, carregados por `sim/dex-formats.ts`;
  - `server/data/mods/<nosso-mod>/`: mudanças de mecânica;
  - `server/data/rulesets.ts`: só se necessário. Preferir regras definidas em mod ou no próprio formato;
  - `server/server/chat-plugins/<nosso-plugin>.ts`: comandos e páginas, carregados automaticamente;
  - `RoomGame` (`server/server/room-game.ts`): jogos de sala.
- **Commits com vários repositórios:** um repositório por comando, nunca em paralelo, e sempre conferindo antes `test "$(git rev-parse --show-toplevel)" = "<caminho esperado>"`. Em 2026-10-17 um commit do repo raiz foi parar no fork por causa de um diretório errado, e a mensagem precisou ser corrigida com `push --force-with-lease`, com autorização do usuário.
- **Testes de interface:** Playwright em container (`mcr.microsoft.com/playwright:v1.49.1-noble`), com `--host-resolver-rules=MAP ps.localhost host.docker.internal` e `ignoreHTTPSErrors`. O Chrome resolve `*.localhost` para o próprio container. Para testar páginas de admin: conta temporária por convite, mais uma linha temporária no `usergroups.csv`; apagar as duas no fim.
- Configuração local do git nos forks: `core.longpaths=true` (o checkout do cliente falha sem isso no Windows) e `core.autocrlf=false`. O Git do sistema tem `autocrlf=true`, e os forks já foram normalizados para LF.

## Decisões de produto

- **Somente o cliente CLÁSSICO** (decisão do usuário, 2026-10-17). O cliente novo (Preact, `src/panel-*.tsx`) está em alpha e não é mantido nem servido. Mudanças de cliente são feitas só no clássico (`src/oldclient/`, `index-old.html`, CSS em `style/oldclient.css`). As páginas do Desafio de Ginásios são geradas pelo servidor e funcionam no clássico. Se um dia a Smogon trocar o padrão para o novo, portamos as nossas pequenas mudanças de cliente.

- Os formatos oficiais da Smogon continuam disponíveis junto com os nossos. O admin pode desabilitar modos e formatos.
- Os times ficam no navegador (localStorage, como no PS original). A **base deve ficar pronta** para sincronizar entre dispositivos no futuro.
- Ambiente local em **Docker** (Docker Desktop no Windows). Deploy final em **VPS na Hostgator**. Antes do deploy, confirmar acesso root, suporte a Docker e RAM (2 GB servem para poucos usuários).
  - Pesquisa de 2026-10-18: a VPS NVMe da HostGator atende (root, Ubuntu 22.04, datacenter no Brasil, sem backup incluso). Recomendado o plano de 2 vCPU e 4 GB, com "SO simples" e Docker instalado por nós.
  - Tutorial em `docs/deploy-vps.md`; backup criptografado com age em `scripts/vps-backup.sh`.
  - O nome e o domínio ainda estão em aberto.
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
6. Insígnias: os **ícones de tipo do PS servem de placeholder**. Depois serão trocados por **imagens das insígnias dos jogos oficiais**.

Terceira rodada (2026-10-17):

- **Quantidade de ginásios configurável.** A Elite 4 (ou o Campeão, se não houver Elite 4) exige **todas** as insígnias. No modo sorteado, são sorteados tantos tipos quantos forem os ginásios. (A menção anterior a "8 insígnias" era o caso típico, não uma regra.)
- **Elite 4 e Campeão em sequência direta**, como nos jogos: perder em qualquer ponto volta ao primeiro membro da Elite 4.
- **Nível de IA por treinador em cada desafio**, não no treinador: o mesmo treinador pode ser Fácil num desafio e Difícil em outro. A dificuldade é a qualidade das escolhas da IA. O nível mais fácil é o bot aleatório padrão. A **dificuldade base do desafio é o mínimo** para todos os seus treinadores. O que cada nível faz será definido depois.
- **Aviso de projeto de fã** no rodapé do cliente: sem fins lucrativos, direitos das imagens da Nintendo, Creatures, Game Freak e The Pokémon Company. Feito no fork do cliente (`index-old.html`, `index-new.html`, `src/panel-mainmenu.tsx`) e nas páginas de conta.
- **Achado:** o cliente do PS **não tem tradução pt-BR** (só de, es, fr, it, ja, ko, zh). As traduções pt existentes são só do servidor. O requisito de interface em pt-BR exige criar essa tradução. **Decisão do usuário (2026-10-17): fica para depois**, não é prioridade agora.

**Identidade visual (2026-10-17):** todas as telas, inclusive as nossas (painel admin, páginas de conta), seguem a **identidade visual oficial do PS**. O cliente deles é a base, e as alterações necessárias ficam no nosso fork, com a mesma premissa do servidor.

Ideias para o futuro, sem implementar agora:

- desafio **"Hardcore"**: só uma tentativa permitida;
- **ranking de pontos** por desafio.

**Futuro:** um modo no estilo roguelite, a detalhar com calma.

## Achados técnicos importantes

- Node: o servidor exige **≥ 22.18** e o build do cliente também. A máquina tem a v20.10, mas rodaremos tudo em Docker com Node 22 LTS ou mais recente.
- `server/config/config-example.js`:
  - `exports.backdoor = true` dá acesso de admin aos sysops da Smogon. **Desligar.**
  - `noguestsecurity` só serve para desenvolvimento.
- O `.gitignore` do servidor ignora toda a pasta `config/` exceto `formats.ts`. No nosso fork, abrir exceção para `config/custom-formats.ts` e **continuar ignorando `config/config.js`**, que terá segredos.
- O cliente **não** traz sprites e áudio no repositório. Por padrão ele os carrega de play.pokemonshowdown.com. Para a VPS, avaliar hospedar esses arquivos nós mesmos.
- O teambuilder conhece a legalidade dos times porque o build do cliente lê os dados de `client/caches/pokemon-showdown` (`build-tools/build-indexes`). Esse cache precisa apontar para o **nosso** servidor, senão formatos e mods próprios não aparecem.
- Persistência padrão do servidor: arquivos em `config/` (`usergroups.csv`, `chatrooms.json`, `ladders/*.tsv`) e `logs/`. SQLite é opcional (`Config.usesqlite`). A ladder local (`ladders-local.ts`) funciona sem login server.
- Times no servidor do PS: `server/server/chat-plugins/teams.ts`, que exige Postgres. Quando implementarmos a sincronização, avaliar se reaproveitamos isso ou guardamos os times no nosso login server.

## Ambiente Docker (detalhes em docs/ambiente-local.md)

- Serviços:
  - `web`: Caddy, com HTTPS, cliente estático e proxy. Substitui o Apache e o `.htaccess`;
  - `login`: Node 24, roda o TS direto, **sem dependências de runtime**;
  - `server`: PS;
  - `client-build`: compila o cliente e encerra.
- Tudo responde em **https://ps.localhost** (`PS_HOST`). O cliente **exige HTTPS** porque compara a origem com `https://{routes.client}`; o Caddy usa uma CA local para `*.localhost`. **O host não pode ser `localhost` puro**: com esse host, o cliente clássico força `ws://localhost:{port}` sem TLS (`client/play.pokemonshowdown.com/src/oldclient/client.js`, `connect`) e não conecta.
- Rotas:
  - `/showdown/*` → server:8000 (WebSocket);
  - `/~~custom/action.php` e `/api/*` → login:9000;
  - `/` e `/{sala}` → cliente clássico;
  - só o **cliente clássico** é servido. As rotas do cliente novo (`/preactalpha` etc.) também abrem o clássico.
- O id do servidor no cliente é `custom` (`docker/client/config.js`).
- Os forks **não são alterados** para configurar o ambiente:
  - `docker/server/config.js` é copiado para `server/config/config.js`, que é ignorado pelo git;
  - `config.js` e `routes.json` do cliente são templates (`__PS_HOST__`), renderizados pelo `docker/client/build.sh` no volume `client-config`;
  - `client/caches/pokemon-showdown` é um bind mount do `server/`, e o build roda com `--no-update`.
- No Windows, `client/play.pokemonshowdown.com/config/*` são symlinks que viram arquivos de texto (`core.symlinks=false`). Por isso o Caddy serve `/config/*` direto do volume `client-config`.
- Chaves RSA:
  - a **privada** fica no volume `login-data`, visível só para o `login`;
  - a **pública** e o token interno ficam no volume `login-shared`, montado somente leitura no `server`.
- Teste e2e validado em 2026-10-17: login via assertion, `/trn`, Random Battle gen 9 até o turno 5 e assertion forjada rejeitada. O script ficou no scratchpad da sessão; vale transformá-lo em teste versionado depois.
- O PS não pareia na ladder jogadores do mesmo IP (`server/server/ladders.ts`). Em dev, `PS_NO_IP_CHECKS=1` liga o `noipchecks`. **Decisão do usuário (2026-10-17): na VPS a proteção fica LIGADA** (`PS_NO_IP_CHECKS=0`); jogadores do mesmo IP só jogam por desafio direto.
- Pendências do ambiente:
  - sprites, áudio e `data/pokedex-mini(-bw).js` vêm de play.pokemonshowdown.com via proxy (provisório). O `pokedex-mini` só é gerado pelo build quando os sprites estão no disco; sem ele, os ícones de Pokémon calculados antes do `pokedex.js` carregar ficam como "?";
  - os containers de dev rodam como root, e a produção deve usar um usuário sem privilégios;
  - o PS grava IPs em logs e modlog. Revisar isso por causa da LGPD antes da produção.

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
   - Os `CRASH: EPIPE` no log (e o aviso "The main process crashed" no Lobby e na Staff) **eram falha real**, não ruído de reinício. Rodar os testes dentro do container `server` chamava `Repl.cleanup`, que conectava nos sockets REPL vivos do servidor e derrubava o servidor. Corrigido em 2026-10-18 com `repl = false` em `docker/server/config.js`.

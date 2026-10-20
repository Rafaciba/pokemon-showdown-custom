# Revisão de segurança e LGPD (2026-10-18)

Revisão de todo o projeto contra o **OWASP Top 10 (2021)** e a **LGPD**: login server, plugins do servidor de jogo (Desafio de Ginásios e contas), mudanças nos forks, cliente, Docker, Caddy e dados guardados. Ela foi feita em três frentes (login, servidor de jogo, infraestrutura e dados pessoais), e cada achado foi conferido no código antes da correção.

**Regra do projeto:** toda mudança relevante deve ser revista de novo contra o OWASP Top 10 e a LGPD. Use este documento como checklist.

## Resumo

| Severidade | Achado | Situação |
|---|---|---|
| Alta | Um jogador podia colocar outra pessoa no lugar do NPC (`/addplayer`) e ganhar insígnias e o desafio com um forfeit combinado | **Corrigido** |
| Alta | O proxy dos sprites e sons repassava à Smogon o cookie de sessão (token de 30 dias), o IP e o Referer do jogador | **Corrigido** |
| Média | JavaScript de terceiro (`pokedex-mini*.js`) era buscado da Smogon a cada acesso e executado na nossa origem | **Corrigido** |
| Média | Bloqueio da conta de outra pessoa por tentativas de senha a partir de qualquer IP; rajadas em paralelo passavam do limite | **Corrigido** |
| Média | Logs com nome, IP e texto de mensagens (aviso de comando lento) e sem limite de retenção | **Corrigido** (sem IP, nome nem texto; logs com tamanho máximo) |
| Média | Logs de batalha (nomes e times) não tinham prazo de retenção e não eram apagados com a conta | **Corrigido** (30 dias; apagados com a conta) |
| Média | Não havia aviso de privacidade nosso; o rodapé apontava para a política da Smogon | **Corrigido** (`/privacidade`) |
| Média | O cliente buscava imagens direto de `play.pokemonshowdown.com` (endereços fixos nas folhas de estilo e no logo), mandando o IP do jogador à Smogon | **Corrigido** (mesmo domínio, pelo proxy) |
| Média | Containers como root, código montado com escrita, imagens sem digest, dependências do upstream com vulnerabilidades conhecidas | **Corrigido em 2026-10-19** (ver "Containers e dependências") |
| Baixa | Nomes de treinador e desafio aceitavam quebra de linha e `< > & " @ \` (injeção no protocolo e em HTML do PS que não escapa) | **Corrigido** |
| Baixa | O jogador podia esconder a batalha contra o NPC (`/hideroom`, `/modjoin`), contra o requisito de batalhas públicas | **Corrigido** |
| Baixa | Códigos de redefinição continuavam valendo depois de trocar a senha ou de gerar um código novo | **Corrigido** |
| Baixa | POST sem `Origin` vindo de outro site era aceito (só o SameSite protegia) | **Corrigido** |
| Baixa | scrypt abaixo do mínimo do OWASP (p=1) | **Corrigido** (p=3; hashes antigos refeitos no login) |
| Baixa | O IP do cliente era lido da primeira entrada do `X-Forwarded-For` (falsificável se o proxy mudar) | **Corrigido** (última entrada) |
| Baixa | Sem HSTS nem Permissions-Policy | **Corrigido** |
| Baixa | Restos de contas excluídas ficavam no arquivo do SQLite e no WAL | **Corrigido** (`secure_delete`, checkpoint após a exclusão) |
| Baixa | Se a conta do admin fosse excluída, outra pessoa podia cadastrar o mesmo nome e herdar o rank `~` | **Corrigido** (nomes de `PS_ADMINS` só com convite reservado) |
| Baixa | Modlog e crashlog guardavam o identificador de jogadores | **Corrigido** (registram a ação, não o jogador) |
| Baixa | Jornadas podiam ser criadas sem limite (desistir e recomeçar em loop) | **Corrigido** (até 5 a cada 10 min por jogador) |
| Baixa | O teambuilder consultava `smogon.com/dex/api` direto do navegador (IP e formato iam para a Smogon) | **Corrigido** (desativado) |
| Baixa | Modlog (punições, com nome e IP) sem prazo de retenção definido | **Corrigido em 2026-10-19**: 6 meses, IP 30 dias (ver "Modlog") |
| Info | `consoleips` usava o padrão do PS (127.0.0.1) | **Corrigido** (vazio) |
| Info | REPL do PS ligado (eval do processo por socket Unix em `logs/repl`). Rodar os testes no container derrubava o servidor com `EPIPE` | **Corrigido** (`repl = false`) |

## Correções, por categoria do OWASP

### A01 – Controle de acesso
- **Tomada do lado do NPC** (`npc-battle.ts`). O lado do NPC não tem usuário, e o PS o tratava como vaga livre. O rank ☆ do jogador tem `joinbattle`, então `/addplayer`, `/acceptbattle`, `/joingame` e `/restoreplayers` permitiam colocar outra pessoa no lugar do NPC.
  - Agora `joinGame` recusa sempre, e `leaveGame` também (para desistir, usa-se `/forfeit`).
  - Como defesa extra, o resultado só conta se o jogador do lado 1 for o dono da jornada.
  - Validado por e2e: `/addplayer`, `/joingame` e `/leavegame` recusados, e a vitória do jogador contou.
- **Privacidade da batalha.** O `forcedSettings.privacy` do próprio PS fica sempre ligado na batalha contra NPC, então `/hideroom`, `/privateroom` e `/modjoin` são recusados (validado por e2e).
- **Conferido e correto:** todos os comandos e páginas de admin checam `isAdmin` (conta registrada e rank `~`); os comandos do jogador só agem na própria jornada; perfis e históricos só aparecem para usuários logados; a API interna do login exige token e não passa pelo Caddy.

### A02 – Falhas criptográficas
- **Cookie de sessão vazando para terceiro** (`Caddyfile`, proxy dos sprites). O pedido saía do nosso domínio com o cookie. Agora o proxy retira `Cookie`, `Authorization`, `Referer`, `X-Forwarded-*` e `Via`, e não deixa voltar `Set-Cookie`. Validado com um servidor de eco local no lugar da Smogon.
- **scrypt:** N=2^15, r=8, **p=3** (configuração mínima do OWASP com 32 MiB por hash). Hashes antigos são refeitos no próximo login.
- **HSTS** de 1 ano.
- **Conferido e correto:** token de sessão de 256 bits guardado só como hash SHA-256; cookie HttpOnly, Secure e SameSite=Lax; códigos de convite e redefinição com cerca de 79 bits, guardados como hash e de uso único; assertion RSA-SHA256 de 3072 bits com challenge, host e userid; chave privada só no volume do login.

### A03 – Injeção
- **Nomes e títulos** (`rules.ts`). Agora recusam caracteres de controle (a quebra de linha injetaria linhas no protocolo do PS), `< > & "` (o `/formathelp` do PS mostra o nome do formato sem escapar) e `@` (`@@@` separa regras no nome de formato), além de `| , ; [ ]` e da barra invertida.
- **Conferido e correto:** SQL sempre parametrizado (login e plugin); HTML das páginas sempre escapado; páginas do login sem JavaScript e com CSP `default-src 'none'`; formatos gerados como objetos, sem `eval`.

### A04 – Design inseguro
- **Limite de jornadas novas** por jogador.
- **Nomes reservados** para os admins.

### A05 – Configuração
- HSTS e Permissions-Policy;
- `consoleips = []`;
- `repl = false`. Antes, a suíte de testes rodava no mesmo container e chamava `Repl.cleanup`, que conecta nos sockets vivos do servidor e os fecha na hora. O EPIPE resultante derrubava o processo principal e os subprocessos (o aviso "The main process crashed" aparecia no Lobby e na Staff);
- logs dos containers limitados a 3 × 10 MB por serviço.
- **Containers endurecidos (2026-10-19):** usuário sem privilégios, código somente leitura para o servidor, `read_only`, `cap_drop: ALL`, `no-new-privileges`, limites de memória e de processos e imagens fixadas por digest (ver "Containers e dependências").

### A06 – Componentes vulneráveis
- O login não tem dependências de runtime.
- **Servidor (2026-10-19):** as dependências são instaladas sem as que não usamos (`docker/server/derive-package.cjs`), e o `npm audit --omit=dev` caiu de 19 vulnerabilidades (uma crítica) para 1 moderada que não se aplica (ver "Containers e dependências").
- **Cliente:** as dependências (20 no `npm audit`, nenhuma crítica) só rodam no build, sobre o nosso próprio código, num container sem root e que termina. Nada delas chega ao navegador além do código que o Babel compila. Aceito; reavaliar a cada merge do upstream.
- Rodar `npm audit` a cada merge do upstream.

### A07 – Identificação e autenticação
- O limite de tentativas de senha passa a ser **por conta e IP** (10 a cada 15 min), mais 30 por IP. Assim, ninguém bloqueia a conta de outra pessoa a partir do próprio IP.
- A tentativa é **contada antes do scrypt**, então rajadas em paralelo não passam do limite.
- Trocar a senha e gerar um código novo **anulam os códigos de redefinição anteriores**.
- POST sem `Origin` com `Sec-Fetch-Site` de outro site é recusado.
- **Conferido e correto:** login e cadastro trocam a sessão (sem fixação); trocar a senha encerra as outras sessões; redefinir a senha e excluir a conta encerram todas; tempo de resposta igual para usuário inexistente (hash fictício).

### A08 – Integridade
- O `pokedex-mini(-bw).js` deixou de vir da Smogon a cada acesso. O build do cliente baixa uma cópia uma vez, e o Caddy serve o arquivo local. Pelo proxy só passam imagens e sons, que não executam código.

### A09 – Logs e monitoramento
- O aviso de comando lento do PS (`server/chat.ts`) registrava nome, IP e o texto da mensagem, que pode ser uma PM. Agora registra só o tempo, a sala e o comando.
- O modlog e o crashlog do nosso código não guardam o identificador de jogadores.
- O login nunca registra nome, IP nem corpo de pedido.
- **Trilha de eventos de segurança do login (2026-10-19):** falhas e bloqueios de senha, códigos inválidos, mudanças nas contas, convites e pedidos recusados, com conta e IP, por 30 dias (ver "Trilha de segurança do login").

### A10 – SSRF
- O único destino externo é fixo (`play.pokemonshowdown.com`), e só `/sprites/*` e `/audio/*` passam pelo proxy. O login não faz pedidos para fora.
- **`/show` com imagem (2026-10-19):** o servidor do PS baixava qualquer URL digitada para medir a imagem (`probe-image-size`), inclusive endereços da rede interna do Docker. O pacote não é mais instalado, e o `/show` com imagem é recusado. Isso também evita que o site da imagem receba o IP de todos na sala.

## LGPD

### Correções feitas
- Nada que identifique o jogador vai mais para a Smogon pelo proxy (cookie, IP, Referer).
- Logs dos containers sem IP, sem nome e sem texto de mensagens nos avisos de lentidão, e com tamanho máximo.
- O login sobrescreve no arquivo o que é apagado (`secure_delete`) e esvazia o WAL depois de excluir uma conta.
- Modlog e crashlog do nosso código sem identificadores de jogadores.
- (Já existia, fase 4) Ao excluir a conta, o servidor de jogo apaga jornadas, conquistas, ladder e ranks.

### Inventário de dados pessoais

| Dado | Onde | Retenção | Apagado com a conta? |
|---|---|---|---|
| Nome de usuário e hash da senha | banco do login | até a exclusão | Sim |
| Sessão (hash do token) e cookie | banco do login e navegador | 30 dias renováveis | Sim |
| Códigos de convite e redefinição (hash) | banco do login | até o uso, 3 dias ou 24h | Sim / vencem |
| Fila de exclusão (userid) | banco do login | até o servidor de jogo confirmar (cerca de 1 min) | Sai após a limpeza |
| IP | memória do login (limite de tentativas) e do servidor (sessão) | 15 min / enquanto conectado | Não é gravado |
| **Trilha de segurança do login** (data, tipo do evento, conta, IP, admin que agiu, onde aconteceu) | banco do login (`security_events`) | **30 dias** (limpeza a cada hora), até 100 mil eventos | **Não** (legítimo interesse; fica até o prazo) |
| **Log de acesso do site** (IP, data, método, caminho sem query string, status, tamanho, user agent) | arquivo do Caddy na VPS (`/var/log/ps-custom/caddy`, só root) | **14 dias** (logrotate diário) | Não (não é ligado à conta; some sozinho) |
| Rank e autoridade de sala | `server/config` | até a exclusão | Sim |
| Ladder | `server/config/ladders` | até a exclusão | Sim |
| Jornadas, insígnias e histórico, com as espécies do time de cada vitória (desde 2026-10-19) | `server/databases/gym-challenge.db` | até a exclusão | Sim |
| Estado das batalhas de ginásio em andamento (nomes, times e jogadas, sem chat) | `server/databases/gym-challenge.db` (`run_battles.input_log`) | até a batalha terminar | Sim (e as batalhas em andamento terminam com forfeit) |
| Logs dos containers | Docker (3 × 10 MB por serviço) | por tamanho | Não (sem IP: o log do Caddy filtra o IP dos avisos; pode haver nomes em erros) |
| Logs de batalha da ladder (nomes e times) | `server/logs/AAAA-MM/...` | 30 dias | Sim |
| **Modlog** (ações de moderação: nome do alvo, alts conhecidas, IP, quem agiu, motivo) | `server/databases/modlog.db` | **6 meses**; o **IP sai aos 30 dias** (limpeza diária) | **Não** (legítimo interesse; fica até o prazo) |
| Punições em vigor (nome e IP) | `config/punishments.tsv` | até vencer ou ser retirada (o PS apaga ao vencer) | Não |
| Trivia e preferências de mensagens privadas (só se usados) | `server/databases/chat-plugins.db`, `offline-pms.db` | até a exclusão | Sim |
| Cópias de segurança (contas, jornadas, modlog, config) | `/var/backups/ps-custom` (criptografadas com age) | 14 dias (o script apaga as antigas) | Substituídas em até 14 dias |
| Times e preferências | localStorage do navegador | controle do usuário | Local |
| Idioma escolhido (`pt`/`en`) | localStorage, cookie `ps_lang` (1 ano) e memória do servidor de jogo enquanto conectado | controle do usuário | Local (não identifica ninguém) |

Batalhas contra NPC não geram log (`logchallenges` desligado). O chat não é registrado (`logchat` desligado).

### Decisões do usuário (2026-10-18) e o que foi feito
1. **Aviso de privacidade** em `/privacidade` (pt e en, `login/src/privacy.ts`): controlador (o admin), dados, finalidades e bases legais, terceiros, retenção, direitos do titular. **Pedidos: mensagem privada ao admin no jogo**; a exclusão de conta é feita direto em `/conta`. O rodapé do cliente e as páginas de cadastro e conta apontam para ele, e os textos curtos foram corrigidos ("não guardamos seu IP" valia só para o login).
2. **Logs de batalha da ladder: 30 dias.** Uma limpeza diária apaga os dias mais antigos, e os logs em que o jogador aparece são apagados junto com a conta (`custom-accounts.ts`). O modlog ganhou prazo em 2026-10-19 (ver "Modlog").
3. **Consulta do teambuilder à Smogon: desativada** (`client-custom.js`). Ele só deixa de mostrar os links de análises dos formatos oficiais.
4. **Sprites e sons no próprio servidor: feito em 2026-10-18** (ver "Sprites e sons próprios" abaixo). Até lá, passam pelo proxy sem dados do jogador. Achado durante a verificação: as folhas de estilo e o logo tinham endereços fixos de `play.pokemonshowdown.com`, buscados direto pelo navegador. Agora são do mesmo domínio e passam pelo proxy. Verificado por e2e: nenhum pedido direto a outros domínios na tela principal, no teambuilder e durante as batalhas.

### Tradução pt-BR (2026-10-18)
Revisada contra o OWASP Top 10 ao ser feita. Detalhes em `docs/traducao-pt-br.md`.
- **A03 (XSS).** A camada da interface clássica (`client-i18n.js`) troca textos só como texto (`nodeValue`/`setAttribute`):
  - o único `innerHTML` vem das entradas `html` do nosso dicionário, que são fixas;
  - valores capturados pelos padrões entram como texto;
  - os selos de tipo são imagens montadas por DOM, a partir de uma lista fixa de tipos;
  - mensagens escritas por usuários (`chatmessage-*`), caixas `.infobox`, nomes e campos de texto ficam de fora (validado por e2e: uma mensagem igual a um texto do dicionário não é traduzida);
  - as traduções de descrições não têm `<` (o tooltip de golpe do PS insere a descrição sem escapar).
- **A05/A04 (desempenho).** Padrões só valem para textos de até 300 caracteres; as entradas `html` só são comparadas quando o começo do texto bate.
- **Cookie `ps_lang`:** só `pt` ou `en`, validado no login (`parseLang`), SameSite=Lax e Secure. Não é HttpOnly porque o cliente também o grava, e não é sensível.
- **LGPD:** o aviso de privacidade passou a citar o idioma guardado no navegador e no cookie.

### Save state das batalhas (2026-10-18)
Revisado contra o OWASP Top 10 e a LGPD ao ser feito. Detalhes em `docs/arquitetura-desafio-ginasios.md`.
- **A01 (acesso).** Só o dono da jornada retoma a batalha: `resumeBattle` confere o `userid` da jornada, e a retomada automática só roda para contas registradas, depois do login. A batalha retomada mantém as proteções da `NpcBattle`: ninguém entra no lugar do NPC, e ela é sempre pública.
- **A03 (injeção).** O estado salvo vem do próprio simulador e só volta para ele. O banco usa consultas parametrizadas. O formato lido do log é conferido contra a lista de formatos antes de criar a sala.
- **A04 (design).** Fechar a página, perder a conexão ou reiniciar o servidor não anula mais a batalha ("reload scam"); a única saída é desistir, que conta como derrota. O defeito de reprodução em que o NPC responderia a pedidos antigos é evitado esperando a reprodução terminar.
- **A08 (integridade).** O estado salvo só tem jogadas confirmadas: uma escolha feita, mas ainda não fechada no turno, não fica salva, e não dá para "voltar" uma jogada.
- **Exclusão de conta.** As batalhas em andamento da conta terminam com forfeit antes de o nome ser liberado. Uma conta nova com o mesmo nome não assume mais essas batalhas (achado nos testes e corrigido).
- **LGPD.** As mensagens de chat saem do estado antes de gravar, o estado é apagado no fim da batalha e junto com a conta, e os avisos de privacidade e de exclusão de conta foram atualizados.

### Insígnias (2026-10-18)
Revisado contra o OWASP Top 10 e a LGPD ao ser feito. Detalhes em `docs/insignias.md` e na arquitetura.
- **A01 (acesso).** Só o admin escolhe insígnias (o mesmo comando já restrito do painel). O jogador só vê.
- **A03 (injeção/XSS).** O valor enviado pelo formulário só é aceito se for um id do catálogo (testado com um comando forjado). Nomes e imagens vêm do catálogo gerado e são escapados no HTML; o nome do arquivo da imagem também passa por `encodeURIComponent`.
- **A05 (configuração).** O Caddy só serve `/badges/<id>.png` com nomes `[a-z0-9-]+`, de uma pasta montada somente leitura; qualquer outro caminho em `/badges/` dá 404.
- **A08 (integridade).** O importador para com erro se a página mudar de formato ou se uma cor não corresponder a um tipo, e o catálogo gerado passa por teste.
- **Terceiros e LGPD.** As imagens são servidas pelo nosso domínio: o navegador do jogador não faz pedidos à Bulbapedia (a página é salva à mão pelo admin, uma vez). Nenhum dado pessoal novo: as insígnias permanentes são dados de jogo já cobertos pelo aviso de privacidade (perfil visível a usuários logados, apagado com a conta).
- **Direitos.** As imagens são da Nintendo e ficam fora dos repositórios públicos; o rodapé do cliente já traz o aviso de projeto de fã e passou a creditar a Bulbapedia pelos dados.

### Log de acesso com IP (2026-10-18)
Achado no primeiro start na VPS: os avisos do proxy do Caddy (log padrão, guardado pelo Docker por tamanho) traziam o IP do visitante, o que contradizia o inventário e o aviso de privacidade. Decisão do usuário: **guardar os IPs por 14 dias, de todos os pedidos HTTP, para segurança**.
- **Base legal:** legítimo interesse (art. 7º, IX), com finalidade só de segurança (identificar ataques e abusos), prazo definido e acesso restrito. O Marco Civil (art. 15, guarda de 6 meses) vale para pessoa jurídica com fins econômicos, que não é o caso do projeto.
- **Como:** log de acesso do Caddy num arquivo (`mode 0600`, pasta só do root, fora do backup), com rotação diária e apagamento depois de 14 dias pelo logrotate do sistema (`docker/logrotate/ps-custom-caddy`), porque a rotação do Caddy é por tamanho. O log padrão (stdout) passou a apagar o IP, a porta, `X-Forwarded-For`, `Referer`, cookies, `Authorization` e a query string.
- **Segredos:** os links de convite e de redefinição levam códigos na URL; o log de acesso grava o caminho sem a query string e sem `Referer`. O Caddy já omite cookies e `Authorization` (validado: nenhum código no arquivo depois de pedidos com `?convite=` e `Referer`).
- **Transparência:** o aviso de privacidade (pt e en) descreve o registro, a finalidade, a base legal, o prazo e quem acessa.

### Sprites e sons próprios (2026-10-18)
Revisado contra o OWASP Top 10 e a LGPD ao ser feito. Detalhes em `docs/recursos-ps.md`.
- **A08 (integridade) e A05.** Os pacotes vêm só por HTTPS, do site do próprio PS, e o zip é testado (CRC) antes de extrair. O script recusa entradas fora de `sprites/`/`audio/`, caminhos com `..` ou absolutos (zip slip) e links simbólicos (que fariam o Caddy servir arquivos do sistema), normaliza as permissões e só troca a versão antiga depois de tudo conferido. Testado com zips maliciosos (13 casos).
- **A08.** O `pokedex-mini.js` (JavaScript) passa a ser gerado localmente a partir dos sprites, em vez de baixado do site oficial.
- **Terceiros e LGPD.** Imagens e sons saem do nosso domínio; só o que faltar no pacote vai ao site oficial, pelo proxy que não repassa cookie, IP nem Referer. O aviso de privacidade foi atualizado.
- **Direitos.** Os arquivos ficam fora dos repositórios públicos (o fork do cliente já ignorava as pastas), como faz o próprio PS.

### Sprites dos treinadores (2026-10-19)
- **A01 (acesso).** Galeria e comandos só para o admin (`isAdmin`), e a troca entra no modlog, como as outras ações do painel.
- **A03 (injeção/XSS e caminhos).** Só ids da lista oficial do PS são aceitos (testado com um id inexistente, `#custom` e `../../etc/passwd`); a busca é reduzida a letras e números; o id entra na URL da imagem com `encodeURIComponent` e no HTML escapado.
- **Fork.** Única mudança fora dos nossos arquivos: `export` em `OFFICIAL_AVATARS` (`server/chat-commands/avatars.tsx`), sem mudar o comportamento.
- **LGPD.** Nenhum dado pessoal: o sprite é do treinador NPC.

### Modlog (2026-10-19)
Achado ao definir o prazo: **o servidor não gravava modlog nenhum**. O PS atual só grava o modlog em SQLite (`Config.usesqlite` e `usesqlitemodlog`), que estava desligado, e a dependência `better-sqlite3` nunca chegava a ser instalada: a 11.10.0 travada pela Smogon não tem binário pronto para o Node 24, o container não tem compilador e o npm pula dependências opcionais que falham. O aviso de privacidade prometia "registros de moderação" que não existiam.

Decisões do usuário:
- **Ligar o modlog do PS**, para ter trilha de investigação (`/modlog` para a staff).
- **Prazo de 6 meses** por registro (referência do Marco Civil para registros de segurança; a LGPD não fixa dias, exige finalidade e eliminação ao fim dela) e **IP apagado aos 30 dias** (serve sobretudo para pegar evasão de punição logo depois dela).
- **O modlog fica até o prazo mesmo depois da exclusão da conta** (legítimo interesse em segurança: o punido não apaga o histórico excluindo a conta). O aviso de privacidade e o aviso da página de exclusão dizem isso.
- **`alts_log` desligado**: ligar o SQLite também ligaria esse registro do PS (IP de cada troca de nome entre contas, sem data, impossível de expirar). Opção `Config.altslog = false` no fork (`server/chat-commands/info.ts`, sem mudar o comportamento para quem não a define).
- **Dependência:** `better-sqlite3@12.11.1`, com binário pronto, instalado pelo nosso script (o fork não muda; o npm confere a integridade do pacote). Desde o endurecimento, fica em `docker/server/derive-package.cjs` (ver "Containers e dependências").

Também desligados de propósito: mensagens privadas offline (`usesqlitepms`) e amigos (`usesqlitefriends`). A moderação automática do PS (Perspective, que grava o texto das mensagens) só funciona com uma chave do Google, que não configuramos. A exclusão de conta passou a limpar os dados que o banco de plugins possa ter do jogador (pontuação de trivia, preferências de mensagens; autoria de perguntas de trivia fica anônima).

Validado: teste de unidade da limpeza (IP aos 30 dias, registro aos 6 meses, alts junto) e, no servidor real, registros antigos limpos na inicialização, `/modnote` gravado e visível no `/modlog`, `alts_log` vazio e exclusão de conta limpando trivia e preferências de mensagens com o modlog mantido. A suíte do servidor passou a rodar também os testes de SQLite do PS que eram pulados.

### Página de convites (2026-10-19)

Página **Convites** no painel admin (`view-ginasiosadmin-convites`): gerar convite (com nome reservado opcional), listar os pendentes, revogar e gerar código de redefinição de senha. Decisão do usuário: não guardar quem gerou cada convite.

- **A01:** a página e os comandos (`/ginasioadmin gerarconvite`, `revogarconvite`, `redefinirsenha`) exigem admin (conta registrada e rank `~`). A API interna nova do login (`/internal/invites`, `/internal/invites/revoke`) exige o token, como as outras.
- **A02:** a lista nunca traz o código, que o login guarda só como hash. O convite é identificado pelo `rowid`, e não pelo hash. O código gerado na página fica na memória do servidor de jogo só até a página ser desenhada de novo (no máximo 10 minutos) e aparece uma única vez.
- **A03:** o id do convite é validado como número nos dois lados; o nome reservado já vem normalizado do login (só letras minúsculas e números) e é escapado na página.
- **A09:** revogar entra no modlog (`INVITEREVOKE`, só o número do convite), como gerar (`INVITE`) e redefinir (`PASSWORDRESET`), sem nomes de jogadores.
- **Idioma:** as mensagens de erro do login (nome em uso, usuário não encontrado) saíam sempre em português. O servidor de jogo passou a mandar o idioma de quem pediu, também no `/convite` e no `/redefinirsenha`.
- **LGPD:** nenhum dado novo é guardado.

Validado: 2 testes novos no login (lista sem o código, revogação, convite usado sai da lista, erros em pt e en) e e2e no navegador, em inglês e em português: abrir pelo botão do painel, gerar convite aberto e reservado, código só uma vez, nome em uso recusado, revogar (e revogar inexistente), redefinição para jogador inexistente e existente.

### Trilha de segurança do login (2026-10-19)

Antes, o login não registrava nenhum evento de segurança, por minimização. Decisões do usuário:

- **Eventos:** senha errada (login, troca de senha, exclusão), bloqueio por excesso de tentativas, criação de conta, troca de senha, código de redefinição gerado e usado, exclusão de conta, convite gerado e revogado, formulário de outro site recusado (CSRF), excesso de pedidos e API interna sem o token. Acrescentei **código de convite ou de redefinição inválido** (tentar adivinhar códigos é o mesmo tipo de ataque que adivinhar senhas).
- **Dados:** data, tipo, conta, **IP**, o admin que agiu (convites e redefinições pedidos pelo painel ou pelo chat) e onde aconteceu (login, troca de senha, exclusão, cadastro, redefinição ou o caminho pedido). Nunca senhas nem códigos.
- **Prazo de 30 dias**, também depois da exclusão da conta (legítimo interesse: quem atacou uma conta não apaga o rastro excluindo a própria). O aviso de privacidade, o aviso da exclusão e o texto da página de cadastro dizem isso.
- **Consulta:** página **Segurança** no painel admin (`view-ginasiosadmin-seguranca`), com o resumo das últimas 24 horas, filtro por tipo e por conta e paginação de 100 em 100. Só o admin.

Como foi feito:
- `login/src/security-events.ts` e a tabela `security_events` (migração 3 do banco do login). A limpeza horária apaga o que passou de 30 dias e o que passar do teto de 100 mil eventos.
- **Contra inundação** (A04): bloqueios e pedidos recusados entram no máximo uma vez por minuto para cada tipo, conta e IP, e a tabela tem teto. Senhas erradas já são limitadas pelo próprio limite de tentativas.
- **A01:** a API interna nova (`/internal/security-events`) exige o token; a página e o filtro exigem admin.
- **A03:** filtros validados (tipo da lista, conta como id, "antes de" como número); tudo escapado na página.
- O teste de ponta a ponta ganhou o passo da página (senha errada do admin aparece no filtro por conta) e a limpeza dele apaga os eventos das contas E2E.

Validado: 2 testes novos no login (cada tipo de evento, o limite de um por minuto, os eventos mantidos depois da exclusão, a consulta com filtros e paginação, o prazo de 30 dias) e o teste de ponta a ponta com 8 passos.

### Containers e dependências (2026-10-19)

Decisões do usuário: manter as montagens (fluxo de `git pull`), tratar as dependências no nosso script sem mudar o `package.json` do fork, tirar o `probe-image-size`, rodar o Caddy sem root e pôr limites de recursos.

**Containers** (`docker-compose.yml`):
- Todos rodam com o usuário `PS_UID:PS_GID` (na VPS, o do `deploy`), sistema de arquivos somente leitura (`/tmp` em memória), `cap_drop: ALL` e `no-new-privileges`.
- O `web` (Caddy) só mantém `NET_BIND_SERVICE`, para abrir as portas 80 e 443. A CA local de desenvolvimento não é instalada no container (`skip_install_trust`).
- O `server` monta o código, o build (`dist/`) e as dependências **somente leitura**, e só grava em `config/`, `databases/` e `logs/`. O `config.js` também é somente leitura. Quem invadir o processo do servidor não consegue alterar o código que roda nem deixar algo para o próximo start.
- Dependências e build ficam com o `server-setup`, que roda antes e termina. Os testes do servidor rodam nele (`docker/server/test.sh`), com uma chave pública descartável: o token interno não chega a um container que instala pacotes de terceiros.
- O `volume-init` é o único com root, sem rede e só com `CHOWN` e `DAC_READ_SEARCH`: ajusta o dono dos volumes e da pasta do log de acesso, e termina.
- Limites: `server` 1,5 GB e 512 processos (inclui os subprocessos de batalha); `login` 256 MB e 64; `web` 256 MB e 256. Em uso normal: cerca de 400 MB, 40 MB e 15 MB.
- Imagens fixadas por digest (`node:24-bookworm-slim`, `caddy:2.10-alpine`); a atualização é manual e está em `docs/deploy-vps.md`, "Atualizar as imagens".
- A pasta do log de acesso passa a ter como dono o usuário dos containers (o `deploy`), e não o root. Na prática não muda quem acessa: o `deploy` está no grupo `docker`, que já equivale a root.

**Dependências do servidor** (`docker/server/derive-package.cjs`):
- Saem: `mysql2` e `pg` (bancos externos), `sqlite` e `sqlite3` (não usados pelo código; traziam o `tar` crítico e o `node-gyp`), `nodemailer`, `githubhook`, `cloud-env` e `probe-image-size`.
- O `mysql2` voltou como dependência **só de desenvolvimento** (2026-10-19): o `lib/database.ts` da Smogon importa os tipos dele, e sem eles a checagem de tipos do servidor (`tsc`) falhava. Ele nunca é carregado, porque o PS só o usa com MySQL configurado, e o `npm audit --omit=dev` não o conta.
- `better-sqlite3` fixo na 12.11.1 (antes instalado pelo entrypoint) e `tar-fs` na 2.1.4 ou mais nova (usado só na instalação).
- Resta 1 aviso moderado: `uuid` dentro do `sockjs`. Não se aplica: a falha exige passar um buffer ao `uuid`, e o `sockjs` só chama `uuidv4()`.
- O teste `test/lib/postgres.js` da Smogon fica de fora, porque testa a biblioteca do Postgres, que não instalamos.

Validado localmente: usuário e capabilities de cada container; escrita recusada no código, no build, nas dependências, no `config.js` e no sistema do container; escrita aceita nos bancos; site, sprites e páginas do login respondendo; e2e com cadastro por convite, intruso bloqueado, batalha entre dois jogadores, `/convite` e exclusão de contas (dados de jogo apagados pelo servidor); build completo do cliente; 2575 testes do servidor e 21 do login.

## Testes desta revisão
- **Login:** 19 testes (5 novos: aviso de privacidade, nomes reservados, anulação de códigos, bloqueio por conta e IP sem afetar outro IP e sem escapar por `X-Forwarded-For` forjado, POST de outro site sem `Origin`).
- **Servidor:** 2541 testes, incluindo os nomes proibidos e a retenção dos logs de batalha.
- **Privacidade (e2e):** a página `/privacidade` aparece em pt, o rodapé aponta para ela, e não há nenhum pedido direto a outros domínios (tela principal, teambuilder e batalhas).
- **E2E de segurança** (9 passos): tentativas de tomar o lado do NPC, trocar de lado e esconder a batalha, todas recusadas; a vitória contou.
- **Regressão** da jornada (13 passos).
- **Cabeçalhos:** conferidos com um servidor de eco local no lugar da Smogon; HSTS e Permissions-Policy presentes; sprites continuam carregando.

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
| Média | Containers como root, código montado com escrita, imagens sem digest, dependências do upstream com vulnerabilidades conhecidas | **Pendente** (deploy na VPS) |
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
| Baixa | Modlog (punições, com nome e IP) sem prazo de retenção definido | **Pendente** (o aviso diz "enquanto necessário para a segurança") |
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
- **Pendente para a VPS:** usuário sem privilégios (`user:`), código somente leitura, `read_only`, `cap_drop: ALL`, `no-new-privileges` e imagens fixadas por digest.

### A06 – Componentes vulneráveis
- O login não tem dependências de runtime.
- **Pendente:** o `npm audit` aponta vulnerabilidades no servidor (19, uma crítica: `tar`) e no cliente (12), quase todas transitivas, opcionais ou de build, herdadas do upstream. Na VPS, instalar sem as dependências opcionais que não usamos (mysql2, pg, nodemailer), acompanhar os merges do upstream e rodar `npm audit` periodicamente.

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
- **Pendente:** o login não tem trilha de eventos de segurança (bloqueios, trocas de senha). Isso foi uma escolha de minimização; se quisermos, contadores anônimos de curta retenção.

### A10 – SSRF
- O único destino externo é fixo (`play.pokemonshowdown.com`), e só `/sprites/*` e `/audio/*` passam pelo proxy. O login não faz pedidos para fora.

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
| **Log de acesso do site** (IP, data, método, caminho sem query string, status, tamanho, user agent) | arquivo do Caddy na VPS (`/var/log/ps-custom/caddy`, só root) | **14 dias** (logrotate diário) | Não (não é ligado à conta; some sozinho) |
| Rank e autoridade de sala | `server/config` | até a exclusão | Sim |
| Ladder | `server/config/ladders` | até a exclusão | Sim |
| Jornadas, insígnias e histórico | `server/databases/gym-challenge.db` | até a exclusão | Sim |
| Estado das batalhas de ginásio em andamento (nomes, times e jogadas, sem chat) | `server/databases/gym-challenge.db` (`run_battles.input_log`) | até a batalha terminar | Sim (e as batalhas em andamento terminam com forfeit) |
| Logs dos containers | Docker (3 × 10 MB por serviço) | por tamanho | Não (sem IP: o log do Caddy filtra o IP dos avisos; pode haver nomes em erros) |
| Logs de batalha da ladder (nomes e times) | `server/logs/AAAA-MM/...` | 30 dias | Sim |
| **Modlog e punições** (nome e IP, só quando há moderação) | `server/logs/modlog`, `config/punishments.tsv` | **indefinida** | **Não** |
| Times e preferências | localStorage do navegador | controle do usuário | Local |
| Idioma escolhido (`pt`/`en`) | localStorage, cookie `ps_lang` (1 ano) e memória do servidor de jogo enquanto conectado | controle do usuário | Local (não identifica ninguém) |

Batalhas contra NPC não geram log (`logchallenges` desligado). O chat não é registrado (`logchat` desligado).

### Decisões do usuário (2026-10-18) e o que foi feito
1. **Aviso de privacidade** em `/privacidade` (pt e en, `login/src/privacy.ts`): controlador (o admin), dados, finalidades e bases legais, terceiros, retenção, direitos do titular. **Pedidos: mensagem privada ao admin no jogo**; a exclusão de conta é feita direto em `/conta`. O rodapé do cliente e as páginas de cadastro e conta apontam para ele, e os textos curtos foram corrigidos ("não guardamos seu IP" valia só para o login).
2. **Logs de batalha da ladder: 30 dias.** Uma limpeza diária apaga os dias mais antigos, e os logs em que o jogador aparece são apagados junto com a conta (`custom-accounts.ts`). O modlog continua sem prazo definido (pendência).
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

## Testes desta revisão
- **Login:** 19 testes (5 novos: aviso de privacidade, nomes reservados, anulação de códigos, bloqueio por conta e IP sem afetar outro IP e sem escapar por `X-Forwarded-For` forjado, POST de outro site sem `Origin`).
- **Servidor:** 2541 testes, incluindo os nomes proibidos e a retenção dos logs de batalha.
- **Privacidade (e2e):** a página `/privacidade` aparece em pt, o rodapé aponta para ela, e não há nenhum pedido direto a outros domínios (tela principal, teambuilder e batalhas).
- **E2E de segurança** (9 passos): tentativas de tomar o lado do NPC, trocar de lado e esconder a batalha, todas recusadas; a vitória contou.
- **Regressão** da jornada (13 passos).
- **Cabeçalhos:** conferidos com um servidor de eco local no lugar da Smogon; HSTS e Permissions-Policy presentes; sprites continuam carregando.

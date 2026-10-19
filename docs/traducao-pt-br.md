# Tradução pt-BR do cliente

O jogo funciona em **português do Brasil** e em **inglês**. O jogador escolhe o idioma pelo botão com o globo, no topo do cliente (ao lado do som), ou no seletor "Idioma" das opções. Na primeira visita vale o idioma do navegador: pt* abre em português, qualquer outro abre em inglês. Depois disso vale a escolha, que fica salva.

## Decisões do usuário (2026-10-18)

- **Nomes em inglês**, como joga a comunidade brasileira: Pokémon, golpes, habilidades, itens e naturezas ("Thunderbolt", "Leftovers", "Adamant").
- **Tipos:** sempre o **selo oficial do tipo** (a mesma imagem colorida dos jogos), inclusive no meio do texto. Onde não dá para mostrar imagem, o nome fica em inglês. Nos textos, o tipo vem depois de "tipo/tipos" ("golpes do tipo Fire"), e o cliente troca esse trecho pelo selo.
- **Atributos:** por extenso em português (Ataque, Defesa, Ataque Especial, Defesa Especial, Velocidade, precisão, evasão). As **abreviações ficam em inglês** (HP, Atk, Def, SpA, SpD, Spe, "Sp. Atk").
- **Descrições traduzidas:** golpes, habilidades e itens, inclusive as variantes de gerações antigas.
- **Idioma inicial:** o do navegador. Depois, o escolhido no botão.

## Como funciona

| Parte | Onde | O que traduz |
|---|---|---|
| Textos de batalha | `server/data/text/pt/*.ts` (fork do servidor) | mensagens do log, descrições, nomes de atributos, status, alvos, tags do teambuilder. O build do cliente gera `data/text/pt.js` a partir deles |
| Catálogo compartilhado | `server/data/text/pt/ui.ts` | tooltips, Pokédex e rótulos usados pelo cliente e pelo servidor |
| Catálogo do cliente | `client/translations/pt.ts` | textos marcados com `TL` no cliente (tooltips de batalha, busca, log). Precisa ficar sincronizado com `translations/en-template.ts`, senão o build falha |
| Interface clássica | `client/.../src/oldclient/client-i18n.js` + `client-i18n-pt.js` | os textos fixos em inglês dos arquivos da Smogon (`src/oldclient/*.js`), trocados depois de virarem DOM |
| Servidor | `server/translations/pt/` (já existia) | páginas e mensagens do servidor. O cliente avisa o idioma por `/updatesettings` |
| Páginas do login | `login/src/i18n.ts`, `privacy.ts`, `rules.ts` | cadastro, conta, privacidade, regras. Seguem o cookie `ps_lang`, gravado pelo cliente, e têm os links "Português · English" |

**Camada da interface clássica** (`client-i18n.js`). Os arquivos da Smogon não são alterados. Um `MutationObserver` troca os textos pelo dicionário, que tem três tipos de entrada:
- `exact`: o nó de texto inteiro, ou os atributos `title`, `placeholder`, `aria-label`, `alt` e o `value` de botões;
- `patterns`: textos com valores do programa (`{0}`);
- `html`: trechos fixos com tags no meio. Uma entrada como `<label>Attack</label>` vira contexto: "Attack" num `<label>` é "Ataque", e num botão é "Atacar".

A camada também:
- troca "tipo Fire" e os rótulos de tipo dos botões de golpe pelo selo do tipo;
- traduz `alert`, `confirm` e `prompt`;
- esconde o aviso "o novo cliente está disponível no seu idioma", porque o projeto não serve o cliente novo.

**Segurança:**
- textos só são trocados como texto (`nodeValue`/`setAttribute`); o único `innerHTML` vem das entradas `html`, fixas no nosso dicionário;
- mensagens escritas por usuários (classe `chatmessage-*`), caixas `.infobox`, nomes e campos de texto ficam de fora;
- padrões só valem para textos de até 300 caracteres;
- o cookie `ps_lang` só aceita `pt` ou `en` e não é sensível, por isso não é HttpOnly.

**LGPD:** o idioma fica no navegador (`localStorage` e o cookie `ps_lang`) e é informado ao servidor de jogo enquanto o jogador está conectado. O aviso de privacidade (`login/src/privacy.ts`) diz isso.

## Como traduzir textos novos

Use este passo a passo quando chegarem textos novos da Smogon (golpes, itens, mensagens, catálogos) ou textos nossos. As ferramentas ficam em `scripts/traducao/` e trabalham numa pasta de trabalho qualquer (`<pasta>`), fora do repositório.

1. **Atualizar a base:**
   - `docker compose exec server node build`;
   - se o catálogo do cliente mudou (`en-template.ts`), rodar `node build translations --sync` dentro do `client-build`. Isso acrescenta as chaves novas a `client/translations/pt.ts` com `null`.
2. **Extrair o que falta:** `node scripts/traducao/extrair.cjs <pasta>`. O script cria, em `<pasta>/src/`, um JSON por lote com o texto em inglês do que ainda não tem tradução:
   - `batalha-*.json`: textos de batalha;
   - `ui-01.json`: os dois catálogos de interface. As notas da Smogon para tradutores ficam em `<pasta>/ui-01.notes.json`;
   - `regras-01.json`: as descrições das regras de formato que aparecem no log.
3. **Traduzir cada lote** para `<pasta>/out/<mesmo nome>.json`, com as mesmas chaves, seguindo as regras e o glossário abaixo. Pode ser à mão ou com agentes; nesse caso, passe a eles esta seção inteira.
4. **Validar:** `node scripts/traducao/validar.cjs <pasta> <lote>` para cada lote. O validador confere chaves, placeholders, espaços iniciais, tipos traduzidos por engano, tipos sem "tipo" antes (aviso) e shortDesc longo demais (aviso).
5. **Aplicar:** `node scripts/traducao/aplicar.cjs <pasta>`. Isso junta as traduções novas às que já existem e regrava os arquivos `pt`.
6. **Gerar e testar:**
   - no `client-build`, `node build translations && node build`;
   - `docker compose up -d --force-recreate server`, que refaz o build do servidor no `server-setup` (o container `server` tem o código somente leitura);
   - rodar as suítes do servidor, do login e do cliente (`node test/run`). O teste "keeps ... locale catalogs synchronized" do cliente acusa um `pt.ts` dessincronizado.

**Textos da interface clássica** (`src/oldclient/*.js`) não são extraídos automaticamente, porque estão espalhados no código como HTML montado à mão. Quando uma atualização da Smogon mexer nesses arquivos, levante os textos novos à mão e grave-os em `<pasta>/out/dicionario-01.json`, no formato `{ "exact": {}, "patterns": [], "html": {} }`. Depois valide e aplique como acima. Regras do dicionário:
- **`exact`:** a chave é o nó de texto **inteiro**, depois de decodificar entidades HTML, juntar espaços e tirar os das pontas. As tags quebram o texto em nós separados.
- **`patterns`:** só quando o valor do programa fica no **mesmo** nó de texto.
- **`html`:** só para trechos pequenos e 100% fixos.
- **Nunca entram:**
  - nomes de Pokémon, golpes, habilidades, itens, naturezas e tipos;
  - siglas que ficam iguais (Teambuilder, Ladder, EVs, IVs, tiers);
  - classes CSS, comandos, ids e URLs.

**Novos textos nossos:** no servidor, seguem o fluxo de `TL` descrito no CLAUDE.md. Nas páginas do login, entram em `i18n.ts`. No cliente, todo texto visível precisa ter a versão em português no dicionário.

## Regras de tradução

Público: jogadores brasileiros de Pokémon competitivo. Tom claro e natural, português do Brasil, "você". O **significado mecânico tem que ser idêntico** ao inglês: números, condições, exceções, arredondamentos.

1. Nomes de Pokémon, golpes, habilidades, itens e naturezas ficam em inglês, exatamente como no original, sem plural e sem artigo colado.
2. Tipos ficam em inglês, sempre depois de "tipo/tipos":
   - "do tipo Fire", "dos tipos Fire e Water", "tipos Rock/Ground";
   - nunca traduzir ("tipo Fogo" está errado);
   - nomes próprios que contêm um tipo ("Fire Blast", "Water Absorb", "Electric Terrain") ficam intactos.
3. Atributos por extenso em português; abreviações em inglês.
4. Placeholders ficam intactos (`[POKEMON]`, `[MOVE]`, `{POKEMON}`, `{STAT}`...):
   - sem modificadores como `:definite`, que o português não suporta;
   - para o artigo do atributo, use `{INFLECT:STAT:ms=O:fs=A:mp=Os:fp=As}`. O gênero dos atributos está em `names.ts`.
5. Espaços no começo da mensagem são significativos e precisam ser preservados. Preserve também `**negrito**`, `\n` e os parênteses.
6. Sem artigo antes de nomes de Pokémon, golpes, habilidades e itens (o gênero deles é desconhecido). Use o masculino genérico para o Pokémon.
7. Vírgula decimal na prosa ("1,5×"); frações e porcentagens iguais ao original.
8. shortDesc curto: golpes com até ~55 caracteres, habilidades e itens com até ~85.
9. Na interface, botões entre colchetes no catálogo ("[OK]") são traduzidos **sem** os colchetes.

### Glossário de mecânicas

| Inglês | Português |
|---|---|
| the user / the target | o usuário / o alvo |
| foe(s) / opposing Pokémon | oponente(s) / Pokémon adversário |
| ally / holder (item) | aliado / o portador |
| stage(s); raise / lower | estágio(s); aumentar / diminuir |
| critical hit | acerto crítico |
| flinch | recuar ("fazer o alvo recuar") |
| priority / contact | prioridade / contato |
| burn, paralysis, poison, badly poisoned | queimadura, paralisia, envenenamento, gravemente envenenado |
| sleep, freeze, confusion, infatuation | sono, congelamento, confusão, paixão |
| faint | desmaiar |
| switch in / switch out | entrar em campo / sair de campo |
| weather: sun, rain, sandstorm, hail, snow | clima: sol, chuva, tempestade de areia, granizo, neve |
| Intense Sun / Heavy Rain / Strong Winds | sol extremo / chuva forte / ventos fortes |
| terrain | terreno (nomes como "Electric Terrain" em inglês) |
| recoil / crash damage | dano de recuo / dano de queda |
| substitute (o boneco) | substituto (o golpe Substitute fica em inglês) |
| super effective / not very effective | superefetivo / não é muito efetivo |
| multi-hit / charge turn | múltiplos acertos / turno de carga |
| semi-invulnerable / grounded | semi-invulnerável / no chão |
| Mega Evolve / Terastallize | megaevoluir / terastalizar |
| Z-Move, Max Move, Dynamax, G-Max, Tera Type, Berry | iguais (inglês) |
| Doubles / Singles | Duplas / Simples |
| party / team | equipe / time |
| base power | poder base |
| "No additional effect." | "Sem efeito adicional." |

### Glossário da interface

| Inglês | Português |
|---|---|
| Battle! | Batalhar! |
| Find a user | Procurar usuário |
| Choose name / Change name / Log out | Escolher nome / Mudar nome / Sair |
| Options / Sound / Format | Opções / Som / Formato |
| Team(s) | Time(s) |
| Teambuilder, Ladder, Timer, Replay, Shiny | iguais |
| Tournament(s) / Chat room(s) | Torneio(s) / Sala(s) de chat |
| Join / Leave / Close / Cancel / Save / Delete | Entrar / Sair / Fechar / Cancelar / Salvar / Excluir |
| Import / Export / Validate | Importar / Exportar / Validar |
| Challenge (verbo / substantivo) | Desafiar / Desafio |
| Accept / Reject / Forfeit | Aceitar / Recusar / Desistir |
| Switch / Attack (botões de batalha) | Pokémon / Atacar |
| Moves / Abilities / Items / Stats | Golpes / Habilidades / Itens / Atributos |
| Nickname / Level / Gender / Happiness | Apelido / Nível / Gênero / Felicidade |
| Spectators / Users / Friends | Espectadores / Usuários / Amigos |
| Block PMs / Block challenges | Bloquear MPs / Bloquear desafios |
| Loading... / Connecting... / Disconnected | Carregando... / Conectando... / Desconectado |
| Untitled | Sem título |
| Gym Challenge / Gym profile / Official Formats | Desafio de Ginásios / Perfil de ginásio / Formatos oficiais |
| Elite Four / Champion / Gym / badge | Elite 4 / Campeão / Ginásio / insígnia |

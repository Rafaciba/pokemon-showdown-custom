# Pacotes de treinadores e desafios

Um pacote é um arquivo JSON que leva treinadores e desafios do Desafio de Ginásios de um servidor para outro, por exemplo do ambiente local para a VPS. A importação e a exportação ficam no painel admin, na página **Importar e exportar** (`view-ginasiosadmin-pacotes`). O código está em `server/server/chat-plugins/gym-challenge/transfer.ts` (no fork), e as páginas em `admin.ts`. Feito em 2026-10-19.

Jogadores, jornadas, conquistas e insígnias ganhas nunca vão num pacote: ele só tem os treinadores NPC e a configuração dos desafios.

## Como usar

**Exportar** (no servidor de origem):

1. No painel, abra **Importar e exportar**.
2. Em "Exportar", marque os desafios (os treinadores que eles usam vão junto) e, se quiser, outros treinadores avulsos.
3. Clique em **Exportar**. A página mostra o JSON numa caixa: clique dentro dela, use Ctrl+A e Ctrl+C, e salve como `.json` ou cole direto no outro servidor.

**Importar** (no servidor de destino, por exemplo a VPS):

1. Abra o arquivo `.json` no computador, copie todo o conteúdo e cole na caixa "Pacote (JSON)" da página **Importar e exportar**.
2. Clique em **Ver prévia da importação**. Nada é gravado ainda. A prévia mostra, para cada treinador e desafio, se ele é novo, se já existe (e vai ser pulado) ou se tem erro. Para cada desafio novo, ela também lista o que falta para abri-lo.
3. Se estiver tudo certo, clique em **Confirmar importação**. Os desafios entram como rascunho: revise cada um no painel e abra quando quiser.

Não é preciso copiar o arquivo para a VPS nem usar o terminal: basta colar o conteúdo no painel de produção.

## Regras da importação

- **Nada é alterado no que já existe.** Um treinador do pacote com o mesmo nome de um treinador do banco é pulado, e os desafios importados usam o treinador do banco, com o time que ele tem lá. A prévia mostra o treinador do banco nessas linhas. Um desafio com nome já cadastrado também é pulado. A comparação de nomes ignora maiúsculas, espaços e pontuação, como nos nomes de formato.
- **Os desafios entram como rascunho**, mesmo que estivessem abertos na origem.
- **Qualquer erro impede a importação inteira**: um time inválido, um treinador sem tipo num ginásio, uma etapa que não existe na configuração do desafio, uma insígnia ou sprite desconhecido. Corrija o arquivo e cole de novo.
- **As validações são as mesmas dos formulários do painel:** nome, título, tipo, sprite oficial, time no validador do PS (com o tipo do treinador), batalha em dupla com pelo menos 2 Pokémon, regras e formato do desafio, nome que não colide com outro formato.
- **Validado de novo ao confirmar:** o pacote fica na memória do servidor (por 30 minutos) entre a prévia e a confirmação, e é conferido outra vez contra o banco atual antes de gravar. A gravação é uma transação só.
- **Tamanho:** até 95 KB por vez. O PS descarta mensagens acima de 100 KB. A exportação avisa quando o pacote passa do limite: exporte em partes. Um pacote tem no máximo 200 treinadores e 20 desafios.
- **Dois treinadores do banco com o mesmo nome** não podem ser exportados juntos (o pacote referencia os treinadores pelo nome). Se um pacote referencia um nome que existe duas vezes no banco de destino, a importação aponta o erro.

## Formato do arquivo

```json
{
	"type": "liga-desafios/ginasios",
	"version": 1,
	"trainers": [
		{
			"name": "Brock",
			"title": "Gym Leader",
			"type": "Rock",
			"doubles": false,
			"sprite": "brock-gen3",
			"team": "Golem @ Custap Berry\nAbility: Sturdy\n..."
		}
	],
	"challenges": [
		{
			"name": "Liga Kanto",
			"baseFormat": "gen9nationaldexag",
			"customRules": "Standard NatDex, Terastal Clause, Z-Move Clause, Dynamax Clause",
			"typeMode": "fixed",
			"gymCount": 8,
			"orderMode": "free",
			"hasElite4": true,
			"teamLock": false,
			"baseAILevel": "medium",
			"timerMode": "free",
			"turnSeconds": null,
			"lossLimit": null,
			"eliminateOnElite4Loss": false,
			"eliminateOnChampionLoss": false,
			"stages": [
				{ "kind": "gym", "position": 1, "trainer": "Brock", "aiLevel": null, "badge": "kanto-boulder" },
				{ "kind": "champion", "position": 1, "trainer": "Blue", "aiLevel": null, "badge": null }
			],
			"pool": []
		}
	]
}
```

- **Treinador:** `name` (obrigatório); `title`; `type` (um dos 18 tipos, em inglês, ou `null` para quem só pode ser Campeão); `doubles`; `sprite` (id oficial do PS, como na galeria do painel, ou vazio); `team` (formato de exportação do teambuilder, com `\n` entre as linhas).
- **Desafio:** os mesmos campos do formulário do painel. Os que faltarem usam o valor de um desafio novo no painel. `baseAILevel` e `aiLevel` aceitam `random`, `easy`, `medium` e `hard`; `aiLevel: null` usa a dificuldade base.
- **Etapas (`stages`):** `kind` é `gym`, `elite4` ou `champion`; `position` vai de 1 até o número de ginásios, de 1 a 4 na Elite 4, e é 1 no Campeão. `trainer` é o nome de um treinador do pacote ou do banco de destino. `badge` (só ginásios) é o id do catálogo de insígnias (`badge-catalog.ts`, por exemplo `kanto-boulder`) ou `null` para o ícone do tipo.
- **Banco de sorteio (`pool`):** só nos desafios de tipos sorteados (`typeMode: "random"`), com `trainer`, `aiLevel` e `badge`.

## Pacotes das ligas

A pasta `pacotes/` (repo raiz) traz quatro pacotes prontos, gerados por `scripts/pacotes/ligas.cjs`:

| Arquivo | Desafio | Ginásios | Elite 4 | Campeão |
|---|---|---|---|---|
| `liga-kanto.json` | Liga Kanto | Brock, Misty, Lt. Surge, Erika, Koga, Sabrina, Blaine, Giovanni | Lorelei, Bruno, Agatha, Lance | Blue |
| `liga-johto.json` | Liga Johto | Falkner, Bugsy, Whitney, Morty, Chuck, Jasmine, Pryce, Clair | Will, Koga (Johto), Bruno (Johto), Karen | Lance (Johto) |
| `liga-hoenn.json` | Liga Hoenn | Roxanne, Brawly, Wattson, Flannery, Norman, Winona, Tate e Liza, Wallace | Sidney, Phoebe, Glacia, Drake | Steven |
| `liga-sinnoh.json` | Liga Sinnoh | Roark, Gardenia, Maylene, Crasher Wake, Fantina, Byron, Candice, Volkner | Aaron, Bertha, Flint, Lucian | Cynthia |

Decisões do usuário (2026-10-19):

- **Times:** competitivos e completos, com 6 Pokémon, inspirados nos times dos jogos e completados com Pokémon do tipo do treinador. O formato é o padrão dos desafios (Pokédex completa até a gen 9, com Megaevolução e sem Tera, Z-Moves e Dynamax), e cada time tem no máximo uma Mega.
- **Desafios:** configuração padrão do servidor, com tipos fixos, ordem livre, Elite 4, sem trava de time, IA base Médio, tempo livre e derrotas ilimitadas. As insígnias são as oficiais de cada região.
- **Repetidos:** Koga, Bruno e Lance aparecem em Kanto e em Johto. Em Johto, eles são treinadores separados ("Koga (Johto)", "Bruno (Johto)" e "Lance (Johto)"), com o time e o título do papel que têm lá.
- **Títulos e nomes em inglês** (Gym Leader, Elite Four, Champion). A exceção é "Tate e Liza", porque o & é proibido em nomes.
- **Tate e Liza** batalham em dupla, como nos jogos, com um time de dupla (Trick Room, Follow Me e golpes em área). Para mudar, desmarque "Batalha em dupla" no treinador.

Os quatro pacotes passam na validação da importação, e as quatro ligas ficam prontas para abrir num banco vazio. Os pacotes são independentes: podem ser importados em qualquer ordem, e cada um tem 16 KB.

**Atenção:** se o servidor de destino já tiver treinadores com esses nomes, por exemplo um Brock montado à mão, a liga importada usa o treinador que já existe, com o time dele. A prévia mostra isso. Se você preferir o time do pacote, renomeie ou apague o treinador antigo antes de importar. Só dá para apagar treinadores que nenhum desafio usa.

Para mudar um time do pacote, edite `scripts/pacotes/ligas.cjs`, rode `node scripts/pacotes/ligas.cjs` (na raiz) e confira a prévia importando no ambiente local.

## Liga Favoritos

O pacote `pacotes/liga-favoritos.json` (22 KB) é gerado por `scripts/pacotes/favoritos.cjs` a partir dos times de Pokémon favoritos do usuário. Pedido e decisões do usuário (2026-10-20):

- **Treinadores:** um por tipo, chamado "<Tipo> Rafa" (Fire Rafa, Steel Rafa... 18 ao todo), com título Gym Leader e os Pokémon favoritos do usuário daquele tipo.
  - O usuário escolheu só os Pokémon, e as builds são nossas, no mesmo estilo das ligas. Cada time tem no máximo uma Mega, quando há uma entre os Pokémon do time.
  - Os apelidos e os gêneros do time Ground ficam como o usuário colocou.
- **Campeão:** "Favorite Rafa", com o time de favoritos do usuário exatamente como ele montou, inclusive apelidos, gêneros e builds.
- **Desafio "Liga Favoritos":**
  - tipos sorteados: cada jornada sorteia 8 dos 18 treinadores de tipo como líderes, e o Favorite Rafa é o Campeão;
  - sem Elite 4;
  - o resto na configuração das outras ligas (IA base Médio, tempo livre, derrotas ilimitadas);
  - insígnias com o ícone do tipo.
- **Sem sprite:** o sprite é escolhido depois, na galeria do painel.

O pacote passa na validação da importação, e a liga fica pronta para abrir num banco vazio.

## Segurança e LGPD

Ver a seção "Pacotes de treinadores e desafios" de `docs/revisao-seguranca-lgpd.md`. Em resumo:

- só o admin acessa;
- o JSON é lido campo a campo, com tipos conferidos e as mesmas validações do painel;
- tudo é escapado nas páginas;
- o modlog registra só a quantidade importada;
- o pacote não tem dados pessoais.

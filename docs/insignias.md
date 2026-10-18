# Insígnias do Desafio de Ginásios

As insígnias são as dos ginásios dos jogos principais (Kanto até Paldea), com nome, região, líderes, cidade, tipo e imagem, tiradas da página [Badge](https://bulbapedia.bulbagarden.net/wiki/Badge) da Bulbapedia.

## Decisões do usuário (2026-10-18)

- **Fonte:** Bulbapedia. Ela bloqueia acesso automatizado (Cloudflare), então a página é salva à mão no navegador e o importador lê os arquivos salvos.
- **Imagens fora do git:** são da Nintendo, e os repositórios são públicos (o PS também não versiona os sprites). Ficam em `assets/badges/` (ver "Onde ficam"), vão para a VPS por `scp` e entram no backup.
- **Quais entram:** só as insígnias de ginásio das ligas principais. Em Paldea, só os 8 ginásios da Victory Road (as Star Badges e Titan Badges não são de ginásio).
- **Unova:** as insígnias repetidas entre Black/White e Black 2/White 2 (mesma imagem) viram uma só, com os líderes juntos (ex.: Basic Badge, Lenora e Cheren).
- **Trio Badge:** sem tipo fixo (Cilan/Grass, Chili/Fire, Cress/Water).
- **Tipo:** a página não traz o tipo em texto; ele vem da cor do quadro de cada insígnia, que segue a paleta de tipos da Bulbapedia. Conferido com o tipo de cada líder nos jogos.

Associação e exibição (etapas 2 e 3), também decididas pelo usuário:
- a insígnia é escolhida para o **treinador em cada desafio**, no painel do desafio (ginásios fixos e treinadores do sorteio). As do tipo do treinador aparecem primeiro, mas qualquer uma pode ser escolhida;
- **sem escolha**, aparece o ícone do tipo, com o nome "insígnia do tipo X";
- a jornada guarda uma cópia (id, nome e imagem) quando começa;
- a imagem aparece no painel, na página da jornada, no histórico, no aviso da sala e no perfil;
- **perfil:** as insígnias das jornadas vencidas ficam como **permanentes**, com nome, líder, desafio e data da vitória no ginásio.

O resultado são 68 insígnias: Kanto 8, Johto 8, Hoenn 8, Sinnoh 8, Unova 10, Kalos 8, Galar 10 e Paldea 8.

## Onde ficam

| O quê | Onde | No git? |
|---|---|---|
| Catálogo (id, nome, região, líderes, cidade, tipo, arquivo) | `server/server/chat-plugins/gym-challenge/badge-catalog.ts` (fork do servidor), gerado | Sim |
| Imagens (`<id>.png`, ex.: `kanto-boulder.png`) | `assets/badges/` (repo raiz) | **Não** (`.gitignore`) |
| Importador | `scripts/insignias/importar.cjs` | Sim |

O Caddy serve as imagens em `https://{PS_HOST}/badges/<id>.png` (só nomes `[a-z0-9-]+.png`; o resto dá 404), com cache de um dia.

## Como importar (ou reimportar)

1. No navegador, abra https://bulbapedia.bulbagarden.net/wiki/Badge e espere o artigo aparecer (se houver verificação "você é humano", conclua antes). Desça a página até o fim para carregar as imagens.
2. `Ctrl+S`, tipo **"Página da Web, completa"**, numa pasta fora dos repositórios (ex.: `D:\Workspace\insignias-bulbapedia\`). Confira: um `.htm` de cerca de 1,5 MB e uma pasta `..._files` com imagens como `100px-Boulder_Badge_1hzS.png`. Um `.htm` pequeno com "Just a moment..." é a tela da Cloudflare, não a página.
3. Na raiz do projeto:
   ```sh
   node scripts/insignias/importar.cjs "D:/Workspace/insignias-bulbapedia/Badge - Bulbapedia, the community-driven Pokémon encyclopedia.htm"
   ```
   O script para com erro se alguma cor não corresponder a um tipo ou se a página mudar de formato.
4. Confira a diferença no `badge-catalog.ts` (git diff no fork do servidor) e rode os testes do servidor (o teste "badge catalog" confere ids, tipos e imagens).
5. Na VPS, copie as imagens (ver `docs/deploy-vps.md`, passo 9).

Os ids (`<região>-<nome>`) ficam gravados nos desafios e nas jornadas: não renomeie ids de insígnias já usadas.

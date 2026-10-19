# Sprites e sons próprios

O repositório do cliente do PS não traz as pastas `/sprites/` e `/audio/` ("por causa do tamanho", diz o README deles). O PS publica os dois como pacotes oficiais, gerados pela ferramenta `build-tools/zip-sprites` do cliente:

- `https://pokemonshowdown.com/files/resources/sprites.zip` (cerca de 890 MB);
- `https://pokemonshowdown.com/files/resources/audio.zip` (cerca de 240 MB).

## Decisões do usuário (2026-10-18)

- **Servir do nosso disco**, a partir desses pacotes oficiais.
- **Reserva:** o que faltar no disco (por exemplo, um Pokémon mais novo que o pacote) vem do site oficial pelo proxy que já existia, sem dados do jogador.
- **Na VPS, o download é feito direto nela** (nada passa pelo computador do admin).
- **Fora do git:** o fork do cliente já ignora `play.pokemonshowdown.com/sprites/` e `/audio/`. Os arquivos não entram no backup: dá para baixar de novo.

## Como funciona

- `scripts/recursos-ps.sh` baixa os pacotes por HTTPS, testa o zip (CRC), confere que toda entrada está dentro de `sprites/` ou `audio/` (sem `..`, sem caminho absoluto e sem links simbólicos), extrai numa pasta de trabalho fora da pasta servida e só então troca a versão antiga pela nova. Se algo falhar, a versão antiga continua no lugar.
- O Caddy serve `/sprites/*` e `/audio/*` do disco (cache de 7 dias no navegador) e usa o proxy para o site oficial só quando o arquivo não existe.
- O build do cliente (`docker/client/build.sh`) gera o `pokedex-mini.js` (tamanhos dos sprites animados) a partir dos sprites locais. Sem os sprites, continua baixando uma cópia do site oficial.

## Instalar ou atualizar

Precisa de `curl` e `unzip` e de uns 3 GB livres durante a instalação (o zip, a extração e a versão antiga convivem até a troca).

Na VPS:

```sh
sudo apt install -y unzip
cd /opt/pokemon-showdown-custom
sh scripts/recursos-ps.sh
docker compose run --rm client-build
```

O `client-build` gera o `pokedex-mini.js` com os sprites novos. Não precisa reiniciar o Caddy.

No ambiente local (Windows), rode o script num container (Git Bash, na raiz do projeto). A pasta `client` inteira é montada para a pasta de trabalho ficar no mesmo disco. `RECURSOS_OVERWRITE=1` é necessário porque o Windows não distingue nomes que só diferem em maiúsculas (o pacote tem `unown-L.gif` e `unown-l.gif`); só afeta o desenvolvimento:

```sh
MSYS_NO_PATHCONV=1 docker run --rm -e RECURSOS_OVERWRITE=1 -v "$PWD/scripts:/scripts:ro" -v "$PWD/client:/client" \
  debian:bookworm-slim sh -c "apt-get update -qq && apt-get install -y -qq curl unzip ca-certificates && sh /scripts/recursos-ps.sh /client/play.pokemonshowdown.com"
docker compose run --rm client-build
```

Os arquivos que já existem e não vêm no pacote são preservados: o fork do cliente versiona alguns arquivos em `sprites/` (por exemplo, `index.php` e a pasta `trainers-custom`, que o pacote não inclui). Sprites que o PS removeu do pacote também continuam no disco, sem prejuízo.

Para atualizar, rode o script de novo de vez em quando (o PS atualiza os pacotes quando sai conteúdo novo; a data aparece em `curl -sI https://pokemonshowdown.com/files/resources/sprites.zip | grep -i last-modified`). Até lá, a reserva cobre o que faltar.

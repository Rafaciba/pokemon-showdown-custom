#!/bin/sh
# Build do cliente do PS dentro do container (código montado em /app).
#
# Os dados do teambuilder (pokédex, golpes, formatos...) são gerados a partir
# do NOSSO servidor, montado em /app/caches/pokemon-showdown. O "--no-update"
# impede o script original de clonar/puxar o repositório da Smogon.
#
# /app/config é um volume próprio (não a pasta config/ do fork): aqui geramos
# config.js e routes.json a partir dos templates em /opt/client, com PS_HOST.
# O Caddy serve /config/* desse mesmo volume.
#
# CLIENT_FORCE_BUILD=1 força o build completo (ex.: após mudar formatos/mods).
set -eu
cd /app

: "${PS_HOST:?PS_HOST não definido}"
case "$PS_HOST" in
	localhost) echo "[client] PS_HOST não pode ser 'localhost' (use ps.localhost)"; exit 1 ;;
	*[!A-Za-z0-9.-]*) echo "[client] PS_HOST inválido: $PS_HOST"; exit 1 ;;
esac

render() { sed "s/__PS_HOST__/$PS_HOST/g" "$1" > "$2"; }
# O build acrescenta Config.routes/version ao config.js; partimos sempre do template
render /opt/client/config.js config/config.js
render /opt/client/routes.json config/routes.json

if [ "${CLIENT_FORCE_BUILD:-0}" = "1" ] \
	|| [ ! -f play.pokemonshowdown.com/data/pokedex.js ] \
	|| [ ! -f play.pokemonshowdown.com/js/client-main.js ] \
	|| [ ! -f play.pokemonshowdown.com/caches/index-old.html ]; then
	echo "[client] build completo (dados do servidor + compilação) para $PS_HOST..."
	node build full --no-update
else
	echo "[client] build rápido para $PS_HOST. Use CLIENT_FORCE_BUILD=1 para regenerar os dados."
	node build
fi

# pokedex-mini(-bw).js: JavaScript com os tamanhos dos sprites animados.
# Com os sprites no disco (scripts/recursos-ps.sh), é gerado aqui a partir deles.
# Sem eles, uma cópia é baixada do site oficial uma vez e servida localmente: assim
# nenhum script de terceiro é buscado a cada acesso (integridade).
if [ -d play.pokemonshowdown.com/sprites/ani ]; then
	echo "[client] gerando pokedex-mini a partir dos sprites locais..."
	node ./build-tools/build-minidex
fi
for f in pokedex-mini.js pokedex-mini-bw.js; do
	dest="play.pokemonshowdown.com/data/$f"
	if [ ! -s "$dest" ]; then
		if node -e "fetch('https://play.pokemonshowdown.com/data/' + process.argv[1]).then(async r => {
			if (!r.ok) throw new Error('HTTP ' + r.status);
			require('fs').writeFileSync(process.argv[2], Buffer.from(await r.arrayBuffer()));
		})" "$f" "$dest"; then
			echo "[client] $f baixado"
		else
			echo "[client] aviso: não foi possível baixar $f"
		fi
	fi
done

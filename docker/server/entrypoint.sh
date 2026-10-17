#!/bin/sh
# Inicializa o servidor de jogo do PS dentro do container (código montado em /app).
set -eu
cd /app

# O PS só lê config/config.js; a fonte de verdade é docker/server/config.js
cp /opt/ps/config.js config/config.js

# Garante os administradores (~) listados em PS_ADMINS (nomes separados por vírgula).
# Só acrescenta quem ainda não está no usergroups.csv; nunca rebaixa ninguém.
# Admins precisam ter conta no login server (o PS exige login com senha para ranks).
if [ -n "${PS_ADMINS:-}" ]; then
	touch config/usergroups.csv
	echo "$PS_ADMINS" | tr ',' '\n' | while IFS= read -r name; do
		name=$(echo "$name" | sed 's/^ *//; s/ *$//')
		[ -z "$name" ] && continue
		id=$(echo "$name" | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9')
		if ! cut -d, -f1 config/usergroups.csv | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9\n' | grep -qx "$id"; then
			echo "$name,~," >> config/usergroups.csv
			echo "[server] admin adicionado: $name"
		fi
	done
fi

# "start" roda o build (esbuild → dist/) e instala dependências se faltarem
exec node pokemon-showdown start

#!/bin/sh
# Prepara o servidor de jogo e termina (serviço server-setup). Roda antes do servidor,
# que depois fica com o código, o build e as dependências somente leitura.
#
# 1. config/config.js e administradores (PS_ADMINS);
# 2. dependências, só as que usamos (ver derive-package.cjs);
# 3. build (esbuild → dist/).
set -eu
cd /app

# O servidor monta docker/server/config.js direto, somente leitura. A cópia aqui só
# mantém config/config.js atualizado para os testes e ferramentas que rodam neste container.
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
			echo "[setup] admin adicionado: $name"
		fi
	done
fi

# Dependências: instaladas a partir de um package.json derivado do fork (sem as que não
# usamos), em /deps, cujo node_modules é o mesmo volume de /app/node_modules. Só reinstala
# quando o package.json, o package-lock.json ou a nossa lista mudam.
stamp=node_modules/.ps-custom-deps
want=$(cat package.json package-lock.json /opt/ps/derive-package.cjs | sha256sum | cut -d' ' -f1)
if [ "$(cat "$stamp" 2>/dev/null)" != "$want" ]; then
	echo "[setup] instalando dependências..."
	node /opt/ps/derive-package.cjs package.json > /deps/package.json
	cp package-lock.json /deps/package-lock.json
	npm install --prefix /deps --no-audit --no-fund
	echo "$want" > "$stamp"
fi

node build
echo "[setup] pronto"

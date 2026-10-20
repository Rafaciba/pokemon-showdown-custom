#!/bin/sh
# Teste de ponta a ponta do ambiente LOCAL (ver docs/testes-e2e.md).
#
# 1. prepara um admin temporário (E2E Admin: linha no usergroups.csv e convite);
# 2. roda tests/e2e num container do Playwright, na rede do Docker do projeto;
# 3. limpa tudo, passe ou falhe: contas e convites E2E, desafios, treinadores e
#    jornadas E2E e a linha do admin. O servidor é reiniciado duas vezes (as batalhas
#    locais em andamento são interrompidas).
#
# Nunca roda fora de *.localhost: o teste cria e apaga contas e dados.
#
# Uso (na raiz do projeto, com o ambiente de pé): sh scripts/e2e.sh [argumentos do playwright]
# O relatório fica em tests/e2e/results/report (abra o index.html).
set -eu
cd "$(dirname "$0")/.."
# Git Bash no Windows: não converter os caminhos dos containers
export MSYS_NO_PATHCONV=1
root=$(pwd -W 2>/dev/null || pwd)

PLAYWRIGHT_IMAGE=mcr.microsoft.com/playwright:v1.49.1-noble@sha256:70e367e0cbf60340a5b5fd562f6247a34eb3196efab9f88a3dd56482d9fe09d2
NETWORK=pokemon-showdown-custom_default

host=$(sed -n 's/^PS_HOST=//p' .env 2>/dev/null | tr -d '\r' | tail -n 1)
host=${host:-ps.localhost}
case "$host" in
	*.localhost) ;;
	*) echo "[e2e] PS_HOST=$host: o teste só roda no ambiente local (*.localhost)."; exit 1 ;;
esac

wait_server() {
	tries=0
	until docker compose ps server --format '{{.Status}}' | grep -q '(healthy)'; do
		tries=$((tries + 1))
		if [ "$tries" -gt 60 ]; then echo "[e2e] o servidor não ficou saudável"; return 1; fi
		sleep 3
	done
}

# Contas E2E excluídas só liberam o nome depois que o servidor de jogo apaga os dados
# delas (fila do login, consultada a cada minuto e 10 s depois de cada start)
wait_purges() {
	tries=0
	while [ "$(docker compose exec -T login node -e "
		const db = new (require('node:sqlite').DatabaseSync)('/data/login.db', { readOnly: true });
		console.log(db.prepare(\"SELECT count(*) AS n FROM pending_purges WHERE userid LIKE 'e2e%'\").get().n);
	" | tr -d '\r')" != "0" ]; do
		tries=$((tries + 1))
		if [ "$tries" -gt 30 ]; then echo "[e2e] a exclusão das contas E2E não terminou"; return 1; fi
		sleep 3
	done
}

if [ "$(docker compose ps server --format '{{.State}}')" != "running" ]; then
	echo "[e2e] suba o ambiente antes (docker compose up -d)."
	exit 1
fi
# Recém-iniciado: espera ficar saudável
wait_server

start=$(date +%s)
password=$(od -An -tx1 -N12 /dev/urandom | tr -d ' \n')

cleanup() {
	echo "[e2e] limpando..."
	docker compose exec -T -e E2E_START="$start" login node --input-type=module < tests/e2e/cleanup/login.mjs || true
	docker compose run --rm --no-deps -v "$root/tests/e2e/cleanup:/e2e/cleanup:ro" server-setup \
		node /e2e/cleanup/gym.cjs 2>&1 | grep '^\[e2e\]' || true
	sed -i '/^E2E /Id' server/config/usergroups.csv
	# Tira o rank do admin temporário da memória e os formatos do desafio E2E
	docker compose restart server > /dev/null 2>&1 || true
	wait_server || true
	wait_purges || true
	echo "[e2e] limpeza concluída"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

echo "[e2e] preparando o admin temporário..."
grep -qi '^E2E Admin,' server/config/usergroups.csv || echo 'E2E Admin,~,' >> server/config/usergroups.csv
docker compose restart server > /dev/null 2>&1
wait_server
wait_purges
invite=$(docker compose exec -T login node src/cli.ts convite --nome "E2E Admin" | grep -oE '[A-Z0-9]{4}(-[A-Z0-9]{4}){3}' | head -n 1)
[ -n "$invite" ] || { echo "[e2e] não foi possível gerar o convite"; exit 1; }
web_ip=$(docker inspect -f "{{(index .NetworkSettings.Networks \"$NETWORK\").IPAddress}}" "$(docker compose ps -q web)")

echo "[e2e] rodando o teste..."
mkdir -p tests/e2e/results
status=0
docker run --rm --init --network "$NETWORK" --add-host "$host:$web_ip" \
	-e PS_HOST="$host" -e E2E_ADMIN_INVITE="$invite" -e E2E_PASSWORD="$password" -e E2E_OUT=/out \
	-v "$root/tests/e2e:/src:ro" -v "$root/tests/e2e/results:/out" \
	"$PLAYWRIGHT_IMAGE" sh -c '
		mkdir -p /tmp/e2e && cd /src && cp package.json package-lock.json *.ts /tmp/e2e/ && cd /tmp/e2e &&
		npm ci --no-audit --no-fund --loglevel=error && npx playwright test "$@"
	' sh "$@" || status=$?
exit "$status"

#!/bin/sh
# Inicializa o servidor de jogo do PS dentro do container (código montado em /app).
set -eu
cd /app

# O PS só lê config/config.js; a fonte de verdade é docker/server/config.js
cp /opt/ps/config.js config/config.js

# "start" roda o build (esbuild → dist/) e instala dependências se faltarem
exec node pokemon-showdown start

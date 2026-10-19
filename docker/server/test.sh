#!/bin/sh
# Roda os testes do servidor no container server-setup, que pode gravar o build (o
# container do servidor é somente leitura). O config.js exige uma chave pública de
# login: os testes usam uma descartável, e o token interno e a chave real nunca chegam
# a este container, que também instala pacotes de terceiros.
#
# Uso: docker compose run --rm --no-deps server-setup sh /opt/ps/test.sh [arquivos do mocha]
set -eu
cd /app
export LOGIN_PUBLIC_KEY_PATH=/tmp/test-login-key.pem
node -e "
const { generateKeyPairSync } = require('crypto');
const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
require('fs').writeFileSync(process.env.LOGIN_PUBLIC_KEY_PATH, publicKey.export({ type: 'spki', format: 'pem' }));
"
cp /opt/ps/config.js config/config.js
# test/lib/postgres.js testa a biblioteca do Postgres, que não instalamos (derive-package.cjs)
exec npx mocha --ignore test/lib/postgres.js "$@"

'use strict';
/**
 * Configuração do servidor de jogo (pokemon-showdown-custom).
 *
 * O container copia este arquivo para server/config/config.js a cada start
 * (o PS só lê esse caminho). Esse destino é ignorado pelo git do fork.
 * Tudo que não estiver aqui vem de server/config/config-example.js.
 *
 * Nada sensível deve ser escrito aqui: valores vêm de variáveis de ambiente
 * e a chave pública é lida do volume compartilhado com o login server.
 */
const fs = require('fs');

const host = process.env.PS_HOST || 'ps.localhost';

exports.port = 8000;
exports.bindaddress = '0.0.0.0';

// O servidor fica atrás do Caddy, dentro da rede do Docker: confiar no X-Forwarded-For
// apenas vindo de faixas privadas (a porta 8000 nunca é publicada para fora).
exports.proxyip = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

// SEGURANÇA: o padrão do PS (true) dá console de admin aos sysops da Smogon.
exports.backdoor = false;
// Nenhum console administrativo por IP (o padrão do PS libera 127.0.0.1)
exports.consoleips = [];
// REPL desligado: é um eval do processo por socket Unix, que não usamos. Ligado, os
// sockets ficam em logs/repl (bind mount) e a limpeza que os testes rodam no mesmo
// container (Repl.cleanup) conecta neles e fecha na hora, e o EPIPE derruba o servidor.
exports.repl = false;

// SQLite: só para o modlog (registro das ações de moderação) e o banco básico dos plugins
// do PS (decisão do usuário, 2026-10-19). O modlog fica 6 meses, e o IP dele, 30 dias
// (limpeza diária em chat-plugins/custom-accounts.ts). Desligados de propósito (LGPD):
// mensagens privadas offline, lista de amigos e o alts_log (IP de cada troca de nome
// entre contas, sem data; Config.altslog é uma opção do nosso fork).
exports.usesqlite = true;
exports.usesqlitemodlog = true;
exports.usesqlitepms = false;
exports.usesqlitefriends = false;
exports.altslog = false;

// Login server próprio (rede interna do Docker)
exports.loginserver = process.env.LOGIN_SERVER_URL || 'http://login:9000/';
exports.loginserverkeyalgo = 'RSA-SHA256';
exports.loginserverpublickeyid = Number(process.env.LOGIN_KEY_ID || 1);
exports.loginserverpublickey = fs.readFileSync(
	process.env.LOGIN_PUBLIC_KEY_PATH || '/run/login-shared/public.pem', 'utf8'
);
// Só aceita assertions emitidas para este host
exports.legalhosts = [host];

// API interna do login server (convites e redefinição de senha), usada pelo
// plugin server/chat-plugins/custom-accounts.ts. Nunca exposta pelo Caddy.
exports.customlogin = {
	internalUrl: process.env.LOGIN_INTERNAL_URL || 'http://login:9000',
	tokenPath: process.env.LOGIN_INTERNAL_TOKEN_PATH || '/run/login-shared/internal-token',
};
exports.serverid = process.env.PS_SERVER_ID || 'custom';

exports.routes = {
	root: host,
	client: host,
	dex: 'dex.pokemonshowdown.com',
	replays: host,
};

// Nunca ligar fora de desenvolvimento
exports.noguestsecurity = false;

// O PS não pareia na ladder dois jogadores com o mesmo IP (anti-abuso) e aplica
// limites por IP. PS_NO_IP_CHECKS=1 desliga isso (ex.: testar com duas abas).
exports.noipchecks = process.env.PS_NO_IP_CHECKS === '1';
exports.crashguard = true;

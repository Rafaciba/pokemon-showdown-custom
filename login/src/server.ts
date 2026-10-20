/**
 * Login server próprio do pokemon-showdown-custom: inicialização.
 * A lógica HTTP está em app.ts.
 */
import { createServer } from 'node:http';
import { loadConfig } from './config.ts';
import { ensureKeyPair, ensureInternalToken } from './keys.ts';
import { openDatabase, purgeExpired } from './db.ts';
import { purgeSecurityEvents } from './security-events.ts';
import { createApp } from './app.ts';

const config = loadConfig();
const db = openDatabase(config.databasePath);
const handle = createApp({
	db,
	config,
	assertion: {
		privateKey: ensureKeyPair(config.privateKeyDir, config.sharedDir),
		keyId: config.keyId,
		serverHost: config.serverHost,
	},
	internalToken: ensureInternalToken(config.sharedDir),
});

// Retenção mínima: sessões e códigos vencidos e eventos de segurança com mais de
// 30 dias são apagados a cada hora
const purge = () => {
	purgeExpired(db);
	purgeSecurityEvents(db);
};
purge();
setInterval(purge, 60 * 60 * 1000).unref();

const server = createServer((req, res) => {
	handle(req, res).catch(err => {
		// Nunca registra o corpo da requisição (contém senhas)
		console.error(`[login] erro ao processar ${req.method} ${req.url?.split('?')[0]}:`, err);
		if (!res.headersSent) {
			res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
			res.end('erro interno');
		}
	});
});

server.listen(config.port, () => {
	console.log(`[login] ouvindo na porta ${config.port} (host: ${config.serverHost}, keyid ${config.keyId})`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
	process.on(signal, () => server.close(() => {
		db.close();
		process.exit(0);
	}));
}

/**
 * Configuração do login server, lida de variáveis de ambiente.
 * Nenhum segredo fica no código: chave privada e token interno são gerados
 * em disco (volumes Docker) no primeiro start.
 */

export interface LoginConfig {
	/** Porta HTTP interna (o Caddy faz o proxy público). */
	port: number;
	/** Diretório exclusivo do login server (chave privada). */
	privateKeyDir: string;
	/**
	 * Diretório compartilhado com o servidor de jogo (somente leitura lá):
	 * public.pem e internal-token.
	 */
	sharedDir: string;
	/** Arquivo do banco SQLite. */
	databasePath: string;
	/** ID da chave anunciado pelo servidor de jogo em |challstr|{keyid}|... */
	keyId: number;
	/** Host público; vai na assertion (conferido em Config.legalhosts) e define a origem aceita. */
	serverHost: string;
	/** Origem aceita em requisições POST do navegador (proteção contra CSRF). */
	publicOrigin: string;
	/** Cookie com flag Secure (sempre true atrás do Caddy com HTTPS). */
	cookieSecure: boolean;
	/** Nomes (userids) que só podem ser cadastrados com convite reservado: os admins (PS_ADMINS). */
	reservedNames: ReadonlySet<string>;
}

import { toID } from './util.ts';

function requireInt(name: string, fallback: number): number {
	const raw = process.env[name];
	if (raw === undefined || raw === '') return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < 0) {
		throw new Error(`Variável de ambiente ${name} inválida: ${raw}`);
	}
	return value;
}

export function loadConfig(): LoginConfig {
	const serverHost = process.env.PS_HOST || 'ps.localhost';
	return {
		port: requireInt('LOGIN_PORT', 9000),
		privateKeyDir: process.env.LOGIN_PRIVATE_KEY_DIR || '/data/keys',
		sharedDir: process.env.LOGIN_SHARED_DIR || '/shared',
		databasePath: process.env.LOGIN_DATABASE || '/data/login.db',
		keyId: requireInt('LOGIN_KEY_ID', 1),
		serverHost,
		publicOrigin: `https://${serverHost}`,
		cookieSecure: process.env.LOGIN_COOKIE_INSECURE !== '1',
		reservedNames: new Set((process.env.PS_ADMINS || '').split(',').map(toID).filter(Boolean)),
	};
}

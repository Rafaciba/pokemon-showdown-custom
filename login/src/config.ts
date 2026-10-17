/**
 * Configuração do login server, lida de variáveis de ambiente.
 * Nenhum segredo fica no código: a chave privada é gerada em disco (volume Docker).
 */

export interface LoginConfig {
	/** Porta HTTP interna (o Caddy faz o proxy público). */
	port: number;
	/** Diretório exclusivo do login server com private.pem. */
	privateKeyDir: string;
	/** Diretório compartilhado com o servidor de jogo, onde é gravado public.pem. */
	publicKeyDir: string;
	/** ID da chave anunciado pelo servidor de jogo em |challstr|{keyid}|... */
	keyId: number;
	/** Host do servidor de jogo, gravado na assertion e conferido em Config.legalhosts. */
	serverHost: string;
}

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
	return {
		port: requireInt('LOGIN_PORT', 9000),
		privateKeyDir: process.env.LOGIN_PRIVATE_KEY_DIR || '/data/keys',
		publicKeyDir: process.env.LOGIN_PUBLIC_KEY_DIR || '/public-key',
		keyId: requireInt('LOGIN_KEY_ID', 1),
		serverHost: process.env.PS_HOST || 'ps.localhost',
	};
}

/**
 * Geração da assertion de login no formato que o servidor de jogo do PS espera
 * (ver server/server/users.ts → validateToken):
 *
 *   {challenge},{userid},{userType},{timestamp},{serverHost};{assinatura hex}
 *
 * userType: '1' = não registrado, '2' = registrado.
 * O algoritmo de assinatura precisa bater com Config.loginserverkeyalgo
 * do servidor de jogo (usamos RSA-SHA256 em vez do RSA-SHA1 legado).
 */
import { sign, type KeyObject } from 'node:crypto';
import { toID } from './util.ts';

export type UserType = '1' | '2';

export interface AssertionContext {
	privateKey: KeyObject;
	keyId: number;
	serverHost: string;
}

/**
 * O cliente repassa o challstr recebido do servidor: "{keyid}|{challenge}".
 * Dependendo do caminho, o "|" pode vir codificado como "%7C" (ou ";" em clientes antigos).
 */
export function parseChallstr(challstr: string): { keyId: number, challenge: string } | null {
	for (const delimiter of ['|', '%7C', ';']) {
		const parts = challstr.split(delimiter);
		if (parts.length > 1) {
			const keyId = Number.parseInt(parts[0], 10);
			const challenge = parts[1];
			if (!Number.isInteger(keyId) || !challenge) return null;
			return { keyId, challenge };
		}
	}
	return null;
}

/** Retorna a assertion assinada, ou uma string iniciada por ";;" com a mensagem de erro (contrato do cliente). */
export function buildAssertion(
	ctx: AssertionContext, challstr: string, userid: string, userType: UserType
): string {
	const parsed = parseChallstr(challstr);
	if (!parsed || toID(parsed.challenge) !== parsed.challenge) {
		return ';;Desafio de login corrompido. Recarregue a página.';
	}
	if (parsed.keyId !== ctx.keyId) {
		return ';;Chave de login desconhecida. O servidor está configurado incorretamente.';
	}

	const timestamp = Math.floor(Date.now() / 1000);
	const data = `${parsed.challenge},${userid},${userType},${timestamp},${ctx.serverHost}`;
	const signature = sign('sha256', Buffer.from(data, 'utf8'), ctx.privateKey).toString('hex');
	return `${data};${signature}`;
}

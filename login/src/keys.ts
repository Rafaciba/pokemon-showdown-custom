/**
 * Segredos gerados no primeiro start:
 *
 * - Par de chaves RSA que assina as assertions de login. A privada fica num
 *   diretório exclusivo deste serviço; a pública vai para o diretório
 *   compartilhado (somente leitura no servidor de jogo).
 * - Token interno: autentica o servidor de jogo na API /internal (convites,
 *   redefinição). Fica no diretório compartilhado.
 */
import { generateKeyPairSync, createPrivateKey, createPublicKey, randomBytes, type KeyObject } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const MODULUS_BITS = 3072;

export function ensureKeyPair(privateDir: string, sharedDir: string): KeyObject {
	const privatePath = join(privateDir, 'private.pem');
	const publicPath = join(sharedDir, 'public.pem');

	if (!existsSync(privatePath)) {
		mkdirSync(privateDir, { recursive: true, mode: 0o700 });
		const { privateKey } = generateKeyPairSync('rsa', {
			modulusLength: MODULUS_BITS,
			publicKeyEncoding: { type: 'spki', format: 'pem' },
			privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
		});
		writeFileSync(privatePath, privateKey, { mode: 0o600 });
		console.log(`[keys] Novo par RSA de ${MODULUS_BITS} bits gerado`);
	}
	// Garante permissões restritas mesmo se o arquivo veio de outro lugar
	try {
		chmodSync(privatePath, 0o600);
	} catch {}

	const privateKey = createPrivateKey(readFileSync(privatePath));
	// A pública é sempre derivada da privada: nunca fica dessincronizada
	const publicPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }) as string;
	mkdirSync(sharedDir, { recursive: true });
	if (!existsSync(publicPath) || readFileSync(publicPath, 'utf8') !== publicPem) {
		writeFileSync(publicPath, publicPem, { mode: 0o644 });
	}
	return privateKey;
}

export function ensureInternalToken(sharedDir: string): string {
	const tokenPath = join(sharedDir, 'internal-token');
	if (!existsSync(tokenPath)) {
		mkdirSync(sharedDir, { recursive: true });
		writeFileSync(tokenPath, randomBytes(32).toString('base64url'), { mode: 0o644 });
		console.log('[keys] Novo token interno gerado');
	}
	return readFileSync(tokenPath, 'utf8').trim();
}

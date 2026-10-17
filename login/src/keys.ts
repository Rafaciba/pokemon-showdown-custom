/**
 * Par de chaves RSA usado para assinar as assertions de login.
 *
 * A chave privada fica num diretório exclusivo deste serviço. A pública é
 * gravada em outro diretório (volume compartilhado, somente leitura no
 * servidor de jogo), para que o servidor de jogo nunca enxergue a privada.
 */
import { generateKeyPairSync, createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const MODULUS_BITS = 3072;

export function ensureKeyPair(privateDir: string, publicDir: string): KeyObject {
	const privatePath = join(privateDir, 'private.pem');
	const publicPath = join(publicDir, 'public.pem');

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
	mkdirSync(publicDir, { recursive: true });
	if (!existsSync(publicPath) || readFileSync(publicPath, 'utf8') !== publicPem) {
		writeFileSync(publicPath, publicPem, { mode: 0o644 });
	}
	return privateKey;
}

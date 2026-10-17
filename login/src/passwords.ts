/**
 * Hash de senhas com scrypt (node:crypto), sem dependências externas.
 * Formato armazenado: scrypt$N$r$p$saltBase64$hashBase64
 */
import { scrypt, randomBytes, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export const PASSWORD_MIN_LENGTH = 8;
/** Limite superior evita uso do hash como vetor de negação de serviço. */
export const PASSWORD_MAX_LENGTH = 128;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
	const options: ScryptOptions = { N: n, r, p, maxmem: 256 * n * r };
	return new Promise((resolve, reject) => {
		scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (err, key) => {
			if (err) reject(err);
			else resolve(key);
		});
	});
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SALT_BYTES);
	const key = await derive(password, salt, N, R, P);
	return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [scheme, n, r, p, saltB64, keyB64] = stored.split('$');
	if (scheme !== 'scrypt' || !keyB64) return false;
	const expected = Buffer.from(keyB64, 'base64');
	const actual = await derive(password, Buffer.from(saltB64, 'base64'), Number(n), Number(r), Number(p));
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Hash usado só para equalizar o tempo de resposta quando o usuário não existe. */
export const DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(KEY_LENGTH).toString('base64');

/** Retorna a chave de mensagem de erro, ou null se a senha é aceitável. */
export function checkPasswordPolicy(password: string, userid: string): 'passwordTooShort' | 'passwordTooLong' | 'passwordIsName' | null {
	if (password.length < PASSWORD_MIN_LENGTH) return 'passwordTooShort';
	if (password.length > PASSWORD_MAX_LENGTH) return 'passwordTooLong';
	if (password.toLowerCase().replace(/[^a-z0-9]+/g, '') === userid) return 'passwordIsName';
	return null;
}

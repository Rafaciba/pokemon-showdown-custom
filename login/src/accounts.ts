/**
 * Contas de usuário: cadastro por convite, verificação de senha,
 * troca/redefinição de senha e exclusão (LGPD).
 */
import { type Database, nowSeconds } from './db.ts';
import { hashPassword, verifyPassword, checkPasswordPolicy, DUMMY_HASH } from './passwords.ts';
import { findCode, consumeCode } from './codes.ts';
import { toID, validateUserid } from './util.ts';
import type { MessageKey } from './i18n.ts';

export interface User {
	userid: string;
	username: string;
}

export type Result<T = void> = { ok: true, value: T } | { ok: false, error: MessageKey };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: MessageKey): Result<never> => ({ ok: false, error });

/** Caracteres com significado no protocolo do PS (| , ;), de controle ou invisíveis/de direção. */
function hasForbiddenChars(text: string): boolean {
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (char === '|' || char === ',' || char === ';') return true;
		if (code <= 0x1f || code === 0x7f) return true;
		if ((code >= 0x200b && code <= 0x200f) || (code >= 0x2028 && code <= 0x202e) || code === 0xfeff) return true;
	}
	return false;
}

/** Normaliza o nome exibido (mesmas restrições de caracteres do PS). */
export function normalizeUsername(raw: string): Result<User> {
	const username = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
	if (hasForbiddenChars(username)) return fail('nameInvalidChars');
	if (username.length > 18) return fail('nameTooLong');
	const userid = toID(username);
	const idError = validateUserid(userid);
	if (idError) return fail(idError);
	if (userid.startsWith('guest')) return fail('nameReserved');
	return ok({ userid, username });
}

export function getUser(db: Database, userid: string): User | null {
	const row = db.prepare('SELECT userid, username FROM users WHERE userid = ?').get(userid) as User | undefined;
	return row ?? null;
}

export async function register(
	db: Database, inviteCode: string, rawName: string, password: string, confirm: string
): Promise<Result<User>> {
	const invite = findCode(db, 'invite', inviteCode);
	if (!invite) return fail('inviteInvalid');

	const name = normalizeUsername(rawName);
	if (!name.ok) return name;
	const { userid, username } = name.value;
	if (invite.userid && invite.userid !== userid) return fail('inviteForOtherName');
	if (getUser(db, userid)) return fail('nameTaken');

	if (password !== confirm) return fail('passwordMismatch');
	const policyError = checkPasswordPolicy(password, userid);
	if (policyError) return fail(policyError);

	const passwordHash = await hashPassword(password);
	// Consome o convite e cria a conta na mesma transação (evita uso duplo concorrente)
	db.exec('BEGIN IMMEDIATE');
	try {
		if (!consumeCode(db, 'invite', inviteCode)) {
			db.exec('ROLLBACK');
			return fail('inviteInvalid');
		}
		if (getUser(db, userid)) {
			db.exec('ROLLBACK');
			return fail('nameTaken');
		}
		const now = nowSeconds();
		db.prepare('INSERT INTO users (userid, username, password_hash, created_at, password_changed_at) VALUES (?, ?, ?, ?, ?)')
			.run(userid, username, passwordHash, now, now);
		db.exec('COMMIT');
	} catch (err) {
		db.exec('ROLLBACK');
		throw err;
	}
	return ok({ userid, username });
}

/** Verifica nome + senha. Tempo de resposta semelhante exista ou não a conta. */
export async function authenticate(db: Database, rawName: string, password: string): Promise<User | null> {
	const userid = toID(rawName);
	const row = db.prepare('SELECT userid, username, password_hash FROM users WHERE userid = ?')
		.get(userid) as (User & { password_hash: string }) | undefined;
	if (!row) {
		await verifyPassword(password, DUMMY_HASH);
		return null;
	}
	if (!await verifyPassword(password, row.password_hash)) return null;
	return { userid: row.userid, username: row.username };
}

async function setPassword(db: Database, userid: string, password: string) {
	const passwordHash = await hashPassword(password);
	db.prepare('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE userid = ?')
		.run(passwordHash, nowSeconds(), userid);
}

export async function changePassword(
	db: Database, user: User, current: string, password: string, confirm: string
): Promise<Result> {
	if (!await authenticate(db, user.userid, current)) return fail('wrongPassword');
	if (password !== confirm) return fail('passwordMismatch');
	const policyError = checkPasswordPolicy(password, user.userid);
	if (policyError) return fail(policyError);
	await setPassword(db, user.userid, password);
	return ok(undefined);
}

export async function resetPassword(
	db: Database, resetCode: string, rawName: string, password: string, confirm: string
): Promise<Result<User>> {
	const code = findCode(db, 'reset', resetCode);
	const userid = toID(rawName);
	if (!code || code.userid !== userid) return fail('resetInvalid');
	const user = getUser(db, userid);
	if (!user) return fail('resetInvalid');
	if (password !== confirm) return fail('passwordMismatch');
	const policyError = checkPasswordPolicy(password, userid);
	if (policyError) return fail(policyError);
	if (!consumeCode(db, 'reset', resetCode)) return fail('resetInvalid');
	await setPassword(db, userid, password);
	// Quem tinha a senha antiga não continua logado
	db.prepare('DELETE FROM sessions WHERE userid = ?').run(userid);
	return ok(user);
}

/**
 * Exclui a conta e tudo que está neste serviço (sessões e códigos ligados a ela).
 * Dados guardados no servidor de jogo precisam ser apagados lá (ver docs).
 */
export async function deleteAccount(db: Database, user: User, password: string): Promise<Result> {
	if (!await authenticate(db, user.userid, password)) return fail('wrongPassword');
	db.exec('BEGIN IMMEDIATE');
	try {
		db.prepare('DELETE FROM codes WHERE userid = ?').run(user.userid);
		db.prepare('DELETE FROM sessions WHERE userid = ?').run(user.userid);
		db.prepare('DELETE FROM users WHERE userid = ?').run(user.userid);
		db.exec('COMMIT');
	} catch (err) {
		db.exec('ROLLBACK');
		throw err;
	}
	return ok(undefined);
}

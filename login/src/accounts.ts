/**
 * Contas de usuário: cadastro por convite, verificação de senha,
 * troca/redefinição de senha e exclusão (LGPD).
 */
import { type Database, nowSeconds } from './db.ts';
import { hashPassword, verifyPassword, checkPasswordPolicy, needsRehash, DUMMY_HASH } from './passwords.ts';
import { findCode, consumeCode, revokeCodes } from './codes.ts';
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

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Letras latinas acentuadas viram letra base + acento combinante (NFD). O filtro de
 * nomes do PS recusa letras acentuadas prontas ("é"), mas aceita acentos combinantes,
 * e o identificador só tem a-z e 0-9: assim "ZéPe" fica "ZéPe" no jogo, com
 * identificador "zepe", em vez de "ZPe" e "zpe". Outros alfabetos ficam como estão.
 */
function decomposeLatin(text: string) {
	return text.replace(/[À-ɏḀ-ỿ]/g, char => char.normalize('NFD'));
}

/** Normaliza o nome exibido (mesmas restrições de caracteres do PS). */
export function normalizeUsername(raw: string): Result<User> {
	let username = decomposeLatin(raw.normalize('NFKC').replace(/\s+/g, ' ').trim());
	// Cada acento separado conta como caractere, e o PS tira todos os símbolos (até os
	// espaços) de nomes com mais de 18: nesse caso, saem só os acentos
	if (username.length > 18) username = username.replace(COMBINING_MARKS, '');
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

// --- Fila de exclusão dos dados de jogo ------------------------------------

/** Conta excluída cujos dados de jogo ainda não foram apagados pelo servidor de jogo. */
export function isPendingPurge(db: Database, userid: string): boolean {
	return !!db.prepare('SELECT 1 FROM pending_purges WHERE userid = ?').get(userid);
}

export function listPendingPurges(db: Database): string[] {
	return (db.prepare('SELECT userid FROM pending_purges ORDER BY deleted_at').all() as { userid: string }[])
		.map(row => row.userid);
}

/** O servidor de jogo apagou os dados: o userid sai da fila e o nome volta a ficar livre. */
export function completePurge(db: Database, userid: string): boolean {
	return db.prepare('DELETE FROM pending_purges WHERE userid = ?').run(userid).changes === 1;
}

/**
 * `reservedNames`: nomes que só podem ser cadastrados com convite reservado para
 * eles (os admins de PS_ADMINS). Sem isso, se a conta do admin fosse excluída, quem
 * cadastrasse o mesmo nome com um convite comum herdaria o rank ~.
 */
export async function register(
	db: Database, inviteCode: string, rawName: string, password: string, confirm: string,
	reservedNames: ReadonlySet<string> = new Set()
): Promise<Result<User>> {
	const invite = findCode(db, 'invite', inviteCode);
	if (!invite) return fail('inviteInvalid');

	const name = normalizeUsername(rawName);
	if (!name.ok) return name;
	const { userid, username } = name.value;
	if (invite.userid && invite.userid !== userid) return fail('inviteForOtherName');
	if (reservedNames.has(userid) && invite.userid !== userid) return fail('nameReserved');
	if (getUser(db, userid)) return fail('nameTaken');
	if (isPendingPurge(db, userid)) return fail('nameReleasing');

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
		if (isPendingPurge(db, userid)) {
			db.exec('ROLLBACK');
			return fail('nameReleasing');
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
	// Parâmetros do scrypt mudaram: refaz o hash agora que temos a senha
	if (needsRehash(row.password_hash)) {
		db.prepare('UPDATE users SET password_hash = ? WHERE userid = ?').run(await hashPassword(password), row.userid);
	}
	return { userid: row.userid, username: row.username };
}

async function setPassword(db: Database, userid: string, password: string) {
	const passwordHash = await hashPassword(password);
	db.prepare('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE userid = ?')
		.run(passwordHash, nowSeconds(), userid);
	// Um código de redefinição que tenha vazado deixa de valer quando a senha muda
	revokeCodes(db, 'reset', userid);
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
 * Os dados do servidor de jogo (jornadas, conquistas, ladder, ranks) são apagados
 * por ele: o userid entra na fila pending_purges, que o servidor de jogo consulta
 * pela API interna e confirma depois de apagar.
 */
export async function deleteAccount(db: Database, user: User, password: string): Promise<Result> {
	if (!await authenticate(db, user.userid, password)) return fail('wrongPassword');
	db.exec('BEGIN IMMEDIATE');
	try {
		db.prepare('DELETE FROM codes WHERE userid = ?').run(user.userid);
		db.prepare('DELETE FROM sessions WHERE userid = ?').run(user.userid);
		db.prepare('DELETE FROM users WHERE userid = ?').run(user.userid);
		db.prepare('INSERT OR REPLACE INTO pending_purges (userid, deleted_at) VALUES (?, ?)').run(user.userid, nowSeconds());
		db.exec('COMMIT');
	} catch (err) {
		db.exec('ROLLBACK');
		throw err;
	}
	// LGPD: tira do WAL as páginas com os dados apagados
	db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
	return ok(undefined);
}

/**
 * Troca o nome de uma conta (pedido do admin; o jogador não troca sozinho por enquanto).
 * A senha continua a mesma. Com identificador novo, as sessões são encerradas (o
 * jogador entra de novo com o nome novo) e os códigos de redefinição passam para o
 * identificador novo. Contas reservadas (PS_ADMINS) não trocam de nome nem recebem um
 * nome reservado.
 */
export function renameAccount(
	db: Database, userid: string, newName: string, reservedNames: ReadonlySet<string> = new Set()
): Result<User & { previous: string }> {
	const user = getUser(db, userid);
	if (!user) return fail('userNotFound');
	const name = normalizeUsername(newName);
	if (!name.ok) return name;
	const { userid: newid, username } = name.value;
	if (reservedNames.has(userid) || (newid !== userid && reservedNames.has(newid))) return fail('nameReserved');
	if (newid !== userid) {
		if (getUser(db, newid)) return fail('nameTaken');
		if (isPendingPurge(db, newid)) return fail('nameReleasing');
	}
	db.exec('BEGIN IMMEDIATE');
	try {
		if (newid === userid) {
			db.prepare('UPDATE users SET username = ? WHERE userid = ?').run(username, userid);
		} else {
			db.prepare(`
				INSERT INTO users (userid, username, password_hash, created_at, password_changed_at)
				SELECT ?, ?, password_hash, created_at, password_changed_at FROM users WHERE userid = ?
			`).run(newid, username, userid);
			db.prepare('UPDATE codes SET userid = ? WHERE userid = ?').run(newid, userid);
			db.prepare('DELETE FROM sessions WHERE userid = ?').run(userid);
			db.prepare('DELETE FROM users WHERE userid = ?').run(userid);
		}
		db.exec('COMMIT');
	} catch (err) {
		db.exec('ROLLBACK');
		throw err;
	}
	return ok({ userid: newid, username, previous: userid });
}

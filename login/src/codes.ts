/**
 * Códigos de uso único (convite e redefinição de senha).
 *
 * O código em claro só é mostrado uma vez a quem o gerou; no banco fica
 * apenas o SHA-256 (o código tem 80 bits de entropia, então um hash rápido basta).
 */
import { createHash, randomInt } from 'node:crypto';
import { type Database, nowSeconds } from './db.ts';

// Sem caracteres ambíguos (0/O, 1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUPS = 4;
const GROUP_SIZE = 4;

export const INVITE_TTL_SECONDS = 3 * 24 * 60 * 60;
export const RESET_TTL_SECONDS = 24 * 60 * 60;

export type CodeKind = 'invite' | 'reset';

export interface IssuedCode {
	code: string;
	expiresAt: number;
}

export function normalizeCode(code: string): string {
	return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hashCode(code: string): string {
	return createHash('sha256').update(normalizeCode(code)).digest('hex');
}

function generateCode(): string {
	const groups: string[] = [];
	for (let g = 0; g < GROUPS; g++) {
		let group = '';
		for (let i = 0; i < GROUP_SIZE; i++) group += ALPHABET[randomInt(ALPHABET.length)];
		groups.push(group);
	}
	return groups.join('-');
}

export function issueCode(db: Database, kind: CodeKind, userid: string | null, ttlSeconds: number): IssuedCode {
	const code = generateCode();
	const now = nowSeconds();
	const expiresAt = now + ttlSeconds;
	db.prepare('INSERT INTO codes (code_hash, kind, userid, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
		.run(hashCode(code), kind, userid, now, expiresAt);
	return { code, expiresAt };
}

/** Invalida os códigos pendentes de um tipo para a conta (ex.: redefinições antigas). */
export function revokeCodes(db: Database, kind: CodeKind, userid: string) {
	db.prepare('DELETE FROM codes WHERE kind = ? AND userid = ?').run(kind, userid);
}

/** Consulta um código válido sem consumi-lo. */
export function findCode(db: Database, kind: CodeKind, code: string): { userid: string | null } | null {
	if (normalizeCode(code).length !== GROUPS * GROUP_SIZE) return null;
	const row = db.prepare('SELECT userid FROM codes WHERE code_hash = ? AND kind = ? AND expires_at > ?')
		.get(hashCode(code), kind, nowSeconds()) as { userid: string | null } | undefined;
	return row ?? null;
}

/** Consome (apaga) o código. Retorna false se ele já tinha sido usado. */
export function consumeCode(db: Database, kind: CodeKind, code: string): boolean {
	const result = db.prepare('DELETE FROM codes WHERE code_hash = ? AND kind = ? AND expires_at > ?')
		.run(hashCode(code), kind, nowSeconds());
	return result.changes === 1;
}

export function countPendingCodes(db: Database, kind: CodeKind): number {
	const row = db.prepare('SELECT COUNT(*) AS n FROM codes WHERE kind = ? AND expires_at > ?')
		.get(kind, nowSeconds()) as { n: number };
	return row.n;
}

/** Convite pendente, sem o código (só o hash fica no banco). */
export interface PendingInvite {
	/** rowid do SQLite: identifica o convite para revogar, sem expor o hash */
	id: number;
	/** nome reservado, se houver */
	userid: string | null;
	createdAt: number;
	expiresAt: number;
}

export function listPendingInvites(db: Database): PendingInvite[] {
	return db.prepare(
		'SELECT rowid AS id, userid, created_at AS createdAt, expires_at AS expiresAt FROM codes ' +
		"WHERE kind = 'invite' AND expires_at > ? ORDER BY created_at, rowid"
	).all(nowSeconds()) as unknown as PendingInvite[];
}

/** Anula um convite pendente. Retorna false se ele não existe (já usado, vencido ou revogado). */
export function revokeInvite(db: Database, id: number): boolean {
	const result = db.prepare("DELETE FROM codes WHERE rowid = ? AND kind = 'invite'").run(id);
	return result.changes === 1;
}

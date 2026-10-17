/**
 * Sessões de login (cookie HttpOnly).
 *
 * O token só existe em claro no cookie do navegador; no banco fica o SHA-256.
 * Validade de 30 dias, renovada a cada uso (no máximo uma vez por hora,
 * para não escrever no banco a cada requisição).
 */
import { createHash, randomBytes } from 'node:crypto';
import { type Database, nowSeconds } from './db.ts';
import type { User } from './accounts.ts';

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const RENEW_INTERVAL_SECONDS = 60 * 60;
export const SESSION_COOKIE = 'ps_session';

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export interface ActiveSession {
	token: string;
	user: User;
	/** true quando a validade foi estendida e o cookie precisa ser reenviado. */
	renewed: boolean;
}

export function createSession(db: Database, userid: string): string {
	const token = randomBytes(32).toString('base64url');
	const now = nowSeconds();
	db.prepare('INSERT INTO sessions (token_hash, userid, created_at, renewed_at, expires_at) VALUES (?, ?, ?, ?, ?)')
		.run(hashToken(token), userid, now, now, now + SESSION_TTL_SECONDS);
	return token;
}

export function getSession(db: Database, token: string | undefined): ActiveSession | null {
	if (!token || token.length > 100) return null;
	const now = nowSeconds();
	const tokenHash = hashToken(token);
	const row = db.prepare(`
		SELECT s.renewed_at, u.userid, u.username FROM sessions s
		JOIN users u ON u.userid = s.userid
		WHERE s.token_hash = ? AND s.expires_at > ?
	`).get(tokenHash, now) as { renewed_at: number, userid: string, username: string } | undefined;
	if (!row) return null;

	let renewed = false;
	if (now - row.renewed_at >= RENEW_INTERVAL_SECONDS) {
		db.prepare('UPDATE sessions SET renewed_at = ?, expires_at = ? WHERE token_hash = ?')
			.run(now, now + SESSION_TTL_SECONDS, tokenHash);
		renewed = true;
	}
	return { token, user: { userid: row.userid, username: row.username }, renewed };
}

export function deleteSession(db: Database, token: string | undefined) {
	if (!token) return;
	db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

/** Encerra as demais sessões do usuário (ex.: após trocar a senha). */
export function deleteOtherSessions(db: Database, userid: string, keepToken: string) {
	db.prepare('DELETE FROM sessions WHERE userid = ? AND token_hash <> ?').run(userid, hashToken(keepToken));
}

export function sessionCookie(token: string, secure: boolean): string {
	return [
		`${SESSION_COOKIE}=${token}`,
		'Path=/',
		`Max-Age=${SESSION_TTL_SECONDS}`,
		'HttpOnly',
		'SameSite=Lax',
		...(secure ? ['Secure'] : []),
	].join('; ');
}

export function clearSessionCookie(secure: boolean): string {
	return [`${SESSION_COOKIE}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax', ...(secure ? ['Secure'] : [])].join('; ');
}

export function readCookie(header: string | undefined, name: string): string | undefined {
	if (!header) return undefined;
	for (const part of header.split(';')) {
		const index = part.indexOf('=');
		if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
	}
	return undefined;
}

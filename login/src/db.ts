/**
 * Banco SQLite do login server (node:sqlite, sem dependências externas).
 *
 * LGPD — dados guardados, todos estritamente necessários:
 *   users     nome de usuário + hash da senha (sem e-mail, sem IP)
 *   sessions  hash do token de sessão + validade
 *   codes     hash de códigos de convite/redefinição + validade
 *   pending_purges  só o userid de contas excluídas, até o servidor de jogo
 *             apagar os dados de jogo delas e confirmar (aí a linha some)
 *   security_events  trilha de eventos de segurança (data, tipo, conta, IP), 30 dias
 *             (security-events.ts)
 * Registros expirados são apagados periodicamente (purgeExpired e purgeSecurityEvents).
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const MIGRATIONS: string[] = [
	// 1: esquema inicial
	`
	CREATE TABLE users (
		userid        TEXT PRIMARY KEY,
		username      TEXT NOT NULL,
		password_hash TEXT NOT NULL,
		created_at    INTEGER NOT NULL,
		password_changed_at INTEGER NOT NULL
	) STRICT;

	CREATE TABLE sessions (
		token_hash  TEXT PRIMARY KEY,
		userid      TEXT NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
		created_at  INTEGER NOT NULL,
		renewed_at  INTEGER NOT NULL,
		expires_at  INTEGER NOT NULL
	) STRICT;
	CREATE INDEX sessions_userid ON sessions(userid);

	CREATE TABLE codes (
		code_hash   TEXT PRIMARY KEY,
		kind        TEXT NOT NULL CHECK (kind IN ('invite', 'reset')),
		-- convite: nome reservado (opcional); redefinição: conta alvo
		userid      TEXT,
		created_at  INTEGER NOT NULL,
		expires_at  INTEGER NOT NULL
	) STRICT;
	`,
	// 2: fila de exclusão dos dados de jogo (conta excluída → servidor de jogo apaga e confirma)
	`
	CREATE TABLE pending_purges (
		userid      TEXT PRIMARY KEY,
		deleted_at  INTEGER NOT NULL
	) STRICT;
	`,
	// 3: trilha de eventos de segurança (30 dias; fica depois da exclusão da conta)
	`
	CREATE TABLE security_events (
		id      INTEGER PRIMARY KEY,
		at      INTEGER NOT NULL,
		type    TEXT NOT NULL,
		userid  TEXT,
		ip      TEXT,
		actor   TEXT,
		detail  TEXT
	) STRICT;
	CREATE INDEX security_events_at ON security_events(at);
	CREATE INDEX security_events_userid ON security_events(userid);
	CREATE INDEX security_events_type ON security_events(type);
	`,
];

export type Database = DatabaseSync;

export function openDatabase(path: string): Database {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const db = new DatabaseSync(path);
	db.exec('PRAGMA journal_mode = WAL');
	db.exec('PRAGMA foreign_keys = ON');
	db.exec('PRAGMA busy_timeout = 5000');
	// LGPD: o que é apagado é sobrescrito no arquivo (sem restos de contas excluídas)
	db.exec('PRAGMA secure_delete = ON');
	migrate(db);
	return db;
}

function migrate(db: Database) {
	const { user_version: current } = db.prepare('PRAGMA user_version').get() as { user_version: number };
	for (let version = current; version < MIGRATIONS.length; version++) {
		db.exec('BEGIN');
		try {
			db.exec(MIGRATIONS[version]);
			db.exec(`PRAGMA user_version = ${version + 1}`);
			db.exec('COMMIT');
		} catch (err) {
			db.exec('ROLLBACK');
			throw err;
		}
	}
}

/** Remove sessões e códigos vencidos (retenção mínima). */
export function purgeExpired(db: Database, now = nowSeconds()) {
	db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
	db.prepare('DELETE FROM codes WHERE expires_at <= ?').run(now);
}

export function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

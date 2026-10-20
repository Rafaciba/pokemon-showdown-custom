/**
 * Trilha de eventos de segurança do login (decisão do usuário, 2026-10-19).
 *
 * LGPD: guarda data, tipo, conta e IP de cada evento, por 30 dias (legítimo
 * interesse: detectar e investigar ataques a contas). Os eventos de uma conta
 * excluída ficam até o fim do prazo, para que quem atacou não apague o rastro
 * excluindo a conta. Só o admin consulta (página do painel, pela API interna).
 *
 * Contra inundação do banco: os eventos de pedidos recusados e de bloqueio são
 * gravados no máximo uma vez por minuto para cada combinação de tipo, conta e IP
 * (EventThrottle), e a tabela tem um teto de linhas.
 */
import { type Database, nowSeconds } from './db.ts';

export const SECURITY_EVENT_TYPES = [
	'loginfailed', // senha errada (login, troca de senha ou exclusão)
	'loginblocked', // bloqueado por excesso de tentativas de senha
	'codefailed', // código de convite ou de redefinição inválido
	'accountcreated',
	'passwordchanged',
	'resetissued', // código de redefinição gerado pelo admin
	'resetused', // senha redefinida com o código
	'accountdeleted',
	'accountrenamed', // nome trocado pelo admin (detalhe: identificador anterior)
	'inviteissued',
	'inviterevoked',
	'csrfrejected', // formulário vindo de outro site
	'ratelimited', // excesso de pedidos
	'internalunauthorized', // API interna sem o token certo
] as const;
export type SecurityEventType = typeof SECURITY_EVENT_TYPES[number];

export const SECURITY_RETENTION_SECONDS = 30 * 24 * 60 * 60;
/** Teto de linhas: acima disso, os eventos mais antigos saem antes do prazo. */
export const SECURITY_MAX_EVENTS = 100_000;
const DETAIL_MAX_LENGTH = 100;

export interface SecurityEvent {
	id: number;
	at: number;
	type: SecurityEventType;
	userid: string | null;
	ip: string | null;
	/** Admin que fez a ação (convites e redefinições pedidos pelo servidor de jogo). */
	actor: string | null;
	/** Contexto curto: onde aconteceu (login, senha, excluir) ou o caminho pedido. */
	detail: string | null;
}

export interface EventData {
	userid?: string | null;
	ip?: string | null;
	actor?: string | null;
	detail?: string | null;
}

export function isSecurityEventType(value: string): value is SecurityEventType {
	return (SECURITY_EVENT_TYPES as readonly string[]).includes(value);
}

export function recordSecurityEvent(db: Database, type: SecurityEventType, data: EventData = {}, now = nowSeconds()) {
	db.prepare('INSERT INTO security_events (at, type, userid, ip, actor, detail) VALUES (?, ?, ?, ?, ?, ?)').run(
		now, type, data.userid || null, data.ip || null, data.actor || null,
		data.detail ? data.detail.slice(0, DETAIL_MAX_LENGTH) : null
	);
}

export function listSecurityEvents(
	db: Database, filter: { type?: SecurityEventType, userid?: string, before?: number, limit?: number } = {}
): SecurityEvent[] {
	const where: string[] = [];
	const args: (string | number)[] = [];
	if (filter.type) { where.push('type = ?'); args.push(filter.type); }
	if (filter.userid) { where.push('userid = ?'); args.push(filter.userid); }
	if (filter.before) { where.push('id < ?'); args.push(filter.before); }
	const limit = Math.min(Math.max(filter.limit || 100, 1), 200);
	return db.prepare(
		`SELECT id, at, type, userid, ip, actor, detail FROM security_events ` +
		(where.length ? `WHERE ${where.join(' AND ')} ` : '') + `ORDER BY id DESC LIMIT ${limit}`
	).all(...args) as unknown as SecurityEvent[];
}

/** Quantos eventos de cada tipo desde `since`. */
export function securitySummary(db: Database, since: number): { type: SecurityEventType, count: number }[] {
	return db.prepare('SELECT type, COUNT(*) AS count FROM security_events WHERE at >= ? GROUP BY type ORDER BY count DESC')
		.all(since) as unknown as { type: SecurityEventType, count: number }[];
}

/** Apaga os eventos vencidos (30 dias) e o excesso acima do teto. */
export function purgeSecurityEvents(db: Database, now = nowSeconds()) {
	db.prepare('DELETE FROM security_events WHERE at <= ?').run(now - SECURITY_RETENTION_SECONDS);
	db.prepare(
		'DELETE FROM security_events WHERE id <= (SELECT id FROM security_events ORDER BY id DESC LIMIT 1 OFFSET ?)'
	).run(SECURITY_MAX_EVENTS);
}

/** Deixa passar um evento por chave a cada janela (em memória). */
export class EventThrottle {
	private seen = new Map<string, number>();
	private readonly windowMs: number;

	constructor(windowMs = 60_000) {
		this.windowMs = windowMs;
		setInterval(() => this.sweep(), windowMs).unref();
	}

	allow(key: string): boolean {
		const now = Date.now();
		const last = this.seen.get(key);
		if (last !== undefined && now - last < this.windowMs) return false;
		this.seen.set(key, now);
		return true;
	}

	private sweep() {
		const now = Date.now();
		for (const [key, at] of this.seen) {
			if (now - at >= this.windowMs) this.seen.delete(key);
		}
	}
}

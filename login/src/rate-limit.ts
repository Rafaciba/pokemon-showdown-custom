/**
 * Limitador de requisições em memória (janela fixa).
 *
 * LGPD: aqui o IP é só uma chave temporária em memória, descartada ao fim da
 * janela. Os bloqueios entram na trilha de segurança (security-events.ts, 30 dias).
 */
export class RateLimiter {
	private hits = new Map<string, { count: number, resetAt: number }>();
	private readonly limit: number;
	private readonly windowMs: number;

	constructor(limit: number, windowMs: number) {
		this.limit = limit;
		this.windowMs = windowMs;
		setInterval(() => this.sweep(), windowMs).unref();
	}

	/** Retorna true se a requisição pode seguir. */
	allow(key: string): boolean {
		const now = Date.now();
		const entry = this.hits.get(key);
		if (!entry || entry.resetAt <= now) {
			this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
			return true;
		}
		entry.count++;
		return entry.count <= this.limit;
	}

	/** Desfaz um registro (ex.: a tentativa de senha deu certo). */
	forgive(key: string) {
		const entry = this.hits.get(key);
		if (entry && entry.count > 0) entry.count--;
	}

	/** Consulta sem registrar: true se a chave já estourou o limite na janela atual. */
	isLimited(key: string): boolean {
		const entry = this.hits.get(key);
		return !!entry && entry.resetAt > Date.now() && entry.count >= this.limit;
	}

	private sweep() {
		const now = Date.now();
		for (const [key, entry] of this.hits) {
			if (entry.resetAt <= now) this.hits.delete(key);
		}
	}
}

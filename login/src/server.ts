/**
 * Login server próprio do pokemon-showdown-custom.
 *
 * Implementa o contrato que o cliente do PS espera de "action.php"
 * (POST /~~{serverid}/action.php ou /api/{act}, corpo urlencoded, parâmetro "act").
 * Respostas JSON começam com "]"; getassertion responde texto puro.
 *
 * Etapa atual: apenas nomes não registrados (sem contas). Cadastro por convite,
 * senha e sessões entram na próxima etapa.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadConfig } from './config.ts';
import { ensureKeyPair } from './keys.ts';
import { buildAssertion, type AssertionContext } from './assertion.ts';
import { RateLimiter } from './rate-limit.ts';
import { toID, validateUserid } from './util.ts';

const MAX_BODY_BYTES = 16 * 1024;

const config = loadConfig();
const assertionCtx: AssertionContext = {
	privateKey: ensureKeyPair(config.privateKeyDir, config.publicKeyDir),
	keyId: config.keyId,
	serverHost: config.serverHost,
};
// 60 ações por minuto por IP é folgado para uso normal e corta abuso simples
const limiter = new RateLimiter(60, 60_000);

type Params = Record<string, string>;
type ActionResult = { json: unknown } | { text: string };
type Action = (params: Params) => ActionResult | Promise<ActionResult>;

const notAvailable = (): ActionResult => ({
	json: { actionsuccess: false, actionerror: 'Ainda não disponível neste servidor.' },
});

const actions: Record<string, Action> = {
	getassertion(params) {
		const userid = toID(params.userid);
		const error = validateUserid(userid);
		if (error) return { text: `;;${error}` };
		// Sem contas ainda: todo nome é tratado como não registrado
		return { text: buildAssertion(assertionCtx, params.challstr || '', userid, '1') };
	},
	upkeep() {
		// Sem sessão: o cliente segue como convidado
		return { json: { loggedin: false, username: '' } };
	},
	getteams() {
		return { json: { teams: [] } };
	},
	logout() {
		return { json: { actionsuccess: true } };
	},
	register: notAvailable,
	login: notAvailable,
	changepassword: notAvailable,
	changeusername: notAvailable,
	getteam: notAvailable,
	ladderget: notAvailable,
	uploadreplay: notAvailable,
	// Chamada periódica do servidor de jogo; não guardamos estatísticas
	updateuserstats() {
		return { json: { actionsuccess: true } };
	},
};

function clientKey(req: IncomingMessage): string {
	// Atrás do Caddy (rede interna do Docker): o IP real vem em X-Forwarded-For
	const forwarded = req.headers['x-forwarded-for'];
	const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
	return first || req.socket.remoteAddress || 'unknown';
}

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks: Buffer[] = [];
		req.on('data', (chunk: Buffer) => {
			size += chunk.length;
			if (size > MAX_BODY_BYTES) {
				reject(new Error('body too large'));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
	});
}

function send(res: ServerResponse, status: number, body: string, contentType = 'text/plain; charset=utf-8') {
	res.writeHead(status, {
		'Content-Type': contentType,
		'Cache-Control': 'no-store',
		'X-Content-Type-Options': 'nosniff',
	});
	res.end(body);
}

/** Extrai o nome da ação de /api/{act} ou do parâmetro act (action.php). */
function resolveAct(url: URL, params: Params): string {
	const apiMatch = /^\/api\/([a-z]+)\/?$/.exec(url.pathname);
	return toID(apiMatch ? apiMatch[1] : params.act);
}

async function handle(req: IncomingMessage, res: ServerResponse) {
	const url = new URL(req.url || '/', 'http://internal');

	if (req.method === 'GET' && url.pathname === '/healthz') {
		return send(res, 200, 'ok');
	}
	const isActionPath = /^\/~~[^/]+\/action\.php$/.test(url.pathname) || url.pathname.startsWith('/api/');
	if (!isActionPath) return send(res, 404, 'not found');
	if (req.method !== 'POST' && req.method !== 'GET') return send(res, 405, 'method not allowed');

	if (!limiter.allow(clientKey(req))) {
		return send(res, 429, ']' + JSON.stringify({ actionerror: 'Muitas requisições. Aguarde um pouco.' }));
	}

	let body = '';
	try {
		if (req.method === 'POST') body = await readBody(req);
	} catch {
		return send(res, 413, 'payload too large');
	}
	const params: Params = {
		...Object.fromEntries(url.searchParams),
		...Object.fromEntries(new URLSearchParams(body)),
	};

	const act = resolveAct(url, params);
	const action = Object.hasOwn(actions, act) ? actions[act] : undefined;
	if (!action) {
		return send(res, 400, ']' + JSON.stringify({ actionerror: 'Ação desconhecida.' }));
	}

	const result = await action(params);
	if ('text' in result) return send(res, 200, result.text);
	return send(res, 200, ']' + JSON.stringify(result.json), 'application/json; charset=utf-8');
}

const server = createServer((req, res) => {
	handle(req, res).catch(err => {
		// Não registra corpo da requisição (pode conter senha no futuro)
		console.error(`[login] erro ao processar ${req.method} ${req.url?.split('?')[0]}:`, err);
		if (!res.headersSent) send(res, 500, ']' + JSON.stringify({ actionerror: 'Erro interno.' }));
	});
});

server.listen(config.port, () => {
	console.log(`[login] ouvindo na porta ${config.port} (host do jogo: ${config.serverHost}, keyid ${config.keyId})`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
	process.on(signal, () => server.close(() => process.exit(0)));
}

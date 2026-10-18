/**
 * Roteamento HTTP do login server.
 *
 * - Contrato do cliente do PS: POST /~~{serverid}/action.php ou /api/{act}
 *   (corpo urlencoded, parâmetro "act"; JSON prefixado com "]").
 * - Chamadas do servidor de jogo: POST /action.php (rede interna).
 * - Páginas: /cadastro, /redefinir, /conta (sem JavaScript).
 * - API interna (/internal/*): só na rede do Docker, autenticada por token.
 *
 * Segurança: POST com cabeçalho Origin diferente do domínio público é recusado
 * (CSRF); o cookie de sessão é HttpOnly + SameSite=Lax + Secure.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { Database } from './db.ts';
import type { LoginConfig } from './config.ts';
import { buildAssertion, type AssertionContext } from './assertion.ts';
import { RateLimiter } from './rate-limit.ts';
import { toID, validateUserid } from './util.ts';
import { t, detectLang, type Lang, type MessageKey } from './i18n.ts';
import {
	authenticate, changePassword, completePurge, deleteAccount, getUser, listPendingPurges, register, resetPassword,
	normalizeUsername, type User,
} from './accounts.ts';
import {
	createSession, getSession, deleteSession, deleteOtherSessions, sessionCookie, clearSessionCookie, readCookie,
	SESSION_COOKIE, type ActiveSession,
} from './sessions.ts';
import { issueCode, revokeCodes, INVITE_TTL_SECONDS, RESET_TTL_SECONDS } from './codes.ts';
import { renderAccount, renderPrivacy, renderRegister, renderReset, type PageMessage } from './pages.ts';

const MAX_BODY_BYTES = 16 * 1024;
// O CSS e as imagens vêm do próprio cliente (mesmo domínio); nada de script
const PAGE_CSP = "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

export interface AppDeps {
	db: Database;
	config: LoginConfig;
	assertion: AssertionContext;
	internalToken: string;
	/** Limites por IP por minuto (os testes usam valores altos). */
	limits?: { requestsPerMinute?: number, formsPerMinute?: number };
}

type Params = Record<string, string>;

interface RequestContext {
	req: IncomingMessage;
	res: ServerResponse;
	url: URL;
	params: Params;
	lang: Lang;
	ip: string;
	session: ActiveSession | null;
	/** Cabeçalhos Set-Cookie acumulados para a resposta. */
	cookies: string[];
}

type ActionResult = { json: unknown } | { text: string };

export function createApp(deps: AppDeps) {
	const { db, config } = deps;

	// Limites em memória (o IP nunca é persistido)
	const requestLimiter = new RateLimiter(deps.limits?.requestsPerMinute ?? 120, 60_000);
	const formLimiter = new RateLimiter(deps.limits?.formsPerMinute ?? 20, 60_000);
	// Falhas de senha, janela de 15 min: por conta + IP (assim ninguém bloqueia a conta
	// de outra pessoa a partir do próprio IP) e por IP (tentativas em várias contas)
	const failuresByUser = new RateLimiter(10, 15 * 60_000);
	const failuresByIp = new RateLimiter(30, 15 * 60_000);
	const userKey = (ctx: RequestContext, userid: string) => `${userid}|${ctx.ip}`;

	const signedAssertion = (ctx: RequestContext, userid: string, userType: '1' | '2') =>
		buildAssertion(deps.assertion, ctx.params.challstr || ctx.params.challenge || '', userid, userType, ctx.lang);

	function loginBlocked(ctx: RequestContext, userid: string): boolean {
		return failuresByUser.isLimited(userKey(ctx, userid)) || failuresByIp.isLimited(ctx.ip);
	}
	function recordAttempt(ctx: RequestContext, userid: string) {
		failuresByUser.allow(userKey(ctx, userid));
		failuresByIp.allow(ctx.ip);
	}
	function forgiveAttempt(ctx: RequestContext, userid: string) {
		failuresByUser.forgive(userKey(ctx, userid));
		failuresByIp.forgive(ctx.ip);
	}

	function startSession(ctx: RequestContext, user: User): string {
		const token = createSession(db, user.userid);
		ctx.cookies.push(sessionCookie(token, config.cookieSecure));
		return token;
	}

	/** Verifica senha com limite de tentativas; usado por login, troca de senha e exclusão. */
	async function checkedAuthenticate(ctx: RequestContext, name: string, password: string): Promise<User | MessageKey> {
		const userid = toID(name);
		if (loginBlocked(ctx, userid)) return 'tooManyLoginAttempts';
		// Conta a tentativa antes do scrypt (assíncrono): pedidos em paralelo não passam do limite
		recordAttempt(ctx, userid);
		const user = await authenticate(db, name, password);
		if (!user) return 'wrongPassword';
		forgiveAttempt(ctx, userid);
		return user;
	}

	// ---------------------------------------------------------------------
	// Ações do cliente (contrato do action.php)
	// ---------------------------------------------------------------------
	const clientActions: Record<string, (ctx: RequestContext) => ActionResult | Promise<ActionResult>> = {
		getassertion(ctx) {
			const userid = toID(ctx.params.userid);
			const idError = validateUserid(userid);
			if (idError) return { text: `;;${t(ctx.lang, idError)}` };
			if (!getUser(db, userid)) {
				// Servidor exige conta: nomes não registrados não recebem assertion
				return { text: `;;${t(ctx.lang, 'accountRequired', { host: config.serverHost })}` };
			}
			if (ctx.session?.user.userid === userid) return { text: signedAssertion(ctx, userid, '2') };
			// Conta existe e não há sessão: ";" faz o cliente pedir a senha
			return { text: ';' };
		},

		upkeep(ctx) {
			if (!ctx.session) return { json: { loggedin: false, username: '', assertion: '' } };
			const { user } = ctx.session;
			return { json: { loggedin: true, username: user.username, assertion: signedAssertion(ctx, user.userid, '2') } };
		},

		async login(ctx) {
			if (ctx.req.method !== 'POST') return { json: { actionsuccess: false, assertion: false } };
			const result = await checkedAuthenticate(ctx, ctx.params.name || '', ctx.params.pass || '');
			if (typeof result === 'string') {
				return { json: { actionsuccess: false, assertion: false, error: t(ctx.lang, result) } };
			}
			if (ctx.session) deleteSession(db, ctx.session.token);
			startSession(ctx, result);
			return {
				json: {
					actionsuccess: true,
					assertion: signedAssertion(ctx, result.userid, '2'),
					curuser: { loggedin: true, username: result.username, userid: result.userid },
				},
			};
		},

		logout(ctx) {
			if (ctx.req.method !== 'POST' || !ctx.session || toID(ctx.params.userid) !== ctx.session.user.userid) {
				return { json: { actionsuccess: false } };
			}
			deleteSession(db, ctx.session.token);
			ctx.cookies.push(clearSessionCookie(config.cookieSecure));
			return { json: { actionsuccess: true } };
		},

		async changepassword(ctx) {
			if (ctx.req.method !== 'POST' || !ctx.session) {
				return { json: { actionsuccess: false, actionerror: t(ctx.lang, 'wrongPassword') } };
			}
			const error = await changePasswordChecked(ctx, ctx.session, ctx.params.oldpassword, ctx.params.password, ctx.params.cpassword);
			if (error) return { json: { actionsuccess: false, actionerror: t(ctx.lang, error) } };
			return { json: { actionsuccess: true } };
		},

		register(ctx) {
			const message = t(ctx.lang, 'registerInClient', { host: config.serverHost });
			return { json: { actionsuccess: false, actionerror: message, error: message } };
		},

		getteams() {
			// Times ainda ficam só no navegador; ver CLAUDE.md (sincronização futura)
			return { json: { teams: [] } };
		},
	};
	for (const act of ['getteam', 'ladderget', 'uploadreplay', 'changeusername']) {
		clientActions[act] = ctx => ({ json: { actionsuccess: false, actionerror: t(ctx.lang, 'notAvailable') } });
	}

	async function changePasswordChecked(
		ctx: RequestContext, session: ActiveSession, current = '', password = '', confirm = ''
	): Promise<MessageKey | null> {
		const userid = session.user.userid;
		if (loginBlocked(ctx, userid)) return 'tooManyLoginAttempts';
		recordAttempt(ctx, userid);
		const result = await changePassword(db, session.user, current, password, confirm);
		// Senha atual correta: a tentativa não conta, mesmo que a troca falhe por outro motivo
		if (result.ok || result.error !== 'wrongPassword') forgiveAttempt(ctx, userid);
		if (!result.ok) return result.error;
		deleteOtherSessions(db, userid, session.token);
		return null;
	}

	// ---------------------------------------------------------------------
	// Páginas
	// ---------------------------------------------------------------------
	const error = (key: MessageKey): PageMessage => ({ kind: 'error', key });
	const success = (key: MessageKey): PageMessage => ({ kind: 'success', key });

	async function registerPage(ctx: RequestContext): Promise<string> {
		if (ctx.req.method !== 'POST') return renderRegister(ctx.lang, { invite: ctx.url.searchParams.get('convite') ?? '' });
		const { invite = '', username = '', password = '', confirm = '' } = ctx.params;
		const result = await register(db, invite, username, password, confirm, config.reservedNames);
		if (!result.ok) return renderRegister(ctx.lang, { msg: error(result.error), invite, username });
		if (ctx.session) deleteSession(db, ctx.session.token);
		startSession(ctx, result.value);
		console.log('[conta] nova conta criada');
		return renderRegister(ctx.lang, { done: true, msg: success('registered') });
	}

	async function resetPage(ctx: RequestContext): Promise<string> {
		if (ctx.req.method !== 'POST') return renderReset(ctx.lang, {});
		const { code = '', username = '', password = '', confirm = '' } = ctx.params;
		const result = await resetPassword(db, code, username, password, confirm);
		if (!result.ok) return renderReset(ctx.lang, { msg: error(result.error), username });
		return renderReset(ctx.lang, { done: true, msg: success('passwordReset') });
	}

	async function accountPage(ctx: RequestContext, sub: string): Promise<string> {
		const session = ctx.session;
		if (ctx.req.method !== 'POST' || !session) return renderAccount(ctx.lang, { user: session?.user ?? null });

		switch (sub) {
		case 'sair':
			deleteSession(db, session.token);
			ctx.cookies.push(clearSessionCookie(config.cookieSecure));
			return renderAccount(ctx.lang, { user: null, msg: success('loggedOut') });
		case 'senha': {
			const { current, password, confirm } = ctx.params;
			const failure = await changePasswordChecked(ctx, session, current, password, confirm);
			return renderAccount(ctx.lang, { user: session.user, msg: failure ? error(failure) : success('passwordChanged') });
		}
		case 'excluir': {
			if (ctx.params.confirm !== 'yes') return renderAccount(ctx.lang, { user: session.user, msg: error('confirmDeletion') });
			const userid = session.user.userid;
			if (loginBlocked(ctx, userid)) return renderAccount(ctx.lang, { user: session.user, msg: error('tooManyLoginAttempts') });
			recordAttempt(ctx, userid);
			const result = await deleteAccount(db, session.user, ctx.params.password || '');
			if (!result.ok) return renderAccount(ctx.lang, { user: session.user, msg: error(result.error) });
			forgiveAttempt(ctx, userid);
			ctx.cookies.push(clearSessionCookie(config.cookieSecure));
			console.log('[conta] conta excluída a pedido do titular');
			return renderAccount(ctx.lang, { user: null, msg: success('accountDeleted') });
		}
		default:
			return renderAccount(ctx.lang, { user: session.user });
		}
	}

	// ---------------------------------------------------------------------
	// API interna (servidor de jogo → login)
	// ---------------------------------------------------------------------
	function internalAuthorized(req: IncomingMessage): boolean {
		const header = req.headers.authorization || '';
		const expected = Buffer.from(`Bearer ${deps.internalToken}`);
		const given = Buffer.from(header);
		return given.length === expected.length && timingSafeEqual(given, expected);
	}

	function internalApi(path: string, params: Params): { status: number, body: unknown } {
		const inviteUrl = (code: string) => `https://${config.serverHost}/cadastro?convite=${encodeURIComponent(code)}`;
		switch (path) {
		case '/internal/invite': {
			let userid: string | null = null;
			if (params.username) {
				const name = normalizeUsername(params.username);
				if (!name.ok) return { status: 400, body: { ok: false, error: t('pt', name.error) } };
				if (getUser(db, name.value.userid)) return { status: 409, body: { ok: false, error: t('pt', 'nameTaken') } };
				userid = name.value.userid;
			}
			const issued = issueCode(db, 'invite', userid, INVITE_TTL_SECONDS);
			console.log(`[admin] convite gerado${userid ? ' (nome reservado)' : ''}`);
			return { status: 200, body: { ok: true, ...issued, url: inviteUrl(issued.code), userid } };
		}
		case '/internal/reset': {
			const user = getUser(db, toID(params.username));
			if (!user) return { status: 404, body: { ok: false, error: 'Usuário não encontrado.' } };
			// Só o código mais recente vale
			revokeCodes(db, 'reset', user.userid);
			const issued = issueCode(db, 'reset', user.userid, RESET_TTL_SECONDS);
			console.log('[admin] código de redefinição gerado');
			return { status: 200, body: { ok: true, ...issued, url: `https://${config.serverHost}/redefinir`, username: user.username } };
		}
		case '/internal/purges':
			// Contas excluídas cujos dados de jogo o servidor de jogo ainda precisa apagar
			return { status: 200, body: { ok: true, userids: listPendingPurges(db) } };
		case '/internal/purges/done': {
			const userid = toID(params.userid);
			if (!userid) return { status: 400, body: { ok: false, error: 'userid required' } };
			completePurge(db, userid);
			return { status: 200, body: { ok: true } };
		}
		default:
			return { status: 404, body: { ok: false, error: 'not found' } };
		}
	}

	// ---------------------------------------------------------------------
	// Infraestrutura HTTP
	// ---------------------------------------------------------------------
	function send(ctx: RequestContext, status: number, body: string, contentType: string, extra: Record<string, string> = {}) {
		const headers: Record<string, string | string[]> = {
			'Content-Type': contentType,
			'Cache-Control': 'no-store',
			'X-Content-Type-Options': 'nosniff',
			...extra,
		};
		if (ctx.cookies.length) headers['Set-Cookie'] = ctx.cookies;
		ctx.res.writeHead(status, headers);
		ctx.res.end(body);
	}
	const sendAction = (ctx: RequestContext, status: number, json: unknown) =>
		send(ctx, status, ']' + JSON.stringify(json), 'application/json; charset=utf-8');
	const sendPage = (ctx: RequestContext, html: string) =>
		send(ctx, 200, html, 'text/html; charset=utf-8', {
			'Content-Security-Policy': PAGE_CSP,
			'X-Frame-Options': 'DENY',
		});

	return async function handle(req: IncomingMessage, res: ServerResponse) {
		const url = new URL(req.url || '/', 'http://internal');
		const path = url.pathname;
		// O Caddy acrescenta o IP do cliente no fim do X-Forwarded-For; o que vem antes
		// pode ter sido enviado pelo próprio cliente. Só a última entrada é confiável.
		const forwarded = req.headers['x-forwarded-for'];
		const ip = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded)?.split(',').pop()?.trim() ||
			req.socket.remoteAddress || 'unknown';
		const ctx: RequestContext = {
			req, res, url, params: {}, ip, lang: detectLang(req.headers['accept-language']), session: null, cookies: [],
		};

		if (req.method === 'GET' && path === '/healthz') return send(ctx, 200, 'ok', 'text/plain; charset=utf-8');

		const isClientAction = /^\/~~[^/]+\/action\.php$/.test(path) || /^\/api\/[a-z]+\/?$/.test(path);
		const isServerAction = path === '/action.php';
		const pageMatch = /^\/(cadastro|redefinir|conta|privacidade)(?:\/(sair|senha|excluir))?\/?$/.exec(path);
		const isInternal = path.startsWith('/internal/');
		if (!isClientAction && !isServerAction && !pageMatch && !isInternal) {
			return send(ctx, 404, 'not found', 'text/plain; charset=utf-8');
		}
		if (req.method !== 'GET' && req.method !== 'POST') return send(ctx, 405, 'method not allowed', 'text/plain; charset=utf-8');

		// CSRF: navegadores sempre mandam Origin em POST; outra origem é recusada
		const origin = req.headers.origin;
		if (req.method === 'POST' && origin !== undefined && origin !== config.publicOrigin) {
			return send(ctx, 403, t(ctx.lang, 'badOrigin'), 'text/plain; charset=utf-8');
		}
		// Sem Origin: um navegador que informa Sec-Fetch-Site de outro site também é recusado
		const fetchSite = req.headers['sec-fetch-site'];
		if (req.method === 'POST' && origin === undefined && fetchSite && !['same-origin', 'none'].includes(String(fetchSite))) {
			return send(ctx, 403, t(ctx.lang, 'badOrigin'), 'text/plain; charset=utf-8');
		}

		if (!requestLimiter.allow(ctx.ip)) {
			return sendAction(ctx, 429, { actionerror: t(ctx.lang, 'tooManyRequests') });
		}

		let body = '';
		try {
			if (req.method === 'POST') body = await readBody(req);
		} catch {
			return send(ctx, 413, 'payload too large', 'text/plain; charset=utf-8');
		}

		if (isInternal) {
			if (req.method !== 'POST' || !internalAuthorized(req)) return send(ctx, 401, 'unauthorized', 'text/plain; charset=utf-8');
			const params: Params = {};
			try {
				const parsed: unknown = body ? JSON.parse(body) : {};
				if (parsed && typeof parsed === 'object') {
					for (const [key, value] of Object.entries(parsed)) {
						if (typeof value === 'string') params[key] = value;
					}
				}
			} catch {
				return send(ctx, 400, 'invalid json', 'text/plain; charset=utf-8');
			}
			const result = internalApi(path, params);
			return send(ctx, result.status, JSON.stringify(result.body), 'application/json; charset=utf-8');
		}

		ctx.params = { ...Object.fromEntries(url.searchParams), ...Object.fromEntries(new URLSearchParams(body)) };
		ctx.session = getSession(db, readCookie(req.headers.cookie, SESSION_COOKIE));
		if (ctx.session?.renewed) ctx.cookies.push(sessionCookie(ctx.session.token, config.cookieSecure));

		if (pageMatch) {
			if (req.method === 'POST' && !formLimiter.allow(ctx.ip)) {
				return send(ctx, 429, t(ctx.lang, 'tooManyRequests'), 'text/plain; charset=utf-8');
			}
			const [, page, sub = ''] = pageMatch;
			if (page === 'privacidade') {
				// Controlador: o primeiro admin de PS_ADMINS (nome como foi cadastrado)
				const [adminId] = config.reservedNames;
				const adminName = adminId ? (getUser(db, adminId)?.username || adminId) : 'admin';
				return sendPage(ctx, renderPrivacy(ctx.lang, adminName));
			}
			if (page === 'cadastro') return sendPage(ctx, await registerPage(ctx));
			if (page === 'redefinir') return sendPage(ctx, await resetPage(ctx));
			return sendPage(ctx, await accountPage(ctx, sub));
		}

		if (isServerAction) {
			// Chamadas periódicas do servidor de jogo (ex.: updateuserstats): nada é guardado
			return sendAction(ctx, 200, { actionsuccess: true });
		}

		const apiMatch = /^\/api\/([a-z]+)\/?$/.exec(path);
		const act = toID(apiMatch ? apiMatch[1] : ctx.params.act);
		const action = Object.hasOwn(clientActions, act) ? clientActions[act] : undefined;
		if (!action) return sendAction(ctx, 400, { actionerror: t(ctx.lang, 'unknownAction') });
		const result = await action(ctx);
		if ('text' in result) return send(ctx, 200, result.text, 'text/plain; charset=utf-8');
		return sendAction(ctx, 200, result.json);
	};
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

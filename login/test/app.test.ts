/**
 * Testes de integração do login server (node:test, sem dependências).
 * Rodar: docker compose run --rm --no-deps login npm test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { createVerify } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.ts';
import { openDatabase, type Database } from '../src/db.ts';
import { getUser } from '../src/accounts.ts';
import { ensureKeyPair } from '../src/keys.ts';
import type { LoginConfig } from '../src/config.ts';
import {
	listSecurityEvents, purgeSecurityEvents, recordSecurityEvent, SECURITY_RETENTION_SECONDS,
} from '../src/security-events.ts';

const HOST = 'ps.test';
const ORIGIN = `https://${HOST}`;
const TOKEN = 'token-de-teste';
const CHALLENGE = 'abc123def456';
const CHALLSTR = `1|${CHALLENGE}`;

let server: Server;
let base = '';
let db: Database;
let tmp = '';
let publicPem = '';

before(async () => {
	tmp = mkdtempSync(join(tmpdir(), 'login-test-'));
	const config: LoginConfig = {
		port: 0, privateKeyDir: join(tmp, 'private'), sharedDir: join(tmp, 'shared'), databasePath: ':memory:',
		keyId: 1, serverHost: HOST, publicOrigin: ORIGIN, cookieSecure: true, reservedNames: new Set(['admintest']),
	};
	db = openDatabase(':memory:');
	const privateKey = ensureKeyPair(config.privateKeyDir, config.sharedDir);
	publicPem = readFileSync(join(config.sharedDir, 'public.pem'), 'utf8');
	const handle = createApp({
		db, config, assertion: { privateKey, keyId: 1, serverHost: HOST }, internalToken: TOKEN,
		// Todas as requisições do teste vêm do mesmo IP
		limits: { requestsPerMinute: 10_000, formsPerMinute: 10_000 },
	});
	server = createServer((req, res) => void handle(req, res));
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (typeof address !== 'object' || !address) throw new Error('sem endereço');
	base = `http://127.0.0.1:${address.port}`;
});

after(() => {
	server.close();
	db.close();
	rmSync(tmp, { recursive: true, force: true });
});

// --- auxiliares -----------------------------------------------------------

interface Reply { status: number, text: string, cookie: string | null, json: any }

async function post(
	path: string, form: Record<string, string>,
	opts: { cookie?: string, origin?: string | null, headers?: Record<string, string> } = {}
): Promise<Reply> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/x-www-form-urlencoded', 'Accept-Language': 'pt-BR', ...opts.headers,
	};
	if (opts.origin !== null) headers.Origin = opts.origin ?? ORIGIN;
	if (opts.cookie) headers.Cookie = opts.cookie;
	const res = await fetch(base + path, { method: 'POST', headers, body: new URLSearchParams(form) });
	const text = await res.text();
	const setCookie = res.headers.get('set-cookie');
	let json: any = null;
	if (text.startsWith(']')) json = JSON.parse(text.slice(1));
	return { status: res.status, text, cookie: setCookie, json };
}

const action = (act: string, form: Record<string, string> = {}, cookie?: string) =>
	post('/~~custom/action.php', { act, ...form }, { cookie });

async function internal(path: string, body: unknown, token = TOKEN) {
	const res = await fetch(base + path, {
		method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
	});
	return { status: res.status, json: await res.json().catch(() => null) as any };
}

/** Extrai "ps_session=..." de um Set-Cookie. */
const sessionOf = (setCookie: string | null) => setCookie?.split(';')[0] ?? '';

function verifyAssertion(assertion: string, userid: string, userType: string) {
	const [data, signature] = assertion.split(';');
	const [challenge, signedUserid, signedType, , host] = data.split(',');
	assert.equal(challenge, CHALLENGE);
	assert.equal(signedUserid, userid);
	assert.equal(signedType, userType);
	assert.equal(host, HOST);
	const verifier = createVerify('RSA-SHA256');
	verifier.update(data);
	assert.ok(verifier.verify(publicPem, signature, 'hex'), 'assinatura RSA deve ser válida');
}

async function newInvite(username?: string): Promise<string> {
	const res = await internal('/internal/invite', username ? { username } : {});
	assert.equal(res.status, 200);
	return res.json.code;
}

async function registerUser(name: string, password = 'senha-forte-1') {
	const invite = await newInvite();
	const res = await post('/cadastro', { invite, username: name, password, confirm: password });
	assert.equal(res.status, 200);
	assert.match(res.text, /Conta criada/);
	return sessionOf(res.cookie);
}

// --- testes ---------------------------------------------------------------

test('nome sem conta não recebe assertion (servidor exige conta)', async () => {
	const res = await action('getassertion', { userid: 'ninguem', challstr: CHALLSTR });
	assert.match(res.text, /^;;.*\/cadastro/);
});

test('cadastro com convite cria conta, sessão e cookie seguro', async () => {
	const invite = await newInvite();
	const res = await post('/cadastro', { invite, username: 'Ash Ketchum', password: 'pikachu123', confirm: 'pikachu123' });
	assert.match(res.text, /Conta criada/);
	assert.ok(res.cookie);
	for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=2592000']) assert.ok(res.cookie.includes(flag), flag);

	const upkeep = await action('upkeep', { challstr: CHALLSTR }, sessionOf(res.cookie));
	assert.equal(upkeep.json.loggedin, true);
	assert.equal(upkeep.json.username, 'Ash Ketchum');
	verifyAssertion(upkeep.json.assertion, 'ashketchum', '2');

	// Com a sessão, getassertion do próprio nome é assinada como registrado
	const own = await action('getassertion', { userid: 'ashketchum', challstr: CHALLSTR }, sessionOf(res.cookie));
	verifyAssertion(own.text, 'ashketchum', '2');
});

test('convite é de uso único e nome não pode repetir', async () => {
	const invite = await newInvite();
	const first = await post('/cadastro', { invite, username: 'Misty', password: 'agua-forte', confirm: 'agua-forte' });
	assert.match(first.text, /Conta criada/);
	const reuse = await post('/cadastro', { invite, username: 'Misty2', password: 'agua-forte', confirm: 'agua-forte' });
	assert.match(reuse.text, /inválido, já usado ou expirado/);
	const dup = await post('/cadastro', { invite: await newInvite(), username: 'misty', password: 'agua-forte', confirm: 'agua-forte' });
	assert.match(dup.text, /já está em uso/);
});

test('convite reservado só serve para o nome indicado', async () => {
	const invite = await newInvite('Brock');
	const wrong = await post('/cadastro', { invite, username: 'Gary', password: 'pedra-dura1', confirm: 'pedra-dura1' });
	assert.match(wrong.text, /outro nome de usuário/);
	const right = await post('/cadastro', { invite, username: 'Brock', password: 'pedra-dura1', confirm: 'pedra-dura1' });
	assert.match(right.text, /Conta criada/);
});

test('política de senha e nomes reservados', async () => {
	const invite = await newInvite();
	const short = await post('/cadastro', { invite, username: 'Oak', password: 'curta', confirm: 'curta' });
	assert.match(short.text, /pelo menos 8/);
	const mismatch = await post('/cadastro', { invite, username: 'Oak', password: 'senha-longa', confirm: 'outra-senha' });
	assert.match(mismatch.text, /não conferem/);
	const same = await post('/cadastro', { invite, username: 'Professor Oak', password: 'professoroak', confirm: 'professoroak' });
	assert.match(same.text, /igual ao nome/);
	const guest = await post('/cadastro', { invite, username: 'Guest 123', password: 'senha-longa', confirm: 'senha-longa' });
	assert.match(guest.text, /reservado/);
	const pipe = await post('/cadastro', { invite, username: 'a|b', password: 'senha-longa', confirm: 'senha-longa' });
	assert.match(pipe.text, /não pode conter/);
});

test('login pelo cliente: conta sem sessão pede senha; senha certa devolve assertion', async () => {
	await registerUser('Dawn', 'piplup-azul');
	const ask = await action('getassertion', { userid: 'dawn', challstr: CHALLSTR });
	assert.equal(ask.text, ';');

	const wrong = await action('login', { name: 'Dawn', pass: 'errada!!', challstr: CHALLSTR });
	assert.equal(wrong.json.actionsuccess, false);
	assert.match(wrong.json.error, /incorretos/);

	const ok = await action('login', { name: 'Dawn', pass: 'piplup-azul', challstr: CHALLSTR });
	assert.equal(ok.json.actionsuccess, true);
	assert.deepEqual(ok.json.curuser, { loggedin: true, username: 'Dawn', userid: 'dawn' });
	verifyAssertion(ok.json.assertion, 'dawn', '2');
	assert.ok(ok.cookie?.includes('HttpOnly'));

	const logout = await action('logout', { userid: 'dawn' }, sessionOf(ok.cookie));
	assert.equal(logout.json.actionsuccess, true);
	const after = await action('upkeep', { challstr: CHALLSTR }, sessionOf(ok.cookie));
	assert.equal(after.json.loggedin, false);
});

test('POST de outra origem é recusado (CSRF)', async () => {
	const res = await post('/~~custom/action.php', { act: 'upkeep' }, { origin: 'https://site-malicioso.example' });
	assert.equal(res.status, 403);
	const page = await post('/conta/excluir', { password: 'x', confirm: 'yes' }, { origin: 'null' });
	assert.equal(page.status, 403);
});

test('API interna exige token', async () => {
	assert.equal((await internal('/internal/invite', {}, 'token-errado')).status, 401);
	const reset = await internal('/internal/reset', { username: 'naoexiste' });
	assert.equal(reset.status, 404);
	const res = await internal('/internal/invite', {});
	assert.match(res.json.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
	assert.ok(res.json.url.startsWith(`https://${HOST}/cadastro?convite=`));
});

test('troca de senha encerra as outras sessões', async () => {
	const sessionA = await registerUser('Serena', 'fennekin-01');
	const login = await action('login', { name: 'Serena', pass: 'fennekin-01', challstr: CHALLSTR });
	const sessionB = sessionOf(login.cookie);

	const change = await action('changepassword', { oldpassword: 'fennekin-01', password: 'braixen-02', cpassword: 'braixen-02' }, sessionA);
	assert.equal(change.json.actionsuccess, true);
	assert.equal((await action('upkeep', {}, sessionA)).json.loggedin, true);
	assert.equal((await action('upkeep', {}, sessionB)).json.loggedin, false);
	const relogin = await action('login', { name: 'Serena', pass: 'braixen-02', challstr: CHALLSTR });
	assert.equal(relogin.json.actionsuccess, true);
});

test('redefinição por código do admin', async () => {
	const session = await registerUser('Iris', 'axew-dragao');
	const { json } = await internal('/internal/reset', { username: 'Iris' });
	const wrongUser = await post('/redefinir', { code: json.code, username: 'Dawn', password: 'nova-senha-1', confirm: 'nova-senha-1' });
	assert.match(wrongUser.text, /inválido/);
	const ok = await post('/redefinir', { code: json.code, username: 'Iris', password: 'nova-senha-1', confirm: 'nova-senha-1' });
	assert.match(ok.text, /Senha redefinida/);
	assert.equal((await action('upkeep', {}, session)).json.loggedin, false, 'sessão antiga encerrada');
	const reuse = await post('/redefinir', { code: json.code, username: 'Iris', password: 'outra-senha-2', confirm: 'outra-senha-2' });
	assert.match(reuse.text, /inválido/);
	assert.equal((await action('login', { name: 'Iris', pass: 'nova-senha-1', challstr: CHALLSTR })).json.actionsuccess, true);
});

test('exclusão de conta exige confirmação e senha, e apaga tudo', async () => {
	const session = await registerUser('Cilan', 'pansage-verde');
	const page = await fetch(`${base}/conta`, { headers: { Cookie: session, 'Accept-Language': 'pt-BR' } }).then(r => r.text());
	assert.match(page, /inclusive times salvos, conquistas e insígnias/);

	const noConfirm = await post('/conta/excluir', { password: 'pansage-verde' }, { cookie: session });
	assert.match(noConfirm.text, /Marque a confirmação/);
	const wrong = await post('/conta/excluir', { password: 'errada-123', confirm: 'yes' }, { cookie: session });
	assert.match(wrong.text, /incorretos/);
	const ok = await post('/conta/excluir', { password: 'pansage-verde', confirm: 'yes' }, { cookie: session });
	assert.match(ok.text, /foram excluídos/);

	assert.equal((await action('upkeep', {}, session)).json.loggedin, false);
	assert.match((await action('getassertion', { userid: 'cilan', challstr: CHALLSTR })).text, /^;;/);
	const left = db.prepare('SELECT (SELECT COUNT(*) FROM users WHERE userid = ?) + (SELECT COUNT(*) FROM sessions WHERE userid = ?) AS n')
		.get('cilan', 'cilan') as { n: number };
	assert.equal(left.n, 0);
});

test('exclusão de conta entra na fila de dados de jogo até o servidor confirmar', async () => {
	const session = await registerUser('Forrest', 'onix-rocha-1');
	const pending = async () => (await internal('/internal/purges', {})).json.userids as string[];
	assert.ok(!(await pending()).includes('forrest'));
	await post('/conta/excluir', { password: 'onix-rocha-1', confirm: 'yes' }, { cookie: session });
	assert.equal((await internal('/internal/purges', {}, 'token-errado')).status, 401);
	assert.ok((await pending()).includes('forrest'));

	// Enquanto os dados de jogo não forem apagados, o nome não pode ser recadastrado
	const invite = await newInvite();
	const blocked = await post('/cadastro', { invite, username: 'Forrest', password: 'outra-senha-1', confirm: 'outra-senha-1' });
	assert.match(blocked.text, /sendo liberado/);

	assert.equal((await internal('/internal/purges/done', { userid: 'Forrest' })).status, 200);
	assert.ok(!(await pending()).includes('forrest'));
	const again = await post('/cadastro', { invite, username: 'Forrest', password: 'outra-senha-1', confirm: 'outra-senha-1' });
	assert.match(again.text, /Conta criada/);
});

test('nomes de admin só com convite reservado', async () => {
	const open = await newInvite();
	const blocked = await post('/cadastro', { invite: open, username: 'AdminTest', password: 'senha-forte-1', confirm: 'senha-forte-1' });
	assert.match(blocked.text, /reservado/);
	const reserved = await newInvite('AdminTest');
	const ok = await post('/cadastro', { invite: reserved, username: 'AdminTest', password: 'senha-forte-1', confirm: 'senha-forte-1' });
	assert.match(ok.text, /Conta criada/);
});

test('troca de senha e novo código anulam códigos de redefinição antigos', async () => {
	const session = await registerUser('Clemont', 'luxray-forte1');
	const first = (await internal('/internal/reset', { username: 'Clemont' })).json.code;
	const second = (await internal('/internal/reset', { username: 'Clemont' })).json.code;
	const old = await post('/redefinir', { code: first, username: 'Clemont', password: 'nova-senha-01', confirm: 'nova-senha-01' });
	assert.match(old.text, /inválido|expirado/, 'código anterior anulado pelo novo');
	await action('changepassword', { oldpassword: 'luxray-forte1', password: 'outra-senha-1', cpassword: 'outra-senha-1' }, session);
	const after = await post('/redefinir', { code: second, username: 'Clemont', password: 'nova-senha-01', confirm: 'nova-senha-01' });
	assert.match(after.text, /inválido|expirado/, 'código anulado pela troca de senha');
});

test('bloqueio por tentativas não afeta a conta a partir de outro IP', async () => {
	await registerUser('Bonnie', 'dedenne-01x');
	const attacker = { 'X-Forwarded-For': '203.0.113.7' };
	for (let i = 0; i < 10; i++) {
		await post('/~~custom/action.php', { act: 'login', name: 'Bonnie', pass: `errada-${i}`, challstr: CHALLSTR }, { headers: attacker });
	}
	const blocked = await post('/~~custom/action.php', { act: 'login', name: 'Bonnie', pass: 'dedenne-01x', challstr: CHALLSTR }, { headers: attacker });
	assert.equal(blocked.json.actionsuccess, false, 'o IP do atacante fica bloqueado');
	const owner = await post('/~~custom/action.php', { act: 'login', name: 'Bonnie', pass: 'dedenne-01x', challstr: CHALLSTR },
		{ headers: { 'X-Forwarded-For': '198.51.100.20' } });
	assert.equal(owner.json.actionsuccess, true, 'a dona da conta entra a partir do próprio IP');
	// Só a última entrada do X-Forwarded-For (a do proxy) conta: forjar a primeira não escapa do bloqueio
	const spoofed = await post('/~~custom/action.php', { act: 'login', name: 'Bonnie', pass: 'dedenne-01x', challstr: CHALLSTR },
		{ headers: { 'X-Forwarded-For': '198.51.100.99, 203.0.113.7' } });
	assert.equal(spoofed.json.actionsuccess, false);
});

test('POST sem Origin vindo de outro site é recusado', async () => {
	const res = await post('/~~custom/action.php', { act: 'upkeep' }, { origin: null, headers: { 'Sec-Fetch-Site': 'cross-site' } });
	assert.equal(res.status, 403);
	const sameSite = await post('/~~custom/action.php', { act: 'upkeep' }, { origin: null, headers: { 'Sec-Fetch-Site': 'same-origin' } });
	assert.equal(sameSite.status, 200);
});

test('botão de ver a senha: script próprio, só da mesma origem', async () => {
	const page = await fetch(`${base}/cadastro`);
	const csp = page.headers.get('content-security-policy') || '';
	assert.match(csp, /script-src 'self'/);
	assert.doesNotMatch(csp, /unsafe-inline'[^;]*script|script-src[^;]*unsafe/);
	assert.match(await page.text(), /<script src="\/conta\.js" defer><\/script>/);
	const script = await fetch(`${base}/conta.js`);
	assert.equal(script.status, 200);
	assert.match(script.headers.get('content-type') || '', /javascript/);
	assert.match(await script.text(), /input\[type=password\]/);
});

test('aviso de privacidade em pt e en, com o administrador', async () => {
	const pt = await fetch(`${base}/privacidade`, { headers: { 'Accept-Language': 'pt-BR' } });
	const html = await pt.text();
	assert.equal(pt.status, 200);
	assert.match(html, /Aviso de privacidade/);
	assert.match(html, /<strong>admintest<\/strong>/i, 'controlador: o admin de PS_ADMINS');
	assert.match(html, /30 dias/);
	assert.match(html, /IA Mestre/, 'dados anônimos de aprendizado da IA');
	assert.match(pt.headers.get('content-security-policy') || '', /default-src 'none'/);
	const en = await fetch(`${base}/privacidade`, { headers: { 'Accept-Language': 'en-US' } }).then(r => r.text());
	assert.match(en, /Privacy notice/);
	const account = await fetch(`${base}/cadastro`, { headers: { 'Accept-Language': 'pt-BR' } }).then(r => r.text());
	assert.match(account, /href="\/privacidade"/);
});

test('idioma escolhido: ?lang grava o cookie ps_lang, que vale mais que o navegador', async () => {
	const chosen = await fetch(`${base}/regras?lang=en`, { headers: { 'Accept-Language': 'pt-BR' } });
	assert.match(await chosen.text(), /<h3>Rules<\/h3>/);
	const cookie = chosen.headers.get('set-cookie') || '';
	assert.match(cookie, /^ps_lang=en; Path=\/; Max-Age=31536000; SameSite=Lax/);
	assert.doesNotMatch(cookie, /HttpOnly/, 'o cliente também grava este cookie');
	const withCookie = await fetch(`${base}/cadastro`, { headers: { 'Accept-Language': 'pt-BR', Cookie: 'ps_lang=en' } });
	const html = await withCookie.text();
	assert.match(html, /Sign up/);
	assert.match(html, /<a href="\?lang=pt" lang="pt-BR"/, 'link para trocar o idioma');
	const invalid = await fetch(`${base}/regras?lang=xx`, { headers: { 'Accept-Language': 'pt-BR', Cookie: 'ps_lang=<b>' } });
	assert.match(await invalid.text(), /<h3>Regras<\/h3>/);
	assert.equal(invalid.headers.get('set-cookie'), null);
});

test('regras em pt e en, com o administrador', async () => {
	const pt = await fetch(`${base}/regras`, { headers: { 'Accept-Language': 'pt-BR' } });
	const html = await pt.text();
	assert.equal(pt.status, 200);
	assert.match(html, /<h3>Regras<\/h3>/);
	assert.match(html, /Desafio de Ginásios/);
	assert.match(html, /Proibido: trapaça/);
	assert.match(html, /<strong>admintest<\/strong>/i, 'contato: o admin de PS_ADMINS');
	assert.match(pt.headers.get('content-security-policy') || '', /default-src 'none'/);
	const en = await fetch(`${base}/regras`, { headers: { 'Accept-Language': 'en-US' } }).then(r => r.text());
	assert.match(en, /Gym Challenge/);
	const sub = await fetch(`${base}/regras/sair`);
	assert.equal(sub.status, 404);
});

test('limite de tentativas de senha por conta', async () => {
	await registerUser('Lance', 'dragonite-9');
	for (let i = 0; i < 10; i++) await action('login', { name: 'Lance', pass: `errada-${i}`, challstr: CHALLSTR });
	const blocked = await action('login', { name: 'Lance', pass: 'dragonite-9', challstr: CHALLSTR });
	assert.equal(blocked.json.actionsuccess, false);
	assert.match(blocked.json.error, /Muitas tentativas/);
});

test('cadastro pelo cliente aponta para a página de convite', async () => {
	const res = await action('register', { username: 'x', password: 'y', cpassword: 'y', captcha: 'pikachu' });
	assert.equal(res.json.actionsuccess, false);
	assert.match(res.json.actionerror, /\/cadastro/);
});

test('lista e revoga convites pendentes pela API interna', async () => {
	assert.equal((await internal('/internal/invites', {}, 'token-errado')).status, 401);
	assert.equal((await internal('/internal/invites/revoke', { id: '1' }, 'token-errado')).status, 401);
	const pendingIds = async () => (await internal('/internal/invites', {})).json.invites as
		{ id: number, userid: string | null, createdAt: number, expiresAt: number }[];
	const before = (await pendingIds()).length;

	const open = await newInvite();
	await newInvite('Gardenia');
	const list = await pendingIds();
	assert.equal(list.length, before + 2);
	const reserved = list.find(invite => invite.userid === 'gardenia');
	assert.ok(reserved, 'convite com nome reservado aparece com o nome');
	assert.ok(reserved.expiresAt > reserved.createdAt);
	assert.ok(!JSON.stringify(list).includes(open), 'a lista nunca traz o código');

	// Revogado: some da lista e não serve mais no cadastro
	assert.equal((await internal('/internal/invites/revoke', { id: String(reserved.id) })).status, 200);
	assert.equal((await internal('/internal/invites/revoke', { id: String(reserved.id) })).status, 404);
	assert.equal((await internal('/internal/invites/revoke', { id: 'x' })).status, 400);
	assert.equal((await pendingIds()).length, before + 1);

	// Usado: some da lista
	const res = await post('/cadastro', { invite: open, username: 'Roark', password: 'cranidos-1', confirm: 'cranidos-1' });
	assert.match(res.text, /Conta criada/);
	assert.equal((await pendingIds()).length, before);
});

test('erros da API interna no idioma de quem pediu', async () => {
	await registerUser('Wallace');
	const taken = await internal('/internal/invite', { username: 'Wallace', lang: 'en' });
	assert.equal(taken.json.error, 'That name is already taken.');
	assert.equal((await internal('/internal/invite', { username: 'Wallace' })).json.error, 'Esse nome já está em uso.');
	assert.equal((await internal('/internal/reset', { username: 'ninguem', lang: 'en' })).json.error, 'User not found.');
	assert.equal((await internal('/internal/reset', { username: 'ninguem', lang: 'pt' })).json.error, 'Usuário não encontrado.');
});

test('trilha de segurança: falhas, bloqueio, mudanças na conta e pedidos recusados', async () => {
	const events = (filter: { type?: string, userid?: string } = {}) =>
		listSecurityEvents(db, filter as Parameters<typeof listSecurityEvents>[1]);

	// Cadastro, código inválido e troca de senha
	const session = await registerUser('Volkner', 'luxray-123');
	assert.equal(events({ type: 'accountcreated', userid: 'volkner' }).length, 1);
	assert.ok(events({ type: 'accountcreated', userid: 'volkner' })[0].ip, 'guarda o IP');
	await post('/cadastro', { invite: 'AAAA-BBBB-CCCC-DDDD', username: 'Flint', password: 'x', confirm: 'x' });
	assert.equal(events({ type: 'codefailed', userid: 'flint' })[0].detail, 'convite');
	await post('/conta/senha', { current: 'luxray-123', password: 'luxray-456', confirm: 'luxray-456' }, { cookie: session });
	assert.equal(events({ type: 'passwordchanged', userid: 'volkner' }).length, 1);

	// Senha errada e bloqueio: o bloqueio entra uma vez por minuto, mesmo com várias tentativas
	for (let i = 0; i < 10; i++) await action('login', { name: 'Volkner', pass: `errada-${i}`, challstr: CHALLSTR });
	assert.equal(events({ type: 'loginfailed', userid: 'volkner' }).length, 10);
	for (let i = 0; i < 3; i++) await action('login', { name: 'Volkner', pass: 'luxray-456', challstr: CHALLSTR });
	const blocked = events({ type: 'loginblocked', userid: 'volkner' });
	assert.equal(blocked.length, 1);
	assert.equal(blocked[0].detail, 'login');

	// Exclusão: os eventos da conta ficam até o prazo
	const other = await registerUser('Cynthia', 'garchomp-1');
	await post('/conta/excluir', { password: 'garchomp-1', confirm: 'yes' }, { cookie: other });
	assert.equal(events({ type: 'accountdeleted', userid: 'cynthia' }).length, 1);
	assert.equal(events({ type: 'accountcreated', userid: 'cynthia' }).length, 1, 'eventos ficam depois da exclusão');

	// Pedidos recusados (os testes anteriores, do mesmo IP, já podem ter gravado o do minuto)
	await post('/conta/senha', { current: 'x', password: 'y', confirm: 'y' }, { origin: 'https://evil.example' });
	assert.ok(events({ type: 'csrfrejected' }).length >= 1);
	await internal('/internal/purges', {}, 'token-errado');
	assert.ok(events({ type: 'internalunauthorized' }).length >= 1);
	assert.ok(events({ type: 'internalunauthorized' }).length <= 1, 'no máximo um por minuto para o mesmo IP');

	// Convites e redefinição pelo admin, com o autor
	const invite = await internal('/internal/invite', { username: 'Byron', actor: 'Admin Test' });
	assert.equal(invite.status, 200);
	assert.equal(events({ type: 'inviteissued', userid: 'byron' })[0].actor, 'admintest');
	const pending = (await internal('/internal/invites', {})).json.invites as { id: number, userid: string }[];
	const byron = pending.find(item => item.userid === 'byron')!;
	await internal('/internal/invites/revoke', { id: String(byron.id), actor: 'Admin Test' });
	assert.equal(events({ type: 'inviterevoked' })[0].detail, `#${byron.id}`);
	await internal('/internal/reset', { username: 'Volkner', actor: 'Admin Test' });
	assert.equal(events({ type: 'resetissued', userid: 'volkner' })[0].actor, 'admintest');

	// Consulta pela API interna, com filtro e resumo das últimas 24 horas
	const list = await internal('/internal/security-events', { type: 'loginfailed', userid: 'Volkner' });
	assert.equal(list.status, 200);
	assert.equal(list.json.events.length, 10);
	assert.ok(list.json.events.every((event: { type: string }) => event.type === 'loginfailed'));
	assert.ok(list.json.summary.some((row: { type: string, count: number }) => row.type === 'loginfailed' && row.count >= 10));
	const page2 = await internal('/internal/security-events', { userid: 'volkner', before: String(list.json.events[4].id) });
	assert.ok(page2.json.events.every((event: { id: number }) => event.id < list.json.events[4].id));
	assert.equal((await internal('/internal/security-events', {}, 'token-errado')).status, 401);
});

test('trilha de segurança: eventos com mais de 30 dias são apagados', () => {
	const now = Math.floor(Date.now() / 1000);
	recordSecurityEvent(db, 'loginfailed', { userid: 'antigo' }, now - SECURITY_RETENTION_SECONDS - 60);
	recordSecurityEvent(db, 'loginfailed', { userid: 'recente' }, now - 60);
	purgeSecurityEvents(db, now);
	assert.equal(listSecurityEvents(db, { userid: 'antigo' }).length, 0);
	assert.equal(listSecurityEvents(db, { userid: 'recente' }).length, 1);
});

test('troca de nome pelo admin: senha mantida, sessões encerradas e trilha', async () => {
	const session = await registerUser('Jos', 'cinder-123');
	const reset = await internal('/internal/reset', { username: 'Jos' });
	assert.equal(reset.status, 200);

	const renamed = await internal('/internal/rename', { userid: 'jos', username: 'Jose', actor: 'Admin Test' });
	assert.equal(renamed.status, 200);
	assert.deepEqual([renamed.json.userid, renamed.json.username, renamed.json.previous], ['jose', 'Jose', 'jos']);
	assert.equal(getUser(db, 'jos'), null);
	// A sessão antiga não vale mais; a senha é a mesma
	assert.equal((await action('upkeep', { challstr: CHALLSTR }, session)).json.loggedin, false);
	const login = await action('login', { name: 'Jose', pass: 'cinder-123', challstr: CHALLSTR });
	assert.equal(login.json.actionsuccess, true);
	// O código de redefinição acompanha a conta
	const used = await post('/redefinir', { code: reset.json.code, username: 'Jose', password: 'cinder-456', confirm: 'cinder-456' });
	assert.match(used.text, /Senha redefinida/);
	const event = listSecurityEvents(db, { type: 'accountrenamed', userid: 'jose' })[0];
	assert.deepEqual([event.actor, event.detail], ['admintest', 'jos']);

	// Só o nome exibido (mesmo identificador): sessões continuam
	const display = await internal('/internal/rename', { userid: 'jose', username: 'JOSE' });
	assert.equal(display.json.username, 'JOSE');
	assert.equal(getUser(db, 'jose')?.username, 'JOSE');

	// Recusas
	await registerUser('Gardenia2', 'turtwig-12');
	assert.equal((await internal('/internal/rename', { userid: 'jose', username: 'Gardenia2' })).status, 400);
	assert.equal((await internal('/internal/rename', { userid: 'naoexiste', username: 'Outro', lang: 'en' })).json.error, 'User not found.');
	assert.equal((await internal('/internal/rename', { userid: 'jose', username: 'admintest' })).status, 400);
	assert.equal((await internal('/internal/rename', { userid: 'jose', username: 'a|b' })).status, 400);
});

test('nomes com acento: a letra base fica no identificador', async () => {
	const zepe = await internal('/internal/invite', {});
	const res = await post('/cadastro', { invite: zepe.json.code, username: 'ZéPe', password: 'senha-forte-1', confirm: 'senha-forte-1' });
	assert.match(res.text, /Conta criada/);
	const user = getUser(db, 'zepe');
	assert.ok(user, 'identificador com a letra base');
	assert.equal(user.username, 'ZéPe', 'acento combinante (o PS aceita)');
	assert.equal(user.username.normalize('NFC'), 'ZéPe');
	// Mesmo identificador: o nome sem acento já está em uso
	const again = await post('/cadastro', {
		invite: (await internal('/internal/invite', {})).json.code, username: 'ZePe', password: 'senha-forte-1', confirm: 'senha-forte-1',
	});
	assert.match(again.text, /já está em uso/);
	// Longo demais com os acentos separados: saem só os acentos
	const long = await internal('/internal/rename', { userid: 'zepe', username: 'Árvore Grande Bela' });
	assert.equal(long.json.username, 'Arvore Grande Bela');
	assert.equal(long.json.userid, 'arvoregrandebela');
});
